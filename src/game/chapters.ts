// Chapter definitions: fixed maps, encounters, and story triggers.
// Each area is a hand-crafted ASCII map — no procedural generation.
//
// Tile key:
//   #  tree / wall        .  walkable path (trash fights trigger randomly here)
//   P  player start       <  back (Sanctuary or previous area)
//   >  advance (next area or boss)
//   B  boss               X  elite guardian
//   T  treasure chest     H  healing spring
//   S  story trigger
//
// Per-chapter field mechanics (DescentScene.ts), each tinted so they're
// always visible, never invisible traps:
//   V  Thicket (Forest) — much higher random-encounter chance than open floor
//   ~  Current (Sunken) — sweeps you further in your direction of travel
//   ^  Embers (Ashen)   — a little party HP damage each time you cross it
//   *  Prism Pad (Crystal) — teleports to its paired pad (see `teleports`)

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
    spells: [], goldReward: 12, xpReward: 10,
    attackInflict: { ailment: 'venom', chance: 0.2, rounds: 2 },
    stats: s(30, 11, 10, 5, 1),
  }, ['fire'], 1);
}

function corruptedSprite(id: string): Combatant {
  return armed({
    id, name: 'Corrupted Sprite', side: 'enemy',
    spriteKey: 'e_sprite', color: 0x7755aa, size: 18,
    spells: ['frost'], goldReward: 15, xpReward: 12,
    stats: s(20, 5, 13, 3, 10, 14),
  }, ['fire'], 1);
}

function aetherWisp(id: string): Combatant {
  return armed({
    id, name: 'Aether Wisp', side: 'enemy',
    spriteKey: 'e_sprite', color: 0xaaaaff, size: 16,
    spells: ['smite'], goldReward: 18, xpReward: 14,
    // Flits in and out like the grove's other shadows — permanently hasted.
    speedStatuses: { haste: { mult: 1.3, turns: 999 } },
    stats: s(16, 4, 15, 2, 13, 18),
  }, ['ice'], 1);
}

function alphaWolf(): Combatant {
  return armed({
    id: 'elite0', name: 'Alpha Shade Wolf', side: 'enemy',
    spriteKey: 'e_ghoul', color: 0x1a2244, size: 30,
    spells: [], goldReward: 50, xpReward: 45, isElite: true,
    attackInflict: { ailment: 'venom', chance: 0.35, rounds: 3 },
    stats: s(72, 14, 11, 7, 2),
  }, ['fire'], 2);
}

