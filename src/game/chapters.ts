// Chapter definitions: fixed maps, encounters, and story triggers.
// Each area is a hand-crafted ASCII map — no procedural generation.
//
// Tile key:
//   #  tree / wall        .  walkable path
//   P  player start       <  back (Sanctuary or previous area)
//   >  advance (next area or boss)
//   E  encounter spot     B  boss
//   X  elite guardian     T  treasure chest
//   H  healing spring     S  story trigger

import type { Combatant, Element, Stats } from './types';

// ---------------------------------------------------------------------------
// Chapter 1 enemies
// ---------------------------------------------------------------------------

function s(hp: number, str: number, agi: number, vit: number, int: number, mp = 0): Stats {
  return { maxHp: hp, hp, maxMp: mp, mp, str, agi, vit, int };
}

/** Attaches weakness + guard pips used by the break system. */
function armed(c: Combatant, weakness: Element[], maxGuard: number): Combatant {
  return { ...c, weakness, maxGuard, guard: maxGuard };
}

function shadowWolf(id: string): Combatant {
  return armed({
    id, name: 'Shadow Wolf', side: 'enemy',
    spriteKey: 'e_ghoul', color: 0x334466, size: 24,
    spells: [], goldReward: 8, xpReward: 10,
    attackInflict: { ailment: 'venom', chance: 0.2, rounds: 2 },
    stats: s(30, 11, 10, 5, 1),
  }, ['phys', 'fire'], 1);
}

function corruptedSprite(id: string): Combatant {
  return armed({
    id, name: 'Corrupted Sprite', side: 'enemy',
    spriteKey: 'e_sprite', color: 0x7755aa, size: 18,
    spells: ['frost'], goldReward: 10, xpReward: 12,
    stats: s(20, 5, 13, 3, 10, 14),
  }, ['fire'], 1);
}

function aetherWisp(id: string): Combatant {
  return armed({
    id, name: 'Aether Wisp', side: 'enemy',
    spriteKey: 'e_sprite', color: 0xaaaaff, size: 16,
    spells: ['smite'], goldReward: 12, xpReward: 14,
    stats: s(16, 4, 15, 2, 13, 18),
  }, ['ice'], 1);
}

function alphaWolf(): Combatant {
  return armed({
    id: 'elite0', name: 'Alpha Shade Wolf', side: 'enemy',
    spriteKey: 'e_ghoul', color: 0x1a2244, size: 30,
    spells: [], goldReward: 35, xpReward: 45, isElite: true,
    attackInflict: { ailment: 'venom', chance: 0.35, rounds: 3 },
    stats: s(72, 14, 11, 7, 2),
  }, ['phys', 'fire'], 2);
}

function forestShade(): Combatant {
  return armed({
    id: 'forest_shade', name: 'Forest Shade', side: 'enemy',
    spriteKey: 'e_leviathan', color: 0x112233, size: 38,
    spells: ['frost', 'fire'], goldReward: 60, xpReward: 100,
    isBoss: true,
    stats: s(300, 16, 9, 10, 18, 50),
  }, ['fire', 'holy'], 3);
}

type EncounterGroup = 'wolves' | 'wolf_sprite' | 'sprites' | 'wisps' | 'elite' | 'boss';

export function makeChapter1Encounter(group: EncounterGroup): Combatant[] {
  switch (group) {
    case 'wolves':      return [shadowWolf('e0'), shadowWolf('e1')];
    case 'wolf_sprite': return [shadowWolf('e0'), corruptedSprite('e1')];
    case 'sprites':     return [corruptedSprite('e0'), corruptedSprite('e1'), aetherWisp('e2')];
    case 'wisps':       return [aetherWisp('e0'), aetherWisp('e1')];
    case 'elite':       return [alphaWolf(), shadowWolf('e1')];
    case 'boss':        return [forestShade()];
  }
}

// ---------------------------------------------------------------------------
// Area definitions
// ---------------------------------------------------------------------------

export interface AreaTheme {
  id: string;        // used for tile texture cache keys
  bg: number;        // background fill
  floor: number;     // primary floor tile
  floorAlt: number;  // alternate floor tile
  wall: number;      // wall tile
  accent: number;    // glow / portal color
  fogColor: number;  // ambient particle color
  fogAlpha: number;  // ambient particle alpha
}

export interface ChestContents {
  gold?: number;
  items?: Record<string, number>;
  equipment?: string;
}

