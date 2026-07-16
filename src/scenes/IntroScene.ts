import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { sharpText, FONT } from '../ui/text';

const CX = GAME.width / 2;
const CY = GAME.height / 2;

/**
 * Cinematic intro sequence before the title screen.
 * Runs ~35 seconds. Any key or tap skips immediately to Title.
 *
 * Sequence:
 *  0 s    — black void, stars drift in
 *  3 s    — Aether crystal forms at center, text: "In the age of light…"
 *  9.5 s  — crystal flickers, text: "Then it fell."
 * 12.5 s  — crystal shatters into 12 shards
 * 17 s    — particle rain, text: "The twelve anchors began to fail."
 * 22 s    — rain slows, single warm glow, text: "Sanctuary."
 * 29 s    — three silhouettes, text: "You are its last hope."
 * 34 s    — fade to black → TitleScene
 */
export class IntroScene extends Phaser.Scene {
  private done = false;

  constructor() {
    super('Intro');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);

    this.input.once('pointerdown', () => this.skip());
    this.input.keyboard?.once('keydown', () => this.skip());

    this.seq0_void();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private after(ms: number, fn: () => void) {
    this.time.delayedCall(ms, fn);
  }

  private caption(text: string, y: number, color = '#dfe4f5', size = '13px'): Phaser.GameObjects.Text {
    return this.add.text(CX, y, text, sharpText({ fontFamily: FONT, fontSize: size, color, align: 'center', wordWrap: { width: GAME.width - 80 } }))
      .setOrigin(0.5).setDepth(30).setAlpha(0);
  }

  private fadeIn(obj: Phaser.GameObjects.GameObject & { alpha: number }, dur = 800) {
    this.tweens.add({ targets: obj, alpha: 1, duration: dur, ease: 'Sine.easeOut' });
  }

  private fadeOut(obj: Phaser.GameObjects.GameObject & { alpha: number }, dur = 600) {
    this.tweens.add({ targets: obj, alpha: 0, duration: dur, ease: 'Sine.easeIn' });
  }

  private skip() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(300, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
  }

  // ── Phase 0: black void, stars drift in ───────────────────────────────────

