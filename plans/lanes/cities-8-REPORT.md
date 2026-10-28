# Lane cities-8: report

ponytail read in full at 12:09 UTC, 28 Oct (whole SKILL.md printed with `cat`; the session start hook also printed "PONYTAIL MODE ACTIVE").
Branch `claude/cities-8` from `origin/claude/integration` cece290d, integration (with gold-sinks) merged before the final push. No API use.
Target: "Cities, builds, settlers" 8/10 (round 2: 5 Sonnet, 6 Opus).

## 1. Every round 2 complaint about cities, and where it stands
| Run, step, shot | Complaint | State |
|---|---|---|
| newcomer 40650969714, step 14 | Settlers 13 turns | balance, unchanged (Civ VI's first settler is 15 to 20 turns) |
| newcomer, step 122 | Spearmen 43 turns in a new city | **fixed here** (item 2.1) |
| newcomer, 87-88, 103 | queued units seem to vanish | fixed by newcomer-flow ("then Warband, +1 more") |
| newcomer, 14, shots/step-014 | build chips cut off | fixed by newcomer-flow (edge fade) |
| warmonger 40650973042, 14-15 | Choose production does nothing | fixed by newcomer-flow |
| warmonger, 66-67, shots/step-067 | build list shows one row, will not scroll | dock part by newcomer-flow; **list room doubled here** (2.4) |
| warmonger, 120-125, shots/step-122 | + hidden under banners | fixed by newcomer-flow |
| warmonger, 148-200 | production banner every turn | city-builds standing orders + newcomer-flow "Always" |
| warmonger, 98-120 | same unit 6 to 150 turns, no reason | slow-row reason by newcomer-flow; **new cities faster here** (2.1) |
| Sonnet civ veteran 40650976677, 14 | build list cramped | **here** (2.4) |
| Sonnet, 16-17, 54-55, 64-65 | closing the city screen needs two closes | **fixed here** (2.6) |
| Sonnet, 59-63 | Build Palisade jumps to the Build tab, wall not queued | **fixed here** (2.5) |
| Sonnet, 73 | no buy option found | newcomer-flow buy offer, gold-sinks Buy chip |
| Sonnet, 133-219; Opus 299-347 | Advisor builds, End Turn loop | standing order "Always" (earlier lanes) |
| Opus 40651416284, 185, 267 | locked items look buildable | fixed by newcomer-flow |
| Opus, 243-244 | rush did nothing | fixed by newcomer-flow |
| Opus, 264 | + under the bottom bar | fixed by newcomer-flow |
| Opus, 113 | toasts cover the list | not checked here |
| Opus, 383-385 | Idle never clears (stranded settlers) | fixed by newcomer-flow |
| brief | why build one thing over another | **here** (2.2) |
| brief | cities feel the same, growth invisible | **here** (2.3) |
| brief | where to found, what a site gives | already there: site rating, why, outlook warnings, claims, outpost turns (settleSiteModel.js); the advisor now names the best site (2.2) |

## 2. Changes
1. **Production floor** (cities.js `PRODUCTION_FLOOR = 3`): a city makes at least 3 x its age's `unitCostMult` (ages.js),
   x 0.75 in a siege, x a fire's cut. It is untaxed like the citizens' hammers (`devProduction` untouched, gold neutral).
   Unit prices rise 4.6 times over the ages; a new city's land does not. Reference: Civ VI's city centre minimum
   production; the game's own unit price curve. Glossary "Production" says it. Test in world/cities.test.js.
2. **The advisor says why** (cityCharacterModel.js `advisorWhy`): with nothing in production the queue bar reads the
   reason ("More cities, more of everything. Best site known: 330 km S."), and the advisor's row in the list is marked
   "Advisor's pick" with it. Buildings and improvements give their measured effect, units the army for the cities.
   Reference: Civ VI's recommended production item.
3. **City character and the next citizen**: the sheet header names what the city is known for: its highest building
   line (Breadbasket, Forge town, Seat of learning, Port...), else what its land yields most (Farming, Quarry, Trading,
   Fishing town); desktop adds "Known for Granary" / "its land: 13 food, 7 production, 8 gold". The Overview's size card
   adds "Next citizen: +2 food, +0.5 production, ..." measured through the same city model (cityEffects.js
   `nextCitizenEffect`). References: Civ VI and Humankind districts give each city a face; Polytopia shows what a
   level-up brings.
4. **Phone held sideways: the whole sheet scrolls** (ProvinceModal.jsx): the name and loyalty scroll away, the tabs and
   the Build tab's queue bar stay pinned; a new tab starts at the top. The standing-order row sits above the list while
   nothing is built, below it otherwise.
5. **Walls from the Defense tab are queued first** (`QUEUE_PRODUCTION` payload `front: true`, no progress lost) and the
   Build tab opens on them; only when the wall's tech is known (else the tab opens on its locked row as before).
6. **The city sheet's X goes back to the map**, not to the city card under it.
7. cityBuilds.sim reports `founded`, `bldDone` and `newInf` per age.

Users rule kept: cities build only the upgraded unit (no unit rules touched). No gold price changed.

## 3. Evidence
**cityBuilds.sim, 600 turns, seeds 11 and 12, scripted player** (newInf = turns for the age's infantry in a city of size 2 or less):
| age | newInf before (11 / 12) | after | median inf | founded before / after (seed 11) | bldDone before / after (seed 11) |
|---|---|---|---|---|---|
| stone | 8 / 7 | 8 / 7 | 8 | 96 / 95 | 0.44 / 0.44 |
| bronze | 7 / 7 | 7 / 7 | 6-7 | 166 / 168 | 0.79 / 0.78 |
| classical | 13 / 13 | 14 / 13 | 10 | 267 / 247 | 0.83 / 0.81 |
| kingdoms | 20 / 19 | 21 / 20 | 9 | 247 / 260 | 1.16 / 1.22 |
| gunpowder | 37 / 37 | **27 / 27** | 10 | 201 / 207 | 0.88 / 0.90 |
| modern | 50 / 50 | **27 / 27** | 8 | 54 / 56 | 0.88 / 0.92 |
| information | 45 / 42 | **27 / 27** | 6 | 32 / 42 | 1.02 / 1.06 |
| future | 41 / 56 | **27 / 27** | 6 | 11 / 16 | 1.26 / 1.21 |
City sizes per age unchanged (2, 2, 3-4, 5, 6-7, 9, 10, 11-13). Idle player city-turns (no standing order) 8-10% to 11-14%:
builds finish sooner; the standing order already takes that to about 0.1% (city-builds report).

**balance-sim compare** `compare.sh cece290d 250 11-16`, POLICY=scripted, paired, * = 95% interval excludes 0:
- playerCities 10.0 to 12.5*, playerProvinces 11.8 to 14.8*, landClaimedPct 51.4 to 52.2*, aiCityProdP10 5.0 to 6.7*,
  aiMajBuildingsMean 231 to 237*, battlesPerWar 5.3 to 6.4*, devastatedShare 0.008 to 0.012*.
- No significant change: aiGoldMean 9,380 to 9,402, playerGold 25.6k to 28.7k, AI units, warsTotal, conquests, captures,
  playerCitiesLost 2.8 to 1.7, runaway (maxProvinceShare, topNationProvinces), year, techs.

**Browser** (`node scripts/ui/cities8-shots.mjs --tag after --swgl`, before with the panel files stashed; plans/ui/cities-8/):
844x390 and 1600x900, en and he, no page errors. Build rows fully between the pinned bar and the screen bottom on a phone,
list scrolled: before 1, after 2 (en) / 3 (he); the list area goes from about 120 to about 240 px. Defense tab wall:
before, production stayed Settlers; after, the wall is current. Hebrew mirrors and reads in order. Worst shot:
`after/build-idle-phone-en.png` (one row while nothing is built: the standing-order row sits above the list then).

**engine-rules-reviewer**: no rule breaks. Its two design notes: a fire did not cut the floor (now it does); a city
under invasion keeps the full floor (only a siege cuts it), left as is.

**Tests**: cityCharacterModel.test.js (new), productionKeep.test.js (queue first), world/cities.test.js (floor). Full run below.

## 4. For the lead
- **Floor value** (design call): 3 gives 27 turns at Normal for a new city's regiment from the Gunpowder Age on (turns =
  81 / floor); 5 would give about 16, 6 about 13.5. 3 is what the compare above measured; a higher value needs its own
  compare (more AI production in its poorest cities).
- Not done: toasts over the build list (Opus 113); settler time in the first city (13 to 17 turns, shared with AI
  expansion balance); a map label for the city character.

## 5. Full test run
(filled in below after `npx vitest run` on the merged branch)