export interface AreaDef {
  id: string;
  name: string;
  theme: AreaTheme;
  /** Tile-keyed encounter groups: 'col,row' -> group name */
  encounters: Record<string, string>;
  /** Tile-keyed dialogue script ids */
  scripts: Record<string, string>;
  /** Tile-keyed treasure chest contents */
  chests: Record<string, ChestContents>;
  map: string[];
}

export const THEMES: Record<string, AreaTheme> = {
  forest: {
    id: 'forest',
    bg: 0x050e07,
    floor: 0x131f14, floorAlt: 0x172318,
    wall: 0x081008,
    accent: 0x4aaa5a,
    fogColor: 0x3a8a4a, fogAlpha: 0.14,
  },
  sunken: {
    id: 'sunken',
    bg: 0x060b12,
    floor: 0x111a26, floorAlt: 0x162030,
    wall: 0x080e18,
    accent: 0x3a7a9a,
    fogColor: 0x2a5a8a, fogAlpha: 0.16,
  },
  ashen: {
    id: 'ashen',
    bg: 0x0e0705,
    floor: 0x1e1008, floorAlt: 0x24140a,
    wall: 0x100804,
    accent: 0xcc4411,
    fogColor: 0xaa3311, fogAlpha: 0.12,
  },
};

// Area 1 – Forest Entrance. 30 cols × 15 rows.
// Player arrives from Sanctuary at bottom, proceeds to the grove (>).
// An elite wolf (X) guards a treasure corridor in the northeast.
const AREA_1: AreaDef = {
  id: 'forest_1',
  name: 'Ashenveil Forest',
  theme: THEMES.forest,
  encounters: {
    '9,2':   'wolf_sprite',
    '3,6':   'wolves',
    '25,6':  'sprites',
    '10,10': 'wolves',
    '22,10': 'wisps',
    '24,2':  'elite',
  },
  scripts: {},
  chests: {
    '22,2': { gold: 40, items: { potion: 2 } },
  },
  map: [
    '##############################',
    '#....................#########',
    '#........E...........#T.X....#',
    '#..##................#######.#',
    '#..##........................#',
    '#.....####........####.......#',
    '#..E..####...>....####...E...#',
    '#.....####........####.......#',
    '#............................#',
    '#...##..........##...........#',
    '#...##....E.....##....E......#',
    '#...##..........##...........#',
    '#............................#',
    '#<............P..............#',
    '##############################',
  ],
};

// Area 2 – Ancient Grove. Boss area. 30 cols × 15 rows.
// A healing spring (H) waits before the boss; a chest hides in the south.
const AREA_2: AreaDef = {
  id: 'forest_2',
  name: 'Ancient Grove',
  theme: THEMES.forest,
  encounters: {
    '14,7': 'boss',
  },
  scripts: {
    '14,4': 'ch1_crystal',
  },
  chests: {
    '11,11': { gold: 30 },
  },
  map: [
    '##############################',
    '#............................#',
    '#.####.................####..#',
    '#.####.................####..#',
    '#.####........S........####..#',
    '#.####.................####..#',
    '#............................#',
    '#....H........B..............#',
    '#............................#',
    '#.####.................####..#',
    '#.####.................####..#',
    '#.####.....T...........####..#',
    '#............................#',
    '#<...........P...............#',
    '##############################',
  ],
};

// ---------------------------------------------------------------------------
// Chapter 2 enemies — Sunken City (depth 3-4)
// ---------------------------------------------------------------------------

function drownedSoldier(id: string): Combatant {
  return armed({
    id, name: 'Drowned Soldier', side: 'enemy',
    spriteKey: 'e_warden', color: 0x2a4a6a, size: 26,
    spells: [], goldReward: 14, xpReward: 18,
    stats: s(80, 17, 7, 13, 2),
  }, ['holy'], 2);
}

function mireSprite(id: string): Combatant {
  return armed({
    id, name: 'Mire Sprite', side: 'enemy',
    spriteKey: 'e_sprite', color: 0x5a8a5a, size: 18,
    spells: ['fire', 'frost'], goldReward: 16, xpReward: 20,
    stats: s(52, 8, 15, 5, 16, 24),
  }, ['fire'], 1);
}

function tombCrawler(id: string): Combatant {
  return armed({
    id, name: 'Tomb Crawler', side: 'enemy',
    spriteKey: 'e_crawler', color: 0x6a4a2a, size: 28,
    spells: [], goldReward: 12, xpReward: 16,
    attackInflict: { ailment: 'venom', chance: 0.3, rounds: 3 },
    stats: s(90, 14, 6, 15, 1),
  }, ['ice'], 2);
}

