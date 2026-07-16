import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { Battle } from '../game/battle';
import { rollBoonChoices } from '../game/boons';
import { ITEMS, SPELLS } from '../game/content';
import { getArea } from '../game/chapters';
import { applyWipePenalty, completeQuest, getRun, grantBattleLoot, hasFlag, returnToTown, saveProgress, setFlag } from '../game/run';
import { questRewardText } from '../game/quests';
import { grantXp, xpForLevel } from '../game/progression';
import { track, chapterOfDepth } from '../game/analytics';
import { openFeedback } from '../ui/feedback';
import { input, attachTouchControls, isTouchDevice } from '../game/input';
import { music, sfx, type AreaThemeId } from '../audio/music';
import { sharpText, FONT } from '../ui/text';
import type { Ailment, BattleEvent, Combatant, Command, Element } from '../game/types';

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

interface EnemyExtras {
  weakBadges: Phaser.GameObjects.Text[];
  pips: Phaser.GameObjects.Rectangle[];
  intentBg: Phaser.GameObjects.Rectangle;
  intentText: Phaser.GameObjects.Text;
  breakLabel: Phaser.GameObjects.Text;
  ailmentBadges: Record<Ailment, Phaser.GameObjects.Text>;
}

interface PartyStatusRow {
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Text;
  mp: Phaser.GameObjects.Text;
  ailments: Record<Ailment, Phaser.GameObjects.Text>;
}

const ELEMENT_LETTER: Record<string, string> = { phys: 'P', fire: 'F', ice: 'I', holy: 'H' };
const ELEMENT_COLOR: Record<string, string> = {
  phys: '#e8ecff', fire: '#ff8a5a', ice: '#6cb8ff', holy: '#ffe07a',
};

const AILMENT_ORDER: Ailment[] = ['burn', 'chill', 'venom'];
const AILMENT_LETTER: Record<Ailment, string> = { burn: 'B', chill: 'C', venom: 'V' };
const AILMENT_COLOR: Record<Ailment, string> = { burn: '#ff8a5a', chill: '#6cb8ff', venom: '#8aff6c' };
const AILMENT_TINT: Record<Ailment, number> = { burn: 0xff8a5a, chill: 0x6cb8ff, venom: 0x8aff6c };
const AILMENT_STAMP: Record<Ailment, string> = { burn: 'BURNING!', chill: 'CHILLED!', venom: 'POISONED!' };

/**
 * Battle presentation layer. Drives the Battle engine by collecting commands
 * through menus, then playing the round events with animation.
 * Arrows = navigate, Z/Enter/Space = confirm, X/Backspace = cancel.
 * Hold Z during playback to fast-forward.
 */
