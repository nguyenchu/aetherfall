import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { SPELLS } from '../game/content';
import { getRun, pickTalent, rollTalentsFor, useReroll } from '../game/run';
import { talentKindColor, talentKindLabel, type Talent } from '../game/talents';
import { input, isTouchDevice } from '../game/input';
import { sfx } from '../audio/music';
import { sharpText, FONT } from '../ui/text';

interface TalentPickData {
  onDone: () => void;
}

const HERO_COLOR: Record<string, string> = { kael: '#6cf0c2', lyra: '#a58cff', mira: '#f0d36c' };
const HERO_ROLE: Record<string, string> = { kael: 'Aetherblade', lyra: 'Hexweaver', mira: 'Dawnkeeper' };

/**
 * Level-up talent draft. Every hero with a pick waiting (run.pendingTalents)
 * chooses one card — a new skill, an upgrade, or a passive — one hero at a
 * time. Cancel spends a reroll (Anchor upgrade) when one is left.
 */
export class TalentScene extends Phaser.Scene {
  private onDone?: () => void;
  private heroId = '';
  private choices: Talent[] = [];
  private index = 0;
  private layer?: Phaser.GameObjects.Container;
  private cards: { frame: Phaser.GameObjects.Rectangle; glow: Phaser.GameObjects.Rectangle; color: number }[] = [];
  private locked = false;
  private unsubs: (() => void)[] = [];

  constructor() {
    super('TalentPick');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    const data = this.scene.settings.data as TalentPickData;
    this.onDone = data.onDone;
    this.unsubs = [];
    input.releaseAll();
    this.add.rectangle(0, 0, GAME.width, GAME.height, 0x05040c, 0.92).setOrigin(0, 0).setDepth(0);

    this.unsubs.push(input.on('left', () => this.move(-1)));
    this.unsubs.push(input.on('right', () => this.move(1)));
    this.unsubs.push(input.on('up', () => this.move(-1)));
    this.unsubs.push(input.on('down', () => this.move(1)));
    this.unsubs.push(input.on('confirm', () => this.choose()));
    this.unsubs.push(input.on('cancel', () => this.reroll()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));

    this.nextHero();
  }

  /** Moves on to the next hero with a pick waiting, or finishes. */
  private nextHero() {
    const pending = getRun().pendingTalents;
    const next = getRun().party.find((c) => (pending[c.id] ?? 0) > 0);
    if (!next) { this.finish(); return; }
    this.heroId = next.id;
    this.choices = rollTalentsFor(next.id);
    if (this.choices.length === 0) {
      delete pending[next.id];
      this.nextHero();
      return;
    }
    this.index = 0;
    this.render();
  }

  private render() {
    this.layer?.destroy();
    this.cards = [];
    this.locked = false;
    const run = getRun();
    const hero = run.party.find((c) => c.id === this.heroId)!;
    const layer = this.add.container(0, 0).setDepth(2);
    this.layer = layer;
    const heroColor = HERO_COLOR[hero.id] ?? '#eef2ff';
    const left = (run.pendingTalents[hero.id] ?? 1) - 1;

    if (this.textures.exists(`portrait_${hero.id}`)) {
      layer.add(this.add.rectangle(48, 40, 46, 46, 0x0d1024).setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(heroColor).color, 0.9));
      layer.add(this.add.image(48, 40, `portrait_${hero.id}`).setDisplaySize(42, 42));
    }
    layer.add(this.add.text(80, 20, `${hero.name.toUpperCase()} REACHES LEVEL ${hero.level ?? 1}`, sharpText({
      fontFamily: FONT, fontSize: '15px', color: heroColor,
    })));
    layer.add(this.add.text(80, 42, `${HERO_ROLE[hero.id] ?? ''}  ·  choose a talent${left > 0 ? `  (${left} more after this)` : ''}`, sharpText({
      fontFamily: FONT, fontSize: '9px', color: '#8a93b8',
    })));

    const count = this.choices.length;
    const gap = 12;
    const cardW = count >= 4 ? 140 : 176;
    const cardH = 176;
    const total = count * cardW + (count - 1) * gap;
    const x0 = (GAME.width - total) / 2;
    const top = 76;

