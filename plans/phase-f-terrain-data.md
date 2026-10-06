# Phase F, the data half: terrain, mountains, rivers (integration note)

Branch `claude/phase-f-terrain-data`, 2026-10-06. Master plan phase F (section 7, row 14) and 6.9,
world art plan sections 3 to 6. This branch adds DATA and small read APIs only; nothing here draws.
The rendering half lands on the one-canvas WebGL map (phase A2, `claude/phase-a2-webgl-map`).

## 1. What is in the grid now

`scripts/geo/build-tile-terrain.mjs` (run by `npm run build:tiles`, or alone with
`npm run build:terrain`) adds four columns to `src/data/geo/tiles.json` and `public/map/tiles.bin.gz`.
Every older column is byte-identical; the river mask `rivers` is unchanged.

| Column | Type | Meaning |
|---|---|---|
| `riverSize` | Uint16 per tile | 2 bits per edge k (the edge to `neighbors[k]`): 0 none, 1 stream, 2 river, 3 great river. From Natural Earth 1:10M `scalerank` (0 to 2 great, 3 to 5 river, 6 to 8 stream) |
| `range` | Int16 per tile | the mountain range of a mountain tile (-1 elsewhere); `rangeNames`, `rangeSizes` |
| `ridge` | Uint8 per tile | bit k: a ridge line runs to `neighbors[k]` (each range's maximum spanning forest by elevation, one chain along the crest) |
| `pass` | Uint8 per tile | 1 on a mountain pass (a mountain tile joining two lowlands that is lower than its mountain neighbours) |

Counts: 14,674 river edges (9,483 streams, 3,743 rivers, 1,448 great rivers); 4,019 mountain tiles in
172 connected masses, split by Natural Earth's named ranges into 269 ranges (209 named: Alps, Andes,
Himalayas, Zagros...); 173 passes (for example the Pyrenees near Somport and Perpignan, the Alps near
the Col de Tende). The binary grew from 1,709 kB to 1,737 kB gzipped; tiles.json from 8.18 MB to 9.12 MB.

## 2. Read APIs (`src/data/geo/terrainData.js`)

All pure; `tiles` defaults to the loaded grid. Edge index k is the edge shared with `neighbors[k]`.

- `riverEdgesOf(tile)` -> `[{ k, neighbour, size }]`; `riverSizeAt(tile)`; `riverSizeBetween(a, b)`.
- `riverEdgeList()` -> every river edge once `{ a, b, size }` (cached per grid).
- `edgeCorners(tile, k)` -> the edge's two corners `{ a, b }` (unit vectors) and `{ from, to }`
  (lat/lon). Both tiles of an edge get bit-identical points, so rivers join across cells.
- `crossingsOf(tile, state)` -> `[{ k, neighbour, size, fords, bridge }]`: fords by size
  (`FORDS_BY_SIZE` 3 / 2 / 1) and a bridge where a road runs on both banks.
- `roadEdgesOf(tile, state)` -> neighbours joined by a road edge.
- `rangeOf(tile)` -> `{ id, name, size }`; `mountainRanges()`; `ridgeEdgesOf(tile)`; `isPass(tile)`;
  `reliefClassOf(tile)` -> 'flat' | 'hills' | 'pass' | 'mountains'.
- `tileTerrainDescriptor(tile, state)` -> the geography half of the world plan's
  `TileVisualDescriptor` (section 7): terrain, relief, feature, climate, elevation, roughness and the
  per-edge arrays `waterEdges`, `riverEdges`, `roadEdges`, `ridgeEdges`, plus range, pass, river name.

`tiles.riverSizeBetween(a, b)` and `tiles.isPass(t)` are also on the grid object (tiles.js).

## 3. Rules that read it

- **Movement** (`src/engine/armies.js`): a river crossing costs `RIVER_CROSSING_KM` of march by size
  (38 / 77 / 154 km: 0.5 / 1 / 2 points at frequency 100), half on a road edge; with Stone Bridges a
  road edge is free and any other crossing half. A pass costs as hills instead of the mountain cost
  (the mountain branch is replaced, never added to). The AI plans with the same costs
  (`findTilePath`), now with its own techs (aiOperations.js), as its march pays them. Balance (8 seeds x 150 turns, PLAYER=au, paired): no significant change; wars,
  conquests, settling (cities, land claimed) all within noise.
- **Battles** (`src/battle/setup/tileContext.js`, `mapgen.js`): each sector carries `riverSize`,
  `fords`, `bridge`; the river band is as wide as the river (3 / 5 / 8 field tiles), with its
  fords, and a road-tile bridge in the middle where a road crosses. The auto-resolve scales river
  odds by size (`riverAttackAdjust`, battleType.js) to keep parity (battle-lab parity,
  `RIVER_SIZES=1,2,3`). The map stays a pure function of the tile (same two random draws per river).

