# Terra Imperium map variations plan (phase MV)

Date: 2026-10-07. Status: plan only, nothing built. Branch for the plan: `claude/plan-map-variations`
(from `claude/integration` 0a35a5ee).

The user's request: different maps each game, "not only Earth": generated (fictional) worlds as a
first-class option, next to Earth-based variations. Added during planning: "maybe we can write math
formulas to generate maps in real time like No Man's Sky, with no need to store the real map data"
(section 4 answers it and the generator is built that way).

Read with: `CLAUDE.md` (the map pipeline), `plans/MASTER-PLAN.md` (order of work),
`plans/UI-DESIGN.md` (W01 start screen, W12 settings, W17 overview), `plans/math/grid-f100.md` (the
grid), `plans/peoples-and-world-setup.md` (peoples, themes, "towns follow the land"),
`plans/RULER-PLAN.md` (rulers, save v13), `plans/SIGNATURE-UNITS-PLAN.md`.

## 0. Summary

- **One grid for every map.** Every variation runs on the same frequency-100 geodesic grid
  (100,002 cells, 77 km apart). Only the per-tile columns change (land, elevation, climate,
  terrain, rivers, ranges, passes, resources, names). The engine already reads the grid through one
  door (`getTiles()` over `setRawTiles(raw)` in `src/data/geo/tiles.js`), and every rule is in km,
  so a new world is "a different tiles.bin", nothing more for the rules.
- **Six tiers**, cheapest first: Historical Earth (today), Shuffled Earth, Earth variants
  (mirror and south-up are exact grid symmetries, measured below; low seas and a green Sahara need
  the procedural look), Generated worlds (the big one), Regional Earth maps, and later a
  "procedural Earth" that shrinks the stored raster.
