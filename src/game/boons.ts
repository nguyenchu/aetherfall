// Boons: run-scoped blessings chosen after won battles (the Hades model).
// They live on RunState and reset when the Crystal draws you home, so every
// descent builds differently. The battle engine reads them via boonTotals().

import type { Element } from './types';

export type BoonRarity = 'common' | 'rare' | 'epic';

export interface Boon {
  id: string;
  name: string;
  desc: string;
  rarity: BoonRarity;
  // Effect hooks, read by the battle engine. Undefined = no effect.
  dmgMult?: number; // multiplies all damage dealt by the party
  elementBoost?: { element: Element; mult: number };
  critBonus?: number; // added to base crit chance
  lifesteal?: number; // fraction of attack damage returned as HP
  mpRegen?: number; // MP restored to living party members each round
  thorns?: number; // fraction of damage taken reflected to the attacker
  goldMult?: number;
  xpMult?: number;
  defendHeal?: number; // HP healed when defending
  breakDmgBonus?: number; // extra damage multiplier vs broken enemies
  guardChipBonus?: number; // extra guard pips removed on weakness hits
  potionBoost?: number; // items heal this fraction more
  reviveOnce?: boolean; // once per battle, a fallen hero returns at 40% HP
}

export const BOONS: Record<string, Boon> = {
  ember_affinity: {
    id: 'ember_affinity', rarity: 'common',
    name: 'Ember Affinity', desc: 'Fire damage +40%.',
    elementBoost: { element: 'fire', mult: 1.4 },
  },
  frost_affinity: {
    id: 'frost_affinity', rarity: 'common',
    name: 'Frost Affinity', desc: 'Ice damage +40%.',
    elementBoost: { element: 'ice', mult: 1.4 },
  },
  radiant_affinity: {
    id: 'radiant_affinity', rarity: 'common',
    name: 'Radiant Affinity', desc: 'Holy damage +40%.',
    elementBoost: { element: 'holy', mult: 1.4 },
  },
  keen_edge: {
    id: 'keen_edge', rarity: 'common',
    name: 'Keen Edge', desc: 'Physical damage +30%.',
    elementBoost: { element: 'phys', mult: 1.3 },
  },
  aether_flow: {
    id: 'aether_flow', rarity: 'common',
    name: 'Aether Flow', desc: 'The party regains 2 MP every round.',
    mpRegen: 2,
  },
  battle_greed: {
    id: 'battle_greed', rarity: 'common',
    name: 'Battle Greed', desc: 'Battles yield +40% gold.',
    goldMult: 1.4,
  },
  scholars_eye: {
    id: 'scholars_eye', rarity: 'common',
    name: "Scholar's Eye", desc: 'Battles yield +30% XP.',
    xpMult: 1.3,
  },
  iron_bulwark: {
    id: 'iron_bulwark', rarity: 'common',
    name: 'Iron Bulwark', desc: 'Defending also heals 12 HP.',
    defendHeal: 12,
  },
  vampiric_edge: {
    id: 'vampiric_edge', rarity: 'rare',
    name: 'Vampiric Edge', desc: 'Attacks heal the attacker for 25% of damage dealt.',
    lifesteal: 0.25,
  },
  deadly_precision: {
    id: 'deadly_precision', rarity: 'rare',
    name: 'Deadly Precision', desc: 'Critical hit chance +15%.',
    critBonus: 0.15,
  },
  shattering_force: {
    id: 'shattering_force', rarity: 'rare',
    name: 'Shattering Force', desc: 'Broken enemies take +50% extra damage.',
    breakDmgBonus: 0.5,
  },
  thorn_pact: {
    id: 'thorn_pact', rarity: 'rare',
    name: 'Thorn Pact', desc: 'Reflect 25% of damage taken back at the attacker.',
    thorns: 0.25,
  },
  deep_pockets: {
    id: 'deep_pockets', rarity: 'rare',
    name: 'Deep Pockets', desc: 'Items restore 60% more.',
    potionBoost: 0.6,
  },
  crystal_promise: {
    id: 'crystal_promise', rarity: 'epic',
    name: 'Crystal Promise', desc: 'Once per battle, a fallen hero returns at 40% HP.',
    reviveOnce: true,
  },
  overwhelming_power: {
    id: 'overwhelming_power', rarity: 'epic',
    name: 'Overwhelming Power', desc: 'All damage dealt +25%.',
    dmgMult: 1.25,
  },
  perfect_break: {
    id: 'perfect_break', rarity: 'epic',
    name: 'Perfect Break', desc: 'Weakness hits remove 2 guard pips instead of 1.',
    guardChipBonus: 1,
  },
};

