# Wave 3 checkpoint 14: the Classical city kit (walls, ruins, fort, civic hall)

2026-10-07, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (4 queue items: `battle-city/classical/wall-kit`, `ruin-library`, `fort`,
and the new `battle-city/classical/civic`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt),
[contact sheet](contact.png) (844x390 battle sandbox, `city=medium&age=classical&fort=2`: a Europe
and a Levant Classical city with the new civic hall at the centre and the ashlar wall ring; the big
town's wide view; the ruined hall proof), [Blender proofs](../../../shots/wave3/city-classical-proofs.png).

## Delivered (`scripts/blender/build_city_classical.py`, 1024 atlases, packed)
| File | Objects | Packed |
|---|---|---:|
| `src/assets/battle/city/walls-classical.glb` | wall-straight, wall-corner, tower, gate-open, gate-closed, each `-damaged` and `-breached` (limestone ashlar, a marble foot band) | 751 KB |
| `ruins-classical.glb` | rubble-s, rubble-m, rubble-l (ashlar heaps, plaster stubs, broken tile), beams, scorch | 397 KB |
| `fort-classical.glb` | fort: an ashlar castellum ring in a 50 m circle with four towers and a gatehouse, a barrack block, a granary, a watch tower, tents, a well, the standard | 635 KB |
| `civic-classical.glb` | keep, keep-damaged, keep-ruined: the basilica hall of rts-classical behind its portico in a walled court; ruined, its walls stand as ragged stubs among rubble and charred beams | 578 KB |

Together 2.42 MB. The shapes are build_city_bronze.py's and build_rts_classical.py's with the
Classical materials (`remat`); the town-kit parts are grounded (`shifted`: moved down by G, nothing
below Z = 0). validate_model.py `auto`: all four pass.

## Wired
Nothing new needed: `artIndex.walls/ruins/fort(ageId)` and `civic(ageId, style)` resolve the Classical
files for Classical cities (before, a Classical city drew the Bronze walls and ruins and had no civic
hall model). Verified with `node scripts/art/city-shots.mjs ... europe,levant "city=medium&age=classical&fort=2"`:
the hall is 5.5 tiles, centred, drawn from civic-classical; no console errors.

## Seen, not fixed here
In the big Classical towns the temple landmarks are still larger than the hall (the same
`HALL_CLEAR` rebuild as the Levant Bronze towns would fix it per kit). The map improvement
`fort-classical` (with its Ground patch) is still pending; this fort is the battle's.