## 4. For the WebGL map (A2) to pick up

1. **Rivers**: draw from `riverEdgeList()` + `edgeCorners`. Either along hex edges (Civ style) or as a
   smooth line through edge midpoints; width by `size`. Natural Earth lines stay for far zooms (the
   raster already has them). Bridges: `crossingsOf(tile, state)` where `bridge` is true.
2. **Mountains**: one chain per range along `ridgeEdgesOf` (orient ridge meshes along those edges),
   lower and gapped on `isPass` tiles; foothills on hills tiles next to a range. Never one
   disconnected mountain model per tile (world plan 5).
3. **Raster detail**: level 6 and land cover tiles (section 5 below) through `src/data/geo/rasterDetail.js`.
4. **Descriptor**: `tileTerrainDescriptor` is the per-tile input for close-view chunks and for the
   battle map; extend it there rather than reading columns ad hoc.

## 5. Raster: level 6 and land cover

`scripts/geo/build-raster-detail.mjs` (`npm run build:raster-detail`, after
`node scripts/geo/fetch-tiles-raw.mjs --detail`) adds files next to the pyramid; levels 0 to 5 and
`meta.json` are untouched, so today's renderer is unaffected.

- `public/map/tiles/6/{x}-{y}.webp`: level 6 (32,768 x 16,384, about 1.2 km a pixel), land tiles
  only. Same look as the pyramid (its `makeShadePixel`), hillshade from zoom-7 elevation (about
  1.2 km) under land within 72 degrees of the equator, so ridges and valleys are real at close
  zoom. Open sea and the poles stay at level 5.
- `public/map/cover/{5,6}/{x}-{y}.png`: one land cover byte a pixel (`LAND_COVER`: water, ice,
  rock, desert, steppe, grassland, forest, rainforest, tundra, wetland, irrigated) for the
  close-view shader's detail patterns. Derived, not surveyed: Köppen climate, the game's own hex
  features (a forest hex shows forest; edges warped by smooth noise so they are not hexagons),
  Natural Earth glaciers, snow and tree lines from the elevation. ESA WorldCover is the upgrade
  (it would replace `classifyCover` only).
- `public/map/tiles/detail.json`: which tiles exist. `src/data/geo/rasterDetail.js`:
  `loadDetailIndex()`, `bestColourTile(index, z, x, y)` (the tile to draw and the part of an
  ancestor to use where a level 6 tile is missing), `coverTileUrl`, `LAND_COVER`.
- Sizes (bytes on disk): level 6, 2,660 tiles, 13.5 MB (about 5 kB a tile); cover level 5,
  1,044 tiles, 1.2 MB; cover level 6, 2,660 tiles, 3.3 MB; manifest 50 kB. A phone screen at
  level 6 shows about 20 to 40 tiles: 100 to 200 kB, fetched only when zoomed in that far. Raw
  input: 3,931 zoom-7 elevation tiles, 236 MB (gitignored). The build takes about 10 minutes.
- Level 7 is NOT built: it needs zoom-8 elevation to be worth it (about 15,000 tiles, 1.2 GB raw)
  and would add about four times level 6's size. Decide after A2 shows level 6 on a phone.

## 6. Footprints (`src/data/geo/footprints.js`)

World art plan section 4 as data in local km (x east, y north of the tile centre; gnomonic, so
edges stay straight), never pixels:
- `cellPolygonKm(tile)` (corner k between neighbours k and k+1; `edgeOf(poly, k)` is the edge to
  neighbour k), `insetPolygon`, `insideDistance`, `pointInPolygon`, `localFrame(tile).toLocal`.
- `tileFootprint(tile, state)` -> `{ cell, safe (inset SAFE_INSET = 8% of the width), apothemKm,
  rivers: [{ k, size, a, b, bandKm }], roads: [{ k, from, to, widthKm, bridge }], town: { radiusKm }
  (by city size, at most 40% of the way to the nearest edge), fields: [{ id, poly }] }`. Fields sit
  around a city's town or across a farm tile, fully inside the safe area, clear of the town, roads,
  river bands and each other; seeded by the tile id, so the same tile is always the same layout.
- The renderer places town models, fields and trees inside these polygons and reserves the river
  and road bands before vegetation. Districts that spill into owned neighbour tiles (world plan 4)
  are the next step, with the city manifest (phase B).

## 7. Not done here
- HydroRIVERS (flow-based, many more tributaries): the global file is about 1.5 GB; Natural Earth
  1:10M stays the source of river edges. The size classes would come from discharge instead.
- Forts on the battle map, field-battle ZOC from forts (6.9): rules work, not data.
