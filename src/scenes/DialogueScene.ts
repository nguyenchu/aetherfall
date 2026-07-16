import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { SCRIPTS } from '../game/dialogue';
import { input } from '../game/input';
import { sharpText, FONT } from '../ui/text';
import type { DialogueLine, DialogueVisual, Script } from '../game/dialogue';

const TYPE_MS = 15; // milliseconds per character in the typewriter effect

interface DialogueData {
  scriptId: string;
  onDone?: () => void;
}

/**
 * Plays a dialogue script over the paused scene below. Includes typewriter text,
 * a name box, and an optional portrait. Key press or tap advances; tapping while
 * text is typing reveals the full line first.
 */
export class DialogueScene extends Phaser.Scene {
  private script: Script = [];
  private onDone?: () => void;
  private index = 0;

  private full = '';
  private shown = 0;
  private typing = false;
  private typeEvent?: Phaser.Time.TimerEvent;

  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private nameBox!: Phaser.GameObjects.Rectangle;
  private box!: Phaser.GameObjects.Rectangle;
  private portrait!: Phaser.GameObjects.Rectangle;
  private portraitGlow!: Phaser.GameObjects.Rectangle;
  private portraitImg?: Phaser.GameObjects.Image;
  private portraitY = 0;
  private indicator!: Phaser.GameObjects.Text;
  private boxY = 0;
  private unsubs: (() => void)[] = [];
  private visualContainer?: Phaser.GameObjects.Container;
  private visualId?: DialogueVisual;

  constructor() {
    super('Dialogue');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    const data = this.scene.settings.data as DialogueData;
    this.script = SCRIPTS[data.scriptId] ?? [];
    this.onDone = data.onDone;
    this.index = 0;
    this.typing = false;
    this.typeEvent = undefined;
    this.unsubs = [];
    this.visualContainer = undefined;
    this.visualId = undefined;

    // Dimmed backdrop over the scene below.
    this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg, 0.82).setOrigin(0, 0).setDepth(0);

    const boxY = GAME.height - 112;
    this.boxY = boxY;
    const nameY = boxY - 15;
    this.portraitY = boxY + 29;

    // Portrait box on the left and dialogue box across the rest. The glow
    // sits just behind the frame and gets recolored per line to match
    // whoever's speaking — same "cool" treatment as the banter toast.
    this.portraitGlow = this.add.rectangle(43, this.portraitY, 68, 68, 0xffffff, 0.28).setOrigin(0.5).setDepth(0.5).setVisible(false);
    this.portrait = this.add.rectangle(14, boxY, 58, 58, 0x0d1024).setOrigin(0, 0).setDepth(1).setStrokeStyle(1, COLORS.wall);
    this.box = this.add.rectangle(80, boxY, GAME.width - 94, 98, 0x0d1024, 0.98).setOrigin(0, 0).setDepth(1);
    this.box.setStrokeStyle(1, COLORS.wall);

    this.nameBox = this.add.rectangle(80, nameY, 8, 18, 0x141a30).setOrigin(0, 0).setDepth(2).setStrokeStyle(1, COLORS.wall).setVisible(false);
    this.nameText = this.add.text(87, nameY + 3, '', sharpText({ fontFamily: FONT, fontSize: '11px', color: '#f0d36c' })).setDepth(3);
    this.bodyText = this.add.text(90, boxY + 13, '', {
      ...sharpText({
        fontFamily: FONT,
        fontSize: '11px',
        color: '#dfe4f5',
        lineSpacing: 5,
        wordWrap: { width: GAME.width - 110 },
      }),
    }).setDepth(3);

    this.indicator = this.add.text(GAME.width - 22, boxY + 84, 'v', sharpText({ fontFamily: FONT, fontSize: '11px', color: '#a58cff' })).setDepth(3).setVisible(false);
    this.tweens.add({ targets: this.indicator, alpha: { from: 1, to: 0.2 }, duration: 500, yoyo: true, repeat: -1 });

