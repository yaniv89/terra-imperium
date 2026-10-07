# Resource nodes, herds and vegetation

Read by `src/battle/render/economyLayer.js` (nodes, herds, groves) and
`src/battle/art/vegetationProps.js` (the battlefield's trees, rocks and grass). Spec:
`plans/ART-MODELS-PLAN.md` section 7, `plans/ART-PRODUCTION-PLAN.md` S9.

## Files and objects
| File | Objects | Budget (LOD0 / LOD1 / LOD2) |
|---|---|---|
| `stone-outcrop.glb`, `ore-outcrop.glb`, `gold-vein.glb`, `fish-shoal.glb` | `full` (more than half left), `half`, `depleted` (a low stump or pit that does not block) | 1,500 / 300 / 80 |
| `herd-sheep-goat.glb`, `herd-cattle.glb` | `animal` (one animal at real size; the game places 2 or 3 round the node, fewer as it is used up) | 400 / 150 / 60 |
| `vegetation-<kit>.glb` (kits: temperate, conifer, mediterranean, tropical, steppe, desert, cold) | `tree-s`, `tree-m`, `tree-l`, `stump`, `felled`, `bush`, `rock-s`, `rock-m`, `grass-tuft` | 600 / 150 / 150 (LOD2 may be a 2-triangle impostor) |

Every object has `LOD0`, `LOD1`, `LOD2` children; materials `Town` (and `Ground` for a ground
patch); one 1024 atlas per file. Herd animals are drawn in their rest pose for now (rigid or
rigged; the clips come with the VAT pipeline, plan Wave 0b).

## Scale and placement
- 1 Blender unit = 10 m, Z up, front to Blender -Y, origin at the footprint centre on Z = 0.
- True scale: 2.75 battle tiles per model unit. Node footprints 4 to 8 m, trees 3 to 8 m.
- Battlefield props: pines take `tree-l`, broad trees `tree-m`, boulders `rock-m`, grass tufts
  `grass-tuft`, keeping every placement, turn, size and shade; LOD0 only when zoomed in close.
- Groves (wood nodes): `tree-l`, then `tree-m`, `felled`, `stump` as they are cut.

## Fallback
The battle's kit comes from the tile's climate (Koppen: A tropical, BW desert, BS steppe, Cs
mediterranean, C temperate, Dc/Dd conifer, other D temperate, E cold; else the battle terrain).
A missing kit falls back: cold to conifer, desert to steppe, then everything to temperate. No file:
the code's trees, rocks and greybox nodes stay.

## Check
`validate_model.py <file> <out> auto` (kinds `node`, `herd`, `tree`), `npm run pack:models`,
`/?battleSandbox`.
