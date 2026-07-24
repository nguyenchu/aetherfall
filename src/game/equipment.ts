// Equipment: stat bonuses PLUS mechanical effects that plug into the battle
// systems — weapons can change your attack element (hitting weaknesses and
// chipping guard!), inflict ailments, and gear can grant crit, lifesteal,
// MP regen, healing power, and ailment immunity.
//
// The pool forms a progression arc: chapter-tier gear is found in chests
// behind elite guardians, dropped by elites, sold after chapter clears, and
// earned from quests.

import type { Ailment, Element, GearEffects, Inflict, Stats } from './types';

export type EquipSlot = 'weapon' | 'armor' | 'charm';

/** Passive effects an item can carry; all optional. */
export interface EquipEffects {
  attackElement?: Element; // weapon: basic attacks strike as this element
  attackInflict?: Inflict; // basic attacks may apply an ailment
  critInflict?: Inflict; // basic attacks that land as a critical hit may also apply an ailment
  critBonus?: number; // added to crit chance
  lifesteal?: number; // fraction of attack damage returned as HP
  mpRegen?: number; // MP restored each round in battle
  guardChipBonus?: number; // extra guard pips on weakness hits
  healBonus?: number; // flat bonus to healing spells
  resist?: Ailment[]; // immune to these ailments
  breakBonusDmg?: number; // extra damage multiplier against broken (staggered) enemies
}

/** How BootScene draws the item's icon. */
export interface IconSpec {
  kind: 'blade' | 'staff' | 'mace' | 'armor' | 'robe' | 'orb' | 'ring' | 'lantern';
  base: number;
  accent: number;
}

export interface Equipment {
  id: string;
  name: string;
  slot: EquipSlot;
  users: string[];
  bonus: Partial<Stats>;
  trait: string;
  description: string;
  effects?: EquipEffects;
  icon: IconSpec;
}

