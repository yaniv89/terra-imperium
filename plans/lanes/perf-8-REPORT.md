# Perf 8: what the player waits for

ponytail read in full at 12:42 UTC, 28 Oct (SKILL.md printed whole with `cat`; the session start hook also printed "PONYTAIL MODE ACTIVE").

Branch `claude/perf-8`, from `claude/integration` at 5542fb12, merged with integration at 0eaaedbd
before the final push. Speed only. No rule, save version or SETUP_VERSION change. The state hash
is identical to base at turns 100, 200 and 300 on seeds 11 and 12, and in the worker-style run on
seed 11 (table below).

## What the round 2 playtests said about speed

- Campaign "Speed feel" 6 to 7: "turns pass quickly", "End Turn is responsive". The low marks
  come from pacing (endless Advisor builds, then End Turn, 13-turn settlers), not from waiting on
  the machine.
- Battle "Speed and smoothness" 6 to 7: "no lag reported". What drags is **waiting on an empty
  field after losing every unit** (steps 88 to 92, 124 to 138 in two runs) and timed prompts that
  are hard to hit at 3x. Those are design calls, not speed work: **question for the lead** below.
- Neither report measured the machine, so I measured it myself. Results are below.

## How I measured (this machine, base and change back to back)

- This sandbox has no GPU. Chrome draws WebGL in software here, so every frame that touches the map
  waits seconds on the compositor ("Commit" in the trace). Wall times in the browser are therefore
  far worse than on a phone, and **GPU cost cannot be judged here**. What I can measure honestly is
  **main-thread JavaScript** (CPU profile, JS plus GC, excluding idle and native waits) at phone
  speed (844x390, CPU slowed 4x) and engine ms in Node.
- New probes:
  - `scripts/perf/end-turn.mjs`: a saved game goes into the save slot and End Turn is pressed in a
    real browser. It also has `--sheets` (rail sheets), `--close` (zoom into the close view),
    `--cpuprofile` and `--trace`.
  - `.claude/skills/perf/battleStart.sim.js`: the battle worker's world build.
  - turnProfile: `LOAD_STATE` (start from a saved state) and `WORKER=1` (each turn is a structured
    clone plus `gameReducer`, as the turn worker runs it).
  - battle-load.mjs: the worker's stages are now printed.
- The late save is seed 11 at turn 300 (925 cities, 2.9 MB state).

## Before and after

| what | base | change | how |
|---|---|---|---|
| End Turn, page JS per 5 late turns (phone 4x) | 20.2 / 21.1 s | 15.5 / 15.5 s | end-turn.mjs, CPU profile, 2 runs each |
| End Turn wall wait, median (phone 4x, software GL) | 7.1 / 7.1 s | 6.1 / 6.4 s | end-turn.mjs |
| Title screen boot, page JS (phone 4x) | 4.5 / 4.5 s | 2.4 / 2.2 s | boot trace, 2 runs |
| Boot, longest frozen task (phone 4x) | 3.2 / 3.1 s | 1.0 / 0.8 s | same |
| Battle sandbox, loading screen shown (phone 4x) | 4.5 / 5.1 s | 3.2 / 2.6 s | battle-load.mjs bronze, eco on |
| Battle sandbox, first paint (phone 4x, software GL) | 12.0 / 13.2 s | 10.9 / 9.8 s | same |
| Worker-style late turn (turn 300 save, 10 turns, Node) | 532 to 714 ms | 464 to 478 ms | WORKER=1 LOAD_STATE, 3 runs each |
| Whole game, worker-style, seed 11 (290 turns) | 323.5 ms | 314.4 ms | WORKER=1, mean |
| Whole game, plain resolveTurn, seeds 11 / 12 | 267.8 / 257.1 ms | 264.9 / 262.7 ms | no change, as expected (noise is 10 to 20%) |

The base browser numbers use the integration head's build (0eaaedbd) and the change uses this
branch merged with it, both built with `VITE_QA_HOOK=1`.

### Per phase, the 20 turns ending at each turn (ms, base / change, plain resolveTurn)

