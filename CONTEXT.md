# Aetherfall - Context & Decision Log

> Paste this into a new session to continue the work. Last updated: 2026-07-11 (later).

## 2026-07-11: Equip Lists Hide Gear Worn by Another Party Member

Supersedes the 2026-07-10 warning below: instead of showing an item another
member has on (tagged WORN, with a confirm-to-steal warning), the equip list
now just filters it out of `choices` entirely — `item.id === current ||
!equippedByOther(item.id, member.id)`. The one exception is a member's own
currently-equipped item, which still always shows (tagged ON) even in the
unlikely case it's also worn by someone else due to stale save data. To move
a single-copy item between party members, unequip it from the current
wearer first ("(Nothing)" is always a choice), then it becomes selectable
for others. Removed the now-dead WORN-tag/"Worn by" UI in both the item list
and the compare panel, and the now-unused `memberName()` helper;
`equippedByOther()` (`run.ts`) stays, now used only for the filter check.
`unequipFromOthers()` (`run.ts`) is unchanged — still a defensive cleanup for
any leftover-duplicate save data, just no longer reachable through normal
play since the list no longer offers an already-worn-elsewhere item to pick.

Verified via a save-injected session (Kael wearing Scout Vest, Mira/Lyra also
eligible to use it): Mira's armor list shows only "(Nothing)" — Scout Vest
correctly hidden — while Kael's own armor list still shows Scout Vest tagged
ON with its normal "Fits: Kael, Lyra, Mira" line. No console errors. `tsc`
clean.

## 2026-07-10: Warn Before Equipping Gear Worn by Another Party Member

Equip's item list already auto-steals a single owned copy of gear from
whoever has it on (one-copy-per-item rule, fixed 2026-07-07 below) — but did
it silently. Rows now tag the item **WORN** + "Worn by \<name\>" instead of
"Fits" when someone else has it equipped, and the preview panel spells out
that confirming will pull it off them, so the steal is visible before you
commit to it. Also fixed a fresh-save default that had Scout Vest equipped on
*both* Kael and Mira at once — violating the same one-copy rule from turn one.

## 2026-07-09 (d): Quest/Item/Boon/Modifier Balance Audit

Extended the content-audit pattern below to the remaining economy systems:
quest rewards, item/equipment pricing, `boons.ts`, and `modifiers.ts`.

- **Found and fixed**: the boss-quest gold reward chain dipped at the very
  end — `clear_ch1`(50) -> `clear_ch2`(90) -> `defeat_ashbrand`(150) ->
  `defeat_prism_sovereign`(140), the same shape as the enemy-gold bug fixed
  in (b) below. Weaker case than that one though: the Ch4 quest's equipment
  reward (`radiant_mace`, priced 260) already outvalues Ch3's
  (`oracle_lantern`, 150), so total reward value was still increasing even
  with the gold dip. Bumped `defeat_prism_sovereign` gold 140 -> 175 anyway,
  restoring a strictly increasing gold curve too.
- **Checked, no issues**: item buy/sell pricing curves (potion/tonic tiers,
  per-chapter junk sell value), equipment prices tier-to-tier, boon rarity
  distribution (20 total: 9 common/7 rare/4 epic), and run modifiers
  (asymmetric pure-buff/pure-curse design reads as intentional roguelite
  variance, not a bug). Also spot-checked all four bosses' phase-transition
  damage/heal scaling (2026-07-07 (b) Chapter 4 entry) — scales smoothly with
  each boss's own INT and max HP, no fix needed.

`tsc` clean.

## 2026-07-09 (c): Stranger Anchor-Count Fix + Child's Missing Ch2 Follow-Up

Audited every NPC's chapter-gated dialogue chain in `SanctuaryScene.ts`'s
`npcs()` selector against the actual text in `dialogue.ts`:

- Warden Eda and Scholar Voss have a complete 5-tier chain (base, after,
  after2, after3, after4) — no gaps.
