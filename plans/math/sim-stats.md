# sim-stats: a statistically sound balance harness

Math wave idea 2 (plans/math-ideas.md 8.1, 8.2, and the Zipf check from 7.2). No engine code changed.

## What changed
- `scripts/simStats.mjs` (new, no imports, shared by everything below): mean, sample sd, Student t
  critical values, `pairedDiff` (mean difference, 95% t interval, significance, up/down counts,
  seeds needed at 80% power `((2.8 sd)/diff)^2`, and a deterministic bootstrap from 10 pairs up),
  `gini`, `hhi`, `kaplanMeier` (censoring and late entry), `zipfSlope`, `forEachOwnedTile`
  (reads `world.tileOwner` as an object, a Map or a typed array, so the perf session's storage
  change does not break the harness) and `worldHealth(state)`. Tests: `scripts/simStats.test.mjs`.
- `.claude/skills/balance-sim/worldStats.sim.js`: every STATS line and SUMMARY gain
  `giniCities, giniPopulation, giniWealth, giniLand, hhiLand, effectiveNations, topLandShare,
  landClaimedShare, zipfSlope, nationsAlive, nationsAliveShare, leadChanges, devastatedShare,
  unclaimedShare`; SUMMARY also `survivalT<checkpoint>` per EVERY turns and `medianNationLife`.
  All old keys are unchanged and in the same order.
- `.claude/skills/balance-sim/pairedCompare.mjs` (new): pairs two logs by seed and prints the table
  below; `--turn N` for a checkpoint, `--all`, `--json`.
- `.claude/skills/balance-sim/compare.sh`: seeds as a list or a range (`11-18`), one process per
  (side, seed) run `JOBS` at a time (default all cores), `PLAYER` defaults to `au`, `AT=50,100`
  for checkpoint tables, `OUT=dir` keeps logs. Still prints both SUMMARY lines per seed first (the
  old output), then the paired table. The base worktree gets the current harness so both sides
  report the same keys. Clear error when the base ref is missing in a shallow clone.
- `scripts/simulate.mjs`: same health measures per game, printed as mean and 95% t interval
  across games (unpaired, since games differ by seed and player). Existing output kept.
- `SKILL.md`: the new keys, how to run and read the paired compare, and new red flags.

## Design choices
- **Student t, not 1.96.** With 2 seeds the 95% multiplier is 12.7, not 1.96; with 8 it is 2.36.
  The old habit of comparing two seeds by eye can only see huge effects. The table says so.
- **Pairing is valid**: the same seed with the same code gives byte-identical SUMMARY lines
  (checked: two runs of seed 11, all keys equal except msPerTurn). So a no-change compare shows
  every metric identical and only timing differs (done at 20 turns: 52 of 53 identical).
- **How much pairing buys here**: measured on the sample below, the paired standard error is 1.0x to
  1.4x smaller than the unpaired one (civil wars 1.38, unrest 1.39, giniLand 1.38, wars 1.09,
  conquests 1.00). Modest, because a rule that consumes the rng makes the two runs diverge within
  a few turns. The bigger wins are the honest interval, the star and the seeds@80% column.
  Common random numbers (one rng stream per system) would make pairing much stronger; that is an
  engine change, left as an open question.
- **Timing is never starred**: parallel runs share the CPU. Use `JOBS=1` or PERF_CHECKS for timing.
- **Cheaper seeds**: per-seed processes in parallel. 16 runs of 150 turns (8 seeds, both sides)
  took about 10 minutes on 4 cores, about what 2 seeds took before (vitest ran seeds serially).

## How it scales to more hexes
Every new measure is a share, an index or a ratio: land shares come from land cells divided by
the grid's own land count (`getTiles()`), Gini and HHI do not change when every holding scales
(unit test), survival and lead changes count nations, not cells. `devastatedShare` and
`unclaimedShare` are per-city versions of the old counts. Cost: one pass over `tileOwner` and the
cities per checkpoint, linear in owned cells,
and a per-turn pass over nations and cities for survival and lead changes. Nothing in the engine.

## Sample compare output
A demonstration, not a proposed change: `BASE_WAR_ROLL_CHANCE` in src/utils/aiLogic.js temporarily
doubled (0.02 to 0.04, reverted, not committed), base = ee575e7, PLAYER=au, 150 turns, seeds 11-18,
`AT=50,100`. Final turn table:

