import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { music } from '../audio/music';
import { sharpText, FONT } from '../ui/text';

/**
 * Title screen. Handles the first user interaction so audio can start,
 * then fades into Sanctuary.
 */
export class TitleScene extends Phaser.Scene {
  private ready = false;

  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(600, 7, 6, 14);

    // Background
    this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg).setOrigin(0, 0);

    // Ambient glow orbs
    for (let i = 0; i < 22; i++) {
      const x = Phaser.Math.Between(20, GAME.width - 20);
      const y = Phaser.Math.Between(20, GAME.height - 20);
      const r = Phaser.Math.FloatBetween(1.2, 3.5);
      const alpha = Phaser.Math.FloatBetween(0.08, 0.22);
      const color = i % 3 === 0 ? 0x8a6cf0 : i % 3 === 1 ? 0x6cf0c2 : 0xf0d36c;
      this.add.circle(x, y, r, color, alpha);
    }

    // Title
    this.add.text(GAME.width / 2, 110, 'AETHERFALL', sharpText({
      fontFamily: FONT, fontSize: '36px', color: '#f0d36c',
    })).setOrigin(0.5);

    this.add.text(GAME.width / 2, 150, 'A WARRIORS OF LIGHT STORY', sharpText({
      fontFamily: FONT, fontSize: '10px', color: '#8a93b8',
    })).setOrigin(0.5);

    // Divider
    this.add.rectangle(GAME.width / 2, 172, 180, 1, 0x2f3658).setOrigin(0.5);

    // Premise
    this.add.text(GAME.width / 2, 192, 'Aether has fallen.\nDescend. Restore. Return.', sharpText({
      fontFamily: FONT, fontSize: '11px', color: '#dfe4f5', align: 'center',
    })).setOrigin(0.5);

    // Prompt — blinks
    const prompt = this.add.text(GAME.width / 2, 290, 'Press any key or tap to begin', sharpText({
      fontFamily: FONT, fontSize: '10px', color: '#6cf0c2',
    })).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.25 }, duration: 700, yoyo: true, repeat: -1 });

    // Controls hint
    this.add.text(GAME.width / 2, 330, 'WASD / arrows  ·  Z confirm  ·  X cancel  ·  M mute', sharpText({
      fontFamily: FONT, fontSize: '8px', color: '#5a6080',
    })).setOrigin(0.5);

    this.add.text(GAME.width / 2, 344, 'v0.1  —  aetherfall.nguyenchu.com', sharpText({
      fontFamily: FONT, fontSize: '7px', color: '#3a4060',
    })).setOrigin(0.5);

    this.input.once('pointerdown', () => this.start());
    this.input.keyboard?.once('keydown', () => this.start());
    this.time.delayedCall(400, () => { this.ready = true; });
  }

  private start() {
    if (!this.ready) return;
    music.play('sanctuary');
    this.cameras.main.fadeOut(400, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Sanctuary');
    });
  }
}
