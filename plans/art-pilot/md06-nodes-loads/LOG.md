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
| Worker loads kit, new | `src/assets/battle/props/worker-loads.glb` | 9 objects, not drawn by the game yet |
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
| Gold | dark rock, bright yellow | pointed crags | four crags with yellow seams in their faces, six nuggets, 3.4 m | two low crags, three nuggets, 1.8 m | a dark rubble bed and pit, three small specks, 0.35 m |
| Fish | light blue-green on the water | flat round patch | wide patch, ten dark fish, three silver fish leaping with foam rings | smaller patch, five fish, one leaper | small grey patch, one fish, nothing leaping |
| Wood | green tree, brown logs with pale ends | a tree and a log pile | `tree-l` and the pile | `tree-m` and the pile | `felled` (trunk down, pale stump, stacked logs) and the pile |

The gold seams are faces of the crag itself given the gold material where a tilted slab crosses the
rock (`ti_nature.crag(veins=...)`). A first try with plates through the rock drew yellow hoops round
it and was thrown away.

LOD1 was raised toward 300 for stone and gold: 272 to 300 (was 28 to 140). LOD2 is 48 to 76 (limit 80).

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

## Ore: the replacement plan

`ore-outcrop.glb` is in place and unchanged, `NODE_KINDS.ore.art` still points at it, and
`build_nature.py` can still rebuild it as it shipped. To retire the key:

1. First step, safe on its own: point `NODE_KINDS.ore.art` at `'stone-outcrop'`. Ore pays out
   `materials` today, the same as stone, so the picture and the yield agree in every age.
2. When ore nodes are removed from the rules, turn each ore spot of a battlefield into the node of
   the table below, so old spots do not vanish.

| Age | Use instead of `ore-outcrop` | Why |
|---|---|---|
| Bronze | `gold-vein.glb` | the ore of the age was copper and tin, traded as wealth; the pickaxe mines gold |
| Classical | `gold-vein.glb` | silver and gold mines paid the armies of the age |
| Kingdoms | `stone-outcrop.glb` | the age builds in stone: castles and walls want quarries |
| Gunpowder | `stone-outcrop.glb` | fortress stone; iron is no longer a field resource |
| Modern | `stone-outcrop.glb` | aggregate and building stone |

3. Then delete: `NODE_KINDS.ore`, `ORE_RATE_MULT`, `NODE_PARTS.ore` (economyLayer.js), the three
   `n.kind === 'ore'` checks in `src/battle/sim/economy.js`, `'ore-outcrop'` in `NATURE_NODES`
   (artIndex.js), the `ore` line of `KIND_RESOURCE` in workerLoads.js, the `'ore-outcrop'` item in
   `build_nature.py` FILES together with `outcrop`, `rock_lods`, `chips`, `cut_blocks`, `veins` and
   the materials `ore` and `verdigris` in `ti_nature.py`, and the file itself. Keep the order of
   the other FILES entries: a file's seed is its place in that list.

If the code session would rather keep one rule for every age, use `stone-outcrop.glb` everywhere.

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
| `gold-vein.glb` | `full` | 1376 / 300 / 76 | 6.2 x 4.9 x 3.36 |
| `gold-vein.glb` | `half` | 1076 / 278 / 48 | 4.8 x 4.3 x 1.84 |
| `gold-vein.glb` | `depleted` | 998 / 272 / 56 | 5.1 x 4.3 x 0.35 |
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

File sizes after packing: stone 406 KB (was 271), gold 438 KB (was 386), fish 140 KB (was 77),
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
   Load the kit once with `loadKit(ART.workerLoads().url)`. Use `kitLodForZoom` for the level.
   The worker models have a tool and a basket baked in; the load sits on the back and does not
   need them removed.
3. Barrows are art only for now: no rule says when a worker uses one. If the design wants them
   (for example a bigger carry after a tech, or always for stone), that is a rules decision.
4. Ore: the plan above.
5. Nothing to do for stone, gold, fish and the grove pile: they are live with this branch.

## Open points

- Nothing here was seen in the running game or on a phone. The pictures are Blender renders under
  the battle's camera angle with a plain sun, not the game's lighting, shadows or water. A
  `/?battleSandbox` look at 844x390 is still owed, above all for the fish patch on real river and
  sea water (an opaque light disc about 1 cm over the surface) and the pile's place beside a grove.
- The log pile stands 0.7 tiles from the grove's centre and has no footprint in the rules, so a
  worker or a building can overlap it. Say if it should be closer, further or only shown once the
  grove has been worked.
- The loads kit has one look for all ages: a timber barrow and wicker basket fit Bronze to
  Gunpowder. A Modern battle would want a steel barrow and crates. Not built.
- The four missing vegetation kits (conifer, tropical, steppe, cold) fall back to temperate as
  before, so they get the new grove states through it.
- The older props kits (`props-<age>.glb`) are still judged as `landmark` by `validate_model.py
  auto`. Under the `prop` row some of their objects are over at LOD1 and LOD2 (up to 460 and 198
  by the triangle budget plan's own table). The new `prop` kind is bound only to
  `worker-loads.glb` so this branch does not fail files it did not touch.
- The herds were not reviewed: the task named stone, gold and fish.
- The vegetation files grew by about 100 KB each (the new objects share the 1024 atlas).