  private seq0_void() {
    this.add.rectangle(0, 0, GAME.width, GAME.height, 0x07060e).setOrigin(0, 0).setDepth(0);

    const stars: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 90; i++) {
      const x = Phaser.Math.Between(4, GAME.width - 4);
      const y = Phaser.Math.Between(4, GAME.height - 4);
      const r = Phaser.Math.FloatBetween(0.5, 1.8);
      const color = [0xdfe4f5, 0x8a6cf0, 0x6cf0c2][i % 3];
      const star = this.add.circle(x, y, r, color, 0).setDepth(1);
      stars.push(star);
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.3, 0.9),
        duration: Phaser.Math.Between(600, 1400),
        delay: Phaser.Math.Between(0, 1800),
        ease: 'Sine.easeOut',
      });
    }

    // Gentle star twinkle
    this.time.addEvent({
      delay: 2200,
      callback: () => {
        for (const s of stars) {
          this.tweens.add({
            targets: s, alpha: { from: s.alpha, to: Phaser.Math.FloatBetween(0.15, 0.95) },
            duration: Phaser.Math.Between(1200, 3000), yoyo: true, repeat: -1,
            delay: Phaser.Math.Between(0, 2000),
          });
        }
      },
    });

    this.after(3000, () => this.seq1_crystal());
  }

  // ── Phase 1: crystal forms, first text ───────────────────────────────────

  private seq1_crystal() {
    const crystal = this.buildCrystal(CX, CY - 10);

    const t1 = this.caption('In the age of light, Aether bound the world aloft.', CY + 60, '#dfe4f5', '12px');
    this.after(600, () => this.fadeIn(crystal, 1400));
    this.after(1300, () => this.fadeIn(t1, 1000));

    this.after(6500, () => {
      this.fadeOut(t1, 500);
      this.seq2_flicker(crystal);
    });
  }

  private buildCrystal(x: number, y: number): Phaser.GameObjects.Container {
    const g = this.add.graphics().setDepth(10);
    // Outer glow
    for (let i = 4; i > 0; i--) {
      g.fillStyle(0x8a6cf0, 0.06 * i);
      g.fillTriangle(x, y - 28 - i * 4, x - 14 - i * 2, y + 10, x + 14 + i * 2, y + 10);
      g.fillTriangle(x, y + 28 + i * 4, x - 14 - i * 2, y - 10, x + 14 + i * 2, y - 10);
    }
    // Crystal body
    g.fillStyle(0x6c44cc, 0.9);
    g.fillTriangle(x, y - 28, x - 13, y + 10, x + 13, y + 10);
    g.fillStyle(0x8a6cf0, 0.95);
    g.fillTriangle(x, y - 28, x, y + 2, x + 13, y + 10);
    g.fillStyle(0xaad4ff, 1);
    g.fillTriangle(x - 4, y - 22, x - 12, y + 8, x, y + 1);
    g.fillStyle(0x6c44cc, 0.9);
    g.fillTriangle(x, y + 28, x - 13, y - 10, x + 13, y - 10);
    g.fillStyle(0x8a6cf0, 0.95);
    g.fillTriangle(x, y + 28, x, y - 2, x + 13, y - 10);
    g.fillStyle(0xaad4ff, 1);
    g.fillTriangle(x - 4, y + 22, x - 12, y - 8, x, y - 1);

    // Inner light
    const glow = this.add.circle(x, y, 7, 0xeef2ff, 0.8).setDepth(11);
    this.tweens.add({ targets: glow, alpha: { from: 0.8, to: 0.25 }, duration: 700, yoyo: true, repeat: -1 });

    const container = this.add.container(0, 0, [g, glow]).setDepth(10).setAlpha(0);
    this.tweens.add({ targets: container, y: { from: 4, to: -4 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return container;
  }

  // ── Phase 2: crystal flickers ────────────────────────────────────────────

  private seq2_flicker(crystal: Phaser.GameObjects.Container) {
    const t2 = this.caption('Then it fell.', CY + 60, '#ff9a9a', '18px');
    this.fadeIn(t2, 600);

    // Flicker the crystal
    let count = 0;
    const flicker = this.time.addEvent({
      delay: 160,
      repeat: 12,
      callback: () => {
        count++;
        crystal.setAlpha(count % 2 === 0 ? 0.2 : 1);
      },
    });

    this.after(3000, () => {
      flicker.remove();
      this.fadeOut(t2, 400);
      this.seq3_shatter(crystal);
    });
  }

  // ── Phase 3: crystal shatters ────────────────────────────────────────────

  private seq3_shatter(crystal: Phaser.GameObjects.Container) {
    crystal.setAlpha(0);

    // Flash
    const flash = this.add.rectangle(0, 0, GAME.width, GAME.height, 0xeef2ff, 0.85).setOrigin(0, 0).setDepth(25);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, ease: 'Expo.easeOut', onComplete: () => flash.destroy() });

    // Shards fly out
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const dist = Phaser.Math.Between(60, 180);
      const shard = this.add.rectangle(CX, CY - 10, Phaser.Math.Between(4, 10), Phaser.Math.Between(2, 6),
        i % 3 === 0 ? 0xaad4ff : i % 3 === 1 ? 0x8a6cf0 : 0xeef2ff, 1)
        .setAngle(Phaser.Math.Between(0, 360)).setDepth(12);
      this.tweens.add({
        targets: shard,
        x: CX + Math.cos(angle) * dist,
        y: (CY - 10) + Math.sin(angle) * dist,
        alpha: 0,
        angle: shard.angle + Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(900, 1800),
        ease: 'Quad.easeOut',
        onComplete: () => shard.destroy(),
      });
    }

    const t3 = this.caption('The twelve anchors of the world began to fail.', CY + 60, '#c9cee8', '11px');
    this.after(700, () => this.fadeIn(t3, 900));
    this.after(4500, () => { this.fadeOut(t3, 500); this.seq4_rain(); });
  }

  // ── Phase 4: world sinking, particle rain ────────────────────────────────

  private seq4_rain() {
    const rainParticles: Phaser.GameObjects.Arc[] = [];
    const rain = this.time.addEvent({
      delay: 55,
      repeat: 90,
      callback: () => {
        const x = Phaser.Math.Between(0, GAME.width);
        const p = this.add.circle(x, -4, Phaser.Math.FloatBetween(0.8, 2.2), 0x8a6cf0, 0.7).setDepth(5);
        rainParticles.push(p);
        this.tweens.add({
          targets: p, y: GAME.height + 10, alpha: 0,
          duration: Phaser.Math.Between(1400, 2400), ease: 'Linear',
          onComplete: () => p.destroy(),
        });
      },
    });

    const t4 = this.caption('One by one, the lands sank into the deep.', CY + 50, '#8a93b8', '11px');
    this.after(600, () => this.fadeIn(t4, 900));

    this.after(5000, () => {
      rain.remove();
      this.fadeOut(t4, 500);
      this.seq5_sanctuary();
    });
  }

  // ── Phase 5: single sanctuary glow ───────────────────────────────────────

  private seq5_sanctuary() {
    // Warm glow at center
    const glowColors = [0xf0d36c, 0xfff0aa, 0xf0d36c];
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(CX, CY - 20, 6 + i * 18, glowColors[i], 0.12 - i * 0.03).setDepth(8);
      this.tweens.add({
        targets: ring, scale: { from: 0.6, to: 1.2 }, alpha: { from: 0.18 - i * 0.04, to: 0.04 },
        duration: 1800, yoyo: true, repeat: -1, delay: i * 260, ease: 'Sine.easeInOut',
      });
    }
    const core = this.add.circle(CX, CY - 20, 5, 0xfff0aa, 0).setDepth(9);
    this.fadeIn(core, 1000);
    this.tweens.add({ targets: core, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1, delay: 1000 });

    const t5a = this.caption('One crystal holds.', CY + 30, '#f0d36c', '13px');
    const t5b = this.caption('One city stands.', CY + 52, '#f0d36c', '13px');
    const t5c = this.caption('S A N C T U A R Y', CY + 80, '#dfe4f5', '16px');
    this.after(1000, () => this.fadeIn(t5a, 800));
    this.after(2200, () => this.fadeIn(t5b, 800));
    this.after(3200, () => this.fadeIn(t5c, 1100));

    this.after(7000, () => {
      [t5a, t5b, t5c].forEach((t) => this.fadeOut(t, 400));
      this.seq6_heroes();
    });
  }

  // ── Phase 6: three silhouettes + call to arms ─────────────────────────────

  private seq6_heroes() {
    const positions = [CX - 48, CX, CX + 48];
    const colors = [0x6cf0c2, 0x8a6cf0, 0xf0d36c];
    positions.forEach((x, i) => {
      const figure = this.add.graphics().setDepth(10).setAlpha(0);
      figure.fillStyle(colors[i], 0.85);
      // Simple humanoid silhouette: head + body
      figure.fillCircle(x, CY + 10, 7);
      figure.fillRect(x - 6, CY + 17, 12, 18);
      figure.fillRect(x - 10, CY + 19, 6, 10);
      figure.fillRect(x + 4, CY + 19, 6, 10);
      figure.fillRect(x - 5, CY + 35, 5, 12);
      figure.fillRect(x + 1, CY + 35, 5, 12);
      this.tweens.add({
        targets: figure, alpha: 1,
        duration: 600, delay: i * 280, ease: 'Sine.easeOut',
      });
      // Subtle float
      this.tweens.add({
        targets: figure, y: { from: 0, to: -4 },
        duration: 2000 + i * 300, yoyo: true, repeat: -1,
        delay: i * 400, ease: 'Sine.easeInOut',
      });
    });

    const t6 = this.caption('And you are its last hope.', CY + 90, '#dfe4f5', '13px');
    this.after(1400, () => this.fadeIn(t6, 900));

    this.after(4500, () => {
      this.fadeOut(t6, 500);
      this.after(800, () => this.seq7_end());
    });
  }

  // ── Phase 7: fade to title ─────────────────────────────────────────────────

  private seq7_end() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(1100, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
  }
}
