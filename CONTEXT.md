# Aetherfall - Context & Decision Log

> Paste this into a new session to continue the work. Last updated: 2026-07-06.

## 2026-07-06 (c): Equip Tab — Left/Right Swaps Character on the Slot Screen

In Step 1 (slot list), `←`/`→` now switch the active party member directly
instead of duplicating Z (right) or doing nothing (left) — lets you compare
the same slot across the party without backing out to the portraits first.
Wraps around; resets preview state the same way choosing a portrait does.
Only Step 1: in Step 2 (item list) `←`/`→` still mean "back to slots" /
"jump to command", which are load-bearing there, so member-switch was kept
out to avoid stealing those. New `switchEquipMember()`; hint line updated to
"Z: open list · ↑↓: slot · ←→: character". Re-verified with the CDP driver
(8 new steps: switch + wrap both directions, opening the item list carries
the new member through, seed-state cleanup so the reused Chrome profile's
leftover equipped-charm from a prior run doesn't leak into scroll assertions).

## 2026-07-06 (b): Equip Tab — Step-by-Step (One Screen at a Time)

Follow-up to the drill-down below: instead of showing the loadout column and
the item list side by side, equip is now a **two-phase, full-width flow** —
each phase has one job, so there's less on screen at once.

- **Phase 1 (`equipColumn === 'slot'`)** `renderEquipSlots()`: portraits +
  three full-width slot rows (icon, slot caption, equipped name, bonus + ✦
  marker, a gold `›` disclosure), and a bottom panel detailing the *highlighted*
  slot's equipped item (name/trait/description/effects) so you know what you'd
  replace. Header "CHOOSE A SLOT TO CHANGE"; hint "Z: open list · ↑↓: pick slot".
- **Phase 2 (`equipColumn === 'items'`)** `renderEquipItems()`: portraits are
  replaced by a compact breadcrumb ("‹ WEAPON  Kael"), freeing vertical space
  for a full-width item list. Each row now shows name + bonus stacked on the
  left and the **passive effect text inline** on the right (e.g. "✦ Attacks heal
  15% of damage") — the old side-by-side layout only had room for "+2 STR ✦".
  Shared bottom compare panel (`renderEquipCompare()`) with CURRENT/PREVIEW +
  stat deltas + effects. Hint "↑↓: preview · Z: equip · X: back".
- **Navigation**: Z (or →) on a slot drills into its list; Z equips and returns
  to the slot list; X (or ←) steps back out; ↑ past the top item returns to the
  slots, ↑ past the top slot reaches the portraits (switch member there). Slot
  and item lists are their own vertical rings (`moveEquipVertical`).
- **Key fix (`focusEquipColumn`)**: phase switches now select the target row
  *after* re-rendering instead of via a `selectionAnchor`. The two phases occupy
  the same screen region, so an anchor carried from the old phase snapped the
  cursor to whatever row was nearest (a portrait), which is why equipping used
  to jump the cursor onto Lyra's face. Equip/unequip and X-back all route
  through this now.
- `EQUIP_LIST_ROWS` bumped 4→5 (portrait row reclaimed); scroll ▲N/▼N counts
  moved to the right gutter (x 474) so they don't collide with a row's "ON" tag.
- Re-verified with the CDP driver: 32 scripted steps (up-x3 reaches equip
  without the magic tab's auto-caster-select, keeping Kael deterministic),
  drill-down + X-back at every level, portrait reach, unequip/re-equip notices +
  EQUIPPED panel, charm-list scrolling with a seeded all-gear save. tsc clean.

## 2026-07-06: Equip Tab — Drill-Down Navigation + Scrolling List

The equip tab now follows a classic JRPG drill-down: **member → slot → item**.

- **Flow**: entering the tab focuses the LOADOUT column (choose slot first);
  Z (or →) on a slot row opens the item list for that slot; in the list, ↑↓
  previews, Z equips and hands the cursor back to the slot row (which now
  shows the new gear), X steps back up one level (items → slots → command).
  Phase-aware hint line top-right ("↑↓: slot · Z: open list" vs "↑↓: preview ·
  Z: equip · X: back"); the list header names the slot ("CHOOSE WEAPON"); a
  gold `›` connects the active slot row to its list.
- **Keyboard fix**: up past the top of either column now reaches the party
  portraits (was impossible — `moveEquipVertical` clamped and swallowed the
  press, so switching member required a mouse).
- **Stale-anchor fix** (`selectSelectable`): when a row's `onFocus`
  early-returns without re-rendering, the `selectionAnchor` it set is now
  cleared; a stale anchor used to hijack the next programmatic cursor move
  (e.g. X-back landed back on the item row). `focusEquipColumn()` sets the
  anchor explicitly so column jumps survive re-renders.
- **Scrolling list**: item lists are windowed to `EQUIP_LIST_ROWS` (4) rows —
  late-game charm lists (6+ entries) used to overflow into the comparison
  panel. Keyboard movement walks the full logical list (`equipChoiceIds`) and
  scrolls the window at the edges; ▲N/▼N markers show hidden entries; mouse
  wheel moves the cursor too. Render clamps the window so the previewed entry
  stays visible.
- **Clarity**: "None" renamed "(Nothing)"; comparison panel is now prefixed
  "CURRENT:" (gold) or "PREVIEW:" (cyan) so preview state is unmistakable.
- Verified via CDP headless-Chrome driver (30 scripted steps: drill-down,
  X-back levels, portrait reach, unequip/re-equip notices, charm-list
  scrolling with a seeded all-gear save, indicator counts); tsc clean.

## 2026-07-05: Menu System — Restart Paths + Intuitive Equip

- **Title menu** (`TitleScene`): first input now opens Continue / New Game
  (Continue only when `hasSave()`, new helper in `save.ts`). New Game over an
  existing save shows an inline confirm ("Keep my save" is the default).
  Menu input binds 80 ms after reveal so the opening keypress can't also
  activate an option.
- **System tab** (`GameMenuScene`): new 6th tab with "Return to Title" (keeps
  save; calls `returnToTown()` first when opened from Descent — the Crystal
  fiction) and "New Game (erase save)" with a two-step arm/confirm
  (`resetArmed`, disarmed on tab switch) that calls `hardReset()`.
- **Equip tab redesigned**: LOADOUT column (3 slot rows: icon + slot caption +
  equipped name; focusing a row switches slot) · AVAILABLE list (icon, name,
  short bonus, gold "ON" tag on the equipped item; focus previews, Z equips,
  equipping sets a menuNotice) · one comparison panel at the bottom (item
  name/trait/description left; all six stats right with green/red `cur>next`
  deltas via `SHORT_STAT`). Replaced the old scattered three-panel layout and
  the cryptic `E`/`>` prefixes. `equipPreviewItemId` is now
  `string | null | undefined` — null means "previewing None", undefined means
  no preview (the old code couldn't preview unequipping).
- **Stats tab redesigned**: two-column panel — left: name/level/role, HP/MP/XP
  gauges (`vitalBar()` helper; XP reads "N XP to Lv X"), attribute line, and a
  magic/skills line that falls back to the next learnset unlock ("Learns Crush
  at Lv 2") when the member knows nothing yet; right: COMBAT column via
  `derivedStats()` (six battle-formula values, each with a plain-language
  caption like "damage reduction" — mirrors battle.ts formulas, keep in sync).
  Below: equipment strip (three icon cells with slot caption + compact gold
  bonus) and run boons as chips (overflow collapses to "+N more"). Replaced
  the old text-wall (`battleStatsLine`/`equipmentLine` deleted).
- **Phaser gotcha**: container children render in add-order (child depth is
  ignored inside a container) — row background rects must be added to the
  container before icons/captions or they occlude them at fill alpha 1.
- Verified via CDP headless-Chrome driver (title menu, confirm dialog, equip
  preview with red deltas, system tab); tsc clean, no console errors.

## 2026-07-04: Status Ailments — Burn / Chill / Venom

Combat depth pass: elemental hits now leave marks (`types.ts` `Ailment`).

- **Burn** (fire): 6% max-HP damage at end of each round, min 3. **Chill**
  (ice): initiative ×0.55 and −25% damage dealt. **Venom** (enemy bites):
  5% max-HP per round, min 2. All tick down at end of round; DoT deaths
  end battles properly (victory *and* wipe). Ailments never leave battle:
  cleared on win/flee (engine) and in `restoreParty()`.
- **Sources**: Ember/Emberstorm burn (35%/25%), Rime/Blizzard chill
  (35%/25%) — symmetric, enemy casters inflict them on heroes too. Enemy
  `attackInflict`: wolves/alpha/crawler venom, Ember Hound + Ashbrand burn,
  Tide Warden + Keep Sentinel chill.
- **New boons**: Cleansing Light (heals also cure), Kindling Soul (fire
  always burns), Winter's Grasp (ice always chills), Smoldering Ruin
  (enemy DoT ×2). Hooks: `sureInflict`, `dotMult`, `healsCure`.
- **Fairer AI**: enemies now target the weakest hero only 60% of the time
  (was 100% — pure focus fire made protecting a wounded member impossible).
- **UI** (`BattleScene`): colored B/C/V badges left of enemy HP bars and in
  party rows, "BURNING!/CHILLED!/POISONED!" stamps + tint flash on apply,
  floating numbers on DoT ticks.
- **Engine smoke tests**: scratchpad script bundles `src/game` with esbuild
  (`--alias:@src=...` + localStorage stub) and drives real `Battle` rounds in
  Node — 11 assertions covering apply/tick/expiry/initiative/cleanse/DoT-win.

## 2026-07-04: Art Overhaul — Sprites & Tiles Redrawn

- **Sprites** (`src/art/spriteData.ts`, new): all figures redrawn with a richer
  palette (highlights + shadows, top-left light). Hero got hair/belt/boots and
  visible hands; Kael a crested helm + sword; Lyra a star-tipped hat + staff
  orb; Mira a gold hood + mace; enemies got glowing eyes, fangs, flame manes,
  fins, sigils. Pixel data now lives in `spriteData.ts` (pure data, no Phaser)
  so Node tooling can render it; `sprites.ts` keeps `buildCharacterSprites()`
  and exports `paintPixelGrid()` (shared pixel-grid → texture painter).
- **Tiles** (`src/art/tiles.ts`, new): pure, deterministic (seeded mulberry32)
  16×16 painters — `cobbleFloor` (flagstones), `stoneWall` (brick masonry,
  optional algae), `foliageWall`, `basaltWall` (optional ember crack),
  `themeFloor` (per-theme flecks), `aetherGlow` (radial portal glow,
  transparent corners, tint-friendly bright core). `themeWall()` dispatches on
  theme id: forest→foliage, ashen→basalt, default→masonry (future strata safe).
- **Variants**: floors/walls generate 2–3 seeded variants per type, picked per
  map cell via `tileVariant(col,row,n)` hash — kills visible repetition.
  BootScene now paints `floor_0/1`, `floorAlt_0/1`, `wall`, `aether`;
  DescentScene paints `th_{floor,floorAlt,wall}_{themeId}_{0..2}`.
- **Preview tooling** (session scratchpad, not committed): Node scripts render
  spriteData/tiles to PNG sheets via a minimal PNG encoder — re-create by
  importing `spriteData.ts`/`tiles.ts` directly (Node 26 runs TS natively).
  Verified in-game via CDP-driven headless Chrome (dev server + synthetic
  arrow keys until a random battle triggered); no console errors.
- Known content quirk (pre-existing): several enemies share sprites — e.g.
  "Shadow Wolf" renders the `e_ghoul` texture; the per-enemy `color` field in
  chapters.ts is only a fallback when the texture is missing.

## 2026-07-03: Gameplay Overhaul — "Make It Fun"

The core loop was redesigned around meaningful decisions:

- **Weakness & break** (`battle.ts`, `chapters.ts`): every enemy has elemental
  weaknesses (phys/fire/ice/holy) and guard pips. Weakness hits chip a pip;
  at zero the enemy is **BROKEN** — loses its actions and takes +50% damage
  until the end of the next round. Weaknesses and pips are always visible in
  battle. Breaking a boss during its phase telegraph cancels the phase.
- **Enemy intents** (`battle.ts` `prepareRound()`): enemies telegraph their
  next action (⚔ target / ✦ spell / ✚ heal / !! phase) during the input
  phase, and the round's initiative order is shown as chips at the top.
- **Boons** (`boons.ts`, `BoonScene.ts`): after every non-boss victory the
  player picks 1 of 3 run-scoped blessings (16 total: element boosts,
  lifesteal, crit, thorns, MP regen, revive...). Elites weight the roll
  toward rare/epic. Boons reset when returning to Sanctuary — this is the
  roguelite build variety.
- **Stakes**: a party wipe now scatters half the carried gold.
- **Skills**: Kael has an MP ("stamina") pool with Crush (guard chipper) and
  Cleave (AoE) via level-up learnsets; Lyra learns Emberstorm/Blizzard (AoE),
  Mira learns Radiance (party heal). See `learnset` in `content.ts`.
- **Map spice** (`chapters.ts`, `DescentScene.ts`): new tiles — `T` treasure
  chests (one-time, saved flag), `H` healing springs (once per run, +50%
  HP/MP), `X` elite guardians blocking treasure corridors. All six maps were
  redesigned; `scratchpad validate-maps` flood-fill script verified them.
- **Pacing & juice**: crits (8% base), faster event playback, hold-confirm
  fast-forward, BREAK stamp, weakness hints while targeting, party HUD +
  boon list in the descent, defend gives +2 MP.
- **Fixes**: Title camera was invisible (`setAlpha(0)` never reset); enemy
  `cure` used to heal the party instead of the caster.
- `window.__AETHERFALL__` exposes the Phaser game for automated smoke tests
  (headless Chrome driver used during development).

## What This Is

**Aetherfall** is a story-driven **roguelite JRPG** inspired by Final Fantasy 1.
It lives at `/Volumes/512gbSSD/dev/aetherfall`.

**Goal:** serious revenue attempt. Web first for validation, mobile later for
monetization.

## Decisions And Rationale

| Topic | Choice | Why |
|---|---|---|
| Genre | Roguelite JRPG, not a linear story JRPG | A linear FF1-like is content-heavy and hard to monetize as a solo/AI developer. Roguelite structure means lower content cost, high replayability, and natural rewarded-ad placement. |
| Story | **Yes, fixed story** - the Hades model | Handmade world, characters, and lore with procedurally generated dungeons. This gives story depth without handmaking 50 maps. |
| Platform | Web first, mobile later | Validate that the game is fun before investing in app stores. |
| Mobile wrapper | **Capacitor**, not Expo | Phaser is web/canvas. Capacitor packages web to app and supports AdMob plugins. React Native/Expo is a poor fit for tile games. |
| Monetization | AdMob rewarded ads + IAP on mobile; web ads are low value | Rewarded video ("watch ad -> reward") fits the roguelite loop. |
| Backend | Own server + Postgres, not Supabase | User preference after free-tier deactivation issues; owns nguyenchu.com. |
| IP / law | Original IP, only genre/mechanics borrowed from FF1 | Mechanics are not copyrightable, but names, art, and music must be original. Do not sell an FF1 clone. |
| Name | "Aetherfall" as working title | Latin-feeling, fits the premise, and is easy to change. |

## Premise

Aether, the luminous substance that holds the world aloft and empowers the
crystals, has **fallen**. The world sinks layer by layer into the deep. The
player is one of the last Warriors of Light, bound to the final whole crystal:
when you die, the crystal draws you back to **Sanctuary**, the hub, and you
descend again to reach the bottom and restore Aether.

- **Fixed frame:** Sanctuary hub, NPCs, story, upgrades, a named protagonist,
  a goal, and a real ending.
- **Strata:** handmade worlds (Stratum I - The Sunken City -> Ashen Deep ->
  Crystal Core and beyond), each with its own mood and boss. Room layout inside
  each stratum is generated.
- **Narrative permadeath:** the crystal brings you home, explaining the
  roguelite loop in fiction.

## Technology

- **Phaser 3 + TypeScript + Vite** using pnpm. Internal resolution 480x270,
  tile size 16.
- `vite.config.ts` has `base: './'`, ready for subfolders and Capacitor.
- Later: Capacitor iOS/Android, `@capacitor-community/admob`, and own
  Postgres backend.

## Status: Phase 3 In Progress - City Hub, Run Loop, Save, Touch, Boss

Build has been verified with `tsc` and `vite build`; modules transpile in the
dev server.

**Current flow:** Boot -> **Sanctuary** -> talk/shop -> descend through the
eastern portal -> Descent depth 1 to 3 -> battle -> boss at the bottom -> return
home. Death returns you home while keeping level and gold. B/X recalls you home
from the dungeon.

```text
src/main.ts                 Phaser setup with 5 scenes + bindKeyboard()
src/config.ts               resolution + color palette
src/scenes/BootScene.ts     generates tiles + character sprites, starts Sanctuary
src/scenes/SanctuaryScene.ts city hub: handmade map, NPCs, merchant, portal, story
src/scenes/DescentScene.ts  procedural rooms + depth + stairs + boss portal + recall
src/scenes/BattleScene.ts   battle: menu via input bus + touch, animated round, XP, boss return
src/scenes/DialogueScene.ts dialogue: typewriter, name box, portrait, key/tap
src/game/types.ts           pure data types with level/xp/growth/xpReward/isBoss
src/game/content.ts         spells, items, party, enemies, Sunken Warden, Leviathan boss
src/game/battle.ts          turn-based battle engine with AGI, spells, AI, rewards
src/game/progression.ts     XP curve, levelUp, restoreLevel, grantXp
src/game/run.ts             orchestrator: party, gold, inventory, depth, save, economy
src/game/save.ts            localStorage meta save: gold, levels, flags, depth, upgrades
src/game/input.ts           shared input bus: keyboard + touch controls
src/game/dialogue.ts        data-driven scripts: intro, NPCs, stratum victory
src/audio/music.ts          procedural chiptune: explore, battle, victory, defeat
src/art/sprites.ts          original pixel art for hero, party, enemies, boss
src/ui/text.ts              shared sharper text style helper
capacitor.config.ts + android/ ios/   native wrappers for one shared web codebase
```

**City hub:** handmade map, NPCs you talk to by bumping into them, merchant
items (Crystal Blessing = permanent +HP, Elixir), and the descent portal in the
east. Story arrives here: `intro` on first arrival, `stratum1_win` after the
boss.

**Run loop + progression:** Descent has depths 1-3; stairs lead deeper, and the
bottom is the **Leviathan boss**. Battles grant XP, level-ups with class growth,
and gold. Enemies scale by depth. Death is not total: the Crystal draws you home,
and you keep levels and gold. Boss victory sets a flag and triggers victory
story in town.

**Save:** `src/game/save.ts` stores localStorage data under
`aetherfall.save.v1`: gold, levels, story flags, deepest stratum, and purchased
upgrades. `run.ts` loads it at startup and writes through `saveProgress()`.
`hardReset()` wipes all progress.

**Input:** `src/game/input.ts` provides one logical input bus. Keyboard
(arrows/WASD, Z/Enter/Space=confirm, X/Backspace=cancel, M=mute) and on-screen
d-pad + A/B buttons feed the same bus. All scenes use it. Dialogue can also be
tapped. Battle touch controls currently sit near the top because the bottom is
used by panels.

**Mobile:** shared codebase. `pnpm sync` runs build + Capacitor sync.
`pnpm android` and `pnpm ios` build/sync/open native projects. AdMob can be
plugged in later for monetization.

**Music:** original procedural Web Audio music, no audio files. Explore uses a
calm Am-F-C-G loop, battle uses a driving Dm riff. Music switches automatically
between encounter and return. M toggles mute. Audio starts on first input due to
browser autoplay policy. One-shot fanfares play for victory and defeat. The API
is stable so recorded tracks can replace the module later.

**Battle design:** FF1-inspired turn-based combat. Each living party member
chooses an action (Attack / Magic / Item / Defend / Flee), then the round
resolves in AGI order. Party: Kael (warrior), Lyra (mage: Ember/Rime), Bram
(cleric: Mend/Lightstrike).

Run:

```bash
pnpm -C /Volumes/512gbSSD/dev/aetherfall dev
```

Open http://localhost:5173. Start in Sanctuary, walk into NPCs to talk, use the
eastern portal to descend.

## Roadmap

1. Done: **Skeleton** - procedural descent + movement
2. Done: **Battle** - turn-based FF1-style combat
3. Done: **Run loop** - city hub, depth, XP/levels, gold economy, save, death return
4. In progress: **Content** - has 4 enemies + 1 boss + story NPCs; needs more strata, enemies, classes, and balancing
5. In progress: **Mobile playability** - touch d-pad/A-B works in all scenes; battle touch needs polish and device testing
6. Todo: **Validation** - deploy to nguyenchu.com and measure retention/feedback
7. Todo: **Monetization** - AdMob rewarded ads + IAP

## Suggested Next Steps

- **Stratum II:** add a new theme/map/enemies under Stratum I; the depth system
  is ready for more strata.
- **Balancing:** tune XP curve, enemy stats, boss HP, and economy through a full
  playthrough.
- **Battle touch polish:** tap enemies/menu choices directly instead of relying
  on the d-pad.
- **Hub music:** add a calmer dedicated Sanctuary track.
- **More story:** add NPC follow-up lines and optional dialogue as the player
  goes deeper.
- **Commit/push:** this phase is still uncommitted.
