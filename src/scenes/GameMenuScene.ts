import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { ITEMS, SPELLS } from '../game/content';
import { EQUIPMENT, type EquipSlot } from '../game/equipment';
import { equipNext, equippedFor, getRun, questList, rewardTextForQuest, useItemOn } from '../game/run';
import { xpForLevel } from '../game/progression';
import { sharpText, FONT } from '../ui/text';

interface MenuData {
  caller: string;
}

type MenuTab = 'stats' | 'items' | 'magic' | 'equip' | 'quests';
const TABS: MenuTab[] = ['stats', 'items', 'magic', 'equip', 'quests'];

interface Selectable {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  action: () => void;
}

export class GameMenuScene extends Phaser.Scene {
  private caller = 'Sanctuary';
  private content?: Phaser.GameObjects.Container;
  private tab: MenuTab = 'stats';
  private selectables: Selectable[] = [];
  private selected = 0;
  private goldText?: Phaser.GameObjects.Text;

  constructor() {
    super('GameMenu');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    const data = this.scene.settings.data as MenuData;
    this.caller = data.caller;

    this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg, 1).setOrigin(0, 0).setDepth(0);
    this.add.rectangle(18, 14, GAME.width - 36, GAME.height - 28, 0x0d1024, 1).setOrigin(0, 0).setStrokeStyle(1, COLORS.wall).setDepth(1);
    this.add.text(42, 32, 'AETHERFALL MENU', sharpText({ fontFamily: FONT, fontSize: '15px', color: '#f0d36c' })).setDepth(2);
    const run = getRun();
    const lv = run.party.map((c) => `${c.name[0]}${c.level ?? 1}`).join(' ');
    this.goldText = this.add.text(GAME.width - 8, 32, `Gold ${run.gold}  Lv ${lv}`, sharpText({ fontFamily: FONT, fontSize: '11px', color: '#f0d36c' })).setOrigin(1, 0).setDepth(2);

    TABS.forEach((tab, i) => {
      this.button(34 + i * 56, 58, 52, title(tab), () => {
        this.tab = tab;
        this.renderContent();
      }, undefined, '8px');
    });
    this.button(GAME.width - 52, 22, 44, 'Close', () => this.close(), undefined, '8px');

    this.renderContent();

