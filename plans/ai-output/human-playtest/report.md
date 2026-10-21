# Human playtest: rts-commander

# Playtest report: rts-commander, phone 844x390, 220 steps

## 1. Summary

The persona came only for the real-time tactical battles. Across six sessions and 220 steps it never entered one. The start session was an isolated island with no one to meet. In later eras, war was gated behind a 300 gold cost that the player could not afford, and disabled buttons gave no feedback. The player did find a workaround: demand tribute, get refused, then declare war cheaply (steps 121 to 123). Even so, being at war never produced contact or a battle, and the game offered no way to locate the enemy. Late on, army production stopped registering, and a loop of panels after a war declaration hid the map for about ten steps. Fun sat at 3 for most of the run and sank to 2 by the end. Frustration climbed from 1 to 4. Event cards, the pact flow, the war confirmation dialog and the battle-mode setting were the bright spots.

**The three things that matter most**
1. **There is no reachable path to an RTS battle for a player who wants one.** War is gated by unexplained rules. Declared wars never make contact, and nothing tells the player where the enemy is.
2. **Army production does not queue in later eras** (steps 143 to 149 and 201 to 219). This may also block ending the turn, because the End Turn slot turns into "Choose production".
3. **Disabled actions are silent.** Declare war, the build plus button and the Ruler virtue gave no message when tapped, so the player could not tell blocked from broken.

## 2. Scorecard

| Area | Score | Why |
|---|---|---|
| Start screen and world setup | 7/10 | Civ pick, World setup, Rules and Ready flowed in four taps (steps 1 to 4) with no trouble. |
| Glossary and help | 4/10 | The tutorial pages were skimmed and skipped (5 to 8) and had nothing on battles. No glossary was used, and no help explained war causes or gold costs. |
| Tech tree | 6/10 | Only seen as choice cards (Copper Working at 21, Animal Husbandry at 47). These worked, but the full tree was never opened. |
| Units and armies | 4/10 | March and confirm worked (34 to 37, 89 to 95, 136 to 140). Own and foreign markers look alike (99, 172), and marching onto an enemy marker reported "army already there" (158). |
| Cities, builds and settlers | 3/10 | A Warband queued fine early (14). Later the army rows were greyed or did nothing, with 75 to 107 turn build times (149, 213 to 219). |
| Speed feel | 3/10 | Long runs of End Turn with nothing happening (40 to 48, 164 to 170). Army builds of 75 to 107 turns. |
| Crises, events, era goals, independents, raids, World Congress | 5/10 | Event and crisis cards were clear and frequent (18, 20, 23, 114, 141). The purple markers the player tapped turned out to be Caral or Muisca armies or settle tiles, not independents. No raids, era goals or World Congress were seen. |
| Pacing and fun | 2/10 | For this persona the game was 220 steps of searching without payoff. Fun never rose above 3. |
| Wars and AI behaviour | 2/10 | War could be declared (123, 178), but the AI never made contact over many turns. The Peoples panel showed "Army: ?" (130). |
| Map pan, zoom, close view and fog | 5/10 | Pinch zoom worked (24). Panning showed mostly empty dark space (132). The search button helped the player get back to the capital (133 to 134). Close view and fog were not judged. |
| Diplomacy | 6/10 | The pact gave clear feedback (105). The tribute-to-cause-of-war trick works but is unexplained (120 to 122). Greyed Declare war cards were silent (82, 120). |
| Economy and gold | 4/10 | Gold fell by 1 per turn (85), making the 300 gold war cost unreachable. There was no shortfall message, and the pact cost drained gold from 164 to 14 (105). |
| Save and load | not reached | The player opened the menu looking for save (28). The menu went straight to Settings, and no save or load was tried. |
| RTS battles (deploy, orders, workers, sieges) | not reached | No battle opened in any session. Only the battle default mode setting was seen (29), and it was clear. |
| Naval | not reached | The player looked for boats on the island start (39) and found no ship or embark option. |

