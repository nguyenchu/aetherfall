// Room-by-room chapter entrances (the Hades model). A chapter's entrance
// stratum used to be one fixed hand-made map with random encounters, the same
// on every run. Now it's ROOMS_PER_CHAPTER generated rooms: each room is a
// small fresh map in the chapter's theme with its field mechanic, holds one
// thing (a visible fight, a chest, a spring, an event, or a merchant shop), and ends in a
// single unlabelled exit, classic-RPG style: what the next room holds is a
// surprise. The last room's exit is the door to the chapter's unchanged
// hand-made boss stratum.
//
// generateRoom() emits a plain AreaDef (like rift.ts), so DescentScene draws
// it with the same tile code; the room-specific bits are the exit tile
// ('1' → AreaDef.doors), 'E' (a visible trash fight), '?' (an event), and 'M' (merchant shop).

import Phaser from 'phaser';
import { baseArea, type AreaDef, type ChestContents } from './chapters';
import { getEventForChapter } from './events';
import type { Combatant } from './types';

export type RoomKind = 'fight' | 'boon' | 'elite' | 'treasure' | 'spring' | 'event' | 'shop';

// A run crosses all six chapters, so each chapter is a short stretch:
// three rooms, then the boss stratum.
export const ROOMS_PER_CHAPTER = 3;

// Walking through a door restores a little: HP/MP carry over between fights
// (only town fully restores), and over five rooms in a row that attrition
// was steep. Small enough that Rest rooms and springs still matter.
export const ROOM_HEAL_HP = 0.15;
export const ROOM_HEAL_MP = 0.2;

/** Applies the between-room breather to living heroes (KO'd stay down). */
export function healBetweenRooms(party: Combatant[]): void {
  for (const c of party) {
    if (c.stats.hp <= 0) continue;
    c.stats.hp = Math.min(c.stats.maxHp, c.stats.hp + Math.round(c.stats.maxHp * ROOM_HEAL_HP));
    c.stats.mp = Math.min(c.stats.maxMp, c.stats.mp + Math.round(c.stats.maxMp * ROOM_HEAL_MP));
  }
}

/** Run-scoped progress through the current chapter's rooms (RunState.room). */
export interface RoomProgress {
  index: number; // 1-based
  kind: RoomKind;
  /** Combat rooms open their exit once their fight is won; others start open. */
  cleared: boolean;
  /** Tiles already used up in this room ('enc:x,y', 'chest:x,y', 'event:x,y'). */
  done: string[];
}

/** Per-kind name, blurb and colours. Exits no longer show these (the next
 *  room is a surprise); the tints still colour '?' events and the merchant. */
export const ROOM_INFO: Record<RoomKind, { label: string; hint: string; color: string; tint: number }> = {
  boon:     { label: '◆ Boon Fight',  hint: 'Win: pick 1 of 3 boons',      color: '#b8a8f8', tint: 0x8a6cf0 },
  fight:    { label: '$ Gold Fight',  hint: 'Win: bonus gold',             color: '#f0d36c', tint: 0xd8b040 },
  elite:    { label: '!! Elite',      hint: 'Hard fight, rare boon + XP',  color: '#ffa03c', tint: 0xff8800 },
  treasure: { label: '▣ Gear Chest',  hint: 'Elite guards a gear chest',   color: '#ffd27a', tint: 0xc08a30 },
  spring:   { label: '✚ Spring',      hint: 'No fight: heal the party',    color: '#9ae8ff', tint: 0x2a8ab8 },
  event:    { label: '? Mystery',     hint: 'No fight: a risky choice',    color: '#6cf0c2', tint: 0x3aa888 },
  shop:     { label: '◈ Merchant',    hint: 'No fight: spend your gold',   color: '#ffe066', tint: 0xe6b800 },
};

/** Combat rooms hold a visible fight that has to be won before the exit opens. */
export function isCombatRoom(kind: RoomKind): boolean {
  return kind === 'fight' || kind === 'boon' || kind === 'elite' || kind === 'treasure';
}

/** Gold purse for clearing a "$ Gold" room, on top of the fight's own gold. */
export function goldRoomPurse(chapter: number): number {
  return 20 + chapter * 10;
}

// Door odds. Blessings are the most common pull (boons now only come from
// these rooms and elites), elites only after the opening room.
const DOOR_WEIGHTS: Record<RoomKind, number> = {
  boon: 3, fight: 2, elite: 1.2, treasure: 1, shop: 1.1, spring: 1, event: 1.6,
};

/** The kind of the next room. Classic RPG flow: every room has exactly one
 *  exit (no door choices, no labels) and what lies behind it is a surprise.
 *  Returned as a one-element list (none: boss door instead). After a rest,
 *  event or shop the next room is always a fight, so a run can't skip its way
 *  to the boss under-levelled. */
