# Human playtest: newcomer-phone

# Playtest Report: newcomer-phone, campaign (phone 844x390, landscape, English)

## 1. Summary

A first-time player on a sideways phone played 255 steps over three sessions:

- **start** (steps 1-85): Akkad, turns 1-11.
- **bronze** (steps 86-171): Israel at war with Pontus, around turns 83-88.
- **classical** (steps 172-255): Israel at war with Akkad, turns 116-126.

No page errors were caught.

The opening flow is smooth. Setup, the welcome tour, the gold "next action" button, event cards, the advisor's build picks and Best site all carried a player who reads little. Save and load worked first time. The manually commanded siege of Jerusalem was the high point of the run, with fun at 5 for over a dozen steps. Things went wrong in the places where a newcomer needs the game to explain itself:

- Diplomacy actions failed silently.
- The city build queue and buy flow were unreliable and ended in a paid item being pushed back.
- The research screen's era tabs did nothing on this layout.
- An auto-resolved siege gave no result at all, after promising 100% odds with 1,500 militia against 20,000.

**The three things that matter most:**

1. **Silent failures.** Diplomacy buttons, peace offers and auto battles give no feedback, so the player cannot tell a missed tap from a refusal.
2. **Build queue and buy-with-gold are fragile.** The queue dropdown does not open reliably, only the top item can be bought, and an item the player had paid for was moved back behind another.
3. **Phone-landscape layout gaps.** The research tree's era tabs do not respond, End Turn sits over that area, the battle Continue button is below the fold, and tips need two taps to close.

## 2. Scorecard

| Area | Score | Why |
|---|---|---|
| Start screen and world setup | 8/10 | Steps 1-8 went cleanly on defaults and the tour was readable. The only snag was the full-screen tip needing two taps to close (172-173). |
| Tech tree | 4/10 | Picking from the recommended list works (9, 28, 50). The era tabs did nothing (26, 111-112) and the player never found an individual tech list (115). |
| Map pan, zoom, close view and fog | 6/10 | Pinch zoom worked (10, 89). There is no way to find a city by name, and the button the player hoped was search opened zoom controls (245-246). Close view and fog were never examined. |
| Units and armies | 5/10 | The Send an army and March flow is good (122-125). The unit "next" arrow showed the same army (138), a march tap picked the wrong city, and the map jumped (125, 248). |
| Cities, builds and settlers | 7/10 | Founding, Best site, the advisor and governors are easy (12-14, 52-53, 206-207, 233-237). The queue dropdown was unreliable (181-184, 190). |
| Speed feel | 5/10 | Turns end quickly. Early items are very slow: Settlers 28 turns (15), Warband 19 turns (58), Longship 11 turns (194). |
| Crises, events, era goals, independents, raids, World Congress | 7/10 | Event cards and era goals are clear and quick (16, 23, 86, 98, 166, 200, 239). Independents and raids were only brushed. World Congress was not reached. |
| Diplomacy | 3/10 | Pact, tribute and trade gave no feedback on failure (19, 62-64, 102). The decree cost is unexplained, and white peace closed without an answer (224). |
| Economy and gold | 5/10 | The buy confirm box is clear (131, 216). Prices are very high for a newcomer (192), only the queue head can be bought (189), and a paid item was reordered (217). |
| Glossary and help | 7/10 | Long-press opening the glossary is a nice discovery (103-104) and entries read clearly (33, 107). The How to play tutorial is three pages and skips the hard parts (82). |
| Save and load | 9/10 | Save, load list and restore all worked on the first try (34-38), and autosave was noticed (221). |
| Pacing and fun | 7/10 | The player rated pacing good by the end, and the to-do list and ruler points kept it busy (227-231). The early game felt "thin" (85). |
| Wars and AI behaviour | 6/10 | AI attacks are visible and the Defend button routes well (120-122, 240-242). Sieges repeated quickly (171), the auto odds looked wrong (251), and declaring war cost 300 gold early (69). |
| Naval | 6/10 | Boarding and sailing were a pleasure in bronze (91-97). In start there was no ship in the build list and no hint why (76). Arrival was never seen. |
| RTS battles (deploy, orders, workers, sieges) | 7/10 | The siege looks great, the tips help, and Enemy plus Attack it works (141-158). The win was costly and confusing (161), Continue was hidden (162), and the auto siege had no result (253). Deploy was skipped and workers were never seen. |

