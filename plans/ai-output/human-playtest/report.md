# Human playtest: rts-commander, battles

# Playtest report: rts-commander, battle sandbox (desktop 1600x900, English, 104 steps)

## 1. Summary

The player, an RTS-focused persona, set out to cover eight age sessions but only five produced a playable battle. Six attempts to start a battle were refused by the harness because the canvas drew nothing. Every second "Fight" in a land session failed this way, and the bronze-walls, gunpowder-field and modern-walls sessions never ran at all.

Of the seven battles that did run:

* **Naval (four battles):** all four timed out with zero losses on both sides. Ships sat on grass with no water drawn, and each was scored a Defeat.
* **Land (three battles):** one quick win with almost no input (kingdoms-sack, 44 s) and two defeats. In the stone-field defeat the player's army vanished without warning. In the future-sack defeat the fight "looked frozen" for a long stretch.

The basic command chain worked: All, then Attack, then tap the map. The Enemy, Base and Map jump buttons, pause and resume, and the result headlines also worked. However, powers, the worker economy, and combat feedback gave the player almost nothing to read. Fun never rose above 4 and spent most of the run at 2 to 3.

**The three things that matter most:**

1. **Naval battles are unplayable.** There is no water, the fleets never meet, and every battle ends in a 5-minute timeout scored as Defeat (steps 29 to 52, 61 to 82).
2. **Battles often fail to draw at all.** Six blank-canvas refusals left three of the eight ages untested, including both walls sessions (steps 27, 28, 58, 59, 60, 98).
3. **The player cannot read the fight.** Units are tiny dots, an entire army died without feedback, powers show no effect, and one long fight looked frozen (steps 10, 16, 18, 90 to 96).

## 2. Scorecard by area

| Area | Score /10 | Why |
|---|---|---|
| Battle setup screen (age, armies, terrain, walls) | 4 | "Fight" works, but the labels confuse ("Battle (raiders attack, you defend)" set to none next to Fortifications 2), the last result shows a raw code, and there is no visible naval option (step 26). The player never changed a picker. |
| Deploy phase | 3 | Reached six times, but the player only pressed start. Tapping a squad in deploy gave no visible change (steps 2 to 3). Placement was never tested. |
| Selection and orders on touch | 4 | All, then Attack, then a map tap sent units moving (steps 11 to 14, 33 to 35). A plain tap with a selection did not move the fleet (steps 75 to 76). Circle select and path drawing were never tried. |
| Camera pan and zoom | 5 | The Enemy, Base and Map buttons and the event "Go" banner all jump the camera (steps 7, 15, 36). A minimap tap aimed at the enemy went to the player's own fleet (step 37). Drag pan and zoom were never tried. |
| Powers | 3 | The panel opens and spends supply (350 to 230), but War Cry showed no visible effect (step 10), and Rally Cry's effect went unremarked (step 89). |
| Combat clarity (who is winning, damage, morale, rout) | 3 | The "enemy warband broke" banner was good (step 15). Otherwise the fight is a dense blob, the player's army was wiped with no warning (step 18), and a fight looked frozen for about a minute (steps 90 to 96). |
| Unit readability and size | 3 | "Tiny dots in a huge crowd", sides are hard to tell apart, and only a few health bars show (step 16). On naval maps, ships read as rafts on grass (step 38). |
| Speed and smoothness | 5 | Pause and resume work and no lag was reported. The "frozen" look in future-sack (steps 91 to 95) is unexplained. Speed controls were never changed. |
| Economy and workers HUD | 2 | Training a Laborer gave no visible queue, the Rally button changed to "Tap map", and the pop counter showed 5/0 in orange (steps 21, 22, 24). Tried once only. |
| Buildings, sieges and walls | 3 | Fire Circle HP was visible as it fell from 1987 to 922, but there was no warning before the base fell (step 22). Both walls sessions failed to start. Siege units were never used. |
| End of battle and the result screen | 4 | Headline and Continue are clear. The text is often wrong: "attackers' camp destroyed" while defending, 60,000 men lost against "8 regiments" from 9 squads, an "Auto is tuned" footer when Auto was not used, and naval text about sinking when nothing sank (steps 24, 40, 56, 96). |
| Layout on this screen and language | 5 | No overlap or reach problems were reported. A raw code "defender (campDestroyed)" and confusing labels appear on the setup screen (step 26). |
| Fun | 3 | Peaked at 4 once (step 15). Fun sat at 2 for both naval sessions and at 3 for the land battles. |
| Naval | 1 | Four battles, zero contact, no water drawn, every one a timeout scored as Defeat. |

