import Phaser from 'phaser';
import { GAME } from '../config';
import { makeEncounter } from '../game/content';
import { getRun } from '../game/run';
import { music } from '../audio/music';

const COLS = Math.floor(GAME.width / GAME.tile);
const ROWS = Math.floor(GAME.height / GAME.tile);

const WALL = 1;
const FLOOR = 0;

/**
 * Ett "stratum" (nivå) i nedstigningen. Selve romlayouten er prosedyre-
 * generert (drunkard's walk), mens temaet/fienden/bossen vil være
 * håndlaget per stratum senere -> "Hades-modellen".
 */
export class DescentScene extends Phaser.Scene {
  private grid: number[][] = [];
  private player!: Phaser.GameObjects.Image;
  private px = 0;
  private py = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private moveLockedUntil = 0;
  private stepsSinceBattle = 0;
  private goldText!: Phaser.GameObjects.Text;
  private musicText!: Phaser.GameObjects.Text;

  constructor() {
    super('Descent');
  }

  create() {
    this.generate();
    this.drawGrid();
    this.spawnPlayer();
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.add
      .text(4, 4, 'AETHERFALL', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#8a6cf0',
      })
      .setDepth(10);
    this.add
      .text(4, 16, 'Stratum I — Den Sunkne By   ·   piltaster: beveg', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#5a6080',
      })
      .setDepth(10);

    this.goldText = this.add
      .text(GAME.width - 4, 4, '', { fontFamily: 'monospace', fontSize: '8px', color: '#f0d36c' })
      .setOrigin(1, 0)
      .setDepth(10);
    this.musicText = this.add
      .text(4, GAME.height - 11, '', { fontFamily: 'monospace', fontSize: '8px', color: '#5a6080' })
      .setDepth(10);
    this.refreshHud();

    // Musikk: rolig utforskningsspor; M skrur av/på.
    music.play('explore');
    this.input.keyboard!.on('keydown-M', () => {
      music.toggle();
      this.refreshHud();
    });

    // Oppdater HUD og bytt tilbake til utforskningsmusikk når vi kommer fra kamp.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.refreshHud();
      music.play('explore');
      this.moveLockedUntil = this.time.now + 200;
    });
  }

  private refreshHud() {
    const run = getRun();
    this.musicText.setText(music.isEnabled() ? '♪ M: demp' : '♪ av  M: på');
    this.goldText.setText(`Gull ${run.gold}`);
  }

  /** Drunkard's walk: hugg ut gulv av massivt fjell. */
  private generate() {
    this.grid = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => WALL),
    );

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
    this.player = this.add
      .image(this.px * GAME.tile, this.py * GAME.tile, 'player')
      .setOrigin(0, 0)
      .setDepth(5);
  }

  update(time: number) {
    if (time < this.moveLockedUntil) return;

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown) dx = -1;
    else if (this.cursors.right.isDown) dx = 1;
    else if (this.cursors.up.isDown) dy = -1;
    else if (this.cursors.down.isDown) dy = 1;

    if (dx === 0 && dy === 0) return;

    const nx = this.px + dx;
    const ny = this.py + dy;
    if (this.grid[ny]?.[nx] === FLOOR) {
      this.px = nx;
      this.py = ny;
      this.player.setPosition(this.px * GAME.tile, this.py * GAME.tile);
      this.moveLockedUntil = time + 110;
      this.maybeEncounter();
    }
  }

  /** Tilfeldig fiende-encounter ved bevegelse, med en kort sikker periode. */
  private maybeEncounter() {
    this.stepsSinceBattle++;
    if (this.stepsSinceBattle < 4) return;
    if (Phaser.Math.FloatBetween(0, 1) > 0.14) return;

    this.stepsSinceBattle = 0;
    this.scene.pause();
    this.scene.launch('Battle', { enemies: makeEncounter() });
  }
}
