# Terra Imperium

A grand-strategy game on a real Earth globe, 2000 BCE to 2300 CE, any of 240 nations, with
real-time tactical battles. React 18 + Vite, three.js, Vitest, Playwright, Capacitor for mobile.
The live site is GitHub Pages, built into `docs/`.

## Working rules (from the user)
- Big features on a side branch. Merge to `main` only when the user asks; then rebuild `docs/`.
- Mobile-friendly always: phones play in landscape (844x390 is the reference screen).
- Automate rather than hand the user manual work.
- Plain English in messages to the user, no em dashes.

## Project skills (in .claude/skills/, use them without being asked)
- `add-mechanic`: before adding or changing any macro game rule, formula or per-turn system.
- `balance-sim`: whole-world headless runs and before/after comparisons for balance changes.
- `battle-lab`: tactical battle bugs and changes (headless squad traces, parity, browser screenshot).
- `ship`: commits, merging, rebuilding docs, the final summary.

## Architecture
- `src/engine/` is the deterministic macro engine. `resolveTurn(state)` (resolveTurn.js) runs one
  turn in fixed phases; `gameReducer` (gameReducer.js) handles player actions. Both are pure and
  seeded from `state.rngSeed`. Never `Math.random()` or `Date.now()` in game logic.
  Systems live in their own modules: economy.js, population.js, development.js, diplomacy.js
  (wars, war progress, `declareWar`), peace.js, invasion.js / defense.js (battle results),
  aftermath.js (war costs), vassals.js, pacts.js, techDiffusion.js, supplies.js, expansion.js (AE),
  aiEconomy.js, research.js (Civ-style science: a current tech, a queue, overflow; player and AI),
  battleReports.js (the player's last 30 battles), stateAudit.js (invariant checks), plus src/utils/aiLogic.js (AI recruitment and
  war decisions). Balance harness: scripts/simulate.mjs.
- Modifiers: src/engine/modifiers/ (`getModifier` = full sheet; `getNationBonusTotal` = static only).
- `src/data/`: static game data (2,028 balanced regions, nations, techTree, buildings, resources).
- New map (plans/civ-map-rework.md, in progress on the features branch): `src/data/geo/tiles.json`
  is a frequency-100 geodesic hex grid (100,002 cells, 29,250 land, about 77 km between neighbours; plans/math/grid-f100.md) built by `npm run build:tiles`
  from Natural Earth, Köppen climate and terrain tiles (`npm run fetch:tiles` first, raw data is
  gitignored). `src/data/geo/geodesic.js` is the grid math, `tiles.js` the loader, `tileGeometry.js`
  turns ownership into GeoJSON territories, borders and the hex mesh, `src/data/scenarios.js` the
  starts (Dawn: one city per nation). The coast follows the hexes (every hex all land or all water, corners softened): `src/data/geo/hexCoast.js`, built into `hexLand.json` by `node scripts/geo/build-hex-coast.mjs` (run after build:tiles, before build:raster and build:pyramid); the flat map, globe and close view clip and mask with it. `npm run build:raster` renders the realistic Earth
  (`public/map/world-*.webp`), the globe texture and flat map background. `/?tileViewer` is the
  prototype of the new map. The look is decided: real Earth, hexes only as a faint overlay.
  The engine now runs on it: `state.regions` holds one city record per city (`src/engine/world/
  cities.js`), `state.world.tileOwner` the borders; `src/engine/world/registry.js` rebuilds the
  old static readers (`REGIONS_DATA`, `getNeighborIds`, `getNationCapital`) from the last synced
  state. Tests that need more cities use `src/engine/testWorld.js` (`addCity`, `addCities`,
  `borderPair`); tests that build their own `regions` map must pass real city ids (`cap('fr')`).
  Save version 10 is a clean break (7 was the frequency-53 grid, 8 and 9 frequency 75). Distances are
  rules in km, never rings: write `ringsForKm(km)` (src/data/geo/gridScale.js; tech reach bonuses in
  src/data/techMapEffects.js are km too), movement is km a turn (armies.js MOVE_KM), a new city claims
  `foundingDisk` (the same land on any grid) and culture tile costs are per area. The one settling rule (306 km, one ring less across water) for founding, starts and the audit: `src/data/geo/citySpacing.js`. Settlers and outposts: `src/engine/settlers.js`; what AI cities
  build: `src/engine/aiProduction.js`. Armies on tiles (unit.tile, move points, tile costs, A*
  routes, zone of control, `normalizeUnitTiles`): `src/engine/armies.js`; marches: routes.js;
  the supply meter: supplyMeter.js; tile sight (fog): sight.js; fleets on sea tiles: fleets.js; sieges (walls, HP,
  encirclement, falls): sieges.js. Battlefields come from the tile and its six
  neighbours: src/battle/setup/tileContext.js feeds mapgen.js. Field battles between stacks on
  tiles: src/engine/fieldBattle.js (ATTACK_ARMY, kind 'field'). Opinion with reasons (AI war
  roll, casus belli): src/engine/opinion.js over src/data/opinion.js. Loyalty and culture per
  city (flips, free cities): src/engine/loyalty.js. AI fronts (attacks from touching tiles,
  tile marches, sieges and assaults): src/engine/aiOperations.js. Research boosts from map facts:
  src/engine/boosts.js over src/data/boosts.js. Era goals and legacies: src/engine/eraGoals.js.
  Progress and open balance items: plan section J3.
