# Human playtest: newcomer-phone

# Playtest report: newcomer-phone, campaign, phone 844x390

## 1. Summary

A first-time player on a sideways phone started a guided campaign as Kemet and played about 28 turns in 126 steps.

**What worked:**
- The opening was smooth: one tap into a guided start, a short tutorial, and an advisor that picks research.
- Queueing settlers and the "Best site" helper both worked.
- Events with clear rewards were easy to pick.
- Save and load worked twice, with a clear confirmation.

**What went wrong:**
- The session was dominated by one army. The player sent it exploring with "To the unknown" (step 28), and it was starving by around turn 16 (steps 49, 59).
- From steps 77 to 119 the player could not find how to order it home. The army panel text was cut off, a drag panned the map instead of scrolling, and tapping the army on the map opened tile info.
- An attempt to approach a neighbour peacefully was blocked by a "declare war first" message.
- No battle, ship or real diplomacy was ever reached.
- Fun sat at 3 the whole time and never rose above it. It dropped to 2 during the army hunt.

**The three things that matter most:**
1. **Army orders are hard to find on a phone.** The March button sits below the fold of a panel the player could not scroll on the first try. Tapping the army on the map shows tile info, not orders.
2. **Starvation and supply are not explained.** There is no obvious way to recover a starving army. The player watched it lose strength and morale for about 12 turns and could not act.
3. **There is no peaceful way to go and meet a neighbour.** Moving toward Mycenae asks for a war declaration, and "Show on map" lands on open sea with no marker. Combined with the lack of any conflict, 28 turns passed with nothing exciting happening.

## 2. Scorecard

| Area | Score | Why |
|---|---|---|
| Start screen and world setup | 8/10 | One tap into a guided Kemet start (step 1); nothing confusing. Only one step of evidence. |
| Glossary and help | 6/10 | The tutorial was clicked through without complaint (steps 2 to 8). The guide at step 90 pointed to a farm, but the player then spent 5 steps hunting for it. |
| Tech tree | 5/10 | Glanced only: "let the advisor choose" (step 9). The tree itself was never opened. |
| Cities, builds and settlers | 6/10 | Settlers queued easily (steps 11, 57) and "Best site" was helpful (steps 64, 65). Finding a food building took steps 92 to 97. Closing the city screen took two taps (steps 98, 99). |
| Map pan, zoom, close view and fog | 3/10 | The player lost track of their own land (step 23). "Show on map" jumped to sea (step 72). There was no deliberate pan or zoom, and fog was never commented on. |
| Speed feel | 5/10 | No complaints about waiting. However, every end turn needed an extra tap to close the report (12 or more times). |
| Crises, events, era goals, independents, raids, World Congress | 7/10 | Many events with readable rewards (steps 15, 21, 37, 39, 41, 61, 67, 74). Effects were sometimes unclear ("not sure what it does", step 15). The raid had no visible follow-up. Era goals and World Congress were not seen. |
| Diplomacy | 3/10 | Only the Peoples panel and "Show on map" were used (steps 18, 19, 70, 71). The peaceful approach was blocked (step 51). |
| Units and armies | 2/10 | March worked early (steps 29, 54). Later the player was stuck for about 40 steps (77 to 119) with clipped text, a scroll that panned the map, and a map tap that gave tile info. |
| Economy and gold | 6/10 | Ruler virtue points were found via a red dot (step 32), and gold visibly rose to 751 (step 40). Picking Founder took three taps (steps 33 to 35). |
| Wars and AI behaviour | not reached | Only one end turn was tagged here (step 42). There was no war, and no AI action was seen. |
| Save and load | 9/10 | Worked twice with confirmations (steps 43 to 47, 102 to 106); state was restored. |
| Pacing and fun | 3/10 | Fun stayed flat at 3 and never higher; 28 turns passed without a battle, a ship or a meeting. |
| Naval | not reached | Tagged at step 72, but that was only a sea view after "Show on map". |
| RTS battles (deploy, orders, workers, sieges) | not reached | Tagged at step 76, but that was only the army idle button. No battle happened. |

Note: the player's final summary (step 126) says "Covered all areas". That is not accurate. Naval, RTS battles and wars were only tagged, never played.

## 3. Fun curve

**Fun:**
- Flat at 3 from steps 1 to 82. It never went higher at any point in the session, so there is no real peak.
- Dropped to 2 from steps 83 to 96, while the player could not move the army and hunted for a farm.
- Back to 3 at step 97, when Storage Pits was found.
- Down to 2 again from steps 115 to 118, after more failed attempts to order the army.
- Back to 3 at step 119, when the March button was finally found, and stayed there to the end.

