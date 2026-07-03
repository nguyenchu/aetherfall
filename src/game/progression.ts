// XP and leveling. Kept pure with no Phaser. Levels are stored in save data;
// current-level XP lives on the combatant at runtime.

import { SPELLS } from './content';
import type { BattleEvent, Combatant, Stats } from './types';

/** XP required to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return 10 + level * level * 4;
}

const GROWABLE: (keyof Stats)[] = ['maxHp', 'maxMp', 'str', 'agi', 'vit', 'int'];

/**
 * Raises one combatant by one level, applies growth, refills HP/MP, and
 * teaches any spells in the learnset. Returns the newly learned spell ids.
 */
export function levelUp(c: Combatant): string[] {
  const g = c.growth ?? {};
  for (const key of GROWABLE) {
    const inc = g[key] ?? 0;
    if (inc) c.stats[key] += inc;
  }
  c.level = (c.level ?? 1) + 1;
  c.stats.hp = c.stats.maxHp;
  c.stats.mp = c.stats.maxMp;
  const learned = c.learnset?.[c.level] ?? [];
  for (const id of learned) {
    if (!c.spells.includes(id)) c.spells.push(id);
  }
  return learned;
}

/** Brings a fresh combatant up to a saved level without combat. */
export function restoreLevel(c: Combatant, targetLevel: number): void {
  while ((c.level ?? 1) < targetLevel) levelUp(c);
}

/**
 * Awards XP to the living party and handles level-ups.
 * Returns log events the scene can display.
 */
export function grantXp(party: Combatant[], amount: number): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const c of party) {
    if (c.stats.hp <= 0) continue; // defeated members do not receive XP this battle
    c.xp = (c.xp ?? 0) + amount;
    while (c.xp >= xpForLevel(c.level ?? 1)) {
      c.xp -= xpForLevel(c.level ?? 1);
      const learned = levelUp(c);
      events.push({ kind: 'info', text: `${c.name} reached level ${c.level}!` });
      for (const id of learned) {
        const spell = SPELLS[id];
        if (spell) events.push({ kind: 'info', text: `${c.name} learned ${spell.name}!` });
      }
    }
  }
  return events;
}
