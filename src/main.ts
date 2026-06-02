import Phaser from 'phaser';
import { GAME, COLORS } from './config';
import { BootScene } from './scenes/BootScene';
import { DescentScene } from './scenes/DescentScene';
import { BattleScene } from './scenes/BattleScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.width,
  height: GAME.height,
  pixelArt: true,
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, DescentScene, BattleScene],
});
