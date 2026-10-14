# Mounted units', generals' and several-rig units' clips

Authored 2026-10-14 by scripts/blender/ti_mounted_clips.py (over ti_clips.py and the foot soldiers' poser and
key library, ti_foot_clips.py) through each unit's builder (`blender -b --factory-startup -P
scripts/blender/<builder>.py [-- <uid>]`; `TI_SHEETS=1` renders the sheets below, `TI_SHEETS=side` a side view
too). Contract: plans/art/clip-animation-pipeline.md section 7 and 7.3. 20 fps, in place, loops closed (the
last frame repeats the first), events 1-based, contact frames held two frames. Frame f is at f / 20 s in the
GLB. Every clip keys every rig of the file over the same frames (one glTF animation per clip).

Sheets (the battle camera, high three-quarter from the front left; a red bar marks an event frame):
<uid>-moving.jpg (Idle and the gaits, Cheer for a general) and <uid>-combat.jpg (Charge, Attack, Hit and the
falls; the chariot: Archer-shoot, Hit, Wreck), eight frames a row, the event frames among them. JPEG at
quality 82.

Rest look: the baked rest pose (Idle frame 1 of every rig) of every unit was checked against its previous GLB
through the game's loader (extractUnitGeometry with the unit's options, a cavalry lance at 3.5 m): the same
triangles, colours, limbs, team and skin parts, positions within 0.5 mm. Triangle counts are unchanged: no
meshes were added (the reins' hand end and the chariot archer's arrow moved to bones of their own).

## The clip sets

Mounted (cavalry, raiders) and generals (the mounted set plus Cheer):

| Clip | Frames | Seconds | Loop | Events | Horse | Rider |
|---|---|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - | breathes, lowers the head, swishes the tail | shifts in the saddle |
| Walk | 21 | 1.05 | yes | - | four-beat (LH, LF, RH, RF), duty .62, the head nods twice a stride | sways with the back |
| Trot | 15 | 0.75 | yes | - | two-beat diagonal pairs (LF with RH), duty .42, the back rises and falls twice | rises on one diagonal, sits the other |
| Gallop | 13 | 0.65 | yes | - | three-beat (RH; LH with RF; LF; suspension), duty .30, rocking, the head and neck nod once | sits deep, leans forward |
| Charge | 41 | 2.05 | no | contact 23 | four strides of the gallop at 10 frames, the neck stretched | the weapon lowered (lance couched, blade or torch forward, a general's arm urging), the strike at 23, raised again |
| Attack | 21 | 1.05 | no | contact 11 | stands, tosses the head | the rider's strike to the right front |
| Hit | 10 | 0.50 | no | - | throws the head up, lifts a fore hoof | recoils |
| Death | 40 | 2.00 | no | settle 40 | knees buckle, rolls onto its side (legs out) | rides it to frame 12, thrown over the side the back rolls to, lies on his back along the horse |
| DeathAlt | 40 | 2.00 | no | settle 40 | sits back on its haunches, rolls onto its side | the same, lies face down |
| Cheer (generals) | 33 | 1.65 | yes | - | tosses the head | the arm (or the weapon) raised twice |

Natural ground speeds (the planted hooves slide back at these, so play a gait at actual / natural): Walk 0.55 H/s
(0.52 tiles/s), Trot 1.36 H/s (1.29), Gallop 2.89 H/s (2.74), Charge 3.47 H/s (3.29); 1 H is about 0.95 tiles
(ART_UNIT_WORLD).

The chariot (Bronze cavalry; the note's archetype table):

| Clip | Frames | Seconds | Loop | Events | What moves |
|---|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - | the horses breathe a beat apart, the crew shift |
| Move | 13 | 0.65 | yes | - | both horses gallop in step, the car pitches about its axle with the yoke on their withers, the wheels turn once a stride, the crew ride with bent knees |
| Charge | 41 | 2.05 | no | contact 23 | four faster strides; at the impact the car jolts and the crew brace (held two frames) |
| Archer-shoot | 33 | 1.65 | no | release 22 | the archer draws to the cheek and looses (the arrow hidden from the release), takes a new arrow from the quiver at his right hip; the horses start at the shot |
| Hit | 10 | 0.50 | no | - | the horses flinch, the car jolts, the crew recoil |
| Wreck | 40 | 2.00 | no | settle 40 | the car tips onto its right side, the horses go down on their chests, the crew are thrown out over the open back (from frame 10) |

## bronze-cavalry

The light chariot: HorseNearRig, HorseOffRig, ChariotRig (Hull, Wheel_L, Wheel_R), DriverRig, ArcherRig. The reins
hang from the car (the driver's fists ride with it). The archer's nocked arrow moved to Tool_Arrow (a child of
Prop_R); the string's middle already hung from his right hand. Triangles 5674 (unchanged); GLB 505 KB packed
(was 404 KB).

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Move | 13 | 0.65 | yes | - |
| Charge | 41 | 2.05 | no | contact 23 |
| Archer-shoot | 33 | 1.65 | no | release 22 |
| Hit | 10 | 0.50 | no | - |
| Wreck | 40 | 2.00 | no | settle 40 |

## bronze-general

MountRig, CommanderRig (the mace upright in the right fist: struck down overhand in Attack, raised and struck in
Charge, raised high in Cheer), BearerRig (the standard bearer on foot: stands in Idle and Attack, walks in Walk,
runs in Trot, Gallop and Charge at the horse's stride, waves the banner out to his left in Cheer while the
other fist punches up, flinches in Hit, steps clear and falls in the deaths). The horse falls away from the
bearer (to its right) in both deaths. Triangles 4486 (unchanged); GLB 450 KB packed (was 323 KB).

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Trot | 15 | 0.75 | yes | - |
| Gallop | 13 | 0.65 | yes | - |
| Charge | 41 | 2.05 | no | contact 23 |
| Attack | 21 | 1.05 | no | contact 11 |
| Hit | 10 | 0.50 | no | - |
| Death | 40 | 2.00 | no | settle 40 |
| DeathAlt | 40 | 2.00 | no | settle 40 |
| Cheer | 33 | 1.65 | yes | - |

## bronze-raider

MountRig, RaiderRig. The torch stays raised in the gaits (as at rest); Charge raises it and thrusts it down at
the right front at the contact, Attack thrusts it down to set fire. Triangles 3160 (unchanged); GLB 302 KB packed
(was 228 KB).

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Trot | 15 | 0.75 | yes | - |
| Gallop | 13 | 0.65 | yes | - |
| Charge | 41 | 2.05 | no | contact 23 |
| Attack | 21 | 1.05 | no | contact 11 |
| Hit | 10 | 0.50 | no | - |
| Death | 40 | 2.00 | no | settle 40 |
| DeathAlt | 40 | 2.00 | no | settle 40 |

## classical-cavalry

MountRig, RiderRig. The long spear (SpearShaft, SpearHead: the battle fits it to a 3.5 m lance) is couched under
the arm in Charge and stabbed overhand at the right front in Attack; the small round shield stays on the left
forearm with the reins. No stirrups: the rider's legs ride with him. Triangles 2974 (unchanged); GLB 287 KB packed
(was 214 KB).

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Trot | 15 | 0.75 | yes | - |
| Gallop | 13 | 0.65 | yes | - |
| Charge | 41 | 2.05 | no | contact 23 |
| Attack | 21 | 1.05 | no | contact 11 |
| Hit | 10 | 0.50 | no | - |
| Death | 40 | 2.00 | no | settle 40 |
| DeathAlt | 40 | 2.00 | no | settle 40 |

## classical-general

MountRig, CommanderRig (no weapon in hand: the pointing hand urges forward in Charge, sweeps up and forward in
Attack, is raised twice in Cheer; its targets ride on the chest), BearerRig (the standard; the light figure, its
fists without finger rings). Triangles 3864 (unchanged); GLB 412 KB packed (was 287 KB).

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Trot | 15 | 0.75 | yes | - |
| Gallop | 13 | 0.65 | yes | - |
| Charge | 41 | 2.05 | no | contact 23 |
| Attack | 21 | 1.05 | no | contact 11 |
| Hit | 10 | 0.50 | no | - |
| Death | 40 | 2.00 | no | settle 40 |
| DeathAlt | 40 | 2.00 | no | settle 40 |
| Cheer | 33 | 1.65 | yes | - |

## classical-raider

MountRig, RaiderRig: the torch set of the Bronze raider (raised in the gaits, thrust down in Charge and Attack).
Triangles 3038 (unchanged); GLB 290 KB packed (was 216 KB).

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Trot | 15 | 0.75 | yes | - |
| Gallop | 13 | 0.65 | yes | - |
| Charge | 41 | 2.05 | no | contact 23 |
| Attack | 21 | 1.05 | no | contact 11 |
| Hit | 10 | 0.50 | no | - |
| Death | 40 | 2.00 | no | settle 40 |
| DeathAlt | 40 | 2.00 | no | settle 40 |
