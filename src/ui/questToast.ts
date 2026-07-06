import type Phaser from 'phaser';
import { GAME } from '../config';
import { questRewardText, type QuestDef } from '../game/quests';
import { sharpText, FONT } from './text';

/** Slides a "quest complete" banner in from the top of the scene, holds, then fades out. */
export function showQuestToast(scene: Phaser.Scene, quest: QuestDef): void {
  const restY = 22;
  const box = scene.add.container(GAME.width / 2, -36).setDepth(999);
  const reward = questRewardText(quest);
  const h = reward ? 40 : 30;
  box.add(scene.add.rectangle(0, 0, 300, h, 0x0d1024, 0.96).setStrokeStyle(1, 0xf0d36c));
  box.add(scene.add.text(0, reward ? -11 : -6, `QUEST COMPLETE  ·  ${quest.title}`,
    sharpText({ fontFamily: FONT, fontSize: '9px', color: '#f0d36c' })).setOrigin(0.5));
  if (reward) {
    box.add(scene.add.text(0, 8, reward,
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#6cf0c2' })).setOrigin(0.5));
  }
  scene.tweens.add({
    targets: box,
    y: restY,
    duration: 320,
    ease: 'Back.Out',
    onComplete: () => {
      scene.time.delayedCall(1800, () => {
        scene.tweens.add({ targets: box, y: -36, duration: 260, ease: 'Cubic.In', onComplete: () => box.destroy() });
      });
    },
  });
}
