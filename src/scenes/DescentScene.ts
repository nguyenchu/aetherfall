import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { getArea, makeEncounterForArea, type AreaTheme } from '../game/chapters';
import { getRun, applyDescentModifier, returnToTown, saveProgress, hasFlag, setFlag } from '../game/run';
import { input, attachTouchControls } from '../game/input';
import { music } from '../audio/music';
import { sharpText, FONT } from '../ui/text';
import { markSeen } from '../game/dialogue';

const PLAYER_SCALE_X = 1.08;
const PLAYER_SCALE_Y = 1.35;
const STEP_MS = 105;
type Facing = 'down' | 'up' | 'left' | 'right';

/**
 * Fixed dungeon exploration. Each depth maps to a hand-crafted area defined
 * in chapters.ts. Encounters trigger at marked tiles and are cleared once won.
 */
export class DescentScene extends Phaser.Scene {
  private map: string[] = [];
  private player!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private tileImages = new Map<string, Phaser.GameObjects.Image>();
  private walkFrame = 0;
  private facing: Facing = 'down';
  private px = 0;
  private py = 0;
  private busy = false;
  private moveLockedUntil = 0;
  private pendingEncounterKey: string | null = null;
  private unsubs: (() => void)[] = [];
  private hintText?: Phaser.GameObjects.Text;

  constructor() {
    super('Descent');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(300, 7, 6, 14);
    this.busy = false;
    this.unsubs = [];
    this.tileImages.clear();
    this.pendingEncounterKey = null;

    const area = getArea(getRun().depth);
    this.map = area.map;

    applyDescentModifier();
    this.buildThemeTiles(area.theme);
    this.drawAtmosphere(area.theme);
    this.drawMap();
    this.placePortals();
    this.spawnPlayer();
    this.buildHud(area.name, area.theme.accent);
    this.bindInput();
    attachTouchControls(this);

    music.play('explore');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
    this.events.on(Phaser.Scenes.Events.RESUME, (_sys: unknown, data?: { won?: boolean }) => {
      this.busy = false;
      music.play('explore');
      this.moveLockedUntil = this.time.now + 220;
      if (data?.won && this.pendingEncounterKey) {
        const key = this.pendingEncounterKey;
        setFlag(`enc_${getRun().depth}_${key}`);
        this.clearEncounterMarker(key);
        this.pendingEncounterKey = null;
      }
    });
  }

  private buildThemeTiles(theme: AreaTheme) {
    const t = GAME.tile;
    const mk = (key: string, base: number, accent: number, noiseChance: number) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      const r = (base >> 16) & 0xff, gr = (base >> 8) & 0xff, b = base & 0xff;
      g.fillStyle(base, 1);
      g.fillRect(0, 0, t, t);
      // Subtle pixel noise for texture
      for (let px = 0; px < t; px++) {
        for (let py = 0; py < t; py++) {
          if (Math.random() < noiseChance) {
            const dark = Math.random() < 0.6;
            const nr = Math.min(255, Math.max(0, r + (dark ? -18 : 14)));
            const ng = Math.min(255, Math.max(0, gr + (dark ? -18 : 14)));
            const nb = Math.min(255, Math.max(0, b + (dark ? -18 : 14)));
            g.fillStyle((nr << 16) | (ng << 8) | nb, 1);
            g.fillRect(px, py, 1, 1);
          }
        }
      }
      // Subtle edge lines for depth
      g.lineStyle(1, accent, 0.08);
      if (Math.random() < 0.3) g.strokeRect(0.5, 0.5, t - 1, t - 1);
      g.generateTexture(key, t, t);
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      g.destroy();
    };
    mk('th_floor', theme.floor, theme.accent, 0.12);
    mk('th_floorAlt', theme.floorAlt, theme.accent, 0.10);
    mk('th_wall', theme.wall, theme.accent, 0.18);
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
        const texKey = isWall ? 'th_wall' : (r + c) % 2 === 0 ? 'th_floor' : 'th_floorAlt';
        this.add.image(c * GAME.tile, r * GAME.tile, texKey).setOrigin(0, 0).setDepth(0);

        if (ch === 'P') { this.px = c; this.py = r; }

        const tileKey = `${c},${r}`;
        if (ch === 'E' && !hasFlag(`enc_${depth}_${tileKey}`)) {
          this.addEncounterMarker(c, r, tileKey);
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
      .setOrigin(0, 0).setTint(0xff4444).setAlpha(0.7).setDepth(2);
    this.tileImages.set(key, img);
  }

  private clearEncounterMarker(key: string) {
    const img = this.tileImages.get(key);
    if (!img) return;
    this.tweens.add({ targets: img, alpha: 0, duration: 300, onComplete: () => img.destroy() });
    this.tileImages.delete(key);
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
    this.add.text(GAME.width - 4, 4, `Gold ${run.gold}`,
      sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c' })).setOrigin(1, 0).setDepth(10);
    // Active modifier
    const mod = run.modifier;
    if (mod.id !== 'none') {
      this.add.text(GAME.width - 4, 18, `✦ ${mod.name}`,
        sharpText({ fontFamily: FONT, fontSize: '8px', color: mod.color })).setOrigin(1, 0).setDepth(10);
    }
  }

  private bindInput() {
    this.unsubs.push(input.on('cancel', () => this.goHome()));
    this.unsubs.push(input.on('menu', () => {
      if (this.scene.isActive('GameMenu')) return;
      this.scene.pause();
      this.scene.launch('GameMenu', { caller: this.scene.key });
    }));
  }

  update(time: number) {
    if (!this.busy) this.updateHint();
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
    this.walkPlayerTo(this.tileCenter(this.px), this.tileCenter(this.py), () => this.resolveTile());
    this.moveLockedUntil = time + 110;
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

    if ((ch === 'E' || ch === 'B') && !hasFlag(`enc_${depth}_${tileKey}`)) {
      this.triggerEncounter(tileKey, ch === 'B');
      return;
    }
    if (ch === 'S' && !hasFlag(`story_${depth}_${tileKey}`)) {
      this.triggerStory(tileKey);
    }
  }

  private triggerEncounter(tileKey: string, isBoss: boolean) {
    const area = getArea(getRun().depth);
    const group = area.encounters[tileKey] ?? (isBoss ? 'boss' : 'wolves');
    this.busy = true;
    this.pendingEncounterKey = tileKey;
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
    this.scene.launch('Dialogue', { scriptId, caller: this.scene.key });
  }

  private advanceArea() {
    if (this.busy) return;
    this.busy = true;
    getRun().depth++;
    saveProgress();
    this.scene.restart();
  }

  private goHome() {
    if (this.busy) return;
    this.busy = true;
    returnToTown();
    this.cameras.main.fadeOut(250, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Sanctuary'));
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
      if ((ch === 'E' || ch === 'B') && !hasFlag(`enc_${depth}_${nx},${ny}`)) {
        label = ch === 'B' ? 'Z / tap  ·  boss battle!' : 'Z / tap  ·  encounter'; break;
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

  private walkPlayerTo(x: number, y: number, onArrive?: () => void) {
    this.walkFrame = 1 - this.walkFrame;
    this.applyFacing(true);
    this.tweens.killTweensOf(this.player);
    this.tweens.killTweensOf(this.playerShadow);
    this.tweens.add({
      targets: this.player, x, y, duration: STEP_MS, ease: 'Linear',
      onComplete: () => { this.applyFacing(false); onArrive?.(); },
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