- The Stranger's numbers didn't match when they actually fire: `npc_stranger`
  triggers right after Ch1 (1 anchor restored) but said "You've only restored
  three"; `npc_stranger_after2` triggers after Ch2 (2 restored, 10 remain)
  but said "Five anchors remain." Ch3/Ch4's Stranger lines already did this
  math correctly (9 remain at 3 restored, 8 remain at 4 restored) — only
  these two were wrong. Fixed both to the correct counts; second line of each
  unchanged.
- Child had no distinct Ch2 tier — the selector fell through
  `ch1Done ? 'npc_child_after1' : ...` all the way to `ch3Done`, so Child
  repeated the Ch1 "Pip came back" line through the entire Ch2 window. Added
  `npc_child_after2` (Pip avoiding the well now that the Sunken City's water
  has calmed) and wired `ch2Done ? 'npc_child_after2'` into the ternary.

Verified via a save-injected session (`ch1_complete`/`ch2_complete` flags,
localStorage): reached Sanctuary, directly invoked `openDialogue()` for all
three touched script ids on the live scene (bypasses walking to exact NPC
tiles), confirmed each renders the corrected/new text with no console errors.
`tsc` clean.

## 2026-07-09 (b): Chapter 3 Gold Rebalance

Ch3 was the one link in the reward curve moving the wrong direction: a full
clear (all 7 area encounters, the elite, the chest, the boss) paid out 488
gold — less than Ch2's 526, despite Ch3 gear/enemies being a tier harder
(383 -> 526 -> 488 -> 652 across chapters, computed the same way as the
Ch1/Ch2 audits: every fight + chest + boss). XP didn't have the same dip
(283 -> 396 -> 622 -> 776), so this was gold-only. Ember Hound / Cinder
Wraith / Magma Golem trash gold, the Pyre Colossus elite, the Ashbrand boss,
and the Area 5 chest are all up ~20-25%, bringing a full clear to 599 gold —
restores the increasing curve (383 -> 526 -> 599 -> 652).

Also audited (no changes needed): Ch3/Ch4 enemy weaknesses are element-only,
matching the Ch1 fix's standard — no repeat of that bug. Ch4's full clear
(652 gold) already comfortably affords all three `ch4_complete` shop items
(620 total), so no boss-HP or gold change was needed there. The apparent
"Ch3 has no shop-gated gear" gap turned out not to be a bug: the shop
previews next-tier gear one chapter early (`winter_staff`/`dawnstar`/
`emberweave_robe` unlock at `ch2_complete`; `stormcaller_rod` at
`ch1_complete`) so players can gear up before the harder chapter ahead —
Ch4-tier gear is the one exception (gated `ch4_complete`, not `ch3_complete`)
because Ch4 is the last chapter and there's no next chapter to prep for.
Every Ch1-4 equipment id is reachable through some combination of chest /
shop / quest reward / random battle drop; none are orphaned.

Not verified in a live playthrough — this is a same-shape numeric edit to
already-exercised fields (`goldReward`, chest `gold`), checked by
hand-summing the encounter tables. `tsc` clean.

## 2026-07-09 (a): Removed SideScrollScene (Dead Code)

