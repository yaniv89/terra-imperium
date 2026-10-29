ponytail loaded in full at the start of the session (Skill `ponytail`; the session start hook also printed PONYTAIL MODE ACTIVE).

# Lane pacing-8: report

Branch `claude/pacing-8` (from `claude/integration` 039d3c18). Local session, no API use.
Source: round 3b Opus playtests civ-veteran 40746164607, warmonger 40746170250 (build a0312e08).

## For the lead

**Open: the event card rule (manual playtest item 1), measured, not built.** See "Event cards" below; the prototype patch is
`pacing-8-event-gap.patch` in the shared notes folder. One question: build it with the dawn card first in each age (the fix for the one
side effect found)? 

## Design calls answered 29 Oct (built)

Q1: A and B built (commit b463ff9b). Q2: built (commit 8918657b). Evidence under "Round 2" below.

### The questions as asked

**Q1. Late game (finding 1).** Evidence, storyPulse on base, Normal speed, seed 11, whole game (923 turns):

| age | turns | event cards | cards a turn | crisis cards | raid cards | era goals met |
|---|---|---|---|---|---|---|
| stone | 26 | 11 | 0.42 | 0 | 0 | 0 |
| bronze | 36 | 10 | 0.28 | 0 | 0 | 0 |
| classical | 92 | 32 | 0.35 | 1 | 3 | 0 |
| kingdoms | 145 | 46 | 0.32 | 1 | 9 | 1 |
| gunpowder | 136 | 44 | 0.32 | 1 | 4 | 0 |
| modern | 109 | 26 | 0.24 | 0 | 0 | 2 |
| information | 148 | 31 | 0.21 | 0 | 0 | 1 |
| future | 230 | 38 | 0.17 | 0 | 0 | 1 |

The last three ages are 53% of the game's turns and have the fewest cards, no crisis and no raid reaching the player.
How others keep the late game busy: Civ VII ends every age with a crisis in its last third and gives milestone goals (legacy paths)
all age long; Civ VI adds emergencies and competitions; Old World chains ambitions (a new one when one is met); EU4 has mission
trees and great-power rivalry. Proposal, two small changes (pick one or both):
- **A. Chained era goals (Old World ambitions).** In modern, information and future ages, a met era goal opens a fresh card to
  pick the next goal (the next unmet playstyle, target from src/data/eraGoals.js), up to 3 an age. eraGoals.js plus the dawn card
  path in eventDeck.js. Proof: storyPulse `goals` and cards a turn in late ages, before vs after.
- **B. A late-age crisis per age (Civ VII).** world_war, global_pandemic and climate_shock exist but never reached the player in
  this run (hit=0). Let the late crises pick the player's nation when it qualifies, once per age, in the age's last third
  (crises.js trigger only, data rows unchanged). Proof: storyPulse `hit` and `crisisCard` in late ages.

**Q2. Early war price (finding 2).** `declareWarUnjustified` is a flat 300 gold in every age (src/data/actionCosts.js).
New sim `.claude/skills/balance-sim/warPrice.sim.js` (scripted player, seeds 11 and 12, Normal):

| turn | age | gold | net a turn | 300 gold = turns of income | majors with a casus belli |
|---|---|---|---|---|---|
| 20 | stone | 493 to 623 | 8 to 9 | 34 to 38 | 0 to 1 |
| 40 | bronze | 557 to 829 | 18 to 19 | 16 to 17 | 0 to 1 |
| 80 | classical | 1,492 to 1,569 | 60 to 65 | 5 | 0 |
| 160 | kingdoms | 7,083 to 8,022 | 101 to 165 | 2 to 3 | 4 to 5 |

Early it costs a month of income and there is rarely a casus belli; from Kingdoms on it is pocket change. Proposal: scale it by the
payer's age through the existing `unitCostMult` (ages.js): 150 x unitCostMult (stone and bronze 150, classical 240, kingdoms 330,
future 690), so early war is about half the price and late war keeps a bite. One line in actionCosts.js plus the three readers
(gameReducer DECLARE_WAR, NationCard, RegionInfoModal, warActions.js) through one helper. Yes or no?

## Findings