- **Generated worlds are formulas plus one global pass.** Everything local (relief, the painted
  surface, land cover, vegetation, the close view's detail) is a deterministic function of
  (seed, point on the sphere, level of detail), evaluated where the camera looks, like No Man's
  Sky. Everything that depends on the whole world (land and sea per hex, rivers by flow
  accumulation, lakes, continents, fair start sites, the hex table the engine runs on) is
  computed once per seed in a worker in a few seconds, kept in memory and in an IndexedDB cache,
  and rebuilt from the seed on load. **Saves and git hold only the seed and the parameters.**
- **Determinism split.** The data the rules read is built with integer hash noise and only
  exactly rounded arithmetic (+ - * / sqrt, plus `exactMath.js` trigonometry), so the same seed
  gives the same bytes on V8 (Android, desktop) and JavaScriptCore (the user's iPhone). The
  painted look runs in float GPU shaders and does not need to be bit exact.
- **The look stays the decided look**: the realistic Earth style (Köppen colours, hypsometric
  tints, snow line, hillshade, bathymetry, rivers), rendered by a GPU shader from the generated
  data instead of baked WebP tiles, at the same pyramid levels 0 to 6 and in the close view.
- **Recommended order**: MV0 foundations, MV1 Shuffled Earth (quick win, ships alone on the baked
  raster), MV2 mirror and south-up Earth (tiny), MV3 generator core (data), MV4 procedural look,
  MV5 generated worlds playable and shipped, MV6 low seas and green Sahara, MV7 regional maps,
  MV8 (optional) procedural Earth detail. About 19 to 29 sessions in all; generated worlds are
  playable after MV5 (about 13 to 20 sessions).

## 1. What exists today (read 2026-10-07 on `claude/integration` 0a35a5ee)

| Piece | Where | What a new map must provide |
|---|---|---|
| The grid | `src/data/geo/tiles.json` (9.1 MB, Node) and `public/map/tiles.bin.gz` (1.7 MB, browser), built by `scripts/geo/build-tiles.mjs`; codec `tilesCodec.js`; loader `tiles.js` | the same columns: `land, coastal, elevation, roughness, climate, terrain, relief, feature, rivers, resource, riverSize, range, ridge, pass` plus `names, riverNames, rangeNames, rangeSizes, capitals`. `lat, lon, neighbors` are the grid itself and never change |
| Classification | `classify()` in build-tiles.mjs: relief from elevation mean, max and roughness (5 x 5 samples per cell), terrain from Köppen, features by a hash, named ranges as a tie-break | the same inputs (elevMean, elevMax, rough, Köppen, region classes, glaciated, lake, river edges, coastal, depth) |
| Resources | build-tiles.mjs: a hashed scatter by terrain, relief and feature, plus curated deposits per country (`deposits.json`) | the scatter works as is; the per-country guarantee needs a per-start guarantee instead |
| Terrain data | `scripts/geo/build-tile-terrain.mjs` (river size classes, ranges as connected mountain groups, ridges as a maximum spanning forest, passes by `PASS_RULES`); read by `terrainData.js` | river sizes from flow instead of Natural Earth scalerank; the rest runs unchanged on any columns |
| Rivers | per tile 6 bits, bit k = a river along the cell boundary shared with `neighbors[k]` (Civ style, on edges); corners by `edgeCorners` | a drainage network on the grid's corners (the hex vertices), so rivers run along edges |
| Coast | `hexCoast.js buildHexLand(tiles)` (pure, in src) -> `hexLand.json` (0.67 MB): every hex all land or all water, corners softened, a 4 km wobble | run the same function on the generated grid, in the worker |
| The painted Earth | `build-world-raster.mjs` (2048 and 4096 base pictures), `build-raster-pyramid.mjs` (levels 0 to 5, 16,384 x 8,192, `makeShadePixel`), `build-raster-detail.mjs` (level 6 land tiles and land cover levels 5 and 6) | the same look as a shader; nothing baked |
| Repo weight | `public/map` = 48 MB: level 6 20 MB, level 5 9.4 MB, level 4 2.7 MB, levels 0 to 3 1.1 MB, land cover 12 MB, base pictures 0.8 MB, tiles.bin.gz 1.7 MB | generated worlds add **0 bytes** |
| WebGL map | `GLMapView.jsx`; `glLayers.createRasterLayer` loads pyramid tiles by URL (`rasterTiles.js`, `rasterDetail.js`); the territory shader finds each pixel's tile on the GPU (`tileGpuData.js`: centres, neighbours, a lookup grid) | a raster source that can be "URLs" or "render this tile procedurally" |
| Peoples | `peoples.js` (150 peoples, real capitals, theme, region), `peopleCapitals.json` (capital tiles), `peoplesWorld.js pickMajors` (612 km gap, `MAJOR_MIN_GAP_KM`), `independents.js pickIndependents`, `cityNames.js` (nearest absent peoples' lists) | a per-game site table instead of `PEOPLES[id].tile` (read in 4 places: peoplesWorld.js twice, independents.js:47, cityNames.js:62) |
| Settling | `citySpacing.js` (306 km, one ring less across water), `settlers.js siteQuality` (tile yields of the city and ring 1, resource, river, coast) | works as is; the fair start score is built on it |
| Art by land | `architecture.js styleOfLand` ("towns follow the land", the tile's modern country; it already accepts a people id), read in `cityManifest.js:55` and `closeViewScene.js:211, 423`; national wonders by `homeland` country (`greatProjects.js`, `wonders.js`: Solomon's Temple, Masada on "Israel's land") | a "land of" lookup that is the country on Historical Earth and a culture zone elsewhere |
| Battle maps | `tileContext.js` + `mapgen.js`, from the tile and its six neighbours | nothing: they read tile columns only |
| Boosts | `src/data/boosts.js` (copper, iron, horses, coal, oil, uranium, river, coast, forest, harbour...) | the facts must exist and be reachable for every start |
| Names | `tiles.names` (5,916 place names), `riverNames` (11,325 tiles), `rangeNames` (269); used by battle names, city names, logs, the tile sheet | generated names |
| Saves | `saveMigrations.js` CURRENT 12; the ruler plan takes v13 | `scenario.map`; next free version (v14) |

Measured for this plan (scratch script over tiles.json):

- **Exact grid symmetries.** The grid maps onto itself under: a 72 degree turn in longitude;
  a mirror across the meridian 15 E (and 51 E, 87 E, every 36 degrees); and a north-south flip
  combined with a 36 degree turn. 100,002 of 100,002 cells match in each case; any other turn or
  mirror matches 742 or fewer. So a mirrored or south-up Earth is an exact permutation of tile ids.
- **Low seas.** 3,886 sea tiles have a mean elevation above -120 m (the Ice Age sea level): land
  grows from 29,250 to about 33,100 tiles (+13%: Beringia, Doggerland, Sundaland, Sahul, a dry
  Persian Gulf).
- **Regional windows (land tiles).** Mediterranean (12 W to 42 E, 28 to 48 N) 1,274; Europe
  (12 W to 45 E, 34 to 72 N) 1,651; Near East (25 to 65 E, 12 to 45 N) 2,325; East Asia (90 to
  150 E, 10 to 55 N) 2,757; Africa 6,962; the Americas 8,186. At Earth's Standard density (36
  majors on 29,250 tiles, about 810 tiles each) the Mediterranean holds about 2 majors: regional
  maps must be denser on purpose (section 2.5).
- The code base: 92 source files call `getTiles()`; 33 have module-level caches (`let x = null`
  or a module `new Map()` memo). Switching worlds in one page is therefore risky; section 3.1
  avoids it.

## 2. The variation menu

| Tier | What the player gets | Value | Effort | Needs |
|---|---|---|---|---|
| a. Historical Earth | today's map, peoples at their real capitals | the default, kept | 0 | none |
| b. Shuffled Earth | real Earth, peoples on fair sites anywhere (climate-matched or loose) | high: every game a new political map, cheap | 2 sessions | MV0 |
| c. Regional Earth | a window (Mediterranean, Near East, Europe, East Asia, Americas, Africa) with its peoples | medium: short, crowded games | 2 to 3 | MV0, MV1 site code |
| d1. Mirrored / south-up Earth | exact grid symmetries; the baked raster drawn mirrored | low to medium: a familiar-unfamiliar world, almost free | 1 | MV0 |
| d2. Low seas, green Sahara | Earth's columns edited (sea level -120 m; Sahara and Arabia wetter, mega-lakes) and painted procedurally | medium: alternate history flavour | 2 | MV4 (the procedural look) |
| e. Generated worlds | a new planet per seed: continents, mountains, passes, climate, rivers, lakes, biomes, names | the highest: endless new maps | 10 to 15 (MV3 to MV5) | MV0, MV1 |
| f. Procedural Earth detail (optional) | Earth's level 6 and land cover replaced by low-res data plus procedural detail | repo size and download, not gameplay | 2 to 3 | MV4 |

### 2.1 Historical Earth (a)

Unchanged. It becomes the `kind: 'earth'` map spec (section 3.2) and is the default in the start
screen. Everything else is measured against it.

### 2.2 Shuffled Earth (b)

The real Earth, the baked raster, every Earth column unchanged. Only where the peoples stand moves.

- **Sites.** A per-game site table `scenario.sites = { [peopleId]: tile }` replaces
  `PEOPLES[id].tile` for the four readers (pickMajors, buildPeoplesStarts, pickIndependents,
  cityNames' neighbour lists) through one helper `siteOf(state | scenario, peopleId)` that falls
  back to the real tile. Historical Earth has no table and behaves exactly as today (state hash
  test).
- **Fair sites** (section 6.1): candidates scored by the fair start score, chosen with the 612 km
  gap among majors and the settle rule for independents.
- **Two modes.** *Climate-matched* (default): peoples are assigned to sites by affinity with their
  real homeland (Kemet near a river in a hot dry land, the Botai on a cold steppe). *Anywhere*:
  a seeded shuffle of the same fair sites.
- **Kept**: name, adjective, theme, palace, theme units, 20 city names, ruler (RULER-PLAN is map
  free), signature unit. The start screen line "Capital Kish, in modern Iraq" becomes "Starts in
  modern Norway" (the tile's country) on Shuffled Earth.
- **Towns** follow the culture zone, not the modern country (section 6.4, open question 3).
- Israel stays pinned (tried first after the player, keeps the gap, decision 13); on Shuffled
  Earth "Israel's land" for its national wonders is its start zone (section 6.4).

### 2.3 Earth variants (d)

**Mirrored and south-up (d1), exact.** The permutation `sigma` of tile ids is computed once from
lat/lon (mirror across 15 E: `lon -> 30 - lon`; south-up: `lat -> -lat, lon -> lon + 36`). The
columns are permuted; the 6-bit edge masks (`rivers`, `ridge`) and the 2-bit `riverSize` are
re-indexed through the neighbour order of the image cell; names and capitals move with their
tiles. The baked raster is not touched: `createRasterLayer` draws each source tile at the image
rectangle with a negative scale (a mirror) or a flipped V (south-up), and `hexLand` coordinates
are transformed the same way. Cost: one permutation at load (under 50 ms), no new images.
South-up keeps physical sense (climates follow latitude on both sides); a mirror moves the
Mediterranean climates to east coasts, which is fine for a game. Peoples: historical positions
mirrored, or Shuffled on top.

**Low seas and green Sahara (d2), procedural look.** Both edit Earth's columns at load:
- *Low seas*: every sea tile with mean elevation above -120 m becomes land (3,886 tiles);
  new land takes the climate of the nearest land tile shifted one step cooler, the classifier
  runs on it, the coast and `hexLand` are rebuilt, rivers are extended over the new land by the
  generator's corner drainage (MV3) from the old mouths. Ice sheets are left out by default (they
  would bury the homes of a third of the peoples; open question 6).
- *Green Sahara*: hot desert (BWh, BWk) between 12 and 32 N in Africa and Arabia becomes BSh or
  Aw by a smooth moisture field, mega-lakes fill closed basins (Chad, the Fezzan) by the
  generator's lake pass, wadis become rivers.
- The baked raster no longer matches the land, so both are painted by the procedural renderer
  (MV4) from the edited columns, using Earth's own elevation data where it exists (section 4.5).

### 2.4 Generated worlds (e)

A fictional planet per seed on the same grid. Parameters (all integers, all saved):

| Parameter | Values | Default | What it drives |
|---|---|---|---|
| `seed` | 32-bit | random at Begin | everything |
| `shape` | continents, pangaea, archipelago, islands, inland sea, earthlike | continents | plate count, continental share, noise weights |
| `land` | 20 to 45 (% of cells) | 30 (Earth: 29.25) | the sea level quantile; exact to 0.1 point |
| `continents` | auto, 1 to 7 | auto (from shape) | plates marked continental, merges |
| `temperature` | cold, temperate, hot | temperate | the temperature offset, ice caps, snow line |
| `rainfall` | dry, normal, wet | normal | moisture pickup and loss |
| `relief` | low, normal, high | normal | boundary uplift, ridged octave weight |
| `polarIce` | on, off | on | ice caps beyond about 70 degrees |

The generator is described in section 4. A generated world uses the world sizes as they are
(Small 24, Standard 36, Large 42 majors), the 612 km gap, the settle rule, independents and late
arrivals; the fair start pass makes the starts equal (decision 10).

### 2.5 Regional Earth maps (c)

A window of Earth with the peoples whose real capitals lie in it. Same grid, same baked raster.

- **Playable mask.** `tiles.playable` (a Uint8Array, all 1 on whole-world maps) marks the window.
  One predicate, `passableTile`, plus sight, settling, naval reach and the AI's target search read
  it; outside the window is drawn dimmed and never revealed. The camera is clamped to the window
  and east-west wrap is off (unless the window is a full band).
- **Peoples.** Majors and independents only from capitals inside the window (Mediterranean: the
  Europe, North Africa and Near East peoples there).
- **Density.** The window is small at 77 km hexes (1,274 to 2,757 land tiles for the classic
  regions). A region preset sets its own majors (6 to 12) and a smaller major gap (408 km to
  start with; the exact numbers are measured per region in MV7). Expect short, crowded games.
- A finer grid for regions (frequency 200 inside the window) would give Earth-like room, but it
  breaks the one-grid rule (its own tiles, raster and GPU data). Not in this plan (open question 7).

### 2.6 Effort and value in one line each

Shuffled Earth is the quick win; mirror and south-up are almost free once MV0 exists; generated
worlds carry the value and the cost; regional maps are cheap but small; low seas and the green
Sahara ride on the procedural renderer; the procedural Earth detail is a size optimisation.

## 3. Foundations: how a map is chosen, loaded and saved

### 3.1 One world per page load

The engine, the turn worker (`turn.worker.js`) and the battle worker (`battle.worker.js`) each
`await loadTiles()` before importing anything else. Rather than switching worlds inside a running
page (92 readers, 33 module caches), **the page boots into one world**:

- `loadTiles(spec)` takes the map spec. Earth: fetch `tiles.bin.gz` as today. Anything else: read
  the world's binary from IndexedDB (key below), or generate it in the worldgen worker and store
  it, then `setRawTiles`. Earth variants permute or edit the Earth binary after loading it.
- Starting or loading a game whose spec differs from the page's world writes the pending game to
  IndexedDB and reloads the page; boot reads the spec first. The cost is one reload behind the
  progress bar. The start screen's preview never touches the engine (it runs the generator in
  its own worker), so the start screen needs no reload.
- The workers load the same spec the same way (they read the IndexedDB entry the main thread
  wrote; no 5 MB copies between threads).
- Node (tests, `simulate.mjs`): `setRawTiles(generateWorld(spec).raw)` plus `resetWorldCaches()`
  for tests that switch worlds in one process; a test proves Earth, generated, Earth in one
  process gives the same state hashes as three fresh processes.

### 3.2 The map spec and the save

```
scenario.map = { kind: 'earth' }                                  // default, also when absent
             | { kind: 'earth', variant: 'mirror' | 'southup' | 'lowseas' | 'greensahara' }
             | { kind: 'earth', region: 'mediterranean' | ... }
             | { kind: 'generated', gen: 1, seed, shape, land, continents, temperature, rainfall, relief, polarIce }
scenario.siting = 'historical' | 'matched' | 'anywhere'
scenario.sites  = { [peopleId]: tile }                            // absent on Historical Earth
```

- The save holds only this. Never the columns, never the raster. On load the world is rebuilt
  from the spec (or read from the cache) and checked against `scenario.mapHash` (FNV-1a over the
  columns, stored at creation); a mismatch stops the load with a clear message instead of playing
  a silently different world.
- **Generator versions are frozen.** `gen: 1` names the generator. Any change that alters
  output bytes is a new version (`src/worldgen/v2/...`), and the old version stays in the code so
  old saves rebuild their world. Golden hashes per version guard it (section 8.1).
- Save version: the next free one after the ruler plan (v14). Old saves without `scenario.map`
  read as Historical Earth; no migration of data.
- The game seed stays hidden (roadmap decision 11). The map seed is separate and shareable
  (section 7.3).

### 3.3 Caching (IndexedDB, never git)

Key: `world:${specCanonical}:${genVersion}`. Value: the tiles binary (`encodeTiles`, gzip through
`CompressionStream`, about 1.5 to 2 MB), `hexLand` (about 0.6 MB, gzip about 0.2 MB), the names,
the quality report, the map hash, and the painted low levels (section 5.4, about 1 MB). About
3 to 4 MB a world; keep the last 3 worlds (LRU) plus any world a save points at. If storage is
denied (private mode) everything still works by regenerating. Capacitor builds use the WebView's
IndexedDB the same way.

### 3.4 Shared pure modules (so Earth and generated worlds use one rule set)

Move out of the Node scripts into `src/data/geo/` (pure, no fs):
- `classifyTile.js`: `TERRAIN, RELIEF, FEATURE, hash01, classify` (from build-tiles.mjs).
- `resourceScatter.js`: the hashed scatter (salted by the map seed off Earth).
- `terrainColumns.js`: ranges, ridges and passes (from build-tile-terrain.mjs, a pure function of
  the columns).
- `rasterLook.js`: `CLIMATE_COLOR`, the tint stops, `LIGHT`, the sea colours (from
  build-world-raster.mjs and `makeShadePixel`), read by the Node builds and the shader.
The Node scripts import them back. **Earth's tiles.json and tiles.bin.gz must stay byte
identical** (a test hashes both before and after the move).

## 4. Formula-driven worlds (the No Man's Sky question)

### 4.1 The idea

No Man's Sky stores no planets: a planet is a set of functions of (seed, position), evaluated only
where the camera looks, with more detail the closer it is. The same works here for everything
**local**. It does not work for things that depend on the whole world: a river's size is the
rain of everything upstream, a coastline decides which seas connect, fair starts compare every
site with every other. The plan splits the world in two:

| Part | How | Evaluated | Stored |
|---|---|---|---|
| **Formula layer** (local) | `f(seed, p, lod)` on the unit sphere: elevation detail, the painted colour, hillshade, land cover, vegetation scatter, close-view relief, sub-hex river meanders, the coast wobble | on demand, on the GPU (visuals) or in JS (battle ground) | nothing |
| **Global pass** (whole world) | plates, coarse elevation per hex, sea level by quantile, climate with winds, drainage and rivers on corners, lakes, continents, terrain columns, resources and their fairness, names, start sites, `hexLand` | once per seed, in a worker, in seconds | memory, IndexedDB cache; regenerated from the seed |

The global pass itself is formulas too: it samples the same continuous elevation function the
shader uses (at the hex level of detail), then runs graph passes over the 100,002 cells and their
200,000 corners. The shader then adds only detail **below** the hex scale, bounded so it can never
contradict the hex data (land stays land, a mountain hex stays high, a river stays on its edge).

### 4.2 The continuous functions (shared by the pass and the shader)

All on the unit sphere (3D noise, so no seam at the date line and no pinching at the poles).

- **Plates (the large shapes).** `P` plate seeds on the sphere (seeded; 8 to 40 by shape). A
  plate field is a warped Voronoi: the nearest seed after domain warping `p + w * noise3(p)`,
  so plate edges wander. Each plate has a type (continental or oceanic, chosen to reach the land
  target), a base height, and a motion vector tangent to the sphere.
- **Boundary terms.** At each point the two nearest plates and the distance to their boundary
  give convergent, divergent or transform motion. Convergent continental-continental: a broad
  high belt (Himalaya); continental-oceanic: a coastal range plus a trench (Andes); oceanic-
  oceanic: an island arc; divergent: a rift or a mid-ocean ridge. Each term is a profile of the
  boundary distance (`smoothstep` bands), so chains are long and connected, which is what makes
  ranges, ridges and passes look right.
- **Detail.** fBm (6 to 8 octaves) for rolling land, ridged multifractal weighted by the
  boundary uplift for sharp crests, domain warping for less regular shapes, an erosion-like
  term that softens slopes with distance from the uplift (cheap: a curvature-weighted blend,
  not a simulation).
- **Elevation** `e(p) = base(plate) + boundary(p) + detail(p, octaves)`, then shifted so the land
  quantile equals the land parameter. The sea-level shift is computed in the global pass and
  passed to the shader as one number.
- **Climate (formulas plus the pass).** Temperature = f(latitude, elevation lapse rate 6.5 C per
  km, the temperature parameter, continentality = distance to the sea). Winds by latitude band
  (trade easterlies to 30 degrees, westerlies 30 to 60, polar easterlies). Moisture is a pass
  (section 4.3) because it depends on what lies upwind.
- **Level of detail.** Octaves are added by zoom: world view (level 0 to 3) 4 octaves, level 4 to
  5 6 octaves, level 6 and the close view 8, the battle ground 9 (on the tile only). A pixel never
  evaluates octaves finer than itself, so cost tracks the screen, not the world.

### 4.3 The global pass, step by step (in the worldgen worker)

1. **Grid**: centres and neighbours come from the Earth grid (identical); corners from
   `edgeCorners`' rule (the three centres summed in id order, so every corner is bit identical).
2. **Plates**: each cell takes its plate from the warped Voronoi at its centre (integer noise).
3. **Elevation per cell**: 25 samples of `e(p)` inside the cell exactly like build-tiles.mjs, giving
   `elevMean, elevMax, rough`; pentagon cells (12) are kept at sea or away from starts.
4. **Sea level**: the quantile of `elevMean` that gives the land share; land = above it. Small
   specks are merged or drowned by the shape's rules (islands keeps them, pangaea removes them).
5. **Climate**: annual temperature per cell; moisture by an upwind march: for each cell, walk K
   steps (about 15, 1,150 km) against the prevailing wind over neighbours, picking moisture up
   over sea and warm sea, dropping it where the ground rises (orographic rain, so lee sides dry
   out: rain shadow), plus an equatorial belt and dry subtropical highs. Seasonality from latitude
   and continentality. A **Köppen class per cell** from temperature, precipitation and
   seasonality (west coasts at 30 to 45 degrees get the dry-summer Cs classes), using the same 30
   names as `climateNames`, so `classify`, `CLIMATE_COLOR` and land cover read it unchanged.
6. **Drainage on corners**: corner elevation = the mean of its three cells plus a small detail
   term; priority-flood depression filling (Barnes 2014, ties broken by corner id); filled
   depressions deeper or wider than a threshold become **lakes** (whole lake hexes, like Earth);
   endorheic basins in dry climates become salt lakes with no outlet. Flow direction to the
   lowest corner neighbour, accumulation weighted by the cell rain. A corner-to-corner segment is a
   cell edge, so a river segment sets bit k on both cells (the existing `rivers` format).
   Edges with accumulation over a threshold become rivers; size classes 1 to 3 by accumulation
   quantiles tuned to Earth's mix (river edges on 38% of land tiles at frequency 100).
7. **Classify**: `classify()` with synthetic region classes: `Range/mtn` on uplift belts,
   `Plateau` on high interiors, `Wetlands` and `Delta` at wet low river mouths; glaciated where the
   temperature and elevation say ice.
8. **Terrain columns**: `terrainColumns.js` (ranges, ridges, passes) unchanged.
9. **Resources**: the scatter (salted by the seed), then the strategic guarantee per start
   (section 6.1), with per-resource counts per land tile kept within 25% of Earth's.
10. **Names**: section 6.5.
11. **Coast**: `buildHexLand` on the new columns.
12. **Quality checks** (section 8.1). A failed check retries with attempt k + 1 (seed mixed with
    k), deterministic, at most 4 attempts, the attempt number saved in the hash.
13. **Starts**: candidate fair sites for the world sizes, kept in the cache (the people
    assignment runs in `createInitialState`, section 6).

### 4.4 Determinism

- **Rules-side (the global pass): integer hash noise.** Lattice values from an integer hash
  (`Math.imul` based, like `hash01` and the mulberry32 `createRng`), interpolation weights in
  fixed point (16.16 in Int32, the quintic fade in integer arithmetic), octave sums in Int32 with
  explicit shifts. Positions are the exact centres (`fromLatLonExact`) scaled to integers.
  Anything that still needs floats uses only + - * / and `Math.sqrt` (exactly rounded on every
  engine) and `exactMath.js` for trigonometry; never `Math.sin`, `cos`, `exp`, `log`, `pow` or
  `atan2`. Every sort has an id tie-break; priority queues break ties by id; no object key order
  is relied on.
- **Visual side: float GPU shaders**, free to differ in the last bit. They read the hex data and
  only add detail under the hex scale, so a visual difference can never change a rule.
- **Battles**: the tactical sim is fixed point already; battle ground from the tile stays in JS
  from the same integer functions, so a replay rebuilds the same field.
- **Tests**: golden hashes for 8 seeds x the 6 shapes per generator version in Vitest (V8), and
  the same hashes computed in a worker in Playwright on Chromium, Firefox and **WebKit** (the
  iPhone's engine); a debug panel in `/?worldLab` shows the hash for a quick check on a real phone.

### 4.5 What it would mean for Earth

Can the real Earth be "low-res data plus formulas"? Yes, partly. What Earth needs is real data
at some scale; formulas can add the scales below it.

| Option | Stored | Size | Look |
|---|---|---|---|
| Today | levels 0 to 6 baked, land cover baked | 48 MB in `public/map` (45 MB raster and cover) | the real relief down to about 1.2 km a pixel |
| A. Keep levels 0 to 5, procedural level 6 and land cover | tiles.bin.gz, levels 0 to 5 (14 MB) | about 16 MB (**saves about 32 MB, 67%**) | real relief to 2.4 km a pixel; finer ridges invented but consistent with the real ones; land cover from the hex data and climate formulas (it is already derived, not surveyed: build-raster-detail.mjs says so) |
| B. Low-res elevation plus formulas for everything | tiles.bin.gz, a 4096 x 2048 int16 elevation (lossless, about 5 to 7 MB), the Köppen grid (tiny), simplified river lines (about 1 MB), hexLand | about 8 to 10 MB (**saves about 80%**) | real shapes to about 10 km; mountain texture, valleys and coasts below that procedural; recognisable Earth, less "satellite photo" |
| C. Everything procedural from tiles.bin.gz only | 1.7 MB | **saves about 96%** | Earth's shape at 77 km, everything below invented; not the decided realistic look |

Recommendation (open question 8): keep the baked Earth as it is for now (it is the decided look
and it is done). After MV4, measure option A on Earth side by side with the baked level 6 (the
parity renders of section 8.4); if the user cannot tell them apart at close zoom, drop level 6
and the cover tiles (MV8). Option B only if the download size becomes a phone problem.

### 4.6 Quality risks and mitigations

| Risk | Mitigation |
|---|---|
| Repetitive noise ("every world looks alike") | plates and boundary profiles carry the large shapes, noise only the detail; domain warping; per-world random octave rotations; six shape presets with different plate counts; review sheets of 12 seeds per preset |
| Blobby continents, no peninsulas or gulfs | warped plate edges, a coast-scale noise band in the sea level test, island arcs on oceanic boundaries |
| Unrealistic rivers (parallel, too straight, uphill) | flow on corners over filled elevation, tie-breaks by a hash so straight runs break, meanders drawn under the hex by the shader; checks: all downhill, no cycles, every river ends in sea or a lake, mean river length and branching close to Earth's |
| Mountains as dots, not chains | uplift belts from boundaries; the ridged octave weighted by uplift; check: share of mountain tiles in ranges of 5+ tiles |
| Climate bands too regular | continentality, rain shadow, ocean warmth by latitude and by a coast-facing term, a seeded "monsoon" term |
| Starts unfair | the fair start pass with repairs (section 6.1) and balance-sim acceptance (section 8.2) |
| Poles stretched on the flat map | polar ice by default; no starts beyond 66 degrees; the generator keeps big land masses off the poles in most presets |

## 5. How a generated world becomes everything the game needs

| Need | Source on a generated world | Work |
|---|---|---|
| Tiles data | global pass, steps 1 to 9 | MV3 |
| `hexLand` coast | `buildHexLand` in the worker (measure its time on the full land; if over 1 s on a phone, chain boundary edges directly, which the hex coast already is, and keep `polygon-clipping` out of the worker) | MV3 |
| River edges and sizes | corner drainage, step 6 | MV3 |
| Ranges, ridges, passes | `terrainColumns.js` | MV3 |
| Footprints (town, fields, road and river bands) | `footprints.js` is pure over tiles and terrainData: works unchanged | none |
| Battle maps | `tileContext.js` and `mapgen.js` read columns: unchanged; the close relief inside a battle can use the formula layer later | none |
| Research boosts | facts from resources, rivers, coast, forest, hills: present; the fairness pass makes copper, horses and iron reachable for every major | MV3, MV5 |
| Start sites | fair site pass (section 6.1) | MV1 (code), MV5 (generated) |
| Independents and late arrivals | the remaining fair sites with the settle rule; late arrivals get sites that stay empty until their year | MV5 |
| Names | section 6.5 | MV3 |
| Fog | `sight.js` and the fog field read tiles: unchanged | none |
| Minimap | the generated 2048 base picture (section 5.4) instead of `world-2048.webp` | MV4 |
| Globe (hidden by default) | the same base picture as its texture | MV4 |
| Saves | spec plus hash only (section 3.2) | MV0 |
| Edge function (`supabase/functions/resolve-turn`) | it bundles Earth's tiles; for a generated world the bundle includes the (pure, DOM-free) generator and caches worlds per spec in the instance; or generated games stay local-only until it matters (open question 9) | MV5 |

### 5.1 The painted surface: the procedural renderer

The look is the decided one: realistic Earth style, hexes only as a faint overlay. The renderer is
`makeShadePixel` moved to the GPU:

- **Input textures** (built once per world, small): the per-tile textures the territory shader
  already has (`tileGpuData.js`: centres, neighbours, the lookup grid) plus one RGBA8 texel per
  tile: Köppen class, elevation band, relief, feature, river bits, river sizes (packed), and one
  float texel for the mean elevation. About 1 MB.
- **Per pixel**: find the tile (the same walk the territory shader does), interpolate the coarse
  elevation across the corner triangle, add the formula detail for this level, clamp it so the
  hex keeps its class (a flat hex never shows a peak), take the climate colour from the
  `rasterLook.js` table blended toward the neighbours' classes near the edge (the 1.5 degree blur
  the Earth build uses), the hypsometric tints, the snow line `5400 - |lat| * 40` m, hillshade
  from the derivative (three extra detail evaluations), bathymetry by depth, the 4% grain.
- **Coast**: the land mask is the tile's land flag with the hex coast rule: signed distance to
  the boundary edges between land and sea hexes, corners rounded by a smooth minimum (what two
  Chaikin passes do) and the same 4 km wobble (`coastNoise`), so the paint and `hexLand` agree.
- **Rivers**: for each of the tile's six edges with a river bit, distance to that edge (corner to
  corner), bent by a meander noise and joined smoothly at corners; width by size class like
  `river-paint.mjs` (wider downstream); never crossing into the next hex.
