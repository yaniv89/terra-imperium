# Math wave: perf (idea 5, plans/math-ideas.md 10.1 and 10.2)

Branch `math/perf`, base `ee575e7`. Goal: bring the turn toward the 80 ms budget with a
100,000-cell grid in mind, keep everything deterministic, keep saves loadable.

## Result in one line

A whole-world turn went from **175 ms to 136 ms** (-22%, mean of seeds 11 and 12, 110 measured
turns after 10 warm-up, PLAYER=au), the worst turn from about **310 ms to about 220 ms**. Every
optimisation except the simulation level of detail is exact: with the LOD switched off the head
reproduces the base world number for number (checked on seed 13 over 150 turns). The LOD itself
shows no drift beyond seed noise in an 8-seed paired compare. Still well above 80 ms; what is left
is listed at the end.

## How to measure

- `TURNS=120 WARMUP=10 SEEDS=11 PLAYER=au npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/perf`
  prints mean and max ms per phase (`PHASES`) and the turn (`TOTAL`). `CPUPROFILE=path` writes a
  V8 profile of the measured turns; `SAVE_STATE=path` writes the last state for micro benchmarks.
- resolveTurn's phase marks now cover the whole turn: the tail that was untimed (37 ms) is split
  into `marches`, `emergenceAndTerritory`, `research` and `registry`.
- `node scripts/perf/cellScaling.mjs` builds the frequency-75 and frequency-100 grids and times the
  per-cell loops (ownership copy, typed index, border scans, site search) on both.
- Timings vary 10-20% run to run in this sandbox; base and head below were run back to back.

## Baseline and after, per phase (ms per turn, mean of seeds 11 and 12)

| phase | base | head | what changed |
|---|---|---|---|
| cities | 49.7 | 36.5 | border search skipped when no tile is affordable; tile allocation memoised; city spacing index reused and extended instead of rebuilt; settler promise check by centre; workable-tile memo; AI researched list kept |
| registry (was untimed) | 19.5 | 9.6 | buildRegistry rewritten over flat typed buffers and static per-tile memos; bridge memo |
| aiEconomy | 22.0 | 17.4 | LOD settlement; incomes only for nations that settle; bordering nations in one pass |
| rebellionAndSupply | 17.9 | 13.7 | loyalty LOD; unchanged cities not rewritten |
| research (was untimed) | 15.3 | 8.9 | boosts read cities by owner once per map, not a scan per nation |
| emergenceAndTerritory (was untimed) | 3.0 | 2.9 | |
| regionUnrestAndPopulation | 7.8 | 8.2 | untouched |
| reinforcementAndMorale | 6.9 | 7.3 | untouched |
| estates, aiGrowthAndHostility, aiRecruitment, disastersAndCivilWar, diplomacy | 4.5, 4.6, 3.9, 3.7, 3.6 | 4.6, 4.4, 3.8, 3.7, 3.5 | untouched |
| aiWarProgress | 4.4 | 2.7 | (opinion border counts) |
| **turn** | **174.6** | **135.9** | |

Seeds: 11: 172.6 -> 137.8 ms (worst 303 -> 206); 12: 176.6 -> 134.1 ms (worst 321 -> 232).

## What changed

### Exact (same world, number for number)
- **Registry** (`world/registry.js`): the neighbour cache key held every city's tile count, so it
  missed every turn and rebuilt everything (20 ms). Now rebuilt from scratch each time but linear:
  ownership and centres in reusable `Int32Array` buffers, near cities from a static ring list per
  centre, sea contact, lat/lon and terrain memoised per tile, ring distances memoised with numeric
  keys, the bridge rule memoised per (capital, people) on the candidates' ids. Output checked
  byte-identical to the old builder.
