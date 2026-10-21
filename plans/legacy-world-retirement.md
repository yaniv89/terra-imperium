# Retiring the legacy 240-country world

Status: phases 1, 2 and 3 done except the balanced-regions file deletions (see section 6).

## What "legacy world" means here

`createInitialState(...)` called **without** `scenario.mode === 'peoples'` builds the old world: all 240
modern countries (`WORLD_NATIONS`, src/data/worldNations.js), legacy country ids (`'fr'`, `'de'`, `'us'`),
one Dawn city each from src/data/scenarios.js. Every new game from the start screen is a peoples world
(`scenario: { mode: 'peoples', size, seed, map }`, nation ids like `akkad`). Only tests, the balance
harness and old saves still reach the legacy builder.

## 1. Start paths (done in this phase)

Checked: start screen (src/components/ui/StartScreen.jsx), title screen, the guided start, URL flags
(`battleSandbox`, `tileViewer`, `worldLab`, `map`, `perf`, `safe`, `turndebug`, `audiodebug`: none start a game),
Capacitor (loads the same App, no start code of its own), pending start after a world change, import and load.

- StartScreen `begin()` and `guided()` always send `mode: 'peoples'`. No picker offers anything else.
- Two paths could still build a legacy world; both are closed in src/context/GameContext.jsx:
  1. `placeholderState()` (the hidden state behind the start screen when there is no save, or the save is
     refused) built `createInitialState()` on Earth. It now builds the same small peoples world a generated
     map already got (akkad, seed 1, size small).
  2. `resetGame(options)` with no `options.scenario` fell through to the legacy world. It now defaults to
     `{ mode: 'peoples', map: EARTH_SPEC }`.
- The reducer action `RESET_GAME` itself is unchanged (the GameContext tests still use it on the legacy
  world; that moves in phase 2).
- **Loading an old legacy-world save (done in phase 2):** `saveProblem` returns `legacyWorld` for any save whose scenario is not a peoples world (`isLegacyWorldSave`), `migrateSave` returns null, and the existing OldSaveNotice shows the reason; the save is kept, not deleted. The emergent country world is refused the same way. Also fixed: `backfillDefaults` rebuilt a peoples world at the default size because a save stores `worldSize`, not `size`.

## 2. Inventory

### Source modules

Real legacy-only code (can go in phase 3):
- `src/data/worldNations.js` (`WORLD_NATIONS`, 240 country records; `peopleNationRecord` lives here too and
  must move out). Readers: gameReducer.js (the `: WORLD_NATIONS` branch), applyEventEffects.js,
  describeEffects.js, TileSheet.jsx, TileViewer.jsx, NationCard.jsx (colour/name lookups: switch to
  `state.nations[id]` / PEOPLES).
- `src/data/peoples.js` `LEGACY_NATION_IDS` / `peopleForNationId` (maps old country ids to peoples; used by the
  `peoples` branch of createInitialState and by old tests that pass `'fr'` with a peoples scenario).
  `scripts/peoples/build-peoples.mjs` writes the `legacy` table.
- `src/engine/gameReducer.js` createInitialState non-peoples branches (`peoplesMode ? ... : WORLD_NATIONS`,
  `worldSeed` fallback, the Dawn one-city-per-country start in worldgen). `src/data/scenarios.js`
  `buildScenarioStarts` is shared with peoples? To confirm in phase 3: it takes `nationIds`, so likely kept.
- `src/engine/saveMigrations.js`: the v6 migration (`combineRegions`, `REGION_MERGE`, lines ~157-300) is dead
  code today: `OLDEST_LOADABLE_SAVE_VERSION = 10`, so no save older than 10 ever runs a migration. Safe to delete
  with its tests. The v10 to v13 steps stay while legacy saves load.
- Balanced regions pipeline: `scripts/geo/build-balanced-regions.mjs`, `build-world-regions.mjs`,
  `build-region-coordinates.mjs`, `build-game-regions.mjs`, `build-country-capitals.mjs`, npm script
  `build:world-regions`, data `src/data/geo/regionMerge.json` (40 KB), `gameRegions.json`,
  `subregions-*.json`, `scripts/geo/source/` (admin-1 provinces). The runtime no longer reads any of this:
  `src/data/regions.js` and `regionCoordinates.js` are now views over the city registry
  (src/engine/world/registry.js). The 2,028 static regions do not exist at runtime. Check before deleting
  that `countries-*.json`, `countryCapitals.json` and `subregions-*` are not read by the tile build
  (`build-tiles.mjs`, `classifyTile.js`): the tile build uses Natural Earth countries, so the country
  files stay, the merged-province files probably go.

**Not legacy, do not delete:** `src/data/regions.js` (name is old, but it is the live registry reader used by
~85 source files), `regionCoordinates.js`, `testWorld.js`, `nations.js` (doctrine tables).

### Tests

