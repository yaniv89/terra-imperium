# MD09 and MD10: only machines get bigger

User answer Q7 of 13 October: siege engines, cannon, artillery, tanks and other vehicles get bigger.
Crews and soldiers stay at true human scale. No soldier figure was enlarged.

Second decision, same day, after the first pass at full real size overlapped neighbouring squads:
**machines are capped at about two thirds of their real size**, one or two machines a squad is
accepted, and **camel and elephant riders are fixed the same way** (riders at the people's scale,
the animal at its true size).

## The rule

1. The battle draws every land machine file, and every camel and elephant file, at the same scale as
   the infantry beside it (`ART_UNIT_WORLD` = 0.95 tiles per authored unit,
   `src/battle/render/unitModels.js`). Before, siege files and files with a JSON `height` were fitted
   to a height, which scaled the crew with the machine: the ballista crew stood at 0.51 and the
   cannon crew at 0.44 against the infantry's 0.95, and camel riders at up to 1.13. Now `siege` is no
   longer in `FIT_TO_HEIGHT` (only `air` and `naval` are) and none of these JSONs carries `height`
   (only the jet does).
2. The machine is authored in Blender against a 1.8 m person (a person is 1 unit) at about two thirds
   of its real size. The builders make it on the existing game-sized rigs and then call
   `ti_mounts.enlarge(rig, s)`, which scales the machine's bones and meshes only. The crew is built
   at 1.0 as before and placed afterwards (beside the wheels, at the push handles, on the truck bed).
3. Animals are at their true size. The camel rig's hump stood 2.3 m: `ti_mounts.true_camel` brings
   it to 1.96 m and moves the rider's seat with it. The elephant rig was already true (3.1 m to the
   top of its back, 2.8 m at the shoulder) and its files only lost their fitted height.
4. Each machine JSON carries `footprint`: [width, length] in units, crew included (written by
   `ti_mounts.mark_machine`). `machineLayout` turns it into the squad's spacing side by side and nose
   to tail, and into how many machines the squad draws. Drawing only: the sim, collisions, strength
   and combat are untouched.
5. The loader's native height range went from 3.5 to 7 units (kept from the first pass; the tallest
   file is now the elephant with its banner, under 3 units, so it is no longer needed but harmless).

## Machines, before and after

