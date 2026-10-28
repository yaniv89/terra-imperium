# Human playtest: battle-commander, battles

# Playtest report: battle sandbox, battle-commander persona

Phone 844x390, English, 8 sessions, 316 steps. No page errors. No harness-error lines, so every session's battle started and drew.

## 1. Summary

An RTS veteran played one sandbox session in each of the eight ages: two open-field battles, two walled assaults, two naval sessions and two sack defenses. Every battle started. The core look works: the setup screen, select-all, the Enemy button and minimap jump, the powers list and aiming, the speed buttons, the strength bar and the result screens all read well. The player was undone by the layer between intent and action. Orders were silently dropped or undone, squads drifted back to idle, and camera drag and pinch did little. Several battle modes also could not really be played. Sack defenses ended after 44 seconds or became unwinnable. The gunpowder field battle ran 20 minutes with zero losses on either side. Fun sat at 3 out of 5 for most of the run, touched 4 only in a few moments (fresh walled city, naval Charge, artillery barrage, gate breach), and ended at 2 in five of eight sessions.

**The three things that matter most**

1. **Orders are unreliable on touch.** The Attack button plus tap, the radial menu's Attack, and Attack plus a minimap tap all failed silently at times, with no feedback. Squads that did move often went back to idle near home. This cost whole battles (steps 29-32, 64-69, 165-195, 296-299).
2. **Two battle modes are broken in pacing or win logic.**
   - Sack defense: raiders withdrew at 0:44, 0:44 and 1:08 (steps 126, 139, 157).
   - Future sack: lost to one raider tank that nothing could damage (steps 298-312).
   - Gunpowder "open field": turned into a 20-minute timeout over buildings with no fighting (step 197).
3. **The phone layout hides the battlefield.**
   - The deploy panel and tutorial cover about 70% of the screen, and the collapse chevron expands the panel instead (steps 3, 7-8, 100-101, 242-243, 281-282).
   - Drag-to-pan and pinch zoom barely work (steps 14-16, 24, 180-181, 206-208).
   - Endings happen under the bottom button bar (step 113).

## 2. Scorecard by area

| Area | Score | Why |
|---|---|---|
| Battle setup screen (age, armies, terrain, walls) | 7/10 | Clear and keeps last picks. Fight is below the fold (315), a dropdown tap fell through to a checkbox (143), and naval setup is invisible in the pickers (81, 253). |
| Layout on this screen and language | 4/10 | Overlays cover about 70% of the screen and the title is cut to "SAND..." (3). Raw key "attacker (lossesDecisive)" (98, 253). Naval text says keep, squad, army (83, 117, 241, 276). Alerts pile up (236). Speed buttons sit over the result panel (250, 272). |
| Deploy phase | 4/10 | Chevron expands instead of collapsing (7-8, 101, 243, 282). No selection feedback on a banner (9-10). Single ship taps fail (255-256). All plus a tap does place the fleet (260). |
| Selection and orders on touch | 3/10 | Attack plus tap, radial Attack and minimap targets were dropped silently (32, 66, 69, 165-169). The Attack toggle turned itself off (171). Squads drift idle (173-195). Ship tap and box select fail (106, 109). Path and focus fire work (111-112, 263, 266). |
| Camera pan and zoom | 4/10 | Drag rarely pans (15-16, 207-208) and once opened the radial menu (185). Pinch barely or never zooms (24, 181). Enemy, Follow and minimap jump work (17, 23, 26). Idle throws the camera home (230). The breach Go button does not move the camera (233). |
| Buildings, sieges and walls | 5/10 | The walled city looks great (45). "Attack it" and the gate-breach alert work (209, 232), and building counts drop (216). There is no breach-and-push flow, squads idle at walls (221, 238), and both assaults ended without a break-in. |
| Powers | 6/10 | Clear list, aiming and toasts. In-context Rally (19, 52-53, 78, 213-214, 289). Arrow Storm did nothing while paused in one session (136). Only land powers at sea, and Charge had no visible effect (87, 248, 269). |
| Economy and workers HUD | 3/10 | Barely reached. Steward toggled with no panel (21). The camp trains only laborers (55). Other buildings open nothing (56-58). Workers were never used. |
| Speed and smoothness | 7/10 | Pause, 2x and 3x are easy to hit and work (21, 37, 50, 131, 167, 301). No lag reported. Sluggish drag is a camera issue, not frame rate. |
| Combat clarity (who is winning, damage, morale, rout) | 5/10 | The You vs Them bar and "shaken" toasts are clear (34, 88, 264). The army went from 30% to 0% with no explanation (36). There was no feedback when units could not hurt a tank (306), and "-50 attrition" is unexplained (236). |
| Unit readability and size | 6/10 | Ships are big and readable (119, 278) and target rings show. Minimap dots are hard to read (226, 238). Thin evidence: only step 33 was tagged here. |
| End of battle and the result screen | 5/10 | Readable, and the XP lines are liked. On the other side: dead time with no surrender (36-39), sudden or off-screen endings (95, 113, 250), mismatched numbers (40, 126, 272) and confusing defeat reasons (197, 314). |
| Fun | 4/10 | Mostly 3s. Peaks of 4 came from good moments, but five sessions ended at fun 2. |
| Naval | 5/10 | Fast, readable fleet clashes. Path and focus fire work. Land wording, land powers, untappable single ships and shallow 1-2 minute fights. |

