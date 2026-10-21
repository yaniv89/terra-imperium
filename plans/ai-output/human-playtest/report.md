# Human playtest: civ-veteran

# Playtest Report: civ-veteran, desktop 1600x900, English

## 1. Summary

A veteran Civ and Paradox player ran 214 steps across six sessions (start, bronze, classical, gunpowder, modern, information). The guided start, event cards, settings and diplomacy all worked and were clear. Most of the run, though, was spent ending turns while a size 1 mountain capital (Tiwanaku, from the bronze session on) failed to produce Settlers. The UI showed "1 turn" and progress above cost (126/112, then 141/112), with no prominent reason why. Later sessions added research ETAs of 951 and 1786 turns and city production of 3. Army control broke repeatedly, with a left panel that stayed half faded. Wars, RTS battles, naval, World Congress, crises, independents and raids were never reached, even though the player's own summaries at steps 169, 193 and 214 claim "all checklist areas were looked at". That claim is not supported by the diary.

**The three things that matter most:**
1. **Settlers block silently.** A city at size 1 with 0 food surplus shows Settlers as "1 turn" forever, with progress over cost. This blocked the whole bronze session (steps 51 to 99).
2. **The era test saves look unplayable.** Every era session seems to start from the same weak Andes capital: production 3, Science +6, research ETAs of 951 to 1786 turns. That pacing kept the player away from wars, battles and naval play.
3. **Army selection and the left panel are unreliable.** The panel stuck half faded and overlapping, and tapping the army did not give orders for about 40 steps across three sessions (44 to 49, 73 to 89, 100 to 105).

## 2. Scorecard

| Area | Score /10 | Why |
|---|---|---|
| Start screen and world setup | 6 | Guided start and tutorial were quick and skippable (1 to 4). Later starting positions (mountain capital, +0 food) were crippling. |
| Glossary and help | 2 | Searched Menu, Log and Empire (113 to 120) and found no help or glossary entry. It may exist elsewhere; unclear. |
| Tech tree | 3 | Web view is a one-row strip (31), lists are cut off and do not scroll (111, 157), and ETAs are absurd (153, 191). The advisor pick worked (40). |
| Cities, builds and settlers | 3 | Settlers block silently, numbers contradict each other (60), production is 3 and the greyed plus has no tooltip (181). "Best site" settling was good (139, 184, 209). |
| Speed feel | 6 | The player says turns resolve fast. Panel animations needed repeated waits (48, 74, 83, 101, 104). |
| Crises, events, era goals, independents, raids, World Congress | 7 (events only) | Event cards were clear, with trade-offs and good flavour (10, 123). Era goals were only glimpsed on the Empire screen (120). Crises, independents, raids and World Congress were not reached. |
| Map pan, zoom, close view and fog | 5 | Only glanced: one pinch (11), a fog reveal from the map trade (151) and the map going dark behind a panel (148, 203). Close view was not tried. |
| Diplomacy | 8 | Pacts, map trade, prices and refusal reasons were all clear (148, 151, 167). Empty early, but with a good hint (15, 65). |
| Units and armies | 3 | March works when found (19 to 21, 128 to 130). Selection failed repeatedly, the panel stuck faded, and the army starved in the field with no easy recall (44). |
| Economy and gold | 6 | Gold choices in events feel meaningful and the treasury is readable. An unexplained -1 gold per turn (55, 92) and log spam (70). |
| Save and load | 2 | Menu opens Settings directly. No save or load found in four checks (26, 67, 114, 162). Autosave may exist; unclear. |
| Pacing and fun | 3 | Long stretches of only pressing End Turn. Fun sat at 2 for most of the first three sessions. |
| Wars and AI behaviour | not reached | No war happened or was attempted. |
| RTS battles (deploy, orders, workers, sieges) | not reached | Only battle settings were seen. |
| Naval | not reached | Inland capital; never attempted. |

## 3. Fun curve

- **Steps 1 to 33 (fun 3, frustration 1):** A calm, positive start. The tutorial, research prompt, city queue and events were all clear. Frustration first rose to 2 at step 31 (the cramped Web tech view).
- **Steps 34 to 48 (fun 2, frustration 2):** Boredom set in. "Settlers in 9 turns is slow" (34), followed by five End Turns in a row (34 to 37). The army starving in the field (44) added annoyance.
- **Step 49 (frustration 3):** The left army panel stuck half faded, and the session ended at 2/3.
- **Bronze, steps 51 to 99: the low point.**
  - It opened hopeful (fun 3 at 51 to 53, "Settlers in 1 turn").
  - It soured when the timer never moved (54, 55).
  - Repeated failed army selections pushed frustration to 4 (87).
  - **Steps 92 to 94 hit fun 1, frustration 5**, the worst of the run: "the game is unplayable."
- **Classical, steps 100 to 121 (2/3, flat):** More failed attempts to clear the stuck panel, then menu browsing. Brief bumps to fun 3 came from the Research screen (109) and Settings (114).
- **Gunpowder, steps 122 to 169: the recovery.**
  - Events gave flavour (123).
  - March finally worked (129 to 131, frustration back to 2).
  - Settlers spawned and a second city was founded (134 to 143).
  - **Step 151 was the peak (fun 4, frustration 1):** the free map trade revealed 821 tiles.
  - The research ETA of 951 turns (153) and the unscrollable tree (157) pulled frustration back to 3.
