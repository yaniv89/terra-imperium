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
`window.__battleRenderer` and `window.__battleOrders`.

### Soldiers at every zoom (phone, iPad, desktop)
```bash
node .claude/skills/battle-lab/zoom-shots.mjs <outDir> [prefix]   # dev server on 5199 first
SIZES=phone:874x402@3 ZOOMS=near:2,far:1,farther:0.6 TIER=2 node .claude/skills/battle-lab/zoom-shots.mjs <outDir> t2
```
Starts the sandbox (kingdoms, mixed, the defaults), fights 12 s at 3x, pauses, centres on your army
and saves one jpg per size and zoom with the detail level picked (TIER forces one; `URL=...&age=bronze`
for another age). Look at every level at the user's zoom: troops must read as soldiers and riders.

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
arrows); GLB people and mounts are drawn at the art set's own scale (unitModels.js ART_UNIT_WORLD,
unitScale.test.js checks man, horse and rider heights); only squads in view are written;
figures per squad shrink past 80 squads a side (capacity.js figureScale); props are instanced per
48-tile chunk so three culls them; worker frames are packed (packedView.js, keep it equal to view.js).
Any change to the sim must keep `kernel.test.js` (grids equal the full scan, hash chain) green; a
pure speed change should leave every world hash unchanged (compare `runHeadless(...).chain`).

## Rules of the sim
- Integer Q8 fixed point (1 tile = 256), integer ticks, `nextRandom(w)` only. Replays and the
  replay-verification tests (replay.test.js) must stay exact. Round damage immediately.
- Anything outside the sim influences it only through orders.
- New per-squad fields go in `makeSquad` (world.js); new view fields in view.js.
- Neighbour queries go through the packed grids (spatial.js, pathing.js `queryRadius`,
  `buildTargetGrid`), never a scan of every squad per squad. `classId`, `commanderId` and `side`
  are fixed after createWorld (squadLists.js caches lists by them).
- Every 20 ticks step() folds the world hash into `w.hashChain` (hash.js); `replaySegment`
  (replay.js) verifies a battle from a snapshot and the tail of its log.
- Renderer: every geometry, material and texture goes through `this.track()` so `dispose()`
  frees it; instanced meshes reset `count` every frame; short effects live in `this.fx` with a life.
- Run `npx vitest run src/battle` and the full suite before committing.