export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private ui: UIState = 'menu';
  private isElite = false;

  // Input
  private activeActor!: Combatant; // whoever's turn it is in the CTB queue
  private menuIndex = 0;
  private options: MenuOption[] = [];
  private subIndex = 0;
  private subItems: { id: string; label: string; desc?: string; enabled: boolean; element?: Element; weak?: boolean }[] = [];
  private pending: PendingAction | null = null;
  private targets: Combatant[] = [];
  private targetIndex = 0;

  // Display
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private spriteHome = new Map<string, { x: number; y: number }>();
  private hpDisplay = new Map<string, number>();
  private mpDisplay = new Map<string, number>();
  private cursor!: Phaser.GameObjects.Text;
  private targetFrame!: Phaser.GameObjects.Ellipse;
  private menuText: Phaser.GameObjects.Text[] = [];
  private menuBacks: Phaser.GameObjects.Rectangle[] = [];
  private logText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private enemyHpBars = new Map<string, BarSet>();
  private enemyExtras = new Map<string, EnemyExtras>();
  private partyXpBars = new Map<string, BarSet>();
  private partyHpBars = new Map<string, BarSet>();
  private partyStatusRows = new Map<string, PartyStatusRow>();
  private turnChips: Phaser.GameObjects.GameObject[] = [];
  private log: string[] = [];
  private unsubs: (() => void)[] = [];
  private touchCleanups: (() => void)[] = [];

  constructor() {
    super('Battle');
  }

  private resetState() {
    this.ui = 'menu';
    this.isElite = false;
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
    this.enemyExtras.clear();
    this.partyXpBars.clear();
    this.partyHpBars.clear();
    this.partyStatusRows.clear();
    this.turnChips = [];
    this.menuText = [];
    this.menuBacks = [];
    this.log = [];
    this.unsubs = [];
    this.touchCleanups = [];
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(400, 7, 6, 14);
    // Phaser reuses scene instances between battles, so reset all state.
    this.resetState();

    const run = getRun();
    const data = this.scene.settings.data as { enemies: Combatant[]; elite?: boolean };
    this.isElite = data.elite === true || data.enemies.some((e) => e.isElite);
    this.battle = new Battle(run.party, data.enemies, run.inventory);

    this.buildBackground();

    this.buildSprites();
    this.buildPanels();
    this.cursor = this.add.text(0, 0, '>', sharpText({ fontFamily: FONT, fontSize: '11px', color: '#f0d36c' })).setDepth(20).setVisible(false);
    this.targetFrame = this.add.ellipse(0, 0, 56, 56)
      .setStrokeStyle(2, 0xf0d36c, 0.95)
      .setDepth(19)
      .setVisible(false);

    this.bindKeys();
    this.syncDisplay();
    music.play('battle', getArea(run.depth).theme.id as AreaThemeId);
    this.pushLog(this.isElite ? 'An elite guardian blocks the way!' : 'Enemies appear!');
    this.battle.start();
    this.advance();
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
    // Combatants step into position at the start of battle rather than just
    // popping in — enemies slide in from further left, the party from
    // further right, staggered so the whole side doesn't arrive at once.
    const fromOffset = x < GAME.width / 2 ? -46 : 46;
    list.forEach((c, i) => {
      const homeY = startY + i * spacing;
      const img = this.add.image(x + fromOffset, homeY, c.spriteKey).setScale(2.4).setDepth(5).setAlpha(0);
      this.sprites.set(c.id, img);
      this.spriteHome.set(c.id, { x, y: homeY });
      this.tweens.add({
        targets: img,
        x,
        alpha: 1,
        duration: 550,
        delay: 150 + i * 140,
        ease: 'Back.easeOut',
        onComplete: () => this.startIdleMotion(img, c, i),
      });
    });
  }

  /** Elite ring + idle bob — started only once a combatant's entrance
   *  slide-in has finished, so nothing floats or pulses mid-slide. */
  private startIdleMotion(img: Phaser.GameObjects.Image, c: Combatant, i: number) {
    if (c.isElite) {
      const ring = this.add.ellipse(img.x, img.y + img.displayHeight / 2 + 3, img.displayWidth + 18, 12)
        .setStrokeStyle(2, 0xffa03c, 0.8).setDepth(4);
      this.tweens.add({ targets: ring, alpha: { from: 0.85, to: 0.3 }, duration: 700, yoyo: true, repeat: -1 });
    }
    // Idle float — enemies and party members bob at slightly different speeds
    const dur = c.side === 'enemy' ? 1600 + i * 220 : 2000 + i * 180;
    this.tweens.add({
      targets: img,
      y: { from: img.y - 2, to: img.y + 2 },
      duration: dur, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private buildPanels() {
    // Log box on the left, status box on the right.
    const panelY = GAME.height - 118;
    const statusX = GAME.width - 196;
    this.panel(4, panelY, GAME.width - 212, 114);
    this.panel(statusX - 6, panelY, 202, 114);
    this.promptText = this.add.text(10, panelY + 7, '', sharpText({ fontFamily: FONT, fontSize: '11px', color: '#a58cff' })).setDepth(15);
    this.logText = this.add.text(10, panelY + 26, '', sharpText({ fontFamily: FONT, fontSize: '11px', color: '#dfe4f5', lineSpacing: 5, wordWrap: { width: GAME.width - 226 } })).setDepth(15);
    this.add.text(statusX, panelY + 7, 'PARTY', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#f0d36c' })).setDepth(15);
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
      const bg = this.add.rectangle(0, 0, width, 5, 0x07060e, 0.88).setDepth(7).setStrokeStyle(1, 0x0c0e16);
      const fill = this.add.rectangle(0, 0, width - 2, 3, e.isBoss ? 0xff5a6a : 0x6cf0a0, 0.96).setOrigin(0, 0.5).setDepth(8);
      const label = this.add.text(0, 0, e.name, sharpText({ fontFamily: FONT, fontSize: e.isBoss ? '8px' : '7px', color: e.isElite ? '#ffcf6a' : '#dfe4f5', strokeThickness: 2 })).setOrigin(0.5, 1).setDepth(8);
      this.enemyHpBars.set(e.id, { bg, fill, label });

      // Weakness badges to the right of the HP bar.
      const weakBadges = (e.weakness ?? []).map((el, i) =>
        this.add.text(0, 0, ELEMENT_LETTER[el] ?? '?', sharpText({
          fontFamily: FONT, fontSize: '8px', color: ELEMENT_COLOR[el] ?? '#dfe4f5', strokeThickness: 3,
        })).setOrigin(0.5).setDepth(8).setData('slot', i),
      );
      // Guard pips under the HP bar.
      const pips: Phaser.GameObjects.Rectangle[] = [];
      for (let i = 0; i < (e.maxGuard ?? 0); i++) {
        pips.push(this.add.rectangle(0, 0, 5, 5, 0x6cd8f0, 0.95).setDepth(8).setStrokeStyle(1, 0x07141c, 1));
      }
      // Intent chip to the right of the sprite.
      const intentBg = this.add.rectangle(0, 0, 26, 14, 0x0d1024, 0.92).setDepth(9).setStrokeStyle(1, 0x2f3658, 0.9).setVisible(false);
      const intentText = this.add.text(0, 0, '', sharpText({ fontFamily: FONT, fontSize: '9px', color: '#ff8a5a', strokeThickness: 2 })).setOrigin(0.5).setDepth(10).setVisible(false);
      // BREAK label over the sprite.
      const breakLabel = this.add.text(0, 0, 'BREAK', sharpText({ fontFamily: FONT, fontSize: '11px', color: '#ff5a6a', strokeThickness: 4 })).setOrigin(0.5).setDepth(11).setVisible(false);
      // Ailment badges: small letters left of the HP bar (weaknesses sit right).
      const ailmentBadges = {} as Record<Ailment, Phaser.GameObjects.Text>;
      for (const a of AILMENT_ORDER) {
        ailmentBadges[a] = this.add.text(0, 0, AILMENT_LETTER[a], sharpText({
          fontFamily: FONT, fontSize: '8px', color: AILMENT_COLOR[a], strokeThickness: 3,
        })).setOrigin(0.5).setDepth(9).setVisible(false);
      }
      this.enemyExtras.set(e.id, { weakBadges, pips, intentBg, intentText, breakLabel, ailmentBadges });
      this.layoutEnemyBar(e.id);
    }
  }

  private buildPartyBars() {
    this.battle.party.forEach((c, i) => {
      const statusX = GAME.width - 196;
      const rowTop = GAME.height - 99 + i * 30;
      const barY = rowTop + 22;

      const rowBg = this.add.rectangle(statusX - 1, rowTop, 188, 27, i % 2 === 0 ? 0x11172b : 0x0f1427, 0.7)
        .setOrigin(0, 0)
        .setDepth(14);
      rowBg.setStrokeStyle(1, 0x2f3658, 0.45);

      const name = this.add.text(statusX + 5, rowTop + 4, '', sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 3 })).setDepth(16);
      const hpText = this.add.text(statusX + 58, rowTop + 4, '', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#6cf0a0', strokeThickness: 3 })).setDepth(16);
      const mpText = this.add.text(statusX + 126, rowTop + 4, '', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 3 })).setDepth(16);
      // Ailment badges in the free space left of the HP bar row.
      const ailments = {} as Record<Ailment, Phaser.GameObjects.Text>;
      AILMENT_ORDER.forEach((a, k) => {
        ailments[a] = this.add.text(statusX + 6 + k * 11, barY, AILMENT_LETTER[a], sharpText({
          fontFamily: FONT, fontSize: '8px', color: AILMENT_COLOR[a], strokeThickness: 3,
        })).setOrigin(0, 0.5).setDepth(17).setVisible(false);
      });
      this.partyStatusRows.set(c.id, { bg: rowBg, name, hp: hpText, mp: mpText, ailments });

      const hpBg = this.add.rectangle(statusX + 58, barY, 64, 5, 0x07060e, 0.9).setOrigin(0, 0.5).setDepth(16);
      const hpFill = this.add.rectangle(statusX + 59, barY, 62, 3, 0x6cf0a0, 0.95).setOrigin(0, 0.5).setDepth(17);
      this.partyHpBars.set(c.id, { bg: hpBg, fill: hpFill });

      const xpBg = this.add.rectangle(statusX + 126, barY, 50, 5, 0x07060e, 0.9).setOrigin(0, 0.5).setDepth(16);
      const xpFill = this.add.rectangle(statusX + 127, barY, 48, 3, 0x8a6cf0, 0.95).setOrigin(0, 0.5).setDepth(17);
      this.partyXpBars.set(c.id, { bg: xpBg, fill: xpFill });
    });
  }

  // --- Turn Order & Intents ---------------------------------------------------

  /** Vertical CTB queue on the right edge: active actor + upcoming turns,
   * live-updated after every single action (not once per round). Shows each
   * combatant's own portrait/battle sprite rather than a name-letter chip. */
  private renderQueue() {
    for (const chip of this.turnChips) chip.destroy();
    this.turnChips = [];
    const upcoming = [this.activeActor, ...this.battle.previewQueue(7)];
    const x = GAME.width - 26;
    const ACTIVE_SIZE = 42;
    const REST_SIZE = 18;
    // Momentum stacks are a battle-wide crit bonus (boons.ts), not tied to any
    // one party member, so it rides along in the queue label instead of a
    // per-character badge.
    const momentum = this.battle.momentumInfo();
    const showMomentum = momentum.active && momentum.stacks > 0;
    const label = this.add.text(
      x, 4,
      showMomentum ? `ORDER ✦${momentum.stacks}` : 'ORDER',
      sharpText({ fontFamily: FONT, fontSize: '7px', color: showMomentum ? '#f0d36c' : '#8a93b8', strokeThickness: 2 }),
    ).setOrigin(0.5, 0).setDepth(30);
    this.turnChips.push(label);
    let cursorY = 16;
    upcoming.forEach((c, i) => {
      const isParty = c.side === 'party';
      const active = i === 0;
      const size = active ? ACTIVE_SIZE : REST_SIZE;
      const y = cursorY + size / 2;
      cursorY = y + size / 2 + (active ? 5 : 2);
      // Active slot is much larger, with a solid gold frame — the whole
      // point is that whoever's turn it is jumps out at a glance.
      const bg = this.add.rectangle(x, y, size, size, active ? 0xf0d36c : (isParty ? 0x11241c : 0x241114), active ? 1 : 0.75)
        .setDepth(30)
        .setStrokeStyle(active ? 0 : 1, c.broken ? 0x5a6080 : isParty ? c.color : 0xaa3344, 0.95);
      this.turnChips.push(bg);
      const portraitKey = isParty ? `portrait_${c.id}` : c.spriteKey;
      if (c.broken) {
        const mark = this.add.text(x, y, '✖', sharpText({
          fontFamily: FONT, fontSize: active ? '20px' : '10px', strokeThickness: 2, color: '#5a6080',
        })).setOrigin(0.5).setDepth(31);
        this.turnChips.push(mark);
      } else if (this.textures.exists(portraitKey)) {
        const inset = active ? 6 : 3;
        const img = this.add.image(x, y, portraitKey).setDisplaySize(size - inset, size - inset).setDepth(31);
        this.turnChips.push(img);
      } else {
        const letter = this.add.text(x, y, c.name[0], sharpText({
          fontFamily: FONT, fontSize: active ? '18px' : '8px', strokeThickness: 2,
          color: active ? '#141a30' : isParty ? '#' + c.color.toString(16).padStart(6, '0') : '#ff8a8a',
        })).setOrigin(0.5).setDepth(31);
        this.turnChips.push(letter);
      }
    });
  }

  /** Shows each living enemy's telegraphed action next to its sprite. */
  private renderIntents() {
    for (const e of this.battle.enemies) {
      const ex = this.enemyExtras.get(e.id);
      if (!ex) continue;
      if (e.stats.hp <= 0 || e.broken || !e.intent) {
        ex.intentBg.setVisible(false);
        ex.intentText.setVisible(false);
        continue;
      }
      const { glyph, color } = this.intentGlyph(e.intent);
      ex.intentText.setText(glyph).setColor(color).setVisible(true);
      ex.intentBg.setVisible(true);
      ex.intentBg.width = ex.intentText.width + 10;
    }
    this.layoutAllEnemyUi();
  }

  private intentGlyph(cmd: Command): { glyph: string; color: string } {
    switch (cmd.type) {
      case 'attack': {
        const target = this.battle.byId(cmd.targetId);
        return { glyph: `⚔${target ? ' ' + target.name[0] : ''}`, color: '#ff8a5a' };
      }
      case 'spell': {
        const spell = SPELLS[cmd.spellId];
        if (spell?.kind === 'heal') return { glyph: '✚', color: '#7df0a0' };
        const target = this.battle.byId(cmd.targetId);
        return { glyph: `✦${target ? ' ' + target.name[0] : ''}`, color: '#b28cff' };
      }
      case 'phase':
        return { glyph: '!!', color: '#ff4455' };
      default:
        return { glyph: '…', color: '#8a93b8' };
    }
  }

  // --- Command Phase --------------------------------------------------------

  /** Advances the CTB queue to the next actor and either opens their command
   * menu (party) or runs their telegraphed action (enemy). Ticks (ailments,
   * MP regen, broken-recovery) may consume the turn with no command needed. */
  private advance() {
    const { actor, events, needsCommand } = this.battle.startTurn();
    this.activeActor = actor;
    this.playEvents(events, 0, () => {
      if (this.syncAndCheckEnd()) return;
      if (!needsCommand) { this.advance(); return; }
      this.renderQueue();
      this.renderIntents();
      if (actor.side === 'party') this.openMenu();
      else this.runEnemyTurn(actor);
    });
  }

  private runEnemyTurn(actor: Combatant) {
    this.runAction(actor.intent ?? { type: 'defend' });
  }

  /** Syncs displayed HP/MP and handles a battle-ending phase. Returns true
   * if the battle ended (caller should stop advancing the queue). */
  private syncAndCheckEnd(): boolean {
    this.syncDisplay();
    switch (this.battle.phase) {
      case 'won': this.onVictory(); return true;
      case 'fled': this.endBattle(500); return true;
      case 'lost': this.gameOver(); return true;
      default: return false;
    }
  }

  private openMenu() {
    this.ui = 'menu';
    this.menuIndex = 0;
    const m = this.activeActor;
    const hasSpells = m.spells.some((s) => SPELLS[s]);
    const itemsAvail = Object.entries(getRun().inventory)
      .some(([id, n]) => n > 0 && ITEMS[id]?.target === 'ally');
    this.options = [
      { label: 'Attack', action: 'attack', enabled: true },
      { label: battleArtLabel(m.id), action: 'magic', enabled: hasSpells },
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
      const bg = this.add.rectangle(8, GAME.height - 95 + i * 18, GAME.width - 220, 16, i === this.menuIndex ? 0x1e2746 : 0x11172b, o.enabled ? 0.92 : 0.55)
        .setOrigin(0, 0)
        .setDepth(15);
      bg.setStrokeStyle(1, i === this.menuIndex ? 0xf0d36c : 0x2f3658, o.enabled ? 0.95 : 0.45);
      this.menuBacks.push(bg);
      const color = !o.enabled ? '#5a6080' : i === this.menuIndex ? '#f0d36c' : '#c9cee8';
      const prefix = i === this.menuIndex ? '▶ ' : '  ';
      const t = this.add.text(16, GAME.height - 92 + i * 18, prefix + o.label, sharpText({ fontFamily: FONT, fontSize: '12px', color })).setDepth(16);
      this.menuText.push(t);
    });
    this.cursor.setVisible(false);
    this.targetFrame.setVisible(false);
    this.markActiveMember();

    if (isTouchDevice()) {
      this.options.forEach((_o, i) => {
        const zone = this.add.rectangle(8, GAME.height - 95 + i * 18, GAME.width - 220, 16, 0xffffff, 0)
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
      const bg = this.add.rectangle(8, GAME.height - 95 + i * 18, GAME.width - 220, 16, i === this.subIndex ? 0x1e2746 : 0x11172b, o.enabled ? 0.92 : 0.55)
        .setOrigin(0, 0)
        .setDepth(15);
      bg.setStrokeStyle(1, i === this.subIndex ? 0xf0d36c : 0x2f3658, o.enabled ? 0.95 : 0.45);
      this.menuBacks.push(bg);
      const color = !o.enabled ? '#5a6080' : i === this.subIndex ? '#f0d36c' : '#c9cee8';
      const prefix = i === this.subIndex ? '▶ ' : '  ';
      const t = this.add.text(16, GAME.height - 92 + i * 18, prefix + o.label, sharpText({ fontFamily: FONT, fontSize: '12px', color })).setDepth(16);
      this.menuText.push(t);
      if (o.element) {
        // Same element badge used on enemies (ELEMENT_LETTER/ELEMENT_COLOR),
        // so a glance at the spell list matches what you already see on
        // their HP bars. A star + gold flags a current weakness match.
        const badgeColor = o.weak ? '#f0d36c' : (ELEMENT_COLOR[o.element] ?? '#dfe4f5');
        const badgeText = (o.weak ? '✦' : '') + (ELEMENT_LETTER[o.element] ?? '?');
        const badge = this.add.text(178, GAME.height - 91 + i * 18, badgeText, sharpText({
          fontFamily: FONT, fontSize: '8px', color: badgeColor, strokeThickness: 2,
        })).setDepth(16);
        this.menuText.push(badge);
      }
      if (o.desc) {
        const d = this.add.text(200, GAME.height - 90 + i * 18, o.desc, sharpText({ fontFamily: FONT, fontSize: '8px', color: o.enabled ? '#8fa8c8' : '#4a5070', strokeThickness: 2 })).setDepth(16);
        this.menuText.push(d);
      }
    });
    this.targetFrame.setVisible(false);

    if (isTouchDevice()) {
      this.subItems.forEach((_o, i) => {
        const zone = this.add.rectangle(8, GAME.height - 95 + i * 18, GAME.width - 220, 16, 0xffffff, 0)
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
    this.menuBacks.forEach((r) => r.destroy());
    this.menuBacks = [];
    for (const fn of this.touchCleanups) fn();
    this.touchCleanups = [];
    this.clearSpriteTouchTargets();
  }

  private markActiveMember() {
    const m = this.activeActor;
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
    attachTouchControls(this, 'top', 'battle');
  }

  private nav(dir: number) {
    if (this.ui === 'menu') {
      this.menuIndex = this.wrap(this.menuIndex, dir, this.options.length);
      this.renderMenu(this.promptText.text);
      sfx.play('cursor');
    } else if (this.ui === 'submenu') {
      this.subIndex = this.wrap(this.subIndex, dir, this.subItems.length);
      this.renderSubmenu(this.promptText.text);
      sfx.play('cursor');
    } else if (this.ui === 'target' || this.ui === 'subtarget') {
      this.navTarget(dir);
      sfx.play('cursor');
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
    if (this.ui === 'busy') return; // held confirm fast-forwards playback instead
    sfx.play('confirm');
    if (this.ui === 'menu') this.confirmMenu();
    else if (this.ui === 'submenu') this.confirmSubmenu();
    else if (this.ui === 'target' || this.ui === 'subtarget') this.confirmTarget();
  }

  private cancel() {
    sfx.play('cancel');
    if (this.ui === 'submenu') {
      this.openMenu();
    } else if (this.ui === 'target') {
      this.openMenu();
    } else if (this.ui === 'subtarget') {
      // back to the spell or item list
      if (this.pending?.kind === 'spell') this.openMagic();
      else if (this.pending?.kind === 'item') this.openItems();
      else this.openMenu();
    }
    // Top-level command menu: nothing to back out of, and the pause menu is
    // deliberately unreachable mid-battle (it would let you re-equip gear or
    // cast field-only healing outside the CTB rules). Flee is the only exit.
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
    const m = this.activeActor;
    this.ui = 'submenu';
    this.subIndex = 0;
    // Show each spell's element (same badge used on enemies) and flag it if
    // it currently hits a living enemy's weakness — so you don't have to
    // commit to a spell and reach target-select just to find that out.
    const livingEnemies = this.battle.living('enemy');
    this.subItems = m.spells.map((id) => {
      const s = SPELLS[id];
      const ok = m.stats.mp >= s.cost;
      const element = s.element && s.element !== 'none' ? s.element : undefined;
      const weak = element ? livingEnemies.some((e) => e.weakness?.includes(element)) : false;
      return { id, label: `${s.name}  ${s.cost}MP`, desc: s.desc, enabled: ok, element, weak };
    });
    if (this.subItems.length === 0) {
      this.openMenu();
      return;
    }
    this.pending = { kind: 'spell' };
    this.renderSubmenu(`${m.name} - ${battleArtLabel(m.id).toLowerCase()}`);
  }

  private openItems() {
    const inv = getRun().inventory;
    this.ui = 'submenu';
    this.subIndex = 0;
    this.subItems = Object.entries(inv)
      .filter(([, n]) => n > 0)
      .filter(([id]) => ITEMS[id]?.target === 'ally')
      .map(([id, n]) => ({ id, label: `${ITEMS[id]?.name ?? id}  x${n}`, desc: ITEMS[id]?.description, enabled: true }));
    if (this.subItems.length === 0) {
      this.openMenu();
      return;
    }
    this.pending = { kind: 'item' };
    this.renderSubmenu(`${this.activeActor.name} - item`);
  }

  private confirmSubmenu() {
    const sel = this.subItems[this.subIndex];
    if (!sel || !sel.enabled) return;
    if (this.pending?.kind === 'spell') {
      this.pending.id = sel.id;
      const spell = SPELLS[sel.id];
      // Multi-target spells need no target selection.
      if (spell.target === 'all-enemies') {
        const first = this.battle.living('enemy')[0];
        this.commit({ type: 'spell', spellId: sel.id, targetId: first?.id ?? '' });
        return;
      }
      if (spell.target === 'party') {
        this.commit({ type: 'spell', spellId: sel.id, targetId: this.activeActor.id });
        return;
      }
      this.beginTargeting(spell.target === 'ally' ? 'party' : 'enemy', 'subtarget');
    } else if (this.pending?.kind === 'item') {
      this.pending.id = sel.id;
      const item = ITEMS[sel.id];
      this.beginTargeting('party', 'subtarget', item?.kind === 'revive');
    }
  }

  private beginTargeting(side: 'party' | 'enemy', state: 'target' | 'subtarget', downedOnly = false) {
    // Revive items target a fallen ally instead of a living one.
    this.targets = downedOnly ? this.battle.party.filter((c) => c.stats.hp <= 0) : this.battle.living(side);
    if (this.targets.length === 0) {
      this.openMenu();
      return;
    }
    this.targetIndex = 0;
    this.ui = state;
    this.clearMenuText();
    this.promptText.setText(isTouchDevice() ? 'Choose target - tap or use < >' : 'Choose target  < >');
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
    if (img) {
      this.cursor.setPosition(img.x - img.displayWidth / 2 - 8, img.y - 4).setVisible(true);
      this.targetFrame
        .setPosition(img.x, img.y)
        .setSize(img.displayWidth + 16, img.displayHeight + 16)
        .setVisible(true);
    }
    // Hint the matchup: does the pending action hit a weakness?
    // Attacks strike as the active member's weapon element (default phys).
    if (t.side === 'enemy' && this.pending) {
      const element: Element | undefined = this.pending.kind === 'attack'
        ? this.activeActor.attackElement ?? 'phys'
        : this.pending.kind === 'spell' && this.pending.id ? SPELLS[this.pending.id]?.element : undefined;
      if (element && element !== 'none' && t.weakness?.includes(element)) {
        this.promptText.setText(`Choose target  < >   ▶ ${t.name}: WEAK to this!`);
        return;
      }
    }
    this.promptText.setText(isTouchDevice() ? 'Choose target - tap or use < >' : 'Choose target  < >');
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
    this.pending = null;
    this.runAction(cmd);
  }

  // --- Resolution and Playback ---------------------------------------------

  /** Runs the active actor's command through the engine and plays its
   * (typically 1-3) events, then advances the queue to whoever's next. */
  private runAction(cmd: Command) {
    const actor = this.activeActor;
    this.ui = 'busy';
    this.returnAllHeroesHome();
    this.cursor.setVisible(false);
    this.targetFrame.setVisible(false);
    this.clearMenuText();
    this.promptText.setText('');
    this.logText.setVisible(true);
    // Snapshot for progressive HP reveal during playback.
    for (const c of this.battle.all()) {
      this.hpDisplay.set(c.id, c.stats.hp);
      this.mpDisplay.set(c.id, c.stats.mp);
    }
    const events = this.battle.executeTurn(actor, cmd);
    this.playEvents(events, 0, () => {
      if (this.syncAndCheckEnd()) return;
      this.advance();
    });
  }

  private playEvents(events: BattleEvent[], i: number, onDone: () => void) {
    if (i >= events.length) {
      this.time.delayedCall(250, onDone);
      return;
    }
    const ev = events[i];
    this.pushLog(ev.text);
    this.animateEvent(ev);
    if (ev.kind === 'attack') sfx.play('hit');
    else if (ev.kind === 'spell') sfx.play('magic');
    else if (ev.kind === 'item') sfx.play('chest');
    else if (ev.kind === 'break') this.playBreak(ev.targetId);
    else if (ev.kind === 'phase') this.playPhaseTransition(ev.actorId);
    else if (ev.kind === 'ailment') this.playAilment(ev.targetId, ev.ailment);

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
    // Revives (Phoenix Down, or the Anchor's Promise boon) bring hp back above
    // zero on a sprite fadeKo left dimmed and dropped — undo that visually.
    if (ev.targetId) {
      const revived = this.battle.byId(ev.targetId);
      const img = this.sprites.get(ev.targetId);
      if (revived && img && revived.stats.hp > 0 && img.alpha < 1) this.reviveSprite(ev.targetId);
    }

    this.refreshStatus();
    // Hold confirm to fast-forward the round.
    const base = ev.kind === 'phase' ? 950 : ev.kind === 'break' ? 700 : ev.kind === 'ailment' ? 560 : 460;
    const delay = input.isDown('confirm') ? Math.round(base * 0.35) : base;
    this.time.delayedCall(delay, () => this.playEvents(events, i + 1, onDone));
  }

  private onVictory() {
    const run = getRun();
    run.gold += this.battle.goldWon;
    // Award XP and show level-up events in the log.
    const xpEvents = grantXp(run.party, this.battle.xpWon);
    for (const ev of xpEvents) this.pushLog(ev.text);
    if (xpEvents.length > 0) sfx.play('levelup');
    for (const c of this.battle.all()) {
      this.hpDisplay.set(c.id, c.stats.hp);
      this.mpDisplay.set(c.id, c.stats.mp);
    }
    this.refreshStatus();

    const boss = this.battle.enemies.some((e) => e.isBoss);
    const depth = run.depth;
    const loot = grantBattleLoot(depth, boss, this.isElite);
    if (loot.length > 0) this.pushLog(`Loot: ${loot.join(', ')}`);
    let firstClear = false;
    if (boss) {
      const flag = depth <= 2 ? 'ch1_complete' : depth <= 4 ? 'ch2_complete' : depth <= 6 ? 'ch3_complete' : 'ch4_complete';
      firstClear = !hasFlag(flag);
      setFlag(flag);
      const questId = flag === 'ch1_complete' ? 'clear_ch1' : flag === 'ch2_complete' ? 'clear_ch2'
        : flag === 'ch3_complete' ? 'defeat_ashbrand' : 'defeat_prism_sovereign';
      const completedQuest = completeQuest(questId);
      if (completedQuest) this.pushLog(`Quest complete: ${completedQuest.title} — ${questRewardText(completedQuest)}`);
      track('chapter_clear', { ch: chapterOfDepth(depth), d: depth });
    }
    saveProgress();
    music.fanfare('victory');
    this.ui = 'over';

    if (boss) {
      this.time.delayedCall(1000, () => {
        const winScript = depth <= 2 ? 'ch1_win' : depth <= 4 ? 'ch2_win' : depth <= 6 ? 'ch3_win' : 'ch4_win';
        // The full ending + feedback prompt is a one-time capstone for the
        // first-ever Prism Sovereign kill. Later kills (Ascension replays)
        // still get the win dialogue, just not the "you finished the game"
        // ceremony again.
        const isFinalBossFirstClear = depth > 6 && firstClear;
        if (isFinalBossFirstClear) track('game_complete', { d: depth });
        // After the ending plays, prompt for feedback once — beating the game
        // is the single highest-signal moment to ask "how was the journey?".
        // The overlay's onClose resumes the flow home whether they send or not.
        const endingThenFeedback = () => this.scene.launch('Dialogue', {
          scriptId: 'ending',
          onDone: () => openFeedback('ending', {
            title: 'You reached the bottom',
            sub: 'Aether is restored. How was the journey? Anonymous — no account needed.',
            onClose: () => this.toTown(),
          }),
        });
        const afterWin = isFinalBossFirstClear ? endingThenFeedback : () => this.toTown();
        this.scene.launch('Dialogue', { scriptId: winScript, onDone: afterWin });
      });
      return;
    }

    // Choose a boon before returning to the descent — the roguelite core loop.
    this.time.delayedCall(900, () => {
      const choices = rollBoonChoices(run.boons, this.isElite);
      const finish = () => {
        this.scene.resume('Descent', { won: true, fromBattle: true });
        this.scene.stop();
      };
      if (choices.length === 0) {
        finish();
        return;
      }
      this.scene.launch('BoonPick', { choices, elite: this.isElite, onDone: finish });
    });
  }

  private endBattle(delay: number) {
    this.ui = 'over';
    this.time.delayedCall(delay, () => {
      this.scene.resume('Descent', { fromBattle: true });
      this.scene.stop();
    });
  }

  private gameOver() {
    this.ui = 'over';
    const depth = getRun().depth;
    const lost = applyWipePenalty();
    this.pushLog('The Anchor draws you back...');
    if (lost > 0) this.pushLog(`${lost} gold scatters into the dark.`);
    this.refreshStatus();
    music.fanfare('defeat');
    this.time.delayedCall(2400, () => {
      this.scene.stop('Descent');
      this.scene.start('RunSummary', { reason: 'wipe', lostGold: lost, depth });
      this.scene.stop();
    });
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
      this.tweens.add({
        targets: img, x: home.x, y: home.y, duration: 120, ease: 'Sine.easeOut',
        onComplete: () => {
          if (img.active) {
            this.tweens.add({ targets: img, y: { from: home.y - 2, to: home.y + 2 }, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          }
        },
      });
    }
  }

  private static spellColor(element?: string): number {
    switch (element) {
      case 'fire':  return 0xff4422;
      case 'ice':   return 0x44aaff;
      case 'holy':  return 0xffe866;
      case 'phys':  return 0xdfe4f5;
      default:      return 0x8a6cf0;
    }
  }

  private animateEvent(ev: BattleEvent) {
    if (ev.kind === 'attack' && ev.actorId && ev.targetId) {
      // Elemental weapons color the slash (fire sword slashes orange, ...).
      this.attackAnim(ev.actorId, ev.targetId, ev.element);
      if (ev.amount) this.floatNumber(ev.targetId, ev.amount, ev);
    } else if (ev.kind === 'spell' && ev.actorId && ev.targetId) {
      const isHeal = (ev.amount ?? 0) < 0;
      if (isHeal) {
        this.healAnim(ev.targetId, 0x6cf0a0);
        this.floatNumber(ev.targetId, ev.amount ?? 0, ev);
      } else {
        const color = BattleScene.spellColor(ev.element);
        if (ev.element === 'phys') {
          this.attackAnim(ev.actorId, ev.targetId, ev.element);
        } else {
          this.projectileAnim(ev.actorId, ev.targetId, color);
        }
        if (ev.amount) this.floatNumber(ev.targetId, ev.amount, ev);
      }
    } else if (ev.kind === 'item' && ev.targetId) {
      this.healAnim(ev.targetId, 0xf0d36c);
      if (ev.amount) this.floatNumber(ev.targetId, ev.amount, ev);
    } else if (ev.kind === 'defend' && ev.actorId) {
      this.guardAnim(ev.actorId);
    } else if (ev.kind === 'dot' && ev.targetId && ev.amount) {
      // Burn/venom end-of-round ticks.
      this.floatNumber(ev.targetId, ev.amount, ev);
    } else if (ev.kind === 'info' && ev.targetId && ev.amount) {
      // Lifesteal, thorns, revive — small floating numbers without an attack animation.
      this.floatNumber(ev.targetId, ev.amount, ev);
    }
  }

  private floatNumber(targetId: string, amount: number, ev?: BattleEvent) {
    const img = this.sprites.get(targetId);
    if (!img || amount === 0) return;
    const isHeal = amount < 0;
    const crit = ev?.crit === true;
    const weak = ev?.weak === true;
    const label = isHeal ? `+${Math.abs(amount)}` : `-${amount}`;
    const color = isHeal ? '#66ffaa' : crit ? '#ffd34d' : weak ? '#ffa03c' : '#ff6655';
    const size = crit ? '16px' : weak ? '13px' : '11px';
    const txt = this.add.text(img.x + Phaser.Math.Between(-6, 6), img.y - 18, label,
      { fontFamily: 'monospace', fontSize: size, color, stroke: '#07060e', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(40).setScale(crit ? 1.5 : 1.2);
    this.tweens.add({ targets: txt, scale: 1, duration: 130, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: txt, y: txt.y - 22, alpha: 0, duration: crit ? 1100 : 900,
      ease: 'Sine.easeOut', onComplete: () => txt.destroy(),
    });
    if (crit || weak) {
      const tag = this.add.text(img.x, img.y - 34, crit ? 'CRIT!' : 'WEAK', sharpText({
        fontFamily: FONT, fontSize: '9px', color: crit ? '#ffd34d' : '#ffa03c', strokeThickness: 3,
      })).setOrigin(0.5, 1).setDepth(40);
      this.tweens.add({ targets: tag, y: tag.y - 14, alpha: 0, duration: 800, ease: 'Sine.easeOut', onComplete: () => tag.destroy() });
    }
  }

  private attackAnim(actorId: string, targetId: string, element?: string) {
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
    const slashColor = element && element !== 'phys' && element !== 'none'
      ? BattleScene.spellColor(element)
      : 0xeef2ff;
    this.slashAt(target.x, target.y, slashColor);
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
      duration: 240,
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

  private slashAt(x: number, y: number, color = 0xeef2ff) {
    const a = this.add.rectangle(x - 6, y - 2, 22, 3, color, 0.9).setAngle(-35).setDepth(32);
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

  /** Ailment applied: colored tint flash + a floating status tag. */
  private playAilment(targetId?: string, ailment?: Ailment) {
    if (!targetId || !ailment) return;
    const img = this.sprites.get(targetId);
    if (!img) return;
    sfx.play('magic');
    img.setTintFill(AILMENT_TINT[ailment]);
    this.time.delayedCall(180, () => img.active && img.clearTint());
    const tag = this.add.text(img.x, img.y - 26, AILMENT_STAMP[ailment], sharpText({
      fontFamily: FONT, fontSize: '10px', color: AILMENT_COLOR[ailment], strokeThickness: 4,
    })).setOrigin(0.5, 1).setDepth(42).setScale(1.4);
    this.tweens.add({ targets: tag, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: tag, y: tag.y - 12, alpha: 0, delay: 420, duration: 420,
      ease: 'Sine.easeOut', onComplete: () => tag.destroy(),
    });
  }

  /** BREAK: big stamp on the enemy, white flash, heavy shake. */
  private playBreak(targetId?: string) {
    if (!targetId) return;
    const img = this.sprites.get(targetId);
    if (!img) return;
    sfx.play('hit');
    sfx.play('levelup');
    this.cameras.main.shake(220, 0.012);
    img.setTintFill(0xffffff);
    this.time.delayedCall(200, () => img.active && img.clearTint());
    const stamp = this.add.text(img.x, img.y - 6, 'BREAK!', sharpText({
      fontFamily: FONT, fontSize: '18px', color: '#ffd34d', strokeThickness: 5,
    })).setOrigin(0.5).setDepth(45).setScale(2).setAngle(-8);
    this.tweens.add({ targets: stamp, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: stamp, y: stamp.y - 10, alpha: 0, delay: 700, duration: 500,
      ease: 'Sine.easeIn', onComplete: () => stamp.destroy(),
    });
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const shard = this.add.rectangle(img.x, img.y, 5, 3, 0x6cd8f0, 0.9).setDepth(33).setAngle(45);
      this.tweens.add({
        targets: shard, x: img.x + Math.cos(angle) * 34, y: img.y + Math.sin(angle) * 22,
        alpha: 0, angle: 180, duration: 450, ease: 'Quad.easeOut', onComplete: () => shard.destroy(),
      });
    }
    this.refreshEnemyBars();
  }

  private playPhaseTransition(bossId?: string) {
    // Full-screen flash + heavy shake
    const bossColors: Record<string, number> = {
      forest_shade: 0x220033,
      tide_warden:  0x003344,
      ashbrand:     0x440800,
    };
    const color = bossId ? (bossColors[bossId] ?? 0x111122) : 0x111122;
    const flash = this.add.rectangle(0, 0, GAME.width, GAME.height, color, 0.85)
      .setOrigin(0, 0).setDepth(50);
    this.tweens.add({ targets: flash, alpha: 0, duration: 900, ease: 'Expo.easeOut', onComplete: () => flash.destroy() });
    this.cameras.main.shake(500, 0.018);
    // Burst from boss sprite
    if (bossId) {
      const img = this.sprites.get(bossId);
      if (img) {
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI * 2 * i) / 10;
          const p = this.add.circle(img.x, img.y, 3, 0xeef2ff, 0.9).setDepth(52);
          this.tweens.add({
            targets: p, x: img.x + Math.cos(angle) * 50, y: img.y + Math.sin(angle) * 30,
            alpha: 0, duration: 500, ease: 'Quad.easeOut', onComplete: () => p.destroy(),
          });
        }
        // Tint the boss sprite red/dark briefly
        img.setTintFill(0xff2200);
        this.time.delayedCall(350, () => img.clearTint());
      }
    }
    sfx.play('levelup'); // dramatic sound
  }

  private fadeKo(id: string) {
    const img = this.sprites.get(id);
    if (!img) return;
    this.tweens.add({ targets: img, alpha: 0.18, y: img.y + 8, duration: 360, ease: 'Sine.easeIn' });
  }

  private reviveSprite(id: string) {
    const img = this.sprites.get(id);
    const home = this.spriteHome.get(id);
    if (!img) return;
    this.tweens.add({ targets: img, alpha: 1, y: home?.y ?? img.y - 8, duration: 300, ease: 'Sine.easeOut' });
  }

  private syncDisplay() {
    for (const c of this.battle.all()) {
      this.hpDisplay.set(c.id, c.stats.hp);
      this.mpDisplay.set(c.id, c.stats.mp);
    }
    this.refreshStatus();
  }

  private clearSpriteTouchTargets() {
    for (const img of this.sprites.values()) {
      img.removeInteractive();
    }
  }

  private layoutEnemyBar(id: string) {
    const img = this.sprites.get(id);
    const bar = this.enemyHpBars.get(id);
    if (!img || !bar) return;

    const y = img.y - img.displayHeight / 2 - 10;
    const left = img.x - bar.bg.width / 2 + 1;

    bar.bg.setPosition(img.x, y);
    bar.fill.setPosition(left, y);
    bar.label?.setPosition(img.x, y - 4);

    const ex = this.enemyExtras.get(id);
    if (!ex) return;
    // Guard pips: centered row right under the HP bar.
    const pipCount = ex.pips.length;
    const pipsW = pipCount * 7 - 2;
    ex.pips.forEach((p, i) => p.setPosition(img.x - pipsW / 2 + i * 7 + 2, y + 7));
    // Weakness badges: small letters to the right of the HP bar.
    ex.weakBadges.forEach((b, i) => b.setPosition(img.x + bar.bg.width / 2 + 8 + i * 9, y));
    // Ailment badges: mirrored on the left side of the HP bar.
    AILMENT_ORDER.forEach((a, i) => ex.ailmentBadges[a].setPosition(img.x - bar.bg.width / 2 - 8 - i * 9, y));
    // Intent chip: floating to the right of the sprite.
    const ix = img.x + img.displayWidth / 2 + 18;
    ex.intentBg.setPosition(ix, img.y - 8);
    ex.intentText.setPosition(ix, img.y - 8);
    // BREAK label above the sprite center.
    ex.breakLabel.setPosition(img.x, img.y - 2);
  }

  private layoutAllEnemyUi() {
    for (const e of this.battle.enemies) this.layoutEnemyBar(e.id);
  }

  private refreshStatus() {
    for (const c of this.battle.party) {
      const hp = Math.round(this.hpDisplay.get(c.id) ?? c.stats.hp);
      const mp = Math.round(this.mpDisplay.get(c.id) ?? c.stats.mp);
      const row = this.partyStatusRows.get(c.id);
      if (!row) continue;
      const dead = hp <= 0;
      row.name.setText(`${c.name} L${c.level ?? 1}`).setColor(dead ? '#ff5a6a' : '#dfe4f5');
      row.hp.setText(dead ? `KO ${hp}/${c.stats.maxHp}` : `HP ${hp}/${c.stats.maxHp}`);
      row.hp.setColor(dead ? '#ff5a6a' : '#6cf0a0');
      row.mp.setText(c.stats.maxMp > 0 ? `MP ${mp}/${c.stats.maxMp}` : '');
      row.bg.setAlpha(dead ? 0.38 : 0.7);
      // Guardian's Wrath (boons.ts): defending buffs the next action — glow
      // the row gold, same accent used for the active-turn chip, while it's live.
      const buffed = !dead && c.guardBuffed === true;
      row.bg.setStrokeStyle(buffed ? 2 : 1, buffed ? 0xf0d36c : 0x2f3658, buffed ? 0.9 : 0.45);
      for (const a of AILMENT_ORDER) {
        row.ailments[a].setVisible(!dead && (c.ailments?.[a] ?? 0) > 0);
      }
    }
    this.refreshPartyBars();
    this.refreshEnemyBars();
  }

  private refreshEnemyBars() {
    for (const e of this.battle.enemies) {
      const bar = this.enemyHpBars.get(e.id);
      if (!bar) continue;
      this.layoutEnemyBar(e.id);
      const hp = Math.round(this.hpDisplay.get(e.id) ?? e.stats.hp);
      const pct = Phaser.Math.Clamp(hp / e.stats.maxHp, 0, 1);
      bar.fill.setScale(pct, 1);
      bar.bg.setAlpha(hp > 0 ? 0.88 : 0.28);
      bar.fill.setAlpha(hp > 0 ? 0.96 : 0);
      bar.label?.setText(hp > 0 ? `${e.name} ${hp}/${e.stats.maxHp}` : `${e.name} KO`);

      const ex = this.enemyExtras.get(e.id);
      if (!ex) continue;
      const dead = hp <= 0;
      // Badge slots were built from the weakness list at battle start, but a
      // boss can mutate its own weakness mid-fight (Forest Shade's Umbral
      // Flicker) — re-read it live each refresh instead of trusting the
      // original slot count/letters.
      const weakness = e.weakness ?? [];
      ex.weakBadges.forEach((b, i) => {
        const el = weakness[i];
        b.setVisible(!dead && el != null);
        if (el != null) b.setText(ELEMENT_LETTER[el] ?? '?').setColor(ELEMENT_COLOR[el] ?? '#dfe4f5');
      });
      for (const a of AILMENT_ORDER) {
        ex.ailmentBadges[a].setVisible(!dead && (e.ailments?.[a] ?? 0) > 0);
      }
      ex.pips.forEach((p, i) => {
        p.setVisible(!dead && (e.maxGuard ?? 0) > 0);
        const remaining = e.guard ?? 0;
        p.setFillStyle(i < remaining ? 0x6cd8f0 : 0x1a2433, i < remaining ? 0.95 : 0.8);
      });
      if (dead) {
        ex.breakLabel.setVisible(false);
        ex.intentBg.setVisible(false);
        ex.intentText.setVisible(false);
      } else if (e.broken) {
        if (!ex.breakLabel.visible) {
          ex.breakLabel.setVisible(true).setAlpha(1);
          this.tweens.add({ targets: ex.breakLabel, alpha: { from: 1, to: 0.45 }, duration: 420, yoyo: true, repeat: -1 });
        }
      } else if (ex.breakLabel.visible) {
        this.tweens.killTweensOf(ex.breakLabel);
        ex.breakLabel.setVisible(false);
      }
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

function battleArtLabel(memberId: string): string {
  switch (memberId) {
    case 'kael': return 'Aether Arts';
    case 'lyra': return 'Hexes';
    case 'mira': return 'Prayers';
    default: return 'Magic';
  }
}
