// Meta-progression: what survives a run. Every descent ends (wipe, retreat or
// a full clear) by banking Echoes — what the Anchor remembers of the attempt.
// Echoes buy permanent Anchor upgrades in Sanctuary. Levels, talents, boons,
// gold and gear are run-only; this is the slow, persistent growth on top.
//
// Pure data + pure helpers (no Phaser); the save fields live in save.ts.

export interface AnchorUpgrade {
  id: string;
  name: string;
  /** What one rank does (shown on the card). */
  desc: string;
  /** Cost of buying rank `rank + 1` (rank = ranks already owned). */
  costs: number[];
}

export const ANCHOR_UPGRADES: AnchorUpgrade[] = [
  { id: 'vitality', name: 'Anchored Flesh', desc: '+8% max HP for every hero.', costs: [10, 20, 35, 55, 80] },
  { id: 'mercy', name: "Anchor's Mercy", desc: 'Once per run, a party wipe is undone: everyone rises at 50% HP.', costs: [40, 140] },
  { id: 'purse', name: 'Pilgrim\'s Purse', desc: 'Start every run with +40 gold.', costs: [10, 20, 35] },
  { id: 'satchel', name: 'Warden\'s Satchel', desc: 'Start every run with +1 Elixir (rank 3: +1 Phoenix Down).', costs: [12, 25, 45] },
  { id: 'focus', name: 'Deep Wells', desc: '+4 max MP for every hero.', costs: [15, 30, 50] },
  { id: 'reroll', name: 'Second Thoughts', desc: '+1 reroll per run for talent and blessing picks.', costs: [20, 40, 70] },
  { id: 'insight', name: 'Insight', desc: 'Talent picks show 4 choices instead of 3.', costs: [60] },
  { id: 'scholar', name: 'Quick Study', desc: '+15% XP from every battle.', costs: [25, 50] },
  { id: 'veteran', name: 'Veteran\'s Start', desc: 'Heroes start every run one level higher.', costs: [50, 110] },
  { id: 'fortune', name: 'Favored', desc: 'Blessings lean toward rare and epic.', costs: [30, 60] },
];

export function upgradeDef(id: string): AnchorUpgrade | undefined {
  return ANCHOR_UPGRADES.find((u) => u.id === id);
}

/** Price of the next rank, or null when maxed. */
export function nextRankCost(id: string, owned: number): number | null {
  const def = upgradeDef(id);
  if (!def || owned >= def.costs.length) return null;
  return def.costs[owned];
}

/** Everything a run tracks to pay out Echoes at the end. */
export interface RunTally {
  fights: number;
  elites: number;
  bossChapters: number[]; // chapter number of each boss defeated this run
  rooms: number;
  deepest: number; // deepest depth reached this run
}

export function emptyTally(): RunTally {
  return { fights: 0, elites: 0, bossChapters: [], rooms: 0, deepest: 1 };
}

export interface EchoBreakdown {
  lines: Array<[string, number]>;
  total: number;
}

/** Echoes earned by a finished run. Ascension tiers pay 25% more each. */
export function echoesForRun(tally: RunTally, goldLeft: number, ascension: number, cleared: boolean): EchoBreakdown {
  const lines: Array<[string, number]> = [];
  if (tally.fights > 0) lines.push([`Battles won ×${tally.fights}`, tally.fights]);
  if (tally.elites > 0) lines.push([`Elites slain ×${tally.elites}`, tally.elites * 4]);
  const bossEchoes = tally.bossChapters.reduce((s, ch) => s + 6 + ch * 3, 0);
  if (bossEchoes > 0) lines.push([`Guardians felled ×${tally.bossChapters.length}`, bossEchoes]);
  const goldEchoes = Math.floor(goldLeft / 25);
  if (goldEchoes > 0) lines.push([`Gold melted (${goldLeft}g)`, goldEchoes]);
  if (cleared) lines.push(['Reached the bottom', 40]);
  let total = lines.reduce((s, [, n]) => s + n, 0);
  if (ascension > 0 && total > 0) {
    const bonus = Math.round(total * 0.25 * ascension);
    lines.push([`Ascension ${ascension} bonus`, bonus]);
    total += bonus;
  }
  return { lines, total };
}
