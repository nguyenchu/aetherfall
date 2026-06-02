import Phaser from 'phaser';
import { GAME, COLORS } from '../config';

/**
 * Genererer enkle plassholder-teksturer i kode slik at spillet kjører
 * helt uten kunst-assets. Byttes ut med ekte sprites senere.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeTile('floor', COLORS.floor);
    this.makeTile('floorAlt', COLORS.floorAlt);
    this.makeTile('wall', COLORS.wall);
    this.makeTile('player', COLORS.player);
    this.makeTile('aether', COLORS.aether);

    this.scene.start('Descent');
  }

  private makeTile(key: string, color: number) {
    const t = GAME.tile;
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, t, t);
    g.lineStyle(1, 0x000000, 0.25);
    g.strokeRect(0.5, 0.5, t - 1, t - 1);
    g.generateTexture(key, t, t);
    g.destroy();
  }
}
