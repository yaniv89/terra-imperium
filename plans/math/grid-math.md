# grid-math: grid constants, one distance helper, sharper A*, determinism guard

Branch `math/grid-math`, base `ee575e7`. Ideas 1 (4.1 plus the loyalty constant of 5.4) and 3
(10.3) of `plans/math-ideas.md`.

## What changed

### One grid-relative distance helper: `src/data/geo/gridScale.js`
Spacing is measured once per grid object from the loaded tiles, in a fixed order. At frequency 75
the numbers are mean 102.2 km, min 76.5 km, max 112.5 km and 9,067 km² per tile. The measurement
takes about 20 ms and is linear in the cell count. The helpers:
- `ringsForKm(km)`: a km rule as whole rings (mean spacing).
- `ringsApart(a, b)`: fractional rings between two tiles.
- `kmCoveringRings(r)`: a radius that surely holds every tile within r steps (r x max), for
  candidate prefilters.
- `minStepsBetween(a, b)`: distance / max step, an admissible A* guess.
- `cellsForAreaKm2(km2)`: search budgets as area.

### Stale constants removed
| Where | Was | Now |
|---|---|---|
| armies.js A* | `KM_PER_RING = 170` x road 0.5 / rail 0.25 | `minStepsBetween` x `cheapestStep(researched)` |
| fleets.js A* | `KM_PER_RING = 170` | `minStepsBetween` |
| loyalty.js | `KM_PER_RING = 147`, `PRESSURE_RINGS = 13` | `PRESSURE_KM = 1330` (13 rings), weights by `ringsApart` |
| data/navalReach.js | `KM_PER_TILE = 147`, cap 400 tiles | `kmPerRing()`, cap `ringsForKm(40_900)` |
| world/registry.js prefilter | `rings * 150 + 60` km | `kmCoveringRings(rings) + 1` (exact ring test after, so no change in result) |

These ring and budget constants are now km or km² converted by the helper. Every value is
unchanged at frequency 75:
- armies: `MAX_ROUTE_STEPS` (6,100 km = 60), `SUPPLY_BASE_RINGS` (2,860 = 28), `REINFORCE_RINGS`
  (410 = 4), `FALLBACK_RINGS` (1,740 = 17), `MAX_SEARCH` (72.54M km² = 8,000 tiles).
- fleets: `MAX_SEA_STEPS` (17,400 = 170), `MAX_SEARCH` (108.81M km² = 12,000).
- sight: `SIGHT_LAND`, `SIGHT_ARMY`, `SIGHT_FLEET` (200 = 2), `SIGHT_HILLS_BONUS` (100 = 1).
- registry: `NEAR_RINGS` (410 = 4), `BRIDGE_RINGS` (1,740 = 17).

### A* bound
A step can never cost less than an unpillaged road with the mover's techs. That is 0.25 with
rail and 0.5 minus the road techs otherwise, never under 0.2; every other tile costs at least 1.
`cheapestStep` reads this from the same rule as `tileStepCost`. The old guess was inadmissible
late in the game: km / 170 x 0.5 is up to 0.33 a step, and with all three road techs a road
costs 0.2. The new guess never overestimates, and on long straight runs it is 1.5 times tighter
(170 / 112.5).

### Determinism
- `src/utils/exactMath.js`: `sinCosDeg`, `asinExact`, `logExact`, `expExact`, `powExact` and
  `log10Exact` use only + - * / and sqrt. They are accurate to about 1e-15 and give the same bits
  on every engine.
- `distanceKm` is now 2R asin(chord / 2). It is more accurate than acos for neighbours (it matches
  within 1e-6 km) and exact on every engine. Tile centres are built with `fromLatLonExact`.
- `buildRadiusIndex` in world/registry.js is now a 3-D cube grid on unit vectors instead of
  asin/atan2 lat/lon buckets. Results come back sorted, so sums run in the same order
  everywhere. This also fixes a latent bug: the old longitude span ignored cos(lat), so at
  60° N loyalty pressure and the near-city rule missed cities to the east and west.
- `size ** 1.8` (growthThreshold) and `size ** 2.8` (sizeToPeople) are now literal tables for
  sizes 0 to 30. The literals equal V8's values bit for bit; off the table they fall back to `**`.
- `provinces ** 1.15` (colonies.js) uses `powExact`, and `Math.log10` (rebellion.js,
  worldNations.js) uses `log10Exact`. All three were checked to give the same rounded results
  over their ranges.
