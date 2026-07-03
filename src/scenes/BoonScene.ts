import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { rarityColor, type Boon } from '../game/boons';
import { addBoon, getRun, saveProgress } from '../game/run';
import { input, isTouchDevice } from '../game/input';
import { sfx } from '../audio/music';
import { sharpText, FONT } from '../ui/text';

interface BoonPickData {
  choices: Boon[];
  elite?: boolean;
  onDone: () => void;
}

const SKIP_GOLD = 10;

/**
 * Post-battle boon chooser: three cards, pick one blessing for the rest of
 * the run. Left/right + confirm, or tap a card. Cancel skips for a little gold.
 */
export class BoonScene extends Phaser.Scene {
  private choices: Boon[] = [];
  private onDone?: () => void;
  private index = 0;
  private cards: { frame: Phaser.GameObjects.Rectangle; glow: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text }[] = [];
  private done = false;
  private unsubs: (() => void)[] = [];

  constructor() {
    super('BoonPick');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    const data = this.scene.settings.data as BoonPickData;
    this.choices = data.choices;
    this.onDone = data.onDone;
    this.index = 0;
    this.cards = [];
    this.done = false;
    this.unsubs = [];
    input.releaseAll();

    this.add.rectangle(0, 0, GAME.width, GAME.height, 0x05040c, 0.9).setOrigin(0, 0).setDepth(0);

    const title = data.elite ? 'THE GUARDIAN YIELDS A BLESSING' : 'THE AETHER OFFERS A BLESSING';
    const titleText = this.add.text(GAME.width / 2, 42, title, sharpText({
      fontFamily: FONT, fontSize: '15px', color: data.elite ? '#ffcf6a' : '#a58cff',
    })).setOrigin(0.5).setDepth(2).setAlpha(0);
    this.tweens.add({ targets: titleText, alpha: 1, y: { from: 34, to: 42 }, duration: 320, ease: 'Sine.easeOut' });
    this.add.text(GAME.width / 2, 62, 'Lasts until the Crystal draws you home.', sharpText({
      fontFamily: FONT, fontSize: '9px', color: '#8a93b8',
    })).setOrigin(0.5).setDepth(2);

    const cardW = 168;
    const cardH = 168;
    const gap = 16;
    const total = this.choices.length * cardW + (this.choices.length - 1) * gap;
    const left = (GAME.width - total) / 2;
    const top = 88;

    this.choices.forEach((boon, i) => {
      const x = left + i * (cardW + gap);
      const color = Phaser.Display.Color.HexStringToColor(rarityColor(boon.rarity)).color;

      const glow = this.add.rectangle(x - 3, top - 3, cardW + 6, cardH + 6, color, 0.14)
        .setOrigin(0, 0).setDepth(1);
      const frame = this.add.rectangle(x, top, cardW, cardH, 0x0d1024, 0.98)
        .setOrigin(0, 0).setDepth(2).setStrokeStyle(2, color, 0.95)
        .setInteractive({ useHandCursor: true });
      const rarity = this.add.text(x + cardW / 2, top + 18, boon.rarity.toUpperCase(), sharpText({
        fontFamily: FONT, fontSize: '8px', color: rarityColor(boon.rarity),
      })).setOrigin(0.5).setDepth(3);
      const name = this.add.text(x + cardW / 2, top + 44, boon.name, sharpText({
        fontFamily: FONT, fontSize: '13px', color: '#eef2ff', align: 'center',
        wordWrap: { width: cardW - 20 },
      })).setOrigin(0.5, 0).setDepth(3);
      const desc = this.add.text(x + cardW / 2, top + 96, boon.desc, sharpText({
        fontFamily: FONT, fontSize: '9px', color: '#c9cee8', align: 'center', lineSpacing: 4,
        wordWrap: { width: cardW - 24 },
      })).setOrigin(0.5, 0).setDepth(3);

      // Staggered reveal.
      for (const obj of [glow, frame, rarity, name, desc]) {
        obj.setAlpha(0);
        this.tweens.add({ targets: obj, alpha: obj === glow ? 0.14 : 1, duration: 260, delay: 120 + i * 110 });
      }

      frame.on('pointerdown', () => {
        this.index = i;
        this.updateSelection();
        this.choose();
      });
      this.cards.push({ frame, glow, name });
    });

    const skipHint = isTouchDevice() ? 'or tap here to skip' : 'X: skip';
    const skip = this.add.text(GAME.width / 2, top + cardH + 34, `${skipHint}  (+${SKIP_GOLD} gold)`, sharpText({
      fontFamily: FONT, fontSize: '9px', color: '#8a93b8',
    })).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true });
    skip.on('pointerdown', () => this.skip());
    if (!isTouchDevice()) {
      this.add.text(GAME.width / 2, top + cardH + 20, '< >  choose   Z  take', sharpText({
        fontFamily: FONT, fontSize: '9px', color: '#6cf0c2',
      })).setOrigin(0.5).setDepth(2);
    }

    this.unsubs.push(input.on('left', () => this.move(-1)));
    this.unsubs.push(input.on('right', () => this.move(1)));
    this.unsubs.push(input.on('up', () => this.move(-1)));
    this.unsubs.push(input.on('down', () => this.move(1)));
    this.unsubs.push(input.on('confirm', () => this.choose()));
    this.unsubs.push(input.on('cancel', () => this.skip()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));

    this.updateSelection();
  }

  private move(dir: number) {
    if (this.done || this.cards.length === 0) return;
    this.index = (this.index + dir + this.cards.length) % this.cards.length;
    sfx.play('cursor');
    this.updateSelection();
  }

  private updateSelection() {
    this.cards.forEach((card, i) => {
      const selected = i === this.index;
      const boon = this.choices[i];
      const color = Phaser.Display.Color.HexStringToColor(rarityColor(boon.rarity)).color;
      card.frame.setStrokeStyle(selected ? 3 : 2, selected ? 0x6cf0c2 : color, selected ? 1 : 0.7);
      card.glow.setFillStyle(color, selected ? 0.3 : 0.1);
      card.name.setColor(selected ? '#6cf0c2' : '#eef2ff');
    });
  }

  private choose() {
    if (this.done) return;
    const boon = this.choices[this.index];
    if (!boon) return;
    this.done = true;
    addBoon(boon.id);
    sfx.play('levelup');
    const card = this.cards[this.index];
    this.tweens.add({ targets: [card.frame, card.glow], scaleX: 1.06, scaleY: 1.06, duration: 120, yoyo: true });
    const flash = this.add.rectangle(0, 0, GAME.width, GAME.height, 0xffffff, 0.18).setOrigin(0, 0).setDepth(10);
    this.tweens.add({ targets: flash, alpha: 0, duration: 350 });
    this.time.delayedCall(420, () => this.finish());
  }

  private skip() {
    if (this.done) return;
    this.done = true;
    getRun().gold += SKIP_GOLD;
    saveProgress();
    sfx.play('cancel');
    this.finish();
  }

  private finish() {
    input.releaseAll();
    const onDone = this.onDone;
    this.scene.stop();
    onDone?.();
  }
}
