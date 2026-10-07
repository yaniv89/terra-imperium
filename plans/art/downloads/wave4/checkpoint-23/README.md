# Wave 4 checkpoint 23: the Kingdoms city kit (walls, ruins, fort, civic hall)

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (4 queue items: `battle-city/kingdoms/wall-kit`, `ruin-library`, `fort` and
the new `battle-city/kingdoms/civic`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt),
[contact sheet](contact.png): a medium Kingdoms city in the sandbox at 844x390 (the guildhall at the
centre, the grey stone ring), the same city with ruined and damaged houses up close, and the Blender
proofs of the walls, civic hall and fort. Shots: `plans/art/shots/wave4/city-kingdoms/`.

## Delivered (`scripts/blender/build_city_kingdoms.py`, 1024 atlases, packed)
| File | Objects | Packed |
|---|---|---:|
| `src/assets/battle/city/walls-kingdoms.glb` | wall-straight, wall-corner, tower, gate-open, gate-closed, each `-damaged` and `-breached` (grey wall stone, a dressed-stone band) | 852 KB |
| `ruins-kingdoms.glb` | rubble-s, rubble-m, rubble-l (wall stone, lime plaster, slate), beams, scorch | 417 KB |
| `fort-kingdoms.glb` | fort: the castellum in wall stone round a half-timbered barrack hall and store, a watch tower under slate, tents, a well, the standard | 719 KB |
| `civic-kingdoms.glb` | keep, keep-damaged, keep-ruined: the guildhall of rts-kingdoms in its walled court; ruined, its walls stand as stubs | 692 KB |

Together 2.68 MB. validate_model.py `auto`: all four pass.

## Wired
Nothing new needed: `artIndex.walls/ruins/fort('kingdoms')` and `civic('kingdoms')` resolve the new
files (before, a Kingdoms city drew the Classical walls and ruins by the age chain and had no hall
model, so the procedural keep stood). The hall is 5.5 tiles, centred, the largest building. No
console errors.

## Seen, not fixed here
Kingdoms damaged and ruined house files (13 themes), palace damage, raider and mercenary,
projectiles, props, culture skins and the map fort are the Kingdoms remainder (as for the Classical
age in checkpoints 16 to 18).