Deleted `src/scenes/SideScrollScene.ts` and its `main.ts` registration. It was
an early side-view walking-corridor prototype (hardcoded "SUNKEN CITY - SIDE
PASSAGE" label) from before the current fixed hand-authored map system
(`chapters.ts`) existed; nothing ever launched it — no door/tile referenced
the `'SideScroll'` scene key, confirmed by grepping the whole codebase for
callers. Unrelated to `IntroScene` (pure graphics/tweens cinematic) and the
Sanctuary intro vignette (built into `DialogueScene.ts`, see 2026-07-07 (e)
below) — the two features it could have been mistaken for. `tsc` clean after
removal.

## 2026-07-07 (e): Equipment Sharing Fix, Held-Key Trigger Bug, Intro Vignette

Three unrelated fixes/features landed in one session:

- **Equipment sharing bug**: a single owned copy of gear could be equipped on
  multiple party members simultaneously (e.g. one Scout Vest worn by both
  Kael and Mira). Equipping now pulls the item off whoever had it on first —
  the one-copy rule the 2026-07-10 warning above builds on.
- **Held-key trigger bug**: random encounters, chests, springs, and story
  triggers on a tile could get silently skipped while a movement key was
  held. Tile resolution hung off the walk animation's `onComplete`, which a
  held direction usually killed just before it fired. Now resolves
  immediately on the logical step instead of waiting on the animation.
- **Intro vignette**: Kael, Lyra, and Mira now walk in and gather on-screen
  using their field sprites during the Sanctuary intro dialogue, giving each
  a personal line instead of generic narration. Pure-narration lines render
  centered and boxless instead of sitting next to an empty portrait slot.

## 2026-07-07 (d): Per-Chapter Music + Title-Screen Audio/Input Fixes

- **Per-chapter themes** (`music.ts`): each chapter now has its own
  explore/battle theme (forest/sunken/ashen/crystal, keyed off the area's
  `AreaThemeId`) instead of all descents reusing Sanctuary's hub music, plus
  a distinct title-screen theme. `play(name, theme)` now takes the theme id.
- **Audio fix**: `AudioContext` could stay suspended after the enabling
  keypress — `resume()` is now called immediately on context creation
  instead of only from a listener that couldn't catch the very event that
  triggered its own creation.
- **Title-screen input fix**: a keypress landing inside the 400ms grace
  window was consumed by a `once()` listener and rejected, leaving keyboard
  input dead until the player clicked; the ready flag is now also reset on
  scene re-entry.

## 2026-07-07 (c): Random Encounters Reworked, Quest Gating, New Items

- **Random encounters**: fixed trash-mob tiles replaced by the existing
  step-based random-battle roll (retuned rate); fixed a bug where the
  progress-to-next-encounter counter reset on *every* menu/dialogue resume
  instead of only on a battle resume.
- **Quest gating**: quests now stay hidden until their chapter flag unlocks
  them, instead of showing "active" (and instantly completing) from the
  start of the game.
- **New items** (`content.ts`): Greater Elixir (65 HP) / Aether Concentrate
  (24 MP) as stronger heal/mp potions, Purifying Draught (cures burn/chill/
  venom, battle only), Phoenix Down (revives a fallen ally at 40% HP),
  per-chapter junk/sell loot (Wolf Pelt, Cinder Shard, Prism Shard, ...), and
  a new Chapter 1 charm to round out its gear pool.
- **Input**: `C` added as an alias for `Tab` to open the menu.

## 2026-07-07 (b): Chapter 4 — Crystal Depths

New fourth chapter continuing the anchor-restoration arc hinted at in the
post-Chapter-3 dialogue (Warden Eda / Scholar Voss / Stranger / Child all
foreshadow "the Hollow" and more anchors to come).

- **Two new areas** (Crystal Depths → Radiant Sanctum), violet/crystal theme,
  following the established map/encounter authoring pattern.
- **Five new enemies**: Crystal Wisp, Cave Stalker, Prism Sprite, Geode
  Warden (elite), and the **Prism Sovereign** boss (700 HP, a shatter-shell
  phase transition at 50% HP mirroring the other three bosses).
- **Six new equipment pieces** across chest find, boss quest reward, shop
  unlock, and random battle drops — priced one tier above Chapter 3's gear.
- New Sanctuary portal (gated on `ch3_complete`), shop stock, and a
  `defeat_prism_sovereign` quest with its own reward text.
- New dialogue: a pre-boss story beat, a win script, an updated "ending"
  epilogue (now four anchors instead of three), and `_after4` follow-ups for
  all four recurring NPCs.
- `BattleScene`'s chapter-branching logic (flags, quest ids, win script,
  ending trigger) extended from 3-way to 4-way.
- **Bug fix** (`quests.ts`): quest reward item names were resolved through a
  hardcoded if/else chain that silently mislabeled any item outside
  `{potion, tonic, tide_pearl}` as "Warden Sigils" — replaced with a proper
  `ITEMS[id].name` lookup.
