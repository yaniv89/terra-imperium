# Berry bushes and stump variants (W12, 16 October 2026)

Branch `claude/art-berries-stumps`, on top of `claude/integration` at `ec440f37` (the merge of
`claude/pa-w12-rts-resources`: treeFelling.js, the berry node kind, instanced stumps).

## What was made

1. `src/assets/battle/nature/berry-bushes.glb`: the berry bush food node, built by
   `scripts/blender/build_nature.py` (`berry_bushes`, `berry_items`; appended last to FILES so every
   other file keeps its seed). Twelve roots, each with LOD0 / LOD1 / LOD2:

   | Band | Roots | Look |
   |---|---|---|
   | temperate | `full`, `half`, `depleted` | dark green bramble mounds, arching canes, bright red berries |
   | dry (mediterranean, desert, steppe) | `full-dry`, `half-dry`, `depleted-dry` | low olive-green shrub (myrtle, juniper), dark violet berries |
   | cold (cold, conifer) | `full-cold`, `half-cold`, `depleted-cold` | four ground-hugging bilberry mats, blue berries |
   | tropical | `full-tropical`, `half-tropical`, `depleted-tropical` | glossy broadleaf bush with big leaves, orange fruit |

   Full is a mound studded with berry clusters (four berries a cluster) on the upper faces the battle
   camera sees. Half is thinner (one clump gone), with fewer clusters and bare twigs out of the
   picked side. Depleted is low, dull khaki-olive mounds with bare twigs and dropped leaves, no berry
   at all and no leaf the colour of a full bush: it cannot be read as a full one. Berries are far
   larger than life on purpose: the colour is what reads at phone zoom.

2. `stump-2` and `stump-3` in all seven vegetation kits (temperate, mediterranean, desert, steppe,
   conifer, tropical, cold; `stump_variants` in build_nature.py, appended after every older object):
   - `stump-2`: a tall trunk snapped off, a jagged bark ring round a pale splintered core, four
     roots, the broken top lying beside it with two snapped limbs, splinters on the ground.
   - `stump-3`: a low sawn stump with a pale top, its trunk sawn into a log lying beside it, fresh
     chips round it.
   - Bark from the kit's own trees: temperate oak, mediterranean olive and stone pine red, desert
     acacia (oak) and tamarisk (dark), steppe poplar (beech) and elm (oak), conifer spruce (dark) and
     Scots pine (red) with pine-coloured cut ends, tropical jungle hardwood with red-brown cut ends,
     cold larch (dark) and larch bark.
   - Each draws from a random stream of its own (from the kit and its name), never the file's, so
     every other object keeps its shape and triangles (checked below).

## Triangles (LOD0 / LOD1 / LOD2, packed files)

Berry bushes, budget `node` 1,500 / 300 / 80:

| Root | LOD0 | LOD1 | LOD2 |
|---|---|---|---|
| full | 1,454 | 184 | 76 |
| half | 982 | 164 | 64 |
| depleted | 784 | 110 | 56 |
| full-dry | 1,382 | 184 | 76 |
| half-dry | 932 | 156 | 64 |
| depleted-dry | 770 | 110 | 56 |
| full-cold | 1,462 | 196 | 76 |
| half-cold | 906 | 156 | 64 |
| depleted-cold | 766 | 106 | 56 |
| full-tropical | 1,206 | 156 | 76 |
| half-tropical | 892 | 152 | 64 |
| depleted-tropical | 774 | 102 | 56 |

Stumps, budget `tree` 600 / 150 / 150 (the same in every kit):

| Object | LOD0 | LOD1 | LOD2 |
|---|---|---|---|
| `stump-2` | 175 | 27 | 12 |
| `stump-3` | 193 | 68 | 32 |

Every older object of all seven kits has the same triangles per LOD as before (compared root by root
against the packed files at `ec440f37`).

## Textures

| File | Atlas | Change |
|---|---|---|
| berry-bushes.glb | 1024 (base, normal, ORM WebP) | new, the same size as stone-outcrop and gold-vein |
| vegetation-*.glb (7) | 1024, as before | no size change; the shared atlas is re-packed round the two new stumps, so every object's texels move a little |

Packed sizes: berry-bushes 0.7 MB; the kits grew 23 to 61 KB each.

## How the code picks them (render only, the sim is untouched)

