// Boons: run-scoped blessings chosen after won battles (the Hades model).
// They live on RunState and reset when the Anchor draws you home, so every
// descent builds differently. The battle engine reads them via boonTotals().
//
// Cut from 30 to 16 on 2026-10-17: kept the ones that play off weakness,
// break, ailments, Defend and each hero's element; dropped overlaps (two
// crit boons, two Defend boons, two MP boons) and flat stat bumps that don't
// change how you play. Ids missing from BOONS are ignored everywhere.

import type { Ailment, Element } from './types';

export type BoonRarity = 'common' | 'rare' | 'epic';

export interface Boon {
  id: string;
  name: string;
  desc: string;
  rarity: BoonRarity;
  // Effect hooks, read by the battle engine. Undefined = no effect.
  elementBoost?: { element: Element; mult: number };
  lifesteal?: number; // fraction of attack damage returned as HP
  mpRegen?: number; // MP restored to living party members each round
  goldMult?: number;
  breakDmgBonus?: number; // extra damage multiplier vs broken enemies
  guardChipBonus?: number; // extra guard pips removed on weakness hits
  reviveOnce?: boolean; // once per battle, a fallen hero returns at 40% HP
  sureInflict?: Ailment; // party hits that can apply this ailment always do
  // --- Synergy hooks: these read/react to other systems (ailments, weakness,
  // defend, kills) rather than just multiplying a number, so they combine
  // with each other and with the boons above into real build identities. ---
  vulnerableBonus?: number; // afflicted enemies (any ailment) take this much more damage from everything
  hasMomentum?: boolean; // weakness hits stack a crit bonus for the rest of the battle
  hasGuardiansWrath?: boolean; // defending empowers the bearer's next action
  executionHeal?: number; // fraction of max HP healed to the living party whenever an enemy dies
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
    elementBoost: { element: 'physical', mult: 1.3 },
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
  vampiric_edge: {
    id: 'vampiric_edge', rarity: 'rare',
    name: 'Vampiric Edge', desc: 'Physical damage heals the attacker for 25% of damage dealt.',
    lifesteal: 0.25,
  },
  shattering_force: {
    id: 'shattering_force', rarity: 'rare',
    name: 'Shattering Force', desc: 'Broken enemies take +50% extra damage.',
    breakDmgBonus: 0.5,
  },
  anchors_promise: {
    id: 'anchors_promise', rarity: 'epic',
    name: "Anchor's Promise", desc: 'Once per battle, a fallen hero returns at 40% HP.',
    reviveOnce: true,
  },
  perfect_break: {
    id: 'perfect_break', rarity: 'epic',
    name: 'Perfect Break', desc: 'Weakness hits remove 2 guard pips instead of 1.',
    guardChipBonus: 1,
  },
  kindling_soul: {
    id: 'kindling_soul', rarity: 'rare',
    name: 'Kindling Soul', desc: 'Fire hits always Burn the target.',
    sureInflict: 'burn',
  },
  winters_grasp: {
    id: 'winters_grasp', rarity: 'rare',
    name: "Winter's Grasp", desc: 'Ice hits always Chill the target.',
    sureInflict: 'chill',
  },

  // --- Synergy boons: each combines with several boons above instead of
  // standing alone (see Boon's synergy-hook fields for exactly how). ---
  vulnerable_flesh: {
    id: 'vulnerable_flesh', rarity: 'epic',
    name: 'Vulnerable Flesh',
    desc: 'Afflicted enemies (Burn, Chill, or Venom) take +20% damage from everything.',
    vulnerableBonus: 0.2,
  },
  momentum: {
    id: 'momentum', rarity: 'rare',
    name: 'Momentum',
    desc: 'Weakness hits raise your crit chance by 10% for the rest of the battle (max +50%).',
    hasMomentum: true,
  },
  reapers_bargain: {
    id: 'reapers_bargain', rarity: 'epic',
    name: "Reaper's Bargain",
    desc: 'Whenever an enemy falls, the living party heals for 8% of their max HP.',
    executionHeal: 0.08,
  },
  guardians_wrath: {
    id: 'guardians_wrath', rarity: 'rare',
    name: "Guardian's Wrath",
    desc: 'Defending empowers your next action: +30% damage.',
    hasGuardiansWrath: true,
  },
};

/** Aggregated boon effects for quick reads in damage formulas. */
export interface BoonTotals {
  elementMult: Partial<Record<Element, number>>;
  lifesteal: number;
  mpRegen: number;
  goldMult: number;
  breakDmgBonus: number;
  guardChipBonus: number;
  reviveOnce: boolean;
  sureInflict: Ailment[];
  vulnerableBonus: number;
  hasMomentum: boolean;
  hasGuardiansWrath: boolean;
  executionHeal: number;
}

export function boonTotals(ids: string[]): BoonTotals {
  const t: BoonTotals = {
    elementMult: {}, lifesteal: 0, mpRegen: 0, goldMult: 1, breakDmgBonus: 0,
    guardChipBonus: 0, reviveOnce: false, sureInflict: [],
    vulnerableBonus: 0, hasMomentum: false, hasGuardiansWrath: false,
    executionHeal: 0,
  };
  for (const id of ids) {
    const b = BOONS[id];
    if (!b) continue;
    if (b.elementBoost) {
      const cur = t.elementMult[b.elementBoost.element] ?? 1;
      t.elementMult[b.elementBoost.element] = cur * b.elementBoost.mult;
    }
    if (b.lifesteal) t.lifesteal += b.lifesteal;
    if (b.mpRegen) t.mpRegen += b.mpRegen;
    if (b.goldMult) t.goldMult *= b.goldMult;
    if (b.breakDmgBonus) t.breakDmgBonus += b.breakDmgBonus;
    if (b.guardChipBonus) t.guardChipBonus += b.guardChipBonus;
    if (b.reviveOnce) t.reviveOnce = true;
    if (b.sureInflict) t.sureInflict.push(b.sureInflict);
    if (b.vulnerableBonus) t.vulnerableBonus += b.vulnerableBonus;
    if (b.hasMomentum) t.hasMomentum = true;
    if (b.hasGuardiansWrath) t.hasGuardiansWrath = true;
    if (b.executionHeal) t.executionHeal += b.executionHeal;
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