| # | Finding | Checked on current integration | Root cause | Fix | Evidence |
|---|---|---|---|---|---|
| 1 | Late game is End Turn plus cards | Reproduced (table above) | Late ages have the fewest cards and no crisis or raid for the player | Built after Q1: A and B (Round 2) | storyPulse table above |
| 2a | War costs 300 gold at +1 income | Reproduced: 34 to 38 turns of income in Stone age | Flat price in every age | Built after Q2: 150 x the payer age's unitCostMult (costs.js warCost) | warPrice.sim.js table above |
| 2b | After a loss the advisor picked a 24-turn archer (539 gold at +17) | Reproduced in code: the advisor took chooseProduction's pick whatever its turns | productionAdvisor.js never read the build time | A pick past the long-build line (`isLongBuild`, about 20 turns at Normal, the same line as the city's slow-build warning) gives way to the first quick fallback item, a unit first when the pick was a unit; if nothing is quick the pick stays (and the city's warning shows) | New `productionAdvisor.slow.test.js`: a wonder pick (past the line) gives way to a quick item |
| 3 | New cities are Outposts for up to 29 turns with no warning | The site card already says "Starts as an outpost ... about N turns" (st.outpost), but the founding log, the city list and the city card did not | Turns shown only on the site card and inside the city sheet | Founding log (player and settler arrival): "X is founded as an outpost: it works no land and builds nothing until it becomes a city in about N turns."; city list row: "Growing into a city in N t"; the city card button: "Open the outpost: a city in N turns" (en and he) | Shots `2a-city-list`, `2b-outpost-card` (844x390 and 1600x900, en and he). 29 turns is a desert or mountain outpost at Normal (terrain factor 0.4); open land is about 12 |
| 4a | Buy prices jumped with no reason (Frigate 1,122 then 929) | Already explained: the offer says the price per point and "The price is up N% for this city's recent purchases; it falls back as turns pass" (cy.rush.heat), and the playtester wrote at 272 "The confirm explains the price clearly" | Progress made and rush heat cooling | None needed | cityBuildModel.js rushText |
| 4b | Bank 2,324 against +303 income | Already fixed by r3-campaign: an out-of-reach Buy is greyed and shows its turns of income ("2324 · 8t") | Building rush price is its gold-table price by design (lead's call 28 Oct) | None | r3-campaign-REPORT row 3 |
| 4c | Harbor at 149/144 still said 6 turns | Reproduced: a queued order paid in full shows the turns of the builds ahead of it | Turns count everything ahead in the queue (correct), the row did not say it was paid | The row says "paid: done in N turns behind the builds ahead, next turn if moved first" | Shot `1b-queue-open` (Storage Pits 999/40) |
| 5a | Queue dropdown opened empty | Reproduced on base at 844x390 and 1600x900, en and he: after scrolling the build list, the toggle flips but the list opens above the view (a tap at its first row hits the bar or other rows) | The list renders at the top of the scroll, under the pinned bar | Opening the list scrolls it under the pinned bar (`scrollIntoView` with a scroll margin) | `pacing8-shots.mjs`: "queue list in view after the toggle" false on base in all 4, true after in all 4; shots `before/` and `after/1b-queue-open` |
| 5b | Idle-city prompts repeat every turn until Always is found | Reproduced in code: the dock's Always skipped outposts, so every outpost that grew into a city asked again | Outposts filtered out of Always | Always now sets the standing order on outposts too (a grown outpost keeps it; foundOutpost already copies it to new cities); after one tap on Advisor builds, Always turns primary so the player sees it | TurnDock.jsx |

## Tests and checks
- `npm run lint`-equivalent eslint on every changed file: 0 warnings.
- Targeted: src/i18n/ (all), productionAdvisor (+ new slow test), cityRailModel, settlers: 13 files, 146 tests passed.
  faNumSentence failed once under the shared-machine load and passed alone.
- Shots: `node scripts/ui/pacing8-shots.mjs --tag after` (dev server on 5287), 844x390 touch and 1600x900, en and he, in
  `plans/lanes/pacing-8-shots/{before,after}/`.
- Not run: the full suite (shared PC), engine-rules-reviewer (the lead runs it before the merge; engine diffs are productionAdvisor.js,
  the two founding log lines in gameReducer.js and settlers.js).

## Round 2 (lead's message of 29 Oct: Q1, Q2 and the manual playtest of af3ee70e)

### Q2 built: war price by age (commit 8918657b)
`declareWarUnjustified` is 150 gold x the payer age's `unitCostMult`, read through `warCost` (src/utils/costs.js) by the reducer,
NationCard, RegionInfoModal and warActions. warPrice.sim.js, seeds 11 and 12, Normal:

| turn | age | price before | turns of income before | price after | turns of income after |
|---|---|---|---|---|---|
| 20 | stone | 300 | 34 to 38 | 150 | 17 to 19 |
| 40 | bronze | 300 | 16 to 17 | 150 | 8 to 9 |
| 80 | classical | 300 | 5 | 240 | 4 |
| 160 | kingdoms | 300 | 2 to 3 | 330 | 2 to 4 |

Test: `src/utils/costs.warCost.test.js`. The era-save builder now keeps 700 gold in reserve (the Future price is 690).

### Q1 built: A chained era goals, B late crisis (commit b463ff9b)
- A (eraGoals.js `canRefocus`, eventDeck.js `eraDawnCard`): from the Modern age, once the focus goal is met, an `era_next` card offers
  the open goals again, up to 3 picks an age (`picks` on the age's record; Hebrew title and text added). Test: eraGoals.chain.test.js.
- B (crises.js `lateCrisisDue`): from the Modern age, once an age, when the player has two thirds of its age's techs, a crisis whose
  age window and conditions fit the player picks it without the chance roll. Gaps, cooldowns and minHit still hold; crises off and
  explore mode stop it (crisesOn). The player is put second in the hit list, so a war crisis only makes it the target (strike code:
  hit[0] against hit[1]). Memory: `state.crises.playerPick`. Tests: two new cases in crises.test.js.
- storyPulse, Fast, seeds 11 and 12, late ages (before, then after):

| seed, age | turns | cards | crisis cards | crises on the player | goals met |
|---|---|---|---|---|---|
| 11 modern | 28 | 15, then 15 | 0, then 0 | 0, then 0 | 1, then 1 |
| 11 information | 69 | 20, then 21 | 0, then 1 | 0, then 1 | 0, then 0 |
| 11 future | 27 | 6, then 6 | 0, then 0 | 0, then 0 | 0, then 0 |
| 12 modern (game ends turn 257) | 35 | 15, then 15 | 0, then 0 | 0, then 0 | 0, then 0 |

  Honest reading: B works (the Information age crisis now reaches the player). A rarely fires: the scripted player always picks
  Expand and late Expand targets are 28 to 33 cities, so the focus is almost never met; it fires for a player who picks a reachable
  goal. A Normal-speed seed 11 run (late ages 487 turns) is below if it finished. `endgameReachability.test.js`: 4 of 4 pass.

### Manual playtest quick bugs (commit 8797aa64)

| Bug | Checked on current code | Root cause | Fix | Evidence |
|---|---|---|---|---|
| Coal Plant in the Stone build list | Reproduced | Every category's next tier was listed, locked, at any age | Build list hides tiers more than one age ahead (cityBuildModel.js) | New cityBuildModel test; fails without the fix (energy listed) |
| Market "about 108 turns of research" in the Stone Age | Reproduced (Market is a Classical tier) | Same | Same | Same test |
| One "Train Settlers" tap queued 2 | Not reproduced | The next-step button dispatches one QUEUE_PRODUCTION, which adds one order; nextStepModel.test.js already checks a tap queues once | None | Lead: if you have the step or shot, I will look again (a city on Always with an empty queue gets the advisor's settler on the next turn too, which may look like a double) |
| Year went backwards (T25 1253 BCE, T26 1283 BCE) | Mechanism reproduced: the share of a tech under way was taken of its full price, so any rise in that price (a research-cost modifier ending, a new city, diffusion) moved the label back. Scripted runs (Fast and Normal, 2 seeds, 120 turns) showed no drop, so the playtest's trigger was likely an event modifier | displayYear read `getResearchCost` with modifiers | The label reads a steady price (`getResearchCost(..., steady)`: no modifiers, no diffusion) | displayYear.steady.test.js: a +30% research cost moved the label from -1460 to -1474 before, not at all after |
| Event card dates centuries off ("450 BCE" card in 39 CE) | Reproduced in code: story cards showed their historical year | Story cards come by age progress, not by year | The card shows the game's year (EventModal `year`) | App.jsx passes state.year |
| Advisor queued the Great Wall in Greece | Reproduced in code: chooseProduction may pick a wonder | The advisor took any pick | The advisor never picks a wonder for the player (a wonder is the player's own call) | productionAdvisor.slow.test.js (a wonder pick gives way) |

### Event cards: a card almost every turn, repeats (measured, not built)
storyPulse now counts `rep` (a card already shown this age) and `forced` (no option could be paid; the harness used to clear these and
the story came back next turn, which inflated repeats to 35 an age; fixed). Prototype rule: (1) a due story waits out the gap after any
card and leaves a 2-turn gap; (2) a drawn card comes at most once per player age. Fast, seeds 11 and 12 (sum), cards a turn:

| age | before | after |
|---|---|---|
| stone | 16 / 22 = 0.73 | 10 / 22 = 0.45 |
| bronze | 17 / 35 = 0.49 | 15 / 38 = 0.39 |
| classical | 42 / 100 = 0.42 | 35 / 88 = 0.40 |
| kingdoms | 42 / 117 = 0.36 (7 repeats) | 51 / 148 = 0.34 (3 repeats) |
| gunpowder | 58 / 172 = 0.34 (3 repeats) | 51 / 148 = 0.34 (0 repeats) |
| modern | 30 / 63 = 0.48 | 23 / 58 = 0.40 |

Side effect: in both seeds the Stone dawn card (era goal focus) was pushed out of the Stone Age by stories (focus `stone:-`). If you
say yes, I build it with the dawn card ahead of stories, and rerun this table.

### Ages on Fast (worldStats, seeds 11 and 12)

| | halfIn_bronze | halfIn_classical | halfIn_kingdoms | halfIn_gunpowder | halfIn_modern |
|---|---|---|---|---|---|
| Fast | 29 to 31 | 56 to 60 | 97 | 134 to 135 | 191 to 194 |
| Normal | 59 | 120 to 122 | 188 to 193 | 271 to 274 | 395 |
| ratio | 0.51 | 0.48 | 0.51 | 0.49 | 0.49 |

The turn-limit ratio is 440 / 923 = 0.48, so U96 scaling holds. The player's Stone Age is 11 turns on Fast and 26 on Normal (storyPulse).
The unreachable goal is the target, not the speed: the scripted player meets 0 Stone and 0 Bronze goals on Normal too (Expand 4 cities,
Science 7 boosts in 26 turns). Suggest a balance lane on the Stone and Bronze goal targets (src/data/eraGoals.js), not on ages.
