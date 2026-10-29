---
name: battle-lab
description: Investigate and verify Terra Imperium's real-time tactical battles (src/battle/ sim, orders, targeting, movement, morale, combat math and the three.js battlefield renderer). Headless squad-by-squad traces reproduce "units don't respond, don't attack, walk away, only archers fight" bugs; a parity check compares tactical vs auto-resolve over many seeds; a real-browser run screenshots a live battle and lists console errors. Use for any bug report or change touching manual (commanded) battles, the battle HUD or the battlefield visuals.
---

# Battle lab

The tactical battle is a deterministic 20 Hz sim (src/battle/sim/, `step(world, orders)`) run in
a Web Worker and drawn by three.js at 60 fps (src/battle/render/BattleRenderer.js), which
interpolates the last two snapshots (src/battle/render/view.js `makeRenderView`). Orders are the
only input (src/battle/sim/orders.js). A player tap goes TacticalBattleScreen.jsx `issueAt` ->
renderer `pick()` -> an order. Reproduce in the sim first: it's exact and fast.

## 1. Trace squads headlessly (reproduce the bug)
```bash
ATT=infantry,infantry,cavalry,ranged DEF=infantry,infantry,ranged AGE=bronze TERRAIN=plains \
ORDER=attack TICKS=1400 EVERY=100 SEED=42 FORT=0 INTEL=1 \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/squadTrace
```
Each tick block lists every squad's position, order, target and state (inReach, closing,
noTarget, routed, fled), strength and morale. `TALLY` lines give time in each state and damage
dealt. ORDER is attack, attackMove, move or none. If the trace looks right but the game doesn't,
the bug is in input (pick radius, fog-hidden targets, tap vs select) or rendering, not the sim.
Add the regression test to src/battle/sim/orders.test.js (it has a `world()` helper).

## 2. Parity with auto-resolve
```bash
N=16 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/parity
```
Exchange rate (attacker losses / defender losses), tactical vs auto, per matchup. Judge on 16+
seeds: 4 seeds swing it by 30%. The guardrail in systems.test.js keeps tactical within
[auto / 2, auto x 3.5]. Commanded play must never be a shortcut to free wins.

### Campaign parity: the economy on, the honest auto-resolve (phase R2)
```bash
N=32 TYPES=field,assault,town AGES=bronze:bronze,classical:kingdoms TERRAIN=mixed \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/parityEco
BASE=<parityEco output> K=0,1.5 U=1000 EFF=1,1.6 F=8,12 A=12,20 D=8,12 W=0.6,0.7 \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/autoCalib
```
parityEco runs every campaign battle the way the game fights it (TYPES also raid, sack, sally, landing; the battle economy on, the real
city from its manifest with its militia; `assault` a walled city at fort level 2, `town` an
unwalled one) against src/engine/autoBattle.js `autoFromInputs` fed the same armies. Each row:
exchange tactical vs auto, the ratio and IN/OUT of the guardrail [auto / 2, auto x 3.5], wins
both ways, auxiliaries trained, battle length, the city's damage kinds. autoCalib reads a
parityEco output and grid-searches the auto's constants (AUTO_TUNE: auxiliaries, the walls'
gate, closeness); put the winners in autoBattle.js and rerun parityEco. Any change to the sim's
economy or AI needs this rerun: Auto must stay honest (master plan 6.1).

