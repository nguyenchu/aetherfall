# Aetherfall

A story-driven roguelite JRPG inspired by Final Fantasy 1, built around the
**Hades model**: handmade story and world, procedural descents.

> Working title. Easy to change via folder name, `package.json`, and the title in `index.html`.

## Premise

Aether, the luminous substance that holds the world aloft and empowers the
crystals, has fallen. The world sinks layer by layer into the deep. You are one
of the last Warriors of Light, bound to the final whole crystal: every time you
die, the crystal draws you back to **Sanctuary**, the hub, and you descend again
to reach the bottom and restore Aether.

- **Fixed frame:** Sanctuary hub, NPCs, story, upgrades, a named protagonist,
  a goal, and a real ending.
- **Strata:** handmade worlds (Stratum I - The Sunken City, Ashen Deep,
  Crystal Core, and beyond) with distinct mood and bosses. Rooms inside each
  stratum are generated.
- **Narrative permadeath:** the crystal brings you home, explaining the
  roguelite loop in fiction.

## Technology

- **Phaser 3 + TypeScript + Vite** for the browser game
- **Capacitor** for later iOS/Android builds with rewarded ads and IAP
- Optional backend later: own server + Postgres for saves and leaderboards

## Highlights

- **Scene-based engine architecture** — Phaser 3 scenes for intro, hub and battle,
  with separate modules for `game` logic, `ui`, `audio` and `art`.
- **One codebase, three targets** — the same TypeScript/Vite build ships to the
  web and wraps into native iOS/Android via Capacitor.
- **Handmade + procedural** — authored strata and story framing a procedurally
  generated descent (the "Hades model").

## Run Locally

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # typecheck + production build to dist/
```

## Roadmap

1. **Skeleton:** procedural descent + grid movement
2. **Battle:** turn-based FF1-style combat with party, enemies, magic, and items
3. **Run loop:** permadeath fiction, loot, currency, upgrades in Sanctuary
4. **Content:** classes, enemy variation, strata, bosses, audio, balancing
5. **Validation:** deploy to nguyenchu.com and measure retention/feedback
6. **Monetization:** Capacitor app stores, AdMob rewarded ads, and IAP
