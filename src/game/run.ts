// Runtime game state: living party, gold, inventory, and current depth.
//
// A run is one descent from Sanctuary to the bottom of the world (all six
// strata, depth 1-12) or until the party falls. Everything inside a run —
// levels, talents, boons, gold, found gear — is lost when it ends; what the
// Anchor keeps is Echoes (meta.ts), spent on permanent upgrades in Sanctuary.
// The run in progress is snapshotted into the save so it survives a reload.

import { track } from './analytics';
import { boonTotals, rollBoonChoices, type Boon, type BoonTotals } from './boons';
import { clearRiftArea, clearRoomArea, TOTAL_CHAPTERS, type ChestContents } from './chapters';
import { isCombatRoom, type RoomKind, type RoomProgress } from './rooms';
import { ITEMS, SPELLS, makeParty } from './content';
import { DEFAULT_EQUIPPED, EQUIPMENT, STARTING_EQUIPMENT, equipmentBonus, gearFor, type EquipSlot } from './equipment';
import { MODIFIERS, rollModifier, type RunModifier } from './modifiers';
import { emptyTally, echoesForRun, nextRankCost, type EchoBreakdown, type RunTally } from './meta';
import { restoreLevel } from './progression';
import { QUESTS, questRewardText, type QuestDef } from './quests';
import { loadSave, writeSave, wipeSave, type SaveData } from './save';
import { reportSaveResult } from './saveStatus';
import { applyTalent, rollTalentChoices, talentPerks, type Talent } from './talents';
import type { Combatant, Stats } from './types';

export interface RunState {
  /** True from the moment the party descends until the run's summary. */
  active: boolean;
  party: Combatant[];
  gold: number;
  inventory: Record<string, number>;
  depth: number;
  modifier: RunModifier;
  /** Boon ids picked this run; cleared when returning to Sanctuary. */
  boons: string[];
  /** Healing springs used this run ('depth_col,row'); reset in town. */
  springsUsed: string[];
  /** Progress through the current chapter entrance's generated rooms
   *  (rooms.ts); null outside them (Sanctuary, boss strata, the Rift). */
  room: RoomProgress | null;
  /** Used fights/chests on the fixed boss maps this run ('enc_4_11,7'). */
  usedTiles: string[];
  /** What this run has done so far, paid out as Echoes at the end. */
  tally: RunTally;
  /** Talent/blessing rerolls left this run (Anchor upgrade). */
  rerolls: number;
  /** Anchor's Mercy charges left: a wipe is undone while > 0. */
  mercy: number;
  /** Talent picks waiting per hero id (earned on level-ups). */
  pendingTalents: Record<string, number>;
  /** Name of the strongest foe in the last fight, for the run recap. */
  lastFoe?: string;
}

/** Sanctuary's starting stock for every run (before Anchor upgrades). */
const BASE_START_ITEMS: Record<string, number> = { potion: 2 };
const START_GOLD_PER_PURSE = 40;
const VITALITY_PER_RANK = 0.08;
const FOCUS_PER_RANK = 4;
const XP_PER_SCHOLAR = 0.15;
/** Between strata the Anchor's pull steadies the party a little. */
const STRATUM_HEAL = 0.3;

let save: SaveData = loadSave();
let state: RunState = buildRun();
let modifierApplied = false;

function townState(): RunState {
  return {
    active: false,
    party: freshParty(),
    gold: save.gold,
    inventory: { ...save.items },
    depth: 1,
    modifier: rollModifier(),
    boons: [],
    springsUsed: [],
    room: null,
    usedTiles: [],
    tally: emptyTally(),
    rerolls: 0,
    mercy: 0,
    pendingTalents: {},
  };
}

function buildRun(): RunState {
  const restored = restoreSnapshot(save.run);
  if (restored) {
    modifierApplied = true; // its start-of-run effects already happened
    return restored;
  }
  save.run = null;
  return townState();
}

