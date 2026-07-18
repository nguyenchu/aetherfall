// Runtime game state: living party, gold, inventory, and current depth.
// Connects persistent meta-progression (save.ts) with runtime state.
// Death is not total: the Anchor returns you to town, but level/gold remain.

import { track } from './analytics';
import { boonTotals, type BoonTotals } from './boons';
import { clearRiftArea, type ChestContents } from './chapters';
import { ITEMS, SPELLS, makeParty } from './content';
import { EQUIPMENT, STARTING_EQUIPMENT, equipmentBonus, gearFor, type EquipSlot } from './equipment';
import { rollModifier, type RunModifier } from './modifiers';
import { restoreLevel } from './progression';
import { QUESTS, questRewardText, type QuestDef } from './quests';
import { loadSave, writeSave, wipeSave, type SaveData } from './save';
import type { Combatant, Stats } from './types';

export interface RunState {
  party: Combatant[];
  gold: number;
  inventory: Record<string, number>;
  depth: number;
  modifier: RunModifier;
  /** Boon ids picked this run; cleared when returning to Sanctuary. */
  boons: string[];
  /** Healing springs used this run ('depth_col,row'); reset in town. */
  springsUsed: string[];
}

const HP_PER_BLESSING = 8;

let save: SaveData = loadSave();
let state: RunState = buildRun();
let modifierApplied = false;

function buildRun(): RunState {
  const party = makeParty();
  for (const c of party) {
    const savedLevel = save.levels[c.id] ?? (c.id === 'mira' ? save.levels.bram : undefined) ?? 1;
    restoreLevel(c, savedLevel);
    if (save.hpBlessings) {
      c.stats.maxHp += save.hpBlessings * HP_PER_BLESSING;
      c.stats.hp = c.stats.maxHp;
    }
    applyEquipment(c);
  }
  return {
    party, gold: save.gold, inventory: { ...save.items }, depth: 1,
    modifier: rollModifier(), boons: [], springsUsed: [],
  };
}

export function getRun(): RunState {
  return state;
}

export function getSave(): SaveData {
  return save;
}

/** Writes runtime progress back to the localStorage save. */
export function saveProgress(): void {
  save.gold = state.gold;
  save.items = { ...state.inventory };
  save.potions = state.inventory.potion ?? 0;
  for (const c of state.party) save.levels[c.id] = c.level ?? 1;
  if (state.depth > save.deepest) save.deepest = state.depth;
  writeSave(save);
}

// --- Boons (run-scoped blessings) --------------------------------------------

export function addBoon(id: string): void {
  if (!state.boons.includes(id)) state.boons.push(id);
}

/** Aggregated boon effects for the current run. */
export function runBoons(): BoonTotals {
  return boonTotals(state.boons);
}

// --- Descent Interactables ----------------------------------------------------

/** Opens a chest: applies contents and returns display lines. */
export function openChest(contents: ChestContents): string[] {
  const lines: string[] = [];
  if (contents.gold) {
    state.gold += contents.gold;
    lines.push(`+${contents.gold} gold`);
  }
  for (const [id, count] of Object.entries(contents.items ?? {})) {
    addItem(id, count);
    lines.push(`${ITEMS[id]?.name ?? id} x${count}`);
  }
  if (contents.equipment) {
    if (grantEquipment(contents.equipment)) {
      lines.push(`${EQUIPMENT[contents.equipment].name}!`);
    } else {
      state.gold += 30; // already owned: convert to gold
      lines.push('+30 gold');
    }
  }
  saveProgress();
  return lines;
}

/** Uses a healing spring once per run: restores 50% max HP/MP to everyone. */
export function useSpring(key: string): boolean {
  if (state.springsUsed.includes(key)) return false;
  state.springsUsed.push(key);
  for (const c of state.party) {
    c.stats.hp = Math.min(c.stats.maxHp, c.stats.hp + Math.round(c.stats.maxHp * 0.5));
    c.stats.mp = Math.min(c.stats.maxMp, c.stats.mp + Math.round(c.stats.maxMp * 0.5));
  }
  return true;
}

