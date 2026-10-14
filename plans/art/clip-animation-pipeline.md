# Clip animation for battle units: what the code needs (I219)

Status: design note, 2026-10-14. Answers audit item I219 for the code session. No code changed.

## 1. What we have today

- **Drawing.** One `InstancedMesh` per (age, class) and detail level; the three levels share the
  per-instance buffers: matrix, colour, `aAnim` vec3, `aVariant` vec4 (`src/battle/render/
  BattleRenderer.js` 849-874). Only figures in view are written each frame (`drawSquads`, 1253).
- **A rigid rig in the vertex shader.** Each vertex has `aLimb` (8 bones, `soldierFactory.js` 25)
  and `aPivot` (its hinge). `rigAngle()` (`RIG_GLSL`, 415-451) swings legs and arms from `aAnim` =
  (phase, moving, attacking) and the clock `RIG_TIME` (544). No death, hit or work motion.
- **Attributes.** A layer uses 14 of the 16: position, normal, color, aLimb, aPivot, aUv, aLook,
  aAnim, aVariant, instanceMatrix (4), instanceColor (`packForGPU` comment, 524-527). Two are free.
- **GLB bake.** `extractUnitGeometry` (`gltfUnitLoader.js` 246) poses the model on Idle frame 1
  (`applyPose`, 180-196), bakes one non-indexed flat-shaded soup (462), maps each vertex to its
  **dominant bone** (320-326) and that bone to a limb by name (109). The clips are then dropped.
- **Detail levels** (`soldierLod.js`): LOD1 and LOD2 are made **at runtime** by meshopt (550 and
  220 triangles, 19), welding on every rig attribute (40). One level for the whole field (152).
- **Per squad, not per figure.** The view gives position, facing, strength, `routed` and
  `striking` (`view.js` 46, `packedView.js` 22, 48). The renderer derives `moving` (1294) and
  `fighting` (1301). A figure that dies just stops being drawn; `spillBlood` sprays (1342, 1275).
- **Workers** are one figure a squad (`battleStats.js` 20). `workerTick` (`sim/economy.js`
  425-491): `gather` phase 0 walks out, 1 works or waits for a slot (455-457), 2 hauls; deposit at
  441. `build` (473) and `repair` (480) set `lastStrikeTick` (the strike pose). **Gathering sets
  nothing, so a gathering worker stands still.** `ecoView.carrying` (671) covers only the player's
  workers. Node kinds (`data/economy.js` 102-109): tree, stone, gold, herd, cattle, fish, farm.

## 2. What the art already gives us

| GLB | Clips (keys / seconds) |
|---|---|
| bronze-infantry | Idle, IdleAlt (2.0 s), Walk 1.0, Run 0.7, Retreat-run 0.7, Attack 1.0, Attack2 1.2, Block 1.0, Hit 0.4, Death 1.5, DeathAlt 1.5, Cheer 1.6 |
| bronze-ranged | Idle, IdleAlt, Walk, Run, Draw-aim-release 1.6, Melee-fallback 1.0, Hit, Death, DeathAlt |
| bronze-worker | Idle, Walk, Run, Carry 1.25, Chop 1.65, Mine 1.45, Harvest 1.85, Build 1.25, Repair 1.05, Deposit 1.5, Hit, Death |
| bronze-siege | Idle, Move, Deploy, Aim, Fire, Reload, Destroyed |
| the other 40 unit GLBs | none: `ti_figure.py` 1408 exports `animations=False` ("rest pose only, no clips") |

- Authored at 20 fps (`ti_units.py` 94 and 151; builders write `clips.json` with fps 20). The
  exporter resamples at about 29 keys a second; durations match 20 fps.
- Events exist only in `clips.json` in the build output (for example `build_bronze_worker.py`
  174-176: Chop contact 19, Mine 17, Build 17, Repair 14, Deposit pour 18, Death settle 30). They
  are **not in the repo**, so the game cannot read them.
