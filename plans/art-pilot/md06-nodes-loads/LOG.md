# MD06, MD07, AN15, AN16: battle nodes and worker loads for four resources

13 October 2026, branch `claude/art-md06-nodes-loads`. Source rows:
`plans/playtest-audits-art-update-2026-10-13.md` (commit fa1b6abd), rows MD06 and AN15, AN16, MD07.
The battle has four resources: food, wood, stone, gold. Ore is not a resource.

## What was built

| Thing | File | State |
|---|---|---|
| Stone node, rebuilt | `src/assets/battle/nature/stone-outcrop.glb` | new art, same file and object names |
| Gold node, rebuilt | `src/assets/battle/nature/gold-vein.glb` | new art, same file and object names |
| Fish node, rebuilt | `src/assets/battle/nature/fish-shoal.glb` | new art, same file and object names |
| Grove states and log pile | `vegetation-temperate.glb`, `vegetation-mediterranean.glb`, `vegetation-desert.glb` | `stump` and `felled` redrawn, new object `log-pile`, trees unchanged |
| Worker loads kits, new | `src/assets/battle/props/worker-loads.glb`, `worker-loads-modern.glb` | 9 objects each, not drawn by the game yet |
| Ore node | `src/assets/battle/nature/ore-outcrop.glb` | untouched, to be retired by the code session |
| Herds | `herd-sheep-goat.glb`, `herd-cattle.glb` | untouched |

Code (render and art only, no rules):
- `src/battle/render/economyLayer.js`: a grove draws the kit's `log-pile` beside its tree
  (`LOG_PILE_OFFSET`, 0.7 tiles). A kit without the object draws the tree alone, as before.
- `src/battle/art/workerLoads.js` (new, pure): object name per resource, the figure scale, where
  a load sits on a worker. `src/battle/art/artIndex.js`: `workerLoads()` resolver.
- `scripts/blender/validate_model.py`: new kind `prop` (800 / 200 / 50), read from the path for
  `worker-loads.glb`. No existing limit was changed.
- Tests: `src/battle/art/workerLoads.test.js` (new), one new case in
  `src/battle/render/economyArt.test.js`.

## The review that started it

`before-nodes-phone-zoom1@4x.png` is the shipped stone, gold and fish at the phone's battle zoom
(rebuilt from the old builder, unpacked). What was wrong:
- Stone and gold were the same grey boulders. Gold differed only by white quartz lumps and small
  yellow dots.
- `depleted` was one wide boulder, as big on screen as `half`. It read as a rock worth walking to.
- LOD1 was 108 to 140 triangles (LOD1 of `depleted` was 28), LOD2 28 to 56.
- The fish shoal was thin ripple lines and dark fish 0.4 to 0.6 m long: almost nothing at 30 px.

## How each node reads now

A node is about 30 px wide on a phone at zoom 1 (844x390, 18 tiles of height, 2.75 tiles a unit,
so 59.6 px a model unit). The rule used: colour and outline tell the resource, height tells the state.

| Node | Colour | Outline | full | half | depleted |
|---|---|---|---|---|---|
| Stone | pale grey | square: sawn benches and cut blocks | three benches stepping up a quarry face, five loose blocks, 2.7 m | one bench and a small block, three loose blocks, darker rubble, 1.35 m | a flat bed of grey rubble round a dark pit, two broken slabs, 0.34 m |
| Gold | dark rock, bright yellow | pointed crags | four crags, thin steep veins of gold in their faces, a lode of gold chunks up the front cleft, six loose nuggets, 3.4 m | two low crags with a vein each, two chunks, three nuggets, 1.8 m | a dark rubble bed and pit, three small specks, 0.35 m |
| Fish | light blue-green on the water | flat round patch | wide patch, ten dark fish, three silver fish leaping with foam rings | smaller patch, five fish, one leaper | small grey patch, one fish, nothing leaping |
| Wood | green tree, brown logs with pale ends | a tree and a log pile | `tree-l` and the pile | `tree-m` and the pile | `felled` (trunk down, pale stump, stacked logs) and the pile |