export function springUsed(key: string): boolean {
  return state.springsUsed.includes(key);
}

/** Party wipe stake: half the carried gold scatters. Returns the loss. */
export function applyWipePenalty(): number {
  const lost = Math.floor(state.gold / 2);
  state.gold -= lost;
  saveProgress();
  return lost;
}

// --- Story Flags ------------------------------------------------------------

export function hasFlag(flag: string): boolean {
  return save.flags.includes(flag);
}

export function setFlag(flag: string): void {
  if (!save.flags.includes(flag)) {
    save.flags.push(flag);
    writeSave(save);
  }
}

// --- Quests -----------------------------------------------------------------

/** Quests the player hasn't reached yet are left out entirely, so the log
 * only ever shows a quest once it has actually started. */
export function questList() {
  return QUESTS
    .filter((q) => !q.unlockFlag || hasFlag(q.unlockFlag))
    .map((q) => ({ ...q, status: save.quests[q.id] ?? 'active' }));
}

/** Marks a quest complete and grants its rewards. Returns the quest the
 * first time it completes, or null if it was already complete (or unknown)
 * so callers can decide whether to show a "quest complete" notification. */
export function completeQuest(id: string): QuestDef | null {
  if (save.quests[id] === 'complete') return null;
  save.quests[id] = 'complete';
  const quest = QUESTS.find((q) => q.id === id);
  if (quest) grantRewards(quest.rewards);
  saveProgress();
  return quest ?? null;
}

export function isQuestActive(id: string): boolean {
  const quest = QUESTS.find((q) => q.id === id);
  if (quest?.unlockFlag && !hasFlag(quest.unlockFlag)) return false;
  return (save.quests[id] ?? 'active') === 'active';
}

// --- Sanctuary Economy ------------------------------------------------------

export function hpBlessingCost(): number {
  return 30 + save.hpBlessings * 20;
}

export function buyHpBlessing(): boolean {
  const cost = hpBlessingCost();
  if (state.gold < cost) return false;
  state.gold -= cost;
  save.hpBlessings++;
  for (const c of state.party) {
    c.stats.maxHp += HP_PER_BLESSING;
    c.stats.hp = c.stats.maxHp;
  }
  saveProgress();
  return true;
}

export const POTION_COST = 15;

export function buyPotion(): boolean {
  return buyItem('potion');
}

export function buyItem(itemId: string): boolean {
  const item = ITEMS[itemId];
  const cost = item?.buyPrice;
  if (!item || cost == null || state.gold < cost) return false;
  state.gold -= cost;
  state.inventory[itemId] = (state.inventory[itemId] ?? 0) + 1;
  saveProgress();
  return true;
}

export function sellItem(itemId: string): boolean {
  const item = ITEMS[itemId];
  if (!item || (state.inventory[itemId] ?? 0) <= 0) return false;
  state.inventory[itemId]--;
  state.gold += item.sellPrice;
  saveProgress();
  return true;
}

export function buyEquipment(itemId: string): boolean {
  const cost = equipmentPrice(itemId);
  if (cost == null || state.gold < cost || save.equipmentOwned.includes(itemId)) return false;
  state.gold -= cost;
  save.equipmentOwned.push(itemId);
  saveProgress();
  return true;
}

export function sellEquipment(itemId: string): boolean {
  if (!canSellEquipment(itemId)) return false;
  save.equipmentOwned = save.equipmentOwned.filter((id) => id !== itemId);
  state.gold += Math.floor((equipmentPrice(itemId) ?? 40) * 0.5);
  saveProgress();
  return true;
}

export function canSellEquipment(itemId: string): boolean {
  return save.equipmentOwned.includes(itemId) && !STARTER_LOCKED.has(itemId) && !isEquipped(itemId);
}

export function usePotionOn(memberId: string): boolean {
  if ((state.inventory.potion ?? 0) <= 0) return false;
  const member = state.party.find((c) => c.id === memberId);
  if (!member || member.stats.hp <= 0 || member.stats.hp >= member.stats.maxHp) return false;
  state.inventory.potion--;
  member.stats.hp = Math.min(member.stats.maxHp, member.stats.hp + 30);
  saveProgress();
  return true;
}

