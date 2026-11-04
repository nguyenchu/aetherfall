import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { input, isTouchDevice } from '../game/input';
import { sfx } from '../audio/music';
import { sharpText, FONT } from '../ui/text';
import { ITEMS } from '../game/content';
import { EQUIPMENT } from '../game/equipment';
import {
  getRun,
  buyItem,
  sellItem,
  buyEquipment,
  sellEquipment,
  ownedEquipment,
  canSellEquipment,
  equipmentPrice,
  saveProgress,
  hasFlag,
} from '../game/run';
import { rollBoonChoices } from '../game/boons';
import { chapterOfDepth } from '../game/analytics';

interface ShopData {
  onDone: (summaryLines?: string[]) => void;
}

interface ShopEntry {
  id?: string;
  kind: 'item' | 'gear' | 'boon' | 'sellItem' | 'sellGear' | 'sellAll';
  name: string;
  desc: string;
  price: number;
  enabled: boolean;
  action: () => void;
}

const DUNGEON_ITEMS = [
  { id: 'potion', flag: '' },
  { id: 'tonic', flag: '' },
  { id: 'aether_bomb', flag: '' },
  { id: 'frost_vial', flag: '' },
  { id: 'hi_potion', flag: 'ch1_complete' },
  { id: 'hi_tonic', flag: 'ch1_complete' },
];

const DUNGEON_GEAR = [
  { id: 'tide_ring', ch: 1 },
  { id: 'reef_mail', ch: 1 },
  { id: 'aether_bands', ch: 1 },
  { id: 'aether_loop', ch: 2 },
  { id: 'pyretic_ring', ch: 2 },
  { id: 'emberweave_robe', ch: 3 },
  { id: 'cinder_band', ch: 3 },
  { id: 'crystalline_brooch', ch: 3 },
  { id: 'gale_greaves', ch: 4 },
  { id: 'prism_band', ch: 4 },
  { id: 'winter_staff', ch: 5 },
  { id: 'dawnstar', ch: 5 },
];

export class DungeonShopScene extends Phaser.Scene {
  private onDone?: (summaryLines?: string[]) => void;
  private tab: 'buy' | 'sell' = 'buy';
  private buyList: ShopEntry[] = [];
  private sellList: ShopEntry[] = [];
  private selectedIndex = 0;
  private unsubs: (() => void)[] = [];
  private container?: Phaser.GameObjects.Container;
  private goldText!: Phaser.GameObjects.Text;

  constructor() {
    super('DungeonShop');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    const data = this.scene.settings.data as ShopData;
    this.onDone = data.onDone;
    this.unsubs = [];
    input.releaseAll();

    // Dark backdrop
    this.add.rectangle(0, 0, GAME.width, GAME.height, 0x05040c, 0.92).setOrigin(0, 0);

    // Header bar
    this.add.rectangle(20, 16, GAME.width - 40, 42, 0x0d1024, 0.98)
      .setOrigin(0, 0).setStrokeStyle(1, 0xd8b040, 0.8);

    if (this.textures.exists('portrait_merchant')) {
      this.add.image(42, 37, 'portrait_merchant').setDisplaySize(32, 32);
    } else if (this.textures.exists('e_merchant')) {
      this.add.image(42, 37, 'e_merchant').setDisplaySize(28, 28);
    }

    this.add.text(68, 24, 'DUNGEON MERCHANT', sharpText({
      fontFamily: FONT, fontSize: '13px', color: '#ffe066', strokeThickness: 2,
    }));
    this.add.text(68, 38, '"Deep under stone, my rates are still honest. Make your trade."', sharpText({
      fontFamily: FONT, fontSize: '7px', color: '#8a93b8',
    }));

    this.goldText = this.add.text(GAME.width - 40, 37, `Gold: ${getRun().gold}`, sharpText({
      fontFamily: FONT, fontSize: '11px', color: '#f0d36c',
    })).setOrigin(1, 0.5);

    // Close button (touch-friendly)
    const closeBtn = this.add.rectangle(GAME.width - 90, GAME.height - 24, 120, 26, 0x1a213d, 0.95)
      .setStrokeStyle(1, 0x6cf0c2, 0.8).setInteractive({ useHandCursor: true });
    this.add.text(GAME.width - 90, GAME.height - 24, isTouchDevice() ? 'LEAVE SHOP' : 'LEAVE (X / Esc)', sharpText({
      fontFamily: FONT, fontSize: '9px', color: '#6cf0c2',
    })).setOrigin(0.5);
    closeBtn.on('pointerdown', () => this.closeShop());

    // Navigation hints
    if (!isTouchDevice()) {
      this.add.text(32, GAME.height - 24, '< > Tab   ^ v Select   Z Confirm   X Leave', sharpText({
        fontFamily: FONT, fontSize: '8px', color: '#7a85ad',
      })).setOrigin(0, 0.5);
    }

    // Input listeners
    this.unsubs.push(input.on('left', () => this.switchTab('buy')));
    this.unsubs.push(input.on('right', () => this.switchTab('sell')));
    this.unsubs.push(input.on('up', () => this.moveSelection(-1)));
    this.unsubs.push(input.on('down', () => this.moveSelection(1)));
    this.unsubs.push(input.on('confirm', () => this.activateSelected()));
    this.unsubs.push(input.on('cancel', () => this.closeShop()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));

    this.refreshShop();
  }

