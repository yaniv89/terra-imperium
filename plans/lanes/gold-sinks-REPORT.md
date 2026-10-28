# Gold sinks lane report

ponytail read in full at 2026-10-28 08:43 UTC.

Branch `claude/gold-sinks`, from `claude/integration` fad52830 with `claude/city-builds` d21803b2 merged in.
Target: "Economy and gold" 8/10 (round 2: 3 to 5). Civ-veteran run 40650976677 ended with about 36,000 gold
unspent and every gold event choice meaningless; newcomer run 40650969714: gold piles up with nothing to buy.

## 1. Research: how proven games give gold a use
From knowledge of the games (no web lookups in this lane).
- **Civilization VI.** Gold buys units, buildings and tiles at a fixed premium over production, and
  every unit and building has a gold maintenance that grows with its era (a unit's maintenance follows
  its production cost). Upgrading an old unit costs gold and raises its maintenance. The treasury stays
  a choice because the buy price is high and the upkeep grows with the empire.
- **Europa Universalis IV.** Army and navy maintenance are the largest standing costs and rise with
  military tech; a maintenance slider trades quality for gold; advisors draw salaries. Events price
  their gold options in "years of income" (`years_of_income` / `scaled_with` in the event files), so a
  card that costs a little early costs the same share late.
- **Humankind.** Money buys production (buyout) in any city, priced by the production still missing;
  there is no hoard tax: money is spent because the buyout is always on offer next to the build queue.

What this game already had (checked in code, not added here): rush buying in cities (spending.js,
4 gold a point, +20% heat per recent buy in that city), unit upgrades for gold on own land
(unitUpgrades.js), buying tiles, standing works, growth investment, gifts and tribute, AI surplus rushes
(aiEconomy.js spendSurplus). What it lacked, against the three games above:
1. upkeep that grows with age: every unit cost 5 gold a turn from the Stone Age to the Future;
2. event gold that scales: cards were written for a Stone Age income of about 40 a turn (-25 to -70);
3. a place in the "Advisor builds, End Turn" loop that offers the buy (the civ-veteran tester never
   found it: "The game may already have a buy or rush option the player never found").

## 2. What changed (the smallest set that fills those three gaps)
1. **Unit upkeep follows the unit's own age** (economy.js `unitUpkeepGold`): 5 gold x the age's
   `unitCostMult`, the curve unit production costs already follow (Stone and Bronze 5, Classical 8,
   Kingdoms 11, Gunpowder 14, Modern 17, Information 20, Future 23). Read by the forecast
   (`calcNationBalance`, so the top bar, the AI's settlement and the turn report agree), the player's
   charge in resolveTurn, march upkeep (routes.js `marchUpkeep` now takes a per-unit function), the AI war
   plan's affordable army (warPlans.js `armyCap`) and the AI budget's disband step (aiBudget.js). An old
   unit keeps its old upkeep until upgraded, which fits the user's rule (units keep their age and upgrade
   with gold on own land): an upgrade now costs its price and a higher upkeep. The army sheet's upgrade
   row says so ("upkeep 5 to 8g a turn", en and he).
2. **Building upkeep back to 1 gold x (tier + 1)** (actionCosts.js `BUILDING_UPKEEP_GOLD` 0.5 to 1). Its
   comment said it was halved "until a playtest calibrates it"; the round 2 playtests are that calibration.
   Player only, as before.
