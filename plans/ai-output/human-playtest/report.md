# Human playtest: civ-veteran

# Playtest Report: civ-veteran, campaign, phone 844x390

## 1. Summary

A Civilization and Paradox veteran played 219 steps across five save points (start, bronze, kingdoms, gunpowder, information). The sessions load separate saves, so this was not one continuous game. The player picks Akkad at step 1, but later sessions are clearly an Israelite realm (Jerusalem, Samaria, Hebron). This is probably the save setup, not a bug.

Setup, tutorial and event cards were clean, and the first RTS battle produced the only fun score above 3. After that the experience narrowed into three problems:

- The player kept losing battles at very lopsided odds.
- Gold piled up with nothing to spend it on.
- The late game became an "advisor builds, end turn" loop repeated dozens of times.

The harness caught no page errors.

**The three things that matter most:**

1. **Lost battles cannot be ended.** Once every unit is dead, the battle keeps running for minutes with no surrender, retreat or skip (steps 122 to 132). This drove frustration to its peak of 4.
2. **Gold has no sink.** It grew from 1,278 (step 138) to about 36,000 (step 219) unspent. By step 190 the player called gold "meaningless", and gold-based event choices stopped being decisions.
3. **The mid and late game is repetitive, and battles feel unwinnable.** Steps 133 to 219 are almost entirely advisor builds plus End Turn. Nearly every battle offered was hopeless: 10k vs 41k, 2,200 vs 20,000, 58k vs 15k.

## 2. Scorecard

| Area | Score | Why |
|---|---|---|
| Start screen and world setup | 7/10 | Five quick taps to a clear summary screen. A banner covered the difficulty options (step 3). |
| Glossary and help | 6/10 | The 4-page tutorial went smoothly. The glossary opened straight onto a people entry and was closed at once (steps 30 to 31). Barely examined. |
| Tech tree | not reached | The player only let the advisor pick research (step 10). The tree itself was never opened. |
| Units and armies | 4/10 | Founding a city worked (steps 11 to 12) and enemy units could be inspected (step 47). No manual movement or army management was tried. |
| Cities, builds and settlers | 6/10 | "Advisor builds" and its all-cities version are fast and liked. The build list is cramped, the Palisade tap was confusing (step 63), and build times run 10 to 19 turns. |
| Speed feel | 6/10 | End Turn is responsive. The early game felt slow (steps 35 to 38) and lost battles drag on badly (steps 124 to 131). |
| Crises, events, era goals, independents, raids, World Congress | 7/10 | Event cards were repeatedly called clear and flavourful (steps 19, 26, 50). Late gold choices are trivial because of the gold glut. World Congress and era goals were never seen. |
| Map pan, zoom, close view and fog | not reached | One pinch out (step 20) with no comment on the result. |
| Diplomacy | 5/10 | The Declare war dialog (step 42) and peace offers (steps 169, 214) are clear. The Peoples screen is cramped, has overlapping buttons and shows a wrong MET count (step 23). |
| Economy and gold | 3/10 | Gold piled up from 1,278 to about 36k with "nothing to spend on". The Empire screen was opened (step 24) but got no comment. |
| Save and load | 5/10 | Manual save (step 29) and autosaves (steps 154, 173) worked. Load was never tested. |
| Wars and AI behaviour | 4/10 | The AI does besiege, raid and offer peace. Odds were overwhelming in almost every fight, and battle entry was hard to find (steps 67 to 68). |
| Pacing and fun | 3/10 | Nothing happened by turn 10 (step 44), and the late loop was described as repetitive (steps 176, 219). |
| RTS battles (deploy, orders, workers, sieges) | 5/10 | Clear objective and readable HUD (step 74). The attack stalled (steps 82 to 87), fights were hopeless, and there is no exit once units are lost (step 129). |
| Naval | 3/10 | One naval battle (steps 112 to 117). It was lost, and the player felt "little control". |

## 3. Fun curve

