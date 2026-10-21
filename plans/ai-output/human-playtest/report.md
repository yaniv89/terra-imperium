# Human playtest: warmonger

# Playtest Report: Warmonger Persona, Phone Landscape (844x390)

## 1. Summary

A warmonger played 182 steps across six sessions (start, bronze, classical, gunpowder, modern, information) and never fought a single battle. The setup flow, tutorial, event cards and march orders all worked. The conquest loop stalled at every stage:

- No neighbour was met in the opening turns.
- Armies marched into empty wilderness and had to walk home to refill supply.
- The Declare War button stayed dimmed with no explanation.
- A war finally declared in the gunpowder session led nowhere visible.
- In the modern session, Caral showed as Neutral and its location was never found.

Save/load could not be found at all. Settlers sat at several times their cost without finishing. Many panels are cramped or covered by the End Turn button on a landscape phone. Fun stayed flat at 3 almost the whole run. It peaked at 4 only at the war declaration dialog and dipped to 2 during the early save hunt.

**The three things that matter most:**
1. **A conqueror cannot find or reach anyone to fight.** There is no enemy location, no attack target and no path from "at war" to "battle". RTS battles were never reached.
2. **Save and load could not be found.** The Menu button opened Settings, and Settings has no save section.
3. **City production looks broken.** Settlers showed 318/117 and 450/140 and still said "1 turn" across several sessions, and build times read as 29 to 36 turns.

## 2. Scorecard

| Area | Score | Why |
|---|---|---|
| Start screen and world setup | 7/10 | Four taps from nation pick to game start (steps 1 to 4), defaults felt fine, no friction. |
| Glossary and help | 5/10 | Tutorial was read through without complaint (5 to 11). The glossary itself was never opened. |
| Tech tree | 4/10 | Only a research pick card (25) and an "Advisor picks" prompt. The tree was never opened. |
| Units and armies | 5/10 | March with path preview and turn count works well. A single unit shows 10x its soldier count (81, 143), and armies have nothing to engage. |
| Cities, builds and settlers | 3/10 | Founding was easy (14). The build list shows about 2 rows, settlers are stuck above cost, and builds take 29 to 36 turns. |
| Speed feel | 4/10 | Long runs of pure End Turn taps (41 to 42, 60 to 63, 75 to 79, 87 to 99, 138 to 141) with nothing to do. |
| Crises, events, era goals, independents, raids, World Congress | 6/10 | Event cards were clear and quick (21, 24, 27, 78, 148, 160). A purple "?" unit was seen (102). No World Congress, raids or era goals were seen. |
| Map pan, zoom, close view and fog | 4/10 | One pinch (22): the map felt small and fogged. A map lens menu opened by accident (84). Enemy positions were never findable. |
| Diplomacy | 5/10 | Silent dimmed button at first (119 to 121). Later the tribute-demand route to a cause, and the confirm dialog, were praised (155 to 157). Panel is cut off (153). |
| Pacing and fun | 3/10 | Fun stayed at 3 for about 170 of 182 steps, with one brief peak to 4. The persona's core loop never paid off. |
| Economy and gold | 5/10 | Gold mattered (300 gold war cost vs 170 held, a 100 gold food import, 198 to 148 on an event), but the player saw only falling numbers and no clear income levers. |
| Save and load | 1/10 | Not found after six attempts across two sessions (33 to 40, 111 to 116). |
| Wars and AI behaviour | 2/10 | A war was declared once (157). No AI response, enemy army or city was ever seen. War state is unclear in the next session (173). |
| RTS battles (deploy, orders, workers, sieges) | not reached | No battle occurred in 182 steps. |
| Naval | not reached | No coast, ships or naval entry point was seen (49). |

## 3. Fun curve

