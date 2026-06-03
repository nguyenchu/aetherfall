// Shared logical input bus. Keyboard and on-screen touch controls feed the same
// buttons, so scenes do not need to care where input came from.
//
// - Directions are read as held state for steady movement.
// - confirm/cancel/menu are emitted as one-shot presses for menus and dialogue.

import Phaser from 'phaser';
import { sharpText, FONT } from '../ui/text';
import { music } from '../audio/music';

export type Btn = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'menu';

const ALL: Btn[] = ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu'];

class InputBus {
  private held: Record<Btn, boolean> = {
    up: false, down: false, left: false, right: false, confirm: false, cancel: false, menu: false,
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
  x: 'cancel', X: 'cancel', Backspace: 'cancel', Escape: 'cancel',
  // Note: removed `m`/`M` here so `m` only toggles sound and does not open the menu.
  Tab: 'menu',
};

let keyboardBound = false;

export function bindKeyboard(): void {
  if (keyboardBound) return;
  keyboardBound = true;
  let wasEnabledBeforeBlur = false;
  window.addEventListener('keydown', (e) => {
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
export function attachTouchControls(scene: Phaser.Scene, anchor: 'bottom' | 'top' = 'bottom'): void {
  if (!isTouchDevice()) return;

  const mk = (x: number, y: number, label: string, b: Btn, r = 13) => {
    const c = scene.add.circle(x, y, r, 0x1b2138, 0.45).setStrokeStyle(1, 0x6cf0c2, 0.55).setDepth(900).setScrollFactor(0).setInteractive({ useHandCursor: false });
    scene.add.text(x, y, label, sharpText({ fontFamily: FONT, fontSize: '10px', color: '#c9cee8' })).setOrigin(0.5).setDepth(901).setScrollFactor(0).setAlpha(0.8);
    c.on('pointerdown', () => input.press(b));
    c.on('pointerup', () => input.release(b));
    c.on('pointerout', () => input.release(b));
    return c;
  };

  // In battle, the bottom is full of panels, so controls sit near the top.
  const cy = anchor === 'top' ? 46 : 224;
  const cx = 40;
  mk(cx, cy - 20, '^', 'up');
  mk(cx, cy + 20, 'v', 'down');
  mk(cx - 20, cy, '<', 'left');
  mk(cx + 20, cy, '>', 'right');

  mk(440, cy - 6, 'A', 'confirm', 15);
  mk(414, cy + 14, 'B', 'cancel', 13);
  mk(460, cy + 18, '≡', 'menu', 11);
}
