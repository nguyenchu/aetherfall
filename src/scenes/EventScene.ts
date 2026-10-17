import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import type { EventOption, EventOutcome, GameEvent } from '../game/events';
import { input, isTouchDevice } from '../game/input';
import { sfx } from '../audio/music';
import { sharpText, FONT } from '../ui/text';

interface EventData {
  event: GameEvent;
  onDone: (outcome: EventOutcome) => void;
}

/**
 * A room event's choice (see game/events.ts): the event's text plus one card
 * per option, laid out like BoonScene's cards. Options the party can't afford
 * are shown greyed out and skipped by the cursor. There's always a "leave"
 * style option, so no cancel binding is needed.
 */
export class EventScene extends Phaser.Scene {
  private options: EventOption[] = [];
  private onDone?: (outcome: EventOutcome) => void;
  private index = 0;
  private cards: { frame: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private done = false;
  private unsubs: (() => void)[] = [];

  constructor() {
    super('Event');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    const data = this.scene.settings.data as EventData;
    this.options = data.event.options();
    this.onDone = data.onDone;
    this.cards = [];
    this.done = false;
    this.unsubs = [];
    this.index = Math.max(0, this.options.findIndex((o) => o.enabled));
    input.releaseAll();

    this.add.rectangle(0, 0, GAME.width, GAME.height, 0x05040c, 0.9).setOrigin(0, 0);
    const title = this.add.text(GAME.width / 2, 40, data.event.title.toUpperCase(), sharpText({
      fontFamily: FONT, fontSize: '15px', color: '#6cf0c2',
    })).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: { from: 32, to: 40 }, duration: 320, ease: 'Sine.easeOut' });
    this.add.text(GAME.width / 2, 66, data.event.text, sharpText({
      fontFamily: FONT, fontSize: '10px', color: '#c9cee8', align: 'center', wordWrap: { width: GAME.width - 120 },
    })).setOrigin(0.5, 0);

    const n = this.options.length;
    const cardW = n >= 3 ? 150 : 180;
    const cardH = 132;
    const gap = 14;
    const left = (GAME.width - (n * cardW + (n - 1) * gap)) / 2;
    const top = 112;

    this.options.forEach((opt, i) => {
      const x = left + i * (cardW + gap);
      const frame = this.add.rectangle(x, top, cardW, cardH, 0x0d1024, 0.98)
        .setOrigin(0, 0).setStrokeStyle(2, 0x2f3658, 1).setAlpha(opt.enabled ? 1 : 0.45);
      const label = this.add.text(x + cardW / 2, top + 22, opt.label, sharpText({
        fontFamily: FONT, fontSize: '11px', color: '#eef2ff', align: 'center', wordWrap: { width: cardW - 18 },
      })).setOrigin(0.5, 0).setAlpha(opt.enabled ? 1 : 0.45);
      this.add.text(x + cardW / 2, top + 62, opt.desc, sharpText({
        fontFamily: FONT, fontSize: '9px', color: '#a8b0d0', align: 'center', lineSpacing: 3, wordWrap: { width: cardW - 22 },
      })).setOrigin(0.5, 0).setAlpha(opt.enabled ? 1 : 0.45);
      if (opt.enabled) {
        frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          this.index = i;
          this.updateSelection();
          this.choose();
        });
      }
      this.cards.push({ frame, label });
    });

    if (!isTouchDevice()) {
      this.add.text(GAME.width / 2, top + cardH + 18, '< >  choose   Z  confirm', sharpText({
        fontFamily: FONT, fontSize: '9px', color: '#6cf0c2',
      })).setOrigin(0.5);
    }

    for (const [btn, dir] of [['left', -1], ['up', -1], ['right', 1], ['down', 1]] as const) {
      this.unsubs.push(input.on(btn, () => this.move(dir)));
    }
    this.unsubs.push(input.on('confirm', () => this.choose()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
    this.updateSelection();
  }

  private move(dir: number) {
    if (this.done) return;
    const n = this.options.length;
    for (let step = 1; step <= n; step++) {
      const next = (this.index + dir * step + n * 2) % n;
      if (this.options[next].enabled) {
        this.index = next;
        sfx.play('cursor');
        this.updateSelection();
        return;
      }
    }
  }

  private updateSelection() {
    this.cards.forEach((card, i) => {
      const selected = i === this.index;
      card.frame.setStrokeStyle(selected ? 3 : 2, selected ? 0x6cf0c2 : 0x2f3658, 1);
      card.label.setColor(selected ? '#6cf0c2' : '#eef2ff');
    });
  }

  private choose() {
    if (this.done) return;
    const opt = this.options[this.index];
    if (!opt?.enabled) return;
    this.done = true;
    sfx.play('confirm');
    const outcome = opt.apply();
    this.time.delayedCall(200, () => {
      input.releaseAll();
      const onDone = this.onDone;
      this.scene.stop();
      onDone?.(outcome);
    });
  }
}
