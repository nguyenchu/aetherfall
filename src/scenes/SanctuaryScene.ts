import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { ITEMS } from '../game/content';
import { EQUIPMENT, equipmentEffectText } from '../game/equipment';
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

/** Compact stat + effect hint for shop rows, e.g. "+5 INT +6 MP · Attacks strike as HOLY". */
function gearHint(id: string): string {
  const item = EQUIPMENT[id];
  if (!item) return '';
  const stats = Object.entries(item.bonus)
    .filter(([, v]) => v)
    .map(([k, v]) => `+${v} ${k.replace('max', '').toUpperCase()}`)
    .join(' ');
  const effect = equipmentEffectText(item)[0];
  return effect ? `${stats} · ${effect}` : stats;
}

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
  /** Shows a bouncing "!" above the figure while true — an unclaimed quest. */
  questActive?: boolean;
  /** Quest resolved by talking to this NPC while questActive is true. */
  questId?: string;
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
      questActive: isQuestActive('speak_eda'), questId: 'speak_eda',
    },
    L: {
      spriteKey: 'c_lyra', scale: 1, name: 'Scholar Voss', kind: 'dialogue',
      scriptId: ch4Done ? 'npc_scholar_after4' : ch3Done ? 'npc_scholar_after3' : ch2Done ? 'npc_scholar_after2' : ch1Done ? 'npc_scholar_after' : 'npc_scholar',
      questActive: isQuestActive('learn_of_anchors'), questId: 'learn_of_anchors',
    },
    C: {
      spriteKey: 'player', scale: 0.8, name: 'Child', kind: 'dialogue',
      scriptId: ch4Done ? 'npc_child_after4' : ch3Done ? 'npc_child_after3' : ch1Done ? 'npc_child_after1' : 'npc_child',
      questActive: ch1Done && isQuestActive('find_pip'), questId: 'find_pip',
    },
    V: { spriteKey: 'c_kael', scale: 1, name: 'Merchant', kind: 'vendor' },
    // The Stranger appears after Ch1 in the northwest corner
    ...(ch1Done ? {
      T: {
        spriteKey: 'c_kael', scale: 0.9, name: '???', kind: 'dialogue' as const,
        scriptId: ch4Done ? 'npc_stranger_after4' : ch3Done ? 'npc_stranger_after3' : ch2Done ? 'npc_stranger_after2' : 'npc_stranger',
        questActive: isQuestActive('heed_the_stranger'), questId: 'heed_the_stranger',
      },
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
  private shopOptions: { label: () => string; action: () => boolean; enabled: () => boolean; column: 'buy' | 'sell' }[] = [];
  private hintText?: Phaser.GameObjects.Text;
  private questMarkers = new Map<string, Phaser.GameObjects.Text>();

  constructor() {
    super('Sanctuary');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(300, 7, 6, 14);
    this.state = 'roam';
    this.unsubs = [];
    this.npcAt.clear();
    this.questMarkers.clear();
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
        if (npc) {
          this.npcAt.set(`${c},${r}`, npc);
          this.add.ellipse(x + GAME.tile / 2, y + GAME.tile / 2 + 7, 14, 5, 0x000000, 0.34).setDepth(3);
          this.add.image(x + GAME.tile / 2, y + GAME.tile / 2, npc.spriteKey).setScale(npc.scale).setDepth(4);
          this.add.text(x + GAME.tile / 2, y + GAME.tile + 1, npc.name, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#dfe4f5' })).setOrigin(0.5, 0).setDepth(4);
          if (npc.questActive && npc.questId) {
            this.questMarkers.set(npc.questId, this.addBounceMarker(x + GAME.tile / 2, y - 4, '!', '#f0d36c'));
          }
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
    } else if (this.state === 'roam' && this.time.now >= this.moveLockedUntil) {
      const action = this.getNearbyAction();
      if (!action) return;
      this.moveLockedUntil = this.time.now + 220;
      input.releaseAll();
      action.run();
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
    if (this.ch4PortalPos && nx === this.ch4PortalPos.x && ny === this.ch4PortalPos.y) {
      this.descendToChapter4();
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

      const npc = this.npcAt.get(`${nx},${ny}`);
      if (npc) {
        return {
          label: `Z / tap  ·  ${npc.kind === 'vendor' ? 'shop' : 'talk'}`,
          run: () => this.interact(npc),
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

  private interact(npc: Npc) {
    if (npc.kind === 'vendor') this.openShop();
    else if (npc.scriptId) this.openDialogue(npc.scriptId, npc.questActive ? npc.questId : undefined);
  }

  // --- Dialog ---------------------------------------------------------------

  private openDialogue(scriptId: string, questId?: string) {
    this.state = 'busy';
    input.releaseAll();
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
    const nextObjective = !hasFlag('ch1_complete') ? mainPortal
      : !hasFlag('ch2_complete') ? this.ch2PortalPos
      : !hasFlag('ch3_complete') ? this.ch3PortalPos
      : !hasFlag('ch4_complete') ? this.ch4PortalPos
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

  private openShop() {
    this.state = 'shop';
    this.shopIndex = 0;
    const inv = getRun().inventory;
    this.shopOptions = [
      {
        label: () => `Crystal Blessing (+8 max HP)   ${hpBlessingCost()}g`,
        enabled: () => getRun().gold >= hpBlessingCost(),
        action: () => buyHpBlessing(),
        column: 'buy' as const,
      },
      {
        label: () => `Elixir (+30 HP)   ${ITEMS.potion.buyPrice}g`,
        enabled: () => getRun().gold >= (ITEMS.potion.buyPrice ?? 0),
        action: () => buyItem('potion'),
        column: 'buy' as const,
      },
      {
        label: () => `Aether Tonic (+12 MP)   ${ITEMS.tonic.buyPrice}g`,
        enabled: () => getRun().gold >= (ITEMS.tonic.buyPrice ?? 0),
        action: () => buyItem('tonic'),
        column: 'buy' as const,
      },
      // Stronger consumables unlock as chapters are cleared.
      ...SHOP_ITEMS
        .filter((it) => hasFlag(it.flag))
        .map((it) => ({
          label: () => `${ITEMS[it.id].name} (${it.hint})   ${ITEMS[it.id].buyPrice}g`,
          enabled: () => getRun().gold >= (ITEMS[it.id].buyPrice ?? 0),
          action: () => buyItem(it.id),
          column: 'buy' as const,
        })),
      // Gear stock grows as chapters are cleared; owned pieces leave the list.
      ...SHOP_GEAR
        .filter((g) => hasFlag(g.flag) && !ownedEquipment().some((e) => e.id === g.id))
        .map((g) => ({
          label: () => `${EQUIPMENT[g.id].name}  ${gearHint(g.id)}  ${equipmentPrice(g.id)}g`,
          enabled: () => getRun().gold >= (equipmentPrice(g.id) ?? 0),
          action: () => { buyEquipment(g.id); return true; },
          column: 'buy' as const,
        })),
    ];
    for (const [id, count] of Object.entries(inv).filter(([, n]) => n > 0)) {
      const item = ITEMS[id];
      if (!item) continue;
      this.shopOptions.push({
        label: () => `${item.name} x${count}   +${item.sellPrice}g`,
        enabled: () => (getRun().inventory[id] ?? 0) > 0,
        action: () => sellItem(id),
        column: 'sell',
      });
    }
    for (const eq of ownedEquipment().filter((e) => canSellEquipment(e.id))) {
      this.shopOptions.push({
        label: () => `${EQUIPMENT[eq.id].name}   +${Math.floor((equipmentPrice(eq.id) ?? 40) * 0.5)}g`,
        enabled: () => canSellEquipment(eq.id),
        action: () => sellEquipment(eq.id),
        column: 'sell',
      });
    }
    this.renderShop();
  }

  private renderShop() {
    this.shopBox?.destroy();
    const box = this.add.container(0, 0).setDepth(40);
    box.add(this.add.rectangle(30, 52, 560, 240, 0x0d1024, 0.98).setOrigin(0, 0).setStrokeStyle(1, COLORS.wall));
    box.add(this.add.text(44, 62, 'MERCHANT', sharpText({ fontFamily: FONT, fontSize: '13px', color: '#f0d36c' })));
    box.add(this.add.text(160, 66, `Gold: ${getRun().gold}`, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5' })));

    const buys = this.shopOptions.filter((o) => o.column === 'buy');
    const sells = this.shopOptions.filter((o) => o.column === 'sell');
    box.add(this.add.text(44, 88, 'BUY', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff' })));
    box.add(this.add.text(330, 88, 'SELL', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff' })));

    this.shopOptions.forEach((o, i) => {
      const inBuy = o.column === 'buy';
      const colIndex = inBuy ? buys.indexOf(o) : sells.indexOf(o);
      const x = inBuy ? 44 : 330;
      const y = 102 + colIndex * 15;
      const color = !o.enabled() ? '#5a6080' : i === this.shopIndex ? '#f0d36c' : '#c9cee8';
      const prefix = i === this.shopIndex ? '> ' : '  ';
      box.add(this.add.text(x, y, prefix + o.label(), sharpText({ fontFamily: FONT, fontSize: '8px', color, strokeThickness: 2 })));
    });
    box.add(this.add.text(44, 276, 'Space/Enter choose  |  Esc close', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8' })));
    this.shopBox = box;
  }

  private closeShop() {
    this.shopBox?.destroy();
    this.shopBox = undefined;
    this.state = 'roam';
    this.moveLockedUntil = this.time.now + 150;
  }
}
