# MD05 / I217 and MD14: battle trees and the steppe kit (14 October 2026)

Branch `claude/art-md05-trees` (from `claude/integration` at dbc96467, which holds c7af37ef).
Brief: plans/playtest-audits-art-update-2026-10-13.md section 4 and row MD14. Complaint, checked
in a forest battle at 844x390: one species everywhere in flat-shaded shards, crowns floating on
thin trunks, dense woods a spiky dark mass hiding the men under it.

## What was built

| File | Species (first: tree-s/m/l, then -2, -3, -4) | Status |
|---|---|---|
| `vegetation-temperate.glb` | oak, beech, birch | rebuilt (trees only) |
| `vegetation-mediterranean.glb` | olive, stone pine, cypress | rebuilt (trees only) |
| `vegetation-desert.glb` | date palm, acacia, tamarisk | rebuilt (trees only) |
| `vegetation-steppe.glb` (new, MD14) | poplar, wind-bent elm, saxaul; tall feather grass as `grass-tuft`; stump, felled, bush, rocks, log-pile | new |
| `vegetation-conifer-species.glb` (new) | -2 Scots pine, -3 fir (the kit's own: spruce) | new companion |
| `vegetation-tropical-species.glb` (new) | -2 coconut palm, -3 buttressed jungle tree, -4 banana | new companion |
| `vegetation-cold-species.glb` (new) | -2 larch, -3 dwarf birch, -4 tundra shrub | new companion |

- Trees: `scripts/blender/ti_trees.py` (new). Trunk: one tube with a flared foot, bare for the
  lower third to half. Crown: a few large icosphere clumps, barely jittered, exported with
  smoothed normals (new `ti_town.SMOOTH` set; every other builder stays flat). LOD1 is the trunk
  and one 80-face rounded mass the size of the crown; LOD2 the same at 20 faces (palms keep a
  few wide fronds). Lighter leaf colours, one hue per species.
- `build_nature.py`: `species_items` names the objects; each tree has its own random stream (from
  its name). The old trees are still run into a throwaway mesher before the stump, so the stump,
  felled trunk, bush, rocks, tuft and log pile keep their shapes. New files are appended at the
  end of FILES, so no old file's seed moved. `soft_crown_uvs`: the far crown's faces take their
  colour from a lit, open full-model leaf face (not one pressed inside another clump, not the
  darkest third), so far woods are not speckled with black triangles.
- The pinned conifer, tropical and cold kits are untouched (`checkpoint38-lod-uvs.mjs`: 14
  models, hashes unchanged). Their extra species ship as `vegetation-<kit>-species.glb`
  (the same pattern as `log-piles.glb`); `artIndex.vegetationSpecies(kit)` finds one for the
  exact kit only.
- `kitLoader.parseKit`: a kit with species objects (`tree-s-2` ...) is never "repaired" (the
  repair for the old temperate file would put the far faces back on dark inner faces).

## Renderer (`src/battle/art/vegetationProps.js`, `treeMix.js`)

Every procedural tree keeps its place, turn and shade; `treeAt(x, z)` (a hash of the place, never
Math.random) gives its species (stands of 9 tiles share a leading species, 60% of their trees),
size (30 / 42 / 28% small / medium / large), rank and own scale (0.86 to 1.14).

| Zoom | LOD | Trees drawn | Meshes |
|---|---|---|---|
| 2 and up | 0 | all, each its own species and size | one per chunk, species and size |
| 0.9 to 2 | 1 | the 70% of lowest rank | one per chunk and species: the medium tree's LOD1 scaled to each tree's size |
| below 0.9 | 2 | the 52% of lowest rank, 14% larger | as LOD1, with the LOD2 geometry |

The trees kept far are always among those kept nearer (instances sorted by rank, `mesh.count`
cut), so zooming never swaps neighbours. Only drawing changes: forest tiles block, slow and hide
as before; groves (`economyLayer.js`) still read `tree-l`, `tree-m`, `felled`, `stump` and the
log pile. The sandbox takes `&vegetation=<kit>` (drawing only) for art checks.

## Triangles (LOD0 / LOD1 / LOD2, budget 600 / 150 / 150; validator kind `tree`)

The validator holds 150 at LOD1 (TRIANGLE-BUDGET.md asks 200): the stricter limit is kept.

| File | Trees |
|---|---|
| temperate | oak 309/40/26, 397/100/26, 485/100/26; beech 309/40/26, 397/100/26, 477/100/26; birch 280/40/26, 280/100/26, 360/100/26 |
| mediterranean | olive 317/40/26, 397/100/26, 485/100/26; stone pine 387/48/32, 477/108/32, 557/108/32; cypress 280/40/26, 360/100/26, 360/100/26 |
| desert | date palm 177/88/46, 261/88/46, 285/88/46; acacia 387/48/32, 477/108/32, 567/108/32; tamarisk 380/38/26, 480/38/26, 580/98/26 |
| steppe | poplar 280/40/26, 360/100/26, 360/100/26; elm 309/40/26, 397/100/26, 477/100/26; saxaul 380/38/26, 480/38/26, 580/98/26 |
| conifer-species | pine 309/40/26, 397/100/26, 485/100/26; fir 280/40/26, 360/100/26, 440/100/26 |
| tropical-species | coconut 177/88/46, 249/88/46, 261/88/46; jungle 321/40/26, 413/100/26, 493/100/26; banana 132/88/46, 144/88/46, 156/88/46 |
| cold-species | larch 280/40/26, 360/100/26, 440/100/26; dwarf birch 309/40/26, 397/40/26, 397/100/26; tundra shrub 380/38/26, 480/38/26, 580/38/26 |

Stump, felled, bush, rocks and log pile: unchanged counts (270/39/13, 214/137/65, 100/28/28, ...).

## Frame cost (forest sandbox, bronze, tile 373 = temperate kit, 844x390 at scale 3, Intel UHD, D3D11)

From the `&perf` readout (`renderer.info`, main pass and shadow pass).

| View, zoom | Triangles before | after | Draw calls before | after |
|---|---|---|---|---|
| army, 2 | 1,718k | 1,542k | 97 | 133 |
| army, 1 | 739k | 762k | 110 | 111 |
| army, 0.6 | 515k | 436k | 116 | 123 |
| woods, 2 | 2,047k | 1,803k | 81 | 138 |
| woods, 1 | 722k | 813k | 114 | 124 |
| woods, 0.6 | 340k | 271k | 140 | 151 |

Near zoom: fewer triangles (10 to 12%) but 36 to 57 more draw calls (a mesh per chunk, species
and size; frame p50 was 13.8 ms before and after on this machine). Zoom 1: +3% and +13%
triangles (the old LOD1 was about 44 triangles, the new about 100, after 30% thinning). Far:
15 to 20% fewer triangles.

## Commands

```
blender -b --factory-startup -P scripts/blender/build_nature.py -- art-build/md05/out vegetation-temperate,vegetation-mediterranean,vegetation-desert,vegetation-steppe,vegetation-conifer-species,vegetation-tropical-species,vegetation-cold-species
"<Blender>/5.2/python/bin/python.exe" -I scripts/blender/validate_model.py art-build/md05/out/vegetation-<name>.glb <out> tree   (all 7 PASSED, before packing; the validator rejects packed files by design: uncompressed_geometry)
blender -b --factory-startup -P scripts/blender/tree_sheet.py -- art-build/md05/out/vegetation-<name>.glb art-build/md05/sheet-<name>
npm run pack:models -- src/assets/battle/nature/vegetation-<name>.glb ...
node scripts/build.mjs && node scripts/preview.mjs --port 5203
node plans/art-pilot/md05-trees/forest-shots.mjs plans/art-pilot/md05-trees/after after
ZOOMS=1 node plans/art-pilot/md05-trees/forest-shots.mjs plans/art-pilot/md05-trees/kits <kit> vegetation=<kit>
```

## Evidence

- `sheets/sheet-<file>.jpg` (and `-phone.jpg`, a quarter size): front row LOD0, then LOD1, LOD2;
  a 1.8 m post for scale; the kit's other objects in front.
- `before/` (origin/claude/integration) and `after/`: army and woods views at zooms 2, 1, 0.6,
  with `*-report.json` (triangles, draw calls, trees drawn).
- `kits/`: each kit at zoom 1 through `&vegetation=<kit>`.

## Open points

- Draw calls at near zoom rose by about 40 to 57 (one mesh per chunk, species and size). If a
  phone shows it, LOD0 could also use one mesh per species and only scale the sizes.
- Pale crowns (tamarisk, olive, saxaul) still read grey-white in the game's bright light at far
  zoom; the steppe and desert woods look washed out next to the temperate one.
- The pinned conifer kit's own spruce LOD1 draws as striped dark and white cones, and the pinned
  tropical palm's far fronds are near black. Both are in the pinned files (not changed here);
  fixing them means rebuilding those files and re-pinning, or a load-time uv repair for them.
- The wind-bent elm leans whichever way its random turn points; a shared wind direction would
  need the renderer to fix the elm's turn.
- Groves still use the first species' `tree-l` / `tree-m` only.
- The sandbox fights on a temperate tile; other kits were checked with `&vegetation=`.