- Verified end-to-end with a save-injected Playwright playthrough: portal →
  themed area → Chapter 4 encounters with correct weaknesses → boss fight
  with weakness/phase/victory → quest completion with correct reward text →
  `ch4_complete`-gated NPC dialogue → shop stock. No console errors.

## 2026-07-07: Boss-Room Crash, Touch Decluttering, Balance Pass, Mobile Lock

A cluster of smaller fixes and tuning passes, same session as Chapter 4:

- **Crash fix**: boss rooms only register their boss's own encounter group
  (e.g. `ch4_boss`), so the random-encounter picker's group list came up
  empty there and fell back to a hardcoded `'wolves'` group that only exists
  in Chapter 1 — landing on a plain floor tile in *any* later chapter's boss
  room while the random roll fired crashed the game. Now skips the roll when
  nothing valid is available to draw from.
- **GameMenu/RunSummary touch declutter**: `GameMenuScene`'s three panels
  fill nearly the whole screen, so the usual bottom d-pad+OK cluster covered
  real stat text (GUARD, RESIST, HP/MP bars). Every row is already tappable,
  so the d-pad/OK were removed, keeping only Back/Menu in a thin strip below
  the panels. `RunSummaryScene` already treats the whole screen as one tap
  target, so its on-screen buttons were removed entirely (dead weight, risk
  of overlap).
- **Mobile landscape lock**: Aetherfall is a fixed 640×360 (16:9) landscape
  game; Phaser's FIT scaling shrinks the whole canvas (and every touch
  button) to a sliver in portrait. Native apps now lock orientation (iOS
  `LandscapeLeft/Right`; Android `sensorLandscape` — locks out portrait but
  still follows the accelerometer between left/right so the game doesn't
  render upside down). A browser tab can't be force-rotated, so `index.html`
  adds a CSS-only "rotate your device" overlay via
  `(orientation: portrait) and (pointer: coarse)`, leaving desktop windows
  unaffected.
- **Retreat shortcut removed**: `X` means "back one step" everywhere else in
  the game, but in a dungeon it instantly started the retreat-to-Sanctuary
  flow with no confirmation — a stray habitual press could yank the player
  out of a run they didn't mean to leave. Only the `<` portal tile leads
  home now.
- **Battle touch declutter**: the Prev/Next d-pad pair did nothing while a
  menu was open (menu rows are already tap-first) and only duplicated
  tap-to-target otherwise, while visually sitting on enemy HP bars; also
  moved OK/Back/Menu into a tight strip hugging the top edge — at their old
  position they overlapped Kael's home sprite slot, so a tap meant to heal
  Kael could be swallowed by the Menu button sitting on top of him.
- **Chapter 1/2 gold rebalance**: every Chapter 1 trash enemy was weak to
  `phys` on top of its element, so Kael's plain attack one-shot a 30 HP
  Shadow Wolf at level 1 with no need for Lyra/Mira — weakness is now
  element-only, matching later chapters. A full Chapter 1 clear paid out 264
  gold against 460 gold of shop gear (couldn't afford its own chapter's
  equipment even on a perfect run) — Ch1 rewards up ~40–50% (→ ~383g full
  clear), Ch2 rewards up ~40–45% (→ ~526g full clear). Boss HP down ~13%
  across all three bosses (300→260, 460→400, 620→540): the round-count math
  looked fine, but Lyra/Mira run out of MP partway through and fall back on
  weak physical hits, so real fights ran longer than the numbers suggested.

## 2026-07-06 (g): Sanctuary Re-Entry Crash Fix

`hintText` (and `shopBox`) are class fields that outlive scene restarts, but
`create()` never reset them. Phaser destroys the previous instance's
GameObjects on shutdown, so the second time Sanctuary loaded, `update()`
called `.setText()` on an already-destroyed `Text` object and crashed.
Reproduced via: descend, retreat, return, descend again.

