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

## Rules of the sim
- Integer Q8 fixed point (1 tile = 256), integer ticks, `nextRandom(w)` only. Replays and the
  replay-verification tests (replay.test.js) must stay exact. Round damage immediately.
- Anything outside the sim influences it only through orders.
- New per-squad fields go in `makeSquad` (world.js); new view fields in view.js.
- Renderer: every geometry, material and texture goes through `this.track()` so `dispose()`
  frees it; instanced meshes reset `count` every frame; short effects live in `this.fx` with a life.
- Run `npx vitest run src/battle` and the full suite before committing.
