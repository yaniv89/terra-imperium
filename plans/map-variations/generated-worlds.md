# Generated worlds: status (MV0, MV3, peoples of MV5, a first MV4)

Date: 2026-10-07. Branch `claude/mv-generated-worlds` (from `claude/integration`). The plan is
`plans/MAP-VARIATIONS-PLAN.md` (tier e, sections 3, 4, 6, 8, rollout MV0, MV3 to MV5).

## Built

- **One world per page load** (MV0): `src/worldgen/worldLoader.js` boots Earth or a generated world
  before the engine loads; the IndexedDB cache (`worldCache.js`); the worldgen worker; turn and
  battle workers get the world in their first message; a game on another world reloads the page.
  Module caches keyed by tile id reset through `onWorldChange` (tiles.js); Node switches worlds
  with `src/worldgen/nodeWorld.js`.
- **World descriptor** `scenario.map` (spec.js: map codes, FNV-1a world hash), save version 13
  (older saves are marked as the real Earth), the site table `scenario.sites`.
- **Shared pure modules**: `classifyTile.js` (classify, resource scatter), `terrainColumns.js`
  (ranges, ridges, passes), `rasterLook.js` (palette). The Earth builds import them back; the
  scatter and the terrain columns were checked against Earth's stored columns (identical).
- **Generator v1** (`src/worldgen/v1/`): integer noise, plates, elevation from 5 x 5 samples,
  sea level by exact quantile, climate and Köppen, corner drainage, lakes, rivers on edges with
  sizes, classify, terrain columns, seeded resources, names, fair start sites with repairs,
  quality checks with up to 4 attempts. Golden hashes for seeds 1 to 3.
- **Peoples on a generated world** (`src/engine/worldgen/generatedPeoples.js`): majors by the
  weighted roll, sites by climate affinity (Hungarian method), independents and late arrivals by
  affinity under the settling rule, spread away from other cities first; culture zones for town art and homelands
  (`src/engine/world/cultureZones.js`); city names stay with the people.
- **Painted look, first CPU version** (MV4 start, `src/worldgen/painter.js`): the realistic style
  of the Earth raster build (Köppen colours, tints, rock and snow line, hillshade, bathymetry, lakes,
  rivers) painted in the worldgen worker into the 2048 base picture (levels 0 to 3), WebP, cached
  with the world; the flat map, globe, minimap and close view ground draw it; no Earth pyramid or
  detail tiles are requested on a generated world (`worldPictures.js`).
- **Start screen** Map block (Real Earth / Generated world, preview, map code, New map, land,
  continents, climate), shown in dev builds or after `?generatedWorlds` until MV4 is complete;
  `/?worldLab` debug page; `scripts/worldgen/bench.mjs`,
  `browser-check.mjs`; balance-sim `MAP=generated`.

## Measured

| What | Result |
|---|---|
| Generation, production build, Edge, worker, with the coast | 1.1 to 1.3 s a world |
| Same plus painting the 2048 picture (first boot only; cached after) | 2.4 to 2.7 s, WebP encode 0.2 s, 270 to 290 KB |
| Same, CPU slowed 4x (page thread) | 4.7 to 5.5 s |
| Node, one attempt | 0.6 to 1.0 s (1.5 s on a loaded machine) |
| Browser worker hashes vs Node golden (seeds 1 to 3) | equal |
| Fair start spread (major sites, below the median) | 4.0 to 4.9 % |

Balance-sim, Standard, 100 turns, passive player Akkad (Earth peoples world for comparison):

| | gen 1 | gen 2 | gen 3 | Earth 1 | Earth 2 | Earth 3 |
|---|---|---|---|---|---|---|
| majors alive at turn 100 (of 36) | 36 | 36 | 36 | 36 | 36 | 36 |
| independents at the start | 108 | 108 | 108 | 108 | 107 | 108 |
| major cities at turn 100 | 208 | 209 | 171 | 162 | 140 | 171 |
| independents alive at turn 100 | 92 | 95 | 104 | 105 | 101 | 105 |
| Gini of cities | 0.448 | 0.447 | 0.402 | 0.389 | 0.365 | 0.409 |
| effective nations | 70.4 | 72.9 | 82.4 | 77.8 | 76.4 | 73.3 |
| ms per turn (last 25, loaded machine) | 94 | 83 | 74 | 114 | 108 | 107 |
| nonFinite / audit violations | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