**Start session (1 to 50).**
- Steps 1 to 28 held at fun 3 with frustration 1 to 2. Setup, tutorial, founding Kish and queuing a Warband all went smoothly.
- The first sag came at 29 to 30. By turn 4 the player had met nobody, and fun dropped to 2.
- Frustration rose to 3 during the save hunt (37 to 40), when the Menu button kept opening Settings.
- It stayed at 3 through the unconfirmed virtue pick (44 to 46) and the session close (50). This is the **lowest stretch of the run** (fun 2, frustration 3, steps 37 to 50).

**Bronze session (51 to 100).**
- Fun held at 3 with frustration 2 while building Spearmen and marching toward the Beni and Mamoré (51 to 80).
- At 81 the army arrived in empty country with supply draining 10 a turn. Frustration rose to 3 and stayed there for the whole forced march home (82 to 100).

**Classical session (101 to 149).**
- Frustration was 2 at the start, then 3 from the virtue confirmation problem (109 to 110) and the settings and save dead end (116 to 117).
- It stayed at 3 through the dimmed Declare War button (120 to 123) and the 36-turn build list (130 to 131).
- It eased back to 2 while the army marched (132 to 149).

**Gunpowder session (150 to 161).**
- This is the **peak**. The player found that demanding tribute creates a cause for war, then declared war on Caral through a dialog they explicitly liked.
- Fun rose to 4 and frustration fell to 1 at steps 157 to 159. This was the only time fun went above 3.

**Modern session (162 to 174).**
- The session opened at frustration 1 while marching "toward Caral".
- Frustration rose to 2 at 171 when the army arrived near Tiwanaku with no enemy in sight, and again at 173 when Caral showed as Neutral.

**Information session (175 to 182).**
- Flat at fun 3, frustration 2, ending on the confusing 450/140 settlers.

**Overall:** the curve barely moves. The highest point came from a diplomacy dialog, not combat. The lows came from things the player could not find (save, enemies, feedback on taps).

## 4. Top issues (ranked by player impact)

### 1. The conquest loop has no reachable target
- **What happened:** In the start session no people was met by turn 8 (29, 50). In bronze and classical the army marched to river regions and found nothing to attack (81, 143), only a supply drain. After war was declared on Caral (157), the modern session's march ended near the player's own city with no enemy visible. The Peoples panel does not say where Caral is (171, 173). Zero battles in 182 steps.
- **Unclear:** At 165 the player picked a map tile "toward Caral" without knowing where Caral was, so the march target itself may have been a guess.
- **Steps:** 29, 50, 66 to 81, 135 to 143, 163 to 173
- **Screenshots:** shots/step-029.jpg, shots/step-081.jpg, shots/step-143.jpg, shots/step-171.jpg, shots/step-173.jpg
- **Fix:**
  - Add a "Show on map" or "March to" button on each known people in the Peoples panel.
  - When at war, highlight enemy cities and armies and offer them as march targets.
  - Make the army panel list nearby attackable targets.
  - Consider guaranteeing first contact with a neighbour within the first few turns.

### 2. Save and load cannot be found
- **What happened:** The bottom-right Menu button (770, 365) opened Settings every time, four times in the start session. In classical, scrolling Settings to the bottom showed only sound, performance and battle options.
- **Unclear:** Save may exist somewhere else, or may be automatic. Either way, the player could not find it or confirm it.
- **Steps:** 32 to 40, 113 to 116
- **Screenshots:** shots/step-040.jpg, shots/step-116.jpg
- **Fix:**
  - If the button opens Settings, label it Settings.
  - Add a visible Save / Load / Main Menu section at the top of that panel.
  - If the game autosaves, say so ("Autosaved turn 12").

### 3. Settlers stuck above cost and very slow builds
- **What happened:**
  - "Settlers finish in 1 turn" appeared at 65 and again at 133.
  - The build list showed Settlers at 318/117 still building (130), then 450/140 "1 turn" (180).
  - Military builds showed 36 turns (130), and a warning said 29 builds were slow at 3 production (180).
  - There is also a puzzling "36 turns at 107 production" reading (130), which looks inconsistent with a production of 107.
