# Aetherfall - Context & Decision Log

> Paste this into a new session to continue the work. Last updated: 2026-07-23.

## 2026-07-23 (gui 2): Sanctuary's Shape — A Keep Built Around the Anchor

Follow-up ask: "kan du gjøre mer av dette, men kanskje også sånn at det gir
mening? sanctuary trenger ikke være firkantet" (do more of this, but make
it make sense — Sanctuary doesn't need to be square). Gave a short
recommendation (3 options via AskUserQuestion: fortress-around-the-Anchor,
distinct quarters, organically-grown town) rather than picking one myself —
this was a real creative-direction fork, not a bug to fix. User picked
fortress-around-the-Anchor.

Replaced the 30x15 rectangle with a 39x21 chamfered-corner octagon (a keep
wall, not a box) — the shape now has an in-fiction reason: it's built to
protect the Anchor shard at its center, the same "last city of light"
IntroScene's cosmology already established. Designed and validated the
whole layout with a throwaway Node script (`.scratch-verify/`, not
committed) before touching the real map: generates the octagon via a
corner-chamfer distance check, carves 5 gate alcoves through the ring (the
always-open Ch1 gate top, one per later chapter — right/left/two-bottom —
so the silhouette reads as "expeditions launch in different directions"),
places the two NPC buildings + all entities, then flood-fills from spawn to
confirm every entity/gate tile is actually reachable. This caught two real
mistakes before they ever hit the browser: an early gate alcove landed
under Scholar Voss's building block (sealed shut — buildings were placed
after gate-carving and silently overwrote the corridor), and the initial
NPC building footprint boxed Eda/Voss into a 3-walls recess reachable from
only one tile.

