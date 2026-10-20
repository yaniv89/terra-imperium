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

## 5. The rest of the nation AI (research, 2026-10-20)

Same rules as section 2: integer-safe picks, seeded rolls, cheap on a phone. Row numbers continue
from section 2 (rows 14 and up). Row 5 (utility curves) and row 6 (top-band seeded pick) are the
shared base; the rows below say where to plug them in. Line numbers are as of this date.
Source marks: **V** a search found the page and it states the formula; **U** unverified or only
secondary.

What the code does today, in short:
- **Trade**: only the player's pact partners earn the gravity bonus (`tradeValue.js`:
  `mult = 0.1 * sqrt(Yp / Ym) / (1 + km / 1000)`, soft cap 0.2). AI nations never form trade pacts
  (`modifiers/sources.js:88`). AI map swaps already use a value model plus a 20% hash roll
  (`mapTrade.js:60-68`, `237`). Mercantile independents sign trade on a flat `TRADE_AI_CHANCE` 0.3
  and pay a flat `tradeGoldOf(age)` (`indepPolicy.js:204`, `387`). A cut route lasts 3 reference turns,
  then is guarded 12 (`tradeDisruptions.js:37-38`).
- **Diplomacy**: AI open borders flip on opinion bars 8 open and 0 close, checked every 10 turns
  (`aiAccords.js:55-57`). A demand needs a chain of gates (`demandBlock`) and power ratio 2
  (`AI_DEMAND_RATIO`). Acceptance is `score = 20 * (ratio - 1) + opinion / 4 - base`, base 10 tribute,
  40 city, 5 stop-settling (`accords.js:80-84`, `175`). Tribute is
  `income * cooldownTurns * 0.08 * max(1, ratio)`, at most half the payer's gold (`accords.js:136-141`).
  Alliances and marriages are player actions only (`gameReducer.js:2305`, `2444`); the AI's only
  league is the defensive pact when two nations hold 40 AE against the same X (`pacts.js:18-20`).
- **Peace**: term costs are fixed prices (cede `100 * cityDev / recipientDev`, gold `min(30, amt/500)`,
  reparations 15, humiliate 15, vassalize 60 and up). The offerer's budget is
  `min(100, max(0, score) + 10)`. `buildAITerms` (`peace.js:259`) fills that budget greedily,
  cheapest city first. The recipient's acceptance ledger (`peace.js:103-129`) is
  `score + 0.4 * exhaustion + clamp(0.5 * (p * risk - (1 - p) * gain), +-30) + min(10, turns / 5)
  - 10 (capital safe) - 15 (capital demanded)`; it accepts iff the total covers the cost.
- **Settling**: `scoreSite` = `here + 0.5 * (unowned ring-1 tiles) + 3 resource + 2 river + 1.5 coast`
  minus 0.6 per 102 km (`settlers.js:149`, `siteQualityParts`). Floor `SITE_SCORE_MIN` 4. One settler
  per nation at a time, slots 2 to 4 by age. Settler utility is a flat 2, halved at war
  (`aiProduction.js:49-50`, `175-178`).
- **Gold**: rush reserve `max(50, 3 * deficit)`, up to 4 rushes a think, more above 400 gold
  (`aiEconomy.js:246-253`). Loans are only taken when gold goes negative: `principal = max(200,
  -gold)`, capacity 3 plus banks, interest 4% plus 1% per loan open (`aiEconomy.js:393-405`,
  `economy.js:57-67`).
- **Government and laws**: a doctrine table picks the type, the reform and the laws; unliked
  categories take the top tier with no stability cost; every change keeps 50 ADM spare and a
  5-turn cooldown (`aiEconomy.js:140-155`, `279-296`).
- **Independents**: raid score `loot * (1 + grudge / 50) * era / (1 + defenders / party) - 2 per
  102 km`, go when `>= 6` and a roll passes `RAID_CHANCE * (1 + grudge / 100)`
  (`data/independents.js:164-185`). Joining a major needs opinion 80 for 20 turns, or army 5x with
  opinion 40. Conquest needs army 2x the garrison and a flat 0.6 roll. Tribute is demanded at 3x
  strength (25% roll) or grudge 40. Razing: size 2 or less and another own city within 306 km.
  Grudges fall a flat 2 a turn.

### Gaps and formulas (rows 14 to 29)