## 2026-07-06 (f): Side Quests, Completion Toasts, Quest Markers

Wires three new side quests (`learn_of_anchors`, `find_pip`,
`heed_the_stranger`) onto story beats that already existed in dialogue but
were never tracked. Quest completion now shows a toast/log line with the
reward; NPCs/portals get a bouncing marker pointing at the next open
objective. The Quest tab in the menu groups active vs. completed and shows a
progress count.

## 2026-07-06 (e): Menu Polish + Character Identity

- **Class identity**: Lyra is now the **Hexweaver** (Ember Hex, Rime Hex,
  Hexstorm, Winter Sigil), Mira the **Dawnkeeper** (Dawnstrike, Dawnmend,
  Sunward), Kael the **Aetherblade** (Guardbreak, Arc Sweep) — renamed from
  the generic black-mage/cleric/vanguard labels and their spells (was
  Ember/Rime/Emberstorm/Blizzard/Lightstrike/Mend/Radiance/Crush/Cleave).
  Battle's magic-menu label is now per-member (`battleArtLabel()`: "Aether
  Arts" / "Hexes" / "Prayers") instead of a flat Skills/Magic split. Portrait
  art (`src/assets/portraits/*.png`) updated to match.
- **New `RunSummaryScene`**: a dedicated full-screen scene shown after a
  party wipe ("THE CRYSTAL PULLS YOU HOME") or a deliberate retreat
  ("RETURNED TO SANCTUARY") — depth reached, gold carried/lost, run-boon
  count, party levels, then Z/tap wakes in Sanctuary. Replaces the old
  behavior of `BattleScene`/`DescentScene` calling `returnToTown()` and
  jumping straight back to `Sanctuary` with no beat in between.
- **Title-screen save summary** (`save.ts` `loadSaveSummary()`): Continue
  now reads "Continue — Lv N, Stratum M, Xg" with a second line (party
  levels, gear/potion/quest counts) instead of a bare "Continue" label.
- **SFX**: `sfx.play('confirm'/'cancel')` on title-menu navigation.

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
- **Strata:** handmade worlds (Ashenveil Forest -> Sunken City -> Ashen
  Foothills -> Crystal Depths, and beyond), each with its own mood and boss.
  Room layout inside each stratum is generated.
- **Narrative permadeath:** the crystal brings you home, explaining the
  roguelite loop in fiction.

## Technology

- **Phaser 3 + TypeScript + Vite** using pnpm. Internal resolution 480x270,
  tile size 16.
- `vite.config.ts` has `base: './'`, ready for subfolders and Capacitor.
- Later: Capacitor iOS/Android, `@capacitor-community/admob`, and own
  Postgres backend.

## Status: Four Chapters Playable, Menus Polished, Balancing Ongoing, Deployed

Build is verified with `tsc` and `vite build`; modules transpile in the dev
server.

**Current flow:** Boot -> **Title** (Continue/New Game, save summary) ->
**Intro** vignette (first save only) -> **Sanctuary** -> talk/shop -> descend
through the chapter portal -> procedural rooms with random encounters,
chests, springs, quest triggers -> boss at the bottom -> **RunSummary**
(wipe or retreat) -> back to Sanctuary. Progress (levels, gold, gear, quests,
story flags) persists across sessions via `localStorage`.

