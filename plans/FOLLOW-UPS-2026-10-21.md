# Follow-ups found on 21 October

Open items found while merging lanes. Kept in sync with the status page.

1. **Event cards fact-check:** Run the full historian check on the 612 AI cards, fix or drop the bad ones, then put them in the game.
2. **Army sight bug:** Army sight stops at tiles its nation already sees; fixing changes game results, needs your OK.
3. **Late turns: re-measured 27 October, no regression:** seed 11, standard peoples world, 20-turn means: turn 50 49 ms, turn 150 117 to 122 ms, turn 300 245 to 262 ms (base 73f09853 on the same PC: 49, 122 to 125, 262 to 270 ms; two runs each). Biggest at turn 300: cities 60, aiWarDeclarations 54, aiWarProgress 22 to 48, rebellionAndSupply 15, fog 14, aiEconomy 14 ms. The 350 to 450 ms figure no longer reproduces here. Map pan (fps, step ms) and battle sim at 300 a side (p95 2.2 ms, same hash) equal to base; phone main ms per frame about 1 ms higher (4x throttle, noise level). Next step if wanted: cities and aiWarDeclarations at turn 300.
4. **Information parity gaps:** 4 parity rows outside the guardrail: field 5 vs 2 in Modern and Information, town Gunpowder vs Modern with siege.
5. **AI Energy plants and drones:** Only lightly tested; check in a long Information game.
6. **Challenge: email name:** Players without a display name show the start of their email on the leaderboard.
7. **Challenge: fast-forward:** Fast-forward in a challenge game gets an honest player rejected; block it in the game instead.
8. **Challenge: switch on:** Deploy steps in plans/U36-DEPLOY.md need your Supabase and GitHub settings.
9. **Mobile bugs H-12 and one more:** Need the mobile bug report file from your PC to identify them.
10. **Hebrew: 22 skipped fixes:** done. The user checked the 7 plural-verb lines and keeps them as they are (21 Oct); the rest were skipped on purpose.
11. **Glossary links:** Tap-to-learn still missing in city build lists, unit rows and the Peoples panel.
12. **Hold for help in battle:** Battle HUD buttons and unit cards do not open help yet.
13. **AI founded line:** The AI 'founded' line is stored but not shown; decide whether to show it.
14. **iPhone check: touch:** Circle select (also by double tap), hold for help, the touch tutorial.
15. **iPhone check: new screens:** World Congress, glossary, crisis banner.
16. **Screenshot checker and playtester:** Trial runs going; then full runs and fixes from their reports.

## From the AI playtester (3 full games, 21 October, $0.32)
Akkad seed 1000 to 700 CE, Elam seed 1001 to 1500 CE, Pontic seed 1002 to 900 CE. Report on branch `ai/playtester-39629750171`.