3. **Event gold in turns of income** (applyEventEffects.js `scaleEventGold`, EU4's years of income):
   every gold amount on a card, cost or gain, x max(1, gross gold income / 40), rounded to 5. 40 is the
   Stone Age income the cards were written for, so early cards are unchanged and a -60 card costs about a
   turn and a half of income at any point. The card (App.jsx), the payment and the crisis check read the
   same function. Shot: a five-city Classical realm sees -340 / +440 on a -40 / +50 card.
4. **A Buy chip on the dock** (endTurnModel.js `buyHint`, TurnDock.jsx): while the treasury holds more than
   10 turns of net income, the dock shows "Buy N" for the current order that saves the most turns per gold;
   one tap is one existing RUSH_PRODUCTION (heat included, so the next price rises and the chip moves on).
   It sits beside Advisor builds, in the exact loop the tester was stuck in. Not a blocker.
5. **Fix found by the engine-rules-reviewer:** a crisis answered early was checked for affordability on the
   turn's start state but paid from the end state; now it is checked again on the state it is paid from and
   the card reopens instead of the answer being dropped (CLAUDE.md lesson). Test in crises.test.js fails
   without the fix.

Not done (named so the lead can decide): AI building upkeep (AI majors hold about 250 buildings each; at
1 gold a tier that is far above most AI incomes, it needs its own calibration); decrees for gold, gold
gifts and Congress votes (exist or are out of this lane's scope); a gold-sink scripted policy that taps Buy
like the chip (RUSH=1 is the stand-in).

## 3. Evidence
balance-sim compare, standard peoples world, Normal speed, PLAYER akkad, 250 turns, seeds 11 to 16, paired
by seed; base 48a8250c (integration fad52830 + city-builds), `*` = 95% interval excludes 0. Harness keys
added: `playerGoldIncome`, `playerGoldExpenses`, `playerArmyUpkeep`. The harness quiets events
(proceduralEventCooldown, every story fired), so the event scale shows only in tests and shots.

### Player gold curve, mean of 6 seeds
| policy | side | T50 | T100 | T150 | T200 | T250 |
|---|---|---|---|---|---|---|
| scripted, never buys | base | 1,156 | 3,729 | 8,862 | 17,577 | 27,497 |
| scripted, never buys | upkeep by age only | 1,156 | 3,723 | 8,820 | 16,459 | 21,389 |
| scripted, never buys | this branch | 1,156 | 3,704 | 8,700 | 16,058 | 20,510 |
| scripted, buys (RUSH=1) | base | 427 | 449 | 487 | 527 | 594 |
| scripted, buys (RUSH=1) | this branch | 422 | 538 | 576 | 443 | 531 |
| passive (one city) | base | 1,072 | 1,968 | 2,963 | 4,286 | 5,531 |
| passive (one city) | this branch | 1,072 | 1,968 | 3,074 | 4,299 | 5,504 |

### Turn 250, paired
| metric | policy | base | branch | diff (95% CI) |
|---|---|---|---|---|
| playerGold | scripted | 27,497 | 20,511 | -6,987 [-12,950, -1,023] * |
| playerGoldExpenses | scripted | 81.8 | 156.8 | +75 [13, 137] * |
| playerArmyUpkeep | scripted | 69.2 | 127.7 | +58.5 * |
| playerTechs | scripted | 32.5 | 31.7 | -0.8 [-1.62, -0.04] * |
| playerCities | scripted | 10.0 | 9.3 | -0.7 (not significant) |
| playerGoldExpenses | buyer | 175 | 345 | +170 [77, 264] * |
| playerRushGold (total) | buyer | 33,786 | 26,264 | -7,521 (not significant) |
| playerCities / playerTechs | buyer | 16.0 / 34.2 | 17.2 / 34.5 | not significant |
| aiMajGoldMean | scripted | 9,433 | 6,824 | -2,609 [-3,410, -1,807] * |
| aiMajGoldMedian | scripted | 7,135 | 3,536 | -3,599 * |
| aiMajGoldMean | passive | 9,092 | 7,268 | -1,823 * |
| aiMajUnitsMean | all three | 26.5 / 26.3 / 25.6 | 26.8 / 26.0 / 26.3 | not significant |
| warsTotal | all three | 12.3 / 11.7 / 11.0 | 13.2 / 13.5 / 12.5 | not significant |
| majorCities | all three | 775 / 764 / 776 | 771 / 760 / 775 | not significant |

nonFinite and auditViolations are 0 on every run; all runs ACTIVE at turn 250. AI gold mean at turn 250
(6.8k to 7.3k) is close to the pre era goals level the ai-gold-balance lane aimed for (6.5k at turn 300).

### Reading it
- A player who buys is now short of gold: upkeep doubled (175 to 345 a turn) and the treasury sits at about
  500 while every surplus goes to buys. Spending is a choice between upkeep, upgrades and buys every turn.
- A player who never buys still saves, but 25% less (27.5k to 20.5k, starred), and from now on the dock
  offers the buy every turn the treasury passes 10 turns of income: the civ-veteran's 36k would have shown
  "Buy N" on every one of those turns. The per-turn sinks alone cannot reach a player who never spends;
  the chip is the lever for that player, and it uses the buy that already existed.
- Gold events now cost a share of income, so "gold is meaningless" choices stay choices.
- Cost: the scripted player researches 0.8 techs fewer by turn 250 (starred, small). Wars, AI armies and
  AI cities did not move.

## 4. UI check (mobile-check)
`node scripts/ui/gold-sinks-shots.mjs` (dev server on 5197), 844x390 and 1600x900, en and he: the upgrade
row's upkeep line, the dock with Buy beside Advisor builds and a blocker, and an event card with scaled gold.
No page errors, no raw placeholders, Hebrew mirrors, the crowded dock fits at 844x390. Shots in
plans/lanes/gold-sinks-shots/ (worst case: 844x390-he-dock-crowded.png).

## 5. Tests
Full `npx vitest run` after merging integration cece290d: 504 files, 4,722 tests passed (17 skipped). New: economy.test.js (upkeep by the unit's age), applyEventEffects.test.js (scale 1 early, payment equals the
card), endTurnModel.test.js (Buy chip and its reserve), crises.test.js (early choice re-checked at payment),
buildingUpkeep.test.js reads the constant. Engine-rules-reviewer: one finding (item 5), fixed; nothing else.

## 6. Questions for the lead
1. Building upkeep 1 is player only. AI parity would need a smaller AI rate (their surplus goes to rushes
   already, aiEconomy.js spendSurplus). Leave as is?
2. The Buy chip's reserve is 10 turns of net income (`BUY_HINT_INCOME_TURNS`). A newcomer playtest would
   show whether it should be 5 or 20.

## 7. Addendum (lead answers, 28 Oct 12:32)
- Lead: building upkeep stays player only; the Buy reserve stays at 10 turns until the round 3 newcomer
  playtest. Lane closed.
- Partial measurement of AI majors paying building upkeep at the player's rate (seeds 11 to 13, 250 turns,
  against this branch, stopped when the lane closed): AI gold mean fell about 40% more (6.8k to 3.9k and
  4.3k on seeds 11 and 12), but AI majors also ended with fewer cities (777 to 757, 801 to 787 major cities),
  fewer buildings (233 to 219, 229 to 221) and fewer wars. Not worth it without its own calibration.
- The late ages run (500 turns) was stopped unfinished when the lane closed. Upkeep by age and event gold by
  income both scale with the age and the income by construction (Future units cost 23 a turn; a card's gold is
  a share of income), but there are no late-age curves in this report.
- Opus playtest 40651416284 bug B1 (the rush button "did nothing" at step 244) is already fixed on integration
  by another lane: the buy offer now opens in the pinned queue bar (CityPanel.jsx).
