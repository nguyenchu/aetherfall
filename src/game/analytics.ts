// Lightweight, privacy-first, first-party telemetry for validation.
//
// The goal (per the roadmap's "Validation" step) is to learn whether the game
// is fun and retains players — where they stop, how far they get, how often
// they come back — without shipping a third-party analytics SDK.
//
// Design:
//  - No cookies, no third parties, no PII. An anonymous random client id in
//    localStorage lets us count unique players and returning visits; a
//    per-page-load session id groups one play session.
//  - Events are sent as a query string to a *same-origin* endpoint (`/e`) that
//    nginx logs and answers 204 to — no backend service to run. See
//    ops/analytics/ for the ingestion + analysis side.
//  - Respects Do Not Track / Global Privacy Control and a persistent opt-out.
//  - Never throws and never blocks gameplay: telemetry is strictly best-effort.
//  - In dev (non-production host) events are logged to the console instead of
//    beaconed, so instrumentation is visible while developing.

const SCHEMA = 1;
const ENDPOINT = '/e'; // same-origin, cookieless; nginx logs $args and returns 204
const CID_KEY = 'aetherfall.cid';
const OPTOUT_KEY = 'aetherfall.analytics.optout';

/** Feedback text and similar free-form fields are capped so a single event URL
 * stays well under the GET fallback's safe length. */
const MAX_FIELD = 500;

type PropValue = string | number | boolean | undefined | null;
export type Props = Record<string, PropValue>;

let sessionId = '';
let seq = 0;
let initialized = false;
let active = false; // opted in (not DNT, not opted out)
let beacon = false; // active AND on a production host — actually send

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // private mode, sandboxed iframe, etc.
  }
}

function randomId(): string {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  } catch {
    /* fall through to Math.random */
  }
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
}

/** Anonymous, stable per-browser id. Enables unique-player and retention
 * counts without any personal data. Regenerated if storage is unavailable. */
function clientId(): string {
  const ls = safeLocalStorage();
  if (!ls) return 'anon';
  let id = ls.getItem(CID_KEY);
  if (!id) {
    id = randomId();
    try {
      ls.setItem(CID_KEY, id);
    } catch {
      /* ignore: still send with the freshly generated id this session */
    }
  }
  return id;
}

function doNotTrackOn(): boolean {
  const nav = navigator as unknown as { doNotTrack?: string; globalPrivacyControl?: boolean };
  const win = window as unknown as { doNotTrack?: string };
  const dnt = nav.doNotTrack ?? win.doNotTrack;
  return dnt === '1' || dnt === 'yes' || nav.globalPrivacyControl === true;
}

/** True on the deployed site; false on localhost, Capacitor's localhost, file://
 * and dev servers — where there is no same-origin collector to receive events. */
function isProductionHost(): boolean {
  const { protocol, hostname } = location;
  if (protocol !== 'http:' && protocol !== 'https:') return false;
  if (hostname === '' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return false;
  if (hostname.endsWith('.local')) return false;
  return true;
}

/** ?analytics=off persists an opt-out; ?analytics=on force-enables beaconing on
 * a dev host so the ingestion pipeline can be tested end-to-end. */
function readUrlOverride(): 'on' | 'off' | null {
  try {
    const v = new URLSearchParams(location.search).get('analytics');
    if (v === 'off' || v === 'on') return v;
  } catch {
    /* ignore malformed query strings */
  }
  return null;
}

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;
  try {
    sessionId = randomId();
    const ls = safeLocalStorage();
    const override = readUrlOverride();
    if (override === 'off') {
      ls?.setItem(OPTOUT_KEY, '1');
    } else if (override === 'on') {
      ls?.removeItem(OPTOUT_KEY);
    }
    const optedOut = ls?.getItem(OPTOUT_KEY) === '1' || doNotTrackOn();
    active = !optedOut;
    beacon = active && (isProductionHost() || override === 'on');
  } catch {
    active = false;
    beacon = false;
  }
}

function send(url: string): void {
  try {
    // sendBeacon survives page unload (e.g. the tab closing right after a run
    // ends), which a plain fetch/Image can miss.
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url)) return;
  } catch {
    /* fall through to the image fallback */
  }
  try {
    // GET pixel fallback — works even where sendBeacon is unavailable.
    new Image().src = url;
  } catch {
    /* give up silently: telemetry must never break the game */
  }
}

/** Records one event. Safe to call before initAnalytics(); no-op when the
 * player has opted out or Do Not Track is on. */
export function track(event: string, props: Props = {}): void {
  try {
    if (!initialized) initAnalytics();
    if (!active) return;
    seq += 1;
    const params = new URLSearchParams();
    params.set('v', String(SCHEMA));
    params.set('e', event);
    params.set('cid', clientId());
    params.set('sid', sessionId);
    params.set('n', String(seq));
    params.set('ts', String(Date.now()));
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === '') continue;
      const str = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
      params.set(key, str.length > MAX_FIELD ? str.slice(0, MAX_FIELD) : str);
    }
    const url = `${ENDPOINT}?${params.toString()}`;
    if (!beacon) {
      // Dev host: make instrumentation visible without a collector to hit.
      console.debug('[analytics]', event, props);
      return;
    }
    send(url);
  } catch {
    /* never surface a telemetry error to the player */
  }
}

// --- Consent controls (wired to the feedback/settings UI) --------------------

export function isOptedOut(): boolean {
  if (!initialized) initAnalytics();
  return !active;
}

export function setOptedOut(value: boolean): void {
  const ls = safeLocalStorage();
  try {
    if (value) ls?.setItem(OPTOUT_KEY, '1');
    else ls?.removeItem(OPTOUT_KEY);
  } catch {
    /* ignore storage failures */
  }
  active = !value && !doNotTrackOn();
  beacon = active && isProductionHost();
}

/** Chapter number a given descent depth belongs to (2 strata per chapter). */
export function chapterOfDepth(depth: number): number {
  return Math.max(1, Math.ceil(depth / 2));
}
