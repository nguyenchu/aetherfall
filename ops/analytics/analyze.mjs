#!/usr/bin/env node
// Aetherfall analytics report.
//
// Reads the nginx event log (lines: "<iso8601>\t<url-encoded query string>")
// and reports the validation picture: reach, retention, the descent funnel,
// and player feedback. No dependencies.
//
//   node ops/analytics/analyze.mjs [log]            # plain-text report (stdout)
//   node ops/analytics/analyze.mjs [log] --html     # standalone HTML dashboard
//   node ops/analytics/analyze.mjs [log] --html-fragment   # body-only (for embedding)
//
//   # default log: /var/log/nginx/aetherfall_events.log
//   # accepts .gz files, and "-" reads stdin
//   # e.g.  node analyze.mjs events.log --html > report.html

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const path = args.find((a) => !a.startsWith('--')) ?? '/var/log/nginx/aetherfall_events.log';

function readLog(p) {
  if (p === '-') return readFileSync(0, 'utf8');
  const buf = readFileSync(p);
  return p.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
}

/** One log line -> event object, or null if unparseable. */
function parseLine(line) {
  if (!line.trim()) return null;
  const tab = line.indexOf('\t');
  if (tab === -1) return null;
  const time = line.slice(0, tab);
  let params;
  try {
    params = new URLSearchParams(line.slice(tab + 1).trim());
  } catch {
    return null;
  }
  const ev = { time, day: time.slice(0, 10) };
  for (const [k, v] of params) ev[k] = v;
  return ev.e ? ev : null;
}

// --- Aggregation (pure: events -> summary) -----------------------------------