export const EQUIPMENT: Record<string, Equipment> = {
  // --- Starting gear (chapter 1 tier) ---------------------------------------
  slender_blade: {
    id: 'slender_blade',
    name: 'Slender Blade',
    slot: 'weapon',
    users: ['kael'],
    bonus: { str: 3, agi: 1 },
    trait: 'Swift blade',
    description: 'Balanced duelist weapon. Raises physical pressure and turn speed.',
    icon: { kind: 'blade', base: 0xdfe4f5, accent: 0x6cf0c2 },
  },
  ember_staff: {
    id: 'ember_staff',
    name: 'Ember Staff',
    slot: 'weapon',
    users: ['lyra'],
    bonus: { int: 3, maxMp: 4 },
    trait: 'Aether focus',
    description: 'Mage focus. Better spell damage and a deeper MP pool.',
    icon: { kind: 'staff', base: 0xff7a32, accent: 0xffd36c },
  },
  dawn_mace: {
    id: 'dawn_mace',
    name: 'Dawn Mace',
    slot: 'weapon',
    users: ['mira'],
    bonus: { str: 2, int: 2 },
    trait: 'War-prayer',
    description: 'Hybrid mace. Supports both strikes and healing magic.',
    icon: { kind: 'mace', base: 0xf0d36c, accent: 0xdfe4f5 },
  },
  scout_vest: {
    id: 'scout_vest',
    name: 'Scout Vest',
    slot: 'armor',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxHp: 8, vit: 1 },
    trait: 'Light armor',
    description: 'Simple field armor. Good survival boost with no specialization.',
    icon: { kind: 'armor', base: 0x4b6f7a, accent: 0x6cf0c2 },
  },
  aether_robe: {
    id: 'aether_robe',
    name: 'Aether Robe',
    slot: 'armor',
    users: ['lyra', 'mira'],
    bonus: { maxHp: 6, maxMp: 6, int: 1 },
    trait: 'Caster robe',
    description: 'Arcane weave. Light protection, built for spell endurance.',
    icon: { kind: 'robe', base: 0x5d3b9a, accent: 0xa58cff },
  },
  sun_charm: {
    id: 'sun_charm',
    name: 'Sun Charm',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxHp: 4, vit: 1, int: 1 },
    trait: 'Steady charm',
    description: 'Defensive talisman with a small magic lift.',
    icon: { kind: 'orb', base: 0xf0d36c, accent: 0xfff0a0 },
  },

  // --- Chapter 1 finds --------------------------------------------------------
  emberfang: {
    id: 'emberfang',
    name: 'Emberfang',
    slot: 'weapon',
    users: ['kael'],
    bonus: { str: 3, agi: 1 },
    trait: 'Burning edge',
    description: 'A blade quenched in grove-fire. Strikes count as fire.',
    effects: { attackElement: 'fire' },
    icon: { kind: 'blade', base: 0xff8a5a, accent: 0xffd36c },
  },
  tide_ring: {
    id: 'tide_ring',
    name: 'Tide Ring',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxMp: 4, int: 2 },
    trait: 'Tide magic',
    description: 'Aether ring. Strong for magic users and hybrid builds.',
    icon: { kind: 'ring', base: 0x44aaff, accent: 0xdff6ff },
  },
  reef_mail: {
    id: 'reef_mail',
    name: 'Reef Mail',
    slot: 'armor',
    users: ['kael', 'mira'],
    bonus: { maxHp: 12, vit: 2 },
    trait: 'Heavy armor',
    description: 'Sturdy mail. Strong protection for front-line fighters.',
    icon: { kind: 'armor', base: 0x4f7f9a, accent: 0x9ad8ff },
  },
  aether_loop: {
    id: 'aether_loop',
    name: 'Aether Loop',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxMp: 4 },
    trait: 'Aether siphon',
    description: 'Draws thin aether from the air. Restores 1 MP every round.',
    effects: { mpRegen: 1 },
    icon: { kind: 'ring', base: 0xa58cff, accent: 0xdfe4f5 },
  },
  moonveil_charm: {
    id: 'moonveil_charm',
    name: 'Moonveil Charm',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { agi: 2 },
    trait: 'Moonlit hush',
    description: 'A sliver of quiet moonlight. Quickens the draw and the eye.',
    effects: { critBonus: 0.04 },
    icon: { kind: 'ring', base: 0x6c8cf0, accent: 0xdfe4f5 },
  },

  // --- Chapter 2 tier (Sunken City) --------------------------------------------
  tidecleaver: {
    id: 'tidecleaver',
    name: 'Tidecleaver',
    slot: 'weapon',
    users: ['kael'],
    bonus: { str: 5 },
    trait: 'Frozen edge',
    description: 'Warden-steel that never dries. Strikes count as ice and can chill.',
    effects: { attackElement: 'ice', attackInflict: { ailment: 'chill', chance: 0.2, rounds: 2 } },
    icon: { kind: 'blade', base: 0x6cb8ff, accent: 0xdff6ff },
  },
  torens_blade: {
    id: 'torens_blade',
    name: 'Toren\'s Blade',
    slot: 'weapon',
    users: ['kael'],
    bonus: { str: 6, agi: 2 },
    trait: 'Steadfast edge',
    description: 'Carried a watch-line\'s discipline into every strike. No magic in the steel — just years spent trusting it.',
    effects: { critBonus: 0.05 },
    icon: { kind: 'blade', base: 0x9aa4c8, accent: 0xdfe4f5 },
  },
  stormcaller_rod: {
    id: 'stormcaller_rod',
    name: 'Stormcaller Rod',
    slot: 'weapon',
    users: ['lyra'],
    bonus: { int: 5, maxMp: 6 },
    trait: 'Deep focus',
    description: 'Cut from a drowned spire. Raw spellpower and a deeper pool.',
    icon: { kind: 'staff', base: 0x4a7ad8, accent: 0x9ad8ff },
  },
  tidewrought_mace: {
    id: 'tidewrought_mace',
    name: 'Tidewrought Mace',
    slot: 'weapon',
    users: ['mira'],
    bonus: { str: 4, int: 4 },
    trait: 'Consecrated',
    description: 'Blessed at the Tidal Anchor. Strikes count as holy.',
    effects: { attackElement: 'holy' },
    icon: { kind: 'mace', base: 0x9ad8ff, accent: 0xffe07a },
  },
  tidewarden_mail: {
    id: 'tidewarden_mail',
    name: 'Tidewarden Mail',
    slot: 'armor',
    users: ['kael', 'mira'],
    bonus: { maxHp: 14, vit: 3 },
    trait: 'Warm current',
    description: 'Warden plate that holds the warmth of the deep. Cannot be chilled.',
    effects: { resist: ['chill'] },
    icon: { kind: 'armor', base: 0x2a5a8a, accent: 0x6cd8f0 },
  },
  vampire_fang: {
    id: 'vampire_fang',
    name: 'Vampire Fang',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { str: 1 },
    trait: 'Thirsting',
    description: 'A drowned predator\'s tooth. Physical damage feeds you 15% of the damage.',
    effects: { lifesteal: 0.15 },
    icon: { kind: 'orb', base: 0xaa3344, accent: 0xff8a8a },
  },
  consecrated_censer: {
    id: 'consecrated_censer',
    name: 'Consecrated Censer',
    slot: 'weapon',
    users: ['mira'],
    bonus: { str: 5, int: 3 },
    trait: 'Zealous strike',
    description: 'A censer swung in judgment. Strikes count as holy, and a well-placed hit sears the wicked.',
    effects: { attackElement: 'holy', critInflict: { ailment: 'burn', chance: 1, rounds: 2 } },
    icon: { kind: 'mace', base: 0xffd36c, accent: 0xff8a5a },
  },
  serpents_kiss: {
    id: 'serpents_kiss',
    name: 'Serpent\'s Kiss',
    slot: 'weapon',
    users: ['kael'],
    bonus: { str: 5, agi: 3 },
    trait: 'Envenomed edge',
    description: 'A blade drawn along something that should not still be moving. Attacks may Poison.',
    effects: { attackInflict: { ailment: 'venom', chance: 0.25, rounds: 3 } },
    icon: { kind: 'blade', base: 0x4a6a3a, accent: 0x8aff6c },
  },
  fracture_band: {
    id: 'fracture_band',
    name: 'Fracture Band',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { agi: 2 },
    trait: 'Merciless',
    description: 'Struck from the same steel Wardens use to stagger their prey. Deals extra damage to staggered enemies.',
    effects: { breakBonusDmg: 0.2 },
    icon: { kind: 'ring', base: 0x6cd8f0, accent: 0xdff6ff },
  },

  // --- Chapter 3 tier (Ashen Peaks) ---------------------------------------------
  sunbrand: {
    id: 'sunbrand',
    name: 'Sunbrand',
    slot: 'weapon',
    users: ['kael'],
    bonus: { str: 7 },
    trait: 'Radiant edge',
    description: 'Forged in shrine-fire, cooled in dawn. Holy strikes that bite deep.',
    effects: { attackElement: 'holy', critBonus: 0.05 },
    icon: { kind: 'blade', base: 0xffe07a, accent: 0xfff4b8 },
  },
  winter_staff: {
    id: 'winter_staff',
    name: 'Winter Staff',
    slot: 'weapon',
    users: ['lyra'],
    bonus: { int: 6, maxMp: 4 },
    trait: 'Shatterfrost',
    description: 'Ancient ice that never melts. Weakness hits chip an extra guard pip.',
    effects: { guardChipBonus: 1 },
    icon: { kind: 'staff', base: 0x9ad8ff, accent: 0xdff6ff },
  },
  dawnstar: {
    id: 'dawnstar',
    name: 'Dawnstar',
    slot: 'weapon',
    users: ['mira'],
    bonus: { str: 5, int: 6 },
    trait: 'Morning light',
    description: 'The mace of the first Warden. Holy strikes and stronger healing.',
    effects: { attackElement: 'holy', healBonus: 8 },
    icon: { kind: 'mace', base: 0xfff0a0, accent: 0xffe07a },
  },
  ashenguard_plate: {
    id: 'ashenguard_plate',
    name: 'Ashenguard Plate',
    slot: 'armor',
    users: ['kael', 'mira'],
    bonus: { maxHp: 20, vit: 4 },
    trait: 'Fireproof',
    description: 'Peak-forged plate. Flame slides off it — cannot be burned.',
    effects: { resist: ['burn'] },
    icon: { kind: 'armor', base: 0x8a3311, accent: 0xff8a5a },
  },
  emberweave_robe: {
    id: 'emberweave_robe',
    name: 'Emberweave Robe',
    slot: 'armor',
    users: ['lyra', 'mira'],
    bonus: { maxHp: 10, maxMp: 8, int: 2 },
    trait: 'Fireproof weave',
    description: 'Woven from cooled cinder-silk. Cannot be burned.',
    effects: { resist: ['burn'] },
    icon: { kind: 'robe', base: 0x8a3311, accent: 0xffb86c },
  },
  cinder_band: {
    id: 'cinder_band',
    name: 'Cinder Band',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { agi: 3 },
    trait: 'Spark-quick',
    description: 'Crackles with restless embers. Faster turns, +8% crit.',
    effects: { critBonus: 0.08 },
    icon: { kind: 'ring', base: 0xff8a5a, accent: 0xffd36c },
  },
  oracle_lantern: {
    id: 'oracle_lantern',
    name: 'Oracle Lantern',
    slot: 'charm',
    users: ['lyra', 'mira'],
    bonus: { maxMp: 8, int: 2 },
    trait: 'Oracle focus',
    description: 'Deepens spiritual focus for long fights and stronger spells.',
    icon: { kind: 'lantern', base: 0xf0d36c, accent: 0xfff4b8 },
  },

  // --- Chapter 4 tier (Crystal Depths) ------------------------------------------
  prism_edge: {
    id: 'prism_edge',
    name: 'Prism Edge',
    slot: 'weapon',
    users: ['kael'],
    bonus: { str: 6, agi: 2 },
    trait: 'Refracted edge',
    description: 'Cut from a living geode. Strikes count as ice and bite true.',
    effects: { attackElement: 'ice', critBonus: 0.06 },
    icon: { kind: 'blade', base: 0x9ad8ff, accent: 0xc78aff },
  },
  stormglass_rod: {
    id: 'stormglass_rod',
    name: 'Stormglass Rod',
    slot: 'weapon',
    users: ['lyra'],
    bonus: { int: 7, maxMp: 8 },
    trait: 'Deep focus',
    description: 'Fused glass from the Depths. Raw spellpower and a deeper pool.',
    icon: { kind: 'staff', base: 0x8a5ad0, accent: 0xc78aff },
  },
  radiant_mace: {
    id: 'radiant_mace',
    name: 'Radiant Mace',
    slot: 'weapon',
    users: ['mira'],
    bonus: { str: 6, int: 7 },
    trait: 'Sanctified crystal',
    description: 'Blessed at the Radiant Anchor. Strikes count as holy and heal deeper.',
    effects: { attackElement: 'holy', healBonus: 10 },
    icon: { kind: 'mace', base: 0xc78aff, accent: 0xfff4b8 },
  },
  hollowguard_plate: {
    id: 'hollowguard_plate',
    name: 'Hollowguard Plate',
    slot: 'armor',
    users: ['kael', 'mira'],
    bonus: { maxHp: 22, vit: 5 },
    trait: 'Depth-forged',
    description: 'Plate grown in the deep cold. Cannot be chilled.',
    effects: { resist: ['chill'] },
    icon: { kind: 'armor', base: 0x5a2a8a, accent: 0x9ad8ff },
  },
  geode_plate: {
    id: 'geode_plate',
    name: 'Geode Plate',
    slot: 'armor',
    users: ['kael', 'mira'],
    bonus: { maxHp: 16, str: 2 },
    trait: 'Crystalline',
    description: 'Armor grown from a hollow geode. Venom cannot take root in it.',
    effects: { resist: ['venom'] },
    icon: { kind: 'armor', base: 0x4a3a6a, accent: 0x8a5ad0 },
  },
  prism_band: {
    id: 'prism_band',
    name: 'Prism Band',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxMp: 6, int: 2 },
    trait: 'Refractive',
    description: 'Splits aether like light through crystal. Restores 2 MP every round.',
    effects: { mpRegen: 2 },
    icon: { kind: 'ring', base: 0xc78aff, accent: 0xdfe4f5 },
  },

  // --- Given by the Stranger, after chapter 4 -----------------------------------
  watchers_ward: {
    id: 'watchers_ward',
    name: 'Watcher\'s Ward',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxMp: 6, agi: 2 },
    trait: 'Unseen vigil',
    description: 'Given by someone who has watched these anchors far longer than anyone in Sanctuary knows. It hums faintly near corrupted things.',
    effects: { critBonus: 0.06 },
    icon: { kind: 'orb', base: 0x8a93b8, accent: 0xdfe4f5 },
  },

  // --- Chapter 5 tier (Tempest Anchor) -------------------------------------------
  squallblade: {
    id: 'squallblade',
    name: 'Squallblade',
    slot: 'weapon',
    users: ['kael'],
    bonus: { str: 8, agi: 2 },
    trait: 'Ungrounded edge',
    description: 'Cut from a bolt that struck the anchor and never fully grounded. Its edge carries no charge of its own — nothing for a ward to catch.',
    effects: { attackElement: 'none', critBonus: 0.05 },
    icon: { kind: 'blade', base: 0x9fc8e0, accent: 0xc0e8ff },
  },
  tempest_rod: {
    id: 'tempest_rod',
    name: 'Tempest Rod',
    slot: 'weapon',
    users: ['lyra'],
    bonus: { int: 8, maxMp: 9 },
    trait: 'Storm focus',
    description: 'Fused where lightning met crystal, again and again. Amplifies spellpower and holds a deeper reserve.',
    icon: { kind: 'staff', base: 0x4a6a8a, accent: 0x9fc8e0 },
  },
  stormward_mace: {
    id: 'stormward_mace',
    name: 'Stormward Mace',
    slot: 'weapon',
    users: ['mira'],
    bonus: { str: 7, int: 8 },
    trait: 'Storm-blessed',
    description: 'Blessed at the mended Tempest Anchor. Strikes count as holy, and its wielder heals a little deeper for it.',
    effects: { attackElement: 'holy', healBonus: 12 },
    icon: { kind: 'mace', base: 0x6ac8f0, accent: 0xfff4b8 },
  },
  stormguard_plate: {
    id: 'stormguard_plate',
    name: 'Stormguard Plate',
    slot: 'armor',
    users: ['kael', 'mira'],
    bonus: { maxHp: 24, vit: 6 },
    trait: 'Storm-tempered',
    description: 'Plate quenched in storm-charged rain. The cold no longer bites through it.',
    effects: { resist: ['chill'] },
    icon: { kind: 'armor', base: 0x3a4a5e, accent: 0x9fc8e0 },
  },
  windrent_plate: {
    id: 'windrent_plate',
    name: 'Windrent Plate',
    slot: 'armor',
    users: ['kael', 'mira'],
    bonus: { maxHp: 26, vit: 7 },
    trait: 'Storm-scarred',
    description: 'Weathered a hundred storms atop the heights. Venom finds no purchase in the cracks.',
    effects: { resist: ['venom'] },
    icon: { kind: 'armor', base: 0x2a3a4e, accent: 0x6ac8f0 },
  },
  thunderhead_band: {
    id: 'thunderhead_band',
    name: 'Thunderhead Band',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxMp: 7, int: 2 },
    trait: 'Static charge',
    description: 'Crackles with charge that never fully discharges. Restores 3 MP every round.',
    effects: { mpRegen: 3 },
    icon: { kind: 'ring', base: 0x9fc8e0, accent: 0xf6f9ff },
  },

  // --- Rift tier: found only in the Rift's own chests, past chapter 4 ----------
  rift_edge: {
    id: 'rift_edge',
    name: 'Rift Edge',
    slot: 'weapon',
    users: ['kael'],
    bonus: { str: 8, agi: 2 },
    trait: 'Unstable edge',
    description: 'Cut from something that shouldn\'t exist outside the Rift. Strikes carry no element — nothing to ward against.',
    effects: { attackElement: 'none' },
    icon: { kind: 'blade', base: 0x2a1f3a, accent: 0xc78aff },
  },
  rift_lens: {
    id: 'rift_lens',
    name: 'Rift Lens',
    slot: 'weapon',
    users: ['lyra'],
    bonus: { int: 9, maxMp: 10 },
    trait: 'Fractured focus',
    description: 'A lens that shows the same enemy weak from every angle.',
    effects: { critBonus: 0.08 },
    icon: { kind: 'staff', base: 0x2a1f3a, accent: 0xc78aff },
  },
  rift_scepter: {
    id: 'rift_scepter',
    name: 'Rift Scepter',
    slot: 'weapon',
    users: ['mira'],
    bonus: { str: 5, int: 8 },
    trait: 'Devourer\'s mercy',
    description: 'Drawn from the same hunger that carved the Rift. Heals as fiercely as it burns.',
    effects: { attackElement: 'holy', healBonus: 14 },
    icon: { kind: 'mace', base: 0x2a1f3a, accent: 0xc78aff },
  },
  rift_core: {
    id: 'rift_core',
    name: 'Rift Core',
    slot: 'armor',
    users: ['kael', 'mira'],
    bonus: { maxHp: 26, vit: 6 },
    trait: 'Collapsed matter',
    description: 'Armor grown from matter the Rift couldn\'t finish consuming. Physical damage feeds you 10% of the damage.',
    effects: { lifesteal: 0.1 },
    icon: { kind: 'armor', base: 0x2a1f3a, accent: 0x8a5ad0 },
  },
  rift_ward: {
    id: 'rift_ward',
    name: 'Rift Ward',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxHp: 10, vit: 2 },
    trait: 'Rift-tempered',
    description: 'Tempered in a place that shouldn\'t hold shape. Cannot be burned, chilled, or poisoned.',
    effects: { resist: ['burn', 'chill', 'venom'] },
    icon: { kind: 'orb', base: 0x2a1f3a, accent: 0xc78aff },
  },
};

