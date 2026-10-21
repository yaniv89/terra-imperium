# Human playtest: hebrew-speaker, battles

# Playtest report: Hebrew speaker, battle sandbox, phone 844x390

## 1. Summary

A Hebrew-speaking persona played four battle sessions on a phone in landscape: a stone age open field battle, a kingdoms age walled city assault, an information age sea battle and a future age sack defence. All four battles started. Only one, the sack defence, reached a result screen, and that result was a defeat the player found unfair. The Hebrew right-to-left layout was judged correct and most of the HUD read well in Hebrew. However, one session showed a power or orders menu with English labels, and some toasts were hard to read or sounded wrong. Fun never rose above 3 out of 5. Frustration reached 4 twice, once in the sea battle and once at the defeat screen. The harness caught no page errors and logged no harness-error lines.

**The three things that matter most:**
1. **The sea battle cannot be played.** The map had no water, the ships were drawn on land and no enemy fleet could be found (steps 94 to 109).
2. **The sack defence cannot be finished fairly.** The last raider could not be found or reached, and the timeout then gave a defeat (תבוסה) even though the city had lost only 2 of 12 buildings (steps 123 to 149).
3. **Battles stall with no clear progress.** The stone field battle had no contact in 50 steps while the enemy "arrived" unit by unit. The walled assault stalled with 2 horsemen left and no way to tell who was winning. Neither battle reached an end.

## 2. Scorecard by area

| Area | Score /10 | Why |
|---|---|---|
| Battle setup screen (age, armies, terrain, walls) | 6 | Fight (להילחם) worked every time, but it sits below the fold and needed a scroll in every session (1, 51, 92, 110). No setup option was ever changed. |
| Deploy phase | 5 | The start button in the deploy panel worked (3, 53, 94, 112) and the hint was Hebrew. No units were ever placed, so this was only glanced at. |
| Layout on this screen and language | 5 | RTL layout was correct (151) and power names were Hebrew in the stone session (8). The menu in the kingdoms session was in English (63). The powers list was cut off and overlapped the selection chip (8). The enemy toasts were hard to read in Hebrew (28). |
| Selection and orders on touch | 4 | Select all works but had to be tapped again and again (dozens of times). The selected count shrank from 10 to 6 to 2 (66, 68). Attack-move in the sea battle did not move the ships (99). Circle select and path drawing were never tried. |
| Powers | 5 | The panel opened and Retreat visibly worked, then the menu closed (66). There were no cost or cooldown details (8). The menu stayed open over the HUD (63). The effect of Forced March was never reported (9, 58). |
| Camera pan and zoom | 5 | Pinch zoom worked in both directions (10, 59, 106). A minimap tap jumped to the wrong place (72). The camera inside the dense city hid units (89). Drag-to-pan was never tried. |
| Combat clarity (who is winning, damage, morale, rout) | 3 | Health bars were clear when zoomed in (60). The enemy button only reported arrivals (28, 50). The player said "hard to tell who is winning" (85). The last raider was invisible (130). |
| Speed and smoothness | 7 | The speed button went to 2x and 3x (17 to 19). No lag was reported. "Screen barely changes" (80) is about pacing, not performance. |
| Fun | 3 | Fun peaked at 3 and never went higher. Three of four sessions ended in waiting or stalling. |
| Economy and workers HUD | 6 | Training a worker showed the cost (50 food) and progress (33%), and the panel read clearly in Hebrew (31). Only one action was tried. |
| End of battle and the result screen | 3 | It was reached once (149). The result screen and the return to setup worked (151), but the defeat at timeout felt unfair, and two other battles never ended. |
| Buildings, sieges and walls | 3 | The siege tower was readable (60), but there was no feedback on wall damage or breaching. The assault stalled and city buildings hid units (89). |
| Unit readability and size | 6 | Units were tiny when zoomed out (50). Zoomed in, units and health bars were clear (60). |
| Naval | 1 | The only naval session had no water and no enemy fleet (108). |

## 3. Scorecard by age

