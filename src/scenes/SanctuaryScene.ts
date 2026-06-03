import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { ITEMS } from '../game/content';
import { EQUIPMENT } from '../game/equipment';
import { input, attachTouchControls } from '../game/input';
import { music } from '../audio/music';
import {
  buyEquipment,
  buyHpBlessing,
  buyItem,
  canSellEquipment,
  completeQuest,
  equipmentPrice,
  getRun,
  hasFlag,
  hpBlessingCost,
  ownedEquipment,
  sellEquipment,
  sellItem,
  setFlag,
} from '../game/run';
import { sharpText, FONT } from '../ui/text';

const PLAYER_SCALE_X = 1.08;
const PLAYER_SCALE_Y = 1.35;
const STEP_MS = 115;
type Facing = 'down' | 'up' | 'left' | 'right';

// Sanctuary, the last city of light. Handmade map, not procedural.
// '#' wall, '.' floor, 'P' player start, 'D' descent portal
// 'K' warden, 'L' scholar, 'C' child, 'V' merchant
const MAP = [
  '##############################',
  '#............................#',
  '#..###..............###......#',
  '#..###...K.......L..###...DD.#',
  '#..###..............###...D..#',
  '#............................#',
  '#............................#',
  '#.........C.......V..........#',
  '#............................#',
  '#............................#',
  '#..............P.............#',
  '#............................#',
  '#............................#',
  '#............................#',
  '##############################',
];

interface Npc {
  spriteKey: string;
  scale: number;
  name: string;
  kind: 'dialogue' | 'vendor';
  scriptId?: string;
}

function npcs(): Record<string, Npc> {
  const ch2Done = hasFlag('ch2_complete');
  const ch1Done = hasFlag('ch1_complete');
  return {
    K: { spriteKey: 'c_mira', scale: 1, name: 'Warden Eda', kind: 'dialogue', scriptId: ch2Done ? 'npc_keeper_after2' : ch1Done ? 'npc_keeper_after' : 'npc_keeper' },
    L: { spriteKey: 'c_lyra', scale: 1, name: 'Scholar Voss', kind: 'dialogue', scriptId: ch2Done ? 'npc_scholar_after2' : ch1Done ? 'npc_scholar_after' : 'npc_scholar' },
    C: { spriteKey: 'player', scale: 0.8, name: 'Child', kind: 'dialogue', scriptId: 'npc_child' },
    V: { spriteKey: 'c_kael', scale: 1, name: 'Merchant', kind: 'vendor' },
  };
}

type State = 'roam' | 'shop' | 'busy';

/**
 * Starting city. The player roams, talks to people by bumping into them,
 * shops with the merchant, and descends through the eastern portal.
 * Story is delivered here instead of throwing the player straight into a dungeon.
 */
export class SanctuaryScene extends Phaser.Scene {
  private grid: string[] = [];
  private npcAt = new Map<string, Npc>();
  private px = 0;
  private py = 0;
  private player!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private walkFrame = 0;
  private facing: Facing = 'down';
  private moveLockedUntil = 0;
  private state: State = 'roam';
  private unsubs: (() => void)[] = [];
  private shopBox?: Phaser.GameObjects.Container;
  private shopIndex = 0;
  private shopOptions: { label: () => string; action: () => boolean; enabled: () => boolean }[] = [];
  private hintText?: Phaser.GameObjects.Text;

  constructor() {
    super('Sanctuary');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(300, 7, 6, 14);
    this.state = 'roam';
    this.unsubs = [];
    this.npcAt.clear();
    this.grid = MAP;

    this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg).setOrigin(0, 0).setDepth(0);
    this.drawMap(npcs());
    this.placePortalLabels();
    this.spawnPlayer();
    this.bindInput();
    attachTouchControls(this);

    music.play('sanctuary'); // resumes/switches if returning from dungeon