## 3. Scorecard by age

| Session | Score /10 | Started? | Played to end? Winner | Why |
|---|---|---|---|---|
| stone-field (open field) | 4 | Battle 1 yes. Battle 2 no (harness error, step 27). | Yes: Defeat, base destroyed (step 24) | Commands worked and the rout banner was fun. Then all 9 squads died in seconds with no feedback, the laborer did not queue, and the result wording was wrong. It is unclear whether an open-field battle loaded: the screens talk about a base siege and "raiders attack, you defend" (steps 18, 26). |
| bronze-walls (walled siege) | not scored | No (harness error, step 28) | Not played | Canvas drew nothing. |
| classical-naval (sea battle) | 2 | Yes, twice | Yes, both: Defeat by timeout, 0 losses each side (steps 40, 51) | No water drawn, ships on grass, deploy text about taking a keep, and the fleets never met in 5 minutes. |
| kingdoms-sack (defend the town) | 5 | Battle 1 yes. Battle 2 no (harness error, step 58). | Yes: Held (player won) in 44 s, 0 losses against 14,380 enemy (step 56) | A win, but it ended before the player gave a real order. |
| gunpowder-field (open field) | not scored | No (harness error, step 59) | Not played | Canvas drew nothing. |
| modern-walls (walled assault) | not scored | No (harness error, step 60) | Not played | Canvas drew nothing. |
| information-naval (sea battle) | 1 | Yes, twice | Yes, both: Defeat by timeout, 0 losses (steps 70, 80) | Same naval failure. In the second run the fleet did not move at all (step 76). |
| future-sack (defend the town) | 4 | Battle 1 yes. Battle 2 no (harness error, step 98). | Yes: Defeat at 12 min, 22,000 of 63,000 lost against 11,760 of 40,000 (step 96) | Attack-move and Rally Cry worked, and a real fight happened. It then looked frozen for about a minute, and the player could not tell who was winning. |

## 4. Fun curve

* **Steps 1 to 14 (stone-field opening): fun 3, frustration 1 to 2.** The setup, tutorial tips, Enemy jump and attack-move all behaved. Frustration ticked up at step 3, when tapping a squad in deploy did nothing visible, and at step 10, when War Cry had no visible effect.
* **Step 15: the peak, fun 4 and frustration 1.** An "enemy warband broke" banner with a "Go" button took the player straight to a rout. This was the only moment of the run that felt like the game the persona came for.
* **Steps 18 to 26: a sharp drop to fun 2 and frustration 3.** Pausing revealed "Yours: 0 on the field, 9 killed" with no prior warning. Next, the laborer did not train and the base fell. The defeat screen then contradicted itself.
* **Steps 27 to 28: fun back to 3.** This was hope for a second battle. Both attempts hit blank-canvas refusals.
* **Steps 29 to 52 (classical-naval): fun flat at 2, frustration rising from 2 to 3 at step 38.** At step 38 it became clear the "sea" was grass and no enemy was in view. Frustration stayed at 3 through two timeout defeats.
* **Steps 53 to 58 (kingdoms-sack): recovery to fun 3, frustration 1.** Frustration rose to 2 at step 56 because the win came after 44 s with nothing to do.
* **Steps 61 to 82 (information-naval): the longest trough, fun 2 and frustration 3 from step 66 onward.** Most steps were waits for the timer (steps 67 to 69, 76 to 79).
* **Steps 83 to 98 (future-sack): fun 3, frustration 1 to 2.** The fight engaged, but steps 90 to 95 were six straight waits on a fight that "looks frozen", which kept fun at 3 rather than lifting it.

Overall, fun rose only when the game showed a clear event (the rout banner). It sank whenever the game hid what was happening (silent army loss, no water, no power feedback, a static fight). Frustration never exceeded 3 and fun never fell below 2, so the experience reads as dull and confusing rather than infuriating.

## 5. Top issues (ranked by harm to a real player)

