// Core data types for the battle system. Kept pure with no Phaser so battle
// logic can be tested and reused independently from presentation.

export type Side = 'party' | 'enemy';
export type Element = 'fire' | 'ice' | 'holy' | 'none';

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
  target: 'enemy' | 'ally';
}

export interface Item {
  id: string;
  name: string;
  kind: 'heal' | 'mp' | 'sell';
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
  // Progression (party only):
  level?: number;
  xp?: number;
  growth?: Partial<Stats>; // stat increase per level
  // Runtime battle state:
  defending?: boolean;
}

export type Command =
  | { type: 'attack'; targetId: string }
  | { type: 'spell'; spellId: string; targetId: string }
  | { type: 'item'; itemId: string; targetId: string }
  | { type: 'defend' }
  | { type: 'flee' };

export type EventKind =
  | 'attack'
  | 'spell'
  | 'item'
  | 'defend'
  | 'flee-ok'
  | 'flee-fail'
  | 'ko'
  | 'info';

/** One battle log step; the scene plays these with animation and text. */
export interface BattleEvent {
  kind: EventKind;
  text: string;
  actorId?: string;
  targetId?: string;
  amount?: number; // damage (positive) or healing (negative)
  element?: string; // for spell visual effects
}

export type BattlePhase = 'input' | 'resolving' | 'won' | 'lost' | 'fled';
