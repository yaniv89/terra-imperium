# Human playtest: battle-commander, battles

# Playtest report: battle sandbox, battle-commander persona (phone 844x390, English)

## 1. Summary

A model playing as an RTS veteran ran eight battle sessions, one per age, over 159 steps. Every battle started. There were no harness errors and no page errors. The **naval battles** (classical, information) and the **sack defenses** (kingdoms, future) were short, readable and ended on clear result screens. The **land assaults and the field battle** were a different story. Win bars sat at 100% vs 100% for long stretches and units went idle. The one-shot "Attack it" prompt kept vanishing before the player could tap it. The gunpowder field battle ran its full 20-minute clock and ended in a **Defeat with 0 men lost on either side**. Fun held at 3 out of 5 most of the time, never reached 5, and fell to 2 in the gunpowder and modern sessions.

**The three things that matter most:**

1. **Armies do not reliably engage.** In the gunpowder field battle nobody fought for 20 minutes and the player lost on the clock (steps 86 to 108). Stone and bronze battles also sat at 100/100 for a long time.
2. **The "Attack it" prompt from the Enemy button disappears within seconds**, and it is nearly impossible to hit at 3x speed (steps 96 to 107). It is the main way the player orders a base assault, so when it fails, the whole assault stalls.
3. **Progress is unreadable in assaults.** Win bars stay at 100% and then drop suddenly (98% to 45% within about two steps in bronze-walls). The enemy building count rose from 8 to 10 with no explanation. Units sit idle (Idle 19, Idle 7), and powers give no visible feedback.

## 2. Scorecard by area

| Area | Score /10 | Why |
|---|---|---|
| Battle setup screen | 7 | Clean and readable in landscape. However, Fight sits below the fold every session (scroll at steps 1, 33, 61, 74, 81, 111, 141, 152), and the picker showed "none" for a walled assault (note 32). |
| Deploy phase | 5 | Tutorial tips advanced fine (3 to 5) and Start worked every time. The player never actually positioned a unit, so this is barely tested. |
| Selection and orders on touch | 5 | Select-all plus attack-move was quick and worked in naval and stone. In modern-walls, several attack-move target taps seemed ignored (116 to 118) and a command popup vanished (120 to 121). Circle select and draw-a-path were never tried. |
| Combat clarity | 4 | Naval bars were clear (77 vs 17). Land assaults showed 100/100 for long periods, then sudden drops. Army blobs were dense. Morale states ("broke", "shaken") did help. |
| Speed and smoothness | 6 | No lag reported. 3x worked from the top bar (14, 89), but the first try at x 778 opened a pause menu (12 to 13). 3x also makes timed prompts harder to hit. |
| Powers | 4 | War Cry (16) and Rally Cry (129) were used, but there was no visible effect. Rally Cry only seemed to close the shaken alerts (note 130). |
| Camera pan and zoom | 5 | The Enemy button jump is handy. Only one pinch was tried (17). The camera lost the fleet in open sea (68), and an Enemy jump appeared to land near the player's own base (132). |
| Economy and workers HUD | 5 | One visit (18 to 21): trained a laborer and set a rally point. The Fire Circle panel covers much of the screen (note 20). The economy was never followed over time. |
| Unit readability and size | 4 | Banners are small and crowd together when zoomed out (note 20), and assault armies read as a single blob (note 41). |
| Buildings, sieges and walls | 4 | Enemy-button target cycling helps. There is little wall or gate damage feedback, with only one "gate breached" (57). The building count rose 8 to 10 (41), and the Attack it prompt is unreliable. |
| End of battle and result screen | 7 | Five clear result screens (men lost, XP, general, houses ruined). Weaker points: no result seen for stone-field (31), the clock looked inconsistent with the result (71), "men lost" sounds wrong for ships (149), and the raider withdrawal ending felt abrupt (159). |
| Layout on this screen and language | 6 | English labels are fine and landscape layout is clean. The objective tooltip (92), the Fire Circle panel and the attrition prompts cover the battlefield. |
| Naval | 7 | Two quick wins with focus fire that worked (147) and clear results. The camera lost the fleet once (68). |
| Fun | 4 | Mostly 3 out of 5. Short decisive battles reached 4. Stalled land battles dropped to 2. |

