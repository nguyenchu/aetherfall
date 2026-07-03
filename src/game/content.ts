// Content: spells, items, and the starting party.
// Kept separate from logic so balancing and content can be changed in one place.
// Enemies live in chapters.ts next to the areas they appear in.

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
  // Lyra — black mage
  fire: {
    id: 'fire', name: 'Ember', cost: 4, kind: 'damage', power: 14,
    element: 'fire', target: 'enemy', desc: 'Fire damage to one enemy.',
  },
  frost: {
    id: 'frost', name: 'Rime', cost: 5, kind: 'damage', power: 16,
    element: 'ice', target: 'enemy', desc: 'Ice damage to one enemy.',
  },
  firewave: {
    id: 'firewave', name: 'Emberstorm', cost: 9, kind: 'damage', power: 11,
    element: 'fire', target: 'all-enemies', desc: 'Fire damage to all enemies.',
  },
  blizzard: {
    id: 'blizzard', name: 'Blizzard', cost: 12, kind: 'damage', power: 14,
    element: 'ice', target: 'all-enemies', desc: 'Ice damage to all enemies.',
  },
  // Mira — cleric
  smite: {
    id: 'smite', name: 'Lightstrike', cost: 6, kind: 'damage', power: 18,
    element: 'holy', target: 'enemy', desc: 'Holy damage to one enemy.',
  },
  cure: {
    id: 'cure', name: 'Mend', cost: 4, kind: 'heal', power: 26,
    element: 'none', target: 'ally', desc: 'Heals one ally.',
  },
  cureall: {
    id: 'cureall', name: 'Radiance', cost: 9, kind: 'heal', power: 16,
    element: 'none', target: 'party', desc: 'Heals the whole party.',
  },
  // Kael — vanguard skills (uses a small stamina pool shown as MP)
  bash: {
    id: 'bash', name: 'Crush', cost: 3, kind: 'damage', power: 18,
    element: 'phys', target: 'enemy', guardHit: 1,
    desc: 'Heavy blow. Always chips 1 guard pip.',
  },
  cleave: {
    id: 'cleave', name: 'Cleave', cost: 4, kind: 'damage', power: 9,
    element: 'phys', target: 'all-enemies', desc: 'Sweeping strike on all enemies.',
  },
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
} as const;

/** Creates a fresh level 1 party. Saved levels are restored later. */
export function makeParty(): Combatant[] {
  return [
    {
      id: 'kael', name: 'Kael', side: 'party', spriteKey: 'c_kael',
      color: C.warrior, size: 22, spells: [], level: 1, xp: 0,
      stats: stats({ maxHp: 60, maxMp: 8, str: 14, agi: 8, vit: 10, int: 2 }),
      growth: { maxHp: 10, maxMp: 2, str: 2, vit: 2, agi: 1 },
      learnset: { 2: ['bash'], 4: ['cleave'] },
    },
    {
      id: 'lyra', name: 'Lyra', side: 'party', spriteKey: 'c_lyra',
      color: C.mage, size: 20, spells: ['fire', 'frost'], level: 1, xp: 0,
      stats: stats({ maxHp: 32, maxMp: 18, str: 6, agi: 11, vit: 5, int: 14 }),
      growth: { maxHp: 5, maxMp: 4, int: 2, agi: 1, str: 1 },
      learnset: { 4: ['firewave'], 7: ['blizzard'] },
    },
    {
      id: 'mira', name: 'Mira', side: 'party', spriteKey: 'c_mira',
      color: C.cleric, size: 21, spells: ['cure', 'smite'], level: 1, xp: 0,
      stats: stats({ maxHp: 44, maxMp: 14, str: 9, agi: 7, vit: 8, int: 11 }),
      growth: { maxHp: 7, maxMp: 3, int: 2, str: 1, vit: 1, agi: 1 },
      learnset: { 5: ['cureall'] },
    },
  ];
}