function keepSentinel(): Combatant {
  return armed({
    id: 'elite0', name: 'Keep Sentinel', side: 'enemy',
    spriteKey: 'e_warden', color: 0x152e4a, size: 32,
    spells: ['frost'], goldReward: 50, xpReward: 70, isElite: true,
    stats: s(150, 20, 8, 16, 8, 20),
  }, ['holy', 'fire'], 3);
}

function tideWarden(): Combatant {
  return armed({
    id: 'tide_warden', name: 'Tide Warden', side: 'enemy',
    spriteKey: 'e_leviathan', color: 0x1a3a5a, size: 40,
    spells: ['frost', 'cure'], goldReward: 80, xpReward: 140,
    isBoss: true,
    attackInflict: { ailment: 'chill', chance: 0.25, rounds: 2 },
    stats: s(460, 20, 10, 16, 20, 60),
  }, ['fire', 'holy'], 3);
}

type Ch2EncounterGroup = 'soldiers' | 'soldier_sprite' | 'crawlers' | 'sprites' | 'elite' | 'ch2_boss';

export function makeChapter2Encounter(group: Ch2EncounterGroup): Combatant[] {
  switch (group) {
    case 'soldiers':       return [drownedSoldier('e0'), drownedSoldier('e1')];
    case 'soldier_sprite': return [drownedSoldier('e0'), mireSprite('e1')];
    case 'crawlers':       return [tombCrawler('e0'), tombCrawler('e1')];
    case 'sprites':        return [mireSprite('e0'), mireSprite('e1'), mireSprite('e2')];
    case 'elite':          return [keepSentinel(), mireSprite('e1')];
    case 'ch2_boss':       return [tideWarden()];
  }
}

// Area 3 – Sunken City Ruins. 30 cols × 15 rows.
// An elite sentinel (X) guards a treasure corridor in the northwest.
const AREA_3: AreaDef = {
  id: 'sunken_1',
  name: 'Sunken City',
  theme: THEMES.sunken,
  encounters: {
    '5,5':  'soldiers',
    '21,5': 'soldier_sprite',
    '5,9':  'crawlers',
    '23,9': 'sprites',
    '3,2':  'elite',
  },
  scripts: {},
  chests: {
    '1,2': { gold: 60, equipment: 'tide_ring' },
  },
  map: [
    '##############################',
    '#########...............>....#',
    '#T.X....#....................#',
    '#######.#....................#',
    '#..........####..............#',
    '#....E.....####......E.......#',
    '#..........####..............#',
    '#.....H......................#',
    '#.............####...........#',
    '#....E........####.....E.....#',
    '#.............####...........#',
    '#............................#',
    '#............................#',
    '#<...........P...............#',
    '##############################',
  ],
};

// Area 4 – Flooded Keep. Boss area. 30 cols × 15 rows.
const AREA_4: AreaDef = {
  id: 'sunken_2',
  name: 'Flooded Keep',
  theme: THEMES.sunken,
  encounters: {
    '14,7': 'ch2_boss',
  },
  scripts: {
    '14,4': 'ch2_warden',
  },
  chests: {
    '17,11': { gold: 50, items: { tonic: 1 } },
  },
  map: [
    '##############################',
    '#............................#',
    '#.####.................####..#',
    '#.####.................####..#',
    '#.####........S........####..#',
    '#.####.................####..#',
    '#............................#',
    '#....H........B..............#',
    '#............................#',
    '#.####.................####..#',
    '#.####.................####..#',
    '#.####...........T.....####..#',
    '#............................#',
    '#<...........P...............#',
    '##############################',
  ],
};

// ---------------------------------------------------------------------------
// Chapter 3 enemies — Ashen Peaks (depth 5-6)
// ---------------------------------------------------------------------------

function emberHound(id: string): Combatant {
  return armed({
    id, name: 'Ember Hound', side: 'enemy',
    spriteKey: 'e_ember', color: 0xcc4411, size: 22,
    spells: ['fire'], goldReward: 18, xpReward: 24,
    attackInflict: { ailment: 'burn', chance: 0.3, rounds: 2 },
    stats: s(70, 17, 16, 8, 10, 16),
  }, ['ice'], 1);
}

function cinderWraith(id: string): Combatant {
  return armed({
    id, name: 'Cinder Wraith', side: 'enemy',
    spriteKey: 'e_cinder', color: 0x774422, size: 20,
    spells: ['fire', 'frost'], goldReward: 20, xpReward: 26,
    stats: s(48, 8, 18, 4, 19, 28),
  }, ['ice', 'holy'], 1);
}

