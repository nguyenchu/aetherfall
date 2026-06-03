// XP and leveling. Kept pure with no Phaser. Levels are stored in save data;
// current-level XP lives on the combatant at runtime.

import type { BattleEvent, Combatant, Stats } from './types';

/** XP required to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return 18 + level * level * 7;
}

const GROWABLE: (keyof Stats)[] = ['maxHp', 'maxMp', 'str', 'agi', 'vit', 'int'];

/** Raises one combatant by one level, applies growth, and refills HP/MP. */
export function levelUp(c: Combatant): void {
  const g = c.growth ?? {};
  for (const key of GROWABLE) {
    const inc = g[key] ?? 0;
    if (inc) c.stats[key] += inc;
  }
  c.level = (c.level ?? 1) + 1;
  c.stats.hp = c.stats.maxHp;
  c.stats.mp = c.stats.maxMp;
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
      levelUp(c);
      events.push({ kind: 'info', text: `${c.name} reached level ${c.level}!` });
    }
  }
  return events;
}