export function useItemOn(itemId: string, memberId: string): boolean {
  const item = ITEMS[itemId];
  if (!item || item.target !== 'ally' || (state.inventory[itemId] ?? 0) <= 0) return false;
  const member = state.party.find((c) => c.id === memberId);
  if (!member) return false;
  // Revive is the one kind that targets a fallen ally instead of a living one.
  if (item.kind === 'revive') {
    if (member.stats.hp > 0) return false;
    state.inventory[itemId]--;
    member.stats.hp = Math.max(1, Math.round(member.stats.maxHp * item.power));
    saveProgress();
    return true;
  }
  if (member.stats.hp <= 0) return false;
  if (item.kind === 'heal') {
    if (member.stats.hp >= member.stats.maxHp) return false;
    state.inventory[itemId]--;
    member.stats.hp = Math.min(member.stats.maxHp, member.stats.hp + item.power);
  } else if (item.kind === 'mp') {
    if (member.stats.mp >= member.stats.maxMp) return false;
    state.inventory[itemId]--;
    member.stats.mp = Math.min(member.stats.maxMp, member.stats.mp + item.power);
  } else if (item.kind === 'cure') {
    // Ailments are battle-scoped and already cleared once a fight ends, so
    // there is nothing to cure here — this kind only does anything mid-battle.
    if (!member.ailments || Object.keys(member.ailments).length === 0) return false;
    state.inventory[itemId]--;
    member.ailments = undefined;
  } else {
    return false;
  }
  saveProgress();
  return true;
}

/** Field cast for party-target heals (Radiance). Blocks if nobody needs it. */
export function castPartyHealOutOfBattle(casterId: string, spellId: string): { healed: number; count: number } | null {
  const spell = SPELLS[spellId];
  if (!spell || spell.kind !== 'heal' || spell.target !== 'party') return null;
  const caster = state.party.find((c) => c.id === casterId);
  if (!caster || !caster.spells.includes(spellId)) return null;
  const cost = effectiveSpellCost(spellId);
  if (caster.stats.mp < cost) return null;
  const living = state.party.filter((c) => c.stats.hp > 0);
  if (living.every((c) => c.stats.hp >= c.stats.maxHp)) return null;
  caster.stats.mp -= cost;
  const heal = Math.round(spell.power + caster.stats.int * 0.5 + (caster.gear?.healBonus ?? 0));
  let healed = 0;
  let count = 0;
  for (const member of living) {
    const before = member.stats.hp;
    member.stats.hp = Math.min(member.stats.maxHp, member.stats.hp + heal);
    if (member.stats.hp > before) count++;
    healed += member.stats.hp - before;
  }
  saveProgress();
  return { healed, count };
}

export function effectiveSpellCost(spellId: string): number {
  const spell = SPELLS[spellId];
  if (!spell) return 0;
  return Math.max(0, spell.cost + (state.modifier.spellCostDelta ?? 0));
}

export function castSpellOutOfBattle(casterId: string, spellId: string, targetId: string): boolean {
  const spell = SPELLS[spellId];
  if (!spell || spell.kind !== 'heal' || spell.target !== 'ally') return false;
  const caster = state.party.find((c) => c.id === casterId);
  const target = state.party.find((c) => c.id === targetId);
  if (!caster || !target || !caster.spells.includes(spellId)) return false;
  if (target.stats.hp <= 0 || target.stats.hp >= target.stats.maxHp) return false;
  const cost = effectiveSpellCost(spellId);
  if (caster.stats.mp < cost) return false;
  caster.stats.mp -= cost;
  const heal = Math.round(spell.power + caster.stats.int * 0.5 + (caster.gear?.healBonus ?? 0));
  target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + heal);
  saveProgress();
  return true;
}

