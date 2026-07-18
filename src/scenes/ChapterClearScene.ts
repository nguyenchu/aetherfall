import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { input } from '../game/input';
import { sfx } from '../audio/music';
import { sharpText, FONT } from '../ui/text';

const CX = GAME.width / 2;
const CY = GAME.height / 2;

interface ChapterClearData {
  chapter: number;   // chapter 1..4, or (rift) the tier just reached
  accent: number;    // area theme accent color
  areaName: string;  // e.g. "Ashenveil Forest"
  rift?: boolean;    // a procedural Rift clear rather than a story chapter
  onDone: () => void;
}

/**
 * Story interstitial played after a chapter boss falls, between the victory
 * dialogue and the return to Sanctuary. A cracked anchor crystal re-lights and
 * blooms outward — the visual promise the intro made ("the twelve anchors began
 * to fail") being paid back, one anchor at a time. Any key/tap skips ahead.
 */
export class ChapterClearScene extends Phaser.Scene {
  private payload!: ChapterClearData;
  private leaving = false;
  private unsubs: (() => void)[] = [];

  constructor() {
    super('ChapterClear');
  }

  // What waits past each cleared chapter — a forward pull toward the next.
  private static readonly TEASE: Record<number, string> = {
    1: 'North of the forest, the Sunken City lies drowned and waiting.',
    2: 'Past the water, the Ashen Wastes still burn.',
    3: 'Only the Crystal Depths remain between you and the dark.',
    4: 'The last anchor is yours to hold.',
  };

  create() {
    this.payload = this.scene.settings.data as ChapterClearData;
    this.leaving = false;
    this.unsubs = [];
    input.releaseAll();

    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(400, 7, 6, 14);
    this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg).setOrigin(0, 0).setDepth(0);

    const accent = this.payload.accent;
    const rift = this.payload.rift === true;
    const isFinal = !rift && this.payload.chapter >= 4;

