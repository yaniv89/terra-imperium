# Math for the nation AI and the battle AI (research, 2026-10-20)

What the code does today, where it falls short, and which proven formulas close each gap.
Sources were checked by web search where marked **V** (verified); **U** means the formula is
standard but no game source was found. Every pick below works in integer or fixed-point math,
so it keeps the engine deterministic (seeded RNG in state, Q8 battle sim, no `Math.random`).

## 1. What the code uses today

### Nation AI (macro)
- **Battle odds** (`src/engine/lanchester.js`): Lanchester square law.
  `power = (effA / effB) * (NA / NB)^2`, `N = strength * clamp((morale - 20) / 80, 0, 1)`,
  `pWin = r / (1 + r)` with `r = 0.94 * power^4.5`, fitted by `lanchester.calibration.test.js`.
  Good base: every macro battle decision reads it.
- **War choice** (`src/engine/warOdds.js`, `src/utils/aiLogic.js`): expected value
  `EV = 0.5 * (p * gain - (1 - p) * risk) - cost` picks the target, but the declaration itself is a
  flat roll: `chance = 0.02 * doctrine * difficulty * coalition * opinion * ruler`.
- **Battle go / no-go** (`src/engine/aiOperations.js`): fixed bars on one battle's `pWin`
  (fight 0.25, assault 0.30, field 0.35, relief and landing 0.40, sally and strike 0.50).
- **Opinion** (`src/engine/opinion.js`): a sum of reasons clamped to plus or minus 100.
- **Production** (`src/engine/aiProduction.js`): the one real utility scorer (needs times weights,
  take the max).
- **Recruitment**: a flat 35% roll, a fixed class mix, fixed caps by age.
- **Research** (`src/engine/research.js`): a fixed sort order, no value of a tech.

### Battle AI (RTS, `src/battle/sim/`)
- **Targeting** (`combat.js` `targetScore`):
  `counter * (2 - str / max) * role bonus / (distance + 1)`, re-picked every 10 ticks.
- **Morale**: falls with damage, rout at 20, shock to neighbours, slow regen.
- **Paths** (`pathing.js`): integer Dijkstra flow fields per goal, cost by terrain only.
- **Movement** (`movement.js`): push-apart plus a 45 degree sidestep (the P4-H4 fix).
- **Tactical AI** (`tacticalAI.js`): if-chains by difficulty; the attacker retreats when
  `now / start < retreatAt`; the defender sallies at 1.5 times the visible enemy strength.

## 2. Gaps, and the formula for each

Ranked by value for effort on a phone.