- **Unclear:** Settlers may be waiting on a hidden requirement such as city size or a free tile. If so, nothing tells the player.
- **Steps:** 64 to 65, 124 to 133, 176 to 180
- **Screenshots:** shots/step-130.jpg, shots/step-180.jpg
- **Fix:**
  - If a build is blocked, show the reason ("Needs size 2") instead of "1 turn".
  - Otherwise, investigate why the progress overflow never completes the item.
  - Check that the turn estimates match the displayed production.

### 4. Declare War is disabled silently, and the cause-for-war route is hidden
- **What happened:** The button was dimmed (no cause, costs 300 gold, player had 170). Two taps did nothing (119 to 121). One session later the player discovered that a refused tribute demand creates a cause and lowers the cost to a decree (155 to 157), and loved that dialog.
- **Steps:** 118 to 121, 154 to 157
- **Screenshots:** shots/step-121.jpg, shots/step-153.jpg
- **Fix:**
  - On tapping a disabled war button, show a toast listing what is missing and how to get a cause, for example "Demand tribute to create a cause".

### 5. War state is unclear between sessions
- **What happened:** War was declared on Caral in gunpowder (157). In modern, Caral showed as NEUTRAL with no cause (173).
- **Likely explanation:** Sessions appear to be separate setups rather than one continued game. The start session was Akkad founding Kish, while later sessions are around Tiwanaku and South American rivers. So this is probably a harness reset, not a game bug. Still, the panel gave no war history or status that would let a player tell.
- **Steps:** 157, 172 to 173
- **Screenshots:** shots/step-173.jpg
- **Fix:**
  - The dev team should confirm whether sessions carry state.
  - In the game, show war status and its start turn clearly in the Peoples panel.

### 6. Supply drain punishes scouting with the main army
- **What happened:**
  - Twice the army walked 3 to 4 turns into wilderness, found nothing, then spent the rest of the session walking home before starving (82 to 99, 144 to 147).
  - The first march home ended "near home" but still low on supply (88 to 90). It needed another 4-turn march with 2 supply left (93).
  - The player did call the supply warning clear (143).
- **Steps:** 81 to 99, 143 to 147
- **Screenshots:** shots/step-081.jpg, shots/step-143.jpg
- **Fix:**
  - Show supply range on the map during march target selection, and warn before confirming a march out of range.
  - Make it clear which tiles refill supply.

### 7. Layout problems on landscape phone
- **What happened:**
  - The End Turn button covers the bottom of the Event Log (48), the Settings text (116) and the Peoples panel war and pact cards (153).
  - The army build list shows about 2 rows (130).
  - The Ruler virtue rows are cut off (109).
- **Steps:** 47 to 48, 109, 116, 130, 153
- **Screenshots:** shots/step-048.jpg, shots/step-109.jpg, shots/step-116.jpg, shots/step-130.jpg, shots/step-153.jpg
- **Fix:**
  - Hide or dock End Turn while a full panel is open.
  - Give lists the full panel height in landscape.

### 8. Virtue pick gives no confirmation
- **What happened:** In two sessions, tapping Warlord twice left the panel looking unchanged (44 to 46, 107 to 109). The player never knew whether the point was spent.
- **Unclear:** The rows are cut off (109), so the confirm button may be off-screen.
- **Steps:** 43 to 46, 106 to 109
- **Screenshots:** shots/step-109.jpg
- **Fix:**
  - Show a selected state and a visible Confirm button.
  - Show a toast when the point is spent.

### 9. Army soldier count is 10x the unit strength
- **What happened:** One Spearmen unit showed 9,130 soldiers (81). One 941/1000 Swordsmen unit showed 9,410 (143).
- **Steps:** 80 to 81, 142 to 143
- **Screenshots:** shots/step-081.jpg, shots/step-143.jpg
- **Fix:** Either fix the multiplier or explain the scale ("1 strength = 10 men").

## 5. Bugs

**Settlers never complete despite progress far above cost (likely bug)**
1. Open Cities, select the capital, and open the city's Build tab (124 to 127 or 176 to 179).
2. Observe Settlers at 318/117 (130) or 450/140 (180), both labelled "1 turn".
3. End turn (133). The settlers are still reported as "1 turn" in later sessions (177).