    this.input.keyboard?.once('keydown-ESC', () => this.close());
    this.input.keyboard?.once('keydown-X', () => this.close());
    this.input.keyboard?.once('keydown-TAB', () => this.close());
    this.input.keyboard?.on('keydown-LEFT', () => this.changeTab(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.changeTab(1));
    this.input.keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-Z', () => this.activateSelection());
    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelection());
    this.input.keyboard?.on('keydown-SPACE', () => this.activateSelection());
    this.updateSelection();
  }

  private renderContent() {
    this.content?.destroy();
    this.cleanSelectables();
    const run = getRun();
    if (this.goldText) {
      const lv = run.party.map((c) => `${c.name[0]}${c.level ?? 1}`).join(' ');
      this.goldText.setText(`Gold ${run.gold}  Lv ${lv}`);
    }
    const box = this.add.container(0, 0).setDepth(2);
    this.content = box;
    box.add(this.add.text(42, 86, title(this.tab), sharpText({ fontFamily: FONT, fontSize: '13px', color: '#a58cff' })));
    if (this.tab === 'stats') this.renderStats(box);
    else if (this.tab === 'items') this.renderItems(box);
    else if (this.tab === 'magic') this.renderMagic(box);
    else if (this.tab === 'equip') this.renderEquip(box);
    else this.renderQuests(box);
    this.selected = Phaser.Math.Clamp(this.selected, 0, Math.max(0, this.selectables.length - 1));
    this.updateSelection();
  }

  private renderStats(box: Phaser.GameObjects.Container) {
    const run = getRun();
    run.party.forEach((member, i) => {
      const y = 112 + i * 38;
      const xpNeed = xpForLevel(member.level ?? 1);
      const portrait = this.add.image(48, y + 12, `portrait_${member.id}`).setDisplaySize(28, 28).setOrigin(0, 0.5);
      const frame = this.add.rectangle(48, y + 12, 30, 30, 0x07060e, 0).setOrigin(0, 0.5).setStrokeStyle(1, COLORS.wall);
      box.add([portrait, frame]);
      box.add(this.add.text(84, y, `${member.name}  Lv ${member.level ?? 1}  XP ${member.xp ?? 0}/${xpNeed}`, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c' })));
      box.add(this.add.text(92, y + 14, `HP ${member.stats.hp}/${member.stats.maxHp}  MP ${member.stats.mp}/${member.stats.maxMp}`, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 2 })));
      box.add(this.add.text(92, y + 26, `STR ${member.stats.str}  VIT ${member.stats.vit}  AGI ${member.stats.agi}  INT ${member.stats.int}`, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 2 })));
    });
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
      const y = 112 + i * 28;
      const label = `${item?.name ?? id} x${count}  -  ${item?.description ?? ''}`;
      box.add(this.add.text(46, y, label, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', wordWrap: { width: GAME.width - 120 } })));
      if (item?.target === 'ally') {
        run.party.forEach((member, memberIndex) => {
          this.button(70 + memberIndex * 70, y + 13, 62, member.name, () => {
            useItemOn(id, member.id);
            this.renderContent();
          }, box, '7px');
        });
      }
    });
  }

  private renderMagic(box: Phaser.GameObjects.Container) {
    const run = getRun();
    run.party.forEach((member, i) => {
      const y = 112 + i * 38;
      box.add(this.add.text(46, y, `${member.name}  MP ${member.stats.mp}/${member.stats.maxMp}`, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c' })));
      const spells = member.spells.map((id) => SPELLS[id]).filter((s) => s != null);
      const line = spells.length > 0
        ? spells.map((s) => `${s.name} (${s.cost}MP, ${s.kind})`).join('  |  ')
        : 'No spells';
      box.add(this.add.text(54, y + 16, line, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5', strokeThickness: 2, wordWrap: { width: 360 } })));
    });
  }

  private renderEquip(box: Phaser.GameObjects.Container) {
    const run = getRun();
    run.party.forEach((member, i) => {
      const y = 112 + i * 42;
      const eq = equippedFor(member.id);
      box.add(this.add.text(46, y, member.name, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c' })));
      this.slotButton(box, 100, y - 2, member.id, 'weapon', eq.weapon);
      this.slotButton(box, 220, y - 2, member.id, 'armor', eq.armor);
      this.slotButton(box, 340, y - 2, member.id, 'charm', eq.charm);
    });
  }

  private renderQuests(box: Phaser.GameObjects.Container) {
    questList().forEach((q, i) => {
      const y = 112 + i * 44;
      const mark = q.status === 'complete' ? '[x]' : '[ ]';
      const color = q.status === 'complete' ? '#8a93b8' : '#dfe4f5';
      box.add(this.add.text(46, y, `${mark} ${q.title}`, sharpText({ fontFamily: FONT, fontSize: '10px', color })));
      box.add(this.add.text(62, y + 15, q.text, sharpText({ fontFamily: FONT, fontSize: '8px', color: '#c9cee8', strokeThickness: 2, wordWrap: { width: GAME.width - 112 } })));
      box.add(this.add.text(62, y + 25, rewardTextForQuest(q.id), sharpText({ fontFamily: FONT, fontSize: '8px', color: '#f0d36c', strokeThickness: 2 })));
    });
  }

  private slotButton(parent: Phaser.GameObjects.Container, x: number, y: number, memberId: string, slot: EquipSlot, itemId?: string) {
    const item = itemId ? EQUIPMENT[itemId] : undefined;
    const text = `${slot}: ${item?.name ?? '-'}`;
    this.button(x, y, 112, text, () => {
      equipNext(memberId, slot);
      this.renderContent();
    }, parent, '7px');
  }

  private button(
    x: number,
    y: number,
    w: number,
    text: string,
    onClick: (label: Phaser.GameObjects.Text) => void,
    parent?: Phaser.GameObjects.Container,
    fontSize = '9px',
  ) {
    const rect = this.add.rectangle(x, y, w, 20, 0x141a30, 0.96).setOrigin(0, 0).setStrokeStyle(1, COLORS.wall).setDepth(2);
    const label = this.add.text(x + 6, y + 3, text, sharpText({ fontFamily: FONT, fontSize, color: '#dfe4f5', strokeThickness: 2 })).setDepth(3);
    rect.setInteractive({ useHandCursor: true });
    const selectable: Selectable = { rect, label, action: () => onClick(label) };
    this.selectables.push(selectable);
    rect.on('pointerdown', () => {
      this.selected = this.selectables.indexOf(selectable);
      this.updateSelection();
      selectable.action();
    });
    parent?.add([rect, label]);
  }

  private changeTab(dir: number) {
    this.tab = TABS[(TABS.indexOf(this.tab) + dir + TABS.length) % TABS.length];
    this.renderContent();
  }

  private moveSelection(dir: number) {
    this.cleanSelectables();
    if (this.selectables.length === 0) return;
    this.selected = (this.selected + dir + this.selectables.length) % this.selectables.length;
    this.updateSelection();
  }

  private activateSelection() {
    this.cleanSelectables();
    this.selectables[this.selected]?.action();
  }

  private cleanSelectables() {
    this.selectables = this.selectables.filter((s) => s.rect.active && s.label.active);
    this.selected = Phaser.Math.Clamp(this.selected, 0, Math.max(0, this.selectables.length - 1));
  }

  private updateSelection() {
    this.cleanSelectables();
    this.selectables.forEach((s, i) => {
      const active = i === this.selected;
      s.rect.setFillStyle(active ? 0x263054 : 0x141a30, active ? 1 : 0.96);
      s.rect.setStrokeStyle(1, active ? 0xf0d36c : COLORS.wall);
      s.label.setColor(active ? '#f0d36c' : '#dfe4f5');
    });
  }

  private close() {
    this.scene.resume(this.caller);
    this.scene.stop();
  }
}

function title(tab: MenuTab): string {
  return tab[0].toUpperCase() + tab.slice(1);
}
