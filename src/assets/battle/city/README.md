# City destruction: walls, ruins, damaged houses, forts

Read by `src/battle/render/cityLayer.js` (the battle), `src/components/map/closeView/townDamage.js`
(the close view of the map) and `src/battle/art/structureArt.js` (forts). Rules in
`src/battle/art/cityArt.js`. Spec: `plans/ART-MODELS-PLAN.md` section 6, `plans/ART-PRODUCTION-PLAN.md` S6, S7.

## Files and objects
| File | Objects | Budget (LOD0 / LOD1 / LOD2) |
|---|---|---|
| `walls-<age>.glb` | `wall-straight` (10 m long along model x, the outer face to -Y in Blender), `wall-corner`, `tower`, `gate-open`, `gate-closed`; each also `-damaged` and `-breached` | 1,500 / 400 / 80 a piece |
| `ruins-<age>.glb` | `rubble-s` (8 m), `rubble-m` (14 m), `rubble-l` (24 m), `beams`, `scorch` | 1,200 / 300 / 80 |
| `<age>-<theme>-houses-damage.glb`, base kit `<age>-houses-damage.glb` | `<house>-damaged` and `<house>-ruined` for every house type of the theme's town kit (`house-poor-damaged`, `house-common-ruined` ...) | damaged 2,500 / 600 / 120, ruined 1,200 / 300 / 80 |
| `fort-<age>.glb` | `fort` (fits a 50 m circle) | as a tile improvement, 8,000 / 1,500 / 300 |

Every object has `LOD0`, `LOD1`, `LOD2` children. Materials `Town`, `Team`, `Ground`, the town kit's
atlas for the houses.

## Scale and placement
- 1 Blender unit = 10 m, Z up, front to Blender -Y, origin at the footprint centre on Z = 0.
- Walls: a ring segment stretches `wall-straight` along its length (true height and thickness);
  the outer face looks away from the keep. Gates stay open in battle (`gate-open`). The ring's
  towers take `tower`. Under 70% HP `-damaged`, when down `-breached`.
- Houses: the town layout keeps only each house's ground, so a house takes the type whose ground
  (from its `-damaged` object) is nearest its own, turned a quarter if that fits better, fitted to
  it (at most a third bigger or smaller). The house is cut out of the town file and the piece
  stands in its place. Keep the damaged and ruined footprint inside the intact one.
- Rubble: a ruined structure without a house piece takes the rubble nearest its size.
- Fort: stands in for the keep of a fortified place that is not a real city, 8 battle tiles across
  with walls, 4.5 without.

## Fallback
Walls, ruins and forts: the age's file, else the nearest earlier age's. Houses: the theme along
`styleChain` (korea and japan to sinic, andalus and israelite to levant ...), then the age's base
file, never another age. Forts then fall back to the map's fort improvement
(`src/assets/map/improvements/fort-<age>[-<style>].glb`). Without files: boxes for walls, the
renderer's towers, grey mounds for rubble, darkened and cut-out houses.

## Check
`python3 scripts/blender/validate_model.py <file> <out> auto` (kinds `wall-kit`, `ruin`,
`house-damage`, `improvement`), `npm run pack:models`, `/?battleSandbox&city=medium`.
