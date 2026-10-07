# Wave 5 checkpoint 29: the Gunpowder city kit (walls, ruins, star fort, civic hall)

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (4 queue items: `battle-city/gunpowder/wall-kit`, `ruin-library`, `fort` and the
new `battle-city/gunpowder/civic`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt),
[contact sheet](contact.png): a medium Gunpowder city in the sandbox at 844x390 (wide and close: the
clock-tower town hall, the grey stone ring) and the Blender proofs of the star fort, the wall kit and the
civic hall. Shots: `plans/art/shots/wave5/city-gunpowder/`.

## Delivered (`scripts/blender/build_city_gunpowder.py`, 1024 atlases, packed)
| File | Objects | Packed |
|---|---|---:|
| `src/assets/battle/city/walls-gunpowder.glb` | wall-straight, wall-corner, tower, gate-open, gate-closed, each `-damaged` and `-breached`, in grey stone scarp with a sandstone cordon | 820 KB |
| `ruins-gunpowder.glb` | rubble-s, rubble-m, rubble-l (brick, stucco, roof tile), beams, scorch | 553 KB |
| `fort-gunpowder.glb` | fort: a star fort in the 50 m circle (ti_gunpowder's bastioned trace: four angled bastions with cannon, turf on stone scarps, a sandstone gatehouse) round a brick barrack block, a powder magazine, a well, a ball pile and the standard; 2,792 / 1,174 / 242 triangles | 484 KB |
| `civic-gunpowder.glb` | keep, keep-damaged, keep-ruined: the brick town hall with its clock tower of rts-gunpowder in its walled court; ruined, its walls stand as stubs | 793 KB |

Together 2.65 MB. validate_model.py `auto`: all four pass.

## Wired
Nothing new needed: `artIndex.walls/ruins/fort('gunpowder')` and `civic('gunpowder')` resolve the new
files (before, a Gunpowder city drew the Kingdoms walls and ruins by the age chain and had no hall).
No console errors from the game.

## Seen, not fixed here
- The wall kit keeps the shared wall-piece shapes (with merlons), in the age's stone; a true bastion
  trace in battle would need new wall pieces. The fort is the age's star fort.
- Gunpowder damaged and ruined house files, palace damage, raider and mercenary, projectiles, props,
  culture skins and the map fort are the Gunpowder remainder (next).
