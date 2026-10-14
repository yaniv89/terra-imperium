# CB04 campaign economy and pacing: the speed study and what changed

Lane CB04 (items I017 to I035; I031, I032 done by the city economy lane). Branch
`claude/pa-w3-economy-pacing`. Q9 (conflicts section 9): Marathon follows Civilization's
game-speed cost logic; every cost and wait scales by the speed multiplier, not a separate rule.

## 1. How Civilization scales game speed (the short study)

- One percentage per speed, applied to every cost category: Civ VI Online 50, Quick 67, Standard
  100, Epic 150, Marathon 300 for production, research, civics, growth, gold purchases, great
  people points and timed effects. Yields per turn are never scaled; unit movement is never scaled.
- Civ IV and Civ V keep separate columns per category in the speed table (GameSpeedInfos):
  Marathon has ConstructPercent and ResearchPercent 300 but TrainPercent 200, and growth 300.
  Reason: armies cross the same distance per turn at every speed, so a war on a slow speed is
  over sooner relative to how long a unit takes to train. Epic keeps 150 for all.
- Era cost: unit and building costs rise with the era (Civ VI purchase cost is a fixed multiple
  of the production cost, so it rises with it); a gold price is always derived from the
  production cost of the thing bought, not from the treasury.
- Gold purchase: Civ VI charges about 4 gold per point of production (more for some classes),
  Civ V about 2 to 3 plus an exponent, Civ IV hurry is 3 gold per point and doubles with no
  progress. A purchase completes at the start of the next turn.

## 2. What we follow

| Rule | Ours | Where |
|---|---|---|
| One speed multiplier for research, buildings, growth, waits | `speedCostMult` = reference years / years a turn (Normal 1.6 to 2, Marathon 2 to 4 in the old reference units) | src/data/ages.js |
| Training column (Civ IV/V TrainPercent) | units, settlers and army orders: Normal's multiplier plus half of any extra (`speedTrainMult`, `TRAIN_SPEED_SHARE` 0.5). Marathon Bronze 2.8 instead of 4.0 | ages.js, cities.js productionCost |
| Waits | `speedTurns(refTurns)` (already in place: truces, cooldowns, rush heat) | ages.js |
| Movement | not scaled (km a turn) | armies.js |
| Gold purchase | 4 gold a missing point of production, settlers 1.5x, up to 2x for a city that rushed often; a production cost already carries the speed and era multipliers, so the price follows both | src/engine/spending.js |
| Gold actions with a flat price | Infrastructure, Defenses, Invest in growth: base x (1 + 0.6 x age index) x speedCostMult x (1 + 0.25 x level) | spending.js scaledGold |

Not changed and left for a decision: the other flat gold prices in actionCosts.js (diplomacy,
missiles, generals, Fund Scholars) still ignore age and speed.

## 3. Numbers (scripted player, peoples world, Australia, seeds 11 and 12, 250 turns)

See the lane report for the tables (base dbc96467 against the branch, runs one at a time on
the same machine). Gold left unspent was the problem: a peaceful player banked about 19,000 gold
by turn 250 at Normal. With rushing it keeps a few hundred and turns the rest into cities and
buildings.

## 4. Open findings handed on

- I035 (administrative pressure): the existing overextension and authority already tax wide
  empires; measure after rushing lands in real play before adding a capacity rule.
- I029, I030 (empty stretches, research outpacing the rest): not changed here; the rush and the
  scaled works add decisions in every turn of the early game. Needs the W00 action-gap metric.
- Logistics line with no engine effect, Library science counted twice (city lane findings): not
  in these rows, still open.