## 3. Fun curve

- **Steps 1 to 7: fun 3, frustration 1.** Setup was quick and the player was hopeful.
- **Steps 8 to 43: frustration 2.** The player skipped the tutorial, founded Kish and queued a Warband. Then the island start meant repeated End Turns with no one to fight. Event cards (18, 20, 23) were the only variety.
- **Step 44 onward: frustration 3 becomes the baseline.** The thought lines repeat "hoping for an encounter" (44 to 48). The bronze session (51 to 66) adds only an unclear Ruler virtue choice.
- **Steps 70 to 102: first fun dips to 2.** The cause was dead Declare war buttons (76), gold falling so war was never affordable (85), and tapping the player's own army thinking it was an enemy (99 to 100, 102).
- **Steps 110 to 111 and 122 to 145: small relief, frustration back to 2.** The log was readable. Then the tribute trick finally let the player declare war (122 to 123), and the march toward the enemy felt like progress (138 to 142). **This is the closest thing to a peak.** It is relief rather than fun, since fun never moved above 3.
- **Steps 146 to 151: first frustration 4 and fun 2.** The army build plus button was greyed with a 75 turn build (149).
- **Steps 185 to 192: fun 2, frustration 4.** The panel loop after declaring war (190).
- **Steps 214 to 220: lowest point, fun 2 and frustration 4 to the end.** Production would not register (215, 219), and many turns at war had produced no battle.

**Overall, the curve was flat and slowly sinking.** No step ever delivered the experience the persona came for.

## 4. Top issues (ranked by harm to a real player)

### 1. No reachable RTS battle for a battle-seeking player
- **What happened:** The pattern repeated across every session.
  - The start session was an isolated island with 0 peoples met (26) and no hint on how to meet anyone.
  - War was gated by "No cause for war ... 300 Gold" (82, 120).
  - After war was declared (123, 178), the enemy never appeared. The Peoples panel showed "Army: ?" (130).
  - Marching onto what looked like an enemy marker said the army was already there (155 to 159).
  - The player was told explicitly that this was the biggest gap (163, 172, 220).
- **Steps:** 26, 44 to 48, 68 to 102, 116 to 142, 155 to 159, 176 to 200.
- **Screenshots:** shots/step-026.jpg, shots/step-076.jpg, shots/step-082.jpg, shots/step-130.jpg, shots/step-219.jpg
- **Suggested fix:**
  - Once at war, show where enemy armies and cities are: a "locate enemy" button in Peoples or a front marker on the map.
  - Give the AI a reason to send forces when war is declared.
  - Offer an early way into a battle, such as independents or barbarian camps near every start, a battle tutorial, or a skirmish mode reachable from the start screen.
  - Avoid zero-contact island starts, or hint at boats early.

### 2. Army production does not queue
- **What happened (gunpowder session):** The Legion Musketeers row's plus button was greyed. The row read "Cavalry or Siege not available yet, 224 production, 75 turns" (149). This may be an intended lock, but the reason is not clear.
- **What happened (information session):** Tapping plus on Legion and Siege train rows did nothing, and the city kept saying "Nothing in production" (206, 213 to 214, 219). From the diary it is unclear whether these buttons were also greyed. If they were enabled, this is a real bug.
- **Possible soft lock:** End Turn is replaced by "Choose production" when nothing is queued (162, 209). If nothing can be queued, the player may be unable to end the turn. The player never ended a turn after step 209.
- **Steps:** 143 to 149, 201 to 206, 209 to 219.
- **Screenshots:** shots/step-149.jpg, shots/step-215.jpg, shots/step-219.jpg
- **Suggested fix:**
  - Check that queuing works on late-era army rows.
  - When a row is locked, say exactly what unlocks it.
  - Never let a missing production choice block End Turn.
  - Also review 75 to 107 turn army builds for pacing.