## 3. Scorecard by age

| Session | Kind of battle | Score /10 | Started | Played to end / winner | Why |
|---|---|---|---|---|---|
| stone-field | Stone, open field | 4 | Yes | Unclear, no winner seen | Both sides were still at 100% at step 30. The next session opened on setup with no result screen (note 31). This may be the harness switching sessions rather than the game ending. |
| bronze-walls | Bronze, walled assault | 4 | Yes | No. Player quit at step 60 while losing (about 41%) | A long 100/100 grind, then a sudden drop. Gate breached at 57. Little wall feedback and a dense blob. |
| classical-naval | Classical, naval | 8 | Yes | Yes, player won (about 1:32) | Quick, readable, focus on the bars. The clock looked mismatched on the result screen. |
| kingdoms-sack | Kingdoms, sack defense | 6 | Yes | Yes, player held (44 s, raiders withdrew) | Clear result, but the battle resolved before the player gave a real order (78 armed attack with no target). One-sided. |
| gunpowder-field | Gunpowder, open field | 1 | Yes | Yes, Defeat by 20-minute clock, 0 losses both sides | No engagement at all. Units idle (Idle 19). The Attack it prompt kept vanishing. |
| modern-walls | Modern, walled assault | 3 | Yes | No. Player quit at step 140 losing 15% vs 42% | Taps seemed ignored, a menu vanished, Rally Cry gave no feedback, and units kept going idle. |
| information-naval | Information, naval | 8 | Yes | Yes, player won (1:10) | Fast, focus fire worked. "Men lost 11,440 of 50,000" reads oddly for ships. |
| future-sack | Future, sack defense | 7 | Yes | Yes, player held (1:35) | Clear result (houses ruined 0 of 12). The raider withdrawal felt abrupt. |

There were no harness-error lines. Every battle drew and started.

## 4. Fun curve

- **Steps 1 to 11 (stone):** fun 3, frustration 1 to 2. The setup and tutorial flow was smooth.
- **Step 13:** frustration rose to 3 when the 3x tap opened a pause menu. It came back down to 2 by step 14.
- **Steps 29 to 30:** frustration 3 as the battle stayed "stuck at 100% both sides".
- **Steps 41 to 59 (bronze):** frustration 3 for most of the session. There was a brief easing to 2 at 48 to 50 when the enemy "broke" and chariots were "shaken". This was the only stretch where combat felt alive. Frustration went back to 3 as the player's side slid to 45% and then 41% with no clear reason.
- **Steps 71 to 73 (classical naval):** the **first peak**, fun 4 and frustration 1, on a clean victory.
- **Steps 79 to 80 (kingdoms sack):** fun 4, frustration 1, but this came from a fast win rather than from play.
- **Steps 94 to 110 (gunpowder):** the **trough**. Fun fell to 2 at 94. Frustration reached 4 at 102 and stayed there through the prompt-chasing loop and the 0-loss clock defeat (108 to 110).
- **Steps 136 to 140 (modern walls):** a second trough. Fun 2 and frustration 4 while re-selecting idle units and losing 21% vs 43%.
- **Steps 148 to 151 (information naval)** and **step 159 (future sack):** back to fun 4 and frustration 1.

**Pattern:** short, decisive battles (naval and sack) scored highest. Long land assaults and the field battle scored lowest, because the player could not see progress or get the army to commit. Fun never reached 5, which means even the good battles were pleasant but not exciting.

## 5. Top issues (ranked by harm to a real player)

