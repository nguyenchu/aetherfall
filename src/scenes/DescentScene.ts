import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { getArea, makeEncounterForArea, type AreaTheme } from '../game/chapters';
import { BOONS } from '../game/boons';
import { getRun, applyDescentModifier, openChest, saveProgress, springUsed, useSpring, hasFlag, setFlag } from '../game/run';
import { input, attachTouchControls } from '../game/input';
import { music, sfx, type AreaThemeId } from '../audio/music';
import { sharpText, FONT } from '../ui/text';
import { markSeen } from '../game/dialogue';
import { track, chapterOfDepth } from '../game/analytics';
import { paintPixelGrid } from '../art/sprites';
import { themeFloor, themeWall, tileVariant } from '../art/tiles';

const PLAYER_SCALE_X = 1.08;
const PLAYER_SCALE_Y = 1.35;
const STEP_MS = 105;
const RANDOM_BATTLE_MIN_STEPS = 5;
// Bad-luck protection: independent per-step rolls can still produce long dry
// spells even at a reasonable average rate, which reads as "broken" rather
// than "unlucky". Force an encounter if one hasn't landed by this many steps.
const RANDOM_BATTLE_MAX_STEPS = 20;
type Facing = 'down' | 'up' | 'left' | 'right';

interface PartyHudRow {
  name: Phaser.GameObjects.Text;
  hpFill: Phaser.GameObjects.Rectangle;
  mpFill: Phaser.GameObjects.Rectangle;
}

/**
 * Fixed dungeon exploration. Each depth maps to a hand-crafted area defined
 * in chapters.ts. Trash fights trigger randomly while walking floor tiles;
 * bosses (B) and elite guardians (X) are fixed, marked encounters.
 * Treasure chests (T) and healing springs (H) reward exploring off the main path.
 */
export class DescentScene extends Phaser.Scene {
  private map: string[] = [];
  private currentThemeId = '';
  private player!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private tileImages = new Map<string, Phaser.GameObjects.Image>();
  private springImages = new Map<string, Phaser.GameObjects.Image>();
  private walkFrame = 0;
  private facing: Facing = 'down';
  private px = 0;
  private py = 0;
  private busy = false;
  private moveLockedUntil = 0;
  private pendingEncounterKey: string | null = null;
  private randomBattleSteps = 0;
  private unsubs: (() => void)[] = [];
  private hintText?: Phaser.GameObjects.Text;
  private goldText?: Phaser.GameObjects.Text;
  private boonTexts: Phaser.GameObjects.Text[] = [];
  private partyHud: PartyHudRow[] = [];
  private hudSignature = '';

  constructor() {
    super('Descent');
  }

