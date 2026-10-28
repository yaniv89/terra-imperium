# Lane battle-odds: report

ponytail read in full at 08:43 UTC (28 Oct).

Target: "Wars and AI behaviour" from 2-4/10 toward 8/10. Inputs:
- the round 2 civ-veteran run 40650976677
- the lead's two messages: the city-builds note on lost outlying cities, and the warmonger run 40650973042

## The bug: battles the AI starts fought the player at the stone age

The playtest's "16,000 vs 9,700, lost" was the Pontic landing at Jerusalem in the kingdoms era save (turn 187). I reproduced it headless from `scripts/ai/era-saves/kingdoms.json.gz`.
- The landing's context had `defenderAgeId: 'stone'`, although Israel was in the kingdoms age.
- Auto held 3% of the time and lost. With the fix it holds 100% and wins, with the same armies.

Root cause: the engine looks at an AI's attack "as the AI" by building a view `{ ...state, playerNationId: ai, techAgeId: ... }`. Inside such a view the human is no longer `playerNationId`. `ageOf(view, human)` then read `nations[human].tech.ageId`, which does not exist, so it returned the first age. `getResearched(view, human)` returned nothing, and `getResearched(view, ai)` returned the human's tech tree.

This hit:
- AI landings (`aiLanding.js`)
- queued field and sea battles (`battleQueue.js` `aggressorView`)
- forts (`forts.js`)
- the AI's own odds checks before attacking the player (every view in `aiOperations.js`)
- the AI naval views
- the Command setup of those battles (`buildBattleSetup.js` `gateOf`)

So the player lost on Auto and on Command alike, and the AI attacked at odds it misread.

Fix: one helper, `viewAs(state, nationId, resources?)` in `src/engine/nationState.js`. It keeps the human in `state.humanView = { id, ageId }`, and `ageOf` / `getResearched` read it. Every view above now goes through it.
- A view copied back into the real state (`humanView.id === playerNationId`) is ignored.
- Old saves lack the field and work as before.

Tests:
- `nationState.test.js` "viewAs"
- `aiLanding.test.js`: the landing fights at the player's own age. It fails on the base (stone) and passes now.

The engine-rules-reviewer agent found no blocking issue. Its three small findings are fixed: the two naval views, the Command gate's pool, and the spare comment.

The other losses checked were honest:
- **Naval interception, 1,000 vs 1,000, 3%:** the player's warship is bronze age in a kingdoms navy (units keep their age; multiplier 0.68 against 1.64). The card now says so ("Units' age").
- **Siege of Lachish (gunpowder), 0%:** the garrison plus militia are 1,490 against 5,820, 3.9 to 1. The tech lead (x1.96) does not make that up.

## Odds and reasons before every battle (Total War's balance of power)

- **Defence card** (DefenseSheet, `defenseSheetModel.js`): new reason chips (Numbers, Technology, Units' age, Walls, Terrain), read as yours. They come from every queued kind: city assault, field, sea, landing, interception, raid and sack (`battleQueue.queuedBattleView` returns `odds.reasons`).
- **New "Units' age" factor** (`battleOdds.js` `explainInvasion`): strength-weighted `unitAgeWeight` of each side. "Numbers" now counts the militia, which already fought.
- **Hopeless warnings name the worst factor against you** ("Hopeless: Auto holds only 0% of the time, mostly from Numbers x0.55"). Before, it always said "Badly outnumbered".
- **Attack card** (PreBattleModal): exact odds under 15% show a hopeless line with its reason, and Auto is pre-selected unless Settings say Command. Retreat is Call off; the line says so.
- **Undefended city** (militia or nobody) that holds this turn: "Holds this turn", plus "At this rate its defences fall in about N turns" (EU4's siege status). Before, it said "Likely hold" for a city taken three turns later.
- **Layout at 844x390:** the defence card's Command / Auto / Withdraw sit right under the odds. In the warmonger run (step 129) the long warning pushed them off the sheet.

## Engage, warnings and responses

- **Engage the besiegers** (playtest step 67: the only way in was the enemy banner):
  - the city's Defense tab: "N men besiege the city ... Engage"
  - the turn report's siege line: "Engage"

  Both open the normal attack card on the weakest besieging stack (`cityDefenseModel.engageTarget`, event `openFieldAttack`). Without a garrison, the Defense tab says why.
- **March warning** (lead, city-builds): an AI stack marching on a player city logs once, 3 tiles out: "Pontus marches on Jerusalem with 10,000 men, 2 tiles away." (`aiOperations.warnMarches`, `ARMY_WARN_TILES`; it is the raid warning's twin).
- **Actionable raid and march warnings** (lead, warmonger run): their turn report lines carry "Defend", which opens the city's Defense tab. Its new card "Coming for this city" lists each raid party and army with men and turns or tiles, and offers:
  - **Pay them:** the independent's sheet; paying tribute is a truce, and the raid goes home at the target.
  - **Send an army:** selects your nearest field army.
  - Train and walls are already on that tab.
- **Sacks:** a sacked city was already spared a fixed 20 turns. That spare is now 12.5 reference turns through `speedTurns`: 20 to 21 at Normal up to kingdoms, 25 later, longer on Marathon, shorter on Fast. Hazor's sacks in the kingdoms save came about 27 turns apart, after a "raiders N tiles away" warning each time. The town had no garrison (220 militia against 2,000).

## Evidence
- **Shots** (`node scripts/ui/battle-odds-shots.mjs <dir>`, dev server on 5197): 844x390 and 1600x900, en and he, no page errors. Engage card: "Numbers x0.27, Units' age x0.42, Technology x1.96", hopeless line, Auto chosen. Defence card: the choice row is visible. Defense tab with Coming and Engage. Hebrew reads right to left.
- **balance-sim compare** (`compare.sh origin/claude/integration 150 11-18`, PLAYER=akkad), first pass with a 12-turn spare:
  - sacks +2.25* (17.1 to 19.4)
  - raidsHit +2.6
  - captures -0.63* (4.9 to 4.3)
  - wars, cities and the player's economy unchanged within noise

  The sack rise came from the spare dropping from 20 to 19 turns early. It is now 12.5; the second pass is below.
- SECOND_PASS
- PARITY
- TESTS

## Not done, for the lead
- The economy view in `economy.js:109` (AI income through a view with the player's `techAgeId`) is the same bug class in someone else's lane.
- `aiOperations.js` march and path views (lines 300 to 804) and `aiScouting.js:104` still hand-build views without the age. They are pathing only; line 804 reads the human's research for roads. I left them: no wrong outcome was seen.
- No marker on the map for an approaching major army. The turn report line and the Defense tab carry it.
- Action logs recorded before this change replay to a different hash: AI choices changed. This is harmless while `CHALLENGES_ON` is false.
