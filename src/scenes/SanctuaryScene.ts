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
  '#..........................D.#',
  '#....K.............L......DD.#',
  '#..........................D.#',
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

const NPCS: Record<string, Npc> = {
  K: { spriteKey: 'c_mira', scale: 1, name: 'Warden Eda', kind: 'dialogue', scriptId: 'npc_keeper' },
  L: { spriteKey: 'c_lyra', scale: 1, name: 'Scholar Voss', kind: 'dialogue', scriptId: 'npc_scholar' },
  C: { spriteKey: 'player', scale: 0.8, name: 'Child', kind: 'dialogue', scriptId: 'npc_child' },
  V: { spriteKey: 'c_kael', scale: 1, name: 'Merchant', kind: 'vendor' },
};

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

  constructor() {
    super('Sanctuary');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.state = 'roam';
    this.unsubs = [];
    this.npcAt.clear();
    this.grid = MAP;

    this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg).setOrigin(0, 0).setDepth(0);
    this.drawMap();
    this.spawnPlayer();
    this.bindInput();
    attachTouchControls(this);

    music.play('explore');

    // Arrival story: intro the first time, victory scene after the boss.
    let arrival: string | undefined;
    if (!hasFlag('intro_seen')) {
      setFlag('intro_seen');
      arrival = 'intro';
    } else if (hasFlag('stratum1_cleared') && !hasFlag('stratum1_win_seen')) {
      setFlag('stratum1_win_seen');
      arrival = 'stratum1_win';
    }
    if (arrival) this.openDialogue(arrival);
  }

  // --- Map and figures ------------------------------------------------------

  private drawMap() {
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
        const npc = NPCS[ch];
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
    if (time < this.moveLockedUntil) return;
    const d = input.dir();
    if (d.x === 0 && d.y === 0) return;

    const nx = this.px + d.x;
    const ny = this.py + d.y;
    const ch = this.grid[ny]?.[nx] ?? '#';

    const npc = this.npcAt.get(`${nx},${ny}`);
    if (npc) {
      this.moveLockedUntil = time + 220;
      this.interact(npc);
      return;
    }
    if (ch === 'D') {
      this.descend();
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

  private descend() {
    this.state = 'busy';
    getRun().depth = 1;
    this.scene.start('Descent');
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
      {
        label: () => `Buy Reef Mail   ${equipmentPrice('reef_mail')} gold`,
        enabled: () => getRun().gold >= (equipmentPrice('reef_mail') ?? 0) && !ownedEquipment().some((e) => e.id === 'reef_mail'),
        action: () => buyEquipment('reef_mail'),
      },
      {
        label: () => `Buy Tide Ring   ${equipmentPrice('tide_ring')} gold`,
        enabled: () => getRun().gold >= (equipmentPrice('tide_ring') ?? 0) && !ownedEquipment().some((e) => e.id === 'tide_ring'),
        action: () => buyEquipment('tide_ring'),
      },
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
