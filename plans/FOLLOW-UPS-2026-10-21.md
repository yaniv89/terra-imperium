# Follow-ups found on 21 October

Open items found while merging lanes. Kept in sync with the status page.

1. **Event cards fact-check:** Run the full historian check on the 612 AI cards, fix or drop the bad ones, then put them in the game.
2. **Army sight bug:** Army sight stops at tiles its nation already sees; fixing changes game results, needs your OK.
3. **Late turns still slow:** About 350 to 450 ms a turn near turn 300 against 80 ms; next step: tile ownership in a typed array.
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
