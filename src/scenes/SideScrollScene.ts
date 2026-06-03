import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { input, attachTouchControls } from '../game/input';
import { music } from '../audio/music';
import { sharpText, FONT } from '../ui/text';

interface SideScrollData {
  caller: string;
}

const PLAYER_SCALE_X = 1.45;
const PLAYER_SCALE_Y = 1.75;
const FLOOR_Y = GAME.height - 72;

export class SideScrollScene extends Phaser.Scene {
  private caller = 'Descent';
  private player!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private unsubs: (() => void)[] = [];
  private vx = 0;
  private facing: 'left' | 'right' = 'right';
  private busy = false;

  constructor() {
    super('SideScroll');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    const data = this.scene.settings.data as SideScrollData;
    this.caller = data.caller ?? 'Descent';
    this.unsubs = [];
    this.busy = false;

    this.buildBackdrop();
    this.spawnPlayer();
    this.bindInput();
    attachTouchControls(this);
    music.play('explore');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
  }

  private buildBackdrop() {
    this.add.rectangle(0, 0, GAME.width, GAME.height, 0x070b18).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME.width, FLOOR_Y, 0x0b1530, 0.96).setOrigin(0, 0);
    this.add.rectangle(0, FLOOR_Y, GAME.width, GAME.height - FLOOR_Y, 0x11182a, 1).setOrigin(0, 0);

    for (let x = 24; x < GAME.width; x += 58) {
      const h = Phaser.Math.Between(58, 122);
      this.add.rectangle(x, FLOOR_Y - h, 24, h, 0x172642, 0.78).setOrigin(0.5, 0).setDepth(1);
      this.add.rectangle(x + 16, FLOOR_Y - h + 18, 12, h - 18, 0x0d1b34, 0.8).setOrigin(0.5, 0).setDepth(1);
    }

    this.add.rectangle(0, FLOOR_Y - 12, GAME.width, 12, 0x233052, 1).setOrigin(0, 0).setDepth(3);
    this.add.rectangle(0, FLOOR_Y, GAME.width, 5, COLORS.aether, 0.22).setOrigin(0, 0).setDepth(4);
    this.add.rectangle(30, FLOOR_Y - 42, 34, 42, 0x141a30, 1).setOrigin(0, 0).setStrokeStyle(1, COLORS.wall).setDepth(5);
    this.add.text(47, FLOOR_Y - 30, '<', sharpText({ fontFamily: FONT, fontSize: '15px', color: '#eef2ff' })).setOrigin(0.5).setDepth(6);
    this.add.rectangle(GAME.width - 64, FLOOR_Y - 42, 34, 42, 0x141a30, 1).setOrigin(0, 0).setStrokeStyle(1, COLORS.wall).setDepth(5);
    this.add.text(GAME.width - 47, FLOOR_Y - 30, '>', sharpText({ fontFamily: FONT, fontSize: '15px', color: '#eef2ff' })).setOrigin(0.5).setDepth(6);

    this.add.text(10, 8, 'SUNKEN CITY - SIDE PASSAGE', sharpText({ fontFamily: FONT, fontSize: '12px', color: '#f0d36c' })).setDepth(10);
    this.add.text(10, 24, 'Left/Right move  |  Space/Enter or Esc returns', sharpText({ fontFamily: FONT, fontSize: '9px', color: '#c9cee8' })).setDepth(10);
  }

  private spawnPlayer() {
    this.shadow = this.add.ellipse(94, FLOOR_Y - 2, 22, 6, 0x000000, 0.36).setDepth(7);
    this.player = this.add.image(94, FLOOR_Y - 22, 'player').setScale(PLAYER_SCALE_X, PLAYER_SCALE_Y).setDepth(8);
  }

  private bindInput() {
    this.unsubs.push(input.on('confirm', () => {
      if (this.player.x > GAME.width - 92 || this.player.x < 92) this.close();
    }));
    this.unsubs.push(input.on('cancel', () => this.close()));
    this.unsubs.push(input.on('menu', () => {
      if (this.scene.isActive('GameMenu')) return;
      this.scene.pause();
      this.scene.launch('GameMenu', { caller: this.scene.key });
    }));
  }

  update(_time: number, delta: number) {
    if (this.busy) return;
    const d = input.dir();
    this.vx = d.x * 112;
    if (this.vx !== 0) {
      this.facing = this.vx < 0 ? 'left' : 'right';
      this.player.setFlipX(this.facing === 'left');
    }

    const nextX = Phaser.Math.Clamp(this.player.x + this.vx * (delta / 1000), 62, GAME.width - 62);
    this.player.setX(nextX);
    this.shadow.setX(nextX);
    this.player.setTexture(this.vx === 0 ? 'player' : this.time.now % 220 < 110 ? 'player_walk_a' : 'player_walk_b');

    if (nextX <= 66 || nextX >= GAME.width - 66) this.close();
  }

  private close() {
    if (this.busy) return;
    this.busy = true;
    this.scene.resume(this.caller);
    this.scene.stop();
  }
}
