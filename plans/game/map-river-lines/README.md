# Map rivers as vector lines

Branch `claude/map-river-lines` (from `claude/integration`). Not merged.

## Why

Painting the rivers into the Earth raster (plans/game/map-rivers-trial) hit its limit: faint pale
wires at the middle zoom, a wide, jagged, too blue band at the close zoom (level 6 is 1.2 km a
pixel) and nothing at the world zoom. The rivers are now real vector lines drawn by the WebGL map
over the raster, crisp at every zoom, and the raster carries no rivers (no double rivers).

## Data: `public/map/rivers.bin.gz` (`npm run build:rivers`)

`scripts/geo/build-river-lines.mjs`, from Natural Earth 1:10M `rivers_lake_centerlines_scale_rank`
(public domain, in CREDITS.md; `npm run fetch:tiles` fetches it). A few seconds.

- 4,212 reaches (ranks 0 to 10, lake centerlines kept so rivers run on through lakes too small to be
  water hexes; canals dropped) become 4,201 pieces on land, 163,251 points.
- Width: Natural Earth's `strokeweig` (0.15 a stream to 2 the Nile at the delta). Each reach end
  takes the mean with the next reach of the same river (`rivernum`), so the width ramps instead of
  stepping; a free end inland is a source and narrows to 30 % (2,004 sources).
- Land only: every reach is cut by the hex coast (`src/data/geo/hexLand.json`, point in polygon,
  the coast crossing found by bisection), so rivers end at the coast and never cross the sea or a
  lake hex.
- Detail: Douglas-Peucker in km gives each point the coarsest of four bands it is kept in
  (3, 1, 0.45, 0.28 km), so one file serves every zoom.
- Format (`src/data/geo/riverCodec.js`): varint deltas at 1/1000 degree, 2 bits of band a point,
  rank and the two end weights a reach. **426,104 bytes raw, 385,890 bytes gzipped** (budget 400 KB).
  Loaded once by `src/data/geo/riverLines.js` (fetch in the browser, from disk in Node). A
  generated world has no river file and draws none.

## Drawing (`src/components/map/gl/riverModel.js`, `riverLayer.js`, wired in `GLMapView.jsx`)

- In the terrain pass: over the raster, under the mountain sprites, the territories and the fog
  (unexplored hidden, explored dimmed like the terrain, for free). One draw call.
- Each reach is one triangle strip (mitred joins, so a river never overlaps itself); the fragment
  shader anti-aliases from the distance across and draws a muted river blue core with a faint
  darker edge. Where reaches meet, the most covered pixel wins through the depth test, so
  confluences have no beads. Points stay in lon/lat and the projection is in the shader: a pan or a
  zoom only changes uniforms. Each reach is drawn at the world copy nearest the view (the wrap).
- Fade in by rank (`RIVER_FADE_K`): ranks 0 to 4 at the world zoom (Nile, Tigris, Euphrates,
  Indus, Ganges, Yangtze, Yellow, Mekong, Danube, Rhine, Volga, Mississippi, Amazon, Niger, Congo),
  then smaller ranks up to rank 10 by k 42. Smaller rivers also get a little less ink.
- Width (`riverWidthPx`, the same formula in the shader): a map width
  `(0.35 + 1.5 w^0.6) (k/3)^0.3` px, at least the real width `0.08 + 0.55 w` km once that is
  wider, never more than `3 + 7 sqrt(w)` px. `w` is the weight plus a small boost for low ranks
  (Natural Earth weighs the Rhine and the Tigris like streams). The Nile at the delta is about
  2.6 px at k 3 and 6 px at k 40 (desktop), not the raster's 10 km band.
- Detail bands (`RIVER_BANDS`): the world band (k < 4.5, ranks 0 to 5) is built once for the
  whole world; the closer bands (k 4.5, 14, 60) for the settled view plus a screen round it, with
  Chaikin corner cutting (1 or 2 rounds) for smooth curves.