- **Steps 1 to 13: calm and easy (fun 3, frustration 1).** Setup, tutorial, founding Kish.
- **Steps 14 to 22: small friction (frustration 2).** It began when the cramped build list needed scrolling (step 14) and the city screen needed two closes (steps 16 to 17).
- **Step 23: first spike (frustration 3).** The Peoples screen had cut-off diplomacy buttons and a wrong MET count.
- **Steps 25 to 43: flat (fun 3, frustration 2).** The player repeatedly noted "pacing slow" while ending turns and answering cards.
- **Step 44: frustration 3.** The player ended the start session because there was no conflict or naval content by turn 10.
- **Steps 45 to 66: rising interest without rising fun.** A Pontic army appeared and besieged Jerusalem ("Tense, interested", step 58). The Palisade confusion pushed frustration to 3 (steps 63 to 67).
- **Steps 74 to 81: the peak (fun 4), the only time fun went above 3.** This was the first RTS battle, with a clear "burn 5 base buildings" goal and a readable HUD.
- **Steps 82 to 88: back down to fun 3.** The enemy grew to 7 base buildings, the warband stalled at 100 vs 100, and the player wrapped up.
- **Steps 89 to 98: first fun 2.** Hazor was sacked at 2,200 vs 20,000.
- **Step 117: fun 2 again.** The naval battle was lost with little control.
- **Steps 118 to 132: the low point.** The Jerusalem defence started at decent odds (16,000 vs 9,700) but was lost. With 0 units left the siege clock kept running: fun 2 and frustration 4 from step 129 to the end of the session.
- **Steps 133 to 219: flat at fun 3, frustration 2.** Only steps 146 to 151 dipped, when two hopeless battles were withdrawn from or auto-resolved and Hazor was sacked again.

The numbers in the late game understate the boredom. The thoughts keep repeating "gold piling up", "still repetitive" and "gold is meaningless", but the scores never moved. Treat steps 133 to 219 as worse than a flat 3 and 2 suggests.

## 4. Top issues (ranked by harm to a real player)

### 1. Lost battles cannot be ended, skipped or surrendered

- **What happened:** In the Jerusalem defence the player was down to 0 units by step 125. The siege clock (16:04 at step 129) kept running for several more waits of 8 to 10 seconds. Switching to 3x (step 130) still left the player just waiting.
- **Steps:** 121 to 132.
- **Screenshot:** shots/step-129.jpg
- **Fix:** End the battle automatically when one side has no units. Show a Retreat or Auto-resolve button at all times in command mode, and offer a faster speed or "skip to result" when the outcome is decided.

### 2. Gold has no meaningful use

- **What happened:** Gold went 1,278 (step 138), 2,844 (step 149), 4,762 (step 160), 5,696 (step 165), 6,463 (step 172), 12k (step 189), about 36k (step 219). Event choices that cost or give gold stopped mattering ("gold is meaningless anyway", step 190).
- **Screenshot:** none.
- **Unclear:** The game may already have a buy or rush option the player never found, since they relied on Advisor builds. Either way, it is invisible to this player.
- **Fix:** Show a clear "Buy now" or "rush" option in the city queue and production chooser. Add late-game sinks such as unit purchase, upkeep that scales, diplomacy bribes and Congress votes. Scale event gold costs to treasury size.

### 3. Battles offered at hopeless odds, and lost even at good odds

- **What happened:** The odds the player faced:
  - 10k vs 41k (step 69)
  - "badly outnumbered" raid on Hazor, which ended 2,200 vs 20,000 (steps 89 and 98)
  - naval battle "badly outnumbered" (step 112)
  - 58k vs 15k (step 146)
  - another "hopeless" fight (step 150)

  Hazor was sacked twice (steps 98 and 151). The one decent-odds fight, 16,000 vs 9,700 at step 118, was still lost completely.
- **Unclear:** In that fight the player mostly waited (steps 121 to 122) and only gave a rally order (step 123), so passivity may explain part of the loss. The saves may also be set up as losing positions.
- **Fix:**
  - Check whether the AI concentrates force too heavily against this player.
  - Check whether auto-behaviour of defending units is too weak when the player does not micro-manage.
  - Explain on the pre-battle screen why the odds are what they are, and what the player could do about it (walls, reinforcements, allies).

