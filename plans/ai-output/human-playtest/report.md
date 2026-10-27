# Human playtest: battle-commander, battles

# Battle playtest report: battle-commander persona, phone 844x390, English

## 1. Summary

The model played four battles from the battle sandbox, one per age: bronze open field, kingdoms walled city, gunpowder naval, and information-age sack defense. All four started and all four reached a result screen. There were no harness errors and no page errors.

The two short battles went well. The naval fight was won in 1:25 and the sack defense was held in 1:14. In both, "select all, arm Attack, tap the enemy" worked and the result screens were readable. The naval battle was the high point of the run (fun 4).

The two long land battles were the opposite. The bronze field battle timed out at 20 minutes with 0 men lost on either side and was scored a Defeat. The walled city assault never reached the walls and was lost. Across these, the player kept looping through Attack taps and an unwanted radial menu. Part of this may come from how the model tapped (it often tapped the ground twice after arming Attack), but the game gave it no feedback either way.

The three things that matter most:

1. **Land battles can stall with no explanation, and a stall ends in defeat.** In bronze-field (steps 7 to 30), neither army fought for 20 minutes, the enemy AI never came either, and the timeout counted as a loss. Nothing on screen says an order was taken or why nobody is fighting.
2. **No clear way to attack walls, gates or buildings.** In kingdoms-walls (steps 42 to 63), the win text says "burn 10 buildings", but the player could not find how. The Enemy button shows targets but cannot order an attack on them.
3. **The result screen numbers contradict themselves.** This happened in 2 of the 4 battles (steps 82, 102), for example "lost 0 of 63,000" next to "1 regiment destroyed". It undermines the one screen every player reads.

## 2. Scorecard by area

| Area | Score /10 | Why |
|---|---|---|
| Battle setup screen (age, armies, terrain, walls) | 6 | Usable, but Fight sits below the fold and needed a scroll every time (steps 1, 34, 85, 96). The options themselves were never explored. |
| Deploy phase | 3 | Tutorial overlays were cramped (3 to 5) and the deploy panel covers much of the screen (87). The player never actually placed troops. |
| Selection and orders on touch | 4 | Select all plus arm Attack worked in the short battles (88 to 93, 99 to 101). Land battles produced repeated radial menu popups and no visible confirmation that an order was taken. Circle select and draw path were never tried. |
| Unit readability and size | 3 | "Units are tiny and hard to read" on a 390 px tall screen (12). |
| Speed and smoothness | 6 | The speed control works and 2x was reached (13). Whether 3x was ever reached is unclear (14). No lag was reported. |
| Combat clarity (who is winning, damage, morale, rout) | 5 | Army percentages (39% vs 81%, step 67) and the "Knights shaken" morale alert (65) read well. During a stall, 100% vs 100% gives no hint of what is wrong (28, 53). |
| Powers | 5 | The menu opens and Rally Cry was cast (18, 66). The arm banner lingers over the field (22), and no effect of Arrow Storm was reported (21). |
| Camera pan and zoom | 4 | A minimap tap went to empty land (24, 25). The Enemy button's camera cycling with captions was liked (57 to 60). Pinch zoom and drag pan were never tried. |
| Buildings, sieges and walls | 2 | The walls were never assaulted (42 to 63). There was no siege guidance, and the "burn 10 buildings" goal was unclear (60, 70). |
| Economy and workers HUD | 3 | Only glanced at: one laborer was trained (27) and its button greyed out (28). Gathering and building were not seen. |
| Layout on this screen and language | 4 | The HUD and info panels take about a third of the height (12, 28). The top bar shows over the result screen (30). Panels needed repeat taps to close (15, 16, 54). The English text was fine. |
| End of battle and the result screen | 5 | Layouts were clear (94 praised). Two screens had contradictory counts (82, 102), and the timeout defeat was not explained (30). |
| Naval | 7 | The battle started, the controls worked, and it was won quickly with a clear result (88 to 95). Only plain attack was tested. |
| Fun | 4 | Fun peaked at 4 in naval. It sat at 2 for most of the land battles, with frustration reaching 5. |

