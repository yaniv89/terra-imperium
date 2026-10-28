# Human playtest: warmonger

# Playtest report: warmonger persona, campaign, phone 844x390 (en)

## 1. Summary

The warmonger played 60 steps over three sessions: a fresh start as Akkad (steps 1 to 20), a classical-era save as Israel at war with Akkad (21 to 40), and a gunpowder-era save as Israel at war with Saba (41 to 60). The harness caught no page errors, and all three sessions opened on a working game screen.

Setup, the tutorial, save and load, naval boarding and sailing, and era goals all worked and read clearly. The session's goal, though, was to fight battles, and the player never got one. Fun sat at a flat 3 for almost the whole run and fell to 2 at the end, when frustration rose to 3.

Part of that is the game: production prompts kept pulling attention, there was nothing military to build at the very start, and nothing showed when contact would happen. Part of it is the run itself. The player ended only three turns in total (steps 33, 38 and 56). In the gunpowder session they never ordered the land army to march; they sailed one musketeer unit to a nearby tile instead.

**The three things that matter most:**
1. **Being at war did not lead to a fight, and nothing told the player when one would come.** See steps 27 to 28, 33, 38 and 56 to 58. A conquest player needs a visible path from "at war" to "battle".
2. **"Choose production" prompts eat a war player's attention.** The fix, "Always" advisor builds, was only found at step 59.
3. **A conqueror has nothing military to build on turn 1.** Warband is locked behind Hunting Bands (steps 17 to 20).

## 2. Scorecard

| Area | Score /10 | Why |
|---|---|---|
| Start screen and world setup | 8 | Civ pick, map, speed, summary and a 4-page tutorial all went smoothly (steps 1 to 10). The only friction was a full-screen tip that needed dismissing (step 3). |
| Tech tree | 6 | Opened All techs and the chooser and picked Hunting Bands without trouble (11 to 13). The player left no comment on readability. |
| Cities, builds and settlers | 6 | Founding, the build list, filters and advisor picks worked (14 to 19, 52 to 55). Repeated production prompts hurt, and the "Always" option is easy to miss (58, 59). |
| Units and armies | 5 | Selecting and marching armies worked (24, 25, 41). No military unit could be built at the start (19, 20). The army strength readout is unclear (60k, then 50k, then "40k" at 58). |
| Economy and gold | 5 | Glanced only. The player saw the Buy cost of 336 gold out of 500 at step 20, with no deeper look. |
| Map pan, zoom, close view and fog | 5 | Zoom-out worked at step 26 but "barely zoomed" at step 45. A tip needed two taps to close, and the second tap leaked through to the map (21 to 23). Fog was never commented on. |
| Wars and AI behaviour | 4 | The march plan with supply and garrison warnings was a highlight (28). No battle happened and no AI action was seen. |
| Diplomacy | 3 | Tapping Pontus in Peoples opened a glossary entry instead of a diplomacy card (30, 31). No diplomatic action was taken. |
| Glossary and help | 7 | The index with categories opened and closed cleanly (31, 32). Getting there by accident when diplomacy was wanted counts against it. |
| Speed feel | 6 | Turns showed "Still working..." and the player waited 3 s (39, 57). No hangs, but nothing to do during the wait. |
| Save and load | 8 | Save confirmed with "Saved, turn 117", and the load restored the army mid-march (35 to 38). It is unclear whether the manual save appears separately from the autosave (37). |
| Crises, events, era goals, independents, raids, World Congress | 6 | The era goal card was clear and fun to pick (40, fun 4). Crises, independents, raids and World Congress were not reached. |
| Naval | 7 | Board, sail and land orders all worked with confirmations (42 to 51). The landing result was never seen, and the sail target was a test tile, not Saba. |
| Pacing and fun | 3 | Flat fun of 3 with no payoff for a war player. Ended at fun 2, frustration 3 (58 to 60). |
| Real-time battles (deploy, orders, workers, sieges) | not reached | No battle opened in any session (58, 60). |

## 3. Fun curve

