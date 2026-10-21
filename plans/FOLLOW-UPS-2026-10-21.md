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
