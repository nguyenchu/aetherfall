// Turn-based battle engine, the heart of the game. A Final Fantasy X-style
// Conditional Turn-Based (CTB) queue with three twists that make decisions matter:
//   - Enemy intents: telegraphed the moment they're decided, cached on the
//     combatant and shown to the player ahead of time.
//   - Weakness & break: hitting a weakness chips guard pips; at zero the enemy
//     is BROKEN — loses its action and takes +50% damage until its own next
//     turn, which it spends recovering instead of acting.
//   - Boons: run-scoped blessings (boons.ts) hook into the damage formulas.
//
// Turn flow (no "rounds" — see the CTB Queue section below):
//   1. start(): zero every combatant's readiness, telegraph all enemies.
//   2. startTurn(): advance the queue to the next actor; tick their own
//      ailments/Haste/Slow, MP regen, or broken-recovery — deciding whether
//      they still need to act (needsCommand).
//   3. executeTurn(actor, cmd): run exactly one actor's action; enemies
//      re-telegraph their next plan immediately afterward.
//
// The engine is pure game logic with no Phaser dependency. It mutates Combatant
// stats and returns BattleEvents for the scene to play with text and animation.

import { boonTotals, type BoonTotals } from './boons';
import { ITEMS, SPELLS } from './content';
import { getRun } from './run';
import type { Ailment, BattleEvent, BattlePhase, Combatant, Command, Element, Inflict, Spell, SpeedSource, SpeedStatus } from './types';

