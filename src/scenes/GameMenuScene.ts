import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { music, sfx } from '../audio/music';
import { BOONS } from '../game/boons';
import { ITEMS, SPELLS } from '../game/content';
import { EQUIPMENT, equipmentEffectText, type EquipSlot } from '../game/equipment';
import { castPartyHealOutOfBattle, castSpellOutOfBattle, effectiveSpellCost, equipItem, equippedByOther, equippedFor, equipmentPreviewStats, getRun, hardReset, ownedEquipment, questList, returnToTown, rewardTextForQuest, useItemOn } from '../game/run';
import { input, attachTouchControls } from '../game/input';
import { xpForLevel } from '../game/progression';
import { loadSaveSummary } from '../game/save';
import { sharpText, FONT } from '../ui/text';
import type { Combatant, Stats } from '../game/types';

interface MenuData {
  caller: string;
}

type MenuTab = 'stats' | 'items' | 'magic' | 'equip' | 'quests' | 'system';
const TABS: MenuTab[] = ['stats', 'items', 'magic', 'equip', 'quests', 'system'];
type MenuFocus = 'command' | 'content';
type EquipColumn = 'slot' | 'items';
type EquipSelectableKind = 'member' | 'slot' | 'item';

interface Selectable {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  action: () => void;
  tab?: MenuTab;
  chosen?: boolean;
  disabled?: boolean;
  baseFill?: number;
  onFocus?: () => void;
  equipKind?: EquipSelectableKind;
  equipSlot?: EquipSlot;
  equipItemId?: string | null;
  /** Inventory id this row/target belongs to (items tab), for scroll nav. */
  itemId?: string;
}

export class GameMenuScene extends Phaser.Scene {
  private caller = 'Sanctuary';
  private content?: Phaser.GameObjects.Container;
  private tab: MenuTab = 'stats';
  private focus: MenuFocus = 'command';
  private selectables: Selectable[] = [];
  private selected = 0;
  private goldText?: Phaser.GameObjects.Text;
  private tabButtons = new Map<MenuTab, Selectable>();
  private memberIndex = 0;
  private equipSlot: EquipSlot = 'weapon';
  private equipColumn: EquipColumn = 'slot';
  private equipScroll = 0;
  /** Full ordered id list for the active slot (null = the "(Nothing)" entry). */
  private equipChoiceIds: Array<string | null> = [];
  private equipLastItemBySlot: Partial<Record<EquipSlot, string | null>> = {};
  /** undefined = no preview (show equipped); null = previewing "None". */
  private equipPreviewItemId?: string | null;
  private resetArmed = false;
  private magicSpellId?: string;
  private itemsScroll = 0;
  /** Item drilled into for target-selection; undefined = showing the list. */
  private itemSelId?: string;
  /** Full sorted id list of held items — the logical list scroll nav walks. */
  private itemRowIds: string[] = [];
  private menuNotice = '';
  private selectionAnchor?: { x: number; y: number };
  private unsubs: (() => void)[] = [];

