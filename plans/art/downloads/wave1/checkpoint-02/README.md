# Wave 1: checkpoint 02 (Bronze battle: construction, city destruction, nature, projectiles)

14 logical items, 2026-10-07, branch `claude/bronze-towns` (plans/ART-MODELS-PLAN.md section 12, Wave 1).
All 14 are in the game (packed copies under `src/assets/battle/`); the ZIPs hold the editable sources
(.blend), uncompressed GLBs, previews, validation reports and the build scripts.
[Manifest](manifest.json) · [Checksums](SHA256SUMS.txt) · [Contact sheet](contact.png) · in-game
shots in [plans/art/shots/wave1](../../../shots/wave1/) (`nature-bronze-base-844x390.png`,
`fort-bronze-town-844x390.png`).

All original procedural art, built headless in Blender 5.2 by script with the town kit's pipeline
(`ti_town.build_file`: one baked atlas per file, AO in the base colour, normal and ORM maps, WebP,
LOD0/LOD1/LOD2). No outside sources.

| Archive | Logical items |
|---|---|
| part-1.zip | construction-set (in rts-bronze.glb), wall-kit, ruin-library, fort, projectiles-bronze |
| part-2.zip | stone-outcrop, ore-outcrop, gold-vein, fish-shoal, herd-sheep-goat, herd-cattle |
| part-3.zip | vegetation-temperate, vegetation-mediterranean, vegetation-desert (queue item `vegetation-scrub`) |

**Where the ZIPs are:** as for checkpoint 01, outside the repository in
`C:\GitWotkspace\art-deliveries\wave1-2026-10-07-cp02\` (no GitHub CLI on this PC). To publish:
`gh release create wave1-2026-10-07-cp02 C:\GitWotkspace\art-deliveries\wave1-2026-10-07-cp02\part-*.zip`.
`node scripts/art/downloads-coverage.mjs --items` checks every item against the game.

## Battle buildings: construction stages (src/assets/battle/rts/rts-bronze.glb)

`construction-stage-0` .. `-3` added to the Bronze file (`scripts/blender/build_rts_bronze.py`), one
square footprint the game fits to the building going up: 0 corner stakes, string lines, a footing
trench with its first stones, a mud pit and brick stacks; 1 knee-high mud-brick walls, the door
frame, bricks drying; 2 full-height walls in a pole scaffold with a reed-mat deck and a ladder;
3 roof beams laid with half the roof on, the scaffold with two decks. Triangles 1,060 / 444 / 84 at
most. `economyLayer.js` already draws them by build progress (0-24, 25-49, 50-74, 75-100%).
Farm growth stages are not read by the game yet (the sim has no crop stages), so none were built.

## City destruction (src/assets/battle/city/)

`scripts/blender/build_city_bronze.py`, in the Bronze town kit's wall materials (sun-dried brick,
lime-wash band, timber walk) so a besieged city matches its walls on the map.

| File | Objects | Triangles (largest LOD0 / LOD1 / LOD2) | Packed |
|---|---|---|---:|
| walls-bronze.glb | wall-straight (10 m, 5 m high, battered outer face to -Y), wall-corner, tower (7.5 m, team pennant), gate-open, gate-closed (bronze-strapped leaves, team banners); each `-damaged` (bites out of the top, cracks, fallen merlons, rubble) and `-breached` (stubs and a rubble ramp) | 1,376 / 368 / 68 (budget 1,500 / 400 / 80) | 0.9 MB |
| ruins-bronze.glb | rubble-s, rubble-m, rubble-l (mud-brick heaps, standing wall stubs, charred beams, loose bricks, jars), beams, scorch | 1,004 / 64 / 28 (budget 1,200 / 300 / 80) | 0.5 MB |
| fort-bronze.glb | fort: earth berm and lashed log palisade (50 m circle), timber gatehouse, mud-brick watch tower, three reed huts, fire, stores, team pennant | 6,190 / 990 / 278 (budget 8,000 / 1,500 / 300) | 1.0 MB |

Not built in this checkpoint: the 13 Bronze damaged-and-ruined house files (`<age>-<theme>-houses-damage.glb`).

## Nature (src/assets/battle/nature/)

`scripts/blender/build_nature.py` over the new parts module `scripts/blender/ti_nature.py` (faceted
rocks, trees, palms, cypress, grass, logs, ripples, fish, a grazing quadruped).

| File | Objects | Triangles (largest) | Packed |
|---|---|---|---:|
| stone-outcrop.glb | full (grey boulders 6 m across), half (fewer, cut blocks), depleted (a low worked floor and chips) | 736 / 140 / 56 | 0.27 MB |
| ore-outcrop.glb | dark rock with rust-red ore and green copper patches; full, half, depleted | 992 / 140 / 56 | 0.34 MB |
| gold-vein.glb | pale rock with white quartz and gold flecks; full, half, depleted | 1,144 / 140 / 56 | 0.39 MB |
| fish-shoal.glb | ripple rings and fish shadows, a leaping fish when full; full, half, depleted | 410 / 116 / 32 | 0.08 MB |
| herd-sheep-goat.glb | animal: a grazing sheep, cream wool, dark face, small horns | 276 / 120 / 52 | 0.11 MB |
| herd-cattle.glb | animal: a long-horned red-brown ox, grazing | 276 / 120 / 52 | 0.08 MB |
| vegetation-temperate.glb | tree-s birch, tree-m oak, tree-l beech, stump, felled, bush, rock-s, rock-m, grass-tuft | 384 / 56 / 28 | 0.42 MB |
| vegetation-mediterranean.glb | tree-s olive, tree-m stone pine, tree-l cypress, the rest as above (dry grass) | 384 / 56 / 36 | 0.46 MB |
| vegetation-desert.glb | tree-s tamarisk, tree-m umbrella thorn, tree-l date palm, sandstone rocks, dry grass | 384 / 100 / 80 | 0.62 MB |

All within the README budgets (node 1,500 / 300 / 80, herd 400 / 150 / 60, tree 600 / 150 / 150).
One 1024 atlas per file, 512 for the herds and the fish. Herd animals stand in their rest pose (no
clips until the VAT pipeline of Wave 0b exists). The queue's `vegetation-scrub` is delivered as the
README's `vegetation-desert` kit (the loader's climate kit names); conifer, tropical, steppe and cold
remain (Wave 8).

## Projectiles (src/assets/battle/projectiles/bronze.glb)

`scripts/blender/build_projectiles_bronze.py`: arrow (0.8 m reed shaft, bronze head, two-sided
fletching, 18 triangles), javelin (1.6 m, 26), sling-stone (20). Points to -Y, origin at the middle.
The Bronze shooters (ranged, infantry, cavalry, towers) already ask for `arrow` and `javelin`.

## Checks

`validate_model.py` passes for every file (kinds prefab, wall-kit, ruin, improvement, node, herd,
tree, projectile) on the uncompressed GLBs; `npm run pack:models` packed the copies in the game;
`npx vitest run src/battle/art src/battle/render scripts/art` passes; seen in an economy battle at
844x390 (`eco-shot.mjs`, `&age=bronze`): the new trees, stone and ore nodes, sheep and the fort.
