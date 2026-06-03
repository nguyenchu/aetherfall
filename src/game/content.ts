// Content: spells, items, starting party, and Stratum I enemies.
// Kept separate from logic so balancing and content can be changed in one place.

import type { Combatant, Item, Spell, Stats } from './types';

function stats(s: Partial<Stats> & Pick<Stats, 'maxHp' | 'str' | 'agi' | 'vit' | 'int'>): Stats {
  const maxMp = s.maxMp ?? 0;
  return {
    maxHp: s.maxHp,
    hp: s.hp ?? s.maxHp,
    maxMp,
    mp: s.mp ?? maxMp,
    str: s.str,
    agi: s.agi,
    vit: s.vit,
    int: s.int,
  };
}

export const SPELLS: Record<string, Spell> = {
  fire: { id: 'fire', name: 'Ember', cost: 4, kind: 'damage', power: 14, element: 'fire', target: 'enemy' },
  frost: { id: 'frost', name: 'Rime', cost: 5, kind: 'damage', power: 16, element: 'ice', target: 'enemy' },
  smite: { id: 'smite', name: 'Lightstrike', cost: 6, kind: 'damage', power: 18, element: 'holy', target: 'enemy' },
  cure: { id: 'cure', name: 'Mend', cost: 4, kind: 'heal', power: 26, element: 'none', target: 'ally' },
};

export const ITEMS: Record<string, Item> = {
  potion: {
    id: 'potion',
    name: 'Elixir',
    kind: 'heal',
    power: 30,
    target: 'ally',
    buyPrice: 15,
    sellPrice: 7,
    description: 'Restores 30 HP.',
  },
  tonic: {
    id: 'tonic',
    name: 'Aether Tonic',
    kind: 'mp',
    power: 12,
    target: 'ally',
    buyPrice: 22,
    sellPrice: 11,
    description: 'Restores 12 MP.',
  },
  tide_pearl: {
    id: 'tide_pearl',
    name: 'Tide Pearl',
    kind: 'sell',
    power: 0,
    target: 'none',
    sellPrice: 12,
    description: 'A damp pearl merchants will buy.',
  },
  warden_sigils: {
    id: 'warden_sigils',
    name: 'Warden Sigils',
    kind: 'sell',
    power: 0,
    target: 'none',
    sellPrice: 28,
    description: 'Old city marks worth selling.',
  },
};

// Color palette for placeholder sprites, ready to be replaced by art later.
const C = {
  warrior: 0x6cf0c2,
  mage: 0x8a6cf0,
  cleric: 0xf0d36c,
  ghoul: 0x4a7a5a,
  sprite: 0x6c9cf0,
  crawler: 0x9a6a4a,
  warden: 0x7a8a9a,
  boss: 0x3a5a8a,
} as const;

/** Creates a fresh level 1 party. Saved levels are restored later. */
export function makeParty(): Combatant[] {
  return [
    {
      id: 'kael', name: 'Kael', side: 'party', spriteKey: 'c_kael',
      color: C.warrior, size: 22, spells: [], level: 1, xp: 0,
      stats: stats({ maxHp: 60, str: 14, agi: 8, vit: 10, int: 2 }),
      growth: { maxHp: 10, str: 2, vit: 2, agi: 1 },
    },
    {
      id: 'lyra', name: 'Lyra', side: 'party', spriteKey: 'c_lyra',
      color: C.mage, size: 20, spells: ['fire', 'frost'], level: 1, xp: 0,
      stats: stats({ maxHp: 32, maxMp: 18, str: 6, agi: 11, vit: 5, int: 14 }),
      growth: { maxHp: 5, maxMp: 4, int: 2, agi: 1, str: 1 },
    },
    {
      id: 'mira', name: 'Mira', side: 'party', spriteKey: 'c_mira',
      color: C.cleric, size: 21, spells: ['cure', 'smite'], level: 1, xp: 0,
      stats: stats({ maxHp: 44, maxMp: 14, str: 9, agi: 7, vit: 8, int: 11 }),
      growth: { maxHp: 7, maxMp: 3, int: 2, str: 1, vit: 1, agi: 1 },
    },
  ];
}

// Enemy templates for Stratum I - The Sunken City.
interface EnemyTemplate {
  name: string;
  spriteKey: string;
  color: number;
  size: number;
  spells: string[];
  gold: number;
  xp: number;
  stats: () => Stats;
}

const ENEMIES: EnemyTemplate[] = [
  {
    name: 'Drowned Ghoul', spriteKey: 'e_ghoul', color: C.ghoul, size: 24,
    spells: [], gold: 6, xp: 8,
    stats: () => stats({ maxHp: 30, str: 9, agi: 6, vit: 4, int: 1 }),
  },
  {
    name: 'Mire Sprite', spriteKey: 'e_sprite', color: C.sprite, size: 18,
    spells: ['fire'], gold: 9, xp: 11,
    stats: () => stats({ maxHp: 20, maxMp: 12, str: 6, agi: 12, vit: 3, int: 9 }),
  },
  {
    name: 'Tide Crawler', spriteKey: 'e_crawler', color: C.crawler, size: 26,
    spells: [], gold: 7, xp: 9,
    stats: () => stats({ maxHp: 26, str: 8, agi: 7, vit: 6, int: 1 }),
  },
  {
    name: 'Sunken Warden', spriteKey: 'e_warden', color: C.warden, size: 26,
    spells: [], gold: 12, xp: 14,
    stats: () => stats({ maxHp: 46, str: 12, agi: 5, vit: 9, int: 2 }),
  },
];

const BOSS: EnemyTemplate = {
  name: 'Leviathan of the Deep', spriteKey: 'e_leviathan', color: C.boss, size: 40,
  spells: ['frost'], gold: 80, xp: 120,
  stats: () => stats({ maxHp: 240, maxMp: 30, str: 16, agi: 8, vit: 10, int: 14 }),
};

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Scales enemy stats by depth so lower strata grow tougher. */
function scaleStats(s: Stats, depth: number): Stats {
  const f = 1 + (depth - 1) * 0.22;
  return {
    ...s,
    maxHp: Math.round(s.maxHp * f), hp: Math.round(s.maxHp * f),
    str: Math.round(s.str * f), vit: Math.round(s.vit * f),
    int: Math.round(s.int * f), agi: s.agi,
  };
}

function instantiate(t: EnemyTemplate, id: string, name: string, depth: number, isBoss = false): Combatant {
  return {
    id, name, side: 'enemy', spriteKey: t.spriteKey, color: t.color, size: t.size,
    spells: t.spells, goldReward: Math.round(t.gold * (1 + (depth - 1) * 0.2)),
    xpReward: Math.round(t.xp * (1 + (depth - 1) * 0.2)), isBoss,
    stats: scaleStats(t.stats(), depth),
  };
}

/** Builds a random enemy group (1-3), scaled by depth. */
export function makeEncounter(depth = 1): Combatant[] {
  const count = rand(1, 3);
  const labels = ['A', 'B', 'C'];
  const group: Combatant[] = [];
  for (let i = 0; i < count; i++) {
    const t = ENEMIES[rand(0, ENEMIES.length - 1)];
    const suffix = count > 1 ? ` ${labels[i]}` : '';
    group.push(instantiate(t, `enemy_${i}`, t.name + suffix, depth));
  }
  return group;
}

/** Boss battle at the bottom of a stratum. */
export function makeBoss(depth = 1): Combatant[] {
  return [instantiate(BOSS, 'boss', BOSS.name, depth, true)];
}