- Rig: `ti_units.py` `rig()` (81-95), 21 bones: Root, Hips, Spine, Chest, Neck, Head, and per side
  Arm, Forearm, Hand, Prop, Leg, Shin, Foot, plus Prop_Back. Mounts add 14 `Mount_*` bones and a
  `Rider` socket (35 in all). Bronze siege carries 91 (four crew plus the machine).
- The bronze worker has one tool (a mattock on Prop_R) and a basket on Prop_Back. AN15 wants an axe
  for Chop and a pickaxe for Mine and gold: **tool swap needs authoring**.
- Plan conflicts: `ART-MODELS-PLAN.md` D5 (57) chose VAT and Wave 0b (702) is this work;
  `model-brief-for-claude.md` 4.6 (197) says 30 fps and lower-case bone names that no builder uses.
- Phone budget (`TRIANGLE-BUDGET.md` 183): 700k triangles target, 1.0 M ceiling, 128 MB GPU
  textures in a battle. A two-triangle impostor (8 directions x pose frames) is planned (215, 287).

## 3. The three options

| | 1. VAT | 2. Bone texture, rigid (recommended) | 3. More procedural motions |
|---|---|---|---|
| Data | Each vertex's position (and normal) per frame, RGBA16F | Each bone's 3x4 matrix per frame, RGBA32F, 3 texels a bone | None |
| Size, bronze infantry (300 frames) | LOD0 6,000 verts: 14 MB positions, 29 MB with normals; LOD1 8 MB; LOD2 3 MB | 21 x 3 x 300 x 16 B = **0.3 MB**; mounted 0.5 MB; siege 1.3 MB | 0 |
| A battle (about 14 unit types) | 200 to 400 MB with LOD0: over the 128 MB budget | 5 to 10 MB | 0 |
| Detail levels | Each level needs its own bake, and the levels are made at runtime, so the bake must run after meshopt | Levels keep the bone index like `aLimb` today: **one texture serves all levels** | Free |
| Attributes | `gl_VertexID` addresses the texture: drop aLimb, aPivot (12 used) | `aBone` replaces aLimb and aPivot (13 used); full 4-weight skinning would be 15 | aAnim becomes a vec4 (14) |
| Vertex work | 2 fetches (position, normal) per sample | 3 `texelFetch` per sample; 6 with frame blend, 12 while cross-fading | A few ALU ops |
| Uses the authored clips | Yes | Yes | No |
| Build step | Bake script in Blender or Node | **None needed**: sample the clips in the loader with three's `AnimationMixer` (already used in `applyPose`) | None |
| Work | about 3 weeks | about 2 weeks | about 1 week |

Both texture options read unfiltered float textures with `texelFetch`, core WebGL2 on iPhone
Safari. All three are visual only: the sim never reads animation, so hashes, replays and parity are
unchanged. Clip time runs on `RIG_TIME`.

VAT loses on memory and on its coupling to runtime LODs; procedural ignores art that exists. Rigid
skinning is what the loader already does (dominant bone), matches the brief's rigid LOD1 weights and
keeps the faceted look.

## 4. Recommended design (option 2)

