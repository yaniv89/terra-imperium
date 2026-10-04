# Math wave: brief for the parallel sessions

The user asked to carry out the top 10 of `plans/math-ideas.md` (read it first: each idea says
where it applies, the current approach, a formula and sources), plus opening the real sea straits
the grid closed. Six sessions work in parallel, each on its own branch. A lead session merges them
into `claude/bronze-towns`.

## Everyone
- Read `CLAUDE.md`. Follow `.claude/skills/add-mechanic/SKILL.md` before changing any rule,
  formula or per-turn system, and `.claude/skills/balance-sim/SKILL.md` for before/after numbers.
- Setup: `npm install` if node_modules is missing. The repo is a shallow clone; for a balance
  compare against your starting commit run `git fetch --filter=blob:none --deepen=50 origin
  claude/bronze-towns` first if `git worktree add` needs history.
- **We are moving to more hexes.** The grid is frequency 75 (56,252 cells, about 102 km between
  neighbours, measured 76 to 112 km). The plan is frequency 100 or more (about 100,000 cells,
  about 77 km). So:
  - never hard-code kilometres per ring, rings for a distance, or cell counts: derive them from the
    grid (the measured neighbour spacing, `tiles.count`), or express rules in kilometres and
    convert with one shared helper;
  - keep every per-turn cost linear (or better) in the number of cells, and say in your report how
    your change scales from 56k to 100k cells;
  - tests must not assume a cell count or a ring count that only holds at frequency 75.
- Deterministic engine: no `Math.random`, no `Date.now`, seeded rng only. Integer or
  well-conditioned maths; avoid functions whose last bit differs between browsers (`acos`, `asin`,
  `pow` with non-integer exponents, `exp`, `log`) in game logic where a flip changes an outcome.
- Before every push: `npm run lint` (zero warnings) and `npx vitest run` on the folders you
  touched, plus the full suite once at the end (long full-game tests can time out under load: rerun
  them alone). Balance or AI changes: a balance-sim compare (base = your starting commit, at least
  150 turns, seeds 11,12, PLAYER=au) with the numbers in the commit message and the report.
- Plain English in messages and comments, no em dashes. Commit messages end with the attribution
  lines your session gives you.
- Stay inside your files (below). If you must touch another area's file, keep the change minimal
  and say so in the report, so the lead can merge.
- Push only to your own branch `math/<your-name>`. Never to `claude/bronze-towns` or `main`.
- When done, write `plans/math/<your-name>.md` (what changed, numbers before and after, how it
  scales to more hexes, open questions) and send a short message to the lead session
  `session_01GqDXUs3bi3nAUtStc5mV91` with send_message: what was pushed and the commit.

## The six sessions and their files

| Name | Ideas | Main files |
|---|---|---|
| `grid-math` | 1 (stale grid constants, sharper A*), 3 (determinism guard), and one grid-relative distance helper used everywhere | src/data/geo/geodesic.js, tiles.js, src/engine/armies.js, fleets.js, loyalty.js (constants only), routes.js, sight.js; a test that bans unsafe maths in src/engine |
| `sim-stats` | 2 (paired-seed confidence intervals, Gini, HHI, survival in the balance sim) | .claude/skills/balance-sim/, scripts/simulate.mjs, src/engine/stateAudit.js (read only) |
| `perf` | 5 (typed-array tile ownership with copy-on-write, simulation level of detail for far, quiet nations) | src/engine/world/, src/engine/resolveTurn.js (phase plumbing only), src/engine/registry users |
| `ai` | 4 (Lanchester battle estimate for the AI), 6 (utility scoring in aiProduction and target choice), 7 (expected-value peace and war) | src/utils/aiLogic.js, src/engine/aiOperations.js, aiProduction.js, peace.js, opinion.js (war roll only) |
| `world-systems` | 8 (logistic population growth, one population model), 9 (gravity-model trade, contact-based tech diffusion), 10 (plague along trade and army routes as SIR; war contagion as a Hawkes process) | src/engine/population.js, development.js, economy.js, pacts.js (trade value), techDiffusion.js, the plague and disaster code, src/engine/diplomacy.js (war contagion term only) |
| `straits` | Open the real straits the grid closed (Gibraltar, Bosphorus, Dardanelles, and any others: Danish straits, Kerch, Bab-el-Mandeb, Hormuz, Malacca, Bass), so the Mediterranean, Black Sea, Baltic, Red Sea and Persian Gulf connect to the ocean as they really do | scripts/geo/build-tiles.mjs, src/data/geo/tiles.json, hexLand.json and the rasters (rebuild with the scripts), save migration if tile land flags change |

Overlaps to watch: `ai` and `world-systems` both affect wars (ai: decisions; world-systems: the
contagion term in the base war chance). `grid-math` and `perf` both touch src/engine/world and
armies: grid-math changes constants and the distance helper, perf changes storage.
