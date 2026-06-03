// Logical resolution is the coordinate system scenes are authored in.
// renderScale zooms cameras so the world fills the canvas at an integer multiple.
// Computed dynamically from the window size; update via setRenderScale().
export const GAME = {
  width: 640,
  height: 360,
  tile: 16,
} as const;

export let renderScale = 1;
export function setRenderScale(s: number): void { renderScale = s; }

export const COLORS = {
  bg: 0x07060e,
  floor: 0x161a2c,
  floorAlt: 0x1b2138,
  wall: 0x2f3658,
  player: 0x6cf0c2,
  aether: 0x8a6cf0,
} as const;
