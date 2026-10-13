# MD09 and MD10: only machines get bigger

User answer Q7 of 13 October: siege engines, cannon, artillery, tanks and other vehicles are drawn
at their true size. Crews and soldiers stay at true human scale. No soldier figure was enlarged.

## The rule

1. The battle draws every land machine file at the same scale as the infantry beside it
   (`ART_UNIT_WORLD` = 0.95 tiles per authored unit, `src/battle/render/unitModels.js`). Before,
   siege files and files with a JSON `height` were fitted to a height, which scaled the crew with the
   machine: the ballista crew stood at 0.51 and the cannon crew at 0.44 against the infantry's 0.95.
   Now `siege` is no longer in `FIT_TO_HEIGHT` (only `air` and `naval` are) and no machine JSON
   carries `height`.
2. The machine is authored in Blender at its real size against a 1.8 m person (a person is 1 unit).
   The builders make it on the existing game-sized rigs and then call `ti_mounts.enlarge(rig, s)`,
   which scales the machine's bones and meshes only. The crew is built at 1.0 as before and placed
   afterwards at the enlarged machine (beside the wheels, at the push handles, on the truck bed, on
   the car's seat and floor).
3. Each machine JSON carries `footprint`: [width, length] in units, crew included (written by
   `ti_mounts.mark_machine`). `machineLayout` turns it into the squad's spacing side by side and nose
   to tail, and into how many machines the squad draws. Drawing only: the sim, collisions, strength
   and combat are untouched.
4. The loader's native height range went from 3.5 to 7 units, so a 9 m trebuchet (5 units) keeps the
   art scale instead of falling back to a height fit.

## Sizes, before and after

Crew: tiles per authored unit as drawn (infantry is 0.95). Machine length, width and height in metres
(the machine alone, no crew), from `measure.mjs`. Before figures are the authored size; the game then
drew them at the crew scale in the first column, so they looked smaller still.

| File | Crew drawn before | Crew drawn after | Machine L x W x H before (m) | Machine L x W x H after (m) | Real target | Triangles before | Triangles after |
|---|---|---|---|---|---|---|---|
| bronze-siege (covered ram, 4 crew) | 0.83 | 0.95 | 3.55 x 3.38 x 1.71 | 6.04 x 4.65 x 2.91 | 6 m long, 2.5 m high | 2900 | 2900 |
| classical-siege (ballista, 3 crew) | 0.51 | 0.95 | 1.88 x 1.72 x 1.39 | 3.10 x 2.84 x 2.29 | 3 m long | 2103 | 2103 |
| kingdoms-siege (trebuchet, 3 crew) | 1.10 | 0.95 | 2.92 x 1.22 x 3.04 | 8.61 x 3.61 x 8.96 | 9 m high | 1801 | 1801 |
| gunpowder-siege (field gun, 3 crew) | 0.44 | 0.95 | 3.04 x 1.41 x 1.05 | 3.95 x 1.84 x 1.37 | 3.5 m long, wheels 1.4 m | 2385 | 2385 |
| modern-siege (155 mm howitzer, 3 crew) | 0.81 | 0.95 | 3.75 x 1.99 x 1.92 | 7.88 x 4.17 x 4.04 | 8 m with trails | 2973 | 2973 |
| modern-cavalry (tank) | 0.78 (no crew) | 0.95 | 3.76 x 2.34 x 1.66 | 9.32 x 3.75 x 3.73 | hull 7 m, 2.4 m high | 1340 | 1468 |
| modern-support (AA truck, 1 crew) | 0.81 | 0.95 | 2.97 x 2.16 x 2.16 | 6.83 x 3.89 x 4.96 | 7 m | 1827 | 1827 |
| modern-general (command car, 2 crew) | 0.86 | 0.95 | 2.51 x 1.51 x 3.15 | 3.51 x 2.12 x 4.41 | 3.4 m | 2947 | 2947 |
| modern-raider (technical, 1 crew) | 0.78 | 0.95 | 2.65 x 1.40 x 1.39 | 5.03 x 2.11 x 2.63 | 5.3 m pickup | 2108 | 2108 |
| signature/kingdom-of-israel (Merkava) | 0.78 (no crew) | 0.95 | 4.08 x 2.34 x 1.53 | 9.79 x 3.75 x 3.67 | hull 7.6 m | 1448 | 1448 |
| signature/marcomannia (LT vz. 38) | 0.78 (no crew) | 0.95 | 2.47 x 1.88 x 1.74 | 5.30 x 2.72 x 3.75 | 4.6 m, 2.4 m high | 1332 | 1332 |
| signature/bosporan-kingdom (stone-thrower, 3 crew) | about 0.5 | 0.95 | 2.2 x 2.4 x 1.56 | 4.19 x 4.62 x 2.97 | about 4 m | 2467 | 2467 |

Notes on the numbers:
- Tank: the hull is 6.97 m (1.72 units x 2.25), the 9.32 m is with the gun forward. The roof is 2.43 m,
  the 3.73 m is the top of the aerial. The tank gained a seventh road wheel for the longer hull.
- AA truck: 3.89 m wide is with the stabiliser legs out (the body is 2.5 m), 4.96 m is the gun muzzles.
- Howitzer: 4.17 m wide is the spread trails, 4.04 m high is the raised muzzle.
- Ram: 4.65 m wide is with the push handles (the body is 2.5 m).
- Command car: 4.41 m is the whip mast.
- All files stay under the machine target of 4,000 triangles.
- The crew's authored height is 1.00 in every file (see `before-measure.txt`): crews were never the
  wrong size in Blender, only in the renderer.

Already at the people's scale, checked by the test and left as they are: bronze-cavalry (chariot),
bronze-support (ox cart), bronze-general.

## Squad layout (render only)

The sim deploys squads 3 tiles apart along a line and the two lines 4 tiles apart. One tile is about
1.9 m at this scale, so that pitch is under 6 m. `MACHINE_BLOCK` (2.9 tiles wide, 5.2 deep) keeps a
squad's drawn machines on its own ground:

| Unit | Drawn before | Drawn now |
|---|---|---|
| Ram, trebuchet, howitzer, tank, AA truck, Merkava, LT vz. 38 | 3 or 4 | 1 |
| Ballista, field gun, Bosporan stone-thrower | 3 | 2, one behind the other (the stone-thrower 1) |
| Technical | 4 | 2 abreast |

The selection ring and the attack ring are sized from the same block.

## What still looks wrong

- A real ram, trebuchet, howitzer or tank is wider or longer than the 3 tile gap the sim leaves
  between squads, so even one machine a squad touches or overlaps its neighbours at deployment
  (see `after-modern-cavalry-z3.jpg`: two tank squads overlap, and a tank stands in an infantry
  squad's ground; `after-kingdoms-siege-z1.jpg`: three trebuchets shoulder to shoulder). This cannot
  be fixed in the renderer alone. It needs a wider deployment pitch for machine squads in the sim,
  which this task was not allowed to touch.
- The general's command car is still parked at the standard, inside its squad.
- Ballistas and guns in a file of two look odd (one fires over the other).
- The trebuchet is 4.7 tiles tall. It dominates the field at zoom 1, which is its true size.
- The map's close view (`closeViewScene.js`) was not checked.

## Evidence

844x390 at device scale factor 3, zoom 1 and 3, a machine squad beside an infantry squad:
`before-<age>-<class>-z1.jpg`, `before-...-z3.jpg`, `after-...`, plus `after-bosporan-*` and
`after-merkava-*` for two signature machines. Taken with `shots.mjs` (dev server on port 5202).
`measure.mjs` prints the table rows, `inspect.mjs` lists a file's meshes, `squad-pitch.mjs` prints
where the sandbox deploys squads, `copy-built.mjs` copies rebuilt files into `src/assets/units/`.

## Rebuild

```
blender -b --factory-startup -P scripts/blender/build_bronze_siege_machinery.py
blender -b --factory-startup -P scripts/blender/build_bronze_siege.py
blender -b --factory-startup -P scripts/blender/build_units_classical.py -- classical-siege
blender -b --factory-startup -P scripts/blender/build_units_kingdoms.py -- kingdoms-siege
blender -b --factory-startup -P scripts/blender/build_units_gunpowder.py -- gunpowder-siege
blender -b --factory-startup -P scripts/blender/build_units_modern.py -- modern-siege modern-cavalry modern-support modern-general
blender -b --factory-startup -P scripts/blender/build_units_modern_irregular.py -- modern-raider
blender -b --factory-startup -P scripts/blender/build_units_modern_signature.py -- kingdom-of-israel marcomannia
blender -b --factory-startup -P scripts/blender/build_units_classical_signature.py -- bosporan-kingdom
node plans/art-pilot/md09-machine-scale/copy-built.mjs
node plans/art-pilot/md09-machine-scale/copy-built.mjs art-build/units/signature/kingdom-of-israel art-build/units/signature/marcomannia art-build/units/signature/bosporan-kingdom
```
