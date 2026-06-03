import Phaser from 'phaser';
import { GAME, COLORS, setRenderScale } from './config';
import { bindKeyboard } from './game/input';
import { BootScene } from './scenes/BootScene';
import { SanctuaryScene } from './scenes/SanctuaryScene';
import { DescentScene } from './scenes/DescentScene';
import { SideScrollScene } from './scenes/SideScrollScene';
import { BattleScene } from './scenes/BattleScene';
import { DialogueScene } from './scenes/DialogueScene';
import { GameMenuScene } from './scenes/GameMenuScene';

// 2× gives 1280×720 canvas. CSS fills the remaining fraction via image-rendering: pixelated.
setRenderScale(2);

bindKeyboard();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.width * 2,
  height: GAME.height * 2,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  backgroundColor: COLORS.bg,
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, SanctuaryScene, DescentScene, SideScrollScene, BattleScene, DialogueScene, GameMenuScene],
});