  create(data?: { deeper?: boolean }) {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(300, 7, 6, 14);
    this.busy = false;
    this.unsubs = [];
    this.tileImages.clear();
    this.springImages.clear();
    this.pendingEncounterKey = null;
    this.randomBattleSteps = 0;
    this.hintText = undefined;
    this.goldText = undefined;
    this.boonTexts = [];
    this.partyHud = [];
    this.hudSignature = '';

    const run = getRun();
    const area = getArea(run.depth);
    this.map = area.map;

    // create() runs both on a fresh descent from Sanctuary (scene.start, no data)
    // and on advancing to the next stratum within a run (advanceArea's
    // scene.restart({ deeper: true })). Battle returns via RESUME, not create.
    // So a fresh entry is the one per-chapter "started" signal, while a deeper
    // entry marks reaching the next stratum — the mid-run progress the funnel
    // was otherwise blind to.
    if (data?.deeper) {
      track('descent_progress', { ch: chapterOfDepth(run.depth), d: run.depth });
    } else {
      track('chapter_start', { ch: chapterOfDepth(run.depth), d: run.depth, mod: run.modifier.id });
    }

    applyDescentModifier();
    this.currentThemeId = area.theme.id;
    this.buildThemeTiles(area.theme);
    this.ensureMarkerTextures();
    this.drawAtmosphere(area.theme);
    this.drawMap();
    this.placePortals();
    this.spawnPlayer();
    this.buildHud(area.name, area.theme.accent);
    this.buildPartyHud();
    this.refreshBoonHud();
    this.bindInput();
    attachTouchControls(this);

    music.play('explore', this.currentThemeId as AreaThemeId);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
    this.events.on(Phaser.Scenes.Events.RESUME, (_sys: unknown, data?: { won?: boolean; fromBattle?: boolean }) => {
      this.busy = false;
      music.play('explore', this.currentThemeId as AreaThemeId);
      this.moveLockedUntil = this.time.now + 220;
      // Only give a grace period after an actual fight (win or flee) — resuming
      // from the menu or a dialogue shouldn't cost the player their progress
      // toward the next random encounter.
      if (data?.fromBattle) this.randomBattleSteps = 0;
      if (data?.won && this.pendingEncounterKey) {
        const key = this.pendingEncounterKey;
        setFlag(`enc_${getRun().depth}_${key}`);
        this.clearEncounterMarker(key);
        this.pendingEncounterKey = null;
      }
      this.goldText?.setText(`Gold ${getRun().gold}`);
      this.refreshBoonHud();
    });
  }

  private buildThemeTiles(theme: AreaTheme) {
    // Three variants per tile type, picked per map cell via tileVariant().
    for (let v = 0; v < 3; v++) {
      paintPixelGrid(this, `th_floor_${theme.id}_${v}`, themeFloor(theme.floor, theme.accent, theme.id, 20 + v));
      paintPixelGrid(this, `th_floorAlt_${theme.id}_${v}`, themeFloor(theme.floorAlt, theme.accent, theme.id, 30 + v));
      paintPixelGrid(this, `th_wall_${theme.id}_${v}`, themeWall(theme, v));
    }
  }

  /** One-time textures for chests and springs. */
  private ensureMarkerTextures() {
    if (!this.textures.exists('chest')) {
      const g = this.add.graphics();
      g.fillStyle(0x6a4520, 1).fillRoundedRect(1, 4, 14, 10, 2);
      g.fillStyle(0x8a5c2c, 1).fillRoundedRect(1, 4, 14, 5, 2);
      g.lineStyle(1, 0xf0d36c, 0.95);
      g.strokeRoundedRect(1, 4, 14, 10, 2);
      g.lineBetween(1, 9, 15, 9);
      g.fillStyle(0xf0d36c, 1).fillRect(7, 7, 3, 4);
      g.generateTexture('chest', 16, 16);
      this.textures.get('chest').setFilter(Phaser.Textures.FilterMode.NEAREST);
      g.destroy();
    }
    if (!this.textures.exists('spring')) {
      const g = this.add.graphics();
      g.fillStyle(0x0e3040, 1).fillCircle(8, 8, 7);
      g.fillStyle(0x2a8ab8, 0.9).fillCircle(8, 8, 5);
      g.fillStyle(0x9ae8ff, 0.9).fillCircle(6, 6, 2);
      g.lineStyle(1, 0x6cd8f0, 0.9).strokeCircle(8, 8, 7);
      g.generateTexture('spring', 16, 16);
      this.textures.get('spring').setFilter(Phaser.Textures.FilterMode.NEAREST);
      g.destroy();
    }
  }

