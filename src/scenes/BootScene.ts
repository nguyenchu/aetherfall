import Phaser from 'phaser';
import { COLORS } from '../config';
import { buildCharacterSprites, paintPixelGrid } from '../art/sprites';
import { cobbleFloor, stoneWall, aetherGlow } from '../art/tiles';
import { ITEMS } from '../game/content';
import { EQUIPMENT } from '../game/equipment';
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
    // Sanctuary tiles: flagstone floors (two variants each), brick wall, portal glow.
    paintPixelGrid(this, 'floor_0', cobbleFloor(COLORS.floor, 11));
    paintPixelGrid(this, 'floor_1', cobbleFloor(COLORS.floor, 12));
    paintPixelGrid(this, 'floorAlt_0', cobbleFloor(COLORS.floorAlt, 13));
    paintPixelGrid(this, 'floorAlt_1', cobbleFloor(COLORS.floorAlt, 14));
    paintPixelGrid(this, 'wall', stoneWall(COLORS.wall, 15));
    paintPixelGrid(this, 'aether', aetherGlow());

    // Pixel sprites for the hero, party, and enemies.
    buildCharacterSprites(this);
    this.buildItemIcons();
    this.buildEquipmentIcons();

    this.scene.start('Intro');
  }

  private buildItemIcons() {
    for (const id of Object.keys(ITEMS)) {
      this.makeIcon(`icon_${id}`, (g) => {
        switch (id) {
          case 'potion':
            this.drawBottle(g, 0xff5a6a, 0xffccd2);
            break;
          case 'tonic':
            this.drawBottle(g, 0x44aaff, 0xb8e8ff);
            break;
          case 'tide_pearl':
            g.fillStyle(0xdff6ff, 1).fillCircle(16, 16, 8);
            g.fillStyle(0x78b6d8, 0.7).fillCircle(19, 14, 3);
            g.lineStyle(2, 0x9ad8ff, 0.8).strokeCircle(16, 16, 9);
            break;
          case 'warden_sigils':
            g.fillStyle(0x7d89a8, 1).fillRoundedRect(8, 6, 16, 20, 3);
            g.lineStyle(2, 0xdfe4f5, 0.8).strokeRoundedRect(8, 6, 16, 20, 3);
            g.fillStyle(0x6cf0c2, 1).fillCircle(16, 16, 3);
            g.fillStyle(0xf0d36c, 1).fillTriangle(16, 9, 12, 22, 20, 22);
            break;
        }
      });
    }
    this.makeIcon('icon_none', (g) => {
      g.lineStyle(3, 0x6f789a, 0.9);
      g.strokeCircle(16, 16, 8);
      g.lineBetween(10, 22, 22, 10);
    });
  }

  private buildEquipmentIcons() {
    for (const id of Object.keys(EQUIPMENT)) {
      this.makeIcon(`icon_${id}`, (g) => {
        switch (id) {
          case 'slender_blade':
            g.fillStyle(0xdfe4f5, 1).fillTriangle(18, 4, 22, 7, 10, 23);
            g.fillStyle(0x6cf0c2, 1).fillRect(9, 22, 12, 3);
            g.fillStyle(0x5c3924, 1).fillRect(13, 21, 4, 7);
            break;
          case 'ember_staff':
            g.fillStyle(0x5c3924, 1).fillRect(15, 8, 3, 18);
            g.fillStyle(0xff7a32, 1).fillCircle(16, 8, 5);
            g.fillStyle(0xffd36c, 1).fillCircle(16, 8, 2);
            break;
          case 'dawn_mace':
            g.fillStyle(0x5c3924, 1).fillRect(15, 11, 3, 16);
            g.fillStyle(0xf0d36c, 1).fillCircle(16, 10, 6);
            g.fillStyle(0xdfe4f5, 1).fillCircle(16, 10, 3);
            break;
          case 'scout_vest':
            this.drawArmor(g, 0x4b6f7a, 0x6cf0c2);
            break;
          case 'aether_robe':
            this.drawRobe(g, 0x5d3b9a, 0xa58cff);
            break;
          case 'reef_mail':
            this.drawArmor(g, 0x4f7f9a, 0x9ad8ff);
            break;
          case 'sun_charm':
            g.fillStyle(0xf0d36c, 1).fillCircle(16, 16, 6);
            g.lineStyle(2, 0xfff0a0, 0.9).strokeCircle(16, 16, 9);
            break;
          case 'tide_ring':
            g.lineStyle(4, 0x44aaff, 1).strokeCircle(16, 16, 8);
            g.fillStyle(0xdff6ff, 1).fillCircle(16, 9, 3);
            break;
          case 'oracle_lantern':
            g.fillStyle(0xf0d36c, 1).fillRoundedRect(10, 9, 12, 15, 3);
            g.fillStyle(0xfff4b8, 1).fillCircle(16, 16, 4);
            g.lineStyle(2, 0xdfe4f5, 0.9).strokeRoundedRect(10, 9, 12, 15, 3);
            break;
        }
      });
    }
  }

  private makeIcon(key: string, draw: (g: Phaser.GameObjects.Graphics) => void) {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    g.fillStyle(0x07153a, 1).fillRoundedRect(0, 0, 32, 32, 4);
    g.lineStyle(2, 0xdfe4f5, 0.72).strokeRoundedRect(1, 1, 30, 30, 4);
    g.fillStyle(0x17306b, 0.35).fillRoundedRect(4, 4, 24, 24, 3);
    draw(g);
    g.generateTexture(key, 32, 32);
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    g.destroy();
  }

  private drawBottle(g: Phaser.GameObjects.Graphics, liquid: number, shine: number) {
    g.fillStyle(0xdfe4f5, 1).fillRoundedRect(12, 5, 8, 6, 2);
    g.fillStyle(liquid, 1).fillRoundedRect(9, 10, 14, 16, 4);
    g.fillStyle(shine, 0.85).fillRoundedRect(12, 12, 4, 9, 2);
    g.lineStyle(2, 0x07060e, 0.45).strokeRoundedRect(9, 10, 14, 16, 4);
  }

  private drawArmor(g: Phaser.GameObjects.Graphics, base: number, accent: number) {
    g.fillStyle(base, 1).fillTriangle(8, 8, 24, 8, 20, 26);
    g.fillStyle(base, 1).fillTriangle(8, 8, 12, 26, 20, 26);
    g.fillStyle(accent, 0.9).fillRect(14, 10, 4, 14);
    g.lineStyle(2, 0xdfe4f5, 0.7).strokeTriangle(8, 8, 24, 8, 20, 26);
  }

  private drawRobe(g: Phaser.GameObjects.Graphics, base: number, accent: number) {
    g.fillStyle(base, 1).fillTriangle(16, 6, 8, 26, 24, 26);
    g.fillStyle(accent, 1).fillTriangle(16, 10, 13, 25, 19, 25);
    g.lineStyle(2, 0xdfe4f5, 0.68).strokeTriangle(16, 6, 8, 26, 24, 26);
  }
}