## 3. Fun curve

**Start session (1-85)**
- Fun held flat at 3 with frustration 1 through setup and the first turns.
- Small lifts to 4 came when the bought Settlers completed (48) and when Best site found a river spot (53).
- The first dip was the silent Offer pact failure at step 19 (fun 2, frustration 3).
- The low point of the session was steps 76-79. The player searched for a boat in Kish, found nothing, and then found no battle and no help on battles (fun 2, frustration 2-3).
- The session ended flat at 3.

**Bronze session (86-171)**
- This was the best stretch. Fun rose to 4 at step 92 once the player found a fleet, boarded spearmen and sailed (92-97). It stayed at 4 through new neighbours and the glossary (98-110).
- It sagged to 3 with frustration 2-3 when the era tabs did nothing and no tech list appeared (111-119, note at 115).
- The overall peak is steps 141-150 at fun 5, frustration 1: choosing to command the siege of Jerusalem, the briefing, the tips, then Enemy and Attack it.
- Fun stayed at 4-5 through the burning camp (154-155).
- It eased to 4 as the fight dragged (151-152, 156-159) and when the result showed a costly win (161).

**Classical session (172-255)**
- Fun held mostly at 4 with low frustration.
- There were three dips:
  - Steps 182-193 (fun 3, frustration up to 3): the queue dropdown would not open and buying a cheap Granary was blocked, then turned out to be expensive.
  - Steps 217-218 (fun 3, frustration 3): the paid Granary was pushed back in the queue.
  - Steps 245-254 (fun 3, frustration 2-3): the player could not find Shechem, the march went to the wrong city, and the auto siege showed no result.
- Ruler points and governors (227-238) were a steady, calm high at 4.
- The session closed at 4.

**Pattern:** fun climbs when the game gives the player a clear next action (gold button, advisor, Defend, Attack it). It sinks when an action fails with no message.

## 4. Top issues (ranked by harm to a real player)

### 1. Diplomacy actions fail silently and hide their costs

**What happened**
- Offer pact did nothing, with no message (18-19).
- Demand tribute did nothing on the first tap. On the second tap it said "need 1 decree (have 0)" (61-64). The card never says it costs a decree, and the player does not know what a decree is.
- Trade with Ahhiyawa did nothing, with no "not enough gold" message (101-102).
- Offer white peace closed the window with no reply (223-224).
- Declaring war cost 300 gold the player did not have by turn 10 (68-69).

**Screenshots:** shots/step-019.jpg, shots/step-064.jpg, shots/step-102.jpg, shots/step-224.jpg

**Suggested fix**
- Grey out any action the player cannot afford, and show its cost (gold or decrees) on the button.
- Always show a toast for refusals or blocked actions.
- Show a clear "Akkad refuses" or "Akkad accepts" reply to peace offers.
- Add a one-line glossary link explaining decrees.

### 2. City build queue and buy-with-gold are unreliable

**What happened**
- The queue dropdown flipped its arrow but showed no list (181-184). It opened on a later try (190-191).
- A cheap Granary added at third place could not be bought, because Buy only targets the queue head (189).
- Once moved to the top, the Granary cost 383 gold, about 5 gold per production point. The player could not tell what was affordable (192).
- After paying 383 gold, with the confirm saying "Done next turn", the Longship jumped back to first place and the Granary showed "done in 7 turns" (213-217). The player had to move it back by hand (218-219).

**Screenshots:** shots/step-184.jpg, shots/step-189.jpg, shots/step-192.jpg, shots/step-217.jpg