**1. Naval battles cannot be played**
* **What happened:** Four sea battles (two classical, two information age) drew ships on grass and stone roads with no water. The deploy text talked about taking a keep. The fleets never met, and every battle ended in a 5-minute timeout scored as Defeat with 0 losses on both sides.
* **Steps:** 29 to 52, 61 to 82.
* **Screenshots:** shots/step-030.jpg, shots/step-038.jpg, shots/step-040.jpg, shots/step-051.jpg, shots/step-070.jpg, shots/step-080.jpg.
* **Unclear from the diary:** whether the fleet was heading to the right place. The player tapped toward where it guessed the enemy was (steps 34, 46, 65), and the jump to the enemy never showed contact.
* **Suggested fix:**
  * Make sure the naval scenario loads a water map and ship-specific deploy text.
  * Check that ships can path to the enemy within the time limit, or start the fleets closer together.
  * Do not score a contact-free timeout as a plain Defeat without explaining why: who was attacking, and what the win condition was.

**2. Battles fail to draw (blank canvas)**
* **What happened:** Six "Fight" taps produced a near-uniform canvas, and the harness refused them. Three ages were never played as a result: bronze-walls, gunpowder-field and modern-walls.
* **Pattern:** In every land session where a first battle ran (stone, kingdoms, future), the second Fight failed. The two naval sessions restarted fine.
* **Steps:** 27, 28, 58, 59, 60, 98.
* **Screenshots:** none (caught by the harness).
* **Unclear from the diary:** whether this is a true render failure or a map that genuinely looks uniform. A large uniform field could trip the check, given that naval maps also showed plain grass.
* **Suggested fix:**
  * Reproduce by running a land battle to its result, pressing Continue, then Fight again.
  * Check whether battle state or the renderer is torn down incorrectly between battles.
  * Check the walls and gunpowder setups from a fresh load.

**3. The player cannot tell what is happening in combat**
* **What happened:**
  * Units are tiny dots in one blob, and only a few health bars show (step 16).
  * The player's whole army (9 squads) died in seconds with no alert. This was discovered only by pausing (step 18), shortly after a banner said an enemy warband broke.
  * In future-sack the fight looked frozen for about a minute and the player could not tell who was winning (steps 90 to 96).
* **Screenshots:** shots/step-016.jpg, shots/step-018.jpg, shots/step-096.jpg.
* **Unclear from the diary:** whether the "frozen" look was a stalled simulation, idle units in a stalemate, or a very slow fight. No page errors were caught. The battle clock reached 12 minutes, which suggests it kept running.
* **Suggested fix:**
  * Add squad-level side colouring or outlines at wide zoom.
  * Add a "your squads are routing / destroyed" alert.
  * Add a visible strength or morale bar for both sides.
  * Add idle indicators when units are not fighting.

**4. Powers give no feedback**
* **What happened:** War Cry closed the panel and spent 120 supply with no visible effect on units (steps 9 to 10). Rally Cry likewise showed nothing the player remarked on, while squads kept dropping (steps 88 to 90).
* **Screenshot:** shots/step-010.jpg.
* **Suggested fix:** Add an on-unit visual (aura or icon), a short text toast naming the effect and its duration, and a buff icon on affected squads.

**5. Worker economy did not respond, and the base fell without warning**
* **What happened:** Tapping Train Laborer at the Fire Circle showed no queue, and the Rally button changed to "Tap map". The Fire Circle dropped from 1987 to 922 HP with no warning, and the pop counter read 5/0 in orange (steps 20 to 24).
* **Screenshots:** shots/step-022.jpg, shots/step-024.jpg.
* **Possible cause:** A pop cap of 0 may have blocked training silently.
* **Suggested fix:**
  * Show a clear reason when training is refused (for example "population cap reached").
  * Show the queue.
  * Alert the player when the base drops below set HP thresholds.

**6. Wrong or confusing text on the result and setup screens**
* **What happened:**
  * "Attackers' camp destroyed" appeared when the player defended and lost.
  * The screen showed 60,000 of 60,000 men lost but "8 regiments destroyed" from 9 squads.
  * The setup screen showed a raw code, "defender (campDestroyed)", alongside "Your army: 0 left".
  * "Auto is tuned to score the same as playing" appeared every time, although Auto was never used.
  * Naval timeouts said "defenders held their ground" and "Ships sunk are gone for good" when nothing sank.