## 3. Scorecard by age

| Session | Kind of battle | Score /10 | Started | Played to end | Who won | Why |
|---|---|---|---|---|---|---|
| bronze-field | Open field, bronze age | 3 | Yes | Yes (20 min timeout) | Enemy (Defeat by timeout) | 0 men lost on either side. Units clumped at camp and neither side engaged. The loss came with no explanation. |
| kingdoms-walls | Walled city assault, kingdoms age | 3 | Yes | Yes (timer ran out after the player retreated at 72) | Enemy (Defeat) | The player could not get the army onto the walls. Once it fought at the barracks it collapsed from 39% to 11% (67 to 70). The result screen contradicts itself. |
| gunpowder-naval | Sea battle, gunpowder age | 7 | Yes | Yes (1:25) | Player (Victory) | Controls responded, the fight was readable, and the result screen was clear. It was short, and only attack was used. |
| information-sack | Town defense against a sack, information age | 6 | Yes | Yes (1:14) | Player (Held) | Attack on the tanks at the breach worked first time. The battle was very short with almost no decisions, and the result screen contradicts itself. |

## 4. Fun curve

- **Steps 1 to 27 (bronze, setup to economy): flat.** Fun held at 3 and frustration at 1 to 2. Small irritants included cramped tutorial overlays (3 to 5), the radial menu popping up (11), a panel that would not close (15, 16) and the lingering arm banner (22). Nothing was terrible, but nothing was exciting either.
- **Steps 28 to 33: first dip.** Frustration rose to 3 at step 28, when both armies were still at 100% after minutes. At step 30, the timeout defeat with 0 losses dropped fun to 2 and raised frustration to 4.
- **Steps 34 to 53 (kingdoms): slow slide.** Frustration started at 2 and rose to 3 at step 43 as the Attack and radial menu loop repeated (42 to 52). It reached 4 at step 53, the "stuck in the loop" note.
- **Steps 57 to 66: brief recovery** (fun 3, frustration 3). The Enemy button's target cycling gave the player something new, and an attack order on the barracks finally moved the army (63, 64).
- **Steps 67 to 71: the low point.** Once fighting started, the army collapsed from 39% to 11% against 75 to 81%. Frustration hit 5 at steps 70 and 71.
- **Steps 72 to 84: dead time.** The player retreated and then sat through nine waits, about 85 seconds of real time, until the timer expired (73 to 81). Fun stayed at 2 with nothing to do.
- **Steps 92 to 95 (naval): the peak.** Fun reached 4 and frustration fell to 1. Orders worked, the enemy frigates broke, and the victory screen was clear.
- **Steps 96 to 103 (sack): back to neutral** (fun 3, frustration 1 to 2). The battle worked but was over too fast to be engaging.

## 5. Top issues (ranked by harm to a real player)

### 1. Land battles stall and the timeout counts as a defeat

- **What happened:** In bronze-field, the player selected all 8 squads, armed Attack and tapped toward the enemy (7 to 11). The units clumped near camp. Both armies stayed at 100% (28), and the battle ended "Defeat by timeout at 20 min with 0 men lost on both sides" (30). In kingdoms-walls, the same "100% after many minutes" happened before the barracks order (53).
- **Uncertainty:** It is unclear whether the orders were actually accepted. The model often tapped the ground a second time after arming Attack (9 and 10, 39 and 40, 44 and 45). That second tap may have opened the radial menu or replaced the order. In naval and sack, a single tap after arming worked. However, the enemy AI also never engaged in 20 minutes, which points at the game and not only at the input.
- **Steps:** 7 to 11, 28, 30, 39 to 53.
- **Screenshots:** shots/step-028.jpg, shots/step-030.jpg, shots/step-053.jpg.
- **Suggested fix:**
  - Show clear order feedback: a destination marker, a path line, and units visibly turning.
  - Make the enemy AI seek contact when nothing has happened for a while.
  - Show a "no contact" hint when neither side has taken damage.
  - On a timeout result, explain why the timeout went against the player.