**Loader** (`gltfUnitLoader.js`): keep the rest bake. Also write `aBone` (the dominant bone's index)
instead of only the limb. For each clip, sample at 20 fps: set the mixer time, update world
matrices, and store per bone `norm x W(frame) x W(rest)^-1 x norm^-1` (W = the bone's world
matrix, `norm` the loader's normalising matrix). That is relative to the baked rest pose, so polearm
fitting, team and skin tags are untouched. Pack frames into one RGBA32F `DataTexture` per unit,
plus a clip table (first frame, frame count, loop). `unitComposer.js` composed units get the same
treatment from their cloned skeletons.

**Shader**: a `USE_CLIPS` variant of `patchRig` for the three materials (soldier, far, depth). Fetch
the bone's matrix for the frame and the next, lerp, transform position and normal. Units without
clips (procedural, the 40 static GLBs) keep today's `rigAngle()` path unchanged.

**Per-instance state**: `aAnim` becomes vec4 = (clip, start time, rate, figure phase). A second
vec4 `aAnimPrev` (clip, start time, rate, switch time) gives a 0.15 s cross-fade; phones may skip it.

**Renderer state machine** (`drawSquads`): a small per-figure array next to `squadFigures`
(current clip, start time). Choose per figure:

| Squad state | Clip |
|---|---|
| still | Idle or IdleAlt (by figure hash) |
| moving | Walk or Run, rate scaled to real speed (strides: walk 1.6 m/s, run 2.6) |
| striking | Attack or Attack2 alternating, started so the contact frame lands on the sim's strike tick |
| lost strength, figure survives | Hit on a few front figures; never over Death |
| routed | Retreat-run |
| won | Cheer |
| figure lost | Death or DeathAlt in a **corpse pool**: the slot where `spillBlood` already puts it, hold the last frame, sink after some seconds |

The corpse pool needs room in each layer's capacity (`capacity.js` `soldierSlots`).

**View fields to add** (packed per-tick record, `packedView.js` FIELDS; never hashed):

| Field | Why |
|---|---|
| `lastStrikeTick` | Sync attack contact (and arrow release) to the real event (AN06, AN07) |
| `lastHitTick` | Hit reaction (the sim already keeps it) |
| `work` | Worker job code: to-node, working, waiting for a slot, hauling, build, repair, plus the node kind |
| `lastDepositTick` | Deposit at the real drop-off (AN16) |

`work` must cover every visible worker, not only the player's (`ecoView.carrying` today).
Worker clips: tree to Chop, stone and gold to Mine, herd, cattle, fish and farm to Harvest,
hauling to Carry, build to Build, repair to Repair, waiting to Idle.

**Impostor (LOD3)**: bake its atlas from the same sampled frames, and pick the atlas cell from the
same per-instance (clip, time). Same state, no new contract.

## 5. Which clips are ready to bake

| Ready now | Needs authoring or export |
|---|---|
| Bronze worker: all 12 (the tool is wrong for Chop and Mine) | Axe and pickaxe props with per-clip visibility (AN15, MD07) |
| Bronze infantry: all 12 | Classical to Modern: export clips (they ship rest pose only) |
| Bronze ranged: all 9 | Mounted: no unit has clips (AN09) |
| Bronze siege: 7 | Charge, Rout, Victory where the brief lists them |

## 6. Phased plan

1. **Workers and death** (about 1 week): loader bake, `USE_CLIPS` shader, per-figure state,
   `work` and `lastDepositTick` in the view, corpse pool. Bronze worker plays its 12 clips; Bronze
   infantry, ranged and worker die and lie still.
2. **Combat** (about 4 days): Attack and Attack2 synced to `lastStrikeTick`, Hit, Block,
   Draw-aim-release at the arrow spawn, Retreat-run, Cheer; siege Fire, Reload, Destroyed.
3. **Cavalry and generals** (about 4 days, after the art): 35-bone mounts, coupled rider and horse.
   Then the impostor.

Each phase: battle-lab screenshots at 844x390, phone frame time within D3.

## 7. Contract between art and code

- **Bones**: the `ti_units.py` names (section 2). One dominant bone per vertex decides the motion,
  so weight cleanly. At most 128 bones a file.
- **Frame 1 of Idle is the rest pose** the game bakes.
- **20 fps**, in place (Root moves only for Death's fall), loops closed (first frame equals last).
- **Names** per archetype: the D5 table (`ART-MODELS-PLAN.md` 161-171), spelled exactly.
- **Events** (1-based frames): `contact` (Attack, Attack2, Melee-fallback, Chop, Mine, Build,
  Repair), `release` (bow and gun fire), `cut` (Harvest), `pour` (Deposit), `settle` (Death,
  DeathAlt, Destroyed, Wreck).
- **Tools**: each tool on its own child bone of Prop_R (`Tool_Axe`, `Tool_Pick`), keyed to scale 0
  in clips that do not use it.
- **Files**: clips inside `src/assets/units/<uid>.glb` (ACTIONS mode). Loop flags and events in
  the options file `src/assets/units/<uid>.json` under `"clips"`, which `unitModels.js` already
  loads (34). Stop leaving `clips.json` only in the build output.

### 7.1 Worker tools and clips (art, 2026-10-14; rows U06, AN15, AN16, MD07)

Delivered on `claude/art-worker-clips` for the five base workers (`<age>-worker.glb`), built by
`scripts/blender/build_<age>_worker.py` over `scripts/blender/ti_worker_clips.py`. Clip table:
`plans/art-pilot/worker-clips/LOG.md`.

- **Tool bones**, children of `Prop_R`, heads at the right grip, the bone's Y axis along the haft:
  `Tool_Held` (the tool held today: Bronze mattock, Classical staff pick, Kingdoms staff axe,
  Gunpowder barrow with its shovel, Modern sledgehammer), `Tool_Axe`, `Tool_Pick`, `Tool_Sickle`,
  `Tool_Hammer` (Bronze a wooden mallet; Modern has none and builds with `Tool_Held`). Gunpowder adds
  `Tool_Wheel`, a child of `Tool_Held` at the axle, turning in the moving clips. Their vertices
  classify as the right arm (as `Prop_R` did), so the procedural rig moves them as before.
- **Visibility is the bone's uniform scale**, 1 or 0, keyed on every frame of every clip. Each clip
  shows one tool (`"tool"` in the options file); scale tracks that equal the bind value (1) are
  dropped by gltfpack, so **a missing track means the bind value**: sample each clip starting from
  the bind pose.
- **The rest bake is unchanged**: Idle frame 1 shows `Tool_Held` only, so the four work tools bake as
  degenerate triangles at the grip (invisible; under 200 triangles a worker, counted in the 2,000).
  For those bones `W(rest)` has scale 0 and no inverse: take **the bind pose** (the GLB's node
  transforms, every tool at full size) as the reference instead, that is bake the `Tool_*` vertices
  from the bind pose and store `W(frame) x W(bind)^-1` for them. For every other bone bind and Idle
  frame 1 agree within 1 mm (the floor lift), so the bind pose can serve as the reference for all.
- **Root**: in place on X and Y in every clip. Root moves vertically for ground contact (the gaits'
  rise and fall, crouches in the work clips with the feet planted) and rotates for Death's fall.
- **Timing**: frame f is at f / 20 s in the GLB (frame 1 at 0.05 s, the last at frames / 20). The pack
  keeps the 20 fps keys (`-af 0` for unit files, `scripts/art/glbInfo.mjs`). Loops are closed: the
  last frame repeats the first.
- **Options file** `"clips"`: per clip `frames`, `fps`, `loop`, `tool` (`Held`, `Axe`, `Pick`,
  `Sickle`, `Hammer`) and `events` (1-based): `contact` (Chop, Mine, Build, Repair), `cut` (Harvest),
  `pour` (Deposit: the frame the load leaves; the game drops its load there), `settle` (Death, the last
  frame). Contact frames are held two frames (the event frame and the next).
- **Loads**: none added to the meshes; the game draws logs, stone, gold and food from
  worker-loads.glb. The loads that are part of today's look stay (Bronze and Classical baskets, the
  Kingdoms firewood, the Gunpowder barrow's earth).
- **Per worker**: Gunpowder keeps the barrow on the ground (hands on the handles) in Idle, the gaits
  and Hit, tips it over the wheel in Deposit, leaves it standing when he falls (Death), and hides it in
  the work clips. Modern walks with the sledgehammer on the right shoulder and steadies a shoulder
  load in Carry. The basket workers tip the basket over the left shoulder in Deposit.

### 7.2 Foot soldiers' clips (art, 2026-10-14)

Delivered on `claude/art-foot-clips` over `scripts/blender/ti_foot_clips.py` (the poser and author of
7.1, lifted into `scripts/blender/ti_clips.py` and shared). Clip table and sheets:
`plans/art-pilot/foot-clips/LOG.md`. Test: `src/battle/render/footClips.test.js`.

- **Sets** (`"clips"` in the options file, in this order): melee (spear, sword, pike) Idle, IdleAlt, Walk,
  Run, Retreat-run, Attack, Attack2, Block, Hit, Death, DeathAlt, Cheer; bow Idle, Walk, Run,
  Draw-aim-release, Melee-fallback, Hit, Death, DeathAlt; gun (Gunpowder and Modern infantry, riflemen
  and mercenaries: the sim makes them shooters, `AGE_OVERRIDES`) the same with Aim-fire-reload; support
  Idle, Walk, Run, (Mine), Build, Repair, Hit, Death. Retreat-run is a plain upright run (no panic); play
  it for a squad walking back, or not at all.
- **Loops**: Idle, IdleAlt, the gaits, Cheer and the work clips. Attack, Attack2, Block, Melee-fallback,
  Draw-aim-release and Aim-fire-reload are one-shots, played once per strike or shot so the event frame
  lands on the sim's tick (`lastStrikeTick`); they start and end on the same pose (the melee guard, or the
  rest pose for the shooting clips), so back-to-back plays join without a fade.
- **Events** (1-based): `contact` (Attack, Attack2, Melee-fallback, Mine, Build, Repair; held two frames),
  `release` (Draw-aim-release: the arrow leaves; spawn the projectile here), `fire` and `reloaded`
  (Aim-fire-reload: the shot, and the end of loading), `settle` (Death, DeathAlt: the last frame; hold it).
- **Prop bones move**: Prop_R and Prop_L are keyed relative to their hands (a hand slides along a haft: the
  pike held near its butt, the musket at the stock's wrist; the musket stays in the left hand while the
  right rams). Sample every bone, Prop_* included; never assume a prop is fixed to its hand.
- **Tool_Arrow** (archers with a nocked arrow): a child of Prop_R, shown by scale as the worker tools
  (7.1: a missing scale track is the bind value 1); 0 from `release` until a new arrow comes out of the
  quiver. Its vertices classify as the right arm, as before. **Prop_String** (the Bronze bow only, a child
  of Prop_L) carries the string's middle and follows the drawing fist; the Classical and Kingdoms strings
  are single segments on Prop_L and stay straight.
- **Polearms** (meshes named spear, pike, lance, halberd): every vertex hangs from Prop_R alone (tested).
  `fitPolearm` stretches the shaft at rest, from the butt along its rest axis; under clips keep that bake
  and move the stretched vertices with Prop_R's matrix relative to rest (`W(frame) x W(rest)^-1`, section
  4): the stretch rides along rigidly, so it must be applied once, in rest space, before the clip matrices,
  and never re-applied per frame or along a posed axis. A pike levelled in Attack reaches about 2.4 m in
  front of the man at its 5 m length; that is the drawing, not a bug. Polearms stretch only for base
  infantry (`bakeOptionsFor`), so a mercenary's or a general's spear keeps its authored length.
- **Root** stays on X and Y (glTF X and Z) in every clip (tested); it rises and falls with the gaits and
  the crouches, and turns for the falls (forward in Death, backward in DeathAlt). The floor pass keeps the
  body above the ground; a weapon may dip into it (a spear butt behind a thrust).
- **Weapon hands**: the weapon's bone carries the weapon exactly; the fists reach for it with two-bone
  IK on the figure's short arms, so on a few in-between frames (a long gun coming down from the shoulder,
  the spade's toss) a fist can sit up to 10 cm off the haft. Nothing for the code to do; it is the art.
- **Not covered**: modern-ranged (the ATGM team: three rigs, a kneeling gunner) keeps its rest pose and the
  procedural rig; mounted units, siege and vehicles are separate work. The Gunpowder rifleman's rifle
  hangs from Prop_L (his left fist), every other gun from Prop_R. No ramrod and no spare magazine were
  modelled (the triangle counts are unchanged), so loading is the hands' motion alone.

## 8. Open questions for the user

1. Replace D5's VAT with the rigid bone texture? (Same art, about 40x less memory.)
2. 20 fps everywhere? The model brief says 30, and the Classical infantry builder uses 30.
3. How long should bodies lie: a few seconds, or the whole battle (capped per squad)?
4. Should enemy workers also show their work, or only yours?
5. Export the generic `ti_units` clip set as placeholders for Classical to Modern now, or wait
   for authored clips?
6. On phones, allow the cross-fade, or snap between clips to save vertex work?
