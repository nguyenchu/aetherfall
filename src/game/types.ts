// Core data types for the battle system. Kept pure with no Phaser so battle
// logic can be tested and reused independently from presentation.

export type Side = 'party' | 'enemy';
export type Element = 'phys' | 'fire' | 'ice' | 'holy' | 'none';

// Status ailments. All tick down at the start of the afflicted combatant's
// own next turn (CTB — see battle.ts):
//   burn  - fire DoT (6% of max HP per tick)
//   chill - initiative halved and -25% damage dealt
//   venom - poison DoT (5% of max HP per tick)
export type Ailment = 'burn' | 'chill' | 'venom';

/** Chance-based ailment application, used by spells and enemy attacks. */
export interface Inflict {
  ailment: Ailment;
  chance: number; // 0..1
  rounds: number;
}

/** Haste/Slow-style turn-order modifiers (CTB queue). Mechanism only for now
 * — nothing grants these yet; see battle.ts effectiveSpeed(). */
export type SpeedSource = 'haste' | 'slow';
export interface SpeedStatus {
  mult: number; // multiplies effective speed
  turns: number; // remaining turns of the bearer's own
}

/** Aggregated passive effects from equipped gear (party members). */
export interface GearEffects {
  critBonus: number; // added to base crit chance
  lifesteal: number; // fraction of attack damage returned as HP
  mpRegen: number; // MP restored each round
  guardChipBonus: number; // extra guard pips removed on weakness hits
  healBonus: number; // flat bonus to healing spells cast
  resist: Ailment[]; // ailments this member is immune to
  speedMult?: number; // permanent turn-order speed multiplier (unused so far)
}

export interface Stats {
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  str: number; // physical attack power
  agi: number; // turn order + fleeing
  vit: number; // defense
  int: number; // magic power
}

export interface Spell {
  id: string;
  name: string;
  cost: number;
  kind: 'damage' | 'heal';
  power: number;
  element: Element;
  target: 'enemy' | 'ally' | 'all-enemies' | 'party';
  guardHit?: number; // extra guard chip even without hitting a weakness
  inflict?: Inflict; // chance to apply an ailment to damaged targets
  desc?: string;
}

export interface Item {
  id: string;
  name: string;
  // heal/mp restore `power` as a flat amount; revive restores `power` as a
  // fraction of max HP (e.g. 0.4 = 40%); cure clears all ailments and
  // ignores `power`; sell has no field use beyond trading it in.
  kind: 'heal' | 'mp' | 'sell' | 'cure' | 'revive';
  power: number;
  target: 'ally' | 'none';
  buyPrice?: number;
  sellPrice: number;
  description: string;
}

/** One battle actor; heroes and enemies share this shape. */
export interface Combatant {
  id: string;
  name: string;
  side: Side;
  stats: Stats;
  spells: string[]; // spell ids this combatant can use
  spriteKey: string;
  color: number;
  size: number; // placeholder sprite pixel width / height
  goldReward?: number; // enemies only
  xpReward?: number; // enemies only
  isBoss?: boolean;
  isElite?: boolean; // tougher guardian fight: better loot + epic boon odds
  phaseTriggered?: boolean; // boss phase 2 already activated
  // Weakness & break (enemies):
  weakness?: Element[]; // elements that deal +50% and chip guard
  maxGuard?: number; // guard pips before breaking
  guard?: number; // current guard pips
  broken?: boolean; // staggered: loses its actions, takes +50% damage; recovers on its own next turn
  // Telegraphed intent for the coming round (enemies):
  intent?: Command;
  // Status ailments: own-turns remaining per ailment. Cleared out of battle.
  ailments?: Partial<Record<Ailment, number>>;
  // Basic attacks may inflict an ailment (enemy nature or party weapon).
  attackInflict?: Inflict;
  // Basic attacks may also drag the target's turn-order speed down (e.g.
  // Tide Warden's Undertow, Sunken's Tomb Crawler) — mirrors attackInflict.
  attackSpeedDebuff?: { mult: number; turns: number };
  // Basic attacks strike as this element (party: from weapon). Default phys.
  attackElement?: Element;
  // Enemy-only: escalates its own speedStatuses.haste by this much every one
  // of its own turns (Prism Sovereign's Overcharge, Ashen's Ember Hound).
  enrageOnOwnTurn?: number;
  // Enemy-only: reflects this fraction of a non-weakness hit's damage back
  // at the attacker (Crystal's Prism Sprite).
  reflectFrac?: number;
  // Passive effects from equipped gear (party only).
  gear?: GearEffects;
  // Progression (party only):
  level?: number;
  xp?: number;
  growth?: Partial<Stats>; // stat increase per level
  learnset?: Record<number, string[]>; // level -> spell ids learned
  // Runtime battle state:
  defending?: boolean;
  // CTB turn queue (battle.ts): count-time readiness and Haste/Slow stack.
  readiness?: number;
  speedStatuses?: Partial<Record<SpeedSource, SpeedStatus>>;
}

export type Command =
  | { type: 'attack'; targetId: string }
  | { type: 'spell'; spellId: string; targetId: string }
  | { type: 'item'; itemId: string; targetId: string }
  | { type: 'defend' }
  | { type: 'flee' }
  | { type: 'phase' };

export type EventKind =
  | 'attack'
  | 'spell'
  | 'item'
  | 'defend'
  | 'flee-ok'
  | 'flee-fail'
  | 'ko'
  | 'info'
  | 'phase'
  | 'break'
  | 'recover'
  | 'ailment' // an ailment was applied
  | 'dot'; // end-of-round burn/venom damage tick

/** One battle log step; the scene plays these with animation and text. */
export interface BattleEvent {
  kind: EventKind;
  text: string;
  actorId?: string;
  targetId?: string;
  amount?: number; // damage (positive) or healing (negative)
  element?: string; // for spell visual effects
  crit?: boolean; // critical hit
  weak?: boolean; // hit a weakness
  ailment?: Ailment; // for 'ailment'/'dot' events: which status is involved
}

export type BattlePhase = 'input' | 'won' | 'lost' | 'fled';