| Session | Age and kind of battle | Score /10 | Started | Played to end | Who won | Why |
|---|---|---|---|---|---|---|
| stone-field | Stone age, open field | 3 | Yes (3) | No | None, ended at step 50 with no fight | The enemy trickled in unit by unit for about 45 steps. The player sent units forward only once (6), so it is unclear whether contact was possible sooner. |
| kingdoms-walls | Kingdoms age, walled city assault | 3 | Yes (53) | No | Unclear, the player's side was down to 2 horsemen | The assault stalled. The minimap jump was wrong, the camera was buried in buildings, the menu had English labels and there was no progress read-out. |
| information-naval | Information age, sea battle | 1 | Yes (94), drew a land-only map | No | None | There was no water and no enemy fleet. The ships sat on land and barely moved. |
| future-sack | Future age, sack defence | 4 | Yes (112) | Yes, by timeout (149) | Enemy (defeat shown) | The fight went well until one raider was left. That raider was unreachable, and the timeout gave a defeat despite only 2 of 12 buildings lost. |

## 4. Fun curve

- **Stone field.** The session opened at fun 3, frustration 1 (steps 1 and 2) and settled at 3/2 from step 3. Endless enemy-button taps (11 to 49) wore the player down. Fun fell to 2 and frustration rose to 3 at the boredom note (28 and 29). Training a worker gave a brief recovery to 3/2 (30 and 31). Frustration returned to 3 from step 35 and stayed there to step 50, where fun was 2 again.
- **Kingdoms walls.** The session started at 3/2 (51 to 62). Frustration rose to 3 at step 63, when the English labels and the menu covering the HUD appeared. It stayed at 3 through the minimap confusion (72 to 75). Fun dropped to 2 at step 83 as the assault stalled, and stayed there to the end (91).
- **Information naval.** The session started at 3/1 (92 and 93) and fell to 2/3 at step 99, when the ships would not move. It hit the low point of the run at 2/4 (108 and 109): no water, no fleet, nothing to fight.
- **Future sack.** This was the best stretch of the run. It held 3/1 from step 110 to 115, while the fight was on and orders worked, and 3/2 through step 128. Frustration went to 3 at step 129, fun to 2 at step 130 once the last raider could not be found. The session then sat at 2/3 through a long timeout wait (136 to 148). Frustration spiked to 4 at the defeat screen (149).

**Peak:** the opening of each session, especially the future sack fight (110 to 128), where orders produced an actual fight.

**Sinks:** the waterless sea battle (108 and 109) and the unfair defeat (149). The long waits (stone 11 to 49, sack 136 to 148) dragged the curve down slowly rather than sharply.

## 5. Top issues (ranked by harm to a real player)

### 1. The sea battle has no water and cannot be played
- **What happened:** The ships were drawn on a dirt road and grass. Zooming out showed only land and no enemy fleet. The enemy button jumped to empty grass with a "their fortress" toast. Attack-move did not move the ships at first, then they moved slowly on land.
- **Steps:** 94, 95, 97 to 109.
- **Screenshots:** shots/step-095.jpg, shots/step-102.jpg, shots/step-108.jpg
- **Suggested fix:** Validate that the chosen Earth tile has enough water before offering or starting a naval battle, and fall back to a coastal tile if it does not. Make sure enemy ships spawn and that the enemy button targets the fleet, not a fortress.

### 2. The sack defence ends in defeat at timeout despite a near-total win
- **What happened:** The raiders were down to 1 by step 123. The city lost only 2 of 12 buildings. When the timer ran out, the result was תבוסה (defeat). A toast near the end said to hold position (146), which suggests the defender's goal was to hold until time ran out. If so, defeat at timeout looks like an inverted win rule. The diary does not show the stated win condition, so this needs checking.
- **Steps:** 123 to 149.
- **Screenshots:** shots/step-130.jpg, shots/step-149.jpg
- **Suggested fix:** Check the timeout rule for the defender in sack battles. Award victory, or at least a holding result, when the defenders survive. Count a lone, cut-off raider as routed.

### 3. The last raider cannot be found or reached
- **What happened:** The enemy button only said the enemy base was unseen and scouts were needed (127). An orange marker found via the map (135) sent units toward it, but they got stuck near a bridge (138).
- **Steps:** 126 to 138.
- **Screenshots:** shots/step-130.jpg
- **Suggested fix:**
  - When few enemies remain, have the enemy button jump to the nearest known enemy unit, not the base.
  - Reveal or highlight the last few enemy units.
  - Check pathing over bridges.