### 2. No working way to assault walls, gates or buildings

- **What happened:** The player tried repeatedly to send the army at the walls and gate (42 to 52). The Enemy button cycles the camera through 4 enemy targets with useful captions, but it cannot order an attack on them (57 to 60). The win text says "burn 10 buildings", but how to do that was unclear. When the army did reach the barracks, it was ground down (67 to 70), and there was "no clear siege guidance" (70). No siege engines were mentioned at any point.
- **Steps:** 42 to 63, 67 to 70.
- **Screenshots:** shots/step-053.jpg, shots/step-060.jpg, shots/step-070.jpg.
- **Suggested fix:**
  - Let a tap on a wall, gate or building with units selected issue an attack, and highlight it as the target.
  - Add an "Attack this" button to the Enemy target caption.
  - Add a short siege tip at deploy that explains how to break walls and burn buildings.
  - Show a burned counter next to the "burn 10" goal.

### 3. The radial menu pops up on ground taps and hides the field

- **What happened:** The radial menu opened during attack orders (11, 41, 46, 49, 52) and covered the battlefield. The player came to treat it as part of the Attack flow, which created the loop described in issue 1.
- **Steps:** 11, 41, 46, 49, 52.
- **Screenshots:** shots/step-012.jpg, shots/step-053.jpg.
- **Suggested fix:**
  - Open the radial menu only on a long press.
  - Never open it while an Attack order is armed or was just issued.
  - Keep it small, and place it away from the tapped point.

### 4. Result screens contradict themselves

- **What happened:**
  - Kingdoms (82): "Theirs lost 0 of 63,000" sits next to "1 regiment destroyed". "Men lost 70,000 of 70,000" sits next to "9 standing at the end". The enemy's percentage had also dropped from 81% to 75% during the fight (67 to 70), so "0 lost" looks wrong.
  - Sack (102): "Yours lost 0 of 63,000" sits next to "1 regiment destroyed".
  - Bronze (30): "0 men lost on both sides" is consistent with the stall, but it was not checked against the screen.
- **Steps:** 82, 102 (also see 30).
- **Screenshots:** shots/step-082.jpg, shots/step-102.jpg.
- **Suggested fix:** Compute men lost and regiments destroyed from the same source. Make "standing at the end" match the men lost figure. Add a check that flags a destroyed regiment alongside 0 men lost.

### 5. Too little of the 390 px height shows the battle

- **What happened:**
  - Tutorial overlays were cramped (3 to 5).
  - The top banner and bottom bars eat the height (12).
  - The camp and win hint panels cover a third of the screen (28, 29).
  - The "4 kinds" panel took two taps, or failed, to close (15, 16, 54).
  - The power arm banner lingers (22).
  - The deploy panel covers much of the screen (87).
  - The top bar draws over the result screen (30).
- **Steps:** 3 to 5, 12, 15, 16, 22, 28 to 30, 54, 87.
- **Screenshots:** shots/step-012.jpg, shots/step-028.jpg, shots/step-030.jpg.
- **Suggested fix:**
  - Use a compact landscape phone HUD and make info panels collapsible.
  - Auto-dismiss hints after a few seconds.
  - Hide the top bar on the result screen.
  - Make close targets larger.

### 6. Units are too small to read on a phone

- **What happened:** "Units are tiny and hard to read" (12). This contributed to the player not knowing where its army was during the stall.
- **Steps:** 12.
- **Screenshots:** shots/step-012.jpg.
- **Suggested fix:** Use a closer default zoom on phones, clear squad banners or icons with health bars, and a stronger selection highlight.

### 7. Dead time after the battle is lost

