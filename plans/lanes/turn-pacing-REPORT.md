# Lane turn-pacing: report

Goal: every turn offers a meaningful next step and a newcomer knows what to do. Sources: playtest
SUMMARY.md (Fun 3.1, Glossary and help 3.5, issue 10, the newcomer note) and the lead's note on run
40550092795 (about 50 of 61 steps of a modern session were the per-city "Choose production" loop, about
five taps a city; the turn report cost a tap every turn).

## What changed

| Change | Research | Code |
|---|---|---|
| **Advisor builds**: beside End Turn's "Choose production", one tap queues the advisor's pick in every idle city | Civ VI marks a recommended item in its production list; Civ IV lets a city automate production. Same idea as the existing research advisor ("Let my advisor pick") | `src/engine/productionAdvisor.js` (the AI's own `chooseProduction` with the player's research, age, speed and laws; a fallback building or infantry so no city stays idle), action `ADVISOR_PRODUCTION` (gameReducer.js, queues through QUEUE_PRODUCTION, logged and replayable), `TurnDock.jsx`, `endTurnModel.js` (`idleCities`) |
| **Quieter turn report**: opens by itself only when something matters (a battle, raid, contact, city founded, taken or lost, a crisis or fight, a new age, or news naming the player or a player city). Other peoples' pacts and milestones no longer open it; the top bar's turn number still does | Civ VI and Old World show routine news in a log and only interrupt for events that concern you | `turnReportModel.js` (`matters` per item, `quiet`) |
| **Goal chip names the next goal**: "Goal: 3/4 cities" instead of "Goals 0/2" | Polytopia keeps its goals on one screen | `eraGoals.js` `nextGoal`, `MapGoals.jsx` |
| **Start tutorial**: three short cards (plus the band card for a band start) that point at what to tap, instead of seven cards about retired systems (ADM/DIP/MIL pools, province development) | Teach by doing: the guide prompts and End Turn's blockers carry the rest | `OnboardingOverlay.jsx`, `onb.*` keys (en, he) |

Not done: **issue 10 (virtue confirm and cost)** was already fixed on integration (RulerSheet.jsx `virtueConfirm`
shows the cost and what is left; locked tiers say why). No new resource or system was added.

## Evidence

Headless: `.claude/skills/balance-sim/turnPacing.sim.js`, akkad, standard world, Normal, seeds 11 to 14,
100 turns each (all reached turn 101). A scripted player answers blockers and events and fills idle cities
with ADVISOR_PRODUCTION.

| Seed | Report opens, old rule | new rule | Production prompts | taps per city (x5) | taps with advisor | Stale turns |
|---|---|---|---|---|---|---|
| 11 | 10 | 5 | 6 | 30 | 6 | 65 |
| 12 | 11 | 5 | 6 | 30 | 6 | 68 |
| 13 | 10 | 4 | 5 | 25 | 5 | 69 |
| 14 | 12 | 7 | 5 | 25 | 5 | 63 |
| **Sum** | **43** | **21 (-51%)** | 22 | 110 | 22 (-80%) | 265 of 400 |

- The advisor left no city idle on any turn (`cityLeftIdle` 0) and its picks are the AI's (the same picks the
  older scripted player made per city).
- The passive harness grows only to 2 or 3 cities, so production taps are small here; in the playtest's
  modern save with many cities the same rule turns about five taps a city into one tap a turn.
- "Stale turns" = no blocker and no chip that was not already there last turn: 66% of turns. No turn had an
  empty stack, because some chips never clear unless answered (ruler on 400 of 400 turns, governor 396,
  decrees 254, law and landmark about 296). The Goal chip now names a concrete next step on those turns.
- Unit tests: `productionAdvisor.test.js` (one action clears every city blocker, deterministic, one city
  only, nothing to do), `turnReportNews.test.js` (pacts stay quiet; news naming the player and crises
  open), `eraGoals.test.js` (`nextGoal`).

Browser (`node scripts/ui/turn-pacing-shots.mjs`, 844x390 and 1600x900, en and he; shots in
plans/ui/turn-pacing/): three idle cities, "Advisor builds (3)" sits beside "Choose production" without
overlap in both directions; one tap leaves 0 idle cities and End Turn reads "End Turn"; tutorial cards fit
at 844x390; no page errors.

## For the lead

- Follow-up worth a lane: the always-on soft chips (ruler, governor, decrees, law, landmark) show nearly
  every turn even after the player passed on them, so the stack never reads "nothing new". A "seen this
  turn" dismissal per chip, Civ VI style, would make new chips stand out.
- The advisor changes no AI rule and no balance: it reads aiProduction.js. One subtlety fixed: the AI's
  settler memo is keyed on the regions map, so the advisor reads a copy (the same state always gives the
  same picks, preview or action).

## Checks before the push

- engine-rules-reviewer: no rule broken. Fixed its three findings: the sound map lacked ADVISOR_PRODUCTION
  (worldSounds.test.js failed), a tap that queues nothing now says so, and the one-city path skips a city being razed.
- npm run lint clean; npm run test:quick 475 files passed (4042 tests); e2e/landscape.spec.js 4 of 4 passed
  (build:mobile run first: its web server needs more than the 120 s timeout to build on this machine).
- Shots kept in plans/ui/turn-pacing/: advisor-build phone en and he, after-advisor desktop en and he, the
  tutorial at 844x390 en and he.
