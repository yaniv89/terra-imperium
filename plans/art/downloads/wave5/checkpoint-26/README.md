# Wave 5 checkpoint 26: the Gunpowder base units and general

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status `in_game_awaiting_review`
(7 queue items `units/gunpowder-<class>`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt),
[contact sheet](contact.png): the in-game lineup (two team colours) and a Gunpowder battle in the
sandbox at 844x390 (wide, line infantry, dragoons, the field gun, the general). Shots:
`plans/art/shots/wave5/units-gunpowder/`. "Wave 5" here is the Gunpowder age (the ages in order).

## Rigs
No new rig file: the people use the shared person rig and body (ti_units.py), the dragoons and the
general the horse (ti_mounts.horse). The field gun has its own rigid carriage armature (Hull,
Wheel_L, Wheel_R, the bones of ti_mounts.frame) with the wheels on the axle and a trail to the ground,
built in `build_units_gunpowder.py` (`field_gun`).

## Delivered (`scripts/blender/build_units_gunpowder.py`, packed without quantization)
| File | What | Triangles | Packed |
|---|---|---:|---:|
| `src/assets/units/gunpowder-infantry.glb` | Line infantry: long Team coat with turnbacks, white cross belts, tricorne, gaiters, musket with a fixed bayonet at the shoulder | 1,388 | 79 KB |
| `gunpowder-ranged.glb` | Riflemen: short Team jacket, round hat with a turned-up brim, rifle at the ready, powder horn, pouch | 1,396 | 77 KB |
| `gunpowder-cavalry.glb` | Dragoons: brass helmet with a horsehair crest, Team coat, boots, sabre, slung carbine, horse with a Team saddle cloth and holsters | 1,796 | 105 KB |
| `gunpowder-siege.glb` | Field cannon: bronze gun on a two-wheeled carriage with a trail, rammer, ball pile; three crew (rammer, linstock) | 2,385 | 142 KB |
| `gunpowder-support.glb` | Sappers: gabion on the back, shovel, fuse coil, leather apron, cap | 1,446 | 78 KB |
| `gunpowder-worker.glb` | Laborer: shirt and Team waistcoat, broad hat, shovel, wheelbarrow | 1,390 | 76 KB |
| `gunpowder-general.glb` | Mounted officer in a plumed bicorne, Team coat with epaulettes and sash, cloak, sabre; a colour bearer with the Emblem colour | 2,297 | 138 KB |

Together 0.69 MB. The old disabled `gunpowder-*.json` stubs (a Kenney soldier with a musket prop) are
replaced by the new files' settings (`enabled: true`, the triangle budget, the tag rules).

## Wired
Nothing new needed: unitModels.js resolves `<age>-<class>.glb`, so every Gunpowder side now fields
these models (before, the Kingdoms models stood in by the age chain). The sandbox's layer counts match
the files (infantry 1,382 / 271 / 53 ...). No console errors from the game.