  constructor() {
    super('GameMenu');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    const data = this.scene.settings.data as MenuData;
    this.caller = data.caller;
    this.unsubs = [];
    this.focus = 'command';
    this.tabButtons.clear();
    input.releaseAll();

    this.add.rectangle(0, 0, GAME.width, GAME.height, 0x030815, 1).setOrigin(0, 0).setDepth(0);
    this.menuWindow(16, 14, 464, 320);
    this.menuWindow(492, 14, 132, 226);
    this.menuWindow(492, 250, 132, 84);
    this.add.text(34, 30, 'AETHERFALL', sharpText({ fontFamily: FONT, fontSize: '15px', color: '#f0d36c' })).setDepth(2);
    this.add.text(506, 30, 'COMMAND', sharpText({ fontFamily: FONT, fontSize: '9px', color: '#a58cff' })).setDepth(2);
    const run = getRun();
    this.goldText = this.add.text(506, 268, `Gold\n${run.gold}`, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c', lineSpacing: 10 })).setDepth(2);

    TABS.forEach((tab, i) => {
      const tabButton = this.button(506, 52 + i * 28, 104, title(tab), () => {
        this.setTab(tab);
      }, undefined, '9px');
      tabButton.tab = tab;
      this.tabButtons.set(tab, tabButton);
    });
    this.renderContent();
    this.bindMenuInput();
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if ((this.tab === 'equip' || this.tab === 'items') && this.focus === 'content' && dy !== 0) this.moveSelection(dy > 0 ? 1 : -1);
    });
    attachTouchControls(this, 'bottom', 'menu');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
    this.updateSelection();
  }

  private menuWindow(x: number, y: number, w: number, h: number) {
    this.add.rectangle(x, y, w, h, 0x07153a, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xdfe4f5, 0.86)
      .setDepth(1);
    this.add.rectangle(x + 3, y + 3, w - 6, h - 6, 0x17306b, 0.28)
      .setOrigin(0, 0)
      .setDepth(1);
  }

  private renderContent() {
    const activeSelection = this.selectables[this.selected];
    if (!this.selectionAnchor && activeSelection?.rect.active) {
      this.selectionAnchor = this.centerOf(activeSelection);
    }
    this.content?.destroy();
    this.cleanSelectables();
    const run = getRun();
    if (this.goldText) {
      this.goldText.setText(`Gold\n${run.gold}`);
    }
    const box = this.add.container(0, 0).setDepth(2);
    this.content = box;
    box.add(this.add.text(34, 54, title(this.tab), sharpText({ fontFamily: FONT, fontSize: '13px', color: '#a58cff' })));
    if (this.menuNotice) {
      box.add(this.add.text(188, 56, this.menuNotice, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#f0d36c', strokeThickness: 2, wordWrap: { width: 280 } })));
    }
    if (this.tab === 'stats') this.renderStats(box);
    else if (this.tab === 'items') this.renderItems(box);
    else if (this.tab === 'magic') this.renderMagic(box);
    else if (this.tab === 'equip') this.renderEquip(box);
    else if (this.tab === 'system') this.renderSystem(box);
    else this.renderQuests(box);
    this.syncSelectionToFocus();
    this.selectionAnchor = undefined;
    this.updateSelection();
  }

  private renderStats(box: Phaser.GameObjects.Container) {
    const member = this.selectedMember();
    this.renderPartyPortraits(box, 78, (i) => {
      this.memberIndex = i;
      this.menuNotice = '';
      this.renderContent();
    });

    const panel = this.add.rectangle(42, 170, 414, 116, 0x101d3f, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x5067b0, 0.72);
    box.add(panel);
    box.add(this.add.rectangle(258, 180, 1, 96, 0x5067b0, 0.4).setOrigin(0, 0));

    // Left column: identity, vitals with bars, attributes, magic.
    box.add(this.add.text(58, 178, `${member.name}  Lv ${member.level ?? 1}  ${this.roleFor(member.id)}`,
      sharpText({ fontFamily: FONT, fontSize: '11px', color: '#f0d36c', strokeThickness: 2 })));
    const level = member.level ?? 1;
    const xp = member.xp ?? 0;
    const xpNeed = xpForLevel(level);
    this.vitalBar(box, 58, 198, 'HP', member.stats.hp, member.stats.maxHp, 0x6cf0c2);
    this.vitalBar(box, 58, 214, 'MP', member.stats.mp, member.stats.maxMp, 0x8a6cf0);
    this.vitalBar(box, 58, 230, 'XP', xp, xpNeed, 0xf0d36c, `${xpNeed - xp} XP to Lv ${level + 1}`);
    box.add(this.add.text(58, 248, `STR ${member.stats.str}   VIT ${member.stats.vit}   AGI ${member.stats.agi}   INT ${member.stats.int}`,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 2 })));
    box.add(this.add.text(58, 266, this.spellLine(member),
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2, wordWrap: { width: 192 } })));

    // Right column: derived combat values with plain-language captions.
    box.add(this.add.text(268, 178, 'COMBAT', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2 })));
    this.derivedStats(member).forEach((entry, i) => {
      const x = 268 + (i % 2) * 94;
      const y = 192 + Math.floor(i / 2) * 30;
      box.add(this.add.text(x, y, `${entry.label} ${entry.value}`,
        sharpText({ fontFamily: FONT, fontSize: '9px', color: '#a8d8ff', strokeThickness: 2 })));
      box.add(this.add.text(x, y + 11, entry.hint,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#7a84a8', strokeThickness: 2 })));
    });

    // Equipment strip: one cell per slot with icon, caption and bonus.
    const eq = equippedFor(member.id);
    (['weapon', 'armor', 'charm'] as EquipSlot[]).forEach((slot, i) => {
      const x = 42 + i * 138;
      box.add(this.add.rectangle(x, 290, 134, 28, 0x101d3f, 0.92)
        .setOrigin(0, 0).setStrokeStyle(1, 0x5067b0, 0.5));
      const id = eq[slot];
      this.addIcon(box, id, x + 4, 293, 22);
      box.add(this.add.text(x + 32, 293, slot.toUpperCase(),
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })));
      if (id) {
        const compact = this.shortBonus(id).replace(/\+(\d+) /g, '+$1');
        box.add(this.add.text(x + 72, 293, compact,
          sharpText({ fontFamily: FONT, fontSize: '7px', color: '#f0d36c', strokeThickness: 2 })));
      }
      box.add(this.add.text(x + 32, 303, id ? EQUIPMENT[id]?.name ?? id : '—',
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#dfe4f5', strokeThickness: 2 })));
    });

    // Run boons as chips.
    const boons = getRun().boons.map((id) => BOONS[id]?.name).filter((n) => n != null);
    if (boons.length === 0) {
      box.add(this.add.text(42, 323, 'Run boons: none yet — win battles to earn blessings.',
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })));
    } else {
      box.add(this.add.text(42, 323, 'BOONS', sharpText({ fontFamily: FONT, fontSize: '7px', color: '#a58cff', strokeThickness: 2 })));
      let cx = 80;
      for (let i = 0; i < boons.length; i++) {
        const name = boons[i]!;
        const w = 10 + name.length * 4;
        if (cx + w > 430) {
          box.add(this.add.text(cx, 323, `+${boons.length - i} more`,
            sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })));
          break;
        }
        box.add(this.add.rectangle(cx, 320, w, 13, 0x2a263a, 1).setOrigin(0, 0).setStrokeStyle(1, 0x8a6cf0, 0.6));
        box.add(this.add.text(cx + 5, 323, name, sharpText({ fontFamily: FONT, fontSize: '7px', color: '#b8a8f8', strokeThickness: 2 })));
        cx += w + 5;
      }
    }
  }

  /** Small labeled bar: caption + numbers above a filled gauge. */
  private vitalBar(
    box: Phaser.GameObjects.Container,
    x: number, y: number, label: string,
    cur: number, max: number, color: number, note?: string,
  ) {
    box.add(this.add.text(x, y, label, sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })));
    box.add(this.add.text(x + 22, y - 1, note ?? `${cur}/${max}`,
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#dfe4f5', strokeThickness: 2 })));
    const barW = 184;
    box.add(this.add.rectangle(x, y + 10, barW, 4, 0x0a1128, 1).setOrigin(0, 0).setStrokeStyle(1, 0x2f3658, 1));
    const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    if (pct > 0) {
      box.add(this.add.rectangle(x + 1, y + 11, Math.max(1, Math.round((barW - 2) * pct)), 2, color, 1).setOrigin(0, 0));
    }
  }

  /** Battle-formula values with plain-language captions. Mirrors battle.ts. */
  private derivedStats(member: Combatant): Array<{ label: string; value: string; hint: string }> {
    const s = member.stats;
    return [
      { label: 'ATTACK', value: `${Math.round(s.str * 1.6)}`, hint: 'physical damage' },
      { label: 'MAGIC', value: `${Math.round(s.int * 0.8)}`, hint: 'spell damage' },
      { label: 'GUARD', value: `${Math.round(s.vit * 0.6)}`, hint: 'damage reduction' },
      { label: 'RESIST', value: `${Math.round(s.int * 0.2)}`, hint: 'spell defense' },
      { label: 'HEALING', value: `${Math.round(s.int * 0.5)}`, hint: 'healing power' },
      { label: 'SPEED', value: `${s.agi}+d3`, hint: 'turn order' },
    ];
  }

  // Items mirror the equip tab's drill-down: a compact, scrollable list of
  // everything held (Z opens it), then a target screen to pick who uses it.
  // One screen at a time keeps every item reachable no matter how full the bag.
  private renderItems(box: Phaser.GameObjects.Container) {
    const run = getRun();
    const held = Object.entries(run.inventory).filter(([, n]) => n > 0) as Array<[string, number]>;
    if (held.length === 0) {
      this.itemRowIds = [];
      this.itemSelId = undefined;
      box.add(this.add.text(46, 112, 'No items.', sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5' })));
      return;
    }
    if (this.itemSelId && (run.inventory[this.itemSelId] ?? 0) > 0 && fieldUsable(this.itemSelId)) {
      this.renderItemUse(box, this.itemSelId);
    } else {
      this.itemSelId = undefined;
      this.renderItemList(box, held);
    }
  }

  /** Scrollable list: usable items first, then cure, then sellable junk last. */
  private renderItemList(box: Phaser.GameObjects.Container, held: Array<[string, number]>) {
    const rank = (id: string) => (fieldUsable(id) ? 0 : ITEMS[id]?.kind === 'cure' ? 1 : 2);
    const sorted = held.slice().sort((a, b) => rank(a[0]) - rank(b[0]));
    this.itemRowIds = sorted.map(([id]) => id);
    this.itemsScroll = Phaser.Math.Clamp(this.itemsScroll, 0, Math.max(0, sorted.length - ITEMS_LIST_ROWS));

    box.add(this.add.text(456, 78, 'Z: use  ·  ↑↓: item', sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })).setOrigin(1, 0));

    const listTop = 96;
    sorted.slice(this.itemsScroll, this.itemsScroll + ITEMS_LIST_ROWS).forEach(([id, count], vi) => {
      const item = ITEMS[id];
      const y = listTop + vi * 34;
      const rect = this.add.rectangle(42, y, 414, 30, 0x141a30, 0.96)
        .setOrigin(0, 0).setStrokeStyle(1, COLORS.wall).setDepth(2)
        .setInteractive({ useHandCursor: true });
      box.add(rect);
      this.addIcon(box, id, 46, y + 4, 22);
      const label = this.add.text(76, y + 4, `${item?.name ?? id}  x${count}`,
        sharpText({ fontFamily: FONT, fontSize: '9px', color: '#f0d36c', strokeThickness: 2 })).setDepth(3);
      box.add(this.add.text(76, y + 16, item?.description ?? '',
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#9aa4c8', strokeThickness: 2, wordWrap: { width: 300 } })).setDepth(3));
      box.add(this.add.text(452, y + 6, itemTag(id),
        sharpText({ fontFamily: FONT, fontSize: '7px', color: fieldUsable(id) ? '#6cf0c2' : '#8a93b8', strokeThickness: 2 })).setOrigin(1, 0).setDepth(3));
      const selectable: Selectable = { rect, label, itemId: id, action: () => this.openItem(id) };
      this.selectables.push(selectable);
      rect.on('pointerdown', () => {
        sfx.play('confirm');
        this.selected = this.selectables.indexOf(selectable);
        this.focus = 'content';
        this.updateSelection();
        selectable.action();
      });
      box.add(label);
    });

    if (this.itemsScroll > 0) {
      box.add(this.add.text(474, listTop + 4, `▲${this.itemsScroll}`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#6cf0c2', strokeThickness: 2 })).setOrigin(1, 0));
    }
    const hiddenBelow = sorted.length - this.itemsScroll - ITEMS_LIST_ROWS;
    if (hiddenBelow > 0) {
      box.add(this.add.text(474, listTop + (ITEMS_LIST_ROWS - 1) * 34 + 4, `▼${hiddenBelow}`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#6cf0c2', strokeThickness: 2 })).setOrigin(1, 0));
    }
  }

  /** Target screen for a usable item: one row per party member. */
  private renderItemUse(box: Phaser.GameObjects.Container, id: string) {
    const run = getRun();
    const item = ITEMS[id]!;
    box.add(this.add.text(46, 74, '‹ ITEMS', sharpText({ fontFamily: FONT, fontSize: '11px', color: '#f0d36c', strokeThickness: 2 })));
    box.add(this.add.text(150, 78, `${item.name}  x${run.inventory[id] ?? 0}`,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#a58cff', strokeThickness: 2 })));
    box.add(this.add.text(456, 78, 'Z: use  ·  X: back', sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })).setOrigin(1, 0));

    this.addIcon(box, id, 46, 98, 26);
    box.add(this.add.text(80, 100, item.description ?? '',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, wordWrap: { width: 360 } })));
    box.add(this.add.text(46, 132, 'USE ON', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2 })));

    run.party.forEach((member, i) => {
      const y = 150 + i * 40;
      const v = this.itemVital(id, member);
      const rect = this.add.rectangle(42, y, 414, 34, 0x141a30, 0.96)
        .setOrigin(0, 0).setStrokeStyle(1, COLORS.wall).setDepth(2)
        .setInteractive({ useHandCursor: true });
      box.add(rect);
      const label = this.add.text(56, y + 5, member.name,
        sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5', strokeThickness: 2 })).setDepth(3);
      box.add(this.add.text(56, y + 18, v.text,
        sharpText({ fontFamily: FONT, fontSize: '8px', color: v.color, strokeThickness: 2 })).setDepth(3));
      box.add(this.add.text(452, y + 11, v.can ? 'USE ›' : v.note,
        sharpText({ fontFamily: FONT, fontSize: '8px', color: v.can ? '#6cf0c2' : '#8a93b8', strokeThickness: 2 })).setOrigin(1, 0).setDepth(3));
      const selectable: Selectable = { rect, label, itemId: id, action: () => this.useItemOnMember(id, member.id, v.can) };
      this.selectables.push(selectable);
      rect.on('pointerdown', () => {
        sfx.play('confirm');
        this.selected = this.selectables.indexOf(selectable);
        this.focus = 'content';
        this.updateSelection();
        selectable.action();
      });
      box.add(label);
    });
  }

  /** Which vital a usable item touches for a member, and whether it applies now. */
  private itemVital(id: string, member: Combatant): { text: string; color: string; can: boolean; note: string } {
    const s = member.stats;
    const kind = ITEMS[id]?.kind;
    if (kind === 'revive') {
      return { text: `HP ${s.hp}/${s.maxHp}`, color: s.hp <= 0 ? '#7df0a0' : '#8a93b8', can: s.hp <= 0, note: 'OK' };
    }
    if (kind === 'mp') {
      return { text: `MP ${s.mp}/${s.maxMp}`, color: '#8a6cf0', can: s.hp > 0 && s.mp < s.maxMp, note: s.hp <= 0 ? 'KO' : 'full' };
    }
    return { text: `HP ${s.hp}/${s.maxHp}`, color: '#6cf0c2', can: s.hp > 0 && s.hp < s.maxHp, note: s.hp <= 0 ? 'KO' : 'full' };
  }

  /** Z on a list row: usable items drill into the target screen; others explain. */
  private openItem(id: string) {
    const item = ITEMS[id];
    if (!item) return;
    if (!fieldUsable(id)) {
      this.menuNotice = item.kind === 'sell'
        ? `Sell ${item.name} at the Sanctuary merchant (${item.sellPrice ?? 0}g).`
        : item.kind === 'cure'
        ? `${item.name} — use it in battle to cure ailments.`
        : item.kind === 'damage'
        ? `${item.name} — a thrown weapon. Use it in battle against an enemy.`
        : `${item.name} — use it in battle.`;
      this.selectionAnchor = this.centerOf(this.selectables[this.selected]);
      this.renderContent();
      return;
    }
    this.itemSelId = id;
    this.selectionAnchor = undefined;
    this.renderContent();
    const target = this.contentSelectables()[0];
    if (target) {
      this.selected = this.selectables.indexOf(target);
      this.focus = 'content';
      this.updateSelection();
    }
  }

  private useItemOnMember(id: string, memberId: string, can: boolean) {
    const run = getRun();
    const member = run.party.find((m) => m.id === memberId);
    const item = ITEMS[id];
    if (!member || !item) return;
    if (!can || !useItemOn(id, memberId)) {
      this.menuNotice = `${member.name} can't use ${item.name} right now.`;
    } else {
      this.menuNotice = item.kind === 'revive'
        ? `${member.name} returns to the fight.`
        : `${member.name} uses ${item.name}.`;
    }
    // Out of that item now -> drop back to the list.
    if ((run.inventory[id] ?? 0) <= 0) this.itemSelId = undefined;
    this.selectionAnchor = this.centerOf(this.selectables[this.selected]);
    this.renderContent();
  }

  /** Vertical nav for the items list: walks the full id list, scrolling the
   * window when the next row is hidden (mirrors the equip item list). Returns
   * false in the target screen so spatial nav handles the member rows. */
  private moveItemsVertical(dir: number): boolean {
    if (this.itemSelId) return false;
    const cur = this.selectables[this.selected];
    if (cur?.itemId == null) return false;
    const idx = this.itemRowIds.indexOf(cur.itemId);
    if (idx < 0) return false;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= this.itemRowIds.length) return true; // clamp at ends
    const nextId = this.itemRowIds[nextIdx];
    if (nextIdx < this.itemsScroll || nextIdx >= this.itemsScroll + ITEMS_LIST_ROWS) {
      this.itemsScroll = dir > 0 ? nextIdx - ITEMS_LIST_ROWS + 1 : nextIdx;
      this.renderContent();
    }
    const target = this.contentSelectables().find((s) => s.itemId === nextId);
    if (target) this.selectSelectable(target, false);
    return true;
  }

  private renderMagic(box: Phaser.GameObjects.Container) {
    const run = getRun();
    const member = this.selectedMember();
    this.renderPartyPortraits(box, 78, (i) => {
      this.memberIndex = i;
      this.magicSpellId = undefined;
      this.menuNotice = '';
      this.renderContent();
    });

    const spells = member.spells.map((id) => SPELLS[id]).filter((s) => s != null);
    // Only healing spells work outside battle — everything else is grouped
    // into a compact "battle-only" line below instead of cluttering the
    // castable list with rows the player can never actually use here.
    const castable = spells.filter((s) => s.kind === 'heal');
    const battleOnly = spells.filter((s) => s.kind !== 'heal');
    // Don't default to the first castable spell — the target portraits stay
    // hidden until the player actually focuses or picks one, instead of
    // showing up immediately whenever this tab has a healer selected.
    if (this.magicSpellId && !castable.some((s) => s.id === this.magicSpellId)) {
      this.magicSpellId = undefined;
    }
    const selectedSpell = this.magicSpellId ? SPELLS[this.magicSpellId] : undefined;

    box.add(this.add.text(46, 168, `${member.name}   MP ${member.stats.mp}/${member.stats.maxMp}`,
      sharpText({ fontFamily: FONT, fontSize: '11px', color: '#f0d36c', strokeThickness: 2 })));

    if (spells.length === 0) {
      const level = member.level ?? 1;
      const upcoming = Object.keys(member.learnset ?? {}).map(Number).filter((lv) => lv > level).sort((a, b) => a - b)[0];
      box.add(this.add.text(46, 190,
        upcoming != null ? `Learns ${SPELLS[member.learnset![upcoming][0]]?.name} at Lv ${upcoming}.` : 'No spells to learn.',
        sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 2 })));
      return;
    }

    let y = 186;
    if (castable.length === 0) {
      box.add(this.add.text(46, y, `${member.name} has no magic that works outside battle.`,
        sharpText({ fontFamily: FONT, fontSize: '9px', color: '#8a93b8', strokeThickness: 2, wordWrap: { width: 400 } })));
      y += 20;
    } else {
      box.add(this.add.text(46, y, 'CASTABLE HERE', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2 })));
      y += 14;
      castable.forEach((spell) => {
        const rowY = y;
        const cost = effectiveSpellCost(spell.id);
        const afford = member.stats.mp >= cost;
        const subColor = afford ? '#7df0a0' : '#ff8a8a';
        if (spell.target === 'ally') {
          const b = this.button(46, rowY, 156, `${spell.name}  ${cost}MP`, () => {
            this.magicSpellId = spell.id;
            this.menuNotice = 'Choose a target portrait.';
            this.renderContent();
          }, box, '8px');
          b.chosen = spell.id === this.magicSpellId;
          b.onFocus = () => {
            if (this.magicSpellId === spell.id) return;
            this.magicSpellId = spell.id;
            this.menuNotice = 'Choose a target portrait.';
            this.renderContent();
          };
          box.add(this.add.text(46, rowY + 22, afford ? `Heals ${this.spellHealAmount(member, spell)} HP` : `Needs ${cost} MP`,
            sharpText({ fontFamily: FONT, fontSize: '7px', color: subColor, strokeThickness: 2 })));
        } else {
          this.button(46, rowY, 156, `${spell.name}  ${cost}MP`, () => this.castFieldPartyHeal(member, spell.id), box, '8px');
          box.add(this.add.text(46, rowY + 22, afford ? `Heals the whole party ~${this.spellHealAmount(member, spell)} HP each` : `Needs ${cost} MP`,
            sharpText({ fontFamily: FONT, fontSize: '7px', color: subColor, strokeThickness: 2, wordWrap: { width: 220 } })));
        }
        y += 32;
      });
    }

    if (battleOnly.length > 0) {
      y += 6;
      box.add(this.add.text(46, y, 'BATTLE-ONLY', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#5a6080', strokeThickness: 2 })));
      y += 12;
      // Wrapping row of spell names, each colored by its element (mirrors
      // BattleScene's element badges) so the list still reads at a glance
      // even though none of these can be cast from here.
      let x = 46;
      const rowStart = x;
      const maxX = 446;
      battleOnly.forEach((spell, i) => {
        const label = i < battleOnly.length - 1 ? `${spell.name}, ` : spell.name;
        const t = this.add.text(x, y, label, sharpText({
          fontFamily: FONT, fontSize: '8px', color: ELEMENT_COLOR[spell.element] ?? '#5a6080', strokeThickness: 2,
        }));
        box.add(t);
        x += t.width;
        if (x > maxX) { x = rowStart; y += 12; t.setPosition(x, y); x += t.width; }
      });
    }

    if (!selectedSpell) return;
    box.add(this.add.text(294, 184, 'TARGET', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2 })));
    run.party.forEach((target, i) => {
      this.portraitButton(box, target, 286, 200 + i * 42, 156, 36, false, () => {
        this.castFieldMagic(member, selectedSpell.id, target);
      }, 'compact');
    });
  }

  /** Actual field-heal amount for display: mirrors castSpellOutOfBattle's formula. */
  private spellHealAmount(caster: Combatant, spell: { power: number }): number {
    return Math.round(spell.power + caster.stats.int * 0.5 + (caster.gear?.healBonus ?? 0));
  }

  private castFieldPartyHeal(caster: Combatant, spellId: string) {
    const spell = SPELLS[spellId];
    const cost = effectiveSpellCost(spellId);
    if (!spell) return;
    if (caster.stats.mp < cost) {
      this.menuNotice = `${caster.name} needs ${cost} MP.`;
    } else {
      const result = castPartyHealOutOfBattle(caster.id, spellId);
      this.menuNotice = result
        ? `${caster.name} casts ${spell.name}. Party +${result.healed} HP total.`
        : 'The whole party is already at full HP.';
    }
    this.renderContent();
  }

  // Equip is a two-step flow: pick a slot (equipColumn === 'slot'), then the
  // item list for that slot takes the full width (equipColumn === 'items').
  // One thing on screen at a time keeps it readable; Z drills in, X steps out.
  private renderEquip(box: Phaser.GameObjects.Container) {
    const member = this.selectedMember();
    if (this.equipColumn === 'items') this.renderEquipItems(box, member);
    else this.renderEquipSlots(box, member);
  }

  /** Step 1: portraits + the member's loadout, one row per slot. */
  private renderEquipSlots(box: Phaser.GameObjects.Container, member: Combatant) {
    const eq = equippedFor(member.id);
    const portraits = this.renderPartyPortraits(box, 78, (i) => {
      this.memberIndex = i;
      this.equipPreviewItemId = undefined;
      this.equipLastItemBySlot = {};
      this.equipColumn = 'slot';
      this.equipScroll = 0;
      this.menuNotice = '';
      this.renderContent();
    });
    portraits.forEach((portrait) => { portrait.equipKind = 'member'; });

    box.add(this.add.text(46, 168, 'CHOOSE A SLOT TO CHANGE', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2 })));
    box.add(this.add.text(456, 168, 'Z: open list  ·  ↑↓: slot  ·  ←→: character', sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })).setOrigin(1, 0));

    (['weapon', 'armor', 'charm'] as EquipSlot[]).forEach((slot, i) => {
      const y = 182 + i * 30;
      const id = eq[slot];
      const name = id ? EQUIPMENT[id]?.name ?? id : '—';
      const color = SLOT_COLOR[slot];
      const rect = this.add.rectangle(42, y, 414, 28, color.fill, 0.96)
        .setOrigin(0, 0).setStrokeStyle(1, color.stroke).setDepth(2)
        .setInteractive({ useHandCursor: true });
      box.add(rect); // added first: children render in container order
      this.addIcon(box, id, 46, y + 3, 22);
      box.add(this.add.text(76, y + 4, slot.toUpperCase(),
        sharpText({ fontFamily: FONT, fontSize: '7px', color: color.text, strokeThickness: 2 })).setDepth(3));
      const label = this.add.text(76, y + 13, name,
        sharpText({ fontFamily: FONT, fontSize: '9px', color: id ? '#dfe4f5' : '#8a93b8', strokeThickness: 2 })).setDepth(3);
      if (id) {
        const hasEffects = EQUIPMENT[id]?.effects != null;
        box.add(this.add.text(250, y + 9, this.shortBonus(id) + (hasEffects ? ' ✦' : ''),
          sharpText({ fontFamily: FONT, fontSize: '7px', color: hasEffects ? '#7df0c8' : '#f0d36c', strokeThickness: 2 })).setDepth(3));
      }
      box.add(this.add.text(452, y + 8, '›', sharpText({ fontFamily: FONT, fontSize: '11px', color: '#f0d36c', strokeThickness: 2 })).setOrigin(1, 0).setDepth(3));
      const selectable: Selectable = {
        rect, label,
        action: () => this.focusEquipColumn('items', slot),
        chosen: slot === this.equipSlot,
        baseFill: color.fill,
        equipKind: 'slot',
        equipSlot: slot,
        onFocus: () => {
          if (this.equipSlot !== slot || this.equipColumn !== 'slot') this.setEquipSlot(slot, 'slot');
        },
      };
      this.selectables.push(selectable);
      rect.on('pointerdown', () => {
        sfx.play('confirm');
        this.selected = this.selectables.indexOf(selectable);
        this.focus = 'content';
        this.updateSelection();
        selectable.action();
      });
      box.add(label);
    });

    // Bottom: detail of the highlighted slot's equipped item (so you know what
    // you'd be replacing before opening the list).
    const cur = eq[this.equipSlot];
    const curItem = cur ? EQUIPMENT[cur] : undefined;
    box.add(this.add.rectangle(42, 278, 414, 48, 0x101d3f, 0.92)
      .setOrigin(0, 0).setStrokeStyle(1, 0x5067b0, 0.5).setDepth(2));
    this.addIcon(box, cur, 46, 282, 20);
    box.add(this.add.text(72, 282, curItem ? `EQUIPPED: ${curItem.name} — ${curItem.trait}` : `${this.equipSlot.toUpperCase()}: nothing equipped`,
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#f0d36c', strokeThickness: 2 })).setDepth(3));
    box.add(this.add.text(72, 294, curItem?.description ?? 'Open the list to equip something here.',
      sharpText({ fontFamily: FONT, fontSize: '7px', color: '#9aa4c8', strokeThickness: 2, lineSpacing: 2, wordWrap: { width: 240 } })).setDepth(3));
    const fx = curItem ? equipmentEffectText(curItem) : [];
    if (fx.length > 0) {
      box.add(this.add.text(320, 282, `✦ ${fx.join(' · ')}`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#7df0c8', strokeThickness: 2, wordWrap: { width: 130 } })).setDepth(3));
    }
  }

  /** Step 2: full-width list of everything the member can put in the active slot. */
  private renderEquipItems(box: Phaser.GameObjects.Container, member: Combatant) {
    const current = equippedFor(member.id)[this.equipSlot];

    // Breadcrumb replaces the portrait row — the list gets the vertical space.
    box.add(this.add.text(46, 74, `‹ ${this.equipSlot.toUpperCase()}`,
      sharpText({ fontFamily: FONT, fontSize: '11px', color: '#f0d36c', strokeThickness: 2 })));
    box.add(this.add.text(150, 78, member.name,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#a58cff', strokeThickness: 2 })));
    box.add(this.add.text(456, 78, '↑↓: preview  ·  Z: equip  ·  X: back', sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })).setOrigin(1, 0));

    const choices = ownedEquipment().filter((item) => item.slot === this.equipSlot && item.users.includes(member.id)
      && (item.id === current || !equippedByOther(item.id, member.id)));
    const allChoices: Array<{ id?: string; name: string }> = [
      { id: undefined, name: '(Nothing)' },
      ...choices.map((item) => ({ id: item.id, name: item.name })),
    ];
    this.equipChoiceIds = allChoices.map((c) => c.id ?? null);
    // Keep the previewed (or equipped) entry inside the visible window.
    const focusId = this.equipPreviewItemId === undefined ? (current ?? null) : this.equipPreviewItemId;
    const focusIdx = Math.max(0, allChoices.findIndex((c) => (c.id ?? null) === focusId));
    this.equipScroll = Phaser.Math.Clamp(this.equipScroll, 0, Math.max(0, allChoices.length - EQUIP_LIST_ROWS));
    if (focusIdx < this.equipScroll) this.equipScroll = focusIdx;
    else if (focusIdx >= this.equipScroll + EQUIP_LIST_ROWS) this.equipScroll = focusIdx - EQUIP_LIST_ROWS + 1;

    const listTop = 98;
    allChoices.slice(this.equipScroll, this.equipScroll + EQUIP_LIST_ROWS).forEach((item, vi) => {
      const y = listTop + vi * 28;
      const equipped = item.id === current || (!item.id && !current);
      const previewed = (this.equipPreviewItemId === undefined ? (current ?? null) : this.equipPreviewItemId) === (item.id ?? null);
      const rect = this.add.rectangle(42, y, 414, 26, previewed ? 0x1c2d4a : 0x141a30, 0.96)
        .setOrigin(0, 0).setStrokeStyle(1, COLORS.wall).setDepth(2)
        .setInteractive({ useHandCursor: true });
      box.add(rect);
      this.addIcon(box, item.id, 46, y + 3, 20);
      const label = this.add.text(74, y + 3, item.name,
        sharpText({ fontFamily: FONT, fontSize: '9px', color: equipped ? '#f0d36c' : '#dfe4f5', strokeThickness: 2 })).setDepth(3);
      box.add(this.add.text(74, y + 15, item.id ? this.shortBonus(item.id) : 'no bonus',
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#9aa4c8', strokeThickness: 2 })).setDepth(3));
      const eqItem = item.id ? EQUIPMENT[item.id] : undefined;
      const fx = eqItem ? equipmentEffectText(eqItem) : [];
      if (eqItem) {
        box.add(this.add.text(228, y + 15, `Fits: ${this.userNames(eqItem.users)}`,
          sharpText({ fontFamily: FONT, fontSize: '7px', color: '#7a84a8', strokeThickness: 2, wordWrap: { width: 168 } })).setDepth(3));
      }
      if (fx.length > 0) {
        box.add(this.add.text(228, y + 4, `✦ ${fx.join(' · ')}`,
          sharpText({ fontFamily: FONT, fontSize: '7px', color: '#7df0c8', strokeThickness: 2, lineSpacing: 1, wordWrap: { width: 190 } })).setDepth(3));
      }
      if (equipped) {
        box.add(this.add.text(452, y + 3, 'ON',
          sharpText({ fontFamily: FONT, fontSize: '7px', color: '#f0d36c', strokeThickness: 2 })).setOrigin(1, 0).setDepth(3));
      } else if (previewed) {
        box.add(this.add.text(452, y + 3, 'VIEW',
          sharpText({ fontFamily: FONT, fontSize: '7px', color: '#6cf0c2', strokeThickness: 2 })).setOrigin(1, 0).setDepth(3));
      }
      const selectable: Selectable = {
        rect, label,
        action: () => {
          this.rememberEquipPreview(item.id ?? null);
          if (equipItem(member.id, this.equipSlot, item.id)) {
            this.menuNotice = `${member.name} equips ${item.id ? EQUIPMENT[item.id]?.name : 'nothing'}.`;
          }
          this.focusEquipColumn('slot'); // done with this slot — back to the loadout
        },
        chosen: equipped,
        baseFill: previewed ? 0x1c2d4a : 0x141a30,
        equipKind: 'item',
        equipSlot: this.equipSlot,
        equipItemId: item.id ?? null,
        onFocus: () => {
          const previewValue = item.id ?? null;
          if (this.equipPreviewItemId === previewValue) return;
          this.rememberEquipPreview(previewValue);
          this.renderContent();
        },
      };
      this.selectables.push(selectable);
      rect.on('pointerdown', () => {
        sfx.play('confirm');
        this.selected = this.selectables.indexOf(selectable);
        this.focus = 'content';
        this.updateSelection();
        selectable.action();
      });
      box.add(label);
    });
    // Scroll counts live in the right gutter (x > 456) so they never collide
    // with a row's "ON" tag.
    if (this.equipScroll > 0) {
      box.add(this.add.text(474, listTop + 4, `▲${this.equipScroll}`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#6cf0c2', strokeThickness: 2 })).setOrigin(1, 0));
    }
    const hiddenBelow = allChoices.length - this.equipScroll - EQUIP_LIST_ROWS;
    if (hiddenBelow > 0) {
      box.add(this.add.text(474, listTop + (EQUIP_LIST_ROWS - 1) * 28 + 4, `▼${hiddenBelow}`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#6cf0c2', strokeThickness: 2 })).setOrigin(1, 0));
    }

    this.renderEquipCompare(box, member, current);
  }

  /** Shared bottom panel: previewed item's info + stat deltas + effects. */
  private renderEquipCompare(box: Phaser.GameObjects.Container, member: Combatant, current: string | undefined) {
    const previewId = this.equipPreviewItemId === undefined ? current : this.equipPreviewItemId ?? undefined;
    const previewItem = previewId ? EQUIPMENT[previewId] : undefined;
    const isCurrent = (previewId ?? null) === (current ?? null);
    const previewStats = equipmentPreviewStats(member.id, this.equipSlot, previewId);
    box.add(this.add.rectangle(42, 272, 414, 48, 0x101d3f, 0.92)
      .setOrigin(0, 0).setStrokeStyle(1, 0x5067b0, 0.5).setDepth(2));
    this.addIcon(box, previewId, 46, 276, 20);
    box.add(this.add.text(72, 276, `${isCurrent ? 'CURRENT' : 'PREVIEW'}: ${previewItem ? `${previewItem.name} — ${previewItem.trait}` : 'Empty slot'}`,
      sharpText({ fontFamily: FONT, fontSize: '8px', color: isCurrent ? '#f0d36c' : '#6cf0c2', strokeThickness: 2 })).setDepth(3));
    box.add(this.add.text(72, 288, previewItem?.description ?? 'No equipment in this slot.',
      sharpText({ fontFamily: FONT, fontSize: '7px', color: '#9aa4c8', strokeThickness: 2, lineSpacing: 2, wordWrap: { width: 200 } })).setDepth(3));
    if (previewItem) {
      box.add(this.add.text(72, 312, `Fits: ${this.userNames(previewItem.users)}`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#7a84a8', strokeThickness: 2 })).setDepth(3));
    }
    if (!previewStats) {
      box.add(this.add.text(288, 288, `${member.name} cannot equip this`,
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#ff8a8a', strokeThickness: 2 })).setDepth(3));
    } else {
      (['maxHp', 'maxMp', 'str', 'vit', 'agi', 'int'] as Array<keyof Stats>).forEach((stat, i) => {
        const cur = member.stats[stat];
        const next = previewStats[stat] ?? cur;
        const delta = next - cur;
        const color = delta > 0 ? '#7df0a0' : delta < 0 ? '#ff8a8a' : '#7a84a8';
        const text = delta === 0 ? `${SHORT_STAT[stat]} ${cur}` : `${SHORT_STAT[stat]} ${cur}>${next}`;
        box.add(this.add.text(288 + (i % 3) * 58, 276 + Math.floor(i / 3) * 13, text,
          sharpText({ fontFamily: FONT, fontSize: '8px', color, strokeThickness: 2 })).setDepth(3));
      });
    }
    const effects = previewItem ? equipmentEffectText(previewItem) : [];
    if (effects.length > 0) {
      box.add(this.add.text(288, 304, `✦ ${effects.join(' · ')}`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#7df0c8', strokeThickness: 2, wordWrap: { width: 168 } })).setDepth(3));
    }
  }

  private setEquipSlot(slot: EquipSlot, column: EquipColumn = this.equipColumn) {
    const slotChanged = this.equipSlot !== slot;
    const columnChanged = this.equipColumn !== column;
    this.equipSlot = slot;
    this.equipColumn = column;
    if (slotChanged) {
      this.equipScroll = 0;
      const rememberedPreview = this.equipLastItemBySlot[slot];
      this.equipPreviewItemId = rememberedPreview === undefined ? undefined : rememberedPreview;
    }
    if (slotChanged || columnChanged) this.renderContent();
  }

  /**
   * Switches equip phase (slot list <-> item list) and lands the cursor on the
   * right target. We pick the target *after* re-rendering rather than via a
   * selection anchor: the two columns sit far apart, so an anchor from the old
   * phase would snap to the nearest wrong row (e.g. a portrait).
   */
  private focusEquipColumn(column: EquipColumn, slot: EquipSlot = this.equipSlot) {
    if (this.equipSlot !== slot) {
      this.equipSlot = slot;
      this.equipScroll = 0;
      const remembered = this.equipLastItemBySlot[slot];
      this.equipPreviewItemId = remembered === undefined ? undefined : remembered;
    }
    this.equipColumn = column;
    this.selectionAnchor = undefined;
    this.renderContent();
    const options = this.contentSelectables();
    const target = column === 'items' ? this.equipItemTarget(options) : this.equipSlotTarget(options);
    if (target) {
      this.selected = this.selectables.indexOf(target);
      this.focus = 'content';
      this.updateSelection();
    }
  }

  /** Puts the cursor on the active member's portrait (up past the top of a column). */
  private focusEquipPortrait(): boolean {
    const portraits = this.contentSelectables().filter((option) => option.equipKind === 'member');
    const portrait = portraits[this.memberIndex] ?? portraits[0];
    if (portrait) this.selectSelectable(portrait, false);
    return true;
  }

  private rememberEquipPreview(itemId: string | null) {
    this.equipPreviewItemId = itemId;
    this.equipLastItemBySlot[this.equipSlot] = itemId;
  }

  private shortBonus(id?: string): string {
    if (!id) return 'no bonus';
    const item = EQUIPMENT[id];
    if (!item) return '';
    return Object.entries(item.bonus)
      .filter(([, value]) => value)
      .map(([key, value]) => `+${value} ${SHORT_STAT[key] ?? key.toUpperCase()}`)
      .join(' ');
  }

  private userNames(ids: string[]): string {
    const names: Record<string, string> = { kael: 'Kael', lyra: 'Lyra', mira: 'Mira', bram: 'Mira' };
    return ids.map((id) => names[id] ?? id).join(', ');
  }

  private renderSystem(box: Phaser.GameObjects.Container) {
    const summary = loadSaveSummary();
    box.add(this.add.text(46, 96, 'SAVE STATUS', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2 })));
    box.add(this.add.text(46, 110, summary
      ? `Auto-saved  ·  Stratum ${summary.deepest}  ·  ${summary.gold}g  ·  Gear ${summary.equipmentCount}\n${summary.partyLevels}`
      : 'No persistent save found yet. Start a new game to create one.',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, lineSpacing: 4 })));

    box.add(this.add.text(46, 148, 'CONTROLS', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2 })));
    box.add(this.add.text(46, 162, `Move WASD/arrows  ·  Z confirm  ·  X cancel  ·  C/Tab menu\nAudio ${music.isEnabled() ? 'on' : 'off'}  ·  M toggles sound`,
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8', strokeThickness: 2, lineSpacing: 4 })));

    if (this.caller === 'Descent') {
      this.button(46, 204, 200, 'Return to Town', () => this.returnHome(), box, '9px');
      box.add(this.add.text(256, 208, 'Ends this run and shows a summary.',
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8', strokeThickness: 2 })));
    }

    this.button(46, 236, 200, 'Return to Title', () => this.quitToTitle(), box, '9px');
    box.add(this.add.text(256, 240, 'Back to the title screen. Keeps your save.',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8', strokeThickness: 2 })));

    const resetLabel = this.resetArmed ? 'CONFIRM: erase everything' : 'New Game (erase save)';
    this.button(46, 268, 200, resetLabel, () => this.newGame(), box, '9px');
    box.add(this.add.text(256, 272, this.resetArmed
      ? 'Choosing again erases ALL progress!'
      : 'Deletes levels, gold, gear and story.',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: this.resetArmed ? '#ff8a8a' : '#8a93b8', strokeThickness: 2 })));
  }

  private returnHome() {
    input.releaseAll();
    this.scene.stop(this.caller);
    this.scene.start('RunSummary', { reason: 'retreat', depth: getRun().depth });
    this.scene.stop();
  }

  private quitToTitle() {
    if (this.caller === 'Descent') returnToTown(); // the Anchor draws the party home
    input.releaseAll();
    this.scene.stop(this.caller);
    this.scene.start('Title');
  }

  private newGame() {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.menuNotice = 'This erases ALL progress. Choose again to confirm.';
      this.renderContent();
      return;
    }
    hardReset();
    input.releaseAll();
    this.scene.stop(this.caller);
    this.scene.start('Title');
  }

  private renderQuests(box: Phaser.GameObjects.Container) {
    const list = questList();
    const done = list.filter((q) => q.status === 'complete');
    box.add(this.add.text(300, 56, `${done.length}/${list.length} complete`,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#8a93b8' })));

    // Active quests lead with full detail; completed ones trail as a compact,
    // dimmed log so the open checklist is never buried by finished business.
    const active = list.filter((q) => q.status !== 'complete');
    let y = 82;
    for (const q of active) {
      box.add(this.add.text(46, y, `[ ] ${q.title}`, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5' })));
      box.add(this.add.text(62, y + 11, q.text, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#9aa2c8', strokeThickness: 2, wordWrap: { width: 390 } })));
      box.add(this.add.text(62, y + 21, rewardTextForQuest(q.id), sharpText({ fontFamily: FONT, fontSize: '8px', color: '#f0d36c', strokeThickness: 2 })));
      y += 32;
    }
    if (active.length > 0 && done.length > 0) {
      box.add(this.add.text(46, y, 'COMPLETE', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#5a6080' })));
      y += 13;
    }
    for (const q of done) {
      box.add(this.add.text(46, y, `[x] ${q.title}`, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#5a6080' })));
      y += 14;
    }
  }

  private button(
    x: number,
    y: number,
    w: number,
    text: string,
    onClick: (label: Phaser.GameObjects.Text) => void,
    parent?: Phaser.GameObjects.Container,
    fontSize = '9px',
  ): Selectable {
    const rect = this.add.rectangle(x, y, w, 20, 0x141a30, 0.96).setOrigin(0, 0).setStrokeStyle(1, COLORS.wall).setDepth(2);
    const label = this.add.text(x + 6, y + 3, text, sharpText({ fontFamily: FONT, fontSize, color: '#dfe4f5', strokeThickness: 2 })).setDepth(3);
    rect.setInteractive({ useHandCursor: true });
    const selectable: Selectable = { rect, label, action: () => onClick(label) };
    this.selectables.push(selectable);
    rect.on('pointerdown', () => {
      if (selectable.disabled) return;
      sfx.play('confirm');
      this.selected = this.selectables.indexOf(selectable);
      this.focus = selectable.tab ? 'command' : 'content';
      this.updateSelection();
      selectable.action();
    });
    parent?.add([rect, label]);
    return selectable;
  }

  private addIcon(parent: Phaser.GameObjects.Container, id: string | undefined, x: number, y: number, size: number) {
    const key = `icon_${id ?? 'none'}`;
    if (!this.textures.exists(key)) return;
    const icon = this.add.image(x, y, key).setDisplaySize(size, size).setOrigin(0, 0);
    parent.add(icon);
  }

  private renderPartyPortraits(box: Phaser.GameObjects.Container, y: number, onChoose: (index: number) => void): Selectable[] {
    const run = getRun();
    this.memberIndex = Phaser.Math.Clamp(this.memberIndex, 0, run.party.length - 1);
    return run.party.map((member, i) => (
      this.portraitButton(box, member, 46 + i * 132, y, 112, 84, i === this.memberIndex, () => onChoose(i), 'large', () => {
        if (this.memberIndex === i) return;
        onChoose(i);
      })
    ));
  }

  private portraitButton(
    parent: Phaser.GameObjects.Container,
    member: Combatant,
    x: number,
    y: number,
    w: number,
    h: number,
    chosen: boolean,
    onClick: () => void,
    variant: 'large' | 'compact' = 'large',
    onFocus?: () => void,
  ): Selectable {
    const rect = this.add.rectangle(x, y, w, h, 0x101d3f, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, chosen ? 0xf0d36c : 0x5067b0, 0.72)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });
    const portraitSize = variant === 'compact' ? 30 : 58;
    const portrait = this.add.image(
      variant === 'compact' ? x + 18 : x + w / 2,
      variant === 'compact' ? y + h / 2 : y + 34,
      `portrait_${member.id}`,
    )
      .setDisplaySize(portraitSize, portraitSize)
      .setOrigin(0.5)
      .setDepth(3)
      .setInteractive({ useHandCursor: true });
    const frame = this.add.rectangle(portrait.x, portrait.y, portraitSize + 2, portraitSize + 2, 0x07060e, 0)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0xdfe4f5, 0.7)
      .setDepth(4);
    const label = this.add.text(
      variant === 'compact' ? x + 40 : x + w / 2,
      variant === 'compact' ? y + 5 : y + 66,
      member.name,
      sharpText({ fontFamily: FONT, fontSize: variant === 'compact' ? '8px' : '9px', color: chosen ? '#f0d36c' : '#dfe4f5', strokeThickness: 2 }),
    )
      .setOrigin(variant === 'compact' ? 0 : 0.5, 0)
      .setDepth(4);
    const vitals = this.add.text(
      variant === 'compact' ? x + 40 : x + w / 2,
      variant === 'compact' ? y + 19 : y + 76,
      `HP ${member.stats.hp}/${member.stats.maxHp}${member.stats.maxMp > 0 ? `  MP ${member.stats.mp}/${member.stats.maxMp}` : ''}`,
      sharpText({ fontFamily: FONT, fontSize: '7px', color: '#c9cee8', strokeThickness: 2 }),
    )
      .setOrigin(variant === 'compact' ? 0 : 0.5, 0)
      .setDepth(4);
    const selectable: Selectable = { rect, label, action: onClick, chosen, onFocus };
    this.selectables.push(selectable);
    const activate = () => {
      this.selected = this.selectables.indexOf(selectable);
      this.focus = 'content';
      this.updateSelection();
      selectable.action();
    };
    portrait.on('pointerdown', activate);
    rect.on('pointerdown', activate);
    parent.add([rect, portrait, frame, label, vitals]);
    return selectable;
  }

  private selectedMember(): Combatant {
    const run = getRun();
    this.memberIndex = Phaser.Math.Clamp(this.memberIndex, 0, run.party.length - 1);
    return run.party[this.memberIndex];
  }

  private castFieldMagic(caster: Combatant, spellId: string, target: Combatant) {
    const spell = SPELLS[spellId];
    const cost = effectiveSpellCost(spellId);
    if (!spell || spell.kind !== 'heal') {
      this.menuNotice = 'Only healing magic works outside battle.';
    } else if (caster.stats.mp < cost) {
      this.menuNotice = `${caster.name} needs ${cost} MP.`;
    } else if (target.stats.hp <= 0) {
      this.menuNotice = `${target.name} cannot be healed right now.`;
    } else if (target.stats.hp >= target.stats.maxHp) {
      this.menuNotice = `${target.name} is already at full HP.`;
    } else {
      const before = target.stats.hp;
      const ok = castSpellOutOfBattle(caster.id, spellId, target.id);
      const healed = target.stats.hp - before;
      this.menuNotice = ok ? `${caster.name} casts ${spell.name}. ${target.name} +${healed} HP.` : 'The spell fizzles.';
    }
    this.renderContent();
  }

  private changeTab(dir: number) {
    this.setTab(TABS[(TABS.indexOf(this.tab) + dir + TABS.length) % TABS.length]);
  }

  private setTab(tab: MenuTab) {
    this.tab = tab;
    this.focus = 'command';
    this.menuNotice = '';
    this.selectionAnchor = undefined;
    if (tab !== 'magic') this.magicSpellId = undefined;
    if (tab !== 'equip') {
      this.equipPreviewItemId = undefined;
      this.equipLastItemBySlot = {};
    } else {
      this.equipColumn = 'slot';
      this.equipScroll = 0;
    }
    this.itemSelId = undefined;
    if (tab === 'items') this.itemsScroll = 0;
    if (tab !== 'system') this.resetArmed = false;
    if (tab === 'magic') this.ensureMagicMember();
    this.renderContent();
  }

  private ensureMagicMember() {
    const run = getRun();
    const current = run.party[this.memberIndex];
    if (current?.spells.length) return;
    const fieldCaster = run.party.findIndex((member) => member.spells.some((id) => {
      const spell = SPELLS[id];
      return spell?.kind === 'heal' && spell.target === 'ally';
    }));
    if (fieldCaster >= 0) this.memberIndex = fieldCaster;
  }

  private moveSelection(dir: number) {
    this.cleanSelectables();
    if (this.selectables.length === 0) return;
    sfx.play('cursor');
    if (this.focus === 'command') {
      this.changeTab(dir);
      return;
    }
    if (this.tab === 'equip' && this.moveEquipVertical(dir)) return;
    if (this.tab === 'items' && this.moveItemsVertical(dir)) return;
    this.moveSpatial(0, dir);
  }

  private moveHorizontal(dir: number) {
    this.cleanSelectables();
    if (this.selectables.length === 0) return;
    sfx.play('cursor');
    if (this.focus === 'command') {
      if (dir < 0) this.enterContent();
      return;
    }
    if (this.tab === 'equip' && this.moveEquipHorizontal(dir)) return;
    const moved = this.moveSpatial(dir, 0);
    if (!moved && dir > 0) this.focusCommand();
  }

  private moveEquipVertical(dir: number): boolean {
    const current = this.selectables[this.selected];
    if (current?.equipKind !== 'slot' && current?.equipKind !== 'item') return false;

    if (current.equipKind === 'slot') {
      const peers = this.contentSelectables().filter((option) => option.equipKind === 'slot');
      const nextIndex = peers.indexOf(current) + dir;
      if (nextIndex < 0) return this.focusEquipPortrait(); // up past the top slot -> party portraits
      if (nextIndex >= peers.length) return true;
      this.equipColumn = 'slot';
      this.selectSelectable(peers[nextIndex], true);
      return true;
    }

    // Items: walk the full logical list, scrolling the window when the target is hidden.
    const ids = this.equipChoiceIds;
    const index = ids.findIndex((id) => id === (current.equipItemId ?? null));
    const nextIndex = index + dir;
    if (nextIndex < 0) { this.focusEquipColumn('slot'); return true; } // up past the top item -> back to slots
    if (nextIndex >= ids.length) return true;
    const visible = this.contentSelectables().filter((option) => option.equipKind === 'item' && option.equipSlot === this.equipSlot);
    const target = visible.find((option) => (option.equipItemId ?? null) === ids[nextIndex]);
    if (target) {
      this.selectSelectable(target, true);
      return true;
    }
    // Off-window: scroll so the target lands on the edge row the cursor is on.
    this.equipScroll = dir > 0 ? nextIndex - EQUIP_LIST_ROWS + 1 : nextIndex;
    this.selectionAnchor = this.centerOf(current);
    this.rememberEquipPreview(ids[nextIndex]);
    this.renderContent();
    return true;
  }

  private moveEquipHorizontal(dir: number): boolean {
    const current = this.selectables[this.selected];
    // Slots: left/right swaps the active party member without leaving Step 1,
    // so you can compare the same slot across the party. Z is the only way to
    // open the item list now (right used to duplicate it).
    if (current?.equipKind === 'slot') {
      this.switchEquipMember(dir);
      return true;
    }
    // Items: left steps back to the slots, right jumps to the command column.
    if (current?.equipKind === 'item') {
      if (dir < 0) this.focusEquipColumn('slot');
      else this.focusCommand();
      return true;
    }
    return false; // portraits: let spatial movement switch party members
  }

  /** Swaps the active member while staying on the same slot row (Step 1 only). */
  private switchEquipMember(dir: number) {
    const partyLen = getRun().party.length;
    if (partyLen <= 1) return;
    this.memberIndex = (this.memberIndex + dir + partyLen) % partyLen;
    this.equipPreviewItemId = undefined;
    this.equipLastItemBySlot = {};
    this.equipScroll = 0;
    this.menuNotice = '';
    this.renderContent();
    const target = this.equipSlotTarget(this.contentSelectables());
    if (target) {
      this.selected = this.selectables.indexOf(target);
      this.focus = 'content';
      this.updateSelection();
    }
  }

  private moveSpatial(dx: number, dy: number): boolean {
    const options = this.contentSelectables();
    if (options.length === 0) {
      this.focusCommand();
      return false;
    }

    const selected = this.selectables[this.selected];
    const current = options.includes(selected) ? selected : this.preferredContentTarget();
    if (!current) return false;
    if (!options.includes(selected)) {
      this.selectSelectable(current, false);
      return true;
    }

    const origin = this.centerOf(current);
    const next = options
      .filter((option) => option !== current)
      .map((option) => ({ option, score: this.directionalScore(origin, this.centerOf(option), dx, dy) }))
      .filter((candidate) => Number.isFinite(candidate.score))
      .sort((a, b) => a.score - b.score)[0]?.option;

    if (!next) return false;
    this.selectSelectable(next, true);
    return true;
  }

  private activateSelection() {
    this.cleanSelectables();
    sfx.play('confirm');
    if (this.focus === 'command') {
      this.enterContent();
      return;
    }
    const selectable = this.selectables[this.selected];
    if (!selectable?.disabled) selectable?.action();
  }

  private bindMenuInput() {
    this.unsubs.push(input.on('up', () => this.moveSelection(-1)));
    this.unsubs.push(input.on('down', () => this.moveSelection(1)));
    this.unsubs.push(input.on('left', () => this.moveHorizontal(-1)));
    this.unsubs.push(input.on('right', () => this.moveHorizontal(1)));
    this.unsubs.push(input.on('confirm', () => this.activateSelection()));
    this.unsubs.push(input.on('cancel', () => this.back()));
  }

  private enterContent() {
    const target = this.preferredContentTarget();
    if (!target) return;
    this.selectSelectable(target, false);
  }

  private back() {
    sfx.play('cancel');
    if (this.focus === 'content') {
      // Equip drills down member -> slot -> item; cancel steps back up one level.
      if (this.tab === 'equip' && this.selectables[this.selected]?.equipKind === 'item') {
        this.focusEquipColumn('slot');
        return;
      }
      // Items drills list -> target screen; cancel steps back to the list, on
      // the row we came from.
      if (this.tab === 'items' && this.itemSelId) {
        const backId = this.itemSelId;
        this.itemSelId = undefined;
        this.selectionAnchor = undefined;
        this.renderContent();
        const target = this.contentSelectables().find((s) => s.itemId === backId) ?? this.contentSelectables()[0];
        if (target) {
          this.selected = this.selectables.indexOf(target);
          this.focus = 'content';
          this.updateSelection();
        }
        return;
      }
      this.focus = 'command';
      this.syncSelectionToFocus();
      this.updateSelection();
      return;
    }
    this.close();
  }

  private contentSelectables(): Selectable[] {
    return this.selectables.filter((s) => !s.tab && s.rect.active && s.label.active);
  }

  private syncSelectionToFocus() {
    const target = this.focus === 'content'
      ? this.preferredContentTarget() ?? this.tabButtons.get(this.tab)
      : this.tabButtons.get(this.tab);
    if (!target) {
      this.selected = Phaser.Math.Clamp(this.selected, 0, Math.max(0, this.selectables.length - 1));
      return;
    }
    this.selected = Math.max(0, this.selectables.indexOf(target));
  }

  private preferredContentTarget(): Selectable | undefined {
    const options = this.contentSelectables();
    if (options.length === 0) return undefined;
    if (this.selectionAnchor) {
      return options
        .map((option) => ({ option, score: Phaser.Math.Distance.Between(this.selectionAnchor!.x, this.selectionAnchor!.y, this.centerOf(option).x, this.centerOf(option).y) }))
        .sort((a, b) => a.score - b.score)[0]?.option;
    }
    if (this.tab === 'equip') {
      const target = this.preferredEquipTarget(options);
      if (target) return target;
    }
    return options.find((s) => s.chosen) ?? options[0];
  }

  private preferredEquipTarget(options: Selectable[]): Selectable | undefined {
    if (this.equipColumn === 'items') {
      return this.equipItemTarget(options) ?? this.equipSlotTarget(options);
    }
    return this.equipSlotTarget(options) ?? this.equipItemTarget(options);
  }

  private equipSlotTarget(options: Selectable[]): Selectable | undefined {
    return options.find((option) => option.equipKind === 'slot' && option.equipSlot === this.equipSlot);
  }

  private equipItemTarget(options: Selectable[]): Selectable | undefined {
    const current = equippedFor(this.selectedMember().id)[this.equipSlot] ?? null;
    const preview = this.equipPreviewItemId === undefined ? current : this.equipPreviewItemId;
    return options.find((option) => (
      option.equipKind === 'item' &&
      option.equipSlot === this.equipSlot &&
      option.equipItemId === preview
    )) ?? options.find((option) => (
      option.equipKind === 'item' &&
      option.equipSlot === this.equipSlot &&
      option.chosen
    )) ?? options.find((option) => option.equipKind === 'item' && option.equipSlot === this.equipSlot);
  }

  private focusCommand() {
    const target = this.tabButtons.get(this.tab);
    if (target) this.selectSelectable(target, false);
  }

  private selectSelectable(target: Selectable, runFocus: boolean) {
    const index = this.selectables.indexOf(target);
    if (index < 0 || target.disabled) return;
    this.focus = target.tab ? 'command' : 'content';
    this.selected = index;
    this.updateSelection();
    if (runFocus && target.onFocus) {
      this.selectionAnchor = this.centerOf(target);
      target.onFocus();
      // If onFocus did not re-render (renderContent consumes and clears the
      // anchor), drop it here so a stale anchor can't hijack a later render.
      this.selectionAnchor = undefined;
    }
  }

  private centerOf(selectable: Selectable): { x: number; y: number } {
    const bounds = selectable.rect.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  }

  private directionalScore(from: { x: number; y: number }, to: { x: number; y: number }, dx: number, dy: number): number {
    const primary = dx !== 0 ? (to.x - from.x) * dx : (to.y - from.y) * dy;
    if (primary <= 4) return Number.POSITIVE_INFINITY;
    const perpendicular = dx !== 0 ? Math.abs(to.y - from.y) : Math.abs(to.x - from.x);
    return primary + perpendicular * 1.35;
  }

  private cleanSelectables() {
    this.selectables = this.selectables.filter((s) => s.rect.active && s.label.active);
    this.selected = Phaser.Math.Clamp(this.selected, 0, Math.max(0, this.selectables.length - 1));
  }

  private updateSelection() {
    this.cleanSelectables();
    this.selectables.forEach((s, i) => {
      const selected = i === this.selected;
      const activeTab = s.tab === this.tab;
      const chosen = s.chosen === true;
      const disabled = s.disabled === true;
      const commandFocus = this.focus === 'command' && activeTab;
      s.rect.setFillStyle(selected ? 0x263054 : activeTab || chosen ? 0x2a263a : s.baseFill ?? 0x141a30, disabled ? 0.48 : selected || activeTab || chosen ? 1 : 0.96);
      s.rect.setStrokeStyle(selected || activeTab || chosen ? 2 : 1, disabled ? 0x50607a : commandFocus ? 0x6cf0c2 : selected ? 0x6cf0c2 : activeTab || chosen ? 0xf0d36c : COLORS.wall);
      s.label.setColor(disabled ? '#8a93b8' : commandFocus ? '#6cf0c2' : selected ? '#6cf0c2' : activeTab || chosen ? '#f0d36c' : '#dfe4f5');
    });
  }

  private roleFor(memberId: string): string {
    switch (memberId) {
      case 'kael': return 'Aetherblade';
      case 'lyra': return 'Hexweaver';
      case 'mira': return 'Dawnkeeper';
      default: return 'Hero';
    }
  }

  private spellLine(member: Combatant): string {
    const spells = member.spells.map((id) => SPELLS[id]).filter((s) => s != null);
    const label = member.id === 'kael' ? 'Aether Arts' : member.id === 'lyra' ? 'Hexes' : member.id === 'mira' ? 'Prayers' : 'Magic';
    if (spells.length > 0) {
      return `${label}  ${spells.map((s) => `${s.name} ${effectiveSpellCost(s.id)}MP`).join(' · ')}`;
    }
    const level = member.level ?? 1;
    const upcoming = Object.keys(member.learnset ?? {})
      .map(Number)
      .filter((lv) => lv > level)
      .sort((a, b) => a - b)[0];
    if (upcoming != null) {
      const firstId = member.learnset![upcoming][0];
      return `Learns ${SPELLS[firstId]?.name ?? firstId} at Lv ${upcoming}`;
    }
    return `${label}  —`;
  }

  private close() {
    input.releaseAll();
    this.scene.resume(this.caller);
    this.scene.stop();
  }
}

function title(tab: MenuTab): string {
  return tab[0].toUpperCase() + tab.slice(1);
}

const SHORT_STAT: Record<string, string> = {
  maxHp: 'HP', maxMp: 'MP', str: 'STR', vit: 'VIT', agi: 'AGI', int: 'INT',
};

const SLOT_COLOR: Record<EquipSlot, { fill: number; stroke: number; text: string }> = {
  weapon: { fill: 0x1b1830, stroke: 0x8a6cf0, text: '#c7b8ff' },
  armor: { fill: 0x142232, stroke: 0x6cb8ff, text: '#a8d8ff' },
  charm: { fill: 0x241f18, stroke: 0xf0d36c, text: '#f0d36c' },
};

// Mirrors BattleScene's ELEMENT_COLOR so spell info reads consistently across screens.
const ELEMENT_COLOR: Record<string, string> = {
  physical: '#e8ecff', fire: '#ff8a5a', ice: '#6cb8ff', holy: '#ffe07a',
};

/** Rows visible at once in the equip item list; more scrolls (▲/▼ markers). */
const EQUIP_LIST_ROWS = 5;

/** Rows visible at once in the items list; more scrolls (▲/▼ markers). */
const ITEMS_LIST_ROWS = 6;

/** Items with a party-target action available outside battle. Cure is
 * battle-only and sell-junk has no field use, so both stay list-only. */
const FIELD_USABLE_KINDS = new Set(['heal', 'mp', 'revive']);
function fieldUsable(id: string): boolean {
  const kind = ITEMS[id]?.kind;
  return kind != null && FIELD_USABLE_KINDS.has(kind);
}

/** Compact right-aligned tag summarizing an item on a list row. */
function itemTag(id: string): string {
  const item = ITEMS[id];
  if (!item) return '';
  switch (item.kind) {
    case 'heal': return `Heal ${item.power}`;
    case 'mp': return `+${item.power} MP`;
    case 'revive': return 'Revive';
    case 'cure': return 'Battle only';
    case 'damage': return `Dmg ${item.power}`;
    case 'sell': return `Sells ${item.sellPrice ?? 0}g`;
    default: return '';
  }
}
