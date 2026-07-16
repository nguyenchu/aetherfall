import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { ITEMS } from '../game/content';
import { EQUIPMENT, equipmentEffectText, type EquipSlot } from '../game/equipment';
import { input, attachTouchControls } from '../game/input';
import { music } from '../audio/music';
import {
  buyEquipment,
  buyHpBlessing,
  buyItem,
  canSellEquipment,
  completeQuest,
  equipmentPrice,
  equippedFor,
  getRun,
  getSave,
  hasFlag,
  hpBlessingCost,
  isQuestActive,
  ownedEquipment,
  sellEquipment,
  sellItem,
  setFlag,
} from '../game/run';
import { sharpText, FONT } from '../ui/text';
import { showQuestToast } from '../ui/questToast';
import { tileVariant } from '../art/tiles';

const PLAYER_SCALE_X = 1.08;
const PLAYER_SCALE_Y = 1.35;
const STEP_MS = 115;
type Facing = 'down' | 'up' | 'left' | 'right';

// Merchant gear stock, unlocked by story flags. Found gear never appears here.
const SHOP_GEAR: Array<{ id: string; flag: string }> = [
  { id: 'reef_mail', flag: 'ch1_complete' },
  { id: 'tide_ring', flag: 'ch1_complete' },
  { id: 'moonveil_charm', flag: 'ch1_complete' },
  { id: 'aether_loop', flag: 'ch1_complete' },
  { id: 'stormcaller_rod', flag: 'ch1_complete' },
  { id: 'winter_staff', flag: 'ch2_complete' },
  { id: 'dawnstar', flag: 'ch2_complete' },
  { id: 'emberweave_robe', flag: 'ch2_complete' },
  { id: 'stormglass_rod', flag: 'ch4_complete' },
  { id: 'hollowguard_plate', flag: 'ch4_complete' },
  { id: 'prism_band', flag: 'ch4_complete' },
];

// Merchant consumable stock beyond the always-available Elixir/Tonic.
const SHOP_ITEMS: Array<{ id: string; flag: string; hint: string }> = [
  { id: 'hi_potion', flag: 'ch1_complete', hint: '+65 HP' },
  { id: 'hi_tonic', flag: 'ch1_complete', hint: '+24 MP' },
  { id: 'purifying_draught', flag: 'ch2_complete', hint: 'cures ailments' },
  { id: 'phoenix_down', flag: 'ch3_complete', hint: 'revives at 40%' },
];

/** Rows visible per shop column before scrolling (▲/▼ markers). */
const SHOP_ROWS = 8;

type ShopKind = 'blessing' | 'buyItem' | 'buyGear' | 'sellItem' | 'sellGear' | 'sellAll';
interface ShopOption {
  id?: string;
  kind: ShopKind;
  label: () => string;
  price: () => number;
  enabled: () => boolean;
  action: () => void;
}

const SLOT_BADGE: Record<EquipSlot, string> = { weapon: 'WPN', armor: 'ARM', charm: 'CHR' };
const USER_NAME: Record<string, string> = { kael: 'Kael', lyra: 'Lyra', mira: 'Mira', bram: 'Mira' };
const STAT_ABBR: Record<string, string> = { maxHp: 'HP', maxMp: 'MP', str: 'STR', vit: 'VIT', agi: 'AGI', int: 'INT' };
const statAbbr = (k: string) => STAT_ABBR[k] ?? k.replace('max', '').toUpperCase();

// Sanctuary, the last city of light. Handmade map, not procedural.
// '#' wall, '.' floor, 'P' player start, 'D' descent portal
// 'K' warden, 'L' scholar, 'C' child, 'V' merchant
const MAP = [
  '##############################',
  '#..T.........................#',
  '#..###..............###......#',
  '#..###...K.......L..###...DD.#',
  '#..###..............###...D..#',
  '#............................#',
  '#............................#',
  '#.........C.......V..........#',
  '#..........A.................#',
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
  kind: 'dialogue' | 'vendor' | 'ascend';
  scriptId?: string;
  /** Shows a bouncing "!" above the figure while true — an unclaimed quest. */
  questActive?: boolean;
  /** Quest resolved by talking to this NPC while questActive is true. */
  questId?: string;
  /** Roams a small area around its spawn tile instead of standing still.
   *  Off for the Merchant/Crystal — you want those exactly where you left them. */
  wander?: boolean;
}

