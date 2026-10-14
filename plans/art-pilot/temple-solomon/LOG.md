# Solomon's Temple: rebuilt for the close view

Branch `claude/art-temple-solomon`. The report: "Built temple of solomon, looks like shit" (Israel,
720 BCE, the close view: a huge flat beige octagonal platform filling the hex, two blue panels, a
small altar and a dark round object).

## Diagnosis

The wiring was right and the model was weak (case c of the brief):

- Id `solomons_temple` (src/data/greatProjects.js), file `src/assets/map/wonders/solomons_temple.glb`
  with `tier1`, `tier2`, `tier3`, each with LOD0..LOD2, materials Town and Team, as the loader
  (`wonderAssets.js` `wonderTierObject`, `townAssets.js` `loadAssetObjects`) expects. The close view
  (`closeViewScene.js`) draws the built tier at the towns' scale, capped by the room to the next town,
  with the LOD for the zoom (LOD0 from k 40). Same path, same rules as every other wonder.
- The file was GPT's checkpoint-02 delivery put through `import_model.py`. Its tier 1 (the tier a
  player builds first) is an octagonal paved platform 85 x 91 m and only 5.5 m high, with an altar,
  a bronze basin and two grey stands whose panels are Team (tinted the player's blue). There is no
  temple at all in tier 1; a small temple appears in one corner of the platform at tier 2.
  Blender render of the old file (LOD0, tiers 1 to 3): `blender-before-tiers.jpg`.
- Since a wonder next to its city is capped to its share of the hex, an 85 m plate with a few small
  props fills the hex with flat beige. That is exactly the screenshot: `before-tier1-k150.jpg`.

## What changed

`scripts/blender/build_wonder_solomons_temple.py` builds a new file by script, in the house style of
the map models (ti_map.py, ti_town.py: 1 unit = 10 m, front to -Y, procedural materials baked into one
atlas set, LOD0/1/2 per tier, Team neutral grey #BFBFBF, no text and no emblems).

- Tier 1, the temple itself: a raised ashlar platform (3 m) with a walled inner court (three courses
  of stone and a cedar course) and a gate with two towers; the long sanctuary block of pale ashlar
  with a flat cedar roof and parapet, three storeys of side chambers round it, narrow windows; the
  20 m porch with gilded doors and a Team veil; Jachin and Boaz, bronze shafts with bowl capitals of
  lilies and pomegranates; the stepped altar with horns and a ramp; the bronze sea on twelve oxen;
  the ten lavers on wheeled stands.
- Tier 2, the great court: a paved outer court, its wall with a gatehouse and side gates, porticoes
  along the south wall and rows of chambers on the other sides.
- Tier 3, the royal quarter on both flanks: the king's house round its court with a tower and the
  throne hall's pillared porch (west), the House of the Forest of Lebanon with its cedar pillars and a
  second house (east), cypress and olive gardens, walls.
- Tiers only add parts, so the atlas is baked once from tier 3 and every tier and level samples it
  (`transfer_uvs_by_face`). That gives three times the texel density of a file that bakes each tier
  apart, on a 1024 atlas.

No code changes were needed. The new shot script `scripts/art/wonder-shots.mjs` builds a wonder at a
chosen tier next to Israel's capital (with Masada and the Great Library beside it for scale) and
shoots the close view.

## Numbers

| | Old file | New file |
|---|---|---|
| Triangles tier 1 (LOD0/1/2) | 3,002 / 3,002 / 1,455 | 7,024 / 2,416 / 532 |
| Triangles tier 2 | 22,156 / 9,700 / 1,455 | 9,144 / 3,960 / 952 |
| Triangles tier 3 | 37,724 / 9,700 / 1,455 | 11,836 / 5,584 / 1,252 |
| Footprint tier 1 / 2 / 3 (units, 10 m) | 8.5 x 9.1 every tier | 4.1 x 7.4 / 6.5 x 8.7 / 9.5 x 8.7 |
| Height | 0.55 (tier 1), 3.2 | 2.5 (the porch, 25 m) |
| Textures | 2 x 2048 WebP (base, surface) | 3 x 1024 WebP (base, normal, packed) |
| GPU texture memory (RGBA with mips) | about 45 MB | about 17 MB |
| File (packed) | 1.42 MB | 1.00 MB |

Budgets (wonder 60,000 / 10,000 / 1,500) hold. `validate_model.py` passes on the unpacked file
(`solomons_temple.validation.json`, `manifest.json`). Compare: Masada 8.5 x 11.2 units, the Great
Library 6.8 x 6.6; the new tier 3 is in the same range, and tier 1 is the temple and its court only.

## Shots

844 x 390 at device scale 3, Chrome, the dev server; Israel's capital with the temple on the tile to
its north, Masada (tier 3) and the Great Library (tier 3) beside it.

- Before: `before-tier1-k60.jpg`, `before-tier1-k150.jpg` (the user's case), `before-tier3-k60.jpg`,
  `before-tier3-k150.jpg`.
- After: `after-tier{1,2,3}-k{60,150}.jpg`.
- Blender renders from the map's angle, LOD0, tiers 1 to 3: `blender-before-tiers.jpg`,
  `blender-after-tiers.jpg`.

## Still weak

- The royal quarter in tier 3 reads as more long flat-roofed blocks; at k 60 it is hard to tell from
  the tier 2 chambers.
- The Team marks are small (the porch veil and four pennants), so the owner's colour shows only up
  close.
