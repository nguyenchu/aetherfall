import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { makeEncounter, makeBoss } from '../game/content';
import { completeQuest, getRun, returnToTown, saveProgress } from '../game/run';
import { input, attachTouchControls } from '../game/input';
import { music } from '../audio/music';
import { sharpText, FONT } from '../ui/text';

const PLAYER_SCALE_X = 1.08;
const PLAYER_SCALE_Y = 1.35;
const STEP_MS = 105;
type Facing = 'down' | 'up' | 'left' | 'right';

const COLS = Math.floor(GAME.width / GAME.tile);
const ROWS = Math.floor(GAME.height / GAME.tile);

const WALL = 1;
const FLOOR = 0;

const BOSS_DEPTH = 3; // number of Stratum I floors before the boss

/**
 * One floor in the descent through a stratum. The room layout is procedural
 * (drunkard's walk), while theme, enemies, and boss are handmade.
 * Stairs lead deeper; the boss waits at the bottom. Return stairs and B/X go home.
 */
export class DescentScene extends Phaser.Scene {
  private grid: number[][] = [];
  private player!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private walkFrame = 0;
  private facing: Facing = 'down';
  private px = 0;
  private py = 0;
  private sx = 0; // stairs down
  private sy = 0;
  private rx = 0; // return stairs
  private ry = 0;
  private vx = 0; // side-view passage
  private vy = 0;
  private moveLockedUntil = 0;
  private stepsSinceBattle = 0;
  private busy = false;
  private headerText!: Phaser.GameObjects.Text;
  private unsubs: (() => void)[] = [];