## Places that assumed the real Earth, and what a generated world does

| Where | Generated world |
|---|---|
| tiles.js decorate: `country`, `countryIds`, `capitals`, name tables | the generator writes the Earth schema with empty values (country -1, `countryIds: []`, `capitals: {}`) and its own name tables |
| peoples.js `PEOPLES[id].tile` (peoplesWorld pickMajors, buildPeoplesStarts, independents pick, late arrivals, cityNames) | `scenario.sites` from generatedPeoples.js; buildPeoplesStarts and processLateArrivals read it; cityNames skips Earth neighbours |
| registry.js ensureDefaultWorld, scenarios.js buildScenarioStarts, emergence.js, generateStarts (legacy country worlds) | with `capitals: {}` they build nothing; only the peoples mode is allowed on a generated world (createInitialState throws otherwise) |
| architecture.js styleOfLand via `countryOf` (cityManifest, closeViewScene) | `landOf(tile)`: the culture zone's people |
| greatProjects.js / wonders.js `homeland` (Solomon's Temple, Masada) | `onHomeland`: the zone of the people of that land (Israel's zone) |
| deposits.js (curated by country) | never matched people ids already; the fair-site repairs place copper or iron and horses for every major |
| tutorial.js (Kemet on the Nile) | the guided start always uses the real Earth |
| hexLand.json (coast) | buildHexLand on the generated columns, unchunked, in the worker |
| worldRaster.js, rasterTiles.js, rasterDetail.js (baked Earth pictures) | MV4: the painter's base picture; Earth tiles and detail are not loaded |
| StartScreen "Capital X, in modern Y" | "Home: a hot dry river land ..." from peopleHomes.json |
| tiles `names`, `riverNames`, `rangeNames` (battle names, tile sheet, logs) | generated names (names.js) |
| countries-meta / names.js culture groups, worldNations doctrine | fall back to generic (cosmetic) |
| events.js scripted country events | legacy worlds only; never fire in a peoples world |
| onboarding text "one real Earth" | flavour, left for a text pass |
| supabase edge function (bundles Earth's tiles) | generated games stay local for now (open question 9) |

## Left

- **MV4**: the GPU renderer for levels 4 to 6 and the land cover (the close view's ground and
  `terrainShader` cover classes), river meanders and coast paint under the hex scale, the 4096
  picture for desktops, parity renders against baked Earth, phone benchmarks. The first CPU
  painter only fills the 2048 base picture, so close zooms are soft.
- Generator look: many shallow inland seas inside continents, island arcs one hex wide, sea ice
  bands at the poles are wide; worth a tuning pass before shipping (a new generator version).
- **MV5**: shapes (pangaea, archipelago, islands, inland sea), rainfall and relief chips and the
  "More" sheet, pasting a map code, `?map=CODE`, W12 and W17 map cards, Clear cached worlds,
  balance-sim acceptance on 20 seeds per preset for 200 turns, e2e of a full game on a generated
  world, the edge-function decision, WebKit hash check (needs `npx playwright install webkit`
  or `/?worldLab` on the iPhone), resource counts within 25% of Earth's per land tile.

## Second round (2026-10-08, branch `claude/mv-generated-2`)

### Built

- **GPU painter (MV4)**: `src/components/map/gl/proceduralPaint.js` over `src/worldgen/paintData.js`
  (two float texels a tile: climate colour, elevation, flags, land cover base class, roughness,
  river bits and sizes). A fragment shader paints 256-pixel tiles of the pyramid layout in the
  map's own WebGL context, levels 2 to 6, and the land cover tiles for levels 5 and 6 that the
  close view's terrain shader reads (tree crowns, ripples, plots, as on Earth). Per pixel: the tile
  by the lookup and a walk, a Gaussian blend of it and its neighbours, relief under the hex scale
  (fractal noise, ridged where rough, octaves down to two pixels) with the Earth build's hillshade,
  colours and snow line, shores pushed off the hexagons by noise, rivers on the grid's edges with a
  meander and a warp of the whole network (they leave the hex edges and stay connected), streams
  thin without a bank, dry wadis in deserts. The raster layer (`glLayers.js`, `source`) paints at
  most 4 tiles a frame and shows a painted ancestor meanwhile; `info().raster.pending`.
- **Base picture** now 1024 wide (CPU painter), the GPU paints everything above it; a cached
  2048 picture from before still loads (`pictureSize`).
- **Generator v2** (gated inside the v1 pass, v1 still matches its golden hashes byte for byte):
  no land specks of up to six hexes and no enclosed seas under 250 hexes (the quantile taken again
  so the land share stays exact), lower ocean arcs and ridges, sea ice from about 80 degrees, fewer
  lakes, a wandering dry belt, resources at Earth's counts per land tile; **shapes** continents,
  pangaea, archipelago, islands, inland sea; **relief** low, normal, high. New games use v2.
- **MV5 UI**: Shape chips, a More sheet (continents, rainfall, relief, paste a map code), map codes
  carry shape and relief letters (`G2-30-AT-NP-...`; old codes parse), `?map=CODE` prefills the
  start screen, `MapCard.jsx` in Settings (with Clear cached worlds and the space used) and in the
  nation overview. The dev flag is gone: the World step offers Real Earth / Generated world to all.
- **Fix**: the start camera went to another people's city on a generated world (the registry kept a
  capital id from the previous game; start sites are reused between games there).