| # | Gap today | Formula | Where | Cost | Source |
|---|---|---|---|---|---|
| 1 | Squads pile on one weak target and waste hits; targets that hurt most are not preferred | **Damage per second over HP left, with an overkill cap.** `score = dps_vs_target * threat / hp_left`; skip a target once the damage already assigned to it is lethal; bonus for a one-hit kill | `combat.js` `targetScore`, `acquireTarget` | O(squads x enemies) every 10 ticks | **V** Churchill, Saffidine, Buro, AIIDE 2012 (SparCraft AttackDPS and NOKDPS scripts): https://ojs.aaai.org/index.php/AIIDE/article/view/12527 |
| 2 | Battle go / no-go uses fixed `pWin` bars and ignores losses and the prize | **Expected value of a battle.** `EV = p * prize - attackerLossShare * value_of_army - cost`; act when `EV > 0`. `lanchester.js` already returns the loss shares and nobody reads them | `aiOperations.js` bars | O(1) | Uses the existing Lanchester model; **V** Stanescu, Barriga, Buro, "Using Lanchester Attrition Laws for Combat Prediction in StarCraft", AIIDE: https://ojs.aaai.org/index.php/AIIDE/article/view/12780 |
| 3 | Lanchester weights are hand set | **Fit the weights from battle logs** (maximum likelihood of the per-class strength), as Stanescu et al. did; run on battle-lab parity and campaign logs | `lanchester.calibration.test.js` | Offline only | **V** same paper; also "Combat Models for RTS Games": https://arxiv.org/pdf/1605.05305 |
| 4 | Squads in the battle have no fight-or-withdraw check of their own; the defender never pulls back | **Per-engagement Lanchester with hysteresis.** Project survivors with the closed form `left = sqrt(A^2 - (b / a) * B^2)` (one integer sqrt); AI squads withdraw when `left / now < t` (t by personality 0.3 to 0.6); engage again only at ratio 1.2 or more, leave at 0.8 or less so they do not flip every tick | `tacticalAI.js` | O(1) per squad every 10 to 20 ticks | **V** Stanescu et al. (attack or retreat bot); hysteresis **U**. The AI only: the player never gets a forced retreat (user rule) |
| 5 | War, build, research and peace choices are many hand-tuned if-chains and flat rolls | **Utility AI with response curves.** `u = product of curve_i(x_i)`, corrected for the number of factors: `u' = u + (1 - u) * (1 - 1/n) * u`; curves are linear, `x^k` or logistic, stored as 64-entry integer tables (0 to 1000) | `aiLogic.js` war roll, recruitment, `research.js`, `peace.js` | O(actions x considerations) | **V** Dave Mark, GDC 2010: https://gdcvault.com/play/1012410/Improving-AI-Decision-Modeling-Through ; Mark and Lewis, "Building a Better Centaur", GDC 2015 (Guild Wars 2): https://www.gdcvault.com/play/1021848/ ; https://gameai.com/iaus.php |
| 6 | The AI is predictable, or random where it should be sensible | **Top-band seeded pick.** Choose at random (seeded RNG) among actions with `u >= 0.85 * best`; a per-nation band width is its personality. Cheaper than softmax `exp(u / T)` and gives the same feel | Any utility choice | O(actions) | **V** (weighted randoms in Mark, GDC 2010) |
| 7 | Grudges and favours do not fade smoothly | **Exponential decay.** `o' = o * d + events`, half-life `h`: `d = 2^(-1/h)`; integer `d = 245/256` (a half-life of about 15 turns) with a shift | `opinion.js` reasons with a turn stamp | O(pairs) a turn | Formula standard; that EU4 and Civ VI use decay is **U** (no official numbers found) |
| 8 | Squads still bunch and jitter in crowds | **Separation steering.** Sum of `(p_i - p_j) / d^2` over neighbours within `r` on the existing spatial grid; L1 or octagonal distance avoids a sqrt | `movement.js` `separateSquads` | O(n x k) a tick | **V** Reynolds, GDC 1999: https://www.red3d.com/cwr/steer/ |
| 9 | No front line or threat picture; marches and flanks ignore enemy fire | **Influence maps.** Each source adds `strength * max(0, 1 - d / R)`; spread with `I'(c) = max(I(c), decay * max(neighbours))` for a few passes; front line = where friendly minus enemy crosses zero. Cap each source so one hero cannot swing the map (Total War: Warhammer 3 lesson) | Macro: coarse grid over tiles every few turns. Battle: 32x32 grid about once a second | O(cells x passes) | **V** Dave Mark, Game AI Pro 2 ch. 30: https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf |
| 10 | Paths cost terrain only | **Threat-aware paths.** `step cost = terrain + w * threat(cell)` from map 9; keep `w * threat < 3 x distance` | `pathing.js` flow fields (add a threat layer to the cost) | Same as today plus a lookup | **U** (no single source); flow fields themselves **V** Emerson, Game AI Pro ch. 23 |
| 11 | The AI sees exact enemy strength through fog (warOdds uses one noise number per pair) | **Gaussian belief per enemy army.** `m' = (m/v + z/r) / (1/v + 1/r)`, `v' = 1 / (1/v + 1/r)`; between sightings `v += q`; a cautious AI decides on `m + k * sqrt(v)` (k is personality) | `warOdds.js` perceived army | O(enemies) a turn | Kalman update standard; fog prediction in StarCraft **V** Synnaeve and Bessiere: https://arxiv.org/pdf/1111.3735 |
| 12 | Archers die in melee unless the difficulty is Emperor | **Kiting rule.** Kite when own speed is higher, `d < 0.7 R` and the cooldown left is longer than the time to be reached; fire again at `d >= 0.8 R` | `tacticalAI.js` abilities | O(1) per ranged squad | **U** (SparCraft has kite scripts) |
| 13 | Army size sent to a war is all or nothing | **Kelly fraction as a heuristic.** `f = p - (1 - p) / b` (b = prize to loss ratio); commit half of `f` of the free army | `aiOperations.js` siege force size | O(1) | Formula **V** Kelly 1956; use in games **U** |

### Skip for now (cost more than they give on a phone)
- ORCA / RVO collision avoidance (**V** https://gamma.cs.unc.edu/ORCA/): floating point, a small linear program per agent; separation steering (row 8) gets most of the win.
- MCTS war planning (**V** Browne et al. 2012): thousands of rollouts, too slow for 100 nations.
- Hungarian slot assignment: O(n^3); sorting units and slots along the facing axis gives almost the same result in O(n log n).
- Shapley coalition value, GOAP and HTN planners: the existing operations code already plans multi-step moves.
- Elo rating of nations: only useful if the power formula drifts from real results; row 3 fixes that more directly.

## 3. Suggested build order

1. **Battle target score with overkill cap** (row 1), plus **AI retreat with hysteresis** (row 4). Battle-lab can measure the effect at once (idle time, losses, parity).
2. **Battle EV instead of fixed bars** (row 2) in `aiOperations.js`. It reuses numbers `lanchester.js` already returns.
3. **Utility curves with a top-band seeded pick** (rows 5 and 6) for the war roll, recruitment and research. This replaces the flat 2% and 35% rolls.
4. **Opinion decay** (row 7).
5. **Influence maps**, then **threat-aware paths** and **fog belief** (rows 9, 10, 11).
6. Fit the Lanchester weights from logs (row 3) once the rest is stable.

Each step changes balance: use the add-mechanic and balance-sim skills on the macro rows and
battle-lab (parity and parityEco) on the battle rows, and bump `SETUP_VERSION` when battle
hashes move.

## 4. Notes
- Determinism checked: `aiLogic.js` keeps a `Math.random` default for its `rng` argument, but
  the only real caller (`resolveTurn.js` line 598) passes the seeded RNG. The other `Math.random` hits in
  `colonies.js`, `mapTrade.js` and `resolveTurn.js` are comments.
- Claims that "Civ, EU4 or Old World use X" were not confirmed by any official source; no
  published formulas were found for those games.
- Determinism reading, if needed: Frontier GDC 2024 (cross-platform determinism):
  https://media.gdcvault.com/gdc2024/Slides/GDC+slide+presentations/Pollard_Bradley_CrossPlatformDeterminism+2024-03-26+09.34.19.pdf
