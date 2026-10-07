# Map terrain kits: `<id>.glb`

Read by `src/components/map/closeView/terrainKits.js`. Spec: `plans/ART-MODELS-PLAN.md` 8.4,
`plans/ART-PRODUCTION-PLAN.md` S11. Model units like the towns: 1 Blender unit = 10 m, Z up, front
to Blender -Y, origin on the ground. Budget 4,000 / 1,000 / 200 a piece, `LOD0`..`LOD2` children
(the close view draws LOD1), materials `Town`, `Ground`.

| File | Objects | Used |
|---|---|---|
| `mountain-ridges.glb` | `ridge-1`, `ridge-2`, `ridge-3`: a ridge segment 2 units long along model x with its crest along x, about 1.1 wide and 1.15 high; `ridge-1-snow`..`ridge-3-snow` with snowcaps | now: replaces the code ridges in the close view, every placement kept |
| `hills.glb` | `hill` (or `hill-1`): a foothill about 2 units across | now: replaces the code hills |
| `cliffs.glb`, `dunes.glb`, `coasts.glb`, `lakes.glb`, `wetlands.glb`, `field-edges.glb` | per the plan's table 8.4 | loaded by `mapTerrainKit(id)`; placed once the placement code for them lands |

Fallback: a missing snowy ridge uses the plain one, a missing variant `ridge-1`; no file keeps the
code meshes. Check: `validate_model.py <file> <out> auto` (kind `terrain-kit`),
`npm run pack:models`, `/?tileViewer` close view.
