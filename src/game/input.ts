// Shared logical input bus. Keyboard and on-screen touch controls feed the same
// buttons, so scenes do not need to care where input came from.
//
// - Directions are read as held state for steady movement.
// - confirm/cancel/menu are emitted as one-shot presses for menus and dialogue.

import Phaser from 'phaser';
import { sharpText, FONT } from '../ui/text';
import { music } from '../audio/music';

export type Btn = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel';

const ALL: Btn[] = ['up', 'down', 'left', 'right', 'confirm', 'cancel'];

class InputBus {
  private held: Record<Btn, boolean> = {
    up: false, down: false, left: false, right: false, confirm: false, cancel: false,
  };
  private listeners = new Map<Btn, Set<() => void>>();

  constructor() {
    for (const b of ALL) this.listeners.set(b, new Set());
  }

  /** Button down: sets held state and emits a press only on transition. */
  press(b: Btn): void {
    if (this.held[b]) return; // ignore repeat / double press
    this.held[b] = true;
    for (const cb of this.listeners.get(b)!) cb();
  }

  release(b: Btn): void {
    this.held[b] = false;
  }

  releaseAll(): void {
    for (const b of ALL) this.held[b] = false;
  }

  isDown(b: Btn): boolean {
    return this.held[b];
  }

  /** Subscribes to presses. Returns an unsubscribe function. */
  on(b: Btn, cb: () => void): () => void {
    this.listeners.get(b)!.add(cb);
    return () => this.listeners.get(b)!.delete(cb);
  }

  /** Direction vector from held state, one axis at a time, x first. */
  dir(): { x: number; y: number } {
    if (this.held.left) return { x: -1, y: 0 };
    if (this.held.right) return { x: 1, y: 0 };
    if (this.held.up) return { x: 0, y: -1 };
    if (this.held.down) return { x: 0, y: 1 };
    return { x: 0, y: 0 };
  }
}

export const input = new InputBus();

// --- Keyboard (bound once globally on window) ------------------------------

const KEY_MAP: Record<string, Btn> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
  z: 'confirm', Z: 'confirm', Enter: 'confirm', ' ': 'confirm',
  // Cancel doubles as the menu button: each scene opens its pause menu from
  // cancel when there's nothing else to back out of. Note: removed `m`/`M`
  // here so `m` only toggles sound and does not open the menu.
  x: 'cancel', X: 'cancel', Backspace: 'cancel', Escape: 'cancel', Tab: 'cancel',
};

let keyboardBound = false;
let suspended = false;

/** Suspends keyboard handling while a DOM overlay (e.g. the feedback textarea)
 * owns input, so typing does not drive the game. Held buttons are released so
 * nothing is stuck down when input resumes. */
export function setInputSuspended(value: boolean): void {
  suspended = value;
  input.releaseAll();
}

export function bindKeyboard(): void {
  if (keyboardBound) return;
  keyboardBound = true;
  let wasEnabledBeforeBlur = false;
  window.addEventListener('keydown', (e) => {
    if (suspended) return;
    // M should toggle mute immediately and not open the menu
    if (e.key && e.key.toLowerCase() === 'm') {
      music.toggle();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const b = KEY_MAP[e.key];
    if (!b) return;
    if (e.key === ' ' || e.key === 'Tab' || e.key.startsWith('Arrow')) e.preventDefault();
    input.press(b);
  });
  window.addEventListener('keyup', (e) => {
    if (suspended) return;
    const b = KEY_MAP[e.key];
    if (b) input.release(b);
  });

  // Mute when window loses focus; restore only if it was enabled before blur.
  window.addEventListener('blur', () => {
    if (music.isEnabled()) {
      music.setEnabled(false);
      wasEnabledBeforeBlur = true;
    } else {
      wasEnabledBeforeBlur = false;
    }
  });
  window.addEventListener('focus', () => {
    if (wasEnabledBeforeBlur) {
      music.setEnabled(true);
      wasEnabledBeforeBlur = false;
    }
  });
}

// --- On-screen Controls (touch) --------------------------------------------

/** Shown only on touch devices. */
export function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
}