- **Steps 1 to 17 (setup, tutorial, first city):** fun 3, frustration 1. Smooth, but no excitement.
- **Steps 18 to 20:** frustration rose to 2. Scrolling the build list showed that Warband is locked, so the conqueror had to queue Settlers.
- **Steps 21 to 23:** frustration 2. The tip's X did not respond and a tap leaked through to the map.
- **Step 28: first peak (fun 4).** The march plan warned about supply and an unknown garrison, and the player committed to attacking Kish. This is the moment the persona wanted.
- **Steps 29 to 38:** back to fun 3. Diplomacy detoured into the glossary (31, frustration 2), then save and load, then end turn.
- **Step 39:** frustration 2 while waiting for the turn.
- **Step 40: second peak (fun 4).** Picking the War era goal (win 2 battles) fit the persona well.
- **Steps 41 to 57:** fun 3, with frustration ticking up to 2 at 46 (weak pinch), 51 and 55 (production chores).
- **Steps 58 to 60: the low point (fun 2, frustration 3).** The player ran out of steps with no battle and wrote the pacing note.

Both peaks were moments of military intent: committing to an attack, and choosing a war goal. The sink came because neither paid off within the run. Fun never went above 4 or below 2, so nothing was really bad. The run was mostly uneventful for this persona.

## 4. Top issues (ranked by harm to a real player)

### 1. At war, but no battle and no sense of when one will come
- **What happened:** The army was sent to march on Kish (27, 28) and the player ended the turn twice (33, 38), with no contact. In the gunpowder save the player reported "many turns" at war with Saba, a big army near the border, and no battle (58).
- **Steps:** 27, 28, 33, 38, 56 to 58, 60.
- **Screenshot:** shots/step-058.jpg
- **Caveat:** This is not clearly a game fault. Only three turns were ended in the whole run. The "many turns at war" were mostly in the loaded save's history, not played. In the gunpowder session the land army was selected (41) but never given a march order, and the fleet sailed to a nearby test tile, not toward Saba.
- **The real problem:** Nothing on screen told the player how to get a fight or how long it would take.
- **Suggested fix:**
  - Show turns-to-arrival on the march plan and on the marching army.
  - Push a clear "battle next turn" heads-up.
  - When an army sits next to an enemy, offer a direct Attack action.
  - Consider an "end turns until contact" option.

### 2. Production prompts keep interrupting the war
- **What happened:** Every turn started with "Choose production" for some city, even right after Advisor builds (55, 58). The player spent steps on Highway and on filling queues instead of fighting (52 to 55). Turning on "Always" advisor builds fixed it and brought back End Turn (59, 60), but it was found only at the end.
- **Steps:** 52 to 55, 58, 59.
- **Screenshot:** shots/step-058.jpg
- **Suggested fix:**
  - Offer "Always use advisor builds" on the first production prompt.
  - Let End Turn proceed with idle cities, showing a light warning instead of a block.
  - Check why a prompt appears again right after Advisor builds (see Bugs).

### 3. No military unit available at the start
- **What happened:** The Armies filter showed Warband locked behind Hunting Bands, which takes 4 turns, so the conqueror had to queue Settlers (17 to 20).
- **Steps:** 17 to 20.
- **Screenshot:** shots/step-020.jpg
- **Suggested fix:**
  - On a locked unit, show "unlocks with Hunting Bands, about 4 turns".
  - Allow a weak basic unit from turn 1.
  - Have the tech chooser flag Hunting Bands as the first military tech.

### 4. Peoples list does not lead to diplomacy
- **What happened:** Tapping Pontus in Peoples, hoping to find an ally, opened Pontus's glossary entry instead of a diplomacy card (30, 31). The player never found diplomacy actions.
- **Steps:** 29 to 31.
- **Screenshot:** none saved.
- **Suggested fix:** Make the main tap on a people open their diplomacy card, and keep the glossary as a secondary "info" button. If diplomacy lives elsewhere, link it from this screen.

### 5. Tip close button and tap-through
- **What happened:** The X on a full-screen tip did not respond to the first tap (21). The second tap closed it, but also went through and opened a tile panel (22, 23).
- **Steps:** 21 to 23.
- **Screenshot:** none saved.
- **Caveat:** This may be a slow close animation rather than a missed hit.
- **Suggested fix:**
  - Enlarge the X hit area.
  - Swallow input for a short time after a modal closes.
  - Give instant visual feedback on tap.

### 6. Pinch zoom inconsistent
- **What happened:** Zoom-out worked well enough to find Kish at step 26, but at step 45 the same gesture "barely zoomed".
- **Steps:** 26, 45, 46.
- **Screenshot:** none saved.
- **Caveat:** The difference could be the zoom level the player started from or a zoom limit.
- **Suggested fix:**
  - Check pinch sensitivity and zoom limits in sail mode.
  - Add zoom buttons or a world-view shortcut on phones.

### 7. Turn processing waits with nothing to do
- **What happened:** "Still working..." appeared and the player waited about 3 s (39, 57). This is mild, but it adds up for a player trying to reach a war.
- **Steps:** 39, 57.
- **Suggested fix:** Show what the AI is doing (war moves, army positions) during processing. That would also help with issue 1.