export function upgradeRank(id: string): number {
  return save.upgrades[id] ?? 0;
}

/** A level-1 party (plus Veteran's Start), with Anchor upgrades and the gear
 *  currently equipped in Sanctuary applied, at full health. */
function freshParty(): Combatant[] {
  const party = makeParty();
  for (const c of party) {
    restoreLevel(c, 1 + upgradeRank('veteran'));
    c.stats.maxHp = Math.round(c.stats.maxHp * (1 + VITALITY_PER_RANK * upgradeRank('vitality')));
    c.stats.maxMp += FOCUS_PER_RANK * upgradeRank('focus');
    c.stats.hp = c.stats.maxHp;
    c.stats.mp = c.stats.maxMp;
    applyEquipment(c);
    c.stats.hp = c.stats.maxHp;
    c.stats.mp = c.stats.maxMp;
  }
  return party;
}

export function getRun(): RunState {
  return state;
}

export function getSave(): SaveData {
  return save;
}

/** Writes runtime progress back to the localStorage save; false if it failed. */
export function saveProgress(): boolean {
  save.gold = state.gold;
  save.items = { ...state.inventory };
  save.potions = state.inventory.potion ?? 0;
  if (state.depth > save.deepest) save.deepest = state.depth;
  if (state.active) {
    if (state.depth > state.tally.deepest) state.tally.deepest = state.depth;
    save.run = snapshot();
  }
  const saved = writeSave(save);
  reportSaveResult(saved);
  return saved;
}

// --- Run lifecycle ------------------------------------------------------------

/** Called as the party steps through Sanctuary's portal. Rebuilds the party
 *  so Anchor upgrades bought since the last run apply, keeps the gold, items
 *  and gear bought in town, and resets everything run-scoped. */
export function startRun(): void {
  clearRiftArea();
  clearRoomArea();
  save.runs += 1;
  state = {
    ...townState(),
    active: true,
    gold: state.gold,
    inventory: { ...state.inventory },
    rerolls: upgradeRank('reroll'),
    mercy: upgradeRank('mercy') > 0 ? 1 + (upgradeRank('mercy') > 1 ? 1 : 0) : 0,
  };
  modifierApplied = false;
  track('run_start', { n: save.runs, asc: save.ngPlus });
  saveProgress();
}

export function isRunActive(): boolean {
  return state.active;
}

/** Ends the run: banks Echoes, records how it went, and resets Sanctuary's
 *  stock for the next one. Safe to call twice (the second call is a no-op
 *  that returns the first payout). */
let lastPayout: EchoBreakdown | null = null;
export function finishRun(result: 'wipe' | 'retreat' | 'clear'): EchoBreakdown {
  if (!state.active) return lastPayout ?? { lines: [], total: 0 };
  const payout = echoesForRun(state.tally, state.gold, save.ngPlus, result === 'clear');
  save.echoes += payout.total;
  save.bestDepth = Math.max(save.bestDepth, state.tally.deepest, state.depth);
  if (result === 'clear') {
    save.clears += 1;
    save.ngPlus += 1;
    track('ngplus_start', { tier: save.ngPlus });
  }
  save.lastRun = { result, depth: state.depth, echoes: payout.total, foe: result === 'wipe' ? state.lastFoe : undefined };
  track('run_payout', { r: result, d: state.depth, e: payout.total });
  state.active = false;
  save.run = null;
  lastPayout = payout;
  resetTownStock();
  return payout;
}

/** Gold, items and gear go back to what the Anchor grants every run. */
function resetTownStock(): void {
  state.gold = START_GOLD_PER_PURSE * upgradeRank('purse');
  const items: Record<string, number> = { ...BASE_START_ITEMS };
  items.potion = (items.potion ?? 0) + upgradeRank('satchel');
  if (upgradeRank('satchel') >= 3) items.phoenix_down = 1;
  state.inventory = items;
  save.equipmentOwned = [...STARTING_EQUIPMENT];
  save.equipped = structuredClone(DEFAULT_EQUIPPED);
}

