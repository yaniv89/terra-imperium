---
name: perf
description: Measure Terra Imperium speed - ms per turn of resolveTurn (phase by phase, CPU profile), map pan frame time in a real browser, battle load and memory soaks - and compare a change against its base commit. Use for "turns are slow", "the map lags", before/after numbers on any engine or renderer change that could cost time, and when a PERF_CHECKS budget test fails.
---

# Perf

Never compare against an old number: the sandbox varies 10-20 ms run to run. Measure the base
commit and the change on the same machine, back to back (a `git worktree` of the base works).
Baseline and history: plans/math/perf.md.

## Turn time (budget 80 ms a turn)
```bash
# phase-by-phase mean ms, slowest first, one TOTAL line per seed
TURNS=120 WARMUP=10 SEEDS=11 PLAYER=akkad npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/perf
# add CPUPROFILE=/tmp/turns.cpuprofile for a V8 profile, SAVE_STATE=/tmp/s.json for the last state
```
The budget tests run only with `PERF_CHECKS=1` (e.g. `PERF_CHECKS=1 npx vitest run src/engine/aiQualityBenchmark.test.js`).
Late turns (turn 300+) are the slow case: use TURNS=300 when a change touches per-tile or per-city loops.

## Map speed (real browser)
```bash
node scripts/perf/map-pan.mjs --gpu            # desktop 1600x900 and phone 844x390 (CPU 4x slower)
node scripts/perf/map-pan.mjs --gpu --explored # the heavy case: no fog
```
Report step ms (median, p90), fps, main ms per frame and settle. `--shots dir` for screenshots.

## Other probes (scripts/perf/)
battle-load.mjs, battle-start.mjs, battle-soak.mjs (battles), memory-soak.mjs and heap-diff.mjs
(leaks), save-size.mjs (save bytes), cellScaling.mjs (grid size), river-cost.mjs (river layer).
Battle sim speed: `node scripts/battle-bench.mjs` (`--eco` for the battle economy).

## Report
Base vs change, same machine, same seeds: the numbers, the delta, and which phase moved.
Load on the box changes results: say what else was running.
