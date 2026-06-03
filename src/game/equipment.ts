import type { Stats } from './types';

export type EquipSlot = 'weapon' | 'armor' | 'charm';

export interface Equipment {
  id: string;
  name: string;
  slot: EquipSlot;
  users: string[];
  bonus: Partial<Stats>;
}

export const EQUIPMENT: Record<string, Equipment> = {
  slender_blade: {
    id: 'slender_blade',
    name: 'Slender Blade',
    slot: 'weapon',
    users: ['kael'],
    bonus: { str: 3, agi: 1 },
  },
  ember_staff: {
    id: 'ember_staff',
    name: 'Ember Staff',
    slot: 'weapon',
    users: ['lyra'],
    bonus: { int: 3, maxMp: 4 },
  },
  dawn_mace: {
    id: 'dawn_mace',
    name: 'Dawn Mace',
    slot: 'weapon',
    users: ['mira'],
    bonus: { str: 2, int: 2 },
  },
  scout_vest: {
    id: 'scout_vest',
    name: 'Scout Vest',
    slot: 'armor',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxHp: 8, vit: 1 },
  },
  aether_robe: {
    id: 'aether_robe',
    name: 'Aether Robe',
    slot: 'armor',
    users: ['lyra', 'mira'],
    bonus: { maxMp: 6, int: 1 },
  },
  sun_charm: {
    id: 'sun_charm',
    name: 'Sun Charm',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxHp: 4, vit: 1, int: 1 },
  },
  tide_ring: {
    id: 'tide_ring',
    name: 'Tide Ring',
    slot: 'charm',
    users: ['kael', 'lyra', 'mira'],
    bonus: { maxMp: 4, int: 2 },
  },
  reef_mail: {
    id: 'reef_mail',
    name: 'Reef Mail',
    slot: 'armor',
    users: ['kael', 'mira'],
    bonus: { maxHp: 12, vit: 2 },
  },
  oracle_lantern: {
    id: 'oracle_lantern',
    name: 'Oracle Lantern',
    slot: 'charm',
    users: ['lyra', 'mira'],
    bonus: { maxMp: 8, int: 2 },
  },
};

export const STARTING_EQUIPMENT = ['slender_blade', 'ember_staff', 'dawn_mace', 'scout_vest', 'aether_robe', 'sun_charm'];

export const DEFAULT_EQUIPPED: Record<string, Partial<Record<EquipSlot, string>>> = {
  kael: { weapon: 'slender_blade', armor: 'scout_vest', charm: 'sun_charm' },
  lyra: { weapon: 'ember_staff', armor: 'aether_robe' },
  mira: { weapon: 'dawn_mace', armor: 'scout_vest' },
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
