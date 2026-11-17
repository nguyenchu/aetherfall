// Talents: how a hero grows *during* a run. Every run starts the party at
// level 1 (plus Anchor upgrades), and every TALENT_EVERY levels each hero
// picks one of three talents from their own pool: a new skill, an upgrade of
// a skill they already have, or a passive perk. The pools are bigger than a
// run can take, so no two descents end with the same three heroes.
//
// Pure data + pure helpers (no Phaser). Passive perks use the same
// GearEffects struct as equipment, merged in run.ts refreshGearEffects().

import { SPELLS } from './content';
import type { Combatant, GearEffects, Stats } from './types';

export type TalentKind = 'skill' | 'upgrade' | 'passive' | 'stat';
export type HeroId = 'kael' | 'lyra' | 'mira';

export interface Talent {
  id: string;
  hero: HeroId | 'any';
  name: string;
  desc: string;
  kind: TalentKind;
  /** Spell added to the hero's list. */
  learn?: string;
  /** Spell this one replaces; the talent is only offered while the hero has it. */
  replaces?: string;
  /** Passive effects, merged with gear effects. */
  perks?: Partial<GearEffects>;
  /** Flat stat change applied once on pick. */
  stats?: Partial<Stats>;
  /** +fraction of max HP applied once on pick. */
  hpPct?: number;
  /** Generic fillers may be taken more than once. */
  repeatable?: boolean;
}

/** A talent pick is earned on every level divisible by this. */
export const TALENT_EVERY = 2;

export const TALENTS: Record<string, Talent> = {};

function t(def: Talent): void {
  TALENTS[def.id] = def;
}

// --- Kael — Aetherblade: guard-breaking, front line, physical pressure ------
t({ id: 'k_cleave', hero: 'kael', kind: 'skill', learn: 'cleave', name: 'Arc Sweep', desc: 'Skill: slash every enemy at once.' });
t({ id: 'k_bash_plus', hero: 'kael', kind: 'upgrade', learn: 'bash_plus', replaces: 'bash', name: 'Guardbreak+', desc: 'Upgrade: Guardbreak hits harder and chips 2 guard pips.' });
t({ id: 'k_flurry', hero: 'kael', kind: 'skill', learn: 'flurry', name: 'Aether Flurry', desc: 'Skill: three quick hits on random foes.' });
t({ id: 'k_sunfire', hero: 'kael', kind: 'skill', learn: 'sunfire_blade', name: 'Sunfire Blade', desc: 'Skill: a fire strike that scales with STR. May Burn.' });
t({ id: 'k_hoarfrost', hero: 'kael', kind: 'skill', learn: 'hoarfrost_blade', name: 'Hoarfrost Blade', desc: 'Skill: an ice strike that scales with STR. May Chill.' });
t({ id: 'k_rend', hero: 'kael', kind: 'skill', learn: 'rend', name: 'Rending Strike', desc: 'Skill: a cut that always inflicts Venom.' });
t({ id: 'k_provoke', hero: 'kael', kind: 'skill', learn: 'provoke', name: "Warden's Call", desc: 'Skill: enemies must target Kael for 2 turns, and he takes -40% damage.' });
t({ id: 'k_riposte', hero: 'kael', kind: 'passive', perks: { counterChance: 0.4 }, name: 'Riposte', desc: '40% chance to strike back when an enemy attacks Kael.' });
t({ id: 'k_executioner', hero: 'kael', kind: 'passive', perks: { executeBonus: 0.6 }, name: 'Executioner', desc: 'Kael deals +60% damage to enemies at 30% HP or less.' });
t({ id: 'k_bloodsworn', hero: 'kael', kind: 'passive', perks: { lifesteal: 0.2 }, name: 'Bloodsworn', desc: 'Kael heals for 20% of the physical damage he deals.' });
t({ id: 'k_rhythm', hero: 'kael', kind: 'passive', perks: { attackMpBonus: 2, killMp: 2 }, name: 'Battle Rhythm', desc: 'Kael\'s attacks restore +2 MP, and kills restore 2 more.' });
t({ id: 'k_stalwart', hero: 'kael', kind: 'passive', perks: { defendHeal: 0.15 }, name: 'Stalwart', desc: 'Defending restores 15% of Kael\'s max HP.' });
t({ id: 'k_vanguard', hero: 'kael', kind: 'passive', perks: { firstStrike: 0.7 }, name: 'Vanguard', desc: 'Kael almost always takes the first turn of a battle.' });
t({ id: 'k_ironskin', hero: 'kael', kind: 'stat', stats: { vit: 4 }, hpPct: 0.2, name: 'Iron Skin', desc: '+20% max HP and +4 VIT.' });

