# Wave 4 checkpoint 22: the Kingdoms battle buildings

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (14 queue items `rts/kingdoms/<role>` and `construction-set`).
[Manifest](manifest.json), [checksums](SHA256SUMS.txt), [contact sheet](contact.png): a Kingdoms city
battle in the sandbox at 844x390 (`city=medium&age=kingdoms&fort=2`, style europe) and the Blender
proofs of all 30 objects. Shots: `plans/art/shots/wave4/rts-kingdoms/`.

## Delivered
`src/assets/battle/rts/rts-kingdoms.glb` (1.94 MB packed, one 1024 atlas): the 13 roles
(expedition-camp, town-hall, food-depot, materials-yard, trade-post, farm-plot, mine, barracks, range,
stable, siege-workshop, aid-post, tower), each with `-damaged` and its sockets, and the four
construction stages. `scripts/blender/build_rts_kingdoms.py`: the Classical layouts, sockets, damage
and grounding (build_rts_classical.py, build_rts_bronze.py) with the Roman house swapped for the
half-timbered Kingdoms town house (ti_kingdoms.town_house, slate roofs, rubble footings), cypresses
for broadleaf trees and the stone, plaster and tile renamed to the Kingdoms wall stone, lime and slate.
validate_model.py `auto` (prefab): pass.

## Wired
Nothing new needed: `artIndex.rts('kingdoms')` now finds the age's own file (before, Kingdoms battles
drew the Classical buildings by the age chain). No console errors.

## Seen, not fixed here
The Kingdoms city in battle still has the procedural keep, walls and rubble: the Kingdoms city kit
(walls, ruins, fort, civic hall) is the next checkpoint.