### 3. Disabled actions give no feedback
- **What happened:** Tapping greyed Declare war did nothing, with no message about the missing cause or the gold shortfall (70, 76, 82, 120). The greyed build plus button behaved the same way (149). Tapping the Warlord virtue twice gave no confirmation (55 to 57).
- **Hidden workaround:** The player only discovered that a refused tribute creates a cause for war by reading carefully (120 to 122).
- **Screenshots:** shots/step-057.jpg, shots/step-070.jpg, shots/step-076.jpg, shots/step-082.jpg, shots/step-120.jpg
- **Suggested fix:**
  - Tapping a disabled button should show a toast explaining why, for example "Need 300 gold (you have 171)" or "No cause for war. Demand tribute or wait for an incident."
  - Show a clear selected state and a short effect line on virtues.

### 4. Panel loop after declaring war
- **What happened:** After war was declared, closing Peoples showed the Turn report, and closing that showed Peoples again. This went on for about ten steps (179 to 189). Escape did not help (191). An End Turn and an event card eventually cleared it (192 to 193).
- **Caveat:** The player alternated taps at (790,20) and (759,34). It is possible the report was simply stacked under Peoples, or that one tap reopened Peoples. The screenshot should confirm which.
- **Screenshot:** shots/step-190.jpg
- **Suggested fix:** Close stacked sheets in a fixed order without reopening them. Make Escape and back close the top sheet. Do not queue Peoples to reopen after a declaration.

### 5. End Turn button overlaps content and changes role
- **What happened:** End Turn covered:
  - the bottom of Settings (29)
  - the Log's Upkeep line (110)
  - the Declare war button, which the player had to scroll to reach (118)
  - the Turn report (190)
  
  It also silently became "Choose production" (161 to 162).
- **Screenshots:** shots/step-029.jpg, shots/step-110.jpg, shots/step-162.jpg, shots/step-190.jpg
- **Suggested fix:** Add bottom padding to sheets equal to the button bar height on short phone screens. Keep End Turn visible, and show "production needed" as a badge rather than replacing the button.

### 6. Own and foreign armies look alike on the map
- **What happened:** The player tapped its own 9.7k marker (98 to 99) and its own 10k marker (171 to 172) believing they were enemies. Step 155 may be the same confusion.
- **Screenshot:** shots/step-099.jpg
- **Suggested fix:** Use clearly different colours or frames for own, allied, neutral and enemy armies, and show the owner name on tap.

### 7. Economy blocks war for low-gold players
- **What happened:** Gold was falling by 1 per turn (85). The 300 gold war cost was unreachable in the classical session, and a 150 gold pact wiped out savings (105).
- **Screenshots:** shots/step-085.jpg, shots/step-105.jpg
- **Suggested fix:** Show turns until affordable, and surface ways to raise gold. Consider whether the base war cost is too high in early eras.

### 8. Naval is not discoverable on an island start
- **What happened:** The army panel only offers March, Hold and rename. There was no hint about ships or embarking (39).
- **Screenshot:** shots/step-039.jpg
- **Suggested fix:** On island starts, hint at the tech or building that unlocks boats, and show embark as a greyed option with its unlock.

### 9. Ruler panel is cramped and hard to close
- **What happened:** The unlocked virtues were cut off below (57). The close tap at (758,34) did not close the panel, and the player had to tap the Ruler button again (58 to 59). This could be a missed tap.
- **Screenshot:** shots/step-057.jpg
- **Suggested fix:** Make the panel scrollable with a clear close button sized for touch.

## 5. Bugs

1. **Production does not register (information session)**
   1. Open city production from the bottom bar (201, 595,347).
   2. Choose the Armies filter (202).
   3. Tap a legion row (203 to 204); nothing happens.
   4. Scroll the list and tap plus on Mechanized Infantry legion or Siege train (205 to 206, 212 to 214).
   
   Result: the city still shows "Nothing in production" (215, 219). It is unclear whether the button was visibly disabled. In the gunpowder session the button was greyed with lock text (149), which may be intended.

