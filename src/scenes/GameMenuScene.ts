import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { BOONS } from '../game/boons';
import { ITEMS, SPELLS } from '../game/content';
import { EQUIPMENT, type EquipSlot } from '../game/equipment';
import { castSpellOutOfBattle, effectiveSpellCost, equipItem, equippedFor, equipmentPreviewStats, getRun, hardReset, ownedEquipment, questList, returnToTown, rewardTextForQuest, useItemOn } from '../game/run';
import { input, attachTouchControls } from '../game/input';
import { xpForLevel } from '../game/progression';
import { sharpText, FONT } from '../ui/text';
import type { Combatant, Stats } from '../game/types';

interface MenuData {
  caller: string;
}

type MenuTab = 'stats' | 'items' | 'magic' | 'equip' | 'quests' | 'system';
const TABS: MenuTab[] = ['stats', 'items', 'magic', 'equip', 'quests', 'system'];
type MenuFocus = 'command' | 'content';

interface Selectable {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  action: () => void;
  tab?: MenuTab;
  chosen?: boolean;
  disabled?: boolean;
  onFocus?: () => void;
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
  /** undefined = no preview (show equipped); null = previewing "None". */
  private equipPreviewItemId?: string | null;
  private resetArmed = false;
  private magicSpellId?: string;
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

  private renderItems(box: Phaser.GameObjects.Container) {
    const run = getRun();
    const entries = Object.entries(run.inventory).filter(([, n]) => n > 0);
    if (entries.length === 0) {
      box.add(this.add.text(46, 112, 'No items.', sharpText({ fontFamily: FONT, fontSize: '10px', color: '#dfe4f5' })));
      return;
    }
    entries.forEach(([id, count], i) => {
      const item = ITEMS[id];
      const y = 102 + i * 46;
      const row = this.add.rectangle(42, y - 4, 414, 42, i % 2 === 0 ? 0x101d3f : 0x0c1836, 0.88)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x5067b0, 0.5);
      box.add(row);
      this.addIcon(box, id, 50, y, 26);
      box.add(this.add.text(84, y, `${item?.name ?? id} x${count}`,
        sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c', strokeThickness: 2 })));
      box.add(this.add.text(84, y + 13, item?.description ?? '',
        sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, wordWrap: { width: 350 } })));
      if (item?.target === 'ally') {
        run.party.forEach((member, memberIndex) => {
          this.button(84 + memberIndex * 70, y + 25, 62, member.name, () => {
            useItemOn(id, member.id);
            this.renderContent();
          }, box, '7px');
        });
      }
    });
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
    const fieldSpells = spells.filter((s) => s.kind === 'heal' && s.target === 'ally');
    if (fieldSpells.length > 0 && !fieldSpells.some((s) => s.id === this.magicSpellId)) {
      this.magicSpellId = fieldSpells[0].id;
    }
    const selectedSpell = this.magicSpellId ? SPELLS[this.magicSpellId] : undefined;

    box.add(this.add.text(46, 176, `${member.name}  MP ${member.stats.mp}/${member.stats.maxMp}`,
      sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c', strokeThickness: 2 })));
    box.add(this.add.text(46, 190, 'Field magic can heal the party outside battle.',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2 })));

