ponytail loaded in full at the start of the session (Skill `ponytail`; the session start hook also printed PONYTAIL MODE ACTIVE).

# Lane early-pace-8: report

Branch `claude/early-pace-8` (from `claude/integration` 89133e2b, which includes the math report). Local session, no API use.
Unit U8 of plans/2026-10-29-1020-feat-every-area-to-8-plan.md; math report sections 3 (economy) and 6 (event cards).

## For the lead

**Q1. Benchmark prices for the player only, or for everyone?** Built: player only (`bench` in the city context,
cities.js `productionCost`). The AI keeps the flat prices (settlers 60 + 10 a city, improvements 10 a step).
Evidence, paired worldStats seeds 11-18, 150 turns, passive player, base 89133e2b:

| version | passive defeats (base 0/8) | cities | avg unrest | AI top-5 overextension | halfIn_classical |
|---|---|---|---|---|---|
| same prices for every nation, tiers 20/35/75 | 1/8 | +39 n.s. | +0.8* | +17 n.s. | not run |
| same prices for every nation, tiers 25/45/80 | 0/8 | +71* (+15%) | +1.2* | +28* | 121 to 109* |
| the above + Expand and Science goals eased | 2/8 | -0.5 | +1.1* | +7 n.s. | 121 to 106* |
| same prices for every nation, tiers 30/55/90, no goal change | 1/8 | +28 n.s. | +1.3* | +16 n.s. | 121 to 110* |
| **built: player-only prices, Science goals eased** | **0/8** | +2.8 n.s. | +0.2 n.s. | +2 n.s. | 121 to 118* |

Cheaper settlers for all majors fill the world about 15% faster and push the ages about 9% sooner (against U96's
schedule); a defenceless passive player then meets wars by turn 50 (base: none by 50 on any seed) and lost its only city
on 1 or 2 seeds. The player-only version leaves the AI world at base. Civ games give the AI its own cost table per difficulty, so
an asymmetric price is a known tool; if you want parity, the AI's expansion needs a separate brake first. Yes for player-only?

**Q2. First Warband stays 16 turns on Normal** (units were not in the brief's price list; unit costs are the AI's
combat balance too). Civ VI's first warrior is about 8 to 10. Price the player's Stone units in benchmark turns as well?

**Q3. AI majors meet the eased Stone Science goal 97% of the time** (35/36; base 55-60%). The goal reward is -10%
research cost for 50 turns; it moves halfIn_classical 3 turns sooner (starred). The player met no Stone or Bronze goal
before (scripted, 8 seeds); now meets Science in both ages on every seed. Accept, or make Stone goals scale with the
player's age length instead?

**Q4. endgameReachability "passive run ends on turnLimit"**: on base 89133e2b the passive seed-7 game ends in DEFEAT at
turn 83 (the test allows DEFEAT), so it was not a turnLimit run before this lane either. Head: DEFEAT at turn 97. With
universal prices the player survived and an AI met the Future goal at turn 883 (limit 923), so the test failed; that
version is not built.

Before the merge: run engine-rules-reviewer (engine diffs: cities.js, cityEconomy.js, resolveTurn.js ctx flag,
productionAdvisor.js, aiProduction.js pass-through, eventDeck.js, spending.js, gameReducer.js FUND_RESEARCH and the rush lock).

## Findings