Counts from a scan of every `*.test.*` / `*.spec.*`: 156 files call `createInitialState`; **135 build the
legacy world** (a call without `scenario`), 455 such calls, about **1,550 tests** (`it(` / `test(` count, an
upper bound since helpers and loops are shared). 24 files already use a peoples world. About 141 files use
legacy country ids (`cap('fr')`, `playerNationId: 'fr'`). After the phase 1 batch: **132 files left**.

By folder (files / tests): src/engine 86 / 934, src/context 1 / 296, src/utils 5 / 74, src/data 9 / 89,
src/engine/modifiers 1 / 27, src/engine/nationActions 1 / 11, src/engine/world 4 / 9, src/engine/worldgen 1 / 7,
src/components (battle 5, city 3, map 4, panels 4, ui 5, modals 1, globe 1) 23 / 84, src/battle 2 / 10,
scripts 1 / 6 (build-edge-engine.test.mjs), src/data/geo 1 / 5.

Largest (migrate with care, each is its own task): src/context/GameContext.test.js (30 calls, 296 tests; it
tests the reducer through country ids), src/engine/resolveTurn.test.js (105 calls, 108 tests),
src/engine/diplomacy.test.js (71), src/utils/helpers.test.js (14 calls, 55), tacticalBattle.test.js (43),
peace.test.js (32), modifiers/sources.test.js (27), battleOutcome.test.js (26), aiEconomy.test.js (24),
applyEventEffects.test.js (24 calls), siege.test.js (24), economy.test.js (13 calls).
The other ~120 files have 1 to 20 tests each; 70 of them have 6 or fewer.

Also: `scripts/simulate.mjs` (balance harness: whole 240-nation runs; the balance-sim skill documents it) and
`scripts/audit-scenarios.mjs` use the legacy world. They need a peoples mode (the sim may already take a
scenario; check) before the builder goes. `scripts/build-edge-engine.test.mjs` builds the edge bundle and runs
legacy states.

### How a test moves

Recipe used in the phase 1 batch:
1. Replace `createInitialState({ playerNationId: 'fr', rngSeed: 7 })` with `peoplesWorld({ seed: 7 })`
   (src/engine/testWorld.js: akkad, small, majors only, built once per argument set and shared).
2. Replace legacy ids by the world's own: the player is `S.playerNationId`, a rival is `rivalOf(S)` (or `rivalOf(S, 1)`),
   cities by `cap(id)` or `addCity` / `addCities` / `borderPair` / `touchingPair`.
3. A test that needs a specific people (a coastal one, one with a given resource) passes `peoplesWorld({ player: 'xxx' })`;
   pin the seed and check the facts the test relies on in the first assertion.
4. A test that needs many nations at war, many cities or a late age builds them with `addCities`, `growCities`
   or the existing state setters, as the 24 already-migrated files do.
5. Numeric expectations that came from the 240-country start (for example "France has N regions") are re-pinned
   to the peoples world; if the assertion was a balance claim about a country, rewrite it as a rule about a
   nation of the world.

Risk: tests that assert on the specific legacy world's geography (Islamabad near India, Paris/Berlin
borders, `GameContext.test.js`) need a rewrite, not a rename. Expect about 15 percent of files to be that kind.

## 3. Proposed phases

**Phase 2: migrate tests in batches by folder (two to three days of agent time, split in lanes).**
- 2a: src/data, src/utils, src/components, src/battle, src/engine/world* (about 45 files, mostly small,
  mechanical). Half a day.
- 2b: src/engine small and medium files (about 75 files, 1 to 25 tests). Batches of 15 to 20 files, each run
  with the full suite. One to two days.
- 2c: the big ones one by one: GameContext.test.js, resolveTurn.test.js, diplomacy.test.js, helpers.test.js,
  tacticalBattle, peace, sources, battleOutcome, aiEconomy, siege, applyEventEffects. These hold 25 percent of
  the tests and most of the rewrite risk. One day, serial.
- 2d: scripts/simulate.mjs and audit-scenarios.mjs to a peoples world; confirm balance-sim still reports.
- Gate for phase 3: `grep` finds no test calling `createInitialState` without `scenario` and no `LEGACY_NATION_IDS` use
  outside the loader.

**Phase 3: delete (half a day, after phase 2 is merged).**
- Remove the non-peoples branch of createInitialState (make `scenario.mode` required or default to peoples),
  `WORLD_NATIONS` and its readers, `LEGACY_NATION_IDS`, the v6 migration, the balanced-regions scripts and data,
  `build:world-regions`, then fix `CLAUDE.md` (it still describes the 240-region data) and the balance-sim skill text.
- Decide the fate of version 10 to 13 saves (decision below), bump `OLDEST_LOADABLE_SAVE_VERSION` if refusing.
- Bundle and load-time gain: roughly 60 KB of nation data and 800 KB of region JSON out of the shipped build (confirm with `npm run build`).

Total: about 4 working days of agent time, 3 serial gates (full suite after each of 2a, 2b, 2c). The code that
goes is small; the effort is the tests.

## 4. Decisions (answered by the user)

1. Legacy-world saves (version 10 to 13, no peoples scenario) show the existing "older version, kept, not
   deleted" notice and do not load. Only the user ever played them. The legacy builder therefore does not
   need to stay for saves.