Final layout: Warden Eda and Scholar Voss's buildings flank a central
shrine (the Anchor, plus a fountain just south of it, inherited from the
prior session's decor pass and repositioned) — they're guarding it now,
not just standing near an unrelated corner. Merchant/Child/plaza clutter
moved south of the shrine (inner keep vs. outer bailey). All prior decor
(lanterns/banners/flowers/crate/barrel) repositioned to match. Also fixed
a latent duplication bug while in there: the "next objective" bounce
marker had its own hardcoded Anchor position (`{x:11,y:8}`) separate from
the MAP's own `'A'` tile — replaced with a grid scan, the same pattern the
existing Ch1-gate-label code already used for `'D'`, so the two positions
can't drift apart again.

Verified: the flood-fill script (structural proof, run before porting
anything into `SanctuaryScene.ts`), then live with Playwright same as the
prior decor session — fresh save to Sanctuary, full screenshot confirms the
octagon/alcoves/buildings/decor all render correctly, walked the player
toward the fountain and confirmed it still blocks at its new position. No
console/page errors. `tsc --noEmit` clean. Grid now 624x336px, still fits
the fixed 640x360 canvas with no camera-scroll changes needed.

## 2026-07-23 (gui): Sanctuary Gets a Decor Pass — Lanterns, Banners, Flowers, a Fountain

Ask: "la oss pynte sånn at sanctuary har masse detaljer og ser fint ut"
(let's decorate so Sanctuary has lots of detail and looks nice). Pure
visual-polish request, not gameplay/balance — Sanctuary's plaza was flat
flagstone/wall tiles with zero ambient props, plain next to the rest of
the game's hand-painted pixel art.

`BootScene.ts` gained `buildSanctuaryDecor()` (+`makeDecorTexture`, a
card-less sibling of the existing `makeIcon`): six new Graphics-drawn
textures — `decor_lantern` (iron post + warm glass), two banner variants
(`decor_banner_gold`/`_violet`), `decor_flowers`, `decor_crate`,
`decor_barrel`, and `decor_fountain` (stone basin around aether-violet
water, tying the plaza centerpiece into the game's anchor/aether motif
instead of a generic water feature).

`SanctuaryScene.ts`: a new `DECOR` table (hand-picked `{x,y,kind}`
coordinates, checked one-by-one against every NPC/portal/building tile so
nothing overlaps) rendered by `placeDecor()` after `drawMap()` — 5
lanterns (each with a pulsing warm-glow circle layered on top) flanking
the two NPC buildings and the Chapter 1 gate, gold/violet banners on
Warden Eda's and Scholar Voss's building facades respectively, 9 flower
beds across the open plaza, and a crate+barrel by the Merchant. All of
that is pure decoration — none of it touches collision.

The one exception is the new plaza fountain (`placeFountain()`, its own
pulsing water-glint tween): made it **blocking** on purpose, via a new
`'F'` map tile, so the plaza centerpiece reads as a real town-square
obstacle instead of walk-through scenery. Extended the two existing
`ch === '#'` collision checks (`update()`'s movement, `isWanderable()`'s
NPC-wander check) to also treat `'F'` as solid — the only logic change in
an otherwise purely additive pass.

Live-verified with Playwright (cold-start setup per `.claude/skills/verify/
SKILL.md`, fresh save through to Sanctuary): full-map and zoomed-crop
screenshots confirm every prop renders in the right place with no z-order
or overlap glitches; walked the player 8 tiles straight at the fountain
and confirmed it stops one tile short and stays there across repeated
presses (blocked), not walking through. `tsc --noEmit` clean. Playwright
was installed/removed the same way prior verify sessions have (`pnpm
install --save-dev playwright` → verify → `git checkout --
package.json pnpm-lock.yaml`), so the manifests are unchanged.

## 2026-07-23 (gameplay 2): Chapter 5 Survivability Audit + Bulwark Couldn't Shield Boss Bursts

Follow-up to "hva skal vi forbedre nå?" -> user picked both proposed options:
a Chapter-5 difficulty-curve check (the "no one-shots" pass ch1-4 got on
2026-07-11, never redone for the newer chapter) and a balance pass on the
two new Limit Break pairs from two sessions back.

**Chapter 5 survivability — audited, no bug found.** Wrote a standalone
`tsx` script (`chapters.ts`/`content.ts`/`progression.ts` have no Phaser
dependency) that replays every *guaranteed* (non-random) depth 1-8
encounter via the real `makeEncounterForArea`/`grantXp` to get a grounded
"worst case, zero random battles" level floor at depth-9 entry: **L11**,
party maxHp 160/86/114 (kael/lyra/mira). A looser "+3 randoms/area"
estimate lands at L12, maxHp 170/91/121 — level estimate is stable either
way. Checked every Chapter 5 enemy/boss's worst single hit (basic attack +
known spells, using the real `strike`/`castDamage` formulas by hand) plus
Galebrand's flat, VIT-bypassing phase-2 burst against both. Worst case:
Lyra takes 51-57% of her HP in one hit (Thunderhead Sentinel's basic
attack, or Galebrand's burst) — survivable, matches the "squishiest but
not one-shottable" bar the 2026-07-11 audit set for chapters 1-4. No
one-shot risk found; no change made.

**Limit Break balance — two pairs fine, one real gap found and fixed.**
Computed Cataclysm/Frostbind and Aegis/Judgment's actual numbers at L11:
Cataclysm one-shots most Chapter 5 trash (88 dmg vs. 78-150 HP) while
Frostbind trades power (48 dmg) for a guaranteed AoE Chill; Judgment (62
flat AoE) vs. Aegis (pure full-party heal/revive/cleanse) are both
clearly situational, not a dominant-choice problem — no change needed
there.

Kael's pair was different. Every boss's phase-2 transition burst
(Forest Shade's Shadow Veil, Tide Warden's Tidal Surge, Ashbrand's
Conflagration, Prism Sovereign's Refracted Blades, Galebrand's Wild
Current) deals damage via a **direct `applyDamage()` call**, bypassing
`computeHit()` — a deliberate choice from 2026-07-11 so Defend can't
trivialize the one scripted "heal-or-die" spike per boss fight. Kael's new
**Warden's Bulwark** (party-wide 50% damage-taken shield, 3 turns) reads
`dmgTakenStatus`, but that field is only ever checked *inside*
`computeHit()` — so Bulwark, sold specifically as anti-burst protection,
could never touch the single biggest hit in any boss fight. Unlike the
Defend bypass (a free, always-available action the burst is meant to
punish), Bulwark is a resource-gated, one-shot ultimate whose entire pitch
is "shield the party from damage" — leaving it blind to exactly the
moment it exists for isn't the same deliberate call, it's Bulwark getting
caught in a bypass that predates it.

Fix (`battle.ts`): new `applyBossBurst(t, dmg)` — applies
`dmgTakenStatus`'s multiplier if present (still ignoring VIT/crit/
weakness/Defend, unchanged), used by all five phase-2 cases in place of
the raw `applyDamage()` call. Event log text/`amount` now shows the
post-shield number so the log doesn't misreport what actually landed.

Verified with a standalone script exercising the real `Battle.executeTurn`
path against Galebrand: no shield/not defending → 49 dmg; defending → still
49 (bypass correctly preserved); Bulwark active (0.5x) → 25 (halved, the
fix). `tsc --noEmit` clean.

## 2026-07-23 (gameplay): Rift Could Roll Chapter 5 Content Before You'd Ever Seen It

Follow-up to "fortsett med å forbedre spillet" (continue improving the
game) — same audit method as the previous session's boss-AI pass, this
time over the endgame Rift (`rift.ts`) instead of `battle.ts`.

The Rift (`SanctuaryScene`'s Anchor NPC) unlocks at `ch4_complete` — always
has, per its own top-of-file comment ("reached from Sanctuary's Anchor once
Chapter 4 is cleared"). `generateRift()` picked its theme with a flat
`Phaser.Utils.Array.GetRandom(CONFIGS)` across all five chapter themes.
That was correct when only 4 chapters existed; once Chapter 5 (Tempest,
`galebrand`) was added, its `tempest` config went straight into the same
pool with no one revisiting the Rift's gate. Net effect: a player who had
*just* cleared Chapter 4 and talked to the Anchor for the first time could
roll a Squall Rift — permanently-hasted Gale Harriers, 35%-reflect
Storm-Warped Sentries, Galebrand itself (860 HP even at tier 0) — none of
which they'd ever encountered, using mechanics (speed-drag, reflect
punishment) the game hadn't taught them yet.

Fix: `RiftConfig` gained a `chapter` field (1-5, matching each theme's
source chapter); `generateRift(tier, maxChapter)` filters `CONFIGS` to
`chapter <= maxChapter` before picking. `SanctuaryScene.enterRift()` now
computes `maxChapter = hasFlag('ch5_complete') ? 5 : 4` and passes it
through — so a Chapter 4 finisher only ever rolls the four themes they've
actually played, and Tempest joins the pool the moment Chapter 5 is done
too. `tsc --noEmit` clean.

**Not verified live**, and for a different reason than usual in this log:
`rift.ts` imports the full `Phaser` package (`Phaser.Utils.Array.GetRandom`,
`Phaser.Math.*`) rather than being a plain-TS module like `battle.ts`, so it
can't run standalone under `tsx` the way the boss-AI fix's test script
did — attempted it with manual `window`/`document` stubs, got past device
detection but hit `Image is not defined` deeper in Phaser's canvas-feature
probing. Not worth vendoring a DOM shim for. Verified by direct code
review instead: confirmed the five `chapter` values match `CONFIGS`' own
array order (forest=1 ... tempest=5), the filter predicate is a plain `<=`,
and `enterRift()` is the sole call site (grepped).

## 2026-07-22 (gameplay): Tide Warden's Phase 2 Was the One Boss With No AI Identity

Ask: "hva forbedrer vi nå?" then "commit og push og forbedre gameplay etter
det" (what are we improving now, then commit/push and improve gameplay
after that). First committed a large pending working-tree diff (dual Limit
Breaks per party member, boss sprites/scale/halo, live Haste queue preview,
dedicated NPC sprites, stepwise Descent retreat, simplified shop sell-all,
slower intro pacing) that had accumulated uncommitted — not written this
session, just landed and pushed as-is after a clean `tsc --noEmit`. Note:
this environment had no git author identity configured at all (not just
missing on this machine's global config) — had to ask the user and set
`user.name`/`user.email` **locally** (this repo only) before any commit
could go through.

For the actual "improve gameplay" ask, audited `battle.ts`'s `enemyAi`/
`executeBossPhase`/`bossTick` across all five bosses (mirrors the
2026-07-16 boon/AI audit's method). Finding: Forest Shade (alternating
weakness), Ashbrand (hunts anyone bracing), and Galebrand (half-random
targeting) each gained a distinct phase-2 *behavior* change on top of the
generic stat/heal bump. Prism Sovereign has its own `enrageOnOwnTurn`
self-haste escalation. **Tide Warden was the one exception** — its phase 2
(`Undertow`: heal 12% + a 3-turn attack-speed-drag debuff on whoever it
next hits) was pure flavor text over the same unchanged weakest-HP-ratio
targeting every non-boss enemy uses.

Fix (`battle.ts` `enemyAi`): past phase 2, Tide Warden now prioritizes
whoever has the *highest readiness* (closest to acting next) instead of
weakest HP ratio — thematically Undertow punishes momentum, not health.
One `priority = e.id === 'tide_warden' && e.phaseTriggered ? soonest :
weakest` branch, same 60%-priority/40%-random-pool structure as the
existing weakest-HP pick.

Verified with a standalone logic script (`battle.ts` has no Phaser
dependency, runs under `tsx` directly against `chapters.ts`/`content.ts`
factories — same approach as the 2026-07-16 boon audit): forced distinct
HP-ratio/readiness on each party member so the two strategies would
disagree, called the private `enemyAi` 500× each side of the phase flag.
Pre-phase: 267/500 picks went to the weakest-HP member (as before).
Post-phase: 249/500 shifted to the highest-readiness member instead —
confirms the branch actually fires and doesn't accidentally affect
pre-phase behavior. `tsc --noEmit` clean. Scratch test script deleted
after, not committed. Not verified in a live browser battle (no vendored
driver reaching a real Tide Warden phase-2 turn) — same bar as most prior
`battle.ts`-only logic changes in this log.

## 2026-07-16 (gui): Longer Intro Cutscene + a Real Battle-Start Entrance

Ask: "lag lengre animasjon i starten" (make the animation at the start
longer), clarified to mean both the opening cinematic and battle entrance.

**IntroScene.ts**: scaled up every phase's hold time (~1.4-1.6x), stretching
the total runtime from ~24s to ~35s. `seq0_void` 2000->3000ms; `seq1_crystal`
4500->6500ms (crystal/caption fade-ins slowed too); `seq2_flicker`
2000->3000ms with the flicker itself extended (repeat 8->12) so it still
fills the held time; `seq3_shatter` 3000->4500ms with longer shard flight
(700-1400 -> 900-1800ms); `seq4_rain` 3200->5000ms with more rain drops
(repeat 60->90); `seq5_sanctuary` 5000->7000ms with the three captions
re-paced to fit; `seq6_heroes` 3200->4500ms + a longer pre-title pause
(500->800ms); final fade-out 800->1100ms. Docstring's phase-start comments
updated to match. Skip-on-any-key still works identically.

**BattleScene.ts**: battles previously popped in with zero transition — no
`fadeIn` anywhere in the file. Added `cameras.main.fadeIn(400, ...)` at the
top of `create()`, and reworked `placeSide()` so combatants slide + fade
into their positions (enemies from further left, party from further
right, `Back.easeOut`, staggered ~140ms apart) instead of appearing fully
formed instantly. The elite ring and idle-bob tween (previously started
immediately) now only start once a combatant's own entrance tween
finishes (`startIdleMotion()`), so nothing bobs or pulses mid-slide.

**Verification note**: this repo's headless-Chromium test harness has a
known, previously-documented issue where `scene.time.delayedCall`/`addEvent`
callbacks (used by `IntroScene`'s `after()` helper) don't fire reliably at
this environment's very low actual FPS — confirmed again here (a phase
transition looked stuck past its expected time in a real-time screenshot
test). Distinguished this from an actual bug by inspecting object state
directly: star fade-tween alpha values were correctly progressing
(0.3-0.9 range) and `scene.time.now` advanced normally, proving the
scene's own logic is correct and this is purely the pre-existing
timer-callback quirk, not a regression. `Tweens.add` (used by the new
battle-entrance animation, not `delayedCall`) was confirmed reliable in
this same environment via direct state checks: sprites captured mid-slide
at their offset start position with `alpha: 0`, then at their final home
position with `alpha: 1` a moment later — both screenshotted and
programmatically verified. `tsc --noEmit` clean, no console/page errors.

## 2026-07-16 (gui): Show a Spell's Element (and Weakness Match) in the Magic List

Ask: "bør vi ha at skills viser allerede hva som monstre er weak mot før vi
velger det?" (should skills already show what monsters are weak against
before we pick one). The information already existed twice over — enemies
show a persistent colored element-letter badge next to their HP bar all
fight, and `pointCursorAtTarget()` already prints "▶ Name: WEAK to this!"
once you've picked a spell and reached target-select — but the Magic list
itself only showed spell name + MP cost, so matching a spell to a badge
meant remembering the mapping or committing blind and finding out after.

`BattleScene.ts`: `subItems` gained optional `element`/`weak` fields.
`openMagic()` now computes, per spell, its element (skipped for `element:
'none'` heals) and whether any currently-living enemy is weak to it
(`this.battle.living('enemy')`). `renderSubmenu()` renders that as a small
badge reusing the exact same `ELEMENT_LETTER`/`ELEMENT_COLOR` maps the
enemy badges already use — plain letter normally, a gold `✦` prefix + gold
color when it matches a live weakness. Scoped to spells only (not the
top-level Attack command), since attack element is fixed per character
rather than a per-turn choice.

Verified live: forced a real elite battle (Alpha Shade Wolf + Shadow Wolf,
both weak to fire) and opened Kael's list (Guardbreak, phys — plain white
"P", not starred, correctly no match) and Lyra's list (Ember Hex, fire —
gold "✦F"; Rime Hex, ice — plain blue "I", correctly no match). `tsc
--noEmit` clean, no console/page errors.

## 2026-07-16 (gui): Same Portrait Ring Treatment on Main Story Dialogue

Follow-up ("fortsett") to the banter-toast portrait pass. The banter toast
got a glowing colored ring per speaker, but `DialogueScene` — where
portraits actually show up most (every story beat and NPC conversation) —
still had a plain static-gray (`COLORS.wall`) frame around the portrait,
regardless of who's talking. Extended the same treatment there for
consistency:
- New `portraitGlow` rectangle (68x68, behind the frame, depth 0.5),
  recolored per line.
- `setPortraitRing(color)` helper: sets the glow's fill and the existing
  `portrait` frame's stroke to the line's own `color` (falls back to
  `0xdfe4f5` if a line has no color, though in practice every non-narration
  line has one).
- Applies to both branches that show a portrait: real art
  (`portrait_kael`/etc.) and the color-swatch dot fallback used for NPCs
  without dedicated portrait art (Warden Eda, Scholar Voss, the Child, the
  Stranger) — so even NPCs without custom art get a matching colored ring
  instead of looking unfinished next to the three heroes.