The gold seams are faces of the crag itself given the gold material where a tilted slab crosses the
rock (`ti_nature.crag(veins=...)`). A first try with plates through the rock drew yellow hoops round
it and was thrown away. A second try with wide slanting bands covered about 40% of the rock and read
as black and yellow warning stripes next to the reference sheet
(`plans/art/concepts/oct13/nodes-states.png`); the veins are now thin and steep (cracks filled with
gold) and most of the gold is a lode of chunks piled up the front cleft, as the sheet draws it.

LOD1 was raised toward 300 for stone and gold: 240 to 288 (was 28 to 140). LOD2 is 48 to 76 (limit 80).

## Wood: what was chosen and why

No `wood-grove.glb`. The grove keeps coming from the battle's vegetation kit, so a grove's trees
match the forest of its climate, and no code path changes. What was weak was the worked states and
the identity:
- `stump` was one 0.6 m stump, 4 px wide on a phone. It is now three pale-topped stumps with roots
  and pale chips (3.1 m across).
- `felled` was a 0.56 m thick trunk with three thin logs beside it. It is now a 0.8 m trunk beside
  its pale-topped stump, the crown lopped, five logs stacked with their pale sawn ends showing.
- New `log-pile`: six logs stacked three, two, one between stakes (2.6 x 2.3 x 1.8 m). The game now
  stands it beside every grove. Reason: a grove's tree is the same model as every other tree on the
  field, so without a mark the player cannot tell a wood node from scenery. The pile is that mark,
  from the first tick, and it stays as the tree shrinks.
- The trees, bushes, rocks and tufts of the three kits are the same shapes as before: the new
  stump and felled draw the random numbers the old ones drew, and `log-pile` is the last object.
  Their atlas was packed again, so texel positions moved, not the look.

Note for the code session: a node with nothing left is dropped from the view (`n.amount !== 0`),
so `stump` (what `groveNames(0)` asks for) is never drawn today. If a cut grove should leave its
stumps on the field, the view has to keep the spent node.

## Ore becomes stone, in every age (user decision, 13 October)

One rule for every age: an ore node is drawn as a stone node. `ore-outcrop.glb` is in place and
unchanged and `build_nature.py` can still rebuild it as it shipped, so nothing breaks before the
code session acts. Ore pays out `materials` today, the same as stone, so the picture and the yield
already agree.

1. The code session sets `NODE_KINDS.ore.art = 'stone-outcrop'` (not done on this branch: the
   task keeps NODE_KINDS and the sim out of the art work).
