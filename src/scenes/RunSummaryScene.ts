import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { input } from '../game/input';
import { finishRun, getRun, returnToTown } from '../game/run';
import { BOONS } from '../game/boons';
import { TALENTS } from '../game/talents';
import { getSave } from '../game/run';
import { music, sfx } from '../audio/music';
import { sharpText, FONT } from '../ui/text';
import { track, chapterOfDepth } from '../game/analytics';
import { openFeedback } from '../ui/feedback';

interface RunSummaryData {
  reason: 'wipe' | 'retreat' | 'clear';
  depth?: number;
}

export class RunSummaryScene extends Phaser.Scene {
  private unsubs: (() => void)[] = [];
  private ready = false;
  private leaving = false;

  constructor() {
    super('RunSummary');
  }

  create(data: RunSummaryData) {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(320, 7, 6, 14);
    this.unsubs = [];
    this.leaving = false;
    input.releaseAll();

    const run = getRun();
    const depth = data.depth ?? run.depth;
    // Both outcomes (a party wipe and a voluntary retreat) funnel through here,
    // so this is the single canonical "run ended" signal.
    const goldLeft = run.gold;
    track('run_end', { reason: data.reason, ch: chapterOfDepth(depth), d: depth, g: goldLeft });
    const payout = finishRun(data.reason);
    const title = data.reason === 'wipe' ? 'THE ANCHOR PULLS YOU HOME'
      : data.reason === 'clear' ? 'YOU REACHED THE BOTTOM' : 'RETURNED TO SANCTUARY';
    const subtitle = data.reason === 'wipe'
      ? 'The descent ends. Only the Echoes remain.'
      : data.reason === 'clear' ? 'The Aether is quiet. The Anchor remembers everything.'
      : 'You leave the dark before it can take more.';

    // The whole background is the "continue" tap target. Making it an
    // interactive object (rather than a scene-level pointerdown) lets the
    // feedback link sit on top and, with input.topOnly (Phaser default),
    // swallow its own taps so they don't also trigger continue().
    const bg = this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg)
      .setOrigin(0, 0)
      .setInteractive();
    bg.on('pointerdown', () => this.continue());
    this.add.rectangle(32, 34, 448, 270, 0x07153a, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xdfe4f5, 0.86);
    this.add.rectangle(36, 38, 440, 262, 0x17306b, 0.25).setOrigin(0, 0);

    this.add.text(54, 58, title, sharpText({ fontFamily: FONT, fontSize: '15px', color: '#f0d36c', strokeThickness: 2 }));
    this.add.text(54, 80, subtitle, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#c9cee8', strokeThickness: 2 }));

    this.add.text(70, 104, `Stratum ${Math.ceil(depth / 2)} (depth ${depth})`, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5', strokeThickness: 2 }));
    payout.lines.forEach(([label, amount], i) => {
      const y = 122 + i * 12;
      this.add.text(70, y, label, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8', strokeThickness: 2 }));
      this.add.text(300, y, `+${amount}`, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#9ae8ff', strokeThickness: 2 })).setOrigin(1, 0);
    });
    this.add.text(300, 122 + payout.lines.length * 12 + 4, `✦ ${payout.total} Echoes  (bank: ${getSave().echoes})`, sharpText({
      fontFamily: FONT, fontSize: '11px', color: '#f0d36c', strokeThickness: 2,
    })).setOrigin(1, 0);

    // Actual boon names, not just a count — the whole point of a roguelite
    // recap is seeing what you actually built this run.
    const boonNames = run.boons.map((id) => BOONS[id]?.name ?? id);
    this.add.text(330, 104, 'Boons', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8', strokeThickness: 2 }));
    this.add.text(330, 116, boonNames.length > 0 ? boonNames.join('\n') : 'None', sharpText({
      fontFamily: FONT, fontSize: '8px', color: '#c9a8ff', strokeThickness: 2, wordWrap: { width: 130 },
    }));

    run.party.forEach((m, i) => {
      const names = (m.talents ?? []).map((t) => TALENTS[t]?.name ?? t).join(', ');
      this.add.text(70, 216 + i * 16, `${m.name} Lv ${m.level ?? 1}: ${names || '—'}`,
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a8d8ff', strokeThickness: 2, wordWrap: { width: 400 } }));
    });
    this.add.text(70, 276, 'Z / tap  ·  wake in Sanctuary',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#6cf0c2', strokeThickness: 2 }));

    // Contextual feedback prompt: this is a natural pause right after an
    // outcome, a far better capture moment than a passive Title-screen link.
    const fb = this.add.text(GAME.width - 8, 8, '✉ How was that run?', sharpText({
      fontFamily: FONT, fontSize: '8px', color: '#6cf0c2', strokeThickness: 2,
    })).setOrigin(1, 0).setDepth(50).setInteractive({ useHandCursor: true });
    fb.on('pointerover', () => fb.setColor('#a8ffe6'));
    fb.on('pointerout', () => fb.setColor('#6cf0c2'));
    fb.on('pointerdown', () => openFeedback(`run_${data.reason}`, {
      sub: 'What made this run end? Anything feel unfair or unclear? Anonymous.',
    }));

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
    if (!this.ready || this.leaving) return;
    this.leaving = true;
    sfx.play('confirm');
    returnToTown();
    music.play('sanctuary');
    this.cameras.main.fadeOut(260, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Sanctuary'));
  }
}
