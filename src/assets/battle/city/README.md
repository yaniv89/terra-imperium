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
| `civic-<age>.glb`, `civic-<age>-<theme>.glb` | `keep`, `keep-damaged`, `keep-ruined`: the town hall (the battle objective) | 15,000 / 3,000 / 500 |
| `palace-damage-<age>[-<theme>].glb` | `palace-damaged`, `palace-ruined`, `palace-small-damaged`, `palace-small-ruined` (same origin as the shared file's `palace`, `palace-small`) | damaged 2,500 / 600 / 120, ruined 1,200 / 300 / 80 |

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
- Civic hall: the keep of every battle (a city's town hall, or an open field's objective) in the
  defender's theme (the city's land style; outside a city the defender's people theme), fitted to the
  keep's ground; `-damaged` under 70% HP, `-ruined` at 0. In a capital the palace stands on the keep
  and one building serves both.
- Palace: the shared file's intact palace; damaged and ruined from `palace-damage-<age>` (battle and
  the close view's capital). Wonders in a city battle are the map's own wonder models
  (`src/assets/map/wonders/<id>.glb`, highest tier; a `ruin` object if the file has one, else rubble).
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

## Delivered
2026-10-07 (wave1 checkpoint-02, `scripts/blender/build_city_bronze.py`): `walls-bronze.glb`,
`ruins-bronze.glb`, `fort-bronze.glb`; later ages fall back to these. Checkpoint-03: the Bronze house
damage files for the base kit and all 12 themes (`scripts/blender/build_houses_damage_bronze.py`).
Checkpoint-04/05: `civic-bronze.glb` and the 12 theme civic halls (`build_civic_bronze.py`,
`finish_civic_bronze.py`), `palace-damage-bronze.glb` (`build_palace_damage_bronze.py`,
`finish_palace_damage_bronze.py`); atlases shipped at 1024 (`node scripts/art/shrink-glb-textures.mjs
1024 <file>` before packing; the 2048 sources stay in the editable deliveries).
Wave 3 checkpoint 16 (2026-10-08): `classical[-<theme>]-houses-damage.glb` for the base kit and 12
themes (`build_houses_damage_classical.py`) and `palace-damage-classical.glb` from the shared Classical
palaces (`build_palace_damage_classical.py`), 1024 atlases.
