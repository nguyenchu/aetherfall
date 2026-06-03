import Phaser from 'phaser';
import { GAME, COLORS } from '../config';
import { buildCharacterSprites } from '../art/sprites';
import kaelPortraitUrl from '../assets/portraits/kael.png';
import lyraPortraitUrl from '../assets/portraits/lyra.png';
import miraPortraitUrl from '../assets/portraits/mira.png';

/**
 * Generates simple placeholder textures in code so the game can run without
 * external art assets. These can be replaced with full sprites later.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('portrait_kael', kaelPortraitUrl);
    this.load.image('portrait_lyra', lyraPortraitUrl);
    this.load.image('portrait_mira', miraPortraitUrl);
  }

  create() {
    this.makeTile('floor', COLORS.floor);
    this.makeTile('floorAlt', COLORS.floorAlt);
    this.makeTile('wall', COLORS.wall);
    this.makeTile('aether', COLORS.aether);

    // Pixel sprites for the hero, party, and enemies.
    buildCharacterSprites(this);

    this.scene.start('Intro');
  }

  private makeTile(key: string, color: number) {
    const t = GAME.tile;
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, t, t);
    g.generateTexture(key, t, t);
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    g.destroy();
  }
}