- **Modern, steps 170 to 193:** Settlers stuck at "1 turn" again (172, 173). Production 3 made the build list feel "dead" (177). The 1786-turn ETA (191) dropped fun to 2.
- **Information, steps 194 to 214 (steady 3/2):** A competent but flat repeat of the same loop (event, pact, settle at the same sugar and river site).

**Why:** fun followed whether the player could act. It peaked when diplomacy and the map gave a visible result. It sank whenever the game silently refused an action (Settlers, army selection, research).

## 4. Top issues (ranked by harm to a real player)

### 1. Settlers show "1 turn" forever when the city is size 1

**What happened:**
- The city list said "Settlers in 1 t" over turns 41 to 43 and beyond.
- The Build tab showed 126/112 (step 60), then 141/112 (step 97), but the unit never spawned.
- The same tab listed Settlers at 38 turns in the queue (60).
- The likely cause is the size 2 requirement, with food at +0 (food 9/35, step 58).
- A "needs size 2" warning does exist in the build list (135), but the player missed it for about 40 steps. Later it was described as "only small text" with no tooltip on the greyed plus (181).
- The same stall recurred at 170 to 175 and 194 to 198.

**Steps:** 51 to 60, 90 to 99, 135, 170 to 181, 194 to 198.

**Screenshots:** shots/step-055.jpg, shots/step-058.jpg, shots/step-060.jpg, shots/step-092.jpg, shots/step-097.jpg, shots/step-181.jpg

**Fix:**
- Replace "1 turn" with "Blocked: needs size 2 (food +0)" in the city list, city screen and turn report.
- Cap displayed progress at the cost.
- Add a tooltip to the greyed plus.
- Consider a turn-report warning when a queue item is blocked.

### 2. Era test states have unplayable pacing

**What happened:**
- Gunpowder, modern and information all start with a size 1 Tiwanaku capital in the Andes, production 3 and Science +6.
- Research ETAs were 951 turns for Gunpowder Weapons (153) and 1786 turns for Civil Service (84/10800, step 191).
- Builds took 47 to 200 turns (177).
- "Fund Scholars" gave +20 science for 100 gold.

This may be a test-save problem rather than core balance. A real modern-era empire would not look like this. Still, it is what kept the player away from wars and naval play.

**Steps:** 135, 153, 177, 191.

**Screenshots:** shots/step-135.jpg, shots/step-153.jpg, shots/step-177.jpg, shots/step-191.jpg

**Fix:**
- Build era presets with era-appropriate cities, science and production, and with neighbours already met and coastal access.
- Separately, check whether late tech costs scale far faster than science output in normal play.

### 3. Army selection fails and the left panel sticks half faded

**What happened:**
- Tapping the army opened tile info (46, 76).
- The left panel stayed half faded over the cities list and guide chips (49, 89, 120).
- Neither Escape (80, 105) nor the top-left close button (81, 102) fixed it.
- The starving army could not be brought home (44 to 49).

**Partly unclear:** at 75 and 84 the player tapped a destination tile directly instead of pressing the March button. When March was used (19 to 21, 128 to 130), movement worked. So some of this may be the player not finding the March control while the faded panel hid it. The faded overlapping panel is a real visual problem either way.

**Steps:** 44 to 49, 73 to 89, 100 to 105.

**Screenshots:** shots/step-049.jpg, shots/step-089.jpg, shots/step-120.jpg

**Fix:**
- Make sure panel fade transitions always finish.
- Let a tap on a tile while an army is selected act as a move, or show a "Use March" hint.
- Make Escape close all overlays.
- Add a "return home" order for armies under attrition.

### 4. The tech tree is cramped and does not scroll

**What happened:**
- The Web view is a single-row strip (31).
- The All Techs list is cut off by the era tabs and End Turn button (111).
- Expanding Economy showed no rows (110).
- Dragging did not scroll (157).
- The Lines view was also cut off (159).

This is a poor comparison point for a Civ veteran.

**Steps:** 29 to 31, 108 to 112, 154 to 159.

**Screenshots:** shots/step-031.jpg, shots/step-111.jpg, shots/step-157.jpg

**Fix:** give the tree a full-screen view, make it drag and wheel scrollable, and keep the era tabs and End Turn clear of the content.

### 5. No save, load, help or glossary found

**What happened:** Menu opens straight into Settings. Four checks found no save or load (26, 67, 114, 162). Searching Menu, Log and Empire found no help or glossary (117, 120). These features may exist somewhere else, which would itself be a discoverability problem.

**Screenshots:** shots/step-026.jpg, shots/step-067.jpg, shots/step-117.jpg, shots/step-120.jpg

**Fix:**
- Make Menu a hub with Save, Load, Help/Glossary and Settings.
- If saving is automatic, say so on screen.

### 6. The map goes dark and shifts after signing a pact

**What happened:** This happened twice. The map behind the Peoples panel turned mostly black, the camera moved and the "Army idle" view was lost (148, 203).