/** Buys the next rank of an Anchor upgrade with Echoes. */
export function buyUpgrade(id: string): boolean {
  const cost = nextRankCost(id, upgradeRank(id));
  if (cost == null || save.echoes < cost || state.active) return false;
  save.echoes -= cost;
  save.upgrades[id] = upgradeRank(id) + 1;
  // Starting stock upgrades show up in town right away.
  if (id === 'purse') state.gold += START_GOLD_PER_PURSE;
  if (id === 'satchel') {
    state.inventory.potion = (state.inventory.potion ?? 0) + 1;
    if (upgradeRank('satchel') >= 3) state.inventory.phoenix_down = Math.max(1, state.inventory.phoenix_down ?? 0);
  }
  state.party = freshParty();
  track('upgrade_buy', { id, rank: upgradeRank(id) });
  saveProgress();
  return true;
}

/** Leaving a boss stratum for the next chapter's rooms: KO'd heroes stand
 *  back up and everyone recovers a little. */
export function steadyBetweenStrata(): void {
  for (const c of state.party) {
    if (c.stats.hp <= 0) c.stats.hp = 1;
    c.stats.hp = Math.min(c.stats.maxHp, c.stats.hp + Math.round(c.stats.maxHp * STRATUM_HEAL));
    c.stats.mp = Math.min(c.stats.maxMp, c.stats.mp + Math.round(c.stats.maxMp * STRATUM_HEAL));
    c.ailments = undefined;
  }
}

export function isFinalDepth(depth: number): boolean {
  return depth >= TOTAL_CHAPTERS * 2;
}

export function xpMultiplier(): number {
  return 1 + XP_PER_SCHOLAR * upgradeRank('scholar');
}

export function recordVictory(kind: 'fight' | 'elite' | 'boss', chapter: number, foe?: string): void {
  if (!state.active) return;
  if (kind === 'boss') state.tally.bossChapters.push(chapter);
  else if (kind === 'elite') state.tally.elites++;
  else state.tally.fights++;
  if (foe) state.lastFoe = foe;
}

export function recordFoe(name: string): void {
  state.lastFoe = name;
}

export function recordRoom(): void {
  if (state.active) state.tally.rooms++;
}

/** Spends one Anchor's Mercy charge; true if the wipe should be undone. */
export function consumeMercy(): boolean {
  if (state.mercy <= 0) return false;
  state.mercy--;
  return true;
}

// --- Talents --------------------------------------------------------------------

export function talentChoiceCount(): number {
  return 3 + upgradeRank('insight');
}

export function addPendingTalents(heroId: string, picks: number): void {
  if (picks <= 0) return;
  state.pendingTalents[heroId] = (state.pendingTalents[heroId] ?? 0) + picks;
}

export function rollTalentsFor(heroId: string): Talent[] {
  const hero = state.party.find((c) => c.id === heroId);
  return hero ? rollTalentChoices(hero, talentChoiceCount()) : [];
}

export function pickTalent(heroId: string, talentId: string): void {
  const hero = state.party.find((c) => c.id === heroId);
  if (!hero) return;
  applyTalent(hero, talentId);
  refreshGearEffects(hero);
  state.pendingTalents[heroId] = Math.max(0, (state.pendingTalents[heroId] ?? 0) - 1);
  if (state.pendingTalents[heroId] === 0) delete state.pendingTalents[heroId];
  saveProgress();
}

export function useReroll(): boolean {
  if (state.rerolls <= 0) return false;
  state.rerolls--;
  return true;
}

// --- Boons (run-scoped blessings) --------------------------------------------

export function addBoon(id: string): void {
  if (!state.boons.includes(id)) state.boons.push(id);
}

/** Aggregated boon effects for the current run. */
export function runBoons(): BoonTotals {
  return boonTotals(state.boons);
}

/** Blessing choices for this run; the Favored upgrade tilts ordinary picks
 *  toward the elite (rare/epic) table. */
