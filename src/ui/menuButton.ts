import Phaser from 'phaser';
import { GAME, COLORS } from '../config';
import { sharpText, FONT } from './text';

export function addMenuButton(scene: Phaser.Scene, y = 34): void {
  const group = scene.add.container(GAME.width - 42, y).setDepth(850);
  const bg = scene.add.rectangle(0, 0, 64, 20, 0x0d1024, 0.92).setStrokeStyle(1, COLORS.wall);
  const label = scene.add.text(0, -1, 'MENU M', sharpText({ fontFamily: FONT, fontSize: '9px', color: '#f0d36c' })).setOrigin(0.5);
  group.add([bg, label]);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', () => {
    scene.scene.pause();
    scene.scene.launch('GameMenu', { caller: scene.scene.key });
  });
}
