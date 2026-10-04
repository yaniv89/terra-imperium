# Math wave: `ai` (ideas 4, 6 and 7)

Branch `math/ai`, base `ee575e7`. Three changes to how the AI decides, none to how battles or wars
are resolved.

## 1. Lanchester battle estimate (idea 4, plans/math-ideas.md 2.1)

New `src/engine/lanchester.js`. From resolveBattle's own arguments it computes each side's
effectiveness (unit matchups incl. siege vs walls, terrain, walls and forts, river or ambush or
landing type, both ages), then the square law:

```
power = (effA x NA²) / (effB x NB²)
ratio = LANCHESTER_EDGE x power^SHARPNESS        pWin = ratio / (1 + ratio)
loss shares = LOSS_BASE / (1 + power^LOSS_EXP) and its mirror
```

**Calibration** (`src/engine/lanchester.calibration.test.js`; `CALIBRATE=1` refits and prints):
1,500 seeded fixtures (1 to 9 units a side, mixed and skewed rosters, depleted units, 7 terrains,
city assaults behind walls of level 1 to 8, forts, rivers, ambushes, age gaps) fought 48 times
each by the real resolveBattle. A free fit with separate exponents on effectiveness and numbers
landed on 4.5 and 9, exactly the square law's 1 : 2, so the model keeps that shape:
SHARPNESS 4.5, EDGE 0.94 (the defender holds undecided battles), LOSS_BASE 0.72, LOSS_EXP 1.25.

| Predictor | Brier | Mean abs. error | Right side of 50% |
|---|---|---|---|
| Lanchester estimate | **0.0129** | **0.050** | **95.9%** |
| Raw strength share (old out-of-sight dice) | 0.1013 | 0.294 | 89.7% |
| Old relief rule (raw x1.2) | | | 90.4% |
| Old assault rule (raw x0.8) | | | 82.3% |

Reliability is flat (predicted 0.15/0.25/0.45/0.75/0.86 vs observed 0.14/0.23/0.43/0.77/0.86).
Error by type: field 0.051, assault 0.047, river 0.044, ambush 0.063. Loss share error 0.084.

What the AI's attack rules do over the same fixtures:

| Rule | Battles fought | Won per battle | Expected wins passed up |
|---|---|---|---|
| Old relief (raw x1.2) | 608 | 0.92 | 124 |
| New relief (pWin >= 0.6) | 654 | 0.94 | 70 |
| Old assault (raw x0.8) | 920 | 0.73 | 17 |
| New assault (pWin >= 0.45) | 694 | 0.92 | 48 |

So the AI fights more of the reliefs it should and about a quarter fewer hopeless assaults
(lost assaults drop from about 250 to 56). Cost: 4.6 microseconds per estimate vs 10.6 ms for
the 200-sample Monte Carlo the player's odds sheet runs.

Determinism: exponents are quarters, built from products and `Math.sqrt` (`powQuarter`), never
`pow`, `exp` or `log`.

**Used in** `aiOperations.js`: sally (`SALLY_MIN_P` 0.6), relief (`RELIEF_MIN_P` 0.6, replaces
`RELIEF_RATIO`), assault (`ASSAULT_MIN_P` 0.45, or walls under `ASSAULT_HP`; a stack that holds
back keeps the siege on), landings (`LANDING_MIN_P` 0.5), and target scoring (below). The
legacy out-of-sight dice in `diplomacy.js` (`resolveWarProgress`, only for nations without an
economy, i.e. old fixtures; every real AI nation has one) use the square-law share instead of the
raw share (equal armies still 0.5). `RELIEF_RATIO` in threat.js is no longer read by the AI.

## 2. Utility scoring (idea 6, 3.1)

**aiProduction.js**: the fixed priority list is now a score per option, best wins:
- building lines: `doctrine (1 / (1 + 0.12 x rank)) x need x affordability`; need curves:
  food 1.5 when starving down to 0.8 at +4 surplus; defense 2 for a city touching an enemy, 1.3
  at war; military 1.3 at war or while fabricating a claim; economy 1.25 under 50 gold;
  affordability 1 up to 5 turns, 0.5 at 40.
