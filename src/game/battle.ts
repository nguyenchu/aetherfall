// Turn-based battle engine, the heart of the game. FF1-inspired rounds with
// three twists that make decisions matter:
//   - Enemy intents: enemies telegraph their next action during the input phase.
//   - Weakness & break: hitting a weakness chips guard pips; at zero the enemy
//     is BROKEN — loses its action and takes +50% damage until it recovers.
//   - Boons: run-scoped blessings (boons.ts) hook into the damage formulas.
//
// Round flow:
//   1. prepareRound(): enemies pick intents, initiative is rolled for everyone.
//   2. Input phase: each living party member chooses an action.
//   3. resolveRound(): all actors execute in initiative order.
//
// The engine is pure game logic with no Phaser dependency. It mutates Combatant
// stats and returns BattleEvents for the scene to play with text and animation.

import { boonTotals, type BoonTotals } from './boons';
import { ITEMS, SPELLS } from './content';
import { getRun } from './run';
import type { BattleEvent, BattlePhase, Combatant, Command, Element, Spell } from './types';

function rnd(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

const CRIT_BASE = 0.08;
const CRIT_MULT = 1.6;
const WEAK_MULT = 1.5;
const BREAK_MULT = 1.5;
const DEFEND_MP_GAIN = 2;

export class Battle {
  readonly party: Combatant[];
  readonly enemies: Combatant[];
  phase: BattlePhase = 'input';
  goldWon = 0;
  xpWon = 0;

  private commands = new Map<string, Command>();
  private speedRoll = new Map<string, number>();
  private bn: BoonTotals;
  private reviveUsed = false;
  private round = 0;

  /** Shared inventory (item id -> count), mutated when items are used. */
  constructor(party: Combatant[], enemies: Combatant[], private inventory: Record<string, number>) {
    this.party = party;
    this.enemies = enemies;
    this.bn = boonTotals(getRun().boons);
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

  /**
   * Starts a round: enemies telegraph their intents (visible to the player)
   * and initiative is rolled for everyone, so the turn order can be shown.
   */
  prepareRound(): void {
    this.speedRoll.clear();
    for (const c of this.all()) {
      if (c.stats.hp > 0) this.speedRoll.set(c.id, c.stats.agi + rnd(0, 3));
    }
    for (const e of this.living('enemy')) {
      e.intent = e.broken ? undefined : this.enemyAi(e);
    }
  }

  /** Living combatants in this round's initiative order, fastest first. */
  roundOrder(): Combatant[] {
    return this.all()
      .filter((c) => c.stats.hp > 0)
      .sort((a, b) => (this.speedRoll.get(b.id) ?? b.stats.agi) - (this.speedRoll.get(a.id) ?? a.stats.agi));
  }

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
   * Executes the round using party commands and telegraphed enemy intents.
   * Returns the full event log for the round.
   */
  resolveRound(): BattleEvent[] {
    this.phase = 'resolving';
    this.round++;
    const events: BattleEvent[] = [];

    // Reset defending from the previous round before locking new actions.
    for (const c of this.all()) c.defending = false;

    for (const e of this.living('enemy')) {
      if (!e.broken) this.commands.set(e.id, e.intent ?? this.enemyAi(e));
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

    // Turn order: initiative rolled in prepareRound, highest first.
    const order = this.roundOrder().filter((c) => this.commands.has(c.id) || c.broken);

    for (const actor of order) {
      if (actor.stats.hp <= 0) continue; // may have fallen earlier in the round
      if (actor.side === 'enemy' && actor.broken) {
        events.push({ kind: 'info', text: `${actor.name} is staggered and cannot act!`, actorId: actor.id });
        continue;
      }
      const cmd = this.commands.get(actor.id);
      if (!cmd) continue;
      this.execute(actor, cmd, events);
      if (this.checkEnd(events)) break;
    }

    this.commands.clear();

    if (this.phase === 'resolving') {
      // Break lasts through the round after it happened, then guard restores.
      for (const e of this.living('enemy')) {
        if (e.broken && (e.brokenRound ?? 0) < this.round) {
          e.broken = false;
          e.guard = e.maxGuard ?? 0;
          events.push({ kind: 'recover', text: `${e.name} steadies itself — guard restored.`, actorId: e.id });
        }
      }
      // Aether Flow boon: party regains MP each round.
      if (this.bn.mpRegen > 0) {
        for (const c of this.living('party')) {
          c.stats.mp = Math.min(c.stats.maxMp, c.stats.mp + this.bn.mpRegen);
        }
      }
      this.phase = 'input';
    }
    return events;
  }

  private execute(actor: Combatant, cmd: Command, events: BattleEvent[]): void {
    switch (cmd.type) {
      case 'defend': {
        actor.defending = true;
        actor.stats.mp = Math.min(actor.stats.maxMp, actor.stats.mp + DEFEND_MP_GAIN);
        let text = `${actor.name} braces (+${DEFEND_MP_GAIN} MP).`;
        if (actor.side === 'party' && this.bn.defendHeal > 0 && actor.stats.hp < actor.stats.maxHp) {
          const heal = Math.min(this.bn.defendHeal, actor.stats.maxHp - actor.stats.hp);
          actor.stats.hp += heal;
          text = `${actor.name} braces (+${DEFEND_MP_GAIN} MP, +${heal} HP).`;
        }
        events.push({ kind: 'defend', text, actorId: actor.id });
        return;
      }
      case 'flee':
        return; // handled in resolveRound for party; enemies do not flee
      case 'attack': {
        const target = this.aliveTargetOr(cmd.targetId, actor.side === 'party' ? 'enemy' : 'party');
        if (!target) return;
        this.strike(actor, target, null, events);
        return;
      }
      case 'spell': {
        const spell = SPELLS[cmd.spellId];
        if (!spell) return;
        const mod = getRun().modifier;
        const effectiveCost = Math.max(0, spell.cost + (actor.side === 'party' ? (mod.spellCostDelta ?? 0) : 0));
        if (actor.stats.mp < effectiveCost) return;
        actor.stats.mp -= effectiveCost;
        if (spell.kind === 'heal') {
          this.castHeal(actor, spell, cmd.targetId, events);
        } else {
          this.castDamage(actor, spell, cmd.targetId, events);
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
        const boost = actor.side === 'party' ? 1 + this.bn.potionBoost : 1;
        const power = Math.round(item.power * boost);
        if (item.kind === 'heal') {
          target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + power);
          events.push({ kind: 'item', text: `${actor.name} uses ${item.name}; ${target.name} +${power} HP.`, actorId: actor.id, targetId: target.id, amount: -power });
        } else if (item.kind === 'mp') {
          target.stats.mp = Math.min(target.stats.maxMp, target.stats.mp + power);
          events.push({ kind: 'item', text: `${actor.name} uses ${item.name}; ${target.name} +${power} MP.`, actorId: actor.id, targetId: target.id });
        }
        return;
      }
    }
  }

  // --- Attacks and Spells -----------------------------------------------------

  /** Physical strike (basic attack). Handles crit, weakness, lifesteal, thorns. */
  private strike(actor: Combatant, target: Combatant, spell: Spell | null, events: BattleEvent[]): void {
    const base = actor.stats.str * 1.6 - target.stats.vit * 0.6;
    const hit = this.computeHit(actor, target, base, 'phys');
    this.applyDamage(target, hit.dmg);
    this.chipGuard(actor, target, hit.weak, spell?.guardHit ?? 0, events);
    const tags = hitTags(hit);
    events.push({
      kind: 'attack',
      text: `${actor.name} hits ${target.name} for ${hit.dmg}.${tags}`,
      actorId: actor.id, targetId: target.id, amount: hit.dmg, crit: hit.crit, weak: hit.weak,
    });
    // Vampiric Edge: attacks heal the attacker.
    if (actor.side === 'party' && this.bn.lifesteal > 0) {
      const heal = Math.round(hit.dmg * this.bn.lifesteal);
      if (heal > 0 && actor.stats.hp > 0 && actor.stats.hp < actor.stats.maxHp) {
        actor.stats.hp = Math.min(actor.stats.maxHp, actor.stats.hp + heal);
        events.push({ kind: 'info', text: `${actor.name} drains ${heal} HP.`, actorId: actor.id, targetId: actor.id, amount: -heal });
      }
    }
    // Thorn Pact: party reflects part of the damage taken.
    if (target.side === 'party' && this.bn.thorns > 0 && actor.stats.hp > 0) {
      const reflect = Math.round(hit.dmg * this.bn.thorns);
      if (reflect > 0) {
        this.applyDamage(actor, reflect);
        events.push({ kind: 'info', text: `Thorns lash ${actor.name} for ${reflect}.`, targetId: actor.id, amount: reflect });
        this.maybeKo(actor, events);
      }
    }
    this.maybeKo(target, events);
  }

  private castDamage(actor: Combatant, spell: Spell, targetId: string, events: BattleEvent[]): void {
    const enemySide = actor.side === 'party' ? 'enemy' : 'party';
    if (spell.element === 'phys' && spell.target !== 'all-enemies') {
      // Physical skills (Crush) behave like boosted attacks with guard chip.
      const target = this.aliveTargetOr(targetId, enemySide);
      if (!target) return;
      const base = spell.power + actor.stats.str * 1.2 - target.stats.vit * 0.5;
      const hit = this.computeHit(actor, target, base, 'phys');
      this.applyDamage(target, hit.dmg);
      this.chipGuard(actor, target, hit.weak, spell.guardHit ?? 0, events);
      events.push({
        kind: 'spell',
        text: `${actor.name} uses ${spell.name}; ${target.name} takes ${hit.dmg}.${hitTags(hit)}`,
        actorId: actor.id, targetId: target.id, amount: hit.dmg, element: spell.element, crit: hit.crit, weak: hit.weak,
      });
      this.maybeKo(target, events);
      return;
    }

    const targets = spell.target === 'all-enemies'
      ? [...this.living(enemySide)]
      : [this.aliveTargetOr(targetId, enemySide)].filter((t): t is Combatant => t != null);
    if (targets.length === 0) return;

    for (const target of targets) {
      if (target.stats.hp <= 0) continue;
      const basePower = spell.element === 'phys'
        ? spell.power + actor.stats.str * 1.0 - target.stats.vit * 0.4
        : spell.power + actor.stats.int * 0.8 - target.stats.int * 0.2;
      const hit = this.computeHit(actor, target, basePower, spell.element);
      this.applyDamage(target, hit.dmg);
      this.chipGuard(actor, target, hit.weak, spell.guardHit ?? 0, events);
      events.push({
        kind: 'spell',
        text: `${actor.name} casts ${spell.name}; ${target.name} takes ${hit.dmg}.${hitTags(hit)}`,
        actorId: actor.id, targetId: target.id, amount: hit.dmg, element: spell.element, crit: hit.crit, weak: hit.weak,
      });
      this.maybeKo(target, events);
    }
  }

  private castHeal(actor: Combatant, spell: Spell, targetId: string, events: BattleEvent[]): void {
    const heal = Math.round(spell.power + actor.stats.int * 0.5);
    const targets = spell.target === 'party'
      ? [...this.living(actor.side)]
      : [this.aliveTargetOr(targetId, actor.side) ?? actor];
    for (const target of targets) {
      if (target.stats.hp <= 0) continue;
      target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + heal);
      events.push({ kind: 'spell', text: `${actor.name} casts ${spell.name}; ${target.name} +${heal} HP.`, actorId: actor.id, targetId: target.id, amount: -heal, element: spell.element });
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

  // --- Damage Formulas --------------------------------------------------------

  private modMult(actor: Combatant, target: Combatant): number {
    const mod = getRun().modifier;
    if (actor.side === 'party' && mod.dmgMult) return mod.dmgMult;
    if (target.side === 'party' && mod.dmgTakenMult) return mod.dmgTakenMult;
    return 1;
  }

  /** Central damage roll: variance, modifiers, boons, weakness, break, crit. */
  private computeHit(actor: Combatant, target: Combatant, base: number, element: Element): { dmg: number; crit: boolean; weak: boolean } {
    let dmg = base * rnd(0.88, 1.12) * this.modMult(actor, target);
    const weak = element !== 'none' && (target.weakness?.includes(element) ?? false);
    let crit = false;
    if (actor.side === 'party') {
      dmg *= this.bn.dmgMult * (this.bn.elementMult[element] ?? 1);
      if (weak) dmg *= WEAK_MULT;
      if (target.broken) dmg *= BREAK_MULT + this.bn.breakDmgBonus;
      crit = Math.random() < CRIT_BASE + this.bn.critBonus;
      if (crit) dmg *= CRIT_MULT;
    }
    if (target.defending) dmg *= element === 'phys' ? 0.5 : 0.75;
    return { dmg: Math.max(1, Math.round(dmg)), crit, weak };
  }

  /** Removes guard pips on weakness hits and skill chips; triggers BREAK at 0. */
  private chipGuard(actor: Combatant, target: Combatant, weak: boolean, guardHit: number, events: BattleEvent[]): void {
    if (actor.side !== 'party' || target.side !== 'enemy') return;
    if (target.broken || (target.guard ?? 0) <= 0) return;
    const chip = (weak ? 1 + this.bn.guardChipBonus : 0) + guardHit;
    if (chip <= 0) return;
    target.guard = Math.max(0, (target.guard ?? 0) - chip);
    if (target.guard === 0) {
      target.broken = true;
      target.brokenRound = this.round;
      target.intent = undefined;
      this.commands.delete(target.id); // loses its action this round
      events.push({ kind: 'break', text: `${target.name} is BROKEN — it reels, defenseless!`, targetId: target.id });
    }
  }

  private applyDamage(t: Combatant, dmg: number): void {
    t.stats.hp = Math.max(0, t.stats.hp - dmg);
  }

  private maybeKo(t: Combatant, events: BattleEvent[]): void {
    if (t.stats.hp > 0) return;
    // Crystal Promise: once per battle, a fallen hero returns.
    if (t.side === 'party' && this.bn.reviveOnce && !this.reviveUsed) {
      this.reviveUsed = true;
      t.stats.hp = Math.round(t.stats.maxHp * 0.4);
      events.push({ kind: 'info', text: `The Crystal flares — ${t.name} returns to the fight!`, targetId: t.id, amount: -t.stats.hp });
      return;
    }
    events.push({ kind: 'ko', text: `${t.name} falls.`, targetId: t.id });
  }

  // --- AI -------------------------------------------------------------------

  private enemyAi(e: Combatant): Command {
    const targets = this.living('party');
    if (targets.length === 0) return { type: 'defend' };

    // Boss phase 2 telegraphs once when HP drops below 50 %.
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
      const spellId = castable[Math.floor(Math.random() * castable.length)];
      const spell = SPELLS[spellId];
      if (spell.kind === 'heal') {
        // Heal the most wounded living ally (often itself).
        const allies = this.living('enemy');
        const wounded = allies.reduce((w, c) => (c.stats.maxHp - c.stats.hp) > (w.stats.maxHp - w.stats.hp) ? c : w, e);
        if (wounded.stats.hp < wounded.stats.maxHp) {
          return { type: 'spell', spellId, targetId: wounded.id };
        }
      } else {
        return { type: 'spell', spellId, targetId: target.id };
      }
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
      this.goldWon = Math.round(this.enemies.reduce((sum, e) => sum + (e.goldReward ?? 0), 0) * (mod.goldMult ?? 1) * this.bn.goldMult);
      this.xpWon = Math.round(this.enemies.reduce((sum, e) => sum + (e.xpReward ?? 0), 0) * (mod.xpMult ?? 1) * this.bn.xpMult);
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

function hitTags(hit: { crit: boolean; weak: boolean }): string {
  let tags = '';
  if (hit.weak) tags += ' Weak!';
  if (hit.crit) tags += ' CRIT!';
  return tags;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
