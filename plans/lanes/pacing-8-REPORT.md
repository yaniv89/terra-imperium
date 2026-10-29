ponytail loaded in full at the start of the session (Skill `ponytail`; the session start hook also printed PONYTAIL MODE ACTIVE).

# Lane pacing-8: report

Branch `claude/pacing-8` (from `claude/integration` 039d3c18). Local session, no API use.
Source: round 3b Opus playtests civ-veteran 40746164607, warmonger 40746170250 (build a0312e08).

## For the lead (two design calls, nothing built for them yet)

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
| 1 | Late game is End Turn plus cards | Reproduced (table above) | Late ages have the fewest cards and no crisis or raid for the player | **Not built: design call Q1** | storyPulse table above |
| 2a | War costs 300 gold at +1 income | Reproduced: 34 to 38 turns of income in Stone age | Flat price in every age | **Not built: design call Q2** | warPrice.sim.js table above |
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