// --- Lyra — Hexweaver: elements, ailments, burst ----------------------------
t({ id: 'l_hexstorm', hero: 'lyra', kind: 'skill', learn: 'firewave', name: 'Hexstorm', desc: 'Skill: a fire hex on every enemy. May Burn.' });
t({ id: 'l_winter', hero: 'lyra', kind: 'skill', learn: 'blizzard', name: 'Winter Sigil', desc: 'Skill: an ice sigil on every enemy. May Chill.' });
t({ id: 'l_fire_plus', hero: 'lyra', kind: 'upgrade', learn: 'fire_plus', replaces: 'fire', name: 'Ember Hex+', desc: 'Upgrade: Ember Hex hits much harder and usually Burns.' });
t({ id: 'l_frost_plus', hero: 'lyra', kind: 'upgrade', learn: 'frost_plus', replaces: 'frost', name: 'Rime Hex+', desc: 'Upgrade: Rime Hex hits much harder and usually Chills.' });
t({ id: 'l_blight', hero: 'lyra', kind: 'skill', learn: 'blight', name: 'Blight Hex', desc: 'Skill: poison every enemy (always Venom).' });
t({ id: 'l_siphon', hero: 'lyra', kind: 'skill', learn: 'siphon', name: 'Aether Siphon', desc: 'Skill (free): drain a foe; half the damage returns as MP.' });
t({ id: 'l_spellweaver', hero: 'lyra', kind: 'passive', perks: { freeCastChance: 0.3 }, name: 'Spellweaver', desc: '30% chance Lyra\'s spells cost no MP.' });
t({ id: 'l_overload', hero: 'lyra', kind: 'passive', perks: { spellDmgMult: 1.3 }, name: 'Overload', desc: 'Lyra\'s damage spells deal +30%.' });
t({ id: 'l_searing', hero: 'lyra', kind: 'passive', perks: { afflictedBonus: 0.35 }, name: 'Searing Mind', desc: 'Lyra deals +35% damage to enemies with any ailment.' });
t({ id: 'l_echo', hero: 'lyra', kind: 'passive', perks: { echoChance: 0.3 }, name: 'Echo', desc: 'Single-target hexes have a 30% chance to cast twice.' });
t({ id: 'l_font', hero: 'lyra', kind: 'passive', perks: { mpRegen: 2 }, stats: { maxMp: 8 }, name: 'Aether Font', desc: '+8 max MP; Lyra regains 2 MP every turn.' });
t({ id: 'l_wardskin', hero: 'lyra', kind: 'stat', stats: { vit: 4 }, hpPct: 0.25, name: 'Wardskin', desc: '+25% max HP and +4 VIT.' });

// --- Mira — Dawnkeeper: healing, protection, holy ----------------------------
t({ id: 'm_haste', hero: 'mira', kind: 'skill', learn: 'haste', name: 'Dawnrush', desc: 'Skill: an ally acts much faster for 3 turns.' });
t({ id: 'm_sunward', hero: 'mira', kind: 'skill', learn: 'cureall', name: 'Sunward', desc: 'Skill: heal the whole party.' });
t({ id: 'm_cure_plus', hero: 'mira', kind: 'upgrade', learn: 'cure_plus', replaces: 'cure', name: 'Dawnmend+', desc: 'Upgrade: a much stronger heal that also cleanses ailments.' });
t({ id: 'm_smite_plus', hero: 'mira', kind: 'upgrade', learn: 'smite_plus', replaces: 'smite', name: 'Dawnstrike+', desc: 'Upgrade: Dawnstrike hits harder and chips a guard pip.' });
t({ id: 'm_ward', hero: 'mira', kind: 'skill', learn: 'radiant_ward', name: 'Radiant Ward', desc: 'Skill: an ally takes half damage for 2 turns.' });
t({ id: 'm_rekindle', hero: 'mira', kind: 'skill', learn: 'rekindle', name: 'Rekindle', desc: 'Skill: revive a fallen ally at 40% HP.' });
t({ id: 'm_nova', hero: 'mira', kind: 'skill', learn: 'holy_nova', name: 'Dawnburst', desc: 'Skill: holy damage to every enemy.' });
t({ id: 'm_benediction', hero: 'mira', kind: 'passive', perks: { healBonus: 14 }, name: 'Benediction', desc: 'Mira\'s heals restore 14 more HP.' });
t({ id: 'm_zealot', hero: 'mira', kind: 'passive', perks: { holyAttack: true }, stats: { str: 4 }, name: 'Zealot', desc: '+4 STR; Mira\'s attacks strike as Holy.' });
t({ id: 'm_angel', hero: 'mira', kind: 'passive', perks: { deathSave: true }, name: 'Guardian Angel', desc: 'Once per battle, the first ally to take a lethal hit survives at 1 HP.' });
t({ id: 'm_chorus', hero: 'mira', kind: 'passive', perks: { battleStartLimit: 30 }, name: 'Dawn Chorus', desc: 'The whole party starts every battle with 30 Limit.' });
t({ id: 'm_light', hero: 'mira', kind: 'passive', perks: { mpRegen: 2 }, stats: { maxMp: 6 }, name: 'Inner Light', desc: '+6 max MP; Mira regains 2 MP every turn.' });