2. **Panel loop after war declaration (information session)**
   1. Open Peoples (176).
   2. Declare war on Caral and confirm with 305 gold (177 to 178).
   3. Close Peoples (179); the Turn report appears.
   4. Close the report (180); Peoples appears again.
   
   Result: this repeats through step 189. Escape does not break it (191). End Turn plus an event card cleared it (192 to 193). See the caveat under issue 4.

3. **March onto an enemy marker reports "already there" and nothing triggers (gunpowder session, at war with Caral)**
   1. Tap the marker at the top right (155).
   2. Tap March (156).
   3. Tap the same marker as the target (157 to 158).
   
   Result: the game says the army is already there, and no battle or contact follows. It is unclear whether the marker was actually the player's own army (see issue 6).

4. **End Turn slot replaced by Choose production, possible soft lock**
   1. Have a city with nothing queued (161, 209).
   2. The End Turn position now opens production.
   3. If production cannot be queued (bug 1), there may be no way to end the turn.
   
   This needs confirming.

5. **Silent disabled Declare war**
   - On a tile card (68 to 69, 75): tap Declare war against Caral while it is unjustified. Nothing happens.
   - In Peoples (81, 119): tap Declare war with less than 300 gold. Nothing happens.
   
   This may be by design, but there is no feedback.

6. **Layout overlaps on 844x390**
   - End Turn over the bottom of Settings (29).
   - End Turn over the Log's Upkeep line (110).
   - End Turn over Declare war in Peoples (118).
   - End Turn over the Turn report (190).
   - The settlers wait bar over the build list (215).

**Not game bugs:** Steps 107 and 112 were harness refusals of taps outside the screen. The failed Ruler close at step 58 may be a missed tap. No page errors were recorded.

## 6. What was good

- **World setup** was fast and clear (1 to 4).
- **The battle default mode setting** (Command, Auto, Ask each time) was praised as clear (29).
- **Event and crisis cards** gave readable choices and added life during otherwise empty turns (18, 114, 141, 169).
- **The diplomatic pact** gave clear, immediate feedback on opinion and gold (105).
- **The war confirmation dialog** was clear once war was possible (123).
- **The tribute-to-cause-of-war mechanic** works and is a good idea. It just needs explaining (121 to 122).
- **The Event log** is readable and has filter chips (110).
- **March orders** with turn counts and confirmation worked reliably (36, 91, 138).
- **The map search button** recovered the player from an empty view (133 to 134).

## 7. Coverage

- **Played:**
  - start and setup
  - event cards
  - diplomacy (Peoples, pact, tribute, war declaration)
  - army marching
  - city production
- **Glanced:**
  - tech (choice cards only)
  - map zoom and pan
  - Settings
  - Log
  - Ruler virtues
  - tutorial
- **Missed:**
  - RTS battles in full: deploy, orders, workers, sieges
  - naval
  - save and load
  - World Congress, era goals, raids, independents
  - glossary
  - close view and fog
  - AI wartime behaviour (never observed, because contact never happened)

**Next run should:**
1. Start from a save or scenario already at war with an adjacent, visible enemy army, or from a battle sandbox, so the battle screen itself finally gets judged on a phone: deploy, unit orders, workers, sieges, and the "Ask each time" prompt.
2. Re-test late-era army production and End Turn with nothing queued, to confirm or rule out the soft lock.
3. Re-test the war-declaration panel loop with screenshots at each close.
4. Try a continental start to see whether contact and independents appear early, and test save and load from the menu.
5. On an island start, follow the tech path to boats to cover naval.

---
220 steps, play $1.88 (claude-sonnet-5-5) + report $0.24 (claude-opus-5-5) = $2.12. Diary: `diary.jsonl`, noted screens: `shots/`.
