# Wave 5 checkpoint 28: the Gunpowder battle buildings

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status `in_game_awaiting_review`
(14 queue items `rts/gunpowder/<role>` and `rts/gunpowder/construction-set`). [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [contact sheet](contact.png): a Gunpowder economy battle in the sandbox at
844x390 (`?battleSandbox&autostart&spectate&city=medium&age=gunpowder`: the base, the town, the HUD)
and the Blender proof of all 30 objects. Shots: `plans/art/shots/wave5/rts-gunpowder/`.

## Delivered
`src/assets/battle/rts/rts-gunpowder.glb` (1.98 MB packed, 1024 atlas; `scripts/blender/build_rts_gunpowder.py`):
the 13 roles (expedition-camp, town-hall, food-depot, materials-yard, trade-post, farm-plot, mine,
barracks, range, stable, siege-workshop, aid-post, tower), each with `-damaged`, and
construction-stage-0..3, with the sockets of the other ages' files. In the Gunpowder town kit's stuff
(ti_gunpowder.py: brick and cream stucco on sandstone plinths, tile and slate roofs, sash windows):
- town-hall: a three-storey brick town hall under a mansard with its clock tower, in a walled court
  (the keep: 20 m, centred, the largest building);
- tower: a bastion gun platform (a battered brick tower, a parapet with embrasures, a cannon, a sentry
  box under slate);
- siege-workshop: a gun foundry (the gantry over a new barrel on trestles, gun wheels, a brick furnace
  with a tall chimney);
- the camp with gabions at its gate, a timber headframe at the mine, an earth gun butt at the range;
- the other roles are the Classical layouts with Gunpowder houses and materials (as rts-kingdoms.glb).
validate_model.py `auto` (prefab): pass.

## Wired
Nothing new needed: `artIndex.rts('gunpowder')` finds the file, so Gunpowder economy battles draw it
(before, the Kingdoms file stood in by the age chain). The build menu keeps one shared icon per role.
No console errors.
