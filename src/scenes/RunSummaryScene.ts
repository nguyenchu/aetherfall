import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { input } from '../game/input';
import { getRun, returnToTown } from '../game/run';
import { music, sfx } from '../audio/music';
import { sharpText, FONT } from '../ui/text';

interface RunSummaryData {
  reason: 'wipe' | 'retreat';
  lostGold?: number;
  depth?: number;
}

export class RunSummaryScene extends Phaser.Scene {
  private unsubs: (() => void)[] = [];
  private ready = false;

  constructor() {
    super('RunSummary');
  }

  create(data: RunSummaryData) {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(320, 7, 6, 14);
    this.unsubs = [];
    input.releaseAll();

    const run = getRun();
    const depth = data.depth ?? run.depth;
    const title = data.reason === 'wipe' ? 'THE CRYSTAL PULLS YOU HOME' : 'RETURNED TO SANCTUARY';
    const subtitle = data.reason === 'wipe'
      ? 'The descent ends, but your growth remains.'
      : 'You leave the dark before it can take more.';

    this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg).setOrigin(0, 0);
    this.add.rectangle(32, 34, 448, 270, 0x07153a, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xdfe4f5, 0.86);
    this.add.rectangle(36, 38, 440, 262, 0x17306b, 0.25).setOrigin(0, 0);

    this.add.text(54, 58, title, sharpText({ fontFamily: FONT, fontSize: '15px', color: '#f0d36c', strokeThickness: 2 }));
    this.add.text(54, 80, subtitle, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#c9cee8', strokeThickness: 2 }));

    const rows = [
      ['Depth reached', `Stratum ${depth}`],
      ['Gold carried', `${run.gold}`],
      ['Gold lost', data.lostGold && data.lostGold > 0 ? `${data.lostGold}` : '0'],
      ['Run boons', run.boons.length > 0 ? `${run.boons.length}` : 'none'],
    ];
    rows.forEach(([label, value], i) => {
      const y = 116 + i * 28;
      this.add.text(70, y, label, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8', strokeThickness: 2 }));
      this.add.text(208, y - 1, value, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5', strokeThickness: 2 }));
    });

    this.add.text(70, 238, run.party.map((m) => `${m.name}  Lv ${m.level ?? 1}`).join('     '),
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#a8d8ff', strokeThickness: 2 }));
    this.add.text(70, 270, 'Z / tap  ·  wake in Sanctuary',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#6cf0c2', strokeThickness: 2 }));

    this.input.once('pointerdown', () => this.continue());
    this.time.delayedCall(250, () => {
      this.ready = true;
      this.unsubs.push(input.on('confirm', () => this.continue()));
      this.unsubs.push(input.on('cancel', () => this.continue()));
    });
    // No on-screen buttons: the whole screen is already one big tap target
    // (see the pointerdown listener above), matching the "Z / tap" hint text.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
  }

  private continue() {
    if (!this.ready) return;
    sfx.play('confirm');
    returnToTown();
    music.play('sanctuary');
    this.cameras.main.fadeOut(260, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Sanctuary'));
  }
}