### 1. Armies never engage, so the field battle is lost on the clock with no combat
- **What happened:** The player attack-moved toward the enemy base at step 86 and ran the battle at 3x. Both bars stayed at 100/100, and the armies stayed bunched with Idle 19. The battle ended in a Defeat by 20-minute clock with 0 men lost on both sides. Stone-field (27 to 30) and bronze-walls (41 to 46) showed the same long 100/100 stall.
- **Steps:** 86 to 108, 27 to 30, 41 to 46.
- **Screenshots:** shots/step-094.jpg, shots/step-108.jpg, shots/step-041.jpg.
- **Unclear:** It is not clear whether the attack-move tap at 86 registered a target. It may have landed on empty ground short of the base.
- **Suggested fix:**
  - Make the defending AI advance or skirmish in field battles.
  - Have an attack-move continue until contact.
  - Warn the player as the clock nears its limit.
  - Show a clear "no contact yet" state instead of 100/100.

### 2. The "Attack it" prompt vanishes before it can be tapped
- **What happened:** In gunpowder, the player went through the Enemy-button and "Attack it" loop six times and the prompt kept disappearing. The player also had to tap it "quickly" in modern-walls (125, 133). It worked in stone-field (24 to 28) and once in modern-walls (125). At 3x, the timer likely runs in game time, so it expires three times faster.
- **Steps:** 96 to 107, 125, 133.
- **Screenshots:** shots/step-104.jpg.
- **Unclear:** Some taps may have landed just after the prompt disappeared. The model's thinking time is real time, not game lag. A real player on a phone would still hit the same wall.
- **Suggested fix:**
  - Keep the prompt until the player dismisses it or picks another target.
  - Run any auto-hide timer in real time, not game time.
  - Offer a long-press on the target as a fallback.

### 3. Units go idle in the middle of an assault
- **What happened:** The Idle count was 19 in gunpowder (94) and 7 in modern-walls (130). The player pressed the Idle button repeatedly (131, 134 to 137).
- **Steps:** 94, 130 to 139.
- **Screenshots:** shots/step-094.jpg, shots/step-130.jpg.
- **Unclear:** Part of this is player error. At 134 to 137 the player only selected idle units and did not give a new order until 138 to 139. Even so, units seem to stop after a single building target.
- **Suggested fix:**
  - When a target building burns, auto-advance units to the next objective.
  - Let attack-move persist across targets.
  - Add a one-tap "send idle to current objective" action.

### 4. The win bar and progress are unreadable in land battles
- **What happened:**
  - The bars stayed at 100% vs 100% while fighting was going on.
  - In bronze-walls they then jumped from 98% (47) to 45% (51) within about two steps.
  - The enemy building count rose from 8 to 10 with no explanation (41).
  - In modern-walls the bars started at 58% with no visible trigger.
- **Steps:** 27 to 30, 41, 47 to 58, 128 to 140.
- **Screenshots:** shots/step-031.jpg, shots/step-041.jpg, shots/step-042.jpg, shots/step-130.jpg.
- **Suggested fix:**
  - Label what the bar measures.
  - Split army strength from objective progress (for example "buildings burned 3 of 9").
  - Add hit and damage feedback on walls and gates.
  - Announce new enemy buildings.

### 5. Touch orders sometimes do not register, and menus vanish
- **What happened:**
  - In modern-walls, three attack-move target taps left "Attack still armed" (116 to 118).
  - A command popup appeared and was gone by the next tap (120 to 121).
  - In stone-field, a tap at the top right opened a pause menu instead of 3x (12 to 13).
- **Steps:** 12 to 13, 116 to 121.
- **Unclear:** These could be missed taps on small targets rather than game bugs.
- **Suggested fix:**
  - Use bigger hit areas on the top bar and space them apart.
  - Show a visible ground marker when an attack-move target is accepted.
  - Keep context menus open until the player taps elsewhere.

### 6. Powers give no visible effect
- **What happened:** War Cry (16) had no effect the player noticed. Rally Cry (129) only closed the shaken alerts, and morale still showed attrition (note 130).
- **Steps:** 15 to 16, 129 to 130.
- **Screenshots:** shots/step-130.jpg.
- **Unclear:** The tap at 129 may have hit an alert rather than the power itself.
- **Suggested fix:**
  - Show an on-unit effect, floating text and a buff icon with a timer.
  - Show the morale change on the morale readout.

