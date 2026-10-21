# Human playtest: hebrew-speaker

# Playtest Report: Hebrew speaker, phone 844x390, language he

## 1. Summary

The player started a game as Akkad in Hebrew. They went through setup and the tutorial, founded Kish, queued a settler, answered three event cards, opened the empty Peoples screen and the event log, and marched an army. That first session (steps 1 to 47) ran smoothly, with fun steady at 3. The Hebrew in the setup, tutorial and event cards mostly read well.

The localization problems were concrete:
- An English "Add to Home Screen" banner covered the difficulty options.
- The event log showed untranslated English event names and mirrored number signs.
- Some army wording sounded translated.

The player then believed a "battle" button was broken and stopped. The label they quote, "צבא בטל", means "idle army", so this was most likely a misread and not a bug (see Top issues).

Every later session (bronze, classical, gunpowder, modern, information; steps 48 to 75) showed only a dark, blank screen for 30+ seconds and never loaded. The harness caught no page errors, so it is unclear whether this is a game failure or a test-setup problem. Either way, nothing past the opening turns was tested.

The player's claim at step 47 that they "covered all areas" is not accurate. Save/load, map, war, RTS battles and naval were never reached.

**The three things that matter most**
1. **Five of six sessions never loaded** (steps 48 to 75). The screen stayed blank, there were no controls, no loading indicator, no error message and no page errors.
2. **Right-to-left and translation breaks in the event log** (step 29). English event names and reversed signs on numbers like "-4700" and "+11g".
3. **No path from the opening to a battle.** The player mistook the "idle army" button for a battle button (steps 40 to 46). The button probably works as designed, but the player had no clear idea how a fight starts.

## 2. Scorecard

| Area | Score /10 | Why |
|---|---|---|
| Start screen and world setup | 7 | Flowed cleanly in Hebrew with a correct RTL arrow (step 1), but an English banner covered the difficulty options (steps 3 to 4). |
| Glossary and help | not reached | Glossary never opened. Tutorial cards read well in Hebrew (step 8), but page dots seemed to move backward (step 9), and the tutorial was skipped at step 10. |
| Tech tree | 5 (glanced) | Research was picked from a prompt three times (steps 11, 25, 27). The tree itself was never browsed. |
| Units and armies | 5 | The march order worked (steps 35 to 39). Wording sounded translated, a trash icon sits next to the unit row with no visible confirmation (step 34), and the idle-army button confused the player (steps 40 to 46). |
| Cities, builds and settlers | 7 | Founding Kish and queuing a settler were quick and clear (steps 13 to 15). |
| Map pan, zoom, close view and fog | not reached | Only taps on the map. No pan, zoom or fog checks. |
| Speed feel | not reached | End turns raised no complaints. The blank later sessions are a loading failure, not a speed measurement. |
| Crises, events, era goals, independents, raids, World Congress | 6 (events only) | Event cards read fine in Hebrew (steps 19, 23, 32), but the log copy of the same events was in English (step 29). Crises, era goals, independents, raids and World Congress were not reached. |
| Diplomacy | 4 (glanced) | Only the empty start state was seen. It shows a large dark area and a search box with no list (step 21). |
| Economy and gold | not reached | Gold came only from event choices. No economy screen was opened. |
| Pacing and fun | 3 | Flat at fun 3 for 47 steps with no peak, then 28 steps of fun 1 to 2 on blank screens. |
| Save and load | not reached | At step 28 the player went looking for save/load but landed in the event log. If the later sessions were loaded saves, loading is suspect, but the diary cannot confirm that. |
| Wars and AI behaviour | not reached | No contact with other peoples. |
| RTS battles | not reached | The player never found a battle (step 46). |
| Naval | not reached | Mentioned as "still unseen" (step 43). |
| Hebrew localization (persona focus, extra row) | 5 | Most text is good. English leaks in the banner and log, the log has bidi-broken numbers, and the wording at step 34 sounds translated. |

## 3. Fun curve

