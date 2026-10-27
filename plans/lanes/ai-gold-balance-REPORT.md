# AI gold balance (follow-ups 19 and 24) — lane report

Branch `claude/ai-gold-balance`, from `claude/integration` e961ec2d. AI decision code only: no rule,
cost or reward changed, nothing changed for the player.

## Method
balance-sim worldStats, standard peoples world, Normal speed, PLAYER akkad, passive policy,
300 turns, seeds 11 to 18, paired by seed (pairedCompare.mjs, 95% t interval, `*` = interval
excludes 0). Three sides:
- **pre**: 43b5e671, the commit before "Merge era goals" (f87356a6)
- **HEAD**: claude/integration e961ec2d
- **branch**: this lane

AI gold = the treasury of the living AI majors (no independents, free cities, rebels or player).
New harness keys in worldStats.sim.js: `aiMajGoldMean`, `aiMajGoldMedian`, `aiMajGoldMax`,
`aiMajUnitsMean`, `aiMajBuildingsMean`.

## 1. The gap (pre vs HEAD)
| turn 300, mean of 8 | pre | HEAD | diff (95% CI) |
|---|---|---|---|
| AI gold mean | 6,511 | 10,624 | +4,113 [2,826, 5,400] * |
| AI gold median | 1,090 | 1,189 | +100 [-662, 861] |
| AI gold max (richest major) | 58,639 | 78,485 | +19,846 * |
| AI land units mean | 29.9 | 31.1 | +1.3 |
| AI buildings mean | 229.4 | 250.7 | +21.4 * |
| wars total | 19.5 | 21.1 | +1.6 |
| major cities | 761 | 833 | +71 * |

The mean rose by 63% at turn 300 (+62% at turn 100, +94% at 200, +87% at 250), more than the
30% in the handoff. The median hardly moved: the gold piles up in the richest majors. At turn 250
(seed 11), the 12 richest were all Tier 1 (they think every turn) and earned about 600 to 1,900
gold a turn. They held 6,000 to 33,000 gold. The rush buys only an order with more than 3 turns
left, in at most 4 cities, so most of that income had nothing to buy. (HEAD also has about 9%
more cities than pre, from other merges since the era goals.)

## 2. The change (src/engine/aiEconomy.js)
A surplus pass at the end of every AI think, `spendSurplus`:
- floor = max(`AI_SURPLUS_GOLD` 3,000, `AI_SURPLUS_INCOME_TURNS` 16 x net income a turn)
- gold above the floor rushes the orders the cities' own queues already chose, at the player's
  rush price (the same `tryRushProduction`, heat included), in up to `AI_SURPLUS_RUSHES` 6 more
  cities. Any order with more than `AI_SURPLUS_MIN_TURNS` 1 turn left qualifies. The pass never
  takes the treasury below the floor.
- It runs after the think's decision, including law and advisor thinks. It does not run on a
  stability emergency or a war chest think.
- `tryRushProduction` takes an `eligibleOnly` option for this pass: it picks the biggest city whose
  order is worth buying, so it does not stop at a city the normal rush already bought. The normal
  rush path behaves exactly as before.

It is deterministic (no rng, cities in index order). The cost per think is nothing when gold is at
or under the floor; otherwise it is at most 6 passes over the nation's own cities.

Tests (src/engine/spending.test.js): short orders get bought above the floor and the floor holds;
the pass moves on to other cities after the normal rush bought the biggest one (this test fails
without the `eligibleOnly` fix); at the floor it buys nothing new.

The engine-rules-reviewer agent found no rule violations. It found one real bug in the first
version: the pass stopped at the city the normal rush had just bought. That bug is fixed and has a
test.

## 3. Result
### HEAD vs branch (what this lane changes)
| metric | turn | HEAD | branch | diff (95% CI) |
|---|---|---|---|---|
| AI gold mean | 300 | 10,624 | 6,263 | -4,362 [-5,667, -3,057] * |
| AI gold mean | 250 | 6,559 | 5,073 | -1,486 [-2,123, -848] * |
| AI gold mean | 200 | 1,828 | 1,744 | -84 [-151, -17] * |
| AI gold median | 300 | 1,189 | 948 | -241 [-500, 19] |
| AI gold max | 300 | 78,485 | 37,580 | -40,905 * |
| gold Gini | 300 | 0.86 | 0.84 | -0.027 * |
| AI buildings mean | 300 | 250.7 | 254.1 | +3.4 * |
| AI land units mean | 300 | 31.1 | 31.3 | +0.2 |
| wars total | 300 | 21.1 | 19.9 | -1.3 [-4.1, 1.6] |
| wars active | 300 | 2.75 | 1.50 | -1.3 * |
| conquests | 300 | 0.13 | 0 | -0.13 |
| cities changed hands | 300 | 37.9 | 39.5 | +1.6 |
| captures | 300 | 18.4 | 18.9 | +0.5 |
| major cities | 300 | 833 | 835 | +2 |
| nations alive | 300 | 63.3 | 63.0 | -0.3 |
| player gold | 300 | 6,272 | 6,332 | +61 (not significant) |

Health: nonFinite 0 and auditViolations 0 at every checkpoint, on all three sides. All 8 runs are
still ACTIVE at turn 300. Up to turn 150 the branch matches HEAD exactly; the pass only acts once
a major has more than 3,000 gold. msPerTurn was not judged: the runs shared the CPU, and the
branch was not slower in any pairing.

