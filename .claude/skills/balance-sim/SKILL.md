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

## Before vs after
```bash
.claude/skills/balance-sim/compare.sh <base-ref> [TURNS=150] [SEEDS=11,12]
```
Checks the base out in a temporary git worktree (sharing node_modules), runs the same sim on
both, and prints both SUMMARY lines per seed. Use the commit before the change, or `origin/main`,
as the base. Timings are only comparable within one compare run.

## Nothing-changed check for refactors
```bash
TURNS=280 SEEDS=11 SPEED=fast npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/stateHash
TURNS=120 SEEDS=12 EVERY=10 SPEED=normal JUMP=1850 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/stateHash
```
Prints `HASH seed=… turn=… year=… age=… <sha1>` of the WHOLE state (keys sorted) every EVERY
turns. Run it on the base commit and on the working tree: identical lines prove a refactor plays
bit-identically; the first differing line shows when they diverge. The first command walks all
ages from 2000 BCE at Fast (about 2 minutes); JUMP=<year> starts the calendar late to cover the
late ages quickly.

## Also in the repo
`node scripts/simulate.mjs --games 5 --turns 150` (the M21 harness: N seeded games, aggregated
metrics, passive response policy) and `auditGameState(state)` / `assertGameState(state)` in
src/engine/stateAudit.js for invariant checks inside any test.

## Reading the numbers
- Red flags: nonFinite or auditViolations above 0; status not ACTIVE before the run ends (a stall is usually an
  unanswered pending item); maxProvinceShare above about 0.33 (runaway); topMilitaryToMedian
  exploding across checkpoints; avgUnrest climbing steadily (rebellion spiral); player gold or
  supplies heading to infinity or pinned at 0.
- The AI world is quiet by design (only Tier-1 AI nations declare wars): about 10 wars per 150
  turns is normal. Systems that need wars (pacts, independence) mostly show up around the player.
- Report to the user as a small before/after table and say plainly what got better or worse.


Note: the passive player defaults to France (`PLAYER=fr`), a one-city nation with neighbours that
often falls to a siege around turn 100 on the frequency-75 grid, which ends the run early (the
SUMMARY then carries the real turn and status). Use `PLAYER=au` for full-length runs.
