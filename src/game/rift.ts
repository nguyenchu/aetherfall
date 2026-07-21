// Procedurally-generated endgame dungeon ("the Rift"), reached from Sanctuary's
// Anchor once Chapter 4 is cleared. It replaces the old Ascension menu: each run
// is a fresh random single floor that ends in a boss, and clearing that boss
// raises the permanent tier (ngPlus) so the next Rift hits harder.
//
// The generator emits a plain AreaDef — the same shape the hand-crafted chapters
// use — so DescentScene and BattleScene render and fight it with no special
// cases. getArea() returns the active Rift (see chapters.ts) while one is set.

import Phaser from 'phaser';
import { THEMES, type AreaDef, type AreaTheme, type ChestContents } from './chapters';
import { RIFT_EQUIPMENT } from './equipment';

interface RiftConfig {
  theme: AreaTheme;
  idPrefix: string;   // must match makeEncounterForArea's area.id prefixes
  trash: string[];    // random-encounter pool for this theme's chapter
  boss: string;       // boss encounter group for this theme's chapter
  name: string;
}

// One config per theme; the enemy pool/boss come from that theme's chapter, so
// the id prefix has to line up with makeEncounterForArea()'s startsWith checks.
const CONFIGS: RiftConfig[] = [
  { theme: THEMES.forest,  idPrefix: 'forest',  trash: ['wolves', 'wolf_sprite', 'sprites', 'wisps'], boss: 'boss',     name: 'Verdant Rift' },
  { theme: THEMES.sunken,  idPrefix: 'sunken',  trash: ['soldiers', 'soldier_sprite', 'crawlers', 'sprites'], boss: 'ch2_boss', name: 'Drowned Rift' },
  { theme: THEMES.ashen,   idPrefix: 'ashen',   trash: ['hounds', 'hound_wraith', 'golems', 'wraiths'], boss: 'ch3_boss', name: 'Ember Rift' },
  { theme: THEMES.crystal, idPrefix: 'crystal', trash: ['wisps', 'wisp_stalker', 'stalkers', 'prisms'], boss: 'ch4_boss', name: 'Prism Rift' },
  { theme: THEMES.tempest, idPrefix: 'tempest', trash: ['harriers', 'harrier_stalker', 'stalker_sentry', 'squalls'], boss: 'ch5_boss', name: 'Squall Rift' },
];

const W = 24;
const H = 15;

interface Room { x: number; y: number; w: number; h: number; cx: number; cy: number; }

function makeRoom(xMin: number, xMax: number): Room {
  const w = Phaser.Math.Between(3, 5);
  const h = Phaser.Math.Between(3, 4);
  const x = Phaser.Math.Clamp(Phaser.Math.Between(xMin, xMax), 1, W - w - 1);
  const y = Phaser.Math.Between(1, H - h - 1);
  return { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) };
}

/** Places `char` on any free '.' cell inside a room; returns where, or null. */
function placeInRoom(grid: string[][], room: Room, char: string): { x: number; y: number } | null {
  const cells: { x: number; y: number }[] = [];
  for (let ry = room.y; ry < room.y + room.h; ry++) {
    for (let rx = room.x; rx < room.x + room.w; rx++) {
      if (grid[ry][rx] === '.') cells.push({ x: rx, y: ry });
    }
  }
  if (cells.length === 0) return null;
  const pick = Phaser.Utils.Array.GetRandom(cells);
  grid[pick.y][pick.x] = char;
  return pick;
}

/** Builds a fresh random single-floor dungeon for the given tier. */
export function generateRift(tier: number): AreaDef {
  const cfg = Phaser.Utils.Array.GetRandom(CONFIGS);
  const grid: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('#'));

  // A start room on the left, a boss room on the right, and a few in between —
  // guarantees the entrance and boss never collide and reads left-to-right.
  const rooms: Room[] = [makeRoom(1, 6)];
  const middle = Phaser.Math.Between(3, 4);
  for (let i = 0; i < middle; i++) rooms.push(makeRoom(7, W - 9));
  rooms.push(makeRoom(W - 8, W - 6));

  for (const r of rooms) {
    for (let ry = r.y; ry < r.y + r.h; ry++) {
      for (let rx = r.x; rx < r.x + r.w; rx++) grid[ry][rx] = '.';
    }
  }

  // Connect rooms in creation order with L-shaped corridors (keeps it fully
  // connected: start → … → boss). Centers are interior, so borders stay walls.
  const carveH = (x1: number, x2: number, y: number) => {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) grid[y][x] = grid[y][x] === '#' ? '.' : grid[y][x];
  };
  const carveV = (y1: number, y2: number, x: number) => {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) grid[y][x] = grid[y][x] === '#' ? '.' : grid[y][x];
  };
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    if (Math.random() < 0.5) { carveH(a.cx, b.cx, a.cy); carveV(a.cy, b.cy, b.cx); }
    else { carveV(a.cy, b.cy, a.cx); carveH(a.cx, b.cx, b.cy); }
  }

  const start = rooms[0];
  const bossRoom = rooms[rooms.length - 1];

  // Entrance + retreat portal in the start room.
  grid[start.cy][start.cx] = 'P';
  grid[start.cy][start.x] = '<';

  // Boss at the far room's center.
  grid[bossRoom.cy][bossRoom.cx] = 'B';
  const bossKey = `${bossRoom.cx},${bossRoom.cy}`;

  // A healing spring somewhere in the middle of the run.
  const springRoom = rooms[Math.max(1, Math.floor(rooms.length / 2))];
  placeInRoom(grid, springRoom, 'H');

  // One or two chests in the intermediate rooms; gold scales with tier, and
  // each has a chance to also carry a piece of the Rift's own gear tier
  // (RIFT_EQUIPMENT) — found nowhere else in the game.
  const chests: Record<string, ChestContents> = {};
  const between = Phaser.Utils.Array.Shuffle(rooms.slice(1, -1));
  const chestCount = Math.min(between.length, Phaser.Math.Between(1, 2));
  for (let i = 0; i < chestCount; i++) {
    const pos = placeInRoom(grid, between[i], 'T');
    if (!pos) continue;
    const gold = 60 + tier * 25;
    chests[`${pos.x},${pos.y}`] = Math.random() < 0.45
      ? { gold, equipment: Phaser.Utils.Array.GetRandom(RIFT_EQUIPMENT) }
      : { gold };
  }

  // Boss group keyed to the B tile; trash groups seed the random-encounter pool
  // (maybeTriggerRandomEncounter reads the values, so their keys are arbitrary).
  const encounters: Record<string, string> = { [bossKey]: cfg.boss };
  cfg.trash.forEach((g, i) => { encounters[`pool${i}`] = g; });

  return {
    id: `${cfg.idPrefix}_rift`,
    name: `${cfg.name} · Tier ${tier + 1}`,
    theme: cfg.theme,
    encounters,
    scripts: {},
    chests,
    map: grid.map((row) => row.join('')),
  };
}