function forestShade(): Combatant {
  return armed({
    id: 'forest_shade', name: 'Forest Shade', side: 'enemy',
    spriteKey: 'e_leviathan', color: 0x112233, size: 38,
    spells: ['frost', 'fire'], goldReward: 85, xpReward: 100,
    isBoss: true,
    stats: s(260, 16, 9, 10, 18, 50),
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
  /** Prism Pad pairs ('*' tiles): 'col,row' -> destination 'col,row' */
  teleports?: Record<string, string>;
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
  crystal: {
    id: 'crystal',
    bg: 0x05040e,
    floor: 0x14102a, floorAlt: 0x1a1433,
    wall: 0x0a0620,
    accent: 0x8a4ae0,
    fogColor: 0x6a3ac0, fogAlpha: 0.16,
  },
};

// Area 1 – Ashenveil Forest. 24 cols × 15 rows — cramped, twisty grove.
// A winding S-path from the entrance to the exit, a Thicket ambush pocket,
// and a dead-end alcove (guarded by the elite) holding the treasure.
const AREA_1: AreaDef = {
  id: 'forest_1',
  name: 'Ashenveil Forest',
  theme: THEMES.forest,
  encounters: {
    '20,1': 'wolf_sprite',
    '5,4':  'wolves',
    '19,6': 'sprites',
    '5,9':  'wolves',
    '19,10': 'wisps',
    '14,3': 'elite',
  },
  scripts: {},
  chests: {
    '13,3': { gold: 35, equipment: 'emberfang' },
  },
  map: [
    '########################',
    '#........>.............#',
    '#........#.............#',
    '#....###.#...TX........#',
    '#....###.###...........#',
    '#......................#',
    '#...VVV....##..........#',
    '#...VVV....##..........#',
    '#......................#',
    '#.....##......##.......#',
    '#.....##......##.......#',
    '#....H.................#',
    '#......................#',
    '#<.........P...........#',
    '########################',
  ],
};

// Area 2 – Twisting Hollow. Boss area. 24 cols × 15 rows.
// Forest Shade's arena: staggered, offset pillar pairs (not mirrored like a
// normal hall) evoke the disorientation of its Umbral Flicker illusion.
const AREA_2: AreaDef = {
  id: 'forest_2',
  name: 'Twisting Hollow',
  theme: THEMES.forest,
  encounters: {
    '11,7': 'boss',
  },
  scripts: {
    '10,6': 'ch1_crystal',
  },
  chests: {
    '14,11': { gold: 42 },
  },
  map: [
    '########################',
    '#......................#',
    '#..##..............##..#',
    '#..##..............##..#',
    '#.......##....##.......#',
    '#.......##....##.......#',
    '#.........S............#',
    '#...H......B...........#',
    '#......................#',
    '#.......##....##.......#',
    '#.......##....##.......#',
    '#..##.........T....##..#',
    '#..##..............##..#',
    '#<.........P...........#',
    '########################',
  ],
};

// ---------------------------------------------------------------------------
// Chapter 2 enemies — Sunken City (depth 3-4)
// ---------------------------------------------------------------------------

function drownedSoldier(id: string): Combatant {
  return armed({
    id, name: 'Drowned Soldier', side: 'enemy',
    spriteKey: 'e_warden', color: 0x2a4a6a, size: 26,
    spells: [], goldReward: 20, xpReward: 18,
    stats: s(80, 17, 7, 13, 2),
  }, ['holy'], 2);
}

function mireSprite(id: string): Combatant {
  return armed({
    id, name: 'Mire Sprite', side: 'enemy',
    spriteKey: 'e_sprite', color: 0x5a8a5a, size: 18,
    spells: ['fire', 'frost'], goldReward: 23, xpReward: 20,
    stats: s(52, 8, 15, 5, 16, 24),
  }, ['fire'], 1);
}

function tombCrawler(id: string): Combatant {
  return armed({
    id, name: 'Tomb Crawler', side: 'enemy',
    spriteKey: 'e_crawler', color: 0x6a4a2a, size: 28,
    spells: [], goldReward: 17, xpReward: 16,
    attackInflict: { ailment: 'venom', chance: 0.3, rounds: 3 },
    // The whole flooded chapter drags you under, not just its Warden.
    attackSpeedDebuff: { mult: 0.6, turns: 2 },
    stats: s(90, 14, 6, 15, 1),
  }, ['ice'], 2);
}

function keepSentinel(): Combatant {
  return armed({
    id: 'elite0', name: 'Keep Sentinel', side: 'enemy',
    spriteKey: 'e_warden', color: 0x152e4a, size: 32,
    spells: ['frost'], goldReward: 72, xpReward: 70, isElite: true,
    stats: s(150, 20, 8, 16, 8, 20),
  }, ['holy', 'fire'], 3);
}

function tideWarden(): Combatant {
  return armed({
    id: 'tide_warden', name: 'Tide Warden', side: 'enemy',
    spriteKey: 'e_leviathan', color: 0x1a3a5a, size: 40,
    spells: ['frost', 'cure'], goldReward: 115, xpReward: 140,
    isBoss: true,
    attackInflict: { ailment: 'chill', chance: 0.25, rounds: 2 },
    stats: s(400, 20, 10, 16, 20, 60),
  }, ['fire', 'holy'], 3);
}

// Sunken signature: a healer that mends its allies — burst it down or focus
// the threats first, or the fight never ends.
function tidecaller(id: string): Combatant {
  return armed({
    id, name: 'Tidecaller', side: 'enemy',
    spriteKey: 'e_sprite', color: 0x3a9ab0, size: 20,
    spells: ['cure'], goldReward: 26, xpReward: 28,
    stats: s(60, 6, 12, 6, 18, 44),
  }, ['holy'], 1);
}

type Ch2EncounterGroup = 'soldiers' | 'soldier_sprite' | 'crawlers' | 'sprites' | 'elite' | 'ch2_boss';

export function makeChapter2Encounter(group: Ch2EncounterGroup): Combatant[] {
  switch (group) {
    case 'soldiers':       return [drownedSoldier('e0'), drownedSoldier('e1')];
    case 'soldier_sprite': return [drownedSoldier('e0'), tidecaller('e1')];
    case 'crawlers':       return [tombCrawler('e0'), tombCrawler('e1')];
    case 'sprites':        return [mireSprite('e0'), tidecaller('e1'), mireSprite('e2')];
    case 'elite':          return [keepSentinel(), tidecaller('e1')];
    case 'ch2_boss':       return [tideWarden()];
  }
}

// Area 3 – Sunken City. 38 cols × 16 rows — wide, flooded hall.
// A broad Current sweeps you straight across (or down into) it; an elite
// guards the treasure once you've crossed to the far side.
const AREA_3: AreaDef = {
  id: 'sunken_1',
  name: 'Sunken City',
  theme: THEMES.sunken,
  encounters: {
    '10,1': 'soldiers',
    '25,1': 'soldier_sprite',
    '10,7': 'crawlers',
    '25,7': 'sprites',
    '32,8': 'elite',
  },
  scripts: {},
  chests: {
    '31,8': { gold: 58, equipment: 'tidecleaver' },
  },
  map: [
    '######################################',
    '#....................................#',
    '#.....H..............................#',
    '#....................................#',
    '#..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~..#',
    '#..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~..#',
    '#..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~..#',
    '#....................................#',
    '#..............................TX....#',
    '#....................................#',
    '#...............>....................#',
    '#....................................#',
    '#....................................#',
    '#....................................#',
    '#<...........P.......................#',
    '######################################',
  ],
};

// Area 4 – Flooded Keep. Boss area. 38 cols × 16 rows.
// Tide Warden's arena: sparse, asymmetric single-tile debris (flood rocks)
// scattered across an otherwise wide-open floor, unlike a symmetric hall.
const AREA_4: AreaDef = {
  id: 'sunken_2',
  name: 'Flooded Keep',
  theme: THEMES.sunken,
  encounters: {
    '18,7': 'ch2_boss',
  },
  scripts: {
    '18,4': 'ch2_warden',
  },
  chests: {
    '24,11': { gold: 72, items: { tonic: 1 } },
  },
  map: [
    '######################################',
    '#....................................#',
    '#........#...........................#',
    '#....................................#',
    '#.................S..................#',
    '#....#...............................#',
    '#....................................#',
    '#......H..........B..................#',
    '#....................................#',
    '#.........................#..........#',
    '#....................................#',
    '#..............#........T............#',
    '#....................................#',
    '#....................................#',
    '#<...........P.......................#',
    '######################################',
  ],
};

// ---------------------------------------------------------------------------
// Chapter 3 enemies — Ashen Peaks (depth 5-6)
// ---------------------------------------------------------------------------

function emberHound(id: string): Combatant {
  return armed({
    id, name: 'Ember Hound', side: 'enemy',
    spriteKey: 'e_ember', color: 0xcc4411, size: 22,
    spells: ['fire'], goldReward: 22, xpReward: 24,
    attackInflict: { ailment: 'burn', chance: 0.3, rounds: 2 },
    // Echoes Ashbrand's own escalation — the whole peak grows more frantic.
    enrageOnOwnTurn: 0.12,
    stats: s(70, 17, 16, 8, 10, 16),
  }, ['ice'], 1);
}

function cinderWraith(id: string): Combatant {
  return armed({
    id, name: 'Cinder Wraith', side: 'enemy',
    spriteKey: 'e_cinder', color: 0x774422, size: 20,
    spells: ['fire', 'frost'], goldReward: 25, xpReward: 26,
    stats: s(48, 8, 18, 4, 19, 28),
  }, ['ice', 'holy'], 1);
}

function magmaGolem(id: string): Combatant {
  return armed({
    id, name: 'Magma Golem', side: 'enemy',
    spriteKey: 'e_warden', color: 0xaa3311, size: 30,
    spells: [], goldReward: 20, xpReward: 22,
    stats: s(130, 19, 4, 20, 2),
  }, ['ice'], 3);
}

function pyreColossus(): Combatant {
  return armed({
    id: 'elite0', name: 'Pyre Colossus', side: 'enemy',
    spriteKey: 'e_warden', color: 0x771100, size: 36,
    spells: ['fire'], goldReward: 85, xpReward: 100, isElite: true,
    stats: s(240, 23, 5, 22, 10, 20),
  }, ['ice'], 4);
}

function ashbrand(): Combatant {
  return armed({
    id: 'ashbrand', name: 'Ashbrand', side: 'enemy',
    spriteKey: 'e_leviathan', color: 0x881100, size: 42,
    spells: ['fire', 'smite'], goldReward: 125, xpReward: 180,
    isBoss: true,
    attackInflict: { ailment: 'burn', chance: 0.3, rounds: 2 },
    stats: s(540, 24, 12, 18, 26, 80),
  }, ['ice'], 4);
}

// Ashen signature: fragile but detonates on death for fire AoE — mind the kill
// order, and don't pop one next to a wounded hero.
function livingCinder(id: string): Combatant {
  return armed({
    id, name: 'Living Cinder', side: 'enemy',
    spriteKey: 'e_ember', color: 0xff5522, size: 18,
    spells: [], goldReward: 20, xpReward: 22,
    deathBurst: { element: 'fire', power: 30 },
    stats: s(38, 14, 15, 4, 2),
  }, ['ice'], 1);
}

type Ch3EncounterGroup = 'hounds' | 'hound_wraith' | 'golems' | 'wraiths' | 'elite' | 'ch3_boss';

export function makeChapter3Encounter(group: Ch3EncounterGroup): Combatant[] {
  switch (group) {
    case 'hounds':       return [emberHound('e0'), emberHound('e1')];
    case 'hound_wraith': return [emberHound('e0'), cinderWraith('e1')];
    case 'golems':       return [magmaGolem('e0'), livingCinder('e1')];
    case 'wraiths':      return [cinderWraith('e0'), livingCinder('e1'), cinderWraith('e2')];
    case 'elite':        return [pyreColossus(), livingCinder('e1')];
    case 'ch3_boss':     return [ashbrand()];
  }
}

// ---------------------------------------------------------------------------
// Chapter 4 enemies — Crystal Depths (depth 7-8)
// ---------------------------------------------------------------------------

function crystalWisp(id: string): Combatant {
  return armed({
    id, name: 'Crystal Wisp', side: 'enemy',
    spriteKey: 'e_sprite', color: 0x8a5ad0, size: 18,
    spells: [], goldReward: 24, xpReward: 30,
    stats: s(60, 16, 17, 6, 8),
  }, ['fire'], 1);
}

function caveStalker(id: string): Combatant {
  return armed({
    id, name: 'Cave Stalker', side: 'enemy',
    spriteKey: 'e_crawler', color: 0x4a3a6a, size: 28,
    spells: [], goldReward: 22, xpReward: 28,
    attackInflict: { ailment: 'chill', chance: 0.3, rounds: 2 },
    stats: s(100, 20, 10, 14, 2),
  }, ['holy'], 2);
}

function prismSprite(id: string): Combatant {
  return armed({
    id, name: 'Prism Sprite', side: 'enemy',
    spriteKey: 'e_sprite', color: 0xc78aff, size: 18,
    spells: ['smite', 'frost'], goldReward: 26, xpReward: 32,
    // Refracts anything that isn't its weakness back at the attacker.
    reflectFrac: 0.4,
    stats: s(70, 9, 16, 6, 22, 32),
  }, ['ice'], 1);
}

function geodeWarden(): Combatant {
  return armed({
    id: 'elite0', name: 'Geode Warden', side: 'enemy',
    spriteKey: 'e_warden', color: 0x5a2a8a, size: 34,
    spells: ['frost'], goldReward: 90, xpReward: 130, isElite: true,
    stats: s(310, 26, 9, 24, 10, 20),
  }, ['fire'], 4);
}

function prismSovereign(): Combatant {
  return armed({
    id: 'prism_sovereign', name: 'Prism Sovereign', side: 'enemy',
    spriteKey: 'e_leviathan', color: 0x9a3aff, size: 44,
    spells: ['frost', 'smite'], goldReward: 130, xpReward: 230,
    isBoss: true,
    attackInflict: { ailment: 'chill', chance: 0.3, rounds: 2 },
    stats: s(700, 28, 14, 22, 30, 90),
  }, ['fire', 'holy'], 4);
}

// Crystal signature: shrugs off ice almost entirely — switch to fire/holy/phys
// (its weaknesses) to break through, or your frost hexes fizzle. Paired with
// Prism Sprite (weak to ice) it punishes blanket frost AoE from both ends.
function wardPrism(id: string): Combatant {
  return armed({
    id, name: 'Ward Prism', side: 'enemy',
    spriteKey: 'e_sprite', color: 0x6affd0, size: 20,
    spells: ['frost'], goldReward: 30, xpReward: 36,
    wardElement: 'ice',
    stats: s(84, 10, 14, 8, 20, 28),
  }, ['fire', 'holy'], 1);
}

type Ch4EncounterGroup = 'wisps' | 'wisp_stalker' | 'stalkers' | 'prisms' | 'elite' | 'ch4_boss';

export function makeChapter4Encounter(group: Ch4EncounterGroup): Combatant[] {
  switch (group) {
    case 'wisps':        return [crystalWisp('e0'), crystalWisp('e1')];
    case 'wisp_stalker': return [crystalWisp('e0'), caveStalker('e1')];
    case 'stalkers':     return [caveStalker('e0'), wardPrism('e1')];
    case 'prisms':       return [prismSprite('e0'), wardPrism('e1'), prismSprite('e2')];
    case 'elite':        return [geodeWarden(), wardPrism('e1')];
    case 'ch4_boss':     return [prismSovereign()];
  }
}

// Area 5 – Ashen Foothills. 26 cols × 20 rows — tall, narrow climb.
// Switchback corridors (alternating left/right wall bands) force a zigzag
// up the peak, with a shortcut lined with Embers.
const AREA_5: AreaDef = {
  id: 'ashen_1',
  name: 'Ashen Foothills',
  theme: THEMES.ashen,
  encounters: {
    '18,2':  'hound_wraith',
    '5,5':   'hounds',
    '19,7':  'golems',
    '5,10':  'wraiths',
    '19,13': 'hound_wraith',
    '10,16': 'hounds',
    '16,3':  'elite',
  },
  scripts: {},
  chests: {
    '15,3': { gold: 70, equipment: 'sunbrand' },
  },
  map: [
    '##########################',
    '#..........>.............#',
    '#........................#',
    '#..............TX........#',
    '#........................#',
    '#......^^^^..............#',
    '#......^^^^..............#',
    '#........................#',
    '#################........#',
    '#################........#',
    '#........................#',
    '#........#################',
    '#........#################',
    '#........................#',
    '#.....H..................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#<.........P.............#',
    '##########################',
  ],
};

// Area 6 – Cinder Floor. Boss area. 26 cols × 20 rows.
// Ashbrand's arena: almost entirely bare and exposed — no cover to hide
// behind, fitting a boss whose Scorched Ground punishes turtling. A couple
// of Ember patches near the corners; no chest (nowhere to loot either).
const AREA_6: AreaDef = {
  id: 'ashen_2',
  name: 'Cinder Floor',
  theme: THEMES.ashen,
  encounters: {
    '14,8': 'ch3_boss',
  },
  scripts: {
    '12,4': 'ch3_ashbrand',
  },
  chests: {},
  map: [
    '##########################',
    '#........................#',
    '#........................#',
    '#^^......................#',
    '#...........S............#',
    '#......................^^#',
    '#........................#',
    '#........................#',
    '#....H........B..........#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#<.........P.............#',
    '##########################',
  ],
};

// Area 7 – Crystal Depths. 40 cols × 22 rows — the largest, most elaborate
// exploration map: several distinct chambers linked by offset (not
// mirrored) pillar corridors, plus a Prism Pad pair that shortcuts across
// the whole map.
const AREA_7: AreaDef = {
  id: 'crystal_1',
  name: 'Crystal Depths',
  theme: THEMES.crystal,
  encounters: {
    '15,1':  'wisp_stalker',
    '25,4':  'wisps',
    '15,7':  'stalkers',
    '30,9':  'prisms',
    '25,12': 'wisp_stalker',
    '15,19': 'wisps',
    '2,2':   'elite',
  },
  scripts: {},
  chests: {
    '1,2': { gold: 45, equipment: 'prism_edge' },
  },
  teleports: {
    '6,5': '31,15',
    '31,15': '6,5',
  },
  map: [
    '########################################',
    '#......................................#',
    '#TX......###...........................#',
    '#........###...........................#',
    '#......................................#',
    '#.....*................................#',
    '#......................................#',
    '#..........###.........................#',
    '#..........###.........................#',
    '#......................................#',
    '#....H.................................#',
    '#......................................#',
    '#....................###...............#',
    '#....................###...............#',
    '#......................................#',
    '#..............................*.......#',
    '#......................................#',
    '#.........................>............#',
    '#......................................#',
    '#......................................#',
    '#<...............P.....................#',
    '########################################',
  ],
};

// Area 8 – Radiant Sanctum. Boss area. 40 cols × 22 rows.
// Prism Sovereign's arena: the most elaborate of the four — three tiers of
// symmetric corner pillar-clusters framing a large open center, a proper
// shrine for the final boss (fitting its escalating Overcharge).
const AREA_8: AreaDef = {
  id: 'crystal_2',
  name: 'Radiant Sanctum',
  theme: THEMES.crystal,
  encounters: {
    '19,10': 'ch4_boss',
  },
  scripts: {
    '18,5': 'ch4_story',
  },
  chests: {
    '17,16': { gold: 55, items: { tonic: 1 } },
  },
  map: [
    '########################################',
    '#......................................#',
    '#....###........................###....#',
    '#....###........................###....#',
    '#....###........................###....#',
    '#.................S....................#',
    '#....###........................###....#',
    '#....###........................###....#',
    '#....###........................###....#',
    '#......................................#',
    '#......H...........B...................#',
    '#......................................#',
    '#....###........................###....#',
    '#....###........................###....#',
    '#....###........................###....#',
    '#......................................#',
    '#................T.....................#',
    '#....###........................###....#',
    '#....###........................###....#',
    '#......................................#',
    '#<...............P.....................#',
    '########################################',
  ],
};

export const ALL_AREAS: AreaDef[] = [AREA_1, AREA_2, AREA_3, AREA_4, AREA_5, AREA_6, AREA_7, AREA_8];

/** Returns the area for the given depth (1-based). */
export function getArea(depth: number): AreaDef {
  return ALL_AREAS[Math.min(depth - 1, ALL_AREAS.length - 1)];
}

// Ascension (New Game+) tuning: each tier scales enemy power and rewards up,
// so postgame descents don't stay flat once a player has cleared Chapter 4.
// Easily nudged if a tier feels too easy/brutal.
const NGPLUS_STAT_MULT = 0.15;
const NGPLUS_REWARD_MULT = 0.10;

function scaleForNgPlus(enemies: Combatant[], ngPlus: number): Combatant[] {
  if (ngPlus <= 0) return enemies;
  const statMult = 1 + NGPLUS_STAT_MULT * ngPlus;
  const rewardMult = 1 + NGPLUS_REWARD_MULT * ngPlus;
  return enemies.map((c) => ({
    ...c,
    stats: {
      maxHp: Math.round(c.stats.maxHp * statMult),
      hp: Math.round(c.stats.maxHp * statMult),
      maxMp: Math.round(c.stats.maxMp * statMult),
      mp: Math.round(c.stats.maxMp * statMult),
      str: Math.round(c.stats.str * statMult),
      agi: Math.round(c.stats.agi * statMult),
      vit: Math.round(c.stats.vit * statMult),
      int: Math.round(c.stats.int * statMult),
    },
    goldReward: c.goldReward != null ? Math.round(c.goldReward * rewardMult) : c.goldReward,
    xpReward: c.xpReward != null ? Math.round(c.xpReward * rewardMult) : c.xpReward,
  }));
}

// Unified encounter factory for DescentScene
export function makeEncounterForArea(area: AreaDef, group: string, ngPlus = 0): Combatant[] {
  const enemies = area.id.startsWith('forest') ? makeChapter1Encounter(group as EncounterGroup)
    : area.id.startsWith('sunken') ? makeChapter2Encounter(group as Ch2EncounterGroup)
    : area.id.startsWith('ashen')  ? makeChapter3Encounter(group as Ch3EncounterGroup)
    : area.id.startsWith('crystal') ? makeChapter4Encounter(group as Ch4EncounterGroup)
    : makeChapter1Encounter(group as EncounterGroup);
  return scaleForNgPlus(enemies, ngPlus);
}