- Tools: `scripts/worldgen/look-shots.mjs` (start, mid and world view, phone and desktop),
  `bench.mjs --paint --version --shape`, `resources.mjs`, balance-sim `SHAPE` and `GENVER`,
  e2e `generatedGame.spec.js`.

### Measured

| What | Result |
|---|---|
| Start view drawn after the game is up (desktop GPU, Edge) | 2 to 5 s (phone profile), 2 s (desktop) |
| Browser worker hashes (seeds 1 to 3, v2) | equal to Node golden |
| Generation in the worker, desktop | 1.7 to 2.0 s with the coast (machine loaded) |
| Same, CPU slowed 4x, page thread | 7.0 to 8.1 s, measured while 6 balance games ran in parallel: not a clean number; the 1024 base picture saves about 1 s of it |
| Resources per land tile, 5 standard worlds | every one within 25% of Earth (before: 32 of 35 outside) |

Balance acceptance, 20 seeds each, Standard, 200 turns, passive Akkad, mean and 95% interval:

| | Earth | continents | pangaea | archipelago | islands | inland sea |
|---|---|---|---|---|---|---|
| Gini of cities, turn 100 | 0.399 | 0.432 | 0.435 | 0.440 | 0.426 | 0.436 |
| Gini of cities, turn 200 | 0.584 | 0.599 | 0.600 | 0.586 | 0.593 | 0.599 |
| majors alive at 200 (of 36) | 36.0 | 36.0 | 35.9 | 36.0 | 36.0 | 35.9 |
| major cities at 200 | 354 | 447 | 448 | 434 | 411 | 458 |
| effective nations at 200 | 43.8 | 46.6 | 46.8 | 49.7 | 49.3 | 46.0 |
| ms a turn at 200 (6 games in parallel) | 147 | 160 | 163 | 175 | 161 | 199 |
| nonFinite, audit violations | 0, 0 | 0, 0 | 0, 0 | 0, 0 | 0, 0 | 0, 0 |

Gini within 10% of Earth's at 100 and 3% at 200 (target 20%), eliminations equal (target 5
points): accepted. Majors build 16 to 30% more cities on generated worlds (more open plains).

### Left

- Phone benchmarks on a real phone (the GPU paint time a tile on an A14 or Adreno 6xx; the
  4x-throttled generation on an unloaded machine); WebKit hash check (`/?worldLab` on the iPhone).
- Parity renders: the GPU painter fed with Earth's columns beside the baked pyramid (MV8 question).
- Rivers still read as following hex edges at the mid zoom; a curve through the corners (tangents
  from the neighbouring reaches) would finish them. Climate blobs (steppe in desert) show as dark
  patches in the close view through the ground materials, as they would on Earth.
- The start screen preview is the flat tile-colour picture; the painted look could replace it.
- Jungle and oasis resources stay short on pangaea and islands worlds with few jungles.
- The edge function decision (generated games stay local).
