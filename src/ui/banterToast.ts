import type Phaser from 'phaser';
import { GAME } from '../config';
import { sharpText, FONT } from './text';
import type { BanterLine } from '../game/banter';

const PORTRAIT_SIZE = 38;
const PORTRAIT_X = -114;

/** Small non-blocking speech toast for ambient party banter shown while
 *  exploring. Cycles through each line in sequence, then fades out — unlike
 *  DialogueScene it never pauses input or movement. Each line gets a small
 *  portrait chip (glowing backdrop + colored ring in the speaker's own
 *  accent color) rather than just a name label. */
export function showBanterToast(scene: Phaser.Scene, lines: BanterLine[]): void {
  if (lines.length === 0) return;
  const restY = GAME.height - 60;
  const box = scene.add.container(GAME.width / 2, restY + 14).setDepth(998).setAlpha(0);
  const bg = scene.add.rectangle(0, 0, 268, 48, 0x0d1024, 0.94).setStrokeStyle(1, 0x2f3658, 0.9);

  // Square glow to match the portrait's own shape (and the same "spotlighted
  // character" motif as BattleScene's active-turn chip) rather than a
  // circular backdrop, which would clip the image's corners.
  const glow = scene.add.rectangle(PORTRAIT_X, 0, PORTRAIT_SIZE + 10, PORTRAIT_SIZE + 10, 0xffffff, 0.3);
  const hasPortrait = scene.textures.exists(lines[0].portrait);
  const portraitImg = hasPortrait
    ? scene.add.image(PORTRAIT_X, 0, lines[0].portrait).setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE)
    : undefined;
  const ring = scene.add.rectangle(PORTRAIT_X, 0, PORTRAIT_SIZE + 2, PORTRAIT_SIZE + 2)
    .setStrokeStyle(2, 0xffffff, 0.95);

  const textX = hasPortrait ? -90 : -128;
  const wrapW = hasPortrait ? 200 : 240;
  const name = scene.add.text(textX, -17, '', sharpText({ fontFamily: FONT, fontSize: '8px', strokeThickness: 2 })).setOrigin(0, 0);
  const body = scene.add.text(textX, -4, '', sharpText({
    fontFamily: FONT, fontSize: '8px', color: '#dfe4f5', strokeThickness: 2, wordWrap: { width: wrapW },
  })).setOrigin(0, 0);
  box.add(portraitImg ? [bg, glow, portraitImg, ring, name, body] : [bg, name, body]);

  scene.tweens.add({ targets: box, y: restY, alpha: 1, duration: 220, ease: 'Sine.easeOut' });

  const showLine = (i: number) => {
    const line = lines[i];
    const hex = '#' + line.color.toString(16).padStart(6, '0');
    name.setText(line.speaker).setColor(hex);
    body.setText(line.text);
    glow.setFillStyle(line.color, 0.3);
    ring.setStrokeStyle(2, line.color, 0.95);
    if (portraitImg && scene.textures.exists(line.portrait)) portraitImg.setTexture(line.portrait);
    scene.time.delayedCall(i === lines.length - 1 ? 3400 : 2800, () => {
      if (i + 1 < lines.length) showLine(i + 1);
      else scene.tweens.add({ targets: box, y: restY + 14, alpha: 0, duration: 260, ease: 'Cubic.In', onComplete: () => box.destroy() });
    });
  };
  showLine(0);
}