    if (spells.length === 0) {
      box.add(this.add.text(54, 216, 'No magic learned.', sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 2 })));
      return;
    }

    spells.forEach((spell, i) => {
      const y = 214 + i * 24;
      const cost = effectiveSpellCost(spell.id);
      if (spell.kind === 'heal' && spell.target === 'ally') {
        const b = this.button(54, y, 128, `${spell.name}  ${cost}MP`, () => {
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
        box.add(this.add.text(194, y + 4, `Heal ${spell.power}+INT`, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a8d8ff', strokeThickness: 2 })));
      } else {
        box.add(this.add.text(58, y + 4, `${spell.name}  ${cost}MP`,
          sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8', strokeThickness: 2 })));
        box.add(this.add.text(194, y + 4, 'Battle only',
          sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8', strokeThickness: 2 })));
      }
    });

    if (!selectedSpell || selectedSpell.kind !== 'heal') return;
    box.add(this.add.text(294, 176, 'Target', sharpText({ fontFamily: FONT, fontSize: '9px', color: '#a58cff', strokeThickness: 2 })));
    run.party.forEach((target, i) => {
      this.portraitButton(box, target, 286, 196 + i * 42, 156, 36, false, () => {
        this.castFieldMagic(member, selectedSpell.id, target);
      }, 'compact');
    });
  }

  private renderEquip(box: Phaser.GameObjects.Container) {
    const member = this.selectedMember();
    const eq = equippedFor(member.id);

    this.renderPartyPortraits(box, 78, (i) => {
      this.memberIndex = i;
      this.equipPreviewItemId = undefined;
      this.menuNotice = '';
      this.renderContent();
    });

    // Left: the member's loadout — one row per slot.
    box.add(this.add.text(46, 168, 'LOADOUT', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2 })));
    (['weapon', 'armor', 'charm'] as EquipSlot[]).forEach((slot, i) => {
      const y = 180 + i * 30;
      const id = eq[slot];
      const name = id ? EQUIPMENT[id]?.name ?? id : '—';
      const rect = this.add.rectangle(46, y, 178, 28, 0x141a30, 0.96)
        .setOrigin(0, 0).setStrokeStyle(1, COLORS.wall).setDepth(2)
        .setInteractive({ useHandCursor: true });
      box.add(rect); // added first: children render in container order
      this.addIcon(box, id, 50, y + 3, 22);
      box.add(this.add.text(78, y + 4, slot.toUpperCase(),
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })).setDepth(3));
      const label = this.add.text(78, y + 13, name,
        sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 2 })).setDepth(3);
      const selectable: Selectable = {
        rect, label,
        action: () => this.setEquipSlot(slot),
        chosen: slot === this.equipSlot,
        onFocus: () => { if (this.equipSlot !== slot) this.setEquipSlot(slot); },
      };
      this.selectables.push(selectable);
      rect.on('pointerdown', () => {
        this.selected = this.selectables.indexOf(selectable);
        this.focus = 'content';
        this.updateSelection();
        selectable.action();
      });
      box.add(label);
    });

    // Right: everything the member can put in the active slot.
    box.add(this.add.text(236, 168, 'AVAILABLE', sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2 })));
    box.add(this.add.text(310, 168, 'move: preview  ·  Z: equip', sharpText({ fontFamily: FONT, fontSize: '7px', color: '#5a6080', strokeThickness: 2 })));
    const current = eq[this.equipSlot];
    const choices = ownedEquipment().filter((item) => item.slot === this.equipSlot && item.users.includes(member.id));
    const allChoices: Array<{ id?: string; name: string }> = [
      { id: undefined, name: 'None' },
      ...choices.map((item) => ({ id: item.id, name: item.name })),
    ];
    allChoices.forEach((item, i) => {
      const y = 180 + i * 24;
      const equipped = item.id === current || (!item.id && !current);
      this.addIcon(box, item.id, 240, y + 1, 18);
      const b = this.button(262, y, 194, item.name, () => {
        if (equipItem(member.id, this.equipSlot, item.id)) {
          this.menuNotice = `${member.name} equips ${item.id ? EQUIPMENT[item.id]?.name : 'nothing'}.`;
        }
        this.equipPreviewItemId = item.id ?? null;
        this.renderContent();
      }, box, '8px');
      b.chosen = equipped;
      b.onFocus = () => {
        const previewValue = item.id ?? null;
        if (this.equipPreviewItemId === previewValue) return;
        this.equipPreviewItemId = previewValue;
        this.renderContent();
      };
      box.add(this.add.text(352, y + 6, this.shortBonus(item.id),
        sharpText({ fontFamily: FONT, fontSize: '7px', color: equipped ? '#f0d36c' : '#9aa4c8', strokeThickness: 2 })).setDepth(3));
      if (equipped) {
        box.add(this.add.text(432, y + 6, 'ON',
          sharpText({ fontFamily: FONT, fontSize: '7px', color: '#f0d36c', strokeThickness: 2 })).setDepth(3));
      }
    });

    // Bottom: one comparison panel — item info left, stat changes right.
    const previewId = this.equipPreviewItemId === undefined ? current : this.equipPreviewItemId ?? undefined;
    const previewItem = previewId ? EQUIPMENT[previewId] : undefined;
    const previewStats = equipmentPreviewStats(member.id, this.equipSlot, previewId);
    box.add(this.add.rectangle(42, 272, 414, 48, 0x101d3f, 0.92)
      .setOrigin(0, 0).setStrokeStyle(1, 0x5067b0, 0.5).setDepth(2));
    this.addIcon(box, previewId, 46, 276, 20);
    box.add(this.add.text(72, 276, previewItem ? `${previewItem.name} — ${previewItem.trait}` : 'Empty slot',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#f0d36c', strokeThickness: 2 })).setDepth(3));
    box.add(this.add.text(72, 288, previewItem?.description ?? 'No equipment in this slot.',
      sharpText({ fontFamily: FONT, fontSize: '7px', color: '#9aa4c8', strokeThickness: 2, lineSpacing: 2, wordWrap: { width: 200 } })).setDepth(3));
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
        box.add(this.add.text(288 + (i % 3) * 58, 278 + Math.floor(i / 3) * 16, text,
          sharpText({ fontFamily: FONT, fontSize: '8px', color, strokeThickness: 2 })).setDepth(3));
      });
    }
  }

  private setEquipSlot(slot: EquipSlot) {
    this.equipSlot = slot;
    this.equipPreviewItemId = undefined;
    this.renderContent();
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

  private renderSystem(box: Phaser.GameObjects.Container) {
    const run = getRun();
    box.add(this.add.text(46, 96, 'Progress is saved automatically after battles,\npurchases and equipment changes.',
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#c9cee8', strokeThickness: 2, lineSpacing: 4 })));
    box.add(this.add.text(46, 132, `Party   ${run.party.map((m) => `${m.name} L${m.level ?? 1}`).join('   ')}`,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 2 })));

    this.button(46, 176, 200, 'Return to Title', () => this.quitToTitle(), box, '9px');
    box.add(this.add.text(256, 180, 'Back to the title screen. Keeps your save.',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#8a93b8', strokeThickness: 2 })));

    const resetLabel = this.resetArmed ? 'CONFIRM: erase everything' : 'New Game (erase save)';
    this.button(46, 208, 200, resetLabel, () => this.newGame(), box, '9px');
    box.add(this.add.text(256, 212, this.resetArmed
      ? 'Choosing again erases ALL progress!'
      : 'Deletes levels, gold, gear and story.',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: this.resetArmed ? '#ff8a8a' : '#8a93b8', strokeThickness: 2 })));
  }

  private quitToTitle() {
    if (this.caller === 'Descent') returnToTown(); // the Crystal draws the party home
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
    questList().forEach((q, i) => {
      const y = 112 + i * 44;
      const mark = q.status === 'complete' ? '[x]' : '[ ]';
      const color = q.status === 'complete' ? '#8a93b8' : '#dfe4f5';
      box.add(this.add.text(46, y, `${mark} ${q.title}`, sharpText({ fontFamily: FONT, fontSize: '10px', color })));
      box.add(this.add.text(62, y + 15, q.text, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, wordWrap: { width: 390 } })));
      box.add(this.add.text(62, y + 25, rewardTextForQuest(q.id), sharpText({ fontFamily: FONT, fontSize: '8px', color: '#f0d36c', strokeThickness: 2 })));
    });
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

  private renderPartyPortraits(box: Phaser.GameObjects.Container, y: number, onChoose: (index: number) => void) {
    const run = getRun();
    this.memberIndex = Phaser.Math.Clamp(this.memberIndex, 0, run.party.length - 1);
    run.party.forEach((member, i) => {
      this.portraitButton(box, member, 46 + i * 132, y, 112, 84, i === this.memberIndex, () => onChoose(i), 'large', () => {
        if (this.memberIndex === i) return;
        onChoose(i);
      });
    });
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
    if (tab !== 'equip') this.equipPreviewItemId = undefined;
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
    if (this.focus === 'command') {
      this.changeTab(dir);
      return;
    }
    this.moveSpatial(0, dir);
  }

  private moveHorizontal(dir: number) {
    this.cleanSelectables();
    if (this.selectables.length === 0) return;
    if (this.focus === 'command') {
      if (dir < 0) this.enterContent();
      return;
    }
    const moved = this.moveSpatial(dir, 0);
    if (!moved && dir > 0) this.focusCommand();
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
    this.unsubs.push(input.on('menu', () => this.close()));
  }

  private enterContent() {
    const target = this.preferredContentTarget();
    if (!target) return;
    this.selectSelectable(target, false);
  }

  private back() {
    if (this.focus === 'content') {
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
    return options.find((s) => s.chosen) ?? options[0];
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
      s.rect.setFillStyle(selected ? 0x263054 : activeTab || chosen ? 0x2a263a : 0x141a30, disabled ? 0.48 : selected || activeTab || chosen ? 1 : 0.96);
      s.rect.setStrokeStyle(selected || activeTab || chosen ? 2 : 1, disabled ? 0x50607a : commandFocus ? 0x6cf0c2 : selected ? 0x6cf0c2 : activeTab || chosen ? 0xf0d36c : COLORS.wall);
      s.label.setColor(disabled ? '#8a93b8' : commandFocus ? '#6cf0c2' : selected ? '#6cf0c2' : activeTab || chosen ? '#f0d36c' : '#dfe4f5');
    });
  }

  private roleFor(memberId: string): string {
    switch (memberId) {
      case 'kael': return 'Vanguard';
      case 'lyra': return 'Black Mage';
      case 'mira': return 'Cleric';
      default: return 'Hero';
    }
  }

  private spellLine(member: Combatant): string {
    const spells = member.spells.map((id) => SPELLS[id]).filter((s) => s != null);
    const label = member.id === 'kael' ? 'Skills' : 'Magic';
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