function analyze(events) {
  const byType = new Map();
  const clients = new Map(); // cid -> Set(day)
  const sessions = new Set();
  const chapterStart = new Map();
  const reachedDeep = new Map();
  const chapterClear = new Map();
  const runEnd = new Map(); // "ch|reason" -> count
  const modifiers = new Map();
  const feedback = [];
  let gameComplete = 0;

  const inc = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);

  for (const ev of events) {
    inc(byType, ev.e);
    if (ev.cid) {
      if (!clients.has(ev.cid)) clients.set(ev.cid, new Set());
      clients.get(ev.cid).add(ev.day);
    }
    if (ev.sid) sessions.add(ev.sid);
    switch (ev.e) {
      case 'chapter_start': inc(chapterStart, ev.ch ?? '?'); if (ev.mod) inc(modifiers, ev.mod); break;
      case 'descent_progress': inc(reachedDeep, ev.ch ?? '?'); break;
      case 'chapter_clear': inc(chapterClear, ev.ch ?? '?'); break;
      case 'run_end': inc(runEnd, `${ev.ch ?? '?'}|${ev.reason ?? '?'}`); break;
      case 'game_complete': gameComplete += 1; break;
      // ev.msg is already URL-decoded by URLSearchParams above; decoding again
      // would throw on a literal '%' in feedback text (URIError) or silently
      // corrupt "%NN"-looking sequences.
      case 'feedback': feedback.push({ time: ev.time, ctx: ev.ctx ?? '?', msg: ev.msg ?? '' }); break;
    }
  }

  // New-vs-returning by first-seen day; simple D1 retention by cohort.
  const nextDay = (d) => {
    const t = new Date(`${d}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString().slice(0, 10);
  };
  const cohort = new Map();
  for (const [, days] of clients) {
    const first = [...days].sort()[0];
    if (!cohort.has(first)) cohort.set(first, { size: 0, retained: 0 });
    const c = cohort.get(first);
    c.size += 1;
    if (days.has(nextDay(first))) c.retained += 1;
  }

  const days = [...new Set(events.map((e) => e.day))].sort();
  const chapters = [...new Set([...chapterStart.keys(), ...reachedDeep.keys(), ...chapterClear.keys()])]
    .filter((c) => c !== '?')
    .sort((a, b) => Number(a) - Number(b));

  return {
    path,
    days,
    total: events.length,
    reach: {
      players: clients.size,
      sessions: sessions.size,
      sessionsPer: sessions.size / Math.max(1, clients.size),
      newGame: byType.get('new_game') ?? 0,
      continue: byType.get('continue') ?? 0,
    },
    retention: [...cohort.entries()].sort().map(([day, c]) => ({ day, ...c })),
    funnel: chapters.map((ch) => ({
      ch,
      start: chapterStart.get(ch) ?? 0,
      deep: reachedDeep.get(ch) ?? 0,
      clear: chapterClear.get(ch) ?? 0,
      wipe: runEnd.get(`${ch}|wipe`) ?? 0,
      retreat: runEnd.get(`${ch}|retreat`) ?? 0,
    })),
    gameComplete,
    modifiers: [...modifiers.entries()].sort((a, b) => b[1] - a[1]),
    feedback,
    byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
  };
}

const pct = (n, d) => (d > 0 ? Math.round((100 * n) / d) : 0);

// --- Text renderer -----------------------------------------------------------

function renderText(s) {
  const out = [];
  const line = (label, value) => out.push(`  ${label.padEnd(22)} ${value}`);
  const h = (t) => out.push(`\n${t}\n${'─'.repeat(t.length)}`);
  const range = s.days.length ? `${s.days[0]} → ${s.days[s.days.length - 1]}` : '(no data)';

  out.push('Aetherfall — analytics report');
  out.push(`${range}  ·  ${s.total} events  ·  ${s.path}`);

  h('Reach');
  line('Unique players', s.reach.players);
  line('Sessions', s.reach.sessions);
  line('Sessions / player', s.reach.sessionsPer.toFixed(2));
  line('New Game', s.reach.newGame);
  line('Continue', s.reach.continue);

  h('Retention (D1 by cohort)');
  if (!s.retention.length) out.push('  (no data)');
  for (const c of s.retention) line(c.day, `${c.size} new  ·  D1 ${c.retained}/${c.size} (${pct(c.retained, c.size)}%)`);

  h('Descent funnel (by chapter)');
  for (const f of s.funnel) {
    line(`Chapter ${f.ch}`, `start ${f.start}  ·  reached S2 ${f.deep} (${pct(f.deep, f.start)}%)  ·  clear ${f.clear} (${pct(f.clear, f.start)}%)  ·  wipe ${f.wipe}  ·  retreat ${f.retreat}`);
  }
  line('Game completed', s.gameComplete);

  if (s.modifiers.length) {
    h('Run modifiers rolled');
    for (const [mod, n] of s.modifiers) line(mod, n);
  }

  h(`Feedback (${s.feedback.length})`);
  if (!s.feedback.length) out.push('  (none yet)');
  for (const f of s.feedback) out.push(`  • [${f.time}] (${f.ctx}) ${f.msg}`);

  h('All events');
  for (const [type, n] of s.byType) line(type, n);
  return out.join('\n') + '\n';
}

// --- HTML dashboard renderer -------------------------------------------------

const esc = (str) => String(str).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Deliberately single-theme: Aetherfall is a dark game, so the console commits
// to its aether look (near-black ground, teal/violet/gold from config.ts).
// Data-mark hues (teal ordinal ramp; status green/red) are validated against
// the dark surface via the dataviz skill's validate_palette.js.
const CSS = `
:root{
  --plane:#0a0a12; --surface:#12131f; --surface-2:#191b2b;
  --border:rgba(138,108,240,.16); --ink:#eef1fb; --ink-2:#9aa0c2; --muted:#6b6f8c;
  --teal:#6cf0c2; --aether:#8a6cf0; --gold:#f0d36c;
  --t1:#7ef0cb; --t2:#33b892; --t3:#1f8467;      /* funnel ordinal steps */
  --good:#2fd07a; --bad:#e05b5b;
}
*{box-sizing:border-box}
.dash{background:var(--plane);color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
  padding:28px 22px 48px;min-height:100vh;line-height:1.45;
  font-variant-numeric:tabular-nums;}
.dash-wrap{max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
.mast{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px 16px;
  padding-bottom:18px;border-bottom:1px solid var(--border)}
.mark{font-size:20px;font-weight:800;letter-spacing:.22em;color:var(--gold)}
.mark span{color:var(--teal)}
.mast .role{color:var(--ink-2);font-size:12px;letter-spacing:.16em;text-transform:uppercase}
.mast .meta{margin-left:auto;color:var(--muted);font-size:12px;text-align:right}
.note{color:var(--muted);font-size:12px}
h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-2);
  margin:0 0 12px;font-weight:600}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;
  display:flex;flex-direction:column;gap:4px}
