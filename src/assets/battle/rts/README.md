# Battle buildings: `rts-<age>.glb`

One file per age (`rts-bronze.glb`, `rts-classical.glb`, `rts-kingdoms.glb`, `rts-gunpowder.glb`,
`rts-modern.glb`). Read by `src/battle/render/economyLayer.js` through `src/battle/art/artIndex.js`.
Spec: `plans/ART-MODELS-PLAN.md` section 5, `plans/ART-PRODUCTION-PLAN.md` S5.

## Objects (root names)
| Object | Notes |
|---|---|
| `expedition-camp`, `town-hall` | HQ budget |
| `food-depot`, `materials-yard`, `trade-post`, `farm-plot`, `mine`, `barracks`, `range`, `stable`, `siege-workshop`, `aid-post`, `tower` | the roles |
| `house` | optional: the village house (a greybox without it) |
| `generator`, `airfield`, `radar-aa` | Modern extras (read once the sim has them) |
| `<role>-damaged` | drawn under 70% HP, same origin and footprint |
| `construction-stage-0` .. `construction-stage-3` | foundation, then scaffold stages, by build progress (0-24, 25-49, 50-74, 75-100%); fitted to the footprint of the building going up |

Each root holds `LOD0`, `LOD1`, `LOD2` children (a second object's are `LOD0.001` and so on, that is
fine) and optional empties: `socket-door` (on the -Y side, where trained units come out),
`socket-rally`, `socket-banner`, `socket-fire-1`..`4`, `socket-smoke-1`.., `socket-drop`.

## Scale, orientation, materials
- 1 Blender unit = 10 m, Z up, the front (entrance) faces Blender -Y, origin at the footprint centre
  on Z = 0, no ground plate.
- The game fits each building to its footprint (the largest of width and depth = the sim's
  footprint in battle tiles, 2 to 4 tiles of 3.6 m). Footprints: small 8-10 m, medium 12-16 m,
  large 18-24 m.
- Materials `Town`, `Team` (grey `#BFBFBF`, takes the side's colour), `Ground`; one 2048 atlas.

## Budgets (triangles LOD0 / LOD1 / LOD2)
8,000 / 2,000 / 400; `town-hall` and `expedition-camp` 15,000 / 3,000 / 600.

## Fallback
A side's age uses its own file, else the nearest EARLIER age with a file (a Gunpowder battle with
only `rts-bronze.glb` draws the Bronze buildings), else the greyboxes. A role missing from the file
stays a greybox; a missing `-damaged` keeps the whole building; missing construction stages show the
building rising out of the ground.

## Delivered
`rts-bronze.glb` (2026-10-07, `scripts/blender/build_rts_bronze.py`, from the Bronze town kit): the
13 roles above with their `-damaged` siblings and sockets; no `house`, construction stages or farm
growth stages yet. Until later ages have files, their battles fall back to it.

## Check
`python3 scripts/blender/validate_model.py <file> <out> auto` (kind `prefab`), then
`npm run pack:models`, then `/?battleSandbox` with an economy battle.