autoCalib also takes `TA=`/`TD=` (the town's auxiliaries, AUX_TRAINED.town), `WAR=` (WALLS_AGE_RELIEF)
and `ROWS=1` (every row of the winner).

### What decides an assault (I211, I212)
```bash
N=12 ATT=infantry,infantry,infantry,cavalry,ranged DEF=infantry,ranged FORT=2 AGE=bronze [VERBOSE=1] \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/siegeProbe
```
Per seed: outcome and reason, when the gate, the ring and the keep fell, the base left, the share of
the attacker's losses from towers and the keep, auxiliaries' lifetimes and who hit them (AUXHITS).
VERBOSE prints the keep's HP and what the attackers target every 20 s. The siege rules themselves
(frontage, volley cap, fire by HP, storming the keep, repairs under attack): src/battle/sim/siegeRules.js.

### Walls hold (city assaults)
```bash
N=12 AGE=bronze TIER=medium [ORDER=keep] [STRICT=1] \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/wallTrace
node .claude/skills/battle-lab/wall-shot.mjs <out.png> [--until fallen]   # dev server first, 844x390
```
wallTrace counts the attacker's ground squads inside the wall ring while every wall segment, ring
tower and the gate still stand (must be 0) and prints when the ring first broke. The ring's walls
are TILE.BUILDING, the gate TILE.GATE: shut to the attacker (its squads batter it), open to the
defender (movement.js passableAt, per-side flow fields in pathing.js getFlowField).

## 3. See it in a real browser
```bash
npx vite --port 5199 --strictPort > /tmp/vite.log 2>&1 &
node .claude/skills/battle-lab/screenshot.mjs <scratchpad>/battle.png 60
ps aux | grep "[v]ite --port 5199" | awk '{print $2}' | xargs -r kill
```
(Don't stop the server with `pkill -f "vite --port …"`: the pattern matches the calling shell
and kills it.) The script opens `?battleSandbox`, starts the battle, attack-moves the player
army on the keep at 3x, prints blood and fx counts every 5 s, centres on the fight (or on the army before any blood), saves the
screenshot and lists console errors. Look at the image with the Read tool. "GPU stall due to
ReadPixels" warnings come from SwiftShader, not the game. It relies on the DEV-only hooks
`window.__battleRenderer` and `window.__battleOrders`. Every real-browser script launches Chromium through scripts/lib/browserLaunch.mjs on the real GPU (SwiftShader only with `--swgl` or `SWGL=1`).

### Soldiers at every zoom (phone, iPad, desktop)
```bash
node .claude/skills/battle-lab/zoom-shots.mjs <outDir> [prefix]   # dev server on 5199 first
SIZES=phone:874x402@3 ZOOMS=near:2,far:1,farther:0.6 TIER=2 node .claude/skills/battle-lab/zoom-shots.mjs <outDir> t2
```
Starts the sandbox (kingdoms, mixed, the defaults), fights 12 s at 3x, pauses, centres on your army
and saves one jpg per size and zoom with the detail level picked (TIER forces one; `URL=...&age=bronze`
for another age). Look at every level at the user's zoom: troops must read as soldiers and riders.

One unit model up close at five zooms (a production build served by `npx vite preview`; add
`EXTRA=perf` or the build hides `window.__battleRenderer`):
```bash
AGE=gunpowder CLASS=cavalry ARMY=cavalry EXTRA=perf node .claude/skills/battle-lab/unit-closeup.mjs http://localhost:5216/terra-imperium/ <outDir> cav
```
For cavalry shots pass `ARMY=cavalry`: the default `small` army has no cavalry squad, so the shot
centres on stand-in procedural horsemen, not the age's model. `LAYER=general` centres on the general,
`PARAMS='raid=raid&spectate'` shows the raiders, `ARMY=siege CLASS=siege` the machines, `TIER=1|2`
forces a detail level.

## 4. Scale: ms per tick at 300 / 500 / 1,000 squads a side
```bash
node scripts/battle-bench.mjs                       # this checkout
node scripts/battle-bench.mjs --root <other checkout> # the same battle on older code (git archive it)
```
AI against AI (king), a full army mix with generals and powers, everyone on the field in deep
blocks (`setup.deployment = 'blocks'`, src/battle/bench/benchScenario.js), 2,400 ticks, best of 3.
The phone column is x4 (plans/rts-world-review.md section 5), the budget p95 <= 10 ms (RTS plan
13.1). Timing is noisy on this hybrid laptop: pin to one core (`start /affinity 4 /high /wait /b
node ...` on Windows) and compare before and after interleaved on the same machine.
`PERF_CHECKS=1 npx vitest run src/battle/sim/kernel.test.js` asserts the 300-a-side budget.
See it drawn: `?battleSandbox&bench=300&autostart` (add `&perf` for the on-screen readout: fps,
frame p50/p95, renderer main-thread ms, sim ms per tick, triangles, draw calls, figures, LOD level;
it works in a production build and on a real phone, see below).

Renderer at scale (phase C2, plans/MASTER-PLAN.md 6.2):
```bash
npx vite --port 5199 --strictPort &
node .claude/skills/battle-lab/render-bench.mjs <outDir> [--bench 300] [--dpr 1] [--throttle 4]   # Edge, real GPU, 844x390
node scripts/battle-phone-bench.mjs --sizes 300,500 --throttle 1,4,6 --out <dir> [--url <build>]  # DPR 3, touch, CPU x4/x6
SIZES=300,500 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/viewcost  # frame build + transfer ms
```
render-bench times BattleRenderer.render, drawSquads and three's render separately and screenshots
each camera. CPU throttling over CDP slows the page's main thread but NOT the sim worker (its ms per
tick stays flat) and never the GPU; take the sim's phone figure from battle-bench.mjs x4. Numbers on
the hybrid laptop swing 30 to 50% run to run (other processes, thermals): compare interleaved.
For timings use a production build (`npx vite build --outDir <tmp> --emptyOutDir`, then
`npx vite preview --outDir <tmp> --port 5198`; never build into docs/ for this): React dev mode
adds milliseconds to every HUD update.
Real phone on the same Wi-Fi: `npx vite --host` (prints the Network URL, e.g.
http://192.168.1.22:5173/terra-imperium/), allow Node through the Windows firewall for private
networks, then open `<Network URL>?battleSandbox&bench=300&autostart&perf` on the phone in landscape.
Renderer rules: soldiers draw through soldierLod.js (full, then meshoptimizer edge collapse to about
550 and 220 triangles within 1.5% and 3% error, thin shafts locked; one level a frame by size on screen
within BATTLE_GRAPHICS.figureTriangles; never vertex clustering, which left only team cloth as blue
arrows); GLB people, mounts and land machines are drawn at the art set's own scale (unitModels.js
ART_UNIT_WORLD, unitScale.test.js checks man, horse and rider heights, and for every machine file
that its crew is the infantryman's size and the machine about two thirds of its real size, camels
and elephants their true size with riders the infantryman's size; a machine's JSON `footprint`
sets the squad's spacing and how many are drawn, `machineLayout`); only squads in view are written;
figures per squad shrink past 80 squads a side (capacity.js figureScale); props are instanced per
48-tile chunk so three culls them; worker frames are packed (packedView.js, keep it equal to view.js).
Any change to the sim must keep `kernel.test.js` (grids equal the full scan, hash chain) green; a
pure speed change should leave every world hash unchanged (compare `runHeadless(...).chain`).

## Rules of the sim
- Integer Q8 fixed point (1 tile = 256), integer ticks, `nextRandom(w)` only. Replays and the
  replay-verification tests (replay.test.js) must stay exact. Round damage immediately.
- Anything outside the sim influences it only through orders.
- A new player order needs its row in `src/battle/sim/orderSchema.js` in the same change: the live
  loop and the verified replay both admit orders through it (orderSchema.test.js fails otherwise).
  The campaign verifies a commanded battle on `buildCommandedSetup` (src/engine/battleVerify.js);
  a rule change that moves hashes bumps `SETUP_VERSION` once.
- New per-squad fields go in `makeSquad` (world.js); new view fields in view.js.
- Neighbour queries go through the packed grids (spatial.js, pathing.js `queryRadius`,
  `buildTargetGrid`), never a scan of every squad per squad. `classId`, `commanderId` and `side`
  are fixed after createWorld (squadLists.js caches lists by them).
- Every 20 ticks step() folds the world hash into `w.hashChain` (hash.js); `replaySegment`
  (replay.js) verifies a battle from a snapshot and the tail of its log.
- Renderer: every geometry, material and texture goes through `this.track()` so `dispose()`
  frees it; instanced meshes reset `count` every frame; short effects live in `this.fx` with a life.
- Run `npx vitest run src/battle` and the full suite before committing.

## Resources on the field (W12: every tree is wood)
```bash
SEEDS=8 TERRAINS=plains,forest,mixed TYPES=field,assault \n  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/nodeCount
node .claude/skills/battle-lab/wood-shot.mjs <outDir> [--seconds 150 --zoom 3.5] [--query "&terrain=mixed&age=bronze"] [--perf-only]
```
nodeCount prints the nodes per battle by kind, the trees, and each resource by half (west, east): run it on
two checkouts to compare a node change. wood-shot (dev server first) times the frame over the woods
(frame and main-thread p50/p95, sim ms per tick, draw calls, triangles), sends the laborers to a wood by
the camp and screenshots them chopping among the stumps, then the whole field.

## Building in battle (CB15, CB16)
```bash
SEEDS=8 TERRAINS=plains,forest,mixed TYPES=field,assault \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/buildSlots
node .claude/skills/battle-lab/build-shot.mjs <outDir> [--w 844 --h 340]   # dev server first
```
buildSlots counts, per terrain and side, the legal top-left tiles for a house, a barracks and a
stable in the build circle a few ticks in, and why the rest is refused (edge, fog, ground, node...):
run it on two checkouts to compare a placement or setup change (I176). build-shot drives the
worker build flow at a phone size (laborer, hammer, sheet, ghost with the green legal grid and the
field edge, a tap to move it, Build here, the sheet back once, cancel, X) and prints each state.
A dev server started from a worktree under `.claude/` may not see later edits (its file watcher
skips the path): restart it (`--force`) after changing code, or the browser runs the old modules.

## The HUD's space (CB19)
```bash
node .claude/skills/battle-lab/hud-shot.mjs <outDir> --w 844 --h 340 --safe 0,47,21,47   # dev server first
```
Shoots deploy, the army selected, the wand sheet, laborers and their build sheet, the minimap and
the pause sheet, and prints per state the share of the screen left to the field (I201: 70% or
more in ordinary play; the first-battle hint is taken as seen unless `--hint 1`), buttons under
44 px, buttons crossing the safe area (`--safe t,r,b,l` css px reaches the screen as `&safe=`,
headless Chromium has no notch) and where speed and pause sit (they must never move, I206).
Camera controls: arrow keys and the mouse at the screen's edge pan, F follows the selection, the
wheel zooms at the pointer (`zoomBy` brings the camera up to date before and after measuring).

## squadTrace extras (W00)
`ORDER=attackStructure` sends every fighting squad at one structure (`STRUCT=0` is the keep; `FORT=2`
gives towers and gates) and prints the tick it falls, what each attacker does then, and a
`STRUCTURE ... attackersWithoutTarget=N` line: the repro for "idle after the target falls".
`ECO=1` builds the setup with the battle economy as campaign battles do (`ECO_SUPPLY`, `ECO_DEV`
0..1); workers are left out of the orders and an `ECO workers=.. buildings=..` line is printed.

## The sandbox's own battle (lead check 28 Oct)
```bash
ORDER=attack|attackMove|split SEEDS=1-8 [REPEAT=60 EVERY=60 VERBOSE=0 ENEMY=1] \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/sandboxTrace
```
`?battleSandbox`'s default battle (mixed, kingdoms, balanced v balanced, fort 2, the economy, the sample tile), the
army sent at the keep every REPEAT s; `split` is what a tap on a building or Attack it sends (selection.js
buildingAttackOrders). A SUMMARY line per seed: end, keep, losses both ways, yours by cause.

## Commanded assaults (mobile campaign audit H-02, H-03, H-04, H-26)
```bash
SEEDS=1-8 POLICY=once|keep|ai [ATT=.. STR_A=588 DEF=.. STR_D=190 TERRAIN=desert FORT=1 TIER=small CAPITAL=1 AGE=kingdoms] [TRACE=<seed>] \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/assaultTrace
SEEDS=1-12 [SPREAD=1] [TIER=big AGE=bronze] QUIET=1 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/sortieTrace
SEEDS=1-20 [STYLES=europe TIERS=small,medium,big AGES=bronze,classical,kingdoms FORT=2] npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/pocketScan
```
assaultTrace fights a commanded assault the way a phone player does (one attack-move on the town,
or every squad at the keep, or the AI for the baseline) and prints per seed the outcome, the
attacker's losses BY CAUSE (sim/losses.js: melee, ranged, tower, impact, attrition; `unbooked` must
be 0), what each building shot, when the garrison was gone, idle squad-seconds (and those under a
building's fire) and Auto's verdict on the same armies. sortieTrace is the player defending a walled
city: every squad attacks the first enemy at the gate, and a STUCK line names any that did not move.
pocketScan lists walkable town ground the defender cannot walk out of (cityBattle.js sealPockets
closes them; a squad there never sortied).

## The battle AI (battle-ai-tactics)
```bash
N=4 TYPES=field,assault,naval AGES=bronze,classical,gunpowder [DIFF=king] \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/aiTrace
node .claude/skills/battle-lab/aiDuel-prep.mjs origin/claude/integration <scratch>/oldai
OLD=<scratch>/oldai N=20 TYPES=field,assault,naval AGES=bronze,kingdoms,gunpowder [DIFF=king MATCH=0 FEAT_OFF=focus,cavalry TRACE=200] \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/aiDuel
```
aiTrace counts the AI's mistakes per side in squad-seconds (lone fights, archers in melee, bad
matchups, wounded in melee, idle with enemies in sight) and names the first ones by tick and squad.
aiDuel fights each battle three ways (old vs old, new attacker, new defender) with the AI of a git
ref; `FEAT_OFF` switches off single behaviours (tacticalAI.js AI_FEATURES, economyAI.js ECO_FEATURES).
Judge on 20+ seeds per row: one mistake decides a mirror battle, so rows swing by 5 of 20.
Land rows: MATCH=0 mixed mirror, 1 two cavalry vs two archers, 2 with a siege engine each; sea rows
(SEAMATCH=0,1,2): 4 v 4, a 6 v 6 mirror (the attacker always loses it: it retreats first, so only NO
moves), 8 v 8 with transports. TRACE lines read `side#idx class strength:order>target!@x,y` (`!` the
target is in reach, `>s0` a structure). At sea judge on the exchange and 30 seeds (battle-ai-2: target
choice barely moves it, damage scales with the shooter's strength).
