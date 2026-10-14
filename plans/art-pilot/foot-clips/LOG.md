# Foot soldiers' clips

Authored 2026-10-14 by scripts/blender/ti_foot_clips.py (over ti_clips.py, the workers' poser and author)
through each unit's builder (`blender -b --factory-startup -P scripts/blender/build_<age>_<class>.py`;
`TI_SHEETS=1` renders the sheets below, `TI_SHEETS=side` a side view too). Contract:
plans/art/clip-animation-pipeline.md section 7 and 7.2. 20 fps, in place, loops closed (the last frame
repeats the first), events 1-based, contact frames held two frames. Frame f is at f / 20 s in the GLB.

Sheets (the battle camera, high three-quarter; a red bar marks an event frame): <uid>-moving.png (Idle,
IdleAlt, the gaits, Cheer or Hit) and <uid>-combat.png (the attacks or the shot, Block, Hit and the falls;
support units: <uid>-work.png), eight frames a row, the event frames among them.

Rest look: the baked rest pose (Idle frame 1) of every unit was checked against its previous GLB through
the game's loader (extractUnitGeometry with the unit's options, and with the infantry polearm lengths):
the same triangles, colours, limbs, team and skin parts, positions within 0.3 mm (the floor pass lifts the
rig at most 1 mm; the loader puts the feet back on the ground). Triangle counts are unchanged: no meshes
were added (no ramrod; the arrow and the string were already there).

## bronze-infantry

Spear and round shield. Attack: an underarm thrust from the guard (the spear forward and up at the hip). Attack2: the spear lifted over the shoulder and stabbed down. Block: crouched behind the shield. Cheer: the spear pumped overhead. Retreat-run: a plain run, upright, no panic. Triangles 2000 (unchanged); GLB 199 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| IdleAlt | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Retreat-run | 15 | 0.75 | yes | - |
| Attack | 21 | 1.05 | no | contact 11 |
| Attack2 | 25 | 1.25 | no | contact 13 |
| Block | 20 | 1.00 | no | - |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |
| Cheer | 33 | 1.65 | yes | - |

## bronze-ranged

Self bow (Prop_L) with its string bone (Prop_String follows the drawing fist from the nock to the release); the nocked arrow on Tool_Arrow (hidden from the release until a new arrow comes out of the back quiver, frame 29). Melee-fallback: the arrow stabbed down in the right fist. Triangles 1976 (unchanged); GLB 187 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Draw-aim-release | 33 | 1.65 | no | release 22 |
| Melee-fallback | 20 | 1.00 | no | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |

## bronze-mercenary

Long bronze sword and round shield. Attack: a cut from over the right shoulder down and across. Attack2: a thrust. Block, Cheer and Retreat-run as the spearman. Triangles 1998 (unchanged); GLB 206 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| IdleAlt | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Retreat-run | 15 | 0.75 | yes | - |
| Attack | 21 | 1.05 | no | contact 11 |
| Attack2 | 25 | 1.25 | no | contact 13 |
| Block | 20 | 1.00 | no | - |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |
| Cheer | 33 | 1.65 | yes | - |