- `src/engine/determinismGuard.test.js` walks src/engine/** and its whole import graph and fails
  on transcendental Math calls, `**` with a non-integer exponent, Math.random, Date and
  performance.now. It has three reviewed exceptions, matched by content: perf timing in
  resolveTurn, the test-only default rng in aiLogic, and randomSeed. Render-only geo files are
  listed with a reason. It also checks that `distanceKm`, `fromLatLonExact` and exactMath contain
  no unsafe call, and has a probe test that proves the scanner catches what it should.

### Tests
- `src/data/geo/gridScale.test.js` checks the following without assuming a frequency or cell count:
  - every step lies within [min, max];
  - the guess is at most 1 per step and never above the BFS hop count from 12 sources, pentagons
    included, and is tight (above 0.95 somewhere);
  - `kmCoveringRings` covers its rings;
  - on a built frequency-100 grid (mean 76.7 km, max 84.3 km), the same km rules and the A* bound
    hold with no edits.
- `src/engine/pathOptimality.test.js`: `findTilePath` costs equal a plain Dijkstra on 25 routes
  around New Delhi with roads, with no road techs and with every road tech. `findSeaPath` equals
  a BFS over passable water.

## Numbers

Balance-sim compare, base `ee575e7`, 150 turns, seeds 11 and 12, PLAYER=au:

| | base s11 | new s11 | base s12 | new s12 |
|---|---|---|---|---|
| loyaltyFlips | 5 | 4 | 9 | 4 |
| citiesChangedHands | 5 | 4 | 9 | 4 |
| cities | 848 | 848 | 854 | 855 |
| topNationProvinces | 15 | 15 | 17 | 16 |
| warsTotal / conquests | 3 / 0 | 3 / 0 | 7 / 1 | 7 / 1 |
| avgUnrest | 5.4 | 5.5 | 7.0 | 7.0 |
| rebelStacks / civil wars | 42 / 30 | 42 / 30 | 58 / 31 | 58 / 31 |
| player gold / techs | 2283 / 12 | 2283 / 12 | 2288 / 10 | 2288 / 10 |
| nonFinite / audit | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| msPerTurn | 281 | 273 | 279 | 261 |

The only real change is fewer loyalty flips. Culture now reaches the 13 rings its own comment
promises (1,330 km, not 1,911 km) and falls off over real rings, so far-away big neighbours press
less. Everything else is the same or within noise.

A* benchmark: 142 land routes from Moscow at 10 to 40 steps, with no techs and with rail, plus
sea routes from Britain. Path costs are identical (5,960 total), so routes stay optimal. Land
search time went from 323 / 354 ms to 311 / 301 ms (two runs each), about 4 to 15% faster. The
gain is modest because, with no road techs, any road still halves the guess.

## Scaling from 56k to 100k cells
- `gridSpacing` is one linear pass, about 20 ms at 56k and about 35 ms at 100k, once per process.
- Every converted constant follows the grid. At frequency 100, 410 km is 5 rings (was 4) and
  MAX_SEARCH covers the same area (about 14,200 tiles). Per-turn costs do not change in kind.
- The radius index is linear in the cities and its cube size is in km, so it does not depend on
  the grid.
- The exact maths costs 3 series terms for a neighbour distance, about the cost of `Math.acos`.

## Open questions and follow-ups for the lead
1. **Ring constants outside my files**, still in rings: `MIN_CITY_SPACING`, `BORDER_RING_MAX`
   (world/cities.js), `SUPPLY_LINE_RINGS` (supplyMeter), `AI_MARCH_STEPS`, `AI_RAID_RINGS`
   (aiOperations), `MAX_SETTLE_RINGS`, `AI_SETTLE_RINGS` (settlers), `CLAIM_RANGE_RINGS`,
   `THREAT_RINGS`, `GOVERNOR_GROUP_RINGS`, `RAIDER_REACH_RINGS`, `CITY_NAME_RINGS`, `AIR_RANGE`,
   `AIR_PATROL_RINGS`, `RETREAT_RINGS`, `SETTLED_NEAR_RINGS`, and `START_SPACING`,
   `BIG_MOVE_RINGS` (scenarios). Each converts in one line with `ringsForKm(rings x 102)`.
2. **Movement per turn** (`MOVE_POINTS`, `NAVAL_MOVES_BY_AGE`, `BANK_CAP`, tech +move) is per
   hex. On a denser grid it should scale too, but tile costs, banking and techs must scale
   together. That is a design decision, so I left it.
3. **A* with no roads at all:** using minStep 1 when no road exists would roughly double the
   guess early in the game. It needs a reliable "any road" flag, and `tileState` is sometimes
   mutated in place (world/cities.js `writeTileState`), so a WeakMap cache is unsafe. A road
   counter kept by the road writer (perf's storage work) would make this safe.
4. **The tactical battle** (src/battle/) is outside the guard. `setup/mapgen.js` uses hypot and
   atan2, `setup/tileContext.js` uses cos and atan2, `setup/buildBattleSetup.js` uses cos, sin
   and atan2, and `sim/fixed.js` builds its tables with Math.sin and Math.atan. They could switch
   to exactMath. That is for battle-lab owners.
5. `gridSpacing` could be stored in tiles.json by `build-tiles.mjs` (straits' file) to save the
   20 ms. Not needed.
6. Other sessions (world-systems for logistic growth, gravity trade and SIR plague; ai for
   Lanchester) should use `powExact` / `expExact` / `logExact` from src/utils/exactMath.js. The
   guard test will fail on `Math.exp`, `Math.log` or `x ** 0.5` in the engine.

## Files outside my list (kept minimal)
- src/engine/world/registry.js: radius index rewrite and NEAR/BRIDGE in km (perf's folder).
- src/engine/world/cities.js: two power tables (perf's folder).
- src/engine/colonies.js, src/data/rebellion.js, src/data/worldNations.js: one line each.
- src/data/navalReach.js: the stale km per tile.
