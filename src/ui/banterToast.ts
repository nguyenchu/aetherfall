import type Phaser from 'phaser';
import { GAME } from '../config';
import { sharpText, FONT } from './text';
import type { BanterLine } from '../game/banter';

/** Small non-blocking speech toast for ambient party banter shown while
 *  exploring. Cycles through each line in sequence, then fades out — unlike
 *  DialogueScene it never pauses input or movement. */
export function showBanterToast(scene: Phaser.Scene, lines: BanterLine[]): void {
  if (lines.length === 0) return;
  const restY = GAME.height - 56;
  const box = scene.add.container(GAME.width / 2, restY + 14).setDepth(998).setAlpha(0);
  const bg = scene.add.rectangle(0, 0, 240, 40, 0x0d1024, 0.92).setStrokeStyle(1, 0x2f3658, 0.9);
  const name = scene.add.text(-112, -16, '', sharpText({ fontFamily: FONT, fontSize: '8px', strokeThickness: 2 })).setOrigin(0, 0);
  const body = scene.add.text(-112, -4, '', sharpText({
    fontFamily: FONT, fontSize: '8px', color: '#dfe4f5', strokeThickness: 2, wordWrap: { width: 224 },
  })).setOrigin(0, 0);
  box.add([bg, name, body]);

  scene.tweens.add({ targets: box, y: restY, alpha: 1, duration: 220, ease: 'Sine.easeOut' });

  const showLine = (i: number) => {
    const line = lines[i];
    name.setText(line.speaker).setColor('#' + line.color.toString(16).padStart(6, '0'));
    body.setText(line.text);
    scene.time.delayedCall(i === lines.length - 1 ? 2200 : 1700, () => {
      if (i + 1 < lines.length) showLine(i + 1);
      else scene.tweens.add({ targets: box, y: restY + 14, alpha: 0, duration: 260, ease: 'Cubic.In', onComplete: () => box.destroy() });
    });
  };
  showLine(0);
}
