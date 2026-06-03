// Turn-based battle engine, the heart of the game. FF1-inspired rounds:
//   1. Input phase: each living party member chooses an action.
//   2. Resolution phase: all actors (party + enemies) are sorted by AGI
//      and execute their actions; defeated actors are skipped.
//   3. Check win/loss, otherwise start a new round.
//
// The engine is pure game logic with no Phaser dependency. It mutates Combatant
// stats and returns BattleEvents for the scene to play with text and animation.

import { ITEMS, SPELLS } from './content';
import { getRun } from './run';
import type { BattleEvent, BattlePhase, Combatant, Command } from './types';

function rnd(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export class Battle {
  readonly party: Combatant[];
  readonly enemies: Combatant[];
  phase: BattlePhase = 'input';
  goldWon = 0;
  xpWon = 0;

  private commands = new Map<string, Command>();

  /** Shared inventory (item id -> count), mutated when items are used. */
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

  // --- Input Phase ----------------------------------------------------------

  setCommand(id: string, cmd: Command): void {
    this.commands.set(id, cmd);
  }

  clearCommands(): void {
    this.commands.clear();
  }

  /** Item validity and living target counts are handled in the scene. */
  itemCount(itemId: string): number {
    return this.inventory[itemId] ?? 0;
  }

  // --- Resolution Phase -----------------------------------------------------

  /**
   * Generates enemy commands, sorts all actors by AGI, and executes the round.
   * Returns the full event log for the round.
   */
  resolveRound(): BattleEvent[] {
    this.phase = 'resolving';
    const events: BattleEvent[] = [];

    // Reset defending from the previous round before locking new actions.
    for (const c of this.all()) c.defending = false;

    for (const e of this.living('enemy')) {
      this.commands.set(e.id, this.enemyAi(e));
    }

    // Fleeing resolves before everything else.
    const fleeing = [...this.commands.entries()].find(
      ([id, cmd]) => cmd.type === 'flee' && this.byId(id)?.side === 'party',
    );
    if (fleeing) {
      const partyAgi = avg(this.living('party').map((c) => c.stats.agi));
      const enemyAgi = avg(this.living('enemy').map((c) => c.stats.agi));
      const chance = Math.min(0.9, Math.max(0.25, 0.5 + (partyAgi - enemyAgi) * 0.05));
      if (Math.random() < chance) {
        events.push({ kind: 'flee-ok', text: 'The party fled!' });
        this.phase = 'fled';
        this.commands.clear();
        return events;
      }
      events.push({ kind: 'flee-fail', text: 'Could not flee!' });
    }

    // Turn order: highest AGI first, with a little randomness to avoid stiffness.
    const order = [...this.commands.keys()]
      .map((id) => this.byId(id)!)
      .filter((c) => c.stats.hp > 0)
      .sort((a, b) => b.stats.agi + rnd(0, 3) - (a.stats.agi + rnd(0, 3)));

    for (const actor of order) {
      if (actor.stats.hp <= 0) continue; // may have fallen earlier in the round
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
        events.push({ kind: 'defend', text: `${actor.name} defends.`, actorId: actor.id });
        return;
      }
      case 'flee':
        return; // handled in resolveRound for party; enemies do not flee
      case 'attack': {
        const target = this.aliveTargetOr(cmd.targetId, actor.side === 'party' ? 'enemy' : 'party');
        if (!target) return;
        const dmg = this.physicalDamage(actor, target);
        this.applyDamage(target, dmg);
        events.push({ kind: 'attack', text: `${actor.name} hits ${target.name} for ${dmg}.`, actorId: actor.id, targetId: target.id, amount: dmg });
        this.maybeKo(target, events);
        return;
      }
      case 'spell': {
        const spell = SPELLS[cmd.spellId];
        const mod = getRun().modifier;
        const effectiveCost = Math.max(0, spell.cost + (actor.side === 'party' ? (mod.spellCostDelta ?? 0) : 0));
        if (!spell || actor.stats.mp < effectiveCost) return;
        actor.stats.mp -= effectiveCost;
        if (spell.kind === 'heal') {
          const target = this.aliveTargetOr(cmd.targetId, actor.side) ?? actor;
          const heal = Math.round(spell.power + actor.stats.int * 0.5);
          target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + heal);
          events.push({ kind: 'spell', text: `${actor.name} casts ${spell.name}; ${target.name} +${heal} HP.`, actorId: actor.id, targetId: target.id, amount: -heal, element: spell.element });
        } else {
          const target = this.aliveTargetOr(cmd.targetId, actor.side === 'party' ? 'enemy' : 'party');
          if (!target) return;
          const dmg = this.spellDamage(actor, target, spell.power);
          this.applyDamage(target, dmg);
          events.push({ kind: 'spell', text: `${actor.name} casts ${spell.name}; ${target.name} takes ${dmg}.`, actorId: actor.id, targetId: target.id, amount: dmg, element: spell.element });
          this.maybeKo(target, events);
        }
        return;
      }
      case 'phase': {
        for (const ev of this.executeBossPhase(actor)) events.push(ev);
        return;
      }
      case 'item': {
        const item = ITEMS[cmd.itemId];
        if (!item || item.target !== 'ally' || (this.inventory[item.id] ?? 0) <= 0) return;
        this.inventory[item.id]--;
        const target = this.aliveTargetOr(cmd.targetId, actor.side) ?? actor;
        if (item.kind === 'heal') {
          target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + item.power);
          events.push({ kind: 'item', text: `${actor.name} uses ${item.name}; ${target.name} +${item.power} HP.`, actorId: actor.id, targetId: target.id, amount: -item.power });
        } else if (item.kind === 'mp') {
          target.stats.mp = Math.min(target.stats.maxMp, target.stats.mp + item.power);
          events.push({ kind: 'item', text: `${actor.name} uses ${item.name}; ${target.name} +${item.power} MP.`, actorId: actor.id, targetId: target.id });
        }
        return;
      }
    }
  }

  // --- Boss Phase Transitions -----------------------------------------------

  private executeBossPhase(boss: Combatant): BattleEvent[] {
    const events: BattleEvent[] = [];

    switch (boss.id) {
      case 'forest_shade': {
        events.push({ kind: 'phase', text: 'The Forest Shade tears apart — shadows pour from its wound!', actorId: boss.id });
        const dmg = Math.round(12 + boss.stats.int * 0.7);
        for (const t of this.living('party')) {
          this.applyDamage(t, dmg);
          events.push({ kind: 'spell', text: `Shadow Veil engulfs ${t.name}! −${dmg} HP`, actorId: boss.id, targetId: t.id, amount: dmg, element: 'none' });
          this.maybeKo(t, events);
          if (this.living('party').length === 0) break;
        }
        boss.stats.int = Math.round(boss.stats.int * 1.3);
        events.push({ kind: 'info', text: 'The Shade\'s power surges — it grows more dangerous!' });
        break;
      }
      case 'tide_warden': {
        events.push({ kind: 'phase', text: 'The Tide Warden roars — the chamber floods in an instant!', actorId: boss.id });
        const surge = Math.round(18 + boss.stats.int * 0.8);
        for (const t of this.living('party')) {
          this.applyDamage(t, surge);
          events.push({ kind: 'spell', text: `Tidal Surge crashes into ${t.name}! −${surge} HP`, actorId: boss.id, targetId: t.id, amount: surge, element: 'ice' });
          this.maybeKo(t, events);
          if (this.living('party').length === 0) break;
        }
        const heal = Math.round(boss.stats.maxHp * 0.12);
        boss.stats.hp = Math.min(boss.stats.maxHp, boss.stats.hp + heal);
        events.push({ kind: 'info', text: `The Warden draws the tide back into itself — +${heal} HP!` });
        break;
      }
      case 'ashbrand': {
        events.push({ kind: 'phase', text: 'Ashbrand ignites — the entire shrine becomes fire!', actorId: boss.id });
        const fire = Math.round(24 + boss.stats.int * 0.9);
        for (const t of this.living('party')) {
          this.applyDamage(t, fire);
          events.push({ kind: 'spell', text: `Conflagration scorches ${t.name}! −${fire} HP`, actorId: boss.id, targetId: t.id, amount: fire, element: 'fire' });
          this.maybeKo(t, events);
          if (this.living('party').length === 0) break;
        }
        boss.stats.str = Math.round(boss.stats.str * 1.25);
        boss.stats.int = Math.round(boss.stats.int * 1.25);
        events.push({ kind: 'info', text: 'Ashbrand burns with primal fury — all power amplified!' });
        break;
      }
      default:
        events.push({ kind: 'phase', text: `${boss.name} transforms!`, actorId: boss.id });
    }

    return events;
  }

  // --- Damage Formulas (FF1-inspired) --------------------------------------

  private modMult(actor: Combatant, target: Combatant): number {
    const mod = getRun().modifier;
    if (actor.side === 'party' && mod.dmgMult) return mod.dmgMult;
    if (target.side === 'party' && mod.dmgTakenMult) return mod.dmgTakenMult;
    return 1;
  }

  private physicalDamage(a: Combatant, t: Combatant): number {
    let dmg = a.stats.str * 1.6 - t.stats.vit * 0.6;
    dmg *= rnd(0.85, 1.15) * this.modMult(a, t);
    if (t.defending) dmg *= 0.5;
    return Math.max(1, Math.round(dmg));
  }

  private spellDamage(a: Combatant, t: Combatant, power: number): number {
    const mod = getRun().modifier;
    const costDelta = a.side === 'party' ? (mod.spellCostDelta ?? 0) : 0;
    // spellCostDelta was already applied to MP cost check in execute; just note it here for reference.
    void costDelta;
    let dmg = power + a.stats.int * 0.8 - t.stats.int * 0.2;
    dmg *= rnd(0.9, 1.1) * this.modMult(a, t);
    if (t.defending) dmg *= 0.75;
    return Math.max(1, Math.round(dmg));
  }

  private applyDamage(t: Combatant, dmg: number): void {
    t.stats.hp = Math.max(0, t.stats.hp - dmg);
  }

  private maybeKo(t: Combatant, events: BattleEvent[]): void {
    if (t.stats.hp <= 0) {
      events.push({ kind: 'ko', text: `${t.name} falls.`, targetId: t.id });
    }
  }

  // --- AI -------------------------------------------------------------------

  private enemyAi(e: Combatant): Command {
    const targets = this.living('party');
    if (targets.length === 0) return { type: 'defend' };

    // Boss phase 2 triggers once when HP drops below 50 %.
    if (e.isBoss && !e.phaseTriggered && e.stats.hp <= e.stats.maxHp / 2) {
      e.phaseTriggered = true;
      return { type: 'phase' };
    }

    // Target the weakest living party member.
    const target = targets.reduce((w, c) => c.stats.hp < w.stats.hp ? c : w);

    // Cast occasionally if MP allows; bosses cast more often.
    const castable = e.spells.filter((s) => SPELLS[s] && e.stats.mp >= SPELLS[s].cost);
    const castChance = e.isBoss ? 0.55 : 0.4;
    if (castable.length > 0 && Math.random() < castChance) {
      return { type: 'spell', spellId: castable[Math.floor(Math.random() * castable.length)], targetId: target.id };
    }
    return { type: 'attack', targetId: target.id };
  }

  // --- Helpers --------------------------------------------------------------

  /** Falls back to a living target on the right side if the original is dead. */
  private aliveTargetOr(id: string, side: 'party' | 'enemy'): Combatant | undefined {
    const t = this.byId(id);
    if (t && t.stats.hp > 0) return t;
    return this.living(side)[0];
  }

  private checkEnd(events: BattleEvent[]): boolean {
    if (this.living('enemy').length === 0) {
      const mod = getRun().modifier;
      this.goldWon = Math.round(this.enemies.reduce((sum, e) => sum + (e.goldReward ?? 0), 0) * (mod.goldMult ?? 1));
      this.xpWon = Math.round(this.enemies.reduce((sum, e) => sum + (e.xpReward ?? 0), 0) * (mod.xpMult ?? 1));
      events.push({ kind: 'info', text: `Victory! +${this.goldWon} gold, +${this.xpWon} XP.` });
      this.phase = 'won';
      return true;
    }
    if (this.living('party').length === 0) {
      events.push({ kind: 'info', text: 'The party is defeated...' });
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
