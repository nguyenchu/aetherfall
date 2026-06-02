// Turbasert kampmotor — spillets «sjel». Rundebasert i FF1-ånd:
//   1. Inntastingsfase: hvert levende party-medlem velger en handling.
//   2. Oppgjørsfase: alle aktører (party + fiender) sorteres etter AGI og
//      utfører handlingene sine; døde hoppes over.
//   3. Sjekk seier/tap, ellers ny runde.
//
// Motoren er ren (ingen Phaser): den muterer Combatant-stats og returnerer
// en liste BattleEvent som scenen spiller av med tekst/animasjon.

import { ITEMS, SPELLS } from './content';
import type { BattleEvent, BattlePhase, Combatant, Command } from './types';

function rnd(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export class Battle {
  readonly party: Combatant[];
  readonly enemies: Combatant[];
  phase: BattlePhase = 'input';
  goldWon = 0;

  private commands = new Map<string, Command>();

  /** Delt inventar (item-id -> antall) — muteres når gjenstander brukes. */
  constructor(party: Combatant[], enemies: Combatant[], private inventory: Record<string, number>) {
    this.party = party;
    this.enemies = enemies;
  }

  all(): Combatant[] {
    return [...this.party, ...this.enemies];
  }

  byId(id: string): Combatant | undefined {
    return this.all().find((c) => c.id === id);
  }

  living(side: 'party' | 'enemy'): Combatant[] {
    const list = side === 'party' ? this.party : this.enemies;
    return list.filter((c) => c.stats.hp > 0);
  }

  // --- Inntastingsfase ------------------------------------------------------

  setCommand(id: string, cmd: Command): void {
    this.commands.set(id, cmd);
  }

  clearCommands(): void {
    this.commands.clear();
  }

  /** Antall levende fiender med gyldig item-bruk osv. håndteres i scenen. */
  itemCount(itemId: string): number {
    return this.inventory[itemId] ?? 0;
  }

  // --- Oppgjørsfase ---------------------------------------------------------

  /**
   * Genererer fiendekommandoer (enkel AI), sorterer alle aktører etter AGI
   * og utfører runden. Returnerer hele hendelsesloggen for runden.
   */
  resolveRound(): BattleEvent[] {
    this.phase = 'resolving';
    const events: BattleEvent[] = [];

    // Nullstill forsvar fra forrige runde før nye handlinger låses inn.
    for (const c of this.all()) c.defending = false;

    for (const e of this.living('enemy')) {
      this.commands.set(e.id, this.enemyAi(e));
    }

    // Flukt avgjøres før alt annet (party prøver å rømme).
    const fleeing = [...this.commands.entries()].find(
      ([id, cmd]) => cmd.type === 'flee' && this.byId(id)?.side === 'party',
    );
    if (fleeing) {
      const partyAgi = avg(this.living('party').map((c) => c.stats.agi));
      const enemyAgi = avg(this.living('enemy').map((c) => c.stats.agi));
      const chance = Math.min(0.9, Math.max(0.25, 0.5 + (partyAgi - enemyAgi) * 0.05));
      if (Math.random() < chance) {
        events.push({ kind: 'flee-ok', text: 'Partyet flyktet!' });
        this.phase = 'fled';
        this.commands.clear();
        return events;
      }
      events.push({ kind: 'flee-fail', text: 'Kunne ikke flykte!' });
    }

    // Turrekkefølge: høyest AGI først, med litt slump for å unngå stivhet.
    const order = [...this.commands.keys()]
      .map((id) => this.byId(id)!)
      .filter((c) => c.stats.hp > 0)
      .sort((a, b) => b.stats.agi + rnd(0, 3) - (a.stats.agi + rnd(0, 3)));

    for (const actor of order) {
      if (actor.stats.hp <= 0) continue; // kan ha falt tidligere i runden
      const cmd = this.commands.get(actor.id);
      if (!cmd) continue;
      this.execute(actor, cmd, events);
      if (this.checkEnd(events)) break;
    }

    this.commands.clear();
    if (this.phase === 'resolving') this.phase = 'input';
    return events;
  }

  private execute(actor: Combatant, cmd: Command, events: BattleEvent[]): void {
    switch (cmd.type) {
      case 'defend': {
        actor.defending = true;
        events.push({ kind: 'defend', text: `${actor.name} forsvarer seg.`, actorId: actor.id });
        return;
      }
      case 'flee':
        return; // håndtert i resolveRound for party; fiender flykter ikke
      case 'attack': {
        const target = this.aliveTargetOr(cmd.targetId, actor.side === 'party' ? 'enemy' : 'party');
        if (!target) return;
        const dmg = this.physicalDamage(actor, target);
        this.applyDamage(target, dmg);
        events.push({ kind: 'attack', text: `${actor.name} treffer ${target.name} for ${dmg}.`, actorId: actor.id, targetId: target.id, amount: dmg });
        this.maybeKo(target, events);
        return;
      }
      case 'spell': {
        const spell = SPELLS[cmd.spellId];
        if (!spell || actor.stats.mp < spell.cost) return;
        actor.stats.mp -= spell.cost;
        if (spell.kind === 'heal') {
          const target = this.aliveTargetOr(cmd.targetId, actor.side) ?? actor;
          const heal = Math.round(spell.power + actor.stats.int * 0.5);
          target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + heal);
          events.push({ kind: 'spell', text: `${actor.name} maner ${spell.name}; ${target.name} +${heal} HP.`, actorId: actor.id, targetId: target.id, amount: -heal });
        } else {
          const target = this.aliveTargetOr(cmd.targetId, actor.side === 'party' ? 'enemy' : 'party');
          if (!target) return;
          const dmg = this.spellDamage(actor, target, spell.power);
          this.applyDamage(target, dmg);
          events.push({ kind: 'spell', text: `${actor.name} maner ${spell.name}; ${target.name} tar ${dmg}.`, actorId: actor.id, targetId: target.id, amount: dmg });
          this.maybeKo(target, events);
        }
        return;
      }
      case 'item': {
        const item = ITEMS[cmd.itemId];
        if (!item || (this.inventory[item.id] ?? 0) <= 0) return;
        this.inventory[item.id]--;
        const target = this.aliveTargetOr(cmd.targetId, actor.side) ?? actor;
        target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + item.power);
        events.push({ kind: 'item', text: `${actor.name} bruker ${item.name}; ${target.name} +${item.power} HP.`, actorId: actor.id, targetId: target.id, amount: -item.power });
        return;
      }
    }
  }

  // --- Skadeformler (FF1-inspirert) ----------------------------------------

  private physicalDamage(a: Combatant, t: Combatant): number {
    let dmg = a.stats.str * 1.6 - t.stats.vit * 0.6;
    dmg *= rnd(0.85, 1.15);
    if (t.defending) dmg *= 0.5;
    return Math.max(1, Math.round(dmg));
  }

  private spellDamage(a: Combatant, t: Combatant, power: number): number {
    let dmg = power + a.stats.int * 0.8 - t.stats.int * 0.2;
    dmg *= rnd(0.9, 1.1);
    if (t.defending) dmg *= 0.75;
    return Math.max(1, Math.round(dmg));
  }

  private applyDamage(t: Combatant, dmg: number): void {
    t.stats.hp = Math.max(0, t.stats.hp - dmg);
  }

  private maybeKo(t: Combatant, events: BattleEvent[]): void {
    if (t.stats.hp <= 0) {
      events.push({ kind: 'ko', text: `${t.name} faller.`, targetId: t.id });
    }
  }

  // --- AI -------------------------------------------------------------------

  private enemyAi(e: Combatant): Command {
    const targets = this.living('party');
    if (targets.length === 0) return { type: 'defend' };
    const target = targets[Math.floor(Math.random() * targets.length)];

    // Kast besvergelse av og til hvis MP tillater det.
    const castable = e.spells.filter((s) => SPELLS[s] && e.stats.mp >= SPELLS[s].cost);
    if (castable.length > 0 && Math.random() < 0.4) {
      return { type: 'spell', spellId: castable[0], targetId: target.id };
    }
    return { type: 'attack', targetId: target.id };
  }

  // --- Hjelpere -------------------------------------------------------------

  /** Faller tilbake til et levende mål på riktig side om det opprinnelige er dødt. */
  private aliveTargetOr(id: string, side: 'party' | 'enemy'): Combatant | undefined {
    const t = this.byId(id);
    if (t && t.stats.hp > 0) return t;
    return this.living(side)[0];
  }

  private checkEnd(events: BattleEvent[]): boolean {
    if (this.living('enemy').length === 0) {
      this.goldWon = this.enemies.reduce((sum, e) => sum + (e.goldReward ?? 0), 0);
      events.push({ kind: 'info', text: `Seier! +${this.goldWon} gull.` });
      this.phase = 'won';
      return true;
    }
    if (this.living('party').length === 0) {
      events.push({ kind: 'info', text: 'Partyet er beseiret …' });
      this.phase = 'lost';
      return true;
    }
    return false;
  }
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