## 3. Scorecard by age

| Session | Kind | Score | Started | Played to end | Result | Why |
|---|---|---|---|---|---|---|
| stone-field | Open field | 4/10 | Yes | Yes | Enemy won (Defeat) | Attack plus tap failed until a long press (32). The army vanished from 30% to 0% (36), then dead time until the camp burned (38). The result screen shows 76,000 lost against 0 (40). |
| bronze-walls | Walled city assault | 4/10 | Yes | Yes | Enemy won (Defeat on the 20 min clock) | Beautiful city. Radial and minimap attacks were dropped (66, 69) and trained squads piled up idle (62-63). |
| classical-naval | Naval, 3 battles | 6/10 | Yes, all 3 | Battles 1 and 2 yes; battle 3 no (session ended at step 120) | Player won 1 (2:09) and 2 | Quick, readable fights with path drawing that works. Ship tap select failed (106). Land wording throughout. The summary claims three wins, but the diary never shows battle 3 ending. |
| kingdoms-sack | Sack defense, 3 battles | 2/10 | Yes, all 3 | Yes | Player "Held" each time (enemy withdrew at 0:44, 0:44, 1:08) | Over before the player could act. Arrow Storm failed while paused (136). Workers and walls were never used. |
| gunpowder-field | Open field | 2/10 | Yes | Yes | Enemy won (Defeat on time, "they held") | 20 minutes with 0 losses on either side. Squads kept going idle and drifting home (181). Pinch did nothing. The goal was burning 11 buildings, not field battle. |
| modern-walls | Walled city assault | 5/10 | Yes | No (out of steps) | Undecided (You 26% vs Them 28%) | The best siege moments: barrage, building burned, gate breach (214-232). Idle throws the camera home, alerts pile up, and the push stalled at the walls (236). |
| information-naval | Naval, 3 battles | 5/10 | Yes, all 3 | Battles 1 and 2 yes; battle 3 no (started at 277, then out of steps) | Battle 1 player won (1:03), battle 2 enemy won (2:25) | Focus fire and path work. The defeat was unexplained (272). Charge did nothing at sea. Same land text and raw key. |
| future-sack | Sack defense | 3/10 | Yes | Yes | Enemy won (Defeat at the clock) | Won the fight on paper but lost to one raider tank that infantry would not shoot and three barrages barely scratched (306, 312). Burn limit of 2 was never stated (314). |

