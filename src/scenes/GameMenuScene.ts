import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { ITEMS, SPELLS } from '../game/content';
import { EQUIPMENT, type EquipSlot } from '../game/equipment';
import { castSpellOutOfBattle, effectiveSpellCost, equipItem, equippedFor, equipmentBonusText, equipmentPreviewStats, getRun, ownedEquipment, questList, rewardTextForQuest, useItemOn } from '../game/run';
import { input, attachTouchControls } from '../game/input';
import { xpForLevel } from '../game/progression';
import { sharpText, FONT } from '../ui/text';
import type { Combatant, Stats } from '../game/types';

interface MenuData {
  caller: string;
}

type MenuTab = 'stats' | 'items' | 'magic' | 'equip' | 'quests';
const TABS: MenuTab[] = ['stats', 'items', 'magic', 'equip', 'quests'];
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
  private equipPreviewItemId?: string;
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
    else this.renderQuests(box);
    this.syncSelectionToFocus();
    this.selectionAnchor = undefined;
    this.updateSelection();
  }

  private renderStats(box: Phaser.GameObjects.Container) {
    const member = this.selectedMember();
    const xpNeed = xpForLevel(member.level ?? 1);
    this.renderPartyPortraits(box, 78, (i) => {
      this.memberIndex = i;
      this.menuNotice = '';
      this.renderContent();
    });

    const panel = this.add.rectangle(42, 178, 414, 130, 0x101d3f, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x5067b0, 0.72);
    box.add(panel);
    box.add(this.add.text(58, 192, `${member.name}  Lv ${member.level ?? 1}  ${this.roleFor(member.id)}`,
      sharpText({ fontFamily: FONT, fontSize: '12px', color: '#f0d36c', strokeThickness: 2 })));
    box.add(this.add.text(58, 212, `HP ${member.stats.hp}/${member.stats.maxHp}    MP ${member.stats.mp}/${member.stats.maxMp}    XP ${member.xp ?? 0}/${xpNeed}`,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 2 })));
    box.add(this.add.text(58, 232, `STR ${member.stats.str}  VIT ${member.stats.vit}  AGI ${member.stats.agi}  INT ${member.stats.int}`,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#c9cee8', strokeThickness: 2 })));
    box.add(this.add.text(58, 250, this.battleStatsLine(member),
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a8d8ff', strokeThickness: 2, wordWrap: { width: 380 } })));
    box.add(this.add.text(58, 270, this.equipmentLine(member.id),
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, wordWrap: { width: 380 } })));
    box.add(this.add.text(58, 288, this.spellLine(member),
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a58cff', strokeThickness: 2, wordWrap: { width: 380 } })));
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

    (['weapon', 'armor', 'charm'] as EquipSlot[]).forEach((slot, i) => {
      const b = this.button(46 + i * 86, 174, 78, slot.toUpperCase(), () => {
        this.equipSlot = slot;
        this.equipPreviewItemId = undefined;
        this.renderContent();
      }, box, '8px');
      b.chosen = slot === this.equipSlot;
      b.onFocus = () => {
        if (this.equipSlot === slot) return;
        this.equipSlot = slot;
        this.equipPreviewItemId = undefined;
        this.renderContent();
      };
    });

    box.add(this.add.text(46, 200, `${member.name}  ${this.roleFor(member.id)}`,
      sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c' })));
    box.add(this.add.text(54, 214, `HP ${member.stats.hp}/${member.stats.maxHp}  MP ${member.stats.mp}/${member.stats.maxMp}  STR ${member.stats.str}  VIT ${member.stats.vit}  AGI ${member.stats.agi}  INT ${member.stats.int}`,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 2 })));

    const current = eq[this.equipSlot];
    const choices = ownedEquipment().filter((item) => item.slot === this.equipSlot && item.users.includes(member.id));
    const currentName = current ? EQUIPMENT[current]?.name ?? current : 'None';
    const previewId = this.equipPreviewItemId ?? current;
    const previewItem = previewId ? EQUIPMENT[previewId] : undefined;
    const previewStats = equipmentPreviewStats(member.id, this.equipSlot, previewId);

    this.addIcon(box, current, 286, 174, 28);
    box.add(this.add.text(322, 176, `${this.equipSlot.toUpperCase()}: ${currentName}`,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#a58cff', strokeThickness: 2, wordWrap: { width: 136 } })));
    box.add(this.add.text(322, 192, equipmentBonusText(current),
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, wordWrap: { width: 136 } })));
    this.addIcon(box, previewId, 286, 218, 32);
    box.add(this.add.text(326, 218, `Preview: ${previewItem?.name ?? 'None'}`,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#f0d36c', strokeThickness: 2, wordWrap: { width: 132 } })));
    box.add(this.add.text(326, 235, previewItem?.trait ?? 'Unequipped',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#a8d8ff', strokeThickness: 2, wordWrap: { width: 132 } })));
    box.add(this.add.text(326, 251, previewItem?.description ?? 'Leaves this slot empty.',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, wordWrap: { width: 132 } })));
    box.add(this.add.text(286, 286, previewStats ? this.statDeltaBlock(member, previewStats) : 'Cannot equip',
      sharpText({ fontFamily: FONT, fontSize: '7px', color: '#dfe4f5', strokeThickness: 2, lineSpacing: 2 })));

    const allChoices: Array<{ id?: string; name: string; bonus: string }> = [
      { id: undefined, name: 'None', bonus: equipmentBonusText(undefined) },
      ...choices.map((item) => ({ id: item.id, name: item.name, bonus: equipmentBonusText(item.id) })),
    ];
    allChoices.forEach((item, i) => {
      const y = 234 + i * 25;
      const equipped = item.id === current || (!item.id && !current);
      const previewed = item.id === previewId || (!item.id && !previewId);
      const label = equipped ? `E ${item.name}` : previewed ? `> ${item.name}` : item.name;
      this.addIcon(box, item.id, 54, y - 1, 22);
      const b = this.button(84, y, 104, label, () => {
        equipItem(member.id, this.equipSlot, item.id);
        this.equipPreviewItemId = item.id;
        this.renderContent();
      }, box, '8px');
      b.chosen = equipped || previewed;
      b.onFocus = () => {
        if (this.equipPreviewItemId === item.id) return;
        this.equipPreviewItemId = item.id;
        this.renderContent();
      };
      box.add(this.add.text(198, y + 4, item.bonus, sharpText({ fontFamily: FONT, fontSize: '8px', color: equipped ? '#f0d36c' : previewed ? '#a8d8ff' : '#c9cee8', strokeThickness: 2, wordWrap: { width: 78 } })));
    });
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

  private battleStatsLine(member: Combatant): string {
    const power = Math.round(member.stats.str * 1.6);
    const guard = Math.round(member.stats.vit * 0.6);
    const magic = Math.round(member.stats.int * 0.8);
    const resist = Math.round(member.stats.int * 0.2);
    const heal = Math.round(member.stats.int * 0.5);
    return `PWR ${power}  GUARD ${guard}  MAG ${magic}  RES ${resist}  HEAL ${heal}  TURN ${member.stats.agi}+d3`;
  }

  private statDeltaBlock(member: Combatant, preview: Partial<Stats>): string {
    const stats: Array<keyof Stats> = ['maxHp', 'maxMp', 'str', 'vit', 'agi', 'int'];
    const lines = stats.map((stat) => {
      const cur = member.stats[stat];
      const next = preview[stat] ?? cur;
      const delta = next - cur;
      const sign = delta > 0 ? '+' : '';
      return `${stat.toUpperCase()} ${cur}->${next} (${sign}${delta})`;
    });
    return [`${lines[0]}  ${lines[1]}`, `${lines[2]}  ${lines[3]}`, `${lines[4]}  ${lines[5]}`].join('\n');
  }

  private equipmentLine(memberId: string): string {
    const eq = equippedFor(memberId);
    const name = (id?: string) => id ? EQUIPMENT[id]?.name ?? '-' : '-';
    return `W ${name(eq.weapon)}  A ${name(eq.armor)}  C ${name(eq.charm)}`;
  }

  private spellLine(member: Combatant): string {
    const spells = member.spells.map((id) => SPELLS[id]).filter((s) => s != null);
    return spells.length > 0
      ? `Magic ${spells.map((s) => `${s.name} ${effectiveSpellCost(s.id)}MP`).join('  |  ')}`
      : 'Magic -';
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
