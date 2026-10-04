# Math wave: combined check

The whole wave (claude/bronze-towns at 4c06338: grid-math, sim-stats, ai, straits, perf,
world-systems with its Zipf commit, plus map changes) against the pre-wave base ee575e7.

`PLAYER=au AT=50,100 .claude/skills/balance-sim/compare.sh ee575e7 150 11-18`, run from a
4c06338 worktree with the harness from math/sim-stats 9ef0282 (adds the plague keys; both sides run
the same harness). 16 sims, 4 at a time, one machine. All 16 reached turn 150 with status ACTIVE.
The straits change altered 34 tiles and the save version, so the two maps differ slightly (expected).

## Verdict
No runaway, no collapse, no broken state. The wave makes turns 16% faster, city sizes more
unequal (as the Zipf work intended, though still far from real-world), the player a little richer,
and brings real plague outbreaks. Wars and civil wars lean down but not significantly.

## Health (all 16 runs)
- nonFinite 0 and auditViolations 0 on every seed, both sides.
- Status ACTIVE at turn 150 on every seed, both sides.

## Starred differences (95% interval excludes 0), turn 150
| metric | base | wave | diff | 95% CI | seeds |
|---|---|---|---|---|---|
| zipfSlope | -0.14 | -0.28 | -0.14 | [-0.16, -0.11] | 0 up / 8 down |
| giniPopulation | 0.36 | 0.43 | +0.073 | [+0.066, +0.079] | 8 / 0 |
| playerGold | 2280 | 2551 | +271 (+12%) | [+260, +282] | 8 / 0 |
| playerTechs | 10.8 | 10.3 | -0.5 | [-0.95, -0.05] | 0 / 4 |
| landClaimedShare | 0.408 | 0.411 | +0.003 | [+0.001, +0.006] | 6 / 0 |
| hhiLand | 0.0080 | 0.0080 | +0.0001 | [0.0000, +0.0001] | 4 / 0 |

Turn 50 also starred: cities -7.9 (408 to 400) and land claimed -0.3 points (slower early
settling), medianNationProvinces -0.5, giniCities -0.005, giniWealth +0.007, playerGold -10,
zipfSlope -0.22 (-0.17 to -0.39). Turn 100: cities -6.8, maxProvinceShare +0.0014 (0.0150 to
0.0164, tiny), playerGold +108, playerTechs -0.5, giniPopulation +0.087, zipfSlope +0.018.
By turn 150 the city count has caught up (+1.8, not significant).

## The numbers asked for (turn 150, mean of 8 seeds)
| metric | base | wave | diff | 95% CI | verdict |
|---|---|---|---|---|---|
| warsTotal | 7.4 | 5.4 | -2.0 | [-6.1, +2.1] | not significant (49 seeds to settle) |
| conquests | 0.38 | 0.63 | +0.25 | [-0.7, +1.2] | not significant, rare |
| civilWarsStarted | 28.5 | 23.5 | -5.0 | [-10.1, +0.06] | borderline, 6 of 8 down (12 seeds) |
| cities | 854.6 | 856.4 | +1.8 | [-4.2, +7.7] | same (slower at 50 and 100) |
| zipfSlope | -0.14 | -0.28 | -0.14 | [-0.16, -0.11] | * steeper, real systems about -1 |
| giniCities | 0.42 | 0.42 | +0.004 | [-0.001, +0.008] | same |
| giniPopulation | 0.36 | 0.43 | +0.073 | * | more unequal city sizes |
| giniWealth | 0.43 | 0.43 | +0.003 | [-0.005, +0.011] | same |
| giniLand | 0.52 | 0.52 | +0.003 | [-0.000, +0.007] | same |
| effectiveNations | 125.2 | 124.7 | -0.6 | [-1.6, +0.5] | same |
| nationsAlive | 239.8 | 240.0 | +0.25 | [-0.14, +0.64] | same, survival 1.00 |
| plagueCitiesStruck | 0.9 | 21.0 | +20.1 | [-4.7, +44.9] | heavy-tailed, see below |
| msPerTurn | 280.5 | 236.9 | -43.5 (-16%) | [-50.6, -36.5] | faster on 8 of 8 seeds |

## Plague
Base: the old independent roll struck 0 or 1 city per run. Wave (SIR epidemic): cities struck per
seed 54, 12, 5, 6, 6, 2, 2, 81; seeds 11 and 18 had 25 and 16 cities sick at turn 150 (outbreaks at
their peak). Heavy-tailed as the world-systems report predicted, so the mean difference is not
starred. It did not hurt the health measures: unrest, nations alive and Gini of wealth did not move.

## Runaway or collapse?
None. Biggest nation 0.8 to 1.0% of the world's land on every seed (base 0.9%), top military to
median 1.7 on both sides, effective nations about 125 on both, nobody eliminated beyond base.
The one starred growth in concentration (maxProvinceShare +0.0014 at turn 100, hhiLand +0.0001 at
150) is far too small to matter.

## Timing
Same machine, both sides interleaved 4 at a time, so the comparison is fair, but absolute values
include CPU sharing. 280 to 237 ms per turn at turns 101-150, 197 to 179 at turns 1-50 (all 8 seeds
faster). Still about 3 times the 80 ms budget.

## Things to watch
- playerTechs -0.5 at 100 and 150 (4 seeds down, none up): research for the passive player is a
  little slower; check the tech-diffusion change if it shows up in real play.