## 4. Fun curve

- **Start, steps 1-30.** Flat at fun 3, frustration 1 to 2. The overlays (3), the chevron (8) and camera drag (14-16, frustration 3 at 16) were mild annoyances.
- **First dip, steps 31-40.** Fun fell to 2 when the Attack order failed (31), then when the army evaporated and the battle became dead time (36-40).
- **First lift, steps 41-48.** The bronze city view brought the first 4 (45), "a lovely walled city with a ziggurat."
- **First real low, steps 66-69.** Frustration reached 4 when the radial and minimap Attack orders did nothing and the army sat at camp.
- **Recovery, steps 70-71.** Recovered when a tower tap finally worked.
- **Naval high, steps 88-96.** Fun 4 at steps 88-90 and 95-96: Charge broke an enemy trireme and the fleet won quickly and readably.
- **Second low, steps 126-159.** Kingdoms sack is the longest trough, fun 2 for almost all of it. Frustration hit 4 at 139 and 157 as the battles kept ending at 44 seconds and 1:08 with nothing played.
- **Gunpowder grind, steps 170-198.** Fun stayed at 2 to 3 while orders dropped and squads drifted home. Frustration reached 4 at steps 194-195, and the battle ended with no fight at all.
- **Run peak, steps 214-232.** Modern walls brought the most sustained fun: 4 at 214, 216, 217 and 232 for the barrage, a burning building, in-context Rally and the gate breach. This is the clearest picture of what the game can feel like.
- **Brief high, step 247.** Information naval opened with a 4 as two destroyers went down early.
- **Final slide, steps 271-273 and 298-316.** Fun fell after the unexplained naval defeat (271-273). In the future sack, frustration sat at 4 from 306 to 312 because the battle could not be won.

**Pattern:** fun rose when a single action produced a visible result (barrage explosions, a ship breaking, the breach banner). It sank whenever an order vanished or the battle's rules took control away from the player.

## 5. Top issues (ranked by harm to a real player)

### 1. Orders are dropped silently

**What happened**
- Attack button plus a ground tap did nothing, while a long press worked (29-32).
- The radial menu's Attack did nothing for 30+ seconds (64-66).
- Attack plus a minimap tap only moved the camera (67-69, 165-169).
- Tapping Attack while it was armed turned it off with no clear feedback (170-171).
- Attack on the last tank did nothing, while a plain tap did move the squads (296-300).
- The same gestures worked at other times (70-71, 75-77, 204-205), which makes the controls feel random.

**Screenshots:** shots/step-032.jpg, shots/step-066.jpg, shots/step-069.jpg, shots/step-298.jpg

**Fix**
- Every order should show a confirmation: a marker on the ground or a target ring plus a short sound or flash.
- When an order is rejected, say why ("no path", "can't target from minimap", "out of range").
- Either let the minimap accept an armed order, or disarm Attack when the minimap is tapped.
- Make the Attack button show a clear armed state and do not toggle it off when it is tapped again.

**Unclear:** some single-tap misses may be coordinate or hit-area issues, not order logic.

### 2. Squads drop orders and drift back to idle near home

**What happened**
- Gunpowder field: attack-move, plain move and path orders all decayed. Idle climbed from 2 back to 9, 21-23 and 37 again and again (173-195).
- The battle ended with 0 losses on either side (197).
- Trained squads in bronze piled up idle at camp (62-63, 74).
- Modern walls squads went idle in front of the walls (221, 229).

**Screenshot:** shots/step-181.jpg

**Fix**
- Check for a leash or return-to-home behavior that overrides player orders.
- Keep attack-move active until the target area is clear.
- Give newly trained squads a rally point.

**Unclear:** the diary cannot tell whether this is a deliberate leash, pathing failure or morale behavior. It needs a log check.

### 3. Sack defense ends almost at once

