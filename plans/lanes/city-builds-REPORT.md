# Lane city-builds: report

ponytail loaded

Ponytail read in full at 04:26 UTC on 28 Oct (the skill was missing from this machine before; the first read was at about 20:35 UTC on 27 Oct).

## Problem (playtests 40550085702 and 40550092795)
Cities, builds and settlers scored 3 to 6 out of 10: builds of 18 to 51 turns, empty queues blocking End Turn every few turns, and the same pick every time.

Measured first, with a new headless count (`.claude/skills/balance-sim/cityBuilds.sim.js`, every major's cities sampled every 15 turns, grouped by the owner's age, the build list's own `buildQuote`). Base, seed 11, 600 turns (all 8 ages):

| Age | production | own-age building, median (p90) | infantry | settler |
|---|---|---|---|---|
| Stone | 6.6 | 8 (20) | 10 | 20 |
| Classical | 9.9 | 15 (90) | 11 | 32 |
| Kingdoms | 12.1 | 20 (100) | 13 | 38 |
| Gunpowder | 15.4 | 25 (126) | 15 | 47 |
| Modern | 21.7 | 26 (130) | 13 | 40 |
| Information | 30.4 | 33 (142) | 11 | 35 |
| Future | 43 | 37 (315) | 10 | 25 |

Cause: the building cost table rose about 1.7 times an age (30 to 1,100) while a city's production rose about 1.3 times an age.

## Changes (each with its reference)
1. **Production per citizen** (Humankind workers, EU4 development): `PRODUCTION_PER_SIZE = 0.5` (cities.js). Growing a city now pays in hammers too.
2. **Workshop line gives flat production** (Civ VI Workshop +2, Factory +3): Industry tiers add +2/+4/+6/+8/+10 (`local.flatProduction`, buildings.js) on top of their percentage. The build list's measured effect line (cityEffects.js) shows it with no extra code.
3. **Flatter production cost curve for buildings** (Civ VI: an Industrial building costs about 4 times an Ancient one): `BUILD_TIER_COST` [30, 55, 90, 130, 175, 225, 280, 340] through `getBuildingBuildCost`. The old gold table (`getBuildingTierCost`, the legacy buy path in gameReducer and aiEconomy) is untouched: gold sinks belong to ai-gold-balance.
4. **Gold stays neutral**: production also feeds gold income (development.js devFromYields). The new citizen and Workshop hammers are not taxed: cityYields returns `devProduction` (the land's part) and devFromYields reads it.
5. **Standing orders** (Civ IV repeat and automated production, Humankind repeat): `city.production.keep` = `repeat` (the last unit again, processCity) or `advisor` (the turn-pacing lane's advisor pick whenever the queue runs dry, `keepBuilding` in productionAdvisor.js, run right after the cities phase). Action `SET_PRODUCTION_KEEP`; a three-way control "When the queue runs dry: Ask me / Repeat unit / Advisor picks" under the city's queue bar (en and he). Off by default; old saves have no `keep` and behave as before.

Units keep their age and upgrade rules (a repeated unit is `classId` only, so it is built at the city's current age). Unit and settler costs are unchanged; they got faster only through production.

## Evidence
**Build times after** (same seed and run):

| Age | production | own-age building, median (p90) | infantry | settler |
|---|---|---|---|---|
| Stone | 8.3 | 7 (15) | 8 | 17 |
| Classical | 12.1 | 10 (28) | 9 | 27 |
| Kingdoms | 16.9 | 10 (32) | 9 | 27 |
| Gunpowder | 22.8 | 11 (40) | 10 | 31 |
| Modern | 36.6 | 9 (34) | 8 | 21 |
| Information | 51.2 | 8 (38) | 7 | 19 |
| Future | 58.4 | 9 (57) | 7 | 21 |

**Empty queue** (player city-turns that began with nothing to build, 300 turns, seeds 11 and 12): base 6 to 8%; after, with no order set, 8 to 9% (builds finish more often); with the advisor order on every city 0.8% (only a new city's first turn).

**balance-sim compare** (`compare.sh origin/claude/integration 250 11-16`, POLICY=scripted, 6 seeds; starred = 95% interval excludes 0):
- Production: aiCityProdMedian 12.9 to 18.6*, playerProdMean 7.7 to 11.8*.
- Growth: cities 748 to 807*, playerCities 5.7 to 13.3*, firstSettlerTurn 39 to 26*, firstBuildingTurn 109 to 63*, aiCapSizeMedian 9.2 to 10.0*.
- Runaway: maxProvinceShare down*, medianNationProvinces 6.5 to 9.3* (less snowball).
- War: warsTotal, conquests, warsOnPlayer, playerCitiesLost, capturesTotal: no significant change. sieges (active at turn 250) 1.2 to 0.3*. rebellionsOnPlayer 1.2 to 0*.
- Pace: the display year at turn 250 is 950 to 1225* (playerTechs +2.7*, medianAiTechs +7.8 not starred): more cities and earlier science buildings speed research a little.
- **Gold: aiGoldMean 7.4k to 17.4k*, playerGold 15.3k to 27.7k*** at turn 250 (at turn 100: +21% AI, not starred). Not from taxes (gold-neutral by design, item 4): AI rush buying is priced off production cost (aiEconomy.js tryRushProduction), so cheaper builds mean cheaper rushes and more hoarded gold, and there are more cities. This needs a sink from the ai-gold-balance lane.

**Browser**: the control at 844x390 and 1600x900, en and he: fits, Hebrew mirrors, tapping Advisor picks sets the order and fills the queue, no page errors.

**Tests**: src/engine/productionKeep.test.js (setKeep, the advisor order clears End Turn, repeat trains the same unit, a foreign city is refused). `npm run test:quick` after merging integration: 4,074 passed, 1 failed (worldSounds: the new action had no sound entry), fixed and that file rerun green; lint clean.

## Side effects to know
- The weekly challenge test played week 2026-W43 passively for 100 turns. Its one-city Elam is now conquered by Israel at turn 87 (on base Israel declared the same war and never attacked). A lost game cannot be submitted, so the test now uses 2026-W42 (W40, W41, W42 and W44 all survive). This is the AI actually fighting, which the playtests asked for, but a passive one-city start can now lose.
- First Stone Age city of size 2 makes 4 production: a settler still takes about 28 turns there. Not changed (Civ VI's first settler is 15 to 20 turns; the settler rule is shared with the AI's expansion balance).

## Not done
- No default standing order for new cities (each city is set once). Easy next step if playtests still show prompts.
- The playtests' "End Turn hidden under prompts" and "double close" are panel layout (phone-pass lane).
- Gold glut: reported above, not fixed here.
