# Map rivers trial: real river lines painted into the raster

Branch `claude/map-rivers-trial` (from `claude/integration`). Not merged. Trial region only.

## The idea

Phase F2 drew rivers along hex edges and looked wrong (switched off in 46db7f78). The raster
already had Natural Earth river lines in it, but as thick uniform blobs (one width per rank,
polyline kinks). This trial keeps rivers in the raster (zero runtime cost: no overlay, no new
layer, no shader change) and paints them better:

- smooth courses: every reach is corner-cut (Chaikin, 2 passes), so no polyline kinks;
- widening downstream: each reach carries Natural Earth's `strokeweig` (the Nile goes 0.2 near
  the source to 2.0 at the delta). Ground width = 1.6 km + 4.2 km x weight, so about 2 km for a
  trickle and 10 km for the Nile at the sea. The width is in km, so every level shows the same
  river and the pixel width follows the level's scale;
- a darker bank line under a lighter water core, so the river reads as a ribbon at close zoom;
- more tributaries: the `scale_rank` file has 4,224 reaches (the old one 1,455).
- still land only: the river layer is cut by the hex coast mask (`hexLand.json`), so rivers
  never leave the land and stop at the hex coast (mouths that fall in a water hex are clipped).

## Source and licence

Natural Earth 1:10M `ne_10m_rivers_lake_centerlines_scale_rank` (public domain, already credited
in CREDITS.md as Natural Earth). Fetched by `npm run fetch:tiles` from the same
raw.githubusercontent.com mirror as the other Natural Earth layers (about 10 MB).
HydroRIVERS (HydroSHEDS, CC BY-style licence, would need attribution) is the better dataset for
discharge-based widths, but hydrosheds.org is blocked from this sandbox (403 on the proxy), so
it was not possible to try. The code is isolated in `scripts/geo/river-paint.mjs`; a HydroRIVERS
loader would only have to return the same `{ line, sw, rank }` list.

## Gameplay edges still match

The river rules and `tiles.json` are untouched. `node scripts/geo/check-river-match.mjs --box ...`
measures how far every gameplay river edge (middle of the edge) is from the nearest painted
river, and the other way round (45 km is about half a hex):

| region | gameplay edges within 45 km of a painted river | painted rank 0-6 river points within 45 km of a gameplay edge |
| --- | --- | --- |
| Levant, Mesopotamia, Nile (27,21 to 51,39) | 97.6 % (great 97.5 %, median 12 km) | 100 % |
| Rhine, Danube (3,42 to 31,53) | 90.1 % (great 98.5 %, median 10 km) | 99.9 % |

The unmatched edges are small streams (class 1) and a few river edges the gameplay data
places a little off the painted course. A river a player crosses on the map is crossed on the
picture: 97 to 99 % of the great river and river edges match.

## What is in this commit

- `scripts/geo/river-paint.mjs`: the shared loader, smoothing, width rule and SVG strokes.
- `build-world-raster.mjs`, `build-raster-pyramid.mjs` (levels 0 to 5), `build-raster-detail.mjs`
  (level 6) use it, so all levels draw the same rivers.
- `--box lon0,lat0,lon1,lat1` on the pyramid and detail builds: rewrites only the tiles meeting
  that box, in place (pyramid: also their parents on levels 0 to 4; detail: level 6 pictures only,
  no cover and no manifest changes). `fetch-tiles-raw.mjs --detail --box ...` fetches only that
  region's zoom-7 elevation. This is how the trial region was rebuilt.
- Rebuilt tiles for two boxes: `27,21,51,39` (Nile, Levant, Mesopotamia, Persian Gulf head) and
  `3,42,31,53` (Rhine, Danube). 134 tile files changed (31 on level 5, 79 on level 6, the rest
  parents on levels 0 to 4); tiles without a river come out byte-identical, so git only sees the
  river tiles.
- NOT rebuilt in the trial: `public/map/world-4096.webp` and `world-2048.webp` (the globe
  texture and the flat map's first image). The code is changed, so the next full
  `npm run build:raster` paints the new rivers there too, but the trial leaves those two files
  alone to keep the commit small. Until then the globe shows the old rivers.
- `scripts/perf/map-shots.mjs`: runs with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, longer screenshot
  timeout, `--settle ms` to let the raster tiles stream in before the shot.

## Screenshots

`before/` and `after/` (same views, same settle time). Names: `place-profile-kZOOM.webp`,
profile `desktop` (1600x900) or `phone` (844x390 at 2x), k = map zoom: 3 far (pyramid level 4),
12 middle (level 5), 40 close (level 6). Places: nile (Cairo and the delta), mesopotamia
(Baghdad), levant (Jordan valley), rhine (Koblenz), danube (Budapest). Not every place has every
zoom: the far view is only for the Nile and Mesopotamia. At the far zoom (level 4 and above) no
river is visible before or after, the rivers are about one pixel there; making them show at
world scale is a separate choice (a minimum width at the lower levels) that this trial does not make.

What changes: the same rivers, thinner and cleaner at their sources, wider at the mouth, with a
bank line; no blobs where a river bends or two reaches meet. Crispness is limited by the level 6
pixel (1.2 km): at k=40 a river edge is still softly pixelated. A crisper close view would need
level 7 tiles (4x the pixels of level 6) or a runtime vector layer; this trial does neither.

## Rebuild the whole world

```
npm run fetch:tiles                                  # the scale_rank rivers and the zoom-4 elevation
node scripts/geo/fetch-tiles-raw.mjs --pyramid       # zoom-5 elevation (75 MB)
node scripts/geo/fetch-tiles-raw.mjs --detail        # zoom-7 elevation, 3,931 tiles, about 330 MB
npm run build:raster                                 # world-4096.webp, world-2048.webp  (about 1 min)
npm run build:pyramid                                # levels 0 to 5                      (about 3 min)
npm run build:raster-detail                          # level 6 + cover                    (about 15 min)
```
(`npm run build:pyramid -- --box ...` and `npm run build:raster-detail -- --box ...` for one
region; fetch with `--detail --box ...` first. The boxes of this trial took 50 s for the pyramid
and 20 s for the detail tiles each.)

Raw data stays under `scripts/geo/.raw` (gitignored). The trial used 140 MB of raw files in /tmp,
deleted afterwards.

## Size cost for the full world

Measured on the trial tiles: the river tiles grew by 3.1 % on level 6 (7.25 to 7.48 kB a tile)
and by 6.1 % on level 5, which have 13.5 MB and 4.3 MB in the repo now. Scaling to the world:
about +0.4 MB (level 6) and +0.3 MB (level 5), lower levels about 0, `world-*.webp` about +0.1 MB.
Estimate: **+0.8 MB, up to about +1.5 MB** if wetter continents (more tributaries) cost more than
the trial boxes, on about 20 MB of tiles. No extra requests, no runtime work.

## Left to do

- Rebuild the whole world and commit (a binary diff of about 20 MB of tiles, so do it on its own commit).
- Decide whether to try HydroRIVERS (needs a download of about 600 MB for the continents, an
  attribution line, and network access to hydrosheds.org).
- Level 7 or a vector overlay if even crisper rivers are wanted at the closest zoom.
- Mouths: rivers are clipped at the hex coast, so a mouth that ends one hex short of the sea
  stops at the coast of that hex; nothing is extended. The Nile delta branches reach the sea in the
  close shots; the other mouths were not inspected one by one.