// --- Fillers: offered only once a hero has fewer than three real options ----
t({ id: 'any_hardy', hero: 'any', kind: 'stat', hpPct: 0.12, repeatable: true, name: 'Hardy', desc: '+12% max HP.' });
t({ id: 'any_might', hero: 'any', kind: 'stat', stats: { str: 3, int: 3 }, repeatable: true, name: 'Might', desc: '+3 STR and +3 INT.' });
t({ id: 'any_swift', hero: 'any', kind: 'stat', stats: { agi: 3 }, repeatable: true, name: 'Swiftness', desc: '+3 AGI: act more often.' });

const KIND_WEIGHT: Record<TalentKind, number> = { skill: 3, upgrade: 3, passive: 2.5, stat: 1.2 };

/** True if this hero could take `talent` right now. */
export function talentEligible(hero: Combatant, talent: Talent): boolean {
  if (talent.hero !== 'any' && talent.hero !== hero.id) return false;
  const taken = hero.talents ?? [];
  if (!talent.repeatable && taken.includes(talent.id)) return false;
  if (talent.replaces && !hero.spells.includes(talent.replaces)) return false;
  if (talent.learn && hero.spells.includes(talent.learn)) return false;
  return true;
}

/** Rolls up to `count` distinct talent choices for one hero. */
export function rollTalentChoices(hero: Combatant, count = 3, rng: () => number = Math.random): Talent[] {
  const own = Object.values(TALENTS).filter((x) => x.hero !== 'any' && talentEligible(hero, x));
  const picks: Talent[] = [];
  const pool = [...own];
  while (picks.length < count && pool.length > 0) {
    const total = pool.reduce((s, x) => s + KIND_WEIGHT[x.kind], 0);
    let roll = rng() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      roll -= KIND_WEIGHT[pool[i].kind];
      if (roll <= 0) { idx = i; break; }
    }
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }
  // Late in a long run a hero can run out of unique talents: top up with
  // generic stat fillers so a pick is never empty.
  const fillers = Object.values(TALENTS).filter((x) => x.hero === 'any');
  while (picks.length < count && fillers.length > 0) {
    const i = Math.floor(rng() * fillers.length);
    picks.push(fillers[i]);
    fillers.splice(i, 1);
  }
  return picks;
}

/** Applies a picked talent to the hero (spells and stats). Perks are read
 *  back from hero.talents by talentPerks(). */
export function applyTalent(hero: Combatant, id: string): void {
  const talent = TALENTS[id];
  if (!talent) return;
  hero.talents = [...(hero.talents ?? []), id];
  if (talent.learn) {
    const idx = talent.replaces ? hero.spells.indexOf(talent.replaces) : -1;
    if (idx >= 0) hero.spells[idx] = talent.learn;
    else if (!hero.spells.includes(talent.learn)) hero.spells.push(talent.learn);
  }
  if (talent.stats) {
    for (const [key, value] of Object.entries(talent.stats) as Array<[keyof Stats, number]>) {
      hero.stats[key] += value;
      if (key === 'maxHp') hero.stats.hp += value;
      if (key === 'maxMp') hero.stats.mp += value;
    }
  }
  if (talent.hpPct) {
    const add = Math.round(hero.stats.maxHp * talent.hpPct);
    hero.stats.maxHp += add;
    if (hero.stats.hp > 0) hero.stats.hp += add;
  }
}

/** Combined passive perks of the given talent ids. */
export function talentPerks(ids: string[]): Partial<GearEffects> {
  const out: Partial<GearEffects> = {};
  const add = (key: keyof GearEffects, value: number) => {
    const cur = (out[key] as number | undefined) ?? 0;
    (out as Record<string, unknown>)[key] = cur + value;
  };
  for (const id of ids) {
    const perks = TALENTS[id]?.perks;
    if (!perks) continue;
    for (const [key, value] of Object.entries(perks) as Array<[keyof GearEffects, unknown]>) {
      if (typeof value === 'number') {
        if (key === 'spellDmgMult') out.spellDmgMult = (out.spellDmgMult ?? 1) * value;
        else add(key, value);
      } else if (typeof value === 'boolean') {
        (out as Record<string, unknown>)[key] = value || (out as Record<string, unknown>)[key] === true;
      }
    }
  }
  return out;
}

/** How many talent picks crossing from level `before` to `after` earns. */
export function talentPicksBetween(before: number, after: number): number {
  let n = 0;
  for (let lv = before + 1; lv <= after; lv++) if (lv % TALENT_EVERY === 0) n++;
  return n;
}

/** Short tag for a talent card. */
export function talentKindLabel(talent: Talent): string {
  if (talent.kind === 'skill') {
    const spell = talent.learn ? SPELLS[talent.learn] : undefined;
    return spell ? `NEW SKILL · ${spell.cost} MP` : 'NEW SKILL';
  }
  if (talent.kind === 'upgrade') return 'UPGRADE';
  if (talent.kind === 'passive') return 'PASSIVE';
  return 'STATS';
}

export function talentKindColor(talent: Talent): string {
  return talent.kind === 'skill' ? '#6cf0c2'
    : talent.kind === 'upgrade' ? '#f0d36c'
    : talent.kind === 'passive' ? '#c07aff'
    : '#9aa3c8';
}