Crew: tiles per authored unit as drawn (infantry is 0.95). Machine length, width and height in metres
(the machine alone, no crew), from `measure.mjs` (`before-measure.txt`, `after-measure.txt`). The
"before" machine is the authored size; the game then drew it at the crew scale in the first column,
so on screen it was smaller still (the last column gives the on-screen growth of the machine's length).

| File | Crew drawn before | Crew drawn after | Machine L x W x H before (m) | Machine L x W x H after (m) | Real | Share of real | Length on screen | Triangles |
|---|---|---|---|---|---|---|---|---|
| bronze-siege (covered ram, 4 crew) | 0.83 | 0.95 | 3.55 x 3.38 x 1.71 | 4.09 x 3.29 x 1.97 | 6 m long, 2.5 to 3 m high | 0.68 | x 1.32 | 2900 |
| classical-siege (ballista, 3 crew) | 0.51 | 0.95 | 1.88 x 1.72 x 1.39 | 2.07 x 1.89 x 1.52 | 3 m long | 0.69 | x 2.05 | 2103 |
| kingdoms-siege (trebuchet, 3 crew) | 1.10 | 0.95 | 2.92 x 1.22 x 3.04 | 5.75 x 2.41 x 5.98 | 9 m high | 0.66 | x 1.70 | 1801 |
| gunpowder-siege (field gun, 3 crew) | 0.44 | 0.95 | 3.04 x 1.41 x 1.05 | 2.49 x 1.16 x 0.86 | 3.5 m long, wheels 1.4 m | 0.71 | x 1.77 | 2385 |
| modern-siege (155 mm howitzer, 3 crew) | 0.81 | 0.95 | 3.75 x 1.99 x 1.92 | 5.26 x 2.78 x 2.69 | 8 m with trails | 0.66 | x 1.65 | 2973 |
| modern-cavalry (tank) | 0.78 (no crew) | 0.95 | 3.76 x 2.34 x 1.66 | 6.21 x 2.51 x 2.48 | hull 7 m, 3.7 m wide, roof 2.4 m | 0.66 (hull 4.64 m) | x 2.01 | 1340, now 1468 |
| modern-support (AA truck, 1 crew) | 0.81 | 0.95 | 2.97 x 2.16 x 2.16 | 4.60 x 2.59 x 3.34 | 7 m | 0.66 | x 1.82 | 1827 |
| modern-general (command car, 2 crew) | 0.86 | 0.95 | 2.51 x 1.51 x 3.15 | 2.51 x 1.51 x 3.15 | 3.4 m | 0.74 | x 1.10 | 2947 |
| modern-raider (technical, 1 crew) | 0.78 | 0.95 | 2.65 x 1.40 x 1.39 | 3.55 x 1.54 x 1.86 | 5.3 m pickup | 0.67 | x 1.63 | 2108 |
| signature/kingdom-of-israel (Merkava) | 0.78 (no crew) | 0.95 | about 4.1 long | 6.73 x 2.51 x 2.52 | hull 7.6 m | 0.64 (hull 4.81 m) | about x 2.0 | 1448 |
| signature/marcomannia (LT vz. 38) | 0.78 (no crew) | 0.95 | about 2.5 long | 3.58 x 1.88 x 2.53 | 4.6 m long, 2.1 m wide | 0.67 (hull 3.08 m) | about x 1.8 | 1332 |
| signature/bosporan-kingdom (stone-thrower, 3 crew) | about 0.5 (fitted) | 0.95 | about 2.2 long | 2.76 x 3.04 x 1.96 | about 4 m | 0.69 | about x 2.4 | 2467 |
| signature/tondo (lantaka, 3 crew) | fitted to a height | 0.95 | 1.93 x 1.05 x 1.30 | 1.93 x 1.05 x 1.30 | a swivel gun on a rest, about 2 m | about 1 | n/a | 2045 |

Notes on the numbers:
- The field gun's machine is smaller in Blender than before (2.49 m against 3.04 m) and still 1.77
  times longer on screen, because it used to be drawn at 0.44. Its wheels are 0.89 m across.
- Tank: the hull is 4.64 m (the 6.21 m is with the gun forward), the roof 1.62 m (the 2.48 m is the
  top of the aerial). It has a seventh road wheel for the longer hull.
- AA truck: 2.59 m wide is with the stabiliser legs out (the body is 1.68 m), 3.34 m is the muzzles.
- Howitzer: 2.78 m wide is the spread trails, 2.69 m high is the raised muzzle.
- Ram: 3.29 m wide is with the push handles (the body is 1.7 m).
- Command car: the rig's own car was already 0.74 of a real one, so it was not rescaled. Its two men
  are now drawn at 0.95 instead of 0.86, and the car with them.
- Tondo lantaka: left at its authored size, which is about a real lantaka on its rest (not capped to
  two thirds: it is the smallest machine in the set). It gained its footprint, and its crew is right
  through the rule.
- The three signature "before" lengths are worked back from the scale factor, not measured.
- Every file is under the machine target of 4,000 triangles. The crew's authored height is 1.00 in
  every file: crews were never the wrong size in Blender, only in the renderer.

Already at the people's scale, checked by the test and left as they are: bronze-cavalry (chariot),
bronze-support (ox cart), bronze-general.

## Camels and elephants, before and after

Sizes in metres against the 1.8 m infantryman as the battle draws them.

| File | Rider before | Rider after | Animal's back before (m) | Animal's back after (m) | Real | What changed |
|---|---|---|---|---|---|---|
| signature/qedar (camel, cavalry) | 1.05 of an infantryman | 1.00 | 2.43 (hump) | 1.96 | about 1.9 m at the hump | rebuilt: camel x 0.85, rider re-seated, no `height` |
| signature/saba (camel, ranged) | 1.19 | 1.00 | 2.74 | 1.96 | about 1.9 m | rebuilt, the same |
| signature/kindah (camel, modern infantry) | 1.19 | 1.00 | 2.74 | 1.96 | about 1.9 m | rebuilt, the same |
| signature/magadha (elephant) | 1.05 | 1.00 | 3.28 (top of the back) | 3.11 | 2.8 to 3 m at the shoulder | JSON only: no `height` |
| signature/kalinga (elephant) | 1.05 | 1.00 | 3.28 | 3.11 | the same | JSON only |
| signature/kamarupa (elephant) | 1.05 | 1.00 | 3.28 | 3.11 | the same | JSON only |
| signature/champa (elephant) | 1.05 | 1.00 | 3.28 | 3.11 | the same | JSON only |

The elephant's shoulder is 1.55 units, 2.79 m; the 3.11 m is the top of its back. There are no base
(non-signature) camel or elephant units. Riders were too big, not too small: the fitted height was
1.28 times the file's own height.

## Squad layout (render only)

The sim deploys squads 3 tiles apart along a line and the two lines up to 4 tiles apart (one tile is
about 1.9 m at this scale). `MACHINE_BLOCK` (2.9 tiles wide, 5.2 deep) keeps a squad's drawn machines
on its own ground. The test asserts that every machine with its crew is narrower than 2.9 tiles and
shorter than 5.2.

| Unit | Footprint with crew (tiles, wide x long) | Drawn before | Drawn now |
|---|---|---|---|
| Ballista | 1.27 x 1.48 | 3 | 3 (two abreast, one behind) |
| Field gun | 1.20 x 1.59 | 3 | 3 (two abreast, one behind) |
| Ram | 1.82 x 2.16 | 3 | 2, one behind the other |
| Trebuchet | 1.81 x 3.04 | 3 | 1 |
| Howitzer | 1.61 x 2.77 | 3 | 1 |
| Tank | 1.32 x 3.28 | 4 | 1 |
| AA truck | 1.37 x 2.43 | 4 | 2, one behind the other |
| Technical | 0.82 x 1.87 | 4 | 4 (two by two) |
| Merkava | 1.32 x 3.55 | 4 | 1 |
| LT vz. 38 | 0.99 x 1.89 | 4 | 4 (two by two) |
| Bosporan stone-thrower | 1.62 x 1.74 | 3 | 2, one behind the other |
| Tondo lantaka | 1.17 x 1.36 | 3 | 3 (two abreast, one behind) |

Elephants keep their own rule (two a squad, `RIG_FIGURES`); camels are laid out like any cavalry.

## Overlap: is it gone?

Checked at deployment in the sandbox, zoom 1 and zoom 3, where squads stand exactly 3 tiles apart.

- **Side by side (the 3 tile pitch): gone** for every machine. Ballistas, guns, rams, trebuchets,
  howitzers and tanks stand clear of the squad beside them (`after-classical-siege-z3.jpg`,
  `after-kingdoms-siege-z1.jpg`, `after-modern-siege-z1.jpg`). The widest block, two ballistas
  abreast, is 2.8 tiles.
- **Still overlapping, one case: the general's own squad.** The sim stands the commander's squad
  about 2.2 tiles behind and to one side of another squad, closer than the 3 tile pitch. When both
  are tanks (3.3 tiles long) the rear tank's gun reaches the front tank
  (`after-modern-cavalry-z3.jpg`, `after-merkava-modern-cavalry-z3.jpg`). The same placement puts
  the general's tank against a howitzer (`after-modern-siege-z1.jpg`) and the bronze general's
  chariots against a ram (`after-bronze-siege-z1.jpg`). It comes from where the sim puts that one
  squad, which this task may not change.
- The command car is still parked at the standard, in its own squad's ground, so it touches the
  squad's first machine or men.
- In a fight squads close to 1.2 tiles of each other (the sim's squad radius), so any two squads'
  figures interleave then, machines included. That was true of infantry before this change.

## What else still looks wrong

- Two rams, AA trucks or stone-throwers stand one behind the other. It reads as a column.
- The field gun's wheels come to a man's hip (0.89 m): the price of two thirds.
- The Tondo lantaka is not capped (see above).
- The AA truck, the technical and the light tank were checked in Blender previews and by the tests,
  not in a sandbox battle (no preset fields them).
- The map's close view (`closeViewScene.js`) was not checked.

## Evidence

844x390 at device scale factor 3, zoom 1 and 3, a machine squad beside an infantry squad:
- `before-<age>-<class>-z1.jpg` and `-z3.jpg`: before any change.
- `after-<age>-<class>-*.jpg`: now. Also `after-bosporan-*`, `after-tondo-*`, `after-merkava-*`.
- `before-elephant-*`, `after-elephant-*` (Magadha) and `before-camel-*`, `after-camel-*` (Qedar).
- Design references read: `plans/art/concepts/oct13/machines-scale-late.png` (reference only).

How the pictures were taken. The BEFORE set: the dev server, Chrome with software rendering
(SwiftShader). The AFTER set: a build of this branch (`NODE_ENV=development npx vite build --outDir
<tmp>`, then `npx vite preview --outDir <tmp> --port 5202`) and Chrome on the real GPU
(`GL=gpu`), which is why its edges and fonts look cleaner; sizes and positions are the game's own in
both. The switch was forced: by the second day other jobs on the machine starved software
rendering, and the sim's first frame then missed the battle's 25 second watchdog ("The battle could
not start"). `shots.mjs` now opens a battle again when that panel shows and marks any picture that
shows it with RETAKE in the log. Two things to know about the dev server in an agent worktree: it
does not watch files under `.claude/` (vite.config.js), so restart it after every code change; and
on a busy machine it can take over a minute to compile the sim's modules.

Scripts: `shots.mjs` and `after-shots.sh` (a server on port 5202), `measure.mjs`, `inspect.mjs`,
`squad-pitch.mjs` (where the sandbox deploys squads and what each draws), `rebuild.ps1` (every
Blender build), `copy-built.mjs` (copies the builds into `src/assets/units/`).

## Rebuild

```
powershell -File plans/art-pilot/md09-machine-scale/rebuild.ps1
node plans/art-pilot/md09-machine-scale/copy-built.mjs
```
The four elephant GLBs are not rebuilt (unchanged); their JSONs only lost `height`, and the builders
no longer write it.
