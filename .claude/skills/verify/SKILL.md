---
name: verify
description: Live-verify Aetherfall changes in a real browser via Playwright (Phaser canvas game, no test framework). Use when asked to verify a UI/gameplay change end-to-end instead of by code review.
---

# Aetherfall live verification

The game has no vendored browser-driver dependency (deliberately — keep it
that way; `pnpm install --save-dev playwright` then `git checkout --
package.json pnpm-lock.yaml` after, so the manifests stay clean). Cold start:

```bash
pnpm install --save-dev playwright   # devDependency, don't commit
npx playwright install chromium      # ~300MB, one-time per machine
pnpm dev                              # vite dev server; note the port it picks
git checkout -- package.json pnpm-lock.yaml   # after installing, keep the repo clean
```

## Headless Chromium needs software WebGL

Phaser defaults to WebGL. Headless Chromium has no GPU, so `chromium.launch()`
with no args renders a **blank black canvas** (a `pageerror: Framebuffer
Unsupported` in the console is the tell). Launch with:

```js
chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
})
```

## Driving the game

Keyboard only, via the shared input bus (`src/game/input.ts`): `ArrowUp/Down/
Left/Right`, `z` = confirm, `x` = cancel (also opens the pause menu from
idle). No accessible DOM tree for the canvas — drive with
`page.keyboard.press`, verify with `page.screenshot()` plus reading Phaser
scene state (see below), not selectors.

Boot sequence from a cold load: Intro (any key) → Title splash ("press any
key") → Title menu (`Continue`/`New Game`, confirm) → intro/lore Dialogue
(multiple screens, one confirm each — party-intro dialogue on a fresh
Continue runs ~10-12 lines) → Sanctuary. Poll
`window.__AETHERFALL__.scene.getScenes(true).map(s => s.scene.key)` between
presses rather than hardcoding a press count — dialogue length varies by save
state.

## Dev hooks already in the codebase (use them, don't route around them)

- `window.__AETHERFALL__` — the Phaser.Game instance, exposed in `main.ts`
  "for dev tooling and automated smoke tests." `.scene.getScene('Descent')`
  etc. TS `private` methods are still callable at runtime (compile-time only).
- Save is plain `localStorage['aetherfall.save.v1']` (JSON, see
  `SaveData` in `src/game/save.ts`). Seed it with `page.evaluate` +
  `localStorage.setItem` before `page.reload()` to skip grinding for a game
  state (levels, items, flags, ngPlus, gold).
- `run.ts`'s `getRun()` returns the live module-singleton `RunState`
  (party/gold/inventory/depth). It's not on `window`, but in Vite dev mode you
  can reach the *same* running instance via
  `await import('/src/game/run.ts')` from `page.evaluate` — the module URL is
  cached, so this is a handle into the already-running game, not a fresh copy.
  Useful for jumping `depth` without an 8-floor playthrough, or forcing enemy
  HP low via `getScene('Battle').battle.enemies` before landing a real
  killing-blow through the UI (real damage/death/onVictory code path, just
  skipping the grind to get there).
- `DescentScene.triggerEncounter(tileKey, isBoss, isElite)` is the same call
  a real player triggers by stepping on an encounter tile — call it directly
  on the scene instance to jump straight to a specific fight (e.g. `'19,10'`
  is the Ch4 boss tile in Area 8 / Radiant Sanctum — check
  `src/game/chapters.ts`'s `encounters` map per area for others). Needs
  `getRun().depth` already set to put `getArea()` on the right area first.
- Non-production host: `analytics.ts`'s `track()` calls
  `console.debug('[analytics]', event, props)` instead of beaconing — a cheap
  way to confirm a funnel event fired (or didn't) without a server. Listen via
  `page.on('console', ...)`.
- The feedback panel (`src/ui/feedback.ts`) is a **DOM overlay**, not a Phaser
  scene — it won't show up in `scene.getScenes()`. Detect it with
  `document.querySelector('textarea')`. It suspends the keyboard input bus
  while open (`setInputSuspended`), so `z`/`x` presses don't reach it or the
  game underneath; only its own Send/Cancel buttons close it.

## Gotchas hit in practice

- Menu nav focus: entering a tab (e.g. Items) from the command list can drop
  focus straight into content with the first row already selected — don't
  assume an extra confirm is needed to "enter" content.
- CTB battle command flow: `confirm` on the top-level menu with Attack
  selected (default index 0) opens target selection; a second `confirm`
  commits it. Enemy turns run automatically, no input needed.
- Two ports: if `pnpm dev` reports "Port 5173 is in use", something else
  (maybe the user's own dev server) already owns it — Vite will fall back to
  5174 and print the real URL; use that, don't kill the other process.
