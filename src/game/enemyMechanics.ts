// Per-chapter signature mechanics and random elite affixes. Pure data and
// helpers, no Phaser: chapters.ts attaches the fields, battle.ts runs them,
// and BattleScene reads the badge/tip text from here so each mechanic is
// explained the first time it shows up.
//
// One signature per chapter, each asking for a different answer than "hit
// the weakness" (Chapter 1 stays the plain weakness/break tutorial):
//   Ch2 Tideshell  — shelled foes take half damage and can't be broken until
//                    an Ice hit shatters the shell. Open with ice.
//   Ch3 Fuse       — Living Cinders blast the party AND their own pack when
//                    they die; left alone, the fuse ends in a bigger blast.
//                    Pick when (and next to whom) to pop them.
//   Ch4 Attune     — a crystal hardens against whatever element just hit it:
//                    resisted, reflected by Prism Sprites, and no guard chip
//                    — so breaking one takes two different schools.
//   Ch5 Tempo      — Gale Harriers steal turn time from whoever they hit.
//                    A Defending hero keeps their place.
//   Ch6 Rime       — Glacial Wisps freeze a hero solid; an ally's heal or
//                    cure breaks the ice.

import type { Combatant, Element } from './types';

const ELEMENT_NAME: Partial<Record<Element, string>> = { physical: 'Physical', fire: 'Fire', ice: 'Ice', holy: 'Holy' };

// --- Elite affixes -----------------------------------------------------------

export type AffixId = 'armored' | 'hasted' | 'regenerating' | 'splitting';

interface AffixDef {
  id: AffixId;
  name: string;   // prefixed to the elite's name
  badge: string;  // short label under its HP bar
  intro: string;  // battle-start log line
}

export const ELITE_AFFIXES: Record<AffixId, AffixDef> = {
  armored: { id: 'armored', name: 'Armored', badge: '+1 GUARD', intro: 'Armored: one extra guard pip before it breaks.' },
  hasted: { id: 'hasted', name: 'Hasted', badge: 'HASTED', intro: 'Hasted: it acts far more often — Chill slows it.' },
  regenerating: { id: 'regenerating', name: 'Regenerating', badge: 'REGEN', intro: 'Regenerating: heals each turn unless Burned or Poisoned.' },
  splitting: { id: 'splitting', name: 'Splitting', badge: 'SPLITS AT 50%', intro: 'Splitting: at half HP a shard breaks away to fight.' },
};

const AFFIX_IDS = Object.keys(ELITE_AFFIXES) as AffixId[];
const HASTED_MULT = 1.3;
// Regenerating replaced the first draft's Vampiric (enemy lifesteal): elites
// land too few basic attacks per fight for a drain to matter (real-Battle
// sim: +0.3 turns at 100% lifesteal), while a per-turn regen that Burn and
// Venom shut off asks for a different answer — get a DoT on it.
const REGEN_FRAC = 0.1;

/** Mutates one elite in place with the given affix. */
export function applyEliteAffix(c: Combatant, id: AffixId): void {
  const def = ELITE_AFFIXES[id];
  const baseName = c.name;
  c.affix = id;
  c.name = `${def.name} ${baseName}`;
  switch (id) {
    case 'armored':
      c.maxGuard = (c.maxGuard ?? 0) + 1;
      c.guard = c.maxGuard;
      break;
    case 'hasted': {
      const cur = c.speedStatuses?.haste?.mult ?? 1;
      c.speedStatuses = { ...c.speedStatuses, haste: { mult: cur * HASTED_MULT, turns: 999 } };
      break;
    }
    case 'regenerating':
      c.regenFrac = REGEN_FRAC;
      break;
    case 'splitting':
      c.splitSpawn = makeShard(c, baseName);
      break;
  }
}

/** The weak add a Splitting elite sheds at half HP: a third of its HP, a
 *  softer hit, one guard pip, same weakness — and none of the elite's own
 *  specials, so it reads as a lesser copy rather than a second elite. */