Verified live: Kael's `ch1_win` line shows the teal ring around his real
portrait art; Warden Eda's `npc_keeper` line shows the same gold ring
around her color-swatch dot. No console/page errors.

## 2026-07-16 (gui): Portraits in the Banter Toast

Ask: "når de snakker, vis portrett også. gjør om på portrettene til noe kul"
(show a portrait when they talk; make the portraits something cool). The
banter toast (added earlier the same day) only showed a name + colored
text, no art — everywhere else a character "talks" (DialogueScene,
BattleScene's turn queue, GameMenuScene) already uses the same
`portrait_kael`/`portrait_lyra`/`portrait_mira` PNGs (real painted art, not
placeholder pixel work — see `src/assets/portraits/`), so banter was the
odd one out.

- `game/banter.ts`: `BanterLine` gained a `portrait` field. Refactored the
  per-line `{ speaker, color }` repetition into three shared constants
  (`KAEL`/`LYRA`/`MIRA`, each bundling speaker/color/portrait) spread into
  every line — same content, less duplication.
- `ui/banterToast.ts`: each line now renders its portrait as a 38x38 chip
  with a square glow backdrop + colored ring border in the speaker's own
  accent color, both updated per line via `setTexture`/`setFillStyle`/
  `setStrokeStyle` as the toast cycles speakers. Deliberately square, not
  circular — a true circular crop would need a geometry mask (fragile on a
  tweening container) and would've clipped the square source art's
  corners anyway; the square-glow treatment instead echoes BattleScene's
  existing "active turn" chip motif (gold-framed square portrait), so it
  reads as the same "spotlighted character" language already used
  elsewhere in the game rather than a new, disconnected style.

**Verification note for future sessions**: multi-line beat auto-advance
(the `scene.time.delayedCall` chain in `showLine()`) looked stuck on line 1
under this repo's headless-Chromium+SwiftShader test setup even after
several real seconds — traced to `Phaser.Time.Clock`'s `PRE_UPDATE` event
(which promotes a freshly-added timer from pending to active) not firing
reliably at this environment's very low actual FPS, even though `UPDATE`
(which just stamps `.now`) clearly does — confirmed by manually pumping
`clock.preUpdate()` + `clock.update(t, 16.6)` in lockstep, which advanced
the beat correctly. This is the same class of pre-existing headless-loop
throttling documented earlier in this project's history, not a code bug —
single-line portrait/color/ring rendering was screenshot-verified directly
for all three characters (Kael teal, Lyra purple, Mira gold), and the
sequencing logic itself was confirmed correct via the manual clock pump.

## 2026-07-16 (story): Inotia 3 Pass — Ambient Banter, Deeper Quests, Tighter Plot, Merchant Humor

Ask: "hva forbedrer vi nå? jeg lurer på om vi bør ha en slags historie som
gir mening. tenk inotia 3" (what do we improve now, wondering if we should
have a story that makes sense, think Inotia 3). Diagnosis: the previous
narrative rewrite (character voices, backstory payoffs) was solid, but the
party was completely silent *outside* scripted story beats — Inotia 3's
actual strength isn't its plot, it's that the party never really goes
quiet. Picked all 4 proposed directions rather than one.