/** Aggregated boon effects for quick reads in damage formulas. */
export interface BoonTotals {
  dmgMult: number;
  elementMult: Partial<Record<Element, number>>;
  critBonus: number;
  lifesteal: number;
  mpRegen: number;
  thorns: number;
  goldMult: number;
  xpMult: number;
  defendHeal: number;
  breakDmgBonus: number;
  guardChipBonus: number;
  potionBoost: number;
  reviveOnce: boolean;
}

export function boonTotals(ids: string[]): BoonTotals {
  const t: BoonTotals = {
    dmgMult: 1, elementMult: {}, critBonus: 0, lifesteal: 0, mpRegen: 0,
    thorns: 0, goldMult: 1, xpMult: 1, defendHeal: 0, breakDmgBonus: 0,
    guardChipBonus: 0, potionBoost: 0, reviveOnce: false,
  };
  for (const id of ids) {
    const b = BOONS[id];
    if (!b) continue;
    if (b.dmgMult) t.dmgMult *= b.dmgMult;
    if (b.elementBoost) {
      const cur = t.elementMult[b.elementBoost.element] ?? 1;
      t.elementMult[b.elementBoost.element] = cur * b.elementBoost.mult;
    }
    if (b.critBonus) t.critBonus += b.critBonus;
    if (b.lifesteal) t.lifesteal += b.lifesteal;
    if (b.mpRegen) t.mpRegen += b.mpRegen;
    if (b.thorns) t.thorns += b.thorns;
    if (b.goldMult) t.goldMult *= b.goldMult;
    if (b.xpMult) t.xpMult *= b.xpMult;
    if (b.defendHeal) t.defendHeal += b.defendHeal;
    if (b.breakDmgBonus) t.breakDmgBonus += b.breakDmgBonus;
    if (b.guardChipBonus) t.guardChipBonus += b.guardChipBonus;
    if (b.potionBoost) t.potionBoost += b.potionBoost;
    if (b.reviveOnce) t.reviveOnce = true;
  }
  return t;
}

const RARITY_COLOR: Record<BoonRarity, string> = {
  common: '#9aa3c8',
  rare: '#6cb8ff',
  epic: '#c07aff',
};

export function rarityColor(r: BoonRarity): string {
  return RARITY_COLOR[r];
}

/**
 * Rolls three distinct boon choices, excluding already-owned ones.
 * Elite and boss fights weight the roll heavily toward rare/epic.
 */
export function rollBoonChoices(owned: string[], elite = false, count = 3): Boon[] {
  const pool = Object.values(BOONS).filter((b) => !owned.includes(b.id));
  const weight = (b: Boon): number => {
    if (elite) return b.rarity === 'epic' ? 6 : b.rarity === 'rare' ? 4 : 1;
    return b.rarity === 'epic' ? 1 : b.rarity === 'rare' ? 3 : 6;
  };
  const picks: Boon[] = [];
  const candidates = [...pool];
  while (picks.length < count && candidates.length > 0) {
    const total = candidates.reduce((sum, b) => sum + weight(b), 0);
    let roll = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weight(candidates[i]);
      if (roll <= 0) { idx = i; break; }
    }
    picks.push(candidates[idx]);
    candidates.splice(idx, 1);
  }
  return picks;
}
