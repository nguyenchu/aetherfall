// Original pixel-art sprites drawn in code, with no image files. Each figure is
// a small dot-grid map: one character equals one palette color, and '.' or space
// means transparent. Generated as Phaser textures at boot and shared by dungeon
// and battle scenes. Replace them later by keeping the same texture keys.

import Phaser from 'phaser';

// -1 = transparent. The rest are hex colors.
const PALETTE: Record<string, number> = {
  '.': -1,
  ' ': -1,
  o: 0x0c0e16, // outline / dark
  S: 0xf0c79a, // light skin
  s: 0xc28e63, // skin shadow
  e: 0x0c0e16, // eye
  H: 0x4a3a2a, // hair / hood
  A: 0x6cf0c2, // warrior turquoise
  B: 0x39a98a, // turquoise shadow
  M: 0xd9e7f2, // light metal
  m: 0x95a8bb, // metal shadow
  P: 0x8a6cf0, // mage purple
  p: 0x5a44b0, // purple shadow
  G: 0xf0d36c, // cleric gold
  g: 0xb89a3c, // gold shadow
  W: 0x9a6a3a, // wood / staff
  w: 0x6b4a28, // wood shadow
  F: 0xeef2ff, // white glow / eyes
  L: 0x4a7a5a, // ghoul green
  l: 0x2f5540, // green shadow
  U: 0x6c9cf0, // sprite blue
  u: 0x3f6bbf, // blue shadow
  C: 0x9a6a4a, // crawler brown
  c: 0x6b4630, // brown shadow
  R: 0xd98a5a, // claw orange
  X: 0xff5a6a, // glowing eyes / accent
  N: 0x7a8a9a, // warden gray
  n: 0x46506a, // gray shadow
  D: 0x3a5a8a, // boss deep blue
  d: 0x24385a, // boss shadow
};

