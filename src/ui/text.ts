import type Phaser from 'phaser';

export const FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function sharpText(
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    stroke: '#07060e',
    strokeThickness: 4,
    fontStyle: '800',
    ...style,
    fontFamily: style.fontFamily ?? FONT,
    resolution: 6,
  };
}
