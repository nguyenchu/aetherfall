// Chapter definitions: fixed maps, encounters, and story triggers.
// Each area is a hand-crafted ASCII map — no procedural generation.
//
// Tile key:
//   #  tree / wall        .  walkable path
//   P  player start       <  back (Sanctuary or previous area)
//   >  advance (next area or boss)
//   E  encounter spot     B  boss
//   S  story trigger

import type { Combatant, Stats } from './types';

// ---------------------------------------------------------------------------
// Chapter 1 enemies
// ---------------------------------------------------------------------------

function s(hp: number, str: number, agi: number, vit: number, int: number, mp = 0): Stats {
  return { maxHp: hp, hp, maxMp: mp, mp, str, agi, vit, int };
}

function shadowWolf(id: string): Combatant {
  return {
    id, name: 'Shadow Wolf', side: 'enemy',
    spriteKey: 'e_ghoul', color: 0x334466, size: 24,
    spells: [], goldReward: 8, xpReward: 10,
    stats: s(28, 11, 10, 5, 1),
  };
}

function corruptedSprite(id: string): Combatant {
  return {
    id, name: 'Corrupted Sprite', side: 'enemy',
    spriteKey: 'e_sprite', color: 0x7755aa, size: 18,
    spells: ['frost'], goldReward: 10, xpReward: 12,
    stats: s(18, 5, 13, 3, 10, 14),
  };
}

function aetherWisp(id: string): Combatant {
  return {
    id, name: 'Aether Wisp', side: 'enemy',
    spriteKey: 'e_sprite', color: 0xaaaaff, size: 16,
    spells: ['smite'], goldReward: 12, xpReward: 14,
    stats: s(14, 4, 15, 2, 13, 18),
  };
}

function forestShade(): Combatant {
  return {
    id: 'forest_shade', name: 'Forest Shade', side: 'enemy',
    spriteKey: 'e_leviathan', color: 0x112233, size: 38,
    spells: ['frost', 'fire'], goldReward: 60, xpReward: 100,
    isBoss: true,
    stats: s(360, 16, 9, 10, 18, 50),
  };
}

type EncounterGroup = 'wolves' | 'wolf_sprite' | 'sprites' | 'wisps' | 'boss';

