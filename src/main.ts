import Phaser from 'phaser';
import { GAME, COLORS, setRenderScale } from './config';
import { bindKeyboard, isTouchDevice } from './game/input';
import { initAnalytics, track } from './game/analytics';
import { BootScene } from './scenes/BootScene';
import { SanctuaryScene } from './scenes/SanctuaryScene';
import { DescentScene } from './scenes/DescentScene';
import { DescentHudScene } from './scenes/DescentHudScene';
import { BattleScene } from './scenes/BattleScene';
import { BoonScene } from './scenes/BoonScene';
import { DialogueScene } from './scenes/DialogueScene';
import { GameMenuScene } from './scenes/GameMenuScene';
import { TitleScene } from './scenes/TitleScene';
import { IntroScene } from './scenes/IntroScene';
import { RunSummaryScene } from './scenes/RunSummaryScene';
import { AscendScene } from './scenes/AscendScene';
import { ChapterClearScene } from './scenes/ChapterClearScene';

// 2× gives 1280×720 canvas. CSS fills the remaining fraction via image-rendering: pixelated.
setRenderScale(2);

bindKeyboard();

initAnalytics();
track('session_start', { mob: isTouchDevice() });

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
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
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME.width * 2,
    height: GAME.height * 2,
  },
  scene: [BootScene, IntroScene, TitleScene, SanctuaryScene, DescentScene, DescentHudScene, BattleScene, BoonScene, DialogueScene, GameMenuScene, RunSummaryScene, AscendScene, ChapterClearScene],
});

// Exposed for dev tooling and automated smoke tests.
(window as unknown as { __AETHERFALL__?: Phaser.Game }).__AETHERFALL__ = game;
