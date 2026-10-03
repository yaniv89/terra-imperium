# Gunpowder Age towns, palaces, bastioned walls, the colony camp and fields

Date: 2026-10-03. Sources: GPT's combined 1254 px concept sheets in
`plans/art/towns/gunpowder/<id>/reference-sheet.png` (batch READMEs beside them). Built in
Blender 4.2 (`bpy` module) on the shared kit (`ti_map.py`, `ti_town.py`, reusing pieces of
`ti_classical.py` and `ti_bronze.py`) plus the new `scripts/blender/ti_gunpowder.py`; one 2048
WebP atlas set per file. Builders: `build_town_gunpowder_<size>_<v>.py`,
`build_shared_gunpowder.py`.

| Object | File | Contents | LOD0 / LOD1 / LOD2 | Footprint | Height | Size |
|---|---|---|---|---|---|---|
| town-small-a | gunpowder-town-small-a.glb | stucco town hall with a sandstone clock tower NW, 7 houses (tile and slate gables, hip, mansard with awning), roofed well, lamps | 13,458 / 2,622 / 616 | 41 m | 10 m (tower) | 3.4 MB |
| town-small-b | gunpowder-town-small-b.glb | post windmill NE, 6 hipped houses with dormers and green shutters, market stall, well, rail fences | 11,072 / 2,860 / 546 | 41 m | 10.8 m (sails) | 3.0 MB |
| town-medium-a | gunpowder-town-medium-a.glb | domed baroque church NW (20 m), brick town hall with clock tower NE (16 m), 17 houses, 4 stalls | 30,836 / 4,950 / 1,100 | 61 m | 20 m | 4.7 MB |
| town-medium-b | gunpowder-town-medium-b.glb | brick town hall with a 20 m clock tower NE, windmill SW (14 m), 20 houses, 4 stalls | 32,244 / 4,986 / 1,034 | 61 m | 20 m | 4.9 MB |
| town-big-a | gunpowder-town-big-a.glb | domed church NW (28 m), town hall NE (26 m), windmill SW, SE bastion with cannon, 33 houses, 4 stalls | 49,743 / 7,577 / 1,268 | 81 m | 28 m | 6.5 MB |
| town-big-b | gunpowder-town-big-b.glb | twin-tower baroque church NW facing the square (28 m), town hall NE (28 m), windmill SW, grassed SE bastion, 30 houses among trees, 4 stalls | 47,054 / 7,696 / 1,188 | 81 m | 28 m | 6.3 MB |
| palace-small | shared-gunpowder.glb | manor: stucco, brick strips, sandstone quoins, 5 bays, pedimented door, team banners, slate mansard, 3 dormers, 2 chimneys | 1,560 / 228 / 28 | 8.1 m | 7.8 m | |
| palace | shared-gunpowder.glb | baroque palace on a U plan round a paved forecourt, brick wings under slate mansards, sandstone pavilion with columns and banners, lead dome and lantern | 3,916 / 840 / 196 | 12.1 m | 12.5 m | |
| walls-small | shared-gunpowder.glb | square bastioned trace: stone scarp, turf rampart, 4 bastions with cannon, sandstone gatehouse | 1,098 / 708 / 300 | 52 m | 5.3 m (guns) | |
| walls-medium | shared-gunpowder.glb | same with pentagonal bastions and a team pennant on the gate | 1,198 / 808 / 300 | 73 m | 9.5 m (pennant) | |
| walls-big | shared-gunpowder.glb | same, bigger, two more guns on the south curtain | 1,390 / 808 / 300 | 95 m | 11.5 m (pennant) | |
| colony-camp | shared-gunpowder.glb | plank hut with tiled roof, two canvas tents, fire ring, barrels, sacks, chest, logs, stakes on W and N, team flag | 3,486 / 1,976 / 418 | 20 x 18 m | 5.2 m | |
| field-1 | shared-gunpowder.glb | eight strips of wheat, ditch with sluice | 792 / 360 / 240 | 15 x 11 m | 1.2 m | |
| field-2 | shared-gunpowder.glb | six pear trees in mulched basins, two staked, trodden paths | 2,836 / 964 / 262 | 17 x 13 m | 2.5 m | |
| field-3 | shared-gunpowder.glb | pasture, whitewashed post-and-rail fence W and N, stone trough, paths | 582 / 550 / 142 | 15 x 13 m | 1.5 m | |
| field-4 | shared-gunpowder.glb | five ridged rows of flowering potatoes, ditch with a marker post on the west | 4,908 / 384 / 204 | 17 x 11 m | 1.3 m | 3.9 MB (all ten) |

Every file passes `validate_model.py` (the `*.validation.json` here and in
`/tmp/claude-0/out/gunpowder/`): budgets, Town / Ground (alpha-cut) / Team materials, one atlas
set, nothing below ground. `*-concept-vs-model.png`: each sheet's beauty panel beside the model.

## Variants
- **a** (French and Central European market towns): brown shutters, a mix of tile gables,
  slate gables, hips and mansards, a domed baroque church and a brick town hall with a clock
  tower; the small town has a stucco hall with a sandstone clock tower.
- **b** (the Low Countries and the North): green shutters, mostly brick under hipped roofs with
  dormers, post windmills, a twin-tower baroque church in the big town, and a tall clock tower
  on the town hall.

## Decisions
- House walls are 2.5 to 2.7 m storeys raised 1.3x (two storeys 5 m, three 7 m); at the full
  4.2 m the small towns' houses rose level with the 10 m clock tower, which the sheets show
  clearly above them. Landmarks and palaces stand at the sheets' heights.
- Detail that carries the age at map scale is geometry kept cheap: windows are a sandstone
  surround quad, a glass quad with glazing bars (in the material), a sill and lintel at LOD0,
  shutters on the fronts; string courses and cornices are single boxes round the house. LOD1
  keeps one glass quad per window, LOD2 a wall block and a closed roof solid per house.
- Roofs are closed solids (hip, mansard with its curb and dormers) or slabs plus gables
  (gable); slate and tile are brick-bond materials so the courses show at the super zoom.
- The palaces fit the free centre: the manor's 20 m front shrinks to 8 m with its proportions,
  and the 40 m U-plan palace to 12 m with its dome lifted to 12.5 m so it still leads the town.
- The bastioned walls are a new builder (`bastioned_walls`): straight curtains with a battered
  grey stone scarp, a sandstone cordon and a turf rampart with a parapet slope, angled bastions
  (frustums of a plan polygon, a turf cap, a packed-earth gun platform, a cannon aimed out of
  the corner), a sandstone gatehouse with an arched timber gate and a road. The inner foot of
  each trace sits just inside the town ground's ragged rim (1.9, 2.86 and 3.86 units), and the
  bastions push the outer size to 52, 73 and 95 m (the sheets' 54, 78 and 104 m, a little
  above the brief's 44 / 64-69 / 86-90 m; smaller bastions stopped reading as bastions).
  Heights follow WALL_RAISE (3, 4 and 5 m walls raised 1.3x).
- The camp reuses the Bronze tents, fire ring, log bundles and stakes with a new plank hut
  under a tiled roof and barrels with iron hoops. Fields: wheat reuses the Bronze field builder
  with a gold wheat material; pears get a foliage material dotted with fruit; the pasture fence
  is square whitewashed posts and rails.
- The cobbled ground is a fine paving bond; at the far zoom it reads as grey with a faint
  banding, which matches the sheets' grey streets.
