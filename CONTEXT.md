# Aetherfall - Context & Decision Log

> Paste this into a new session to continue the work. Last updated: 2026-07-07.

## 2026-07-07 (k): Equipment Sharing Fix, Movement-Key Crash, Intro Vignette

- Fixed equipment being wearable by multiple party members at once from a
  single owned copy — equipping now pulls it off whoever had it on.
- Fixed random encounters (and chests/springs/story triggers) getting
  silently skipped while holding a movement key: tile resolution hung off
  a walk animation's `onComplete`, which a held direction would usually
  kill just before it fired. Resolved immediately on the logical step
  instead.
- Sanctuary intro dialogue now gives Kael, Lyra, and Mira a personal stake
  via a new vignette system: the three walk in and gather on screen using
  their field sprites; pure narration lines show centered, boxless text
  instead of sitting next to an empty portrait slot.

## 2026-07-07 (j): Per-Chapter Music, Title Screen Audio/Input Fixes

- Each chapter now has its own explore/battle theme (forest/sunken/ashen/
  crystal, keyed off the area's theme id) plus a distinct title theme,
  instead of every chapter reusing Sanctuary's hub music.
- Fixed `AudioContext` staying suspended after the enabling keypress:
  `resume()` is now called immediately on context creation instead of
  only via a listener that couldn't catch the same event that triggered
  it.
- Fixed a title-screen input bug where a keypress landing inside the
  400ms grace window was consumed by a `once()` listener and rejected,
  leaving keyboard input dead until the player clicked instead; the ready
  flag is now reset on scene re-entry.

## 2026-07-07 (i): Random Encounter Rework, Quest Unlocking, Item/Equipment Expansion

- Fixed trash-mob tiles replaced with the existing step-based random
  battle system; retuned its rate and fixed a bug that reset progress
  toward the next encounter on every menu/dialogue resume (only battle
  resumes should do that).
- Quests now stay hidden until their chapter flag unlocks them, instead
  of showing "active" (and instantly completing) from the start of the
  game.
- Added Greater Elixir / Aether Concentrate (stronger heal/MP), Purifying
  Draught (cures ailments), Phoenix Down (revives a fallen ally),
  per-chapter junk loot, and a Chapter 1 charm.
- `C` is now an alias for `Tab` to open the menu.

## 2026-07-07 (h): Chapter 4 — Crystal Depths

New fourth chapter continuing the anchor-restoration arc hinted at in the
post-Ch3 dialogue (Warden Eda/Scholar Voss/Stranger/Child all foreshadow
"the Hollow" and more anchors to come).

- Two new areas (Crystal Depths → Radiant Sanctum) with a violet/crystal
  theme, following the established map/encounter authoring pattern.
- Five new enemies: Crystal Wisp, Cave Stalker, Prism Sprite, Geode
  Warden (elite), and the Prism Sovereign boss (700 HP, a shatter-shell
  phase transition at 50% HP mirroring the other three bosses).
- Six new equipment pieces across chest find, boss quest reward, shop
  unlock, and random battle drops — priced one tier above Ch3's gear.
- New portal in Sanctuary (gated on `ch3_complete`), shop stock, and a
  `defeat_prism_sovereign` quest with its own reward text.
- New dialogue: a pre-boss story beat, a win script, an updated "ending"
  epilogue (now four anchors instead of three), and `_after4` follow-ups
  for all four recurring NPCs.
- `BattleScene`'s chapter-branching logic (flags, quest ids, win script,
  ending trigger) extended from 3-way to 4-way.
- Also fixed a latent bug in `quests.ts`: quest reward item names were
  resolved through a hardcoded if/else chain that silently mislabeled any
  item not in `{potion, tonic, tide_pearl}` as "Warden Sigils" — replaced
  with a proper `ITEMS[id].name` lookup.
- Verified end-to-end with a save-injected Playwright playthrough: portal
  → themed area → Ch4 encounters with correct weaknesses → boss fight
  with weakness/phase/victory → quest completion with correct reward
  text → `ch4_complete`-gated NPC dialogue → shop stock. No console
  errors.

## 2026-07-07 (g): Boss Room Crash Fix

Boss rooms only register their boss's encounter group (e.g. `ch4_boss`),
so the random-encounter picker's group list came up empty there and fell
back to a hardcoded `'wolves'` — a group that only exists in Chapter 1's
encounter factory. Landing on a plain floor tile in any later chapter's
boss room while the random-encounter roll fired would crash the game.
Now it just skips the roll when there's nothing valid to draw from.

## 2026-07-07 (f): GameMenu/RunSummary Touch Controls Decluttered

