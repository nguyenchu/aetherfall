import Phaser from 'phaser';
import { GAME, COLORS, renderScale } from '../config';
import { music, sfx } from '../audio/music';
import { input } from '../game/input';
import { loadSaveSummary } from '../game/save';
import { hardReset } from '../game/run';
import { sharpText, FONT } from '../ui/text';
import { track } from '../game/analytics';
import { openFeedback } from '../ui/feedback';

interface TitleOption {
  text: Phaser.GameObjects.Text;
  label: string;
  action: () => void;
}

/**
 * Title screen. Handles the first user interaction so audio can start,
 * then shows Continue / New Game. New Game over an existing save asks
 * for confirmation before erasing progress.
 */
export class TitleScene extends Phaser.Scene {
  private ready = false;
  private mode: 'prompt' | 'menu' | 'confirm' = 'prompt';
  private options: TitleOption[] = [];
  private index = 0;
  private prompt?: Phaser.GameObjects.Text;
  private menuBox?: Phaser.GameObjects.Container;
  private unsubs: (() => void)[] = [];
  private saveStatus?: Phaser.GameObjects.Text;

  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.cameras.main.fadeIn(600, 7, 6, 14);
    this.mode = 'prompt';
    this.ready = false; // this instance survives scene restarts; reset the grace-period gate
    this.options = [];
    this.unsubs = [];

    // Background
    this.add.rectangle(0, 0, GAME.width, GAME.height, COLORS.bg).setOrigin(0, 0);

    // Ambient glow orbs
    for (let i = 0; i < 22; i++) {
      const x = Phaser.Math.Between(20, GAME.width - 20);
      const y = Phaser.Math.Between(20, GAME.height - 20);
      const r = Phaser.Math.FloatBetween(1.2, 3.5);
      const alpha = Phaser.Math.FloatBetween(0.08, 0.22);
      const color = i % 3 === 0 ? 0x8a6cf0 : i % 3 === 1 ? 0x6cf0c2 : 0xf0d36c;
      this.add.circle(x, y, r, color, alpha);
    }

    // Title
    this.add.text(GAME.width / 2, 110, 'AETHERFALL', sharpText({
      fontFamily: FONT, fontSize: '36px', color: '#f0d36c',
    })).setOrigin(0.5);

    this.add.text(GAME.width / 2, 150, 'A WARRIORS OF LIGHT STORY', sharpText({
      fontFamily: FONT, fontSize: '10px', color: '#8a93b8',
    })).setOrigin(0.5);

    // Divider
    this.add.rectangle(GAME.width / 2, 172, 180, 1, 0x2f3658).setOrigin(0.5);

    // Premise
    this.add.text(GAME.width / 2, 192, 'Aether has fallen.\nDescend. Restore. Return.', sharpText({
      fontFamily: FONT, fontSize: '11px', color: '#dfe4f5', align: 'center',
    })).setOrigin(0.5);

    // Prompt — blinks until the first interaction, then becomes the menu
    this.prompt = this.add.text(GAME.width / 2, 290, 'Press any key or tap to begin', sharpText({
      fontFamily: FONT, fontSize: '10px', color: '#6cf0c2',
    })).setOrigin(0.5);
    this.tweens.add({ targets: this.prompt, alpha: { from: 1, to: 0.25 }, duration: 700, yoyo: true, repeat: -1 });

    // Controls hint
    this.add.text(GAME.width / 2, 330, 'WASD / arrows  ·  Z confirm  ·  X cancel  ·  M mute', sharpText({
      fontFamily: FONT, fontSize: '8px', color: '#5a6080',
    })).setOrigin(0.5);

    this.add.text(GAME.width / 2, 344, 'v0.1  —  aetherfall.nguyenchu.com', sharpText({
      fontFamily: FONT, fontSize: '7px', color: '#3a4060',
    })).setOrigin(0.5);

    // Always-available feedback link (top-right). Its own pointerdown opens the
    // overlay; the scene-level "tap to begin" handler still runs harmlessly.
    const feedback = this.add.text(GAME.width - 8, 8, '✉ Feedback', sharpText({
      fontFamily: FONT, fontSize: '8px', color: '#6cf0c2',
    })).setOrigin(1, 0).setDepth(50).setInteractive({ useHandCursor: true });
    feedback.on('pointerover', () => feedback.setColor('#a8ffe6'));
    feedback.on('pointerout', () => feedback.setColor('#6cf0c2'));
    feedback.on('pointerdown', () => openFeedback('title'));

    music.play('title');