```text
src/main.ts                   Phaser setup: 10 scenes + bindKeyboard()
src/config.ts                 resolution + color palette
src/scenes/BootScene.ts       generates tiles + character sprites, starts Title/Intro
src/scenes/TitleScene.ts      Continue (save summary)/New Game, confirm-to-erase
src/scenes/IntroScene.ts      Sanctuary backstory vignette (first save only)
src/scenes/SanctuaryScene.ts  city hub: handmade map, NPCs, merchant, chapter portals, quest markers
src/scenes/DescentScene.ts    procedural rooms, depth, encounters/chests/springs, boss portal, recall
src/scenes/BattleScene.ts     battle: menu via input bus + touch, weakness/break, intents, XP, boss phases
src/scenes/BoonScene.ts       post-victory run-boon pick (1 of 3)
src/scenes/RunSummaryScene.ts post-run recap (wipe/retreat) before returning to Sanctuary
src/scenes/DialogueScene.ts   dialogue: typewriter, name box, portrait/vignette, key/tap
src/scenes/GameMenuScene.ts   Stats/Items/Magic/Equip/Quests/System tabs
src/game/types.ts             pure data types (level/xp/growth/xpReward/isBoss/Ailment/GearEffects)
src/game/content.ts           spells, items, party (Kael/Lyra/Mira), learnsets
src/game/chapters.ts          four chapters' areas, encounters, chests, scripts, bosses
src/game/equipment.ts         weapon/armor/charm defs, passive effects, one-copy ownership
src/game/boons.ts             run-scoped blessing pool
src/game/quests.ts            quest defs, gating flags, reward text
src/game/modifiers.ts         roguelite descent modifiers
src/game/battle.ts            turn-based battle engine: AGI, weakness/break, ailments, AI, rewards
src/game/progression.ts       XP curve, levelUp, restoreLevel, grantXp
src/game/run.ts               orchestrator: party, gold, inventory, equipment, quests, depth, save, economy
src/game/save.ts              localStorage save + loadSaveSummary() for the title screen
src/game/input.ts             shared input bus: keyboard + touch controls
src/game/dialogue.ts          data-driven scripts: intro, NPCs, chapter win/ending
src/audio/music.ts            procedural chiptune: per-chapter explore/battle themes + title/sanctuary
src/art/sprites.ts + spriteData.ts  original pixel art for hero, party, enemies, bosses
src/art/tiles.ts              seeded pixel-art tile painters (floor/wall variants per theme)
src/assets/portraits/         painted portrait art (Kael/Lyra/Mira) for dialogue and menus
src/ui/text.ts                shared sharper text style helper
src/ui/questToast.ts          quest-completion toast/log line
capacitor.config.ts + android/ ios/   native wrappers, landscape-locked, for one shared web codebase
```

Note: `SideScrollScene.ts` (an early side-view walking-corridor prototype)
was removed 2026-07-09 (a) — it predated the current fixed-map chapter
system and nothing ever launched it.

**Story so far:** four chapters — Ashenveil Forest (Ancient Grove), Sunken
City (Flooded Keep), Ashen Foothills (Summit Shrine), Crystal Depths
(Radiant Sanctum) — each with its own theme, enemies, an elite guardian, and
a boss with a mid-fight phase transition. Post-Ch3 dialogue foreshadows more
anchors ("the Hollow") beyond Chapter 4, so the story is not yet concluded.
Side quests (`quests.ts`) unlock as chapter flags advance and show
completion toasts + map markers.

**Party & classes:** Kael the **Aetherblade** (physical pressure, guard
break), Lyra the **Hexweaver** (elemental damage + ailments), Mira the
**Dawnkeeper** (holy damage + healing). Battle actions: Attack / magic
(per-class label: Aether Arts / Hexes / Prayers) / Item / Defend / Flee,
resolved in AGI order with weakness/break, intents, and ailments (burn/
chill/venom).

**Save:** `src/game/save.ts` stores localStorage data under
`aetherfall.save.v1`: gold, levels, inventory, equipment (owned + equipped
per member, one copy shared), quests, story flags, deepest stratum.
`run.ts` loads it at startup and writes through `saveProgress()`.
`hardReset()` wipes all progress. `loadSaveSummary()` powers the title
screen's Continue line.

**Input:** `src/game/input.ts` provides one logical input bus. Keyboard
(arrows/WASD, Z/Enter/Space=confirm, X/Backspace=cancel, Tab/C=menu, M=mute)
and on-screen d-pad + A/B buttons feed the same bus; touch layouts are
per-scene and decluttered to avoid overlapping tappable content (battle,
GameMenu, RunSummary). Dialogue can also be tapped.

