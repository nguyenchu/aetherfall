import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { ANCHOR_UPGRADES, nextRankCost } from '../game/meta';
import { buyUpgrade, getSave, upgradeRank } from '../game/run';
import { input, isTouchDevice } from '../game/input';
import { sfx } from '../audio/music';
import { sharpText, FONT } from '../ui/text';

interface AnchorData {
  onDone: () => void;
}

const ROW_H = 24;
const LIST_X = 40;
const LIST_Y = 72;

/**
 * Sanctuary's Anchor: spend Echoes (banked at the end of every run) on
 * permanent upgrades. The only progression that survives a run.
 */
export class AnchorScene extends Phaser.Scene {
  private onDone?: () => void;
  private index = 0;
  private layer?: Phaser.GameObjects.Container;
  private unsubs: (() => void)[] = [];
  private closing = false;

  constructor() {
    super('Anchor');
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    const data = this.scene.settings.data as AnchorData;
    this.onDone = data.onDone;
    this.unsubs = [];
    this.closing = false;
    input.releaseAll();
    const bg = this.add.rectangle(0, 0, GAME.width, GAME.height, 0x05040c, 0.94).setOrigin(0, 0).setInteractive();
    bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Tap outside the panel closes it.
      if (p.y / renderScale > GAME.height - 30) this.close();
    });

    this.unsubs.push(input.on('up', () => this.move(-1)));
    this.unsubs.push(input.on('down', () => this.move(1)));
    this.unsubs.push(input.on('confirm', () => this.buy()));
    this.unsubs.push(input.on('cancel', () => this.close()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));
    this.render();
  }

  private render() {
    this.layer?.destroy();
    const layer = this.add.container(0, 0).setDepth(2);
    this.layer = layer;
    const save = getSave();

    layer.add(this.add.text(LIST_X, 22, 'THE ANCHOR', sharpText({ fontFamily: FONT, fontSize: '16px', color: '#a58cff' })));
    layer.add(this.add.text(LIST_X, 44, 'It remembers every descent. Spend what it kept to make the next one stronger.', sharpText({
      fontFamily: FONT, fontSize: '8px', color: '#8a93b8',
    })));
    layer.add(this.add.text(GAME.width - 40, 22, `✦ ${save.echoes} Echoes`, sharpText({
      fontFamily: FONT, fontSize: '14px', color: '#9ae8ff',
    })).setOrigin(1, 0));

    ANCHOR_UPGRADES.forEach((u, i) => {
      const y = LIST_Y + i * ROW_H;
      const rank = upgradeRank(u.id);
      const cost = nextRankCost(u.id, rank);
      const selected = i === this.index;
      const affordable = cost != null && save.echoes >= cost;
      const row = this.add.rectangle(LIST_X - 6, y - 3, 330, ROW_H - 2, selected ? 0x263054 : 0x0f1427, selected ? 1 : 0.6)
        .setOrigin(0, 0).setStrokeStyle(1, selected ? 0x9ae8ff : 0x2f3658, selected ? 1 : 0.5)
        .setInteractive({ useHandCursor: true });
      row.on('pointerdown', () => {
        if (this.index === i) this.buy();
        else { this.index = i; this.render(); }
      });
      layer.add(row);
      layer.add(this.add.text(LIST_X, y + 2, u.name, sharpText({
        fontFamily: FONT, fontSize: '9px', color: cost == null ? '#6cf0a0' : selected ? '#ffffff' : '#c9cee8',
      })));
      const pips = u.costs.map((_, k) => (k < rank ? '●' : '○')).join('');
      layer.add(this.add.text(LIST_X + 170, y + 2, pips, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#9ae8ff' })));
      layer.add(this.add.text(LIST_X + 318, y + 2, cost == null ? 'MAX' : `✦ ${cost}`, sharpText({
        fontFamily: FONT, fontSize: '9px', color: cost == null ? '#6cf0a0' : affordable ? '#f0d36c' : '#5a6080',
      })).setOrigin(1, 0));
    });

    // Detail panel for the selected upgrade.
    const u = ANCHOR_UPGRADES[this.index];
    const rank = upgradeRank(u.id);
    const cost = nextRankCost(u.id, rank);
    const px = 392;
    layer.add(this.add.rectangle(px, LIST_Y - 3, 210, 150, 0x0d1024, 0.98).setOrigin(0, 0).setStrokeStyle(1, 0x2f3658));
    layer.add(this.add.text(px + 10, LIST_Y + 6, u.name, sharpText({ fontFamily: FONT, fontSize: '12px', color: '#eef2ff' })));
    layer.add(this.add.text(px + 10, LIST_Y + 28, u.desc, sharpText({
      fontFamily: FONT, fontSize: '9px', color: '#c9cee8', lineSpacing: 4, wordWrap: { width: 190 },
    })));
    layer.add(this.add.text(px + 10, LIST_Y + 92, `Rank ${rank} / ${u.costs.length}`, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#9ae8ff' })));
    const status = cost == null ? 'Fully awakened.'
      : save.echoes >= cost ? `Z / tap: awaken for ✦ ${cost}`
      : `Needs ✦ ${cost - save.echoes} more`;
    layer.add(this.add.text(px + 10, LIST_Y + 112, status, sharpText({
      fontFamily: FONT, fontSize: '9px', color: cost != null && save.echoes >= cost ? '#f0d36c' : '#8a93b8',
    })));

    // Record of past descents.
    const best = save.bestDepth;
    const stats = [
      `Descents: ${save.runs}`,
      `Deepest: Stratum ${Math.ceil(best / 2)} (depth ${best})`,
      `Full clears: ${save.clears}`,
      ...(save.ngPlus > 0 ? [`Ascension: ${save.ngPlus}`] : []),
    ];
    layer.add(this.add.text(px, LIST_Y + 160, stats.join('\n'), sharpText({
      fontFamily: FONT, fontSize: '8px', color: '#8a93b8', lineSpacing: 4,
    })));

    const hint = isTouchDevice() ? 'Tap an upgrade twice to buy  ·  tap here to close' : '↑↓ choose  ·  Z awaken  ·  X close';
    layer.add(this.add.text(GAME.width / 2, GAME.height - 18, hint, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#6cf0c2' })).setOrigin(0.5));
  }

  private move(dir: number) {
    this.index = (this.index + dir + ANCHOR_UPGRADES.length) % ANCHOR_UPGRADES.length;
    sfx.play('cursor');
    this.render();
  }

  private buy() {
    const u = ANCHOR_UPGRADES[this.index];
    if (!buyUpgrade(u.id)) { sfx.play('cancel'); return; }
    sfx.play('levelup');
    const flash = this.add.rectangle(0, 0, GAME.width, GAME.height, 0x9ae8ff, 0.18).setOrigin(0, 0).setDepth(10);
    this.tweens.add({ targets: flash, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
    this.render();
  }

  private close() {
    if (this.closing) return;
    this.closing = true;
    sfx.play('cancel');
    input.releaseAll();
    const onDone = this.onDone;
    this.scene.stop();
    onDone?.();
  }
}