export function rollDoors(index: number, rng: () => number = Math.random, currentKind?: RoomKind): RoomKind[] {
  if (index >= ROOMS_PER_CHAPTER) return [];
  const pool = (Object.keys(DOOR_WEIGHTS) as RoomKind[]).filter((k) => {
    if (k === 'elite' && index < 1) return false;
    // Shop appears only as rooms 2 to 4 (doors out of 1, 2, 3), and never twice in a row
    if (k === 'shop' && (index < 1 || index >= 4 || currentKind === 'shop')) return false;
    if (currentKind && !isCombatRoom(currentKind) && !isCombatRoom(k)) return false;
    if (k === currentKind && !isCombatRoom(k)) return false;
    return true;
  });
  const total = pool.reduce((sum, k) => sum + DOOR_WEIGHTS[k], 0);
  let roll = rng() * total;
  for (const k of pool) {
    roll -= DOOR_WEIGHTS[k];
    if (roll <= 0) return [k];
  }
  return [pool[pool.length - 1] ?? 'fight'];
}

const W = 24;
const H = 15;
const START = { x: 2, y: 7 };
const DOOR_COL = W - 2;

export interface RoomOptions {
  depth: number;       // the chapter's entrance stratum (odd depth)
  index: number;       // 1-based room number
  kind: RoomKind;
  /** A new game's very first fight uses the fixed teaching pair. */
  firstFight: boolean;
  /** Already-owned equipment ids, so treasure doesn't hand out a duplicate. */
  ownedEquipment: string[];
  /** Door/loot/current rolls; defaults to Math.random. Layout uses Phaser's RNG. */
  rng?: () => number;
}

/** Builds one room of a chapter's entrance run. */
export function generateRoom(opts: RoomOptions): AreaDef {
  const base = baseArea(opts.depth);
  const chapter = Math.ceil(opts.depth / 2);
  const doorKinds = rollDoors(opts.index, opts.rng, opts.kind);

  for (let attempt = 0; attempt < 40; attempt++) {
    const area = tryBuild(opts, base, chapter, doorKinds, attempt > 30);
    if (area) return area;
  }
  // Unreachable in practice (the open-floor fallback always connects).
  return tryBuild(opts, base, chapter, doorKinds, true)!;
}

function tryBuild(opts: RoomOptions, base: AreaDef, chapter: number, doorKinds: RoomKind[], bare: boolean): AreaDef | null {
  const grid: string[][] = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : '.')));
  const free = (x: number, y: number) => grid[y]?.[x] === '.';
  // Tiles that must stay plain floor: the spawn lane, and the door approach.
  const reserved = (x: number) => x <= 4 || x >= DOOR_COL - 1;

  if (!bare) {
    // Rock/pillar clusters so every room has a different shape.
    const clusters = Phaser.Math.Between(4, 7);
    for (let i = 0; i < clusters; i++) {
      const w = Phaser.Math.Between(1, 3);
      const h = Phaser.Math.Between(1, 3);
      const x0 = Phaser.Math.Between(5, DOOR_COL - 3 - w);
      const y0 = Phaser.Math.Between(1, H - 1 - h);
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) grid[y][x] = '#';
    }
  }

  // Spawn and the way home ('<' ends the run, same as before).
  grid[START.y][START.x] = 'P';
  grid[START.y][1] = '<';

  // One exit on the right wall's inner column; the final room's is the boss door.
  const doors: Record<string, string> = {};
  if (doorKinds.length === 0) {
    grid[7][DOOR_COL] = '>';
  } else {
    grid[7][DOOR_COL] = '1';
    doors[`${DOOR_COL},7`] = doorKinds[0];
  }

  // The room's one thing, placed in the middle band so it's on the way.
  const encounters: Record<string, string> = {};
  const chests: Record<string, ChestContents> = {};
  let eventId: string | undefined;
  const trash = Array.from(new Set(Object.values(base.encounters).filter((g) => g !== 'elite')));
  const pickSpot = (xMin: number, xMax: number): { x: number; y: number } | null => {
    const cells: { x: number; y: number }[] = [];
    for (let y = 2; y < H - 2; y++) for (let x = xMin; x <= xMax; x++) if (free(x, y) && !reserved(x)) cells.push({ x, y });
    return cells.length > 0 ? Phaser.Utils.Array.GetRandom(cells) : null;
  };

  if (isCombatRoom(opts.kind)) {
    // The first-ever fight sits a few steps from the spawn so a new player is
    // in battle within seconds; any other fight is mid-room.
    const spot = opts.firstFight ? { x: 6, y: START.y } : pickSpot(8, 15);
    if (!spot) return null;
    grid[spot.y][spot.x] = opts.kind === 'elite' ? 'X' : 'E';
    encounters[`${spot.x},${spot.y}`] = opts.firstFight ? 'first_fight'
      : opts.kind === 'elite' ? 'elite' : Phaser.Utils.Array.GetRandom(trash);
  }
  if (opts.kind === 'treasure') {
    // Guarded: the chest sits behind the fight, nearer the doors.
    const spot = pickSpot(16, DOOR_COL - 2);
    if (!spot) return null;
    grid[spot.y][spot.x] = 'T';
    chests[`${spot.x},${spot.y}`] = treasureFor(base, chapter, opts.ownedEquipment, opts.rng);
  }
  if (opts.kind === 'spring') {
    const spot = pickSpot(9, 14);
    if (!spot) return null;
    grid[spot.y][spot.x] = 'H';
  }
  if (opts.kind === 'event') {
    const spot = pickSpot(9, 14);
    if (!spot) return null;
    grid[spot.y][spot.x] = '?';
    eventId = getEventForChapter(chapter, opts.rng);
  }
  if (opts.kind === 'shop') {
    const spot = pickSpot(9, 14);
    if (!spot) return null;
    grid[spot.y][spot.x] = 'M';
  }

  // The chapter's field mechanic, sprinkled on open floor away from the
  // spawn/doors: same tiles and DescentScene behaviour as the hand-made maps.
  const teleports: Record<string, string> = {};
  const gusts: Record<string, 'up' | 'down' | 'left' | 'right'> = {};
  if (!bare) addFieldTiles(grid, base.theme.id, teleports, gusts, reserved, opts.rng);

  // Aether Caches: 2-3 interactive sparkling pickups per room on open floor
  const cacheCount = Phaser.Math.Between(2, 3);
  for (let i = 0; i < cacheCount; i++) {
    const spot = pickSpot(5, DOOR_COL - 2);
    if (spot && grid[spot.y][spot.x] === '.') {
      grid[spot.y][spot.x] = 'O';
    }
  }

  if (!connected(grid)) return null;

  return {
    id: `${base.id}_room${opts.index}`,
    name: `${base.name} · Room ${opts.index}/${ROOMS_PER_CHAPTER}`,
    theme: base.theme,
    encounters,
    scripts: {},
    chests,
    teleports,
    gusts,
    doors,
    eventId,
    map: grid.map((row) => row.join('')),
  };
}