### 4. The open field battle has no fight for 50 steps
- **What happened:** The enemy kept "arriving" in pieces: "2 of 3 fortress", "spearmen 1 of 3", "longbowmen 4 of 4", "archers 5 of 5". The counts kept resetting, as if new waves kept spawning. The enemy button only reported arrivals and never showed where the enemy was. Even at 3x speed no contact happened.
- **Unclear:** The player ordered a move toward the enemy only once (step 6) and never marched to the enemy edge, so the enemy may have been reachable. The wait is still a real pacing problem.
- **Steps:** 6, 11 to 50.
- **Screenshots:** shots/step-028.jpg, shots/step-050.jpg
- **Suggested fix:**
  - Have the enemy army start on the field, or arrive in one block.
  - Make the enemy button move the camera to the visible enemy force.
  - Add a clear "the enemy is gathering" countdown, or allow skipping to contact.

### 5. English labels in the Hebrew UI
- **What happened:** In the kingdoms session the menu showed Entrench, Volley, Charge, Ambush, Retreat, Stop, Hold and Forced March in English. In the stone session the powers panel was in Hebrew (8). This menu may be the orders or stance menu rather than the powers list, since it includes Stop and Hold, so one surface is localised and another is not.
- **Steps:** 63, 66.
- **Screenshots:** shots/step-063.jpg, shots/step-066.jpg
- **Suggested fix:** Run a string audit on the power and order menus for every age in the he locale. Use the same Hebrew names as the stone age powers panel (for example צעדת כפייה for Forced March).

### 6. The walled assault stalls with no progress feedback
- **What happened:** After Retreat, select all picked 6 units, then only 2. The camera ended up buried in city buildings. There was no read-out of wall health, enemy strength or the objective, and no result appeared.
- **Unclear:** The shrinking selection may simply be casualties.
- **Steps:** 65 to 91.
- **Screenshots:** shots/step-085.jpg, shots/step-089.jpg
- **Suggested fix:**
  - Add a force comparison bar and an objective or wall-health indicator.
  - Fade or cut away buildings that hide units.
  - Show losses when the army count drops.

### 7. The minimap tap jumps to the wrong place
- **What happened:** A tap on the minimap moved the camera to an empty river area, not the spot tapped. It took two more taps to recover.
- **Unclear:** This may be a mismatch between tap position and minimap coordinates, or a missed tap.
- **Steps:** 70 to 75.
- **Screenshots:** shots/step-072.jpg
- **Suggested fix:** Check the minimap coordinate mapping in RTL layout and at 844x390. A mirrored x axis is a likely suspect in Hebrew.

### 8. Powers panel layout problems
- **What happened:**
  - The list was cut off at the bottom and overlapped the selection chip (8).
  - The menu stayed open and covered the top HUD (63).
  - No cost or cooldown was shown.
- **Steps:** 7, 8, 57, 63.
- **Screenshots:** shots/step-008.jpg, shots/step-063.jpg
- **Suggested fix:** Make the list scrollable inside safe bounds on short landscape screens, close it when the player taps the map, and show the cost and cooldown on each entry.

### 9. Confusing toast wording
- **What happened:**
  - The enemy arrival messages were "hard to read in Hebrew" (28).
  - The sea battle showed a "their fortress" toast (102).
  - Stone age arrivals were named fortress and longbowmen, which sounds wrong for the age. This may come from translation or from wrong unit data; it is unclear.
- **Steps:** 22, 24, 33, 34, 102.
- **Screenshots:** shots/step-028.jpg, shots/step-102.jpg
- **Suggested fix:** Have a native speaker review the enemy-button and arrival toasts, and check the unit names per age.

### 10. The Fight button is below the fold on a phone
- **What happened:** The player had to scroll in every session before tapping Fight.
- **Steps:** 1, 51, 92, 110.
- **Screenshots:** none.
- **Suggested fix:** Make the Fight button sticky at the bottom of the setup screen on short landscape screens.

## 6. Bugs

No harness-error lines were logged and no page errors were caught.

### B1. Naval battle generates a land-only map
1. Set up an information age naval battle.
2. Scroll down and tap Fight.
3. Tap the start button in the deploy panel.
4. Observe that the ships are on grass or road and there is no water.
5. Pinch out twice and observe that there is no water and no enemy fleet.
6. Tap the enemy button. The camera goes to empty grass with a "their fortress" toast.

Steps 92 to 108. Screenshots: shots/step-095.jpg, shots/step-102.jpg, shots/step-108.jpg

### B2. Ships do not respond to attack-move
1. In the naval battle, tap select all, then attack-move (תקיפה).
2. Tap the ground ahead twice.
3. The ships did not move (99), then moved slowly on land (100).

This is likely a side effect of B1. Steps 96 to 100.