| # | Item | Before | After | How | Evidence |
|---|---|---|---|---|---|
| 1 | First Settlers, Normal, a fresh size-2 capital (4 production) | 26 turns (8 of 8 seeds) | 11 turns (8 of 8) | ages.js `benchProduction` per age (4, 5, 8, 12, 16, 25, 35, 45); the player's settler = 6.5 benchmark turns at Normal + 10 a city, scaled by the speed table | earlyPace.sim.js seeds 11-18. Fast: 6 turns |
| 1b | First Storage Pits (a core Stone building) | 10 turns | 10 turns | building tiers unchanged (cutting them for everyone was part of the drift in Q1) | earlyPace.sim.js |
| 1c | A farm (basic improvement), Stone, benchmark city | 8 turns | 3 turns | 1.5 benchmark turns per step of the improvement's turns (player) | formula: 2 x 1.5 x 4/1.6 = 8 production x 1.6 / 4 |
| 1d | First Warband | 16 turns | 16 turns | not changed (Q2) | earlyPace.sim.js |
| 2a | Buy a later queued order | stored its progress behind the head | moves to the front, the rest keep their order; behind a head bought this turn, it goes second | gameReducer RUSH_PRODUCTION + moveQueueItem | cityBuildModel.test.js "buying a later order moves it to the front" |
| 2b | Paid head order | could be removed or reordered | locked this turn: no remove, nothing moves before it, shown with a lock and the reason "Paid in full: it is done next turn, so it cannot be removed or moved." | spending.js `paidHead`; reducer DEQUEUE and MOVE refuse; QUEUE front skips it | same test; shots `2-paid-locked-*` |
| 2c | Offer text | price only | price, "N gold left after"; unaffordable: "N gold short." plus the turns of income | cityBuildModel.js rushText | shots `1-buy-offer-*`; test "an unaffordable buy names the shortfall" |
| 2d | Second tap | always two taps | a buy at or below 25% of the treasury pays on the first tap; above it the offer asks again | `BUY_CONFIRM_SHARE`, row `rush.quick` | same test |
| 3a | Era goal chip | "Goal: 2/4 cities" | "Expand: 2/4 cities · +10% manpower" (goal, progress, reward), en and he | MapGoals.jsx, goals.chipNext | shots `0-goal-chip-*` |
| 3b | Stone and Bronze goals, scripted player, Normal | 0 met (best Stone 1-2/4 cities, 4/7 boosts; Bronze 3-4/8, 6-7/8) | Science met in Stone and Bronze on 8 of 8 seeds | Science targets Stone 7 to 4, Bronze 8 to 7 (Expand eased too at first: reverted, Q1 table) | eraGoals.sim.js PLAYERGOALS (new line), seeds 11-18 base, 11-14 and 11-12 head |
| 4a | Same card again | 14 reference turns (Normal 23) | 19 (Normal 31 to 38) | `EVENT_COOLDOWN_TURNS.template` | eventDeck.test.js "at Normal one card waits 30 turns..." |
| 4b | Same family | 5 (Normal 8) | 6.5 (Normal 11 to 13) | `.family` | same test; existing "no family repeats" test |
| 4c | Harsh cards (sick herds, plague, raiders, failed harvest, flood, harsh winter) | no spacing | 6 reference turns apart (Normal 10 to 12) | `HARSH_CARDS`, history key `h` | same test plays 300 turns |
| 4d | After a lost city | cards as usual | 2.5 reference turns (Normal 4) with no story or draw; links, raid answers and the dawn card still come | drawEvent counts the player's cities (`cities`, `quiet` in eventHistory) | test "a lost city buys quiet turns" |
| 4e | Empty pool | no filler existed | still none (now tested) | none | same test |
| 4f | Dawn card | exempt | still exempt | unchanged | existing pacing-8 test passes |
| 5 | Late gold | scripted player, seed 11: turn 200 27,060 gold against 131 a turn of expenses (206 turns), turn 300 41,319 against 466 (89 turns) | Fund research: 25% of the treasury buys science toward the current tech, b(x) = left x/(x + 4 left) (the report's diminishing returns; never the whole tech), once a turn | spending.js `fundQuote`, action FUND_RESEARCH, a button on the research card (en and he), log line | spending.test.js "fund research"; shots `3-research-fund-*` (258 gold for 14 science) |

Card gaps (storyPulse.sim.js `gaps` line, drawn cards only, Normal, 300 turns):

| run | fewest turns between one card | one family | two harsh cards | cards a turn (Stone, Bronze, Classical) |
|---|---|---|---|---|
| base seed 12 | 21 | 9 | not tracked | 0.32, 0.29, 0.33 |
| head seed 11 | 65 | 11 | 13 | 0.35, 0.44, 0.44 |
| head seed 12 | 9 (era chain card in the first metric) | 9 (same) | 12 | 0.33, 0.27, 0.32 |

The first metric counted the dawn and `era_next` cards (no family); base seed 11 and head seed 12 read 1 to 2 for that reason. Fixed, and rerun on head seed 11 only (shared machine). afterLoss (any card within 3 turns of a lost city) counts links and raid answers too, which the rule lets through.

## Tests and checks
- Targeted: `npm run test:related` on the engine files (first pass, 419 files): the real failures were the expected number changes, fixed;
  the battle sim, sight and edge-bundle failures were load-only and passed alone. After the final change:
  lateArrivalPace (lapita 75 to 68, from the eased Science goal), lateAgesAI, resolveTurn, eraGoals, eraGoals.chain, src/components/panels:
  147 passed; cities, spending, sayWhy, cityBuildModel: 51 passed; eventDeck (+2 tests), eventContext, data/eventDeck: passed.
- Lint: eslint `--no-ignore --max-warnings 0` on every changed file: clean (the worktree sits under .claude/, which eslint ignores by default).
- Shots: `node scripts/ui/earlypace8-shots.mjs` (own vite on 5293), 844x390 touch and 1600x900, en and he, in plans/lanes/early-pace-8-shots/.
- Harness: compare.sh ran every sim in the folder for each seed (about 9 minutes a seed, and warPrice.sim.js crashed on the shared `OUT`
  variable); it now runs `SIM` (default worldStats.sim.js). New sims: earlyPace.sim.js, endgame.sim.js; storyPulse prints card gaps;
  eraGoals prints the player's best progress per goal.

## Not done
- Full suite and engine-rules-reviewer (the lead runs them before the merge; shared machine).
- Q1 to Q3 wait on the lead.
