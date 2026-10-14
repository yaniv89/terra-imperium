# Worker clips (rows U06, AN15, AN16, MD07)

Authored 2026-10-14 by scripts/blender/ti_worker_clips.py through each scripts/blender/build_<age>_worker.py
(`blender -b --factory-startup -P scripts/blender/build_<age>_worker.py`; `TI_SHEETS=1` renders the
sheets below, `TI_SHEETS=side` a side view too). Contract: plans/art/clip-animation-pipeline.md
section 7 and 7.1. 20 fps, in place, loops closed (the last frame repeats the first), events 1-based,
contact frames held two frames. Frame f is at f / 20 s in the GLB.

Sheets (the battle camera, high three-quarter; a red bar marks an event frame): <uid>-moving.png
(Idle, Walk, Run, Carry, Hit, Death) and <uid>-work.png (Chop, Mine, Harvest, Build, Repair, Deposit),
eight frames a row, the event frames among them.

Rest look: the baked rest pose (Idle frame 1) was checked against the previous GLB through the game's
loader (extractUnitGeometry with the unit's bake options): the same triangles, colours, limbs and scale
within 1 mm, plus the hidden work tools as degenerate triangles at the grip.

## bronze-worker

Tools: held: the mattock (Tool_Held); work: a bronze axe, pick and sickle, a wooden mallet (Tool_Hammer). Triangles 1936 (budget 2,000, tools included); GLB 210 KB packed.

| Clip | Frames | Seconds | Loop | Tool | Events |
|---|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | Held | - |
| Walk | 21 | 1.05 | yes | Held | - |
| Run | 15 | 0.75 | yes | Held | - |
| Carry | 25 | 1.25 | yes | Held | - |
| Chop | 33 | 1.65 | yes | Axe | contact 17 |
| Mine | 29 | 1.45 | yes | Pick | contact 15 |
| Harvest | 37 | 1.85 | yes | Sickle | cut 13 |
| Build | 25 | 1.25 | yes | Hammer | contact 15 |
| Repair | 21 | 1.05 | yes | Hammer | contact 11 |
| Deposit | 30 | 1.50 | no | Held | pour 16 |
| Hit | 8 | 0.40 | no | Held | - |
| Death | 30 | 1.50 | no | Held | settle 30 |

## classical-worker

Tools: held: the staff pick (Tool_Held); work: an iron axe, pick, sickle and hammer. Triangles 1954 (budget 2,000, tools included); GLB 211 KB packed.

| Clip | Frames | Seconds | Loop | Tool | Events |
|---|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | Held | - |
| Walk | 21 | 1.05 | yes | Held | - |
| Run | 15 | 0.75 | yes | Held | - |
| Carry | 25 | 1.25 | yes | Held | - |
| Chop | 33 | 1.65 | yes | Axe | contact 17 |
| Mine | 29 | 1.45 | yes | Pick | contact 15 |
| Harvest | 37 | 1.85 | yes | Sickle | cut 13 |
| Build | 25 | 1.25 | yes | Hammer | contact 15 |
| Repair | 21 | 1.05 | yes | Hammer | contact 11 |
| Deposit | 30 | 1.50 | no | Held | pour 16 |
| Hit | 8 | 0.40 | no | Held | - |
| Death | 30 | 1.50 | no | Held | settle 30 |

## kingdoms-worker

Tools: held: the staff felling axe (Tool_Held); work: a steel axe, pick, sickle and hammer. Triangles 1998 (budget 2,000, tools included); GLB 212 KB packed.

| Clip | Frames | Seconds | Loop | Tool | Events |
|---|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | Held | - |
| Walk | 21 | 1.05 | yes | Held | - |
| Run | 15 | 0.75 | yes | Held | - |
| Carry | 25 | 1.25 | yes | Held | - |
| Chop | 33 | 1.65 | yes | Axe | contact 17 |
| Mine | 29 | 1.45 | yes | Pick | contact 15 |
| Harvest | 37 | 1.85 | yes | Sickle | cut 13 |
| Build | 25 | 1.25 | yes | Hammer | contact 15 |
| Repair | 21 | 1.05 | yes | Hammer | contact 11 |
| Deposit | 30 | 1.50 | no | Held | pour 16 |
| Hit | 8 | 0.40 | no | Held | - |
| Death | 30 | 1.50 | no | Held | settle 30 |

## gunpowder-worker

Tools: held: the wheelbarrow with its shovel (Tool_Held, the wheel on Tool_Wheel); work: a steel axe, pick, sickle and hammer. Triangles 1914 (budget 2,000, tools included); GLB 219 KB packed.

| Clip | Frames | Seconds | Loop | Tool | Events |
|---|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | Held | - |
| Walk | 21 | 1.05 | yes | Held | - |
| Run | 15 | 0.75 | yes | Held | - |
| Carry | 25 | 1.25 | yes | Held | - |
| Chop | 33 | 1.65 | yes | Axe | contact 17 |
| Mine | 29 | 1.45 | yes | Pick | contact 15 |
| Harvest | 37 | 1.85 | yes | Sickle | cut 13 |
| Build | 25 | 1.25 | yes | Hammer | contact 15 |
| Repair | 21 | 1.05 | yes | Hammer | contact 11 |
| Deposit | 30 | 1.50 | no | Held | pour 15 |
| Hit | 8 | 0.40 | no | Held | - |
| Death | 30 | 1.50 | no | Held | settle 30 |

## modern-worker

Tools: held: the sledgehammer (Tool_Held), also the build and repair tool; work: a modern axe, pick and sickle with black grips. Triangles 1934 (budget 2,000, tools included); GLB 205 KB packed.

| Clip | Frames | Seconds | Loop | Tool | Events |
|---|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | Held | - |
| Walk | 21 | 1.05 | yes | Held | - |
| Run | 15 | 0.75 | yes | Held | - |
| Carry | 25 | 1.25 | yes | Held | - |
| Chop | 33 | 1.65 | yes | Axe | contact 17 |
| Mine | 29 | 1.45 | yes | Pick | contact 15 |
| Harvest | 37 | 1.85 | yes | Sickle | cut 13 |
| Build | 25 | 1.25 | yes | Held | contact 15 |
| Repair | 21 | 1.05 | yes | Held | contact 11 |
| Deposit | 30 | 1.50 | no | Held | pour 15 |
| Hit | 8 | 0.40 | no | Held | - |
| Death | 30 | 1.50 | no | Held | settle 30 |