### 7. Unit readability
- **What happened:** Banners are small and crowd together when zoomed out (20). Assault armies read as one blob (41).
- **Screenshots:** shots/step-020.jpg, shots/step-041.jpg.
- **Suggested fix:**
  - Use larger squad banners that merge or stack into clusters with counts.
  - Add a type-colored outline per squad.
  - Spread the formation on approach.

### 8. Result screen inconsistencies
- **What happened:**
  - **Stone-field result never seen** (31). This is possibly a session switch rather than a game fault.
  - **Clock mismatch:** the header showed 3:28 while the result said 1 min 32 s (71). These add up to exactly 5:00, so the header is most likely a countdown of time left, but it is not labeled as one.
  - **Wording for ships:** "men lost" on naval results (149).
  - **Abrupt endings:** the sack defense ends on a raider withdrawal that feels abrupt (80, 159).
- **Screenshots:** shots/step-031.jpg, shots/step-071.jpg, shots/step-149.jpg.
- **Suggested fix:**
  - Label the header as "time left".
  - Use "crew lost / ships sunk" for naval battles.
  - Show a short "raiders retreat" beat before the result screen.

### 9. Setup friction
- **What happened:** Fight is below the fold, so the player had to scroll in all eight sessions. The picker showed "none" for a walled assault (32).
- **Screenshots:** shots/step-032.jpg.
- **Suggested fix:**
  - Pin Fight to the bottom in landscape.
  - Show the actual battle kind in the picker.

### 10. Camera loses track of the action
- **What happened:** The camera showed empty sea while the fleet was elsewhere (68). An Enemy jump landed near what looked like the player's own base (132).
- **Suggested fix:**
  - Add a "Find my army" button next to Enemy.
  - Center Enemy jumps on the actual target building.

## 6. Bugs

**B1. Field battle: no engagement, Defeat by clock with 0 losses** (shots/step-094.jpg, shots/step-108.jpg)
1. Start the gunpowder-field battle (Fight, then Start from the deploy panel).
2. Select all squads (x70, y346), arm Attack (x617, y347), and tap toward the enemy base (x540, y150).
3. Set speed to 3x (x722, y22) and wait.
4. Expected: the armies meet. Actual: bars stay at 100/100, Idle 19, and after 20 minutes the result is a Defeat with 0 men lost on both sides.

**B2. "Attack it" prompt disappears before it can be tapped** (shots/step-104.jpg)
1. During a battle at 3x, tap Enemy (x170, y346).
2. Tap the Attack it prompt (about x567, y283) on the next step.
3. Expected: the army is sent to the target. Actual: the prompt has often already vanished. This repeated six times in steps 96 to 107.

**B3. Units go idle during an assault** (shots/step-130.jpg)
1. In modern-walls, send the army at a building through Enemy and then Attack it (124 to 125).
2. Wait until fighting starts (126 to 128).
3. Expected: units keep attacking. Actual: the Idle count rises (7) while the battle is being lost.
4. Unclear: this may be expected behavior after a single target, but there is no auto-continue.

**B4. Stone-field ended without a result screen** (shots/step-031.jpg)
1. Play stone-field and use Enemy and Attack it on the storage pit, the lodge and the keep (23 to 30).
2. Expected: a result screen. Actual: the next view is the setup screen.
3. Unclear: this may be the harness starting the bronze-walls session. Recheck by playing stone-field to its end.

**B5. Win bar static, then jumps; enemy building count rises** (shots/step-041.jpg)
1. Start bronze-walls and attack-move the whole army at the city (36 to 38).
2. Wait about 10 to 15 seconds. Bars stay at 100/100 and the building count goes from 8 to 10.
3. Keep attacking. The bars read 98% at step 47, then the player's side reads 45% at step 51.

**B6. Attack-move target taps ignored and command popup vanishes**
1. In modern-walls, select all (x70, y346) and arm Attack (x617, y343).
2. Tap the enemy compound (x470, y150) twice, then x540, y150. "Attack still armed" remains each time.
3. When a command menu appears, tap Attack (x291, y208). The menu is gone and nothing happens.
4. Unclear: these may be missed taps.