* **Steps:** 24, 26, 40, 56, 70, 96.
* **Screenshots:** shots/step-024.jpg, shots/step-026.jpg, shots/step-040.jpg, shots/step-056.jpg, shots/step-070.jpg, shots/step-096.jpg.
* **Suggested fix:**
  * Localise the result codes.
  * Pick the result text by the player's role and the actual end cause.
  * Show the Auto footer only when Auto was used.
  * Make the regiment and men counts agree with what was deployed.

**7. Pacing swings between too short and too long**
* **What happened:** The kingdoms-sack defence ended in 44 s before any real order (step 56). The stone-field army was wiped "in seconds" (step 18). Future-sack dragged to 12 minutes with a static middle (step 96).
* **Screenshots:** shots/step-056.jpg, shots/step-018.jpg, shots/step-096.jpg.
* **Suggested fix:** Tune enemy commitment and withdrawal thresholds so the player gets at least one meaningful decision point. Consider a short grace period before the AI commits.

**8. Session setup may not match the intended scenario**
* **What happened:** The stone-field session (meant as an open field) showed a "Base 1 vs 10" siege banner and a raiders-attack setup (steps 18, 26). The naval deploy text talked about taking a keep (step 30).
* **Screenshots:** shots/step-018.jpg, shots/step-026.jpg, shots/step-030.jpg.
* **Unclear from the diary:** whether the harness or the game chose the scenario.
* **Suggested fix:** Verify that the setup applied per session matches the tag, and show the scenario name clearly at deploy.

**9. Some orders did not register (uncertain)**
* **What happened:**
  * Tapping a squad in deploy gave no visible selection (steps 2 to 3).
  * Selecting All and then a plain map tap did not move the fleet (steps 74 to 76).
  * A minimap tap aimed at the enemy dot jumped to the player's own fleet (step 37).
* **Unclear from the diary:** These may be missed taps, a design where a plain tap is not a move order, or ships unable to move on land. They need a recheck.
* **Suggested fix:** Show a clear selection highlight and a move marker on every accepted order. Give a "can't go there" cue when an order is refused.

## 6. Bugs

1. **Naval battle has no water, and fleets never engage**
   1. Start the classical-naval or information-naval session and tap Fight (800,460).
   2. Start the battle (around 820,218).
   3. Tap All (31,870), then Attack (1413,870), then a point toward the enemy.
   4. Wait.
   * **Result:** Ships stay on grass, no sea is drawn, and the battle ends by timeout after 5 minutes with 0 losses on both sides as Defeat.
   * **Steps:** 29 to 51, 61 to 80. **Screenshots:** shots/step-030.jpg, shots/step-051.jpg, shots/step-080.jpg.
2. **Blank canvas on Fight**
   1. Finish a land battle (stone-field, kingdoms-sack or future-sack).
   2. Tap Continue (1224,637).
   3. Tap Fight (800,460).
   * **Result:** The canvas draws nothing.
   * **Also:** Fight fails directly at the start of bronze-walls, gunpowder-field and modern-walls.
   * **Steps:** 27, 28, 58, 59, 60, 98.
3. **Army wiped with no feedback**
   1. In stone-field, start the battle.
   2. Tap All, then Attack, then tap toward the enemy (1300,300).
   3. Wait about 3 s, follow the Go banner, and pause.
   * **Result:** The pause panel shows "Yours: 0 on the field, 9 killed" with no prior alert.
   * **Step:** 18. **Screenshot:** shots/step-018.jpg.
4. **Laborer training does not queue**
   1. In stone-field, mid-battle, tap Base (183,870).
   2. Tap Train Laborer (1558,810).
   * **Result:** No queue appears, the Rally button changes to "Tap map", and pop shows 5/0 in orange.
   * **Steps:** 20 to 22, 24. **Screenshot:** shots/step-022.jpg.
5. **War Cry shows no effect**
   1. Open Powers (1569,872).
   2. Tap War Cry (1348,772).
   * **Result:** The panel closes and supply drops from 350 to 230, but nothing is visible on units.
   * **Steps:** 8 to 10. **Screenshot:** shots/step-010.jpg.
