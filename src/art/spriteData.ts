// Pixel data for all character/enemy sprites. Pure data, no Phaser import,
// so tooling (preview renderers, validators) can load it in Node directly.
// Each figure is a dot-grid map: one character equals one palette color,
// and '.' or ' ' means transparent.

// -1 = transparent. The rest are hex colors.
export const PALETTE: Record<string, number> = {
  '.': -1,
  ' ': -1,
  o: 0x10121c, // outline / near-black
  e: 0x231d33, // eye
  S: 0xf2c99c, // skin light
  s: 0xc9906a, // skin shadow
  H: 0x5c4227, // hair base
  h: 0x8a6540, // hair highlight
  A: 0x45c793, // turquoise base
  a: 0x8ff2c8, // turquoise highlight
  B: 0x27795e, // turquoise shadow
  M: 0xe6edf7, // metal / cream light
  m: 0xa8b6ca, // metal mid
  P: 0x8a6cf0, // purple base
  Q: 0xb9a4ff, // purple highlight
  p: 0x5b43ae, // purple shadow
  G: 0xf2d066, // gold base
  g: 0xb8923c, // gold shadow
  W: 0x9a6a3a, // wood / leather
  w: 0x684626, // wood / leather shadow
  F: 0xf6f9ff, // white glow / glint
  L: 0x5f9a68, // ghoul green
  k: 0x8cc98e, // green highlight
  l: 0x37634a, // green shadow
  U: 0x6aa2f2, // sprite blue
  V: 0xaacdff, // blue highlight
  u: 0x3e66c2, // blue shadow
  C: 0xa26a45, // crawler brown
  c: 0x6f462c, // brown shadow
  R: 0xe28550, // ember orange
  r: 0x99401d, // ember shadow
  J: 0xffc23e, // flame yellow
  X: 0xff4f64, // glowing red
  N: 0x8592a6, // warden gray
  n: 0x4b566c, // gray shadow
  D: 0x3b64a3, // boss deep blue
  d: 0x243f6d, // deep blue shadow
  Y: 0x24352a, // shade base (mossy near-black green)
  y: 0x152018, // shade shadow
  I: 0xd8f5ff, // icy glow
};