| # | Gap today | Formula | Where | Cost | Source |
|---|---|---|---|---|---|
| 14 | AI nations never trade with each other; a trade pact is worth something only to the player | **Reuse the gravity flow for AI pairs.** `flow = G * sqrt(Ya * Yb) / (1 + km / 1000)` with straight-line km (no path search). Each AI scores every partner in reach as a utility: `u = curve(flow / Ya) * curve(opinion) * (1 - war risk)`; sign the best one above a bar (top-band seeded pick, rows 5 and 6). Integer: `sqrt` by integer Newton, `Y` already cached by `economySizes` | `tradeValue.js`, `aiAccords.js` accord slot | O(partners) per nation per 10 turns | **V** Tinbergen gravity model (exponents near 1): https://arxiv.org/pdf/1304.3252 |
| 15 | Independent trade is a flat 30% roll and a flat gold payment | **Same gravity flow with the independent's size**, so a big city beside a rich major pays more; sign when `flow >= TRADE_MIN` instead of rolling `TRADE_AI_CHANCE`; keep the grudge cutoff | `indepPolicy.js:204`, `387`; `data/independents.js tradeGoldOf` | O(majors in reach) | **V** same source |
| 16 | Open-border bars (8 open, 0 close) are flat and the same for everyone | **Utility with hysteresis.** Open when `u_open >= 0.6`, close at `u_open < 0.35` (the gap stops flapping). Considerations: opinion (logistic), shared threat (a common enemy raises it), trade flow (row 14), a rival's border (lowers it) | `aiAccords.js:56-58` | O(touching pairs) per slot | **V** Dave Mark IAUS (section 2 row 5); shared-threat term from Walt, row 17 |
| 17 | The AI never makes an alliance or a marriage; leagues only form from AE >= 40 | **Balance of threat score.** `threat(X -> me) = (power_X / power_all) * proximity_X * offence_X * (1 + intent_X)`, with `proximity = 1 / (1 + km / 1000)`, `offence` = share of the army that is attack units, `intent` from `opinion.js` hostility and AE held. Ally with the nation that most reduces the biggest threat: `value(Y) = threat_biggest * power_Y / (power_Y + power_biggest) - cost_of_being_called_to_war`. For a group of 2 or 3, exact Shapley (6 orderings at most): `phi_i = avg over orderings of v(S + i) - v(S)`, `v(S)` = summed power against the threat. Cap alliances per nation at 2 or 3 | new `aiAlliances.js`; `pacts.js` for the AE league | O(neighbours^2) per slot, 3 players exact | **V** Walt, balance of threat (aggregate power, proximity, offensive capability, intent): https://en.wikipedia.org/wiki/Balance_of_threat ; Shapley as marginal contribution **V** https://www.cs.huji.ac.il/labs/mas/talks/articles/computingshapley.pdf (use in a game **U**) |
| 18 | Tribute and demand prices are a rule of thumb (share of income times ratio) and the accept test is linear | **Nash bargaining with the war as the break point.** For the target, paying `T` beats fighting when `T <= T_max = p_lose * exposure` (the same `warOdds` and `exposure` the peace ledger uses). For the demander, `T_min` is its expected cost of the war it threatens. Price at `T = (T_min + T_max) / 2` (equal power) or weighted by `ratio / (1 + ratio)`; ask only when `T_max > T_min`. The target accepts when `T <= T_max`. Replaces `20 * (ratio - 1) + opinion / 4 - base` | `accords.js:136-176` | O(1) per demand; reuses `warOdds` | **V** Nash bargaining solution: https://metricgate.com/docs/nash-bargaining-solution/ (the asymmetric form takes bargaining-power weights) |
| 19 | The AI asks the most its war-score budget allows, not what the other side would take; it picks cities cheapest first, so it takes junk | **Ask the recipient's reservation value.** Offerer share of the surplus (Rubinstein): `x = (1 - d_r) / (1 - d_o * d_r)`; `d` = patience, from `exhaustion` and turns at war (`d = 1 - exhaustion / 200`, kept as Q8 integers). Total ask `A = min(maxCost, acceptance.total * x)`. Then pick terms by value per cost, `value(city) = dev + resource + port + goal prize`, until `sum cost <= A` (greedy knapsack, fine for 2 to 6 terms). Offer white peace early when `EV(continue) < 0`: `p * gain - (1 - p) * risk - cost_per_turn * turns_left` | `peace.js:259-303` (`buildAITerms`) | O(terms) per offer; one `getPeaceAcceptance` | **V** Rubinstein alternating offers, `(1 - d2) / (1 - d1 * d2)`, the patient side gets more: https://en.wikipedia.org/wiki/Rubinstein_bargaining_model |
| 20 | Settling scores only ring 1 at half weight, though a new city claims a whole `foundingDisk`; overlap with its own cities is not counted | **Ring-weighted tile sum with overlap discount.** `V(site) = 12 * sum(ring1) + 6 * sum(ring2) + 2 * sum(ring3)` over the tile values already in `siteQualityParts` (ring weights as in the Civ IV settler AI), each tile divided by `(1 + my cities already claiming it)`; then river and coast modifiers (keep today's flat bonuses if tuning is cheaper), minus the distance penalty. Two-stage search: rank candidates by today's cheap score, run the ring sum only on the top 20 | `settlers.js` `siteQualityParts` | O(20 candidates * 37 tiles) per nation per settle decision; cached per world as now | **V** (forum, not official) CivFanatics, Civ IV AI ring weights 12/6/2 and river/coast modifiers: https://forums.civfanatics.com/threads/better-city-sites-ai.339368/page-3 |
| 21 | Settler utility is a flat 2; the AI settles at the same urgency whether land is open or a rival is two turns away | **Utility curve on site value and race.** `u = curve_site(V / V_ref) * curve_free(free slots / slots) * (1 + race)`, with `race = 1 / (1 + rivalRings)` where `rivalRings` is the nearest other nation's distance to the site (contested sites first). Marginal-city test: found when `V * turnsLeft(speed) > settlerCost + upkeep * turnsLeft`. At war keep the 0.5 factor but let a safe interior site override it | `aiProduction.js:175-178` | O(1) on top of the site search | **V** Dave Mark IAUS for the curves; race term **U** |
| 22 | The reserve is a fixed 50 gold or 3 turns of deficit; the AI neither saves for a bad year nor spends a big pile | **Miller-Orr cash controller.** Lower limit `L = max(50, 3 * deficit + warChest)`; spread `3Z` with `Z = (3/4 * c * sigma2 / i)^(1/3)`; return point `L + Z`; upper limit `L + 3Z`. Above the upper limit: spend down to the return point (rush, buildings, law ADM). At `L`: stop rushing and, only if a project pays back, borrow up to the return point. `c` = the fee in gold of a rush or loan, `i` = loan rate per turn, `sigma2` = running variance of net income, integer EMA: `var += ((d * d) - var) >> 3` with `d = net - mean`; integer cube root by Newton | `aiEconomy.js:246-253` | O(1) per think; one cube root | **V** Miller-Orr limits and return point (textbook notes; the 1966 paper itself not read, so the primary is **U**): https://acowtancy.com/textbook/acca-fm/c2f-managing-cash/miller-orr-model/notes |
| 23 | Loans only appear when gold goes negative, never to finish something worth finishing; the size is `max(200, -gold)` | **Borrow for payback.** Take a loan of `size` when `gain_per_turn * turnsLeft > size * (1 + rate * term)` and gold is under the return point of row 22; cap by `getLoanCapacity`. Repay early when gold passes the upper limit. Keep today's emergency loan as the floor | `aiEconomy.js:393-405` | O(1) per think | Payback rule **U** (standard capital budgeting); limits from row 22 **V** |
| 24 | Rush buying picks the biggest city and spends whatever is above the reserve, with no price check | **Rush by price per turn saved.** `ppt = rushGold(missing) / turnsSaved`; rush the order with the best `value_of_item / ppt`, only if `ppt` is under the nation's gold value per turn (income per turn, scaled). Items under a war plan keep priority (existing rule) | `aiEconomy.js:250-277` | O(cities), already scanned | **V** Dave Mark IAUS (score, take the max); thresholds **U** |
| 25 | Government, reform and laws follow a doctrine table; the same law for a nation at war, broke or at peace | **Situational weighted sum with a switching cost.** `score(option) = sum_k w_k(situation) * effect_k - cost / horizon + doctrineBonus`; the `w_k` are response curves: gold weight rises as `gold / income` falls, manpower weight rises at war or with a `warPlan`, stability weight rises as stability goes below 0, science weight rises in peace. Switch only when `score(new) >= 1.2 * score(current)` (a 20% dwell margin) and the cooldown has passed. Doctrine becomes the prior (a bonus), not the whole answer | `aiEconomy.js:140-155`, `279-296` | about 10 categories x 4 tiers, once per think (5 turns) | **V** Dave Mark, weighted considerations with response curves (section 2 row 5); the dwell margin **U** |
| 26 | A raid goes when its score is 6 or more and a roll passes; it ignores what the raid party costs if it loses | **Expected value of a raid.** `EV = p * loot * (1 + grudge / 50) * era - (1 - p) * partyValue - recover * incomePerTurn`, with `p` from `lanchester.js` for party vs defenders, and the existing distance penalty. Go when `EV > 0`; pick the target by the top-band seeded pick (rows 5, 6); keep the cooldown and `RAID_CHANCE` as the nation's personality (band width) | `data/independents.js:164-185`; `raids.js` scan | O(targets in RAID_KM) per think, `p` is O(1) | **V** Lanchester odds and EV (section 2 row 2) |
| 27 | An independent picks raid or tribute by rule (grudge, 1.5x strength); it never compares them | **Stationary versus roving bandit.** Tribute per turn `T` beats raiding when `T * expectedTurns >= raid_loot_rate * (1 - p_loss)`; the victim pays when `T <=` its expected raid loss per turn. Set `T` at the midpoint of the two (the Nash split of row 18). A raiders-type independent with a low `T` stays roving; a fortress or tribal one with steady targets goes stationary | `raids.js` think order 3 and 4; `tributePricing.js` | O(1) per target | **V** Olson, stationary bandit (tax instead of plunder): https://en.wikipedia.org/wiki/Stationary_bandit_theory ; the split **V** row 18 |
| 28 | An independent joins a major on a threshold (opinion 80 for 20 turns, or army 5x and opinion 40) | **Bandwagon utility.** `u_join = curve(security gain) * curve(opinion) * curve(trade) - curve(autonomy)`, where `security gain = nearest threat strength * major's army near / (major + threat)`. A weak, threatened independent joins the strong neighbour; a safe one stays free. Keep the 20-turn dwell as hysteresis so it does not flip | `indepPolicy.js` joining check; `data/independents.js:299-304` | O(majors in JOIN_KM) per think | **V** Walt: https://en.wikipedia.org/wiki/Balance_of_threat (the bandwagon detail itself **U**) |
| 29 | Razing and mercenary hiring are flat rules (size 2 or less with a crowding city; hire at 2x price in gold at war) | **Razing**: raze when `value(city) < crowdPenalty`, with `value` = site V (row 20) + building tier + port and `crowdPenalty` = overlap with my own disks * upkeep. **Mercenaries**: hire when `(p(win with band) - p(win without)) * war prize` exceeds the band price plus upkeep over the contract, via `lanchester.js` | `razing.js:142-152`; `mercenaries.js` AI hire | O(1) each | Reuses rows 20 and 26 (**V** as above) |

### Not worth it (cost more than they give)
- Full Rubinstein with several rounds and offers in the game loop: the closed form in row 19 gives the same answer in O(1).
- Shapley beyond 3 or 4 players: the sum is over all orderings; cap alliances at 2 or 3 per nation.
- Solving laws as a planning problem (GOAP, MCTS): the weighted sum in row 25 runs once per think and is enough.
- A PID loop on gold: Miller-Orr (row 22) has two numbers and no tuning.

### Build order for rows 14 to 29
1. **Rows 20 and 21** (site value with rings and overlap, race term). The biggest gap in play (cities placed badly or late); `balance-sim` shows it as land share and city count by turn 100.
2. **Rows 22, 24, 23** (Miller-Orr reserve, rush by price per turn saved, payback loans). Local to `aiEconomy.js`; watch AI gold piles (the 150-gold claim trap in the `aiEconomy.js` comment) and war counts.
3. **Rows 19 and 18** (peace asks the reservation value, tribute by Nash split). One shared helper for the split; keep the acceptance ledger as is. Check with `balance-sim`: wars ending, vassals made, tribute paid.
4. **Rows 26, 27, 29** (raid EV, bandit choice, raze and hire by EV). They reuse `lanchester.js`; compare raids per game and independents surviving.
5. **Rows 14, 15, 16** (AI-to-AI trade, open borders with utility). Adds income to AI nations, so run the world balance compare for runaway nations.
6. **Rows 25 and 28** (laws and government weights, joining by utility).
7. **Row 17 last** (alliances and marriages for the AI). It is a new system: use the `add-mechanic` skill, and give it an AE and call-to-arms cost so alliances do not snowball. Rows 17 and 28 share the Walt threat score, so build that helper once.

Each step changes balance: use `add-mechanic` before editing a macro rule and `balance-sim` for the before and after.
Determinism: every pick above uses `hashRoll` or the seeded RNG; cube roots and square roots are integer
Newton; the variance EMA and the patience factors use Q8 integers.