/** Rift chests (see rift.ts) draw from this pool instead of the fixed
 *  chapter tiers — the Rift's own gear, found nowhere else. */
export const RIFT_EQUIPMENT = ['rift_edge', 'rift_lens', 'rift_scepter', 'rift_core', 'rift_ward'];

export const STARTING_EQUIPMENT = ['slender_blade', 'ember_staff', 'dawn_mace', 'scout_vest', 'aether_robe', 'sun_charm'];

export const DEFAULT_EQUIPPED: Record<string, Partial<Record<EquipSlot, string>>> = {
  kael: { weapon: 'slender_blade', armor: 'scout_vest', charm: 'sun_charm' },
  lyra: { weapon: 'ember_staff', armor: 'aether_robe' },
  mira: { weapon: 'dawn_mace' },
};

export function equipmentBonus(ids: Array<string | undefined>): Partial<Stats> {
  const total: Partial<Stats> = {};
  for (const id of ids) {
    if (!id) continue;
    const item = EQUIPMENT[id];
    if (!item) continue;
    for (const [key, value] of Object.entries(item.bonus) as Array<[keyof Stats, number]>) {
      total[key] = (total[key] ?? 0) + value;
    }
  }
  return total;
}

/** Aggregated passive effects from a set of equipped item ids. */
export function gearFor(ids: Array<string | undefined>): {
  attackElement?: Element;
  attackInflict?: Inflict;
  critInflict?: Inflict;
  gear: GearEffects;
} {
  const gear: GearEffects = { critBonus: 0, lifesteal: 0, mpRegen: 0, guardChipBonus: 0, healBonus: 0, resist: [], breakBonusDmg: 0 };
  let attackElement: Element | undefined;
  let attackInflict: Inflict | undefined;
  let critInflict: Inflict | undefined;
  for (const id of ids) {
    const fx = id ? EQUIPMENT[id]?.effects : undefined;
    if (!fx) continue;
    if (fx.attackElement) attackElement = fx.attackElement;
    if (fx.attackInflict) attackInflict = fx.attackInflict;
    if (fx.critInflict) critInflict = fx.critInflict;
    if (fx.critBonus) gear.critBonus += fx.critBonus;
    if (fx.lifesteal) gear.lifesteal += fx.lifesteal;
    if (fx.mpRegen) gear.mpRegen += fx.mpRegen;
    if (fx.guardChipBonus) gear.guardChipBonus += fx.guardChipBonus;
    if (fx.healBonus) gear.healBonus += fx.healBonus;
    if (fx.breakBonusDmg) gear.breakBonusDmg = (gear.breakBonusDmg ?? 0) + fx.breakBonusDmg;
    for (const a of fx.resist ?? []) {
      if (!gear.resist.includes(a)) gear.resist.push(a);
    }
  }
  return { attackElement, attackInflict, critInflict, gear };
}

