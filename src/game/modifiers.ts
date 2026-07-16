// Run modifiers — one is chosen at random each descent.
// Applied in battle (damage/XP/MP) and in DescentScene (HP drain).

export interface RunModifier {
  id: string;
  name: string;
  desc: string;
  color: string;
  // Optional multipliers — undefined means no effect.
  xpMult?: number;
  goldMult?: number;
  startHpFactor?: number;  // Party starts descent at this fraction of maxHp
  hpDrainPerStep?: number; // HP lost by whole party per dungeon step
  dmgMult?: number;        // Party damage multiplier
  dmgTakenMult?: number;   // Damage party takes multiplier
  spellCostDelta?: number; // Added to all spell MP costs (negative = cheaper)
}

export const MODIFIERS: RunModifier[] = [
  {
    id: 'none',
    name: 'Clear Aether',
    desc: 'No special conditions.',
    color: '#8a93b8',
  },
  {
    id: 'aether_surge',
    name: 'Aether Surge',
    desc: '+50% XP and gold from all battles.',
    color: '#f0d36c',
    xpMult: 1.5,
    goldMult: 1.5,
  },
  {
    id: 'blood_pact',
    name: 'Blood Pact',
    desc: 'Deal +30% damage — but take +30% damage.',
    color: '#ff6655',
    dmgMult: 1.3,
    dmgTakenMult: 1.3,
  },
  {
    id: 'ancient_runes',
    name: 'Ancient Runes',
    desc: 'All spells cost 2 fewer MP.',
    color: '#8a6cf0',
    spellCostDelta: -2,
  },
  {
    id: 'crystal_weakness',
    name: 'Crystal Weakness',
    desc: 'Party descends at 70% max HP, but desperation sharpens the blade: +15% damage.',
    color: '#6c9cf0',
    startHpFactor: 0.7,
    dmgMult: 1.15,
  },
  {
    id: 'dark_drain',
    name: 'Dark Drain',
    desc: 'The dungeon saps life (1 HP lost per step) — but the drained Aether turns to gold: +30%.',
    color: '#aa4466',
    hpDrainPerStep: 1,
    goldMult: 1.3,
  },
];

export function rollModifier(): RunModifier {
  return MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
}
