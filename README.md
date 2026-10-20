# Terra Imperium 🌍

A grand-strategy game on a real Earth globe, from 2000 BCE to 2300 CE. You lead one of the peoples of the world, grow cities, research technology, trade and fight with the other powers, and command your battles in real time or let Auto settle them.

It is built for phones in landscape first, and also runs on desktop and tablet. The game is in Hebrew and English.

> **Status**: in active development. Everything under "What the game is" exists today. Everything under "Roadmap" is planned and not built yet.

## Play it

- **In a browser**: https://terra-imperium.pages.dev (rebuilt on every push to `main`).
- **On iPhone**: open the site in Safari, tap Share, then Add to Home Screen.
- **On Android**: open the site in Chrome and choose Add to Home screen, or install the test APK from https://terra-imperium.pages.dev/terra-imperium.apk (allow unknown sources). The APK is a thin Capacitor shell that opens the live site full screen in landscape, so it does not need an update when the game changes.
- Hold the phone in landscape. Portrait shows a rotate screen. The reference screen is 844x390.

## What the game is

- **A real Earth.** The map is a hex grid over a realistic Earth (about 100,000 cells, 29,000 of them land, roughly 77 km between neighbours), with rivers, mountain ranges, passes, climate and land cover from real data. It plays as a flat map that wraps east to west, with a globe view as an option, and a close view that shows towns, fields and terrain in 3D.
- **Peoples worlds.** A new game draws its major powers from a pool of 150 peoples, each placed at its real home. Smaller one-city independents sit among them. (The older 240-country world is still in the code for tests and old saves.)
- **Cities and research, Civ style.** Cities are the unit of play: they found, grow, build and hold their own loyalty and culture. Research works like Civilization: one current tech, a queue, and overflow carried over. Map facts such as rivers or mountains can give research boosts.
- **Diplomacy with reasons, Paradox style.** Wars, pacts, vassals, tribute demands and peace offers, with an opinion system that shows why a nation likes or dislikes you. The AI world is quiet by design: only the strongest tier of AI nations declares wars on its own.
- **Real-time battles.** Armies move over map tiles, sieges and field battles start on the map, and a battle opens as a real-time tactical fight on a field built from the tile and its neighbours. In a commanded battle you also run a small base economy (workers, buildings, training). If you do not want to command, Auto resolves the same battle by the same inputs and the result screen shows the full receipt.
- **Hebrew and English.** The whole game switches language, including names, events and messages (`src/i18n`).
- **Mobile built in.** Slim top bar, tab rail on the right and side sheets on phones. Capacitor packages the same app for Android and iOS.

## Tech stack

React 18, Vite, three.js (the battlefield, close view and globe), a custom WebGL map renderer, Tailwind CSS, Vitest, Playwright, Capacitor for mobile. Supabase is used for online features. The site is hosted on Cloudflare Pages.

## Project structure

```
src/
  engine/       deterministic macro engine: resolveTurn, gameReducer, economy, diplomacy,
                sieges, armies, research, AI operations, state audit
  engine/world  cities, registry and the world state built on the tile grid
  battle/       real-time tactical sim (fixed-point, 20 Hz, in a Web Worker),
                renderer, setup from macro armies, battle economy
  data/         static game data: tiles and geography, nations, peoples, tech tree, buildings
  components/   React UI: map (WebGL), panels, modals, battle screens
  hooks/        layout mode (desktop, tablet, phone), panel and card priority
  i18n/         Hebrew and English text
scripts/        data builders (geo, peoples, art), balance sim, perf and UI checks
scripts/blender Blender builders for unit and town models
e2e/            Playwright tests
plans/          design plans, audits and the master plan
.github/        CI and the Cloudflare Pages deploy
```

The engine is pure and seeded from `state.rngSeed`: the same seed and the same actions always give the same game. `CLAUDE.md` has the detailed architecture notes.

## Getting started

You need Node.js 22 (the version CI uses) and npm.

```bash
git clone https://github.com/yaniv89/terra-imperium
cd terra-imperium
npm install
npm run dev        # dev server on http://localhost:3000
```

Build and preview:

```bash
npm run build      # writes dist/
npm run preview
```

Tests and lint:

```bash
npm run lint       # zero warnings allowed
npm test           # Vitest
npm run test:e2e   # Playwright (set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH if you use your own Chromium)
```

Some long full-game tests can time out under full-suite load; rerun them alone.

Mobile: `npm run cap:sync` builds the mobile bundle and syncs it into the Capacitor projects.

Battle sandbox: with the dev server running, open `http://localhost:3000/?battleSandbox` to fight a test battle without a campaign. The prototype of the new map is at `/?tileViewer`.

Map data is rebuilt with scripts such as `npm run fetch:tiles` then `npm run build:tiles`, `npm run build:raster` and `npm run build:peoples`. The built data is checked in, so you only need these when you change the map.

## Art pipeline

Units, towns and map models are built in Blender from scripts in `scripts/blender` (one builder per unit or town type, with validation scripts). CC0 model packs go in `src/assets/raw-models/` and `npm run import:models` brings them in. `npm run pack:models` packs the models the map and close view use, and `npm run build:town-layouts` rebuilds town layouts after town art changes.

## Roadmap (planned, not built yet)

These come from `plans/2026-10-20-001-feat-eight-ages-plan.md` and `plans/2026-10-20-002-feat-differentiation-plan.md`.

- **Eight ages, by research.** Every game starts in the Stone Age and an age comes only from your own research. The ages run from the Stone Age to the Future, each with its own techs, units, buildings, battles and art. The old space race and nuclear systems go.
- **A ruler with ambitions and decrees.** One ruler across the whole game with named ambitions for each age. The abstract point pools give way to gold, authority and a small budget of decrees earned mostly through deeds.
- **Legacy score.** One legacy score (or domination) replaces the five victory types.
- **The Chronicle.** A history of your people you can read and share, with a glossary.
- Also planned: a linked event deck, fewer but more meaningful battles with a readable Auto, and weekly seeded challenges.

## License

MIT License. Feel free to modify and distribute.

---

**Note**: This is a historical strategy game. Depictions of nations, borders and history are for gameplay purposes and are not political statements.