**Suggested fix**
- Make the queue reliably open on the first tap, and on a phone show it inline near the button.
- Allow buying any queued item, or auto-move an item to the front when the player buys it.
- Lock a paid item at the head of the queue.
- Mark affordable items in the build list.

### 3. Auto-resolve siege: no result screen and odds that look wrong

**What happened**
- The Siege of Shechem showed "Auto holds 100%" with 1,500 militia against 20,000 attackers (251).
- After Fight on Auto, the window closed straight to the turn report with no result (252-253). The player only learned Shechem held by checking the map (254-255).
- It is unclear whether the odds were wrong. The player's army had just reached Damascus nearby (248-250), and that army may have counted. If so, the panel should say so.
- In bronze, by contrast, Auto gave 13% for a repeat siege (171), so the odds panel is not always strange.

**Screenshot:** shots/step-253.jpg

**Suggested fix**
- Always show a short auto-battle result card covering held or lost and casualties.
- In the odds panel, list which forces are counted, including relief armies and walls.

### 4. Research screen on landscape phone: era tabs dead, no tech list found

**What happened**
- Tapping the Stone tab did nothing new (26-27).
- In bronze, the Classical and Bronze tabs did not respond (111-112).
- Scrolling only moved the current tech card and the era goals (113-114). The player concluded that picking a specific tech is impossible from this screen (115).
- The note says End Turn covers the area under the pinned tabs, so some taps may have hit the wrong control. This could be a layout overlap rather than a logic bug.

**Screenshot:** shots/step-115.jpg

**Suggested fix**
- Check the hit areas of the era tabs at 844x390.
- Keep End Turn away from the tab row, or hide it while Research is open.
- Make the tech list visible without scrolling once a tab is chosen.

### 5. Naval start is undiscoverable

**What happened**
- In Kish's Units list the player scrolled to the end and found no ship, not even a locked one naming a tech (70-76).
- Kish may simply not be coastal, but nothing said so.
- Later, with a fleet in port, boarding and sailing were clear and enjoyable (91-97). The "open ocean needs Gunpowder" message was a good example of explaining a block (95).

**Screenshot:** shots/step-076.jpg

**Suggested fix**
- In non-coastal cities, show a greyed ship row reading "needs a coastal city".
- Show locked ships with the tech they need.

### 6. Finding and targeting cities on the map

**What happened**
- In march mode the player could not find Shechem (244-245).
- The button they hoped was search opened zoom controls (246).
- Tapping a city icon picked Damascus instead of Shechem (247-248).
- The map jumped after choosing a target, in both bronze (125) and classical (248).
- It is unclear whether 247 was a slightly missed tap on a dense map. The map jump happened twice, though.

**Suggested fix**
- Add a city list or search in march mode.
- Make city hit targets larger on a phone, and confirm the chosen target by name before the player commits.
- Do not recenter the camera unexpectedly.

### 7. Siege outcome presentation

**What happened**
- The battle UI vanished and only trees showed for a few seconds (159-160).
- The win cost 20,380 of 33,000 men, more than the enemy lost (161).
- The result said 197 gold was looted "and spent inside the battle", which confused the player.
- Continue was below the fold and had to be scrolled to (162-163).
- Pontus besieged Jerusalem again two turns later (171).

**Screenshot:** shots/step-161.jpg

**Suggested fix**
- Show a "battle ending" overlay instead of a bare scene.
- Pin Continue on screen.
- Explain the loot line in plain words, or drop it for defenders.
- Consider a breather after a successful defence.

### 8. Early build times feel very slow

**What happened**
- Settlers took 28 turns (15) and a Warband 19 turns (58). The player called this "very slow" (85).
- Gold buying rescued the Settlers (43-48), but only just, and the player was 2 gold short for a turn.

**Suggested fix**
- Review early production, or point the player toward buying or chopping at the moment a 20+ turn item is queued.

### 9. Thin help for the hard parts

**What happened**
- How to play is three pages covering the gold button and the goal chip. It says nothing about battles, ships or decrees (79-83).