function rnd(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

const CRIT_BASE = 0.08;
const CRIT_MULT = 1.6;
const WEAK_MULT = 1.5;
const WARD_MULT = 0.3; // a warded element does only 30% damage to that enemy
const BREAK_MULT = 1.5;
const DEFEND_MP_GAIN = 2;
// Ailments (see types.ts): burn/venom tick at end of round, chill slows.
const CHILL_AGI_MULT = 0.55;
const CHILL_DMG_MULT = 0.75;
const BURN_FRAC = 0.06; // of max HP per tick, min 3
const VENOM_FRAC = 0.05; // of max HP per tick, min 2
// Synergy boons (boons.ts) — see computeHit/chipGuard/maybeKo/executeTurn.
const GUARDIANS_WRATH_MULT = 1.3;
const LAST_STAND_THRESHOLD = 0.3;
const LAST_STAND_DMG_MULT = 1.4;
const LAST_STAND_CRIT_BONUS = 0.15;
const MOMENTUM_CRIT_PER_STACK = 0.1;
const MOMENTUM_MAX_STACKS = 5;
// Limit Break gauge (see types.ts Combatant.limit): fills from damage taken
// (scaled by how much of max HP it cost) and a small flat amount for simply
// acting, so a caster who dodges the enemy's attention still builds it up.
const LIMIT_MAX = 100;
const LIMIT_TAKEN_SCALE = 1.4;
const LIMIT_ACT_GAIN = 4;

// --- CTB Queue (new engine core; see CONTEXT.md 2026-07-14 CTB plan) --------
// Every combatant has a persistent `readiness` counter (0..READY_THRESHOLD).
// The next actor is whoever needs the fewest ticks to cross the threshold at
// their effective speed; everyone's readiness advances by that many ticks,
// and the winner rolls over (keeps overflow speed) rather than resetting to
// zero. Once seeded, advancement itself is deterministic — no RNG — so the
// queue can be previewed exactly from any point in the battle.
const READY_THRESHOLD = 1000;

interface ReadinessEntry {
  id: string;
  readiness: number;
  speed: number;
}

/** Advances every entry to the next ready actor and returns its id. Mutates
 * `entries` in place (readiness advanced for all, rolled over for the
 * winner) — callers decide whether that's real state or a preview clone. */
function advanceQueue(entries: ReadinessEntry[]): string {
  let bestIdx = 0;
  let bestTicks = Infinity;
  entries.forEach((e, i) => {
    const remaining = READY_THRESHOLD - e.readiness;
    const ticks = e.speed > 0 ? Math.max(0, Math.ceil(remaining / e.speed)) : Infinity;
    // Ties resolve to the fastest, then to whoever came first (stable).
    if (ticks < bestTicks || (ticks === bestTicks && e.speed > entries[bestIdx].speed)) {
      bestTicks = ticks;
      bestIdx = i;
    }
  });
  const advance = bestTicks === Infinity ? 0 : bestTicks;
  for (const e of entries) e.readiness += advance * e.speed;
  entries[bestIdx].readiness -= READY_THRESHOLD;
  return entries[bestIdx].id;
}

const AILMENT_APPLY_TEXT: Record<Ailment, (name: string) => string> = {
  burn: (n) => `${n} is set ablaze!`,
  chill: (n) => `${n} is chilled to the bone!`,
  venom: (n) => `${n} is poisoned!`,
};
const AILMENT_EXPIRE_TEXT: Record<Ailment, (name: string) => string> = {
  burn: (n) => `The flames on ${n} gutter out.`,
  chill: (n) => `${n} shakes off the chill.`,
  venom: (n) => `The venom in ${n} fades.`,
};

export class Battle {
  readonly party: Combatant[];
  readonly enemies: Combatant[];
  phase: BattlePhase = 'input';
  goldWon = 0;
  xpWon = 0;

  private bn: BoonTotals;
  private reviveUsed = false;
  private momentumStacks = 0; // Momentum boon: +crit per weakness hit landed, for the rest of the battle

  /** Shared inventory (item id -> count), mutated when items are used. */
  constructor(party: Combatant[], enemies: Combatant[], private inventory: Record<string, number>) {
    this.party = party;
    this.enemies = enemies;
    this.bn = boonTotals(getRun().boons);
  }

  all(): Combatant[] {
    return [...this.party, ...this.enemies];
  }

  /** For UI: current Momentum stack count, and whether the boon is even active this run. */
  momentumInfo(): { active: boolean; stacks: number } {
    return { active: this.bn.hasMomentum, stacks: this.momentumStacks };
  }

  byId(id: string): Combatant | undefined {
    return this.all().find((c) => c.id === id);
  }

  living(side: 'party' | 'enemy'): Combatant[] {
    const list = side === 'party' ? this.party : this.enemies;
    return list.filter((c) => c.stats.hp > 0);
  }

  /** Item validity and living target counts are handled in the scene. */
  itemCount(itemId: string): number {
    return this.inventory[itemId] ?? 0;
  }

  // --- CTB Queue --------------------------------------------------------------

  /** Call once at battle start: seeds the queue and telegraphs every enemy.
   * Readiness starts at a random point on each combatant's own gauge rather
   * than a flat zero — agi still decides who's usually fastest (a high-agi
   * combatant needs a smaller random head start to lead), but it stops being
   * a guarantee that the same party member opens literally every fight. */
  start(): void {
    for (const c of this.all()) c.readiness = Math.floor(Math.random() * READY_THRESHOLD);
    for (const e of this.living('enemy')) this.refreshIntent(e);
  }

  /**
   * Advances the queue to the next actor and runs their "start of turn"
   * pipeline (ailment/DoT tick, MP regen, broken recovery). Returns the
   * events from that pipeline plus whether the actor still needs a command
   * this turn (false if they just recovered from broken, or died to DoT).
   */
  startTurn(): { actor: Combatant; events: BattleEvent[]; needsCommand: boolean } {
    const events: BattleEvent[] = [];
    const actor = this.byId(this.nextReadyId())!;

    actor.defending = false;
    this.tickOwnStatuses(actor, events);
    if (actor.isBoss && actor.phaseTriggered) this.bossTick(actor);
    if (actor.enrageOnOwnTurn && actor.stats.hp > 0) this.enrageTick(actor);

    if (this.checkEnd(events) || actor.stats.hp <= 0) {
      return { actor, events, needsCommand: false };
    }

    if (actor.side === 'enemy' && actor.broken) {
      actor.broken = false;
      actor.guard = actor.maxGuard ?? 0;
      events.push({ kind: 'recover', text: `${actor.name} steadies itself — guard restored.`, actorId: actor.id });
      this.refreshIntent(actor);
      return { actor, events, needsCommand: false };
    }

    if (actor.side === 'party') {
      const regen = this.bn.mpRegen + (actor.gear?.mpRegen ?? 0);
      if (regen > 0) actor.stats.mp = Math.min(actor.stats.maxMp, actor.stats.mp + regen);
    }

    return { actor, events, needsCommand: true };
  }

  /** Runs a single actor's chosen command and returns its events. */
  executeTurn(actor: Combatant, cmd: Command): BattleEvent[] {
    const events: BattleEvent[] = [];
    if (cmd.type === 'flee') {
      this.attemptFlee(events);
      return events;
    }
    // Acting builds the Limit Break gauge a little regardless of whether the
    // actor gets hit — but using the Limit Break itself doesn't re-fill it.
    if (actor.side === 'party' && cmd.type !== 'limit') {
      actor.limit = Math.min(LIMIT_MAX, (actor.limit ?? 0) + LIMIT_ACT_GAIN);
    }
    this.execute(actor, cmd, events);
    // Guardian's Wrath: the buff persists through repeated defends, and is
    // spent by whatever non-defend action finally uses it.
    if (cmd.type !== 'defend' && actor.guardBuffed) actor.guardBuffed = false;
    if (!this.checkEnd(events) && actor.side === 'enemy' && actor.stats.hp > 0 && !actor.broken) {
      this.refreshIntent(actor);
    }
    return events;
  }

  /** Non-mutating: the next `steps` actors in queue order, for UI preview. */
  previewQueue(steps: number): Combatant[] {
    const entries: ReadinessEntry[] = this.living('party').concat(this.living('enemy')).map((c) => ({
      id: c.id,
      readiness: c.readiness ?? 0,
      speed: this.effectiveSpeed(c),
    }));
    const order: Combatant[] = [];
    for (let i = 0; i < steps && entries.length > 0; i++) {
      const c = this.byId(advanceQueue(entries));
      if (c) order.push(c);
    }
    return order;
  }

  /** Advances the real queue and returns the id of whoever is up next. */
  private nextReadyId(): string {
    const entries: ReadinessEntry[] = this.living('party').concat(this.living('enemy')).map((c) => ({
      id: c.id,
      readiness: c.readiness ?? 0,
      speed: this.effectiveSpeed(c),
    }));
    const id = advanceQueue(entries);
    for (const e of entries) {
      const c = this.byId(e.id);
      if (c) c.readiness = e.readiness;
    }
    return id;
  }

  /** agi × chill × Haste/Slow stack — the one place turn speed is computed. */
  private effectiveSpeed(c: Combatant): number {
    let mult = c.ailments?.chill ? CHILL_AGI_MULT : 1;
    if (c.speedStatuses) {
      for (const status of Object.values(c.speedStatuses)) {
        if (status) mult *= status.mult;
      }
    }
    return Math.max(1, c.stats.agi * mult);
  }

  private refreshIntent(e: Combatant): void {
    e.intent = e.broken ? undefined : this.enemyAi(e);
  }

  /** Same flee formula as before, resolved the instant it's chosen. */
  private attemptFlee(events: BattleEvent[]): void {
    const partyAgi = avg(this.living('party').map((c) => this.effectiveSpeed(c)));
    const enemyAgi = avg(this.living('enemy').map((c) => this.effectiveSpeed(c)));
    const chance = Math.min(0.9, Math.max(0.25, 0.5 + (partyAgi - enemyAgi) * 0.05));
    if (Math.random() < chance) {
      events.push({ kind: 'flee-ok', text: 'The party fled!' });
      this.phase = 'fled';
      this.clearPartyAilments();
      return;
    }
    events.push({ kind: 'flee-fail', text: 'Could not flee!' });
  }

  /** Ailments and Haste/Slow tick down at the start of the bearer's own
   * turn — CTB has no global "round end" to synchronize them to. */
  private tickOwnStatuses(actor: Combatant, events: BattleEvent[]): void {
    if (actor.stats.hp > 0 && actor.ailments) {
      for (const [ailment, turns] of Object.entries(actor.ailments) as [Ailment, number][]) {
        if (actor.stats.hp <= 0) break;
        const dotMult = actor.side === 'enemy' ? this.bn.dotMult : 1;
        if (ailment === 'burn' || ailment === 'venom') {
          const frac = ailment === 'burn' ? BURN_FRAC : VENOM_FRAC;
          const min = ailment === 'burn' ? 3 : 2;
          const dmg = Math.round(Math.max(min, actor.stats.maxHp * frac) * dotMult);
          this.applyDamage(actor, dmg);
          const text = ailment === 'burn'
            ? `${actor.name} burns for ${dmg}.`
            : `Venom courses through ${actor.name} — ${dmg} damage.`;
          events.push({ kind: 'dot', text, targetId: actor.id, amount: dmg, ailment });
          this.maybeKo(actor, events);
        }
        if (turns - 1 <= 0) {
          delete actor.ailments[ailment];
          if (actor.stats.hp > 0) {
            events.push({ kind: 'info', text: AILMENT_EXPIRE_TEXT[ailment](actor.name), targetId: actor.id });
          }
        } else {
          actor.ailments[ailment] = turns - 1;
        }
      }
    }
    if (actor.speedStatuses) {
      for (const [source, status] of Object.entries(actor.speedStatuses) as [SpeedSource, SpeedStatus][]) {
        if (!status) continue;
        if (status.turns - 1 <= 0) delete actor.speedStatuses[source];
        else actor.speedStatuses[source] = { ...status, turns: status.turns - 1 };
      }
    }
  }

  // --- Resolution ------------------------------------------------------------

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
        if (actor.side === 'party' && this.bn.hasGuardiansWrath) {
          actor.guardBuffed = true;
          text += ' Their next strike will hit harder.';
        }
        events.push({ kind: 'defend', text, actorId: actor.id });
        return;
      }
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
        } else if (spell.kind === 'buff') {
          this.castBuff(actor, spell, cmd.targetId, events);
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
        if (!item || item.target === 'none' || (this.inventory[item.id] ?? 0) <= 0) return;
        // Revive is the one item kind that targets a fallen ally directly —
        // aliveTargetOr would just redirect it to someone still standing.
        if (item.kind === 'revive') {
          const target = this.byId(cmd.targetId);
          if (!target || target.side !== actor.side || target.stats.hp > 0) return;
          this.inventory[item.id]--;
          target.stats.hp = Math.min(target.stats.maxHp, Math.max(1, Math.round(target.stats.maxHp * item.power)));
          events.push({
            kind: 'item', text: `${actor.name} uses ${item.name}; ${target.name} returns to the fight!`,
            actorId: actor.id, targetId: target.id, amount: -target.stats.hp,
          });
          return;
        }
        // Throwables (kind: 'damage') hit the opposing side; every other
        // kind supports the actor's own side.
        if (item.kind === 'damage') {
          const enemySide = actor.side === 'party' ? 'enemy' : 'party';
          const target = this.aliveTargetOr(cmd.targetId, enemySide);
          if (!target) return;
          this.inventory[item.id]--;
          this.applyDamage(target, item.power);
          events.push({
            kind: 'item', text: `${actor.name} uses ${item.name}; ${target.name} takes ${item.power}.`,
            actorId: actor.id, targetId: target.id, amount: item.power,
          });
          if (item.inflict) this.applyAilment(target, item.inflict, events);
          this.maybeKo(target, events);
          return;
        }
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
        } else if (item.kind === 'cure') {
          const had = !!target.ailments && Object.keys(target.ailments).length > 0;
          target.ailments = undefined;
          events.push({
            kind: 'item',
            text: had ? `${actor.name} uses ${item.name}; ${target.name} is cleansed of ailments.` : `${actor.name} uses ${item.name}, but ${target.name} has nothing to cure.`,
            actorId: actor.id, targetId: target.id,
          });
        }
        return;
      }
      case 'limit': {
        if ((actor.limit ?? 0) < LIMIT_MAX) return; // menu shouldn't offer it otherwise
        actor.limit = 0;
        this.executeLimitBreak(actor, events);
        return;
      }
    }
  }

  // --- Limit Breaks -----------------------------------------------------------

  /** Ultimate move for a full gauge — ignores defending/ward mitigation (a
   *  limit break cuts through guard by design) but still respects weakness
   *  for flavor. One bespoke move per party member. */
  private limitDamage(target: Combatant, base: number, element: Element): { dmg: number; weak: boolean } {
    const weak = element !== 'none' && (target.weakness?.includes(element) ?? false);
    let dmg = base * rnd(0.95, 1.08);
    if (weak) dmg *= WEAK_MULT;
    return { dmg: Math.max(1, Math.round(dmg)), weak };
  }

  private executeLimitBreak(actor: Combatant, events: BattleEvent[]): void {
    switch (actor.id) {
      case 'kael': {
        const target = this.living('enemy')[0];
        if (!target) return;
        events.push({ kind: 'limit', text: `Kael unleashes AETHERBLADE REQUIEM!`, actorId: actor.id });
        const hit = this.limitDamage(target, actor.stats.str * 4.2, 'physical');
        this.applyDamage(target, hit.dmg);
        if (target.side === 'enemy' && !target.broken && (target.guard ?? 0) > 0) {
          target.guard = 0;
          target.broken = true;
          target.intent = undefined;
          events.push({ kind: 'break', text: `${target.name} is BROKEN — it reels, defenseless!`, targetId: target.id });
        }
        events.push({
          kind: 'spell', text: `${target.name} takes ${hit.dmg}!${hit.weak ? ' Weak!' : ''}`,
          actorId: actor.id, targetId: target.id, amount: hit.dmg, element: 'physical', spellId: 'requiem', weak: hit.weak,
        });
        this.maybeKo(target, events);
        return;
      }
      case 'lyra': {
        events.push({ kind: 'limit', text: `Lyra unleashes CATACLYSM!`, actorId: actor.id });
        for (const target of this.living('enemy')) {
          const hit = this.limitDamage(target, actor.stats.int * 2.6, 'none');
          this.applyDamage(target, hit.dmg);
          events.push({
            kind: 'spell', text: `${target.name} is engulfed! −${hit.dmg}`,
            actorId: actor.id, targetId: target.id, amount: hit.dmg, element: 'none', spellId: 'cataclysm', parallel: true,
          });
          this.maybeKo(target, events, true);
        }
        return;
      }
      case 'mira': {
        events.push({ kind: 'limit', text: `Mira unleashes AEGIS OF DAWN!`, actorId: actor.id });
        for (const t of this.party) {
          if (t.stats.hp <= 0) {
            t.stats.hp = Math.round(t.stats.maxHp * 0.5);
            events.push({ kind: 'info', text: `${t.name} is revived!`, targetId: t.id, amount: -t.stats.hp, parallel: true });
          } else {
            const healAmt = t.stats.maxHp - t.stats.hp;
            if (healAmt > 0) {
              t.stats.hp = t.stats.maxHp;
              events.push({
                kind: 'spell', text: `${t.name} is bathed in dawnlight! +${healAmt} HP`,
                actorId: actor.id, targetId: t.id, amount: -healAmt, element: 'holy', spellId: 'aegis', parallel: true,
              });
            }
          }
          // Cleansing applies whether they were healed or just revived — a
          // freshly-revived ally shouldn't drop right back to venom ticking.
          if (t.ailments && Object.keys(t.ailments).length > 0) {
            t.ailments = undefined;
            events.push({ kind: 'info', text: `${t.name} is cleansed of ailments.`, targetId: t.id, parallel: true });
          }
        }
        return;
      }
    }
  }

  // --- Attacks and Spells -----------------------------------------------------

  /** Basic attack. Element comes from the weapon (default physical). */
  private strike(actor: Combatant, target: Combatant, spell: Spell | null, events: BattleEvent[]): void {
    const element = actor.attackElement ?? 'physical';
    const base = actor.stats.str * 1.6 - target.stats.vit * 0.6;
    const hit = this.computeHit(actor, target, base, element);
    this.applyDamage(target, hit.dmg);
    this.chipGuard(actor, target, hit.weak, spell?.guardHit ?? 0, events);
    this.maybeGainMomentum(actor, hit.weak);
    const tags = hitTags(hit);
    events.push({
      kind: 'attack',
      text: `${actor.name} hits ${target.name} for ${hit.dmg}.${tags}`,
      actorId: actor.id, targetId: target.id, amount: hit.dmg, element, crit: hit.crit, weak: hit.weak,
    });
    // Venomous bites, chilling blades: attacks can carry an ailment
    // (enemy nature or a party weapon like the Tidecleaver). Ashbrand's
    // "Scorched Ground": a defending target gets no benefit of the doubt —
    // the burn always catches.
    if (actor.attackInflict) {
      const sureBurn = actor.id === 'ashbrand' && actor.phaseTriggered === true && target.defending === true;
      this.applyAilment(target, actor.attackInflict, events, sureBurn);
    }
    // Consecrated Censer and the like: a critical hit also lands an ailment,
    // independent of (and stacking with) attackInflict's per-hit roll.
    if (hit.crit && actor.critInflict) {
      this.applyAilment(target, actor.critInflict, events);
    }
    // Tide Warden's "Undertow": drags the target back in the CTB queue.
    if (actor.attackSpeedDebuff) {
      this.applySpeedStatus(target, 'slow', actor.attackSpeedDebuff.mult, actor.attackSpeedDebuff.turns, events);
    }
    this.applyLifesteal(actor, hit.dmg, events);
    // Thorn Pact: party reflects part of the damage taken.
    if (target.side === 'party' && this.bn.thorns > 0 && actor.stats.hp > 0) {
      const reflect = Math.round(hit.dmg * this.bn.thorns);
      if (reflect > 0) {
        this.applyDamage(actor, reflect);
        events.push({ kind: 'info', text: `Thorns lash ${actor.name} for ${reflect}.`, targetId: actor.id, amount: reflect });
        this.maybeKo(actor, events);
      }
    }
    this.applyReflect(actor, target, hit, events);
    this.maybeKo(target, events);
  }

  /** Lifesteal: the Vampiric Edge boon and gear like the Vampire Fang. Covers
   * physical damage only — plain attacks and physical-element skills — not
   * elemental magic (see castDamage's callers). */
  private applyLifesteal(actor: Combatant, dmg: number, events: BattleEvent[], parallel = false): void {
    const lifesteal = (actor.side === 'party' ? this.bn.lifesteal : 0) + (actor.gear?.lifesteal ?? 0);
    if (lifesteal <= 0) return;
    const heal = Math.round(dmg * lifesteal);
    if (heal > 0 && actor.stats.hp > 0 && actor.stats.hp < actor.stats.maxHp) {
      actor.stats.hp = Math.min(actor.stats.maxHp, actor.stats.hp + heal);
      events.push({ kind: 'info', text: `${actor.name} drains ${heal} HP.`, actorId: actor.id, targetId: actor.id, amount: -heal, parallel });
    }
  }

  /** Prism Sprite's reflect: a non-weakness hit bounces part of its damage
   * back at the attacker. Hitting the actual weakness bypasses it entirely,
   * rewarding correct play. */
  private applyReflect(actor: Combatant, target: Combatant, hit: { dmg: number; weak: boolean }, events: BattleEvent[], parallel = false): void {
    if (!target.reflectFrac || hit.weak || actor.stats.hp <= 0) return;
    const reflect = Math.round(hit.dmg * target.reflectFrac);
    if (reflect <= 0) return;
    this.applyDamage(actor, reflect);
    events.push({ kind: 'info', text: `${target.name} refracts ${reflect} damage back at ${actor.name}!`, targetId: actor.id, amount: reflect, parallel });
    this.maybeKo(actor, events, parallel);
  }

  private castDamage(actor: Combatant, spell: Spell, targetId: string, events: BattleEvent[]): void {
    const enemySide = actor.side === 'party' ? 'enemy' : 'party';
    if (spell.element === 'physical' && spell.target !== 'all-enemies') {
      // Physical skills (Crush) behave like boosted attacks with guard chip.
      const target = this.aliveTargetOr(targetId, enemySide);
      if (!target) return;
      const base = spell.power + actor.stats.str * 1.2 - target.stats.vit * 0.5;
      const hit = this.computeHit(actor, target, base, 'physical');
      this.applyDamage(target, hit.dmg);
      this.chipGuard(actor, target, hit.weak, spell.guardHit ?? 0, events);
      this.maybeGainMomentum(actor, hit.weak);
      events.push({
        kind: 'spell',
        text: `${actor.name} uses ${spell.name}; ${target.name} takes ${hit.dmg}.${hitTags(hit)}`,
        actorId: actor.id, targetId: target.id, amount: hit.dmg, element: spell.element, spellId: spell.id, crit: hit.crit, weak: hit.weak,
      });
      if (spell.inflict) this.applySpellInflict(actor, target, spell.inflict, events);
      this.applyLifesteal(actor, hit.dmg, events);
      this.applyReflect(actor, target, hit, events);
      this.maybeKo(target, events);
      return;
    }

    const targets = spell.target === 'all-enemies'
      ? [...this.living(enemySide)]
      : [this.aliveTargetOr(targetId, enemySide)].filter((t): t is Combatant => t != null);
    if (targets.length === 0) return;
    const isAoe = targets.length > 1;

    for (const target of targets) {
      if (target.stats.hp <= 0) continue;
      const basePower = spell.element === 'physical'
        ? spell.power + actor.stats.str * 1.0 - target.stats.vit * 0.4
        : spell.power + actor.stats.int * 0.8 - target.stats.int * 0.2;
      const hit = this.computeHit(actor, target, basePower, spell.element);
      this.applyDamage(target, hit.dmg);
      this.chipGuard(actor, target, hit.weak, spell.guardHit ?? 0, events, isAoe);
      this.maybeGainMomentum(actor, hit.weak);
      events.push({
        kind: 'spell',
        text: `${actor.name} casts ${spell.name}; ${target.name} takes ${hit.dmg}.${hitTags(hit)}`,
        actorId: actor.id, targetId: target.id, amount: hit.dmg, element: spell.element, spellId: spell.id, crit: hit.crit, weak: hit.weak, parallel: isAoe,
      });
      if (spell.inflict) this.applySpellInflict(actor, target, spell.inflict, events, isAoe);
      if (spell.element === 'physical') this.applyLifesteal(actor, hit.dmg, events, isAoe);
      this.applyReflect(actor, target, hit, events, isAoe);
      this.maybeKo(target, events, isAoe);
    }
  }

  private castHeal(actor: Combatant, spell: Spell, targetId: string, events: BattleEvent[]): void {
    const heal = Math.round(spell.power + actor.stats.int * 0.5 + (actor.gear?.healBonus ?? 0));
    const targets = spell.target === 'party'
      ? [...this.living(actor.side)]
      : [this.aliveTargetOr(targetId, actor.side) ?? actor];
    const isAoe = targets.length > 1;
    for (const target of targets) {
      if (target.stats.hp <= 0) continue;
      target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + heal);
      events.push({ kind: 'spell', text: `${actor.name} casts ${spell.name}; ${target.name} +${heal} HP.`, actorId: actor.id, targetId: target.id, amount: -heal, element: spell.element, spellId: spell.id, parallel: isAoe });
      // Cleansing Light boon: healing also washes ailments away.
      if (actor.side === 'party' && this.bn.healsCure && target.ailments && Object.keys(target.ailments).length > 0) {
        target.ailments = undefined;
        events.push({ kind: 'info', text: `${target.name} is cleansed of ailments.`, targetId: target.id, parallel: isAoe });
      }
    }
  }

  /** Ally-targeted CTB speed buff (Mira's Dawnrush) — see applySpeedStatus. */
  private castBuff(actor: Combatant, spell: Spell, targetId: string, events: BattleEvent[]): void {
    if (!spell.haste) return;
    const target = this.aliveTargetOr(targetId, actor.side) ?? actor;
    events.push({ kind: 'spell', text: `${actor.name} casts ${spell.name} on ${target.name}.`, actorId: actor.id, targetId: target.id, element: spell.element, spellId: spell.id });
    this.applySpeedStatus(target, 'haste', spell.haste.mult, spell.haste.turns, events);
  }

  // --- Boss Phase Transitions -----------------------------------------------

  /** Post-phase-2 per-own-turn boss specialness: currently just Forest
   * Shade's alternating weakness. Silent (no log spam) — visible instead
   * via the live weak-badge. */
  private bossTick(actor: Combatant): void {
    switch (actor.id) {
      case 'forest_shade': {
        actor.weakness = actor.weakness?.[0] === 'fire' ? ['holy'] : ['fire'];
        break;
      }
    }
  }

  /** Generic escalating self-haste for any enemy with enrageOnOwnTurn set
   * (Prism Sovereign's Overcharge, Ashen's Ember Hound) — gets faster every
   * one of its own turns, capped so it can't spiral unboundedly. */
  private enrageTick(actor: Combatant): void {
    const inc = actor.enrageOnOwnTurn ?? 0;
    if (inc <= 0) return;
    const cur = actor.speedStatuses?.haste?.mult ?? 1;
    actor.speedStatuses = { ...actor.speedStatuses, haste: { mult: Math.min(2.5, cur + inc), turns: 999 } };
  }

  private executeBossPhase(boss: Combatant): BattleEvent[] {
    const events: BattleEvent[] = [];

    switch (boss.id) {
      case 'forest_shade': {
        events.push({ kind: 'phase', text: 'The Forest Shade tears apart — shadows pour from its wound!', actorId: boss.id });
        const dmg = Math.round(12 + boss.stats.int * 0.7);
        for (const t of this.living('party')) {
          this.applyDamage(t, dmg);
          events.push({ kind: 'spell', text: `Shadow Veil engulfs ${t.name}! −${dmg} HP`, actorId: boss.id, targetId: t.id, amount: dmg, element: 'none', parallel: true });
          this.maybeKo(t, events, true);
          if (this.living('party').length === 0) break;
        }
        boss.stats.int = Math.round(boss.stats.int * 1.3);
        events.push({ kind: 'info', text: 'The Shade\'s power surges — it grows more dangerous!' });
        // Umbral Flicker: narrows to one weakness at a time, alternating
        // every one of its own turns from here on (see bossTick()).
        boss.weakness = ['fire'];
        events.push({ kind: 'info', text: 'The Shade splits its essence — its weakness now flickers between fire and holy light.' });
        break;
      }
      case 'tide_warden': {
        events.push({ kind: 'phase', text: 'The Tide Warden roars — the chamber floods in an instant!', actorId: boss.id });
        const surge = Math.round(18 + boss.stats.int * 0.8);
        for (const t of this.living('party')) {
          this.applyDamage(t, surge);
          events.push({ kind: 'spell', text: `Tidal Surge crashes into ${t.name}! −${surge} HP`, actorId: boss.id, targetId: t.id, amount: surge, element: 'ice', parallel: true });
          this.maybeKo(t, events, true);
          if (this.living('party').length === 0) break;
        }
        const heal = Math.round(boss.stats.maxHp * 0.12);
        boss.stats.hp = Math.min(boss.stats.maxHp, boss.stats.hp + heal);
        events.push({ kind: 'info', text: `The Warden draws the tide back into itself — +${heal} HP!` });
        // Undertow: every strike from here on drags the target back in the
        // turn queue (see strike()'s attackSpeedDebuff hook).
        boss.attackSpeedDebuff = { mult: 0.55, turns: 3 };
        events.push({ kind: 'info', text: 'The undertow answers the Warden\'s call — its strikes now drag victims under.' });
        break;
      }
      case 'ashbrand': {
        events.push({ kind: 'phase', text: 'Ashbrand ignites — the entire shrine becomes fire!', actorId: boss.id });
        const fire = Math.round(24 + boss.stats.int * 0.9);
        for (const t of this.living('party')) {
          this.applyDamage(t, fire);
          events.push({ kind: 'spell', text: `Conflagration scorches ${t.name}! −${fire} HP`, actorId: boss.id, targetId: t.id, amount: fire, element: 'fire', parallel: true });
          this.maybeKo(t, events, true);
          if (this.living('party').length === 0) break;
        }
        boss.stats.str = Math.round(boss.stats.str * 1.25);
        boss.stats.int = Math.round(boss.stats.int * 1.25);
        events.push({ kind: 'info', text: 'Ashbrand burns with primal fury — all power amplified!' });
        // Scorched Ground: from here on it hunts whoever is bracing and
        // burns them for certain (see enemyAi()'s targeting + strike()).
        events.push({ kind: 'info', text: 'Ashbrand\'s flames now hunt stillness — anyone who braces will burn for certain.' });
        break;
      }
      case 'prism_sovereign': {
        events.push({ kind: 'phase', text: 'The Prism Sovereign shatters its own shell — light scatters into blades!', actorId: boss.id });
        const shards = Math.round(20 + boss.stats.int * 0.85);
        for (const t of this.living('party')) {
          this.applyDamage(t, shards);
          events.push({ kind: 'spell', text: `Refracted Blades tear into ${t.name}! −${shards} HP`, actorId: boss.id, targetId: t.id, amount: shards, element: 'ice', parallel: true });
          this.maybeKo(t, events, true);
          if (this.living('party').length === 0) break;
        }
        const heal = Math.round(boss.stats.maxHp * 0.12);
        boss.stats.hp = Math.min(boss.stats.maxHp, boss.stats.hp + heal);
        events.push({ kind: 'info', text: `The crystal knits itself back together — +${heal} HP!` });
        // Overcharge: gets faster every one of its own turns from here on
        // (see enrageTick()), a compounding enrage for the final boss.
        boss.speedStatuses = { ...boss.speedStatuses, haste: { mult: 1.15, turns: 999 } };
        boss.enrageOnOwnTurn = 0.15;
        events.push({ kind: 'info', text: 'The crystal overcharges — the Sovereign begins to move faster with every passing moment.' });
        break;
      }
      case 'galebrand': {
        events.push({ kind: 'phase', text: 'Galebrand tears loose from its own anchor-point — the storm inside it runs wild!', actorId: boss.id });
        const surge = Math.round(20 + boss.stats.int * 0.85);
        for (const t of this.living('party')) {
          this.applyDamage(t, surge);
          events.push({ kind: 'spell', text: `Wild current rakes ${t.name}! −${surge} HP`, actorId: boss.id, targetId: t.id, amount: surge, element: 'none', parallel: true });
          this.maybeKo(t, events, true);
          if (this.living('party').length === 0) break;
        }
        // It can no longer hold its own power in — the storm burns through
        // its own form for the rest of the fight (see tickOwnStatuses()'s
        // generic burn handling; no new plumbing needed).
        this.applyAilment(boss, { ailment: 'burn', chance: 1, rounds: 99 }, events, true);
        events.push({ kind: 'info', text: 'The storm inside it has turned against it — and its strikes no longer answer to anything but the wind.' });
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
    if (actor.ailments?.chill) dmg *= CHILL_DMG_MULT; // chilled hands strike weakly
    const weak = element !== 'none' && (target.weakness?.includes(element) ?? false);
    let crit = false;
    if (actor.side === 'party') {
      dmg *= this.bn.dmgMult * (this.bn.elementMult[element] ?? 1);
      if (weak) dmg *= WEAK_MULT;
      if (target.broken) dmg *= BREAK_MULT + this.bn.breakDmgBonus + (actor.gear?.breakBonusDmg ?? 0);
      // Vulnerable Flesh: any ailment on the target (not just DoTs) opens it
      // up to everything else too — synergizes with every ailment-applying
      // boon/gear/weapon in the pool.
      if (this.bn.vulnerableBonus && target.ailments && Object.keys(target.ailments).length > 0) {
        dmg *= 1 + this.bn.vulnerableBonus;
      }
      // Guardian's Wrath: consumed by executeTurn() right after this action resolves.
      if (actor.guardBuffed) dmg *= GUARDIANS_WRATH_MULT;
      const lastStand = this.bn.hasLastStand && actor.stats.hp / actor.stats.maxHp <= LAST_STAND_THRESHOLD;
      if (lastStand) dmg *= LAST_STAND_DMG_MULT;
      let critChance = CRIT_BASE + this.bn.critBonus + (actor.gear?.critBonus ?? 0)
        + (this.bn.hasMomentum ? this.momentumStacks * MOMENTUM_CRIT_PER_STACK : 0);
      if (lastStand) critChance += LAST_STAND_CRIT_BONUS;
      crit = Math.random() < critChance;
      if (crit) dmg *= CRIT_MULT;
    }
    // Prism ward: this element barely scratches it — switch to another school.
    if (target.wardElement && element !== 'none' && element === target.wardElement) dmg *= WARD_MULT;
    if (target.defending) dmg *= element === 'physical' ? 0.5 : 0.75;
    return { dmg: Math.max(1, Math.round(dmg)), crit, weak };
  }

  /** Removes guard pips on weakness hits and skill chips; triggers BREAK at 0. */
  private chipGuard(actor: Combatant, target: Combatant, weak: boolean, guardHit: number, events: BattleEvent[], parallel = false): void {
    if (actor.side !== 'party' || target.side !== 'enemy') return;
    if (target.broken || (target.guard ?? 0) <= 0) return;
    const chip = (weak ? 1 + this.bn.guardChipBonus + (actor.gear?.guardChipBonus ?? 0) : 0) + guardHit;
    if (chip <= 0) return;
    target.guard = Math.max(0, (target.guard ?? 0) - chip);
    if (target.guard === 0) {
      target.broken = true;
      target.intent = undefined;
      events.push({ kind: 'break', text: `${target.name} is BROKEN — it reels, defenseless!`, targetId: target.id, parallel });
      if (this.bn.breakInflictsChill) {
        this.applyAilment(target, { ailment: 'chill', chance: 1, rounds: 2 }, events, true, parallel);
      }
    }
  }

  /** Momentum boon: a landed weakness hit raises crit chance for the rest
   * of the battle (read back in computeHit), capped so it can't run away. */
  private maybeGainMomentum(actor: Combatant, weak: boolean): void {
    if (!weak || actor.side !== 'party' || !this.bn.hasMomentum) return;
    this.momentumStacks = Math.min(MOMENTUM_MAX_STACKS, this.momentumStacks + 1);
  }

  private applyDamage(t: Combatant, dmg: number): void {
    t.stats.hp = Math.max(0, t.stats.hp - dmg);
    if (t.side === 'party' && dmg > 0) this.gainLimit(t, dmg);
  }

  /** Limit Break gauge gain from taking a hit — a bigger fraction of max HP
   *  lost fills it faster (see LIMIT_TAKEN_SCALE). */
  private gainLimit(c: Combatant, dmgTaken: number): void {
    const gain = Math.round((dmgTaken / c.stats.maxHp) * 100 * LIMIT_TAKEN_SCALE);
    if (gain <= 0) return;
    c.limit = Math.min(LIMIT_MAX, (c.limit ?? 0) + gain);
  }

  // --- Ailments ---------------------------------------------------------------

  /** Spell inflicts; party boons can turn the chance roll into a certainty. */
  private applySpellInflict(actor: Combatant, target: Combatant, inf: Inflict, events: BattleEvent[], parallel = false): void {
    const sure = actor.side === 'party' && this.bn.sureInflict.includes(inf.ailment);
    this.applyAilment(target, inf, events, sure, parallel);
  }

  /** Rolls the chance and applies/refreshes an ailment on a living target. */
  private applyAilment(target: Combatant, inf: Inflict, events: BattleEvent[], sure = false, parallel = false): void {
    if (target.stats.hp <= 0) return;
    if (!sure && Math.random() >= inf.chance) return;
    // Gear immunity: Tidewarden Mail shrugs off chill, Ashenguard Plate fire.
    if (target.gear?.resist.includes(inf.ailment)) {
      events.push({ kind: 'info', text: `${target.name}'s gear wards it off!`, targetId: target.id, parallel });
      return;
    }
    const had = (target.ailments?.[inf.ailment] ?? 0) > 0;
    target.ailments = target.ailments ?? {};
    target.ailments[inf.ailment] = Math.max(target.ailments[inf.ailment] ?? 0, inf.rounds);
    // Refreshing an active ailment is silent to keep the log readable.
    if (!had) {
      events.push({ kind: 'ailment', text: AILMENT_APPLY_TEXT[inf.ailment](target.name), targetId: target.id, ailment: inf.ailment, parallel });
    }
  }

  /** Haste/Slow application — mirrors applyAilment() for the CTB speed
   * stack (see effectiveSpeed()). Overwrites any existing status from the
   * same source rather than stacking. */
  private applySpeedStatus(target: Combatant, source: SpeedSource, mult: number, turns: number, events: BattleEvent[]): void {
    if (target.stats.hp <= 0) return;
    target.speedStatuses = target.speedStatuses ?? {};
    target.speedStatuses[source] = { mult, turns };
    if (source === 'slow') {
      events.push({ kind: 'info', text: `${target.name} is dragged under — its next turns slip away!`, targetId: target.id });
    } else if (source === 'haste' && target.side === 'party') {
      // Enemy self-haste (Overcharge, enrageOnOwnTurn) predates this and was
      // always silent — only the player-facing cast gets a log line.
      events.push({ kind: 'info', text: `${target.name} feels time quicken around them!`, targetId: target.id });
    }
  }

  /** Battle-scoped statuses do not follow the party out of the fight. */
  private clearPartyAilments(): void {
    for (const c of this.party) c.ailments = undefined;
  }

  private maybeKo(t: Combatant, events: BattleEvent[], parallel = false): void {
    if (t.stats.hp > 0) return;
    // Anchor's Promise: once per battle, a fallen hero returns.
    if (t.side === 'party' && this.bn.reviveOnce && !this.reviveUsed) {
      this.reviveUsed = true;
      t.stats.hp = Math.round(t.stats.maxHp * 0.4);
      events.push({ kind: 'info', text: `The Anchor flares — ${t.name} returns to the fight!`, targetId: t.id, amount: -t.stats.hp, parallel });
      return;
    }
    // Living Cinders and the like detonate as they die, hitting the whole party.
    if (t.side === 'enemy' && t.deathBurst) {
      const b = t.deathBurst;
      t.deathBurst = undefined; // consume so it can never double-fire
      events.push({ kind: 'info', text: `${t.name} bursts apart!`, actorId: t.id, parallel });
      // This inner blast always hits the whole party at once, regardless of
      // whether the death that triggered it was itself part of a batch.
      for (const p of this.living('party')) {
        const hit = this.computeHit(t, p, b.power, b.element);
        this.applyDamage(p, hit.dmg);
        events.push({ kind: 'spell', text: `${p.name} is caught in the blast (${hit.dmg}).`, targetId: p.id, amount: hit.dmg, element: b.element, weak: hit.weak, parallel: true });
        this.maybeKo(p, events, true);
      }
    }
    // Spreading Rot: a Burning or Poisoned enemy's affliction leaps to
    // another living enemy on death instead of just fizzling out.
    if (t.side === 'enemy' && this.bn.spreadAilmentOnDeath && t.ailments) {
      const spreadable = (Object.entries(t.ailments) as [Ailment, number][]).find(([a]) => a === 'burn' || a === 'venom');
      if (spreadable) {
        const [ailment, rounds] = spreadable;
        const others = this.living('enemy').filter((e) => e.id !== t.id);
        if (others.length > 0) {
          const victim = others[Math.floor(Math.random() * others.length)];
          this.applyAilment(victim, { ailment, chance: 1, rounds: Math.max(2, rounds) }, events, true, parallel);
        }
      }
    }
    events.push({ kind: 'ko', text: `${t.name} falls.`, targetId: t.id, parallel });
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

    // Ashbrand's Scorched Ground: past phase 2 it hunts anyone bracing —
    // strike() then guarantees the burn against them (no hiding in the fire).
    if (e.id === 'ashbrand' && e.phaseTriggered) {
      const defender = targets.find((t) => t.defending);
      if (defender) return { type: 'attack', targetId: defender.id };
    }

    // Galebrand's Wild Current: past phase 2, half its own turns the storm
    // picks a target at random — no weighting toward the wounded, no
    // avoiding whoever's bracing. The other half it's still coherent —
    // reads as losing control, not having none.
    if (e.id === 'galebrand' && e.phaseTriggered && Math.random() < 0.5) {
      const wild = targets[Math.floor(Math.random() * targets.length)];
      return { type: 'attack', targetId: wild.id };
    }

    // A defending target only takes half damage from a physical hit (75% from
    // magic) — usually the weaker play, so prefer whoever isn't bracing
    // unless everyone is (Ashbrand's hunt-the-defender case is handled above).
    const openTargets = targets.filter((t) => !t.defending);
    const pool = openTargets.length > 0 ? openTargets : targets;

    // Prefer the weakest living hero by HP *ratio*, not raw HP — a squishy
    // caster at 90% can have less raw HP than a tank at 50%, but the tank is
    // the one actually close to falling. Not relentless, though — pure focus
    // fire feels unfair and makes protecting a wounded member impossible.
    const weakest = pool.reduce((w, c) => (c.stats.hp / c.stats.maxHp) < (w.stats.hp / w.stats.maxHp) ? c : w);
    const target = Math.random() < 0.6 ? weakest : pool[Math.floor(Math.random() * pool.length)];

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
        // Spread ailments across the party instead of piling one onto a
        // target that already has it — prefer an open target without this
        // spell's ailment yet, falling back to the usual pick.
        const spellTarget = spell.inflict
          ? pool.find((t) => !t.ailments?.[spell.inflict!.ailment]) ?? target
          : target;
        return { type: 'spell', spellId, targetId: spellTarget.id };
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
      this.clearPartyAilments();
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
  if (hit.crit) tags += ' Critical!';
  return tags;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
