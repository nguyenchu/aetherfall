// A small notice over the game when progress could not be saved. It lives in
// the page rather than in a Phaser scene, because saves happen in many scenes
// and the notice must show whichever one is active.

const NOTICE_ID = 'save-notice';
const VISIBLE_MS = 4500;

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function showSaveNotice(): void {
  let el = document.getElementById(NOTICE_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = NOTICE_ID;
    el.setAttribute('role', 'status');
    el.textContent = "Progress couldn't be saved. Storage may be full or blocked in this browser.";
    Object.assign(el.style, {
      position: 'fixed',
      left: '50%',
      bottom: 'max(16px, env(safe-area-inset-bottom))',
      transform: 'translateX(-50%)',
      maxWidth: 'calc(100vw - 32px)',
      padding: '8px 14px',
      borderRadius: '6px',
      border: '1px solid #945334',
      background: 'rgba(13, 16, 36, 0.94)',
      color: '#f0d36c',
      font: '12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: '10',
      transition: 'opacity 300ms',
      opacity: '0',
    });
    document.body.appendChild(el);
  }
  // Next frame, so the fade-in runs even right after the element is created.
  requestAnimationFrame(() => {
    if (el) el.style.opacity = '1';
  });
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (el) el.style.opacity = '0';
  }, VISIBLE_MS);
}