    this.choices.forEach((talent, i) => {
      const x = x0 + i * (cardW + gap);
      const color = Phaser.Display.Color.HexStringToColor(talentKindColor(talent)).color;
      const glow = this.add.rectangle(x - 3, top - 3, cardW + 6, cardH + 6, color, 0.12).setOrigin(0, 0);
      const frame = this.add.rectangle(x, top, cardW, cardH, 0x0d1024, 0.98).setOrigin(0, 0)
        .setStrokeStyle(2, color, 0.9).setInteractive({ useHandCursor: true });
      const kind = this.add.text(x + cardW / 2, top + 16, talentKindLabel(talent), sharpText({
        fontFamily: FONT, fontSize: '8px', color: talentKindColor(talent),
      })).setOrigin(0.5);
      const name = this.add.text(x + cardW / 2, top + 36, talent.name, sharpText({
        fontFamily: FONT, fontSize: '13px', color: '#eef2ff', align: 'center', wordWrap: { width: cardW - 16 },
      })).setOrigin(0.5, 0);
      const desc = this.add.text(x + cardW / 2, top + 84, talent.desc, sharpText({
        fontFamily: FONT, fontSize: '9px', color: '#c9cee8', align: 'center', lineSpacing: 4, wordWrap: { width: cardW - 20 },
      })).setOrigin(0.5, 0);
      layer.add([glow, frame, kind, name, desc]);
      for (const obj of [glow, frame, kind, name, desc]) {
        const target = obj === glow ? 0.12 : 1;
        obj.setAlpha(0);
        this.tweens.add({ targets: obj, alpha: target, duration: 220, delay: 80 + i * 90 });
      }
      frame.on('pointerdown', () => {
        this.index = i;
        this.updateSelection();
        this.choose();
      });
      this.cards.push({ frame, glow, color });
    });

    // The hero's current kit, so the pick is made knowing what it adds to.
    const kit = hero.spells.map((id) => SPELLS[id]?.name ?? id).join(' · ');
    layer.add(this.add.text(GAME.width / 2, top + cardH + 18, `Skills: ${kit || '—'}`, sharpText({
      fontFamily: FONT, fontSize: '8px', color: '#a8d8ff', align: 'center', wordWrap: { width: GAME.width - 60 },
    })).setOrigin(0.5, 0));

    const rerolls = run.rerolls;
    const hint = isTouchDevice()
      ? (rerolls > 0 ? `Tap a card  ·  B: reroll (${rerolls} left)` : 'Tap a card')
      : `← →  choose   Z  take${rerolls > 0 ? `   X  reroll (${rerolls} left)` : ''}`;
    layer.add(this.add.text(GAME.width / 2, GAME.height - 22, hint, sharpText({
      fontFamily: FONT, fontSize: '9px', color: '#6cf0c2',
    })).setOrigin(0.5));

    this.updateSelection();
  }

  private move(dir: number) {
    if (this.locked || this.cards.length === 0) return;
    this.index = (this.index + dir + this.cards.length) % this.cards.length;
    sfx.play('cursor');
    this.updateSelection();
  }

  private updateSelection() {
    this.cards.forEach((card, i) => {
      const selected = i === this.index;
      card.frame.setStrokeStyle(selected ? 3 : 2, selected ? 0xffffff : card.color, selected ? 1 : 0.7);
      card.glow.setFillStyle(card.color, selected ? 0.32 : 0.1);
    });
  }

  private reroll() {
    if (this.locked) return;
    if (!useReroll()) { sfx.play('cancel'); return; }
    sfx.play('magic');
    this.choices = rollTalentsFor(this.heroId);
    this.index = 0;
    this.render();
  }

  private choose() {
    if (this.locked) return;
    const talent = this.choices[this.index];
    if (!talent) return;
    this.locked = true;
    pickTalent(this.heroId, talent.id);
    sfx.play('levelup');
    const card = this.cards[this.index];
    this.tweens.add({ targets: [card.frame, card.glow], scaleX: 1.05, scaleY: 1.05, duration: 110, yoyo: true });
    const flash = this.add.rectangle(0, 0, GAME.width, GAME.height, 0xffffff, 0.16).setOrigin(0, 0).setDepth(10);
    this.tweens.add({ targets: flash, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
    this.time.delayedCall(380, () => this.nextHero());
  }

  private finish() {
    input.releaseAll();
    const onDone = this.onDone;
    this.scene.stop();
    onDone?.();
  }
}
