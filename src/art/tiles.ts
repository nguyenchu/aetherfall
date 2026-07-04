// Procedural 16x16 tile pixel art. Pure functions returning pixel grids
// (no Phaser import) so previews and tests can render them in Node.
// -1 = transparent, number = opaque 0xRRGGBB, [color, alpha] = translucent.

export type Pix = number | readonly [number, number] | -1;
export type PixGrid = Pix[][];

const T = 16;

/** Deterministic RNG so tiles look the same every boot / HMR reload. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shade(color: number, delta: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, v + delta));
  return (ch((color >> 16) & 0xff) << 16) | (ch((color >> 8) & 0xff) << 8) | ch(color & 0xff);
}

export function mix(a: number, b: number, t: number): number {
  const ch = (sa: number, sb: number) => Math.round(sa + (sb - sa) * t);
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (ch(ar, br) << 16) | (ch(ag, bg) << 8) | ch(ab, bb);
}

function filled(color: number): PixGrid {
  return Array.from({ length: T }, () => Array<Pix>(T).fill(color));
}

function pset(g: PixGrid, x: number, y: number, p: Pix): void {
  g[((y % T) + T) % T][((x % T) + T) % T] = p;
}

function speckle(g: PixGrid, base: number, rnd: () => number, count: number, amount: number): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * T), y = Math.floor(rnd() * T);
    const d = (rnd() < 0.6 ? -1 : 1) * (1 + Math.floor(rnd() * amount));
    pset(g, x, y, shade(base, d));
  }
}

/** Flagstone floor: large 8x8 slabs, faint seams — reads as ground, not wall. */
export function cobbleFloor(base: number, seed: number): PixGrid {
  const rnd = mulberry32(seed);
  const g = filled(base);
  const seam = shade(base, -10);
  for (let band = 0; band < 2; band++) {
    const y0 = band * 8;
    const off = (band % 2) * 4;
    for (let x0 = off - 8; x0 < T; x0 += 8) {
      const tone = shade(base, [-4, 0, 4][Math.floor(rnd() * 3)]);
      for (let y = y0; y < y0 + 7; y++)
        for (let x = Math.max(0, x0); x < Math.min(T, x0 + 7); x++) pset(g, x, y, tone);
      if (x0 >= 0 && x0 < T) for (let y = y0; y < y0 + 8; y++) pset(g, x0 - 1, y, seam);
      if (x0 >= 0) pset(g, x0, y0, shade(tone, 9)); // glint
    }
    for (let x = 0; x < T; x++) pset(g, x, y0 + 7, seam);
  }
  speckle(g, base, rnd, 8, 7);
  return g;
}

/** Stone-brick wall: 8x4 masonry, beveled top, dark base, optional algae. */
export function stoneWall(base: number, seed: number, algae?: number): PixGrid {
  const rnd = mulberry32(seed);
  const g = filled(base);
  const mortar = shade(base, -26);
  for (let band = 0; band < 4; band++) {
    const y0 = band * 4;
    const off = (band % 2) * 4;
    for (let x0 = off - 8; x0 < T; x0 += 8) {
      const tone = shade(base, -6 + Math.floor(rnd() * 13));
      for (let y = y0; y < y0 + 3; y++)
        for (let x = Math.max(0, x0); x < Math.min(T, x0 + 7); x++) pset(g, x, y, tone);
      for (let x = Math.max(0, x0); x < Math.min(T, x0 + 7); x++) pset(g, x, y0, shade(tone, 14));
      if (x0 >= 0 && x0 < T) for (let y = y0; y < y0 + 4; y++) pset(g, x0 - 1, y, mortar);
    }
    for (let x = 0; x < T; x++) pset(g, x, y0 + 3, mortar);
  }
  speckle(g, base, rnd, 8, 10);
  if (algae != null) {
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rnd() * T), y = Math.floor(rnd() * T);
      const len = 1 + Math.floor(rnd() * 3);
      const tone = mix(base, algae, 0.45);
      for (let d = 0; d < len; d++) pset(g, x, y + d, tone);
      pset(g, x, y, mix(base, algae, 0.65));
    }
  }
  return g;
}