// Each value is top-to-bottom rows. Width is the longest row.
export const SPRITES: Record<string, string[]> = {
  // --- Dungeon hero: brown-haired explorer, turquoise tunic, belt, boots ---
  player: [
    '......oooo......',
    '.....ohHHHo.....',
    '....ohhHHHHo....',
    '....oHSSSSHo....',
    '....oSeSSeSo....',
    '.....osSSso.....',
    '.....oAAABo.....',
    '....oaAAAABo....',
    '...ooaAAAABoo...',
    '...oSoaAABoSo...',
    '....owwGGwwo....',
    '.....oAAABo.....',
    '.....oSooSo.....',
    '.....oSooSo.....',
    '.....oWooWo.....',
    '.....oo..oo.....',
  ],

  player_walk_a: [
    '......oooo......',
    '.....ohHHHo.....',
    '....ohhHHHHo....',
    '....oHSSSSHo....',
    '....oSeSSeSo....',
    '.....osSSso.....',
    '.....oAAABo.....',
    '....oaAAAABo....',
    '...ooaAAAABoo...',
    '...oSoaAABoSo...',
    '....owwGGwwo....',
    '.....oAAABo.....',
    '....oSo..oSo....',
    '....oSo..oSo....',
    '....oWo..oWo....',
    '....oo....oo....',
  ],

  player_walk_b: [
    '......oooo......',
    '.....ohHHHo.....',
    '....ohhHHHHo....',
    '....oHSSSSHo....',
    '....oSeSSeSo....',
    '.....osSSso.....',
    '.....oAAABo.....',
    '....oaAAAABo....',
    '...ooaAAAABoo...',
    '...oSoaAABoSo...',
    '....owwGGwwo....',
    '.....oAAABo.....',
    '......oSSo......',
    '......oSSo......',
    '.....oWoWWo.....',
    '.....oo.ooo.....',
  ],

  player_back: [
    '......oooo......',
    '.....ohHHHo.....',
    '....ohhHHHHo....',
    '....oHHHHHHo....',
    '....oHHHHHHo....',
    '.....oHHHHo.....',
    '.....oAAABo.....',
    '....oaAAAABo....',
    '...ooaAAAABoo...',
    '...oSoaAABoSo...',
    '....owwwwwwo....',
    '.....oAAABo.....',
    '.....oSooSo.....',
    '.....oSooSo.....',
    '.....oWooWo.....',
    '.....oo..oo.....',
  ],

  player_back_walk_a: [
    '......oooo......',
    '.....ohHHHo.....',
    '....ohhHHHHo....',
    '....oHHHHHHo....',
    '....oHHHHHHo....',
    '.....oHHHHo.....',
    '.....oAAABo.....',
    '....oaAAAABo....',
    '...ooaAAAABoo...',
    '...oSoaAABoSo...',
    '....owwwwwwo....',
    '.....oAAABo.....',
    '....oSo..oSo....',
    '....oSo..oSo....',
    '....oWo..oWo....',
    '....oo....oo....',
  ],

  player_back_walk_b: [
    '......oooo......',
    '.....ohHHHo.....',
    '....ohhHHHHo....',
    '....oHHHHHHo....',
    '....oHHHHHHo....',
    '.....oHHHHo.....',
    '.....oAAABo.....',
    '....oaAAAABo....',
    '...ooaAAAABoo...',
    '...oSoaAABoSo...',
    '....owwwwwwo....',
    '.....oAAABo.....',
    '......oSSo......',
    '......oSSo......',
    '.....oWoWWo.....',
    '.....oo.ooo.....',
  ],

  // --- Kael, warrior: crested steel helm, pauldrons, sword carried blade-up ---
  c_kael: [
    '.....ooAAoo.....',
    '.....oMMMmo.....',
    '....oMMMMmmo....',
    '....omSSSSmo....',
    '....oSeSSeSo....',
    '..F..osSSso.....',
    '..M.oMAAABMo....',
    '..M.oaAAAABo....',
    '..MooaAAAABoo...',
    '.oWoSoaAABoSo...',
    '..g.owwGGwwo....',
    '.....oAAABo.....',
    '.....oSooSo.....',
    '.....oSooSo.....',
    '.....oMooMo.....',
    '.....oo..oo.....',
  ],

  // --- Lyra, mage: pointed hat with gold star, purple robe, glowing staff ---
  c_lyra: [
    '.......oo.......',
    '......oQPo......',
    '.....oQPPpo.....',
    '....oQPPPppo....',
    '...oPPPGPPPpo...',
    '....oHSSSSHo....',
    '....oSeSSeSoQFQ.',
    '.....osSSso..W..',
    '....oQPPPPpo.W..',
    '...oQPgGgPPpoW..',
    '...oPPPPPPPpoW..',
    '...oPPPPPPPpoS..',
    '....oPPPPPpo.W..',
    '....opPPPPpo.w..',
    '.....oSooSo..w..',
    '.....oo..oo.....',
  ],

  // --- Mira, cleric: golden hood, cream robe, mace at her side ---
  c_mira: [
    '......oooo......',
    '.....oGGGgo.....',
    '....oGGGGGgo....',
    '....oGSSSSgo....',
    '....oSeSSeSo....',
    '.....osSSso.....',
    '.....oGGGgo.GGG.',
    '....oMMMMMmoGgG.',
    '...ooMMGGMmooW..',
    '...oSoMGGMmoSo..',
    '....ogGGGGgo.W..',
    '....oMMMMMmo.w..',
    '....oMMMMMmo....',
    '....omMMMMmo....',
    '.....omMMmo.....',
    '.....oooooo.....',
  ],

  // --- Drowned Ghoul: hunched, mottled green, glowing eyes, ragged maw ---
  e_ghoul: [
    '....oooooo....',
    '...okLLLLLo...',
    '..okLLlLLLLo..',
    '..oLLLLLLlLo..',
    '..oXLLLLXLLo..',
    '..oLLlooLlLo..',
    '..oLoFoFoLLo..',
    '.olLLLLLLLLlo.',
    'oLLlLLLLLlLLLo',
    'oLooLLLLLLooLo',
    '..oLLllLLLLo..',
    '..oLLllllLLo..',
    '..oLLo..oLLo..',
    '..oLo....oLo..',
    '..oo......oo..',
  ],

  // --- Mire Sprite: small floating blue wisp with a fading tail ---
  e_sprite: [
    '.....oooo.....',
    '...ooVVUUoo...',
    '..oVVUUUUUUo..',
    '.oVUFUUUUFUUo.',
    '.oVUFUUUUFUuo.',
    '.oUUUuUUuUUuo.',
    '..oUUUUUUUUo..',
    '...oUUuuUUo...',
    '....oUuuUo....',
    '...o.oUUo.o...',
    '..o..oUuo..o..',
    '.....oUuo.....',
    '......oo......',
  ],

  // --- Sunken Warden: armored construct, glowing visor, gold sigil ---
  e_warden: [
    '....oooooo....',
    '...oNNNNNno...',
    '..oNmMMMmnNo..',
    '..oNMXXXXmNo..',
    '..oNmMMMMmNo..',
    '..oNNmmmmNNo..',
    '.oNNNNNNNNNNo.',
    'oNNmNNNNNNmNNo',
    'oNonNNGgNNnoNo',
    '..oNNNGgNNNo..',
    '..oNNNNNNNNo..',
    '..oNNmmmmNNo..',
    '..oNNo..oNNo..',
    '..oNo....oNo..',
    '..oo......oo..',
  ],

  // --- Forest Shade (Ch1 boss): finned maw shape recast as a mossy, near-black
  // wraith with two glowing red eyes — the anchor guardian consumed by dark. ---
  e_forestshade: [
    '........oooo........',
    '......ooYyYYoo......',
    '.....oYYYYYYYYo.....',
    '.oo.oYYyYYYYyYYo.oo.',
    'oFYooYYYYYYYYYYooYFo',
    'oYYoYYXXYYYYXXYyoYYo',
    '.oYoYYYYYYYYYYYyoYo.',
    '.oYoYYYyYYYYyYYYoYo.',
    '..ooYYYYYYYYYYYYoo..',
    '.oYYyYYYYYYYYYYyYYo.',
    '.oFYFYFYFYFYFYFYFYo.',
    '.oooooooooooooooooo.',
    '..oYFYFYFYFYFYFYFo..',
    '...oYYYYYYYYYYYYo...',
    '....oYYyYYYYyYYo....',
    '.....ooYYYYYYoo.....',
    '.......oooooo.......',
  ],

  // --- Tide Warden (Ch2 boss): the deep-sea leviathan shape, eyes recast icy
  // pale-cyan (its chill inflict) instead of a fire-boss's red glow. ---
  e_tidewarden: [
    '........oooo........',
    '......ooDdDDoo......',
    '.....oDDDDDDDDo.....',
    '.oo.oDDdDDDDdDDo.oo.',
    'oVDooDDDDDDDDDDooDVo',
    'oDDoDDIIDDDDIIDdoDDo',
    '.oDoDDDDDDDDDDDdoDo.',
    '.oDoDDDdDDDDdDDDoDo.',
    '..ooDDDDDDDDDDDDoo..',
    '.oDDdDDDDDDDDDDdDDo.',
    '.oFDFDFDFDFDFDFDFDo.',
    '.oooooooooooooooooo.',
    '..oDFDFDFDFDFDFDFo..',
    '...oDDDDDDDDDDDDo...',
    '....oDDdDDDDdDDo....',
    '.....ooDDDDDDoo.....',
    '.......oooooo.......',
  ],

  // --- Ashbrand (Ch3 boss): the same maw in the ember palette, molten cracks
  // where the deep-sea boss had cold blue plating. ---
  e_ashbrand: [
    '........oooo........',
    '......ooRrRRoo......',
    '.....oRRRRRRRRo.....',
    '.oo.oRRrRRRRrRRo.oo.',
    'oJRooRRRRRRRRRRooRJo',
    'oRRoRRXXRRRRXXRroRRo',
    '.oRoRRRRRRRRRRRroRo.',
    '.oRoRRRrRRRRrRRRoRo.',
    '..ooRRRRRRRRRRRRoo..',
    '.oRRrRRRRRRRRRRrRRo.',
    '.oFRFRFRFRFRFRFRFRo.',
    '.oooooooooooooooooo.',
    '..oRFRFRFRFRFRFRFo..',
    '...oRRRRRRRRRRRRo...',
    '....oRRrRRRRrRRo....',
    '.....ooRRRRRRoo.....',
    '.......oooooo.......',
  ],

  // --- Prism Sovereign (Ch4 boss): the maw shape cut from crystal instead of
  // flesh — purple facets, luminous white facet-eyes. ---
  e_prismsovereign: [
    '........oooo........',
    '......ooPpPPoo......',
    '.....oPPPPPPPPo.....',
    '.oo.oPPpPPPPpPPo.oo.',
    'oQPooPPPPPPPPPPooPQo',
    'oPPoPPFFPPPPFFPpoPPo',
    '.oPoPPPPPPPPPPPpoPo.',
    '.oPoPPPpPPPPpPPPoPo.',
    '..ooPPPPPPPPPPPPoo..',
    '.oPPpPPPPPPPPPPpPPo.',
    '.oFPFPFPFPFPFPFPFPo.',
    '.oooooooooooooooooo.',
    '..oPFPFPFPFPFPFPFo..',
    '...oPPPPPPPPPPPPo...',
    '....oPPpPPPPpPPo....',
    '.....ooPPPPPPoo.....',
    '.......oooooo.......',
  ],

  // --- Ember Hound: crouching fire-wolf, flame mane, burning eyes ---
  e_ember: [
    '....oooooo....',
    '...oJRRRRJo...',
    '..oRRrRRrRRo..',
    '..oXXRRRRXXo..',
    '..oRRRRRRRRo..',
    '..oRoFoFooRo..',
    '.oRRrRRRRrRRo.',
    'oRRJRRRRRRJRRo',
    'oRooRRrrRRooRo',
    '..oRRRRRRRRo..',
    '..oRRrrrrRRo..',
    '..oRo....oRo..',
    '..oo......oo..',
  ],

  // --- Cinder Wraith: dark tattered shade around a glowing ember core ---
  e_cinder: [
    '....oooooo....',
    '...onnnnnno...',
    '..onXnnnnXno..',
    '..onnnJJnnno..',
    '..onnJRRJnno..',
    '..oonnRRnnoo..',
    '...onnnnnno...',
    '....onnnno....',
    '...onnnnnnoo..',
    '..onnonnonno..',
    '..ono.onno.o..',
    '..oo..oRo..o..',
    '.......J......',
  ],

  // --- Tide Crawler: crab, heavy claws, eyes on the shell ---
  e_crawler: [
    '.oo........oo.',
    'oJRo.oooo.oJRo',
    'oRRoCCCCCCoRRo',
    '.oCCcCCCCcCCo.',
    '.oCXXCCCCXXCo.',
    '.oCCCCCCCCCCo.',
    '.oCcCCccCCcCo.',
    '..oCCCCCCCCo..',
    '..ooo.oo.ooo..',
    '.o..o.o..o..o.',
  ],
};