**Frustration:**
- 1 during the tutorial and first city setup (steps 1 to 12).
- 2 from step 13, when panels started covering the map.
- 3 at steps 51 to 55 (the "declare war first" message) and steps 72 to 73 (lost at sea).
- 3 again from step 77, when the starving army appeared.
- **4 at steps 83 to 96 and 115 to 118.** These were the low points, both about army orders.
- Eased to 2 at steps 106 and 107, when the load succeeded.
- Settled at 3 through step 126, because the army was still starving even though it was finally moving.

**Why it never peaked:** nothing exciting happened. Most steps were end turns and event picks. The thoughts at steps 48, 60, 62, 69, 72, 73, 75 and 76 repeat "hoping for a battle or ships".

## 4. Top issues (ranked by harm to a real player)

### 1. The player cannot find how to move an army on phone

**What happened:**
- The army panel text was cut off at the bottom (step 77).
- A vertical drag on the panel moved the map instead (steps 78, 79).
- There was no visible March button (step 83).
- Tapping the army on the map opened tile info instead of orders (steps 84 to 87, 114 to 116).
- At step 118 a drag at a different spot did scroll, and step 119 revealed "March". The tile-then-confirm flow at steps 120 and 121 then worked.

**Steps:** 77 to 121.

**Screenshots:** shots/step-077.jpg, shots/step-083.jpg, shots/step-115.jpg.

**Fix:**
- Pin the primary orders (March, Go home, Path) in a fixed bar at the top of the army panel, never below a scroll.
- Make the panel visibly scrollable (fade or scrollbar) and keep drags inside it from reaching the map.
- When a tile holds the player's army, make the tap select the army first and show tile info second.

### 2. Starvation is not explained and cannot be recovered

**What happened:**
- At step 29 the player was warned that "To the unknown" could cause starvation, but went anyway.
- The army was "nearly starving" by step 49 and starving through step 125, at morale 0 by step 83 and losing 5% per turn.
- The player guessed that a farm or Storage Pits in the city would help (steps 90 to 97). It is unclear from the diary whether that does anything for a distant army.

**Steps:** 29, 49, 59, 77, 83, 90 to 97, 108 to 125.

**Screenshots:** shots/step-077.jpg, shots/step-083.jpg.

**Fix:**
- On the starving warning, offer a one-tap "Return to supply" action.
- State plainly what restores supply.
- Have the advisor or guide flag a starving army each turn with a direct button.
- Consider stopping auto-explore before supply runs out.

### 3. No peaceful way to meet neighbours, and "Show on map" lands on sea

**What happened:**
- "Toward Mycenae" asked for a war declaration, even though the player only wanted contact (step 51).
- "Show on map" jumped to water with no city or marker (steps 19, 20, 71, 72).

**Screenshots:** shots/step-051.jpg, shots/step-072.jpg.

**Fix:**
- Allow moving toward a peaceful people up to their border, or offer "Send envoy" in place of the war prompt.
- Make "Show on map" centre on a visible marker and pulse it, even when the city is fogged.
- It is unclear whether the target was simply under fog; the screenshot should be checked.

### 4. Nothing exciting reaches a newcomer in 28 turns

**What happened:**
- No battle, ship or diplomacy event occurred.
- The raiders event (step 41) gave no visible consequence.

**Steps:** 41, 48, 60, 69, 72, 75, 76.

**Fix:**
- In the guided start, script an early skirmish or raid that leads into a small tactical battle.
- Add an early nudge toward the coast or a first ship.

### 5. The end-turn report needs a tap every single turn

**What happened:** after each end turn the player had to close a report sheet. This happened at steps 59, 62, 68, 75, 81, 89, 101, 108, 110, 112, 123 and 125, which nearly doubles the taps per turn. The player called it out in the final summary.

**Fix:**
- Let End turn also dismiss the report, or show it as a small toast.
- Add an "auto-close unless important" option.

### 6. Panels pile up and cover the map

**What happened:**
- Closing the city screen needed a second close for an info card (steps 12, 13 and 98, 99).
- The Cities panel stayed over the map after a close tap (steps 25, 26).
- The player lost track of their own land (step 23).

**Fix:**
- Make one close tap clear the whole stack, or add a "back to map" button.
- Add a "home" button that centres on the capital.

### 7. Event and virtue effects are vague to a newcomer

**What happened:**
- The player picked without knowing the effects ("not sure what it does", steps 15, 33).
- The Founder virtue took three taps (steps 33 to 35). From the diary this may have been a select-then-confirm flow or a missed tap; it is unclear.