### 4. Repetitive late-game loop

- **What happened:** From step 133 to step 218, nearly every pair of steps is "X needs production, Advisor builds" followed by End Turn. The player only found the all-cities Advisor button at step 209. They called the loop repetitive at steps 176 and 219.
- **Fix:**
  - Make "Advisor builds for all idle cities" the default prompt, or give it a toggle such as "let advisor manage this city".
  - Allow longer or repeating queues so cities do not ask every turn.
  - Add more decisions between turns, so the player has a reason to open screens other than the chooser.

### 5. Peoples (diplomacy) screen broken on phone layout

- **What happened:** The header shows "0 MET" while Israel is listed as MET. The Declare war and Offer buttons are cut off, and the End Turn button covers them.
- **Steps:** 21 to 23.
- **Screenshot:** shots/step-023.jpg
- **Unclear:** The player did reach Declare war at step 41, so the buttons may be reachable by another route.
- **Fix:** Correct the MET count. Keep the action buttons inside the safe area on 844x390, and hide or offset the End Turn button while the panel is open.

### 6. Palisade order unclear, and build times too long during a siege

- **What happened:** Tapping Build Palisade on the Defense tab jumped to the Build tab with a Trireme (16 turns) at the top of the queue. The player could not tell whether the palisade was queued. Build times of 10 to 19 turns felt useless while besieged.
- **Steps:** 59 to 63.
- **Screenshot:** shots/step-063.jpg
- **Fix:** Show a confirmation ("Palisade added, position 1, N turns"), and put emergency defensive builds at the front of the queue. Consider a siege rush option, which would also help with Issue 2.

### 7. Slow opening with no conflict

- **What happened:** By turn 10 the player had only ended turns and answered cards ("pacing is slow").
- **Steps:** 35 to 44.
- **Screenshot:** shots/step-044.jpg
- **Fix:** Bring a first contact, raid or independent encounter forward in the first 10 turns, and point the player at something to do between turns.

### 8. RTS attack stalls and the objective seems to move

- **What happened:** The goal was to burn 5 base buildings. The enemy grew to 7 (step 82), and the warband stalled with strength at 100 vs 100 (step 81). Attack had to be re-armed (step 85), and the player gave up (step 88).
- **Steps:** 80 to 88.
- **Unclear:** It is not clear whether the target count rises with enemy building, or whether the warband actually attacked.
- **Fix:** Make attack orders persist until the target dies, show clear progress such as "2 of 5 burned", and flag idle units.

### 9. Battle entry hard to find

- **What happened:** During the Jerusalem siege, opening the city and its Defense tab gave no way into a battle. The attack option only appeared after tapping the enemy banner on the map (steps 67 to 68). The player's summary at step 88 lists "siege and battle entry is hard to find".
- **Steps:** 58 to 68.
- **Fix:** Add an "Engage besiegers" button to the city Defense tab and to the siege notification.

### 10. Naval battle offers little control

- **What happened:** The player started the naval battle, set 2x speed and watched it lose 35% vs 71% ("a bit disappointed by little control").
- **Steps:** 112 to 117.
- **Fix:** Show available naval orders prominently at battle start, such as formation, focus fire and disengage.

## 5. Bugs

1. **Wrong MET count on Peoples screen.**
   - Reproduce: start session, end a turn, open Peoples from the side bar (steps 21 to 22).
   - Seen: the header reads 0 MET while Israel is listed as MET.
   - Screenshot: shots/step-023.jpg
2. **End Turn button overlaps diplomacy actions on 844x390.**
   - Reproduce: same path as Bug 1.
   - Seen: the Declare war and Offer buttons are cut off at the bottom and covered by End Turn.
   - Screenshot: shots/step-023.jpg
