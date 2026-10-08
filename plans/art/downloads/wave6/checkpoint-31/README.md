# Wave 6 checkpoint 31: the vehicle rigs and the Modern base units and general

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status `in_game_awaiting_review`
(11 queue items: `units/rigs/{tank,wheeled,jet}`, the six `units/modern-<class>`, `units/modern-air` and
`units/modern-general`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt), [contact sheet](contact.png):
a Modern battle in the sandbox at 844x390 (wide, rifle infantry, tanks, the command car), the in-game
lineup (two team colours) and the Blender proofs. Shots: `plans/art/shots/wave6/units-modern/`. "Wave 6"
is the Modern age (the ages in order).

## Rigs (`scripts/blender/ti_mounts.py`)
- `tank()`: the tracked rig. Bones `Hull`, `Track_L`, `Track_R` (rigid), `Turret` and its child `Barrel`
  (the loader's turret limb: the turret and gun swing together). Track loops with road wheels, a lower
  hull and deck with a glacis, side skirts with a Team stripe, an angular turret with a Team band, the gun
  with a mantlet and fume extractor, cupola and hatches, a stowage basket. Parameters cover hull and
  turret sizes, wheel count and size, skirts, an engine in front (the Merkava) and rivets (the LT vz. 38).
  1,340 triangles.
- `wheeled()`: the wheeled rig: chassis rails and axles on the `Hull` bone, one rigid bone per wheel
  (`Wheel_F_L`, `Wheel_2_R` ...), optional `Turret` and `Barrel` for a gun mount. 516 triangles bare.
- `jet()`: the aircraft rig: one rigid `Hull` (a generic twin-tail fighter, gear up). 556 triangles.
- Bare reference files `art-build/units/rigs/{tank,wheeled,jet}.(blend|glb)` (outside Git; units carry
  their rigs): `blender -b --factory-startup -P scripts/blender/ti_mounts.py -- rigs tank wheeled jet`.

## Delivered (`scripts/blender/build_units_modern.py`, packed without quantization)
| File | What | Triangles | Packed |
|---|---|---:|---:|
| `src/assets/units/modern-infantry.glb` | Rifle infantry: helmet with a Team band, Team plate carrier with magazine pouches, olive uniform with long sleeves, knee pads, boots, an assault rifle at the ready | 1,493 | 84 KB |
| `modern-ranged.glb` | ATGM team: the gunner kneeling behind a tripod guided-missile launcher (sight, Team band on the tube), the loader standing with a spare missile tube | 2,998 | 162 KB |
| `modern-cavalry.glb` | Tank on the tracked rig | 1,340 | 65 KB |
| `modern-siege.glb` | Towed 155 mm howitzer in the firing position on the wheeled rig (split trails spread to their spades, the long barrel raised with a muzzle brake on Turret and Barrel, a shield, ready rounds), three crew in helmets and Team vests with a shell, binoculars and a rammer | 2,973 | 170 KB |
| `modern-support.glb` | Anti-air battery: a three-axle truck (Team doors and tailboard, stabiliser legs out) with a twin anti-aircraft gun mount and a radar panel on Turret and Barrel, a gunner at the mount | 1,827 | 105 KB |
| `modern-worker.glb` | Engineer: blue-grey overalls, a Team high-visibility vest, a Team hard hat, a tool bag, a sledgehammer | 1,403 | 76 KB |
| `modern-general.glb` | General: an open command car on the wheeled rig (Team door marks, radio set, a whip mast with an Emblem pennant), a driver in a beret, the general standing in a peaked cap and service jacket with Team epaulettes | 2,948 | 161 KB |
| `modern-air.glb` | Fighter jet for `air` squads: pointed radome, canopy, intakes, swept wings with emblem roundels and a missile each, twin Team fins, two nozzles | 556 | 33 KB |

Together 0.86 MB (8 GLBs and 8 JSONs, 16 files; 3 of the JSONs are new, 5 replace the disabled Kenney
recipes). People wear long sleeves (new `sleeves`, `yoke`; the skin under sleeves and trousers is dropped).

## Wired
- unitModels.js resolves `modern-<class>.glb`, so every Modern side now fields these models (before:
  the procedural tank, truck and soldiers); the general is drawn beside the standard of squads with a
  commander. No code was needed for that.
- Vehicles carry `height` in their JSON (their true height, a person = 1), so crews keep the people's
  scale; the jet's JSON sets `segment: false` (no humanoid split of an unnamed rigid model).
- `BattleRenderer.js`: Modern tanks and AA trucks are spread wider in their squads (1.3 and 1.4 instead
  of 0.95 and 1.05) so they no longer overlap. Tests: unitPipeline.test.js and unitExtras.test.js now
  expect the Modern set. Lint clean; `vitest src/battle/render scripts/art`: 129 passed. No console errors.

## Next
The 10 Modern signature units (two tanks on the tracked rig: the Merkava and the LT vz. 38).