/**
 * Adds a translucent d-pad on the left and A/B buttons on the right.
 * The buttons feed the same input bus. Called by scenes that need controls.
 */
type TouchLayout = 'move' | 'battle' | 'menu';

export function attachTouchControls(scene: Phaser.Scene, anchor: 'bottom' | 'top' = 'bottom', layout: TouchLayout = 'move'): void {
  if (!isTouchDevice()) return;

  const bind = (target: Phaser.GameObjects.Shape, b: Btn) => {
    target.on('pointerdown', () => input.press(b));
    target.on('pointerup', () => input.release(b));
    target.on('pointerout', () => input.release(b));
  };

  const mkCircle = (x: number, y: number, label: string, b: Btn, r = 16) => {
    const c = scene.add.circle(x, y, r, 0x141a30, 0.72).setStrokeStyle(2, 0x6cf0c2, 0.72).setDepth(900).setScrollFactor(0).setInteractive({ useHandCursor: false });
    scene.add.text(x, y, label, sharpText({ fontFamily: FONT, fontSize: r > 16 ? '9px' : '10px', color: '#eef2ff', strokeThickness: 3 })).setOrigin(0.5).setDepth(901).setScrollFactor(0).setAlpha(0.95);
    bind(c, b);
    return c;
  };

  const mkPill = (x: number, y: number, w: number, label: string, b: Btn) => {
    const r = scene.add.rectangle(x, y, w, 24, 0x141a30, 0.78).setStrokeStyle(2, 0x6cf0c2, 0.72).setDepth(900).setScrollFactor(0).setInteractive({ useHandCursor: false });
    scene.add.text(x, y, label, sharpText({ fontFamily: FONT, fontSize: '9px', color: '#eef2ff', strokeThickness: 3 })).setOrigin(0.5).setDepth(901).setScrollFactor(0).setAlpha(0.95);
    bind(r, b);
    return r;
  };

  const cy = anchor === 'top' ? 46 : 224;
  const cx = 40;

  if (layout === 'move') {
    mkCircle(cx, cy - 24, '^', 'up');
    mkCircle(cx, cy + 24, 'v', 'down');
    mkCircle(cx - 24, cy, '<', 'left');
    mkCircle(cx + 24, cy, '>', 'right');
  }
  // 'battle' and 'menu' have no d-pad: every row/target is already directly
  // tappable there (BattleScene's renderMenu/beginTargeting touch zones,
  // GameMenuScene's button() rows), so arrow buttons would just sit dead
  // over the content and do nothing while a list is open.

  if (layout === 'battle') {
    // BattleScene fills the middle two-thirds of the screen with sprites
    // (enemies on the left, party on the right, home row as high as y=64)
    // and the bottom third with panels, so the usual bottom-anchored OK/
    // Back row would have nowhere free. Pack them into a tight row hugging
    // the very top edge instead, clear of every sprite and of the turn-order
    // strip (which is centered, not off to this side). Back doubles as the
    // menu button (see input.ts's KEY_MAP comment) — no separate Menu pill.
    mkPill(480, 14, 44, 'OK', 'confirm');
    mkPill(540, 14, 50, 'Back', 'cancel');
  } else if (layout === 'menu') {
    // GameMenuScene's three panels fill almost the entire 640x360 screen,
    // so the default bottom-anchored cluster landed on top of real stat
    // text. OK is also dead here (tapping a row already selects *and*
    // activates it), so only Back remains, pushed into the thin strip below
    // every panel instead.
    mkPill(580, 347, 56, 'Back', 'cancel');
  } else {
    mkPill(442, cy - 8, 48, 'OK', 'confirm');
    mkPill(438, cy + 20, 58, 'Back', 'cancel');
  }
}