    // Not .once(): a keypress landing inside the 400ms grace window below
    // would be consumed-but-rejected by the ready check and never retried,
    // leaving keyboard input dead until the player happened to click instead.
    const tryShowMenu = () => this.showMenu();
    this.input.on('pointerdown', tryShowMenu);
    this.input.keyboard?.on('keydown', tryShowMenu);
    this.unsubs.push(() => {
      this.input.off('pointerdown', tryShowMenu);
      this.input.keyboard?.off('keydown', tryShowMenu);
    });
    this.time.delayedCall(400, () => { this.ready = true; });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
  }

  private showMenu() {
    if (!this.ready || this.mode !== 'prompt') return;
    this.mode = 'menu';
    this.tweens.killTweensOf(this.prompt!);
    this.prompt?.destroy();
    this.buildMenu();
    // Bind the menu input after this keydown has fully resolved so the
    // opening keypress does not also activate the focused option.
    this.time.delayedCall(80, () => {
      if (!this.scene.isActive()) return;
      this.unsubs.push(input.on('up', () => this.move(-1)));
      this.unsubs.push(input.on('down', () => this.move(1)));
      this.unsubs.push(input.on('confirm', () => {
        sfx.play('confirm');
        this.options[this.index]?.action();
      }));
      this.unsubs.push(input.on('cancel', () => {
        sfx.play('cancel');
        if (this.mode === 'confirm') this.buildMenu();
      }));
    });
  }

  private buildMenu() {
    this.mode = 'menu';
    const entries: Array<{ label: string; action: () => void }> = [];
    const summary = loadSaveSummary();
    if (summary) {
      entries.push({ label: `Continue  -  Lv ${summary.highestLevel}, Stratum ${summary.deepest}, ${summary.gold}g`, action: () => this.begin(false) });
      entries.push({ label: 'New Game', action: () => this.buildConfirm() });
    } else {
      entries.push({ label: 'New Game', action: () => this.begin(true) });
    }
    this.renderOptions(entries, undefined, summary
      ? `${summary.partyLevels}\nGear ${summary.equipmentCount}  Potions ${summary.potions}  Quests ${summary.completeQuests}`
      : 'No save found.');
  }

  private buildConfirm() {
    this.mode = 'confirm';
    this.renderOptions([
      { label: 'Keep my save', action: () => this.buildMenu() },
      { label: 'Erase everything and start anew', action: () => this.begin(true) },
    ], 'This deletes ALL progress: levels, gold and gear.');
  }

  private renderOptions(entries: Array<{ label: string; action: () => void }>, warning?: string, saveStatus?: string) {
    this.menuBox?.destroy();
    this.saveStatus?.destroy();
    this.options = [];
    this.index = 0;
    const box = this.add.container(0, 0);
    this.menuBox = box;
    if (saveStatus) {
      this.saveStatus = this.add.text(GAME.width / 2, 236, saveStatus, sharpText({
        fontFamily: FONT, fontSize: '8px', color: '#8a93b8', align: 'center', strokeThickness: 2, lineSpacing: 3,
      })).setOrigin(0.5);
      box.add(this.saveStatus);
    }
    if (warning) {
      box.add(this.add.text(GAME.width / 2, 254, warning, sharpText({
        fontFamily: FONT, fontSize: '9px', color: '#ff8a8a', align: 'center',
      })).setOrigin(0.5));
    }
    entries.forEach((entry, i) => {
      const text = this.add.text(GAME.width / 2, 278 + i * 20, entry.label, sharpText({
        fontFamily: FONT, fontSize: entry.label.length > 26 ? '9px' : '11px', color: '#dfe4f5',
      })).setOrigin(0.5).setInteractive({ useHandCursor: true });
      text.on('pointerover', () => { this.index = i; sfx.play('cursor'); this.updateFocus(); });
      text.on('pointerdown', () => { this.index = i; sfx.play('confirm'); this.updateFocus(); entry.action(); });
      box.add(text);
      this.options.push({ text, label: entry.label, action: entry.action });
    });
    this.updateFocus();
  }

  private move(dir: number) {
    if (this.options.length === 0) return;
    this.index = (this.index + dir + this.options.length) % this.options.length;
    sfx.play('cursor');
    this.updateFocus();
  }

  private updateFocus() {
    this.options.forEach((option, i) => {
      const focused = i === this.index;
      option.text.setColor(focused ? '#6cf0c2' : '#dfe4f5');
      option.text.setText(`${focused ? '> ' : ''}${option.label}`);
    });
  }

  private begin(reset: boolean) {
    track(reset ? 'new_game' : 'continue');
    if (reset) hardReset();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    music.play('sanctuary'); // head start before the fade into Sanctuary
    this.cameras.main.fadeOut(400, 7, 6, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Sanctuary');
    });
  }
}