- **Tile ownership** (`world/tileIndex.js`, `world/cities.js`): measured first. Copying the
  ownership object is cheap (V8 copies integer keys as elements: 0.3 to 0.9 ms even at 29,000
  claimed tiles), so a storage swap of `world.tileOwner` (147 readers, the UI, saves) would buy
  about 1 ms. What was done instead:
  - map-level copy-on-write in processCities: the ownership and tile-state maps are copied on the
    first write of the turn, not up front (`privateWorld` hands settlers a private copy);
  - a typed index `ownerSlots(tileOwner)`: an `Int32Array` (one slot per tile, city index) kept per
    ownership map and **derived by change lists**: `noteOwnerCopy`/`noteOwnerWrite` record the
    copy and the claimed tiles, so a turn's index is last turn's index (one typed-array copy) plus
    the claims, never a walk of the dictionary (a walk costs 1.6 ms at 16k tiles, 4 ms at 29k).
    A test checks it against a fresh walk on every turn of a real game. Used by the opinion border
    counts; ready for the other per-cell readers.
  - State shape is unchanged (`world.tileOwner` stays a plain object), so **no save migration**.
- **Opinion borders** (`opinion.js`, mapReasons): border length between nations counted once per
  ownership map for every pair (typed index), not one walk of A's land per pair asked.
- **Cities** (`world/cities.js`): a city whose culture bank is below the cheapest ring-1 tile skips
  the border-candidate search; tile allocation is memoised per city while its candidate yields,
  size, focus, locks and centre are the same objects; the city spacing index is keyed on the set of
  cities (order-free: where two cities block a tile, the lower centre names it) and extended when
  cities were only added; workable tiles memoised in a flat array.
- **Others**: research boosts index cities by owner once per regions map (`boosts.js`); the settler
  promise check looks up city centres in the ring instead of scanning every city (`accords.js`);
  `getBorderingNationIds` computes every nation in one walk (`data/regions.js`); the AI's researched
  list keeps its identity while nothing completes (`research.js`), which keeps the tile-yield
  memos warm.

### Simulation level of detail (`world/lod.js`), not exact by design
- A far AI nation at peace (not Tier 1, not at war, not in a civil war; Tier 1 already covers
  bordering the player and the strongest militaries) **settles its economy every few turns**:
  Tier 2 every 3, Tier 3 every 5, on the same hash offset as `thinksThisTurn`, so a nation always
  settles on a turn it decides. It also settles on every turn it spends science
  (`researchesThisTurn`), so research reads every turn's tech points.
- A settlement covers every turn since the last (`nation.lodSettledTurn`), so nothing is lost or
  counted twice when a tier changes: income, power (capped as before), supplies (iterated per turn)
  and upkeep. **The covered turns are replayed one by one** in `settleAIUpkeep`: a broke nation
  takes a loan or goes bankrupt as often as it would turn by turn. Without the replay the compare
  showed a clear drift (rebel stacks 51 -> 14 over 4 seeds: one bankruptcy per settlement instead of
  one per turn meant fewer stability hits).
- City loyalty of those nations moves `period` steps on their settlement turn instead of one step
  each turn (culture keeps its own schedule). `state.lodPeriods` carries the periods to the next
  turn's loyalty pass.
- Deterministic: the schedule is a pure function of nation id, tier and turn.

## Balance compare (proof the LOD does not drift)

150 turns, PLAYER=au, seeds 11 to 18, base `ee575e7` vs head, paired by seed. Differences are
head minus base; the interval is a paired t 95% interval (8 seeds).

| metric | base mean | head mean | diff | 95% interval | base sd across seeds |
|---|---|---|---|---|---|
| warsTotal | 7.38 | 4.88 | -2.50 | [-5.56, +0.56] | 4.14 |
| conquests | 0.38 | 0.62 | +0.25 | [-0.49, +0.99] | 0.52 |
| civilWarsStarted | 28.50 | 26.75 | -1.75 | [-7.49, +3.99] | 5.86 |
| rebelStacks | 48.50 | 44.00 | -4.50 | [-24.19, +15.19] | 15.46 |
| cities | 854.62 | 856.38 | +1.75 | [-4.68, +8.18] | 9.07 |
| landClaimedPct | 40.76 | 40.80 | +0.04 | [-0.27, +0.35] | 0.44 |
| citiesChangedHands | 8.50 | 8.62 | +0.12 | [-4.25, +4.50] | 2.93 |
| loyaltyFlips | 7.75 | 7.88 | +0.12 | [-3.56, +3.81] | 2.76 |
| vassals | 0.62 | 1.25 | +0.62 | [-0.14, +1.39] | 0.74 |
| topNationProvinces | 15.12 | 14.38 | -0.75 | [-1.61, +0.11] | 0.83 |
| avgUnrest | 6.04 | 5.67 | -0.36 | [-2.49, +1.76] | 1.74 |
| playerGold | 2280.12 | 2286.12 | +6.00 | [+0.78, +11.22] | 9.36 |
| playerTechs | 10.75 | 10.62 | -0.12 | [-0.42, +0.17] | 0.71 |
| medianAiTechs | 5 | 5 | 0 | | 0 |
| nonFinite, auditViolations | 0 | 0 | 0 | | 0 |