**What happened:** three runs ended "Held: they withdrew" at 0:44, 0:44 and 1:08, even against a siege army. No buildings burned, and walls, workers and powers had no time to matter (126, 139, 157). The identical 0:44 suggests a fixed or broken withdraw trigger. The result numbers also do not add up: about 22,000 men are unaccounted for (126).

**Screenshots:** shots/step-126.jpg, shots/step-139.jpg, shots/step-157.jpg

**Fix**
- Review the raider withdraw threshold so it depends on losses and time, with a minimum duration.
- A siege army should commit to the walls before it can rout.

### 4. Future sack becomes unwinnable because of one raider tank

**What happened**
- The win condition was to catch the last raider, a tank. Infantry with an armed Attack would not fire (298).
- A plain tap moved them in, but they did no damage (300-301).
- Three Artillery Barrages barely scratched it (305-311).
- The player lost at the clock while ahead 68% to 14% (312).
- The burn-loss threshold was 2 houses and was never shown up front (314).

**Screenshots:** shots/step-298.jpg, shots/step-306.jpg, shots/step-312.jpg, shots/step-314.jpg

**Fix**
- Give infantry some anti-armor damage or a capture option, or show a "can't damage" icon on hover or target.
- Do not let the last enemy unit be immune to everything the defender has.
- Show the loss rules (burn limit, clock) at deploy.

### 5. Camera drag and pinch barely work

**What happened**
- Drag did not pan (14-16, 206-208) and once opened the radial menu instead (184-185).
- Pinch at scale 0.6 barely zoomed (24) or did nothing (180-181).
- The player could not get army and target on one screen and fell back on the Enemy button and minimap.

**Screenshot:** shots/step-181.jpg

**Fix**
- Make one-finger drag on open ground always pan.
- Separate long press (radial menu) from drag with a movement threshold.
- Allow a much wider zoom-out range.

### 6. The deploy panel and tutorial cover the field, and the chevron makes it worse

**What happened**
- The tutorial and deploy panel cover about 70% of the screen, and the title is truncated to "SAND..." (3).
- The chevron expands help text instead of collapsing the panel (7-8, 100-101, 242-243, 281-282), and once hid the Start button (282).
- Most sessions skipped real deployment because of it (43, 123, 201, 283).

**Screenshots:** shots/step-003.jpg, shots/step-101.jpg

**Fix**
- Show the tutorial and deploy panel one at a time.
- Make the chevron collapse the panel to a slim bar and keep Start always visible.
- Check title truncation at 844 px wide.

### 7. Battles end badly: dead time with no surrender, or sudden off-screen endings

**What happened**
- In stone, the army was wiped out and the player had to watch several minutes at 3x with nothing to command (36-39).
- Naval battles ended abruptly with the final ship out of view, sometimes under the bottom bar (95, 113, 250).

**Screenshots:** shots/step-036.jpg, shots/step-038.jpg, shots/step-113.jpg, shots/step-095.jpg, shots/step-250.jpg

**Fix**
- Add Surrender and Retreat buttons, and end automatically when a side has no army and cannot train one.
- Add a 1-2 second end moment that centers the camera on the last kill or rout.
- Keep the play area out from under the HUD.

### 8. Naval mode uses land text and land powers

**What happened**
- The deploy objective says "Take the keep" and "Tap a squad" while the banner says "Sink or scatter the enemy fleet" (83, 117, 241, 276).
- The result screens say men, regiments and army (95, 250, 272).
- The powers at sea are Forced March, Entrench, Ambush and Charge, and Charge had no visible effect (87, 248, 268-269).

**Screenshots:** shots/step-083.jpg, shots/step-117.jpg, shots/step-241.jpg, shots/step-276.jpg, shots/step-095.jpg, shots/step-250.jpg, shots/step-272.jpg

**Fix**
- Use naval strings throughout: ships sunk, crews lost, fleet scattered.
- Add a naval power set, or hide powers that do nothing at sea.

