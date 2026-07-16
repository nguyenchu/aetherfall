import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { input } from '../game/input';
import { ascend, getSave } from '../game/run';
import { music, sfx } from '../audio/music';
import { sharpText, FONT } from '../ui/text';

const STAT_MULT = 0.15;
const REWARD_MULT = 0.10;

/**
 * Reached by talking to the Anchor in Sanctuary once Chapter 4 is cleared.
 * Opt-in, repeatable: raises the permanent Ascension tier, which scales
 * enemy stats/rewards on every future descent (see chapters.ts). Levels,
 * gear, gold, and story flags are untouched — this only raises the ceiling.
 */
export class AscendScene extends Phaser.Scene {
  private unsubs: (() => void)[] = [];
  private ready = false;
  private leaving = false;

  constructor() {
    super('Ascend');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(320, 7, 6, 14);
    this.unsubs = [];
    this.leaving = false;
    input.releaseAll();

    const tier = getSave().ngPlus;
    const statPct = Math.round(STAT_MULT * 100);
    const rewardPct = Math.round(REWARD_MULT * 100);

    const bg = this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg).setOrigin(0, 0);
    bg.setInteractive();
    this.add.rectangle(32, 34, 448, 270, 0x07153a, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xdfe4f5, 0.86);
    this.add.rectangle(36, 38, 440, 262, 0x17306b, 0.25).setOrigin(0, 0);

    this.add.text(54, 58, 'THE CRYSTAL PULSES', sharpText({ fontFamily: FONT, fontSize: '15px', color: '#f0d36c', strokeThickness: 2 }));
    this.add.text(54, 80,
      tier === 0
        ? 'The anchors hold. Push deeper, and let it push back harder.'
        : 'It remembers every tier you have already climbed.',
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#c9cee8', strokeThickness: 2 }));

    const rows = [
      ['Current tier', tier === 0 ? 'None' : `Ascension ${tier}`],
      ['Next tier', `Ascension ${tier + 1}`],
      ['Enemy power', `+${statPct}%`],
      ['Gold & XP', `+${rewardPct}%`],
    ];
    rows.forEach(([label, value], i) => {
      const y = 112 + i * 26;
      this.add.text(70, y, label, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8', strokeThickness: 2 }));
      this.add.text(208, y - 1, value, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5', strokeThickness: 2 }));
    });

    this.add.text(70, 224,
      'Levels, gear, gold, and story stay exactly as they are.\nOnly the descent gets harder — and more rewarding.',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#6cf0c2', strokeThickness: 2 }));

    this.addButton(70, 268, `Z / tap  ·  Ascend to ${tier + 1}`, '#f0d36c', () => this.confirmAscend());
    this.addButton(70, 288, 'X / tap  ·  Not yet', '#8a93b8', () => this.cancel());

    this.time.delayedCall(250, () => {
      this.ready = true;
      this.unsubs.push(input.on('confirm', () => this.confirmAscend()));
      this.unsubs.push(input.on('cancel', () => this.cancel()));
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
  }

  private addButton(x: number, y: number, label: string, color: string, run: () => void) {
    const text = this.add.text(x, y, label, sharpText({ fontFamily: FONT, fontSize: '9px', color, strokeThickness: 2 }))
      .setInteractive({ useHandCursor: true });
    text.on('pointerover', () => text.setAlpha(0.8));
    text.on('pointerout', () => text.setAlpha(1));
    text.on('pointerdown', () => { if (this.ready && !this.leaving) run(); });
  }

  private confirmAscend() {
    if (!this.ready || this.leaving) return;
    this.leaving = true;
    sfx.play('confirm');
    ascend();
    music.play('sanctuary');
    this.cameras.main.fadeOut(260, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Sanctuary'));
  }

  private cancel() {
    if (!this.ready || this.leaving) return;
    this.leaving = true;
    sfx.play('confirm');
    this.cameras.main.fadeOut(260, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Sanctuary'));
  }
}
