// Persistent meta-progression in localStorage. Survives sessions and death:
// in the Hades model, growth (levels, gold, upgrades) remains even when the
// Crystal draws you back to Sanctuary.

import { DEFAULT_EQUIPPED, STARTING_EQUIPMENT, type EquipSlot } from './equipment';
import { initialQuests, type QuestStatus } from './quests';

export interface SaveData {
  gold: number;
  potions: number;
  items: Record<string, number>;
  hpBlessings: number; // purchased permanent +HP blessings
  deepest: number; // deepest stratum reached
  levels: Record<string, number>; // party id -> level
  flags: string[]; // story flags / seen scripts
  equipmentOwned: string[];
  equipped: Record<string, Partial<Record<EquipSlot, string>>>;
  quests: Record<string, QuestStatus>;
}

export interface SaveSummary {
  gold: number;
  deepest: number;
  potions: number;
  highestLevel: number;
  partyLevels: string;
  equipmentCount: number;
  completeQuests: number;
}

const KEY = 'aetherfall.save.v1';

function defaults(): SaveData {
  return {
    gold: 0,
    potions: 3,
    items: { potion: 3 },
    hpBlessings: 0,
    deepest: 1,
    levels: {},
    flags: [],
    equipmentOwned: [...STARTING_EQUIPMENT],
    equipped: structuredClone(DEFAULT_EQUIPPED),
    quests: initialQuests(),
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return normalize({ ...defaults(), ...(JSON.parse(raw) as Partial<SaveData>) });
  } catch {
    return defaults();
  }
}

export function loadSaveSummary(): SaveSummary | null {
  if (!hasSave()) return null;
  const data = loadSave();
  const levels = {
    kael: data.levels.kael ?? 1,
    lyra: data.levels.lyra ?? 1,
    mira: data.levels.mira ?? data.levels.bram ?? 1,
  };
  return {
    gold: data.gold,
    deepest: data.deepest,
    potions: data.items.potion ?? data.potions ?? 0,
    highestLevel: Math.max(...Object.values(levels)),
    partyLevels: `Kael L${levels.kael}  Lyra L${levels.lyra}  Mira L${levels.mira}`,
    equipmentCount: data.equipmentOwned.length,
    completeQuests: Object.values(data.quests).filter((status) => status === 'complete').length,
  };
}

function normalize(data: SaveData): SaveData {
  data.items = { potion: data.potions ?? 0, ...(data.items ?? {}) };
  if ((data.items.potion ?? 0) === 3 && data.potions !== 3) data.items.potion = data.potions;
  data.potions = data.items.potion ?? 0;
  data.equipmentOwned = Array.from(new Set([...(data.equipmentOwned ?? []), ...STARTING_EQUIPMENT]));
  data.equipped = { ...structuredClone(DEFAULT_EQUIPPED), ...(data.equipped ?? {}) };
  data.quests = { ...initialQuests(), ...(data.quests ?? {}) };
  return data;
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable, such as private mode; continue without saving.
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(KEY) != null;
  } catch {
    return false;
  }
}

export function wipeSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
