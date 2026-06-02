// Innhold: trylleformler, gjenstander, startparty og fiender for Stratum I.
// Holdt adskilt fra logikken slik at balansering/innhold kan endres ett sted.

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
  fire: { id: 'fire', name: 'Glød', cost: 4, kind: 'damage', power: 14, element: 'fire', target: 'enemy' },
  frost: { id: 'frost', name: 'Rim', cost: 5, kind: 'damage', power: 16, element: 'ice', target: 'enemy' },
  smite: { id: 'smite', name: 'Lysslag', cost: 6, kind: 'damage', power: 18, element: 'holy', target: 'enemy' },
  cure: { id: 'cure', name: 'Leg', cost: 4, kind: 'heal', power: 26, element: 'none', target: 'ally' },
};

export const ITEMS: Record<string, Item> = {
  potion: { id: 'potion', name: 'Eliksir', kind: 'heal', power: 30, target: 'ally' },
};

// Fargepalett for plassholder-sprites (byttes ut med kunst senere).
const C = {
  warrior: 0x6cf0c2,
  mage: 0x8a6cf0,
  cleric: 0xf0d36c,
  ghoul: 0x4a7a5a,
  sprite: 0x6c9cf0,
  crawler: 0x9a6a4a,
} as const;

/** Lager et ferskt party for en ny "run". HP/MP nullstilles her. */
export function makeParty(): Combatant[] {
  return [
    {
      id: 'kael', name: 'Kael', side: 'party', spriteKey: 'c_kael',
      color: C.warrior, size: 22, spells: [],
      stats: stats({ maxHp: 60, str: 14, agi: 8, vit: 10, int: 2 }),
    },
    {
      id: 'lyra', name: 'Lyra', side: 'party', spriteKey: 'c_lyra',
      color: C.mage, size: 20, spells: ['fire', 'frost'],
      stats: stats({ maxHp: 32, maxMp: 18, str: 6, agi: 11, vit: 5, int: 14 }),
    },
    {
      id: 'bram', name: 'Bram', side: 'party', spriteKey: 'c_bram',
      color: C.cleric, size: 21, spells: ['cure', 'smite'],
      stats: stats({ maxHp: 44, maxMp: 14, str: 9, agi: 7, vit: 8, int: 11 }),
    },
  ];
}

// Fiendemaler for Stratum I — Den Sunkne By (vannfarget tema).
interface EnemyTemplate {
  name: string;
  spriteKey: string;
  color: number;
  size: number;
  spells: string[];
  gold: number;
  stats: () => Stats;
}

const ENEMIES: EnemyTemplate[] = [
  {
    name: 'Drukneghoul', spriteKey: 'e_ghoul', color: C.ghoul, size: 24,
    spells: [], gold: 6,
    stats: () => stats({ maxHp: 30, str: 9, agi: 6, vit: 4, int: 1 }),
  },
  {
    name: 'Gjørmealv', spriteKey: 'e_sprite', color: C.sprite, size: 18,
    spells: ['fire'], gold: 9,
    stats: () => stats({ maxHp: 20, maxMp: 12, str: 6, agi: 12, vit: 3, int: 9 }),
  },
  {
    name: 'Tidekryper', spriteKey: 'e_crawler', color: C.crawler, size: 26,
    spells: [], gold: 7,
    stats: () => stats({ maxHp: 26, str: 8, agi: 7, vit: 6, int: 1 }),
  },
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Bygger en tilfeldig fiendegruppe (1–3) med unike kamp-id-er og navn. */
export function makeEncounter(): Combatant[] {
  const count = rand(1, 3);
  const group: Combatant[] = [];
  const labels = ['A', 'B', 'C'];
  for (let i = 0; i < count; i++) {
    const t = ENEMIES[rand(0, ENEMIES.length - 1)];
    const suffix = count > 1 ? ` ${labels[i]}` : '';
    group.push({
      id: `enemy_${i}`,
      name: t.name + suffix,
      side: 'enemy',
      spriteKey: t.spriteKey,
      color: t.color,
      size: t.size,
      spells: t.spells,
      goldReward: t.gold,
      stats: t.stats(),
    });
  }
  return group;
}
