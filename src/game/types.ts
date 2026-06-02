// Kjernedatatyper for kampsystemet. Holdes rent (ingen Phaser) slik at
// kamplogikken kan testes og gjenbrukes uavhengig av presentasjonen.

export type Side = 'party' | 'enemy';
export type Element = 'fire' | 'ice' | 'holy' | 'none';

export interface Stats {
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  str: number; // fysisk angrepskraft
  agi: number; // turrekkefølge + flukt
  vit: number; // forsvar
  int: number; // magisk kraft
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
  kind: 'heal';
  power: number;
  target: 'ally';
}

/** Én aktør i kamp — både helter og fiender deler denne formen. */
export interface Combatant {
  id: string;
  name: string;
  side: Side;
  stats: Stats;
  spells: string[]; // spell-id-er denne kan bruke
  spriteKey: string;
  color: number;
  size: number; // pikselbredde/-høyde på plassholder-sprite
  goldReward?: number; // kun fiender
  // Kjøretids-kamptilstand:
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

/** Ett steg i kampens logg — scenen spiller disse av med animasjon/tekst. */
export interface BattleEvent {
  kind: EventKind;
  text: string;
  actorId?: string;
  targetId?: string;
  amount?: number; // skade (positiv) eller helbredelse (negativ)
}

export type BattlePhase = 'input' | 'resolving' | 'won' | 'lost' | 'fled';
