# Aetherfall — Kontekst & beslutningslogg

> Lim inn denne i en ny økt for å fortsette arbeidet. Sist oppdatert: 2026-06-02.

## Hva er dette

**Aetherfall** — et historiedrevet **roguelite-JRPG** inspirert av Final Fantasy 1.
Ligger på `/Volumes/512gbSSD/dev/aetherfall`.

**Mål:** seriøst inntektsforsøk. Web først (validering), mobil senere for monetisering.

## Beslutninger (med begrunnelse)

| Tema | Valg | Hvorfor |
|---|---|---|
| Sjanger | Roguelite-JRPG, ikke lineært story-JRPG | Lineært FF1 er mest innholdstungt og vanskeligst å monetisere som solo/AI-dev. Roguelite = lav innholdskostnad, høy replay, naturlig ads-plassering. |
| Historie | **Ja, fast historie** — «Hades-modellen» | Håndlaget verden/figurer/lore + prosedyre-genererte dungeons. Får historiedybde uten å håndlage 50 kart. |
| Plattform | Web først → mobil senere | Validere at spillet er gøy før investering i app-butikk. |
| Mobil-wrapper | **Capacitor** (ikke Expo) | Phaser er web/canvas; Capacitor pakker web→app og har AdMob-plugin. RN/Expo passer dårlig for tile-spill. |
| Monetisering | AdMob rewarded ads + IAP (mobil); web-ads er lite verdt | Rewarded video («se reklame → belønning») passer roguelite-løkka. |
| Backend | Egen server + Postgres (IKKE Supabase) | Brukerpreferanse — brent av free-tier-deaktivering, eier nguyenchu.com. |
| IP / juss | Original IP, kun sjanger/mekanikk lånt fra FF1 | Mekanikk kan ikke opphavsrettsbeskyttes; navn/kunst/musikk må være egne. Kan ikke selge en FF1-klone. |
| Navn | «Aetherfall» (arbeidstittel) | Latinsk-klingende, passer premisset. Lett å endre (mappe + package.json + tittel). |

## Premiss

Aether — den lysende substansen som holder verden oppe og gir krystallene kraft —
har **falt**. Verden synker, lag for lag, ned i dypet. Spilleren er en av Lysets
siste krigere, bundet til den siste hele krystallen: dør man, trekker krystallen
deg tilbake til **Helligdommen** (hub), og man stiger ned igjen for å nå bunnen og
gjenreise Aether.

- **Fast ramme:** Helligdom (hub, NPC-er, historie, oppgraderinger) + navngitt
  hovedperson + mål + en faktisk slutt.
- **Strata:** håndlagde verdener (Stratum I – Den Sunkne By → Ashen Dyp →
  Krystallkjernen …), egen stemning + boss. Romlayout _inni_ genereres.
- **Narrativ permadeath:** krystallen henter deg = roguelite-løkka forklart i fiksjonen.

## Teknologi

- **Phaser 3 + TypeScript + Vite** (pnpm). Intern oppløsning 480×270, tile 16.
- `vite.config.ts` har `base: './'` → klar for undermappe + Capacitor.
- Senere: Capacitor (iOS/Android) + `@capacitor-community/admob`; egen Postgres-backend.

## Status: Fase 2 FERDIG ✅

Turbasert kampmotor på plass, bygg verifisert (tsc + vite build grønt, dev-server booter):

```
src/main.ts                 Phaser-oppsett (3 scener)
src/config.ts               oppløsning + fargepalett
src/scenes/BootScene.ts     plassholder-teksturer
src/scenes/DescentScene.ts  prosedyre-rom + bevegelse + tilfeldig encounter (14%/steg, gull-HUD)
src/scenes/BattleScene.ts   kamp-presentasjon: tastaturmeny + animert rundeavspilling
src/game/types.ts           rene datatyper (ingen Phaser)
src/game/content.ts         besvergelser, gjenstander, startparty, fiendemaler + encounter-generator
src/game/battle.ts          ren rundebasert kampmotor (AGI-rekkefølge, skadeformler, enkel fiende-AI)
src/game/run.ts             run-tilstand: party, gull, delt inventar (lever på tvers av kamper)
src/audio/music.ts          prosedyre-generert chiptune (Web Audio): 'explore' + 'battle', M = demp
```

**Musikk:** original, prosedyre-generert i Web Audio (ingen lydfiler — juss-trygt).
To spor: rolig Am–F–C–G ved utforskning, drivende Dm-riff i kamp. Bytter automatisk
ved encounter/retur. M-tast demper. Lyd starter ved første tastetrykk (autoplay-policy).
Engangs-fanfarer: triumferende C-dur ved seier, dyster fallende a-moll ved nederlag.
API (play/stop/toggle) er stabilt så innspilte spor kan erstatte modulen senere.

**Kampdesign (FF1-ånd):** rundebasert. Hvert levende party-medlem velger handling
(Angrip / Magi / Gjenstand / Forsvar / Flykt), så løses runden i AGI-rekkefølge.
Party: Kael (kriger), Lyra (magiker: Glød/Rim), Bram (kleriker: Leg/Lysslag).
HP/MP og gull bæres mellom kamper; party-wipe → krystallen nullstiller run (roguelite-løkka).
Tastatur: piltaster = naviger, Z/Enter/Space = bekreft, X/Backspace = avbryt.

Kjør: `pnpm -C /Volumes/512gbSSD/dev/aetherfall dev` → http://localhost:5173
(Beveg deg i dungeon → tilfeldig kamp starter.)

## Roadmap

1. ✅ **Skjelett** — prosedyre-descent + bevegelse
2. ✅ **Kamp** — turbasert FF1-kamp (party, fiender, runde-initiativ, magi, items, flukt)
3. ⬜ **Run-loop** — Helligdom-hub, ekte permadeath-skjerm, loot/exp, oppgradering ← NESTE
   (delvis: gull, persistent party-HP og wipe-reset finnes allerede i `run.ts`)
4. ⬜ **Innhold** — klasser, fiende-variasjon, strata, boss, lyd, balansering
5. ⬜ **Validering** — deploy til nguyenchu.com, mål retention/feedback
6. ⬜ **Monetisering** — Capacitor → app-butikk, AdMob rewarded + IAP

## Neste steg

Fase 3: bygg ut run-løkka rundt kampen. Mangler ennå:
- **Helligdom-scene (hub):** start-/respawn-punkt med NPC-er og «stig ned»-knapp.
- **Nivå-progresjon:** trapp/utgang i dungeon → dypere stratum (Descent tar i dag aldri slutt).
- **Belønning:** XP + nivåstigning, loot-drops; bruk gull til oppgradering i Helligdommen.
- **Ekte game-over-skjerm** i stedet for direkte restart, og lagring (localStorage) av meta-progresjon.