### 9. Single ships cannot be selected, and box select pans

**What happened**
- Taps on a hull or health bar did not select a ship (103-106, 119, 255-256).
- Select-mode box drag panned the view instead (107-109).
- Only the All button worked, so no flanking with one ship was possible.

**Screenshot:** shots/step-106.jpg

**Fix**
- Enlarge ship tap targets to the full hull plus padding.
- When Select mode is armed, drag should always draw a box and never pan.

### 10. Result and setup numbers are inconsistent, and a raw key shows

**What happened**
- Setup's Last result box shows "attacker (lossesDecisive)" and unit-less counts (98, 253).
- The stone result shows 76,000 lost against 0 after a real fight (40).
- The naval defeat says "5 regiments destroyed" for 6 ships, and the duration of 2:25 does not match the 2:35 clock (272).
- "No regiment of yours came through to learn from it" appears when nobody was lost (197).
- "They burned enough" appears when only 2 of 12 houses were ruined (314).

**Screenshots:** shots/step-098.jpg, shots/step-253.jpg, shots/step-272.jpg, shots/step-197.jpg, shots/step-314.jpg

**Fix**
- Localize the result key.
- Audit the result tallies against the in-battle state.
- Add conditional text for the zero-loss case.

### 11. Arrow Storm did nothing while paused in one session

**What happened:** in the kingdoms sack, the pause panel says "Powers, usable while paused". Three taps produced no strike and no supply spent (132-136). After resuming, supply was still full (139). In bronze, the same power did queue while paused (51-53), so the behavior is inconsistent.

**Screenshot:** shots/step-136.jpg

**Fix**
- Check whether the pause panel or the objective card eats battlefield taps.
- Make paused targeting consistent with the label.

### 12. The economy and workers layer cannot be reached

**What happened:** Steward toggled but opened no visible panel (20-21). The camp trains only laborers (55). Tapping other buildings did not open their panels (56-58). The player never found a way to train soldiers or direct workers.

**Screenshots:** none taken.

**Fix**
- Give the Steward button a visible panel.
- Make every own building tappable with its own panel.
- Show where soldiers are trained.

### 13. Siege flow friction

**What happened**
- Idle always throws the camera home, so every re-order takes Idle, then Enemy, then "Attack it" (229-231, 236).
- Go on the gate-breach banner does not move the camera (232-233).
- Alerts stack over the top left of the map.
- "-50 attrition" and "-60 attrition" are unexplained (236, 238).

**Screenshot:** shots/step-236.jpg

**Fix**
- Select idle squads without moving the camera, or add a second tap to jump.
- Make Go center on the breach.
- Cap visible alerts and add a tooltip for attrition.

### 14. Setup friction

**What happened:** Fight is below the fold in landscape (315). A native dropdown tap fell through and ticked the mercenaries checkbox (143). The player had to use arrow keys instead (144-150), which a real phone user cannot do.

**Screenshot:** shots/step-315.jpg

**Fix**
- Make the Fight button sticky.
- Replace native selects with touch-safe pickers.

## 6. Bugs

There were no page errors and no harness-error lines in this run.

1. **Attack button plus ground tap issues no order** (stone, steps 27-32)
   1. Select All.
   2. Tap Attack (it lights).
   3. Tap the enemy camp.
   4. Result: Idle stays 9 and Attack stays armed. A long press on the same spot works.
   5. It worked in other sessions (75-77, 204-205), so the bug is intermittent.
2. **Radial menu Attack does nothing** (bronze, steps 63-66)
   1. Select All (15).
   2. Long press near the city walls.
   3. Tap Attack in the radial menu.
   4. Result: the menu closes and every squad stays idle for 30+ seconds (Idle 16).
3. **Armed Attack plus minimap tap only moves the camera** (bronze 67-69, gunpowder 164-169)
   1. Select All.
   2. Tap Attack.
   3. Tap the enemy on the minimap.
   4. Result: the camera jumps, no order goes out, and Idle rises.