**B7. Speed tap opens the pause menu**
1. In a running battle, tap the top-right corner (x778, y22).
2. Expected: 3x. Actual: a pause menu opens. A tap at x722, y22 worked afterwards.
3. Unclear: this could be a missed tap next to a pause button. Check spacing on an 844-wide screen.

**B8. Rally Cry has no visible effect** (shots/step-130.jpg)
1. In modern-walls, when units are shaken, tap Rally Cry (x580, y133).
2. Actual: the shaken alerts close, but morale still shows attrition and the bars keep falling (58% to 47%).
3. Unclear: the tap may have hit the alert instead of the power.

**B9. Setup picker shows "none" for a walled assault** (shots/step-032.jpg)
1. Open the setup screen for bronze-walls.
2. Actual: the battle picker says "none" with fortifications 4.

**B10 (minor, wording). Header clock vs result duration** (shots/step-071.jpg)
1. Win classical-naval.
2. Actual: the header shows 3:28 and the result says 1 min 32 s. This is likely a 5:00 countdown, so the fix is to label it as time left.

Harness errors: none. Page errors: none.

## 7. What was fun, and what else was good

**Fun:**
- **Naval battles:** select all, attack, and focus fire on a specific ship (147) gave a quick, readable win.
- **Morale moments:** the bronze-walls stretch where enemy units "broke" and chariots got "shaken" (48 to 50) was the liveliest land combat.
- **Short sack defenses:** these had a satisfying "held the town" ending.

**Also good:**
- **Result screens** are clear: men lost bars, XP per unit, general survived, sunk ships gone for good, and houses ruined.
- **Enemy button** cycles through targets and was the player's main navigation tool. The player called it helpful several times.
- **Idle button** exists and shows a count, which is the right tool for the idle problem once the rest works.
- **Select-all plus attack-move** is a fast three-tap flow on a phone.
- **Tutorial tips and deploy flow** are short and easy to dismiss.
- **Setup screen** is clean and in correct English in landscape.
- **Performance:** no lag reported, and 3x speed works.
- **Stability:** no page errors and no failed starts across all eight ages.

## 8. Coverage

**Played properly:**
- Battle setup, select-all and attack-move, end-of-battle and result screens.
- Naval (two full battles).
- Buildings and sieges through the Enemy and Attack it loop.
- Combat clarity.

**Only glanced at:**
- **Deploy phase:** Start only, with no unit placement.
- **Economy and workers:** one visit at 18 to 21.
- **Powers:** two uses.
- **Camera:** one pinch and Enemy jumps.
- **Speed:** two taps.
- **Layout:** notes only.

**Missed:**
- Circle select, draw-a-path, splitting the army into groups, and flanking.
- Real deployment positioning.
- Zooming in on units.
- Panning by drag.
- Watching workers gather or build over time.
- Siege engines and targeting walls or gates directly.

**Ages:** all eight started.
- Finished: classical, kingdoms, gunpowder (clock defeat), information and future.
- Not finished: stone (unclear ending), bronze and modern (player quit while losing).

**Next run should aim at:**
1. Play stone-field and one walled assault to their real end, to confirm or clear B4 and see the walled result screen.
2. Re-run gunpowder-field at 1x and check whether the armies meet without help. Test whether the Attack it prompt lasts longer at 1x than at 3x.
3. Spend a session on deployment and tactics: place units in deploy, split into two groups with circle select, draw a flanking path, and attack-move a single squad.
4. Use each power while watching one squad closely, before and after, to judge feedback.
5. Follow the economy for a few minutes: train workers, watch resources, and build something.
6. In walled battles, target the gate and walls directly and note what damage feedback appears.
7. Probe the top-bar buttons (pause vs speed) with deliberate taps to separate a layout problem from missed taps.

---
159 steps, play $1.56 (claude-sonnet-5-5) + report $0.31 (claude-opus-5-5) = $1.88. Diary: `diary.jsonl`, noted screens: `shots/`.
