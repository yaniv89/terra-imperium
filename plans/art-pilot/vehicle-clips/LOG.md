# Modern vehicles' clips

Authored 2026-10-14 by scripts/blender/ti_vehicle_clips.py (over ti_mounted_clips.py: several rigs in one file,
one glTF animation per clip, carried crews) through the vehicles' own builders, unchanged otherwise
(`blender -b --factory-startup -P scripts/blender/build_units_modern.py -- modern-cavalry modern-support
modern-general modern-siege`, `... build_units_modern_irregular.py -- modern-raider`; `TI_SHEETS=1` renders the
sheets below). Contract: plans/art/clip-animation-pipeline.md section 7 and 7.4. 20 fps, in place, loops closed,
events 1-based, every clip keys every rig of its file over the same frames.

Sheets (the battle camera, high three-quarter from the front left; a red bar marks an event frame):
<uid>-moving.jpg (Idle, Move, Hit) and <uid>-combat.jpg (Fire, Death, Wreck), eight frames a row, JPEG quality 82.

Rest look: the baked rest pose (Idle frame 1) of every unit was checked against its previous GLB through the game's
loader: the same triangles, colours, limbs, team and skin parts, positions within 0.3 mm. A plain rebuild of the
four build_units_modern.py vehicles without clips was byte-identical to the committed GLBs, so the builders still
make today's look. Triangle counts, sizes, footprints and triangle budgets are unchanged.

## What moves

- Move: the wheels (the tank's road wheels, moved to bones of their own, RoadWheel_<side><k>, children of the
  tracks) turn a whole number of times a loop, the hull rides its suspension over the wheels' fixed centres. The
  track belts are one rigid loop each (flat colour, nothing to scroll): they stay still.
- Fire: the Barrel bone slides back along the bore at the `fire` frame and runs out again (location only); the hull
  rocks. Turret and Barrel are never rotated: the Turret has no track at all, the Barrel only a position track.
- Hit: a jolt (roll, pitch, a hop). Wreck: the blast lifts the hull, it drops 3.5 to 5 cm below where it stood with a
  list (a wheel splayed on the wheeled ones) and settles at frame 40; the crews die with it.
- Crews keep the person rig: Idle, riding in Move (bent knees; the howitzer crew walk), their part in Fire, a flinch
  in Hit, and Death (the crew killed, the machine standing) and the same fall in Wreck.

| Unit | Rigs | Move loop | Natural speed | Fire | Death and Wreck: the crew |
|---|---|---|---|---|---|
| modern-cavalry (tank) | TankRig | 19 frames, 3 turns | 2.98 tiles/s | 30 frames, fire 8: one round, 0.11 H of recoil | (no crew rig) |
| modern-support (AA truck) | AARig, GunnerRig | 21 frames, 1 turn | 1.39 tiles/s | 30 frames, fire 8: a burst of five, 0.045 H a shot; the gunner hunched at the mount | slumps where he stands on the bed |
| modern-general (command car) | CarRig, DriverRig, CommanderRig | 23 frames, 4 turns | 3.04 tiles/s | 25 frames, fire 12: the order, the general's arm thrown forward (no gun) | the driver slumps in his seat; the general goes over the right side to the ground |
| modern-raider (technical) | PickupRig, GunnerRig | 21 frames, 3 turns | 3.12 tiles/s | 30 frames, fire 8: a burst of six, 0.025 H a shot | the gunner goes out backwards over the tailgate |
| modern-siege (howitzer) | HowRig, Crew0Rig, Crew1Rig, Crew2Rig | 41 frames, 1 turn | 0.84 tiles/s | 40 frames, fire 28: the loader swings the shell in, the rammer drives it home twice, the observer watches, all turn away and cover up, 0.22 H of recoil | each falls where he stands, a step aside |

Every unit: Idle 41 frames (loop), Hit 10, Wreck 40 (settle 40); Death 40 (settle 40) where there is a crew.

GLB sizes, packed: modern-cavalry 92 KB (was 68), modern-support 144 KB (was 101), modern-general 206 KB (was 157),
modern-raider 154 KB (was 113), modern-siege 260 KB (was 165).

## Not done

The signature Modern machines (signature/kingdom-of-israel, the Merkava; signature/marcomannia, the LT vz. 38)
keep their rest pose: their builders and rigs were not reworked in this pass. The same module would serve them
(a tracked rig: road wheel bones, Barrel recoil) once their builders call ti_vehicle_clips.
