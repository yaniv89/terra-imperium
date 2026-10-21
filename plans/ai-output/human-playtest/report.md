# Human playtest: newcomer-phone

# Playtest Report: newcomer-phone (844x390, English, 78 steps)

## 1. Summary

A first-time player on a sideways phone got through world setup and the tutorial without trouble. They founded one village (Kish), queued a Warband and answered three event cards. Then they spent most of the start session ending turns and opening panels with nothing to do. They never moved a unit, never met another people, never found save or load, and stopped at step 49 bored and "a bit lost". From step 50 onward every later session (bronze, classical, gunpowder, modern, information) showed only a black screen. That cost 29 of 78 steps, and no later-era content was ever seen. The harness caught no page errors, so we cannot yet tell whether the game or the test setup caused the black screen.

**The three things that matter most:**
1. **Every later session loaded to a black screen** (steps 50 to 78). There was no loading text, no error and no recovery. This blocked all testing past the first session.
2. **The game never told the newcomer to explore.** The player ended about seven turns with an idle unit and a "0 met" Peoples tab, and never found anyone to talk to or fight.
3. **Save and load could not be found** in Settings (steps 25 to 28).

## 2. Scorecard

| Area | Score /10 | Why |
|---|---|---|
| Start screen and world setup | 8 | Four taps from launch to game (steps 1 to 4) with sensible defaults and no confusion. |
| Glossary and help | 5 | The tutorial was clear at first but "getting wordy" over seven pages (steps 5 to 11). The player still did not know what to pick right after it (step 12). The glossary was never opened. |
| Tech tree | not reached | The player let "the advisor choose" at step 12, probably a research pick, but never opened the tree. |
| Units and armies | 3 | Only the settler was used. The second idle unit (step 13 "Idle 2") was never moved. The first Warband would take 22 turns (step 17). |
| Cities, builds and settlers | 6 | Founding Kish and opening the build list was easy (steps 14 to 17). The 22-turn Warband felt slow. |
| Map pan, zoom, close view and fog | not reached | The player never panned or zoomed. They only said the map is "small and fogged" (step 49). |
| Speed feel | 4 | Turns passed quickly, but nothing happened between them. The 22-turn build reinforced the slow feel. |
| Crises, events, era goals, independents, raids, World Congress | 6 | Three event cards were readable and answered in one tap each (steps 21, 23, 31). Era goals, independents, raids and the World Congress were not reached. |
| Pacing and fun | 3 | Fun sat at 3 and never rose. The player was "a bit bored of ending turns" (step 42) and quit the session at step 49. |
| Economy and gold | 5 | Gold of 512 felt plentiful and the trade choices made sense (steps 23, 31). The player said "hopefully this is fine", so they were unsure of the effects. |
| Diplomacy | not reached | The Peoples tab showed "0 met" with "little guidance" (steps 48 to 49). |
| Save and load | 2 | The player scrolled all of Settings and found nothing (steps 25 to 28). It is unclear whether save and load exist elsewhere. |
| Wars and AI behaviour | not reached | No contact with any other people. |
| RTS battles | not reached | No war happened, and later sessions were black. |
| Naval | not reached | "The map shows only land around my village" (step 41). |

## 3. Fun curve

- **Steps 1 to 11 (setup and tutorial):** fun 3, frustration 1. This was the best stretch of the run. Everything was a clear "Next" button. Comments shifted from "short and clear" (step 6) to "getting wordy" (step 8), but frustration did not rise.
- **Step 12:** frustration rose to 2 the moment the tutorial ended: "Not sure what to pick, let the advisor choose for me." The tutorial did not leave the player knowing what to do.
- **Steps 12 to 49:** a flat line at fun 3, frustration 2. Founding the village and the event cards (steps 14 to 31) kept things moving. After that the player cycled through End Turn, the Log, Cities, Legacy and Peoples hoping to find "battles or ships" (steps 32 to 48). Boredom appears at step 42 and step 49 ("Nothing more to do; no one met"). Fun never went above 3 at any point.
- **Steps 50 to 58 (bronze):** the curve sank. Fun dropped to 2, then 1 at step 53, and frustration rose to 4 on the black screen.
- **Steps 59 to 78 (classical through information):** each new session opened with slight hope (fun 2, frustration 3 at steps 59, 66, 71 and 75). Within one or two steps it fell back to fun 1, frustration 4 as the screen stayed black.

**Peak:** steps 1 to 11, when the frustration was lowest. There was no true high point.
**Low:** steps 53 to 78, when the player could not play at all.

## 4. Top issues, ranked by harm to a real player

**1. Black screen on every session after the first (severity: blocker)**
- **What happened:** From the first bronze step the screen was fully black. The player waited a total of about 40 seconds, tapped the centre twice and pressed Escape (steps 50 to 58). Nothing changed, and there was no loading text or error. The same thing happened in classical (59 to 65), gunpowder (66 to 70), modern (71 to 74) and information (75 to 78).
- **Screenshot:** shots/step-053.jpg
- **Unclear:** Page errors were "none". This could be a stuck load, a rendering failure that throws no error, or a harness or session-transition problem (for example a later-era save that never loaded). It needs a developer to reproduce before it is called a game bug.
- **Suggested fix:**
  - Investigate how later-era sessions load.
  - Whatever the cause, never show a silent black screen. Show a loading indicator, and after a timeout show an error with a Retry and a Back to Menu option.

**2. No push to explore, so the game feels empty (severity: high)**
- **What happened:**
  - The player saw "Idle 2" (step 13), used the settler, and never moved the other unit.
  - They ended turns at steps 20, 22, 29, 30, 36, 39 and 46 while looking for "battles or ships".
  - The Peoples tab said "0 met" with no hint of what to do (step 48).
  - The player concluded "Nothing more to do" (step 49).