function magmaGolem(id: string): Combatant {
  return armed({
    id, name: 'Magma Golem', side: 'enemy',
    spriteKey: 'e_warden', color: 0xaa3311, size: 30,
    spells: [], goldReward: 16, xpReward: 22,
    stats: s(130, 19, 4, 20, 2),
  }, ['ice'], 3);
}

function pyreColossus(): Combatant {
  return armed({
    id: 'elite0', name: 'Pyre Colossus', side: 'enemy',
    spriteKey: 'e_warden', color: 0x771100, size: 36,
    spells: ['fire'], goldReward: 70, xpReward: 100, isElite: true,
    stats: s(240, 23, 5, 22, 10, 20),
  }, ['ice'], 4);
}

function ashbrand(): Combatant {
  return armed({
    id: 'ashbrand', name: 'Ashbrand', side: 'enemy',
    spriteKey: 'e_leviathan', color: 0x881100, size: 42,
    spells: ['fire', 'smite'], goldReward: 100, xpReward: 180,
    isBoss: true,
    attackInflict: { ailment: 'burn', chance: 0.3, rounds: 2 },
    stats: s(620, 24, 12, 18, 26, 80),
  }, ['ice'], 4);
}

type Ch3EncounterGroup = 'hounds' | 'hound_wraith' | 'golems' | 'wraiths' | 'elite' | 'ch3_boss';

export function makeChapter3Encounter(group: Ch3EncounterGroup): Combatant[] {
  switch (group) {
    case 'hounds':       return [emberHound('e0'), emberHound('e1')];
    case 'hound_wraith': return [emberHound('e0'), cinderWraith('e1')];
    case 'golems':       return [magmaGolem('e0'), magmaGolem('e1')];
    case 'wraiths':      return [cinderWraith('e0'), cinderWraith('e1'), cinderWraith('e2')];
    case 'elite':        return [pyreColossus(), emberHound('e1')];
    case 'ch3_boss':     return [ashbrand()];
  }
}

// Area 5 – Ashen Foothills. 30 cols × 15 rows.
// An elite colossus (X) guards a treasure corridor in the southeast.
const AREA_5: AreaDef = {
  id: 'ashen_1',
  name: 'Ashen Foothills',
  theme: THEMES.ashen,
  encounters: {
    '25,2':  'hound_wraith',
    '10,3':  'hounds',
    '4,7':   'golems',
    '26,7':  'wraiths',
    '10,10': 'hound_wraith',
    '23,10': 'hounds',
    '24,12': 'elite',
  },
  scripts: {},
  chests: {
    '22,12': { gold: 100, items: { tonic: 2 } },
  },
  map: [
    '##############################',
    '#............................#',
    '#..###..........###......E...#',
    '#..###....E.....###..........#',
    '#..###..........###..........#',
    '#............................#',
    '#.......H....................#',
    '#...E.....................E..#',
    '#............................#',
    '#..###..........###..........#',
    '#..###....E.....###....E.....#',
    '#....................#######.#',
    '#.........>..........#T.X....#',
    '#<............P......#########',
    '##############################',
  ],
};

// Area 6 – Summit Shrine. Boss area. 30 cols × 15 rows.
const AREA_6: AreaDef = {
  id: 'ashen_2',
  name: 'Summit Shrine',
  theme: THEMES.ashen,
  encounters: {
    '14,7': 'ch3_boss',
  },
  scripts: {
    '14,4': 'ch3_ashbrand',
  },
  chests: {},
  map: [
    '##############################',
    '#............................#',
    '#.######.............######..#',
    '#.######.............######..#',
    '#.######......S......######..#',
    '#.######.............######..#',
    '#............................#',
    '#....H........B..............#',
    '#............................#',
    '#.######.............######..#',
    '#.######.............######..#',
    '#.######.............######..#',
    '#............................#',
    '#<...........P...............#',
    '##############################',
  ],
};

export const ALL_AREAS: AreaDef[] = [AREA_1, AREA_2, AREA_3, AREA_4, AREA_5, AREA_6];

/** Returns the area for the given depth (1-based). */
export function getArea(depth: number): AreaDef {
  return ALL_AREAS[Math.min(depth - 1, ALL_AREAS.length - 1)];
}

// Unified encounter factory for DescentScene
export function makeEncounterForArea(area: AreaDef, group: string): Combatant[] {
  if (area.id.startsWith('forest')) return makeChapter1Encounter(group as EncounterGroup);
  if (area.id.startsWith('sunken')) return makeChapter2Encounter(group as Ch2EncounterGroup);
  if (area.id.startsWith('ashen'))  return makeChapter3Encounter(group as Ch3EncounterGroup);
  return makeChapter1Encounter(group as EncounterGroup);
}
