# Aetherfall - Context & Decision Log

> Paste this into a new session to continue the work. Last updated: 2026-06-02.

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
