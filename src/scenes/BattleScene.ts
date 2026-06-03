import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { Battle } from '../game/battle';
import { ITEMS, SPELLS } from '../game/content';
import { getRun, grantBattleLoot, returnToTown, saveProgress, setFlag } from '../game/run';
import { grantXp, xpForLevel } from '../game/progression';
import { input, attachTouchControls, isTouchDevice } from '../game/input';
import { music } from '../audio/music';
import { sharpText, FONT } from '../ui/text';
import type { BattleEvent, Combatant, Command } from '../game/types';

type UIState = 'menu' | 'target' | 'submenu' | 'subtarget' | 'busy' | 'over';

interface PendingAction {
  kind: 'attack' | 'spell' | 'item';
  id?: string; // spell or item id
}

interface MenuOption {
  label: string;
  action: 'attack' | 'magic' | 'item' | 'defend' | 'flee';
  enabled: boolean;
}

interface BarSet {
  bg: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  label?: Phaser.GameObjects.Text;
}

/**
 * Battle presentation layer. Drives the Battle engine by collecting commands
 * through menus, then playing the round events with animation.
 * Arrows = navigate, Z/Enter/Space = confirm, X/Backspace = cancel.
 */
export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private ui: UIState = 'menu';

  // Input
  private order: Combatant[] = []; // living party in command order
  private pos = 0;
  private menuIndex = 0;
  private options: MenuOption[] = [];
  private subIndex = 0;
  private subItems: { id: string; label: string; enabled: boolean }[] = [];
  private pending: PendingAction | null = null;
  private targets: Combatant[] = [];
  private targetIndex = 0;

  // Display
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private spriteHome = new Map<string, { x: number; y: number }>();
  private hpDisplay = new Map<string, number>();
  private mpDisplay = new Map<string, number>();
  private cursor!: Phaser.GameObjects.Text;
  private menuText: Phaser.GameObjects.Text[] = [];
  private logText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private enemyHpBars = new Map<string, BarSet>();
  private partyXpBars = new Map<string, BarSet>();
  private partyHpBars = new Map<string, BarSet>();
  private log: string[] = [];
  private unsubs: (() => void)[] = [];
  private touchCleanups: (() => void)[] = [];

  constructor() {
    super('Battle');
  }

  private resetState() {
    this.ui = 'menu';
    this.order = [];
    this.pos = 0;
    this.menuIndex = 0;
    this.options = [];
    this.subIndex = 0;
    this.subItems = [];
    this.pending = null;
    this.targets = [];
    this.targetIndex = 0;
    this.sprites.clear();
    this.spriteHome.clear();
    this.hpDisplay.clear();
    this.mpDisplay.clear();
    this.enemyHpBars.clear();
    this.partyXpBars.clear();
    this.partyHpBars.clear();
    this.menuText = [];
    this.log = [];
    this.unsubs = [];
    this.touchCleanups = [];
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    // Phaser reuses scene instances between battles, so reset all state.
    this.resetState();

    const run = getRun();
    const enemies = (this.scene.settings.data as { enemies: Combatant[] }).enemies;
    this.battle = new Battle(run.party, enemies, run.inventory);

    this.buildBackground();

    this.buildSprites();
    this.buildPanels();
    this.cursor = this.add.text(0, 0, '>', sharpText({ fontFamily: FONT, fontSize: '11px', color: '#f0d36c' })).setDepth(20).setVisible(false);

    this.bindKeys();
    this.syncDisplay();
    music.play('battle');
    this.pushLog('Enemies appear!');
    this.startCommandPhase();
  }

  // --- Layout ---------------------------------------------------------------

  private buildBackground() {
    this.add.rectangle(0, 0, GAME.width, GAME.height, 0x070b18).setOrigin(0, 0).setDepth(0);
    this.add.rectangle(0, 0, GAME.width, 78, 0x0b1530, 0.88).setOrigin(0, 0).setDepth(1);
    this.add.rectangle(0, 78, GAME.width, 90, 0x13243a, 0.92).setOrigin(0, 0).setDepth(1);
    this.add.rectangle(0, 128, GAME.width, 40, 0x0b101c, 0.38).setOrigin(0, 0).setDepth(2);

    for (let x = 18; x < GAME.width; x += 46) {
      const h = Phaser.Math.Between(26, 56);
      this.add.rectangle(x, 78 - h, 18, h, 0x15284a, 0.72).setOrigin(0.5, 0).setDepth(2);
      this.add.rectangle(x + 12, 84 - h, 10, h - 10, 0x0d1b34, 0.78).setOrigin(0.5, 0).setDepth(2);
    }

    this.add.ellipse(102, 142, 190, 34, 0x000000, 0.24).setDepth(3);
    this.add.ellipse(372, 142, 156, 30, 0x000000, 0.22).setDepth(3);

    for (let i = 0; i < 18; i++) {
      this.add.circle(Phaser.Math.Between(8, GAME.width - 8), Phaser.Math.Between(18, 132), Phaser.Math.FloatBetween(0.6, 1.5), 0x6cf0c2, 0.18).setDepth(2);
    }
  }

  private buildSprites() {
    for (const c of this.battle.all()) {
      if (!this.textures.exists(c.spriteKey)) {
        const g = this.add.graphics();
        g.fillStyle(c.color, 1);
        g.fillRoundedRect(0, 0, c.size, c.size, 3);
        g.lineStyle(1, 0x000000, 0.35);
        g.strokeRoundedRect(0.5, 0.5, c.size - 1, c.size - 1, 3);
        g.generateTexture(c.spriteKey, c.size, c.size);
        g.destroy();
      }
    }
    this.placeSide(this.battle.enemies, 128);
    this.placeSide(this.battle.party, GAME.width - 128);
    this.buildEnemyHpBars();
  }

  private placeSide(list: Combatant[], x: number) {
    const spacing = 62;
    const startY = 126 - ((list.length - 1) * spacing) / 2;
    list.forEach((c, i) => {
      // Scale the small pixel sprites up so they have presence in battle.
      const img = this.add.image(x, startY + i * spacing, c.spriteKey).setScale(2.4).setDepth(5);
      this.sprites.set(c.id, img);
      this.spriteHome.set(c.id, { x: img.x, y: img.y });
    });
  }

  private buildPanels() {
    // Log box on the left, status box on the right.
    const panelY = GAME.height - 104;
    const statusX = GAME.width - 184;
    this.panel(4, panelY, GAME.width - 200, 100);
    this.panel(statusX - 6, panelY, 190, 100);
    this.promptText = this.add.text(8, panelY + 5, '', sharpText({ fontFamily: FONT, fontSize: '10px', color: '#a58cff' })).setDepth(15);
    this.logText = this.add.text(8, panelY + 22, '', sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5', lineSpacing: 3, wordWrap: { width: GAME.width - 212 } })).setDepth(15);
    this.statusText = this.add.text(statusX, panelY + 8, '', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#dfe4f5', lineSpacing: 11 })).setDepth(15);
    this.buildPartyBars();
  }

  private panel(x: number, y: number, w: number, h: number) {
    const r = this.add.rectangle(x, y, w, h, 0x0d1024, 0.92).setOrigin(0, 0).setDepth(12);
    r.setStrokeStyle(1, COLORS.wall);
  }

  private buildEnemyHpBars() {
    for (const e of this.battle.enemies) {
      const img = this.sprites.get(e.id);
      if (!img) continue;
      const width = e.isBoss ? 86 : 62;
      const y = img.y + img.displayHeight / 2 + 7;
      const bg = this.add.rectangle(img.x, y, width, 5, 0x07060e, 0.88).setDepth(7).setStrokeStyle(1, 0x0c0e16);
      const fill = this.add.rectangle(img.x - width / 2 + 1, y, width - 2, 3, e.isBoss ? 0xff5a6a : 0x6cf0a0, 0.96).setOrigin(0, 0.5).setDepth(8);
      const label = this.add.text(img.x, y + 7, e.name, sharpText({ fontFamily: FONT, fontSize: e.isBoss ? '8px' : '7px', color: '#dfe4f5', strokeThickness: 2 })).setOrigin(0.5, 0).setDepth(8);
      this.enemyHpBars.set(e.id, { bg, fill, label });
    }
  }

  private buildPartyBars() {
    this.battle.party.forEach((c, i) => {
      const statusX = GAME.width - 184;
      const y = GAME.height - 85 + i * 20;
      const hpBg = this.add.rectangle(statusX, y, 78, 4, 0x07060e, 0.9).setOrigin(0, 0.5).setDepth(16);
      const hpFill = this.add.rectangle(statusX + 1, y, 76, 2, 0x6cf0a0, 0.95).setOrigin(0, 0.5).setDepth(17);
      this.partyHpBars.set(c.id, { bg: hpBg, fill: hpFill });

      const xpBg = this.add.rectangle(statusX + 84, y, 62, 4, 0x07060e, 0.9).setOrigin(0, 0.5).setDepth(16);
      const xpFill = this.add.rectangle(statusX + 85, y, 60, 2, 0x8a6cf0, 0.95).setOrigin(0, 0.5).setDepth(17);
      this.partyXpBars.set(c.id, { bg: xpBg, fill: xpFill });
    });
  }

  // --- Command Phase --------------------------------------------------------

  private startCommandPhase() {
    this.syncDisplay();
    this.order = this.battle.living('party');
    this.pos = 0;
    this.battle.clearCommands();
    if (this.order.length === 0) return; // should not happen
    this.openMenu();
  }

  private openMenu() {
    this.ui = 'menu';
    this.menuIndex = 0;
    const m = this.order[this.pos];
    const hasSpells = m.spells.some((s) => SPELLS[s]);
    const itemsAvail = Object.values(getRun().inventory).some((n) => n > 0);
    this.options = [
      { label: 'Attack', action: 'attack', enabled: true },
      { label: 'Magic', action: 'magic', enabled: hasSpells },
      { label: 'Item', action: 'item', enabled: itemsAvail },
      { label: 'Defend', action: 'defend', enabled: true },
      { label: 'Flee', action: 'flee', enabled: true },
    ];
    this.renderMenu(`${m.name} - choose action`);
    this.stepActiveHeroForward(m.id);
  }

  private renderMenu(prompt: string) {
    this.promptText.setText(prompt);
    this.logText.setVisible(false);
    this.clearMenuText();
    this.options.forEach((o, i) => {
      const color = !o.enabled ? '#5a6080' : i === this.menuIndex ? '#f0d36c' : '#c9cee8';
      const prefix = i === this.menuIndex ? '> ' : '  ';
      const t = this.add.text(12, GAME.height - 79 + i * 14, prefix + o.label, sharpText({ fontFamily: FONT, fontSize: '10px', color })).setDepth(16);
      this.menuText.push(t);
    });
    this.cursor.setVisible(false);
    this.markActiveMember();

    if (isTouchDevice()) {
      this.options.forEach((_o, i) => {
        const zone = this.add.rectangle(4, GAME.height - 83 + i * 14, GAME.width - 200, 16, 0xffffff, 0)
          .setOrigin(0, 0).setDepth(25).setInteractive();
        zone.on('pointerdown', () => {
          if (!this.options[i].enabled) return;
          this.menuIndex = i;
          this.confirmMenu();
        });
        this.touchCleanups.push(() => zone.destroy());
      });
    }
  }

  private renderSubmenu(prompt: string) {
    this.promptText.setText(prompt);
    this.logText.setVisible(false);
    this.clearMenuText();
    this.subItems.forEach((o, i) => {
      const color = !o.enabled ? '#5a6080' : i === this.subIndex ? '#f0d36c' : '#c9cee8';
      const prefix = i === this.subIndex ? '> ' : '  ';
      const t = this.add.text(12, GAME.height - 79 + i * 14, prefix + o.label, sharpText({ fontFamily: FONT, fontSize: '10px', color })).setDepth(16);
      this.menuText.push(t);
    });

    if (isTouchDevice()) {
      this.subItems.forEach((_o, i) => {
        const zone = this.add.rectangle(4, GAME.height - 83 + i * 14, GAME.width - 200, 16, 0xffffff, 0)
          .setOrigin(0, 0).setDepth(25).setInteractive();
        zone.on('pointerdown', () => {
          if (!this.subItems[i].enabled) return;
          this.subIndex = i;
          this.confirmSubmenu();
        });
        this.touchCleanups.push(() => zone.destroy());
      });
    }
  }

  private clearMenuText() {
    this.menuText.forEach((t) => t.destroy());
    this.menuText = [];
    for (const fn of this.touchCleanups) fn();
    this.touchCleanups = [];
  }

  private markActiveMember() {
    const m = this.order[this.pos];
    const img = this.sprites.get(m.id);
    if (img) {
      this.cursor.setPosition(img.x - img.displayWidth / 2 - 8, img.y - 4).setVisible(true);
    }
  }

  // Navigation ---------------------------------------------------------------

  private bindKeys() {
    // Shared input bus for keyboard and touch, unsubscribed on shutdown.
    this.unsubs.push(input.on('up', () => this.nav(-1)));
    this.unsubs.push(input.on('down', () => this.nav(1)));
    this.unsubs.push(input.on('left', () => this.navTarget(-1)));
    this.unsubs.push(input.on('right', () => this.navTarget(1)));
    this.unsubs.push(input.on('confirm', () => this.confirm()));
    this.unsubs.push(input.on('cancel', () => this.cancel()));
    this.unsubs.push(input.on('menu', () => {
      if (this.scene.isActive('GameMenu')) return;
      this.scene.pause();
      this.scene.launch('GameMenu', { caller: this.scene.key });
    }));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
    attachTouchControls(this, 'top');
  }

  private nav(dir: number) {
    if (this.ui === 'menu') {
      this.menuIndex = this.wrap(this.menuIndex, dir, this.options.length);
      this.renderMenu(this.promptText.text);
    } else if (this.ui === 'submenu') {
      this.subIndex = this.wrap(this.subIndex, dir, this.subItems.length);
      this.renderSubmenu(this.promptText.text);
    } else if (this.ui === 'target' || this.ui === 'subtarget') {
      this.navTarget(dir);
    }
  }

  private navTarget(dir: number) {
    if (this.ui !== 'target' && this.ui !== 'subtarget') return;
    this.targetIndex = this.wrap(this.targetIndex, dir, this.targets.length);
    this.pointCursorAtTarget();
  }

  private wrap(idx: number, dir: number, len: number): number {
    return (idx + dir + len) % len;
  }

  private confirm() {
    if (this.ui === 'menu') this.confirmMenu();
    else if (this.ui === 'submenu') this.confirmSubmenu();
    else if (this.ui === 'target' || this.ui === 'subtarget') this.confirmTarget();
  }

  private cancel() {
    if (this.ui === 'submenu') {
      this.openMenu();
    } else if (this.ui === 'target') {
      this.openMenu();
    } else if (this.ui === 'subtarget') {
      // back to the spell or item list
      if (this.pending?.kind === 'spell') this.openMagic();
      else if (this.pending?.kind === 'item') this.openItems();
      else this.openMenu();
    } else if (this.ui === 'menu' && this.pos > 0) {
      this.pos--;
      this.openMenu();
    }
  }

  private confirmMenu() {
    const opt = this.options[this.menuIndex];
    if (!opt.enabled) return;
    switch (opt.action) {
      case 'attack':
        this.pending = { kind: 'attack' };
        this.beginTargeting('enemy', 'target');
        break;
      case 'magic':
        this.openMagic();
        break;
      case 'item':
        this.openItems();
        break;
      case 'defend':
        this.commit({ type: 'defend' });
        break;
      case 'flee':
        this.commit({ type: 'flee' });
        break;
    }
  }

  private openMagic() {
    const m = this.order[this.pos];
    this.ui = 'submenu';
    this.subIndex = 0;
    this.subItems = m.spells.map((id) => {
      const s = SPELLS[id];
      const ok = m.stats.mp >= s.cost;
      return { id, label: `${s.name}  ${s.cost}MP`, enabled: ok };
    });
    this.pending = { kind: 'spell' };
    this.renderSubmenu(`${m.name} - magic`);
  }

  private openItems() {
    const inv = getRun().inventory;
    this.ui = 'submenu';
    this.subIndex = 0;
    this.subItems = Object.entries(inv)
      .filter(([, n]) => n > 0)
      .filter(([id]) => ITEMS[id]?.target === 'ally')
      .map(([id, n]) => ({ id, label: `${ITEMS[id]?.name ?? id}  x${n}`, enabled: true }));
    this.pending = { kind: 'item' };
    this.renderSubmenu(`${this.order[this.pos].name} - item`);
  }

  private confirmSubmenu() {
    const sel = this.subItems[this.subIndex];
    if (!sel || !sel.enabled) return;
    if (this.pending?.kind === 'spell') {
      this.pending.id = sel.id;
      const spell = SPELLS[sel.id];
      this.beginTargeting(spell.target === 'ally' ? 'party' : 'enemy', 'subtarget');
    } else if (this.pending?.kind === 'item') {
      this.pending.id = sel.id;
      this.beginTargeting('party', 'subtarget');
    }
  }

  private beginTargeting(side: 'party' | 'enemy', state: 'target' | 'subtarget') {
    this.targets = this.battle.living(side);
    this.targetIndex = 0;
    this.ui = state;
    this.clearMenuText();
    this.promptText.setText('Choose target  < >');
    this.pointCursorAtTarget();

    if (isTouchDevice()) {
      this.targets.forEach((t, i) => {
        const img = this.sprites.get(t.id);
        if (!img) return;
        img.setInteractive();
        const handler = () => { this.targetIndex = i; this.confirmTarget(); };
        img.on('pointerdown', handler);
        this.touchCleanups.push(() => { img.off('pointerdown', handler); img.disableInteractive(); });
      });
    }
  }

  private pointCursorAtTarget() {
    const t = this.targets[this.targetIndex];
    const img = this.sprites.get(t.id);
    if (img) this.cursor.setPosition(img.x - img.displayWidth / 2 - 8, img.y - 4).setVisible(true);
  }

  private confirmTarget() {
    const target = this.targets[this.targetIndex];
    if (!this.pending) return;
    if (this.pending.kind === 'attack') {
      this.commit({ type: 'attack', targetId: target.id });
    } else if (this.pending.kind === 'spell' && this.pending.id) {
      this.commit({ type: 'spell', spellId: this.pending.id, targetId: target.id });
    } else if (this.pending.kind === 'item' && this.pending.id) {
      this.commit({ type: 'item', itemId: this.pending.id, targetId: target.id });
    }
  }

  private commit(cmd: Command) {
    this.returnAllHeroesHome();
    this.battle.setCommand(this.order[this.pos].id, cmd);
    this.pending = null;
    this.pos++;
    if (this.pos >= this.order.length) {
      this.resolve();
    } else {
      this.openMenu();
    }
  }

  // --- Resolution and Playback ---------------------------------------------

  private resolve() {
    this.ui = 'busy';
    this.returnAllHeroesHome();
    this.cursor.setVisible(false);
    this.clearMenuText();
    this.promptText.setText('');
    this.logText.setVisible(true);
    // Snapshot for progressive HP reveal during playback.
    for (const c of this.battle.all()) {
      this.hpDisplay.set(c.id, c.stats.hp);
      this.mpDisplay.set(c.id, c.stats.mp);
    }
    const events = this.battle.resolveRound();
    this.playEvents(events, 0);
  }

  private playEvents(events: BattleEvent[], i: number) {
    if (i >= events.length) {
      this.time.delayedCall(350, () => this.afterRound());
      return;
    }
    const ev = events[i];
    this.pushLog(ev.text);
    this.animateEvent(ev);

    if (ev.amount != null && ev.targetId) {
      const cur = this.hpDisplay.get(ev.targetId) ?? 0;
      const target = this.battle.byId(ev.targetId);
      const max = target?.stats.maxHp ?? cur;
      const next = Phaser.Math.Clamp(cur - ev.amount, 0, max);
      this.hpDisplay.set(ev.targetId, next);
      this.flash(ev.targetId, ev.amount > 0 ? 0xff5a6a : 0x6cf0a0);
    }
    if (ev.kind === 'spell' && ev.actorId) {
      // Rough MP sync for the caster.
      const a = this.battle.byId(ev.actorId);
      if (a) this.mpDisplay.set(a.id, a.stats.mp);
    }
    if (ev.kind === 'ko' && ev.targetId) this.fadeKo(ev.targetId);

    this.refreshStatus();
    this.time.delayedCall(720, () => this.playEvents(events, i + 1));
  }

  private afterRound() {
    // Sync display to actual values.
    for (const c of this.battle.all()) {
      this.hpDisplay.set(c.id, c.stats.hp);
      this.mpDisplay.set(c.id, c.stats.mp);
    }
    this.refreshStatus();

    switch (this.battle.phase) {
      case 'won':
        this.onVictory();
        break;
      case 'fled':
        this.endBattle(500);
        break;
      case 'lost':
        this.gameOver();
        break;
      default:
        this.startCommandPhase();
    }
  }

  private onVictory() {
    const run = getRun();
    run.gold += this.battle.goldWon;
    // Award XP and show level-up events in the log.
    for (const ev of grantXp(run.party, this.battle.xpWon)) this.pushLog(ev.text);
    for (const c of this.battle.all()) {
      this.hpDisplay.set(c.id, c.stats.hp);
      this.mpDisplay.set(c.id, c.stats.mp);
    }
    this.refreshStatus();

    const boss = this.battle.enemies.some((e) => e.isBoss);
    const depth = run.depth;
    const loot = grantBattleLoot(depth, boss);
    if (loot.length > 0) this.pushLog(`Loot: ${loot.join(', ')}`);
    if (boss) {
      const flag = depth <= 2 ? 'ch1_complete' : depth <= 4 ? 'ch2_complete' : 'ch3_complete';
      setFlag(flag);
    }
    saveProgress();
    music.fanfare('victory');
    this.ui = 'over';

    this.time.delayedCall(boss ? 1000 : 1500, () => {
      if (boss) {
        const winScript = depth <= 2 ? 'ch1_win' : depth <= 4 ? 'ch2_win' : 'ch3_win';
        this.scene.launch('Dialogue', { scriptId: winScript, onDone: () => this.toTown() });
      } else {
        this.scene.resume('Descent', { won: true });
        this.scene.stop();
      }
    });
  }

  private endBattle(delay: number) {
    this.ui = 'over';
    this.time.delayedCall(delay, () => {
      this.scene.resume('Descent');
      this.scene.stop();
    });
  }

  private gameOver() {
    this.ui = 'over';
    this.pushLog('The Crystal draws you back...');
    this.refreshStatus();
    music.fanfare('defeat');
    this.time.delayedCall(2200, () => this.toTown());
  }

  /** Leaves the descent and returns to Sanctuary. */
  private toTown() {
    returnToTown();
    this.scene.stop('Descent');
    this.scene.start('Sanctuary');
    this.scene.stop();
  }

  // --- Display Helpers ------------------------------------------------------

  private flash(id: string, color: number) {
    const img = this.sprites.get(id);
    if (!img) return;
    img.setTintFill(color);
    this.time.delayedCall(140, () => img.clearTint());
    this.tweens.add({ targets: img, x: img.x + (this.battle.byId(id)?.side === 'enemy' ? 4 : -4), duration: 60, yoyo: true });
  }

  private stepActiveHeroForward(id: string) {
    this.returnAllHeroesHome(id);
    const img = this.sprites.get(id);
    const home = this.spriteHome.get(id);
    if (!img || !home) return;
    this.tweens.killTweensOf(img);
    this.tweens.add({
      targets: img,
      x: home.x - 20,
      y: home.y - 3,
      duration: 160,
      ease: 'Sine.easeOut',
    });
  }

  private returnAllHeroesHome(exceptId?: string) {
    for (const c of this.battle.party) {
      if (c.id === exceptId) continue;
      const img = this.sprites.get(c.id);
      const home = this.spriteHome.get(c.id);
      if (!img || !home) continue;
      this.tweens.killTweensOf(img);
      this.tweens.add({ targets: img, x: home.x, y: home.y, duration: 120, ease: 'Sine.easeOut' });
    }
  }

  private static spellColor(element?: string): number {
    switch (element) {
      case 'fire':  return 0xff4422;
      case 'ice':   return 0x44aaff;
      case 'holy':  return 0xffe866;
      default:      return 0x8a6cf0;
    }
  }

  private animateEvent(ev: BattleEvent) {
    if (ev.kind === 'attack' && ev.actorId && ev.targetId) {
      this.attackAnim(ev.actorId, ev.targetId);
      if (ev.amount) this.floatNumber(ev.targetId, ev.amount);
    } else if (ev.kind === 'spell' && ev.actorId && ev.targetId) {
      const isHeal = (ev.amount ?? 0) < 0;
      if (isHeal) {
        this.healAnim(ev.targetId, 0x6cf0a0);
        this.floatNumber(ev.targetId, ev.amount ?? 0);
      } else {
        const color = BattleScene.spellColor(ev.element);
        this.projectileAnim(ev.actorId, ev.targetId, color);
        if (ev.amount) this.floatNumber(ev.targetId, ev.amount);
      }
    } else if (ev.kind === 'item' && ev.targetId) {
      this.healAnim(ev.targetId, 0xf0d36c);
      if (ev.amount) this.floatNumber(ev.targetId, ev.amount);
    } else if (ev.kind === 'defend' && ev.actorId) {
      this.guardAnim(ev.actorId);
    }
  }

  private floatNumber(targetId: string, amount: number) {
    const img = this.sprites.get(targetId);
    if (!img || amount === 0) return;
    const isHeal = amount < 0;
    const label = isHeal ? `+${Math.abs(amount)}` : `-${amount}`;
    const color = isHeal ? '#66ffaa' : '#ff6655';
    const txt = this.add.text(img.x + Phaser.Math.Between(-6, 6), img.y - 18, label,
      { fontFamily: 'monospace', fontSize: '11px', color, stroke: '#07060e', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(40);
    this.tweens.add({
      targets: txt, y: txt.y - 22, alpha: 0, duration: 900,
      ease: 'Sine.easeOut', onComplete: () => txt.destroy(),
    });
  }

  private attackAnim(actorId: string, targetId: string) {
    const actor = this.sprites.get(actorId);
    const target = this.sprites.get(targetId);
    if (!actor || !target) return;
    const ox = actor.x;
    const oy = actor.y;
    const dx = Phaser.Math.Clamp((target.x - actor.x) * 0.22, -26, 26);
    const dy = Phaser.Math.Clamp((target.y - actor.y) * 0.12, -10, 10);
    this.tweens.add({
      targets: actor,
      x: ox + dx,
      y: oy + dy,
      duration: 95,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => actor.setPosition(ox, oy),
    });
    this.slashAt(target.x, target.y);
    this.cameras.main.shake(70, 0.003);
  }

  private projectileAnim(actorId: string, targetId: string, color: number) {
    const actor = this.sprites.get(actorId);
    const target = this.sprites.get(targetId);
    if (!actor || !target) return;
    const orb = this.add.circle(actor.x, actor.y - 8, 4, color, 0.95).setDepth(30);
    const trail = this.add.circle(actor.x, actor.y - 8, 8, color, 0.18).setDepth(29);
    this.tweens.add({
      targets: [orb, trail],
      x: target.x,
      y: target.y,
      duration: 260,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.burstAt(target.x, target.y, color);
        orb.destroy();
        trail.destroy();
      },
    });
  }

  private healAnim(targetId: string, color: number) {
    const target = this.sprites.get(targetId);
    if (!target) return;
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(target.x, target.y + 2, 7 + i * 4, color, 0).setStrokeStyle(2, color, 0.55).setDepth(31);
      this.tweens.add({
        targets: ring,
        scale: 1.35,
        alpha: 0,
        y: target.y - 8 - i * 3,
        duration: 420 + i * 90,
        ease: 'Sine.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
  }

  private guardAnim(actorId: string) {
    const actor = this.sprites.get(actorId);
    if (!actor) return;
    const shield = this.add.circle(actor.x, actor.y, Math.max(actor.displayWidth, actor.displayHeight) * 0.42, 0x8a6cf0, 0).setStrokeStyle(2, 0x8a6cf0, 0.65).setDepth(28);
    this.tweens.add({
      targets: shield,
      alpha: 0,
      scale: 1.25,
      duration: 420,
      ease: 'Sine.easeOut',
      onComplete: () => shield.destroy(),
    });
  }

  private slashAt(x: number, y: number) {
    const a = this.add.rectangle(x - 6, y - 2, 22, 3, 0xeef2ff, 0.9).setAngle(-35).setDepth(32);
    const b = this.add.rectangle(x + 5, y + 4, 18, 2, 0xf0d36c, 0.85).setAngle(-35).setDepth(32);
    this.tweens.add({
      targets: [a, b],
      alpha: 0,
      scaleX: 1.5,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => {
        a.destroy();
        b.destroy();
      },
    });
  }

  private burstAt(x: number, y: number, color: number) {
    this.cameras.main.shake(90, 0.005);
    for (let i = 0; i < 6; i++) {
      const p = this.add.circle(x, y, 2, color, 0.9).setDepth(32);
      const angle = (Math.PI * 2 * i) / 6;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * 18,
        y: y + Math.sin(angle) * 12,
        alpha: 0,
        duration: 260,
        ease: 'Sine.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private fadeKo(id: string) {
    const img = this.sprites.get(id);
    if (!img) return;
    this.tweens.add({ targets: img, alpha: 0.18, y: img.y + 8, duration: 360, ease: 'Sine.easeIn' });
  }

  private syncDisplay() {
    for (const c of this.battle.all()) {
      this.hpDisplay.set(c.id, c.stats.hp);
      this.mpDisplay.set(c.id, c.stats.mp);
    }
    this.refreshStatus();
  }

  private refreshStatus() {
    const lines = this.battle.party.map((c) => {
      const hp = Math.round(this.hpDisplay.get(c.id) ?? c.stats.hp);
      const mp = Math.round(this.mpDisplay.get(c.id) ?? c.stats.mp);
      const dead = hp <= 0 ? ' KO' : '';
      const mpStr = c.stats.maxMp > 0 ? `  MP ${mp}/${c.stats.maxMp}` : '';
      return `${c.name} Lv${c.level ?? 1}${dead}  HP ${hp}/${c.stats.maxHp}${mpStr}`;
    });
    this.statusText.setText(lines.join('\n'));
    this.refreshPartyBars();
    this.refreshEnemyBars();
  }

  private refreshEnemyBars() {
    for (const e of this.battle.enemies) {
      const bar = this.enemyHpBars.get(e.id);
      if (!bar) continue;
      const hp = Math.round(this.hpDisplay.get(e.id) ?? e.stats.hp);
      const pct = Phaser.Math.Clamp(hp / e.stats.maxHp, 0, 1);
      bar.fill.setScale(pct, 1);
      bar.bg.setAlpha(hp > 0 ? 0.88 : 0.28);
      bar.fill.setAlpha(hp > 0 ? 0.96 : 0);
      bar.label?.setText(hp > 0 ? `${e.name} ${hp}/${e.stats.maxHp}` : `${e.name} KO`);
    }
  }

  private refreshPartyBars() {
    for (const c of this.battle.party) {
      const hp = Math.round(this.hpDisplay.get(c.id) ?? c.stats.hp);
      const hpPct = Phaser.Math.Clamp(hp / c.stats.maxHp, 0, 1);
      const hpBar = this.partyHpBars.get(c.id);
      if (hpBar) hpBar.fill.setScale(hpPct, 1);

      const needed = xpForLevel(c.level ?? 1);
      const xpPct = Phaser.Math.Clamp((c.xp ?? 0) / needed, 0, 1);
      const xpBar = this.partyXpBars.get(c.id);
      if (xpBar) xpBar.fill.setScale(xpPct, 1);
    }
  }

  private pushLog(line: string) {
    this.log.push(line);
    if (this.log.length > 3) this.log.shift();
    this.logText.setText(this.log.join('\n'));
  }
}