/** Dense foliage wall: layered leaf clumps with top-left highlights. */
export function foliageWall(base: number, seed: number): PixGrid {
  const rnd = mulberry32(seed);
  const leaf = 0x2f7a3c;
  const g = filled(shade(base, -4));
  const tones = [mix(base, leaf, 0.3), mix(base, leaf, 0.5), mix(base, leaf, 0.68)];
  for (let i = 0; i < 9; i++) {
    const cx = Math.floor(rnd() * T), cy = Math.floor(rnd() * T);
    const r = 2 + Math.floor(rnd() * 2);
    const tone = tones[Math.floor(rnd() * tones.length)];
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        pset(g, cx + dx, cy + dy, tone);
      }
    pset(g, cx - 1, cy - 1, shade(tone, 22)); // leaf highlight
  }
  // scattered bright leaf tips
  for (let i = 0; i < 5; i++) {
    pset(g, Math.floor(rnd() * T), Math.floor(rnd() * T), mix(base, 0x5abb6a, 0.7));
  }
  return g;
}

/** Dark basalt wall: warm speckles, strata, optional glowing ember crack. */
export function basaltWall(base: number, seed: number, ember?: number): PixGrid {
  const rnd = mulberry32(seed);
  const g = filled(base);
  // strata: subtle darker rows
  for (const y of [5, 11]) {
    for (let x = 0; x < T; x++) if (rnd() < 0.75) pset(g, x, y, shade(base, -8));
  }
  speckle(g, base, rnd, 10, 9);
  if (ember != null) {
    let x = 3 + Math.floor(rnd() * 10);
    const y0 = 1 + Math.floor(rnd() * 3);
    const y1 = 11 + Math.floor(rnd() * 4);
    for (let y = y0; y <= y1; y++) {
      pset(g, x, y, [ember, 0.85]);
      if (rnd() < 0.3) pset(g, x, y, shade(ember, 60));
      if (rnd() < 0.4) pset(g, x + (rnd() < 0.5 ? -1 : 1), y, [ember, 0.25]);
      x += rnd() < 0.35 ? (rnd() < 0.5 ? -1 : 1) : 0;
      x = Math.max(1, Math.min(T - 2, x));
    }
  }
  return g;
}

/** Themed dungeon floor: quiet texture with a hint of the area's accent. */
export function themeFloor(base: number, accent: number, themeId: string, seed: number): PixGrid {
  const rnd = mulberry32(seed);
  const g = filled(base);
  speckle(g, base, rnd, 12, 9);
  for (let i = 0; i < 2; i++) {
    pset(g, Math.floor(rnd() * T), Math.floor(rnd() * T), mix(base, accent, 0.3));
  }
  if (themeId === 'forest') {
    // grass tufts
    for (let i = 0; i < 2; i++) {
      const x = Math.floor(rnd() * T), y = Math.floor(rnd() * (T - 1));
      const tone = mix(base, 0x2e6b38, 0.55);
      pset(g, x, y, tone);
      pset(g, x, y + 1, tone);
    }
  } else if (themeId === 'sunken') {
    // faint ripple
    const y = Math.floor(rnd() * T), x = Math.floor(rnd() * (T - 3));
    for (let d = 0; d < 3; d++) pset(g, x + d, y, shade(base, 7));
  } else if (themeId === 'ashen') {
    // cooling ember fleck
    pset(g, Math.floor(rnd() * T), Math.floor(rnd() * T), mix(base, accent, 0.5));
  }
  return g;
}

/** Picks a wall style for an area theme. Unknown themes get masonry. */
export function themeWall(
  theme: { id: string; wall: number; accent: number },
  variant: number,
): PixGrid {
  const seed = 40 + variant;
  if (theme.id === 'forest') return foliageWall(theme.wall, seed);
  if (theme.id === 'ashen') {
    return variant === 2 ? basaltWall(theme.wall, seed, theme.accent) : basaltWall(theme.wall, seed);
  }
  return stoneWall(theme.wall, seed, theme.accent);
}

/** Deterministic per-tile variant so maps stay stable between visits. */
export function tileVariant(col: number, row: number, n: number): number {
  let h = Math.imul(col + 1, 0x9e3779b1) ^ Math.imul(row + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % n;
}

/** Aether portal: soft radial glow around a bright rune diamond. */
export function aetherGlow(): PixGrid {
  const g: PixGrid = Array.from({ length: T }, () => Array<Pix>(T).fill(-1));
  const CORE = 0xf6f9ff, MID = 0x8a6cf0, HALO = 0xb9a4ff;
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const dx = x - 7.5, dy = y - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const diamond = Math.abs(dx) + Math.abs(dy);
      if (diamond <= 2.5) g[y][x] = CORE;
      else if (diamond <= 4.5) g[y][x] = [MID, 0.9];
      else if (dist <= 8) g[y][x] = [HALO, Math.max(0, 0.5 * (1 - dist / 8) + 0.08)];
    }
  // sparkles at the cardinal points
  for (const [sx, sy] of [[7, 0], [8, 15], [0, 8], [15, 7]] as const) {
    g[sy][sx] = [CORE, 0.8];
  }
  return g;
}