Reading: no metric moves outside its interval of no change except the player's gold (+0.3%, the
player is never sliced; the AI it trades with settles on other turns). Wars and the top nation's
size lean lower but both intervals include zero; worth a 16-seed check after the merge. With the
LOD off, seed 13 matched the base exactly on every key, so all the drift there is comes from the
LOD's timing.

## Scaling to 100,000 cells (frequency 100)

`scripts/perf/cellScaling.mjs` (same land share, cities the same km apart, same km radius):

| | f75 | f100 | ratio |
|---|---|---|---|
| cells | 56,252 | 100,002 | 1.78 |
| mean neighbour spacing | 102 km | 77 km | |
| claimed tiles | 16,262 | 29,039 | 1.79 |
| border scan over claimed tiles, dictionary | 2.8 ms | 5.6 ms | about 2.0 |
| same, typed index | 0.43 ms | 0.92 ms | about 2.0 (6x faster than the dictionary) |
| typed index from a walk (avoided by change lists) | 1.6 ms | 4.0 ms | |
| ownership copy | 0.3 ms | 0.9 ms | |

Every loop added here is linear in claimed tiles or in cities (no pair loops over cells); the
static memos cost O(cells) memory once (Int32/Int8 arrays: about 0.6 MB at 100k).

Estimate for the head turn at frequency 100:
- About 34 of the 136 ms scale with claimed tiles (city tile work and yields about 15, settler site
  search about 10, registry and border scans about 5, boosts about 2, other about 2).
- If the rules are kept in km (grid-math's helper; city count stays near 850): about
  136 + 34 x (1.8 to 2.0 - 1) = **163 to 170 ms**.
- If spacing and borders stay in rings (cities about 1.75x as many): nearly everything scales,
  about **240 ms**. Rules in km matter as much as any optimisation here.

## Files touched (for the merge)

Mine: `src/engine/world/` (registry.js, cities.js, lod.js, tileIndex.js and tests),
`src/engine/resolveTurn.js` (phase marks, LOD plumbing in the aiEconomy and loyalty calls,
`privateWorld`), `.claude/skills/perf/turnProfile.sim.js`, `scripts/perf/cellScaling.mjs`.
Small edits in other areas, kept minimal:
- `src/engine/aiEconomy.js`: `calcAllNationIncomes(state, only)`, `settleAIUpkeep(..., turns, goldPerTurn)`.
- `src/engine/opinion.js` (ai session's file): mapReasons border count via `sharedBorderOf`; no
  rule changed.
- `src/engine/loyalty.js`: `applyLoyalty(..., periodOf)`; unchanged cities not rewritten.
- `src/engine/boosts.js`, `src/engine/research.js` (`researchesThisTurn`, researched identity),
  `src/engine/accords.js` (settlingBarred), `src/data/regions.js` (getBorderingNationIds).
- New nation field `lodSettledTurn` and top-level `lodPeriods` (both optional; old saves load and
  start on the per-turn path).

## Open items toward 80 ms
1. Cities phase, 36 ms: the AI settler site search (bestSites, about 10 ms) could share one
   nation-independent table of valid sites per map; processCity's yields could be memoised per
   city like the allocation.
2. Registry, 9.6 ms: most of it is rebuilding 850 plain records a turn; readers could take the
   city record directly (the registry's own plan).
3. regionUnrest, reinforcement, estates, AI growth: per-region and per-unit passes untouched; the
   same LOD idea (far nations every few turns, replayed per turn) applies, with the same compare.
4. GC is about 8% of the turn: the per-turn spreads of every region record are the main source.
5. Other per-cell readers (claimCandidates, siteQuality, armies tileAccess, supplies) can switch
   to `ownerSlots` when frequency 100 lands.