| seed | phase | turn 100 | turn 200 | turn 300 |
|---|---|---|---|---|
| 11 | whole turn | 176 / 136 | 314 / 347 | 409 / 477 |
| 11 | cities | 50 / 36 | 77 / 88 | 113 / 135 |
| 11 | registry | 8 / 7 | 7 / 2 | 16 / 14 |
| 12 | whole turn | 123 / 137 | 321 / 298 | 515 / 516 |
| 12 | cities | 34 / 46 | 88 / 81 | 132 / 137 |
| 12 | registry | 6 / 6 | 15 / 13 | 20 / 6 |

The plain engine moves only within noise. The registry phase drops when no city changed what the
registry reads. The engine gain is in the turn worker (next section).

## Hash proof

`stateHash` at turns 100 / 200 / 300 (equal in every cell):

| run | turn 100 | turn 200 | turn 300 |
|---|---|---|---|
| seed 11, base and change | 659ec989e4880713 | fd62fc4f4126710a | 62aaa1e73ee664d9 |
| seed 12, base and change | d2254bb75b66b095 | 98bb7452bd7ac5d5 | 63f228f8668ebab8 |
| seed 11 worker-style (gameReducer + clone), base and change | a473ab25869f972c | 0c14976ee417bb69 | cc5c3a79287b9a1a |

The worker-style hashes differ from the plain ones because `gameReducer` also refreshes names and
fog. Base and change are equal within each path. buildScenarioStarts output (dawn, kingdoms, dawn
with a priority nation) and the default world's registry are byte-identical to base.

## What changed

1. **Autosave off the main thread** (GameContext.jsx, turnClient.js, turn.worker.js). After each
   turn the page stringified the 3 MB world for the autosave. The worker now writes that JSON right
   after answering (`saveText`), and the page only calls `localStorage.setItem`. The idle autosave
   also skips a state that is already written (it used to save every turn twice), and the turn log
   no longer stringifies the whole state just to print its size. Test: the worker's JSON equals the
   revived state's JSON (`saveText.test.js`), and the client hands the text only to the state it
   answered.
2. **Boot: the default world** (scenarios.js, registry.js). On every page load, before any game
   exists, `ensureDefaultWorld` places the retired 240-nation Dawn world. Its capital spacing ran
   about 57,000 ring searches, and its founding copied the 100,000-tile owner map 240 times. Ring
   searches are now kept per centre for one placement, the wide own-land search reuses a typed
   array, and the cities are founded on one map copy (`inPlace`). This was the single 3 to 5 s
   frozen task at phone speed on the title screen and in the battle sandbox.
3. **The turn worker keeps its caches** (cities.js, registry.js). The worker gets a structured clone
   every turn, so every memo keyed on object identity missed: tile facts and yields, tile
   allocation, and the registry rebuilt for an unchanged world. An equal tile entry or list now
   counts as a hit, and the registry adopts a regions map whose cities match a snapshot taken at
   build time. The snapshot is tied to the source, so `keepWorldRegistry` and reset cannot fool
   it. Worker turns late in the game are about 12% faster.

## Not done, and why

- **GPU work** (territory redraw, texture uploads, shader compiles on the first battle frame, the
  close view's frames) cannot be measured on this machine. The close view zoom is about 0.34 s of
  JS per zoom at phone speed; the rest here is software GL. Next step on a real GPU: three.js
  `renderer.compileAsync` during "Mustering the troops", so the first battle frame does not compile
  every shader at once (0.8 s of program setup at 4x in the sandbox profile). Check it with
  battle-load.mjs on a GPU machine.
- **Campaign battles** do not pay the default world cost (the game is already loaded when the
  battle chunk loads), so the battle-load gain above is the sandbox and boot path only.
- `localStorage.setItem` of the 3 MB save is still about 0.35 s per turn at phone speed. Moving
  saves to IndexedDB would make it asynchronous, but that is a larger change to every save path.
- The plain engine tail is flat (no phase over 30% of a late turn), and earlier perf lanes already
  harvested its hot spots.

## Questions for the lead (design, not speed)

- When the player has no army left in a commanded battle, offer **Concede** or **Auto-finish**
  instead of a wait on an empty field. Two round 2 runs lost 10 to 15 steps this way. This touches
  battle rule Q3 (a side with bases loses only when its buildings are gone), so it is your call.
- Timed prompts ("Attack it") are hard to hit at 3x: pause the clock while one is shown?

## Tests

- Full `npx vitest run` on the merged branch: 509 files passed, 2 skipped (4,762 tests passed, 17 skipped).
- Lint clean on every changed file.