    // Drifting motes for atmosphere.
    for (let i = 0; i < 40; i++) {
      const m = this.add.circle(
        Phaser.Math.Between(0, GAME.width), Phaser.Math.Between(0, GAME.height),
        Phaser.Math.FloatBetween(0.5, 1.6), accent, 0,
      ).setDepth(1);
      this.tweens.add({
        targets: m, alpha: Phaser.Math.FloatBetween(0.2, 0.6), y: m.y - Phaser.Math.Between(10, 30),
        duration: Phaser.Math.Between(1800, 3600), delay: Phaser.Math.Between(0, 1400),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    const crystal = this.buildCrystal(CX, CY - 18, accent);
    crystal.setAlpha(0);
    this.tweens.add({ targets: crystal, alpha: 1, duration: 900, delay: 300, ease: 'Sine.easeOut' });

    // A crack across the crystal, healing as the anchor re-lights.
    const crack = this.add.graphics().setDepth(13);
    crack.lineStyle(1.5, 0x05060e, 0.9);
    crack.beginPath();
    crack.moveTo(CX - 6, CY - 42);
    crack.lineTo(CX + 4, CY - 14);
    crack.lineTo(CX - 4, CY + 8);
    crack.lineTo(CX + 6, CY + 30);
    crack.strokePath();
    this.tweens.add({ targets: crack, alpha: 0, duration: 1100, delay: 1300, ease: 'Sine.easeIn' });

    // The re-light: a soft flash, expanding bloom rings, a rising chime.
    this.time.delayedCall(1300, () => {
      sfx.play('levelup');
      const flash = this.add.circle(CX, CY - 18, 6, 0xffffff, 0.9).setDepth(20);
      this.tweens.add({ targets: flash, scale: 26, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
      for (let i = 0; i < 3; i++) {
        const ring = this.add.circle(CX, CY - 18, 8, accent, 0.5).setDepth(5);
        this.tweens.add({
          targets: ring, scale: 10 + i * 4, alpha: 0,
          duration: 1500, delay: i * 220, ease: 'Cubic.easeOut', onComplete: () => ring.destroy(),
        });
      }
    });

    // Text beats.
    const hex = '#' + accent.toString(16).padStart(6, '0');
    const kicker = this.add.text(CX, CY + 44, rift ? `TIER ${this.payload.chapter} REACHED` : `CHAPTER ${this.payload.chapter} CLEARED`,
      sharpText({ fontFamily: FONT, fontSize: '10px', color: '#8a93b8', align: 'center' }))
      .setOrigin(0.5).setDepth(30).setAlpha(0);
    this.tweens.add({ targets: kicker, alpha: 1, duration: 700, delay: 1700 });

    const title = this.add.text(CX, CY + 66, rift ? 'THE RIFT COLLAPSES' : isFinal ? 'THE LAST ANCHOR HOLDS' : 'THE ANCHOR HOLDS',
      sharpText({ fontFamily: FONT, fontSize: '18px', color: '#ffffff', strokeThickness: 3, align: 'center' }))
      .setOrigin(0.5).setDepth(30).setAlpha(0).setScale(1.25);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 650, delay: 2200, ease: 'Back.easeOut' });

    const place = this.add.text(CX, CY + 90, rift ? 'The Rift yields — for now.' : `${this.payload.areaName} — reclaimed from the dark`,
      sharpText({ fontFamily: FONT, fontSize: '10px', color: hex, align: 'center' }))
      .setOrigin(0.5).setDepth(30).setAlpha(0);
    this.tweens.add({ targets: place, alpha: 1, duration: 700, delay: 3000 });

    const teaseText = rift
      ? 'The Anchor will tear open again — deeper, and hungrier.'
      : ChapterClearScene.TEASE[this.payload.chapter] ?? '';
    const tease = this.add.text(CX, CY + 116, teaseText,
      sharpText({ fontFamily: FONT, fontSize: '9px', color: '#c9cee8', align: 'center', wordWrap: { width: GAME.width - 80 } }))
      .setOrigin(0.5).setDepth(30).setAlpha(0);
    this.tweens.add({ targets: tease, alpha: 1, duration: 800, delay: 4000 });

    const hint = this.add.text(CX, GAME.height - 16, 'Z / tap  ·  continue',
      sharpText({ fontFamily: FONT, fontSize: '8px', color: '#5a6178', align: 'center' }))
      .setOrigin(0.5).setDepth(30).setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 1, duration: 600, delay: 4600 });

    // Auto-advance, or let the player skip once the beats have landed.
    this.time.delayedCall(700, () => {
      this.unsubs.push(input.on('confirm', () => this.finish()));
      this.unsubs.push(input.on('cancel', () => this.finish()));
    });
    this.time.delayedCall(7200, () => this.finish());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
  }

  /** A floating cut-crystal diamond, tinted toward the chapter's accent. */
  private buildCrystal(x: number, y: number, accent: number): Phaser.GameObjects.Container {
    const g = this.add.graphics().setDepth(10);
    for (let i = 4; i > 0; i--) {
      g.fillStyle(accent, 0.06 * i);
      g.fillTriangle(x, y - 30 - i * 4, x - 15 - i * 2, y + 11, x + 15 + i * 2, y + 11);
      g.fillTriangle(x, y + 30 + i * 4, x - 15 - i * 2, y - 11, x + 15 + i * 2, y - 11);
    }
    g.fillStyle(accent, 0.9);
    g.fillTriangle(x, y - 30, x - 14, y + 11, x + 14, y + 11);
    g.fillStyle(0xffffff, 0.35);
    g.fillTriangle(x, y - 30, x, y + 2, x + 14, y + 11);
    g.fillStyle(accent, 0.9);
    g.fillTriangle(x, y + 30, x - 14, y - 11, x + 14, y - 11);
    g.fillStyle(0xffffff, 0.3);
    g.fillTriangle(x, y + 30, x, y - 2, x + 14, y - 11);

    const glow = this.add.circle(x, y, 8, 0xffffff, 0.85).setDepth(11);
    this.tweens.add({ targets: glow, alpha: { from: 0.85, to: 0.3 }, duration: 800, yoyo: true, repeat: -1 });

    const container = this.add.container(0, 0, [g, glow]).setDepth(10);
    this.tweens.add({ targets: container, y: { from: 4, to: -4 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return container;
  }

  private finish() {
    if (this.leaving) return;
    this.leaving = true;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.cameras.main.fadeOut(500, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const done = this.payload.onDone;
      this.scene.stop();
      done();
    });
  }
}
