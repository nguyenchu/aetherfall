import { describe, expect, it, vi } from 'vitest';
import type { Combatant } from './types';

// rooms.ts only needs Phaser's random helpers; the real package wants a
// browser, so tests get a plain-JS stand-in.
vi.mock('phaser', () => ({
  default: {
    Math: { Between: (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1)) },
    Utils: { Array: { GetRandom: <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)] } },
  },
}));

const { ROOMS_PER_CHAPTER, generateRoom, healBetweenRooms, isCombatRoom, rollDoors } = await import('./rooms');
const { getEventForChapter, CHAPTER_EVENTS } = await import('./events');
type RoomKind = import('./rooms').RoomKind;

/** Replays the given values, then repeats the last one. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('rollDoors', () => {
  it('offers no doors out of the last room (boss door instead)', () => {
    expect(rollDoors(ROOMS_PER_CHAPTER, () => 0)).toEqual([]);
    expect(rollDoors(ROOMS_PER_CHAPTER + 1, () => 0)).toEqual([]);
  });

  it('first rng picks two or three doors', () => {
    // < 0.5 rolls 2 doors, >= 0.5 rolls 3
    expect(rollDoors(2, seq(0.1, 0))).toHaveLength(2);
    expect(rollDoors(2, seq(0.9, 0))).toHaveLength(3);
  });

  it('picks by weight without repeating a kind', () => {
    // 0.9 rolls 3 doors; subsequent 0s take the first candidate from the pool
    // each time, which walks the keys in order (boon, fight, elite).
    expect(rollDoors(2, seq(0.9, 0))).toEqual(['boon', 'fight', 'elite']);
  });

  it('never offers an elite out of the opening room', () => {
    for (let i = 0; i < 200; i++) expect(rollDoors(0)).not.toContain('elite');
  });

  it('never offers a shop out of the opening room or room 4', () => {
    for (let i = 0; i < 200; i++) {
      expect(rollDoors(0)).not.toContain('shop');
      expect(rollDoors(4)).not.toContain('shop');
    }
  });

  it('never offers shop when current room is shop', () => {
    for (let i = 0; i < 200; i++) {
      expect(rollDoors(2, Math.random, 'shop')).not.toContain('shop');
    }
  });

  it('always offers at least one combat door', () => {
    for (let index = 0; index < ROOMS_PER_CHAPTER; index++) {
      for (let i = 0; i < 200; i++) {
        const doors = rollDoors(index);
        expect(doors.some(isCombatRoom)).toBe(true);
        expect(new Set(doors).size).toBe(doors.length);
      }
    }
  });

  it('swaps the last door for a blessing when every pick was non-combat', () => {
    // Rolls landing near the top of the pool take event, then spring.
    expect(rollDoors(2, seq(0.1, 0.999, 0.999))).toEqual(['event', 'boon']);
  });
});

describe('healBetweenRooms', () => {
  function hero(hp: number, mp: number): Combatant {
    return {
      id: 'h', name: 'Hero', side: 'party', spriteKey: 'h', color: 0, size: 32, spells: [],
      stats: { maxHp: 100, hp, maxMp: 50, mp, str: 1, agi: 1, vit: 1, int: 1 },
    };
  }

  it('restores 15% HP and 20% MP, capped at max', () => {
    const party = [hero(40, 5)];
    healBetweenRooms(party);
    expect(party[0].stats.hp).toBe(55); // 40 + 15
    expect(party[0].stats.mp).toBe(15); // 5 + 10
  });

  it('leaves KO\'d heroes down', () => {
    const party = [hero(0, 0)];
    healBetweenRooms(party);
    expect(party[0].stats.hp).toBe(0);
    expect(party[0].stats.mp).toBe(0);
  });
});

describe('generateRoom', () => {
  const KINDS: RoomKind[] = ['fight', 'boon', 'elite', 'treasure', 'spring', 'event', 'shop'];

  it('builds a walled, fully connected room for every chapter and kind', () => {
    // All 6 entrance depths (1, 3, 5, 7, 9, 11) × 7 kinds.
    for (let ch = 1; ch <= 6; ch++) {
      const depth = ch * 2 - 1;
      for (const kind of KINDS) {
        const room = generateRoom({ depth, index: 2, kind, firstFight: false, ownedEquipment: [] });
        const grid = room.map;
        expect(grid).toHaveLength(15);
        expect(grid[0]).toHaveLength(24);
        // Outer border is walls except for '<' on the left and doors on the right.
        for (let x = 0; x < 24; x++) {
          expect(grid[0][x]).toBe('#');
          expect(grid[14][x]).toBe('#');
        }
        for (let y = 0; y < 15; y++) {
          expect(grid[y][0]).toBe('#');
          expect(grid[y][23]).toBe('#');
        }
        // Player spawn and way home are in place.
        expect(grid[7][2]).toBe('P');
        expect(grid[7][1]).toBe('<');
      }
    }
  });

  it('places the one thing the room holds', () => {
    const tile = (kind: RoomKind) =>
      generateRoom({ depth: 1, index: 2, kind, firstFight: false, ownedEquipment: [] }).map.join('');
    expect(tile('fight')).toContain('E');
    expect(tile('elite')).toContain('X');
    expect(tile('treasure')).toContain('E');
    expect(tile('treasure')).toContain('T');
    expect(tile('spring')).toContain('H');
    expect(tile('event')).toContain('?');
    expect(tile('shop')).toContain('M');
  });

  it('records the encounter, chest and event for the room kind', () => {
    const elite = generateRoom({ depth: 3, index: 2, kind: 'elite', firstFight: false, ownedEquipment: [] });
    expect(Object.values(elite.encounters)).toEqual(['elite']);
    const event = generateRoom({ depth: 3, index: 2, kind: 'event', firstFight: false, ownedEquipment: [] });
    expect(event.eventId).toBeTruthy();
    expect(Object.keys(event.encounters)).toHaveLength(0);
    const treasure = generateRoom({ depth: 3, index: 2, kind: 'treasure', firstFight: false, ownedEquipment: [] });
    expect(Object.values(treasure.chests)).toHaveLength(1);
  });

  it('puts a new game\'s first fight right next to the spawn', () => {
    const room = generateRoom({ depth: 1, index: 1, kind: 'fight', firstFight: true, ownedEquipment: [] });
    expect(room.encounters['6,7']).toBe('first_fight');
  });

  it('numbers the doors and maps them to the rolled kinds', () => {
    const room = generateRoom({ depth: 1, index: 2, kind: 'spring', firstFight: false, ownedEquipment: [], rng: seq(0.9, 0) });
    expect(Object.values(room.doors ?? {})).toEqual(['boon', 'fight', 'elite']);
    for (const [pos, n] of [['22,3', '1'], ['22,7', '2'], ['22,11', '3']] as const) {
      const [x, y] = pos.split(',').map(Number);
      expect(room.map[y][x]).toBe(n);
    }
  });

  it('ends the chapter with a single boss door', () => {
    const room = generateRoom({ depth: 1, index: ROOMS_PER_CHAPTER, kind: 'fight', firstFight: false, ownedEquipment: [] });
    expect(room.map[7][22]).toBe('>');
    expect(room.doors).toEqual({});
  });
});

describe('getEventForChapter', () => {
  it('returns chapter specific event when rng < 0.65', () => {
    for (let ch = 1; ch <= 6; ch++) {
      expect(getEventForChapter(ch, () => 0.2)).toBe(CHAPTER_EVENTS[ch]);
    }
  });

  it('returns base event when rng >= 0.65', () => {
    const event = getEventForChapter(1, () => 0.8);
    expect(['altar', 'merchant', 'bound_chest', 'aether_pool', 'gambler']).toContain(event);
  });
});
