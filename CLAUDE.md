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
  battleReports.js (the player's last 30 battles), raidBattle.js (raids and sacks as battles),
  aiLanding.js (AI landings on the player's coast, queued), forts.js (manned forts start battles), stateAudit.js (invariant checks), plus src/utils/aiLogic.js (AI recruitment and
  war decisions). Balance harness: scripts/simulate.mjs.
- Modifiers: src/engine/modifiers/ (`getModifier` = full sheet; `getNationBonusTotal` = static only).
- `src/data/`: static game data (2,028 balanced regions, nations, techTree, buildings, resources).
- New map (plans/civ-map-rework.md, in progress on the features branch): `src/data/geo/tiles.json`
  is a frequency-100 geodesic hex grid (100,002 cells, 29,250 land, about 77 km between neighbours; plans/math/grid-f100.md) built by `npm run build:tiles`
  from Natural Earth, Köppen climate and terrain tiles (`npm run fetch:tiles` first, raw data is
  gitignored). `src/data/geo/geodesic.js` is the grid math, `tiles.js` the loader, `tileGeometry.js`
  turns ownership into GeoJSON territories, borders and the hex mesh, `src/data/scenarios.js` the
  starts (Dawn: one city per nation). Terrain data (phase F): `scripts/geo/build-tile-terrain.mjs`
  (in the build:tiles chain, or `npm run build:terrain`) adds river sizes per hex edge, mountain
  ranges, ridges and passes to tiles.json; read them through `src/data/geo/terrainData.js`
  (renderer integration notes: plans/phase-f-terrain-data.md). `npm run build:raster-detail`
  (after `node scripts/geo/fetch-tiles-raw.mjs --detail`) adds land-only level 6 tiles and land
  cover tiles (`src/data/geo/rasterDetail.js`); per-tile footprints in local km (town, fields,
  road and river bands): `src/data/geo/footprints.js`. The coast follows the hexes (every hex all land or all water, corners softened): `src/data/geo/hexCoast.js`, built into `hexLand.json` by `node scripts/geo/build-hex-coast.mjs` (run after build:tiles, before build:raster and build:pyramid); the flat map, globe and close view clip and mask with it. `npm run build:raster` renders the realistic Earth
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
  routes, zone of control, `normalizeUnitTiles`): `src/engine/armies.js`; marches: routes.js (Attack on a city the army does not border is a march to attack: marchAttack.js);
  the supply meter: supplyMeter.js; tile sight (fog): sight.js; fleets on sea tiles: fleets.js; sieges (walls, HP,
  encirclement, falls): sieges.js. Battlefields come from the tile and its six
  neighbours: src/battle/setup/tileContext.js feeds mapgen.js. Field battles between stacks on
  tiles: src/engine/fieldBattle.js (ATTACK_ARMY, kind 'field'). The campaign bridge (phase R2):
  every battle ends in ONE call, `applyBattleOutcome` (src/engine/battleOutcome.js, idempotent by
  operation id, every row of master plan 6.7; invasion/defense/field/naval apply functions are thin
  wrappers); battleInputs.js is what Command and Auto both read (supply, starvation, plague, walls'
  HP, the city's militia, allied reinforcements); autoBattle.js is the honest auto-resolve
  (auxiliaries from the battle economy, the walls' gate, calibrated with battle-lab parityEco);
  battleQueue.js holds battles others start against the player (pendingDefenses: city, field and
  sea), Command or Auto each, waiting for events and peace offers. Opinion with reasons (AI war
  roll, casus belli): src/engine/opinion.js over src/data/opinion.js. Loyalty and culture per
  city (flips, free cities): src/engine/loyalty.js. AI fronts (attacks from touching tiles,
  tile marches, sieges and assaults): src/engine/aiOperations.js. Research boosts from map facts:
  src/engine/boosts.js over src/data/boosts.js. Era goals and legacies: src/engine/eraGoals.js.
  Independent cities (phase W1, one-city `kind: 'independent'` nations of a peoples world): src/engine/independents.js
  over src/data/independents.js; who may fight whom (`canFight`, `canAttack`: no war needed against an
  independent): src/engine/hostility.js. Use it instead of a bare war check in new combat code. Their AI (W2):
  raids, sacks and tribute in src/engine/raids.js (the raid battle R3 replaces: raidBattle.js `fightRaidBattle`),
  grudges.js, mercenaries.js. No captives: units lost are gone (master plan decision 37). Majors and
  independents (W3): src/engine/indepPolicy.js (AI campaigns, `nation.indepGoal`, siege force `unit.indepOp`
  marched by aiOperations.js; joining by attitude; trade; tribute to majors; the player's actions) and
  razing.js (one size a turn, `city.razing`).
  City manifest (phase B): src/data/townLayout.js (from src/data/townLayouts.json, `npm run
  build:town-layouts` after town art), src/engine/cityManifest.js (from the city record; damage in
  region.cityDamage, the 50% rule, free repairs), battle: src/battle/setup/cityBattle.js and
  src/battle/render/cityLayer.js, map: src/components/map/closeView/townDamage.js.
  Progress and open balance items: plan section J3.
  Phase F rendering (WebGL map): rivers, bridges, mountain chains and passes in
  src/components/map/gl/terrainModel.js (drawn in GLMapView's terrain pass, under the fog);
  level 6 raster and land cover streamed by glLayers.createRasterLayer; the close view's towns and
  field plots from footprints, 3D ridges and river bands in closeView/terrainPlacement.js and
  mountainModels.js (`createCloseScene(..., { footprintOf })` is the hook for phase B's manifest).
- Peoples (phase W0): new games use scenario mode `peoples`: majors drawn from the 150-people
  pool (src/data/peoples.js, built facts in src/data/geo/peopleCapitals.json via
  `npm run build:peoples`), world sizes in src/data/worldSizes.js, the pick in
  src/engine/worldgen/peoplesWorld.js. Nation ids are people slugs (`akkad`, `israel`);
  `LEGACY_NATION_IDS` maps old country ids. `createInitialState` without a scenario still builds
  the legacy 240-country world (tests, old saves). Titles, regiment numbers: src/engine/peopleNames.js;
  battle names: src/engine/battleNames.js.
- Map data (current game): `scripts/geo/build-balanced-regions.mjs` merges the 4,482 real admin-1 provinces
  (kept in scripts/geo/source/) into 2,028 evenly sized regions, then `build-world-regions.mjs`
  and `build-region-coordinates.mjs` rebuild the game data. `regionMerge.json` maps old ids to
  new ones (used by the v6 save migration); a region's `includes` lists its member provinces.
- `src/battle/`: the tactical RTS. `sim/` is an integer fixed-point 20 Hz deterministic sim
  driven only by orders, run in a Web Worker (`worker/`); `render/` is the three.js battlefield;
  `setup/` builds a battle from macro armies. UI in src/components/battle/.
  Battle economy (phase R1, `setup.economy`, on for campaign battles, off by default in
  `buildSetupFromArmies` so tests/parity/bench hash as before): catalog src/battle/data/economy.js,
  nodes and camp src/battle/setup/economySetup.js, sim src/battle/sim/economy.js (workers, building,
  training, housing cap, `tactical.economy` in the result) and economyAI.js, drawing
  render/economyLayer.js, HUD EconomyHud.jsx. Workers are squads with `q.worker` (excluded from the
  end rules and the army AI). `node scripts/battle-bench.mjs --eco`; `.claude/skills/battle-lab/eco-shot.mjs`.
- `src/components/`: React UI (panels, modals, globe, map, battle screens).
- The flat map is one WebGL canvas (phase A2): `src/components/map/gl/GLMapView.jsx`. Territories,
  borders, hexes, fog and lens tints are one full-screen shader that finds each pixel's tile
  (territoryShader.js over the data textures of tileGpuData.js and territoryData.js); badges,
  banners, markers and glyphs are instanced sprites from a canvas atlas (sceneModel.js,
  spriteArt.js); the close view's models come from closeView/closeViewScene.js in the same scene.
  The world wraps east-west (mapView.js; a resize keeps the place at the centre: carryTransform). Camera moves from outside the map (after a battle, Show on map, prompts, the turn report) go through src/components/map/mapCamera.js (`cameraTarget`: the place, else the selected army, else the capital, never a default spot; `focusPlace` in marchEvents.js). The old SVG map (Map2DView.jsx) and the globe stay behind
  settings (map/mapPrefs.js) for one release. Map speed: `node scripts/perf/map-pan.mjs --gpu`.
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
- A commanded battle never opens with nobody on a side, and any set-up, worker or drawing error shows BattleFailure (Auto or Try again): src/components/battle/battleOpenGuard.js, TacticalBattleHost.jsx. Checkpoints resume only into the battle they were saved from (setupKeyOf; battle ids repeat between games).
- Plans and audits live in `plans/` (stabilization audit, Civ-style research, unit art brief).
- Tests that create a game must pass a fixed `rngSeed`; a fresh game gets a random one.
- resolveTurn does nothing while an event, a `pendingPeaceOffer` or a pending defense battle is
  open: long-run loops must answer them.
- The AI world is quiet by design (only Tier-1 AI nations declare wars).
- Unit models: CC0 packs go in src/assets/raw-models/, then `npm run import:models`.