/** A spawned Npc plus its live position/display state. Shadow, sprite, name
 *  label, and any quest/story marker are children of one Container, so
 *  wandering just means tweening the container — everything rides along. */
interface LiveNpc {
  def: Npc;
  container: Phaser.GameObjects.Container;
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  facing: 1 | -1;
  moving: boolean;
  nextMoveAt: number;
}

function npcs(): Record<string, Npc> {
  const ch4Done = hasFlag('ch4_complete');
  const ch3Done = hasFlag('ch3_complete');
  const ch2Done = hasFlag('ch2_complete');
  const ch1Done = hasFlag('ch1_complete');
  return {
    K: {
      spriteKey: 'c_mira', scale: 1, name: 'Warden Eda', kind: 'dialogue',
      scriptId: ch4Done ? 'npc_keeper_after4' : ch3Done ? 'npc_keeper_after3' : ch2Done ? 'npc_keeper_after2' : ch1Done ? 'npc_keeper_after' : 'npc_keeper',
      questActive: isQuestActive('speak_eda'), questId: 'speak_eda', wander: true,
    },
    L: {
      spriteKey: 'c_lyra', scale: 1, name: 'Scholar Voss', kind: 'dialogue',
      scriptId: ch4Done ? 'npc_scholar_after4' : ch3Done ? 'npc_scholar_after3' : ch2Done ? 'npc_scholar_after2' : ch1Done ? 'npc_scholar_after' : 'npc_scholar',
      questActive: isQuestActive('learn_of_anchors'), questId: 'learn_of_anchors', wander: true,
    },
    C: {
      spriteKey: 'player', scale: 0.8, name: 'Child', kind: 'dialogue',
      scriptId: ch4Done ? 'npc_child_after4' : ch3Done ? 'npc_child_after3' : ch2Done ? 'npc_child_after2' : ch1Done ? 'npc_child_after1' : 'npc_child',
      questActive: ch1Done && isQuestActive('find_pip'), questId: 'find_pip', wander: true,
    },
    V: { spriteKey: 'c_kael', scale: 1, name: 'Merchant', kind: 'vendor' },
    // The Stranger appears after Ch1 in the northwest corner
    ...(ch1Done ? {
      T: {
        spriteKey: 'c_kael', scale: 0.9, name: '???', kind: 'dialogue' as const,
        scriptId: ch4Done ? 'npc_stranger_after4' : ch3Done ? 'npc_stranger_after3' : ch2Done ? 'npc_stranger_after2' : 'npc_stranger',
        // heed_the_stranger is a one-off "you've noticed them" bootstrap quest
        // (completes on first talk after ch1); stranger_truth is the real
        // payoff, gated on ch4 so it can't complete until the after4 tier —
        // completeQuest() no-ops on an already-complete id, so this switch is
        // what makes the second quest ever fire at all.
        questActive: isQuestActive(ch4Done ? 'stranger_truth' : 'heed_the_stranger'),
        questId: ch4Done ? 'stranger_truth' : 'heed_the_stranger',
        wander: true,
      },
    } : {}),
    // The Crystal itself — an Ascension prompt, once the anchors are restored.
    ...(ch4Done ? {
      A: { spriteKey: 'aether', scale: 0.9, name: 'the Crystal', kind: 'ascend' as const },
    } : {}),
  };
}

type State = 'roam' | 'shop' | 'busy';
interface NearbyAction {
  label: string;
  run: () => void;
}

/**
 * Starting city. The player roams, talks to people by bumping into them,
 * shops with the merchant, and descends through the eastern portal.
 * Story is delivered here instead of throwing the player straight into a dungeon.
 */
export class SanctuaryScene extends Phaser.Scene {
  private grid: string[] = [];
  private liveNpcs: LiveNpc[] = [];
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
  private shopColumn: 'buy' | 'sell' = 'buy';
  private shopSel = { buy: 0, sell: 0 };
  private shopScroll = { buy: 0, sell: 0 };
  private buys: ShopOption[] = [];
  private sells: ShopOption[] = [];
  private hintText?: Phaser.GameObjects.Text;
  private questMarkers = new Map<string, Phaser.GameObjects.Text>();
  private storyMarkers = new Map<string, Phaser.GameObjects.Text>();