/** The chapter's signature weapon (from its hand-made entrance chest) until
 *  owned, then gold plus a restorative. */
function treasureFor(base: AreaDef, chapter: number, owned: string[], rng: () => number = Math.random): ChestContents {
  const signature = Object.values(base.chests).find((c) => c.equipment && !owned.includes(c.equipment));
  if (signature) return { gold: 25 + chapter * 10, equipment: signature.equipment };
  return { gold: 45 + chapter * 15, items: { [rng() < 0.5 ? 'potion' : 'tonic']: 1 } };
}

function addFieldTiles(
  grid: string[][], themeId: string,
  teleports: Record<string, string>, gusts: Record<string, 'up' | 'down' | 'left' | 'right'>,
  reserved: (x: number) => boolean,
  rng: () => number = Math.random,
): void {
  const open = (): { x: number; y: number } | null => {
    for (let tries = 0; tries < 60; tries++) {
      const x = Phaser.Math.Between(5, DOOR_COL - 2);
      const y = Phaser.Math.Between(1, H - 2);
      if (grid[y][x] === '.' && !reserved(x)) return { x, y };
    }
    return null;
  };
  const scatter = (ch: string, n: number) => {
    for (let i = 0; i < n; i++) { const p = open(); if (p) grid[p.y][p.x] = ch; }
  };
  switch (themeId) {
    case 'forest': scatter('V', Phaser.Math.Between(5, 9)); break;      // thicket (cosmetic here: no random fights in rooms)
    case 'ashen': scatter('^', Phaser.Math.Between(6, 10)); break;      // embers: small HP cost to cross
    case 'sunken':
    case 'frost': {
      // Currents / icy slicks: short runs that sweep you along.
      for (let i = 0; i < 3; i++) {
        const p = open();
        if (!p) continue;
        const horizontal = rng() < 0.5;
        for (let k = 0; k < Phaser.Math.Between(2, 4); k++) {
          const x = p.x + (horizontal ? k : 0);
          const y = p.y + (horizontal ? 0 : k);
          if (grid[y]?.[x] === '.' && !reserved(x)) grid[y][x] = '~';
        }
      }
      break;
    }
    case 'crystal': {
      // Two linked prism-pad pairs.
      for (let i = 0; i < 2; i++) {
        const a = open();
        if (!a) continue;
        grid[a.y][a.x] = '*';
        const b = open();
        if (!b) { grid[a.y][a.x] = '.'; continue; }
        grid[b.y][b.x] = '*';
        teleports[`${a.x},${a.y}`] = `${b.x},${b.y}`;
        teleports[`${b.x},${b.y}`] = `${a.x},${a.y}`;
      }
      break;
    }
    case 'tempest': {
      const dirs = ['up', 'down', 'left', 'right'] as const;
      for (let i = 0; i < Phaser.Math.Between(4, 6); i++) {
        const p = open();
        if (!p) continue;
        grid[p.y][p.x] = 'G';
        gusts[`${p.x},${p.y}`] = Phaser.Utils.Array.GetRandom([...dirs]);
      }
      break;
    }
  }
}

/** Every non-wall tile reachable from the spawn (field tiles count as walkable). */
function connected(grid: string[][]): boolean {
  const seen = new Set<string>();
  const stack = [START];
  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    const key = `${x},${y}`;
    if (seen.has(key) || grid[y]?.[x] === undefined || grid[y][x] === '#') continue;
    seen.add(key);
    stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grid[y][x] !== '#' && !seen.has(`${x},${y}`)) return false;
  }
  return true;
}