- **Land cover output**: a second render target with the `LAND_COVER` class index, so the close
  view's terrain shader (`terrainShader.js`, `uCover`) works as on Earth.

### 5.2 Where it runs

Into 256-pixel tiles of the existing pyramid layout (`rasterTiles.js`: level z = 2^(z+1) x 2^z
tiles), rendered to textures on demand by the map's own WebGL context and handed to
`createRasterLayer` through a **raster source** interface: `{ tile(z, x, y) -> Promise<Texture>,
cover(z, x, y), base(size) }`, with an URL source (Earth) and a procedural source (generated and
edited worlds). The layer code that places, falls back and evicts stays as it is.

### 5.3 Budgets for the shader (mid phone: an Adreno 6xx or Apple A14 class GPU)

| Item | Estimate | Budget |
|---|---|---|
| Cost per pixel | the tile walk (3 steps), about 30 to 40 noise evaluations at level 5 to 6 (detail plus 3 for the slope), 6 edge distances: about 1,500 to 2,500 ALU ops | |
| One 256 x 256 tile | 65,536 pixels: about 2 to 6 ms on a mid phone | 8 ms; render at most one tile per frame while panning, more while idle |
| World levels 0 to 3 | 2 + 8 + 32 + 128 = 170 tiles: about 0.5 to 1 s | at world creation, behind the progress bar, then cached |
| The 2048 base picture and globe texture | read back from level 3 | under 0.3 s |
| Levels 4 to 6 | on demand: a phone screen at 844 x 390 needs 8 to 24 tiles | first view of an area under 150 ms |
| GPU memory | 256 KB a tile; LRU of 96 tiles on phones (24 MB), 256 on desktop | as today's pyramid cache |
| Drawing the map every frame from formulas instead of tiles | 844 x 390 x dpr 3 is 3 M pixels x 2,000 ops each frame: too much for a phone | rejected: render to tiles once, draw tiles |