.kpi .v{font-size:30px;font-weight:750;color:var(--teal);letter-spacing:-.01em}
.kpi.g .v{color:var(--gold)}
.kpi .l{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.kpi .s{font-size:12px;color:var(--ink-2)}
.cols{display:grid;grid-template-columns:1.35fr 1fr;gap:22px}
@media(max-width:720px){.cols{grid-template-columns:1fr}}
.chap{padding:14px 0;border-top:1px solid var(--border)}
.chap:first-child{border-top:0;padding-top:0}
.chap-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.chap-h .n{font-weight:650;color:var(--ink)}
.chap-h .o{font-size:12px;color:var(--ink-2)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 3px 0 8px;vertical-align:middle}
.row{display:grid;grid-template-columns:78px 1fr 92px;align-items:center;gap:10px;margin:5px 0}
.row .rl{font-size:12px;color:var(--ink-2)}
.track{height:14px;background:rgba(255,255,255,.05);border-radius:5px;overflow:hidden}
.fill{height:100%;border-radius:5px;min-width:2px}
.row .rv{font-size:12px;color:var(--ink);text-align:right}
.row .rv b{color:var(--ink);font-weight:650}.row .rv span{color:var(--muted)}
.bars{display:flex;flex-direction:column;gap:9px}
.bar{display:grid;grid-template-columns:96px 1fr 70px;align-items:center;gap:10px}
.bar .bl{font-size:12px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar .bv{font-size:12px;text-align:right;color:var(--ink)}
.bar .bv em{color:var(--muted);font-style:normal}
.fb{display:flex;flex-direction:column;gap:10px}
.fb-item{background:var(--surface-2);border:1px solid var(--border);border-left:3px solid var(--aether);
  border-radius:8px;padding:10px 12px}
.fb-item .m{color:var(--ink)}
.fb-item .meta{color:var(--muted);font-size:11px;margin-top:5px;letter-spacing:.04em}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl td{padding:6px 8px;border-top:1px solid var(--border);color:var(--ink-2)}
.tbl td:last-child{text-align:right;color:var(--ink);font-weight:600}
.tbl tr:first-child td{border-top:0}
.empty{color:var(--muted);font-size:13px;padding:6px 0}
`;

function barRow(label, n, base, color) {
  const p = base > 0 ? Math.round((100 * n) / base) : 0;
  const w = Math.max(base > 0 ? (100 * n) / base : 0, n > 0 ? 2 : 0);
  return `<div class="row"><span class="rl">${esc(label)}</span>`
    + `<span class="track"><span class="fill" style="width:${w.toFixed(1)}%;background:${color}"></span></span>`
    + `<span class="rv"><b>${n}</b> <span>${p}%</span></span></div>`;
}

function renderHtml(s, { fragment } = {}) {
  const range = s.days.length ? `${s.days[0]} → ${s.days[s.days.length - 1]}` : 'no data yet';
  const kpi = (v, l, sub, gold) => `<div class="kpi${gold ? ' g' : ''}"><div class="v">${v}</div>`
    + `<div class="l">${esc(l)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;

  const funnel = s.funnel.length ? s.funnel.map((f) => `
    <div class="chap">
      <div class="chap-h"><span class="n">Chapter ${esc(f.ch)}</span>
        <span class="o"><span class="dot" style="background:var(--bad)"></span>wipe ${f.wipe}
          <span class="dot" style="background:var(--muted)"></span>retreat ${f.retreat}</span></div>
      ${barRow('Started', f.start, f.start, 'var(--t1)')}
      ${barRow('Reached S2', f.deep, f.start, 'var(--t2)')}
      ${barRow('Cleared', f.clear, f.start, 'var(--t3)')}
    </div>`).join('') : '<div class="empty">No descents recorded yet.</div>';

  const maxCohort = Math.max(1, ...s.retention.map((c) => c.size));
  const retention = s.retention.length ? `<div class="bars">${s.retention.map((c) => `
    <div class="bar"><span class="bl">${esc(c.day)}</span>
      <span class="track"><span class="fill" style="width:${Math.max(2, (100 * c.size) / maxCohort).toFixed(1)}%;background:var(--aether)"></span></span>
      <span class="bv">${c.size} new <em>· D1 ${pct(c.retained, c.size)}%</em></span></div>`).join('')}</div>`
    : '<div class="empty">Need two days of data for D1 retention.</div>';

  const maxMod = Math.max(1, ...s.modifiers.map(([, n]) => n));
  const modifiers = s.modifiers.length ? `<div class="bars">${s.modifiers.map(([m, n]) => `
    <div class="bar"><span class="bl">${esc(m)}</span>
      <span class="track"><span class="fill" style="width:${Math.max(2, (100 * n) / maxMod).toFixed(1)}%;background:var(--t2)"></span></span>
      <span class="bv">${n}</span></div>`).join('')}</div>` : '<div class="empty">—</div>';

  const feedback = s.feedback.length ? `<div class="fb">${s.feedback.slice().reverse().map((f) => `
    <div class="fb-item"><div class="m">${esc(f.msg) || '<span class="empty">(preferences only)</span>'}</div>
      <div class="meta">${esc(f.time)} · ${esc(f.ctx)}</div></div>`).join('')}</div>`
    : '<div class="empty">No feedback submitted yet.</div>';

  const events = `<table class="tbl">${s.byType.map(([t, n]) => `<tr><td>${esc(t)}</td><td>${n}</td></tr>`).join('')}</table>`;

  const body = `<div class="dash"><div class="dash-wrap">
    <div class="mast">
      <span class="mark">AETHER<span>FALL</span></span>
      <span class="role">Validation console</span>
      <span class="meta">${esc(range)}<br>${s.total} events · ${s.reach.players} players</span>
    </div>
    <div class="kpis">
      ${kpi(s.reach.players, 'Unique players', 'anonymous', false)}
      ${kpi(s.reach.sessions, 'Sessions', `${s.reach.sessionsPer.toFixed(1)} / player`, false)}
      ${kpi(s.reach.newGame, 'New games', `${s.reach.continue} continues`, false)}
      ${kpi(s.gameComplete, 'Completions', 'reached the bottom', true)}
    </div>
    <div class="cols">
      <div><h2>Descent funnel</h2><div class="card">${funnel}</div></div>
      <div style="display:flex;flex-direction:column;gap:22px">
        <div><h2>Retention · D1 by cohort</h2><div class="card">${retention}</div></div>
        <div><h2>Run modifiers rolled</h2><div class="card">${modifiers}</div></div>
      </div>
    </div>
    <div><h2>Player feedback (${s.feedback.length})</h2>${feedback}</div>
    <div><h2>All events</h2><div class="card">${events}</div></div>
    <div class="note">Source: ${esc(s.path)} · cookieless first-party telemetry · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</div>
  </div></div>`;

  if (fragment) return `<style>${CSS}</style>${body}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aetherfall — Validation Console</title>
<style>html,body{margin:0;background:#0a0a12}${CSS}</style>
</head><body>${body}</body></html>`;
}

// --- Main --------------------------------------------------------------------

let raw;
try {
  raw = readLog(path);
} catch (err) {
  console.error(`Could not read log at ${path}: ${err.message}`);
  process.exit(1);
}

const events = raw.split('\n').map(parseLine).filter(Boolean);
const summary = analyze(events);

if (flags.has('--html') || flags.has('--html-fragment')) {
  process.stdout.write(renderHtml(summary, { fragment: flags.has('--html-fragment') }));
} else if (events.length === 0) {
  console.log('No events found in the log yet.');
} else {
  console.log(renderText(summary));
}