2. Country-specific tests (France, Germany, India geography) are rewritten as rules about a peoples world.
3. scripts/simulate.mjs moves to a peoples world once, at the end of phase 2. That resets every balance
   baseline: every lane's before/after comparison must be rerun once against the new base.

## 5. Progress log (phase 2)

Moved to a peoples world so far: about 120 test files (all of src/data, src/utils, src/components, src/battle,
src/engine/world and about 60 of src/engine). Helpers in src/engine/testWorld.js: `peoplesWorld`,
`neighbourWorld` (player borders its first rivals; `capitals: true` also makes the border city the rival's
capital), `withBorder`, `makeCapital`, `cloneWorld`, `majorIds`, `rivalOf`. Cached worlds are shared: a test that
changes a state in place must `cloneWorld` it first.

Still on the legacy world (phase 2 continues):
- Hand work needed, started and backed out: aiAccords (1 test), aiProduction (1), bridgeReaders (1: needs two
  cities of one people whose lands do not touch but are neighbours by the near rule), stabilization (2: the AI
  recruits nothing in the small world).
- Skipped by the script because of several player ids or extra options: resolveTurn, battleOutcome,
  secondReviewFixes, spending, mapTrade, settlers, aiOperations, forts, israeliteWonders, aiLanding, tutorial,
  wonders, sallyLanding, aiQualityBenchmark, pathOptimality, longRun, stateAudit, endgameReachability,
  data/proceduralEvents, data/geo/cityFeatures, utils/helpers, components/map/armySheetModel,
  engine/world/landChanges.
- Not started: src/context/GameContext.test.js (about 296 tests), scripts/simulate.mjs and
  scripts/build-edge-engine.test.mjs, worldgen/emergentWorld.test.js (the emergent country world goes with the
  builder in phase 3).

Engine findings from the migration (not changed here):
1. `generateAdvisorCandidates('akkad', ...)` can return a repeated name; the same call with a legacy id such as
   'fr' does not. govChoice.test.js keeps 'fr' for that reason.
2. Strategic deposits are keyed by modern country code (`data/deposits.js`, read as
   `hasDeposit(regData.startOwner, ...)` in helpers.js and aiEconomy.js), so a peoples city never has a deposit.
3. `getNationCapital` and friends read the registry of the last synced state. A test file that builds more than
   one world can read the wrong capital; read it from the state (`state.nations[id].capitalRegionId`).
4. `backfillDefaults` rebuilt a saved peoples world at the default size (fixed, saveMigrations.js).

## 6. Progress log (phases 2d and 3, 2026-10-21)

- Phase 2: the last 31 legacy test files moved (resolveTurn, GameContext, helpers, ai*, settlers, wonders, battleOutcome and more); no test calls `createInitialState` without a scenario. Full suite: 434 files, 4,153 tests green.
- Phase 2d: scripts/simulate.mjs (always a standard peoples world, `--scenario` removed, players rotate over the 150-pool majors), audit-scenarios.mjs (small, standard, large), and the balance-sim / perf harnesses (default player akkad). **Every balance baseline is reset: rerun the base commit with the new harness.** stateHash no longer crashes on a people id (it builds a peoples world).
- Engine finding 2 (deposits) was already fixed by pa-w9-deposits: a city's deposits follow `landCode`, the land its tile stands on.
- Phase 3 done: non-peoples branch of `createInitialState` (a missing scenario means peoples; other modes throw), `applyScenario` non-peoples branch, `generateStarts`, emergence.js, `WORLD_NATIONS` (worldNations.js became peopleNation.js with only `peopleNationRecord`), `LEGACY_NATION_IDS` and `peopleForNationId` (and the `legacy` table in peopleCapitals.json and build-peoples.mjs), save migrations 1 to 5 (the v6 merge included), src/test/fixtures.js. Readers (TileSheet, TileViewer, NationCard, describeEffects, applyEventEffects) use countries-meta or the state.
- Still to delete (a tool permission block stopped the delete): scripts/geo/build-balanced-regions.mjs, build-world-regions.mjs, build-region-coordinates.mjs, build-game-regions.mjs, scripts/geo/source/, src/data/geo/regionMerge.json, gameRegions.json, worldRegions.json, and the `build:world-regions` npm script. Nothing reads them at runtime. `subregions-*.json` stay (loadWorldFeatures.js reads them).
- Leftover: the `mode === 'emergent'` guards in colonies.js, aiEconomy.js, aiOperations.js, ColonyBlock.jsx, RegionInfoModal.jsx are dead in new games (the frontier expedition needs an emergent world). Remove with the frontier expedition.
- Engine findings: (a) curated national events (`HISTORICAL_EVENTS` with `nationId` like 'eg') never fire in a peoples world, ids are people slugs; (b) Israel's national wonders need `homeland: 'il'` but Jerusalem's tile is country `ps` on the Earth map; (c) `getNationCapital(id)` after `makeCapital` can return the old capital until the registry is synced.