  private drawAtmosphere(theme: AreaTheme) {
    // Background fill
    this.add.rectangle(0, 0, GAME.width, GAME.height, theme.bg).setOrigin(0, 0).setDepth(-1);

    // Ambient floating particles
    const spawnParticle = () => {
      if (!this.scene.isActive()) return;
      const x = Phaser.Math.Between(0, GAME.width);
      const p = this.add.circle(x, GAME.height + 3, Phaser.Math.FloatBetween(0.6, 1.8),
        theme.fogColor, theme.fogAlpha).setDepth(1);
      const dur = Phaser.Math.Between(4000, 9000);
      this.tweens.add({
        targets: p, y: -6, x: x + Phaser.Math.Between(-20, 20),
        alpha: 0, duration: dur, ease: 'Linear',
        onComplete: () => { p.destroy(); spawnParticle(); },
      });
    };
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(Phaser.Math.Between(0, 3000), spawnParticle);
    }
  }

  private drawMap() {
    const depth = getRun().depth;
    for (let r = 0; r < this.map.length; r++) {
      for (let c = 0; c < this.map[r].length; c++) {
        const ch = this.map[r][c];
        const isWall = ch === '#';
        const tid = this.currentThemeId;
        const base = isWall ? 'th_wall' : (r + c) % 2 === 0 ? 'th_floor' : 'th_floorAlt';
        const texKey = `${base}_${tid}_${tileVariant(c, r, 3)}`;
        this.add.image(c * GAME.tile, r * GAME.tile, texKey).setOrigin(0, 0).setDepth(0);

        if (ch === 'P') { this.px = c; this.py = r; }

        const tileKey = `${c},${r}`;
        if (ch === 'X' && !hasFlag(`enc_${depth}_${tileKey}`)) {
          this.addEncounterMarker(c, r, tileKey);
        }
        if (ch === 'T' && !hasFlag(`chest_${depth}_${tileKey}`)) {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'chest').setOrigin(0, 0).setDepth(2);
          this.tileImages.set(tileKey, img);
        }
        if (ch === 'H') {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'spring').setOrigin(0, 0).setDepth(2);
          this.springImages.set(tileKey, img);
          if (springUsed(`${depth}_${tileKey}`)) {
            img.setAlpha(0.35);
          } else {
            this.tweens.add({ targets: img, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1 });
          }
        }
        if (ch === 'S' && !hasFlag(`story_${depth}_${tileKey}`)) {
          this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
            .setOrigin(0, 0).setTint(0x8a6cf0).setAlpha(0.85).setDepth(2);
        }
      }
    }
  }

  private placePortals() {
    for (let r = 0; r < this.map.length; r++) {
      for (let c = 0; c < this.map[r].length; c++) {
        const ch = this.map[r][c];
        const cx = c * GAME.tile + GAME.tile / 2;
        const cy = r * GAME.tile + GAME.tile / 2;
        if (ch === '>') {
          this.add.image(c * GAME.tile, r * GAME.tile, 'aether').setOrigin(0, 0).setDepth(2);
          this.add.text(cx, cy, '▶', sharpText({ fontFamily: FONT, fontSize: '10px', color: '#ffffff' })).setOrigin(0.5).setDepth(3);
        } else if (ch === '<') {
          this.add.image(c * GAME.tile, r * GAME.tile, 'aether').setOrigin(0, 0).setTint(0x6cf0c2).setDepth(2);
          this.add.text(cx, cy, '◀', sharpText({ fontFamily: FONT, fontSize: '10px', color: '#ffffff' })).setOrigin(0.5).setDepth(3);
        } else if (ch === 'B') {
          this.add.image(c * GAME.tile, r * GAME.tile, 'aether').setOrigin(0, 0).setTint(0xff2222).setDepth(2);
          this.add.text(cx, cy, '!', sharpText({ fontFamily: FONT, fontSize: '14px', color: '#ffaaaa' })).setOrigin(0.5).setDepth(3);
        }
      }
    }
  }

  private addEncounterMarker(c: number, r: number, key: string) {
    const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
      .setOrigin(0, 0).setTint(0xff8800).setAlpha(0.95).setDepth(2);
    this.tweens.add({ targets: img, alpha: { from: 0.95, to: 0.5 }, duration: 650, yoyo: true, repeat: -1 });
    this.add.text(c * GAME.tile + GAME.tile / 2, r * GAME.tile - 2, '!!', sharpText({
      fontFamily: FONT, fontSize: '9px', color: '#ffa03c', strokeThickness: 3,
    })).setOrigin(0.5, 1).setDepth(3).setName(`elite_label_${key}`);
    this.tileImages.set(key, img);
  }

  private clearEncounterMarker(key: string) {
    const img = this.tileImages.get(key);
    if (!img) return;
    this.tweens.add({ targets: img, alpha: 0, duration: 300, onComplete: () => img.destroy() });
    this.tileImages.delete(key);
    const label = this.children.getByName(`elite_label_${key}`);
    label?.destroy();
  }

  private spawnPlayer() {
    this.playerShadow = this.add.ellipse(
      this.tileCenter(this.px), this.tileCenter(this.py) + 8, 15, 5, 0x000000, 0.36,
    ).setDepth(4);
    this.player = this.add.image(
      this.tileCenter(this.px), this.tileCenter(this.py), 'player',
    ).setScale(PLAYER_SCALE_X, PLAYER_SCALE_Y).setDepth(5);
    // Subtle idle float
    this.tweens.add({
      targets: this.player,
      y: { from: this.player.y - 1.5, to: this.player.y + 1.5 },
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private buildHud(areaName: string, accentColor: number) {
    const hex = '#' + accentColor.toString(16).padStart(6, '0');
    const run = getRun();
    this.add.text(4, 4, 'AETHERFALL', sharpText({ fontFamily: FONT, fontSize: '12px', color: hex })).setDepth(10);
    this.add.text(4, 18, areaName, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5' })).setDepth(10);
    this.goldText = this.add.text(GAME.width - 4, 4, `Gold ${run.gold}`,
      sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c' })).setOrigin(1, 0).setDepth(10);
    // Active modifier
    const mod = run.modifier;
    if (mod.id !== 'none') {
      this.add.text(GAME.width - 4, 18, `✦ ${mod.name}`,
        sharpText({ fontFamily: FONT, fontSize: '8px', color: mod.color })).setOrigin(1, 0).setDepth(10);
    }
  }

  /** Boons picked this run, listed under the modifier in the top-right corner. */
  private refreshBoonHud() {
    for (const t of this.boonTexts) t.destroy();
    this.boonTexts = [];
    const boons = getRun().boons;
    const maxShown = 5;
    boons.slice(0, maxShown).forEach((id, i) => {
      const boon = BOONS[id];
      if (!boon) return;
      this.boonTexts.push(this.add.text(GAME.width - 4, 32 + i * 10, `◆ ${boon.name}`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#b8a8f8', strokeThickness: 2 })).setOrigin(1, 0).setDepth(10));
    });
    if (boons.length > maxShown) {
      this.boonTexts.push(this.add.text(GAME.width - 4, 32 + maxShown * 10, `+${boons.length - maxShown} more`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })).setOrigin(1, 0).setDepth(10));
    }
  }

  /** Compact party vitals in the bottom-left corner. */
  private buildPartyHud() {
    const run = getRun();
    const top = GAME.height - 14 - run.party.length * 13;
    this.add.rectangle(2, top - 4, 118, run.party.length * 13 + 8, 0x07060e, 0.62)
      .setOrigin(0, 0).setDepth(9).setStrokeStyle(1, 0x2f3658, 0.5);
    run.party.forEach((c, i) => {
      const y = top + i * 13;
      const name = this.add.text(6, y, c.name, sharpText({ fontFamily: FONT, fontSize: '7px', color: '#dfe4f5', strokeThickness: 2 })).setDepth(10);
      this.add.rectangle(44, y + 4, 44, 4, 0x07060e, 0.9).setOrigin(0, 0.5).setDepth(10).setStrokeStyle(1, 0x0c0e16);
      const hpFill = this.add.rectangle(45, y + 4, 42, 2, 0x6cf0a0, 0.95).setOrigin(0, 0.5).setDepth(11);
      this.add.rectangle(92, y + 4, 24, 4, 0x07060e, 0.9).setOrigin(0, 0.5).setDepth(10).setStrokeStyle(1, 0x0c0e16);
      const mpFill = this.add.rectangle(93, y + 4, 22, 2, 0x8a6cf0, 0.95).setOrigin(0, 0.5).setDepth(11);
      this.partyHud.push({ name, hpFill, mpFill });
    });
    this.updatePartyHud();
  }

  private updatePartyHud() {
    const run = getRun();
    const signature = run.party.map((c) => `${c.stats.hp}/${c.stats.mp}`).join('|');
    if (signature === this.hudSignature) return;
    this.hudSignature = signature;
    run.party.forEach((c, i) => {
      const row = this.partyHud[i];
      if (!row) return;
      const hpPct = Phaser.Math.Clamp(c.stats.hp / c.stats.maxHp, 0, 1);
      const mpPct = c.stats.maxMp > 0 ? Phaser.Math.Clamp(c.stats.mp / c.stats.maxMp, 0, 1) : 0;
      row.hpFill.setScale(hpPct, 1);
      row.hpFill.setFillStyle(hpPct < 0.3 ? 0xff5a6a : 0x6cf0a0, 0.95);
      row.mpFill.setScale(mpPct, 1);
    });
  }

  private bindInput() {
    this.unsubs.push(input.on('menu', () => {
      if (this.scene.isActive('GameMenu')) return;
      this.scene.pause();
      this.scene.launch('GameMenu', { caller: this.scene.key });
    }));
  }

  update(time: number) {
    if (!this.busy) {
      this.updateHint();
      this.updatePartyHud();
    }
    if (this.busy || time < this.moveLockedUntil) return;
    const d = input.dir();
    if (d.x === 0 && d.y === 0) return;

    const nx = this.px + d.x;
    const ny = this.py + d.y;
    const ch = this.map[ny]?.[nx];
    if (!ch || ch === '#') {
      this.moveLockedUntil = time + 110;
      return;
    }

    this.px = nx;
    this.py = ny;
    this.facing = this.facingFromDir(d.x, d.y);
    // walkPlayerTo is purely cosmetic (STEP_MS ≈ moveLockedUntil apart, so a
    // held direction reliably kills the previous step's tween just before it
    // completes). Game logic used to hang off that tween's onComplete, which
    // meant most tiles crossed while holding a direction never actually got
    // resolved — chests, springs, and random encounters all silently skipped.
    // Resolve the tile immediately instead, decoupled from the animation.
    this.walkPlayerTo(this.tileCenter(this.px), this.tileCenter(this.py));
    this.moveLockedUntil = time + 110;
    this.resolveTile();
    // Dark Drain modifier
    const drain = getRun().modifier.hpDrainPerStep;
    if (drain) {
      for (const c of getRun().party) c.stats.hp = Math.max(1, c.stats.hp - drain);
    }
  }

  private resolveTile() {
    const ch = this.map[this.py]?.[this.px];
    if (!ch) return;

    if (ch === '>') { this.advanceArea(); return; }
    if (ch === '<') { this.goHome(); return; }

    const tileKey = `${this.px},${this.py}`;
    const depth = getRun().depth;

    if ((ch === 'B' || ch === 'X') && !hasFlag(`enc_${depth}_${tileKey}`)) {
      this.triggerEncounter(tileKey, ch === 'B', ch === 'X');
      return;
    }
    if (ch === 'T' && !hasFlag(`chest_${depth}_${tileKey}`)) {
      this.openChestAt(tileKey);
      return;
    }
    if (ch === 'H' && !springUsed(`${depth}_${tileKey}`)) {
      this.useSpringAt(tileKey);
      return;
    }
    if (ch === 'S' && !hasFlag(`story_${depth}_${tileKey}`)) {
      this.triggerStory(tileKey);
      return;
    }

    this.maybeTriggerRandomEncounter(ch);
  }

  private triggerEncounter(tileKey: string, isBoss: boolean, isElite: boolean) {
    const area = getArea(getRun().depth);
    const group = area.encounters[tileKey] ?? (isBoss ? 'boss' : 'elite');
    this.busy = true;
    this.pendingEncounterKey = tileKey;
    this.scene.pause();
    this.scene.launch('Battle', { enemies: makeEncounterForArea(area, group), elite: isElite });
  }

  private openChestAt(tileKey: string) {
    const depth = getRun().depth;
    const area = getArea(depth);
    const contents = area.chests[tileKey];
    if (!contents) return;
    setFlag(`chest_${depth}_${tileKey}`);
    const lines = openChest(contents);
    sfx.play('chest');
    this.goldText?.setText(`Gold ${getRun().gold}`);
    const img = this.tileImages.get(tileKey);
    if (img) {
      this.tweens.add({ targets: img, alpha: 0, y: img.y - 4, duration: 500, delay: 200, onComplete: () => img.destroy() });
      this.tileImages.delete(tileKey);
    }
    lines.forEach((line, i) => this.floatText(line, '#f0d36c', i * 14));
  }

  private useSpringAt(tileKey: string) {
    const depth = getRun().depth;
    if (!useSpring(`${depth}_${tileKey}`)) return;
    sfx.play('magic');
    const img = this.springImages.get(tileKey);
    if (img) {
      this.tweens.killTweensOf(img);
      img.setAlpha(0.35);
    }
    // Rising sparkles around the player
    for (let i = 0; i < 6; i++) {
      const p = this.add.circle(
        this.player.x + Phaser.Math.Between(-10, 10), this.player.y + 6,
        Phaser.Math.FloatBetween(0.8, 1.6), 0x9ae8ff, 0.9,
      ).setDepth(12);
      this.tweens.add({
        targets: p, y: p.y - Phaser.Math.Between(14, 26), alpha: 0,
        duration: Phaser.Math.Between(500, 900), delay: i * 70, onComplete: () => p.destroy(),
      });
    }
    this.floatText('The spring restores you (+50% HP/MP)', '#9ae8ff', 0);
    this.updatePartyHud();
  }

  private floatText(text: string, color: string, delayOffset: number) {
    const t = this.add.text(this.player.x, this.player.y - 14 - delayOffset, text,
      sharpText({ fontFamily: FONT, fontSize: '9px', color, strokeThickness: 3 }))
      .setOrigin(0.5, 1).setDepth(30).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, y: t.y - 8, duration: 260, delay: delayOffset * 16,
      onComplete: () => this.tweens.add({
        targets: t, alpha: 0, y: t.y - 12, delay: 1100, duration: 420, onComplete: () => t.destroy(),
      }),
    });
  }

  private maybeTriggerRandomEncounter(tile: string) {
    if (tile !== '.' && tile !== 'P') return;
    this.randomBattleSteps++;
    if (this.randomBattleSteps < RANDOM_BATTLE_MIN_STEPS) return;

    const depth = getRun().depth;
    const chance = Math.min(0.16, 0.08 + depth * 0.008);
    const forced = this.randomBattleSteps >= RANDOM_BATTLE_MAX_STEPS;
    if (!forced && Math.random() >= chance) return;

    const area = getArea(depth);
    const groups = Array.from(new Set(Object.values(area.encounters).filter((group) => group !== 'boss' && group !== 'elite' && !group.endsWith('_boss'))));
    // Boss rooms only register their boss's group, so there's nothing valid
    // to draw a random trash fight from here - skip it instead of falling
    // back to a hardcoded group name that doesn't exist past Chapter 1.
    if (groups.length === 0) return;
    const group = Phaser.Utils.Array.GetRandom(groups);
    this.busy = true;
    this.pendingEncounterKey = null;
    this.randomBattleSteps = 0;
    this.scene.pause();
    this.scene.launch('Battle', { enemies: makeEncounterForArea(area, group) });
  }

  private triggerStory(tileKey: string) {
    const area = getArea(getRun().depth);
    const scriptId = area.scripts[tileKey];
    if (!scriptId) return;
    this.busy = true;
    setFlag(`story_${getRun().depth}_${tileKey}`);
    markSeen(scriptId);
    this.scene.pause();
    this.scene.launch('Dialogue', {
      scriptId,
      onDone: () => {
        this.busy = false;
        this.scene.resume();
        this.moveLockedUntil = this.time.now + 300;
      },
    });
  }

  private advanceArea() {
    if (this.busy) return;
    this.busy = true;
    getRun().depth++;
    saveProgress();
    this.scene.restart({ deeper: true });
  }

  /** Only the '<' portal tile leads home; there is no global retreat key. */
  private goHome() {
    if (this.busy) return;
    this.busy = true;
    this.cameras.main.fadeOut(250, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('RunSummary', { reason: 'retreat', depth: getRun().depth }));
  }

  private updateHint() {
    const depth = getRun().depth;
    const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
    let label = '';
    for (const d of dirs) {
      const nx = this.px + d.x;
      const ny = this.py + d.y;
      const ch = this.map[ny]?.[nx];
      if (!ch) continue;
      if (ch === '>') { label = 'Z / tap  ·  descend'; break; }
      if (ch === '<') { label = 'Z / tap  ·  return home'; break; }
      if ((ch === 'B' || ch === 'X') && !hasFlag(`enc_${depth}_${nx},${ny}`)) {
        label = ch === 'B' ? 'Z / tap  ·  boss battle!' : 'Z / tap  ·  elite guardian!';
        break;
      }
      if (ch === 'T' && !hasFlag(`chest_${depth}_${nx},${ny}`)) {
        label = 'Z / tap  ·  open chest'; break;
      }
      if (ch === 'H' && !springUsed(`${depth}_${nx},${ny}`)) {
        label = 'Z / tap  ·  rest at the spring'; break;
      }
      if (ch === 'S' && !hasFlag(`story_${depth}_${nx},${ny}`)) {
        label = 'Z / tap  ·  examine'; break;
      }
    }
    if (label) {
      if (!this.hintText) {
        this.hintText = this.add.text(GAME.width / 2, GAME.height - 18, label,
          sharpText({ fontFamily: FONT, fontSize: '9px', color: '#6cf0c2' }))
          .setOrigin(0.5, 1).setDepth(20).setAlpha(0);
        this.tweens.add({ targets: this.hintText, alpha: 1, duration: 180 });
      } else {
        this.hintText.setText(label).setVisible(true);
      }
    } else if (this.hintText?.visible) {
      this.hintText.setVisible(false);
    }
  }

  private tileCenter(n: number): number { return n * GAME.tile + GAME.tile / 2; }

  private walkPlayerTo(x: number, y: number) {
    this.walkFrame = 1 - this.walkFrame;
    this.applyFacing(true);
    this.tweens.killTweensOf(this.player);
    this.tweens.killTweensOf(this.playerShadow);
    this.tweens.add({
      targets: this.player, x, y, duration: STEP_MS, ease: 'Linear',
      onComplete: () => { this.applyFacing(false); },
    });
    this.tweens.add({ targets: this.playerShadow, x, y: y + 8, duration: STEP_MS, ease: 'Linear' });
  }

  private facingFromDir(x: number, y: number): Facing {
    if (y < 0) return 'up';
    if (y > 0) return 'down';
    return x < 0 ? 'left' : 'right';
  }

  private applyFacing(walking: boolean) {
    const frame = walking ? (this.walkFrame === 0 ? '_walk_a' : '_walk_b') : '';
    const base = this.facing === 'up' ? 'player_back' : 'player';
    this.player.setTexture(`${base}${frame}`);
    this.player.setFlipX(this.facing === 'left');
  }
}