    // Input: global bus (confirm/cancel both advance) + tap for mobile.
    const advance = () => this.advance();
    this.unsubs.push(input.on('confirm', advance));
    this.unsubs.push(input.on('cancel', advance));
    this.input.on('pointerdown', advance);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubs.forEach((u) => u());
      this.input.off('pointerdown', advance);
    });

    this.add.text(GAME.width - 6, 6, 'Z / tap >', sharpText({ fontFamily: FONT, fontSize: '9px', color: '#c9cee8' })).setOrigin(1, 0).setDepth(3);

    this.showLine(0);
  }

  private showLine(i: number) {
    const line: DialogueLine = this.script[i];
    if (!line) {
      this.finish();
      return;
    }
    // Name box.
    if (line.speaker) {
      this.nameText.setText(line.speaker);
      this.nameBox.setVisible(true).setSize(this.nameText.width + 14, 18);
      this.nameText.setColor(toHex(line.color ?? 0xf0d36c));
    } else {
      this.nameText.setText('');
      this.nameBox.setVisible(false);
    }

    // Portrait: sprite if provided, otherwise color swatch or empty. Pure
    // narration (no speaker) shows no one and no box at all — just the text,
    // dead center on the screen, like IntroScene's captions.
    this.portraitImg?.destroy();
    this.portraitImg = undefined;
    const narration = !line.speaker;
    this.box.setVisible(!narration);
    if (!narration && line.portrait && this.textures.exists(line.portrait)) {
      this.portraitImg = this.add.image(43, this.portraitY, line.portrait).setDepth(2).setDisplaySize(52, 52);
      this.portrait.setVisible(true);
      this.setPortraitRing(line.color);
    } else if (!narration && line.color != null) {
      this.portrait.setVisible(true).setFillStyle(0x0d1024);
      this.portraitImg = this.add.image(43, this.portraitY, this.dotTexture(line.color)).setDepth(2);
      this.setPortraitRing(line.color);
    } else {
      this.portrait.setVisible(false);
      this.portraitGlow.setVisible(false);
    }
    this.bodyText.setWordWrapWidth(narration ? 520 : GAME.width - 110);
    this.bodyText.setAlign(narration ? 'center' : 'left');
    this.bodyText.setOrigin(narration ? 0.5 : 0, narration ? 0.5 : 0);
    this.bodyText.setPosition(narration ? GAME.width / 2 : 90, narration ? GAME.height / 2 : this.boxY + 13);

    this.renderVisual(line.visual);

    // Typewriter.
    this.full = line.text;
    this.shown = 0;
    this.typing = true;
    this.indicator.setVisible(false);
    this.bodyText.setText('');
    this.typeEvent?.remove();
    this.typeEvent = this.time.addEvent({
      delay: TYPE_MS,
      loop: true,
      callback: () => {
        this.shown++;
        this.bodyText.setText(this.full.slice(0, this.shown));
        if (this.shown >= this.full.length) this.finishTyping();
      },
    });
  }

  private finishTyping() {
    this.typeEvent?.remove();
    this.typeEvent = undefined;
    this.typing = false;
    this.bodyText.setText(this.full);
    this.indicator.setVisible(true);
  }

  private advance() {
    if (this.typing) {
      this.finishTyping();
      return;
    }
    this.index++;
    if (this.index >= this.script.length) this.finish();
    else this.showLine(this.index);
  }

  private finish() {
    this.typeEvent?.remove();
    this.scene.stop();
    this.onDone?.();
  }

  /** Vignette shown above the textbox for lines that carry one. Reused
   *  unchanged across consecutive lines with the same id, so a run of lines
   *  sharing a scene reads as one continuous moment instead of re-flickering. */
  private renderVisual(id?: DialogueVisual) {
    if (id === this.visualId) return;
    this.visualId = id;
    this.visualContainer?.destroy();
    this.visualContainer = undefined;
    if (!id) return;
    const c = this.add.container(320, 130).setDepth(1);
    this.visualContainer = c;
    if (id === 'heroes_meet') this.buildHeroesMeet(c);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 500, ease: 'Sine.easeOut' });
  }

  // The three heroes walking in and converging on the same spot, drawn from
  // the same sprites used in the field — one continuous scene for the whole
  // "how we got here" beat. Kael and Mira stride in from either side
  // (already Sanctuary's own); Lyra drops in from above (the outsider,
  // arriving from elsewhere). Each has a small hop-bob while moving so it
  // reads as footsteps rather than a glide.
  private buildHeroesMeet(c: Phaser.GameObjects.Container) {
    const ground = this.add.rectangle(0, 24, 150, 1, 0x2f3658, 0.6);
    c.add(ground);

    const heroes: Array<{ key: string; x: number; glow: number; fromX: number; fromY: number }> = [
      { key: 'c_kael', x: -42, glow: 0x6cf0c2, fromX: -95, fromY: 0 },
      { key: 'c_lyra', x: 0, glow: 0x8a6cf0, fromX: 0, fromY: -46 },
      { key: 'c_mira', x: 42, glow: 0xf0d36c, fromX: 95, fromY: 0 },
    ];
    heroes.forEach((h, i) => {
      // The walker carries the walk-in translation; the image bobs inside it
      // independently, so the "footsteps" wobble never fights the glide for
      // the same property.
      const walker = this.add.container(h.x + h.fromX, 6 + h.fromY).setAlpha(0);
      c.add(walker);
      const halo = this.add.circle(0, 0, 16, h.glow, 0.16);
      const img = this.add.image(0, 0, h.key).setDisplaySize(34, 34);
      walker.add([halo, img]);

      const delay = 150 + i * 220;
      const travelMs = 780;
      this.tweens.add({ targets: walker, x: h.x, y: 6, alpha: 1, duration: travelMs, delay, ease: 'Sine.easeInOut' });
      const bob = this.tweens.add({
        targets: img, y: -3, duration: 130, delay, yoyo: true,
        repeat: Math.round(travelMs / 260), ease: 'Sine.easeInOut',
      });
      this.time.delayedCall(delay + travelMs, () => {
        bob.stop();
        img.y = 0;
        this.tweens.add({
          targets: walker, y: '+=2', duration: 1500 + i * 200,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      });
    });
  }

  /** Recolors the portrait frame + backing glow to match whoever's speaking. */
  private setPortraitRing(color?: number) {
    const c = color ?? 0xdfe4f5;
    this.portraitGlow.setVisible(true).setFillStyle(c, 0.28);
    this.portrait.setStrokeStyle(2, c, 0.95);
  }

  /** Creates one small round portrait dot texture per color. */
  private dotTexture(color: number): string {
    const key = `dot_${color.toString(16)}`;
    if (!this.textures.exists(key)) {
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillCircle(9, 9, 8);
      g.lineStyle(1, 0x0c0e16, 0.5);
      g.strokeCircle(9, 9, 8);
      g.generateTexture(key, 18, 18);
      g.destroy();
    }
    return key;
  }
}

function toHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