- Berries: `src/battle/art/vegetation.js` `berryBand(kit)` maps the battle's vegetation kit
  (`vegetationKitFor(setup)`: the tile's Koppen climate, else the terrain, else `&vegetation=`) to
  `''` (temperate and any unknown kit), `'dry'` (mediterranean, desert, steppe), `'cold'`
  (cold, conifer) or `'tropical'`. `EconomyLayer` keeps it as `this.berryBand`, and
  `nodeObjectNames('berries', frac, band)` (economyLayer.js) asks for `full-cold` then `full`, and
  so on down `nodeStateNames(frac)`, so a band missing from the file falls back to temperate. The
  file is `NODE_KINDS.berries.art = 'berry-bushes'` as the code session set it; the greybox
  (`NODE_PARTS.berries`) still draws when the file is not loaded.
- Stumps: `VegetationProps.setKit` keeps `stumpObjs` (the kit's `stump`, `stump-2`, `stump-3` that
  exist, `STUMP_NAMES` in vegetation.js). `TreeFelling` makes one instanced mesh per variant (three
  draw calls for all stumps of the field instead of one) and each stump takes
  `stumpVariant(tile, k, n)`, a hash of its tile and its place on the tile (never Math.random), so a
  tile always shows the same stump. A kit with only `stump` uses one mesh as before.
- Tests: `src/battle/render/economyArt.test.js` (bands and names) and
  `src/battle/render/treeFelling.test.js` (the pick is pure and spread, stumps go to their variant's
  mesh, a redraw draws the same).

## Pins

`scripts/art/checkpoint38-lod-uvs.mjs` pins the conifer, tropical and cold kits: hashes moved with a
dated reason, roots 74 to 80, lower levels 148 to 160. The script no longer ran at the base
(kitLoader.js now imports `onGltfEvict`); it gets a no-op for it and passes: 14 models, 0 UV
rewrites, 0 index or triangle changes.

## Evidence in this folder (JPEG quality 82)

| Picture | What it shows |
|---|---|
| `berries-large.jpg`, `-lod1`, `-lod2` | the twelve roots (rows: temperate, dry, cold, tropical; columns full, half, depleted) |
| `berries-phone-zoom1.jpg`, `@6x` | at the phone's zoom 1 (59.6 px a unit, LOD0); a node is about 25 px |
| `berries-phone-zoom06-lod1@8x.jpg` | at zoom 0.6, LOD1 |
| `berries-phone-zoom045-lod2@10x.jpg` | at zoom 0.45, LOD2 |
| `stumps-large.jpg` | rows: temperate, mediterranean, desert, steppe, conifer, tropical, cold; columns `stump`, `stump-2`, `stump-3` |
| `stumps-phone-zoom1@6x.jpg`, `stumps-phone-zoom06-lod1@8x.jpg` | the same at phone zoom |
| `game-berries-temperate.jpg`, `game-berries-near-*.jpg` | the production build at 844x390 DPR 3, a berry pair (temperate default zoom; temperate, cold and tropical closer) |
| `game-cut-wood-*.jpg` | a wood felled 70 percent (drawn by calling TreeFelling.update with a view of it; drawing only), stumps of all three variants |

The in-game shots: production build (`npx vite build`), `npx vite preview --port 5222`, Chrome with
the GPU flags, `?battleSandbox&autostart&perf&terrain=forest&age=bronze` (plus `&vegetation=cold`
or `tropical`). No console errors.

## Commands

```
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
PY="/c/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe"
"$B" -b --factory-startup -P scripts/blender/build_nature.py -- art-build/nature berry-bushes
"$B" -b --factory-startup -P scripts/blender/build_nature.py -- art-build/nature vegetation-temperate   # one kit a run, about 90 s
cp art-build/nature/*.glb src/assets/battle/nature/
"$PY" -I scripts/blender/validate_model.py src/assets/battle/nature/berry-bushes.glb art-build/validation auto
npm run pack:models -- src/assets/battle/nature/berry-bushes.glb src/assets/battle/nature/vegetation-*.glb
"$B" -b --factory-startup -P scripts/blender/render_kit_zoom.py -- OUT.png 59.6 0 3 --mag 6 art-build/nature/berry-bushes.glb
"$B" -b --factory-startup -P scripts/blender/render_kit_zoom.py -- OUT.png 400 0 3 --mag 1 --only stump,stump-2,stump-3 art-build/nature/vegetation-*.glb
node scripts/art/checkpoint38-lod-uvs.mjs
```

`render_kit_zoom.py` gained `--only NAME,NAME` (just those objects of each file).

## Still weak

- The dry band's dark violet berries on an olive shrub read least well of the four, most of all at
  LOD2 (two or three violet pixels). Kept dark as asked; a lighter violet would read better.
- At the default battle zoom on a phone a berry node is small (a pair is about 60 px wide at DPR 3,
  20 css px): the red reads, the shape barely does.
- `stump-2` and `stump-3` carry a log about 3 m long beside the stump; in a dense wood the logs of
  neighbouring stumps cross each other (see the near cut-wood shot). Fine for a cleared patch, busy
  in a tight one.
- The temperate and Mediterranean `stump` is still the MD06 cluster of three stumps, so a felled
  tree that picks it shows three small stumps where the others show one.
