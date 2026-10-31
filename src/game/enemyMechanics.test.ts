import { describe, expect, it } from 'vitest';
import {
  ELITE_AFFIXES, applyEliteAffix, eliteIntro, mechanicBadge, rollEliteAffixes, type AffixId,
} from './enemyMechanics';
import type { Combatant } from './types';

function enemy(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'golem', name: 'Golem', side: 'enemy', spriteKey: 'golem', color: 0xffffff, size: 40,
    spells: [], xpReward: 100, weakness: ['ice'], maxGuard: 2, guard: 2,
    stats: { maxHp: 300, hp: 300, maxMp: 0, mp: 0, str: 20, agi: 10, vit: 30, int: 10 },
    ...overrides,
  };
}

describe('applyEliteAffix', () => {
  it('prefixes the name and records the affix', () => {
    const c = enemy();
    applyEliteAffix(c, 'hasted');
    expect(c.name).toBe('Hasted Golem');
    expect(c.affix).toBe('hasted');
  });

  it('armored adds a guard pip and refills guard', () => {
    const c = enemy({ guard: 0 });
    applyEliteAffix(c, 'armored');
    expect(c.maxGuard).toBe(3);
    expect(c.guard).toBe(3);
  });

  it('hasted stacks on an existing haste', () => {
    const c = enemy({ speedStatuses: { haste: { mult: 2, turns: 3 } } });
    applyEliteAffix(c, 'hasted');
    expect(c.speedStatuses?.haste?.mult).toBeCloseTo(2.6);
    expect(c.speedStatuses?.haste?.turns).toBe(999);
  });

  it('regenerating sets a per-turn heal fraction', () => {
    const c = enemy();
    applyEliteAffix(c, 'regenerating');
    expect(c.regenFrac).toBe(0.1);
  });

  it('splitting prepares a weaker shard that keeps the weakness', () => {
    const c = enemy();
    applyEliteAffix(c, 'splitting');
    const shard = c.splitSpawn!;
    expect(shard.name).toBe('Golem Shard');
    expect(shard.stats.maxHp).toBe(90);
    expect(shard.stats.hp).toBe(90);
    expect(shard.stats.str).toBe(14);
    expect(shard.maxGuard).toBe(1);
    expect(shard.weakness).toEqual(['ice']);
    expect(shard.weakness).not.toBe(c.weakness);
    expect(shard.xpReward).toBe(15);
    expect(shard.affix).toBeUndefined();
  });
});

describe('rollEliteAffixes', () => {
  const ids = Object.keys(ELITE_AFFIXES) as AffixId[];

  it('only rolls for elites that are not bosses and not already affixed', () => {
    const trash = enemy({ id: 'a' });
    const boss = enemy({ id: 'b', isElite: true, isBoss: true });
    const done = enemy({ id: 'c', isElite: true, affix: 'armored', name: 'Armored Golem' });
    const elite = enemy({ id: 'd', isElite: true });
    rollEliteAffixes([trash, boss, done, elite], () => 0);
    expect(trash.affix).toBeUndefined();
    expect(boss.affix).toBeUndefined();
    expect(done.name).toBe('Armored Golem');
    expect(elite.affix).toBe(ids[0]);
  });

  it('maps the rng range onto every affix', () => {
    const rolled = ids.map((_, i) => {
      const e = enemy({ isElite: true });
      rollEliteAffixes([e], () => (i + 0.5) / ids.length);
      return e.affix;
    });
    expect(rolled).toEqual(ids);
    const last = enemy({ isElite: true });
    rollEliteAffixes([last], () => 0.999999);
    expect(last.affix).toBe(ids[ids.length - 1]);
  });
});

describe('mechanicBadge', () => {
  it('is null for a plain enemy', () => {
    expect(mechanicBadge(enemy())).toBeNull();
  });

  it('joins several mechanics and uses the first colour', () => {
    const badge = mechanicBadge(enemy({ shell: { breaker: 'ice', mult: 0.5 }, turnSteal: 0.3 }));
    expect(badge).toEqual({ text: 'SHELL · STEALS TURNS', color: '#6cb8ff' });
  });

  it('shows the fuse only with a death burst', () => {
    expect(mechanicBadge(enemy({ fuse: 2 }))).toBeNull();
    expect(mechanicBadge(enemy({ fuse: 2, deathBurst: { element: 'fire', power: 10 } }))?.text).toBe('FUSE 2');
  });

  it('names the attuned element', () => {
    expect(mechanicBadge(enemy({ attuning: true }))?.text).toBe('ATTUNES');
    expect(mechanicBadge(enemy({ attuning: true, wardElement: 'fire' }))?.text).toBe('RESISTS FIRE');
  });

  it('drops the splitting badge once the shard is spent', () => {
    const c = enemy({ isElite: true });
    applyEliteAffix(c, 'splitting');
    expect(mechanicBadge(c)?.text).toBe('SPLITS AT 50%');
    c.splitSpawn = undefined;
    expect(mechanicBadge(c)).toBeNull();
  });
});

describe('eliteIntro', () => {
  it('names the rolled affix', () => {
    const c = enemy({ isElite: true });
    applyEliteAffix(c, 'regenerating');
    expect(eliteIntro([enemy(), c])).toContain(ELITE_AFFIXES.regenerating.intro);
  });

  it('falls back to the plain line', () => {
    expect(eliteIntro([enemy()])).toBe('An elite guardian blocks the way!');
  });
});
