---
name: balance-sim
description: Run whole-world headless Terra Imperium games (all 240 nations, 50-150+ turns, fixed seeds) and report wars, pacts, rebellions, conquests, devastation, unrest, war exhaustion, runaway nations, the player's economy and ms per turn, or compare those numbers between a base commit and the working tree. Use to validate any balance, economy, AI, diplomacy or per-turn formula change, to check for snowballing, collapse, NaN or stalls, and when the user asks how the world plays out or whether a change made things better or worse.
---

# Balance sim

Judge balance on numbers, not feel. Both helpers use fixed seeds and a passive player who
accepts free white peaces and refuses costly ones; enemy assaults auto-resolve.

## One run
```bash
TURNS=150 SEEDS=11,12 EVERY=50 PLAYER=fr \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim
```
Prints `STATS seed=… turn=… key=value …` every EVERY turns and one `SUMMARY {json}` per seed.
Roughly 0.1-0.3 s per turn, so 150 turns x 2 seeds takes a few minutes. Keys:
- wars: warsActive, warsTotal, independenceWars, pactWars, conquests
- diplomacy: pactMembers, leaguesFormed, vassals, avgLibertyDesire
- strain: devastatedProvinces, avgWarExhaustion, avgUnrest
- runaway: maxProvinceShare (largest nation's share of provinces), topMilitaryToMedian
- player: playerProvinces, playerGold, playerSupplies, playerUnits
- health: nonFinite and auditViolations (both must be 0; the latter from src/engine/stateAudit.js), msPerTurn
- runaway and health measures (scripts/simStats.mjs, all shares or indices so they mean the same
  on a denser grid; prefer them to raw counts):
  - giniCities, giniPopulation, giniWealth (treasury), giniLand (land cells) over living nations:
    0 = equal, 1 = one nation has everything
  - hhiLand (sum of squared land shares) and effectiveNations (1 / hhiLand): how many equal
    powers the land map is worth; topLandShare (biggest nation's share of all land cells; history
    says a few percent to a quarter), landClaimedShare
  - nationsAlive, nationsAliveShare (Kaplan-Meier survival so far; a revived nation is a new life),
    and in SUMMARY survivalT<checkpoint> for each EVERY turns plus medianNationLife (null = more
    than half still alive)
  - leadChanges (times the nation with the most cities changed), zipfSlope (rank-size slope of
    the 50 biggest cities; Zipf's law is about -1, near 0 means every city is alike)
  - devastatedShare, unclaimedShare: the per-city versions of devastatedProvinces and unclaimedProvinces
  - plagueCitiesNow (cities with the plague mark now), plagueCitiesStruck (distinct cities struck so far)

## Before vs after (paired seeds, with confidence intervals)
```bash
PLAYER=au .claude/skills/balance-sim/compare.sh <base-ref> 150 11-18
```
Checks the base out in a temporary git worktree (sharing node_modules, running the current
harness so both sides report the same keys), runs every (side, seed) as its own process, `JOBS`
at a time (default: all cores; 8 seeds x 150 turns is about 10 minutes on 4 cores), prints both
SUMMARY lines per seed as before, then a **paired table**:

- per metric: base mean, head mean, mean difference (head - base) over the same seeds, its 95%
  Student t interval, `*` when the interval excludes 0, how many seeds went up/down, and
  `seeds@80%` = seeds needed to resolve the observed difference at 80% power, ((2.8 sd) / diff)².
- metrics identical on every seed are folded into one line; a WARNING names seeds whose two
  sides ended at a different turn or status (not like for like).
- `AT=50,100` adds the same table at those checkpoints; `OUT=dir` keeps the logs, then
  `node .claude/skills/balance-sim/pairedCompare.mjs dir/base.log dir/head.log [--turn N] [--all] [--json f]`
  re-reads them without rerunning.

How to read it: the same seed with the same code gives the same numbers, so every difference
is caused by the change, and pairing cancels most seed-to-seed noise. Call a change real only
when it is starred; with 2 seeds the t value is 12.7 and almost nothing is, so use at least 4
seeds (6 to 8 for wars and conquests, which are rare events), and when an unstarred row matters,
rerun with the seeds@80% count. msPerTurn is never starred: parallel runs share the CPU, so judge
timing with `JOBS=1` or the PERF_CHECKS tests. Seeds that end early (a fallen player) make the
pair unequal: use PLAYER=au. Report the table (or its starred rows) in the commit message.

## Also in the repo
`node scripts/simulate.mjs --games 5 --turns 150` (the M21 harness: N seeded games with a
different player each, aggregated metrics, passive response policy, and the runaway measures as
mean ± 95% interval across games; unpaired, so use compare.sh for before/after) and `auditGameState(state)` / `assertGameState(state)` in
src/engine/stateAudit.js for invariant checks inside any test.

## Reading the numbers
- Red flags: nonFinite or auditViolations above 0; topLandShare above about 0.25 or
  effectiveNations falling fast (runaway); nationsAliveShare collapsing early (a cull);
  leadChanges stuck at 0 over a long run (a frozen world); status not ACTIVE before the run ends (a stall is usually an
  unanswered pending item); maxProvinceShare above about 0.33 (runaway); topMilitaryToMedian
  exploding across checkpoints; avgUnrest climbing steadily (rebellion spiral); player gold or
  supplies heading to infinity or pinned at 0.
- The AI world is quiet by design (only Tier-1 AI nations declare wars): about 10 wars per 150
  turns is normal. Systems that need wars (pacts, independence) mostly show up around the player.
- Report to the user as a small before/after table and say plainly what got better or worse.


Note: the passive player defaults to France (`PLAYER=fr`), a one-city nation with neighbours that
often falls to a siege around turn 100 on the frequency-75 grid, which ends the run early (the
SUMMARY then carries the real turn and status). Use `PLAYER=au` for full-length runs.