export function makeChapter1Encounter(group: EncounterGroup): Combatant[] {
  switch (group) {
    case 'wolves':      return [shadowWolf('e0'), shadowWolf('e1')];
    case 'wolf_sprite': return [shadowWolf('e0'), corruptedSprite('e1')];
    case 'sprites':     return [corruptedSprite('e0'), corruptedSprite('e1'), aetherWisp('e2')];
    case 'wisps':       return [aetherWisp('e0'), aetherWisp('e1')];
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

export interface AreaDef {
  id: string;
  name: string;
  theme: AreaTheme;
  /** Tile-keyed encounter groups: 'col,row' -> group name */
  encounters: Record<string, string>;
  /** Tile-keyed dialogue script ids */
  scripts: Record<string, string>;
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
// Player arrives from Sanctuary at bottom (<), proceeds north to the grove (>).
const AREA_1: AreaDef = {
  id: 'forest_1',
  name: 'Ashenveil Forest',
  theme: THEMES.forest,
  encounters: {
    '7,3':  'wolves',
    '22,3': 'wolf_sprite',
    '4,7':  'wolves',
    '24,7': 'sprites',
    '7,11': 'wolf_sprite',
    '22,11':'wisps',
  },
  scripts: {},
  map: [
    '##############################',
    '#............................#',
    '#....##..............##......#',
    '#....##.....E........##..E...#',
    '#....##..............##......#',
    '#............................#',
    '#............................#',
    '#..E.....................E...#',
    '#............................#',
    '#............................#',
    '#....##..............##......#',
    '#....##.....E........##..E...#',
    '#....##.....>........##......#',
    '#<............P..............#',
    '##############################',
  ],
};

// Area 2 – Ancient Grove. Boss area. 30 cols × 15 rows.
// Player arrives from the forest (<), story trigger, then boss (B).
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
  map: [
    '##############################',
    '#............................#',
    '#.####.................####..#',
    '#.####.................####..#',
    '#.####......S..........####..#',
    '#.####.................####..#',
    '#............................#',
    '#.............B..............#',
    '#............................#',
    '#.####.................####..#',
    '#.####.................####..#',
    '#.####.................####..#',
    '#............................#',
    '#<...........P...............#',
    '##############################',
  ],
};

// ---------------------------------------------------------------------------
// Chapter 2 enemies — Sunken City (depth 3-4)
// ---------------------------------------------------------------------------

function drownedSoldier(id: string): Combatant {
  return {
    id, name: 'Drowned Soldier', side: 'enemy',
    spriteKey: 'e_warden', color: 0x2a4a6a, size: 26,
    spells: [], goldReward: 14, xpReward: 18,
    stats: s(80, 17, 7, 13, 2),
  };
}

function mireSprite(id: string): Combatant {
  return {
    id, name: 'Mire Sprite', side: 'enemy',
    spriteKey: 'e_sprite', color: 0x5a8a5a, size: 18,
    spells: ['fire', 'frost'], goldReward: 16, xpReward: 20,
    stats: s(52, 8, 15, 5, 16, 24),
  };
}

function tombCrawler(id: string): Combatant {
  return {
    id, name: 'Tomb Crawler', side: 'enemy',
    spriteKey: 'e_crawler', color: 0x6a4a2a, size: 28,
    spells: [], goldReward: 12, xpReward: 16,
    stats: s(90, 14, 6, 15, 1),
  };
}

function tideWarden(): Combatant {
  return {
    id: 'tide_warden', name: 'Tide Warden', side: 'enemy',
    spriteKey: 'e_leviathan', color: 0x1a3a5a, size: 40,
    spells: ['frost', 'cure'], goldReward: 80, xpReward: 140,
    isBoss: true,
    stats: s(520, 20, 10, 16, 20, 60),
  };
}

type Ch2EncounterGroup = 'soldiers' | 'soldier_sprite' | 'crawlers' | 'sprites' | 'ch2_boss';

export function makeChapter2Encounter(group: Ch2EncounterGroup): Combatant[] {
  switch (group) {
    case 'soldiers':       return [drownedSoldier('e0'), drownedSoldier('e1')];
    case 'soldier_sprite': return [drownedSoldier('e0'), mireSprite('e1')];
    case 'crawlers':       return [tombCrawler('e0'), tombCrawler('e1')];
    case 'sprites':        return [mireSprite('e0'), mireSprite('e1'), mireSprite('e2')];
    case 'ch2_boss':       return [tideWarden()];
  }
}

// Area 3 – Sunken City Ruins. 30 cols × 15 rows.
const AREA_3: AreaDef = {
  id: 'sunken_1',
  name: 'Sunken City',
  theme: THEMES.sunken,
  encounters: {
    '6,3':   'soldiers',
    '22,4':  'soldier_sprite',
    '5,7':   'crawlers',
    '23,7':  'sprites',
    '8,11':  'soldier_sprite',
    '20,11': 'soldiers',
  },
  scripts: {},
  map: [
    '##############################',
    '#............................#',
    '#.##.##..............##.##...#',
    '#.##.##.....E........##.##...#',
    '#....##..........E...##......#',
    '#............................#',
    '#............................#',
    '#..E.....................E...#',
    '#............................#',
    '#............................#',
    '#.##.##..............##.##...#',
    '#.##.##.....E....E...##.##...#',
    '#.##.##.....>........##.##...#',
    '#<............P..............#',
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
  map: [
    '##############################',
    '#............................#',
    '#..####.............####.....#',
    '#..####.............####.....#',
    '#..####......S......####.....#',
    '#..####.............####.....#',
    '#............................#',
    '#.............B..............#',
    '#............................#',
    '#..####.............####.....#',
    '#..####.............####.....#',
    '#..####.............####.....#',
    '#............................#',
    '#<...........P...............#',
    '##############################',
  ],
};

// ---------------------------------------------------------------------------
// Chapter 3 enemies — Ashen Peaks (depth 5-6)
// ---------------------------------------------------------------------------

function emberHound(id: string): Combatant {
  return {
    id, name: 'Ember Hound', side: 'enemy',
    spriteKey: 'e_ember', color: 0xcc4411, size: 22,
    spells: ['fire'], goldReward: 18, xpReward: 24,
    stats: s(70, 17, 16, 8, 10, 16),
  };
}

function cinderWraith(id: string): Combatant {
  return {
    id, name: 'Cinder Wraith', side: 'enemy',
    spriteKey: 'e_cinder', color: 0x774422, size: 20,
    spells: ['fire', 'frost'], goldReward: 20, xpReward: 26,
    stats: s(48, 8, 18, 4, 19, 28),
  };
}

function magmaGolem(id: string): Combatant {
  return {
    id, name: 'Magma Golem', side: 'enemy',
    spriteKey: 'e_warden', color: 0xaa3311, size: 30,
    spells: [], goldReward: 16, xpReward: 22,
    stats: s(130, 19, 4, 20, 2),
  };
}

function ashbrand(): Combatant {
  return {
    id: 'ashbrand', name: 'Ashbrand', side: 'enemy',
    spriteKey: 'e_leviathan', color: 0x881100, size: 42,
    spells: ['fire', 'smite'], goldReward: 100, xpReward: 180,
    isBoss: true,
    stats: s(720, 24, 12, 18, 26, 80),
  };
}

type Ch3EncounterGroup = 'hounds' | 'hound_wraith' | 'golems' | 'wraiths' | 'ch3_boss';

export function makeChapter3Encounter(group: Ch3EncounterGroup): Combatant[] {
  switch (group) {
    case 'hounds':       return [emberHound('e0'), emberHound('e1')];
    case 'hound_wraith': return [emberHound('e0'), cinderWraith('e1')];
    case 'golems':       return [magmaGolem('e0'), magmaGolem('e1')];
    case 'wraiths':      return [cinderWraith('e0'), cinderWraith('e1'), cinderWraith('e2')];
    case 'ch3_boss':     return [ashbrand()];
  }
}

// Area 5 – Ashen Foothills. 30 cols × 15 rows.
const AREA_5: AreaDef = {
  id: 'ashen_1',
  name: 'Ashen Foothills',
  theme: THEMES.ashen,
  encounters: {
    '7,3':   'hounds',
    '21,3':  'hound_wraith',
    '5,7':   'golems',
    '24,7':  'wraiths',
    '9,11':  'hound_wraith',
    '19,11': 'hounds',
  },
  scripts: {},
  map: [
    '##############################',
    '#............................#',
    '#.###.................###....#',
    '#.###.....E.......E...###....#',
    '#.###.................###....#',
    '#............................#',
    '#............................#',
    '#..E.....................E...#',
    '#............................#',
    '#............................#',
    '#.###.................###....#',
    '#.###.....E.......E...###....#',
    '#.###.....>...........###....#',
    '#<............P..............#',
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
  map: [
    '##############################',
    '#............................#',
    '#.######.............######..#',
    '#.######.............######..#',
    '#.######......S......######..#',
    '#.######.............######..#',
    '#............................#',
    '#.............B..............#',
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
  if (area.id.startsWith('forest')) return makeChapter1Encounter(group as Parameters<typeof makeChapter1Encounter>[0]);
  if (area.id.startsWith('sunken')) return makeChapter2Encounter(group as Ch2EncounterGroup);
  if (area.id.startsWith('ashen'))  return makeChapter3Encounter(group as Ch3EncounterGroup);
  return makeChapter1Encounter(group as Parameters<typeof makeChapter1Encounter>[0]);
}