```
== paired (final turn)
paired over 8 seed(s): 11,12,13,14,15,16,17,18   diff = head - base, 95% t interval, * = interval excludes 0
  metric                 base    head     diff              95% CI       up/down  seeds@80%
  warsActive             0.38    1.25    +0.88       [-0.42, 2.17]           4/1         25
  warsTotal              7.38    13.6    +6.25        [0.97, 11.5]    *      7/1           
  vassals                0.63    2.00    +1.38       [-0.52, 3.27]           6/1         22
  avgLibertyDesire       9.56    12.5    +2.96       [-8.93, 14.9]           5/2        181
  conquests              0.38    3.38    +3.00       [-0.28, 6.28]           5/1         14
  devastatedProvinces       0    0.38    +0.38     [-0.0578, 0.81]           3/0         15
  civilWarsStarted       28.5    34.6    +6.13        [0.98, 11.3]    *      7/1           
  inCivilWar             1.00    0.88    -0.13       [-1.42, 1.17]           2/3       1210
  rebelStacks            48.5    56.5    +8.00       [-6.59, 22.6]           4/4         38
  cities                854.6   854.3    -0.38       [-7.18, 6.43]           5/3       3695
  landClaimedPct         40.8    40.8  +0.0250       [-0.35, 0.40]           5/3       2536
  citiesChangedHands     8.50    15.9    +7.38        [0.63, 14.1]    *      6/2           
  loyaltyFlips           7.75    12.5    +4.75       [-0.88, 10.4]           5/3         16
  freeCities             0.25    0.25        0       [-0.45, 0.45]           1/1           
  sieges                 0.25    1.13    +0.88       [-0.34, 2.09]           3/0         22
  armiesOnRoad           13.0    24.6    +11.6       [-1.96, 25.2]           6/1         16
  maxProvinceShare     0.0178  0.0170  -0.0008   [-0.0025, 0.0010]           1/3         59
  topNationProvinces     15.1    14.5    -0.63       [-1.88, 0.63]           1/3         46
  unclaimedProvinces     0.25    0.25        0       [-0.45, 0.45]           1/1           
  avgWarExhaustion       0.29    1.05    +0.76        [0.25, 1.28]    *      7/0           
  avgUnrest              6.04    7.08    +1.04       [-0.40, 2.48]           5/3         22
  playerGold             2280    2288    +7.38       [-2.77, 17.5]           5/2         22
  playerSupplies        165.0   164.6    -0.38       [-1.26, 0.51]           0/1         63
  playerTechs            10.8    10.6    -0.13       [-0.42, 0.17]           0/1         63
  devastatedShare           0  0.0004  +0.0004   [-0.0001, 0.0008]           3/0         15
  unclaimedShare       0.0003  0.0003        0   [-0.0004, 0.0004]           1/1           
  nationsAlive          239.8   239.6    -0.13       [-0.66, 0.41]           1/2        207
  giniCities             0.42    0.42  +0.0008   [-0.0025, 0.0040]           6/2        211
  giniPopulation         0.36    0.36  +0.0020   [-0.0019, 0.0059]           6/2         44
  giniWealth             0.43    0.44  +0.0099    [0.0017, 0.0180]    *      7/1           
  giniLand               0.52    0.52  +0.0013   [-0.0013, 0.0038]           6/2         46
  hhiLand              0.0080  0.0080  +0.0000   [-0.0000, 0.0001]           5/1         18
  effectiveNations      125.2   125.0    -0.19       [-1.29, 0.91]           3/5        386
  topLandShare         0.0091  0.0084  -0.0007  [-0.0013, -0.0002]    *      0/5           
  landClaimedShare       0.41    0.41  +0.0001   [-0.0035, 0.0037]           5/3       9238
  zipfSlope             -0.14   -0.13  +0.0100   [-0.0055, 0.0255]           4/2         27
  nationsAliveShare      1.00    1.00  -0.0015   [-0.0040, 0.0010]           1/4         31
  leadChanges            1.88    2.00    +0.13       [-1.09, 1.34]           2/2       1067
  msPerTurn             310.5   329.5    +19.0        [2.90, 35.1]  (t)      8/0          9
  survivalT50            1.00    1.00  -0.0005   [-0.0026, 0.0016]           1/2        207
  survivalT100           1.00    1.00  -0.0010   [-0.0034, 0.0014]           1/3         63
  survivalT150           1.00    1.00  -0.0015   [-0.0040, 0.0010]           1/4         31
  12 metric(s) identical on every seed (--all shows them)
significant: warsTotal, civilWarsStarted, citiesChangedHands, avgWarExhaustion, giniWealth, topLandShare
(t) = timing, parallel runs share the CPU. seeds@80% = seeds needed to resolve the observed diff at 80% power, ((2.8 sd)/diff)^2.
```

Turn 50 starred: warsTotal, civilWarsStarted, rebelStacks, armiesOnRoad, avgUnrest.
Turn 100 starred: civilWarsStarted, maxProvinceShare, playerGold.

Reading it: doubling the war roll almost doubles wars (7.4 to 13.6, interval 1.0 to 11.5) and
raises civil wars, cities changing hands, war exhaustion and wealth inequality. Conquests (+3.0)
just miss the star; the table says 14 seeds would settle it. Wars knock the biggest nation down a
little (topLandShare -0.0007, 0 of 8 up).

## What the base world looks like (base side of the sample, turn 150, 8 seeds)
- 239.8 of 240 nations alive, survival at 150 turns 0.999: almost nobody dies, so survival curves
  only start to say something in longer runs or after war changes. `medianNationLife` stays null.
- Biggest nation holds 0.9% of the world's land (`topLandShare` 0.009), effective nations 125:
  no runaway at all; history's biggest empires held a few percent to a quarter.
- Zipf slope -0.14 (real city systems are about -1): city sizes are far too even. A finding for
  the world-systems session (logistic growth, trade).
- Wars per 150 turns 7.4, conquests 0.4, lead changes 1.9.

## Open questions
- Common random numbers: separate rng streams per system (war rolls, disasters, AI) would make
  paired seeds stay aligned after a change, and cut the seeds needed several times. Engine change.
- Targets for idea 8.3 (automated tuning): topLandShare by era, survival at turn 300, Zipf slope.
- Survival needs 300+ turn runs to be informative in this quiet world.