// Depth-tiered gear that can drop from battles; elites drop it far more often.
const GEAR_DROPS: Record<number, string[]> = {
  1: ['tide_ring', 'moonveil_charm'],
  2: ['tide_ring', 'moonveil_charm'],
  3: ['tidewarden_mail', 'vampire_fang'],
  4: ['tidewarden_mail', 'vampire_fang'],
  5: ['ashenguard_plate', 'cinder_band'],
  6: ['ashenguard_plate', 'cinder_band'],
  7: ['geode_plate', 'prism_band'],
  8: ['geode_plate', 'prism_band'],
};

// Depth-tiered sell junk, one flavor per chapter.
const JUNK_DROPS: Record<number, string> = {
  1: 'wolf_pelt', 2: 'wolf_pelt',
  3: 'tide_pearl', 4: 'tide_pearl',
  5: 'cinder_shard', 6: 'cinder_shard',
  7: 'prism_shard', 8: 'prism_shard',
};

export function grantBattleLoot(depth: number, boss: boolean, elite = false): string[] {
  const drops: string[] = [];
  const junk = JUNK_DROPS[depth] ?? 'tide_pearl';
  const pearlChance = boss || elite ? 1 : 0.45 + depth * 0.05;
  if (Math.random() < pearlChance) {
    const id = boss ? 'warden_sigils' : junk;
    const count = boss || elite ? 2 : 1;
    addItem(id, count);
    drops.push(`${ITEMS[id].name} x${count}`);
  }
  if (!boss && Math.random() < (elite ? 0.6 : 0.16)) {
    addItem('tonic', 1);
    drops.push('Aether Tonic x1');
  }
  if (!boss && Math.random() < (elite ? 0.3 : 0.08)) {
    addItem('purifying_draught', 1);
    drops.push('Purifying Draught x1');
  }
  if (elite && Math.random() < 0.25) {
    addItem('phoenix_down', 1);
    drops.push('Phoenix Down x1');
  }
  if (!boss && Math.random() < (elite ? 0.4 : 0.12)) {
    const pool = (GEAR_DROPS[depth] ?? []).filter((id) => !save.equipmentOwned.includes(id));
    const gear = pool[Math.floor(Math.random() * pool.length)];
    if (gear && grantEquipment(gear)) drops.push(`${EQUIPMENT[gear].name}!`);
  }
  saveProgress();
  return drops;
}

export function addItem(itemId: string, count: number): void {
  state.inventory[itemId] = (state.inventory[itemId] ?? 0) + count;
}

export function grantEquipment(itemId: string): boolean {
  if (!EQUIPMENT[itemId] || save.equipmentOwned.includes(itemId)) return false;
  save.equipmentOwned.push(itemId);
  return true;
}

// --- Equipment --------------------------------------------------------------

export function ownedEquipment() {
  return save.equipmentOwned.map((id) => EQUIPMENT[id]).filter((e) => e != null);
}

export function equipmentPrice(itemId: string): number | undefined {
  if (!EQUIPMENT[itemId]) return undefined;
  const prices: Record<string, number> = {
    tide_ring: 90,
    moonveil_charm: 80,
    reef_mail: 120,
    oracle_lantern: 150,
    aether_loop: 110,
    stormcaller_rod: 140,
    winter_staff: 180,
    dawnstar: 200,
    emberweave_robe: 170,
    // Found gear (sell value = half of this):
    emberfang: 100,
    tidecleaver: 150,
    torens_blade: 155,
    tidewrought_mace: 160,
    tidewarden_mail: 130,
    vampire_fang: 140,
    sunbrand: 220,
    ashenguard_plate: 180,
    cinder_band: 150,
    // Chapter 4 tier:
    stormglass_rod: 220,
    hollowguard_plate: 210,
    prism_band: 190,
    prism_edge: 240,
    geode_plate: 200,
    radiant_mace: 260,
    watchers_ward: 190,
  };
  return prices[itemId] ?? 55;
}

export function equippedFor(memberId: string): Partial<Record<EquipSlot, string>> {
  return save.equipped[memberId] ?? {};
}

