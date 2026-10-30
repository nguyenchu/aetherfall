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
type RoomKind = import('./rooms').RoomKind;

/** Replays the given values, then repeats the last one. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('rollDoors', () => {
  it('offers no doors out of the last room (boss door instead)', () => {
    expect(rollDoors(ROOMS_PER_CHAPTER, () => 0)).toEqual([]);
  });

  it('first rng picks two or three doors', () => {
    expect(rollDoors(2, seq(0.1, 0))).toHaveLength(2);
    expect(rollDoors(2, seq(0.9, 0))).toHaveLength(3);
  });

  it('picks by weight without repeating a kind', () => {
    // Pool order is boon, fight, elite, treasure, spring, event; a roll of 0
    // always takes the first kind still in the pool.
    expect(rollDoors(2, seq(0.9, 0))).toEqual(['boon', 'fight', 'elite']);
  });

  it('never offers an elite out of the opening room', () => {
    for (let i = 0; i < 200; i++) expect(rollDoors(0)).not.toContain('elite');
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
    const a = hero(50, 10);
    const b = hero(95, 48);
    healBetweenRooms([a, b]);
    expect(a.stats).toMatchObject({ hp: 65, mp: 20 });
    expect(b.stats).toMatchObject({ hp: 100, mp: 50 });
  });

  it('leaves KO\'d heroes down', () => {
    const ko = hero(0, 0);
    healBetweenRooms([ko]);
    expect(ko.stats).toMatchObject({ hp: 0, mp: 0 });
  });
});

describe('generateRoom', () => {
  const KINDS: RoomKind[] = ['fight', 'boon', 'elite', 'treasure', 'spring', 'event'];
  const DEPTHS = [1, 3, 5, 7, 9, 11];

  function reachableFromSpawn(map: string[]): boolean {
    const start = map.findIndex((row) => row.includes('P'));
    const seen = new Set<string>();
    const stack = [{ x: map[start].indexOf('P'), y: start }];
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const key = `${x},${y}`;
      if (seen.has(key) || map[y]?.[x] === undefined || map[y][x] === '#') continue;
      seen.add(key);
      stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
    }
    return map.every((row, y) => [...row].every((ch, x) => ch === '#' || seen.has(`${x},${y}`)));
  }

  it('builds a walled, fully connected room for every chapter and kind', () => {
    for (const depth of DEPTHS) {
      for (const kind of KINDS) {
        for (let i = 0; i < 10; i++) {
          const room = generateRoom({ depth, index: 2, kind, firstFight: false, ownedEquipment: [] });
          expect(room.map).toHaveLength(15);
          expect(room.map.every((row) => row.length === 24)).toBe(true);
          expect(room.map[0]).toBe('#'.repeat(24));
          expect(reachableFromSpawn(room.map)).toBe(true);
        }
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