- settler 2 (x0.5 at war), wonder 0.55 (x1.25 the doctrine's own), unit 0.45 in peace, 1.1
  while arming, 1.6 at war (same unit cap as before: armies come before the war, not after).
- Doctrine order still wins in peace (the existing template tests pass unchanged).

**Target choice**: `aiOperations.js` ranks the enemy cities next to a stack by
`dev x claim(3) x goal(2) x capital(1.5) x (0.1 + pWin)` instead of "former owner, then goal,
then weakest garrison". `aiLogic.js pickWarTarget` picks the neighbour with the best war value
(next section) instead of the weakest.

## 3. Bargaining model for war and peace (idea 7, 3.3)

New `src/engine/warOdds.js`:
- **Perceived army**: the other side's land units on tiles the AI sees (sight.js) count exactly;
  hidden ones are a guess off by up to `INTEL_ERROR` (35%) either way, from a report that
  changes every 10 turns (a hash, no rng). This is where believable mistakes come from.
- **War odds**: square law over whole armies (age and matchups included), each army split over
  the wars it fights, soft: `ratio = 0.85 x power`, `p = ratio / (1 + ratio)`.
- **Exposure / prize**: the development of cities touching the other side, in peace-cost units.
- **EV(war)** = `0.5 x (p x gain - (1 - p) x risk) - cost`; cost 4 divided by the doctrine x
  ruler temper (0.5 to 2). The war roll is unchanged (the world stays quiet); a nation that rolls
  attacks the neighbour with the best EV, or nobody if every EV <= 0.

**peace.js getPeaceAcceptance**: the "Military balance" line (±20 from a raw share) is now "Odds
if the war goes on" = `0.5 x (p x risk - (1 - p) x gain)` within ±30, with p as the RECIPIENT
sees the armies (so a hidden army is a bluff it can fall for). The other ledger lines and the
player's peace sheet are unchanged; the result also returns `odds`.

**diplomacy.js** (small change in a shared file): two AI nations below the 25-score peace
threshold sign a white peace when both would accept one (their estimates converged), checked
every 5 turns after 25 turns of war. With 10 turns this ended too many wars and cut Tier-1 rolls
(nations at war are Tier 1), dropping war counts by a third; 25 keeps them in range.

## Balance (compare.sh against ee575e7, 150 turns, PLAYER=au, same machine, same run)

| Seed | Wars base -> new | Conquests | Cities changed hands | Vassals | Avg unrest | ms/turn |
|---|---|---|---|---|---|---|
| 11 | 3 -> 3 | 0 -> 0 | 5 -> 10 | 1 -> 2 | 5.4 -> 3.6 | 269 -> 260 |
| 12 | 7 -> 7 | 1 -> 0 | 9 -> 11 | 1 -> 0 | 7.0 -> 6.5 | 282 -> 280 |
| 13 | 14 -> 9 | 1 -> 0 | 14 -> 9 | 1 -> 1 | 8.5 -> 8.5 | 267 -> 280 |
| 14 | 13 -> 12 | 1 -> 0 | 9 -> 8 | 2 -> 1 | 4.3 -> 5.3 | 332 -> 275 |

Totals: wars 37 -> 31, cities changed hands 37 -> 38, conquests 3 -> 0 (conquest counts are 0 or
1 per run, so this is within noise; the AI now waits for the walls before assaulting). nonFinite
and auditViolations 0 everywhere, maxProvinceShare 0.016 to 0.020 both sides, no runaway. Speed
is unchanged within the sandbox noise (mean 287 -> 274 ms). Seeds 11 and 12 (the brief's) keep
the same war counts; seed 13 is the only real drop.

## How it scales to more hexes

Nothing here walks tiles except `visibleTiles` (already cached per state, and only for a nation
that rolled a war or answers a peace offer). Per decision the cost is O(units of the two
nations) for the estimate and O(cities of the two nations x neighbours) for exposure, so it is
independent of the cell count; going from 56k to 100k cells changes nothing here. No ring counts,
kilometres or cell counts are assumed.

## Tests

- `lanchester.test.js` (formula edges), `lanchester.calibration.test.js` (160 fixtures x 24
  battles by default: Brier under 0.6x the raw share's, MAE under 0.12, decisions over 85%).
- `warOdds.test.js` (fog exact vs guessed, split armies, exposure, EV sign).
- `aiProduction.test.js` (starving -> food, threatened -> walls, at war -> units first).
- `aiLogic.test.js`: a weak nation that rolls declares no war; the coalition-truce test now
  gives the member an army that makes its war worth it.
- `peace.test.js` (a crushed recipient concedes more), `diplomacy.test.js` (converged peace).
- Full suite: 2,323 passed (the edge-engine bundle test timed out under load and passes alone).
  Lint clean.

## Open questions

- WAR_SHARPNESS, WAR_EDGE, DECISIVE and WAR_COST are not fitted: too few AI wars per run (3 to 14
  per 150 turns) to fit war outcomes. With sim-stats' paired intervals a longer run could.
- Promotions and generals are left out of the estimate (AI units rarely carry them).
- Fleet attacks still use `AI_FLEET_ATTACK_RATIO` in navalBattle.js (not my file).
- A fog-free variant of `warOdds` (viewer `null`) is ready for the player's diplomacy screen
  ("their odds as they see them") if the UI wants it.