3. **Palisade possibly not queued (unconfirmed).**
   - Reproduce: bronze session, during the Jerusalem siege tap the city (step 59), open Defense (step 60), scroll (step 61), tap Build Palisade (step 62).
   - Seen: the screen jumps to the Build tab showing a Trireme on top, and no palisade is visible.
   - Unclear: this could be a display issue or a missed tap.
   - Screenshot: shots/step-063.jpg
4. **Battle continues after all player units are dead.**
   - Reproduce: kingdoms session, defend Jerusalem in command mode (steps 118 to 120), wait until 0 units remain (step 125).
   - Seen: the clock keeps running and the battle never resolves within about a minute of waits, even at 3x (steps 125 to 131).
   - Unclear: this may be intended as a timer-based siege, but with no exit it behaves like a soft-lock.
   - Screenshot: shots/step-129.jpg
5. **Glossary opens on a people entry instead of an index (minor, unclear).**
   - Reproduce: open Menu (step 28), then Glossary (step 30).
   - Seen: a people entry is shown first. This may be the last-viewed entry by design.
6. **Still at war with Kerma right after accepting white peace (unclear).**
   - Reproduce: information session, accept the white peace offer (step 214), end turn (step 215).
   - Seen: the player reports still being at war with Kerma.
   - Unclear: the peace may have been with a different nation, so the treaty partner should be checked.
7. **Closing the city screen leaves a second panel that also needs closing (minor UX).**
   - Seen: steps 16 to 17, 54 to 55 and 64 to 65. Each time, closing the city screen left a tile or city info panel open.

## 6. What was good

- **Setup and onboarding:** five taps to start, a clear summary screen, and a short 4-page tutorial.
- **Event cards:** praised repeatedly as clear and readable, with good flavour ("send fighters up the water shaft", step 50; sea raiders tribute, step 45).
- **Declare war dialog:** clear about the cost (300 gold), the opinion drop and the missing cause for war (step 42, shots/step-042.jpg).
- **Peace offers:** easy to read and accept (steps 169, 214).
- **RTS battle presentation:** a clear win condition, an in-battle build action, a readable HUD with resources and speed buttons, and useful Enemy and All camera buttons (steps 74 to 79, shots/step-074.jpg). This was the only fun 4 of the run.
- **City Defense tab:** "clear options in this panel, good UX" (step 62).
- **Advisor builds, especially the all-cities version:** kept an impatient player moving (steps 107, 209).
- **Withdraw and Auto options before battle:** let the player skip hopeless fights quickly (steps 146, 150).
- **Autosave:** visible and reassuring (steps 154, 173).

## 7. Coverage

**Played properly:**
- cities and builds (mostly through the advisor)
- events and crises
- End Turn speed
- RTS land battles, both attack and defence
- war outcomes and peace offers

**Only glanced at:**
- **Tech tree:** advisor pick only.
- **Units and armies:** one founding and one inspect.
- **Glossary:** opened and closed.
- **Map zoom:** one pinch, no comment.
- **Economy:** the Empire screen was opened silently, and gold was tracked only through the top bar.
- **Save:** saved, never loaded.
- **Naval:** one battle, watched rather than commanded.

**Missed:**
- loading a save
- the tech tree itself
- map close view and fog
- moving units or armies by hand
- settlers after the first city
- World Congress
- era goals
- independents (steps 139 and 166 may involve them, but this is unclear)
- RTS workers
- sieges as the attacker
- proactive diplomacy (trade, alliances)
- spending gold

**Next run should aim at:**

1. Open and navigate the tech tree by hand.
2. Load a save, both manual and autosave.
3. Zoom into close view and check fog edges.
4. Move armies manually and attack a city from the map.
5. Fight an RTS battle at even or favourable odds while actively giving orders, including workers and siege equipment. This would show whether Issue 3 is balance or player passivity.
6. Try to spend a large treasury on purpose: find any buy, rush or bribe option.
7. Seek out World Congress, era goals and an independent.
8. Re-check the Peoples screen layout and the Palisade confirmation after any fixes.

---
219 steps, play $1.97 (claude-sonnet-5-5) + report $0.24 (claude-opus-5-5) = $2.21. Diary: `diary.jsonl`, noted screens: `shots/`.
