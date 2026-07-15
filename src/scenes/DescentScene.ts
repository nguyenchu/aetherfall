import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { getArea, makeEncounterForArea, type AreaTheme } from '../game/chapters';
import { getRun, getSave, applyDescentModifier, openChest, saveProgress, springUsed, useSpring, hasFlag, setFlag } from '../game/run';
import { input } from '../game/input';
import { music, sfx, type AreaThemeId } from '../audio/music';
import { sharpText, FONT } from '../ui/text';
import { markSeen } from '../game/dialogue';
import { track, chapterOfDepth } from '../game/analytics';
import { paintPixelGrid } from '../art/sprites';
import { themeFloor, themeWall, tileVariant } from '../art/tiles';
import { DescentHudScene } from './DescentHudScene';

const PLAYER_SCALE_X = 1.08;
const PLAYER_SCALE_Y = 1.35;
const STEP_MS = 105;
const RANDOM_BATTLE_MIN_STEPS = 7;
// Bad-luck protection: independent per-step rolls can still produce long dry
// spells even at a reasonable average rate, which reads as "broken" rather
// than "unlucky". Force an encounter if one hasn't landed by this many steps.
const RANDOM_BATTLE_MAX_STEPS = 26;
// Extra zoom on top of renderScale so the camera has room to actually pan —
// at renderScale alone every hand-authored map already fits the viewport, so
// follow+bounds would have nothing to scroll. 1.5x keeps renderScale*1.5 an
// integer (crisp pixel art) while giving most maps real scroll room.
const WORLD_ZOOM_BONUS = 1.5;
type Facing = 'down' | 'up' | 'left' | 'right';

/**
 * Fixed dungeon exploration. Each depth maps to a hand-crafted area defined
 * in chapters.ts. Trash fights trigger randomly while walking floor tiles;
 * bosses (B) and elite guardians (X) are fixed, marked encounters.
 * Treasure chests (T) and healing springs (H) reward exploring off the main path.
 */
// How quickly the camera catches up to the player each frame (0-1, higher = snappier).
const CAMERA_LERP = 0.1;

export class DescentScene extends Phaser.Scene {
  private map: string[] = [];
  private mapPixelW = 0;
  private mapPixelH = 0;
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
  // Fixed-screen HUD (gold/party/boons/hint) — a separate scene with its own
  // plain-zoom camera, so it never moves or rescales when this scene's own
  // camera zooms in and follows the player. See DescentHudScene for why.
  private hud!: DescentHudScene;

  constructor() {
    super('Descent');
  }

  create(data?: { deeper?: boolean }) {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale * WORLD_ZOOM_BONUS);
    this.cameras.main.fadeIn(300, 7, 6, 14);
    this.busy = false;
    this.unsubs = [];
    this.tileImages.clear();
    this.springImages.clear();
    this.pendingEncounterKey = null;
    this.randomBattleSteps = 0;

    const run = getRun();
    const area = getArea(run.depth);
    this.map = area.map;
    this.mapPixelW = this.map[0].length * GAME.tile;
    this.mapPixelH = this.map.length * GAME.tile;

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
    // Phaser's built-in startFollow()/setBounds() clamping assumes camera
    // width/height are already in world units — but ours are the raw 2x
    // canvas size (see config.ts), with zoom doing the pixel-doubling. That
    // mismatch makes Camera.clampX/clampY() (used by both startFollow's
    // initial snap and the per-frame bounds check) pin the scroll to a
    // wrong, zoom-skewed constant. So the camera is driven manually in
    // update() instead of via startFollow/setBounds.
    this.updateCameraFollow(true);

    // scene.restart() (advanceArea) reuses this scene instance, which fires
    // SHUTDOWN before this create() runs again — the once-listener below
    // stops the previous stratum's HUD scene at that point, so launching a
    // fresh one here never stacks duplicates.
    this.scene.launch('DescentHud', { areaName: area.name, accentColor: area.theme.accent });
    this.hud = this.scene.get('DescentHud') as DescentHudScene;
    this.bindInput();