`GameMenuScene`'s three panels fill almost the whole screen, so the usual
bottom-anchored d-pad+OK cluster landed on top of real stat text (GUARD,
RESIST, HP/MP bars partly hidden). Every row there is already directly
tappable, so the d-pad and OK button were dead weight — removed, keeping
Back/Menu in a thin strip below all panels instead. `RunSummaryScene`
already treats the whole screen as one big tap target ("Z / tap" hint
text, full-screen `pointerdown` listener), so its on-screen buttons did
nothing but risk overlapping the stats list — removed entirely.

## 2026-07-07 (e): Mobile Landscape Lock + Rotate Prompt

Aetherfall is a fixed 640×360 (16:9) landscape game; Phaser's FIT scaling
means a portrait phone shrinks the whole canvas — and every touch button
on it — down to a sliver. Native apps now lock orientation: iOS only
supports LandscapeLeft/Right, Android uses `sensorLandscape` (locks out
portrait but still follows the accelerometer between left/right, so the
game doesn't render upside-down depending on how the phone is held). A
browser tab can't be force-rotated, so `index.html` adds a CSS-only
"rotate your device" overlay shown via `(orientation: portrait) and
(pointer: coarse)`, leaving desktop users with a narrow window
unaffected.

## 2026-07-07 (d): Removed the Dungeon Retreat Shortcut

X means "back one step" everywhere else in the game, but in a dungeon it
instantly started the retreat-to-Sanctuary flow with no confirmation — a
stray habitual press could yank the player out of a run they didn't mean
to leave. Only the `<` portal tile leads home now, a deliberate, visible
action instead of a hidden global shortcut.

## 2026-07-07 (c): Chapter 2 Gold Rebalance

Same shortfall as Chapter 1 had: a full clear paid out 366 gold against
550 gold of gear the chapter unlocks in the shop. Gold rewards across Ch2
encounters, chests, and the boss are up ~40-45%, bringing a full clear to
~526 gold.

## 2026-07-07 (b): Chapter 1 Rebalance — Weakness, Gold, Boss HP

- Every Ch1 trash enemy was weak to phys on top of its element, so
  Kael's plain attack one-shot a 30 HP Shadow Wolf at level 1 — no need
  for Lyra or Mira to do anything. Weakness is now element-only, matching
  every later chapter's enemies.
- A full Ch1 clear (every fight, both chests, the boss) paid out 264 gold
  against 460 gold of gear the chapter unlocks in the shop — even a
  perfect run couldn't afford its own chapter's equipment. Gold rewards
  across Ch1 are up ~40-50%, bringing a full clear to ~383 gold.
- Boss HP down ~13% on all three bosses (300→260, 460→400, 620→540): the
  naive round-count looked fine, but Lyra/Mira run out of MP partway
  through a fight and fall back on weak physical hits, so real fights ran
  longer than the numbers suggested.

## 2026-07-07 (a): Battle Touch Controls Decluttered

Menu rows and target sprites are already tap-first (`renderMenu`/
`beginTargeting`), so the Prev/Next d-pad pair in battle did nothing
while a menu was open and only duplicated tap-to-target otherwise —
meanwhile it visually sat on top of enemy HP bars. OK/Back/Menu also move
into a tight row hugging the top edge: at their old position they
overlapped Kael's home sprite slot, so a tap meant for Kael (e.g. healing
him) could be swallowed by the Menu button sitting on top of him.

## 2026-07-06 (g): Sanctuary Second-Return Crash Fix

`hintText` (and `shopBox`) are class fields that outlive scene restarts,
but `create()` never reset them. Phaser destroys the previous instance's
GameObjects on shutdown, so the second time Sanctuary loads, `update()`
called `.setText()` on an already-destroyed Text object and crashed.
Reproduced via: descend, retreat, return, descend again.

## 2026-07-06 (f): Side Quests, Completion Toasts, Quest Markers

Wires three new side quests (`learn_of_anchors`, `find_pip`,
`heed_the_stranger`) onto story beats that already existed in dialogue
but were never tracked. Quest completion now shows a toast/log line with
the reward, and NPCs/portals get a bouncing marker pointing at the next
open objective. Quest tab in the menu groups active vs. completed and
shows a progress count.

## 2026-07-06 (e): Menu Polish + Character Identity

