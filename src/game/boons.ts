// Boons: run-scoped blessings chosen after won battles (the Hades model).
// They live on RunState and reset when the Anchor draws you home, so every
// descent builds differently. The battle engine reads them via boonTotals().

import type { Ailment, Element } from './types';

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
  sureInflict?: Ailment; // party hits that can apply this ailment always do
  dotMult?: number; // burn/venom ticks on enemies are multiplied by this
  healsCure?: boolean; // party healing spells also cure ailments
  // --- Synergy hooks: these read/react to other systems (ailments, break,
  // low HP, defend) rather than just multiplying a number, so they combine
  // with each other and with the boons above into real build identities. ---
  vulnerableBonus?: number; // afflicted enemies (any ailment) take this much more damage from everything
  spreadAilmentOnDeath?: boolean; // a dying enemy's Burn/Venom leaps to another living enemy
  hasMomentum?: boolean; // weakness hits stack a crit bonus for the rest of the battle
  breakInflictsChill?: boolean; // breaking an enemy also Chills it
  hasLastStand?: boolean; // bonus damage/crit for a hero below 30% HP
  hasGuardiansWrath?: boolean; // defending empowers the bearer's next action
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
    name: 'Vampiric Edge', desc: 'Physical damage heals the attacker for 25% of damage dealt.',
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
  anchors_promise: {
    id: 'anchors_promise', rarity: 'epic',
    name: "Anchor's Promise", desc: 'Once per battle, a fallen hero returns at 40% HP.',
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
  cleansing_light: {
    id: 'cleansing_light', rarity: 'common',
    name: 'Cleansing Light', desc: 'Healing spells also cure Burn, Chill and Venom.',
    healsCure: true,
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
  smoldering_ruin: {
    id: 'smoldering_ruin', rarity: 'epic',
    name: 'Smoldering Ruin', desc: 'Burn and Venom on enemies tick for double damage.',
    dotMult: 2,
  },

  // --- Synergy boons: each combines with several boons above instead of
  // standing alone (see Boon's synergy-hook fields for exactly how). ---
  vulnerable_flesh: {
    id: 'vulnerable_flesh', rarity: 'epic',
    name: 'Vulnerable Flesh',
    desc: 'Afflicted enemies (Burn, Chill, or Venom) take +20% damage from everything.',
    vulnerableBonus: 0.2,
  },
  spreading_rot: {
    id: 'spreading_rot', rarity: 'rare',
    name: 'Spreading Rot',
    desc: 'When a Burning or Poisoned enemy dies, the affliction leaps to another living enemy.',
    spreadAilmentOnDeath: true,
  },
  momentum: {
    id: 'momentum', rarity: 'rare',
    name: 'Momentum',
    desc: 'Weakness hits raise your crit chance by 10% for the rest of the battle (max +50%).',
    hasMomentum: true,
  },
  broken_chill: {
    id: 'broken_chill', rarity: 'rare',
    name: 'Broken Chill',
    desc: 'Breaking an enemy also Chills it.',
    breakInflictsChill: true,
  },
  last_stand: {
    id: 'last_stand', rarity: 'epic',
    name: 'Last Stand',
    desc: 'Below 30% HP, a hero deals +40% damage and gains +15% crit chance.',
    hasLastStand: true,
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
  sureInflict: Ailment[];
  dotMult: number;
  healsCure: boolean;
  vulnerableBonus: number;
  spreadAilmentOnDeath: boolean;
  hasMomentum: boolean;
  breakInflictsChill: boolean;
  hasLastStand: boolean;
  hasGuardiansWrath: boolean;
}

export function boonTotals(ids: string[]): BoonTotals {
  const t: BoonTotals = {
    dmgMult: 1, elementMult: {}, critBonus: 0, lifesteal: 0, mpRegen: 0,
    thorns: 0, goldMult: 1, xpMult: 1, defendHeal: 0, breakDmgBonus: 0,
    guardChipBonus: 0, potionBoost: 0, reviveOnce: false,
    sureInflict: [], dotMult: 1, healsCure: false,
    vulnerableBonus: 0, spreadAilmentOnDeath: false, hasMomentum: false,
    breakInflictsChill: false, hasLastStand: false, hasGuardiansWrath: false,
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
    if (b.sureInflict) t.sureInflict.push(b.sureInflict);
    if (b.dotMult) t.dotMult *= b.dotMult;
    if (b.healsCure) t.healsCure = true;
    if (b.vulnerableBonus) t.vulnerableBonus += b.vulnerableBonus;
    if (b.spreadAilmentOnDeath) t.spreadAilmentOnDeath = true;
    if (b.hasMomentum) t.hasMomentum = true;
    if (b.breakInflictsChill) t.breakInflictsChill = true;
    if (b.hasLastStand) t.hasLastStand = true;
    if (b.hasGuardiansWrath) t.hasGuardiansWrath = true;
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