  private switchTab(tab: 'buy' | 'sell') {
    if (this.tab === tab) return;
    this.tab = tab;
    this.selectedIndex = 0;
    sfx.play('cursor');
    this.refreshShop();
  }

  private moveSelection(dir: number) {
    const list = this.currentList();
    if (list.length === 0) return;
    this.selectedIndex = (this.selectedIndex + dir + list.length) % list.length;
    sfx.play('cursor');
    this.renderList();
  }

  private currentList(): ShopEntry[] {
    return this.tab === 'buy' ? this.buyList : this.sellList;
  }

  private refreshShop() {
    this.buildInventory();
    this.goldText.setText(`Gold: ${getRun().gold}`);
    const list = this.currentList();
    if (this.selectedIndex >= list.length) this.selectedIndex = Math.max(0, list.length - 1);
    this.renderList();
  }

  private buildInventory() {
    const run = getRun();
    const ch = chapterOfDepth(run.depth);
    const ownedGearIds = ownedEquipment().map((e) => e.id);

    // Build BUY list
    const buys: ShopEntry[] = [];

    // 1. Crystal Blessing (Boon)
    const boonCost = 60;
    buys.push({
      kind: 'boon',
      name: 'Crystal Blessing (Boon)',
      desc: 'Purchase an immediate run-wide blessing choice for your descent.',
      price: boonCost,
      enabled: run.gold >= boonCost,
      action: () => {
        run.gold -= boonCost;
        saveProgress();
        sfx.play('shop');
        this.openBoonPick();
      },
    });

    // 2. Consumables
    for (const itemDef of DUNGEON_ITEMS) {
      if (itemDef.flag && !hasFlag(itemDef.flag)) continue;
      const item = ITEMS[itemDef.id];
      if (!item) continue;
      const price = item.buyPrice ?? 20;
      buys.push({
        id: item.id,
        kind: 'item',
        name: item.name,
        desc: item.description ?? '',
        price,
        enabled: run.gold >= price,
        action: () => {
          if (buyItem(item.id)) {
            sfx.play('shop');
            this.refreshShop();
          }
        },
      });
    }

    // 3. Chapter equipment
    for (const gearDef of DUNGEON_GEAR) {
      if (gearDef.ch > ch + 1) continue;
      if (ownedGearIds.includes(gearDef.id)) continue;
      const eq = EQUIPMENT[gearDef.id];
      if (!eq) continue;
      const price = equipmentPrice(gearDef.id) ?? 120;
      buys.push({
        id: eq.id,
        kind: 'gear',
        name: eq.name,
        desc: `${eq.trait} — ${eq.description}`,
        price,
        enabled: run.gold >= price,
        action: () => {
          if (buyEquipment(eq.id)) {
            sfx.play('shop');
            this.refreshShop();
          }
        },
      });
    }
    this.buyList = buys;

    // Build SELL list
    const sells: ShopEntry[] = [];
    const inv = run.inventory;

    // Bulk sell resale junk
    const junk = Object.entries(inv).filter(([id, n]) => n > 0 && ITEMS[id]?.kind === 'sell');
    if (junk.length > 0) {
      const total = junk.reduce((s, [id, n]) => s + (ITEMS[id]?.sellPrice ?? 0) * n, 0);
      sells.push({
        kind: 'sellAll',
        name: 'Sell all resale loot',
        desc: `Unload monster pelts, pearls, and shards (${junk.map(([id, n]) => `${ITEMS[id]?.name ?? id} x${n}`).join(', ')})`,
        price: total,
        enabled: true,
        action: () => {
          for (const [id, n] of junk) {
            for (let i = 0; i < n; i++) sellItem(id);
          }
          sfx.play('shop');
          this.refreshShop();
        },
      });
    }

    // Individual items
    for (const [id, count] of Object.entries(inv).filter(([, n]) => n > 0)) {
      const item = ITEMS[id];
      if (!item) continue;
      const price = (item.sellPrice ?? 5) * count;
      sells.push({
        id,
        kind: 'sellItem',
        name: `${item.name} x${count}`,
        desc: `Sell entire stack for ${price} gold.`,
        price,
        enabled: true,
        action: () => {
          for (let i = 0; i < count; i++) sellItem(id);
          sfx.play('shop');
          this.refreshShop();
        },
      });
    }

    // Spare gear
    for (const eq of ownedEquipment().filter((e) => canSellEquipment(e.id))) {
      const price = Math.floor((equipmentPrice(eq.id) ?? 40) * 0.5);
      sells.push({
        id: eq.id,
        kind: 'sellGear',
        name: eq.name,
        desc: `${eq.trait} — Sell back for ${price} gold.`,
        price,
        enabled: true,
        action: () => {
          sellEquipment(eq.id);
          sfx.play('shop');
          this.refreshShop();
        },
      });
    }

    this.sellList = sells;
  }