export function equipNext(memberId: string, slot: EquipSlot): boolean {
  const member = state.party.find((c) => c.id === memberId);
  if (!member) return false;
  const choices = ownedEquipment().filter((e) => e.slot === slot && e.users.includes(memberId));
  if (choices.length === 0) return false;
  const current = equippedFor(memberId)[slot];
  const idx = choices.findIndex((e) => e.id === current);
  const next = choices[(idx + 1) % choices.length];
  const before = currentEquipmentBonus(memberId);
  unequipFromOthers(next.id, memberId);
  save.equipped[memberId] = { ...equippedFor(memberId), [slot]: next.id };
  const after = currentEquipmentBonus(memberId);
  applyStatDelta(member, before, -1);
  applyStatDelta(member, after, 1);
  clampVitals(member);
  refreshGearEffects(member);
  saveProgress();
  return true;
}

export function equipItem(memberId: string, slot: EquipSlot, itemId?: string): boolean {
  const member = state.party.find((c) => c.id === memberId);
  if (!member) return false;
  if (itemId) {
    const item = EQUIPMENT[itemId];
    if (!item || item.slot !== slot || !item.users.includes(memberId) || !save.equipmentOwned.includes(itemId)) return false;
  }
  const current = equippedFor(memberId)[slot];
  if (current === itemId) return false;
  const before = currentEquipmentBonus(memberId);
  if (itemId) unequipFromOthers(itemId, memberId);
  save.equipped[memberId] = { ...equippedFor(memberId), [slot]: itemId };
  if (!itemId) delete save.equipped[memberId][slot];
  const after = currentEquipmentBonus(memberId);
  applyStatDelta(member, before, -1);
  applyStatDelta(member, after, 1);
  clampVitals(member);
  refreshGearEffects(member);
  saveProgress();
  return true;
}

export function equipmentBonusText(itemId?: string): string {
  if (!itemId) return 'No bonus';
  const item = EQUIPMENT[itemId];
  if (!item) return 'Unknown';
  const parts = Object.entries(item.bonus)
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => `+${value} ${key.toUpperCase()}`);
  return parts.length > 0 ? parts.join('  ') : 'No bonus';
}

export function equipmentPreviewStats(memberId: string, slot: EquipSlot, itemId?: string): Partial<Stats> | null {
  const member = state.party.find((c) => c.id === memberId);
  if (!member) return null;
  if (itemId) {
    const item = EQUIPMENT[itemId];
    if (!item || item.slot !== slot || !item.users.includes(memberId) || !save.equipmentOwned.includes(itemId)) return null;
  }
  const current = equippedFor(memberId);
  const next = { ...current, [slot]: itemId };
  if (!itemId) delete next[slot];
  const before = currentEquipmentBonus(memberId);
  const after = equipmentBonus([next.weapon, next.armor, next.charm]);
  const preview: Partial<Stats> = { ...member.stats };
  for (const [key, value] of Object.entries(before) as Array<[keyof Stats, number]>) {
    preview[key] = (preview[key] ?? 0) - value;
  }
  for (const [key, value] of Object.entries(after) as Array<[keyof Stats, number]>) {
    preview[key] = (preview[key] ?? 0) + value;
  }
  return preview;
}

// --- Party State ------------------------------------------------------------

export function restoreParty(): void {
  for (const c of state.party) {
    c.stats.hp = c.stats.maxHp;
    c.stats.mp = c.stats.maxMp;
    c.defending = false;
    c.ailments = undefined;
    c.speedStatuses = undefined;
    c.limit = 0;
  }
}

/** Back to Sanctuary: full healing, reset depth/boons, roll new modifier. */
export function returnToTown(): void {
  clearRiftArea(); // any active Rift run ends the moment we're safely home
  restoreParty();
  state.depth = 1;
  state.modifier = rollModifier();
  state.boons = [];
  state.springsUsed = [];
  modifierApplied = false;
  saveProgress();
}

/** Raises the permanent Ascension tier and sends the player back to descend
 * again — levels/gear/gold/flags are untouched, only postgame difficulty and
 * rewards scale with the tier (see makeEncounterForArea in chapters.ts). */
