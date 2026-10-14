# MD05 / I217 and MD14: battle trees and the steppe kit (14 October 2026)

Branch `claude/art-md05-trees`. First pass 6dc4817f (merged into integration as 13a81ecf); second
pass 9e3d77d7 on the user's decisions (one mesh a species, rebuild and re-pin the conifer,
tropical and cold kits, one wind, darker crowns), then integration 8cec80ba merged in; third
pass on top of e3aa70ed: lighter LOD1 crowns for the zoom 1 phone budget and lit date palm fronds.
Brief: plans/playtest-audits-art-update-2026-10-13.md section 4 and row MD14. Complaint, checked
in a forest battle at 844x390: one species everywhere in flat-shaded shards, crowns floating on
thin trunks, dense woods a spiky dark mass hiding the men under it.

## What was built

Every kit has three species at three sizes: the first is tree-s, tree-m, tree-l (the names the
game always read, and what groves use), the others tree-s-2 ... tree-l-3.

| File | Species | Built |
|---|---|---|
| `vegetation-temperate.glb` | oak, beech, birch | trees new, other objects unchanged |
| `vegetation-mediterranean.glb` | olive, stone pine, cypress | same |
| `vegetation-desert.glb` | date palm, acacia, tamarisk | same |
| `vegetation-steppe.glb` (MD14) | poplar, wind-bent elm, saxaul; tall feather grass as `grass-tuft`; stump, felled, bush, rocks, log-pile | new |
| `vegetation-conifer.glb` | spruce, Scots pine, fir | trees new, rest as checkpoint 38 shipped it |
| `vegetation-tropical.glb` | buttressed jungle tree, coconut palm, banana | same |
| `vegetation-cold.glb` | larch, dwarf birch, tundra shrub | same |

- Trees: `scripts/blender/ti_trees.py`. Trunk: one tube with a flared foot, bare for the lower
  third to half. Crown: a few large icosphere clumps, barely jittered, exported with smoothed
  normals (`ti_town.SMOOTH`; every other builder stays flat). LOD1 (third pass, the zoom 1
  budget) is a four-sided trunk post and one rounded mass the size of the crown: an eight-sided
  sphere of four rows (48 triangles, smoothed), 20 faces for small trees; 56 triangles for a
  medium tree (was 100). LOD2 the same mass at 20 faces. Palms: 5 wide fronds at LOD1 (48).
- Palm fronds (third pass) are smoothed and take their far colour from a lit frond like the
  crowns; the date palm's fronds are lighter, in the other crowns' value range at zoom 1.
- Tone (second pass): every crown in the temperate oak's value range (luminance about 0.4 to
  0.47) and saturated; the pale ones (beech, birch, olive, acacia, tamarisk, poplar, elm, saxaul,
  larch, dwarf birch) were washing out to white at far zoom. Birch trunks stay white.
- `build_nature.py`: `species_items` names the objects; each tree has its own random stream (from
  its name). The old trees are still run into a throwaway mesher before the stump, so the stump,
  felled trunk, bush, rocks, tuft and log pile keep their shapes. `soft_crown_uvs`: the far
  crown's faces take their colour from a lit, open full-model leaf face (not one pressed inside
  another clump, not the darkest third), so far woods are not speckled with black triangles.
- Conifer, tropical, cold (second pass): rebuilt by `build_nature.py` `remaining_kit` instead of
  `build_vegetation_remaining.py` (which shells out to python3 and has a sheet gate; it is kept,
  marked superseded). `remaining_kit` takes that builder's layouts (`ti_vegetation_remaining.py`)
  over `ti_nature_wave7.py` (ti_nature.py as of 189b134d: MD06 has since redrawn the stump and
  felled trunk) with that builder's seeds, and runs its old trees into nothing first, so every
  object but the trees is the same geometry as shipped: stump 84/16/16, felled 172 (conifer) /
  232 (tropical) / 252 (cold) /44/16, bush, rocks and grass tuft all equal to the checkpoint 38
  record. The first pass's `vegetation-<kit>-species.glb` companions and `ART.vegetationSpecies`
  are gone: folding them in is cleaner (one file a kit, one atlas, one loader path).
