// Lav intern oppløsning som skaleres opp -> skarp pixel-art-følelse.
// 480x270 er 16:9 og passer både nettleser og mobil.
export const GAME = {
  width: 480,
  height: 270,
  tile: 16,
} as const;

export const COLORS = {
  bg: 0x07060e,
  floor: 0x161a2c,
  floorAlt: 0x1b2138,
  wall: 0x2f3658,
  player: 0x6cf0c2,
  aether: 0x8a6cf0,
} as const;