- Party members got proper class identities and matching spell renames:
  Kael the **Aetherblade** (Guardbreak, Arc Sweep), Lyra the
  **Hexweaver** (Ember Hex, Rime Hex, Hexstorm, Winter Sigil), Mira the
  **Dawnkeeper** (Dawnstrike, Dawnmend, Sunward) — replacing the old
  generic warrior/mage/cleric naming and FF-style spell names (Ember,
  Rime, Emberstorm, Blizzard, Lightstrike, Mend, Radiance, Crush,
  Cleave). Portrait art bumped for all three.
- New `RunSummaryScene` (wipe/retreat) shows depth reached, gold carried
  vs. lost, boons collected, and party levels before fading back to
  Sanctuary — replacing a silent scene transition.
- Title screen's Continue option now reads the save via
  `loadSaveSummary()` (`save.ts`) and shows level/stratum/gold inline,
  plus a party-levels/gear/potions/quests line under the menu.
- Confirm/cancel sfx added to title screen navigation.

## 2026-07-06 (d): Items + Magic Tabs — Same Polish as Equip/Stats

Closed the gap: Items and Magic were the last two tabs still in the old
plain-text style while Stats/Equip/System had already been redone.

- **Items tab**: per-target use buttons now show live vitals (`Kael 142/142`)
  instead of a bare name, and are disabled (existing `Selectable.disabled`
  styling) when the target is dead or already full — clicking used to be a
  silent no-op with no feedback. Using an item now sets a `menuNotice`
  ("Kael uses Elixir." / "can't use this right now."). Sell-only items
  (`tide_pearl`, `warden_sigils`) get a one-line "Sell to the merchant in
  Sanctuary" hint instead of empty space where use-buttons would go.