**First session (steps 1 to 47)**
- **Fun:** stayed at 3 for every step. It never rose above that, so there is no real peak. The closest things to highs were the smooth city founding (13 to 15) and readable event cards (19, 23).
- **Frustration:** started at 1.
  - Rose to 2 at step 3 (English banner covering difficulty) and fell back after it was closed (step 5).
  - Ticked to 2 at step 10 when the player skipped the tutorial.
  - Settled at 2 from step 29 onward after the event log showed English text and mirrored numbers.
  - Rose to 3 at steps 43 to 47, when repeated taps on the supposed battle button kept opening the army card.

**Later sessions (steps 48 to 75)**
- **Bronze:** began at fun 3, frustration 2, but dropped to fun 2, frustration 3 at step 50, and to fun 1, frustration 4 at step 51 once the blank screen was clearly stuck.
- **Classical, gunpowder, modern, information:** each started already discouraged (fun 2, frustration 3 at steps 56, 61, 66, 71) and ended at fun 1, frustration 4 (steps 60, 64 to 65, 68 to 70, 74 to 75).

**The low point** is the whole stretch from step 51 to the end. The player had nothing to do but wait and tap.

**Why it never peaked:** the opening was competent but not exciting. The player was always heading toward wars, battles and naval play, which they never got to.

## 4. Top issues (ranked by harm to a real player)

### 1. Later-era sessions show a permanent blank screen
- **What happened:** In bronze, classical, gunpowder, modern and information, the screen stayed dark for 30 to 45 seconds. A center tap (steps 50, 58, 63, 68, 73) and Escape (step 53) did nothing. There was no spinner, no message and no way out. The modern and information summaries both mention turn 151, so the player apparently saw some session metadata even though nothing rendered.
- **Steps:** 48 to 75.
- **Screenshot:** shots/step-051.jpg
- **Unclear:** The harness reported no page errors. This may be a test-harness problem with loading prepared mid-game states rather than a game bug. If players can reach this state, though (for example loading a late save on a phone in Hebrew), it is game-breaking.
- **Suggested fix:**
  - Reproduce by loading a late-era save on a 844x390 phone with the language set to he.
  - Always show a loading indicator.
  - Add a timeout that shows an error screen with "back to menu".
  - Log load failures even when no exception is thrown.

### 2. Event log has untranslated English and broken right-to-left numbers
- **What happened:** The log shows "Traveling Merchants ← Trade only what you need" in English, even though the same event's card was in Hebrew (step 23). Numbers with signs appear reversed: "-4700" and "11g+" instead of "+11g". English and Hebrew lines are mixed.
- **Step:** 29.
- **Screenshot:** shots/step-029.jpg
- **Suggested fix:**
  - Build log entries from translation keys at display time, not from stored English strings.
  - Wrap numbers, signs and unit suffixes in LTR isolation (`<bdi>`, `dir="ltr"` spans, or Unicode isolates U+2066/U+2069) so signs stay attached in RTL lines.

### 3. English "Add to Home Screen / full screen" banner covers difficulty options
- **What happened:** On the rules screen, the English banner sat over the difficulty buttons. The player had to find and close it first.
- **Steps:** 3 to 4.
- **Screenshot:** shots/step-003.jpg
- **Suggested fix:**
  - Translate the banner.
  - Place it so it never covers setup controls, for example at the bottom or after setup.

### 4. No clear route to a battle; "idle army" button read as "battle"
- **What happened:** After the army arrived (steps 38 to 39), a button labeled "צבא בטל" appeared. The player took it for a battle button. Each tap opened the army card (steps 40 to 45), and the player reported it as broken (step 46). "צבא בטל" means "idle army", so the button most likely did its job: it selected the idle army. Nothing in the diary shows an enemy nearby, so no battle was available.
- **Steps:** 40 to 46.
- **Screenshot:** shots/step-046.jpg
- **Unclear:** This is probably a misread, not a game bug. It still matters, because a player looking for combat had no clue how to start one and ended the session over it.
- **Suggested fix:**
  - Check whether the idle-army icon looks like a combat icon.
  - Add a short tooltip on first appearance.
  - Give a tutorial hint on how battles start (moving into an enemy or independent).

### 5. Army card wording and a risky trash icon
- **What happened:** The march button "צעדו..." sounds like a literal translation. Mixed number formats ("1000/1000", "10,000 חיילים") sit side by side. A trash icon next to the unit row looks easy to hit, and no confirmation was visible. The player did not test whether one exists.
- **Step:** 34.
- **Screenshot:** shots/step-034.jpg
- **Suggested fix:**
  - Have a native speaker review army and order verbs.
  - Make sure disbanding asks for confirmation.
  - Move the icon away from the main row tap area.