export function ascend(): void {
  save.ngPlus += 1;
  track('ngplus_start', { tier: save.ngPlus });
  returnToTown();
}

/** Called in DescentScene.create() — applies startHpFactor once per run. */
export function applyDescentModifier(): void {
  if (modifierApplied) return;
  modifierApplied = true;
  const f = state.modifier.startHpFactor;
  if (!f) return;
  for (const c of state.party) {
    c.stats.hp = Math.max(1, Math.round(c.stats.maxHp * f));
  }
}

export function partyWiped(): boolean {
  return state.party.every((c) => c.stats.hp <= 0);
}

/** Deletes all progression for a fresh start. */
export function hardReset(): void {
  wipeSave();
  save = loadSave();
  state = buildRun();
}

function applyEquipment(c: Combatant): void {
  applyStatDelta(c, currentEquipmentBonus(c.id), 1);
  clampVitals(c);
  refreshGearEffects(c);
}

/** Recomputes weapon element/inflict and passive gear effects from equipped items. */
function refreshGearEffects(c: Combatant): void {
  const slots = equippedFor(c.id);
  const fx = gearFor([slots.weapon, slots.armor, slots.charm]);
  c.attackElement = fx.attackElement;
  c.attackInflict = fx.attackInflict;
  c.gear = fx.gear;
}

function currentEquipmentBonus(memberId: string): Partial<Stats> {
  const slots = equippedFor(memberId);
  return equipmentBonus([slots.weapon, slots.armor, slots.charm]);
}

function applyStatDelta(c: Combatant, bonus: Partial<Stats>, sign: 1 | -1): void {
  for (const [key, value] of Object.entries(bonus) as Array<[keyof Stats, number]>) {
    c.stats[key] += value * sign;
    if (key === 'maxHp') c.stats.hp += value * sign;
    if (key === 'maxMp') c.stats.mp += value * sign;
  }
}

function clampVitals(c: Combatant): void {
  c.stats.hp = Math.max(0, Math.min(c.stats.hp, c.stats.maxHp));
  c.stats.mp = Math.max(0, Math.min(c.stats.mp, c.stats.maxMp));
}

const STARTER_LOCKED = new Set(STARTING_EQUIPMENT);

function isEquipped(itemId: string): boolean {
  return Object.values(save.equipped).some((slots) => Object.values(slots).includes(itemId));
}

/** memberId of whoever else currently wears this item, if any — lets the UI
 * warn before an equip silently pulls it off them. */
export function equippedByOther(itemId: string, exceptMemberId: string): string | undefined {
  for (const [memberId, slots] of Object.entries(save.equipped)) {
    if (memberId === exceptMemberId) continue;
    if (Object.values(slots).includes(itemId)) return memberId;
  }
  return undefined;
}

/** Each owned copy of gear can only be worn by one party member at a time —
 * equipping it elsewhere pulls it off whoever currently has it on. */
function unequipFromOthers(itemId: string, exceptMemberId: string): void {
  for (const other of state.party) {
    if (other.id === exceptMemberId) continue;
    const slots = equippedFor(other.id);
    const slot = (Object.keys(slots) as EquipSlot[]).find((s) => slots[s] === itemId);
    if (!slot) continue;
    const before = currentEquipmentBonus(other.id);
    delete save.equipped[other.id][slot];
    const after = currentEquipmentBonus(other.id);
    applyStatDelta(other, before, -1);
    applyStatDelta(other, after, 1);
    clampVitals(other);
    refreshGearEffects(other);
  }
}

function grantRewards(rewards: typeof QUESTS[number]['rewards']): void {
  if (!rewards) return;
  if (rewards.gold) state.gold += rewards.gold;
  for (const [id, count] of Object.entries(rewards.items ?? {})) addItem(id, count);
  for (const id of rewards.equipment ?? []) grantEquipment(id);
}

export function rewardTextForQuest(id: string): string {
  const quest = QUESTS.find((q) => q.id === id);
  return quest ? questRewardText(quest) : '';
}