- **Magic tab**: three-way split per spell instead of one heal-or-"Battle
  only" branch — ally-heal (button, target picker, `Heals N HP` computed with
  the caster's actual INT via new `spellHealAmount()`), **party-heal is now
  usable in the field** (was previously stuck behind "Battle only" even
  though Radiance/cureall has no battle-only reason not to work outside),
  and damage/attack spells render as plain (non-boxed — a bordered look
  implied clickability they didn't have) text showing `spell.desc` colored by
  element (`ELEMENT_COLOR`, mirrors `BattleScene`'s convention) plus a
  "(battle only)" suffix so the player can still plan around element/ailment
  info without it looking like a dead button. Empty spellbook now shows the
  next learnset unlock ("Learns Bash at Lv 2") instead of "No magic learned."
- **New `castPartyHealOutOfBattle()`** (`run.ts`): mirrors battle.ts's
  `castHeal` party-target formula (`power + int*0.5 + healBonus`, applied to
  every living member). Refuses (no MP spent) if the caster can't afford it
  or nobody needs healing — deliberate UX guard the battle version doesn't
  have, since a battle cast is a committed action but a field cast is a menu
  browse and shouldn't be able to waste MP by misclick.
- Verified via CDP driver with a seeded high-level, full-inventory save
  (screenshots of Items grid, Lyra's four battle-only spells with
  element-colored hints, Mira's Mend/Radiance with real computed heal
  numbers, target-picker spatial nav skipping non-interactive rows). tsc
  clean, no console errors. Not independently screenshot-verified: the
  disabled/greyed appearance of an item button on a damaged party member —
  fresh saves always start at full HP/MP (current HP isn't persisted), and
  reaching a damaged state needs a real battle; the code path reuses the
  same `Selectable.disabled` mechanism already exercised elsewhere in this
  file, so this is a reasoned-correct gap, not a verified one.

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
- **Strata:** four handmade chapters, each two hand-authored areas ending in a
  boss: **Ch1** Ashenveil Forest -> Ancient Grove (Alpha Shade Wolf / Keep
  Sentinel-adjacent early bosses), **Ch2** Sunken City -> Flooded Keep (Tide
  Warden), **Ch3** Ashen Foothills -> Summit Shrine (Ashbrand), **Ch4** Crystal
  Depths -> Radiant Sanctum (Prism Sovereign). Chapter N's Sanctuary portal
  unlocks on `chN-1_complete`. Maps are fixed ASCII layouts, not procedurally
  generated (see `chapters.ts`'s header comment) — the "generated dungeon"
  framing in the original pitch didn't end up how the content was built.
- **Narrative permadeath:** the crystal brings you home, explaining the
  roguelite loop in fiction.

## Technology

- **Phaser 3 + TypeScript + Vite** using pnpm. Internal resolution 480x270,
  tile size 16.
- `vite.config.ts` has `base: './'`, ready for subfolders and Capacitor.
- Later: Capacitor iOS/Android, `@capacitor-community/admob`, and own
  Postgres backend.

## Status: Phase 4 In Progress - 4 Chapters, Quests, Boons, Balancing

Build has been verified with `tsc` and `vite build`; modules transpile in the
dev server.

**Current flow:** Boot -> **Intro** (skippable ~20s cinematic, first run only)
-> **Title** (Continue/New Game, save summary shown inline) -> **Sanctuary** ->
talk/shop/quests -> descend through a chapter portal (each gated on the
previous chapter's `chN_complete` flag) -> two hand-authored areas per chapter,
random encounters + chests/springs/elites along the way -> chapter boss ->
**RunSummary** on wipe/retreat, victory dialogue + next portal unlock on boss
win. Death is not total: the Crystal draws you home, keeping levels/gold; a
wipe scatters half your carried gold. The `<` portal tile is the only way to
retreat mid-run (no keyboard shortcut, see 2026-07-07 (d)).

```text
src/main.ts                    Phaser setup, scene list + bindKeyboard()
src/config.ts                  resolution + color palette
src/scenes/BootScene.ts        generates tiles + character sprites, starts Intro/Title
src/scenes/IntroScene.ts       cinematic intro sequence, skippable
src/scenes/TitleScene.ts       Continue/New Game, save summary, confirm-erase
src/scenes/SanctuaryScene.ts   city hub: handmade map, NPCs, merchant, chapter portals, story
src/scenes/DescentScene.ts     per-chapter areas, encounters, chests/springs/elites, boss portal, recall
src/scenes/BattleScene.ts      battle: menu via input bus + touch, weakness/break, ailments, chapter-branching win logic
src/scenes/BoonScene.ts        post-victory boon pick (1 of 3, elite rolls weight rare/epic)
src/scenes/DialogueScene.ts    dialogue: typewriter, name box, portrait, key/tap
src/scenes/GameMenuScene.ts    stats / items / magic / equip / quests / system tabs
src/scenes/RunSummaryScene.ts  wipe/retreat summary (depth, gold, boons, party levels)
src/scenes/SideScrollScene.ts  side-view walk scene; registered in main.ts but not
                                currently launched from anywhere (dead code as of this writing)
src/game/types.ts              pure data types (level/xp/growth/weakness/guard/ailments)
src/game/chapters.ts            all 4 chapters' maps, enemies, and per-chapter encounter factories
src/game/content.ts             spells, base items, party definitions
src/game/equipment.ts           weapon/armor/charm defs + passive GearEffects (crit, lifesteal, elemental, etc.)
src/game/quests.ts              quest defs, unlock flags, rewards
src/game/boons.ts               run-scoped boon defs + rarity
src/game/modifiers.ts           per-descent random RunModifier (xp/gold/dmg/HP-drain multipliers)
src/game/battle.ts              turn-based engine: AGI order, weakness/break, ailments, AI, rewards
src/game/progression.ts        XP curve, levelUp, restoreLevel, grantXp
src/game/run.ts                orchestrator: party, gold, inventory, depth, quests, boons, modifier, save
src/game/save.ts                localStorage meta save + loadSaveSummary() for the title screen
src/game/input.ts               shared input bus: keyboard + touch controls
src/game/dialogue.ts            data-driven scripts: intro, NPCs, per-chapter win/ending beats
src/audio/music.ts              procedural chiptune: per-chapter explore/battle themes, title theme, sfx
src/art/sprites.ts + spriteData.ts  original pixel art for hero, party, enemies, boss
src/art/tiles.ts                seeded procedural tile painters (floor/wall variants per theme)
src/ui/text.ts                  shared sharper text style helper
capacitor.config.ts + android/ ios/   native wrappers, orientation-locked, one shared web codebase
```

**City hub:** handmade map, NPCs you talk to by bumping into them, merchant
(potions/tonics/gear gated on chapter-complete flags), a quest board, and one
portal per chapter (later ones only appear once the prior chapter's flag is
set). Story arrives here: `intro` on first arrival, a win script + epilogue
after each chapter boss (updated to reference "four anchors" as of Ch4), and
`_afterN` follow-ups for recurring NPCs (Warden Eda, Scholar Voss, Stranger,
Child).

**Run loop + progression:** each chapter is two areas ending in a boss;
`getArea(depth)` indexes into 8 total areas (`ALL_AREAS` in `chapters.ts`).
Battles grant XP, level-ups with class growth, and gold; enemies scale per
chapter. A random step-based encounter roll fires while walking (rate tuned
per chapter); boss rooms skip the roll entirely (there's nothing valid to draw
from there, see 2026-07-07 (g)). Each descent rolls one random `RunModifier`
(`modifiers.ts`) that nudges XP/gold/damage/HP-drain for that run; after every
non-boss win the player picks 1 of 3 **boons** (`boons.ts`, 20 total) that
persist for the rest of the run and reset on return to Sanctuary. Boss victory
sets a `chN_complete` flag, triggers victory dialogue, and unlocks the next
chapter's portal + shop stock + gear tier.

**Quests:** `quests.ts` defs are hidden until their `unlockFlag` is set (no
more "active-and-instantly-complete" from game start). Completion shows a
toast with the reward and clears a bouncing marker on the relevant NPC/portal;
the menu's quests tab groups active vs. complete with a progress count.

**Save:** `src/game/save.ts` stores localStorage data under
`aetherfall.save.v1`: gold, levels, story flags, deepest stratum/area,
inventory, equipment owned, and quest status. `run.ts` loads it at startup and
writes through `saveProgress()`. `loadSaveSummary()` feeds the title screen's
Continue line (level/stratum/gold/party/gear/quests). `hardReset()` wipes all
progress.

**Input:** `src/game/input.ts` provides one logical input bus. Keyboard
(arrows/WASD, Z/Enter/Space=confirm, X/Backspace=cancel, M=mute, C also opens
the menu) and on-screen d-pad + A/B buttons feed the same bus. All scenes use
it. Touch controls in battle/menu/run-summary have been decluttered down to
only what isn't already tap-first (see 2026-07-07 (a)/(f)).

**Mobile:** shared codebase. `pnpm sync` runs build + Capacitor sync.
`pnpm android` and `pnpm ios` build/sync/open native projects. Native builds
lock to landscape (iOS Landscape*, Android `sensorLandscape`); the browser
shows a CSS-only rotate-device prompt on portrait+coarse-pointer instead.
AdMob can be plugged in later for monetization.

**Music:** original procedural Web Audio music, no audio files. Each chapter
has its own explore/battle theme (forest/sunken/ashen/crystal) plus a distinct
title theme; Sanctuary keeps its own hub theme. Music switches automatically
between encounter and return. M toggles mute. Audio starts on first input
(`AudioContext.resume()` called immediately on creation to dodge the browser
autoplay policy). One-shot fanfares play for victory and defeat, plus
confirm/cancel sfx on menus. The API is stable so recorded tracks can replace
the module later.

**Battle design:** FF1-inspired turn-based combat with a weakness/break layer
— every enemy has elemental weaknesses and guard pips; a weakness hit chips a
pip, and zero pips means **BROKEN** (loses its turn, +50% damage taken).
Status ailments (Burn/Chill/Venom) tick each round. Each living party member
chooses an action (Attack / Magic / Item / Defend / Flee), then the round
resolves in AGI order, with enemy intents telegraphed up front. Party: Kael
the Aetherblade (Guardbreak, Arc Sweep), Lyra the Hexweaver (Ember Hex, Rime
Hex, Hexstorm, Winter Sigil), Mira the Dawnkeeper (Dawnstrike, Dawnmend,
Sunward).

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
4. In progress: **Content** - 4 chapters (Ashenveil Forest/Ancient Grove ->
   Sunken City/Flooded Keep -> Ashen Foothills/Summit Shrine -> Crystal
   Depths/Radiant Sanctum), each with its own enemies, boss, gear, and quests;
   ongoing balancing pass chapter by chapter (Ch1/Ch2 done, see 2026-07-07 (b)/(c))
5. Mostly done: **Mobile playability** - touch controls decluttered across battle/
   menu/run-summary, orientation locked native-side with a browser rotate prompt;
   still needs real device testing (so far verified via headless Chrome/Playwright)
6. Todo: **Validation** - deploy to nguyenchu.com and measure retention/feedback
7. Todo: **Monetization** - AdMob rewarded ads + IAP

## Suggested Next Steps

- **Chapter balance pass:** Ch3/Ch4 haven't had the gold/weakness/boss-HP audit
  Ch1 and Ch2 got (2026-07-07 (b)/(c)) — same shortfall pattern is likely there.
- **Real device testing:** landscape lock + touch declutter work is only
  verified via automated headless browser so far, not a physical phone/tablet.
- **More story:** NPC follow-up lines and optional dialogue as the player goes
  deeper — Ch4 added `_after4` follow-ups; earlier chapters could use another
  pass now that the vignette/intro system (2026-07-07 (k)) exists.
- **SideScrollScene:** registered in `main.ts` but nothing launches it —
  either wire it up (it looks built for a walk-in cutscene/transition) or
  remove it as dead code.
- **Validation/Monetization:** still not started (roadmap items 6-7).
