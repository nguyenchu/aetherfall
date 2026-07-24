import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { sharpText, FONT } from '../ui/text';

const CX = GAME.width / 2;
const CY = GAME.height / 2;

/**
 * Cinematic intro sequence before the title screen.
 * Runs ~170 seconds. Any key or tap skips immediately to Title.
 *
 * The heroes come first, so the animation the story is really about is what you
 * see up front; the world's history plays afterward as the flashback that
 * explains what they are fighting for.
 *
 * Act I — the heroes (who they are, why they gathered):
 *  0 s     — black void, stars drift in
 *  2.6 s   — cold open: "The world was going dark…" → "But three did not turn away."
 * 11 s     — Kael: a watch-line of eight marches into a forest gate; seven are
 *            snuffed out, only Kael turns back.
 * 28 s     — Lyra: reaches for a failing anchor; it shatters anyway; a spark
 *            rekindles in her hand — her vow.
 * 46 s     — Mira: a flame is handed down a line of kneeling Wardens; she rises
 *            and lifts it to the sigil.
 * 64 s     — the three walk in and converge under a warm halo, then a pivot:
 *            "…to know what they are fighting for, you have to know what was lost."
 *
 * Act II — the world (the flashback that explains the stakes):
 * 78 s     — Aether crystal forms: "In the age of light…" then "Twelve anchors…"
 * 91 s     — a ring of twelve lights: "Sanctuary was only one light among many."
 *          — flicker → shatter → four ruins → particle rain → the Wardens' vigil
 *          — single warm glow: "Sanctuary." → watchers sent out, not all came home
 * ~163 s   — "And you are its last hope." → fade to black → TitleScene
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

  /** Draws a simple humanoid silhouette around a local (0,0) origin, so it can
   *  be wrapped in a container and moved/scaled as one. Used by every vignette. */
  private drawHero(color: number, s = 1, alpha = 0.85): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(color, alpha);
    g.fillCircle(0, 10 * s, 7 * s);            // head
    g.fillRect(-6 * s, 17 * s, 12 * s, 18 * s); // torso
    g.fillRect(-10 * s, 19 * s, 6 * s, 10 * s); // left arm
    g.fillRect(4 * s, 19 * s, 6 * s, 10 * s);   // right arm
    g.fillRect(-5 * s, 35 * s, 5 * s, 12 * s);  // left leg
    g.fillRect(1 * s, 35 * s, 5 * s, 12 * s);   // right leg
    return g;
  }

  /** Fades out and destroys everything a vignette built, then runs the next
   *  phase. Kills any looping tweens first so they don't fight the fade. */
  private sweep(objs: Array<Phaser.GameObjects.GameObject & { alpha: number }>, next: () => void, dur = 700) {
    const alive = objs.filter((o) => o.active);
    if (alive.length === 0) { next(); return; }
    alive.forEach((o) => this.tweens.killTweensOf(o));
    this.tweens.add({
      targets: alive, alpha: 0, duration: dur, ease: 'Sine.easeIn',
      onComplete: () => { alive.forEach((o) => o.destroy()); next(); },
    });
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

    this.after(2600, () => this.seqColdOpen());
  }

  // ── Cold open: set the stakes in two lines, then meet the heroes ──────────

  private seqColdOpen() {
    const objs: Array<Phaser.GameObjects.GameObject & { alpha: number }> = [];
    const t1 = this.caption('The world was going dark, its lights going out one by one.', CY + 60, '#c9cee8', '12px');
    objs.push(t1);
    this.fadeIn(t1, 900);
    this.after(3600, () => this.fadeOut(t1, 500));

    this.after(4400, () => {
      const t2 = this.caption('But three did not turn away.', CY + 60, '#dfe4f5', '13px');
      objs.push(t2);
      this.fadeIn(t2, 900);
      this.after(3200, () => this.fadeOut(t2, 500));
    });

    this.after(8400, () => this.sweep(objs, () => this.seq6a_kael()));
  }

  // ── Phase 1: crystal forms, first text ───────────────────────────────────

  private seq1_crystal() {
    const crystal = this.buildCrystal(CX, CY - 10);

    const t1 = this.caption('In the age of light, Aether bound the world aloft.', CY + 60, '#dfe4f5', '12px');
    this.after(600, () => this.fadeIn(crystal, 1400));
    this.after(1300, () => this.fadeIn(t1, 1000));

    this.after(6000, () => {
      this.fadeOut(t1, 500);
      this.after(700, () => {
        const t1b = this.caption('Twelve anchors, woven of living crystal, held the realm above the dark.', CY + 60, '#dfe4f5', '12px');
        this.fadeIn(t1b, 1000);
        this.after(5500, () => {
          this.fadeOut(t1b, 500);
          this.after(600, () => this.seq1b_anchors(crystal));
        });
      });
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

  // ── Phase 1b: a ring of twelve lights forms around the crystal ──────────

  private seq1b_anchors(crystal: Phaser.GameObjects.Container) {
    const ring: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 - Math.PI / 2;
      const x = CX + Math.cos(angle) * 55;
      const y = (CY - 10) + Math.sin(angle) * 55;
      const light = this.add.circle(x, y, 3, 0xaad4ff, 0).setDepth(9);
      ring.push(light);
      this.tweens.add({ targets: light, alpha: 0.8, duration: 500, delay: i * 90, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: light, alpha: { from: 0.8, to: 0.4 }, duration: 1400, yoyo: true, repeat: -1, delay: 1200 + i * 90 });
    }

    const t1 = this.caption('Forests grew in their glow. Cities rose in their warmth.', CY + 60, '#dfe4f5', '12px');
    this.after(1600, () => this.fadeIn(t1, 900));

    this.after(4600, () => {
      this.fadeOut(t1, 500);
      this.after(700, () => {
        const t2 = this.caption('Sanctuary was only one light among many.', CY + 60, '#dfe4f5', '12px');
        this.fadeIn(t2, 900);
        this.after(3600, () => {
          this.fadeOut(t2, 500);
          this.seq2_flicker(crystal, ring);
        });
      });
    });
  }

  // ── Phase 2: crystal flickers ────────────────────────────────────────────

  private seq2_flicker(crystal: Phaser.GameObjects.Container, ring: Phaser.GameObjects.Arc[]) {
    const pre = this.caption('But light is not eternal.', CY + 60, '#c9cee8', '12px');
    this.fadeIn(pre, 700);

    this.after(2600, () => {
      this.fadeOut(pre, 500);
      this.after(600, () => {
        const t2 = this.caption('Then it fell.', CY + 60, '#ff9a9a', '18px');
        this.fadeIn(t2, 600);

        // Flicker the crystal and the ring of anchors together
        let count = 0;
        const flicker = this.time.addEvent({
          delay: 160,
          repeat: 14,
          callback: () => {
            count++;
            crystal.setAlpha(count % 2 === 0 ? 0.2 : 1);
            for (let i = 0; i < ring.length; i++) {
              ring[i].setAlpha(count % 2 === 0 ? 0.1 : (i % 2 === 0 ? 0.7 : 0.4));
            }
          },
        });

        this.after(3200, () => {
          flicker.remove();
          this.fadeOut(t2, 400);
          this.seq3_shatter(crystal, ring);
        });
      });
    });
  }

  // ── Phase 3: crystal shatters ────────────────────────────────────────────

  private seq3_shatter(crystal: Phaser.GameObjects.Container, ring: Phaser.GameObjects.Arc[]) {
    crystal.setAlpha(0);
    for (const light of ring) {
      this.tweens.add({ targets: light, alpha: 0, duration: 500, onComplete: () => light.destroy() });
    }

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

    const t3 = this.caption('The twelve anchors began to fail, one by one.', CY + 60, '#c9cee8', '11px');
    this.after(700, () => this.fadeIn(t3, 900));
    this.after(4500, () => { this.fadeOut(t3, 500); this.seq3b_fragments(); });
  }

  // ── Phase 3b: the fallen anchors scatter into four kinds of ruin ────────

  private seq3b_fragments() {
    const beats: Array<{ text: string; color: number; angle: number }> = [
      { text: 'Some sank into forests that forgot the sun.', color: 0x4aaa5a, angle: Math.PI * 1.25 },
      { text: 'Some drowned beneath seas that never settled.', color: 0x3a7a9a, angle: Math.PI * 1.75 },
      { text: 'Some smoldered in ash where the fire never sleeps.', color: 0xcc4411, angle: Math.PI * 0.25 },
      { text: 'Some cracked into crystal, sharp and endless.', color: 0x8a4ae0, angle: Math.PI * 0.75 },
    ];

    const runBeat = (i: number) => {
      if (i >= beats.length) {
        this.after(600, () => this.seq4_rain());
        return;
      }
      const b = beats[i];
      for (let p = 0; p < 10; p++) {
        const spread = Phaser.Math.FloatBetween(-0.3, 0.3);
        const dist = Phaser.Math.Between(40, 120);
        const shard = this.add.circle(CX, CY - 10, Phaser.Math.FloatBetween(1.5, 3.5), b.color, 0.85).setDepth(11);
        this.tweens.add({
          targets: shard,
          x: CX + Math.cos(b.angle + spread) * dist,
          y: (CY - 10) + Math.sin(b.angle + spread) * dist,
          alpha: 0,
          duration: Phaser.Math.Between(1600, 2400),
          ease: 'Sine.easeOut',
          onComplete: () => shard.destroy(),
        });
      }
      const t = this.caption(b.text, CY + 60, '#c9cee8', '11px');
      this.after(300, () => this.fadeIn(t, 800));
      this.after(2800, () => {
        this.fadeOut(t, 500);
        this.after(500, () => runBeat(i + 1));
      });
    };

    runBeat(0);
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

    const t4 = this.caption('One by one, the lands sank into the deep, and the sky itself grew hollow.', CY + 50, '#8a93b8', '11px');
    this.after(600, () => this.fadeIn(t4, 900));

    this.after(5000, () => {
      rain.remove();
      this.fadeOut(t4, 500);
      this.seq4b_wardens();
    });
  }

  // ── Phase 4b: the Wardens' vigil ─────────────────────────────────────────

  private seq4b_wardens() {
    const g = this.add.graphics().setDepth(10).setAlpha(0);
    g.lineStyle(2, 0xf0d36c, 0.9);
    g.strokeCircle(CX, CY - 10, 18);
    g.lineBetween(CX, CY - 28, CX, CY + 8);
    g.lineBetween(CX - 14, CY - 10, CX + 14, CY - 10);
    this.fadeIn(g, 1000);
    this.after(1000, () => {
      this.tweens.add({ targets: g, alpha: { from: 0.9, to: 0.5 }, duration: 1600, yoyo: true, repeat: -1 });
    });

    const t1 = this.caption('Only the Wardens remained, sworn to keep what little light was left.', CY + 60, '#f0d36c', '12px');
    this.after(1200, () => this.fadeIn(t1, 900));

    this.after(4600, () => {
      this.fadeOut(t1, 500);
      this.after(700, () => {
        const t2 = this.caption('Generation after generation, they stood watch at the gates of the last anchor.', CY + 60, '#f0d36c', '12px');
        this.fadeIn(t2, 900);
        this.after(4200, () => {
          this.fadeOut(t2, 500);
          this.fadeOut(g, 600);
          this.after(700, () => this.seq5_sanctuary());
        });
      });
    });
  }

  // ── Phase 5: single sanctuary glow ───────────────────────────────────────

  private seq5_sanctuary() {
    const t0 = this.caption('Around that one light, a city grew — the last of its kind in a darkened world.', CY + 60, '#dfe4f5', '12px');
    this.fadeIn(t0, 900);

    this.after(3600, () => {
      this.fadeOut(t0, 500);
      this.after(500, () => this.seq5_glow());
    });
  }

  private seq5_glow() {
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
      this.seq5b_watchers();
    });
  }

  // ── Phase 5b: watchers sent out to the other anchors ─────────────────────

  private seq5b_watchers() {
    const figure = this.add.graphics().setDepth(10).setAlpha(0);
    figure.fillStyle(0xdfe4f5, 0.85);
    figure.fillCircle(CX, CY + 4, 6);
    figure.fillRect(CX - 5, CY + 10, 10, 16);
    this.fadeIn(figure, 800);

    const t1 = this.caption('From Sanctuary, watchers were sent to the other anchors, to see what could still be saved.', CY + 60, '#c9cee8', '11px');
    this.after(1000, () => this.fadeIn(t1, 900));

    this.after(4200, () => {
      this.fadeOut(t1, 500);
      this.tweens.add({ targets: figure, x: -70, alpha: 0, duration: 2200, ease: 'Sine.easeIn' });

      this.after(1400, () => {
        const t2 = this.caption('Not all of them came home.', CY + 60, '#8a93b8', '13px');
        this.fadeIn(t2, 900);
        this.after(3400, () => {
          this.fadeOut(t2, 500);
          this.after(700, () => this.seqClose());
        });
      });
    });
  }

  // ── Phase 6a: Kael — the watch-line that never came back ─────────────────

  private seq6a_kael() {
    const objs: Array<Phaser.GameObjects.GameObject & { alpha: number }> = [];
    const TEAL = 0x6cf0c2;
    const gx = CX + 96, gy = CY - 4;

    // A dark forest gate on the right, with a sickly glow in the doorway.
    const gate = this.add.graphics().setDepth(8).setAlpha(0);
    gate.fillStyle(0x0e1f15, 0.95);
    gate.fillRect(gx - 4, gy - 44, 8, 96);
    gate.fillRect(gx - 46, gy - 44, 8, 96);
    gate.fillRect(gx - 46, gy - 48, 50, 8);
    gate.fillStyle(0x1c3f27, 0.6);
    gate.fillRect(gx - 38, gy - 40, 34, 92);
    objs.push(gate);
    this.fadeIn(gate, 900);

    const t1 = this.caption('Kael led a watch-line of eight into Ashenveil.', CY + 74, '#6cf0c2', '12px');
    objs.push(t1);
    this.after(700, () => this.fadeIn(t1, 900));

    // Seven watchers march in from the left and are snuffed out at the gate.
    for (let i = 0; i < 7; i++) {
      const g = this.drawHero(TEAL, 0.5);
      const c = this.add.container(-40 - i * 24, gy + 12, [g]).setDepth(10).setAlpha(0);
      objs.push(c);
      const bob = this.tweens.add({ targets: g, y: '-=2', duration: 170, yoyo: true, repeat: -1, delay: i * 40, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: c, alpha: 1, duration: 500, delay: 1600 + i * 110 });
      this.tweens.add({
        targets: c, x: gx - 22, duration: 4800, delay: 1600 + i * 110, ease: 'Sine.easeIn',
        onComplete: () => {
          bob.remove();
          this.tweens.add({ targets: c, alpha: 0, y: c.y - 6, duration: 700, ease: 'Sine.easeIn' });
          const ember = this.add.circle(gx - 22, gy + 6, 2, TEAL, 0.9).setDepth(11);
          objs.push(ember);
          this.tweens.add({ targets: ember, y: gy - 34, alpha: 0, duration: 950, ease: 'Sine.easeOut', onComplete: () => ember.destroy() });
        },
      });
    }

    // Kael stops short of the gate, then turns back.
    const kg = this.drawHero(TEAL, 0.5);
    const kael = this.add.container(-70, gy + 12, [kg]).setDepth(11).setAlpha(0);
    objs.push(kael);
    const kbob = this.tweens.add({ targets: kg, y: '-=2', duration: 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: kael, alpha: 1, duration: 500, delay: 1600 });
    this.tweens.add({
      targets: kael, x: gx - 64, duration: 4200, delay: 1600, ease: 'Sine.easeOut',
      onComplete: () => kbob.remove(),
    });

    this.after(5400, () => { this.fadeOut(t1, 500); });
    this.after(6000, () => {
      const t2 = this.caption('One by one, the forest took them.', CY + 74, '#8a93b8', '12px');
      objs.push(t2);
      this.fadeIn(t2, 900);
      this.after(4200, () => this.fadeOut(t2, 500));
    });

    // Kael turns and walks back out, alone.
    this.after(8600, () => {
      const kbob2 = this.tweens.add({ targets: kg, y: '-=2', duration: 190, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({
        targets: kael, x: CX - 30, duration: 3200, ease: 'Sine.easeInOut',
        onComplete: () => kbob2.remove(),
      });
    });

    this.after(11000, () => {
      const t3 = this.caption('Only Kael walked out — and he never learned what took the other seven.', CY + 74, '#6cf0c2', '11px');
      objs.push(t3);
      this.fadeIn(t3, 1200);
    });

    this.after(17200, () => this.sweep(objs, () => this.seq6b_lyra()));
  }

  // ── Phase 6b: Lyra — the light she could not hold ────────────────────────

  private seq6b_lyra() {
    const objs: Array<Phaser.GameObjects.GameObject & { alpha: number }> = [];
    const PURPLE = 0x8a6cf0;
    const ax = CX, ay = CY - 46;

    // A failing anchor above, a lone hexweaver reaching for it from below.
    const crystal = this.buildCrystal(ax, ay);
    objs.push(crystal);
    this.fadeIn(crystal, 1200);

    const lg = this.drawHero(PURPLE, 0.85);
    lg.fillStyle(PURPLE, 0.85);
    lg.fillRect(-2, -10, 4, 30); // raised arm reaching up toward the anchor
    const lyra = this.add.container(ax, CY + 8, [lg]).setDepth(10).setAlpha(0);
    objs.push(lyra);
    this.after(600, () => this.fadeIn(lyra, 900));

    const t1 = this.caption('Lyra once stood beneath a failing anchor, hands raised to hold its light.', CY + 78, '#8a6cf0', '11px');
    objs.push(t1);
    this.after(900, () => this.fadeIn(t1, 900));

    // Aether motes drift up from her hands toward the crystal.
    const rise = this.time.addEvent({
      delay: 260, repeat: 16,
      callback: () => {
        const mx = ax + Phaser.Math.Between(-10, 10);
        const m = this.add.circle(mx, CY, Phaser.Math.FloatBetween(1, 2.4), 0xd8ccff, 0.85).setDepth(11);
        objs.push(m);
        this.tweens.add({ targets: m, y: ay + 10, alpha: 0, duration: 1600, ease: 'Sine.easeOut', onComplete: () => m.destroy() });
      },
    });

    // The light goes out anyway: flicker, then shatter, motes scatter away.
    this.after(5000, () => {
      rise.remove();
      this.fadeOut(t1, 500);
      let count = 0;
      const flicker = this.time.addEvent({
        delay: 150, repeat: 8,
        callback: () => { count++; crystal.setAlpha(count % 2 === 0 ? 0.25 : 1); },
      });
      this.after(1500, () => {
        flicker.remove();
        crystal.setAlpha(0);
        for (let i = 0; i < 12; i++) {
          const a = (Math.PI * 2 * i) / 12 + Phaser.Math.FloatBetween(-0.2, 0.2);
          const d = Phaser.Math.Between(30, 90);
          const shard = this.add.circle(ax, ay, Phaser.Math.FloatBetween(1.5, 3), i % 2 === 0 ? 0xaad4ff : PURPLE, 0.9).setDepth(11);
          objs.push(shard);
          this.tweens.add({
            targets: shard, x: ax + Math.cos(a) * d, y: ay + Math.sin(a) * d + 40, alpha: 0,
            duration: Phaser.Math.Between(1000, 1700), ease: 'Quad.easeOut', onComplete: () => shard.destroy(),
          });
        }
        // her reaching arm drops
        this.tweens.add({ targets: lg, angle: -8, duration: 600, ease: 'Sine.easeIn', yoyo: true });
        const t2 = this.caption('It went out anyway. She could not hold it.', CY + 78, '#8a93b8', '12px');
        objs.push(t2);
        this.after(500, () => this.fadeIn(t2, 900));
        this.after(4600, () => this.fadeOut(t2, 500));
      });
    });

    // A single spark rekindles in her hand — her vow.
    this.after(11800, () => {
      const spark = this.add.circle(ax, CY + 4, 1, PURPLE, 0).setDepth(12);
      objs.push(spark);
      this.tweens.add({ targets: spark, scale: 4, alpha: 0.9, duration: 900, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: spark, alpha: { from: 0.9, to: 0.45 }, duration: 700, yoyo: true, repeat: -1, delay: 900 });
      const t3 = this.caption('She swore she would never watch a light die twice.', CY + 78, '#8a6cf0', '12px');
      objs.push(t3);
      this.fadeIn(t3, 1200);
    });

    this.after(17600, () => this.sweep(objs, () => this.seq6c_mira()));
  }

  // ── Phase 6c: Mira — the flame handed down ───────────────────────────────

  private seq6c_mira() {
    const objs: Array<Phaser.GameObjects.GameObject & { alpha: number }> = [];
    const GOLD = 0xf0d36c;
    const sy = CY - 44;

    // The Warden sigil overhead, dim at first.
    const sigil = this.add.graphics().setDepth(9).setAlpha(0);
    sigil.lineStyle(2, GOLD, 0.9);
    sigil.strokeCircle(CX, sy, 18);
    sigil.lineBetween(CX, sy - 18, CX, sy + 18);
    sigil.lineBetween(CX - 14, sy, CX + 14, sy);
    objs.push(sigil);
    this.tweens.add({ targets: sigil, alpha: 0.35, duration: 1000 });

    // A line of kneeling Wardens — generations of the watch.
    const xs = [CX - 96, CX - 48, CX, CX + 48];
    const wardens: Phaser.GameObjects.Container[] = [];
    xs.forEach((x, i) => {
      const g = this.drawHero(GOLD, 0.5, 0.55);
      const c = this.add.container(x, CY + 24, [g]).setDepth(10).setAlpha(0);
      wardens.push(c);
      objs.push(c);
      this.tweens.add({ targets: c, alpha: 1, duration: 700, delay: i * 160 });
    });

    const t1 = this.caption('The Wardens have kept the last anchor since before the walls rose.', CY + 78, '#f0d36c', '11px');
    objs.push(t1);
    this.after(900, () => this.fadeIn(t1, 900));

    // A flame is passed hand to hand along the line, brightening each Warden.
    const flame = this.add.circle(xs[0], CY + 18, 3.5, 0xfff0aa, 0).setDepth(12);
    objs.push(flame);
    this.after(1800, () => this.fadeIn(flame, 500));
    xs.forEach((x, i) => {
      if (i === 0) return;
      this.after(1800 + i * 1400, () => {
        this.tweens.add({ targets: flame, x, duration: 1100, ease: 'Sine.easeInOut' });
        const lit = wardens[i].list[0] as Phaser.GameObjects.Graphics;
        this.tweens.add({ targets: lit, alpha: { from: 0.55, to: 1 }, duration: 500, delay: 900, yoyo: true });
      });
    });

    this.after(6600, () => { this.fadeOut(t1, 500); });
    this.after(7100, () => {
      const t2 = this.caption('Mira took the flame from hands that could no longer carry it.', CY + 78, '#f0d36c', '12px');
      objs.push(t2);
      this.fadeIn(t2, 900);
      this.after(4200, () => this.fadeOut(t2, 500));
    });

    // Mira (the last in line) rises and lifts the flame toward the sigil.
    this.after(7600, () => {
      const mira = wardens[wardens.length - 1];
      this.tweens.add({ targets: mira, y: CY + 8, duration: 1000, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: mira, scaleX: 1.25, scaleY: 1.25, duration: 1000, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: flame, x: xs[xs.length - 1], y: CY - 6, duration: 1200, ease: 'Sine.easeOut' });
      // sigil flares bright
      this.tweens.add({ targets: sigil, alpha: 1, duration: 1200, ease: 'Sine.easeOut' });
      this.after(1200, () => {
        this.tweens.add({ targets: sigil, alpha: { from: 1, to: 0.55 }, duration: 1400, yoyo: true, repeat: -1 });
        this.tweens.add({ targets: flame, alpha: { from: 1, to: 0.6 }, duration: 800, yoyo: true, repeat: -1 });
      });
    });

    this.after(11800, () => {
      const t3 = this.caption('She does not intend to be the one who lets it go out.', CY + 78, '#f0d36c', '12px');
      objs.push(t3);
      this.fadeIn(t3, 1200);
    });

    this.after(17800, () => this.sweep(objs, () => this.seq6_heroes()));
  }

  // ── Phase 6: three silhouettes converge + call to arms ────────────────────

  private seq6_heroes() {
    const objs: Array<Phaser.GameObjects.GameObject & { alpha: number }> = [];
    const targetX = [CX - 48, CX, CX + 48];
    const startPos = [
      { x: -40, y: CY + 30 },
      { x: CX, y: CY + 150 },
      { x: GAME.width + 40, y: CY + 30 },
    ];
    const colors = [0x6cf0c2, 0x8a6cf0, 0xf0d36c];

    const bridge = this.caption('Three roads. Three wounds. One place left worth defending.', CY + 90, '#c9cee8', '12px');
    objs.push(bridge);
    this.after(600, () => this.fadeIn(bridge, 900));
    this.after(3400, () => this.fadeOut(bridge, 500));

    targetX.forEach((tx, i) => {
      const g = this.drawHero(colors[i]);
      const figure = this.add.container(startPos[i].x, startPos[i].y, [g]).setDepth(10).setAlpha(0);
      objs.push(figure);
      this.tweens.add({ targets: figure, alpha: 1, duration: 500, delay: i * 380, ease: 'Sine.easeOut' });

      // Footstep bob while walking in
      const bob = this.tweens.add({
        targets: g, y: { from: 0, to: -3 }, duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });

      // Walk in from off-screen and converge on the group position — a slow,
      // deliberate approach so the moment they arrive together has weight.
      this.tweens.add({
        targets: figure,
        x: tx, y: CY + 10,
        duration: 3200,
        delay: i * 380,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          bob.remove();
          g.y = 0;
          // Subtle idle float once they've arrived
          this.tweens.add({
            targets: figure, y: { from: CY + 10, to: CY + 6 },
            duration: 2000 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          });
        },
      });
    });

    // Once the three stand together, a warm light rises around them and holds —
    // the thing they have each chosen to guard. A held beat, not a quick blink.
    this.after(4100, () => {
      const flash = this.add.circle(CX, CY + 12, 4, 0xeef2ff, 0.6).setDepth(9);
      this.tweens.add({ targets: flash, scale: 16, alpha: 0, duration: 1300, ease: 'Sine.easeOut', onComplete: () => flash.destroy() });
      const haloColors = [0xf0d36c, 0xfff0aa];
      for (let i = 0; i < 2; i++) {
        const halo = this.add.circle(CX, CY + 12, 22 + i * 22, haloColors[i], 0).setDepth(8);
        objs.push(halo);
        this.tweens.add({ targets: halo, alpha: 0.1 - i * 0.03, scale: { from: 0.7, to: 1 }, duration: 1900, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: halo, alpha: { from: 0.1 - i * 0.03, to: 0.04 }, duration: 2200, yoyo: true, repeat: -1, delay: 1900, ease: 'Sine.easeInOut' });
      }
    });

    // They have come together. Pivot from who they are to what they are up
    // against — the world's story, told as the flashback that follows.
    this.after(6200, () => {
      const t = this.caption('They gathered around the last light still burning — Sanctuary.', CY + 90, '#dfe4f5', '12px');
      objs.push(t);
      this.fadeIn(t, 900);
      this.after(4200, () => this.fadeOut(t, 500));
    });
    this.after(11200, () => {
      const t2 = this.caption('To know what they are fighting for, you have to know what was lost.', CY + 90, '#c9cee8', '11px');
      objs.push(t2);
      this.fadeIn(t2, 900);
      this.after(4000, () => this.fadeOut(t2, 500));
    });

    this.after(16200, () => this.sweep(objs, () => this.seq1_crystal()));
  }

  // ── Closing beat: the call to arms, after the world's story ──────────────

  private seqClose() {
    const t = this.caption('And you are its last hope.', CY + 40, '#dfe4f5', '15px');
    this.after(400, () => this.fadeIn(t, 1300));
    this.after(5200, () => {
      this.fadeOut(t, 600);
      this.after(1000, () => this.seq7_end());
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