**Possible cause:** the camera centres on the partner's area, which is still fogged. The map trade at 151 then revealed it.

**Screenshots:** shots/step-148.jpg, shots/step-203.jpg

**Fix:** do not move the camera on pact signing, or only move it to revealed tiles.

### 7. Smaller UX issues

- The event log is spammed with per-turn gold lines, and End Turn overlaps its bottom (70, 117). Screenshots: shots/step-070.jpg, shots/step-117.jpg
- The Riflemen use an airplane icon (135).
- An unexplained -1 gold per turn (55, 92).
- The legend panel and minimap cover a lot of the map (15).

## 5. Bugs

### 1. Settlers progress exceeds cost but never completes, and shows "1 turn"
1. Load the bronze session (Tiwanaku capital, size 1, food +0).
2. Open the city, then the Build tab. Settlers shows 126/112, "1 turn", and 38 turns in the queue (step 60).
3. End turn several times (63, 72, 87, 90, 91).
4. Settlers never spawn and progress reaches 141/112 (97).

**Expected:** a blocked state with a reason, and progress capped at the cost.

### 2. Left panel stuck half faded; army cannot be selected
1. In the start session, dismiss the report about the starving army (44).
2. Tap the army banner (45 to 47). Tile info opens and the panel freezes mid fade (48, 49).
3. In bronze, repeat at (1028,435) after waiting (73, 74). Escape (80) and the close button (81) do not clear it.

This partly overlaps with possible player error (see issue 3 above).

### 3. Map turns black and camera jumps after pact
1. Open Peoples (145) or a contact's diplomacy (201).
2. Press Offer pact with Caral (147 or 202).
3. Gold drops 150 as listed, but the map behind the panel goes black and shifts, and the army view is lost (148, 203).

### 4. Research panel does not scroll; content cut off
1. Open Research (154) and switch to Web (155).
2. Drag upward inside the panel (156). Nothing scrolls and the tree is hidden behind the era tabs (157).
3. The Lines view is also cut off (158).

### 5. Wrong unit icon
1. In the gunpowder session, open production on the idle capital (134).
2. Riflemen show an airplane icon (135).

### 6. End Turn overlaps the event log
1. Open Log (116).
2. The bottom rows sit under the End Turn button (117).

### 7. Possible: very fast early tech
After one turn, Pottery finished at 58 science (step 13). This may be an intended start bonus; unclear.

**Probably not game bugs:** the first taps on the Advisor button (38) and on Offer pact (146) did nothing, and both worked on a retry at a different spot. These look like missed taps.

## 6. What was good

- **Diplomacy:**
  - Pact cost, opinion change (+12 to +37) and the "Break the pact" toggle were immediate and clear (148).
  - The free map trade revealed 821 tiles and gave the run its peak moment (151).
  - Refusal reasons and the opinion gates are shown (167).
  - The empty-state message before meeting anyone explains how to unlock diplomacy (15, 65).
- **Event cards:** clear trade-offs, historical flavour, and meaningful gold, food and manpower choices (10, 17, 123, 160, 174).
- **Settings:** thorough battle defaults, auto-resolve, battle size, performance and sound, with explanations, saved on change (26, 114, 162).
- **Settling:** "Best site" picked a good sugar and river spot quickly and showed the travel time (139, 140, 184, 209).
- **March:** the path preview with a turn count, plus a confirm step (130).
- **Fast turn processing**, plus an advisor that can pick research for you (40).
- **The event log** has filters and is readable apart from the spam.

## 7. Coverage

**Played properly:**
- Cities, builds and settlers
- Diplomacy (pacts, map trade)
- Events
- Settings
- The research screen, as a UI only

**Only glanced at:**
- Start and world setup: the tutorial was skipped at step 4.
- Map pan, zoom and fog: one pinch at step 11; close view never tried.
- Units and armies: two successful marches, many failed selections.
- Economy: event choices and one Empire screen view.
- Era goals: visible on the Empire screen at 120 but not explored.
- Tech tree content: never browsed because of scrolling.

**Missed:**
- Wars and AI behaviour
- RTS battles (deploy, orders, workers, sieges)
- Naval
- Crises, independents, raids, World Congress
- Glossary and help, and save and load (looked for but not found)

**Budget note:** roughly a third of the 214 steps were plain End Turn presses or retries against the stuck panel. The player's "covered all areas" summaries should not be trusted.

**Next run should:**
1. Load presets that start mid-war or next to a hostile neighbour, with a coastal city and several met peoples. This forces an RTS battle, a siege and naval movement.
2. Try saving and loading explicitly, and search the whole UI for help or glossary. If they exist, record where they live.
3. Use close view and zoom on a fogged frontier, and test the map after diplomacy panels close.
4. Revisit army selection on a clean screen to settle whether the faded panel is a bug or a missed March button.
5. Trigger or look for World Congress, crises, independents and raids, ideally from a later-era preset with realistic science and production.

---
214 steps, play $3.18 (claude-sonnet-5-5) + report $0.26 (claude-opus-5-5) = $3.44. Diary: `diary.jsonl`, noted screens: `shots/`.