  constructor() {
    super('Sanctuary');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(300, 7, 6, 14);
    this.state = 'roam';
    this.unsubs = [];
    this.liveNpcs = [];
    this.questMarkers.clear();
    this.storyMarkers.clear();
    this.grid = MAP;
    // Phaser destroys the previous instance's display objects on shutdown,
    // but this class instance (and its fields) survives scene restarts —
    // without resetting these, update() can touch a destroyed GameObject.
    this.hintText = undefined;
    this.shopBox = undefined;

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
          const base = (r + c) % 2 === 0 ? 'floor' : 'floorAlt';
          this.add.image(x, y, `${base}_${tileVariant(c, r, 2)}`).setOrigin(0, 0);
        }
        if (ch === 'D') {
          this.add.image(x, y, 'aether').setOrigin(0, 0).setDepth(1).setAlpha(0.85);
        }
        if (ch === 'P') {
          this.px = c;
          this.py = r;
        }
        const npc = npcDefs[ch];
        if (npc) this.spawnNpc(npc, c, r);
      }
    }
  }

  /** Builds one NPC's shadow/sprite/label/marker as children of a single
   *  Container, positioned at tile (c, r). Wandering just tweens the
   *  container afterward — everything rides along with it. */
  private spawnNpc(npc: Npc, c: number, r: number) {
    const container = this.add.container(c * GAME.tile + GAME.tile / 2, r * GAME.tile + GAME.tile / 2).setDepth(4);
    container.add(this.add.ellipse(0, 7, 14, 5, 0x000000, 0.34));
    const img = this.add.image(0, 0, npc.spriteKey).setScale(npc.scale);
    container.add(img);
    container.add(this.add.text(0, GAME.tile / 2 + 1, npc.name, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#dfe4f5' })).setOrigin(0.5, 0));

    if (npc.questActive && npc.questId) {
      const marker = this.addNpcMarker(container, '!', '#f0d36c');
      this.questMarkers.set(npc.questId, marker);
    } else if (npc.scriptId && !hasFlag(`seen_${npc.scriptId}`)) {
      // Unclaimed-quest "!" takes priority; this is the quieter nudge for
      // optional story/world-building lines that have no quest attached
      // (e.g. an NPC's _after2/_after3 follow-up), which otherwise had
      // zero on-screen indicator once their one-time quest was done.
      const marker = this.addNpcMarker(container, '•', '#6cf0c2');
      this.storyMarkers.set(npc.scriptId, marker);
    }

    this.liveNpcs.push({
      def: npc, container, img, x: c, y: r, homeX: c, homeY: r,
      facing: 1, moving: false, nextMoveAt: this.time.now + Phaser.Math.Between(1000, 3000),
    });
  }

  /** A small bouncing glyph parented to an NPC's container (local coords —
   *  moves with the NPC automatically). See addBounceMarker for the
   *  standalone, absolute-position version used for the next-objective marker. */
  private addNpcMarker(container: Phaser.GameObjects.Container, glyph: string, color: string): Phaser.GameObjects.Text {
    const marker = this.add.text(0, -GAME.tile / 2 - 4, glyph, sharpText({ fontFamily: FONT, fontSize: '11px', color })).setOrigin(0.5);
    container.add(marker);
    this.tweens.add({ targets: marker, y: marker.y - 4, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return marker;
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
    this.unsubs.push(input.on('left', () => this.onHoriz(-1)));
    this.unsubs.push(input.on('right', () => this.onHoriz(1)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
  }

  private activeList(): ShopOption[] {
    return this.shopColumn === 'buy' ? this.buys : this.sells;
  }

  private onVert(dir: number) {
    if (this.state !== 'shop') return;
    const list = this.activeList();
    if (list.length === 0) return;
    this.shopSel[this.shopColumn] = (this.shopSel[this.shopColumn] + dir + list.length) % list.length;
    this.clampScroll();
    this.renderShop();
  }

  private onHoriz(dir: number) {
    if (this.state !== 'shop') return;
    const target: 'buy' | 'sell' = dir < 0 ? 'buy' : 'sell'; // left = BUY column, right = SELL
    if (target === this.shopColumn) return;
    if ((target === 'buy' ? this.buys : this.sells).length === 0) return; // nothing on that side
    this.shopColumn = target;
    this.clampScroll();
    this.renderShop();
  }

  /** Keep the active column's selected row inside its scroll window. */
  private clampScroll() {
    const col = this.shopColumn;
    const list = this.activeList();
    const sel = this.shopSel[col];
    let scroll = Phaser.Math.Clamp(this.shopScroll[col], 0, Math.max(0, list.length - SHOP_ROWS));
    if (sel < scroll) scroll = sel;
    else if (sel >= scroll + SHOP_ROWS) scroll = sel - SHOP_ROWS + 1;
    this.shopScroll[col] = scroll;
  }

  private onConfirm() {
    if (this.state === 'shop') {
      const opt = this.activeList()[this.shopSel[this.shopColumn]];
      if (opt && opt.enabled()) {
        opt.action();
        this.refreshShop(); // rebuild stock but keep the player's place
      }
    } else if (this.state === 'roam' && this.time.now >= this.moveLockedUntil) {
      const action = this.getNearbyAction();
      if (!action) return;
      this.moveLockedUntil = this.time.now + 220;
      input.releaseAll();
      action.run();
    }
  }

  private onCancel() {
    if (this.state === 'shop') { this.closeShop(); return; }
    if (this.state === 'busy') return; // mid-dialogue/transition — not a menu opportunity
    if (this.scene.isActive('GameMenu')) return;
    this.scene.pause();
    this.scene.launch('GameMenu', { caller: this.scene.key });
  }

  update(time: number) {
    if (this.state !== 'roam') return;
    this.updateHint();
    this.updateNpcWander(time);
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
    if (this.ch4PortalPos && nx === this.ch4PortalPos.x && ny === this.ch4PortalPos.y) {
      this.descendToChapter4();
      return;
    }

    const live = this.liveNpcAt(nx, ny);
    if (live) {
      this.moveLockedUntil = time + 220;
      this.interact(live);
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

  private liveNpcAt(x: number, y: number): LiveNpc | undefined {
    return this.liveNpcs.find((n) => n.x === x && n.y === y);
  }

  /** True if a wandering NPC may step onto (x, y) right now: in-bounds
   *  floor, not a wall/portal, not the player's tile, not another NPC's
   *  tile, and within a short leash of home so they stay findable. */
  private isWanderable(live: LiveNpc, x: number, y: number): boolean {
    const ch = this.grid[y]?.[x];
    if (!ch || ch === '#' || ch === 'D') return false;
    if (x === this.px && y === this.py) return false;
    if (this.liveNpcAt(x, y)) return false;
    if (this.ch2PortalPos && x === this.ch2PortalPos.x && y === this.ch2PortalPos.y) return false;
    if (this.ch3PortalPos && x === this.ch3PortalPos.x && y === this.ch3PortalPos.y) return false;
    if (this.ch4PortalPos && x === this.ch4PortalPos.x && y === this.ch4PortalPos.y) return false;
    const leash = 3;
    return Math.max(Math.abs(x - live.homeX), Math.abs(y - live.homeY)) <= leash;
  }

  /** Idle wander for NPCs marked `wander: true` — occasionally steps one
   *  tile in a random open direction, otherwise just waits. Ticks only
   *  while roaming (dialogue/shop already pause or skip update() entirely). */
  private updateNpcWander(time: number) {
    for (const live of this.liveNpcs) {
      if (!live.def.wander || live.moving || time < live.nextMoveAt) continue;
      if (Math.random() < 0.4) {
        live.nextMoveAt = time + Phaser.Math.Between(1200, 2600);
        continue;
      }
      const dirs = Phaser.Utils.Array.Shuffle([{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]);
      let moved = false;
      for (const d of dirs) {
        const nx = live.x + d.x, ny = live.y + d.y;
        if (!this.isWanderable(live, nx, ny)) continue;
        if (d.x !== 0) { live.facing = d.x > 0 ? 1 : -1; live.img.setFlipX(live.facing === -1); }
        live.x = nx;
        live.y = ny;
        live.moving = true;
        this.tweens.add({
          targets: live.container,
          x: nx * GAME.tile + GAME.tile / 2,
          y: ny * GAME.tile + GAME.tile / 2,
          duration: 280,
          ease: 'Linear',
          onComplete: () => { live.moving = false; },
        });
        moved = true;
        break;
      }
      live.nextMoveAt = time + (moved ? Phaser.Math.Between(2200, 4200) : Phaser.Math.Between(1000, 2000));
    }
  }

  /** NPCs only have one sprite frame (no back-view), so "facing" the player
   *  is just a left/right flip — a small acknowledgement when you walk up. */
  private faceNpcTowardPlayer(live: LiveNpc) {
    if (this.px === live.x) return;
    const faceLeft = this.px < live.x;
    live.facing = faceLeft ? -1 : 1;
    live.img.setFlipX(faceLeft);
  }

  private updateHint() {
    const label = this.getNearbyAction()?.label ?? '';
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

  private getNearbyAction(): NearbyAction | null {
    for (const d of this.nearbyDirs()) {
      const nx = this.px + d.x;
      const ny = this.py + d.y;
      const ch = this.grid[ny]?.[nx] ?? '#';

      if (ch === 'D') return this.portalAction(() => this.descend());
      if (this.ch2PortalPos && nx === this.ch2PortalPos.x && ny === this.ch2PortalPos.y) {
        return this.portalAction(() => this.descendToChapter2());
      }
      if (this.ch3PortalPos && nx === this.ch3PortalPos.x && ny === this.ch3PortalPos.y) {
        return this.portalAction(() => this.descendToChapter3());
      }
      if (this.ch4PortalPos && nx === this.ch4PortalPos.x && ny === this.ch4PortalPos.y) {
        return this.portalAction(() => this.descendToChapter4());
      }

      const live = this.liveNpcAt(nx, ny);
      if (live) {
        const verb = live.def.kind === 'vendor' ? 'shop' : live.def.kind === 'ascend' ? 'ascend' : 'talk';
        return {
          label: `Z / tap  ·  ${verb}`,
          run: () => this.interact(live),
        };
      }
    }
    return null;
  }

  private portalAction(run: () => void): NearbyAction {
    const mod = getRun().modifier;
    const modTag = mod.id !== 'none' ? `  [${mod.name}]` : '';
    return { label: `Z / tap  ·  enter${modTag}`, run };
  }

  private nearbyDirs() {
    const facingDir = {
      down: { x: 0, y: 1 },
      up: { x: 0, y: -1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    }[this.facing];
    const dirs = [facingDir, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
    return dirs.filter((d, i) => dirs.findIndex((o) => o.x === d.x && o.y === d.y) === i);
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

  private interact(live: LiveNpc) {
    this.faceNpcTowardPlayer(live);
    const npc = live.def;
    if (npc.kind === 'vendor') this.openShop();
    else if (npc.kind === 'ascend') this.openAscend();
    else if (npc.scriptId) this.openDialogue(npc.scriptId, npc.questActive ? npc.questId : undefined);
  }

  private openAscend() {
    this.state = 'busy';
    this.cameras.main.fadeOut(250, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Ascend'));
  }

  // --- Dialog ---------------------------------------------------------------

  private openDialogue(scriptId: string, questId?: string) {
    this.state = 'busy';
    input.releaseAll();
    setFlag(`seen_${scriptId}`);
    this.storyMarkers.get(scriptId)?.destroy();
    this.storyMarkers.delete(scriptId);
    this.scene.pause();
    this.scene.launch('Dialogue', {
      scriptId,
      onDone: () => {
        input.releaseAll();
        this.scene.resume();
        this.state = 'roam';
        this.moveLockedUntil = this.time.now + 300;
        // Quests resolve once the conversation actually closes, so the
        // reward toast isn't hidden behind the dialogue box.
        const completed = questId ? completeQuest(questId) : null;
        if (completed) {
          this.questMarkers.get(questId!)?.destroy();
          this.questMarkers.delete(questId!);
          showQuestToast(this, completed);
        }
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

    if (hasFlag('ch3_complete')) {
      const px = 27, py = 7;
      this.add.image(px * GAME.tile, py * GAME.tile, 'aether')
        .setOrigin(0, 0).setTint(0xaa44ff).setDepth(1);
      this.add.text(px * GAME.tile + GAME.tile / 2, py * GAME.tile - 6, 'Crystal Depths',
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#c78aff' })).setOrigin(0.5, 1).setDepth(5);
      this.ch4PortalPos = { x: px, y: py };
    }

    // Point toward whichever descent still holds the active main quest.
    const mainPortal = dTiles.length > 0 ? { x: dTiles[Math.floor(dTiles.length / 2)].c, y: dTiles[Math.floor(dTiles.length / 2)].r } : null;
    const crystalPos = { x: 11, y: 8 };
    const nextObjective = !hasFlag('ch1_complete') ? mainPortal
      : !hasFlag('ch2_complete') ? this.ch2PortalPos
      : !hasFlag('ch3_complete') ? this.ch3PortalPos
      : !hasFlag('ch4_complete') ? this.ch4PortalPos
      : getSave().ngPlus === 0 ? crystalPos
      : null;
    if (nextObjective) {
      this.addBounceMarker(nextObjective.x * GAME.tile + GAME.tile / 2, nextObjective.y * GAME.tile - 12, '▼', '#6cf0c2');
    }
  }

  /** A small bouncing glyph (pixel coords, center-origin) used for quest/objective markers. */
  private addBounceMarker(x: number, y: number, glyph: string, color: string): Phaser.GameObjects.Text {
    const marker = this.add.text(x, y, glyph, sharpText({ fontFamily: FONT, fontSize: '11px', color })).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: marker, y: y - 4, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return marker;
  }

  private ch2PortalPos: { x: number; y: number } | null = null;
  private ch3PortalPos: { x: number; y: number } | null = null;
  private ch4PortalPos: { x: number; y: number } | null = null;

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

  private descendToChapter4() {
    this.state = 'busy';
    getRun().depth = 7;
    this.cameras.main.fadeOut(250, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Descent'));
  }

  // --- Merchant shop --------------------------------------------------------

  private buildShopOptions() {
    const inv = getRun().inventory;
    this.buys = [
      {
        kind: 'blessing',
        label: () => 'Crystal Blessing',
        price: () => hpBlessingCost(),
        enabled: () => getRun().gold >= hpBlessingCost(),
        action: () => { buyHpBlessing(); },
      },
      ...(['potion', 'tonic'] as const).map((id) => ({
        id, kind: 'buyItem' as const,
        label: () => ITEMS[id].name,
        price: () => ITEMS[id].buyPrice ?? 0,
        enabled: () => getRun().gold >= (ITEMS[id].buyPrice ?? 0),
        action: () => { buyItem(id); },
      })),
      // Stronger consumables unlock as chapters are cleared.
      ...SHOP_ITEMS.filter((it) => hasFlag(it.flag)).map((it) => ({
        id: it.id, kind: 'buyItem' as const,
        label: () => ITEMS[it.id].name,
        price: () => ITEMS[it.id].buyPrice ?? 0,
        enabled: () => getRun().gold >= (ITEMS[it.id].buyPrice ?? 0),
        action: () => { buyItem(it.id); },
      })),
      // Gear stock grows as chapters are cleared; owned pieces leave the list.
      ...SHOP_GEAR
        .filter((g) => hasFlag(g.flag) && !ownedEquipment().some((e) => e.id === g.id))
        .map((g) => ({
          id: g.id, kind: 'buyGear' as const,
          label: () => EQUIPMENT[g.id].name,
          price: () => equipmentPrice(g.id) ?? 0,
          enabled: () => getRun().gold >= (equipmentPrice(g.id) ?? 0),
          action: () => { buyEquipment(g.id); },
        })),
    ];

    const sells: ShopOption[] = [];
    // Convenience: dump all resale-only junk in one go.
    const junk = Object.entries(inv).filter(([id, n]) => n > 0 && ITEMS[id]?.kind === 'sell');
    if (junk.length > 0) {
      const total = junk.reduce((s, [id, n]) => s + (ITEMS[id].sellPrice ?? 0) * n, 0);
      sells.push({
        kind: 'sellAll',
        label: () => 'Sell all junk',
        price: () => total,
        enabled: () => true,
        action: () => { for (const [id, n] of junk) for (let k = 0; k < n; k++) sellItem(id); },
      });
    }
    for (const [id, count] of Object.entries(inv).filter(([, n]) => n > 0)) {
      const item = ITEMS[id];
      if (!item) continue;
      sells.push({
        id, kind: 'sellItem',
        label: () => `${item.name} x${count}`,
        price: () => item.sellPrice ?? 0,
        enabled: () => (getRun().inventory[id] ?? 0) > 0,
        action: () => { sellItem(id); },
      });
    }
    for (const eq of ownedEquipment().filter((e) => canSellEquipment(e.id))) {
      sells.push({
        id: eq.id, kind: 'sellGear',
        label: () => EQUIPMENT[eq.id].name,
        price: () => Math.floor((equipmentPrice(eq.id) ?? 40) * 0.5),
        enabled: () => canSellEquipment(eq.id),
        action: () => { sellEquipment(eq.id); },
      });
    }
    this.sells = sells;
  }

  private openShop() {
    this.state = 'shop';
    this.buildShopOptions();
    this.shopColumn = 'buy';
    this.shopSel = { buy: 0, sell: 0 };
    this.shopScroll = { buy: 0, sell: 0 };
    this.renderShop();
  }

  /** Rebuild stock after a purchase without throwing away the cursor position. */
  private refreshShop() {
    this.buildShopOptions();
    if (this.activeList().length === 0) this.shopColumn = this.buys.length ? 'buy' : 'sell';
    const list = this.activeList();
    this.shopSel[this.shopColumn] = Phaser.Math.Clamp(this.shopSel[this.shopColumn], 0, Math.max(0, list.length - 1));
    this.clampScroll();
    this.renderShop();
  }

  private renderShop() {
    this.shopBox?.destroy();
    const box = this.add.container(0, 0).setDepth(40);
    box.add(this.add.rectangle(20, 22, 600, 316, 0x0d1024, 0.98).setOrigin(0, 0).setStrokeStyle(1, COLORS.wall));
    box.add(this.add.text(34, 30, 'MERCHANT', sharpText({ fontFamily: FONT, fontSize: '13px', color: '#f0d36c' })));
    box.add(this.add.text(150, 34, `Gold: ${getRun().gold}`, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5' })));

    this.renderShopColumn(box, 'buy', 32);
    this.renderShopColumn(box, 'sell', 320);

    this.renderShopDetail(box, this.activeList()[this.shopSel[this.shopColumn]]);
    box.add(this.add.text(34, 322, '←→ column  ·  ↑↓ item  ·  Z buy/sell  ·  Esc close',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8' })));
    this.shopBox = box;
  }

  private renderShopColumn(box: Phaser.GameObjects.Container, col: 'buy' | 'sell', x: number) {
    const list = col === 'buy' ? this.buys : this.sells;
    const active = this.shopColumn === col;
    const sel = this.shopSel[col];
    const scroll = this.shopScroll[col];
    box.add(this.add.text(x, 52, col === 'buy' ? 'BUY' : 'SELL',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: active ? '#a58cff' : '#5a6080' })));
    if (list.length === 0) {
      box.add(this.add.text(x, 70, col === 'buy' ? '(nothing)' : 'Nothing to sell',
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#5a6080', strokeThickness: 2 })));
      return;
    }
    const top = 68;
    list.slice(scroll, scroll + SHOP_ROWS).forEach((o, vi) => {
      const idx = scroll + vi;
      const y = top + vi * 21;
      const selected = active && idx === sel;
      const afford = o.enabled();
      if (selected) box.add(this.add.rectangle(x - 2, y - 2, 282, 21, 0x263054, 1).setOrigin(0, 0).setStrokeStyle(1, 0x6cf0c2));
      if (o.id && this.textures.exists(`icon_${o.id}`)) {
        box.add(this.add.image(x + 1, y + 1, `icon_${o.id}`).setDisplaySize(16, 16).setOrigin(0, 0));
      }
      box.add(this.add.text(x + 20, y, o.label(),
        sharpText({ fontFamily: FONT, fontSize: '8px', color: !afford ? '#5a6080' : selected ? '#f0d36c' : '#c9cee8', strokeThickness: 2 })));
      const badge = this.shopRowBadge(o);
      if (badge) box.add(this.add.text(x + 20, y + 10, badge,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })));
      const price = col === 'buy' ? `${o.price()}g` : `+${o.price()}g`;
      box.add(this.add.text(x + 278, y + 1, price,
        sharpText({ fontFamily: FONT, fontSize: '8px', color: col === 'buy' ? (afford ? '#f0d36c' : '#5a6080') : '#7df0a0', strokeThickness: 2 })).setOrigin(1, 0));
    });
    if (scroll > 0) box.add(this.add.text(x + 278, 60, `▲${scroll}`,
      sharpText({ fontFamily: FONT, fontSize: '7px', color: '#6cf0c2' })).setOrigin(1, 0));
    const below = list.length - scroll - SHOP_ROWS;
    if (below > 0) box.add(this.add.text(x + 278, top + SHOP_ROWS * 21 - 6, `▼${below}`,
      sharpText({ fontFamily: FONT, fontSize: '7px', color: '#6cf0c2' })).setOrigin(1, 0));
  }

  /** Second-line hint on a row: slot+users for gear, a short blurb for items. */
  private shopRowBadge(o: ShopOption): string {
    if (o.kind === 'buyGear' || o.kind === 'sellGear') {
      const eq = o.id ? EQUIPMENT[o.id] : undefined;
      return eq ? `${SLOT_BADGE[eq.slot]} · ${eq.users.map((u) => USER_NAME[u] ?? u).join('/')}` : '';
    }
    if (o.kind === 'buyItem' || o.kind === 'sellItem') {
      const d = o.id ? ITEMS[o.id]?.description ?? '' : '';
      return d.length > 30 ? d.slice(0, 29) + '…' : d;
    }
    if (o.kind === 'blessing') return '+8 max HP · whole party';
    if (o.kind === 'sellAll') return 'clears resale loot from your bag';
    return '';
  }

  /** Full-width panel describing the highlighted option, with a gear compare. */
  private renderShopDetail(box: Phaser.GameObjects.Container, o?: ShopOption) {
    const py = 250;
    box.add(this.add.rectangle(32, py, 576, 62, 0x101d3f, 0.9).setOrigin(0, 0).setStrokeStyle(1, 0x5067b0, 0.5));
    if (!o) return;
    if (o.id && this.textures.exists(`icon_${o.id}`)) {
      box.add(this.add.image(40, py + 8, `icon_${o.id}`).setDisplaySize(24, 24).setOrigin(0, 0));
    }
    const tx = o.id ? 72 : 42;
    const head = (t: string) => box.add(this.add.text(tx, py + 6, t, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#f0d36c', strokeThickness: 2 })));
    if (o.kind === 'buyGear' || o.kind === 'sellGear') {
      const eq = EQUIPMENT[o.id!];
      head(`${eq.name}  ·  ${SLOT_BADGE[eq.slot]}  ·  ${eq.trait}`);
      const stats = Object.entries(eq.bonus).filter(([, v]) => v).map(([k, v]) => `+${v} ${statAbbr(k)}`).join('   ');
      const fx = equipmentEffectText(eq);
      box.add(this.add.text(tx, py + 20, `${stats}${fx.length ? '    ✦ ' + fx.join(' · ') : ''}`,
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#7df0c8', strokeThickness: 2, wordWrap: { width: 500 } })));
      const compare = eq.users.map((u) => {
        const cur = equippedFor(u === 'bram' ? 'mira' : u)[eq.slot];
        return `${USER_NAME[u] ?? u}: ${cur ? EQUIPMENT[cur]?.name ?? cur : '—'}`;
      }).join('    ');
      box.add(this.add.text(tx, py + 34, `Now equipped — ${compare}`,
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#9aa4c8', strokeThickness: 2, wordWrap: { width: 500 } })));
      box.add(this.add.text(tx, py + 48, eq.description ?? '',
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2, wordWrap: { width: 510 } })));
    } else if (o.kind === 'buyItem' || o.kind === 'sellItem') {
      const item = ITEMS[o.id!];
      head(item.name);
      box.add(this.add.text(tx, py + 22, item.description ?? '',
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, wordWrap: { width: 500 } })));
      box.add(this.add.text(tx, py + 42, o.kind === 'buyItem'
        ? `Buy ${item.buyPrice ?? 0}g   ·   sells back for ${item.sellPrice ?? 0}g`
        : `Sells for ${item.sellPrice ?? 0}g each`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })));
    } else if (o.kind === 'blessing') {
      head('Crystal Blessing');
      box.add(this.add.text(42, py + 22, 'Permanent +8 max HP for the whole party. Stacks with every purchase, and heals everyone to full when bought.',
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, wordWrap: { width: 540 } })));
      box.add(this.add.text(42, py + 44, `Cost rises each time — next: ${hpBlessingCost()}g`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })));
    } else if (o.kind === 'sellAll') {
      head('Sell all junk');
      box.add(this.add.text(42, py + 22, 'Sells every resale-only loot item in your bag at once. Usable items and gear are kept.',
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, wordWrap: { width: 540 } })));
      box.add(this.add.text(42, py + 44, `Total: +${o.price()}g`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#7df0a0', strokeThickness: 2 })));
    }
  }

  private closeShop() {
    this.shopBox?.destroy();
    this.shopBox = undefined;
    this.state = 'roam';
    this.moveLockedUntil = this.time.now + 150;
  }
}
