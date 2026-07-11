# Aetherfall Analytics

First-party, cookieless validation telemetry. No third-party SDK, no cookies,
no personal data. The point is to answer the roadmap's **Validation** question —
*is the game fun and does it retain players?* — from real play data.

## How it works

```
game (browser)  ──GET/POST /e?…──►  nginx  ──logs $args──►  aetherfall_events.log
   analytics.ts     (same origin)     returns 204            analyze.mjs → report
```

- The client ([`src/game/analytics.ts`](../../src/game/analytics.ts)) sends each
  event as a query string to the **same-origin** `/e` endpoint via
  `navigator.sendBeacon` (with an `Image` GET fallback).
- nginx logs the query string and returns `204`. **No backend service** — it
  matches the existing static-file deployment.
- [`analyze.mjs`](./analyze.mjs) turns the log into a plain-text report.

## Privacy

- **No cookies, no third parties.** Just an anonymous random `cid` in
  `localStorage` (for unique-player and retention counts) and a per-load `sid`.
- **No PII.** The nginx recipe deliberately does **not** log the IP address.
- **Consent honored.** Do Not Track and Global Privacy Control disable it
  entirely; players can opt out from the feedback panel (persisted), and
  `?analytics=off` opts out via URL.

## Events

| Event | Fired when | Key props |
|---|---|---|
| `session_start` | page load | `mob` (touch device) |
| `new_game` / `continue` | Title screen choice | — |
| `chapter_start` | a fresh descent from Sanctuary begins | `ch`, `d` (depth), `mod` (modifier) |
| `descent_progress` | reached the chapter's 2nd stratum within a run | `ch`, `d` |
| `chapter_clear` | a chapter boss falls | `ch`, `d` |
| `run_end` | run ends (wipe or retreat) | `reason`, `ch`, `d`, `g` (gold) |
| `game_complete` | final boss cleared | `d` |
| `feedback` | feedback panel submitted | `msg`, `ctx` |

Every event also carries `v` (schema), `e` (name), `cid`, `sid`, `n` (sequence),
`ts` (client time).

## Server setup (one time)

1. Apply [`nginx.conf.snippet`](./nginx.conf.snippet): add the `log_format` to the
   `http { }` block and the `location = /e` to the aetherfall `server { }` block.
2. `sudo nginx -t && sudo systemctl reload nginx`
3. Redeploy the built game (the client already points at `/e`).

## Reading the data

```bash
# Plain-text report to the terminal:
node ops/analytics/analyze.mjs /var/log/nginx/aetherfall_events.log

# Self-contained HTML dashboard (open report.html in any browser):
node ops/analytics/analyze.mjs /var/log/nginx/aetherfall_events.log --html > report.html

# Rotated logs work too, and stdin:
node ops/analytics/analyze.mjs /var/log/nginx/aetherfall_events.log.1
zcat aetherfall_events.log.*.gz | node ops/analytics/analyze.mjs - --html > report.html
```

Both views cover the same data: reach (unique players, sessions), D1 retention
by cohort, the per-chapter descent funnel (start → reached-2nd-stratum % →
clear %, plus wipes/retreats), game completions, run modifiers rolled, and all
submitted feedback. `--html` is a single dependency-free file (inline CSS, no
JS, no external requests) — mail it, host it, or open it locally. `--html-fragment`
emits the body-only version for embedding in another page.

## Testing the pipeline

Load the live site with `?analytics=on` to force beaconing from any host, play a
bit, then run `analyze.mjs` against the log to confirm events land.