**Screenshot:** shots/step-082.jpg

**Suggested fix**
- Add short topic cards (Battles, Ships, Diplomacy costs) reachable from the "?" button.
- Link each card from the matching panel.

### 10. Close buttons and arrows that need a second tap

**What happened**
- The Safari tip X failed on the first tap in two sessions at the same spot (87-88, 172-173).
- The unit "next" arrow needed two taps (136-137).
- Repeated at identical coordinates, this looks like a real hit-area problem rather than player error.

**Suggested fix**
- Enlarge the tap targets and check that nothing overlays them on the first frame.

## 5. Bugs

### Bug 1: Paid item loses its place in the queue

Severity: high, because it costs the player gold.

1. Classical save, turn 120: open Jerusalem, then Build, with Longship first and Granary second (213-214).
2. Open the queue and move the Granary to the top (215).
3. Tap the 383g buy button and confirm Pay. The box says "Done next turn" (216).
4. **Observed:** the Longship returns to first place. The Granary shows 73/73 and "done in 7 turns" in second place (217).
5. **Expected:** the Granary stays first and completes next turn.

Screenshot: shots/step-217.jpg

### Bug 2: Auto-resolved siege shows no result

1. Classical, turn 125: Akkad besieges Shechem and the siege window opens (251).
2. Select Auto, then tap Fight on Auto (252).
3. **Observed:** the window closes straight to the turn report with no result screen (253).

Screenshot: shots/step-253.jpg

### Bug 3 (possible): Auto odds show 100% for 1,500 militia against 20,000

1. Same siege as Bug 2. The odds panel reads "Auto holds 100%" (251).
2. This is unclear from the diary. A nearby relief army in Damascus may have been counted. Check the odds calculation and what the panel displays.

### Bug 4: Unit "next" arrow shows the same army

1. Bronze, turn 85: tap the army button showing 1 (135).
2. Tap the next arrow. The first tap does nothing (136-137).
3. **Observed:** on the second tap the header changes to "Unit 2 of 2", but the panel still shows "Army at El Arish" with 18,820 soldiers (138).
4. **Expected:** a different unit, such as the fleet.

Screenshot: shots/step-138.jpg

### Bug 5: Build queue dropdown does not open

1. Classical: open Jerusalem, then Build, and add a Longship (176-180).
2. Tap the "2" queue dropdown (181), then tap it again (182).
3. **Observed:** the arrow flips but no list appears, even after scrolling (183-184).
4. A later tap on the "3" dropdown did open it (190-191), so this is intermittent.

Screenshot: shots/step-184.jpg

### Bug 6: Diplomacy action gives no response on the first tap

1. Start, turn 8: open Peoples, then Israel (60).
2. Tap Demand tribute. **Observed:** nothing happens (61-62).
3. Tap again (63). **Observed:** "Not enough resources, need 1 decree (have 0)" (64).
4. **Related:** Offer pact (18-19) and Trade with Ahhiyawa in bronze (101-102) never gave any message.
5. It is unclear whether the first tap registered at all. Either way, the button looked enabled.

Screenshots: shots/step-019.jpg, shots/step-064.jpg, shots/step-102.jpg

### Bug 7: White peace offer gives no reply

1. Classical, turn 121: open Peoples, then Akkad, then Peace deal (221-222).
2. Tap Offer white peace (223).
3. **Observed:** the window closes with no accept or refuse message. The top bar still reads AT WAR (224).

Screenshot: shots/step-224.jpg

### Bug 8: Research era tabs do not respond on 844x390

1. Bronze: open Research and pick the Great Ziggurat landmark (108-109).
2. Scroll down and tap the Classical tab (110-111), then the Bronze tab (112).
3. **Observed:** no visible change (115). The same happened with the Stone tab in start (26-27).
4. This may be overlap with End Turn, per the note.

Screenshot: shots/step-115.jpg

### Bug 9: Tip close button needs two taps