// Each value is top-to-bottom rows. Width is the longest row.
const SPRITES: Record<string, string[]> = {
  // --- Dungeon hero: turquoise-clad explorer ---
  player: [
    '.......oooo.....',
    '......oHHHHo....',
    '.....oHSSSSo....',
    '.....oSeSSeo....',
    '.....osSSSo.....',
    '.....oAAAAo.....',
    '....oAAAAAAo....',
    '....oAABAAAoo...',
    '....oAAAAAAo....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '......oAAo......',
    '.....oSooSo.....',
    '.....oBooBo.....',
    '.....oo..oo.....',
  ],

  player_walk_a: [
    '.......oooo.....',
    '......oHHHHo....',
    '.....oHSSSSo....',
    '.....oSeSSeo....',
    '.....osSSSo.....',
    '.....oAAAAo.....',
    '....oAAAAAAo....',
    '....oAABAAAoo...',
    '....oAAAAAAo....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '......oAAo......',
    '....oSo..oSo....',
    '....oBo..oBo....',
    '....oo....oo....',
  ],

  player_walk_b: [
    '.......oooo.....',
    '......oHHHHo....',
    '.....oHSSSSo....',
    '.....oSeSSeo....',
    '.....osSSSo.....',
    '.....oAAAAo.....',
    '....oAAAAAAo....',
    '...ooAAAABAo....',
    '....oAAAAAAo....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '......oAAo......',
    '......oSSo......',
    '.....oBoBBo.....',
    '.....oo.ooo.....',
  ],

  player_back: [
    '.......oooo.....',
    '......oHHHHo....',
    '.....oHHHHHo....',
    '.....oHHHHHo....',
    '......oHHHo.....',
    '.....oAAAAo.....',
    '....oAAAAAAo....',
    '....oAABAAAoo...',
    '....oAAAAAAo....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '......oAAo......',
    '.....oSooSo.....',
    '.....oBooBo.....',
    '.....oo..oo.....',
  ],

  player_back_walk_a: [
    '.......oooo.....',
    '......oHHHHo....',
    '.....oHHHHHo....',
    '.....oHHHHHo....',
    '......oHHHo.....',
    '.....oAAAAo.....',
    '....oAAAAAAo....',
    '....oAABAAAoo...',
    '....oAAAAAAo....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '......oAAo......',
    '....oSo..oSo....',
    '....oBo..oBo....',
    '....oo....oo....',
  ],

  player_back_walk_b: [
    '.......oooo.....',
    '......oHHHHo....',
    '.....oHHHHHo....',
    '.....oHHHHHo....',
    '......oHHHo.....',
    '.....oAAAAo.....',
    '....oAAAAAAo....',
    '...ooAAAABAo....',
    '....oAAAAAAo....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '.....oAAAAo.....',
    '......oAAo......',
    '......oSSo......',
    '.....oBoBBo.....',
    '.....oo.ooo.....',
  ],

  // --- Kael, warrior: steel helm, turquoise armor, sword ---
  c_kael: [
    '.......oooo.....',
    '......oMMMMo....',
    '.....oMMMMMo....',
    '.....oSSSSo.....',
    '.....oSeSeo.....',
    '.....oSSSSo.....',
    '.....osSSo......',
    '..M..oAAAAo.....',
    '.oMooAABAoo.M...',
    '.oMooAAAAooMo...',
    '.oMooAABAo.o....',
    '..M..oAAAAo.....',
    '.....oSooSo.....',
    '.....oSooSo.....',
    '.....oBooBo.....',
    '.....oo..oo.....',
  ],

  // --- Lyra, mage: pointed hat, purple cloak, glowing staff ---
  c_lyra: [
    '.......o........',
    '......ooo.......',
    '.....oPpPo......',
    '....oPPPPPo.....',
    '...oPPPPPPPo....',
    '...oSSSSSSo.....',
    '...oSeSSeSo.W...',
    '...oSSSSSSoFFW..',
    '..oPPPPPPPPoWo..',
    '..oPpPPPPpPoW...',
    '..oPPPPPPPPoW...',
    '...oPPPPPPo.W...',
    '...oPPPPPPo.W...',
    '....oPPPPo......',
    '....oSooSo......',
    '....ooooooo.....',
  ],

  // --- Mira, cleric: golden hood and cloak, mace ---
  c_mira: [
    '.....oooo.......',
    '....oGGGGo......',
    '...oGGGGGGo.....',
    '...oGSSSSGo.....',
    '...oGSeSeGo.....',
    '...oGSSSSGo.....',
    '....oSSSSo......',
    '...oGGGGGGo.M...',
    '..oGGGgGGGooMo..',
    '..oGgGGGgGooMo..',
    '..oGGGGGGGo.w...',
    '..oGGGGGGGo.w...',
    '...oGGGGGGo.w...',
    '....oGGGGo......',
    '....oSooSo......',
    '....ooooooo.....',
  ],

  // --- Drowned Ghoul: drowned green creature, glowing red eyes ---
  e_ghoul: [
    '....oooooo....',
    '...oLLLLLLo...',
    '..oLLllLLLLo..',
    '..oLLLLLLLLo..',
    '..oLXLLLLXLo..',
    '..oLLLLLLLLo..',
    '..oLLlwwlLLo..',
    '.olLLLLLLLLlo.',
    'oLLLlLLLLlLLLo',
    'oLooLLLLLLooLo',
    '..oLLLLLLLLo..',
    '..oLLllllLLo..',
    '..oLLo..oLLo..',
    '..oLo....oLo..',
    '..oo......oo..',
  ],

  // --- Mire Sprite: small floating blue spirit ---
  e_sprite: [
    '.....oooo.....',
    '...ooUUUUoo...',
    '..oUUUUUUUUo..',
    '.oUUUuUUuUUUo.',
    '.oUUFUUUUFUUo.',
    '.oUUUUUUUUUUo.',
    '.oUUUuUUuUUUo.',
    '..oUUUUUUUUo..',
    '...oUUUUUUo...',
    '....oUuuUo....',
    '...o.oUUo.o...',
    '..o..oUUo..o..',
    '.....o..o.....',
  ],

  // --- Sunken Warden: armored gray-metal warden, glowing eye ---
  e_warden: [
    '....NNNNNN....',
    '...oNNNNNNo...',
    '..oNNmmmmNNo..',
    '..oNmMMMMmNo..',
    '..oNmMXXMmNo..',
    '..oNmMMMMmNo..',
    '..oNNmmmmNNo..',
    '.oNNNNNNNNNNo.',
    'oNNmNNNNNNmNNo',
    'oNonNNNNNNnoNo',
    '..oNNNNNNNNo..',
    '..oNNmmmmNNo..',
    '..oNNo..oNNo..',
    '..oNo....oNo..',
    '..oo......oo..',
  ],

  // --- Leviathan of the Deep (boss): huge gaping deep-blue creature ---
  e_leviathan: [
    '........oooo........',
    '......ooDDDDoo......',
    '....ooDDDDDDDDoo....',
    '...oDDDdDDDDdDDDo...',
    '..oDDDDDDDDDDDDDDo..',
    '..oDDXDDDDDDDDXDDo..',
    '..oDDDDDDDDDDDDDDo..',
    '.oDDDdDDDDDDDDdDDDo.',
    '.oDDDDDDDDDDDDDDDDo.',
    '.oFDFDFDFDFDFDFDFDo.',
    '.oDDDDDDDDDDDDDDDDo.',
    '..oDDDDDDDDDDDDDDo..',
    '...oFDFDFDFDFDFDo...',
    '...oDDDDDDDDDDDDo...',
    '....oDDdDDDDdDDo....',
    '.....ooDDDDDDoo.....',
    '.......oooooo.......',
  ],

  // --- Tide Crawler: crab-like, orange claws, glowing eyes ---
  e_crawler: [
    '.o..........o.',
    'oRo.oooooo.oRo',
    'oRoCCCCCCCCoRo',
    '.oCCcCCCCcCCo.',
    '.oCXCCCCCCXCo.',
    '.oCCCCCCCCCCo.',
    '.oCCcCCCCcCCo.',
    '..oCCCCCCCCo..',
    '..o.oo..oo.o..',
    '.o..o....o..o.',
  ],
};

/** Builds all character textures before the game starts. */
export function buildCharacterSprites(scene: Phaser.Scene): void {
  for (const [key, rows] of Object.entries(SPRITES)) {
    if (scene.textures.exists(key)) continue;
    const w = Math.max(...rows.map((r) => r.length));
    const h = rows.length;
    const g = scene.add.graphics();
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const color = PALETTE[row[x] ?? '.'];
        if (color == null || color < 0) continue;
        g.fillStyle(color, 1);
        g.fillRect(x, y, 1, 1);
      }
    }
    g.generateTexture(key, w, h);
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    g.destroy();
  }
}
