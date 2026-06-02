# Aetherfall

Et historiedrevet roguelite-JRPG inspirert av Final Fantasy 1 — bygget på
**«Hades-modellen»**: håndlaget historie og verden, prosedyre-genererte
nedstigninger.

> Arbeidstittel. Lett å endre (mappenavn + `package.json` + tittel i `index.html`).

## Premiss

Aether — den lysende substansen som holder verden oppe og gir krystallene
kraft — har falt. Verden synker, lag for lag, ned i dypet. Du er en av Lysets
siste krigere, bundet til den siste hele krystallen: hver gang du dør, trekker
krystallen deg tilbake til **Helligdommen** (hub), og du stiger ned igjen for å
nå bunnen og gjenreise Aether.

- **Fast ramme:** Helligdom (hub, NPC-er, historie, oppgraderinger) + navngitt
  hovedperson + mål + en faktisk slutt.
- **Strata:** håndlagde verdener (Stratum I – Den Sunkne By → Ashen Dyp →
  Krystallkjernen …) med egen stemning og boss. Rommene _inni_ genereres.
- **Narrativ permadeath:** krystallen henter deg = roguelite-løkka forklart i
  fiksjonen.

## Teknologi

- **Phaser 3 + TypeScript + Vite** — spillet (kjører i nettleser)
- **Capacitor** (senere) → iOS/Android med AdMob (rewarded ads) + kjøp i app
- Backend (valgfritt, senere): egen server + Postgres for lagring/leaderboard

## Kjøre lokalt

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # typesjekk + produksjonsbygg til dist/
```

## Roadmap

1. **Skjelett** ← nå: prosedyre-descent + rutenett-bevegelse
2. **Kamp:** turbasert FF1-kamp (party, fiender, ATB, magi, items)
3. **Run-loop:** permadeath, loot, valuta, oppgradering i Helligdommen
4. **Innhold:** klasser, fiende-variasjon, strata, boss, lyd, balansering
5. **Validering:** deploy til nguyenchu.com, mål retention/feedback
6. **Monetisering:** Capacitor → app-butikk, AdMob rewarded + IAP