17. **Research stalls after Classical:** one tech takes about 100 turns. Check against the U96 Marathon/Gunpowder calibration first.
18. **Calendar freezes then jumps:** the year stays put for many turns, then skips centuries.
19. **Gold piles up:** nothing worth spending it on in mid game.
20. **Expansion is very slow:** few new cities across the whole game.
    - **Measured 27 October** (c7644583, balance-sim worldStats-style run, POLICY scripted, 8 seeds 11 to 18, standard peoples world, akkad, 200 turns, cities include outposts; the throwaway sim is not kept):

      | Normal speed (mean of 8) | T25 | T50 | T100 | T150 | T200 |
      |---|---|---|---|---|---|
      | player cities | 1 | 2 | 2 | 2 | 2.8 |
      | AI median / top / bottom | 2 / 2.9 / 1 | 3 / 4 / 1.9 | 6 / 8.4 / 2.5 | 10.1 / 16.1 / 3 | 14.4 / 24.4 / 3 |
      | independents left (of 45) | 45 | 45 | 46.6 | 43.5 | 35.5 |
      | land claimed | 4.7% | 6.5% | 12.7% | 21.8% | 32.5% |

      | Marathon (mean of 8; seed 13 player lost at turn 88) | T25 | T50 | T100 | T150 | T200 |
      |---|---|---|---|---|---|
      | player cities | 1 | 1 | 1 | 1.9 | 1.9 |
      | AI median / top / bottom | 2 / 2 / 1 | 2 / 3 / 1.6 | 4.1 / 6 / 1.9 | 6.7 / 9.3 / 3 | 9.3 / 14.1 / 3 |
      | independents left (of 45) | 45 | 45 | 45 | 46.1 | 42.9 |
      | land claimed | 4.5% | 5.9% | 10.1% | 15.4% | 21.6% |

      First settler built / second city grown (median of seeds): AI 18 / 28 (Normal), 21 / 34 (Marathon); the scripted player 48 / 61 (Normal), 130 / 150 (Marathon).
    - **What blocks** (share of sampled turns, every 5th turn, per nation): AI nations, Normal: first 50 turns outpost slots full 45% (stone age allows 1, bronze 2), a site exists but no settler is queued 46%; turns 101 to 200 a settler is on the road 26 to 32%, no site in the AI search reach (11 rings, 1,122 km) 10 to 20%, slots full 12 to 13%, war under 2%. Marathon is the same shape, slower. Not the blocker: the size-2 rule (0 to 5%), war, city spacing as such. For the scripted player the cause is production: its capital makes 3 hammers a turn at size 8 (it works food tiles; the AI capital makes 10 to 13), and a settler costs 112 to 133 (Normal) or 140 to 210 (Marathon), so one settler takes about 40 turns (Normal) or 70+ (Marathon). A human can retile the city, so the player rows are a floor, not typical play.
    - **Civilization VI, Standard size and speed** (from my memory of normal play, no single published table): a human has 4 to 6 cities by turn 50, 8 to 12 by turn 100, 10 to 15 by turn 150; the AI on Prince has about 4, 7 and 9. Terra's AI median (3, 6, 10 on Normal) is close at turns 100 and 150 and one city behind at turn 50; on Marathon (2, 4, 7) it is clearly behind. The land stays 68% unclaimed at turn 200 and about 40 of 45 independents are still alive, so the slow part is the early game and the AI top (24 cities) shows the late game can run.
    - **Options:**
      1. Raise `OUTPOST_SLOTS_BY_AGE` in settlers.js (stone 1 to 2, bronze 2 to 3): the AI's first-50-turn stall (45% slots full) mostly goes away, about 1 more city by turn 50 and 2 by turn 100.
      2. Let a city queue a settler at once when it is size 2 or more and a site exists (drop the one-turn-in-three `SETTLER_THINK_PERIOD` and let the Marathon cost use `buildSpeedMult` like buildings): the first settler comes about 5 to 10 turns sooner and Marathon catches up with Normal in city count per year.
      3. Cut the settler's production cost to about 60% (or make it cost food and a citizen only): a low-production capital then needs about 20 turns, not 40, which fixes the player's slow start without touching the AI; check with balance-sim compare for the AI runaway (top 24 cities at turn 200 is already a quarter of land).
21. **Idle cities build no defenders:** the auto build queue leaves cities empty and they fall.
22. **City lost with no visible battle:** the player loses cities without a battle report or a war notice.
23. **Events repeat:** the same card shows several times in one game.
24. **Era goals feel thin:** few goals and small rewards.
25. **Crises rarely touch the player.**
26. **AI declares war with no reason shown.**

## From the human-style playtests (7 runs, 1,138 steps, $12.51; plans/ai-output/human-playtest/SUMMARY.md)
27. **No path to a battle:** nobody met a neighbour for many turns; declared wars never showed the enemy.
28. **Settlers stuck at "1 turn":** progress far over cost because of the hidden size 2 rule.
29. **Save, load, help and glossary not found:** Menu opens Settings only.
30. **End Turn covers the bottom of panels on the phone,** including Declare war.
31. **Exploring is aimless:** armies march into empty land and starve; no supply range shown.
32. **Disabled actions say nothing:** Declare war, the greyed build plus, Military pact.
33. **Map goes blank after closing Peoples or signing a pact.**
34. **Late army rows will not queue; End Turn turns into "Choose production".**
35. **Virtue choice has no confirm or cost.**
36. **Playtest era saves too weak:** need real empires, met neighbours, a coast, one save at war.

## From the battle sandbox playtests (3 runs plus a trial, $5.94; plans/ai-output/human-playtest/BATTLE-SUMMARY.md)
37. **Sea battles drawn on land:** grass and road under the ships, tanks in the fleet; fleets never meet.
38. **Nobody can tell who is winning:** no strength bar, "Base 1 vs 9" unexplained.
39. **Battles drag with no goal; a sack is lost on the clock with no warning** (loot taken, last raider to catch).
40. **Battle keeps running after an army is dead;** result screen headline and reason disagree.
41. **Units tiny and hidden under trees and buildings; melee is a blob.**
42. **Phone battle HUD:** powers menu clipped, camera buttons misfire, Hebrew labels missing.