export function rollBoons(elite = false): Boon[] {
  const favored = !elite && Math.random() < 0.3 * upgradeRank('fortune');
  return rollBoonChoices(state.boons, elite || favored);
}

// --- Run snapshot (resume after reload) ----------------------------------------

interface RunSnapshot {
  depth: number;
  party: Combatant[];
  boons: string[];
  modifierId: string;
  springsUsed: string[];
  room: { index: number; kind: RoomKind } | null;
  usedTiles: string[];
  tally: RunTally;
  rerolls: number;
  mercy: number;
  pendingTalents: Record<string, number>;
  lastFoe?: string;
}

function snapshot(): Record<string, unknown> {
  const snap: RunSnapshot = {
    depth: state.depth,
    party: state.party.map((c) => ({ ...c, intent: undefined, readiness: undefined, defending: false, gear: undefined })),
    boons: [...state.boons],
    modifierId: state.modifier.id,
    springsUsed: [...state.springsUsed],
    room: state.room ? { index: state.room.index, kind: state.room.kind } : null,
    usedTiles: [...state.usedTiles],
    tally: { ...state.tally, bossChapters: [...state.tally.bossChapters] },
    rerolls: state.rerolls,
    mercy: state.mercy,
    pendingTalents: { ...state.pendingTalents },
    lastFoe: state.lastFoe,
  };
  return JSON.parse(JSON.stringify(snap)) as Record<string, unknown>;
}