- Map data (current game): `scripts/geo/build-balanced-regions.mjs` merges the 4,482 real admin-1 provinces
  (kept in scripts/geo/source/) into 2,028 evenly sized regions, then `build-world-regions.mjs`
  and `build-region-coordinates.mjs` rebuild the game data. `regionMerge.json` maps old ids to
  new ones (used by the v6 save migration); a region's `includes` lists its member provinces.
- `src/battle/`: the tactical RTS. `sim/` is an integer fixed-point 20 Hz deterministic sim
  driven only by orders, run in a Web Worker (`worker/`); `render/` is the three.js battlefield;
  `setup/` builds a battle from macro armies. UI in src/components/battle/.
- `src/components/`: React UI (panels, modals, globe, map, battle screens).
- Layout: `src/hooks/useLayoutMode.js` picks desktop / tablet / phone-landscape / phone-portrait and
  sets `<html data-layout>`. Phones play landscape (slim top bar, tab rail on the right, side
  sheets); portrait shows a rotate screen. CSS follows it with the `pl:` Tailwind variant and the
  `.sheet-backdrop` / `.sheet-panel` classes (index.css). `useIsMobile` = the bottom-bar layout only.

## Commands
- `npm run lint` (zero warnings allowed), `npx vitest run`, `npm run build` (writes docs/).
- e2e: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium npx playwright test`.
- Battle sandbox in the browser: `npx vite`, then open `/?battleSandbox`.

## Known quirks
- Timing budgets (80 ms/turn) run only with `PERF_CHECKS=1`. The sandbox varies by 10-20 ms run
  to run: compare against the base commit on the same machine (balance-sim compare.sh), never
  against an old number. Long full-game tests can time out under full-suite load; rerun alone.
- Invariants: `auditGameState` / `assertGameState` in src/engine/stateAudit.js.
- Plans and audits live in `plans/` (stabilization audit, Civ-style research, unit art brief).
- Tests that create a game must pass a fixed `rngSeed`; a fresh game gets a random one.
- resolveTurn does nothing while an event, a `pendingPeaceOffer` or a pending defense battle is
  open: long-run loops must answer them.
- The AI world is quiet by design (only Tier-1 AI nations declare wars).
- Unit models: CC0 packs go in src/assets/raw-models/, then `npm run import:models`.