2. When ore nodes leave the rules, every ore spot of a battlefield becomes a stone node.
3. Then delete: `NODE_KINDS.ore`, `ORE_RATE_MULT`, `NODE_PARTS.ore` (economyLayer.js), the
   `n.kind === 'ore'` checks in `src/battle/sim/economy.js`, `'ore-outcrop'` in `NATURE_NODES`
   (artIndex.js), the `ore` entry of `KIND_RESOURCE` in workerLoads.js (it already reads as
   stone), the `'ore-outcrop'` item in `build_nature.py` FILES together with `outcrop`, `chips`,
   `cut_blocks` and `veins` (keep `rock_lods`: the vegetation kits' rocks use it), the materials
   `ore` and `verdigris` in `ti_nature.py`, and the file itself. Keep the order of the other FILES
   entries, or leave a `None` placeholder where ore was: a file's seed is its place in that list,
   and moving a file changes its random shapes on the next rebuild.

## Worker loads kit

`src/assets/battle/props/worker-loads.glb`, built by `scripts/blender/build_worker_loads.py` on the
same kit pipeline as the nature files (`ti_town.build_file`: procedural materials, one baked atlas,
material `Town`, LOD0 to LOD2 children per root). One file for every age.

| Object | Shape | Colour |
|---|---|---|
| `load-logs` | three short logs across a back frame: wide and low | dark bark, pale round ends |
| `load-stone` | a sawn block in a rope sling, a smaller one on top: a square lump | pale grey |
| `load-gold` | a small sack heaped with gold: round | dark brown under bright yellow |
| `load-food` | a tall wicker basket of produce: a tall cone | tan, green and red on top |
| `barrow-empty` | a timber wheelbarrow, one plank wheel | wood |
| `barrow-logs` | five logs along the tray | bark, pale ends to the front |
| `barrow-stone` | three sawn blocks | pale grey |
| `barrow-gold` | two open sacks of gold and loose nuggets | dark and bright yellow |
| `barrow-food` | a pale grain sack, a basket of produce, loose greens | pale, tan, green, red |

### Scale note
- Kits are true size at 1 Blender unit = 10 m and are drawn at 2.75 tiles a unit
  (`CITY_TILES_PER_UNIT`). At that scale a 1.8 m person would be 0.495 tiles.
- A soldier or worker is drawn 0.95 tiles tall (`ART_UNIT_WORLD`), which is 1.92 times true size.
- So a load that rides a worker must be drawn at the figure scale: 0.95 / 0.18 = **5.278 tiles a
  model unit** (`LOAD_TILES_PER_UNIT` in workerLoads.js), not 2.75. The kit itself stays at 1 unit
  = 10 m like every other kit.
- On a phone at zoom 1 that is 114.4 px a unit: a worker is 20.6 px tall, a load 7 to 13 px, a
  barrow about 27 px long. The loads are cut a little big for a real back (a 1.1 m log bundle, a
  0.6 m block) because a true-size load would be 5 px.
- `load-*`: the origin is where the load meets the back, bottom centre, everything behind it
  (Blender +Y) and above it. Place it 0.095 units up and 0.022 units behind the worker's centre
  (waist height, 0.95 m): `workerLoadPlacement(x, y, z, yaw)`.
- `barrow-*`: the origin is on the ground under the tray, the wheel ahead, the handles reaching
  0.125 units back. Stand the worker 0.115 units behind the origin:
  `workerLoadPlacement(x, y, z, yaw, { barrow: true })`.
- Wheel: each barrow level (LOD0, LOD1, LOD2) has one child mesh named `wheel` (`wheel`,
  `wheel.001` ... `wheel.014` in the file). Its origin is the axle and the axle runs along its
  local X, so turning it about X spins it. `kitLoader.js` merges a level's children, so the barrow
  already draws whole; a later loader can lift the child out and spin it.

## Triangle and size tables

Limits: node 1,500 / 300 / 80, tree 600 / 150 / 150, prop 800 / 200 / 50. Sizes are LOD0, in
metres, width x depth x height. Barrow counts include the wheel (120 / 28 / 12 of them).

| File | Object | Triangles LOD0 / LOD1 / LOD2 | Size (m) |
|---|---|---|---|
| `stone-outcrop.glb` | `full` | 994 / 276 / 64 | 6.6 x 6.5 x 2.70 |
| `stone-outcrop.glb` | `half` | 910 / 272 / 64 | 5.4 x 5.8 x 1.35 |
| `stone-outcrop.glb` | `depleted` | 652 / 276 / 68 | 4.9 x 5.3 x 0.34 |
| `gold-vein.glb` | `full` | 1464 / 240 / 76 | 6.0 x 6.0 x 3.36 |
| `gold-vein.glb` | `half` | 1012 / 288 / 48 | 5.8 x 5.3 x 1.85 |
| `gold-vein.glb` | `depleted` | 994 / 268 / 56 | 5.3 x 5.0 x 0.34 |
| `fish-shoal.glb` | `full` | 509 / 295 / 64 | 5.6 x 5.4 x 0.85 |
| `fish-shoal.glb` | `half` | 242 / 184 / 43 | 4.0 x 4.0 x 0.71 |
| `fish-shoal.glb` | `depleted` | 77 / 55 / 22 | 2.2 x 2.1 x 0.18 |
| `vegetation-*.glb` (3 kits) | `stump` | 270 / 39 / 13 | 3.1 x 2.7 x 0.65 |
| `vegetation-*.glb` (3 kits) | `felled` | 214 / 137 / 65 | 7.3 x 3.9 x 1.07 |
| `vegetation-*.glb` (3 kits) | `log-pile` | 152 / 128 / 72 | 2.6 x 2.3 x 1.76 |
| `worker-loads.glb` | `load-logs` | 144 / 64 / 36 | 1.13 x 0.66 x 0.75 |
| `worker-loads.glb` | `load-stone` | 164 / 40 / 24 | 0.60 x 0.59 x 0.74 |
| `worker-loads.glb` | `load-gold` | 232 / 38 / 38 | 0.58 x 0.60 x 0.63 |
| `worker-loads.glb` | `load-food` | 280 / 60 / 20 | 0.64 x 0.61 x 0.91 |
| `worker-loads.glb` | `barrow-empty` | 380 / 120 / 26 | 0.82 x 2.4 x 0.74 |
| `worker-loads.glb` | `barrow-logs` | 536 / 180 / 50 | 0.84 x 2.4 x 1.00 |
| `worker-loads.glb` | `barrow-stone` | 512 / 156 / 36 | 0.82 x 2.4 x 1.06 |
| `worker-loads.glb` | `barrow-gold` | 752 / 196 / 40 | 0.82 x 2.4 x 0.93 |
| `worker-loads.glb` | `barrow-food` | 760 / 196 / 46 | 0.82 x 2.4 x 0.98 |

File sizes after packing: stone 406 KB (was 271), gold 429 KB (was 386), fish 140 KB (was 77),
temperate 525 KB (was 418), mediterranean 595 KB (was 458), desert 725 KB (was 622), worker loads
352 KB. Atlases: 1024 for stone, gold and the kits, 512 for fish and the loads.

## Validation

`validate_model.py <file> <out> auto` on every unpacked file, before packing: all seven PASSED
(stone, gold and fish as `node`, the three kits as `tree`, the loads as `prop`). The validator
counts the triangles of a root's direct children, so a barrow's wheel is not in its numbers; the
build script checks the whole barrow, wheel included, against 800 / 200 / 50 and stops on a miss
(`art-build/worker-loads/report-worker-loads.json`). The first fish build failed
`nothing_below_ground` (the bigger fish dipped 2 cm past the 10 cm limit); the fish were raised and
the file rebuilt.

Tests: `npx vitest run src/battle`, 39 files, 327 passed, 1 skipped (the kernel timing budget, which
runs only with `PERF_CHECKS=1`).
`npx eslint --max-warnings 0` on the five changed JavaScript files: clean.
`scripts/art/pack-map-models.test.mjs` (outside src/battle): "are packed" and "keep the object
names the game reads" pass with the new files. Its first case, which lists every model folder
once per map model, timed out at 5 seconds on this Windows machine in three runs. It does not read
the files this branch changed; it was not run on the base commit, so whether it also times out
there is not known.

## Commands

```
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
PY="/c/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe"

# build (about 90 seconds a nature file, 60 for the loads)
"$B" -b --factory-startup -P scripts/blender/build_nature.py -- art-build/nature \
  stone-outcrop,gold-vein,fish-shoal,vegetation-temperate,vegetation-mediterranean,vegetation-desert
"$B" -b --factory-startup -P scripts/blender/build_worker_loads.py -- art-build/worker-loads

# validate the unpacked files from their game paths, then pack
cp art-build/nature/*.glb src/assets/battle/nature/
cp art-build/worker-loads/worker-loads.glb src/assets/battle/props/
"$PY" scripts/blender/validate_model.py src/assets/battle/nature/gold-vein.glb art-build/validation auto
npm run pack:models -- src/assets/battle/nature/gold-vein.glb src/assets/battle/props/worker-loads.glb

# evidence (unpacked files: Blender cannot read the packed ones)
"$B" -b --factory-startup -P scripts/blender/render_kit_zoom.py -- OUT.png 59.6 0 3 --mag 6 \
  art-build/nature/stone-outcrop.glb art-build/nature/gold-vein.glb
"$B" -b --factory-startup -P scripts/blender/render_kit_zoom.py -- OUT.png 114.4 0 5 --person --turn 200 --mag 6 \
  art-build/worker-loads/worker-loads.glb
"$B" -b --factory-startup -P scripts/blender/render_kit_contact.py -- art-build/nature/gold-vein.glb OUT.png 3 0
```

Builds are deterministic: a file's seed is its place in `build_nature.py` FILES (4100 + 17 x index),
whichever files are built with it (before, the seed moved with the order on the command line), and
7700 for the loads. Lower levels now take their colours from the nearest LOD0 face of the same
material (`build_nature.material_transfer`), so a far gold seam never samples the dark rock.

## Evidence in this folder

`scripts/blender/render_kit_zoom.py` (new) stands the objects on a plane under the battle's own
camera direction at a chosen number of pixels a model unit. Files with `@Nx` are the same pixels
enlarged N times so the phone's view can be judged on a monitor.

| Picture | What it shows |
|---|---|
| `before-nodes-phone-zoom1.png`, `@4x` | the old stone, gold and fish at the phone's zoom 1 |
| `nodes-large.png`, `nodes-large-lod1.png` | stone (top row) and gold: full, half, depleted, at LOD0 and LOD1 |
| `nodes-phone-zoom1.png`, `@6x` | the same at the phone's zoom 1 (59.6 px a unit, LOD0) |
| `nodes-phone-zoom06-lod1.png`, `@8x` | at zoom 0.6, LOD1 |
| `nodes-phone-zoom045-lod2.png`, `@10x` | at the furthest zoom, 0.45, LOD2 |
| `fish-large.png`, `fish-phone-zoom1.png` `@6x`, `fish-phone-zoom06-lod1.png` `@8x` | the shoal on water colour |
| `grove-temperate-large.png` | the temperate kit: trees, `stump`, `felled`, `log-pile` (bottom right) |
| `grove-kits-phone-zoom1.png`, `@4x` | the three kits at the phone's zoom 1 |
| `loads-large.png` | every load on a 1.8 m figure seen from behind, every barrow ahead of one |
| `loads-phone-zoom1.png`, `@6x` | the same at the phone's zoom 1 (114.4 px a unit, a worker 20 px) |
| `loads-front-phone-zoom1.png`, `@6x` | the same with the figures facing the camera |
| `loads-phone-zoom06-lod1.png` `@8x`, `loads-phone-zoom045-lod2.png` `@10x` | LOD1 and LOD2 at their zooms |
| `contact-*.png` | `render_kit_contact.py` sheets, one object a tile |

The figure in the load pictures is a plain stand-in drawn by the render script, not a game model.

## What the code session must do

Renderer hook for the loads: not built. The view lists who carries but not what, and the task
forbids touching the sim. Exactly what is missing:

1. `src/battle/sim/economy.js`, the economy view (`ecoView`, about line 645) has
   `carrying: workers.filter((q) => q.carry > 0).map((q) => q.idx)`. Change it to carry the resource:
   `carrying: workers.filter((q) => q.carry > 0).map((q) => ({ idx: q.idx, res: RESOURCES[q.carryRes], kind: eco.nodes[q.job?.node]?.kind ?? null }))`.
   `kind` is only needed while wood and stone are both `materials`; once the four resources exist,
   `res` alone is enough. Any reader of the old list of indices must be updated (none draws it today).
2. In the renderer, after the squads are placed each frame, for each entry: take the worker's
   position and facing, `loadObjectName(res, { nodeKind: kind })`, `workerLoadPlacement(...)`, and
   add the object to a `KitInstances` with `M.makeRotationY(yaw).scale(scale).setPosition(x, y, z)`.
   Load the side's kit once with `loadKit(ART.workerLoads(side.ageId).url)` (Modern has its own file, same object names). Use `kitLodForZoom` for the level.
   The worker models have a tool and a basket baked in; the load sits on the back and does not
   need them removed.
3. Barrows are art only for now: no rule says when a worker uses one. If the design wants them
   (for example a bigger carry after a tech, or always for stone), that is a rules decision.
4. Ore: set `NODE_KINDS.ore.art = 'stone-outcrop'`, then the steps of the ore section above.
5. Nothing to do for stone, gold, fish and the grove pile: they are live with this branch.

## Open points

- Nothing here was seen in the running game or on a phone. The pictures are Blender renders under
  the battle's camera angle with a plain sun, not the game's lighting, shadows or water. A
  `/?battleSandbox` look at 844x390 is still owed, above all for the fish patch on real river and
  sea water (an opaque light disc about 1 cm over the surface) and the pile's place beside a grove.
- The log pile stands 0.7 tiles from the grove's centre from the first tick. The user confirmed this on
  13 October. It has no footprint in the rules, so a worker or a building can overlap it.
- The conifer, tropical and cold vegetation kits arrived with the integration merge. See the third pass
  below: they now get a log pile from `log-piles.glb`; their `stump` and `felled` are still the old ones.
- The older props kits (`props-<age>.glb`) are still judged as `landmark` by `validate_model.py
  auto`. Under the `prop` row some of their objects are over at LOD1 and LOD2 (up to 460 and 198
  by the triangle budget plan's own table). The new `prop` kind is bound only to the
  `worker-loads*.glb` files so this branch does not fail files it did not touch.
- The herds were not reviewed: the task named stone, gold and fish.
- The vegetation files grew by about 100 KB each (the new objects share the 1024 atlas).

## Second pass, 13 and 14 October

### Merge
`claude/integration` at ab3bfa5b (the local branch: origin did not have that commit yet) was merged
in, commit bdb1ac25. Four files conflicted and both sides were kept: the ruined building states and
the log pile in `economyLayer.js` and its tests, the wave 7 lines and the worker loads lines in the
props README and LICENSE. Integration's `kitLoader.js` now keeps a file's own LOD UVs (only the
temperate vegetation kit is still repaired at load). The files of this branch were built with
per-material LOD UVs, so they do not depend on the repair, and the barrow's `wheel` child is still
merged into its level (`bakeBundle` did not change).

### User decisions
- Ore becomes stone in every age: the ore section above was rewritten, the per-age table dropped.
- The log pile beside every grove stays as built.
- A Modern load set was asked for and built (below).

### The Modern loads: a second file, the same names
`src/assets/battle/props/worker-loads-modern.glb`, from the same script
(`build_worker_loads.py -- <out_dir> worker-loads-modern`, seed 7717). It is a second file and not
more objects in the first because:
- both files hold the same nine names, so the resource picks the object exactly as before and the
  age only picks the file (`workerLoadsKey(ageId)`, `ART.workerLoads(ageId)`), the way `props-<age>`
  and `rts-<age>` already work;
- `worker-loads.glb` did not have to be rebuilt or reviewed again, and its 512 atlas keeps its
  texel density (eighteen objects would have wanted a 1024 atlas);
- a battle with no Modern side never downloads the Modern art.
If the Modern file is missing, a Modern worker gets the first set rather than nothing.

| Object | Shape | Colour | Triangles LOD0 / LOD1 / LOD2 | Size (m) |
|---|---|---|---|---|
| `load-logs` | a strapped bundle of sawn planks, square ends | pale sawn wood, dark straps | 148 / 46 / 10 | 1.25 x 0.63 x 0.70 |
| `load-stone` | two concrete blocks and a cement bag on a pack frame | pale grey, tan bag, blue straps | 244 / 52 / 36 | 0.65 x 0.46 x 0.84 |
| `load-gold` | an open steel case stacked with gold bars | dark steel under bright yellow | 192 / 52 / 24 | 0.56 x 0.51 x 0.62 |
| `load-food` | a slotted plastic crate of produce | blue, green and red on top | 268 / 76 / 20 | 0.60 x 0.51 x 0.52 |
| `barrow-empty` | a pressed steel tray on a tube frame, a fat tyre, black grips | green, pale steel, black | 204 / 96 / 26 | 0.84 x 2.4 x 0.69 |
| `barrow-logs` | planks along the tray, strapped | pale sawn wood | 336 / 136 / 36 | height 1.02 |
| `barrow-stone` | three concrete blocks and a cement bag | pale grey, tan | 464 / 144 / 36 | height 1.03 |
| `barrow-gold` | the open case of bars and a second stack | dark steel, yellow | 404 / 132 / 40 | height 0.99 |
| `barrow-food` | the blue crate of produce and a white woven sack | blue, green, red, white | 520 / 172 / 40 | height 0.97 |

Barrow counts include the wheel (80 / 44 / 12). Same scale, origins and wheel rule as the first set
(the Modern axle is 0.08 units ahead of the origin and 0.021 up). No letters anywhere: the cement
bag has a plain dark band. Packed size 214 KB, one 512 atlas, material Town.
`validate_model.py auto` (kind `prop`): PASSED.

Readability rules taken from the reference sheet `plans/art/concepts/oct13/worker-loads.png` and
kept in both sets: one big simple shape a load, the resource's colour on top where the camera
sees it, the carrier's frame and straps thin and dull. A resource keeps its colour across the two
sets (wood pale or brown with pale ends, stone grey, gold yellow, food green and red), so only the
dress changes with the age. After the first render at phone zoom the Modern stone load and gold
case read too small and too dark; the blocks were made a fifth bigger and paler and the bars were
stacked higher over a lower case.

### Checked against the reference sheets
`plans/art/concepts/oct13/nodes-states.png` and `worker-loads.png` (design reference only, nothing
sampled or traced).
- Changed: the gold node, as described above (thin steep veins and a lode of chunks, not bands).
  `gold-vein.glb` was rebuilt, validated and packed again; the node sheets and
  `contact-gold-vein.png` in this folder are the new file.
- Left as built, and why:
  - Stone matches the sheet (sawn benches, loose blocks). The sheet's exhausted quarry keeps a low
    wall; ours is a flat rubble bed round a pit, because the task asked that a depleted node never
    be mistaken for a full one.
  - Fish: the sheet draws a pond with reeds and lilies on land. Ours is a patch laid on existing
    water, so it has no bank or reeds. Reeds round the patch would be a cheap later addition.
  - Wood: the sheet shows trees, stumps and a log pile, which is what the grove now draws. The
    sheet has several trees a grove; the game draws one tree a node.
  - Herds: not reviewed (untouched files).
  - First load set: the sheet carries two thick logs on a shoulder and gold in a tan burlap sack.
    Ours has three logs on a back frame and gold in a dark sack. Both read; the dark sack keeps
    gold apart from a grain sack, which the sheet tells apart only by what shows in the mouth.
    The sheet's tools (axe, pickaxe, shovel, hammer, sickle) are not part of this kit: the worker
    models carry their tools.

### New evidence
| Picture | What it shows |
|---|---|
| `loads-modern-large.png` | the Modern set on the stand-in figure, from behind |
| `loads-modern-phone-zoom1.png`, `@6x` | the same at the phone's zoom 1 |
| `loads-modern-phone-zoom06-lod1.png` `@8x`, `loads-modern-phone-zoom045-lod2.png` `@10x` | LOD1 and LOD2 at their zooms |
| `loads-both-sets-phone-zoom1.png`, `@6x` | first set (top row) over the Modern set, phone zoom 1 |
| `contact-worker-loads-modern.png` | `render_kit_contact.py` sheet |

### Tests on the second pass
- After the merge: `npx vitest run src/battle scripts/art`, 44 files, 362 passed, 1 skipped (the
  kernel timing budget). The first case of `pack-map-models.test.mjs` passed here and also passes
  in the main checkout (3 of 3 in 3.2 seconds), so the three timeouts of the first pass were this
  machine being busy with renders, not this branch.
- After the Modern set and the gold rebuild: the same run gave 359 passed and 4 timeouts at 5
  seconds while other Blender jobs were running on the machine (`pack-map-models` "are packed",
  `sim.test.js`, `systems.test.js`, `battleLoop.test.js`). Those four files alone: 54 of 54 passed.
- eslint on the changed JavaScript files: zero warnings.

### Still open after the second pass
- The Modern barrow's tray is green. On grass it has less contrast than the timber barrow; the
  tyre, the pale frame and the load carry the reading. A charcoal or orange tray is a one-line
  colour change if a phone check asks for it.
- The Modern `load-stone` is the smallest reading of the eight loads at 20 px (grey on a figure).
- Nothing of either pass has been seen in the running game.

## Third pass, 14 October: a log pile for the conifer, tropical and cold kits

The three kits that came with the integration merge have no `log-pile`, so a grove there had no
pile. They were NOT rebuilt. Why rebuilding through `build_vegetation_remaining.py` is not practical:
- Its `stump` and `felled` call `ti_nature.stump` and `ti_nature.felled`, which this branch
  redrew. A rebuild would replace those two objects in all three kits with the new shapes (270
  and 214 triangles, not the shipped ones), against the instruction to leave the existing objects.
- The three files are pinned by hash (`scripts/art/checkpoint38-lod-uvs.mjs`) and carry a recorded
  proof of their authored LOD UVs (checkpoint 38). A rebuild bakes new atlases, moves every UV and
  voids that proof for the trees as well.
- The builder shells out to `python3` for the validator and asserts on the result; this Windows
  machine has no `python3` command (the validator is run here with Blender's own Python).

What was done instead, and it goes one step past the asked fallback (the temperate pile for every
kit): a small file with a pile in each kit's own wood.
- `src/assets/battle/nature/log-piles.glb` (`build_nature.py`, entry `log-piles`, last in FILES so
  no other file's seed moves; one 512 atlas; 175 KB packed):

| Object | Wood | Triangles LOD0 / LOD1 / LOD2 | Size (m) |
|---|---|---|---|
| `log-pile-conifer` | pale red-brown pine bark, pale yellow ends, six logs | 152 / 128 / 72 | 2.6 x 2.3 x 1.76 |
| `log-pile-tropical` | dark hardwood, red-brown ends, six thicker logs | 152 / 128 / 72 | 2.7 x 2.5 x 1.93 |
| `log-pile-cold` | thin white birch and grey larch, nine logs (four, three, two) | 212 / 176 / 48 | 2.4 x 2.1 x 1.27 |

- `economyLayer.js`: a grove whose kit has no `log-pile` takes `log-pile-<kit>` from this file.
  The file is asked for only when the battle's kit is conifer, tropical or cold and the battle has
  groves. Without the file the tree stands alone, as before. Test: the new case in
  `economyArt.test.js` (each of the three kits, no file, and a temperate battle that never loads it).
- `validate_model.py auto`: PASSED as `node` (1,500 / 300 / 80). The cold pile keeps only its
  bottom row, a little thicker, at LOD2 to stay under 80.
- The three kits' files are byte-identical to the merge (`git diff` shows nothing), so their trees,
  stumps, felled trunks, bushes and rocks have the same triangle counts.
- Their `stump` and `felled` are the old shapes this branch replaced in its own kits (one 0.7 m
  stump; a thin trunk with three thin logs, plus moss or snow). They read clearly weaker than the
  new ones at battle zoom. Left as they are, as instructed.
- Note for whoever next runs `build_vegetation_remaining.py`: it will pick up the new `stump` and
  `felled` from `ti_nature.py` and change those objects.

Evidence: `log-piles-large.png`, `log-piles-phone-zoom1.png` and `@8x`,
`log-piles-phone-zoom06-lod1.png` and `@10x` (conifer, tropical, cold, left to right).

Tests: `npx vitest run src/battle scripts/art` gave 361 passed, 1 skipped and 3 timeouts at 5
seconds (`sim.test.js`, `systems.test.js`, `battleLoop.test.js`) with about forty node and Blender
processes of other sessions on the machine. Alone, `sim.test.js` passed 12 of 12; the other two
still timed out at 5 seconds and passed 39 of 39 with `--testTimeout=120000`. None of the three
reads a file this branch changed. eslint on the changed JavaScript files: zero warnings.