  private renderList() {
    this.container?.destroy();
    const box = this.add.container(0, 0);
    this.container = box;

    // Tab buttons
    const tabY = 66;
    const isBuy = this.tab === 'buy';
    const buyTab = this.add.rectangle(80, tabY, 110, 24, isBuy ? 0x223055 : 0x0e1324, 0.95)
      .setStrokeStyle(1.5, isBuy ? 0xffe066 : 0x3d496e).setInteractive({ useHandCursor: true });
    this.add.text(80, tabY, 'BUY GOODS', sharpText({
      fontFamily: FONT, fontSize: '9px', color: isBuy ? '#ffe066' : '#7a85ad', strokeThickness: 2,
    })).setOrigin(0.5);
    buyTab.on('pointerdown', () => this.switchTab('buy'));

    const isSell = this.tab === 'sell';
    const sellTab = this.add.rectangle(200, tabY, 110, 24, isSell ? 0x223055 : 0x0e1324, 0.95)
      .setStrokeStyle(1.5, isSell ? 0x6cf0c2 : 0x3d496e).setInteractive({ useHandCursor: true });
    this.add.text(200, tabY, 'SELL LOOT', sharpText({
      fontFamily: FONT, fontSize: '9px', color: isSell ? '#6cf0c2' : '#7a85ad', strokeThickness: 2,
    })).setOrigin(0.5);
    sellTab.on('pointerdown', () => this.switchTab('sell'));

    box.add([buyTab, sellTab]);

    const list = this.currentList();
    const startY = 88;
    const rowH = 34;
    const maxVisible = 6;
    const scroll = Math.max(0, Math.min(this.selectedIndex - Math.floor(maxVisible / 2), list.length - maxVisible));

    if (list.length === 0) {
      box.add(this.add.text(GAME.width / 2, 160, this.tab === 'buy' ? 'No stock available.' : 'Nothing to sell.', sharpText({
        fontFamily: FONT, fontSize: '11px', color: '#687294', align: 'center',
      })).setOrigin(0.5));
      return;
    }

    for (let i = 0; i < maxVisible; i++) {
      const idx = scroll + i;
      if (idx >= list.length) break;
      const entry = list[idx];
      const y = startY + i * rowH;
      const isSelected = idx === this.selectedIndex;

      const bg = this.add.rectangle(20, y, GAME.width - 40, rowH - 4, isSelected ? 0x1f294d : 0x0e1324, 0.95)
        .setOrigin(0, 0)
        .setStrokeStyle(1, isSelected ? (isBuy ? 0xffe066 : 0x6cf0c2) : 0x2a3352, isSelected ? 1 : 0.6)
        .setInteractive({ useHandCursor: entry.enabled });

      bg.on('pointerdown', () => {
        this.selectedIndex = idx;
        this.renderList();
        this.activateSelected();
      });

      const titleColor = !entry.enabled ? '#586078' : isSelected ? '#ffffff' : '#cdd3ec';
      const nameText = this.add.text(32, y + 4, entry.name, sharpText({
        fontFamily: FONT, fontSize: '9px', color: titleColor, strokeThickness: 2,
      }));

      const descText = this.add.text(32, y + 17, entry.desc, sharpText({
        fontFamily: FONT, fontSize: '7px', color: entry.enabled ? '#8893b8' : '#4d546a',
      }));

      const priceLabel = isBuy ? `${entry.price}g` : `+${entry.price}g`;
      const priceColor = !entry.enabled ? '#6e5842' : isBuy ? '#f0d36c' : '#6cf0c2';
      const priceText = this.add.text(GAME.width - 32, y + 10, priceLabel, sharpText({
        fontFamily: FONT, fontSize: '9px', color: priceColor,
      })).setOrigin(1, 0);

      box.add([bg, nameText, descText, priceText]);
    }
  }

  private activateSelected() {
    const list = this.currentList();
    const entry = list[this.selectedIndex];
    if (!entry || !entry.enabled) {
      sfx.play('cancel');
      return;
    }
    entry.action();
  }

  private openBoonPick() {
    const choices = rollBoonChoices(getRun().boons, false);
    if (choices.length === 0) return;
    this.scene.pause();
    this.scene.launch('BoonPick', {
      choices,
      elite: false,
      onDone: () => {
        this.scene.resume();
        this.refreshShop();
      },
    });
  }

  private closeShop() {
    sfx.play('cancel');
    this.scene.stop();
    this.onDone?.();
  }
}
