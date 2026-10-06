# Battle terrain: river banks, fords, bridges

Read by `src/battle/art/battleTerrain.js` from the battle map's tiles (`mapgen.js` WATER, FORD and
ROAD). Spec: `plans/ART-MODELS-PLAN.md` 8.1, `plans/ART-PRODUCTION-PLAN.md` S11.

## Files and objects
| File | Objects | Placement |
|---|---|---|
| `river-kit.glb` | `bank`: one battle tile of river bank, 0.36 units (3.6 m) along model x, the water on its Blender -Y side (glTF +Z) | on every edge between water and land |
| `ford.glb` | `ford`: stones and shallows filling one battle tile (0.36 x 0.36 units) | on every ford tile, a random quarter turn |
| `bridge-wood.glb`, `bridge-stone.glb`, `bridge-steel.glb` | `bridge-<material>`, `bridge-<material>-damaged`, `bridge-<material>-destroyed`, each with empties `socket-end-a` and `socket-end-b` at its two ends | over every road crossing, stretched between the banks along its end sockets |

Budget: 4,000 / 1,000 / 200 a piece. `LOD0`, `LOD1`, `LOD2` children. Materials `Town`, `Ground`.

## Scale
1 Blender unit = 10 m, Z up, origin on the ground at the piece's centre. True scale (2.75 battle
tiles a unit) across, a bridge stretched along its span. The deck sits at the higher bank's level.

## Fallback
Bridges by age: Bronze wood, Classical to Gunpowder stone, Modern steel; a missing material falls
back to the lighter one (steel to stone to wood). Only intact bridges are drawn until the sim gives
bridges HP (the `-damaged` and `-destroyed` objects are read then). No files: the plain water,
the ground shader's ford tint and the road stay.

## Check
`validate_model.py <file> <out> auto` (kind `terrain-kit`), `npm run pack:models`,
`/?battleSandbox` on a river map.