1. Load the bronze or classical session. A full-screen Safari tip shows.
2. Tap the X at about (587, 72).
3. **Observed:** the tip stays. A second tap closes it (87-88, 172-173).
4. This was reproduced in two sessions.

### Bug 10: March target picks the wrong city, and the map jumps

1. Classical, turn 123: open Shechem Defense, tap Send an army, then March (242-243).
2. Zoom out and tap the city icon north of the army (246-247).
3. **Observed:** Damascus is chosen instead of Shechem, and the camera jumps (248).
4. A camera jump also happened in bronze when targeting Jerusalem (125).
5. A missed tap is possible for the target choice. The camera jump repeated.

### Bug 11: Battle UI disappears before the result

1. Bronze siege of Jerusalem, commanded manually: play until one enemy building is left (159).
2. **Observed:** all buttons vanish and only trees show for a few seconds before the result appears (160-161).
3. On the result screen, Continue is below the fold (162-163).

Screenshot: shots/step-161.jpg

## 6. What was good

- **Onboarding.** Setup on defaults and the four-card tour got a non-reader playing in eight taps (1-8). The gold "next action" button was followed all game.
- **Advisor picks and Best site.** These are ideal for this persona (14, 52-53, 168, 202, 206-207).
- **Buy confirm box.** It explains production, gold and timing, and dims Pay when the player cannot afford it (131, 216). The player held this up as the model the Peoples cards should copy.
- **Save and load.** Both worked first time, and autosave was visible (34-38, 221).
- **Glossary.** Long-press on a name opens it, which the player discovered on their own (103-104). The index and entries read clearly (30-33, 105-107).
- **Naval transport.** Board, Sail, the coast-only restriction with a clear Gunpowder message, and turns-to-arrive were all easy to follow (91-97).
- **Defence flow.** The turn report has a Defend button, which leads to the Defense tab, then Send an army, then March, all in a natural chain (120-125, 240-243).
- **Siege battle.** It looks great (144). The three tips arrive while the battle waits (145-147). Enemy plus Attack it gave a newcomer a working plan (148-149). Burning the camp was satisfying (154-158). The result screen layout is clear (161).
- **Ruler points and governors.** They are quick, readable and gave the player a sense of agency (227-237). The left-side to-do list kept them busy (255).
- **Event cards and era goals.** They are short, readable choices, and the player always understood them (16, 23, 39, 86, 98, 166, 200, 239).

## 7. Coverage

**Played in depth**
- Cities, builds and settlers
- Economy and gold
- Diplomacy, as attempts that mostly failed
- RTS siege battle (one manual and one auto)
- Wars and AI defence
- Crises, events and era goals
- Glossary and help
- Save and load

**Only glanced at**
- **Tech tree:** only recommended picks and landmarks. No individual tech was chosen.
- **Map:** pinch zoom only. Close view and fog were never mentioned.
- **Naval:** one voyage started. Arrival, unloading and naval combat were never seen.
- **Independents:** "met new tribes" and one failed trade (99-102).
- **Raids:** one Raiders event card (86).
- **Units and armies:** marching only. No offensive moves, merging or splitting.

**Missed**
- World Congress
- RTS deployment (skipped at 144), workers, siege equipment, and attacking a city rather than defending
- Declaring a war (too expensive in start) and AI behaviour in an offensive war
- Fog of war and close view
- A completed peace deal

**What the next run should aim at**
1. A mid or late-game save with World Congress active.
2. A naval landing that is followed through to arrival, plus one sea battle.
3. An offensive war: declare war, march on an enemy city, and command an attacking siege, using deployment and workers on purpose.
4. Re-testing the research era tabs and the build queue dropdown at 844x390, to confirm whether they are layout or hit-area issues.
5. A deliberate check of fog and close view while zoomed in.
6. Re-running the diplomacy, peace and auto-siege feedback paths after fixes.

---
255 steps, play $5.01 (claude-opus-5-5) + report $0.28 (claude-opus-5-5) = $5.28. Diary: `diary.jsonl`, noted screens: `shots/`.