    // Arrival story: only intro on first visit. Chapter wins play from BattleScene.
    if (!hasFlag('intro_seen')) {
      setFlag('intro_seen');
      this.openDialogue('intro');
    }
  }

  // --- Map and figures ------------------------------------------------------

  private drawMap(npcDefs: Record<string, Npc>) {
    for (let r = 0; r < this.grid.length; r++) {
      const row = this.grid[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        const x = c * GAME.tile;
        const y = r * GAME.tile;
        if (ch === '#') {
          this.add.image(x, y, 'wall').setOrigin(0, 0);
        } else {
          this.add.image(x, y, (r + c) % 2 === 0 ? 'floor' : 'floorAlt').setOrigin(0, 0);
        }
        if (ch === 'D') {
          this.add.image(x, y, 'aether').setOrigin(0, 0).setDepth(1).setAlpha(0.85);
        }
        if (ch === 'P') {
          this.px = c;
          this.py = r;
        }
        const npc = npcDefs[ch];
        if (npc) {
          this.npcAt.set(`${c},${r}`, npc);
          this.add.ellipse(x + GAME.tile / 2, y + GAME.tile / 2 + 7, 14, 5, 0x000000, 0.34).setDepth(3);
          this.add.image(x + GAME.tile / 2, y + GAME.tile / 2, npc.spriteKey).setScale(npc.scale).setDepth(4);
          this.add.text(x + GAME.tile / 2, y + GAME.tile + 1, npc.name, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#dfe4f5' })).setOrigin(0.5, 0).setDepth(4);
        }
      }
    }
  }

  private spawnPlayer() {
    this.playerShadow = this.add.ellipse(this.px * GAME.tile + GAME.tile / 2, this.py * GAME.tile + GAME.tile / 2 + 8, 15, 5, 0x000000, 0.36).setDepth(4);
    this.player = this.add.image(this.px * GAME.tile + GAME.tile / 2, this.py * GAME.tile + GAME.tile / 2, 'player').setScale(PLAYER_SCALE_X, PLAYER_SCALE_Y).setDepth(5);
  }

  

  // --- Input ----------------------------------------------------------------

  private bindInput() {
    this.unsubs.push(input.on('confirm', () => this.onConfirm()));
    this.unsubs.push(input.on('cancel', () => this.onCancel()));
    this.unsubs.push(input.on('up', () => this.onVert(-1)));
    this.unsubs.push(input.on('down', () => this.onVert(1)));
    this.unsubs.push(input.on('menu', () => {
      if (this.scene.isActive('GameMenu')) return;
      this.scene.pause();
      this.scene.launch('GameMenu', { caller: this.scene.key });
    }));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
  }

  private onVert(dir: number) {
    if (this.state === 'shop') {
      this.shopIndex = (this.shopIndex + dir + this.shopOptions.length) % this.shopOptions.length;
      this.renderShop();
    }
  }

  private onConfirm() {
    if (this.state === 'shop') {
      const opt = this.shopOptions[this.shopIndex];
      if (opt.enabled()) {
        opt.action();
        this.openShop();
      }
    }
  }

  private onCancel() {
    if (this.state === 'shop') this.closeShop();
  }

  update(time: number) {
    if (this.state !== 'roam') return;
    this.updateHint();
    if (time < this.moveLockedUntil) return;
    const d = input.dir();
    if (d.x === 0 && d.y === 0) return;

    const nx = this.px + d.x;
    const ny = this.py + d.y;
    const ch = this.grid[ny]?.[nx] ?? '#';

    if (ch === 'D') { this.descend(); return; }

    if (this.ch2PortalPos && nx === this.ch2PortalPos.x && ny === this.ch2PortalPos.y) {
      this.descendToChapter2();
      return;
    }
    if (this.ch3PortalPos && nx === this.ch3PortalPos.x && ny === this.ch3PortalPos.y) {
      this.descendToChapter3();
      return;
    }

    const npc = this.npcAt.get(`${nx},${ny}`);
    if (npc && npc.name) {
      this.moveLockedUntil = time + 220;
      this.interact(npc);
      return;
    }
    if (ch === '#' || ch === undefined) {
      this.moveLockedUntil = time + 120;
      return;
    }
    this.px = nx;
    this.py = ny;
    this.facing = this.facingFromDir(d.x, d.y);
    this.walkPlayerTo(this.px * GAME.tile + GAME.tile / 2, this.py * GAME.tile + GAME.tile / 2);
    this.moveLockedUntil = time + 120;
  }

  private updateHint() {
    const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
    let label = '';
    for (const d of dirs) {
      const nx = this.px + d.x;
      const ny = this.py + d.y;
      const ch = this.grid[ny]?.[nx] ?? '#';
      if (ch === 'D' || (this.ch2PortalPos && nx === this.ch2PortalPos.x && ny === this.ch2PortalPos.y)
        || (this.ch3PortalPos && nx === this.ch3PortalPos.x && ny === this.ch3PortalPos.y)) {
        label = 'Z / tap  ·  enter'; break;
      }
      if (this.npcAt.has(`${nx},${ny}`)) {
        const npc = this.npcAt.get(`${nx},${ny}`)!;
        label = `Z / tap  ·  ${npc.kind === 'vendor' ? 'shop' : 'talk'}`; break;
      }
    }
    if (label) {
      if (!this.hintText) {
        this.hintText = this.add.text(GAME.width / 2, GAME.height - 18, label,
          sharpText({ fontFamily: FONT, fontSize: '9px', color: '#6cf0c2' }))
          .setOrigin(0.5, 1).setDepth(20).setAlpha(0);
        this.tweens.add({ targets: this.hintText, alpha: 1, duration: 180 });
      } else {
        this.hintText.setText(label).setVisible(true);
      }
    } else if (this.hintText?.visible) {
      this.hintText.setVisible(false);
    }
  }

  private walkPlayerTo(x: number, y: number) {
    this.walkFrame = 1 - this.walkFrame;
    this.applyFacing(true);
    this.tweens.killTweensOf(this.player);
    this.tweens.killTweensOf(this.playerShadow);
    this.tweens.add({
      targets: this.player,
      x,
      y,
      duration: STEP_MS,
      ease: 'Linear',
      onComplete: () => this.applyFacing(false),
    });
    this.tweens.add({
      targets: this.playerShadow,
      x,
      y: y + 8,
      duration: STEP_MS,
      ease: 'Linear',
    });
  }

  private facingFromDir(x: number, y: number): Facing {
    if (y < 0) return 'up';
    if (y > 0) return 'down';
    return x < 0 ? 'left' : 'right';
  }

  private applyFacing(walking: boolean) {
    const frame = walking ? (this.walkFrame === 0 ? '_walk_a' : '_walk_b') : '';
    const base = this.facing === 'up' ? 'player_back' : 'player';
    this.player.setTexture(`${base}${frame}`);
    this.player.setFlipX(this.facing === 'left');
  }

  private interact(npc: Npc) {
    if (npc.kind === 'vendor') this.openShop();
    else if (npc.scriptId) {
      if (npc.scriptId === 'npc_keeper') completeQuest('speak_eda');
      this.openDialogue(npc.scriptId);
    }
  }

  // --- Dialog ---------------------------------------------------------------

  private openDialogue(scriptId: string) {
    this.state = 'busy';
    this.scene.pause();
    this.scene.launch('Dialogue', {
      scriptId,
      onDone: () => {
        this.scene.resume();
        this.state = 'roam';
      },
    });
  }

  // --- Descent --------------------------------------------------------------

  private placePortalLabels() {
    // Label the Ashenveil Forest portal.
    const dTiles: { c: number; r: number }[] = [];
    for (let r = 0; r < this.grid.length; r++)
      for (let c = 0; c < this.grid[r].length; c++)
        if (this.grid[r][c] === 'D') dTiles.push({ c, r });
    if (dTiles.length > 0) {
      const mid = dTiles[Math.floor(dTiles.length / 2)];
      this.add.text(mid.c * GAME.tile + GAME.tile / 2, mid.r * GAME.tile - 6, 'Ashenveil Forest',
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#a58cff' })).setOrigin(0.5, 1).setDepth(5);
    }

    // Chapter 2 portal — north of town, only after ch1 complete.
    if (hasFlag('ch1_complete')) {
      const px = 14, py = 1;
      this.add.image(px * GAME.tile, py * GAME.tile, 'aether')
        .setOrigin(0, 0).setTint(0x4488ff).setDepth(1);
      this.add.text(px * GAME.tile + GAME.tile / 2, py * GAME.tile - 6, 'Sunken City',
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#6699ff' })).setOrigin(0.5, 1).setDepth(5);
      this.ch2PortalPos = { x: px, y: py };
    }

    if (hasFlag('ch2_complete')) {
      const px = 2, py = 7;
      this.add.image(px * GAME.tile, py * GAME.tile, 'aether')
        .setOrigin(0, 0).setTint(0xff6622).setDepth(1);
      this.add.text(px * GAME.tile + GAME.tile / 2, py * GAME.tile - 6, 'Ashen Peaks',
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#ff8844' })).setOrigin(0.5, 1).setDepth(5);
      this.ch3PortalPos = { x: px, y: py };
    }
  }

  private ch2PortalPos: { x: number; y: number } | null = null;
  private ch3PortalPos: { x: number; y: number } | null = null;

  private descend() {
    this.state = 'busy';
    getRun().depth = 1;
    this.cameras.main.fadeOut(250, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Descent'));
  }

  private descendToChapter2() {
    this.state = 'busy';
    getRun().depth = 3;
    this.cameras.main.fadeOut(250, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Descent'));
  }

  private descendToChapter3() {
    this.state = 'busy';
    getRun().depth = 5;
    this.cameras.main.fadeOut(250, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Descent'));
  }

  // --- Merchant shop --------------------------------------------------------

  private openShop() {
    this.state = 'shop';
    this.shopIndex = 0;
    const inv = getRun().inventory;
    this.shopOptions = [
      {
        label: () => `Crystal Blessing (+${8} max HP)   ${hpBlessingCost()} gold`,
        enabled: () => getRun().gold >= hpBlessingCost(),
        action: () => buyHpBlessing(),
      },
      {
        label: () => `Buy Elixir (+30 HP)   ${ITEMS.potion.buyPrice} gold`,
        enabled: () => getRun().gold >= (ITEMS.potion.buyPrice ?? 0),
        action: () => buyItem('potion'),
      },
      {
        label: () => `Buy Aether Tonic (+12 MP)   ${ITEMS.tonic.buyPrice} gold`,
        enabled: () => getRun().gold >= (ITEMS.tonic.buyPrice ?? 0),
        action: () => buyItem('tonic'),
      },
      ...(hasFlag('ch1_complete') ? [{
        label: () => `Buy Reef Mail   ${equipmentPrice('reef_mail')} gold`,
        enabled: () => getRun().gold >= (equipmentPrice('reef_mail') ?? 0) && !ownedEquipment().some((e) => e.id === 'reef_mail'),
        action: () => { buyEquipment('reef_mail'); return true; },
      }, {
        label: () => `Buy Tide Ring   ${equipmentPrice('tide_ring')} gold`,
        enabled: () => getRun().gold >= (equipmentPrice('tide_ring') ?? 0) && !ownedEquipment().some((e) => e.id === 'tide_ring'),
        action: () => { buyEquipment('tide_ring'); return true; },
      }] : []),
    ];
    for (const [id, count] of Object.entries(inv).filter(([, n]) => n > 0)) {
      const item = ITEMS[id];
      if (!item) continue;
      this.shopOptions.push({
        label: () => `Sell ${item.name} x${count}   +${item.sellPrice} gold`,
        enabled: () => (getRun().inventory[id] ?? 0) > 0,
        action: () => sellItem(id),
      });
    }
    for (const eq of ownedEquipment().filter((e) => !['slender_blade', 'ember_staff', 'dawn_mace'].includes(e.id))) {
      this.shopOptions.push({
        label: () => `Sell ${EQUIPMENT[eq.id].name}   +${Math.floor((equipmentPrice(eq.id) ?? 40) * 0.5)} gold`,
        enabled: () => canSellEquipment(eq.id),
        action: () => sellEquipment(eq.id),
      });
    }
    this.renderShop();
  }

  private renderShop() {
    this.shopBox?.destroy();
    const box = this.add.container(0, 0).setDepth(40);
    box.add(this.add.rectangle(30, 58, 560, 222, 0x0d1024, 0.98).setOrigin(0, 0).setStrokeStyle(1, COLORS.wall));
    box.add(this.add.text(44, 70, 'MERCHANT', sharpText({ fontFamily: FONT, fontSize: '13px', color: '#f0d36c' })));
    box.add(this.add.text(44, 91, `Gold: ${getRun().gold}  |  Elixir: ${getRun().inventory.potion ?? 0}  |  Tonic: ${getRun().inventory.tonic ?? 0}`, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5' })));
    this.shopOptions.forEach((o, i) => {
      const color = !o.enabled() ? '#5a6080' : i === this.shopIndex ? '#f0d36c' : '#c9cee8';
      const prefix = i === this.shopIndex ? '> ' : '  ';
      box.add(this.add.text(44, 116 + i * 17, prefix + o.label(), sharpText({ fontFamily: FONT, fontSize: '9px', color, strokeThickness: 2 })));
    });
    box.add(this.add.text(44, 262, 'Space/Enter choose  |  Esc close', sharpText({ fontFamily: FONT, fontSize: '9px', color: '#c9cee8' })));
    this.shopBox = box;
  }

  private closeShop() {
    this.shopBox?.destroy();
    this.shopBox = undefined;
    this.state = 'roam';
    this.moveLockedUntil = this.time.now + 150;
  }
}