- Early settling is slower (8 fewer cities at turn 50), catching up by 150.
- Zipf slope -0.28 is better but still far from -1.
- Survival stays at 1.00 for 150 turns in both worlds; it needs 300+ turn runs to say anything.

## Sample of the raw table (turn 150)
```
== paired (final turn)
paired over 8 seed(s): 11,12,13,14,15,16,17,18   diff = head - base, 95% t interval, * = interval excludes 0
  metric                 base    head     diff             95% CI       up/down  seeds@80%
  warsActive             0.38    0.50    +0.13      [-0.41, 0.66]           2/1        207
  warsTotal              7.38    5.38    -2.00      [-6.14, 2.14]           2/5         49
  vassals                0.63    0.75    +0.13      [-0.82, 1.07]           3/3        637
  avgLibertyDesire       9.56    7.13    -2.44      [-17.0, 12.2]           2/4        403
  conquests              0.38    0.63    +0.25      [-0.72, 1.22]           1/1        171
  devastatedProvinces       0    0.13    +0.13      [-0.17, 0.42]           1/0         63
  civilWarsStarted       28.5    23.5    -5.00    [-10.1, 0.0566]           1/6         12
  inCivilWar             1.00    1.75    +0.75      [-0.49, 1.99]           4/2         31
  rebelStacks            48.5    37.9    -10.6      [-26.8, 5.56]           3/4         27
  cities                854.6   856.4    +1.75      [-4.21, 7.71]           4/4        131
  landClaimedPct         40.8    41.1    +0.33     [0.0692, 0.58]    *      6/0           
  citiesChangedHands     8.50    5.75    -2.75      [-6.79, 1.29]           2/6         25
  loyaltyFlips           7.75    5.25    -2.50      [-6.08, 1.08]           2/6         23
  freeCities             0.25       0    -0.25      [-0.84, 0.34]           0/1         63
  sieges                 0.25    0.25        0      [-0.89, 0.89]           1/1           
  armiesOnRoad           13.0    6.13    -6.88      [-15.0, 1.27]           2/5         16
  maxProvinceShare     0.0178  0.0175  -0.0002  [-0.0015, 0.0010]           3/4        278
  topNationProvinces     15.1    15.0    -0.13      [-1.07, 0.82]           3/3        637
  unclaimedProvinces     0.25       0    -0.25      [-0.84, 0.34]           0/1         63
  avgWarExhaustion       0.29    0.31  +0.0250      [-0.46, 0.51]           2/3       4149
  avgUnrest              6.04    5.80    -0.24      [-2.05, 1.58]           4/4        655
  playerGold             2280    2551   +271.1     [260.0, 282.2]    *      8/0           
  playerSupplies        165.0   164.8    -0.25      [-1.49, 0.99]           4/3        278
  playerTechs            10.8    10.3    -0.50   [-0.95, -0.0531]    *      0/4           
  devastatedShare           0  0.0001  +0.0001  [-0.0002, 0.0004]           1/0         63
  unclaimedShare       0.0003       0  -0.0003  [-0.0008, 0.0003]           0/1         63
  nationsAlive          239.8   240.0    +0.25      [-0.14, 0.64]           2/0         27
  giniCities             0.42    0.42  +0.0038  [-0.0006, 0.0081]           5/2         16
  giniPopulation         0.36    0.43  +0.0725   [0.0664, 0.0786]    *      8/0           
  giniWealth             0.43    0.43  +0.0030  [-0.0053, 0.0113]           4/4         87
  giniLand               0.52    0.52  +0.0031  [-0.0004, 0.0067]           5/2         15
  hhiLand              0.0080  0.0080  +0.0001   [0.0000, 0.0001]    *      4/0           
  effectiveNations      125.2   124.7    -0.56      [-1.61, 0.49]           3/5         40
  topLandShare         0.0091  0.0090  -0.0001  [-0.0007, 0.0004]           1/2        207
  landClaimedShare       0.41    0.41  +0.0034   [0.0009, 0.0059]    *      6/0           
  zipfSlope             -0.14   -0.28    -0.14     [-0.16, -0.11]    *      0/8           
  nationsAliveShare      1.00    1.00  +0.0010  [-0.0005, 0.0025]           2/0         27
  leadChanges            1.88    1.00    -0.88      [-1.92, 0.17]           0/3         16
  plagueCitiesNow           0    5.38    +5.38      [-2.69, 13.4]           4/0         26
  plagueCitiesStruck     0.88    21.0    +20.1      [-4.69, 44.9]           8/0         18
  msPerTurn             280.5   236.9    -43.5     [-50.6, -36.5]  (t)      0/8          2
  survivalT50            1.00    1.00  +0.0010  [-0.0005, 0.0025]           2/0         27
  survivalT100           1.00    1.00  +0.0010  [-0.0005, 0.0025]           2/0         27
  survivalT150           1.00    1.00  +0.0010  [-0.0005, 0.0025]           2/0         27
  12 metric(s) identical on every seed (--all shows them)
significant: landClaimedPct, playerGold, playerTechs, giniPopulation, hhiLand, landClaimedShare, zipfSlope
(t) = timing, parallel runs share the CPU. seeds@80% = seeds needed to resolve the observed diff at 80% power, ((2.8 sd)/diff)^2.
```