6. **Wrong defeat text and inconsistent counts**
   1. Lose the stone-field defence when the base falls.
   * **Result:** The screen says "attackers' camp destroyed", "60,000 of 60,000" lost but "8 regiments" from 9 squads, and the top bar still shows 5/0.
   * **Step:** 24. **Screenshot:** shots/step-024.jpg.
7. **Raw result code on the setup screen**
   1. Continue past the stone-field defeat.
   * **Result:** The setup screen shows "defender (campDestroyed)" and "Your army: 0 left".
   * **Step:** 26. **Screenshot:** shots/step-026.jpg.
8. **"Auto is tuned" footer shown when Auto was not used**
   1. Finish any battle without touching Auto.
   * **Steps:** 24, 56, 96. **Screenshots:** shots/step-056.jpg, shots/step-096.jpg.
9. **Naval timeout text mentions sinking and "defenders held"**
   1. Let any sea battle time out with no contact.
   * **Steps:** 40, 70. **Screenshots:** shots/step-040.jpg, shots/step-070.jpg.
10. **Fight appears frozen (needs confirmation)**
    1. In future-sack, start the battle.
    2. Tap All, then Attack, then tap the west-wall enemy (700,340).
    3. Use Rally Cry, then wait.
    * **Result:** The scene looks static for about 60 s of waits, and the battle ends at 12 minutes as Defeat.
    * **Steps:** 85 to 96. **Screenshot:** shots/step-096.jpg.

## 7. What was fun, and what else was good

**What was fun:**
* The "enemy warband broke" banner with a Go button that jumps straight to the rout was the high point of the run (step 15, fun 4).

**What else was good:**
* **Command chain:** All, then Attack, then tap is quick and was easy to use repeatedly. Units visibly marched (step 14) and the fleet moved (step 35).
* **Camera buttons:** The bottom bar (All, Find, Enemy, Base, Map) was praised as useful in the naval wrap-up (step 52). The Enemy and Map jumps worked.
* **Pause and resume:** Both work, and the pause panel gives a useful side-by-side unit count (steps 17 to 19).
* **Tutorial tips:** Short, and advanced cleanly with Next (steps 4 to 6).
* **Result screens:** Headlines are clear and readable (steps 24, 96), and Continue reliably returns to setup.
* **Stability:** No page errors were caught in any battle.
* **Future-sack:** Delivered a real, sustained fight with meaningful losses on both sides.

## 8. Coverage

**Ages:**
* **Played:** stone-field (1 battle), classical-naval (2), kingdoms-sack (1), information-naval (2), future-sack (1).
* **Missed (never started):** bronze-walls, gunpowder-field, modern-walls. No walled battle was ever played.

**Areas:**
* **Played properly:**
  * Selection via All and attack-move
  * Camera jump buttons and minimap
  * End of battle and result screen
  * Naval (thoroughly, though broken)
* **Only glanced at:**
  * **Setup screen:** never changed a picker.
  * **Deploy:** only pressed start.
  * **Powers:** two uses.
  * **Economy and workers:** one train attempt.
  * **Buildings:** watched the Fire Circle HP fall.
  * **Speed and smoothness:** pause only.
  * **Layout and language:** one note.
* **Missed entirely:**
  * Circle select
  * Drawing a path
  * Single-unit selection that visibly worked
  * Drag pan and zoom
  * Speed-up controls
  * Walls
  * Siege units
  * Worker gathering and building placement

**What the next run should aim at:**
1. Fix or explain the blank-canvas refusals first. Then rerun bronze-walls, gunpowder-field and modern-walls to cover walls and sieges.
2. After a naval fix, rerun one sea battle to confirm water, ship movement and contact.
3. Deliberately test the touch controls: tap-select one squad, circle select, draw a path, drag pan, and zoom in on a fight to judge readability up close.
4. Spend a whole battle on the economy: train workers, gather, place a building, and use a siege engine on a wall.
5. Change setup pickers (age, armies, terrain, walls) and confirm that the scenario that loads matches the choice.
6. Recheck the "frozen fight" in future-sack, with a screenshot at each wait, to tell a stall from a stalemate.

---
104 steps, play $1.48 (claude-sonnet-5-5) + report $0.30 (claude-opus-5-5) = $1.78. Diary: `diary.jsonl`, noted screens: `shots/`.