**Mobile:** shared codebase, orientation-locked to landscape natively (iOS
`LandscapeLeft/Right`, Android `sensorLandscape`); the browser shows a
CSS-only rotate prompt in portrait on coarse-pointer devices. `pnpm sync`
runs build + Capacitor sync; `pnpm android`/`pnpm ios` build/sync/open
native projects. AdMob can be plugged in later for monetization.

**Music:** original procedural Web Audio, no audio files — a distinct
explore/battle theme per chapter (forest/sunken/ashen/crystal) plus
dedicated title and Sanctuary themes. M toggles mute. Audio starts on first
input due to browser autoplay policy; `AudioContext.resume()` fires
immediately on creation so the very first keypress isn't swallowed.
One-shot fanfares play for victory and defeat.

**Deployment:** live at **https://aetherfall.nguyenchu.com** as of 2026-07-09,
served as a static build from `/var/www/aetherfall` by nginx on the same
home-server box that hosts nguyenchu.com's other subdomains (an Ubuntu
desktop, not a cloud VPS). TLS via Certbot's `dns-cloudflare` plugin (the
established pattern on that box for every subdomain — the `--nginx`/HTTP-01
route does *not* work here, port 80 isn't reachable from the internet on
this connection; DNS-01 sidesteps that entirely). Static files only, no
systemd service needed (mirrors the existing `/themepark` static-site
pattern on the root `nguyenchu.com` config) — `root` + `try_files $uri $uri/
/index.html` for SPA fallback. To redeploy: `pnpm build` locally, `rsync`
the `dist/` output to `/var/www/aetherfall` on the server, no nginx/cert
changes needed unless the domain changes. Known gotcha: the server and a
browser on the *same home WiFi* may not be able to reach the public
hostname (common home-router "NAT loopback" limitation) — works fine from
outside the network; affected devices can use the LAN IP or a local DNS
override if needed.

Run:

```bash
pnpm dev
```

Open http://localhost:5173. Title screen -> Sanctuary -> walk into NPCs to
talk, use a chapter portal to descend.

## Roadmap

1. Done: **Skeleton** - procedural descent + movement
2. Done: **Battle** - turn-based combat with weakness/break, intents, ailments, boons
3. Done: **Run loop** - city hub, depth, XP/levels, gold economy, save, death/retreat return
4. In progress: **Content** - four chapters (Forest/Sunken/Ashen/Crystal) with side quests done;
   more chapters planned per the story's "more anchors to come" foreshadowing; gold economy
   now audited/balanced across all four chapters (2026-07-07, 2026-07-09 (b)/(d))
5. In progress: **Mobile playability** - landscape lock + rotate prompt done; touch controls
   decluttered per-scene; still needs real-device testing pass
6. Done: **Validation** - deployed to https://aetherfall.nguyenchu.com (2026-07-09); retention/
   feedback measurement itself is still todo
7. Todo: **Monetization** - AdMob rewarded ads + IAP

## Suggested Next Steps

- **Chapter 5:** the story explicitly foreshadows more anchors/"the Hollow"
  beyond Crystal Depths; the chapter-authoring pattern (area pair, encounter
  factories, elite + boss with phase transition, dialogue, shop unlock,
  quest) is now well-established across four chapters.
- **Real-device mobile testing:** landscape lock, rotate prompt, and touch
  decluttering are done but only verified via CDP/emulation, not a physical
  phone.
- **More story:** the Stranger/Child dialogue gaps are filled (2026-07-09
  (c)), but there's room for more NPC follow-up lines and optional dialogue
  as the player goes deeper, following the `_after4`-style per-chapter
  pattern.
- **Retention/feedback measurement:** the game is deployed and reachable;
  actually gathering playtester feedback is still todo.
- **Monetization:** still todo per the Roadmap — AdMob rewarded ads + IAP.
- **JS bundle size:** Vite flags the production bundle at ~1.7MB
  (minified, ~400KB gzipped) as larger than its default chunk-size warning —
  works fine, but code-splitting would improve load time.
