ponytail read in full at 18:34 UTC, 28 Oct (cat of the whole SKILL.md; the session start hook also printed PONYTAIL MODE ACTIVE).

# Lane r3-campaign: report

Branch `claude/r3-campaign` (from `claude/integration`, merged with it again before the push). No API use.
Source: the round 3 Opus playtests (civ-veteran 40736765307, warmonger 40736770044, newcomer-phone 40736775039).

## What was fixed

| # | Playtest finding | Root cause | Fix |
|---|---|---|---|
| 1 | Tech tree: six scrolls to reach the techs; an era tab tap did nothing (civ-veteran 14 to 20) | The tech list sits under the current card, boosts, queue, era goals, scholars and focus. The age strip cells looked like tabs but were plain `div`s in the Lines view | An **All techs** chip in the Research header scrolls to the list (one tap). Every age strip cell is now a button in both views: a tap opens the Web at that age (TechPanel.jsx) |
| 2a | "Offer pact" gave no answer (newcomer 17 to 18) | The player had no decree (1 needed). The "not enough" notice was drawn under the action tiles, below the fold on a phone | Every diplomacy action in the card now shows its answer in a bubble on the tapped tile: the refusal, or the reducer's own log line after the action (NationCard.jsx, `Bubble` exported from WhyTip.jsx). The Offer pact tile says what is missing before the tap ("Not enough resources: need 150 Gold (have 98)") |
| 2b | Tapping a people in the Peoples list opened the glossary (warmonger 30 to 31) | The row had `data-help`, so a slow tap (the harness's CDP tap on a busy page) passed the 500 ms hold-for-help | No hold-for-glossary on Peoples rows; the card's title still links to the entry (DiplomacyPanel.jsx). Shot: a 700 ms hold on Pontus opens Pontus's card |
| 3 | Unaffordable buys look like affordable ones, no turns to afford (civ-veteran 28) | `opacity-60` only, no turn count | Out-of-reach Buy is greyed (dashed, muted, 50%) and shows the turns of income it takes ("1128 · 15t"); the buy offer says "You have 98 gold: 15 turns of income to save it." (`goldWait` in cityBuildModel.js reads `calcNationBalance` net, the top bar's own number) |
| 4 | Preview "Hopeless: Sippar holds 1,600 men to your 10,000", then a battle at 8,590 vs 20,000 (newcomer 50, 59) | Reproduced headless on the classical era save: at turn 116 Sippar has only 1,600 militia, Auto reads it as an empty city and batters its walls, which hold (320 of 320 HP to about 278), so 0%. A 20,000-man Akkadian stack stands next to Sippar (reinforcementSources); it moves in and attacks the marching army at turn 120 (field defense, 8,590 vs 20,000). The numbers were right; the line gave no reason and did not name the stack | estimateMarchOdds (battleOdds.js) now passes through simulate's own `autoRule`, `city` (walls HP) and `attacker`, and adds `standbyStrength`: the enemy troops a commanded assault would call in (the same `reinforcementSources` as the pending battle), only those the player sees. The line now reads "Hopeless on Auto: Sippar's walls hold (320 of 320 HP to about 278); 1,600 militia to your 10,000. 10,000 more enemy men stand near it." A garrisoned city reads the battle win chance (Auto never takes a garrisoned city in one battle). No new math |
| 5 | A newcomer cannot find their army or how to fight (newcomer 31 to 59) | The war pill opens the enemy's card, but "March to Sippar" was a small button under the opinion and war rows, below the fold | **March to <city>** is now the first tile of the at-war card, with "Your 10,000 men set out: tap March to attack, then End Turn until they arrive." The path is: war pill, March tile, March to attack (3 taps), and the march bar then shows the odds above |

Also: removed an em dash from `nc.notEnough` (en and he).

## The lead's rerun items (newcomer rerun 40746174323, message of 28 Oct 19:45)

| # | Item | Finding (headless on the classical save, turns 116 to 129) | Done |
|---|---|---|---|
| 1 | Siege of Shechem said "Auto holds 100%" with 1,500 militia against 20,000 (251) | The number is honest and reads the same forces: no regiment inside, so Auto batters the walls (210 to about 102 of 240 HP) and the city falls only when they break; by turn 128 the walls are at 0 but Akkad's stack is archers only, and nothing takes the city (simulate's `hasMelee`). Shechem stayed Israel's every turn. The reason was only in the Auto box, below the fold on a phone | A line under the odds row says why: "No regiment inside: the attack batters its walls from 210 to about 102 of 240 HP; it falls only when they break", or "Its walls are down (0 of 240 HP), but the attackers bring no foot or horse to take it". estimateDefenseOdds passes through simulate's `hasMelee` (no new math). Shot `7a-siege-card` |
| 2 | After "Fight on Auto" no result screen (253) | An attack on an empty city's walls has no rounds, so BattleReportsHost had no replay to play and showed nothing | The player's own Auto battle of this turn with nothing to replay opens its battle report (not with "instant battles" on). Shot `7b-after-auto`: "Siege of Shechem, Defeat ... Shechem holds on" |
| 3 | March-mode tap picked Damascus, map jumped; no city search (245 to 248) | The magnifier button only opened zoom buttons | **Find a city** box in that panel (`citySearch.js`, explored cities, the shown name or the record's own); a pick goes through the map's own select, so in March mode it aims the march (shot `6b-city-found`: "To Shechem"), else it opens the city. **Not taken:** the badge hit test that picked Damascus (GL map hit areas; no shot of the tap, may have been Damascus's own badge) and the camera move when the target is set |
| 4 | Diplomacy feedback on failure (19, 62 to 64, 102); white peace closed without an answer (224) | Same cause as item 2 above (the notice below the fold) | Already fixed by the tile bubbles; white peace (PeaceDealSheet `onSend`) now goes through the card, so Akkad's answer shows in the bubble. The peace sheet opened from a city card (RegionInfoModal) still closes silently: not taken |
| 5 | Era tabs did nothing (26, 111 to 112) | Same as item 1 above | Already fixed |

Tests: `citySearch.test.js` (new), two new cases in `defenseSheetModel.test.js`.

## Evidence

- Shots before and after, 844x390 (touch, CDP taps like the playtester) and 1600x900, en and he: `plans/lanes/r3-campaign-shots/{before,after}/`. Script: `node scripts/ui/r3-campaign-shots.mjs --tag after` (dev server on 5197; loads the classical era save, Israel at war with Akkad). Key pairs: `1b-all-techs`, `1c-age-tab`, `2b-offer-pact`, `3b-city-buy-offer`, `4a-march-odds`, `5a-war-card`.
- Tests: new `src/components/map/marchOddsText.test.js` (walls, garrison, standby), `goldWait` in `cityBuildModel.test.js`; `marchBar.test.js` updated to the garrison wording. Related tests (326 files) green; full `npx vitest run` result below.
- engine-rules-reviewer on the battleOdds.js diff: no rule breaks (pure, no new rings, fog-filtered standby). Its one suggestion (read the tile through `unitTile`) is applied.

## Open items for the lead (not fixed here; other lanes' areas)

1. **Desktop overlap (lead-ui-fixes area):** at 1600x900 the Cities dock (open by default) covers the nation sheet that the war pill opens (`after/5a-war-card-desktop-en.png`); a tap on its tiles hits the dock. The phone is fine.
2. **Auto vs Command reinforcements:** a commanded assault calls in `defenderReinforcements`, Auto (LAUNCH_INVASION) does not. The preview now names the standby troops and says they "stand near it", not that they join. Worth a battle-lab parity look.
3. **Turn report "Defend"** opens the city's Defense tab (newcomer 38 to 39 read it as an unrelated housing page). It is designed that way; a clearer first line in that tab, or focusing the incoming army, would help.
4. `scripts/ui/panels-shots.mjs` times out at the desktop dock step on this machine, on the base code too (an earlier step there), so it is flaky here, not broken by this lane.
5. "have 98" in the pact line vs 99 in the top bar: shortfallLine floors and the bar rounds (pre-existing).

## Full suite

`npx vitest run` after the merge with claude/integration (3da7f3e7): 513 files passed, 2 skipped; 4,796 tests passed, 17 skipped, 0 failed. `npm run lint` clean.