- `scripts/art/checkpoint38-lod-uvs.mjs`: the three kits' hashes moved, and its root and
  lower-level totals (56 to 74, 112 to 148: 6 more tree roots a kit), with a dated comment. Its
  other 11 pins unchanged; it passes (14 models, 0 uv rewrites, 0 index or triangle changes).
- `kitLoader.parseKit`: a kit with species objects is never "repaired" (the repair for the old
  temperate file would put the far faces back on dark inner faces).

## Renderer (`src/battle/art/vegetationProps.js`, `treeMix.js`)

Every procedural tree keeps its place and shade; `treeAt(x, z)` (a hash of the place, never
Math.random) gives its species (stands of 9 tiles share a leading species, 60% of their trees),
size (30 / 42 / 28% small / medium / large), rank and own scale (0.86 to 1.14).

One instanced mesh per 48-tile chunk and species at every zoom: it draws the species' `tree-m`
at the zoom's LOD, each instance scaled to its size (the heights of the kit's tree-s, tree-m,
tree-l). So near-zoom draw calls no longer grow with sizes (the first pass had a mesh per size).

| Zoom | LOD | Trees drawn |
|---|---|---|
| 2 and up | 0 | all |
| 0.9 to 2 | 1 | the 70% of lowest rank |
| below 0.9 | 2 | the 52% of lowest rank, 14% larger |

The trees kept far are always among those kept nearer (instances sorted by rank, `mesh.count`
cut), so zooming never swaps neighbours. Wind: a species whose crown stands more than a quarter of
its height off its foot (only the steppe elm, 0.36 to 0.42; olives, palms and dwarf birches stay
under 0.2) is turned so it leans along the battle's wind (`windYaw(setup.seed)`), plus or minus
15 degrees. Only drawing changes: forest tiles block, slow and hide as before; groves
(`economyLayer.js`) still read `tree-l`, `tree-m`, `felled`, `stump` and the log pile. The sandbox
takes `&vegetation=<kit>` (drawing only) for art checks.

## Triangles (LOD0 / LOD1 / LOD2, budget 600 / 150 / 150; validator kind `tree`)

The validator holds 150 at LOD1 (TRIANGLE-BUDGET.md asks 200): the stricter limit is kept, and
the third pass brought LOD1 down to about 56 for the zoom 1 phone budget.

| Kit | Trees (small, medium, large) |
|---|---|
| temperate | oak 309/28/26, 397/56/26, 485/56/26; beech 309/28/26, 397/56/26, 477/56/26; birch 280/28/26, 280/56/26, 360/56/26 |
| mediterranean | olive 317/28/26, 397/56/26, 485/56/26; stone pine 387/36/32, 477/64/32, 557/64/32; cypress 280/28/26, 360/56/26, 360/56/26 |
| desert | date palm 177/48/46, 261/48/46, 285/48/46; acacia 387/36/32, 477/64/32, 567/64/32; tamarisk 380/38/26, 480/38/26, 580/66/26 |
| steppe | poplar 280/28/26, 360/56/26, 360/56/26; elm 309/28/26, 397/56/26, 477/56/26; saxaul 380/38/26, 480/38/26, 580/66/26 |
| conifer | spruce 280/28/26, 360/56/26, 440/56/26; pine 309/28/26, 397/56/26, 485/56/26; fir 280/28/26, 360/56/26, 440/56/26 |
| tropical | jungle 321/28/26, 413/56/26, 493/56/26; coconut 177/48/46, 249/48/46, 261/48/46; banana 132/48/46, 144/48/46, 156/48/46 |
| cold | larch 280/28/26, 360/56/26, 440/56/26; dwarf birch 309/28/26, 397/28/26, 397/56/26; tundra shrub 380/38/26, 480/38/26, 580/38/26 |

The game draws each species' medium tree (scaled), so a tree costs 144 to 480 triangles at
LOD0, 28 to 64 at LOD1 and 26 to 46 at LOD2.