### pre vs branch (the target: within about 10%)
| AI gold mean | pre | branch | diff (95% CI) |
|---|---|---|---|
| turn 300 | 6,511 | 6,263 | -249 [-1,269, 772], -4%, not significant |
| turn 250 | 3,499 | 5,073 | +1,575 * (HEAD was +3,060) |
| turn 200 | 942 | 1,744 | +802 * (HEAD was +886) |

At the end of the game, AI gold is back at its level before the era goals. Mid game (turns 200 to
250) stays above it. Turn 250 has half of HEAD's excess; turn 200 has about the same excess as
HEAD. At those turns the rich majors are still under a floor of 16 turns of income. A lower floor
cut turn 200 only a little and overshot the end of the game:

| floor (turns of income / minimum) | turn 200 | turn 250 | turn 300 |
|---|---|---|---|
| 12 / 2,000 | 1,548 | 4,130 | 4,355 (-33% vs pre *) |
| **16 / 3,000 (chosen)** | 1,744 | 5,073 | 6,263 (-4%) |

Part of the mid game gap is not the era goals. HEAD has about 13% more major cities than pre at
turn 200 (other merges), so it also has more income.

## 4. Proposal for the user (a rule change, not implemented)
To bring mid game AI gold down to the pre-era level as well, the lever is the era goals' gold
reward itself (src/data/eraGoals.js, `wealth`: +10% gold, +5% per age step, on
`national.goldMult`). It pays the player and the AI alike. Options:
1. Leave it as is (recommended). With this lane, end of game gold matches pre, and the extra mid
   game gold now turns into buildings (+3 a major at turn 300).
2. Halve the wealth reward's step (n0 10, step 2.5). This lowers both sides' mid game income. It
   needs an era goals recalibration run.
3. Make the gold reward a one-time payment instead of a timed multiplier. That is a bigger design
   change.

## Files
- src/engine/aiEconomy.js: `spendSurplus`, `aiSurplusFloor`, the AI_SURPLUS_* constants, and
  `tryRushProduction`'s `eligibleOnly` and `reserve` options.
- src/engine/spending.test.js: three tests.
- .claude/skills/balance-sim/worldStats.sim.js: the aiMaj* keys.

## Addendum: lead messages after the run (27 Oct)
The lead sent four messages after this lane's turn had ended:
- **The lead may approve rule changes.** I did not change any rule on that basis. It reached this
  session only as a message from another session, and CLAUDE.md still asks for the user's own yes
  on a rule change. The proposal in section 4 stays a proposal. Nothing in this lane needs it: the
  end of game target is met without a rule change.
- **Research and evidence for each design call.** The one call here is "buy what the cities
  already queued, at the player's own price, only from a surplus". It follows how Civilization V
  and VI let you buy production with gold, and it adds no new sink. The evidence is the paired
  8 seed tables above.
- **No API or workflow work was used or needed.**
- **Playtest run 40550092795, step 51: "no rush buy shown" with 11k gold.** I checked the shot
  (`plans/ai-output/human-playtest/shots/step-051.jpg` on branch
  `ai/human-playtest-40550092795`). The player's Civ-style buy already exists, and the shot
  shows it:
  - The coin button reading **546** beside the current order (Settlers, 31 turns) in the
    city's Build tab is the rush price. It comes from CityPanel.jsx `city-rush-open`, which uses
    spending.js `rushQuote`, the same price the AI pays.
  - At step 51 the player had **512 gold** (top bar), not 11k, so the button was greyed out
    (`opacity-60`, "Needs 546 gold").
  - The 22 turn Warband rows in the shot are build options, not queued orders. A queued row gets
    its own gold button (`queue-rush`).
  - The price path is `rushGold` in src/engine/spending.js: 4 gold a production point, x1.5 for
    settlers, +20% for each recent rush (heat, up to +100%, which cools over 5 reference turns).
    It is not in src/utils/costs.js.

  So the gap is that players do not find the buy, not that it is missing. It is a bare coin icon
  with a number, it appears only on an order already in the queue, and the build option rows
  show only turns. A UI lane could:
  1. label the button "Buy 546" (the i18n key `cy.rush.button` already exists);
  2. show "or buy now: N gold" on the military build option rows;
  3. add a hint when gold is over about 20 turns of income.

  None of this is in this lane's scope (engine AI only). It should be checked with mobile-check
  at 844x390.

## Addendum 2: the player's gold curve (lead message, civ-veteran run 40550085702)
Same runs, mean of 8 seeds, `playerGold` (passive harness player: it never builds, rushes or
upgrades, so this is the treasury of a player who spends nothing):

| side | T50 | T100 | T150 | T200 | T250 | T300 |
|---|---|---|---|---|---|---|
| pre era goals (43b5e671) | 1,073 | 1,888 | 2,789 | 3,886 | 5,152 | 6,377 |
| integration HEAD | 1,093 | 1,959 | 2,927 | 4,019 | 5,158 | 6,271 |
| this branch | 1,093 | 1,959 | 2,927 | 4,019 | 5,157 | 6,332 |

This lane does not touch the player (no significant difference at any checkpoint). The era goals
barely moved this curve either (+3% to +5% mid game). The player's pile in the playtests is a
player-side question: whether the buy option is easy to find (see Addendum 1), and maybe sinks that
scale. Any sink that scales (upkeep, prices) is a rule change. It needs the user's yes, and a
scripted-player balance-sim (`POLICY=scripted RUSH=1`) to measure it. That is a separate lane.
