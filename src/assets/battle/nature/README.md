# Resource nodes, herds and vegetation

Read by `src/battle/render/economyLayer.js` (nodes, herds, groves) and
`src/battle/art/vegetationProps.js` (the battlefield's trees, rocks and grass). Spec:
`plans/ART-MODELS-PLAN.md` section 7, `plans/ART-PRODUCTION-PLAN.md` S9.

## Files and objects
| File | Objects | Budget (LOD0 / LOD1 / LOD2) |
|---|---|---|
| `stone-outcrop.glb`, `ore-outcrop.glb`, `gold-vein.glb`, `fish-shoal.glb` | `full` (more than half left), `half`, `depleted` (a low stump or pit that does not block) | 1,500 / 300 / 80 |
| `herd-sheep-goat.glb`, `herd-cattle.glb` | `animal` (one animal at real size; the game places 2 or 3 round the node, fewer as it is used up) | 400 / 150 / 60 |
| `log-piles.glb` | `log-pile-conifer`, `log-pile-tropical`, `log-pile-cold` (the grove's log pile for the kits without one; `build_nature.py`, one 512 atlas) | 1,500 / 300 / 80 (they use 212 / 176 / 72 at most) |
| `vegetation-<kit>.glb` (kits: temperate, conifer, mediterranean, tropical, steppe, desert, cold) | `tree-s`, `tree-m`, `tree-l` (the first species), `tree-s-2` ... `tree-l-3` (more species, MD05), `stump`, `felled`, `bush`, `rock-s`, `rock-m`, `grass-tuft`, `log-pile` | 600 / 150 / 150 (LOD2 may be a 2-triangle impostor) |
| `vegetation-<kit>-species.glb` (conifer, tropical, cold) | `tree-s-2` ... `tree-l-4`: more species for the kits whose own file is pinned (`build_nature.py`) | 600 / 150 / 150 |

## The four resources (2026-10-13, manifest row MD06)
The battle has food, wood, stone and gold. Each node is told from the others by colour and shape,
and its states by height:
- Stone (`stone-outcrop.glb`): pale grey and square. Sawn benches step up a quarry face, loose cut
  blocks lie in front. `half` is one low bench, `depleted` a flat bed of rubble round a dark pit.
- Gold (`gold-vein.glb`): dark pointed crags with bright yellow seams in the rock faces and nuggets
  at the foot. `half` is two low crags, `depleted` a dark rubble bed with three specks left.
- Fish (`fish-shoal.glb`): a light patch of stirred water with ripples, dark fish under it and
  silver fish leaping. `half` is a smaller patch with one leaper, `depleted` a small grey patch
  with one fish.
- Wood has no node file: a grove is the kit's `tree-l`, then `tree-m`, then `felled` (the trunk
  down by its pale-topped stump, logs stacked), then `stump` (three pale-topped stumps and chips),
  and the game stands the kit's `log-pile` beside it, the mark that says wood node and not one
  more tree. The conifer, tropical and cold kits (built by another pipeline, pinned by hash) have
  no `log-pile`: the game takes `log-pile-conifer`, `log-pile-tropical` or `log-pile-cold` from
  `log-piles.glb` for them (pale pine, dark hardwood, thin birch and larch).
- Ore is retired. `ore-outcrop.glb` stays until the code stops pointing at it (the replacement
  plan is in plans/art-pilot/md06-nodes-loads/LOG.md).
`full` is 2.7 to 3.4 m tall, `half` 1.3 to 1.8 m, `depleted` under 0.4 m.

Every object has `LOD0`, `LOD1`, `LOD2` children; materials `Town` (and `Ground` for a ground
patch); one 1024 atlas per file. Herd animals are drawn in their rest pose for now (rigid or
rigged; the clips come with the VAT pipeline, plan Wave 0b).

## Scale and placement
- 1 Blender unit = 10 m, Z up, front to Blender -Y, origin at the footprint centre on Z = 0.
- True scale: 2.75 battle tiles per model unit. Node footprints 4 to 8 m, trees 3 to 8 m.
- Battlefield props: every tree keeps its place, turn and shade and takes a species and a size
  from a hash of its place (`src/battle/art/treeMix.js`: stands of a leading species, small,
  medium and large); boulders `rock-m`, grass tufts `grass-tuft`. LOD0 only when zoomed in close;
  at LOD1 and LOD2 a wood is thinned (70% and 52% of its trees drawn, the far ones 14% larger) so
  the crowns stand apart. Drawing only: forest tiles block and hide as before.
- Groves (wood nodes): `tree-l`, then `tree-m`, `felled`, `stump` as they are cut.

## Fallback
The battle's kit comes from the tile's climate (Koppen: A tropical, BW desert, BS steppe, Cs
mediterranean, C temperate, Dc/Dd conifer, other D temperate, E cold; else the battle terrain).
A missing kit falls back: cold to conifer, desert to steppe, then everything to temperate. No file:
the code's trees, rocks and greybox nodes stay.

## Check
`validate_model.py <file> <out> auto` (kinds `node`, `herd`, `tree`), `npm run pack:models`,
`/?battleSandbox`.

## Delivered
2026-10-07 (wave1 checkpoint-02, `scripts/blender/build_nature.py` over `ti_nature.py`):
`stone-outcrop`, `ore-outcrop`, `gold-vein`, `fish-shoal`, `herd-sheep-goat`, `herd-cattle`,
`vegetation-temperate`, `vegetation-mediterranean`, `vegetation-desert`. The conifer, tropical, steppe
and cold kits are still missing (cold and conifer fall back to temperate, steppe to temperate).

2026-10-13 (MD06, `plans/art-pilot/md06-nodes-loads/LOG.md`): `stone-outcrop`, `gold-vein` and `fish-shoal`
rebuilt for the four resources; `stump` and `felled` redrawn and `log-pile` added in the three kits.

2026-10-14 (MD05, MD14, `plans/art-pilot/md05-trees/LOG.md`, trees in `scripts/blender/ti_trees.py`):
the temperate (oak, beech, birch), mediterranean (olive, stone pine, cypress) and desert (date palm,
acacia, tamarisk) trees rebuilt as three species at three sizes, with sturdy trunks and soft crowns
(smoothed normals); `vegetation-steppe.glb` added (poplar, wind-bent elm, saxaul, tall feather
grass); `vegetation-conifer-species.glb` (Scots pine, fir), `vegetation-tropical-species.glb`
(coconut palm, buttressed jungle tree, banana) and `vegetation-cold-species.glb` (larch, dwarf
birch, tundra shrub) add species to the pinned kits.