function makeShard(parent: Combatant, baseName: string): Combatant {
  const p = parent.stats;
  const hp = Math.round(p.maxHp * 0.3);
  return {
    id: `${parent.id}_shard`, name: `${baseName} Shard`, side: 'enemy',
    spriteKey: parent.spriteKey, color: parent.color, size: Math.round(parent.size * 0.7),
    spells: [], goldReward: 0, xpReward: Math.round((parent.xpReward ?? 0) * 0.15),
    weakness: parent.weakness ? [...parent.weakness] : undefined, maxGuard: 1, guard: 1,
    stats: {
      maxHp: hp, hp, maxMp: 0, mp: 0,
      str: Math.round(p.str * 0.7), agi: p.agi, vit: Math.round(p.vit * 0.7), int: Math.round(p.int * 0.7),
    },
  };
}

/** Rolls one affix for every (non-boss) elite in a freshly spawned encounter. */
export function rollEliteAffixes(enemies: Combatant[], rng: () => number = Math.random): Combatant[] {
  for (const e of enemies) {
    if (!e.isElite || e.isBoss || e.affix) continue;
    applyEliteAffix(e, AFFIX_IDS[Math.floor(rng() * AFFIX_IDS.length)]);
  }
  return enemies;
}

// --- Battle UI text ----------------------------------------------------------

export interface MechanicBadge {
  text: string;
  color: string;
}

function hasFreezeSpell(c: Combatant): boolean {
  return c.spells.includes('rime_prison');
}

/** Short live label under an enemy's HP bar, or null when it has nothing
 *  special going on (anymore). Re-read every refresh — fuse counts down,
 *  shells shatter, attunement shifts. */
export function mechanicBadge(c: Combatant): MechanicBadge | null {
  const parts: MechanicBadge[] = [];
  if (c.shell) parts.push({ text: 'SHELL', color: '#6cb8ff' });
  if (c.fuse != null && c.deathBurst) parts.push({ text: `FUSE ${c.fuse}`, color: '#ff8a5a' });
  if (c.attuning) {
    const el = c.wardElement && ELEMENT_NAME[c.wardElement];
    parts.push({ text: el ? `RESISTS ${el.toUpperCase()}` : 'ATTUNES', color: '#c78aff' });
  }
  if (c.turnSteal) parts.push({ text: 'STEALS TURNS', color: '#9fd8f0' });
  if (hasFreezeSpell(c)) parts.push({ text: 'FREEZES', color: '#bfeaff' });
  if (c.affix && (c.affix !== 'splitting' || c.splitSpawn)) {
    parts.push({ text: ELITE_AFFIXES[c.affix as AffixId]?.badge ?? '', color: '#ffcf6a' });
  }
  if (parts.length === 0) return null;
  return { text: parts.map((p) => p.text).join(' · '), color: parts[0].color };
}

/** One-time prompt-line tips, keyed by save flag. The first entry whose
 *  mechanic is on the field and whose flag isn't set yet is shown. */
export const MECHANIC_TIPS: { flag: string; has: (c: Combatant) => boolean; text: string }[] = [
  { flag: 'seen_mech_shell', has: (c) => !!c.shell, text: 'Tip: SHELL halves damage and blocks BREAK — Ice shatters it' },
  { flag: 'seen_mech_fuse', has: (c) => c.fuse != null, text: 'Tip: a Cinder\'s death blast hits its pack too — FUSE 0 blasts harder' },
  { flag: 'seen_mech_attune', has: (c) => !!c.attuning, text: 'Tip: crystals harden against the last element that hit them' },
  { flag: 'seen_mech_tempo', has: (c) => !!c.turnSteal, text: 'Tip: Harriers steal turn order — a Defending hero keeps theirs' },
  { flag: 'seen_mech_rime', has: hasFreezeSpell, text: 'Tip: a frozen hero is freed by an ally\'s heal or cure' },
];

/** Battle-start log line for an elite fight: names the rolled affix. */
export function eliteIntro(enemies: Combatant[]): string {
  const affixed = enemies.find((e) => e.affix);
  const def = affixed && ELITE_AFFIXES[affixed.affix as AffixId];
  return def ? `An elite guardian blocks the way! ${def.intro}` : 'An elite guardian blocks the way!';
}
