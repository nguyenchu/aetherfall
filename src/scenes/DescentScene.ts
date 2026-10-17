import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { getArea, makeEncounterForArea, isRiftActive, isRoomActive, setRoomArea, clearRoomArea, type AreaTheme } from '../game/chapters';
import { generateRoom, isCombatRoom, goldRoomPurse, ROOM_INFO, type RoomKind } from '../game/rooms';
import { EVENTS } from '../game/events';
import { rollBoonChoices } from '../game/boons';
import { getRun, getSave, applyDescentModifier, openChest, saveProgress, springUsed, useSpring, hasFlag, setFlag } from '../game/run';
import { input } from '../game/input';
import { music, sfx, type AreaThemeId } from '../audio/music';
import { sharpText, FONT } from '../ui/text';
import { markSeen } from '../game/dialogue';
import { track, chapterOfDepth } from '../game/analytics';
import { paintPixelGrid } from '../art/sprites';
import { themeFloor, themeWall, tileVariant } from '../art/tiles';
import { DescentHudScene } from './DescentHudScene';
import { pickBanter, DESCENT_BANTER, FIRST_FIGHT_BANTER } from '../game/banter';
import { showBanterToast } from '../ui/banterToast';

const GUST_DIR: Record<'up' | 'down' | 'left' | 'right', [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};

// One quiet ground-clutter texture per theme (built in BootScene) — purely
// decorative, scattered over plain floor tiles only, see drawMap().
const DUNGEON_DECOR: Record<string, string> = {
  forest: 'decor_dungeon_forest',
  sunken: 'decor_dungeon_sunken',
  ashen: 'decor_dungeon_ashen',
  crystal: 'decor_dungeon_crystal',
  tempest: 'decor_dungeon_tempest',
};
// Sparse — a scattered handful per map, not a repeating pattern. 1-in-8
// looked like wallpaper in practice (same single texture stamped on ~1 in
// every 2 open tiles' neighborhood); 1-in-45 reads as occasional detail.
const DECOR_DENSITY = 45;

const PLAYER_SCALE_X = 1.08;
const PLAYER_SCALE_Y = 1.35;
const STEP_MS = 105;
const RANDOM_BATTLE_MIN_STEPS = 7;
// Bad-luck protection: independent per-step rolls can still produce long dry
// spells even at a reasonable average rate, which reads as "broken" rather
// than "unlucky". Force an encounter if one hasn't landed by this many steps.
const RANDOM_BATTLE_MAX_STEPS = 26;
// Ambient party banter (see game/banter.ts): occasional, never forced — a
// dry spell just means a quieter walk, unlike the battle bad-luck floor above.
const BANTER_MIN_STEPS = 18;
const BANTER_CHANCE = 0.12;
// Extra zoom on top of renderScale so the camera has room to actually pan —
// at renderScale alone every hand-authored map already fits the viewport, so
// follow+bounds would have nothing to scroll. 1.5x keeps renderScale*1.5 an
// integer (crisp pixel art) while giving most maps real scroll room.
const WORLD_ZOOM_BONUS = 1.5;
type Facing = 'down' | 'up' | 'left' | 'right';

