// Persistent meta-progression in localStorage. Survives sessions and death:
// in the Hades model, growth (levels, gold, upgrades) remains even when the
// Anchor draws you back to Sanctuary.

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
  ngPlus: number; // Ascension tier — raises postgame enemy difficulty/rewards
  // --- Run-based meta-progression (meta.ts), save version 2 ---
  version: number;
  echoes: number; // persistent currency banked at the end of every run
  upgrades: Record<string, number>; // Anchor upgrade id -> ranks owned
  runs: number; // runs started
  clears: number; // full descents completed
  bestDepth: number; // deepest depth any run has reached
  lastRun: LastRun | null; // how the previous run ended (Sanctuary reacts to it)
  /** The run in progress, so closing the tab mid-descent resumes it. Shape
   *  owned and validated by run.ts (RunSnapshot). */
  run: Record<string, unknown> | null;
}

export interface LastRun {
  result: 'wipe' | 'retreat' | 'clear';
  depth: number;
  echoes: number;
  /** Name of whatever ended the run, if a fight did. */
  foe?: string;
}

export const SAVE_VERSION = 2;

export interface SaveSummary {
  gold: number;
  deepest: number;
  potions: number;
  highestLevel: number;
  partyLevels: string;
  equipmentCount: number;
  completeQuests: number;
  echoes: number;
  bestDepth: number;
  runs: number;
  /** Depth of the run in progress, or null when resting in Sanctuary. */
  runDepth: number | null;
}

const KEY = 'aetherfall.save.v1';
const BACKUP_KEY = `${KEY}.backup`;

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
    ngPlus: 0,
    version: SAVE_VERSION,
    echoes: 0,
    upgrades: {},
    runs: 0,
    clears: 0,
    bestDepth: 1,
    lastRun: null,
    run: null,
  };
}

export function loadSave(): SaveData {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error('Save data is not an object');
    return normalize(parsed);
  } catch (err) {
    if (raw) backupCorruptSave(raw, err);
    return defaults();
  }
}

// The next writeSave() would overwrite an unreadable save, so stash the raw
// text first; it may still be recoverable by hand.
function backupCorruptSave(raw: string, err: unknown): void {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    console.warn(`Save data could not be read; raw copy kept under "${BACKUP_KEY}".`, err);
  } catch {
    /* ignore */
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
    echoes: data.echoes,
    bestDepth: data.bestDepth,
    runs: data.runs,
    runDepth: data.run && typeof data.run.depth === 'number' ? data.run.depth : null,
  };
}

// Stored data may be old, hand-edited or damaged, so every field is checked
// and anything of the wrong type falls back to its default instead of
// reaching code that assumes the type (such as data.levels.kael).
function normalize(stored: Record<string, unknown>): SaveData {
  const base = defaults();
  const data: SaveData = {
    ...(stored as Partial<SaveData>),
    gold: count(stored.gold, base.gold),
    potions: count(stored.potions, base.potions),
    items: numberRecord(stored.items, 0),
    hpBlessings: count(stored.hpBlessings, base.hpBlessings),
    deepest: count(stored.deepest, base.deepest, 1),
    levels: numberRecord(stored.levels, 1),
    flags: strings(stored.flags),
    equipmentOwned: strings(stored.equipmentOwned),
    equipped: equippedRecord(stored.equipped),
    quests: questRecord(stored.quests),
    ngPlus: count(stored.ngPlus, base.ngPlus),
    version: count(stored.version, 1),
    echoes: count(stored.echoes, base.echoes),
    upgrades: numberRecord(stored.upgrades, 0),
    runs: count(stored.runs, base.runs),
    clears: count(stored.clears, base.clears),
    bestDepth: count(stored.bestDepth, base.bestDepth, 1),
    lastRun: lastRunRecord(stored.lastRun),
    run: isRecord(stored.run) ? stored.run : null,
  };
  // Saves from before items existed only have potions; keep that count.
  data.items = { potion: data.potions, ...(isRecord(stored.items) ? data.items : base.items) };
  if ((data.items.potion ?? 0) === 3 && data.potions !== 3) data.items.potion = data.potions;
  data.potions = data.items.potion ?? 0;
  data.equipmentOwned = Array.from(new Set([...data.equipmentOwned, ...STARTING_EQUIPMENT]));
  data.equipped = { ...structuredClone(DEFAULT_EQUIPPED), ...data.equipped };
  data.quests = { ...initialQuests(), ...data.quests };
  if (data.version < SAVE_VERSION) migrateToRuns(data);
  return data;
}

/** Version 1 saves kept levels, gold and gear forever. Runs now start fresh,
 *  so that progress is converted into Echoes (spent on permanent Anchor
 *  upgrades) instead of silently vanishing. Story flags, quests and the
 *  Ascension tier carry over untouched. */
function migrateToRuns(data: SaveData): void {
  const chapters = [1, 2, 3, 4, 5, 6].filter((ch) => data.flags.includes(`ch${ch}_complete`)).length;
  const topLevel = Math.max(1, ...Object.values(data.levels));
  data.echoes += chapters * 25 + data.hpBlessings * 10 + Math.floor(data.gold / 20) + (topLevel - 1) * 3;
  data.bestDepth = Math.max(data.bestDepth, data.deepest);
  data.hpBlessings = 0;
  data.gold = 0;
  data.levels = {};
  data.items = { potion: 3 };
  data.potions = 3;
  data.equipmentOwned = [...STARTING_EQUIPMENT];
  data.equipped = structuredClone(DEFAULT_EQUIPPED);
  data.run = null;
  data.version = SAVE_VERSION;
}

function lastRunRecord(value: unknown): LastRun | null {
  if (!isRecord(value)) return null;
  const result = value.result;
  if (result !== 'wipe' && result !== 'retreat' && result !== 'clear') return null;
  return {
    result,
    depth: count(value.depth, 1, 1),
    echoes: count(value.echoes, 0),
    foe: typeof value.foe === 'string' ? value.foe : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown, fallback: number, min = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function numberRecord(value: unknown, min: number): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((e): e is [string, number] => count(e[1], NaN, min) === e[1]),
  );
}

const SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'charm'];

function equippedRecord(value: unknown): SaveData['equipped'] {
  if (!isRecord(value)) return {};
  const result: SaveData['equipped'] = {};
  for (const [member, slots] of Object.entries(value)) {
    if (!isRecord(slots)) continue;
    const kept: Partial<Record<EquipSlot, string>> = {};
    for (const slot of SLOTS) {
      if (typeof slots[slot] === 'string') kept[slot] = slots[slot];
    }
    result[member] = kept;
  }
  return result;
}

function questRecord(value: unknown): Record<string, QuestStatus> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((e): e is [string, QuestStatus] => e[1] === 'active' || e[1] === 'complete'),
  );
}

/** Returns false when the save could not be written, so the caller can tell the player. */
export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    // localStorage unavailable or full (private mode, quota); the game goes on without saving.
    return false;
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