4. **Attack button toggles off with no clear feedback** (gunpowder, steps 170-171)
   1. With Attack already armed, tap Attack again.
   2. Result: it disarms.
   3. Unclear: the player may have misread the armed state.
5. **Squads revert to idle and drift home after orders** (gunpowder, steps 172-195)
   1. Give attack-move, move or path orders toward the enemy fort.
   2. Wait 5 seconds.
   3. Result: Idle climbs back to 9, 21-23 or 37 and squads walk back toward the base.
   4. The battle ended with 0 losses.
6. **Sack defense withdraw trigger fires early** (kingdoms, steps 121-126, 128-139, 141-157)
   1. Kingdoms age, sack, walls 2, economy on: tap Fight, then Start.
   2. Result: "They withdrew from the field" at 0:44 (twice, regardless of player action).
   3. With the enemy set to siege, the same result came at 1:08.
7. **Arrow Storm does not fire while paused** (kingdoms, steps 131-136)
   1. Pause.
   2. Arm Arrow Storm from the pause panel.
   3. Tap the battlefield three times.
   4. Result: no strike, no supply spent, and the hint stays up.
   5. In bronze, steps 50-53, the same flow did queue it, so the behavior is inconsistent.
8. **Last raider tank cannot be damaged, so the battle is unwinnable** (future sack, steps 294-312)
   1. Kill all raiders but the tank.
   2. Select All, arm Attack and tap the tank: no movement.
   3. Plain tap the tank: squads approach but do not fire.
   4. Fire Artillery Barrage three times: the bar barely changes.
   5. Result: Defeat at the clock.
9. **Deploy chevron expands instead of collapsing** (steps 7-8, 100-101, 242-243, 281-282)
   1. Start any battle.
   2. Tap the chevron on the Deploy panel.
   3. Result: more help text appears and the panel grows. In the future sack it hid the Start button (282).
10. **Pinch zoom has little or no effect** (steps 24, 180-181)
    1. Pinch at scale 0.6 on the battlefield.
    2. Result: the zoom barely changes or does not change at all.
11. **Drag does not pan, or opens the radial menu** (steps 14-15, 206-207, 184-185)
    1. Drag across open ground.
    2. Result: the camera does not move, or the radial orders menu opens.
12. **Box select pans instead of selecting** (classical naval, steps 107-109)
    1. Tap Select.
    2. Drag a box over your ships.
    3. Result: the view pans and nothing is selected.
13. **Ships cannot be selected by tapping** (steps 103-105, 119, 255-256)
    1. Tap a ship's hull or health bar.
    2. Result: nothing is selected.
    3. Unclear: this could be a small hit area or an offset in the tap coordinates.
14. **Naval deploy objective shows land siege text** (steps 83, 117, 241, 276)
    1. Start any naval battle.
    2. Result: the deploy panel says "Take the keep or break the defenders" and "Tap a squad", while the banner says "Sink or scatter the enemy fleet".
15. **Raw localization key on the setup screen** (steps 96-98, 251-253)
    1. Finish a naval battle.
    2. Tap Continue.
    3. Result: the Last result box shows "attacker (lossesDecisive)" and unit-less counts.
16. **Result screen tallies are inconsistent**
    1. Stone defeat: 76,000 lost against 0 (40).
    2. Kingdoms: about 22,000 raiders unaccounted for (126).
    3. Naval defeat: "5 regiments destroyed" with 6 ships sunk, and duration 2:25 against a 2:35 clock (272).
    4. Gunpowder, with 0 losses: "No regiment of yours came through" (197).
17. **Native dropdown tap falls through** (kingdoms setup, steps 141-143)
    1. Open the Enemy army picker.
    2. Tap "siege".
    3. Result: the mercenaries checkbox underneath gets ticked instead.