  constructor() {
    super('Descent');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.busy = false;
    this.stepsSinceBattle = 0;
    this.unsubs = [];

    this.generate();
    this.drawGrid();
    this.placeStairs();
    this.placeReturnStairs();
    this.placeSidePassage();
    this.spawnPlayer();
    this.buildHud();
    this.bindInput();
    attachTouchControls(this);

    music.play('explore');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.busy = false;
      music.play('explore');
      this.moveLockedUntil = this.time.now + 220;
    });
  }

  private buildHud() {
    const depth = getRun().depth;
    this.add.text(4, 4, 'AETHERFALL', sharpText({ fontFamily: FONT, fontSize: '12px', color: '#a58cff' })).setDepth(10);
    this.headerText = this.add.text(4, 20, '', sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5' })).setDepth(10);
    this.headerText.setText(
      depth >= BOSS_DEPTH
        ? `Sunken City  |  Depth ${depth}/${BOSS_DEPTH}  |  v = BOSS  |  ^ home  |  > side`
        : `Sunken City  |  Depth ${depth}/${BOSS_DEPTH}  |  v deeper  |  ^ home  |  > side`,
    );
    const run = getRun();
    this.add.text(GAME.width - 4, 4, `Gold ${run.gold}`, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c' })).setOrigin(1, 0).setDepth(10);
  }

  private bindInput() {
    this.unsubs.push(input.on('cancel', () => this.goHome()));
    this.unsubs.push(input.on('menu', () => {
      if (this.scene.isActive('GameMenu')) return;
      this.scene.pause();
      this.scene.launch('GameMenu', { caller: this.scene.key });
    }));
  }

  /** Drunkard's walk: carve floors out of solid rock. */
  private generate() {
    this.grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => WALL));
    let x = Math.floor(COLS / 2);
    let y = Math.floor(ROWS / 2);
    const steps = Math.floor(COLS * ROWS * 0.5);
    for (let i = 0; i < steps; i++) {
      this.grid[y][x] = FLOOR;
      const dir = Phaser.Math.Between(0, 3);
      if (dir === 0 && x > 1) x--;
      else if (dir === 1 && x < COLS - 2) x++;
      else if (dir === 2 && y > 1) y--;
      else if (dir === 3 && y < ROWS - 2) y++;
    }
    this.px = Math.floor(COLS / 2);
    this.py = Math.floor(ROWS / 2);
    this.grid[this.py][this.px] = FLOOR;
    this.rx = this.px;
    this.ry = Math.min(ROWS - 2, this.py + 1);
    this.grid[this.ry][this.rx] = FLOOR;
  }

  /** Places the stairs on the floor tile farthest from the start. */
  private placeStairs() {
    let best = -1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] !== FLOOR) continue;
        const dist = Math.abs(c - this.px) + Math.abs(r - this.py);
        if (dist > best) {
          best = dist;
          this.sx = c;
          this.sy = r;
        }
      }
    }
    this.add.image(this.sx * GAME.tile, this.sy * GAME.tile, 'aether').setOrigin(0, 0).setDepth(2);
    this.add.text(this.sx * GAME.tile + GAME.tile / 2, this.sy * GAME.tile + GAME.tile / 2, 'v', sharpText({ fontFamily: FONT, fontSize: '12px', color: '#eef2ff' })).setOrigin(0.5).setDepth(3);
  }

  private placeReturnStairs() {
    this.add.image(this.rx * GAME.tile, this.ry * GAME.tile, 'aether').setOrigin(0, 0).setTint(0x6cf0c2).setDepth(2);
    this.add.text(this.rx * GAME.tile + GAME.tile / 2, this.ry * GAME.tile + GAME.tile / 2, '^', sharpText({ fontFamily: FONT, fontSize: '12px', color: '#eef2ff' })).setOrigin(0.5).setDepth(3);
  }

  private placeSidePassage() {
    let best = -1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] !== FLOOR) continue;
        if ((c === this.sx && r === this.sy) || (c === this.rx && r === this.ry)) continue;
        const dist = Math.abs(c - this.px) + Math.abs(r - this.py);
        const score = dist - Math.abs(dist - 8);
        if (score > best) {
          best = score;
          this.vx = c;
          this.vy = r;
        }
      }
    }
    this.add.image(this.vx * GAME.tile, this.vy * GAME.tile, 'aether').setOrigin(0, 0).setTint(0xf0d36c).setAlpha(0.9).setDepth(2);
    this.add.text(this.vx * GAME.tile + GAME.tile / 2, this.vy * GAME.tile + GAME.tile / 2, '>', sharpText({ fontFamily: FONT, fontSize: '12px', color: '#eef2ff' })).setOrigin(0.5).setDepth(3);
  }

  private drawGrid() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const isWall = this.grid[r][c] === WALL;
        const key = isWall ? 'wall' : (r + c) % 2 === 0 ? 'floor' : 'floorAlt';
        this.add.image(c * GAME.tile, r * GAME.tile, key).setOrigin(0, 0);
      }
    }
  }

  private spawnPlayer() {
    this.playerShadow = this.add.ellipse(this.tileCenter(this.px), this.tileCenter(this.py) + 8, 15, 5, 0x000000, 0.36).setDepth(4);
    this.player = this.add.image(this.tileCenter(this.px), this.tileCenter(this.py), 'player').setScale(PLAYER_SCALE_X, PLAYER_SCALE_Y).setDepth(5);
  }

  update(time: number) {
    if (this.busy || time < this.moveLockedUntil) return;
    const d = input.dir();
    if (d.x === 0 && d.y === 0) return;

    const nx = this.px + d.x;
    const ny = this.py + d.y;
    if (this.grid[ny]?.[nx] !== FLOOR) {
      this.moveLockedUntil = time + 110;
      return;
    }

    this.px = nx;
    this.py = ny;
    this.facing = this.facingFromDir(d.x, d.y);
    this.walkPlayerTo(this.tileCenter(this.px), this.tileCenter(this.py), () => this.resolveLandingTile());
    this.moveLockedUntil = time + 110;
  }

  private resolveLandingTile() {
    if (this.px === this.sx && this.py === this.sy) {
      this.takeStairs();
      return;
    }
    if (this.px === this.rx && this.py === this.ry) {
      this.goHome();
      return;
    }
    if (this.px === this.vx && this.py === this.vy) {
      this.openSidePassage();
      return;
    }
    this.maybeEncounter();
  }

  private tileCenter(n: number): number {
    return n * GAME.tile + GAME.tile / 2;
  }

  private walkPlayerTo(x: number, y: number, onArrive?: () => void) {
    this.walkFrame = 1 - this.walkFrame;
    this.applyFacing(true);
    this.tweens.killTweensOf(this.player);
    this.tweens.killTweensOf(this.playerShadow);
    this.tweens.add({
      targets: this.player,
      x,
      y,
      duration: STEP_MS,
      ease: 'Linear',
      onComplete: () => {
        this.applyFacing(false);
        onArrive?.();
      },
    });
    this.tweens.add({
      targets: this.playerShadow,
      x,
      y: y + 8,
      duration: STEP_MS,
      ease: 'Linear',
    });
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

  /** Stairs down: a deeper floor or the boss battle at the bottom. */
  private takeStairs() {
    this.busy = true;
    const run = getRun();
    if (run.depth >= BOSS_DEPTH) {
      this.scene.pause();
      this.scene.launch('Battle', { enemies: makeBoss(run.depth) });
    } else {
      run.depth++;
      if (run.depth >= 2) completeQuest('reach_depth_2');
      saveProgress();
      this.scene.restart();
    }
  }

  /** Random encounter on movement, with a short grace period. */
  private maybeEncounter() {
    this.stepsSinceBattle++;
    if (this.stepsSinceBattle < 4) return;
    if (Phaser.Math.FloatBetween(0, 1) > 0.14) return;
    this.stepsSinceBattle = 0;
    this.busy = true;
    this.scene.pause();
    this.scene.launch('Battle', { enemies: makeEncounter(getRun().depth) });
  }

  private openSidePassage() {
    if (this.busy) return;
    this.busy = true;
    this.scene.pause();
    this.scene.launch('SideScroll', { caller: this.scene.key });
  }

  /** The Crystal draws you back to Sanctuary. */
  private goHome() {
    if (this.busy) return;
    this.busy = true;
    returnToTown();
    this.scene.start('Sanctuary');
  }
}