- **What happened:** After retreating at 72, the player waited through about 85 seconds of real time across steps 73 to 81 for the timer to expire, with nothing to do.
- **Steps:** 72 to 81.
- **Screenshots:** none.
- **Suggested fix:** Add a Surrender or "End battle" button. Alternatively, end the battle automatically once one side is routed or below a threshold.

### 8. Minimap tap lands on empty ground

- **What happened:** A tap on the minimap moved the camera to empty land (24, 25). This may be the model's aim and not a game bug.
- **Steps:** 23 to 25.
- **Screenshots:** none.
- **Suggested fix:** Use a larger minimap on phones, show friendly and enemy markers clearly, and center the view exactly on the tapped point.

### 9. Fight button below the fold on the setup screen

- **What happened:** The player had to scroll to reach Fight in every session.
- **Steps:** 1, 34, 85, 96.
- **Screenshots:** none.
- **Suggested fix:** Pin the Fight button to the bottom of the setup screen.

### 10. Short battles leave almost no decisions

- **What happened:** The naval and sack battles were won in 1:25 and 1:14 with one attack order each. For an RTS fan this is "readable" but thin.
- **Steps:** 88 to 94, 99 to 102.
- **Screenshots:** shots/step-094.jpg, shots/step-102.jpg.
- **Suggested fix:** Tune these sandbox presets for longer, closer fights, or offer a difficulty choice.

## 6. Bugs

No harness errors and no page errors were recorded.

**B1. Battle stalls with 0 losses, then ends as a timeout Defeat (severity 3)**

Steps to reproduce:
1. Open the battle sandbox and set up bronze age, open field.
2. Scroll down and tap Fight.
3. Clear the tutorial and tap start (steps 1 to 6).
4. Tap Select all at (70, 347).
5. Arm Attack at (617, 343) and tap toward the enemy at (700, 200) (steps 7 to 9).
6. Set speed to 2x (step 13) and let the battle run.

Result: both armies stay at 100%, units clump at camp, and at 20 minutes the result is "Defeat by timeout" with 0 men lost on either side (step 30, shots/step-030.jpg).

Unclear: whether the extra ground taps at steps 10 and 11 cancelled the order. The enemy AI also never attacked.

**B2. Walled assault: attack orders do not engage walls or gate (severity 3)**

Steps to reproduce:
1. Set up kingdoms age, walled city assault, and tap Fight, then start (steps 34 to 36).
2. Select all, arm Attack, and tap toward the walls (37 to 40).
3. Repeat (42 to 52).

Result: units barely engage, both sides stay at 100%, and the radial menu keeps opening (step 53, shots/step-053.jpg).

This may be a missing feature (no way to target walls) as much as a bug.

**B3. Result screen counts contradict each other (severity 2)**

Steps to reproduce, first case:
1. Play kingdoms-walls to a defeat (steps 34 to 81).
2. Read the result screen: "Theirs lost 0 of 63,000" appears with "1 regiment destroyed", and "Men lost 70,000 of 70,000" appears with "9 standing at the end" (step 82, shots/step-082.jpg).

Steps to reproduce, second case:
1. Play information-sack and win (96 to 101).
2. Read the result: "Yours lost 0 of 63,000" appears with "1 regiment destroyed" (step 102, shots/step-102.jpg).

**B4. Top bar draws over the result screen (severity 2)**

Steps to reproduce:
1. End any battle, for example bronze-field by timeout.
2. The top HUD bar still shows over the result screen (step 30, shots/step-030.jpg).

**B5. Info panel does not close on the first tap (severity 1, unclear)**

Steps to reproduce:
1. During a bronze-field battle, tap the close control of the "4 kinds" selection panel at (598, 131) (step 15).
2. The panel stays, and a second tap was needed (step 16). A similar close tap was needed again in kingdoms at (490, 131) (step 54).

This may be a missed tap target and not a game bug. No screenshot.

**B6. Power arm banner lingers after aiming (severity 1)**

