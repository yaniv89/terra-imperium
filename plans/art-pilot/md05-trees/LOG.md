# MD05 / I217 and MD14: battle trees and the steppe kit (14 October 2026)

Branch `claude/art-md05-trees`. First pass 6dc4817f (merged into integration as 13a81ecf); second
pass 9e3d77d7 on the user's decisions (one mesh a species, rebuild and re-pin the conifer,
tropical and cold kits, one wind, darker crowns), then integration 8cec80ba merged in.
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
  normals (`ti_town.SMOOTH`; every other builder stays flat). LOD1 is the trunk and one 80-face
  rounded mass the size of the crown, LOD2 the same at 20 faces (palms keep a few wide fronds).
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

The validator holds 150 at LOD1 (TRIANGLE-BUDGET.md asks 200): the stricter limit is kept.

| Kit | Trees (small, medium, large) |
|---|---|
| temperate | oak 309/40/26, 397/100/26, 485/100/26; beech 309/40/26, 397/100/26, 477/100/26; birch 280/40/26, 280/100/26, 360/100/26 |
| mediterranean | olive 317/40/26, 397/100/26, 485/100/26; stone pine 387/48/32, 477/108/32, 557/108/32; cypress 280/40/26, 360/100/26, 360/100/26 |
| desert | date palm 177/88/46, 261/88/46, 285/88/46; acacia 387/48/32, 477/108/32, 567/108/32; tamarisk 380/38/26, 480/38/26, 580/98/26 |
| steppe | poplar 280/40/26, 360/100/26, 360/100/26; elm 309/40/26, 397/100/26, 477/100/26; saxaul 380/38/26, 480/38/26, 580/98/26 |
| conifer | spruce 280/40/26, 360/100/26, 440/100/26; pine 309/40/26, 397/100/26, 485/100/26; fir 280/40/26, 360/100/26, 440/100/26 |
| tropical | jungle 321/40/26, 413/100/26, 493/100/26; coconut 177/88/46, 249/88/46, 261/88/46; banana 132/88/46, 144/88/46, 156/88/46 |
| cold | larch 280/40/26, 360/100/26, 440/100/26; dwarf birch 309/40/26, 397/40/26, 397/100/26; tundra shrub 380/38/26, 480/38/26, 580/38/26 |

The game now draws each species' medium tree (scaled), so a tree costs 144 to 480 at LOD0.

## Frame cost (forest sandbox, bronze, tile 373 = temperate kit, 844x390 at scale 3, Intel UHD, D3D11)

Before: base commit dbc96467 built from a clean export (`git archive`) and served on port 5204.
After: this branch with integration 8cec80ba merged in, port 5203. Both runs on the same machine
in the same hour.

Tree triangles: instances drawn times the level's triangles over the whole field (the main pass;
shadows double it on both sides). This is the trees' own cost, free of the soldiers' adaptive
detail and of the economy art that integration added meanwhile.

| Zoom | Tree triangles before | after | Tree meshes before | after |
|---|---|---|---|---|
| 2 | 1,507k | 1,390k (-8%) | 32 | 48 |
| 1 | 188k | 275k (+46%) | 32 | 48 |
| 0.6 | 110k | 53k (-52%) | 32 | 48 |

Whole frame from the `&perf` readout (triangles include the soldiers, whose detail tier the
renderer picks by speed: before tier 0/0/1 and 0/0/2, after 0/0/0 and 0/0/1, so the zoom 0.6
army totals are not comparable; integration also added drawn worker loads and grove stumps):

| View, zoom | Triangles before | after | Draw calls before | after (first pass) |
|---|---|---|---|---|
| army, 2 | 1,718k | 1,709k | 97 | 109 (133) |
| army, 1 | 739k | 988k | 110 | 118 (111) |
| army, 0.6 | 329k | 657k | 111 | 130 (123) |
| woods, 2 | 2,047k | 1,645k | 81 | 92 (138) |
| woods, 1 | 722k | 1,028k | 114 | 126 (124) |
| woods, 0.6 | 308k | 300k | 140 | 153 (151) |

Draw calls: down 24 to 46 from the first pass at near zoom; still 8 to 13 above the old level,
because a chunk now has three species meshes where it had two kinds (pine, oak). Zoom 1 costs
more tree triangles (LOD1 about 100 against the old 44, after 30% thinning). Frame time p50 was
13.7 to 13.9 ms before and after at zoom 2 on this machine.

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
- `before/` and `after/`: army and woods views at zooms 2, 1, 0.6, with `*-report.json`
  (triangles, draw calls, tree triangles, trees drawn).
- `kits/`: each kit's woods at zooms 1 and 0.6 through `&vegetation=<kit>`.

## Open points

- Near-zoom draw calls are 8 to 13 above the old level (three species meshes a chunk against two
  kinds). Going lower means fewer species per chunk (for example one species in the far skirt).
- Zoom 1 tree triangles are up 46% (about 87k over the field); a lighter LOD1 crown or keeping
  60% of the trees at LOD1 would bring it back.
- The desert date palms' fronds now read dark at zoom 1 after the tone pass (darker than the
  acacias); a lighter `date_frond` would fix it.
- Groves still use the first species' `tree-l` / `tree-m` only.
- The sandbox fights on a temperate tile; other kits were checked with `&vegetation=`.
