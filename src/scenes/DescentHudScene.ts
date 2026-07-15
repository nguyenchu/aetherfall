import Phaser from 'phaser';
import { GAME, renderScale } from '../config';
import { BOONS } from '../game/boons';
import { getRun } from '../game/run';
import { attachTouchControls } from '../game/input';
import { sharpText, FONT } from '../ui/text';

interface PartyHudRow {
  name: Phaser.GameObjects.Text;
  hpFill: Phaser.GameObjects.Rectangle;
  mpFill: Phaser.GameObjects.Rectangle;
}

interface HudData {
  areaName: string;
  accentColor: number;
}

/**
 * Fixed-screen HUD overlay for a descent: gold, area name, active modifier,
 * boons, party vitals, and the contextual action hint. Runs as its own scene
 * (its own camera at the plain renderScale zoom every other scene uses) so
 * none of it moves or rescales when DescentScene's own camera zooms in and
 * follows the player around a bigger-than-viewport map — a second camera
 * bolted onto DescentScene itself hit an unresolved Phaser rendering issue
 * where HUD objects on a non-main camera simply didn't draw, so this uses
 * the same one-camera-per-scene pattern every other scene already relies on.
 */
export class DescentHudScene extends Phaser.Scene {
  private goldText?: Phaser.GameObjects.Text;
  private boonTexts: Phaser.GameObjects.Text[] = [];
  private partyHud: PartyHudRow[] = [];
  private hudSignature = '';
  private hintText?: Phaser.GameObjects.Text;

  constructor() {
    super('DescentHud');
  }

  create(data: HudData) {
    this.cameras.main.setOrigin(0, 0).setZoom(renderScale).setScroll(0, 0);
    this.boonTexts = [];
    this.partyHud = [];
    this.hudSignature = '';
    this.hintText = undefined;
    this.goldText = undefined;

    this.buildHud(data.areaName, data.accentColor);
    this.buildPartyHud();
    this.refreshBoonHud();
    attachTouchControls(this);
  }

  private buildHud(areaName: string, accentColor: number) {
    const hex = '#' + accentColor.toString(16).padStart(6, '0');
    const run = getRun();
    this.add.text(4, 4, 'AETHERFALL', sharpText({ fontFamily: FONT, fontSize: '12px', color: hex })).setDepth(10);
    this.add.text(4, 18, areaName, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#dfe4f5' })).setDepth(10);
    this.goldText = this.add.text(GAME.width - 4, 4, `Gold ${run.gold}`,
      sharpText({ fontFamily: FONT, fontSize: '10px', color: '#f0d36c' })).setOrigin(1, 0).setDepth(10);
    const mod = run.modifier;
    if (mod.id !== 'none') {
      this.add.text(GAME.width - 4, 18, `✦ ${mod.name}`,
        sharpText({ fontFamily: FONT, fontSize: '8px', color: mod.color })).setOrigin(1, 0).setDepth(10);
    }
  }

  /** Boons picked this run, listed under the modifier in the top-right corner. */
  refreshBoonHud() {
    for (const t of this.boonTexts) t.destroy();
    this.boonTexts = [];
    const boons = getRun().boons;
    const maxShown = 5;
    boons.slice(0, maxShown).forEach((id, i) => {
      const boon = BOONS[id];
      if (!boon) return;
      this.boonTexts.push(this.add.text(GAME.width - 4, 32 + i * 10, `◆ ${boon.name}`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#b8a8f8', strokeThickness: 2 })).setOrigin(1, 0).setDepth(10));
    });
    if (boons.length > maxShown) {
      this.boonTexts.push(this.add.text(GAME.width - 4, 32 + maxShown * 10, `+${boons.length - maxShown} more`,
        sharpText({ fontFamily: FONT, fontSize: '7px', color: '#8a93b8', strokeThickness: 2 })).setOrigin(1, 0).setDepth(10));
    }
  }

  /** Compact party vitals in the bottom-left corner. */
  private buildPartyHud() {
    const run = getRun();
    const top = GAME.height - 14 - run.party.length * 13;
    this.add.rectangle(2, top - 4, 118, run.party.length * 13 + 8, 0x07060e, 0.62)
      .setOrigin(0, 0).setDepth(9).setStrokeStyle(1, 0x2f3658, 0.5);
    run.party.forEach((c, i) => {
      const y = top + i * 13;
      const name = this.add.text(6, y, c.name, sharpText({ fontFamily: FONT, fontSize: '7px', color: '#dfe4f5', strokeThickness: 2 })).setDepth(10);
      this.add.rectangle(44, y + 4, 44, 4, 0x07060e, 0.9).setOrigin(0, 0.5).setDepth(10).setStrokeStyle(1, 0x0c0e16);
      const hpFill = this.add.rectangle(45, y + 4, 42, 2, 0x6cf0a0, 0.95).setOrigin(0, 0.5).setDepth(11);
      this.add.rectangle(92, y + 4, 24, 4, 0x07060e, 0.9).setOrigin(0, 0.5).setDepth(10).setStrokeStyle(1, 0x0c0e16);
      const mpFill = this.add.rectangle(93, y + 4, 22, 2, 0x8a6cf0, 0.95).setOrigin(0, 0.5).setDepth(11);
      this.partyHud.push({ name, hpFill, mpFill });
    });
    this.updatePartyHud();
  }

  updatePartyHud() {
    const run = getRun();
    const signature = run.party.map((c) => `${c.stats.hp}/${c.stats.mp}`).join('|');
    if (signature === this.hudSignature) return;
    this.hudSignature = signature;
    run.party.forEach((c, i) => {
      const row = this.partyHud[i];
      if (!row) return;
      const hpPct = Phaser.Math.Clamp(c.stats.hp / c.stats.maxHp, 0, 1);
      const mpPct = c.stats.maxMp > 0 ? Phaser.Math.Clamp(c.stats.mp / c.stats.maxMp, 0, 1) : 0;
      row.hpFill.setScale(hpPct, 1);
      row.hpFill.setFillStyle(hpPct < 0.3 ? 0xff5a6a : 0x6cf0a0, 0.95);
      row.mpFill.setScale(mpPct, 1);
    });
  }

  setGold(gold: number) {
    this.goldText?.setText(`Gold ${gold}`);
  }

  /** Pass '' to hide the current hint. */
  setHint(label: string) {
    if (label) {
      if (!this.hintText) {
        this.hintText = this.add.text(GAME.width / 2, GAME.height - 18, label,
          sharpText({ fontFamily: FONT, fontSize: '9px', color: '#6cf0c2' }))
          .setOrigin(0.5, 1).setDepth(20).setAlpha(0);
        this.tweens.add({ targets: this.hintText, alpha: 1, duration: 180 });
      } else {
        this.hintText.setText(label).setVisible(true);
      }
    } else if (this.hintText?.visible) {
      this.hintText.setVisible(false);
    }
  }
}