**Fix:** show the concrete result in one line on each choice, for example "+1 food per turn in all cities".

## 5. Bugs

Some items below may be missed taps or player misreadings, as noted.

### 1. A drag on the army panel pans the map instead of scrolling the panel

**Steps to reproduce:**
1. Leave an army idle in open country.
2. Tap the army idle button in the bottom bar.
3. Drag vertically on the panel (step 78: from 400,300 to 400,120).

**Expected:** the panel scrolls.

**Actual:** the map moved (step 79).

**Note:** at step 118 a drag at x=200 did scroll the army card, so the scroll hit area may be narrow, or this may be a different panel opened by tapping the army.

### 2. Army panel content is clipped at 844x390 with no visible scroll cue

**Steps to reproduce:**
1. Have a starving army.
2. Open it via the idle button (steps 76, 82).

**Actual:** the text is cut off at the bottom, and March is not visible (shots/step-077.jpg, shots/step-083.jpg).

### 3. Tapping your own army on the map opens tile info

**Steps to reproduce:**
1. Tap the army banner on the map (steps 84, 86, 114).

**Actual:** a land info card opens (step 87, shots/step-115.jpg).

**Note:** this may be imprecise tap placement on a small screen. Step 117, which tapped the banner, did lead on to the army card.

### 4. "Show on map" for Mycenae centres on open sea with no marker

**Steps to reproduce:**
1. Open the Peoples panel.
2. Tap "Show on map" (steps 70, 71).

**Actual:** a sea view with no visible city (shots/step-072.jpg).

**Note:** this is possibly intended fog behaviour; check whether the location is simply unexplored.

### 5. Cities panel still covers the map after the close tap (possible)

**Steps to reproduce:**
1. Open Cities.
2. Tap the capital.
3. Tap close (steps 23 to 25).

**Actual:** the Cities panel is still open (step 26).

**Note:** the close probably dismissed only the top card.

### Not a game bug

The step 72 note says "after 70 turns", but the game was at turn 19 to 20 (steps 68, 75). The player meant steps. No page errors were caught.

## 6. What was good

- **Guided start and tutorial:** one tap to start, and the tutorial was read through without confusion (steps 1 to 8).
- **Research advisor:** "let the advisor choose" lets a newcomer skip the tech tree safely (step 9).
- **Settlers and "Best site":**
  - Queueing settlers was simple (steps 11, 57).
  - "Best site" showed a good spot "with wheat and river" and sent the settlers there in two taps (steps 64 to 66).
- **Events:** each event had readable choices with clear rewards, and gold visibly went up (steps 21, 38, 40).
- **Ruler virtues:** a red-dot cue led the player to their points (step 32).
- **Autosave:** the autosave indicator was noticed and liked (step 17).
- **Save and load:** clear and reliable, with a "Saved" confirmation and Continue restoring the exact state (steps 44 to 47, 103 to 106, shots/step-106.jpg).
- **March flow, once found:** "tap a tile, then March" was understandable (steps 119 to 121).
- **Route drawing:** drawing a route with the finger worked (steps 53, 54).

## 7. Coverage

**Played:**
- Cities, builds and settlers
- Units and armies (movement only)
- Save and load
- Events and crises
- Speed feel (end turn loop)
- Economy and gold (virtues, gold changes)
- Start setup and tutorial

**Only glanced at:**
- Tech tree (advisor button only)
- Diplomacy (Peoples panel and "Show on map" only)
- Map pan, zoom and fog (no deliberate use)
- Glossary (one guide open)
- Raids (one event, no follow-up)

**Missed:**
- Wars and AI behaviour
- Naval
- RTS battles (deploy, orders, workers, sieges)
- Era goals
- Independents
- World Congress
- Zoom and close view

**Next run should aim at:**
1. Start a scene already at war, or with an enemy army adjacent, to reach the RTS battle and test deploy, orders and sieges on a 390 px tall screen.
2. Use a coastal start to try building and moving a ship.
3. Re-test the army panel on phone: scrolling, March visibility, and selecting an army versus a tile by tapping.
4. Try supply recovery deliberately: march a starving army home and record what restores it.
5. Open the tech tree and diplomacy actions directly (envoy, trade, peace) rather than only through advisors and panels.
6. Pinch-zoom and pan on purpose to judge the close view and fog.

---
126 steps, play $1.06 (claude-sonnet-5-5) + report $0.18 (claude-opus-5-5) = $1.25. Diary: `diary.jsonl`, noted screens: `shots/`.