**1. Ambient exploration banter (new system).** `game/banter.ts`: pools of
short multi-line exchanges (`BanterBeat`, 1-3 lines each) tagged by
character voice, with optional `minFlag` gating so later banter can
reference events (Toren's blade, an anchor restored) without being
available before they happen. `pickBanter()` avoids repeating the last beat
shown. `ui/banterToast.ts`: a small non-blocking speech toast (bottom-
center, ~240x40px) that cycles through a beat's lines and fades — unlike
DialogueScene it never pauses input or movement. Wired into both
`DescentScene.ts` and `SanctuaryScene.ts` the same way the existing random-
encounter roll works: a per-step counter + a small chance once a step floor
is cleared (`resolveTile()` for Descent, the normal-movement branch of
`update()` for Sanctuary), skipped whenever an encounter/portal/NPC-
interact already consumed that step. ~12 descent beats, ~8 Sanctuary beats,
mixing serious character moments with lighter banter.

**2. Deeper side-quest chains.** Eda/Voss/Child previously had one paid
"talk once" quest each with a hard stop (the story kept escalating in
their dialogue tiers, but the quest system never paid out again). Copied
the Stranger's existing `heed_the_stranger` -> `stranger_truth` pattern
(dynamic `questId` switch on `ch4Done`) onto all three: `speak_eda` ->
`eda_watchline`, `learn_of_anchors` -> `voss_hollow`, `find_pip` ->
`pip_digging`, all unlocking at `ch4_complete` (`quests.ts`). Each pays off
with a real twist appended to their existing `_after4` scripts
(`dialogue.ts`): Eda admits she signed off on Kael's watch-line assignment
and still isn't sure it was worth it; Voss finally translates "Twisting
Hollow" as a warning, not a place-name — Ashenveil was deliberately chosen
as the weakest anchor, not stumbled onto; Pip digs up a tarnished
watch-sigil by Sanctuary's own well, matching the marks from the grove and
the Ch4 casing — the same threat has already reached home.

**3. Tightened the main throughline.** The "Twisting Hollow" line
(`npc_scholar_after3`) was a real reveal that never got referenced again —
a dropped thread, which was likely a chunk of what "doesn't make sense"
was pointing at. Fixed via Voss's ch4 twist above, plus one new `ending`
line (Mira, right before the "eight anchors remain" beat) acknowledging
the well-sigil discovery specifically — so the endgame stakes ("it knows
we're coming") are earned by something concrete in Sanctuary, not just
told.

**4. Light self-aware humor.** `MERCHANT_QUIPS` in `banter.ts` — six dry
one-liners, one picked per shop visit (`SanctuaryScene.openShop()`) and
rendered under the "MERCHANT" header, e.g. "No refunds. Not even if the
sword turns out to be cursed. Especially not then." Kept out of the
banter pools proper (which stay mostly in-voice) since the merchant is the
one character who's always been more of a fixture than a person.

Verified live (headless Chrome): forced both banter systems via the real
`pickBanter`/`showBanterToast` call path — screenshots confirm clean,
non-overlapping toasts in both Descent (over a live dungeon, doesn't clip
the touch d-pad) and Sanctuary (full hub map visible, "the Anchor" NPC
labeled correctly per the earlier rename); Merchant quip renders correctly
under the shop header; all three new quest ids resolve and their
`ch4Done`-gated `questId` switch confirmed live on Eda's actual `LiveNpc`
state; new dialogue script text read back correct with no truncation or
escaping bugs. `tsc --noEmit` clean throughout. No console/page errors
beyond one benign 404 (browser's default favicon request, unrelated).

## 2026-07-16 (story): "The Crystal" Didn't Make Sense — Renamed to "the Anchor"

Ask: "fjern The Crystal. det gir ikke noe mening" (remove The Crystal, it
doesn't make sense). Root cause: the game had **two unrelated things both
called "the Crystal."** IntroScene's cold-open cosmology has a primordial
Aether crystal that "fell" and "shattered into 12 shards" which became "the
twelve anchors" — that part is real, load-bearing lore (it's why anchors
exist at all). Completely separately, `SanctuaryScene.ts` had an NPC
literally named `'the Crystal'` (kind: `'ascend'`) that opens the Ascension
scene, plus a pile of flavor text calling the party-wipe recall "the
Crystal" too — a second, disconnected entity sharing the same name as the
first, explaining nothing about why it does what it does. That's the
"doesn't make sense" — chose "remove the whole concept + mechanic" (not
just reword one line) when asked to scope it.

Fix: renamed every occurrence of that second, entity-flavored "Crystal" to
**"the Anchor"** — reframed as Sanctuary's own anchor-shard (one of the
twelve from the Intro's cosmology, kept safe at home), tying the
death-recall/Ascension mechanic back into lore that already exists instead
of inventing a second magic rock:
- `SanctuaryScene.ts`: the ascend NPC is now `name: 'the Anchor'` (comment
  updated to note it's a shard of the one that shattered).
- Boon `crystal_promise` -> `anchors_promise` / "Anchor's Promise" (id,
  name, and its battle.ts revive-flavor text `"The Anchor flares — ..."`).
- All remaining flavor text/comments: `RunSummaryScene.ts`'s wipe title
  ("THE ANCHOR PULLS YOU HOME"), `BoonScene.ts`'s subtitle, `BattleScene.ts`'s
  game-over log line, `AscendScene.ts`/`GameMenuScene.ts`/`run.ts`/`save.ts`
  comments.
- **Left untouched on purpose**: IntroScene's primordial crystal (the
  origin lore, now the *only* "Crystal"), and every mundane/adjectival use
  of the word — "Crystal Depths" (Ch4 area name), "Crystal Wisp" (Ch4
  enemy), "Crystal Weakness"/"Crystal Blessing" (unrelated modifier/shop-
  upgrade names), "Crystalline" (an equipment trait). None of those claim to
  *be* the entity that pulls you home or grants Ascension, so they don't
  carry the same confusion — renaming them would've been surface-level
  word-scrubbing, not fixing the actual sense-doesn't-follow problem.

Verified live (headless Chrome): force-set all four chapter-complete flags
and loaded Sanctuary — the ascend NPC's `def.name` reads `"the Anchor"`;
forced `RunSummary` with `reason: 'wipe'` — title renders "THE ANCHOR PULLS
YOU HOME"; forced `BoonPick` with the renamed boon — card shows "Anchor's
Promise". `tsc --noEmit` clean, no console/page errors, no leftover
`'the Crystal'` references (grepped after each pass).

## 2026-07-16 (gui): Remove the Bottom-Left Party Panel from Descent Maps

Ask: "fjern kael lyra mira info venstre nederst i noen kart" — the compact
party name/HP/MP panel `DescentHudScene.buildPartyHud()` drew in the
bottom-left corner during dungeon exploration was unwanted clutter. Removed
`buildPartyHud()`/`updatePartyHud()`/`PartyHudRow` entirely from
`DescentHudScene.ts`, and the two now-dead `this.hud.updatePartyHud()` call
sites in `DescentScene.ts` (per-frame `update()` and after using a healing
spring). Party HP/MP during a descent is still visible via the GameMenu
(pause) screen; this only removed the always-on-screen mini version.
Verified live: screenshot of a fresh descent map shows only the top-left
area name / top-right gold+modifier HUD — bottom-left is now clear except
the touch d-pad. No console/page errors.

## 2026-07-16 (gui): Surface the New Synergy Mechanics, Real Boon Names on the Run Recap

Follow-up to the same day's boon-synergy pass: that work added Momentum
(stacking crit from weakness hits) and Guardian's Wrath (defend buffs the
next action) with zero player-visible feedback — mechanically real but
invisible. Also flagged in passing: `RunSummaryScene` showed "Run boons: 3",
a bare count, on a roguelite's end-of-run recap where players actually want
to see what they built.

Fixes:
- `battle.ts`: added `Battle.momentumInfo()` (`{ active, stacks }`) — a
  public accessor so the scene doesn't need to reach into the private
  `momentumStacks` field.
- `BattleScene.ts`: `renderQueue()`'s "ORDER" label now reads `ORDER ✦3` in
  the same gold (`#f0d36c`) used for the active-turn chip whenever Momentum
  is active and stacked; `refreshStatus()` gives each party row a gold
  glowing border (`setStrokeStyle`) while `guardBuffed` is true, same accent,
  so Guardian's Wrath reads as "this character is charged" at a glance.
- `RunSummaryScene.ts`: replaced the boon-count row with a wrapped list of
  actual boon names (`BOONS[id].name`), falling back to "None this run".
  Tightened the stat-row spacing (28px -> 24px) to make room without
  crowding the party-level line below.

Verified live (headless Chrome, SwiftShader): forced `RunSummary` with 4
boons active — names render on one line, no overlap with the party/hint
text below; forced it again with zero boons — "None this run" renders
clean. Forced a real elite `Battle` via `triggerEncounter`, set
`guardBuffed = true` on Kael and `momentumStacks = 3` directly on the live
`Battle` instance, called `refreshStatus()`/`renderQueue()` — screenshot
confirms Kael's row gets the gold border and the queue label reads
`ORDER ✦3`, both while Lyra/Mira's rows stay unstyled. No console/page
errors (one benign 404, unrelated to game code — browser's default favicon
request).

## 2026-07-16 (gameplay): Boon Synergies, Fairer Modifiers, Smarter Enemy AI

Playtest ask: "improve gameplay considerably." Audited `battle.ts`/`boons.ts`/
`modifiers.ts`/`progression.ts`. Findings: all 18 boons were flat stat
multipliers with zero synergy between them despite the game explicitly
citing "the Hades model" (Hades' depth comes from boons that combine); two
of six run modifiers (`crystal_weakness`, `dark_drain`) were pure downside
with no compensating upside, unlike `blood_pact`'s real risk/reward; enemy
AI targeted raw-HP "weakest" (not HP ratio) and never avoided defending
targets or varied ailment application.

**Six new synergy boons** (`boons.ts`), each a mechanic hook that combines
with several existing boons instead of standing alone:
- `vulnerable_flesh` (epic): any ailment on an enemy (not just the DoT
  itself) makes it take +20% from everything — amplifies every
  ailment-applying boon/weapon in the pool.
- `spreading_rot` (rare): a dying Burning/Poisoned enemy's affliction leaps
  to another living enemy — combos with `smoldering_ruin`/`kindling_soul`/
  `winters_grasp` into a real DoT-spread build.
- `momentum` (rare): weakness hits stack +10% crit for the rest of the
  battle, capped at +50% — rewards `perfect_break`/`shattering_force`-style
  weakness-hunting builds.
- `broken_chill` (rare): breaking an enemy also Chills it (slower, weaker).
- `last_stand` (epic): below 30% HP, +40% damage and +15% crit — pairs with
  `crystal_promise`/`iron_bulwark` as a deliberate high-risk safety net.
- `guardians_wrath` (rare): defending empowers the bearer's next action,
  +30% damage — makes Defend an active choice, not just a filler heal-tick.

Implementation notes: `Momentum`'s stack count and `Guardian's Wrath`'s
buffed flag are the first boon effects that need battle-scoped/combatant-
scoped *state* rather than a flat `BoonTotals` number — added
`Battle.momentumStacks` and `Combatant.guardBuffed` (consumed by
`executeTurn()` right after a non-defend action resolves, so it survives
repeated defends and covers the whole action even for AoE spells).

**Modifiers** (`modifiers.ts`): `crystal_weakness` now also grants +15%
damage ("desperation sharpens the blade"); `dark_drain` now also grants
+30% gold ("the drained Aether turns to gold"). Both reuse existing
`RunModifier` fields (`dmgMult`/`goldMult`) already read by `battle.ts` —
no engine changes needed, pure data.

**Enemy AI** (`battle.ts` `enemyAi`): "weakest" now compares HP *ratio*
(`hp/maxHp`), not raw HP — a squishy caster at 90% no longer loses out to a
tank at 50% with more raw HP. Prefers non-defending targets when any exist
(a defending target only takes half/three-quarter damage, so hitting them
was usually the weaker play the AI didn't know to avoid). When casting a
spell that inflicts an ailment, prefers a target who doesn't have it yet
instead of piling onto the same target — spreads pressure across the party.

Verified with a direct logic-level test script (`battle.ts` has no Phaser
dependency by design, so it runs standalone under `tsx`, bypassing the
browser): 15/15 checks — Vulnerable Flesh's damage ratio, Guardian's
Wrath's set/consume/refresh-on-redefend lifecycle, Momentum's stacking and
cap, Broken Chill firing exactly on break, Last Stand's damage+crit
compounding (math confirmed by hand: 1.4x dmg × elevated crit rate ≈
1.5-1.6x observed, not a bare 1.4x — first attempt's tighter bound was the
test's error, not the code's), Spreading Rot's leap to another enemy, both
modifier fixes present, and both AI changes (defender-avoidance,
HP-ratio targeting) at their statistically-expected rates. Separately
launched the real `BoonPick` scene directly with all six new boons —
confirmed correct name/rarity color/description render with proper
word-wrap and selection highlight. `tsc`/`pnpm build` clean.

Not verified: a full UI-driven battle (menu navigation via simulated
keypresses start-to-finish) in this environment — hit a `BattleScene`
menu-index error that traced to this session's separately-documented
headless render-loop throttling / boot-sequence flakiness (Title/Dialogue
scenes not fully settled before input was sent), not to anything touched
here (confirmed via `git status`: only `battle.ts`/`boons.ts`/
`modifiers.ts`/`types.ts` changed — `BattleScene.ts`, where the error
actually occurred, wasn't touched at all).

## 2026-07-16 (npc-wander): Sanctuary NPCs Wander, and Face You When You Talk

Playtest ask: Sanctuary's NPCs stood on one fixed tile forever, and had no
acknowledgement of the player. Reworked `SanctuaryScene.ts`'s NPC model:

- **Wandering.** Warden Eda, Scholar Voss, the Child, and the Stranger
  (`Npc.wander: true`) now idle-step one tile every ~1-4s within a 3-tile
  leash of their spawn point (`isWanderable`: not a wall/portal/the player's
  tile/another NPC's tile, and within leash). The Merchant and the Crystal
  stay put — you want a shop exactly where you left it. Each NPC's
  shadow/sprite/label/quest-marker are now children of one `Container`
  (`spawnNpc`/`LiveNpc`), so wandering is just tweening the container —
  everything rides along automatically instead of needing separate position
  syncing.
- **Data model swap.** `npcAt: Map<string, Npc>` (static tile → def) replaced
  by `liveNpcs: LiveNpc[]` (live position, tracked at commit-time like the
  player's own `px`/`py` — updates the instant a move is decided, tween is
  cosmetic). `liveNpcAt(x, y)` replaces the old map lookup everywhere
  (movement-collision, `getNearbyAction`).
- **"Better interaction":** talking to (or bumping) an NPC now calls
  `faceNpcTowardPlayer` first — a left/right sprite flip based on the
  player's position, since these are single-frame portrait sprites with no
  back-view. Small, but means an NPC visibly turns to acknowledge you
  instead of you talking to the back of someone facing away.

**Verification note — a genuine test-harness gotcha, not a code issue:**
headless Chromium's render loop in this environment is heavily throttled
(~4fps measured via `game.loop.frame`), and `Scene.time.now` for a *paused*
scene (Sanctuary auto-pauses itself for the now-11-line intro dialogue on a
fresh save) correctly stays frozen at 0 — so several passive
"wait N real seconds and check if NPCs moved" attempts kept catching
Sanctuary mid-intro rather than actually roaming, showing no movement for
reasons that had nothing to do with the wander logic. Resolved by
verifying the algorithm directly instead of waiting on real time: called
`sanctuaryScene.updateNpcWander(fakeAdvancedTime)` directly via
`page.evaluate` — confirmed wandering NPCs correctly step, respect
walls/portals/other-NPC/player collision and the 3-tile leash, and the
Merchant never moves. Separately confirmed `faceNpcTowardPlayer` flips
correctly for player-left/player-right and leaves facing unchanged when the
player is directly above/below (no back sprite to flip to). `tsc`/
`pnpm build` clean. Not confirmed: a real-time, un-forced observation of
wandering during normal play — the logic is verified, but a real player
watching it happen for 30+ seconds wasn't.

## 2026-07-16 (stranger-quest): The Stranger Gets a Real Quest, Not Just Flavor Text

Third and last follow-up to the dialogue rewrite. The Stranger had zero
mechanical footprint — `heed_the_stranger` was a one-off "you noticed the
mysterious NPC" bootstrap quest that completes on the first talk after ch1
and nothing since (their `after2`/`after3`/`after4` dialogue tiers fire from
`hasFlag` progression alone, no quest tied to any of it).

Added `stranger_truth` (`quests.ts`): unlocks on `ch4_complete`, rewards
gold + a new charm, `watchers_ward` (`equipment.ts` — universal charm,
+6 MP/+2 AGI, +6% crit, "Given by someone who has watched these anchors far
longer than anyone in Sanctuary knows"). `SanctuaryScene.ts`'s Stranger NPC
now picks `questId` dynamically (`heed_the_stranger` before ch4,
`stranger_truth` after) instead of the old hardcoded single id — needed
because `completeQuest()` no-ops on an already-complete id, so without the
switch the second quest could never fire at all. `questActive` follows the
same switch so the bounce-marker "!" reappears once there's something new
to claim.

Verified live: `stranger_truth` correctly inactive/hidden from the quest log
before `ch4_complete`; after flagging ch2/ch3/ch4 complete, it activates,
shows the right title/text in the log, and `completeQuest('stranger_truth')`
grants gold (0→40) and `watchers_ward` to `ownedEquipment()`. Confirmed the
Sanctuary NPC itself picks up `scriptId: 'npc_stranger_after4'` +
`questId: 'stranger_truth'` after a scene restart. Equip menu → any
character → Charm shows "Watcher's Ward", `+6 MP +2 AGI`, `✦ +6% crit`,
correct "Fits: Kael, Lyra, Mira". `tsc`/`pnpm build` clean.

Between this, `torens_blade`, and the quest-text pass, all three follow-ups
flagged after the dialogue rewrite are done.

## 2026-07-16 (quest-text): Chapter-Clear Quest Text — Consistent Anchor Naming

Second follow-up to the dialogue rewrite. `quests.ts`'s four chapter-clear
quests were inconsistent about naming the thing being fought over: only
`defeat_prism_sovereign` named its anchor ("Radiant Anchor"); `clear_ch1`
and `clear_ch2` didn't name theirs at all, and `defeat_ashbrand` said
"Summit Shrine" — a name that matches neither `chapters.ts`'s actual area
names (Ashen Foothills / Cinder Floor) nor dialogue.ts's "Peaks Anchor."
Looked like a stale leftover from before an earlier rename.

All four now follow the same pattern and match the names `dialogue.ts`
already established: "Defeat the Forest Shade, the corrupted spirit
devouring Ashenveil's anchor" / "...guarding the drowned Tidal Anchor" /
"Defeat Ashbrand, ...bound to the Peaks Anchor" / "Defeat the Prism
Sovereign, ...bound to the Radiant Anchor." Text-only change, no `QuestDef`
shape or reward changes.

Verified live: flagged ch1-3 complete, opened GameMenu's Quests tab, all
four texts render correctly (word-wrap, apostrophe in "Ashenveil's"
included) with the new consistent phrasing. `tsc`/`pnpm build` clean.

## 2026-07-16 (torens-blade): Toren's Blade — Kael's Watch-Line Arc Gets a Real Item

Follow-up to the dialogue rewrite below: `ch2_win` has Kael find a named
ally's blade in the Sunken City wreckage, but nothing in-game backed that up
— no item, just narration. Added `torens_blade` to `equipment.ts` (Kael-only
weapon, +6 STR/+2 AGI, +5% crit — "Steadfast edge": a plain, non-elemental
soldier's blade, deliberately contrasting `tidecleaver`'s ice/chill utility
so both chapter-2 Kael weapons are real, distinct picks rather than a
strict upgrade).

Granted via `clear_ch2`'s quest reward (`quests.ts`), alongside the existing
`tidewrought_mace` — this is the same `completeQuest()` call
`BattleScene.onVictory` already fires on the real Tide Warden kill, so it
lands in the player's hands at exactly the moment the dialogue describes
finding it, guaranteed (not a random chest/drop roll). Added a sell-price
entry in `run.ts` alongside the other found gear. Icon is free — `BootScene`
generates `icon_<id>` textures from `Object.values(EQUIPMENT)` generically.

Verified live: `completeQuest('clear_ch2')` correctly granted both
`tidewrought_mace` and `torens_blade` to `ownedEquipment()` (gold 0→90,
matching the quest reward). Equip menu → Kael → Weapon shows "Toren's
Blade — Steadfast edge", `+6 STR +2 AGI`, `✦ +5% crit`, full description,
stat-delta preview (STR 17→20, AGI 9→10) against the currently-equipped
Slender Blade. Confirmed the equip action itself: `equippedFor('kael')`
shows `weapon: 'torens_blade'` after selecting it and confirming. `tsc`/
`pnpm build` clean.

## 2026-07-16 (story): Rewrote Chapter 1-4 Dialogue — Voice, Backstory Payoffs, Villain Presence

Playtest note: the story read as filler between fights. Every chapter's
story-trigger/win script followed the same 3-beat template (Lyra senses the
anchor → Mira notes corruption → Kael says something terse), Lyra and Mira
were interchangeable exposition devices, and both Kael's ("eight of us, I
never heard from the other seven") and Lyra's ("I've stood where an anchor
already failed") intro hooks were never mentioned again. The antagonist was
100% narrated, never shown.

Rewrote `src/game/dialogue.ts` content only — same scriptIds, same
`DialogueLine` shape, no scene-code changes:
- **Differentiated voices.** Kael: grounded, protective, cares about specific
  people over the abstract mission. Lyra: intuitive/haunted, the one who
  voices doubt. Mira: duty/institution-driven (a Warden herself), the one who
  reframes and grounds the party. Each chapter now leads with a different one
  instead of the same rotation.
- **Paid off both intro hooks across the 4 chapters.** Kael finds a trace of
  his missing watch-line at every anchor (a sigil in ch1, a named ally's
  blade — Toren — in ch2, a timeline realization in ch3, proof someone from
  his old unit is still building for the enemy in ch4), landing on a real
  "which — dead, or working for them" question by the ending, not silence.
  Lyra's echo lands in `ch2_warden`/`ch2_win` (the buried Tidal Anchor
  mirrors the anchor she couldn't save) with a Mira line that finally
  acknowledges it instead of leaving it as a dangling intro-only beat.
- **Villain got physical traces, not just narration** — Kael's discoveries
  above, plus a Scholar Voss payoff: the ch1 boss-room area is *already
  named* "Twisting Hollow" in `chapters.ts` (coincidental, unconnected to the
  Hollow reveal until now) — added one line tying the old map name to the
  late-game reveal instead of leaving it an unexplained coincidence. The
  Stranger's lines now reference specifics only someone who'd physically been
  at the anchors would know, and directly calls out Kael's new blade in
  `npc_stranger_after3`.
- **Added party banter** — short beats where they talk to each other instead
  of reciting exposition at the player (Mira: "Like the one you couldn't
  save?" / Lyra: "Kael. Finish what you didn't say back there.").
- Ending rewritten so each character lands a closing beat on their own arc
  instead of a flat "we rest, then keep going" — Lyra's last line ("Let
  them.") deliberately echoes Kael's line from `ch1_win`, earned rather than
  reused.

Verified live via the new `verify` skill: played `intro`, `ch1_crystal`,
`ch1_win`, and `ending` to completion via direct `Dialogue` scene-starts,
polling `index`/`typing`/`shown`/`visualId` per line. All four scripts
completed (`onDone` fired), the new short interjection lines ("Kael—",
"Recently?") transition cleanly, the `heroes_meet` visual tag still applies
to exactly the intro lines that carry it. Also mashed confirm 25× with zero
delay through `ch1_crystal` (now 8 lines, up from 5) — completes cleanly, no
stuck state. No console errors beyond a pre-existing unrelated 404 and
benign headless-WebGL performance warnings. `tsc`/`pnpm build` clean.

Not touched: `npc_keeper`/`npc_scholar`/`npc_child` (pre-ch1) and the
Child/Pip thread, both already solid. Quest text (`quests.ts`) and
equipment/item flavor (`equipment.ts`/`content.ts`) are unchanged — could use
a pass for consistency with the sharpened character voices but weren't part
of this request.

## 2026-07-16 (verify): Live-Verified Two Previously Code-Review-Only Fixes

Two changes from the last session were checked by code review only, not by
running the game (CONTEXT notes from 2026-07-13 and 2026-07-15 both flagged
this explicitly). Live-verified both in a real (headless) browser this
session:

- **Items tab scroll/drill-down** (2026-07-13): seeded a save with 11 item
  types via `localStorage` and drove the menu with real keypresses. Confirmed
  the 6-row scroll window, `▲`/`▼` hidden-count indicators, window-edge
  scroll in both directions, top/bottom clamping, drill-in to target
  selection, and drill-out preserving the row all work exactly as described.
  Bonus: caught the game correctly *refusing* to use Phoenix Down on a
  full-HP ally ("Kael can't use Phoenix Down right now.") rather than wasting
  it — not a bug, just confirms the guard exists.
- **`firstClear` gate on the ending/feedback ceremony** (2026-07-15,
  `BattleScene.onVictory`): fought the Ch4 boss twice via a seeded save +
  console-assisted state jump (`getRun().depth = 8` then
  `DescentScene.triggerEncounter('19,10', true, false)` — the same call a
  player triggers by stepping on the tile, see `.claude/skills/verify/
  SKILL.md`). With `ch4_complete` already flagged (simulating a returning
  finisher), the kill fired `chapter_clear` and played the `ch4_win` dialogue
  but **not** `game_complete`, and no feedback textarea ever appeared — went
  straight back to Sanctuary. With the flag absent (genuine first clear), the
  same fight fired `game_complete` and opened the "You reached the bottom"
  ending + feedback prompt. Confirms the fix does exactly what it claims on
  both branches.

No code changes from this — both held up. Also set up
`.claude/skills/verify/SKILL.md` (Playwright cold-start, headless-WebGL
flags, dev hooks) so the next verification session skips the ~30min
first-time setup this one paid.

Separately: checked whether the Validation telemetry (live since 2026-07-13)
has real player data yet — no. This machine has no SSH access to
`aetherfall.nguyenchu.com` (the authorized key from 2026-07-13 is on the dev
Mac only), and the log was truncated to zero on deploy day, so there's
nothing to read yet regardless. Revisit once there's been real traffic and
either SSH is set up from this machine too, or someone pulls the
`analyze.mjs` report manually.

## 2026-07-15: Ascension (New Game+) — Endgame Replay Content

Beating the Chapter 4 boss (Prism Sovereign) already had a real ending —
`ch4_win` → `ending` dialogue, a one-time feedback prompt, back to Sanctuary
(`BattleScene.onVictory`). But nothing happened *after* that: `getArea()`
clamps to the last authored area past depth 8, so postgame descents replayed
Chapters 1-4 at exactly the same enemy stats and rewards forever, and
Sanctuary's "next objective" marker went to `null` once `ch4_complete` was
set — a dead end. There was also a latent bug: the win/ending cutscene +
feedback prompt was gated on `depth > 6`, not "first clear," so it would have
replayed in full on every future Prism Sovereign kill.

Added an opt-in, repeatable **Ascension** tier instead of jumping straight to
a Chapter 5 — cheaper to build, and validates via the already-live telemetry
whether finishers want more before investing in a new zone:
- `SaveData.ngPlus` (persistent, default 0). `ascend()` in `run.ts` bumps it
  and reuses `returnToTown()` — depth resets to 1, fresh modifier, boons
  cleared. Levels, gear, gold, and story flags are **untouched** — Ascension
  only raises a difficulty/reward ceiling, it doesn't reset the world.
- `makeEncounterForArea(area, group, ngPlus)` in `chapters.ts` scales every
  enemy's stats (+15%/tier) and gold/XP (+10%/tier) — applies to *any*
  chapter being replayed, not just the Ch4 rematch, which is what actually
  fixes the flat-postgame problem. `DescentScene` threads `getSave().ngPlus`
  through both encounter call sites.
- `BattleScene.onVictory` now captures `firstClear` (`!hasFlag(flag)`) before
  `setFlag`, and only chains into the `ending` dialogue + feedback prompt on
  the first-ever Ch4 clear. Later Prism Sovereign kills (Ascension replays)
  still get the normal win-dialogue + loot flow, just not the "you finished
  the game" ceremony again.
- New Sanctuary interactable: the Crystal (`kind: 'ascend'` on `Npc`, reuses
  the `aether` texture, no new art), gated on `hasFlag('ch4_complete')` same
  as the postgame shop gear. Talking to it opens `AscendScene` (modeled on
  `RunSummaryScene`'s layout) showing current/next tier and the stat/reward
  bump; confirm calls `ascend()`, cancel leaves everything untouched. The
  Sanctuary "next objective" bounce marker now points at the Crystal once
  (only while `ngPlus === 0`) instead of going to a dead `null`.
- `track('ngplus_start', { tier })` plugs into the existing `ops/analytics/`
  pipeline so "do finishers come back for more" is actually measurable.

Verified live: `pnpm build` clean, then a save-injected Playwright session
(seeded `ch4_complete` + levels/gold, no vendored driver — same bar as prior
UI work) drove the real flow — walked into the Crystal, confirmed the
AscendScene text (`Current tier: None` → `Ascension 1`, `+15%`/`+10%`
correct), confirmed **cancel** leaves `ngPlus` at 0, confirmed **confirm**
persists `ngPlus: 1` to `localStorage` and is reflected on reopening
(`Ascension 1` → `Ascension 2` preview). No console errors. Encounter scaling
double-checked directly (tier-2 Prism Sovereign: 700→910 HP, 130→156 gold,
matches the 1.30/1.20 multipliers exactly). **Not** live-verified: the
`firstClear` fix on `BattleScene.onVictory` (would need a scripted full CTB
battle win) — confirmed by careful code review instead (variable scoping,
`hasFlag`/`setFlag` order) rather than an end-to-end run.

## 2026-07-14: Cancel Doubles as Menu — One Button Instead of Two

Removed the `Btn` input bus's separate `'menu'` signal entirely (was: X/Backspace/
Escape → `cancel`, Tab/C → `menu`, plus a dedicated on-screen "Menu" pill next to
"Back" in every touch layout). Now there's just `cancel` (X, Backspace, Escape,
Tab), and each scene's cancel handler falls through to opening the pause
`GameMenu` when there's nothing else to back out of:

- **DescentScene**: had no `cancel` handler at all (X did nothing there since
  the retreat-shortcut removal, 2026-07-07) — now `cancel` opens the menu
  unconditionally, since there was never anything else for it to do.
- **SanctuaryScene**: `onCancel()` still closes the shop first if one's open;
  only opens the menu when idle (previously a no-op in that case).
- **BattleScene**: `cancel()`'s existing submenu/target/subtarget back-navigation
  is unchanged and still takes priority; only falls through to opening the menu
  when `ui === 'menu' && pos === 0` — i.e. already at the top-level "choose an
  action" screen with nowhere left to back out to. Tradeoff: the old dedicated
  Menu button could jump to the pause menu from *any* battle state (mid-submenu,
  mid-animation); that's gone now, by design — X does the contextual thing first.
- **GameMenuScene**: turned out `back()` already fell through to `close()` at
  its own top level, so the separate `menu` → `close()` binding was pure
  redundancy — deleted with no behavior change.

Also removed: the now-dead `'side'` `TouchLayout` (unreachable since
`SideScrollScene` was deleted 2026-07-09 (a)) and its unused d-pad branch.
Touch "Back" pills nudged to center in the freed-up space where "Menu" used
to sit (battle/menu/default layouts).

Verified live via a save-injected Playwright session covering all four cases:
X opens the menu from idle Sanctuary and from Descent; X closes the menu from
its own top level; in Battle, X opens the menu at the top-level action screen
but correctly backs out of an open Magic submenu first instead (menu stays
closed). No console errors. `tsc` and `vite build` both clean.

## 2026-07-13 (merchant): Merchant Overhaul — Icons, Slot Clarity, Scroll Nav, Compare

Playtest note: the merchant was hard to read (what is this item? what slot is
this gear?) and had a latent bug. Rebuilt the shop in `SanctuaryScene`.

Legibility (the core ask):
- **Icon on every row** — reuses the `icon_<id>` textures BootScene already
  generates for all gear + items (the shop wasn't using them).
- **Gear rows show a slot badge + who-fits** (`WPN · Kael`, `ARM · Kael/Mira`).
- **Detail panel** at the bottom, live per highlighted row: gear shows slot,
  trait, full stats, ✦ effects, description, and a **"Now equipped" compare**
  line (what each eligible member currently has in that slot); items show
  description + buy/sell price; blessing explains stacking + next cost.

Nav + the bug:
- **Overflow fixed.** The old shop drew all rows at fixed offsets; late-game the
  BUY column (3 base + up to 4 consumables + up to 11 gear ≈ 18 rows) ran off
  the box. Now each column is a **scroll window** (`SHOP_ROWS = 8`, `▲/▼`).
- **Two-column nav**: `←→` switches BUY/SELL (was a single flat index snaking
  through both columns), `↑↓` within, guarded against an empty column.
- **Cursor keeps its place after a purchase** — buy/sell calls `refreshShop`
  (rebuild stock, clamp selection) instead of `openShop` (which reset to top).
- BUY items sorted; **"Sell all junk"** shortcut atop SELL dumps all resale-only
  loot at once.

State went from a flat `shopIndex`/`shopOptions` to `shopColumn` + per-column
`shopSel`/`shopScroll` + `buys`/`sells: ShopOption[]`. Panel enlarged to
600×316 for icons + detail. `tsc` clean, `pnpm build` OK; layout + nav edges
traced (no overlap; column switch, scroll clamp, keep-place, sell-all, last-item
→ fall back to BUY). **Not** pixel-verified in a live browser (no vendored
driver; reaching the merchant needs in-game navigation) — same bar as the
items-menu drill-down.

## 2026-07-13 (validation-live): Telemetry Ingest Deployed — Validation Loop Live E2E

The roadmap's Validation step is no longer blocked: the analytics loop now runs
in production, verified with a real browser client (not just curl).

Done on the home server (over SSH from the dev Mac):
- Applied `ops/analytics/nginx.conf.snippet`: `log_format aetherfall_events`
  (`escape=none '$time_iso8601\t$args'`) in the `http {}` block, and
  `location = /e` (logs `$args`, returns 204) in the aetherfall `server {}`
  block. `sudo nginx -t` clean, reloaded. Created
  `/var/log/nginx/aetherfall_events.log` (www-data:adm).
- Redeployed the game. The live build was stale — Jul 9, pre-analytics
  (`index-DVPZCaPA.js`, no `sendBeacon`); rsynced a fresh `dist/` into
  `/var/www/aetherfall` (`index-DrVD4OfP.js`), which also ships this session's
  random-battle + items-menu fixes. Backup at `~/aetherfall.bak-<ts>` on the box.
- Proof: loaded the live site in headless Chrome → a real `session_start`
  (anonymous `cid`, `mob=0`) landed in the log and `analyze.mjs` parsed it.
  Then truncated the log so real validation data starts from zero.

Ops notes for next time: web root `/var/www/aetherfall` is `nguyen`-owned (no
sudo needed to deploy); the site is static-file + nginx (no systemd app service);
the dev Mac now has an authorized SSH key (`nguyen@aetherfall.nguyenchu.com`), so
server ops can be driven directly. Redeploy = `pnpm build` then
`rsync -av --delete dist/ nguyen@aetherfall.nguyenchu.com:/var/www/aetherfall/`.

## 2026-07-13 (items-menu): Items Tab — Scrollable List + Target-Selection Drill-Down

Playtest note: with a full bag you couldn't *see* or reach all your items. Root
cause: the Items tab (`renderItems`) drew every entry at `y = 100 + i*50` with
**no scroll window** — unlike the Equip tab, which already scrolls. Only ~4-5
rows fit the panel, so with up to 11 held item types (2 heal, 2 mp, 1 cure, 1
revive, 5 sellable junk) the lower rows rendered off-panel and were unreachable
by cursor or touch.

Rebuilt the tab to mirror Equip's proven two-step drill-down (keeps items and
equipment on separate tabs, per the 2026-07-13 discussion):
- **Step 1 — scrollable list** (`renderItemList`): compact 34px rows (icon,
  name ×count, description, right-aligned tag), `ITEMS_LIST_ROWS = 6` visible
  with `▲/▼` counts. Sorted **usable-first** (heal/mp/revive), then cure, then
  sellable junk — so the items you act on are always in view without scrolling.
- **Step 2 — target screen** (`renderItemUse`): Z on a usable item opens a
  one-row-per-member picker (name + HP/MP + `USE ›`/`full`/`KO`); X steps back.
  Non-usable items don't drill — Z explains instead (cure = battle only, sell =
  "sell at the Sanctuary merchant (Ng)").
- **Nav** reuses the equip pattern: new `moveItemsVertical` walks the full id
  list (`itemRowIds`) and scrolls the window when the next row is hidden; wheel
  scroll now covers items too; `back`/`setTab` reset the drill state
  (`itemSelId`, `itemsScroll`). Added `Selectable.itemId` to anchor scroll nav.

Field-usable = kind ∈ {heal, mp, revive}; cure (battle-only) and sell (junk)
stay list-only, same as before but now reachable. `tsc` clean, `pnpm build` OK.
Traced the nav edges (window-edge scroll, top/bottom clamp, drill in/out,
last-item-consumed → back to list, empty bag, right → command column). **Not**
driven in a live browser (no vendored driver) — same bar as prior menu work;
reaching a full-bag state needs real play.

## 2026-07-12 (encounter-rate): Random Battles Too Frequent — Rebalanced

Playtest note: random battles fire too often during descent. The encounter
roll in `DescentScene.maybeTriggerRandomEncounter` runs one probability check
per walked tile once past a floor of guaranteed-quiet steps, with a hard
"bad-luck" ceiling that forces a fight. Old values gave a mean gap of only
~8 steps and just 2 quiet steps after a fight, which reads as "constant".

Tuning (all in `DescentScene.ts`, no logic change):
- `RANDOM_BATTLE_MIN_STEPS` 3 → 5 (longer guaranteed-quiet window after a fight).
- per-step `chance` `min(0.22, 0.11 + depth*0.01)` → `min(0.16, 0.08 + depth*0.008)`
  (lower base + slope + ceiling; still scales gently with depth).
- `RANDOM_BATTLE_MAX_STEPS` 14 → 20 (raise the forced-encounter ceiling).

Net: mean gap ~8 → ~13-14 steps at low depth (~40% fewer trash fights), with a
5-step guaranteed lull. `tsc` clean. Pure numeric tuning of an already-exercised
code path (mirrors the prior gold/Lyra rebalances); not driven in a live descent
(no vendored browser driver). Easily nudged further if it now feels too empty —
lower `MIN`/raise `chance`.

## 2026-07-11 (analytics 3): Ingest Pipeline Verified E2E — Feedback Double-Decode Crash Fixed

Went to actually wire up the telemetry ingest (roadmap step 6: the nginx `/e`
endpoint had been documented but never exercised against the analyzer). No live
server access from here and no local nginx/docker, so I built a **faithful Node
emulator of `ops/analytics/nginx.conf.snippet`** — logs `$time_iso8601\t$args`
(raw, *undecoded* query string) and returns 204, for both the GET pixel and the
POST `sendBeacon` paths — and drove it with URLs shaped exactly like
`analytics.ts` `track()` builds them.

That surfaced a **showstopper bug in `analyze.mjs`**: `parseLine` already
URL-decodes every field via `URLSearchParams`, but the `feedback` case then
called `decodeURIComponent(ev.msg)` a *second* time. The first `%` a real player
types in feedback (e.g. "got 50% through") makes `decodeURIComponent` throw
`URIError: URI malformed` — and it's unwrapped, so **the whole report crashes**;
`"%NN"`-looking text (e.g. "100%20off") silently corrupts instead. Not caught
by the earlier synthetic-log checks because none of that fixture feedback
contained a `%`. Fix: drop the redundant decode (`msg: ev.msg ?? ''`).

Verified end-to-end on a 10-event session (GET+POST mix) with feedback text
containing `%`, `&`, `<touch>`, and unicode: text report exits 0 and renders the
message intact; `--html` exits 0 with correct escaping (`&amp;`, `&lt;touch&gt;`,
`café` preserved) and **zero** unescaped `<touch>` leaks; the snippet's log
format matches the parser exactly. Also confirmed `escape=none` is not a
log-injection vector — nginx never decodes `$args`, so a `%0A` stays literal and
one physical line still holds one event.

Not run against real nginx (none vendored) — the emulator reproduces the exact
snippet log line, which is the only nginx behavior the parser depends on.
**Still pending (needs server access):** apply the snippet, reload nginx,
redeploy, then smoke-test with `?analytics=on` per `ops/analytics/README.md`.
Retention/D1 still can't be exercised locally (it keys off the nginx receive
date, which the single-run emulator collapses to one day).

## 2026-07-11 (dashboard + party-audit): HTML Analytics Dashboard + Party Survivability Audit

- **`analyze.mjs` gained an HTML dashboard.** Refactored so aggregation
  (`analyze(events) -> summary`) is separate from rendering; added
  `renderHtml(summary)` alongside the existing text renderer. `--html` emits a
  self-contained dark "aether console" (inline CSS, no JS, no external requests
  — CSP-clean, mailable, opens locally); `--html-fragment` emits body-only for
  embedding. Design grounded in the game's own palette (config.ts: near-black
  ground, teal `#6cf0c2`, aether-violet `#8a6cf0`, gold `#f0d36c`), deliberately
  single-theme (the game is dark). Data marks use a **validated** teal ordinal
  ramp for the funnel + status green/red for outcomes — checked with the dataviz
  skill's `validate_palette.js` against the dark surface (ordinal: all pass;
  status trio: worst adjacent CVD ΔE 12.4, above the ≥12 target), and every mark
  is direct-labelled with counts + %. Untrusted feedback text is HTML-escaped
  (verified `<touch>` renders inert). README updated with the `--html` usage.
  Verified on a 249-line synthetic log (16 players, 3 days, 4-chapter funnel,
  5 feedback msgs, 1 completion, a malformed line): text report unchanged and
  correct, HTML valid (doctype/charset/closed tags, no `undefined`/`NaN` leaks),
  escaping confirmed. A preview artifact was published from the demo data.
  Not pixel-inspected in a browser (no vendored driver) — validated structurally
  + palette-validated + CSS reviewed.
- **Whole-party survivability audit** (after the Lyra fix below). Recomputed the
  actual `battle.ts` formulas for all three members with default gear against
  every chapter's hardest normal/elite attacker and boss-phase AoE. Finding:
  **no member is one-shot from full at reasonable levels** anymore, including the
  boss phase transitions (which I confirmed apply *flat* damage via `applyDamage`,
  bypassing VIT and defend — 25/34/47/46 across ch1–4). Lyra stays clearly the
  squishiest but survivable. Two notes, neither warranting a change: Mira has no
  default armor (fine on HP; the single shared `scout_vest` is on Kael), and boss
  phase AoEs are the intended "heal-or-die" burst. No balance edits made.

## 2026-07-11 (lyra-survivability): Lyra Was One-Shottable — Root-Cause Rebalance

## 2026-07-11 (lyra-survivability): Lyra Was One-Shottable — Root-Cause Rebalance

Playtest complaint: Lyra dies in a single hit. Confirmed and traced to three
compounding causes (not just "mage = low HP"):

1. **Her VIT never grew.** Growth block was `{maxHp:5,maxMp:4,int:2,agi:1,str:1}`
   — no `vit`, unlike Kael (+2) and Mira (+1). Physical mitigation
   (`target.vit * 0.6` in `battle.ts` strike) was therefore frozen at ~3 for the
   entire game while enemy STR climbs (11 ch1 → 20 ch2 elite → higher).
2. **Her default armor gave zero survivability.** `aether_robe` was
   `{maxMp:6,int:1}` (pure offense), vs Kael's `scout_vest` `{maxHp:8,vit:1}`.
   She was the only member whose starting armor did nothing defensive.
3. Lowest base HP (32) and slowest HP growth (+5) on top.

Enemies can't crit (crit/weakness/break only apply when `actor.side==='party'`
in `computeHit`), so a hit maxes at ~`base×1.12`. Even so, ch2 Keep Sentinel
(STR 20) hits for up to 32 and the ch1 Forest Shade's frost/fire (base ≈30) up
to ~34 — both one-shot a low-level 32–37 HP Lyra.

**Fix (conservative — keeps her the glass cannon, removes the one-shot-from-full):**
- `content.ts`: Lyra base `maxHp 32 → 36`; growth gains `vit: 1` (the real
  root-cause fix — mitigation now scales with the game).
- `equipment.ts`: `aether_robe` bonus `{maxMp:6,int:1}` → `{maxHp:6,maxMp:6,int:1}`
  (a light defensive floor; also helps Mira, who can wear it). Flavor text
  updated from "Trades heavy protection" to "Light protection".

Net: +10 effective HP at every level (base +4, robe +6) and VIT now 5→14 by L10
instead of frozen at 5. Party HP ordering preserved — at L5 (with default gear)
Kael 108 > Mira 72 > **Lyra 62**, still clearly squishiest. Verified by
recomputing the actual `battle.ts` formulas against ch1/ch2 attackers: every
prior one-shot-from-full case (Forest Shade spell, Drowned Soldier, Keep
Sentinel elite) now survives. `restoreLevel` rebuilds from base+growth, so
existing saves pick this up on next load — no migration. `tsc` clean.

Not verified in a live battle (no vendored browser driver) — same-shape numeric
edit to already-exercised stat/growth/bonus fields, checked against the formulas
(mirrors the 2026-07-09 (b) gold-rebalance verification approach). Easily
tunable if she now feels *too* durable: drop the robe `maxHp`, or the base bump,
or the `vit` growth — the `vit` growth is the load-bearing one for late game.

## 2026-07-11 (analytics 2): Contextual Feedback + Mid-Run Funnel + chapter_start Fix

## 2026-07-11 (analytics 2): Contextual Feedback + Mid-Run Funnel + chapter_start Fix

Sharpened the telemetry from the entry below so its data is actually usable.

- **Fixed a double-count bug in the just-added `chapter_start`.** `advanceArea()`
  advances to the next stratum with `getRun().depth++; this.scene.restart()`,
  which re-runs `DescentScene.create()` — so `chapter_start` was firing *twice
  per chapter* (once per stratum), inflating the funnel's denominator. Now
  `create(data?: { deeper?: boolean })` branches: a fresh descent from Sanctuary
  (`scene.start`, no data) fires `chapter_start`; the in-run advance
  (`scene.restart({ deeper: true })`) fires the new **`descent_progress`** event
  instead. Verified against Phaser source that `restart(data)` → `settings.data`
  → `create(settings.data)` (dist/phaser.js:201389, :198302).
- **`descent_progress`** (`ch`,`d`) closes the mid-run blind spot: it fires on
  reaching a chapter's 2nd (boss) stratum, so a player who starts a chapter and
  quits (tab close) in the first stratum now shows as start-without-progress
  rather than being invisible. `analyze.mjs`'s funnel gained a "reached S2 N
  (p%)" column between start and clear.
- **Contextual feedback prompts** replace reliance on the passive Title link
  (which in practice gets almost no clicks). RunSummary now shows a
  "✉ How was that run?" link (context `run_wipe`/`run_retreat`) — a natural
  pause right after an outcome. The **ending** auto-opens the feedback panel once
  ("You reached the bottom / How was the journey?", context `ending`) — the
  single highest-signal moment — then continues home when it closes. The Title
  link stays as an always-available fallback.
- **`openFeedback(context, opts)`** gained `{ onClose, title, sub }`: `onClose`
  lets the ending resume the walk home whether the player sends or cancels;
  `title`/`sub` tailor the copy per moment. If called while already open it
  invokes `onClose` immediately so a waiting caller is never stranded.
- **RunSummary tap handling** was reworked so the feedback link doesn't also
  trigger "continue": the full-screen background is now an interactive object
  (not a scene-level `pointerdown`), and with Phaser's default `input.topOnly`
  the link on top swallows its own taps. Added a `leaving` re-entry guard to
  `continue()`.

Verified: `tsc` clean; `pnpm build` succeeds. `analyze.mjs` re-exercised on a
synthetic log where one player bounces in stratum 1 — funnel correctly shows
"reached S2 67%" (not 100%), i.e. the drop-off is now visible. **Not** verified
in a live browser (no vendored driver): the RunSummary/ending prompt UI and the
`descent_progress` firing from real play were not driven end-to-end, though the
Phaser data-flow the fix depends on was confirmed from source.

## 2026-07-11 (analytics): First-Party Validation Telemetry + In-Game Feedback

Roadmap step 5 (Validation) was "deployed, but measuring retention/feedback is
still todo" — the game had been live since 2026-07-09 with zero instrumentation,
so there was no way to know whether it's fun or retains. Added a lightweight,
privacy-first, first-party telemetry + feedback system. No third-party SDK, no
cookies, no PII.

- **`src/game/analytics.ts`** (new): `track(event, props)` sends each event as a
  query string to a **same-origin** `/e` endpoint via `navigator.sendBeacon`
  (Image-GET fallback). An anonymous random `cid` in localStorage powers
  unique-player/retention counts; a per-load `sid` groups a session. Fails
  silent, never blocks gameplay. Honors Do Not Track / Global Privacy Control
  and a persistent opt-out; `?analytics=off`/`on` override. On a non-production
  host it `console.debug`s events instead of beaconing (visible in dev, nothing
  sent). `chapterOfDepth(d)` maps descent depth → chapter (2 strata/chapter).
- **Funnel events**, wired at the existing choke points: `session_start`
  (`main.ts`), `new_game`/`continue` (`TitleScene.begin`), `chapter_start`
  (`DescentScene.create` — the one place a fresh descent starts; battle returns
  via RESUME, not create), `chapter_clear` + `game_complete` (`BattleScene`
  boss-victory branch), `run_end{reason:wipe|retreat,g}` (`RunSummaryScene.create`
  — the single choke point both outcomes funnel through). Deliberately did *not*
  add a separate `party_wipe`: `run_end` with `reason` is the canonical outcome.
- **`src/ui/feedback.ts`** (new): a DOM overlay (real `<textarea>`, not Phaser)
  for freeform feedback, sent as a `feedback` event through the same channel.
  Includes an analytics opt-out checkbox. Reached via a small "✉ Feedback" link
  on the Title screen (top-right, always tappable). Typing must not drive the
  game, so `input.ts` gained `setInputSuspended()` — the overlay suspends the
  shared keyboard bus while open (early-returns in the window keydown/keyup
  handlers, releases held buttons).
- **`ops/analytics/`** (new, not shipped in the build): `nginx.conf.snippet`
  (a `log_format` + `location = /e` that logs `$args` and returns 204 — no
  systemd service, matches the static-only deploy; IP deliberately not logged),
  `analyze.mjs` (dependency-free report: reach, D1 retention by cohort,
  per-chapter start→clear% funnel with wipe/retreat, completions, modifiers,
  feedback messages; reads plain/`.gz`/stdin, skips malformed lines), and a
  `README.md` documenting the pipeline + privacy stance.

**Server-side is not yet applied** — the nginx `location = /e` must be added to
the aetherfall server block and nginx reloaded before events are captured (until
then beacons 404 harmlessly). Redeploy the built client afterward.

Verified: `tsc --noEmit` clean; `pnpm build` (prod) succeeds. `analyze.mjs`
exercised against a synthetic 35-line log (3 players, 2 days, wipes/retreats,
a completion, feedback, one malformed line) — report correct, bad line skipped.
`analytics.ts` transpiled and run against stubbed browser globals: 20/20
assertions (prod beaconing + URL shape, cid persistence across reloads,
dev-console-only, `?analytics=on` force, DNT + GPC disable, opt-out persist +
resume, 500-char field cap, depth→chapter). **Not** verified in a live browser
playthrough (no vendored browser driver): the feedback overlay UI and events
firing from real play were not exercised end-to-end.

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
6. Live: **Validation** - deployed to https://aetherfall.nguyenchu.com; first-party
   telemetry + in-game feedback shipped; the nginx `/e` ingest endpoint is deployed
   and logging, verified end-to-end with a real browser client (2026-07-13). Read
   reports with `ops/analytics/analyze.mjs` against
   `/var/log/nginx/aetherfall_events.log`. Remaining: read the reports as real data
   accrues; optional Postgres backend later for richer querying.
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
- **Retention/feedback measurement:** now **live** — telemetry, feedback panel,
  and the nginx `/e` ingest are all deployed and verified end-to-end
  (2026-07-13 (validation-live)). Just read `ops/analytics/analyze.mjs` reports
  as data accrues. Later, the planned Postgres backend could replace log-file
  ingestion for richer querying.
- **Monetization:** still todo per the Roadmap — AdMob rewarded ads + IAP.
- **JS bundle size:** Vite flags the production bundle at ~1.7MB
  (minified, ~400KB gzipped) as larger than its default chunk-size warning —
  works fine, but code-splitting would improve load time.
