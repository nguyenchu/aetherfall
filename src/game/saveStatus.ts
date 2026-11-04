// Tells the player when progress could not be saved, without nagging: the
// game saves at many points, so a failing storage would otherwise raise a
// notice on every step. One notice per interval is enough to make it known.

export const SAVE_NOTICE_INTERVAL_MS = 60_000;

let handler: (() => void) | null = null;
let lastNotice = -Infinity;

/** Registers what to do when a save fails (main.ts shows a notice). */
export function onSaveFailure(callback: (() => void) | null): void {
  handler = callback;
}

export function reportSaveResult(saved: boolean, now = Date.now()): void {
  if (saved || now - lastNotice < SAVE_NOTICE_INTERVAL_MS) return;
  lastNotice = now;
  handler?.();
}

/** For tests: forget when the last notice was shown. */
export function resetSaveStatus(): void {
  lastNotice = -Infinity;
}