## Frame cost (forest sandbox, bronze, tile 373 = temperate kit, 844x390 at scale 3, Intel UHD, D3D11)

Before: base commit dbc96467 built from a clean export (`git archive`) and served on port 5204.
After: this branch (integration 8cec80ba merged in), port 5203. Same machine, same day.

Tree triangles: instances drawn times the level's triangles over the whole field (the main pass;
shadows double it on both sides). This is the trees' own cost, free of the soldiers' adaptive
detail and of the economy art that integration added meanwhile.

| Zoom | Tree triangles before | second pass | final | Tree meshes before | final |
|---|---|---|---|---|---|
| 2 | 1,507k | 1,390k | 1,390k (-8%) | 32 | 48 |
| 1 | 188k | 275k | **154k (-18%)** | 32 | 48 |
| 0.6 | 110k | 53k | 53k (-52%) | 32 | 48 |

At zoom 1 the desert kit draws 136k and the tropical kit 139k for the same view.

Whole frame from the `&perf` readout (triangles include the soldiers, whose detail tier the
renderer picks by speed and which differed between runs, and the worker loads and grove stumps
integration added; the tree rows above are the comparable numbers):

| View, zoom | Triangles before | final | Draw calls before | final |
|---|---|---|---|---|
| army, 2 | 1,718k | 1,709k | 97 | 109 |
| army, 1 | 739k | 877k | 110 | 118 |
| army, 0.6 | 329k | 284k | 111 | 124 |
| woods, 2 | 2,047k | 1,645k | 81 | 92 |
| woods, 1 | 722k | 531k | 114 | 120 |
| woods, 0.6 | 308k | 250k | 140 | 153 |

Draw calls: 8 to 13 above the old level at every zoom (three species meshes a chunk against two
kinds), accepted. The first pass, with a mesh per size, drew 133 and 138 at zoom 2.

## Commands

```
blender -b --factory-startup -P scripts/blender/build_nature.py -- art-build/md05/out3 vegetation-temperate,vegetation-mediterranean,vegetation-desert,vegetation-steppe,vegetation-conifer,vegetation-tropical,vegetation-cold
"<Blender>/5.2/python/bin/python.exe" -I scripts/blender/validate_model.py art-build/md05/out3/vegetation-<kit>.glb <out> tree   (all 7 PASSED, before packing; the validator rejects packed files by design: uncompressed_geometry)
blender -b --factory-startup -P scripts/blender/tree_sheet.py -- art-build/md05/out3/vegetation-<kit>.glb art-build/md05/sheet-<kit>
npm run pack:models -- src/assets/battle/nature/vegetation-<kit>.glb ...
node scripts/art/checkpoint38-lod-uvs.mjs
node scripts/build.mjs && node scripts/preview.mjs --port 5203
node plans/art-pilot/md05-trees/forest-shots.mjs plans/art-pilot/md05-trees/after after
BASE=http://localhost:5204/terra-imperium/ node plans/art-pilot/md05-trees/forest-shots.mjs plans/art-pilot/md05-trees/before before
ZOOMS=1,0.6 node plans/art-pilot/md05-trees/forest-shots.mjs plans/art-pilot/md05-trees/kits <kit> vegetation=<kit>
```

## Evidence

- `sheets/sheet-<kit>.jpg` (and `-phone.jpg`, a quarter size): front row LOD0, then LOD1, LOD2;
  a 1.8 m post for scale; the kit's other objects in front.
- `before/` (base) and `after/` (final): army and woods views at zooms 2, 1, 0.6, with
  `*-report.json` (triangles, draw calls, tree triangles, trees drawn).
- `kits/`: each kit's woods at zooms 1 and 0.6 through `&vegetation=<kit>` (desert and tropical
  at zoom 1 retaken after the third pass; `desert-woods-zoom1-before-palms.jpg` is the second
  pass, with the dark date palms).

## Tree budget at the phone's zoom (branch claude/art-md05-tree-budget, from integration 6a5a6c3b)