Steps to reproduce:
1. Open Powers at (725, 345) and arm Arrow Storm at (690, 280).
2. Tap the target at (690, 225) (steps 19 to 21).
3. The arm banner stays over the field until it is closed by hand (step 22).

It is also unclear whether Arrow Storm fired. No screenshot.

**B7. Speed button reached only 2x (severity 1, unclear)**

Steps to reproduce:
1. During a battle, tap the speed control at (678, 20). It goes to 2x (step 13).
2. Tap at (729, 22), intending 3x (step 14). The result was not reported.

The control may cycle by design. No screenshot.

**B8. Laborer train button greys out while training (severity 1, unclear)**

Steps to reproduce:
1. Open Base at (230, 356).
2. Tap train laborer at (500, 331) (steps 26, 27).
3. The button greys out (step 28, shots/step-028.jpg).

This may be intended single-queue behavior. If so, a progress indicator would help.

## 7. What was fun, and what else was good

- **The naval battle (88 to 95)** was the best moment of the run. Orders responded at once, the player could see the enemy frigates breaking (92), and fun reached 4.
- **The naval victory screen** was praised (94, shots/step-094.jpg). It shows men lost, XP per frigate, and that sunk ships are gone for good.
- **"Select all, arm Attack, tap enemy" is quick on touch** when it works (88 to 90, 99 to 101).
- **Clear combat readouts.** Army percentages (67 to 70) and the "Knights shaken" morale alert with a Rally prompt (65, 66) were understood immediately.
- **The Enemy button** cycles the camera through enemy targets with helpful captions (57 to 60). It is a good basis for target selection.
- **The powers menu** opens, and Rally Cry casts without trouble (17, 18, 66).
- **Result screen layouts** were called clear in all four sessions, setting the number errors aside.
- **After a battle the game returns to the setup form** (32), which makes replays quick.
- **Stability:** no page errors and no harness errors, and every battle started and drew.

## 8. Coverage

The model claimed at steps 84, 95 and 103 that it had "covered the whole checklist". That claim is not supported by the diary.

**Played properly:**
- Selection and orders, but only Select all plus attack-move.
- Combat clarity.
- End of battle and the result screen, in all four sessions.
- Naval, but only a basic attack.
- An attempted walled assault.

**Only glanced at:**
- Setup screen: only Fight was tapped, and no options were changed.
- Deploy: the player tapped start every time and never placed troops.
- Powers: two powers tried, and Arrow Storm's effect was unconfirmed.
- Camera: the Map button, one minimap tap, and Enemy cycling.
- Economy: one laborer trained.
- Speed: one change.
- Readability: one note.

**Missed:**
- Circle select, draw a path, single-unit selection, and focus fire on land.
- Pinch zoom and drag pan.
- Workers gathering, building construction, and siege engines.
- Retreat behavior beyond one tap.
- Rout.
- Naval tactics beyond attacking.

**Ages:** four of eight were played: bronze, kingdoms, gunpowder and information. The other four, including stone and future, were not reached.

**What the next run should aim at:**
1. A walled assault in which the player taps a wall, gate or building directly with units selected, and checks for siege units and the burn goal.
2. Issue each order with exactly one tap after arming Attack, then watch for a few seconds before tapping again. This separates input confusion from real stalls, and it rechecks the bronze open field to see whether the enemy AI ever engages.
3. Real deploy placement, circle select and draw path, plus a flank or focus fire test on land.
4. The economy loop: train workers, gather, build, and check the HUD.
5. Camera gestures (pinch, drag) and the minimap at phone size.
6. A longer naval fight that uses powers and maneuvering.
7. The unplayed ages, at least stone and future.
8. A recheck of the result screen numbers after B3 is fixed.

---
103 steps, play $1.00 (claude-sonnet-5-5) + report $0.27 (claude-opus-5-5) = $1.27. Diary: `diary.jsonl`, noted screens: `shots/`.