- **Screenshot:** none attached.
- **Suggested fix:**
  - Add a tutorial or advisor step that says to send your scout out to find neighbours.
  - Show a gentle prompt on End Turn while units are idle.
  - Give the Peoples tab empty state a line such as "Explore the map to meet other peoples", with a button that selects an idle unit.

**3. Save and load not found (severity: high for a bus player)**
- **What happened:** The player opened the Menu and scrolled Settings twice, but found no save or load (steps 25 to 28). Someone playing in short bus sessions needs this.
- **Screenshot:** none attached.
- **Unclear:** It may live elsewhere (the Empire menu was tapped at step 24 without comment), or the game may autosave without telling the player.
- **Suggested fix:**
  - Put Save and Load at the top level of the Menu.
  - If the game autosaves, say so visibly, for example "Autosaved, turn 8".

**4. Slow opening production (severity: medium)**
- **What happened:** The first build the player understood, a Warband, would take 22 turns (step 17). Combined with issue 2, the early game felt like ending turns with little to do (step 49: "Pacing felt slow").
- **Screenshot:** none attached.
- **Suggested fix:**
  - Mark a recommended first build.
  - Show cheaper or faster options near the top of the build list.
  - Review early production rates.

**5. The tutorial is long but does not stick (severity: medium)**
- **What happened:** Seven pages, with the player noting "a bit wordy" and "getting wordy" (steps 7 and 8). Right after finishing, the player did not know what to pick (step 12).
- **Screenshot:** none attached.
- **Suggested fix:** Cut the up-front pages and teach in context instead, for example one hint when the first research choice appears and one when the first unit is idle.

**6. Chronicle panel cramped and unclear (severity: low)**
- **What happened:** The panel showed a mostly empty card with a "blocky orange image" under Famous battles, and it felt cramped on the phone (steps 43 and 44).
- **Screenshot:** shots/step-044.jpg
- **Suggested fix:**
  - Hide empty sections or give them an empty-state message such as "No battles yet".
  - Check whether the orange block is placeholder or broken art.
  - Review the panel layout at 844x390.

**7. Closing panels takes guesswork (severity: low, unclear)**
- **What happened:** The player used two different close taps in a row (steps 18 and 19). They closed the Log with a tap near the top at x 418 (steps 34, 38, 41), and closed Cities by re-tapping its tab (step 35).
- **Unclear:** These closes may simply have worked, and the double close at steps 18 and 19 may have been two stacked panels rather than a missed tap.
- **Suggested fix:** Use one consistent, large close button on every panel.

## 5. Bugs

**Bug A: Black screen at session start for later eras**
1. Play the start session as Akkad on a phone viewport of 844x390 until it ends (the start session here ended at step 49).
2. Begin the bronze session.
3. Observe a fully black screen with no loading text or error.
4. Wait 40 seconds, tap the centre (422,195) and press Escape. Nothing changes.
5. Begin the classical, gunpowder, modern and information sessions. Each one is also black.

No page errors were recorded. Screenshot: shots/step-053.jpg. Cause unconfirmed: game or harness.

**Bug B (possible): Placeholder or broken image in the Chronicle**
1. In the start session, end a few turns.
2. Tap the Legacy tab (770,274).
3. Tap the Chronicle (540,167).
4. Under Famous battles, a mostly empty card shows a blocky orange image.

Screenshot: shots/step-044.jpg. This may be intended art for "no battles yet", so it is unconfirmed.

**Not counted as bugs:** The missing save and load (issue 3) and the empty Peoples tab (issue 2) are usability findings. The diary does not show anything malfunctioning.

## 6. What was good

- **Setup:** Akkad pre-selected and sensible defaults got a total newcomer into a game in four taps (steps 1 to 4).
- **Tutorial:** The first pages were "short and clear" (step 6).
- **Founding a village:** It was easy, and the yield preview ("food +3") helped the player pick a spot (step 14).
- **Event cards:** They were readable on a phone, and each one was answered with one confident tap (steps 21, 23, 31).
- **Advisor:** The advisor option gave a lost player a way forward (step 12).
- **Red dot on the Log:** It drew the player's attention every time (steps 37, 40).

## 7. Coverage

- **Played:**
  - Start and world setup
  - Tutorial
  - Founding a city and the build queue
  - Event cards
  - Light economy choices
- **Only glanced at:**
  - Tech choice, via the advisor only
  - Settings
  - Cities, Log, Legacy and Chronicle panels
  - Peoples tab
  - The map, seen but never panned or zoomed
- **Missed:**
  - Glossary
  - Tech tree screen
  - Unit movement and armies
  - Map gestures and close view
  - Era goals, independents, raids and the World Congress
  - Diplomacy
  - Wars and AI behaviour
  - RTS battles
  - Naval
  - Save and load (searched for but not found)

**Next run should aim at:**
1. Confirming that later-era sessions actually load before spending a run on them. Check with a developer whether the black screen comes from the game or the harness.
2. Having the newcomer move units and explore, so contact, diplomacy and war can be reached.
3. Testing pan, zoom, close view and fog with touch gestures at 844x390.
4. Getting into an RTS battle and a coastal or naval situation once contact happens.
5. Looking for save and load outside Settings, for example in the Empire menu.

---
78 steps, play $0.62 (claude-sonnet-5-5) + report $0.16 (claude-opus-5-5) = $0.77. Diary: `diary.jsonl`, noted screens: `shots/`.