Fallback for weak GPUs: render in the worldgen worker with an `OffscreenCanvas` WebGL2 context
(Safari 17+), or on the CPU at levels 0 to 3 only (about 100 ms a tile in JS) with level 4 and up
shown magnified.

### 5.4 Cached pictures

Levels 0 to 3 (and the 2048 base) are encoded once with `convertToBlob('image/webp')` in the
worker and stored with the world in IndexedDB (about 1 MB), so a reload shows the world at once.
Levels 4 to 6 are never stored; they are cheaper to re-render than to keep.

### 5.5 The close view

Towns, fields, roads and river bands come from `footprints.js`; 3D ridges and mountain models from
`range` and `ridge` (`terrainPlacement.js`, `mountainModels.js`); land cover from the cover target.
All read tile data, so they work unchanged. The close terrain shader's relief comes from the same
formula layer at 8 octaves, so the 3D ground and the painted ground agree.

## 6. Peoples on non-historical maps

### 6.1 Fair start score and the site pass

`startScore(tile)` builds on `settlers.js siteQuality` (food x 1.2 + production + gold of the tile
and ring 1, +3 resource, +2 river, +1.5 coast) and widens it:

- yields of rings 1 to 3 (the city's working area), fresh water (river or lake), coast;
- strategic reach: copper or iron within 6 rings, horses within 8, a luxury within 4;
- room: legal city sites (306 km rule) reachable over land within 800 km, counting at most 6;
- penalties: more than half of ring 1 to 3 desert, tundra, snow or mountains; a pentagon cell.

The pass: keep candidates above a quality floor (the 30th percentile of land); pick major sites
greedily by score with the 612 km gap and a farthest-point tie-break, then **repair**: a site
short of a strategic resource gets one placed on a suitable tile in reach (the scatter's own
terrain options, chosen by hash), a site short of food gets a forest or marsh hex in ring 1 to 2
turned to grassland or floodplain. The spread target: every major's score within 15% of the
median. Independents take the next sites with the settle rule (no gap from majors beyond it).
Shuffled Earth uses the same pass (repairs on Earth limited to resources: Earth's land is not
edited).

### 6.2 Affinity

`npm run build:peoples` adds a **home profile** per people from its real capital tile: Köppen
class, terrain, relief, feature, coastal, river, latitude band. Each Köppen class maps to a small
prototype (annual temperature, rain, seasonality), so `affinity(site, people)` = 1 - the
normalised distance of the prototypes, plus coast and river matches. Assignment: the player's
people first (its best-affinity fair site), then the rest by the Hungarian method on the
majors x sites table (36 x 36 is instant; deterministic tie-breaks), then independents greedily.
"Anywhere" mode: a seeded shuffle instead.

### 6.3 Signature units with terrain needs

Signature units are art and a role today; their rules are phase SU. The camel peoples (Saba,
Kindah, Qedar) and the elephant peoples (Magadha, Kalinga, Kamarupa, Champa) get a stronger weight
on affinity (camels prefer B climates, elephants A and Cw), so they land where their unit makes
sense whenever such land exists. When a world has none (a cold world), the unit still works:
there is no requirement to break. If SU later gives a unit a resource need (horses, for example),
the repair step of 6.1 places that resource near the people's start on non-historical maps.

### 6.4 Art follows the land: culture zones

On Historical Earth towns follow the modern country, as decided. Elsewhere there is no modern
country, so the land gets a **culture zone**: every land tile belongs to the start (major or
independent) nearest by travel cost at world creation, and `landOf(tile)` returns that people's id
(`styleOfLand` already accepts a people id). It is derived from the spec and the sites, never
saved, and fixed for the game, so a conquered town keeps its look, as on Earth. The same lookup
answers the national wonders' `homeland` ("Israel's land" = Israel's zone). Late arrivals take
over the zone of their site from their year.

### 6.5 Names

- Cities keep the people's 20 names, then the nearest absent peoples' lists, then syllables
  (`cityNames.js`, unchanged apart from `siteOf`).
- Map features get generated names: 8 built-in syllable sets (phonologies), one per continent or
  large island by seed; rivers named per drainage basin (main stems of size 2 or more), ranges
  per range, notable hexes (passes, river mouths, oases, lakes, capes) about one land tile in five
  like Earth's `names`. A blocklist filter on the output. Names depend on the map only, so a map
  code always gives the same names.
- "In modern Iraq" lines are hidden off Earth; the people card shows "Home: hot river valley"
  from the home profile.
- Event texts mention Earth ("from the steppes to the western ocean"): harmless flavour; a later
  text pass may neutralise a few.

### 6.6 Rulers

Unchanged: the ruler plan has no map dependency.

## 7. UI

### 7.1 W01 start screen

The first column gets a **Map** block above World size (one row of rounded radio cards, like the
world size cards, scrolling sideways at 844 x 390):

- **Earth** (default) and **Shuffled Earth**; later **Generated**, **Region**, **Variants** (a small
  chip row inside Earth: Mirror, South up, Low seas, Green Sahara).
- Shuffled Earth: a two-chip toggle "Climate matched / Anywhere".
- Generated: a preview thumbnail (about 256 x 128, drawn from the generated tile colours, in the
  third column where the people preview sits on a phone), shape chips (Continents, Pangaea,
  Archipelago, Islands), a Land slider (20 to 45%), Climate chips (Cold, Temperate, Hot), a "New
  map" button (rerolls the map seed) and the map code. "More" opens a sheet: continents, rainfall,
  relief, polar ice, and a field to paste a map code.
- The preview runs the real generator in a worker (debounced, the old job cancelled), shows the
  coarse land after about a third of the time and the finished world after; the result is cached
  so Begin starts at once.
- Region: a region card list with its majors count.
- The people picker on non-historical maps hides "in modern X" and shows the home profile.

### 7.2 W12 settings and W17 overview

A **Map** card: type, parameters, land %, continents, generator version, the map code with Copy.
Settings also gets "Clear cached worlds" with the size used.

### 7.3 Sharing a seed

A **map code** such as `G1-C30T-7KX2QF` (generator version, shape, land, temperature, and the
seed in base 32) encodes the whole spec. It is separate from the game seed, which stays hidden
(decision 11 stands for the AI's rolls). `?map=CODE` in the URL prefills the start screen. Two
players with the same map code get the same world; the peoples and AI differ unless they also
pick the same people and world size (the game seed still differs).

## 8. Validation

### 8.1 Generator quality checks (in the generator, every world)

Land share within 0.5 point of the parameter; continents (landmasses of 300+ tiles) within the
shape's range; largest landmass share within the shape's range; mountains 5 to 12% of land and
80% of them in ranges of 5+ tiles; river edges on 30 to 45% of land tiles; every river downhill,
no cycles, every river ends in sea or lake; lakes under 3% of land; no Köppen group over 45% of
land; desert under 25%; tundra plus snow under 25% (cold worlds 40%); oceans connected apart from
inland seas; enough fair sites for Large (42 majors) plus 60 independents; every major site on a
landmass of at least 150 tiles or coastal; no start beyond 66 degrees. Golden hashes per
generator version (8 seeds x 6 shapes) in Vitest; cross-engine hashes in Playwright (Chromium,
Firefox, WebKit).

### 8.2 Balance-sim on generated worlds

`scripts/simulate.mjs --map generated:<seed>:<shape>` (and `--map shuffled`). 20 seeds per preset,
Standard size, 200 turns, battles on Auto, compared with 20 Earth seeds:
- per major at turns 100 and 200: cities, population, score; their median, spread (IQR and Gini)
  and the share of majors eliminated;
- acceptance: the Gini of cities across majors within 20% of Earth's; elimination rate within 5
  points; no major below 3 cities at turn 100 unless it lost a war (the sim's war log says);
- AI settling rate, wars, ms per turn (compare.sh against the base commit on the same machine).

### 8.3 Performance benchmarks

`node scripts/worldgen/bench.mjs` (the global pass per stage, per preset); a Playwright run with
4x CPU throttling for the worker and the first map view; the real phone through the GitHub Pages
build behind `/?worldLab` (the user's iPhone; LAN access is blocked by the firewall, so the
deployed build is the route).

| Budget | Desktop | Mid phone |
|---|---|---|
| Global pass (tiles, terrain, coast, names, sites) | under 1.5 s | **under 5 s**, with a progress bar per stage |
| Levels 0 to 3 painted | under 0.3 s | under 1 s |
| Reload of a cached world | under 0.3 s | under 0.8 s |
| Worker peak memory | under 80 MB | under 80 MB |
| Main thread memory for the world | as Earth today (columns about 5 MB plus the decorated grid) | same |
| IndexedDB per world | about 3 to 4 MB | same, 3 worlds kept |
| Committed to git | 0 bytes of generated data | |

### 8.4 Visual checks

`/?worldLab`: a sheet of 12 seeds per preset (thumbnails, hashes, the quality report), a toggle
for the hex overlay, rivers and plates. `scripts/perf/map-shots.mjs --map <code>`: screenshots at
world, region and close zoom for 4 seeds per preset at 844 x 390 and desktop, kept out of git
(small selections only into `plans/images/`). Parity: the procedural renderer fed with Earth's own
columns and real elevation, side by side with the baked pyramid at levels 3, 5 and 6.

## 9. Rollout

| Step | What | Sessions | Depends on |
|---|---|---|---|
| **MV0** | Foundations: map spec in `scenario.map`, save v14, `loadTiles(spec)` and boot into one world, reload on a world change, `resetWorldCaches` for Node, shared pure modules (3.4) with Earth byte identical, the raster source interface in `glLayers`, `siteOf` and `landOf` lookups, `tiles.playable` (all 1) | 2 to 3 | none |
| **MV1** | Shuffled Earth: home profiles in build:peoples, fair start score and site pass, affinity assignment, culture zones, start screen Map block (Earth / Shuffled), balance-sim Shuffled vs Historical | 2 | MV0 |
| **MV2** | Mirror and south-up Earth: permutation, edge re-indexing, mirrored raster placement, hexLand transform | 1 | MV0 |
| **MV3** | Generator core (data): integer noise, plates, elevation, sea level, climate and Köppen, corner drainage, lakes, classify, terrain columns, resources and repairs, names, hexLand in the worker, quality checks, IndexedDB cache, golden and cross-engine hashes, `/?worldLab` with tile-colour previews | 4 to 6 | MV0 |
| **MV4** | Procedural look: the GPU renderer for levels 0 to 6 and land cover, coast and river paint, base picture, minimap and globe texture, caching of levels 0 to 3, parity renders against baked Earth, phone benchmarks | 3 to 5 | MV3 |
| **MV5** | Generated worlds playable and shipped: peoples, independents and late arrivals on generated sites, start screen Generated block with preview and map code, W12/W17 map card, balance-sim acceptance, e2e on a generated world, the edge function decision | 2 to 3 | MV1, MV4 |
| **MV6** | Low seas and green Sahara (Earth edits, painted by MV4) | 2 | MV3, MV4 |
| **MV7** | Regional maps: playable mask in the engine readers, camera bounds, region presets with measured majors and gap, peoples by window | 2 to 3 | MV1 |
| **MV8** (optional) | Procedural Earth detail: option A of 4.5 if the parity check passes (drops about 32 MB) | 2 to 3 | MV4 |

Totals: Shuffled Earth ships after about 4 to 5 sessions (MV0, MV1); generated worlds after about
13 to 20 (MV0 to MV5); everything about 20 to 29.

**Recommended order**: MV0, MV1 (the quick win: new political maps every game with no art
work), MV2 (almost free, rides on MV0), then MV3, MV4, MV5 (generated worlds, shipped only with
the procedural look, never with a debug look), then MV6, MV7, and MV8 if wanted. MV3 can start
right after MV0, in parallel with MV1 and MV2. MV7 is cheap but its maps are small; it waits.

Branches: each step on its own branch from `claude/integration`, merged when the user asks.

**Risks**:
- Hidden Earth assumptions (92 grid readers, 33 module caches): mitigated by booting into one
  world per page and the switch test in Node.
- Cross-engine drift in the global pass: integer noise, exact arithmetic only, WebKit hash test.
- Generator changes breaking old saves: frozen versions and golden hashes.
- Phone GPU cost of the renderer: render to tiles, one tile per frame, the CPU fallback.
- Fairness on strange worlds (one huge continent, tiny islands): the site pass with repairs and
  the balance-sim acceptance before shipping.
- Worlds that look samey: plates for large shapes, review sheets per preset.
- The start screen at 844 x 390 gets busier: the Map block is one row, the details live in a sheet.

## 10. Open questions for the user (with a recommendation each)

1. **Shuffled Earth first?** Recommend yes: it is the quick win and its site and affinity code is
   reused by every other map type.
2. **Climate-matched by default on Shuffled Earth?** Recommend yes, with "Anywhere" as the second
   chip.
3. **Towns on non-historical maps follow the culture zone of the nearest start, not the modern
   country?** Recommend yes on Shuffled Earth and generated worlds (the modern country means
   nothing when Akkad starts in Norway); Historical Earth keeps the modern country.
4. **Show a map code** (separate from the hidden game seed, decision 11)? Recommend yes, for
   generated worlds and shuffled maps; the game seed stays hidden.
5. **Ship generated worlds only with the procedural look** (no interim flat-colour map)?
   Recommend yes; the debug look lives only in `/?worldLab`.
6. **Low seas without ice sheets?** Recommend yes (ice sheets on Europe and North America would
   bury many peoples' homes at a 2000 BCE start); an "Ice Age" with sheets could be a later
   variant for a fully generated or shuffled start.
7. **Regional maps on the same 77 km grid** (small, crowded, short games) rather than a finer
   regional grid? Recommend yes; a finer grid is a separate project.
8. **Should Earth also move to "low-res data plus procedural detail"?** Recommend: not now. After
   MV4, compare procedural level 6 and land cover against the baked ones on Earth; if they read
   the same, drop them (about 32 MB, 67% of the map's weight). Full procedural Earth (option B,
   about 80% smaller) only if download size becomes a phone problem, because it gives up the real
   relief below about 10 km.
9. **The online edge function and generated worlds**: bundle the generator there (it is pure) or
   keep generated games local until online play needs them? Recommend local first, bundle when
   the edge function is used for real.
10. **A planet size option** (fewer or more cells)? Recommend no: the one grid keeps the rules,
    GPU data and pyramid unchanged; world size stays the peoples count and the land share.
