// In-game feedback overlay.
//
// Rendered as a DOM overlay above the Phaser canvas (not inside Phaser) so we
// get a real <textarea> with native keyboard handling on web and mobile.
// Submitting sends a single `feedback` analytics event through the same
// first-party channel as the funnel events — no email client, no third party.

import { track, isOptedOut, setOptedOut } from '../game/analytics';
import { setInputSuspended } from '../game/input';

const MAX_LEN = 500;
let open = false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: Partial<CSSStyleDeclaration>): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  return node;
}

interface FeedbackOpts {
  /** Runs once when the panel closes (sent or cancelled) — lets a caller
   * resume scene flow after prompting, e.g. the ending → back to town. */
  onClose?: () => void;
  title?: string;
  sub?: string;
}

/** Opens the feedback panel. `context` records where it was opened from
 * (e.g. 'title', 'run_wipe', 'ending') so messages can be read in context. */
export function openFeedback(context = 'title', opts: FeedbackOpts = {}): void {
  // Never strand a caller that is waiting on the close callback to continue.
  if (open) { opts.onClose?.(); return; }
  open = true;
  // Feedback typing must not drive the game (movement, mute, confirm), so
  // suspend the shared keyboard bus for as long as the overlay is up.
  setInputSuspended(true);

  const backdrop = el('div', {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(4, 4, 12, 0.72)',
    zIndex: '10000',
    padding: '16px',
    boxSizing: 'border-box',
    font: '14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif',
  });

  const panel = el('div', {
    width: '100%',
    maxWidth: '440px',
    background: '#0b1024',
    border: '1px solid #2f3658',
    borderRadius: '10px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    padding: '20px',
    boxSizing: 'border-box',
    color: '#dfe4f5',
  });

  const title = el('div', { fontSize: '16px', fontWeight: '600', color: '#f0d36c', marginBottom: '4px' });
  title.textContent = opts.title ?? 'Send feedback';

  const sub = el('div', { fontSize: '12px', color: '#8a93b8', marginBottom: '12px' });
  sub.textContent = opts.sub ?? 'What did you enjoy? What felt off? Anonymous — no account needed.';

  const textarea = el('textarea', {
    width: '100%',
    minHeight: '110px',
    resize: 'vertical',
    background: '#07060e',
    color: '#eef2ff',
    border: '1px solid #2f3658',
    borderRadius: '6px',
    padding: '10px',
    boxSizing: 'border-box',
    font: 'inherit',
    outline: 'none',
  }) as HTMLTextAreaElement;
  textarea.maxLength = MAX_LEN;
  textarea.placeholder = 'Type your thoughts…';

  const counter = el('div', { fontSize: '11px', color: '#5a6080', textAlign: 'right', marginTop: '4px' });
  const updateCounter = () => { counter.textContent = `${textarea.value.length} / ${MAX_LEN}`; };
  updateCounter();
  textarea.addEventListener('input', updateCounter);

  const row = el('div', { display: 'flex', gap: '8px', marginTop: '14px', alignItems: 'center' });

  const optOutWrap = el('label', {
    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#8a93b8', cursor: 'pointer', marginRight: 'auto',
  });
  const optOut = el('input', {}) as HTMLInputElement;
  optOut.type = 'checkbox';
  optOut.checked = isOptedOut();
  const optOutText = document.createElement('span');
  optOutText.textContent = "Don't collect analytics";
  optOutWrap.append(optOut, optOutText);

  const cancelBtn = el('button', {
    background: 'transparent', color: '#8a93b8', border: '1px solid #2f3658',
    borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', font: 'inherit',
  }) as HTMLButtonElement;
  cancelBtn.textContent = 'Cancel';

  const sendBtn = el('button', {
    background: '#6cf0c2', color: '#07060e', border: 'none', fontWeight: '600',
    borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', font: 'inherit',
  }) as HTMLButtonElement;
  sendBtn.textContent = 'Send';

  row.append(optOutWrap, cancelBtn, sendBtn);
  panel.append(title, sub, textarea, counter, row);
  backdrop.append(panel);

  const close = () => {
    if (!open) return;
    open = false;
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    setInputSuspended(false);
    opts.onClose?.();
  };

  const submit = () => {
    setOptedOut(optOut.checked);
    const msg = textarea.value.trim();
    if (msg) track('feedback', { msg, ctx: context });
    // Brief acknowledgement so the tap has a visible result.
    panel.replaceChildren();
    const thanks = el('div', { fontSize: '15px', color: '#6cf0c2', textAlign: 'center', padding: '12px 0' });
    thanks.textContent = msg ? 'Thank you — sent.' : 'Preferences saved.';
    panel.append(thanks);
    setTimeout(close, 900);
  };

  // Escape closes; keep every key from leaking to the game while typing.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    e.stopPropagation();
  };
  document.addEventListener('keydown', onKey, true);

  cancelBtn.addEventListener('click', close);
  sendBtn.addEventListener('click', submit);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  document.body.appendChild(backdrop);
  textarea.focus();
}