Report from the code session: a forest battle at the default zoom drew about 1.02 M triangles a
frame on a phone, over the 1.0 M ceiling, said to be mostly trees at full detail.

**Measured** (`layer-budget.mjs`: phone profile 844x390 at device scale 3, real GPU, production
build; each layer's share is the drop in `renderer.info` triangles when that layer is hidden, so
it counts the shadow pass). The battle opens at zoom 1 (BattleRenderer: `camera.zoom = 1`; a
landscape phone shows 18 tiles tall, so zoom 1 on a phone is already close), where the trees were
at LOD1, not full detail:

| View | Total | Trees | Rocks, grass | Soldiers | Terrain | Everything else |
|---|---|---|---|---|---|---|
| opening camera, zoom 1 | 926k | 140k | 17k | 456k | 51k | 263k |
| densest wood, zoom 1 | 412k | 150k | 19k | 0 | 51k | 193k |
| densest wood, zoom 2 (before) | **1,407k** | **1,124k** | 42k | 0 | 51k | 191k |

So at the opening zoom the frame is mostly soldiers (456k, the adaptive tier lifting them past
their 300k budget) and the camp, nodes and buildings (about 200k to 260k). The trees blow the
budget from zoom 2 up, where every tree switched to full detail at once: 1.12 M for the trees
alone. That is the likely source of the 1.02 M reading (a slightly zoomed-in view, or the zoom 2
step); I could not reproduce over 1.0 M at zoom 1 in the forest sandbox.

**Fix** (tree drawing only, `vegetationProps.js`, `treeMix.js`, `quality.js`):
- The level follows a medium tree's height on screen (css px, a 6 m reference tree): full trees
  from 70 px, the middle level from 32 px, with an 8% margin against flicker. On a landscape phone
  these sit where the zoom rule switched (zoom 2.16 and 0.9); a desktop switches at its own zooms.
  The size level also sets how much of a wood stands (all, 70%, 52%), as before.
- A per-frame tree budget like the soldiers' (`BATTLE_GRAPHICS.treeTriangles`: 160k phone, 500k
  desktop, shadows counted): the cost is the trees in the chunks in view (a chunk on screen is
  drawn whole) at each level; past the budget the trees draw a simpler level, never fewer trees;
  a finer level only with 15% to spare.
- Close up (the full-tree size level) the trees come from 16-tile chunks instead of 48: every
  chunk in view draws the middle level, then full trees go to the chunks nearest the middle of
  the view, one by one, while the budget lasts. The 48-tile chunks still draw the middle and far
  levels (few draw calls over a whole wood).

**After** (same views):

| View | Total | Trees | Tree estimate | Detail |
|---|---|---|---|---|
| opening camera, zoom 1 | 926k | 140k | 136k | middle level, 70% of trees |
| army, zoom 1 | 506k | 141k | 141k | middle level |
| densest wood, zoom 1 | 412k | 150k | 159k | middle level |
| densest wood, zoom 1.5 | 379k | 120k | 110k | middle level |
| densest wood, zoom 2 | 374k (was 1,407k) | 118k (was 1,124k) | 110k | middle level, 70% |
| densest wood, zoom 3 | 423k | 141k | 136k | every tree; full trees in the middle chunks, the middle level round them |
| army, zoom 3 | 507k | 138k | 135k | same |

(The opening and army totals differ between runs with the soldiers' adaptive tier: 456k at tier
0, 85k at tier 1.) Shots: `budget/before-*.jpg` and `budget/after-*.jpg` at each view.

Open: the soldiers (456k at tier 0) and the camp, nodes and buildings (about 200k to 260k) are
most of the opening frame; at zoom 3 the edge between full trees and the middle level shows as a
change of crown shape across chunk lines.

## Open points

- Near-zoom draw calls are 8 to 13 above the old level (accepted).
- Groves still use the first species' `tree-l` / `tree-m` only.
- The sandbox fights on a temperate tile; other kits were checked with `&vegetation=`.
