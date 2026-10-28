# Lane newcomer-flow: report

ponytail read in full at 08:43 UTC (28 Oct). Branch `claude/newcomer-flow` from `origin/claude/integration`. No API use.

Sources: newcomer-phone run 40650969714 (report, diary, shots on `ai/human-playtest-40650969714`) and civ-veteran run 40650976677 (step 23).

## The biggest finding: the live Stone Age start had no AI peoples

`reconcileTerritory` (src/engine/worldLifecycle.js) marks any landless major as eliminated and deletes its units. It runs in `gameReducer` after RESET_GAME and after any action that changes regions. In a band start (U23, the start screen's only start: `band: true`), no major holds land before its first village. So **every AI major died on RESET_GAME**, and again on the player's first FOUND_CITY. A browser check found 35 of 36 majors eliminated on turn 1, with all their units gone. This is what the civ-veteran saw as "0 MET" over "Kingdom of Israel (fallen)", and it explains part of "Wars and AI 2/10". The guided start (cities, no bands) was not hit. The newcomer met live peoples because they played that start.

- Fix: the shared rule. `reconcileTerritory` now spares a nation with a band, using the same `hasBand` rule as `elimination.js` (now exported).
- Test: `src/engine/bandStartSurvives.test.js` covers RESET_GAME and the first FOUND_CITY through the real reducer. It fails without the fix and passes with it.
- Balance sims were not affected: they call resolveTurn, not the reducer's RESET path. The live game now has the AI world that balance-sim assumed.
- `engine-rules-reviewer`: no rule violations. It confirmed `foundAiVillages` founds every AI village on turn 1 (seeds 5, 11, 23, 42; 12 turns). It also found an older crash: an unjustified DECLARE_WAR while the player is still a band read `homeRegion.unrest` of undefined (gameReducer.js). That is now guarded and tested.
- Still open from the review, not changed: `stateAudit` reports `missing_region` for band units before turn 1. The player's band already triggered it before this lane. An AI band that never finds a legal site now stays alive with no capital. No run showed that case.

## The seven items

1. **Nothing to do (Pacing).** New `src/components/ui/nextStepModel.js` and a brass "Next step" chip, first in the "needs you" column (NextPrompt.jsx). It shows after the guide and never blocks End Turn. The first step that applies:
   - send an idle scout exploring;
   - train Settlers (under 4 cities);
   - train Scouts (no major met);
   - train an army;
   - build a ship (coastal city);
   - talk to a people met in the last 10 turns;
   - take a known independent city within 900 km.

   One tap does it: it queues the item and opens the city's Build tab, sends the scout, opens that people's card, or opens the city. References: Civ VI's advisor, Polytopia's one clear move. Tests: nextStepModel.test.js walks settle, then army and the rest, one queue tap at a time, and checks that a queued step never comes back.
2. **Foreign unit tap.** The tile sheet's red "Declare war" button is gone. The sheet says whose army it is and offers "About them (opinion N)", which opens their card on Peoples, or an independent's sheet. War is only on the people's card, last in its grid, behind the existing confirm.
3. **Glossary.** Menu and Help open the glossary **index**: a search box, tabs for Game terms, Peoples, Technologies and Units, and the search also covers cities. Every entry has an "All entries" link back. 16 new game terms (gold, production, science, settlers, scouts, armies, battles, war, pacts, independents, ruler, decrees, governors, laws, ages, era goals) are written in English and Hebrew, checked against the engine rules (decrees come from deeds plus a trickle). Test in glossary.test.js.
4. **Governor and law prompts, Ruler virtue.**
   - Root cause: the prompt fired its section event before the Empire panel mounted, so the event was lost.
   - Fix: `panelEvents.openSection` keeps the ask for 2 s, and `CollapsibleSection` takes it on mount, opens the section, scrolls to it and rings it for 2 s.
   - The governor prompt goes to `court.governors`, the governors block itself.
   - The timers are not cleared on a dev StrictMode remount, which was dropping the scroll.
   - Browser check: the law chip lands on Laws (shots `law-*`).
   - Virtue: the detail card now scrolls clear of End Turn (`scroll-mb-20`). The persona's tap at (270,270) seems to have landed on an attribute row, which has no control without points.
5. **Queued units vanish.** I checked whether the queue was lost: a headless run of settler plus infantry over 6 turns kept the queue. It was only hidden. The Cities list now adds "then Warband, +1 more". Test in cityRailModel.test.js.
6. **Peoples panel.**
   - The actions grid now sits right under the people's header, with war last.
   - The "0 MET" header was the elimination bug above. The count also now includes every listed people.
   - The first-contact card's "Open diplomacy" opens that people (`openPeople`), or an independent's own sheet.
   - A war or map-offer chip also opens its people.
7. **Rail and chips.**
   - Rail measured at 844x390: 8 rows of 44x52 px, no scroll and no overlap. The mis-taps look like persona taps on row edges. No change.
   - The city sheet's sideways rows (queue-dry chips, build groups, city tabs) now fade the edge where chips hide. `useScrollHint` sets `data-more` and index.css adds the mask, mirrored in Hebrew.


## The lead's five items from the warmonger run 40650973042 (message of 09:09)

1. **Advisor builds before every End Turn.** The dock now shows **Always** beside Advisor builds. One tap gives every city the standing order "advisor picks when the queue runs dry" (city-builds' `SET_PRODUCTION_KEEP 'advisor'`), so the banner stops coming back. Each city's Build tab still changes it. Shot: `after2/dock-map-*`.
2. **Build list stuck under the banners (step 67).** In the browser the sheet's body scrolls as a whole (243 px visible at 844x390). The dock's Advisor builds button and the Idle chip sat on its lower part, so about one row was free and drags landed on the buttons. Now, on a phone held sideways with a city sheet open, those dock buttons hide (ProvinceModal sets `html[data-city-sheet]`, index.css). The sheet's own queue bar gets an **Advisor: <item>** button when nothing is in production. Shots: `before2/build-idle-*` vs `after2/build-idle-*`.
3. **Choose production did nothing (step 18).** Pressing "Choose production: X" while X's sheet is already open now queues the advisor's pick for X. Browser check: before, the city's production stayed `null`; after, it is `{ kind: 'settler' }` (`*/build-idle-dockpress-*`).
4. **War on a people you never saw, and "0 MET".**
   - `declareWarModel` (warActions.js), read by the nation card, the tile and army sheets and the confirm, now blocks war while you know none of their cities and see none of their armies: "Find them first ... Explore toward them."
   - This is a UI rule. The reducer still accepts DECLARE_WAR, since the AI's wars go through `declareWar`. Say if you want it as an engine rule.
   - "0 MET" was the band-start elimination bug above.
   - Test: confirmSpecs.test.js. Shot: `after2/peoples-war-*`.
5. **6 to 150 turns with no reason.** Each slow row in the build list now reads "slow here (N production a turn): queue it and buy for about G gold". The price is the same rush price RUSH_PRODUCTION charges (spending.js `rushGold`). The 150-turn quote is this city's production; the same unit is faster in a bigger city. Test: cityBuildModel.test.js.

## Evidence

- Shots: `plans/ui/newcomer/before/` and `after/`. Covered: 844x390 and 1600x900, en and he, these screens: map-fresh, step-tap, map, glossary, cities, peoples, ruler-virtue, law (after only), build and foreign-unit. Script: `node scripts/ui/newcomer-shots.mjs --tag after --swgl` (dev server on 5197).
- The 1600x900 foreign-unit shot timed out under software GL in both runs, so the desktop has no foreign-unit shot. The phone foreign-unit shot exists only in `after/`; use playtest shot step-116 as the before.
- Lint is clean. Full `npx vitest run`: see the last section.

## For the lead

- Merge soon: the elimination fix changes the live game the most (an AI world in every normal start). Expect more contact, demands and wars in band-start playtests from here on.
- Design calls made inside the lane: the next-step order and its thresholds (4 cities, 10 turns, 900 km), and war removed from a foreign-unit tap. These answer the brief's items 1 and 2 directly. Adjust if you disagree.
- Not done: a "unit trained" notice that selects the new unit (the report's item 5 extra); shorter early build times (balance, needs balance-sim); a guided first skirmish.

## Tests

The full `npx vitest run` passed 4692 tests across 498 files. 3 failed under full-suite load: worldgen "same bytes", battleLoop replay and the cities 150 ms budget. The first two are on the known-flake list. All 3 pass when run alone (29 tests). Lint is clean.

After the lead's items, a second full `npx vitest run`: 4695 passed and 1 failed. The failure was sayWhy.test.js, whose rival was never seen, so the new war block came before the gold shortfall. The test now uses a world with fog off and passes (6 of 6). Lint is clean.