function restoreSnapshot(raw: Record<string, unknown> | null): RunState | null {
  if (!raw) return null;
  try {
    const snap = raw as unknown as RunSnapshot;
    if (typeof snap.depth !== 'number' || !Array.isArray(snap.party) || snap.party.length !== 3) return null;
    const fresh = makeParty();
    const party = snap.party.map((c, i) => {
      if (!c || typeof c !== 'object' || !c.stats || typeof c.stats.maxHp !== 'number') throw new Error('bad hero');
      // Code-defined fields (growth curves, sprite keys) come from content.ts
      // so a balance change reaches resumed runs too.
      const base = fresh.find((f) => f.id === c.id) ?? fresh[i];
      return { ...c, growth: base.growth, spriteKey: base.spriteKey, color: base.color, learnset: {} } as Combatant;
    });
    for (const c of party) refreshGearEffects(c);
    const room = snap.room && isCombatRoom(snap.room.kind) !== undefined
      ? { index: snap.room.index, kind: snap.room.kind, cleared: !isCombatRoom(snap.room.kind), done: [] }
      : null;
    return {
      active: true,
      party,
      gold: save.gold,
      inventory: { ...save.items },
      depth: snap.depth,
      modifier: MODIFIERS.find((m) => m.id === snap.modifierId) ?? MODIFIERS[0],
      boons: Array.isArray(snap.boons) ? snap.boons : [],
      springsUsed: Array.isArray(snap.springsUsed) ? snap.springsUsed : [],
      room,
      usedTiles: Array.isArray(snap.usedTiles) ? snap.usedTiles : [],
      tally: { ...emptyTally(), ...(snap.tally ?? {}) },
      rerolls: typeof snap.rerolls === 'number' ? snap.rerolls : 0,
      mercy: typeof snap.mercy === 'number' ? snap.mercy : 0,
      pendingTalents: snap.pendingTalents ?? {},
      lastFoe: snap.lastFoe,
    };
  } catch {
    return null;
  }
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

// --- Story Flags ------------------------------------------------------------

export function hasFlag(flag: string): boolean {
  return save.flags.includes(flag);
}

export function setFlag(flag: string): void {
  if (!save.flags.includes(flag)) {
    save.flags.push(flag);
    reportSaveResult(writeSave(save));
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

/** Milestone/delivery quests have no NPC or boss to trigger them — call
 * this whenever the player is somewhere safe to check in (Sanctuary) and
 * complete anything whose condition is now met. Returns whichever quests
 * completed just now, so the caller can show a notice. */
export function checkMilestoneQuests(): QuestDef[] {
  const completed: QuestDef[] = [];
  const tryComplete = (id: string, met: boolean) => {
    if (!met || !isQuestActive(id)) return;
    const q = completeQuest(id);
    if (q) completed.push(q);
  };
  tryComplete('milestone_level10', state.party.some((c) => (c.level ?? 1) >= 10));
  tryComplete('milestone_boons', state.boons.length >= 6);
  tryComplete('milestone_gold', state.gold >= 500);
  tryComplete('milestone_depth9', state.depth >= 9);
  if (isQuestActive('bounty_sigils') && (state.inventory.warden_sigils ?? 0) >= 5) {
    state.inventory.warden_sigils -= 5;
    const q = completeQuest('bounty_sigils');
    if (q) completed.push(q);
  }
  return completed;
}

// --- Sanctuary Economy ------------------------------------------------------

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
  9: ['windrent_plate', 'thunderhead_band'],
  10: ['windrent_plate', 'thunderhead_band'],
  11: ['frostbitten_plate', 'glacial_band'],
  12: ['frostbitten_plate', 'glacial_band'],
};

// Depth-tiered sell junk, one flavor per chapter.
const JUNK_DROPS: Record<number, string> = {
  1: 'wolf_pelt', 2: 'wolf_pelt',
  3: 'tide_pearl', 4: 'tide_pearl',
  5: 'cinder_shard', 6: 'cinder_shard',
  7: 'prism_shard', 8: 'prism_shard',
  9: 'storm_shard', 10: 'storm_shard',
  11: 'frost_shard', 12: 'frost_shard',
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
    consecrated_censer: 160,
    serpents_kiss: 155,
    fracture_band: 145,
    tidebound_tome: 145,
    tidewoven_robe: 135,
    sunbrand: 220,
    ashenguard_plate: 180,
    cinder_band: 150,
    // Chapter 4 tier:
    stormglass_rod: 220,
    hollowguard_plate: 210,
    prism_band: 190,
    prism_edge: 240,
    geode_plate: 200,
    prism_veil: 205,
    radiant_mace: 260,
    watchers_ward: 190,
    // Chapter 5 tier:
    tempest_rod: 240,
    stormguard_plate: 235,
    thunderhead_band: 215,
    squallblade: 260,
    windrent_plate: 215,
    stormveil_robe: 225,
    stormward_mace: 280,
    // Chapter 6 tier:
    frostbound_rod: 260,
    rimeguard_plate: 250,
    glacial_band: 235,
    rimeglass_blade: 280,
    frostbitten_plate: 235,
    rimeveil_robe: 245,
    frostward_mace: 300,
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

/** Back to Sanctuary: the run (if one is still open) ends as a retreat, and
 *  the party wakes at level 1 with Sanctuary's starting stock. */
export function returnToTown(): void {
  clearRiftArea(); // any active Rift run ends the moment we're safely home
  clearRoomArea();
  if (state.active) finishRun('retreat');
  state = { ...townState(), gold: state.gold, inventory: { ...state.inventory } };
  modifierApplied = false;
  saveProgress();
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
  const perks = talentPerks(c.talents ?? []);
  const gear = { ...fx.gear };
  for (const [key, value] of Object.entries(perks)) {
    const cur = (gear as Record<string, unknown>)[key];
    if (key === 'spellDmgMult') gear.spellDmgMult = (gear.spellDmgMult ?? 1) * (value as number);
    else if (typeof value === 'number') (gear as Record<string, unknown>)[key] = ((cur as number | undefined) ?? 0) + value;
    else (gear as Record<string, unknown>)[key] = value;
  }
  c.gear = gear;
  c.attackElement = perks.holyAttack ? 'holy' : fx.attackElement;
  c.attackInflict = fx.attackInflict;
  c.critInflict = fx.critInflict;
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
