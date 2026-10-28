# Perf loop 2: faster late turns, same game

Branch `claude/perf-loop-2`, from `claude/integration` at 930c795d. Speed only: no rule, no
SETUP_VERSION, no save version change. The state hash is identical to the base at turns 100,
200 and 300 on seeds 11, 12 and 13.

## How it was measured

- Turn time: `.claude/skills/perf/turnProfile.sim.js`, TURNS=300, WARMUP=10, SEEDS=11,12,13,
  WINDOWS=100,200,300, PLAYER=akkad. Base (a worktree of 930c795d) and change ran back to back on
  the same idle 4-core sandbox, nothing else running.
- Finding the costs: V8 CPU profiles and an allocation sampling profile of turns 301 to 310 of
  seed 11 (the saved turn-300 state continued for 10 turns). On that slice the base took 600 ms a
  turn and the change 537 to 553 ms (same end hash, 291d271e084b7d48).
- Map pan: `node scripts/perf/map-pan.mjs --gpu --profiles phone` (844x390, CPU 4x slower).

## Turn time (ms per turn, mean of 25-turn buckets)

| seed | turns 11-110 base / change | turns 111-210 | turns 211-285 | whole game mean | worst turn |
|---|---|---|---|---|---|
| 11 | 114 / 102 | 257 / 234 | 391 / 343 | 251.9 / 225.6 | 562 / 524 |
| 12 | 96 / 87 | 253 / 237 | 420 / 369 | 254.4 / 228.1 | 653 / 551 |
| 13 | 100 / 87 | 258 / 235 | 420 / 374 | 258.5 / 231.4 | 649 / 588 |

About 10% off the whole game and 12% off turns 211 to 285.

## Per phase, the 20 turns ending at turn 300 (ms per turn, base / change)

| phase | seed 11 | seed 12 | seed 13 |
|---|---|---|---|
| whole turn | 442 / 412 | 493 / 392 | 504 / 447 |
| aiWarProgress | 95.4 / 70.3 | 109.6 / 68.5 | 124.6 / 93.1 |
| cities | 105.8 / 109.9 | 120.9 / 103.6 | 117.5 / 114.3 |
| aiWarDeclarations | 33.0 / 30.9 | 37.0 / 32.9 | 40.1 / 34.9 |
| fog | 25.2 / 17.7 | 26.4 / 16.4 | 25.8 / 19.1 |
| rebellionAndSupply | 25.9 / 24.7 | 30.0 / 24.9 | 27.9 / 26.7 |
| aiEconomy | 22.7 / 22.2 | 25.2 / 21.6 | 26.2 / 21.7 |
| registry | 17.9 / 17.6 | 16.3 / 14.8 | 14.0 / 16.5 |

AI war progress is 25% to 37% faster and fog about 30%. The cities phase moved within noise
(-14% to +4%): its remaining cost is spread thin over the city pass (tile allocation, yields,
borders), the AI build choice and the settlers. The sandbox varies 10 to 20 ms run to run.

Allocation on turns 301 to 310: iterator steps fell from 340 MB to 113 MB over the 10 turns.
The garbage collector share in the CPU profiles went from 6 to 8% (base) to about 5%.

## Hash proof

`stateHash` at turns 100 / 200 / 300, base and change (equal in every cell):

| seed | turn 100 | turn 200 | turn 300 |
|---|---|---|---|
| 11 | ea7c0e44055897bd | fe0fe349ab56a3d9 | 5aa35aa55825411f |
| 12 | adfe65c70df0ac5d | bd623281302145e2 | 25607a4051300956 |
| 13 | b5acdb25f93fe6a8 | 90030384c7762a17 | ba565694b4659146 |

## What changed

- `aiOperations.js` seekFieldBattle: it built a map of every land unit by tile for every stack
  it checked. It now reuses the nation's index of the phase until a battle replaces the units or
  the regions map. Within one nation's turn only that nation's own units are written in place,
  and the check reads enemy units only. aiSally keeps one index per units and regions map in the
  same way, instead of one per besieged city.
- `navalReach.js`: the sea tiles beside a city and the sea reach from it are memoised on the
  city's tile array (guarded by its length and the grid). Every registry rebuild used to start
  them over, and the naval AI asks about every port and coast pair.
- `resolveTurn.js` cities phase: a city's context (governor, wonder culture) is built once for
  the phase instead of once for the AI build choice and again for the city pass. City records
  the pass made this turn get `lastYields` and `dev` written in place (same keys, same order).
- `world/cities.js` processCity: one full copy of each city record less per turn (it writes its
  own fresh record in place, and the border step reads it without a copy). New
  `canFoundCityOk`, the boolean of `canFoundCity`, for the settler site search, which asked it
  for every tile in reach and built a reason message for each blocked one.
- `world/market.js`: each tile's market cells and the kernel weight of a pair of city centres
  are memoised per grid (distance only).
- `fog.js` / `sight.js`: index loops instead of `for...of` in the sight walks (an iterator step
  per tile), and a city's sight list is also kept on its tile array, which skips building a
  string key per city per turn.
- `aftermath.js` applyCasualtyScars: one copy of the regions map per battle instead of one per
  fallen unit.

The `engine-rules-reviewer` agent read the diff and found no risk to results. It asked for a
grid guard on the naval cache and the removal of a duplicated comment; both are done.

## Map pan, phone profile (844x390, CPU 4x slower)

| k | step median / p90 ms | fps | frame p90 / max ms | main ms per frame | longest task after a pan |
|---|---|---|---|---|---|
| 1 | 133.9 / 157.3 | 8.2 | 149.9 / 150 | 129.3 | 1008 |
| 4 | 136.5 / 163.2 | 6.8 | 183.4 / 199.9 | 156.4 | 1019 |
| 12 | 134.2 / 153.2 | 8.6 | 133.4 / 133.4 | 122.9 | 860 |
| 40 | 1486.6 / 1545.4 | 1.1 | 1416.5 / 1416.5 | 1409.3 | 2228 |

This sandbox has no GPU: WebGL runs on SwiftShader (software). A CPU profile of the page while it
pans shows 97 to 98% of the main thread in native code (the software rasteriser drawing the
full-screen territory shader and the close view), and 1 to 2% in our JavaScript. So these numbers
say nothing reliable about a real phone, and there was no renderer JavaScript cost to cut without
changing the look. No renderer change in this lane. A real phone, or the Windows machine with
Chrome on its GPU, is needed to judge the 33 ms target.

## Checks

- `npx eslint` on the changed files: zero warnings.
- `npm run test:quick`: 474 files passed, 2 skipped, 0 failed.
- `npm run build`: passes.

## Left for later

- The world registry is rebuilt in full about twice a turn (the end of the turn, and the naval
  AI's reducer calls after the cities pass changed borders), about 12 to 17 ms each. An
  incremental rebuild would save 15 to 25 ms a late turn but needs care to keep every list in
  the same order.
- `bestSites` ranks site quality only after the spacing test. Moving the quality test first
  would be faster, but its memo is keyed on a world object that in-place outpost founding
  keeps, so it could change a result. It was left as it is.
