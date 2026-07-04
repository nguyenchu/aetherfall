// Original pixel-art sprites drawn in code, with no image files. The dot-grid
// data lives in spriteData.ts (pure data, previewable in Node). Generated as
// Phaser textures at boot and shared by dungeon and battle scenes. Replace
// them later by keeping the same texture keys.

import Phaser from 'phaser';
import { PALETTE, SPRITES } from './spriteData';
import type { PixGrid } from './tiles';

/** Paints a pixel grid (from tiles.ts) into a nearest-filtered texture. */
export function paintPixelGrid(scene: Phaser.Scene, key: string, grid: PixGrid): void {
  if (scene.textures.exists(key)) return;
  const h = grid.length;
  const w = grid[0].length;
  const g = scene.add.graphics();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = grid[y][x];
      if (p === -1) continue;
      const [color, alpha] = Array.isArray(p) ? p : [p, 1];
      g.fillStyle(color, alpha);
      g.fillRect(x, y, 1, 1);
    }
  }
  g.generateTexture(key, w, h);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  g.destroy();
}

/** Builds all character textures before the game starts. */
export function buildCharacterSprites(scene: Phaser.Scene): void {
  for (const [key, rows] of Object.entries(SPRITES)) {
    if (scene.textures.exists(key)) continue;
    const w = Math.max(...rows.map((r) => r.length));
    const h = rows.length;
    const g = scene.add.graphics();
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const color = PALETTE[row[x] ?? '.'];
        if (color == null || color < 0) continue;
        g.fillStyle(color, 1);
        g.fillRect(x, y, 1, 1);
      }
    }
    g.generateTexture(key, w, h);
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    g.destroy();
  }
}