## 5. Bugs

Each item lists the reproduction steps taken from the diary, then what to check. Several may be design choices or player misreads, and are marked as such.

### 1. Tip dismiss needs two taps, and the second tap leaks to the map (possible)
1. Load the classical campaign save.
2. Tap the X on the full-screen tip (586,71).
3. Observe no response (step 21).
4. Tap the X again (587,72).
5. The tip closes and a tile panel opens underneath (steps 22, 23).

### 2. Production prompt returns right after Advisor builds (possible)
1. Load the gunpowder save.
2. Tap Advisor builds (step 55).
3. Observe "All queues filled".
4. End the turn (step 56).
5. A "Choose production" prompt appears again for some city (step 58).

**Unclear:** a city may simply have finished its item during that turn. Check whether the advisor queues only one item per city.

### 3. Tapping a people in Peoples opens its glossary entry (likely design, but confusing)
1. Open Peoples (step 29).
2. Tap Pontus (step 30).
3. A glossary entry opens instead of diplomacy (step 31).

### 4. Pinch zoom barely moves (possible)
1. In the gunpowder save, select the fleet.
2. Enter Sail mode (step 44).
3. Pinch at scale 0.5 around (400,200) (step 45).
4. The map barely zooms (step 46).

Compare with step 26, where the same gesture in march mode worked.

### 5. Army strength readout inconsistent (unclear, may not be a bug)
1. In the gunpowder save, the army reads 60k (step 41).
2. Board one musketeer unit onto the fleet; the army reads 50k (step 44).
3. After one end turn, the player describes a 40k army near the border (step 58).

Check whether attrition or a second boarding explains the drop, or whether the label is misleading.

### 6. Save list shows only an autosave after a manual save (unclear)
1. Open Menu.
2. Tap Save now; the label reads "Saved, turn 117" (step 36).
3. Open Load. The list shows "my autosave from turn 117" (step 37).

Confirm whether manual saves get their own labelled slot.

## 6. What was good

- **Setup flow:** Civ, map, speed and summary were clear on a small phone screen. Fast speed was easy to find (steps 1 to 6).
- **Tutorial:** Short and easy to click through (7 to 10).
- **Advisor guidance:**
  - The founding site was recommended with its yield shown ("+3 food", step 15).
  - An advisor build pick was offered when the military build was locked (19).
- **March plan:** The supply and unknown-garrison warnings made committing to an attack feel weighty (28, fun 4).
- **Save and load:** Clear confirmation, and the load restored the mid-march state exactly (35 to 38).
- **Era goals:** The War goal ("win 2 battles, +40% morale recovery") spoke directly to the persona (40, fun 4).
- **Naval transport:** Board, sail and land orders were understandable, with confirmations, and the army count updated on boarding (42 to 51).
- **Advisor builds "Always":** Once found, it removed the prompt chore completely (59, 60).
- **Stability:** No page errors were caught across three sessions.

## 7. Coverage

**Played properly:**
- Start screen and world setup
- Cities, builds and settlers
- Save and load
- Naval (boarding and sailing; the landing result was not seen)

**Only glanced at:**
- Tech tree (one pick)
- Economy and gold (one Buy price)
- Glossary (the index, reached by accident)
- Era goals (one card)
- Speed feel (two waits)
- Map zoom (two pinches)
- Units and armies (select and march only)

**Missed:**
- Real-time battles: deploy, orders, workers, sieges. This is the persona's main goal.
- AI war behaviour
- Diplomacy actions
- Fog
- Crises, independents, raids, World Congress
- Unit production and upgrades in later eras

**Next run should aim at:**
1. **Reaching a battle.** Load a save where an army is already next to an enemy army or city, issue a direct march or attack onto it, and end turns repeatedly until a battle opens. Then test deploy, orders and a siege of Kish.
2. **Turning on "Always" advisor builds early,** so steps go to the war, not to queues.
3. **Finding the diplomacy card** by a route other than tapping a people's name, and trying an alliance or peace offer.
4. **Finishing the naval landing** on the enemy coast and seeing whether an amphibious battle triggers.
5. **Rechecking the issues found here:** the tip tap-through, the weak pinch zoom, and the production prompt that returned after Advisor builds.

---
60 steps, play $1.06 (claude-opus-5-5) + report $0.17 (claude-opus-5-5) = $1.23. Diary: `diary.jsonl`, noted screens: `shots/`.