### B3. Sack defence: timeout gives a defeat while the defender holds the city
1. Start a future age sack defence.
2. Select all, attack-move toward the raiders and let the battle run.
3. Reduce the raiders to 1 while the city loses 2 of 12 buildings.
4. Wait for the timer to reach 0. The result shows תבוסה (defeat).

Steps 112 to 149. Screenshots: shots/step-130.jpg, shots/step-149.jpg

### B4. Sack defence: the last raider is unlocatable and units stall at a bridge
1. Same setup as B3. With one raider left, tap the enemy button.
2. The toast says the enemy base is unseen and scouts are needed.
3. Open the map and tap the orange marker on the right.
4. Units head toward it and get stuck near the bridge.

Steps 126 to 138. Screenshot: shots/step-130.jpg

### B5. English strings in the he locale menu
1. Set the language to Hebrew and start a kingdoms age walled assault.
2. Open the powers button (bar, around x=383).
3. The labels Entrench, Volley, Charge, Ambush, Retreat, Stop, Hold and Forced March show in English.

Steps 57 to 63. Screenshot: shots/step-063.jpg

### B6. Minimap tap moves the camera to the wrong location
1. In the walled assault, tap the map button.
2. Tap the minimap at about (125, 150).
3. The camera lands on an empty river area instead of the tapped spot.

It needs confirming that this was not a missed tap. Steps 70 to 72. Screenshot: shots/step-072.jpg

### B7. Powers panel is clipped and overlaps the selection chip
1. Start a stone age field battle and select all.
2. Tap powers.
3. The list is cut off at the bottom and overlaps the selection chip.

In the kingdoms session the menu also stayed open over the top HUD (63). Steps 7, 8, 63. Screenshots: shots/step-008.jpg, shots/step-063.jpg

### B8 (to verify). Selection count drops after Retreat
1. In the walled assault, select all (10 units).
2. Use Retreat. The selection shows 6.
3. Select all again. It shows 2.

This may be casualties, not a bug. The game gives no feedback on losses. Steps 65 to 69.

## 7. What was fun, and what else was good

**What was fun:**
- The opening of the future sack defence. Select all, attack-move and the fight played out, with the raiders cut down to one (113 to 123).
- The Retreat power had a visible effect, pulling units back from the walls (66).

**What else was good:**
- **Hebrew presentation:**
  - The RTL layout looked correct on the result screen and on return to setup (151).
  - The stone age powers panel used Hebrew names and statuses: יכולות וכוחות, מוכן, צעדת כפייה (8).
  - The deploy hint and most of the HUD were in good Hebrew (60, 95).
- **Economy:** The worker training panel was clear, with the cost and a progress bar (31).
- **Readability:** Zoomed in, units, the siege tower and health bars were readable (60).
- **Pace and stability:**
  - The speed control (2x, 3x) worked at once (17 to 19).
  - The result screen appeared and the continue button returned to setup cleanly (150, 151).
  - There were no page errors and no harness failures.

## 8. Coverage

**Ages played:** stone (field), kingdoms (walls), information (naval) and future (sack). The other four ages were not touched.

**Areas played properly:**
- Selection with select all and attack-move
- Powers
- Pinch zoom
- Speed control
- End of battle (once)

**Areas only glanced at:**
- **Battle setup:** no age, army, terrain or wall option was ever changed.
- **Deploy phase:** the start button only, no placement.
- **Economy:** one worker trained.
- **Buildings, sieges and walls:** no breach was seen.
- **Unit readability:** a single zoom check.
- **Camera:** the minimap was tried, drag-to-pan never was.

**Missed or blocked:**
- **Naval:** the map was broken.
- **Circle select and path drawing:** never tried.
- **Morale and rout display:** never observed.
- **Victory screen:** never seen.

**Aims for the next run:**
1. A naval battle on a tile confirmed to have water, played to the end.
2. A walled assault where siege engines actually breach a wall, to see wall damage feedback and a result.
3. Re-run the sack defence to confirm the timeout rule and test pathing over the bridge.
4. Re-run the stone field and march straight to the enemy edge, to separate player passivity from enemy trickle-in.
5. Try circle select, path drawing and drag-to-pan on the phone.
6. Change setup options and place units during deploy.
7. Cover the four unplayed ages.
8. In the he locale, open the powers and orders menus in every age to find every English string, and check the minimap mapping under RTL.

---
151 steps, play $1.48 (claude-sonnet-5-5) + report $0.27 (claude-opus-5-5) = $1.74. Diary: `diary.jsonl`, noted screens: `shots/`.