**Army soldier count shows 10x unit strength (likely bug or unexplained scaling)**
1. Build one Spearmen or Swordsmen unit.
2. Select the stack and open the army panel (80, 142).
3. The soldier total reads 9,130 or 9,410 for a single unit at 913 or 941 strength.

**Menu button opens Settings, and no save/load is present (bug or mislabel)**
1. Tap the bottom-right button at about (770, 365) (32, 34, 36, 38, 113).
2. Settings opens.
3. Scroll to the bottom (114 to 115). There are no save or load options.

**Disabled Declare War gives no feedback (UX defect)**
1. Open Peoples while holding no cause and under 300 gold (118).
2. Tap Declare War on Caral (119, 120).
3. Nothing happens, and no message appears.

**Virtue selection shows no confirmed state (UX defect, possibly hidden confirm button)**
1. Open Ruler when it shows a red dot (43 or 106).
2. Tap Warlord twice (44 to 45, 107 to 108).
3. The panel is unchanged.

**War state lost between sessions (unclear, probably harness setup)**
1. Declare war on Caral in the gunpowder session (155 to 157).
2. In the modern session, open Peoples (172).
3. Caral shows NEUTRAL.

**Not counted as bugs:**
- Step 84: the map lens menu opened when the player tapped near the bottom-left. This was probably a missed tap.
- Step 111: tapping (770, 325) opened the Log instead of the Menu. This was a mis-tap on the Log button, not a game fault.

## 6. What was good

- **Setup and tutorial flow:** Setup was fast, and the tutorial pages advanced cleanly (1 to 11).
- **City founding and first build:** Founding a city on a river site and queuing a Warband were easy (14 to 17).
- **March orders:** The path preview with turn count worked every time (69, 137, 166), and turns-remaining feedback was shown while marching.
- **Supply warning:** The player called the warning "clear" (143), even though the mechanic itself was frustrating.
- **Event cards:** They were quick and readable, and the choices fit the persona (manpower, fort level, aggressive adoption, food import).
- **War declaration via tribute:** The tribute-demand route to a cause for war, and the war confirmation dialog, were the best moment of the run: "clear cost and cause shown, I like this dialog" (157, fun 4).
- **Stability:** No page errors were recorded across all sessions.

## 7. Coverage

**Played properly**
- Start and world setup
- Tutorial
- City founding and the build queue
- Army march and supply
- Event cards
- The diplomacy war flow (Peoples panel, tribute, declaration)

**Only glanced at**
- **Tech tree:** a single research pick card, and the tree was never opened.
- **Map pan and zoom:** one pinch.
- **Economy:** gold was read off event costs only.
- **Ruler and Legacy panels:** opened briefly.
- **Independents:** the purple "?" unit at 102, which was not explored.
- **Glossary:** the "glossary" entry was a Peoples tap at 118, so the glossary itself was not reached.

**Missed**
- RTS battles: deploy, orders, workers, sieges
- Naval
- World Congress, raids, era goals
- AI war behaviour
- Save and load (not found, so not tested)

The player's session summaries claim "every checklist area covered at least briefly". The diary does not support that for battles, naval, World Congress or the glossary.

**Next run should aim at:**
1. **Starting an actual battle.** Use a session already at war with a known enemy city adjacent to the player's army, so deploy, orders and sieges can be judged.
2. **A coastal start** so naval units and sea movement are reachable.
3. **Opening the tech tree and glossary directly**, and checking World Congress in a later era.
4. **Confirming whether save/load exists anywhere** (main menu, pause screen).
5. **Retesting the settlers overflow** with a city of known size.
6. **Clarifying with the harness team whether era sessions share state**, so a war declared in one session can be followed into the next.

---
182 steps, play $1.52 (claude-sonnet-5-5) + report $0.22 (claude-opus-5-5) = $1.73. Diary: `diary.jsonl`, noted screens: `shots/`.
