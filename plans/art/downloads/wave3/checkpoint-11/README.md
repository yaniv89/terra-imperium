# Wave 3 checkpoint 11: the camel, elephant and frame rigs and the Classical base units

2026-10-07, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (10 queue items: `units/rigs/{camel,elephant,frame}`, the six
`units/classical-<class>` and `units/classical-general`). [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [contact sheet](contact.png) (844x390: the battle sandbox with
`age=classical`: swordsmen, heavy cavalry, ballista and archers; Blender proofs of the general,
engineers and laborer; the three bare rigs).

Numbering: the user's "Wave 3" is the next age after Bronze (Classical); plans/ART-MODELS-PLAN.md 12
lists it as wave 4 (its wave 3 is map polish).

## Rigs (track E, `scripts/blender/ti_mounts.py`)
- `camel()`: a dromedary on `ti_units.quadruped` (new `MOUNTS['camel']`: 1.1 H at the withers, long
  legs, a U-shaped neck), a hump, round foot pads; the `Rider` socket on the hump's crown. 698 triangles.
- `elephant()`: an Asian war elephant (`MOUNTS['elephant']`: 1.55 H at the shoulder), trunk to the
  ground, tusks, ears, round feet; `howdah()` puts a box with a Team cloth on its back. 762 triangles.
- `frame()`: the siege frame: a wheeled carriage (beams, cross pieces, deck, eight-spoke iron-tyred
  wheels, a splayed front stand) on a rigid `Hull` / `Wheel_*` armature with three crew spots;
  `torsion_engine()` puts a bolt thrower or (stone=True) a stone thrower on its deck. 750 triangles
  with the engine. Same bone names as the other rigs, so the loader trots the camel and elephant
  like a horse and keeps the frame rigid.
- Bare reference files: `art-build/units/rigs/{camel,elephant,frame}.(blend|glb)` (outside Git, not
  shipped: units carry their rigs). `blender -b --factory-startup -P scripts/blender/ti_mounts.py -- rigs camel elephant frame`.

## Classical base units and general (`scripts/blender/build_units_classical.py`)
| File | Unit | Triangles | Packed |
|---|---|---:|---:|
| `src/assets/units/classical-infantry.glb` | Swordsmen: bronze cuirass, pteruges, crested helmet, oval Emblem shield, short sword, greaves | 1,488 | 86 KB |
| `classical-ranged.glb` | Composite archers: recurve bow, back quiver, leather corselet, felt cap | 1,216 | 65 KB |
| `classical-cavalry.glb` | Heavy cavalry: scale coat, crested helmet, long spear, small round shield, Team saddle cloth | 1,682 | 97 KB |
| `classical-siege.glb` | Ballista on the frame rig, three crew | 2,103 | 130 KB |
| `classical-support.glb` | Engineers: wicker mantlet, pick, ladder | 1,228 | 69 KB |
| `classical-worker.glb` | Laborer: pick and basket | 1,102 | 58 KB |
| `classical-general.glb` | Mounted general and standard bearer | 2,295 | 137 KB |

Together 0.64 MB packed (meshopt, unquantized like the Bronze units). Culture-neutral; rest pose.
The part library of `build_units_bronze_signature.py` is now importable (its build loop runs only as a
script), and the new builder adds an oval shield, crested helmets (front-to-back or transverse), a
cuirass with pteruges, a composite bow, a pick, a basket, a ladder, a wicker mantlet, a cloth
standard and a seated-rider helper (`rider`: dress, bake the astride pose, then arm).

## Wired
`src/assets/units/classical-<class>.json` now enable the GLBs (the old disabled recipe JSONs are
replaced), so `findUnitModel('classical', ...)` and `findGeneralModel('classical')` resolve them; the
unit tests were moved to Kingdoms for "no model yet". Verified in `?battleSandbox&age=classical&bench=20&autostart`
(layers `classical:infantry` 1,488, `classical:cavalry`, `classical:siege` 2,103, `classical:general`;
no console errors besides the usual 403s of the sandbox).

## Checks
`validate_model.py` unit / unit-mounted / unit-machine pass all seven (unpacked builds,
`plans/art/shots/wave3/classical-units/validation/`); lint clean; 15 render test files pass.