18. **Steward button opens no visible panel** (stone, steps 20-21)
    1. Tap Steward during battle.
    2. Result: it toggles, but no panel appears.
19. **Camp buildings other than the camp do not open panels** (bronze, steps 54-58)
    1. Tap Base.
    2. Tap the long building, other buildings and the hut.
    3. Result: no panel changes or opens.
20. **Breach banner Go does not move the camera** (modern walls, steps 232-233)
    1. Breach the gate.
    2. Tap Go on the banner.
    3. Result: the banner closes but the camera stays put.
21. **Speed buttons and clock stay on top of the result panel** (steps 250, 272)
    1. Finish any naval battle.
    2. Result: the speed buttons and clock remain visible over the result panel.

## 7. What was fun, and what else was good

**Fun**
- The bronze walled city with its ziggurat (45).
- Charge breaking an enemy trireme and a quick naval win (88-90, 95).
- Modern walls was the run's best stretch: the Artillery Barrage landed with clear explosions, a building burned, Rally appeared in context, and the gate-breach banner fired (214-217, 232).
- Focus fire at sea dropping an enemy ship (266-267).

**Other good things**
- Setup is clean and readable, the Fight button is big, and picks persist for a quick rematch (2, 315).
- Select All with clear rings (12).
- The Enemy button with its "Attack it" prompt (17, 209, 223) and the minimap jump (26-27).
- Path drawing works, with a clear hint (110-112, 262-263).
- The powers list, aim prompts and confirm toasts are clear (19, 53, 212-213, 288-289). Rally appears inside the "shaken" toast (78, 217).
- Pause, 2x and 3x are big and reliable.
- The You vs Them strength bar always shows who is winning.
- The goal banner states the win condition (80, 238).
- Hint toasts such as "cavalry arrives first" are useful (187).
- The result screens are readable, with XP per unit, city damage and the general's fall chance (80, 157, 312).

## 8. Coverage

**Ages:** all eight were played. Every session's battle started.

| Played to an end | Cut short by step budget |
|---|---|
| Stone, bronze, kingdoms (3 battles), gunpowder, future | Modern walls (undecided) |
| Classical naval (battles 1 and 2) | Classical naval battle 3 |
| Information naval (battles 1 and 2) | Information naval battle 3 |

**Areas**

| Status | Areas |
|---|---|
| Played well | Setup, selection and orders, camera, powers, speed, combat clarity, result screen, naval, walls and buildings (assault side) |
| Glanced at only | Economy and workers (Steward and one camp panel, no worker ever used). Unit readability (one tagged step). Deploy (real placement only once, at step 260). |
| Missed | Circle select (taught in the tutorial at step 5, never tried). Hold, Line, Stop and Retreat from the radial menu. Defending from walls in sack (no battle lasted long enough). Siege engines breaching walls. Path drawing on land beyond one try (177). Single-unit micro on land. Formations. |

**What the next run should aim at**

1. **Order reliability.** Repeat attack-move by button plus tap, long press and the radial menu, five times each, and record which ones drop. This tells you whether issue 1 is intermittent input handling or something tied to target type.
2. **Economy and workers.** Train soldiers, assign workers and use the Steward panel. This area has almost no data.
3. **Sack defense after the withdraw fix.** Hold the walls, use workers and test the burn limit.
4. **Sieges with engines.** Breach a wall, push through the gate, and check whether squads still idle at the walls.
5. **Gesture tests.** Circle select, box select, drag to pan and pinch, especially on land.
6. **Naval single-ship micro.** Zoom in and test tap selection, and check whether any power affects ships.
7. **Losing well.** Test Retreat, and test what happens when an army is wiped out but buildings remain.

---
316 steps, play $7.78 (claude-opus-5-5) + report $0.44 (claude-opus-5-5) = $8.22. Diary: `diary.jsonl`, noted screens: `shots/`.