    music.play('explore', this.currentThemeId as AreaThemeId);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubs.forEach((u) => u());
      this.scene.stop('DescentHud');
    });
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
      this.hud.setGold(getRun().gold);
      this.hud.refreshBoonHud();
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
        // Field mechanic tiles — always tinted so the player can see and
        // anticipate them, never an invisible trap.
        if (ch === 'V') {
          this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
            .setOrigin(0, 0).setTint(0x2a6a2a).setAlpha(0.5).setDepth(1);
        }
        if (ch === '~') {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
            .setOrigin(0, 0).setTint(0x2a7ac0).setAlpha(0.45).setDepth(1);
          this.tweens.add({ targets: img, alpha: { from: 0.3, to: 0.6 }, duration: 700, yoyo: true, repeat: -1 });
        }
        if (ch === '^') {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
            .setOrigin(0, 0).setTint(0xff5522).setAlpha(0.55).setDepth(1);
          this.tweens.add({ targets: img, alpha: { from: 0.35, to: 0.75 }, duration: 500, yoyo: true, repeat: -1 });
        }
        if (ch === '*') {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
            .setOrigin(0, 0).setTint(0xc78aff).setAlpha(0.8).setDepth(2);
          this.tweens.add({ targets: img, alpha: { from: 0.5, to: 0.95 }, duration: 550, yoyo: true, repeat: -1 });
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

  private bindInput() {
    this.unsubs.push(input.on('cancel', () => {
      if (this.busy) return; // mid-dialogue/transition — not a menu opportunity
      if (this.scene.isActive('GameMenu')) return;
      this.scene.pause();
      this.scene.launch('GameMenu', { caller: this.scene.key });
    }));
  }

  /** Zoom-aware replacement for Camera.startFollow()/setBounds() — see the
   * note in create() for why those don't work with this project's camera
   * setup. Runs every frame regardless of movement lock so the camera keeps
   * smoothly catching up even through brief input-lock windows. */
  private updateCameraFollow(snap = false) {
    const cam = this.cameras.main;
    const visW = cam.width / cam.zoom;
    const visH = cam.height / cam.zoom;
    const maxScrollX = Math.max(0, this.mapPixelW - visW);
    const maxScrollY = Math.max(0, this.mapPixelH - visH);
    const targetX = Phaser.Math.Clamp(this.player.x - visW / 2, 0, maxScrollX);
    const targetY = Phaser.Math.Clamp(this.player.y - visH / 2, 0, maxScrollY);
    if (snap) {
      cam.setScroll(targetX, targetY);
    } else {
      cam.setScroll(
        Phaser.Math.Linear(cam.scrollX, targetX, CAMERA_LERP),
        Phaser.Math.Linear(cam.scrollY, targetY, CAMERA_LERP),
      );
    }
  }

  update(time: number) {
    this.updateCameraFollow();
    if (!this.busy) {
      this.hud.setHint(this.hintLabel());
      this.hud.updatePartyHud();
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
    // Sunken's Current: standing on a '~' tile sweeps you further in the
    // same direction until you reach dry floor or a wall.
    while (this.map[this.py]?.[this.px] === '~') {
      const sx = this.px + d.x;
      const sy = this.py + d.y;
      const sch = this.map[sy]?.[sx];
      if (!sch || sch === '#') break;
      this.px = sx;
      this.py = sy;
    }
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
    if (ch === '^') {
      for (const c of getRun().party) c.stats.hp = Math.max(1, c.stats.hp - 4);
      this.floatText('The embers scorch you!', '#ff8a5a', 0);
      return;
    }
    if (ch === '*') {
      const dest = getArea(depth).teleports?.[tileKey];
      if (dest) {
        const [dx, dy] = dest.split(',').map(Number);
        this.px = dx;
        this.py = dy;
        this.tweens.killTweensOf(this.player);
        this.tweens.killTweensOf(this.playerShadow);
        this.player.setPosition(this.tileCenter(this.px), this.tileCenter(this.py));
        this.playerShadow.setPosition(this.tileCenter(this.px), this.tileCenter(this.py) + 8);
        this.floatText('The prism light bends around you...', '#c78aff', 0);
      }
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
    this.scene.launch('Battle', { enemies: makeEncounterForArea(area, group, getSave().ngPlus), elite: isElite });
  }

  private openChestAt(tileKey: string) {
    const depth = getRun().depth;
    const area = getArea(depth);
    const contents = area.chests[tileKey];
    if (!contents) return;
    setFlag(`chest_${depth}_${tileKey}`);
    const lines = openChest(contents);
    sfx.play('chest');
    this.hud.setGold(getRun().gold);
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
    this.hud.updatePartyHud();
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
    // Forest's Thicket: dense undergrowth ambushes far more readily than
    // open floor, but still respects the same step-count floor/ceiling.
    if (tile !== '.' && tile !== 'P' && tile !== 'V') return;
    this.randomBattleSteps++;
    if (this.randomBattleSteps < RANDOM_BATTLE_MIN_STEPS) return;

    const depth = getRun().depth;
    // Thicket keeps its 3x ambush rate (and 3x cap) on top of the base curve.
    const raw = 0.055 + depth * 0.006;
    const chance = tile === 'V' ? Math.min(0.33, raw * 3) : Math.min(0.11, raw);
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
    this.scene.launch('Battle', { enemies: makeEncounterForArea(area, group, getSave().ngPlus) });
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

  /** Contextual action hint for whatever's next to the player, or '' for none. */
  private hintLabel(): string {
    const depth = getRun().depth;
    const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
    for (const d of dirs) {
      const nx = this.px + d.x;
      const ny = this.py + d.y;
      const ch = this.map[ny]?.[nx];
      if (!ch) continue;
      if (ch === '>') return 'Z / tap  ·  descend';
      if (ch === '<') return 'Z / tap  ·  return home';
      if ((ch === 'B' || ch === 'X') && !hasFlag(`enc_${depth}_${nx},${ny}`)) {
        return ch === 'B' ? 'Z / tap  ·  boss battle!' : 'Z / tap  ·  elite guardian!';
      }
      if (ch === 'T' && !hasFlag(`chest_${depth}_${nx},${ny}`)) return 'Z / tap  ·  open chest';
      if (ch === 'H' && !springUsed(`${depth}_${nx},${ny}`)) return 'Z / tap  ·  rest at the spring';
      if (ch === 'S' && !hasFlag(`story_${depth}_${nx},${ny}`)) return 'Z / tap  ·  examine';
    }
    return '';
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
