// Boss silhouettes: each of the 5 chapter bosses gets its own distinct
// shape via real geometry, generated once at boot alongside the rest of the
// cast (see sprites.ts) — not the same "finned maw" outline recolored five
// times. NEAREST-filtered like everything else in the game so it still
// reads as chunky pixel art once scaled up in battle (see BattleScene's
// BOSS_SCALE).
import Phaser from 'phaser';

interface Pt { x: number; y: number }

interface BossSpec {
  key: string;
  base: number;
  shadow: number;
  glow: number; // eye / accent glow color
  shape: (g: Phaser.GameObjects.Graphics, s: number, spec: BossSpec) => void;
}

const OUTLINE = 0x10121c;
const SIZE = 44;

function fillPoly(g: Phaser.GameObjects.Graphics, points: Pt[], color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.closePath();
  g.fillPath();
}

function eyes(g: Phaser.GameObjects.Graphics, cx: number, cy: number, spread: number, r: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(cx - spread, cy, r);
  g.fillCircle(cx + spread, cy, r);
}

const BOSSES: BossSpec[] = [
  {
    // Forest Shade (Ch1) — a gnarled crown of uneven thorns around a dark
    // mossy core; the anchor guardian consumed by dark.
    key: 'e_forestshade', base: 0x24352a, shadow: 0x152018, glow: 0xff4f64,
    shape: (g, s, spec) => {
      const cx = s / 2, cy = s / 2;
      const spikes = 10;
      const lens = [1, 0.68, 0.86, 0.6, 1, 0.74, 0.92, 0.64, 0.96, 0.7];
      const pts: Pt[] = [];
      for (let i = 0; i < spikes * 2; i++) {
        const a = (Math.PI * 2 * i) / (spikes * 2) - Math.PI / 2;
        const outer = i % 2 === 0;
        const r = outer ? (s / 2 - 1) * lens[(i / 2) | 0] : s * 0.22;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      fillPoly(g, pts, spec.base);
      g.fillStyle(spec.shadow, 0.6);
      g.fillCircle(cx, cy, s * 0.24);
      g.lineStyle(2, OUTLINE, 0.9);
      g.strokePoints(pts, true);
      eyes(g, cx, cy - s * 0.04, s * 0.1, s * 0.045, spec.glow);
    },
  },
  {
    // Tide Warden (Ch2) — a tall serpentine leviathan: dorsal fin above,
    // tapering tail below, distinctly narrower and taller than the others.
    key: 'e_tidewarden', base: 0x3b64a3, shadow: 0x243f6d, glow: 0xd8f5ff,
    shape: (g, s, spec) => {
      const cx = s / 2;
      const body: Pt[] = [
        { x: cx, y: 1 },
        { x: cx + s * 0.16, y: s * 0.12 },
        { x: cx + s * 0.3, y: s * 0.3 },
        { x: cx + s * 0.34, y: s * 0.55 },
        { x: cx + s * 0.22, y: s * 0.78 },
        { x: cx + s * 0.08, y: s - 1 },
        { x: cx, y: s * 0.94 },
        { x: cx - s * 0.08, y: s - 1 },
        { x: cx - s * 0.22, y: s * 0.78 },
        { x: cx - s * 0.34, y: s * 0.55 },
        { x: cx - s * 0.3, y: s * 0.3 },
        { x: cx - s * 0.16, y: s * 0.12 },
      ];
      fillPoly(g, body, spec.base);
      fillPoly(g, [{ x: cx, y: 1 }, { x: cx + s * 0.14, y: s * 0.2 }, { x: cx - s * 0.14, y: s * 0.2 }], spec.shadow, 0.9);
      g.fillStyle(spec.shadow, 0.5);
      g.fillEllipse(cx, s * 0.5, s * 0.3, s * 0.4);
      g.lineStyle(2, OUTLINE, 0.9);
      g.strokePoints(body, true);
      eyes(g, cx, s * 0.32, s * 0.1, s * 0.045, spec.glow);
    },
  },
  {
    // Ashbrand (Ch3) — a crown of flame licks over a narrowing ember body;
    // the ember that will not die.
    key: 'e_ashbrand', base: 0xe28550, shadow: 0x99401d, glow: 0xffc23e,
    shape: (g, s, spec) => {
      const cx = s / 2;
      // Three symmetric flame peaks — starts and ends at the same valley
      // height on both sides so it closes cleanly into the lower taper.
      const body: Pt[] = [
        { x: s * 0.15, y: s * 0.5 },
        { x: s * 0.26, y: s * 0.16 },
        { x: s * 0.38, y: s * 0.42 },
        { x: cx, y: s * 0.02 },
        { x: s * 0.62, y: s * 0.42 },
        { x: s * 0.74, y: s * 0.16 },
        { x: s * 0.85, y: s * 0.5 },
        { x: s * 0.68, y: s * 0.72 },
        { x: cx, y: s - 1 },
        { x: s * 0.32, y: s * 0.72 },
      ];
      fillPoly(g, body, spec.base);
      fillPoly(g, [{ x: cx, y: s * 0.42 }, { x: s * 0.6, y: s * 0.7 }, { x: cx, y: s * 0.92 }, { x: s * 0.4, y: s * 0.7 }], spec.glow, 0.85);
      g.lineStyle(2, OUTLINE, 0.9);
      g.strokePoints(body, true);
      eyes(g, cx, s * 0.5, s * 0.09, s * 0.04, 0xff4f64);
    },
  },
  {
    // Prism Sovereign (Ch4) — a hard-edged faceted star, cut like a gem
    // instead of grown like flesh.
    key: 'e_prismsovereign', base: 0x8a6cf0, shadow: 0x5b43ae, glow: 0xf6f9ff,
    shape: (g, s, spec) => {
      const cx = s / 2, cy = s / 2;
      const points = 6;
      const outer: Pt[] = [];
      const pts: Pt[] = [];
      for (let i = 0; i < points * 2; i++) {
        const a = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
        const r = i % 2 === 0 ? s / 2 - 1 : s * 0.32;
        const p = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
        pts.push(p);
        if (i % 2 === 0) outer.push(p);
      }
      fillPoly(g, pts, spec.base);
      fillPoly(g, outer, spec.shadow, 0.5);
      g.lineStyle(2, OUTLINE, 0.9);
      g.strokePoints(pts, true);
      eyes(g, cx, cy, s * 0.11, s * 0.045, spec.glow);
    },
  },
  {
    // Galebrand (Ch5) — a swirling storm vortex with curling wind-arms; the
    // gale undone, wildest and largest-reading of the five.
    key: 'e_galebrand', base: 0x4a6a8a, shadow: 0x2a3a4e, glow: 0xd8f5ff,
    shape: (g, s, spec) => {
      const cx = s / 2, cy = s / 2;
      // Five swept pinwheel blades, each its own outlined triangle — reads
      // clearly as spinning wind even at this resolution, unlike a smooth
      // spiral curve which just blurs into a blob.
      const blades = 5;
      const sweep = 0.9;
      for (let i = 0; i < blades; i++) {
        const a0 = (Math.PI * 2 * i) / blades - Math.PI / 2;
        const tip = { x: cx + Math.cos(a0 + sweep) * (s / 2 - 1), y: cy + Math.sin(a0 + sweep) * (s / 2 - 1) };
        const base1 = { x: cx + Math.cos(a0) * s * 0.16, y: cy + Math.sin(a0) * s * 0.16 };
        const base2 = { x: cx + Math.cos(a0 + sweep * 0.55) * s * 0.36, y: cy + Math.sin(a0 + sweep * 0.55) * s * 0.36 };
        const blade = [base1, base2, tip];
        fillPoly(g, blade, i % 2 === 0 ? spec.base : spec.shadow, 1);
        g.lineStyle(1.5, OUTLINE, 0.85);
        g.strokePoints(blade, true);
      }
      g.fillStyle(spec.shadow, 1);
      g.fillCircle(cx, cy, s * 0.15);
      g.lineStyle(2, OUTLINE, 0.9);
      g.strokeCircle(cx, cy, s * 0.15);
      eyes(g, cx, cy, s * 0.07, s * 0.035, spec.glow);
    },
  },
];

/** Builds all boss textures before the game starts — called before
 *  buildCharacterSprites() so these take precedence over anything with the
 *  same key still sitting in spriteData.ts. */
export function buildBossSprites(scene: Phaser.Scene): void {
  for (const spec of BOSSES) {
    if (scene.textures.exists(spec.key)) continue;
    const g = scene.add.graphics();
    spec.shape(g, SIZE, spec);
    g.generateTexture(spec.key, SIZE, SIZE);
    scene.textures.get(spec.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    g.destroy();
  }
}
