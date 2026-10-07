# Wave 1: checkpoint 03 (Bronze damaged houses, ground materials, battle effects)

29 delivery items, 2026-10-07, branch `claude/bronze-towns` (plans/ART-MODELS-PLAN.md section 12, Wave 1):
the 13 Bronze damaged-and-ruined house files, the 8 ground materials and the 8 core battle effect
sheets. All in the game. [Manifest](manifest.json) · [Checksums](SHA256SUMS.txt) ·
[House contact sheet](contact.png) · [Ground tiles, 2 x 2 repeats](ground-tiles.png) ·
[Effect frames](fx-sheets.png) · in-game shots `plans/art/shots/wave1/ground-construction-bronze-844x390.png`
and `walls-bronze-city-844x390.png`.

Built headless in Blender 5.2 by script. The houses reuse the town art already in the game: the
procedural kits' own house builders, and the delivered kit house models (original work from the
earlier Blender deliveries, sources listed below). The ground textures and effects are drawn from
periodic noise and seeded particles. No outside sources.

| Archive | Items |
|---|---|
| part-1.zip | houses: base, europe, americas, levant, steppe |
| part-2.zip | houses: indic, monsoon, eastafrica, maghreb |
| part-3.zip | houses: sinic, nile, westafrica, israelite |
| part-4.zip | ground materials (color, normal, orm PNGs) and effect frames |

**Where the ZIPs are:** `C:\GitWotkspace\art-deliveries\wave1-2026-10-07-cp03\` (no GitHub CLI on
this PC). To publish: `gh release create wave1-2026-10-07-cp03 C:\GitWotkspace\art-deliveries\wave1-2026-10-07-cp03\part-*.zip`.

## Damaged and ruined houses (src/assets/battle/city/bronze[-<theme>]-houses-damage.glb)

`scripts/blender/build_houses_damage_bronze.py <out_dir> <theme>`. Each file holds `house-poor`,
`house-common` and `house-rich` of the theme's Bronze town kit as `-damaged` (a top corner broken
off and capped, a burnt hole in the roof with charred beams, cracks, a heap of the house's own wall
stuff) and `-ruined` (walls cut to 1.4 to 3 m on a slanting line, roof gone, the inside filled with
rubble, charred beams and loose bricks). Same origin and footprint as the intact house; the
renderer (`cityArt.pickHouse`) fits them to each house's ground. One 1024 atlas per file.

| Theme | File | Damaged (largest LOD0 / LOD1 / LOD2) | Ruined | Packed | House source |
|---|---|---|---|---:|---|
| base | bronze-houses-damage.glb | 1272 / 204 / 96 | 313 / 78 / 38 | 0.59 MB | procedural, ti_town.house |
| europe | bronze-europe-houses-damage.glb | 1484 / 244 / 82 | 860 / 207 / 58 | 0.73 MB | procedural, ti_europe_bronze.py |
| americas | bronze-americas-houses-damage.glb | 544 / 284 / 62 | 342 / 182 / 36 | 0.39 MB | kit model.glb (delivery blender-next40) |
| levant | bronze-levant-houses-damage.glb | 2258 / 334 / 62 | 637 / 228 / 36 | 0.57 MB | kit model.glb (blender-remaining 04) |
| steppe | bronze-steppe-houses-damage.glb | 2349 / 330 / 62 | 605 / 277 / 36 | 0.50 MB | kit model.glb (blender-eastafrica-steppe40) |
| indic | bronze-indic-houses-damage.glb | 2026 / 400 / 80 | 852 / 298 / 38 | 0.64 MB | procedural, ti_indic_bronze.py |
| monsoon | bronze-monsoon-houses-damage.glb | 810 / 330 / 62 | 525 / 260 / 36 | 0.40 MB | kit model.glb (blender-next40) |
| eastafrica | bronze-eastafrica-houses-damage.glb | 1702 / 325 / 62 | 954 / 288 / 36 | 0.54 MB | kit model.glb (blender-west-eastafrica40) |
| maghreb | bronze-maghreb-houses-damage.glb | 715 / 329 / 62 | 409 / 216 / 36 | 0.48 MB | kit model.glb (blender-monsoon-maghreb40) |
| sinic | bronze-sinic-houses-damage.glb | 1832 / 302 / 106 | 1145 / 282 / 55 | 0.82 MB | procedural, ti_sinic_bronze.py |
| nile | bronze-nile-houses-damage.glb | 672 / 316 / 62 | 328 / 144 / 36 | 0.39 MB | kit model.glb (blender-next30) |
| westafrica | bronze-westafrica-houses-damage.glb | 862 / 318 / 62 | 410 / 223 / 36 | 0.46 MB | kit model.glb (blender-maghreb-westafrica40) |
| israelite | bronze-israelite-houses-damage.glb | 2297 / 333 / 62 | 648 / 249 / 36 | 0.62 MB | kit model.glb (blender-remaining 01) |

Budgets: damaged 2,500 / 600 / 120, ruined 1,200 / 300 / 80; every file passes `validate_model.py`
(kind `house-damage`). The kit models are read from the backup ZIPs in
`C:\GitWotkspace\art-downloads-backup\` (extracted to `art-build/kitsrc/plans/art/kits/<theme>/bronze/houses/model.glb`,
the default kit root of the script). Some delivered kits carry loose vertices; the script drops them
so each object's bounds stay its house.

## Ground materials (src/assets/terrain/<id>/color.webp)

`scripts/blender/build_ground_materials.py <out_dir> [--maps]`, then `node scripts/art/ground-webp.mjs`:
grass, dry-soil, desert-sand, rock, snow, wet-soil, paving, steppe-grass, 1024 px, seamless (periodic
noise and periodic Voronoi cells, AO of their own height in the colour), WebP q85, 1.7 MB for all
eight. Only `color.webp` ships: `groundMaterials.js` needs nothing else until the lit ground lands;
`normal.png` and `orm.png` are in part-4.zip (and rebuild with `--maps`). Queue items: ground-grass,
-desert-sand, -rock, -dry-steppe (steppe-grass), -snow-ice (snow), -wet-soil, -paving; dry-soil is an
extra the game asks for; ground-tundra stays open.

## Battle effects (src/assets/fx/<id>/)

`scripts/blender/build_fx_sheets.py <out_dir>`: impact-sparks (64 px, 8 frames, additive),
explosion (128, 12, additive), smoke (128, 12, alpha), fire-small (128, 12, additive), fire-large
(128, 16, additive, looping), debris (128, 10, alpha: chunks and dust, no gore), muzzle-flash (64, 8,
additive), dust (128, 12, alpha). PNG frames with `sheet.json`, 150 KB for all eight. They replace
the code's sparks through `fxSheets.js`.

## Checks

`validate_model.py` on every house file; `npx vitest run src/battle src/components/map/closeView src/data scripts/art`
passes (925 tests); `downloads-coverage.mjs`: every item in the game; city battle at 844x390
(`eco-shot.mjs`, `&age=bronze&city=medium`) shows the Bronze wall kit, and an economy battle the
ground grain and a construction stage.
