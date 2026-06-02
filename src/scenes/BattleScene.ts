import Phaser from 'phaser';
import { GAME, COLORS } from '../config';
import { Battle } from '../game/battle';
import { ITEMS, SPELLS } from '../game/content';
import { getRun, partyWiped, resetRun } from '../game/run';
import { music } from '../audio/music';
import type { BattleEvent, Combatant, Command } from '../game/types';

type UIState = 'menu' | 'target' | 'submenu' | 'subtarget' | 'busy' | 'over';

interface PendingAction {
  kind: 'attack' | 'spell' | 'item';
  id?: string; // spell- eller item-id
}

interface MenuOption {
  label: string;
  action: 'attack' | 'magic' | 'item' | 'defend' | 'flee';
  enabled: boolean;
}

const FONT = 'monospace';

/**
 * Presentasjonslaget for kamp. Driver Battle-motoren: samler kommandoer via
 * en tastaturmeny, og spiller deretter av rundens hendelser med animasjon.
 * Piltaster = naviger, Z/Enter/Space = bekreft, X/Backspace = avbryt.
 */
export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private ui: UIState = 'menu';

  // Inntasting
  private order: Combatant[] = []; // levende party i kommandorekkefølge
  private pos = 0;
  private menuIndex = 0;
  private options: MenuOption[] = [];
  private subIndex = 0;
  private subItems: { id: string; label: string; enabled: boolean }[] = [];
  private pending: PendingAction | null = null;
  private targets: Combatant[] = [];
  private targetIndex = 0;

  // Visning
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private hpDisplay = new Map<string, number>();
  private mpDisplay = new Map<string, number>();
  private cursor!: Phaser.GameObjects.Text;
  private menuText: Phaser.GameObjects.Text[] = [];
  private logText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private log: string[] = [];

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
    this.hpDisplay.clear();
    this.mpDisplay.clear();
    this.menuText = [];
    this.log = [];
  }

  create() {
    // Phaser gjenbruker scene-instansen mellom kamper -> nullstill all tilstand.
    this.resetState();

    const run = getRun();
    const enemies = (this.scene.settings.data as { enemies: Combatant[] }).enemies;
    this.battle = new Battle(run.party, enemies, run.inventory);

    this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg).setOrigin(0, 0).setDepth(0);

    this.buildSprites();
    this.buildPanels();
    this.cursor = this.add.text(0, 0, '▶', { fontFamily: FONT, fontSize: '8px', color: '#f0d36c' }).setDepth(20).setVisible(false);

    this.bindKeys();
    this.syncDisplay();
    music.play('battle');
    this.pushLog('Fiender dukker opp!');
    this.startCommandPhase();
  }

  // --- Oppbygging -----------------------------------------------------------

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
    this.placeSide(this.battle.enemies, 100);
    this.placeSide(this.battle.party, 372);
  }

  private placeSide(list: Combatant[], x: number) {
    const spacing = 50;
    const startY = 92 - ((list.length - 1) * spacing) / 2;
    list.forEach((c, i) => {
      const img = this.add.image(x, startY + i * spacing, c.spriteKey).setDepth(5);
      this.sprites.set(c.id, img);
    });
  }

  private buildPanels() {
    // Loggboks (venstre) + statusboks (høyre).
    this.panel(4, 182, 292, 84);
    this.panel(300, 182, 176, 84);
    this.promptText = this.add.text(8, 186, '', { fontFamily: FONT, fontSize: '8px', color: '#8a6cf0' }).setDepth(15);
    this.logText = this.add.text(8, 198, '', { fontFamily: FONT, fontSize: '8px', color: '#c9cee8', lineSpacing: 2, wordWrap: { width: 284 } }).setDepth(15);
    this.statusText = this.add.text(306, 186, '', { fontFamily: FONT, fontSize: '8px', color: '#c9cee8', lineSpacing: 3 }).setDepth(15);
  }

  private panel(x: number, y: number, w: number, h: number) {
    const r = this.add.rectangle(x, y, w, h, 0x0d1024, 0.92).setOrigin(0, 0).setDepth(12);
    r.setStrokeStyle(1, COLORS.wall);
  }

  // --- Inntastingsfase ------------------------------------------------------

  private startCommandPhase() {
    this.syncDisplay();
    this.order = this.battle.living('party');
    this.pos = 0;
    this.battle.clearCommands();
    if (this.order.length === 0) return; // bør ikke skje
    this.openMenu();
  }

  private openMenu() {
    this.ui = 'menu';
    this.menuIndex = 0;
    const m = this.order[this.pos];
    const hasSpells = m.spells.some((s) => SPELLS[s]);
    const itemsAvail = Object.values(getRun().inventory).some((n) => n > 0);
    this.options = [
      { label: 'Angrip', action: 'attack', enabled: true },
      { label: 'Magi', action: 'magic', enabled: hasSpells },
      { label: 'Gjenstand', action: 'item', enabled: itemsAvail },
      { label: 'Forsvar', action: 'defend', enabled: true },
      { label: 'Flykt', action: 'flee', enabled: true },
    ];
    this.renderMenu(`${m.name} — velg handling`);
  }

  private renderMenu(prompt: string) {
    this.promptText.setText(prompt);
    this.logText.setVisible(false);
    this.clearMenuText();
    this.options.forEach((o, i) => {
      const color = !o.enabled ? '#5a6080' : i === this.menuIndex ? '#f0d36c' : '#c9cee8';
      const prefix = i === this.menuIndex ? '▸ ' : '  ';
      const t = this.add.text(12, 200 + i * 11, prefix + o.label, { fontFamily: FONT, fontSize: '8px', color }).setDepth(16);
      this.menuText.push(t);
    });
    this.cursor.setVisible(false);
    this.markActiveMember();
  }

  private renderSubmenu(prompt: string) {
    this.promptText.setText(prompt);
    this.logText.setVisible(false);
    this.clearMenuText();
    this.subItems.forEach((o, i) => {
      const color = !o.enabled ? '#5a6080' : i === this.subIndex ? '#f0d36c' : '#c9cee8';
      const prefix = i === this.subIndex ? '▸ ' : '  ';
      const t = this.add.text(12, 200 + i * 11, prefix + o.label, { fontFamily: FONT, fontSize: '8px', color }).setDepth(16);
      this.menuText.push(t);
    });
  }

  private clearMenuText() {
    this.menuText.forEach((t) => t.destroy());
    this.menuText = [];
  }

  private markActiveMember() {
    const m = this.order[this.pos];
    const img = this.sprites.get(m.id);
    if (img) {
      this.cursor.setPosition(img.x - img.width / 2 - 10, img.y - 4).setVisible(true);
    }
  }

  // Navigasjon ----------------------------------------------------------------

  private bindKeys() {
    const k = this.input.keyboard!;
    k.on('keydown-UP', () => this.nav(-1));
    k.on('keydown-DOWN', () => this.nav(1));
    k.on('keydown-LEFT', () => this.navTarget(-1));
    k.on('keydown-RIGHT', () => this.navTarget(1));
    k.on('keydown-Z', () => this.confirm());
    k.on('keydown-ENTER', () => this.confirm());
    k.on('keydown-SPACE', () => this.confirm());
    k.on('keydown-X', () => this.cancel());
    k.on('keydown-BACKSPACE', () => this.cancel());
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
      // tilbake til besvergelse-/gjenstandslisten
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
    this.renderSubmenu(`${m.name} — magi`);
  }

  private openItems() {
    const inv = getRun().inventory;
    this.ui = 'submenu';
    this.subIndex = 0;
    this.subItems = Object.entries(inv)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ id, label: `${ITEMS[id]?.name ?? id}  x${n}`, enabled: true }));
    this.pending = { kind: 'item' };
    this.renderSubmenu(`${this.order[this.pos].name} — gjenstand`);
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
    this.promptText.setText('Velg mål  ◂ ▸');
    this.pointCursorAtTarget();
  }

  private pointCursorAtTarget() {
    const t = this.targets[this.targetIndex];
    const img = this.sprites.get(t.id);
    if (img) this.cursor.setPosition(img.x - img.width / 2 - 10, img.y - 4).setVisible(true);
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
    this.battle.setCommand(this.order[this.pos].id, cmd);
    this.pending = null;
    this.pos++;
    if (this.pos >= this.order.length) {
      this.resolve();
    } else {
      this.openMenu();
    }
  }

  // --- Oppgjør + avspilling -------------------------------------------------

  private resolve() {
    this.ui = 'busy';
    this.cursor.setVisible(false);
    this.clearMenuText();
    this.promptText.setText('');
    this.logText.setVisible(true);
    // Snapshot for progressiv HP-avsløring under avspilling.
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

    if (ev.amount != null && ev.targetId) {
      const cur = this.hpDisplay.get(ev.targetId) ?? 0;
      const target = this.battle.byId(ev.targetId);
      const max = target?.stats.maxHp ?? cur;
      const next = Phaser.Math.Clamp(cur - ev.amount, 0, max);
      this.hpDisplay.set(ev.targetId, next);
      this.flash(ev.targetId, ev.amount > 0 ? 0xff5a6a : 0x6cf0a0);
    }
    if (ev.kind === 'spell' && ev.actorId) {
      // grov MP-synk for kaster
      const a = this.battle.byId(ev.actorId);
      if (a) this.mpDisplay.set(a.id, a.stats.mp);
    }
    if (ev.kind === 'ko' && ev.targetId) this.fadeKo(ev.targetId);

    this.refreshStatus();
    this.time.delayedCall(720, () => this.playEvents(events, i + 1));
  }

  private afterRound() {
    // Synk visning til faktiske verdier.
    for (const c of this.battle.all()) {
      this.hpDisplay.set(c.id, c.stats.hp);
      this.mpDisplay.set(c.id, c.stats.mp);
    }
    this.refreshStatus();

    switch (this.battle.phase) {
      case 'won':
        getRun().gold += this.battle.goldWon;
        music.fanfare('victory');
        this.endBattle(1500); // la fanfaren få klinge ut før vi vender tilbake
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

  private endBattle(delay: number) {
    this.ui = 'over';
    this.time.delayedCall(delay, () => {
      this.scene.resume('Descent');
      this.scene.stop();
    });
  }

  private gameOver() {
    this.ui = 'over';
    this.pushLog('Krystallen trekker deg tilbake …');
    this.refreshStatus();
    music.fanfare('defeat');
    this.time.delayedCall(2200, () => {
      if (partyWiped()) resetRun();
      this.scene.start('Descent');
      this.scene.stop();
    });
  }

  // --- Visnings-hjelpere ----------------------------------------------------

  private flash(id: string, color: number) {
    const img = this.sprites.get(id);
    if (!img) return;
    img.setTintFill(color);
    this.time.delayedCall(140, () => img.clearTint());
    this.tweens.add({ targets: img, x: img.x + (this.battle.byId(id)?.side === 'enemy' ? 4 : -4), duration: 60, yoyo: true });
  }

  private fadeKo(id: string) {
    const img = this.sprites.get(id);
    if (!img) return;
    this.tweens.add({ targets: img, alpha: 0.18, duration: 300 });
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
      const dead = hp <= 0 ? ' ✝' : '';
      const mpStr = c.stats.maxMp > 0 ? `  MP ${mp}/${c.stats.maxMp}` : '';
      return `${c.name}${dead}\n  HP ${hp}/${c.stats.maxHp}${mpStr}`;
    });
    this.statusText.setText(lines.join('\n'));

    // Fiende-HP som liten tekst under hver sprite.
    for (const e of this.battle.enemies) {
      const img = this.sprites.get(e.id);
      if (!img) continue;
      const key = `hp_${e.id}`;
      let t = this.children.getByName(key) as Phaser.GameObjects.Text | null;
      if (!t) {
        t = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '7px', color: '#c9cee8' }).setName(key).setDepth(6).setOrigin(0.5, 0);
        t.setPosition(img.x, img.y + img.height / 2 + 2);
      }
      const hp = Math.round(this.hpDisplay.get(e.id) ?? e.stats.hp);
      t.setText(hp > 0 ? `${e.name} ${hp}` : '✝');
    }
  }

  private pushLog(line: string) {
    this.log.push(line);
    if (this.log.length > 4) this.log.shift();
    this.logText.setText(this.log.join('\n'));
  }
}
