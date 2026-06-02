// Tilstanden for én "run" (nedstigning): partyet, valuta og delt inventar.
// Lever på tvers av kamper slik at HP/MP-tap gir innsats — roguelite-løkka.
// Ved party-wipe nullstiller vi (krystallen henter deg tilbake til Helligdommen).

import { makeParty } from './content';
import type { Combatant } from './types';

export interface RunState {
  party: Combatant[];
  gold: number;
  inventory: Record<string, number>; // item-id -> antall
}

let state: RunState = freshRun();

function freshRun(): RunState {
  return {
    party: makeParty(),
    gold: 0,
    inventory: { potion: 3 },
  };
}

export function getRun(): RunState {
  return state;
}

export function resetRun(): void {
  state = freshRun();
}

/** Helbreder hele partyet til fullt (brukes ved retur til Helligdommen). */
export function restoreParty(): void {
  for (const c of state.party) {
    c.stats.hp = c.stats.maxHp;
    c.stats.mp = c.stats.maxMp;
    c.defending = false;
  }
}

export function partyWiped(): boolean {
  return state.party.every((c) => c.stats.hp <= 0);
}