- Close view: the bands kept clear of trees and fields now follow these lines
  (`closeView/terrainPlacement.js riverDiscsOnScreen` over `riverModel.riverDiscs`), claimed
  before the fields, so the same course everywhere.
- The old hex-edge river code (phase F2) is gone from `gl/terrainModel.js`.

## Raster without rivers

`scripts/geo/river-paint.mjs`: `PAINT_RIVERS = false` (the loader stays for the check below and for
a trial). Rebuilt the whole raster: `npm run build:raster` (world-4096 and world-2048),
`build:pyramid` (levels 0 to 5, 232 s), `build:raster-detail` (level 6, 332 s); land cover tiles
and `detail.json` unchanged. 2,376 files under `public/map`; the tiles got smaller
(public/map: 27,532,998 bytes before, 25,329,626 after, river file included).

## Gameplay match (`node scripts/geo/check-river-match.mjs --box ...`, within 45 km)

The check now reads the drawn lines (`--painted` for the old raster painting). Tiles, hexLand and
the river rules are unchanged.

| region | gameplay edges matched | great edges | drawn rank 0-6 points near an edge |
| --- | --- | --- | --- |
| Levant, Mesopotamia, Nile (27,21,51,39) | 97.6 % | 100 % | 97.3 % |
| Rhine, Danube (3,42,31,53) | 90.3 % | 98.5 % | 99.9 % |
| Mississippi (-100,28,-85,45) | 97.2 % | 94.2 % | 99.6 % |
| Yangtze (100,22,122,34) | 98.5 % | 99.1 % | 100 % |
| Ganges, Indus (70,20,92,30) | 95.5 % | 87.5 % | 99.2 % |
| whole world | 93.6 % | 93.2 % | 98.6 % |

## Speed (`node scripts/perf/map-pan.mjs --gpu --explored`)

This sandbox has no GPU: `--gpu` still runs Chromium on SwiftShader (software WebGL), where every
frame takes 100 ms or more and the run to run noise is tens of ms (other jobs share the machine).
Frame p90 / max ms while panning, explored world, same machine:

| profile | k | before (integration) | after, lines on | after, lines off (`--no-rivers`, same build) |
| --- | --- | --- | --- | --- |
| desktop | 1 | 150 / 150 | 167 / 167 | 167 / 167 |
| desktop | 4 | 200 / 200 | 200 / 217 | 200 / 200 |
| desktop | 12 | 100 / 117 | 117 / 117 | 100 / 117 |
| desktop | 40 | 1417 / 1417 | 1433 / 1433 | 1550 / 1550 |
| phone | 1 | 150 / 150 | 167 / 167 | 183 / 183 |
| phone | 4 | 183 / 200 | 233 / 267 | 200 / 300 |
| phone | 12 | 117 / 117 | 183 / 217 | 150 / 150 |
| phone | 40 | 3217 / 3217 | 1817 / 1817 | 1800 / 1800 |

`node scripts/perf/river-cost.mjs` draws the same view back to back with the lines on and off
(`__glMap.timeFrames`, GPU synced): on SwiftShader the lines cost 0 to about 20 ms of a 120 to
250 ms software frame, within the noise at the close zoom. They are one draw call of 13,000
(world view) to 38,000 (middle zoom) vertices with a short fragment shader, and only reaches round
the view are built at the middle and close zooms. On a real GPU (a phone's included) that is far
under the 1 ms budget, but it could not be measured here.

## Screenshots

`before/` (the painted raster, river lines off) and `after/`, desktop 1600x900 and phone 844x390,
k 3, 12 and 40, Nile delta, Mesopotamia, Rhine, Mississippi, explored world
(`scripts/perf/map-shots.mjs --explored`, `--no-rivers` for the before set).

## Left

- Natural Earth's 1:10M lines zigzag in a few places at the closest zoom (the Rosetta branch of
  the Nile); a finer source (HydroRIVERS) would need its download and an attribution line.
- Rivers stop at the hex coast; a mouth that ends one hex short of the sea is not extended.
