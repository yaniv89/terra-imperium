# MD13: three states for the battle buildings (2026-10-13)

Manifest row MD13 (plans/playtest-audits-art-update-2026-10-13.md): a side now loses only when its
base buildings are destroyed, so whole, damaged and destroyed must read at a glance at battle zoom
on a phone (844x390).

## What was built
- `<role>-ruined` for every role of the five shared files (`rts-bronze`, `rts-classical`,
  `rts-kingdoms`, `rts-gunpowder`, `rts-modern`): 13 roles each, and Modern's `generator`,
  `airfield` and `radar-aa`. 68 wrecks in all.
- One script makes them all: `ruined(role, layout)` in `scripts/blender/build_rts_bronze.py`, used
  by the five builders through `ruined_items`. It takes the role's OWN parts, so each wreck stays in
  its age's stuff:
  - every part is cut off by a tilted plane at knee to waist height (the tower keeps a stump of
    30% of its height; the mine's rock is broken down to about half), so the stumps are jagged;
  - big blocks become a burnt-out shell: a rim of wall round a sunken ash floor;
  - one or two posts stay standing, burnt; cloth is cut lower than walls; all Team cloth is gone;
  - what stood low (racks, troughs, stalls, cut stone, log piles, crop beds) stays where it was;
  - the stuff is charred (`ti_town.charred`: the part's own material multiplied down, with soot
    patches), the cuts are closed in ash;
  - under it a scorch mark the size of the footprint, heaps of the building's own wall stuff along
    the stumps, a broken tooth of wall on the highest corners, seven burnt beams (three leaning).
  - Same origin and footprint as the whole building. Sockets: only `socket-fire-1..4` and
    `socket-smoke-1`, brought down onto the wreck.
  - Each wreck has its own random stream (seeded from its role name) and is added after every other
    object of the file, so no part of a whole building, a damaged building or a construction stage
    moved.
- The damaged state was too close to the whole building at phone size (a few heaps at the foot and
  some missing cloth), so it was strengthened (`_breach` in the same file): one corner of the main
  body is cut away by a sloping plane and closed in ash, walls and roofs carry soot blotches, and the
  fallen corner lies as heaps on a scorch mark. It runs last on its own random stream, so the rest of
  the file is unchanged.
- LOD textures: `ti_map.transfer_uvs` gave the corners of one simpler face uvs from different atlas
  islands, so LOD1 and LOD2 were smeared in stripes (in the shipped Bronze file 10,007 of 16,686
  LOD1 triangles and 1,982 of 2,878 LOD2 triangles had a uv edge longer than a fifth of the atlas).
  `ti_map.transfer_uvs_by_face` keeps every simpler face on one face of the full model: 0 of 19,116
  and 0 of 3,568 now. This changes the LOD1 and LOD2 uvs of the whole buildings too (their
  triangles are the same). The game repaired such LODs at load time before (kitLoader
  `transferLodUvs`), so the visible change in game should be small.
- Validator: `<role>-ruined` in a battle building file is held to the ruin budget
  (1,200 / 300 / 80), the HQ roles too (it was 8,000 / 2,000 / 400 by default).
- Game: `economyLayer.js` draws `<role>-ruined` for a destroyed building (see "Code").

## Rebuild
```
blender -b --factory-startup -P scripts/blender/build_rts_bronze.py -- art-build/rts-bronze 2048
blender -b --factory-startup -P scripts/blender/build_rts_<age>.py -- art-build/rts-<age> 1024     (classical, kingdoms, gunpowder, modern)
<Blender's python> scripts/blender/validate_model.py art-build/rts-<age>/rts-<age>.glb art-build/validation prefab
copy art-build/rts-<age>/rts-<age>.glb to src/assets/battle/rts/, then: npm run pack:models -- src/assets/battle/rts/rts-<age>.glb
blender -b --factory-startup -P scripts/blender/render_rts_states.py -- art-build/rts-<age>/rts-<age>.glb OUT.png 2 0 844
blender -b --factory-startup -P scripts/blender/render_rts_states.py -- art-build/rts-<age>/rts-<age>.glb OUT-phone.png 4 1 281
```
`ONLY=barracks,tower` in the environment builds only those roles (all five builders now). A full
build takes about 3 minutes an age (Blender 5.2.2, CPU bake). The validator runs with Blender's own
Python (`<Blender>/5.2/python/bin/python.exe`); this machine has no other Python. All five files
passed the validator before packing.

## Review sheets (this folder)
- `<age>.jpg`: every role as whole, damaged, ruined, left to right, LOD0, each tile the phone
  screen's width. The Team material is tinted red as a side's colour would be.
- `<age>-phone.jpg`: the same at a third of the size on LOD1, about what battle zoom shows.

## Triangles (LOD0 / LOD1 / LOD2), read from the packed files
Whole buildings and construction stages have the same counts as before in all five files (checked
against the shipped files, packed against packed). Damaged counts changed (the collapsed corner).

### Bronze (3,983,868 -> 4,045,616 bytes packed; 2048 atlas)
| role | whole | damaged | ruined |
|---|---|---|---|
| aid-post | 863 / 135 / 74 | 1158 / 290 / 15 | 478 / 185 / 51 |
| barracks | 1428 / 296 / 92 | 1541 / 499 / 57 | 506 / 163 / 39 |
| expedition-camp | 2769 / 653 / 110 | 3020 / 824 / 67 | 592 / 251 / 61 |
| farm-plot | 1220 / 892 / 48 | 1627 / 1087 / 53 | 716 / 271 / 67 |
| food-depot | 1604 / 384 / 144 | 1743 / 567 / 149 | 530 / 249 / 39 |
| materials-yard | 1424 / 888 / 48 | 1867 / 1131 / 53 | 620 / 249 / 73 |
| mine | 827 / 271 / 67 | 1258 / 502 / 72 | 543 / 200 / 62 |
| range | 658 / 534 / 118 | 1037 / 701 / 75 | 584 / 219 / 71 |
| siege-workshop | 730 / 570 / 238 | 1185 / 813 / 243 | 617 / 248 / 70 |
| stable | 1110 / 1022 / 116 | 854 / 663 / 61 | 612 / 241 / 69 |
| tower | 868 / 224 / 80 | 1017 / 367 / 41 | 264 / 139 / 35 |
| town-hall | 2964 / 552 / 212 | 2319 / 507 / 141 | 670 / 247 / 73 |
| trade-post | 2636 / 344 / 92 | 2651 / 515 / 49 | 518 / 171 / 43 |

### Classical (1,538,768 -> 1,980,792 bytes packed; 1024 atlas)
| role | whole | damaged | ruined |
|---|---|---|---|
| aid-post | 863 / 135 / 74 | 1256 / 382 / 83 | 478 / 185 / 51 |
| barracks | 1054 / 542 / 118 | 984 / 575 / 63 | 506 / 157 / 35 |
| expedition-camp | 4087 / 2047 / 122 | 4222 / 2186 / 127 | 611 / 266 / 64 |
| farm-plot | 666 / 338 / 120 | 1121 / 581 / 133 | 787 / 285 / 72 |
| food-depot | 1146 / 146 / 38 | 1193 / 397 / 51 | 362 / 177 / 49 |
| materials-yard | 928 / 392 / 108 | 1383 / 635 / 113 | 654 / 263 / 63 |
| mine | 827 / 271 / 67 | 1179 / 490 / 72 | 543 / 200 / 62 |
| range | 698 / 510 / 118 | 1009 / 609 / 75 | 593 / 224 / 62 |
| siege-workshop | 886 / 542 / 214 | 1341 / 785 / 219 | 564 / 219 / 73 |
| stable | 1110 / 1022 / 116 | 856 / 585 / 61 | 612 / 241 / 69 |
| tower | 482 / 322 / 118 | 743 / 393 / 83 | 326 / 161 / 37 |
| town-hall | 1186 / 602 / 250 | 1579 / 829 / 263 | 616 / 271 / 73 |
| trade-post | 2456 / 528 / 128 | 1654 / 611 / 145 | 538 / 173 / 55 |

### Kingdoms (1,935,928 -> 2,105,324 bytes packed; 1024 atlas)
| role | whole | damaged | ruined |
|---|---|---|---|
| aid-post | 863 / 135 / 74 | 1280 / 382 / 83 | 478 / 185 / 51 |
| barracks | 1526 / 626 / 94 | 1514 / 670 / 35 | 570 / 213 / 65 |
| expedition-camp | 4087 / 2047 / 122 | 4314 / 2158 / 127 | 611 / 266 / 64 |
| farm-plot | 666 / 338 / 120 | 1089 / 549 / 133 | 787 / 285 / 72 |
| food-depot | 1522 / 230 / 14 | 1597 / 453 / 23 | 586 / 233 / 73 |
| materials-yard | 928 / 392 / 108 | 1383 / 635 / 113 | 654 / 263 / 63 |
| mine | 827 / 271 / 67 | 1214 / 494 / 72 | 543 / 200 / 62 |
| range | 966 / 582 / 94 | 1309 / 725 / 51 | 604 / 249 / 71 |
| siege-workshop | 1178 / 614 / 190 | 1549 / 809 / 147 | 638 / 275 / 73 |
| stable | 1110 / 1022 / 116 | 841 / 581 / 61 | 612 / 241 / 69 |
| tower | 482 / 322 / 118 | 779 / 405 / 83 | 326 / 161 / 37 |
| town-hall | 2626 / 846 / 186 | 2913 / 1075 / 195 | 838 / 273 / 73 |
| trade-post | 2408 / 528 / 128 | 1868 / 541 / 93 | 538 / 173 / 55 |

### Gunpowder (1,978,412 -> 2,176,916 bytes packed; 1024 atlas)
| role | whole | damaged | ruined |
|---|---|---|---|
| aid-post | 863 / 135 / 74 | 1244 / 334 / 35 | 478 / 185 / 51 |
| barracks | 1392 / 566 / 100 | 1306 / 638 / 45 | 536 / 179 / 43 |
| expedition-camp | 4311 / 2159 / 122 | 4568 / 2252 / 127 | 611 / 266 / 64 |
| farm-plot | 666 / 338 / 120 | 1096 / 556 / 133 | 787 / 285 / 72 |
| food-depot | 1420 / 166 / 20 | 1359 / 413 / 33 | 466 / 183 / 49 |
| materials-yard | 928 / 392 / 108 | 1383 / 635 / 113 | 654 / 263 / 63 |
| mine | 955 / 387 / 67 | 1274 / 534 / 72 | 573 / 234 / 72 |
| range | 764 / 538 / 124 | 1143 / 705 / 81 | 593 / 224 / 60 |
| siege-workshop | 1004 / 522 / 244 | 1459 / 765 / 249 | 620 / 251 / 67 |
| stable | 1110 / 1022 / 116 | 913 / 650 / 61 | 612 / 241 / 69 |
| tower | 426 / 218 / 104 | 719 / 377 / 69 | 318 / 165 / 37 |
| town-hall | 4012 / 1054 / 264 | 3941 / 1009 / 181 | 862 / 285 / 73 |
| trade-post | 2536 / 528 / 128 | 1604 / 551 / 145 | 538 / 173 / 55 |

### Modern (1,973,256 -> 2,273,788 bytes packed; 1024 atlas)
| role | whole | damaged | ruined |
|---|---|---|---|
| aid-post | 748 / 396 / 118 | 1141 / 577 / 73 | 603 / 246 / 66 |
| airfield | 832 / 344 / 140 | 1163 / 539 / 101 | 650 / 213 / 57 |
| barracks | 1340 / 336 / 144 | 1749 / 539 / 109 | 599 / 230 / 66 |
| expedition-camp | 2994 / 1718 / 182 | 3329 / 1885 / 139 | 808 / 277 / 73 |
| farm-plot | 1220 / 672 / 116 | 1601 / 889 / 119 | 924 / 281 / 73 |
| food-depot | 898 / 98 / 38 | 1361 / 349 / 51 | 402 / 181 / 73 |
| generator | 900 / 652 / 12 | 1323 / 863 / 17 | 701 / 273 / 73 |
| materials-yard | 1048 / 452 / 108 | 1503 / 695 / 113 | 654 / 263 / 63 |
| mine | 402 / 174 / 58 | 582 / 328 / 47 | 444 / 211 / 67 |
| radar-aa | 2768 / 1136 / 68 | 3187 / 1335 / 73 | 625 / 263 / 73 |
| range | 1162 / 518 / 114 | 1569 / 713 / 71 | 527 / 182 / 54 |
| siege-workshop | 2286 / 742 / 106 | 2681 / 925 / 63 | 550 / 191 / 65 |
| stable | 798 / 478 / 128 | 1181 / 677 / 85 | 654 / 231 / 51 |
| tower | 1800 / 300 / 116 | 2175 / 543 / 121 | 504 / 163 / 35 |
| town-hall | 1672 / 704 / 206 | 1588 / 785 / 158 | 558 / 215 / 63 |
| trade-post | 812 / 440 / 90 | 1099 / 623 / 35 | 580 / 226 / 62 |

The counts are what gltfpack leaves (it drops the paper-thin rim triangles of the pennants, 32 a
flag, as it did in the shipped files).

## Code
- `src/battle/render/economyLayer.js`: `buildingStateName(b, role)` names the state (whole, damaged
  under 70% HP, ruined once dead; null for a building that never stood), `ruinCovered` hides a wreck
  once a standing building covers it. `update` no longer skips dead buildings: a dead, finished
  building draws its wreck when its file has one (no greybox wreck). A culture skin has no wreck of
  its own, so it takes the shared file's.
- The sim was not changed and does not need to be: `ecoView` (src/battle/sim/economy.js) keeps
  dead buildings in the view with `alive: false`, `built` as it was and `hp: 0`.
- Tests: `src/battle/render/economyArt.test.js` (the name choice, the wreck drawn, built over),
  `src/battle/render/rtsStates.test.js` (every role of every age has its three states with three
  LODs, a wreck has only fire and smoke sockets), `scripts/blender/validate_model.test.mjs` (the
  ruin budget name rule; that file runs only where `python3` exists).

## Known gaps, said plainly
- Weakest reads at phone size: the mine (the damaged and ruined rock differ mostly by height and
  the scorch mark), the farm plot (the ruin keeps its crop rows, darker, on the scorch mark; in
  Modern the beds stay rather yellow), the Kingdoms tower's wreck (a pale lime stump), and the
  damaged state of the Modern stable and the Kingdoms barracks and food depot (the collapsed corner
  is at the back or small there).
- The 60 culture skin files (`rts-<age>-<theme>.glb`: barracks, tower, trade post) were not rebuilt:
  they have no `-ruined` (the game falls back to the shared wreck) and keep the older, milder
  `-damaged`. Their builders use `rb.damaged`, so a rebuild would pick up the stronger damage.
- A wreck stays for the rest of the battle and for both sides alike; an enemy wreck out of sight is
  hidden by the fog like any enemy building. No fade and no fire effect was added: the fire and
  smoke sockets are there for one.
- The wrecks were judged in Blender renders (LOD0 and LOD1), not in a running battle: nothing in
  the sim destroys a building on demand in the sandbox without playing one out.
- The atlas of each file now also holds the wrecks and the soot materials, so every other object
  has a little less texture area than before (same atlas size).
- Greybox buildings (no art file) still leave nothing when destroyed.