### 6. Tutorial page dots appear to run backward
- **What happened:** The player said the page dots "seem to go backward oddly".
- **Step:** 9.
- **Screenshot:** none.
- **Unclear:** This may be correct RTL behavior that simply felt odd.
- **Suggested fix:** Confirm the dot direction matches the swipe and button direction in RTL.

### 7. Empty Peoples screen at start
- **What happened:** The screen shows a large dark empty area and a search box with no list.
- **Step:** 21.
- **Screenshot:** shots/step-021.jpg
- **Suggested fix:**
  - Hide the search box when the list is empty.
  - Fill the empty space with a short explanation of how to meet peoples.

## 5. Bugs

1. **Blank screen on later-era sessions** (severity high; cause unclear, no page errors)
   1. Start any of the bronze, classical, gunpowder, modern or information sessions on a phone at 844x390 with the language set to he.
   2. Wait 30+ seconds.
   3. Tap the center (422,195), or press Escape.
   4. Result: the screen stays dark with no controls (shots/step-051.jpg).

2. **Event log English text and mirrored number signs**
   1. Start a game as Akkad in Hebrew.
   2. End turn until the Traveling Merchants event appears, then choose "trade only what you need" (step 23).
   3. Open the log via the bottom-left control (step 28, tap at 72,320).
   4. Result: the entry is in English, and "-4700" and "+11g" display with signs reversed (shots/step-029.jpg).

3. **Untranslated full-screen / Add to Home Screen banner covering setup**
   1. Start a new game in Hebrew.
   2. Advance past civilization selection and world setup to the rules screen (steps 1 to 2).
   3. Result: an English banner covers the difficulty buttons (shots/step-003.jpg).

4. **Possible: tutorial page dots move in the wrong direction** (unconfirmed)
   1. Start a game.
   2. Advance tutorial cards (steps 7 to 9).
   3. Watch the page dots.

**Reported but likely not a bug:** "battle button opens army card" (step 46). The label means "idle army", and opening the army card is the expected result. Listed under Top issues as a discoverability problem instead.

## 6. What was good

- Setup flow was short and clear. The "next" arrow correctly pointed left for RTL (step 1).
- Tutorial cards read naturally in Hebrew (step 8).
- Founding a city and queuing a settler with the plus button was quick (steps 13 to 15).
- Event cards were well translated and easy to choose from (steps 19, 23, 32).
- Ordering a march worked: select army, march, pick hex, confirm, and the army arrived after two turns (steps 35 to 39).
- No crashes or page errors during the first session.

## 7. Coverage

**Played:**
- Start screen and world setup
- Cities, builds and settlers
- Event cards
- Army selection and march orders

**Glanced at:**
- Tech tree (research picks only)
- Diplomacy (empty start state)
- Tutorial (skipped partway)
- Event log

**Missed:**
- Glossary and help
- Map pan, zoom, close view and fog
- Speed feel
- Crises, era goals, independents, raids, World Congress
- Economy and gold
- Save and load
- Wars and AI behaviour
- RTS battles
- Naval
- Everything in every era after the first few turns

**Next run should aim at:**
1. **Fix or verify session loading first.** Confirm whether the blank screens come from the harness or the game. Without that, five sessions are lost again.
2. **Take a deliberate route to combat.** March toward an independent or a neighbor, or declare war, so RTS battles get covered: deploy, orders, workers, sieges. Check the Hebrew and RTL layout of the battle HUD.
3. **Open the main menu to test save and load.** At step 28 the player hit the log instead. Then reload a save in Hebrew.
4. **Browse the full tech tree and glossary for untranslated text,** and pinch and pan the map to check fog and close view.
5. **In a later era, check** World Congress, crises, era goals, economy screens and naval units, with attention to number and sign direction everywhere numbers appear.

---
75 steps, play $0.62 (claude-sonnet-5-5) + report $0.17 (claude-opus-5-5) = $0.78. Diary: `diary.jsonl`, noted screens: `shots/`.