/**
 * Dungeon exploration. A chapter's entrance stratum (odd depth) is played as
 * a run of generated rooms (rooms.ts): each holds one visible fight ('E'/'X'),
 * chest, spring or event ('?'), and its doors ('1'-'3') show what the next
 * room gives. Boss strata (even depths) are the fixed hand-made maps from
 * chapters.ts, and the Rift is its own generated floor with random fights.
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
  // Ward Lever/Sealed Ward (see chapters.ts tile-key comment): the one field
  // mechanic with memory — resets fresh every time the area is (re-)entered.
  private wardOpen = false;
  private wardImages = new Map<string, Phaser.GameObjects.Image>();
  private leverImages = new Map<string, Phaser.GameObjects.Image>();
  // Generated rooms: door tiles and their labels, dimmed while sealed.
  private doorObjects: Phaser.GameObjects.Components.Alpha[] = [];
  private walkFrame = 0;
  private facing: Facing = 'down';
  private px = 0;
  private py = 0;
  private busy = false;
  private moveLockedUntil = 0;
  private pendingEncounterKey: string | null = null;
  private randomBattleSteps = 0;
  private banterSteps = 0;
  private unsubs: (() => void)[] = [];
  // Fixed-screen HUD (gold/party/boons/hint) — a separate scene with its own
  // plain-zoom camera, so it never moves or rescales when this scene's own
  // camera zooms in and follows the player. See DescentHudScene for why.
  private hud!: DescentHudScene;

  constructor() {
    super('Descent');
  }

  create(data?: { deeper?: boolean; room?: boolean }) {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale * WORLD_ZOOM_BONUS);
    this.cameras.main.fadeIn(300, 7, 6, 14);
    this.busy = false;
    this.unsubs = [];
    this.tileImages.clear();
    this.springImages.clear();
    this.wardOpen = false;
    this.wardImages.clear();
    this.leverImages.clear();
    this.doorObjects = [];
    this.pendingEncounterKey = null;
    this.randomBattleSteps = 0;

    const run = getRun();
    // Chapter entrances play as generated rooms; a fresh entry starts room 1
    // (always a fight). Moving between rooms restarts this scene with
    // { room: true } after enterRoom() has already built the next one.
    if (!isRiftActive() && run.depth % 2 === 1 && !run.room) this.buildRoom(1, 'fight');
    const area = getArea(run.depth);
    this.map = area.map;
    this.mapPixelW = this.map[0].length * GAME.tile;
    this.mapPixelH = this.map.length * GAME.tile;

    // create() runs on a fresh descent from Sanctuary (scene.start, no data),
    // on advancing to the boss stratum (advanceArea's { deeper: true }), and
    // on moving to the next generated room ({ room: true }). Battle returns
    // via RESUME, not create. A fresh entry is the per-chapter "started"
    // signal and reaching the boss stratum is mid-run progress; room-to-room
    // moves aren't separate funnel steps.
    if (data?.deeper) {
      track('descent_progress', { ch: chapterOfDepth(run.depth), d: run.depth });
    } else if (!data?.room) {
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
      if (data?.fromBattle) {
        this.randomBattleSteps = 0;
        // Battle entry faded us to black (see playBattleTransition); fade back
        // in now. The pause-menu resume path never faded out, so it's not
        // touched here — fading in on top of an already-visible camera would
        // just flash black for no reason.
        this.cameras.main.fadeIn(250, 7, 6, 14);
      }
      if (data?.won && this.pendingEncounterKey) {
        const key = this.pendingEncounterKey;
        this.markUsed('enc', key);
        this.clearEncounterMarker(key);
        this.pendingEncounterKey = null;
        const room = getRun().room;
        if (room && isRoomActive() && !room.cleared) this.clearRoom();
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
    for (let r = 0; r < this.map.length; r++) {
      for (let c = 0; c < this.map[r].length; c++) {
        const ch = this.map[r][c];
        const isWall = ch === '#';
        const tid = this.currentThemeId;
        const base = isWall ? 'th_wall' : (r + c) % 2 === 0 ? 'th_floor' : 'th_floorAlt';
        const texKey = `${base}_${tid}_${tileVariant(c, r, 3)}`;
        this.add.image(c * GAME.tile, r * GAME.tile, texKey).setOrigin(0, 0).setDepth(0);

        if (ch === 'P') { this.px = c; this.py = r; }

        // Ambient ground clutter — plain floor only, so it never overlaps a
        // wall, portal, chest, spring, story beat, or field-mechanic tile.
        if (ch === '.') {
          const decorKey = DUNGEON_DECOR[tid];
          if (decorKey && tileVariant(c + 1, r + 1, DECOR_DENSITY) === 0) {
            const flip = tileVariant(c + 2, r + 2, 2) === 0;
            const alpha = 0.75 + tileVariant(c + 3, r + 3, 4) * 0.08; // 0.75-0.99, breaks up repetition
            this.add.image(c * GAME.tile, r * GAME.tile, decorKey)
              .setOrigin(0, 0).setDepth(0.5).setFlipX(flip).setAlpha(alpha);
          }
        }

        const tileKey = `${c},${r}`;
        if ((ch === 'X' || ch === 'E') && !this.isUsed('enc', tileKey)) {
          this.addEncounterMarker(c, r, tileKey, ch === 'E' ? '⚔' : '!!');
        }
        if (ch === '?' && !this.isUsed('event', tileKey)) {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
            .setOrigin(0, 0).setTint(ROOM_INFO.event.tint).setAlpha(0.9).setDepth(2);
          this.tweens.add({ targets: img, alpha: { from: 0.9, to: 0.5 }, duration: 700, yoyo: true, repeat: -1 });
          this.tileImages.set(tileKey, img);
          this.add.text(c * GAME.tile + GAME.tile / 2, r * GAME.tile + GAME.tile / 2, '?', sharpText({
            fontFamily: FONT, fontSize: '11px', color: '#ffffff', strokeThickness: 3,
          })).setOrigin(0.5).setDepth(3).setName(`event_label_${tileKey}`);
        }
        if (ch >= '1' && ch <= '3') this.drawDoor(c, r, tileKey);
        if (ch === 'T' && !this.isUsed('chest', tileKey)) {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'chest').setOrigin(0, 0).setDepth(2);
          this.tileImages.set(tileKey, img);
        }
        if (ch === 'H') {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'spring').setOrigin(0, 0).setDepth(2);
          this.springImages.set(tileKey, img);
          if (springUsed(this.springKey(tileKey))) {
            img.setAlpha(0.35);
          } else {
            this.tweens.add({ targets: img, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1 });
          }
        }
        if (ch === 'S' && !this.isUsed('story', tileKey)) {
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
        if (ch === 'G') {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
            .setOrigin(0, 0).setTint(0x9fc8e0).setAlpha(0.5).setDepth(1);
          this.tweens.add({ targets: img, alpha: { from: 0.3, to: 0.65 }, duration: 450, yoyo: true, repeat: -1 });
        }
        if (ch === 'Y') {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
            .setOrigin(0, 0).setTint(0x66e8ff).setAlpha(0.85).setDepth(2);
          if (this.wardOpen) {
            img.setAlpha(0.3);
          } else {
            this.tweens.add({ targets: img, alpha: { from: 0.55, to: 1 }, duration: 400, yoyo: true, repeat: -1 });
          }
          this.leverImages.set(tileKey, img);
        }
        // Sealed Ward: rendered on top of its (already-floor) base tile, so
        // it reads as a visible barrier rather than an invisible wall —
        // removed the instant the area's lever is found (see resolveTile).
        if (ch === '=' && !this.wardOpen) {
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
            .setOrigin(0, 0).setTint(0xaee8ff).setAlpha(0.75).setDepth(1);
          this.wardImages.set(tileKey, img);
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
          const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether').setOrigin(0, 0).setDepth(2);
          const arrow = this.add.text(cx, cy, '▶', sharpText({ fontFamily: FONT, fontSize: '10px', color: '#ffffff' })).setOrigin(0.5).setDepth(3);
          if (isRoomActive()) {
            const label = this.add.text(cx, r * GAME.tile - 2, '☠ Guardian', sharpText({
              fontFamily: FONT, fontSize: '8px', color: '#ff8a8a', strokeThickness: 3,
            })).setOrigin(0.5, 1).setDepth(3);
            this.doorObjects.push(img, arrow, label);
            if (!getRun().room?.cleared) for (const o of [img, arrow, label]) o.setAlpha(0.35);
          }
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

  private addEncounterMarker(c: number, r: number, key: string, glyph = '!!') {
    const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
      .setOrigin(0, 0).setTint(0xff8800).setAlpha(0.95).setDepth(2);
    this.tweens.add({ targets: img, alpha: { from: 0.95, to: 0.5 }, duration: 650, yoyo: true, repeat: -1 });
    this.add.text(c * GAME.tile + GAME.tile / 2, r * GAME.tile - 2, glyph, sharpText({
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
    }
    if (this.busy || time < this.moveLockedUntil) return;
    const d = input.dir();
    if (d.x === 0 && d.y === 0) return;

    const nx = this.px + d.x;
    const ny = this.py + d.y;
    const ch = this.map[ny]?.[nx];
    if (this.isBlocked(ch)) {
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
      if (this.isBlocked(sch)) break;
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

    if (ch >= '1' && ch <= '3') {
      const kind = getArea(depth).doors?.[tileKey] as RoomKind | undefined;
      if (kind) this.enterRoom(kind);
      return;
    }
    if ((ch === 'B' || ch === 'X' || ch === 'E') && !this.isUsed('enc', tileKey)) {
      this.triggerEncounter(tileKey, ch === 'B', ch === 'X');
      return;
    }
    if (ch === '?' && !this.isUsed('event', tileKey)) {
      this.openEvent(tileKey);
      return;
    }
    if (ch === 'T' && !this.isUsed('chest', tileKey)) {
      this.openChestAt(tileKey);
      return;
    }
    if (ch === 'H' && !springUsed(this.springKey(tileKey))) {
      this.useSpringAt(tileKey);
      return;
    }
    if (ch === 'S' && !this.isUsed('story', tileKey)) {
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
    if (ch === 'Y' && !this.wardOpen) {
      this.wardOpen = true;
      for (const img of this.wardImages.values()) {
        this.tweens.add({ targets: img, alpha: 0, duration: 350, onComplete: () => img.destroy() });
      }
      this.wardImages.clear();
      const lever = this.leverImages.get(tileKey);
      if (lever) {
        this.tweens.killTweensOf(lever);
        this.tweens.add({ targets: lever, alpha: 0.3, duration: 350 });
      }
      this.floatText('The frost ward shatters — a sealed path opens!', '#66e8ff', 0);
      return;
    }
    if (ch === 'G') {
      const gust = getArea(depth).gusts?.[tileKey];
      if (gust) {
        const [gx, gy] = GUST_DIR[gust];
        const nx = this.px + gx;
        const ny = this.py + gy;
        const nch = this.map[ny]?.[nx];
        if (nch && nch !== '#') {
          this.px = nx;
          this.py = ny;
          this.tweens.killTweensOf(this.player);
          this.tweens.killTweensOf(this.playerShadow);
          this.walkPlayerTo(this.tileCenter(this.px), this.tileCenter(this.py));
          this.floatText('A gust of wind shoves you sideways!', '#9fc8e0', 0);
        }
      }
      return;
    }

    this.maybeTriggerRandomEncounter(ch);
    if (!this.busy) this.maybeTriggerBanter();
  }

  private maybeTriggerBanter() {
    // The heroes' "why we're here" lines, once, right after the first fight.
    if (hasFlag('first_fight_done') && !hasFlag('heard_first_fight_banter')) {
      setFlag('heard_first_fight_banter');
      this.banterSteps = 0;
      showBanterToast(this.hud, FIRST_FIGHT_BANTER);
      return;
    }
    this.banterSteps++;
    if (this.banterSteps < BANTER_MIN_STEPS) return;
    if (Math.random() >= BANTER_CHANCE) return;
    this.banterSteps = 0;
    const beat = pickBanter(DESCENT_BANTER);
    if (beat) showBanterToast(this.hud, beat.lines);
  }

  private triggerEncounter(tileKey: string, isBoss: boolean, isElite: boolean) {
    const area = getArea(getRun().depth);
    const group = area.encounters[tileKey] ?? (isBoss ? 'boss' : 'elite');
    if (group === 'first_fight') setFlag('first_fight_done');
    // In rooms, only Blessing and Elite rooms end their fight with a boon pick.
    const room = isRoomActive() ? getRun().room : null;
    const boon = room ? room.kind === 'boon' || room.kind === 'elite' : undefined;
    this.busy = true;
    this.pendingEncounterKey = tileKey;
    this.playBattleTransition(() => {
      this.scene.pause();
      this.scene.launch('Battle', { enemies: makeEncounterForArea(area, group, getSave().ngPlus), elite: isElite, boon });
    });
  }

  /** Battle used to cut in with zero warning — a flash, a burst of light
   *  filling the screen, and a fade to black now bridges the two scenes.
   *  Battle's own fadeIn(400,...) picks up from black, so the handoff reads
   *  as one beat.
   *
   *  The burst visuals are drawn on the DescentHud scene, not this one:
   *  DescentScene's own camera runs at renderScale*WORLD_ZOOM_BONUS zoom to
   *  give it room to scroll/follow the player, so GAME.width/height
   *  coordinates here don't land where you'd expect on screen even with
   *  setScrollFactor(0) — zoom still warps them. DescentHudScene's camera is
   *  the plain renderScale-only, scroll-locked one every other full-screen
   *  overlay in this game already uses (banter toasts, the gold counter),
   *  so GAME.width/height there really do map to the visible screen. */
  private playBattleTransition(onDone: () => void) {
    const cam = this.cameras.main;
    const hud = this.hud;
    const cx = GAME.width / 2;
    const cy = GAME.height / 2;
    // Far enough from center that every ray/ring clears all four screen
    // corners rather than just a small halo around the middle.
    const reach = Math.hypot(GAME.width, GAME.height);

    const flash = hud.add.rectangle(0, 0, GAME.width, GAME.height, 0xffffff, 0).setOrigin(0, 0).setDepth(200);
    hud.tweens.add({ targets: flash, alpha: 0.9, duration: 90, yoyo: true, onComplete: () => flash.destroy() });
    cam.shake(200, 0.014);
    music.fanfare('encounter'); // stops the explore loop; BattleScene starts its own theme once it loads

    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const line = hud.add.rectangle(cx, cy, 3, 20, 0xffe27a, 0.95).setDepth(199).setAngle(Phaser.Math.RadToDeg(angle));
      hud.tweens.add({
        targets: line,
        x: cx + Math.cos(angle) * reach,
        y: cy + Math.sin(angle) * reach,
        alpha: 0,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => line.destroy(),
      });
    }

    // An expanding ring sweeping out past every edge reinforces the "impact
    // spreading across the whole screen" read, rather than a small local burst.
    const ring = hud.add.circle(cx, cy, 4, 0xffe27a, 0).setStrokeStyle(3, 0xffe27a, 0.9).setDepth(198);
    hud.tweens.add({ targets: ring, scale: reach / 4, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });

    this.time.delayedCall(200, () => {
      cam.fadeOut(220, 7, 6, 14);
      cam.once('camerafadeoutcomplete', onDone);
    });
  }

  private openChestAt(tileKey: string) {
    const depth = getRun().depth;
    const area = getArea(depth);
    const contents = area.chests[tileKey];
    if (!contents) return;
    this.markUsed('chest', tileKey);
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
    if (!useSpring(this.springKey(tileKey))) return;
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
    // Generated rooms show every fight as a visible tile instead.
    if (isRoomActive()) return;
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
    this.playBattleTransition(() => {
      this.scene.pause();
      this.scene.launch('Battle', { enemies: makeEncounterForArea(area, group, getSave().ngPlus) });
    });
  }

  private triggerStory(tileKey: string) {
    const area = getArea(getRun().depth);
    const scriptId = area.scripts[tileKey];
    if (!scriptId) return;
    this.busy = true;
    this.markUsed('story', tileKey);
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
    // Leaving the last room for the chapter's boss stratum.
    if (isRoomActive()) {
      clearRoomArea();
      getRun().room = null;
    }
    getRun().depth++;
    saveProgress();
    this.scene.restart({ deeper: true });
  }

  /** The '<' portal ends the run and returns to Sanctuary, from any floor.
   *  It used to step back from a boss stratum to its entrance map, but the
   *  entrance is now a forward-only run of generated rooms (rooms.ts), so
   *  there's nothing fixed to step back into. */
  private goHome() {
    if (this.busy) return;
    this.busy = true;
    this.cameras.main.fadeOut(250, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('RunSummary', { reason: 'retreat', depth: getRun().depth }));
  }

  // --- Generated rooms (rooms.ts) --------------------------------------------

  /** Builds room `index` of this chapter's entrance and makes it the area. */
  private buildRoom(index: number, kind: RoomKind) {
    const run = getRun();
    run.room = { index, kind, cleared: !isCombatRoom(kind), done: [] };
    setRoomArea(generateRoom({
      depth: run.depth,
      index,
      kind,
      firstFight: run.depth === 1 && index === 1 && !hasFlag('first_fight_done') && !hasFlag('ch1_complete'),
      ownedEquipment: getSave().equipmentOwned,
    }));
  }

  /** Walks through a door into the next generated room. */
  private enterRoom(kind: RoomKind) {
    const room = getRun().room;
    if (this.busy || !room) return;
    this.busy = true;
    sfx.play('confirm');
    this.buildRoom(room.index + 1, kind);
    saveProgress();
    this.cameras.main.fadeOut(220, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ room: true }));
  }

  /** The room's fight is won: pay a Gold room's purse and unseal the doors. */
  private clearRoom() {
    const run = getRun();
    const room = run.room;
    if (!room) return;
    room.cleared = true;
    if (room.kind === 'fight') {
      const purse = goldRoomPurse(chapterOfDepth(run.depth));
      run.gold += purse;
      saveProgress();
      this.hud.setGold(run.gold);
      this.floatText(`Purse: +${purse} gold`, '#f0d36c', 0);
    }
    for (const o of this.doorObjects) {
      this.tweens.add({ targets: o, alpha: 1, duration: 400 });
    }
    this.floatText('The doors unseal...', '#6cf0c2', room.kind === 'fight' ? 14 : 0);
  }

  /** A door tile plus a label naming the room behind it; dim while sealed. */
  private drawDoor(c: number, r: number, tileKey: string) {
    const kind = getArea(getRun().depth).doors?.[tileKey] as RoomKind | undefined;
    if (!kind) return;
    const info = ROOM_INFO[kind];
    const img = this.add.image(c * GAME.tile, r * GAME.tile, 'aether')
      .setOrigin(0, 0).setTint(info.tint).setDepth(2);
    const arrow = this.add.text(c * GAME.tile + GAME.tile / 2, r * GAME.tile + GAME.tile / 2, '▶', sharpText({
      fontFamily: FONT, fontSize: '10px', color: '#ffffff',
    })).setOrigin(0.5).setDepth(3);
    // Labels sit left of the door so they stay on-screen at the map's edge.
    const label = this.add.text(c * GAME.tile - 3, r * GAME.tile + GAME.tile / 2, info.label, sharpText({
      fontFamily: FONT, fontSize: '8px', color: info.color, strokeThickness: 3,
    })).setOrigin(1, 0.5).setDepth(3);
    this.doorObjects.push(img, arrow, label);
    if (!getRun().room?.cleared) for (const o of [img, arrow, label]) o.setAlpha(0.35);
  }

  /** A room's '?' tile: the event's choice cards, then its outcome. */
  private openEvent(tileKey: string) {
    const event = EVENTS[getArea(getRun().depth).eventId ?? ''];
    if (!event) return;
    this.busy = true;
    this.markUsed('event', tileKey);
    const img = this.tileImages.get(tileKey);
    if (img) { this.tweens.killTweensOf(img); img.setAlpha(0.25); }
    this.children.getByName(`event_label_${tileKey}`)?.destroy();
    this.scene.pause();
    const resume = () => {
      this.busy = false;
      this.scene.resume();
      this.moveLockedUntil = this.time.now + 300;
      this.hud.setGold(getRun().gold);
      this.hud.refreshBoonHud();
    };
    this.scene.launch('Event', {
      event,
      onDone: (outcome: { lines: string[]; boon?: { elite: boolean } }) => {
        outcome.lines.forEach((line, i) => this.floatText(line, '#6cf0c2', i * 14));
        const choices = outcome.boon ? rollBoonChoices(getRun().boons, outcome.boon.elite) : [];
        if (choices.length === 0) { resume(); return; }
        this.scene.launch('BoonPick', { choices, elite: outcome.boon?.elite, onDone: resume });
      },
    });
  }

  /** Fixed maps remember used tiles (fights, chests, story beats) in save
   *  flags across runs; a generated room only remembers them for itself. */
  private isUsed(prefix: 'enc' | 'chest' | 'story' | 'event', key: string): boolean {
    const room = isRoomActive() ? getRun().room : null;
    if (room) return room.done.includes(`${prefix}:${key}`);
    return hasFlag(`${prefix}_${getRun().depth}_${key}`);
  }

  private markUsed(prefix: 'enc' | 'chest' | 'story' | 'event', key: string): void {
    const room = isRoomActive() ? getRun().room : null;
    if (room) room.done.push(`${prefix}:${key}`);
    else setFlag(`${prefix}_${getRun().depth}_${key}`);
  }

  /** Spring keys are per run; rooms reuse coordinates, so add the room number. */
  private springKey(tileKey: string): string {
    const room = isRoomActive() ? getRun().room : null;
    return room ? `${getRun().depth}_r${room.index}_${tileKey}` : `${getRun().depth}_${tileKey}`;
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
      const key = `${nx},${ny}`;
      const sealed = isRoomActive() && !getRun().room?.cleared;
      if (ch === '>') return sealed ? 'Sealed  ·  win this room\'s fight first' : 'Z / tap  ·  descend';
      if (ch >= '1' && ch <= '3') {
        const kind = getArea(depth).doors?.[key] as RoomKind | undefined;
        if (sealed) return 'Sealed  ·  win this room\'s fight first';
        return kind ? `Z / tap  ·  next room: ${ROOM_INFO[kind].label}` : '';
      }
      if (ch === '<') return 'Z / tap  ·  return home';
      if ((ch === 'B' || ch === 'X' || ch === 'E') && !this.isUsed('enc', key)) {
        return ch === 'B' ? 'Z / tap  ·  boss battle!' : ch === 'X' ? 'Z / tap  ·  elite guardian!' : 'Z / tap  ·  fight!';
      }
      if (ch === '?' && !this.isUsed('event', key)) return 'Z / tap  ·  investigate';
      if (ch === 'T' && !this.isUsed('chest', key)) return 'Z / tap  ·  open chest';
      if (ch === 'H' && !springUsed(this.springKey(key))) return 'Z / tap  ·  rest at the spring';
      if (ch === 'S' && !this.isUsed('story', key)) return 'Z / tap  ·  examine';
    }
    return '';
  }

  private tileCenter(n: number): number { return n * GAME.tile + GAME.tile / 2; }

  /** A wall, off the map, or a Sealed Ward that hasn't been unsealed yet. */
  private isBlocked(ch: string | undefined): boolean {
    if (!ch || ch === '#' || (ch === '=' && !this.wardOpen)) return true;
    // A generated room's doors stay sealed until its fight is won.
    const isDoor = ch === '>' || (ch >= '1' && ch <= '3');
    return isDoor && isRoomActive() && !getRun().room?.cleared;
  }

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