## Status on 27 October (lane leftovers audit)

Checked against claude/integration c16d20ae plus this lane. "Done" rows rest on the commits named and a look at the code, not on a new playtest.

| # | Item | Status | Commit or place | Note |
|---|---|---|---|---|
| 1 | Event cards fact-check | done | d1a85b58, c85b6582 | Historian fixes on the cards in the game |
| 2 | Army sight bug | done | f21604ad | Each unit walks its own seen set |
| 3 | Late turns slow | open (measure) | b77d142d, 8d1e48f6, c4cd5abc, 38325bd4 | Turn-speed cuts landed (typed tile slots); no new 80 ms measure yet: run the perf skill |
| 4 | Information parity gaps | design change | 1d804c17 | Field 5 vs 2 rows still out; a fix retunes Auto for every age (list for the user) |
| 5 | AI energy plants and drones | waits on the user | e956875e | Needs a long Information game (no new AI playtest spend) |
| 6 | Challenge email name | done | e977d311 | |
| 7 | Challenge fast-forward | done | 6d4e28ed | |
| 8 | Challenge switch on | waits on the user | plans/U36-DEPLOY.md | Supabase and GitHub settings |
| 9 | Mobile bugs H-12 and one more | waits on the user | | Needs the bug report file |
| 10 | Hebrew 22 skipped fixes | done | f63c68e1 | |
| 11 | Glossary links | done | 0e8ed532 | |
| 12 | Hold for help in battle | done | a251214d | Train buttons and unit cards; powers have no glossary entry on purpose |
| 13 | AI founded line | done | b2cd00ee | Shown in the glossary |
| 14 | iPhone check: touch | waits on the user | 2e01f447 | Emulated only; needs a real iPhone |
| 15 | iPhone check: new screens | waits on the user | 2e01f447 | Needs a real iPhone |
| 16 | Screenshot checker and playtester | waits on the user | bbc24b0c, 14f921a4 | No new AI playtest round for now |
| 17 | Research stalls after Classical | done | e741e949, a2816433 | |
| 18 | Calendar freezes then jumps | done | e741e949, beef31be | |
| 19 | Gold piles up | design change | | Needs gold sinks (U34 parked) |
| 20 | Expansion very slow | design change | | Settler, growth or AE rule |
| 21 | Idle cities build no defenders | done | a209a237 | |
| 22 | City lost with no visible battle | done | a209a237, 74e43362 | |
| 23 | Events repeat | done | 23e2cb0c (U26 deck) | Cooldowns per card, family and city; story openers once |
| 24 | Era goals thin | design change | | How many goals, how big the rewards |
| 25 | Crises rarely touch the player | design change | | Crisis targeting and frequency |
| 26 | AI declares war with no reason | fixed now | d6c16f26 | The log line names the claim, refused demand, grievance or no just cause |
| 27 | No path to a battle | done | 9c27ed46 | |
| 28 | Settlers stuck at 1 turn | done | 32dbc81e | |
| 29 | Save, load, help, glossary | done | f9e9ae84 | |
| 30 | End Turn covers panels | done | 7e316d20, 5f577b62 | |
| 31 | Exploring is aimless | done | 9c27ed46 | |
| 32 | Disabled actions say nothing | done | 32dbc81e, f8d7a5c8, 30cf7ad9 | |
| 33 | Map blank after Peoples or pact | done | 77801542 | Not reproducible; a blank-map check guards it |
| 34 | Late army rows will not queue | done | e3a0a9f4, 3f49057b, 32dbc81e | |
| 35 | Virtue has no confirm or cost | done | 32dbc81e, 347550a3 | |
| 36 | Playtest era saves too weak | done | 491c9f03, 4532eaae | |
| 37 | Sea battles on land | done | 1a3d14d4 | |
| 38 | Who is winning | done | 0b514191 | |
| 39 | Battles drag, sack lost on the clock | done | 0b514191, fb920b3e | |
| 40 | Battle runs after an army is dead | done | 0b514191, 7e3fe8b3 | |
| 41 | Units tiny and hidden | done (mostly) | dc70b464, b370ba40, fc63d272 | Melee blob not changed (a look decision) |
| 42 | Phone battle HUD | done | e1601603, 37c2a4ba, 977d1d3a | Plus this lane: Hebrew ability names in the radial, overlays take turns |