const AILMENT_VERB: Record<Ailment, string> = { burn: 'burn', chill: 'chill', venom: 'poison' };

/** Human-readable effect lines for the equip UI and shop. */
export function equipmentEffectText(item: Equipment): string[] {
  const fx = item.effects;
  if (!fx) return [];
  const parts: string[] = [];
  if (fx.attackElement === 'none') parts.push('Attacks carry no element — bypasses elemental wards');
  else if (fx.attackElement) parts.push(`Attacks strike as ${fx.attackElement.toUpperCase()}`);
  if (fx.attackInflict) parts.push(`${Math.round(fx.attackInflict.chance * 100)}% to ${AILMENT_VERB[fx.attackInflict.ailment]} on hit`);
  if (fx.critInflict) parts.push(`Critical hits also ${AILMENT_VERB[fx.critInflict.ailment]}${fx.critInflict.chance < 1 ? ` (${Math.round(fx.critInflict.chance * 100)}%)` : ''}`);
  if (fx.critBonus) parts.push(`+${Math.round(fx.critBonus * 100)}% crit`);
  if (fx.lifesteal) parts.push(`Physical damage heals ${Math.round(fx.lifesteal * 100)}% back`);
  if (fx.mpRegen) parts.push(`+${fx.mpRegen} MP each round`);
  if (fx.guardChipBonus) parts.push(`Weakness hits chip +${fx.guardChipBonus} guard`);
  if (fx.healBonus) parts.push(`Healing +${fx.healBonus}`);
  if (fx.breakBonusDmg) parts.push(`+${Math.round(fx.breakBonusDmg * 100)}% damage to staggered enemies`);
  if (fx.resist && fx.resist.length > 0) parts.push(`Immune to ${fx.resist.join(', ')}`);
  return parts;
}
