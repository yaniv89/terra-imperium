# Human playtest: newcomer-phone

# Playtest Report: newcomer-phone, start session (39 steps, phone 844x390, landscape)

## 1. Summary

A first-time player on a sideways phone chose the guided start and clicked through a seven-tip intro. They let the advisor pick research and queued Settlers on the guide's advice, then ended turns until turn 9. The basics worked and nothing crashed: the harness caught no page errors. The early game, though, gave this player very little to do. The first Settlers needed 12 turns, nobody was met, and the player tapped End Turn over and over waiting for something to happen. Fun never rose above 3 out of 5 and ended at 2. Every other area the player tried to look at (wars, battles, naval, save/load) was either out of reach this early or not found. Every diary line is tagged "start", so the area judgements below come from what each step actually did.

**The three things that matter most:**
1. **The opening is too slow and too empty for a newcomer.** Settlers take 12 turns (step 23), and turns 6 to 9 brought nothing new (steps 34 to 39). Fun dropped to 2 both times.
2. **After the intro, nothing tells the player what to do next.** The guide covered Settlers, then the player was left saying "a bit lost" (step 34) and ending turns blindly.
3. **Save/load could not be found in the Menu** (steps 29 to 31). For a bus player who has to stop at any moment, this matters a lot, although it may sit somewhere the player did not look.

## 2. Scorecard

| Area | Score | Why |
|---|---|---|
| Start screen and world setup | 6/10 | Guided start was inviting and the intro was "clear", but seven Next taps (steps 2 to 8) raised frustration. World setup options were never seen because the guided start skipped them. |
| Glossary and help | 5/10 | The tutorial tips and the guide's Settlers hint helped. The glossary itself was never opened, and no help appeared when the player got lost (step 34). |
| Tech tree | 5/10 | The advisor-choose button was a good newcomer shortcut (step 9). The tree itself was never opened, so this is a glance only. |
| Cities, builds and settlers | 5/10 | Queuing Settlers worked (step 11), but it took five taps to get back into the city (steps 18 to 22), and 12 turns for the first Settlers felt slow (step 23). |
| Speed feel | 4/10 | Turn processing was never complained about, but the early progress felt slow, with fun dipping at steps 23 and 38. |
| Crises, events, era goals, independents, raids, World Congress | 6/10 | Two event cards (steps 13 and 17) were easy to read and pick. Era goals were only glimpsed in the Empire panel, and the other parts of this area were not seen. |
| Units and armies | 3/10 | The only contact was an army panel opened by accident (step 19). No unit was moved. |
| Map pan, zoom, close view and fog | not reached | There was no pan or zoom on the map. The only drag was in Settings (step 30). |
| Diplomacy | 6/10 | The Peoples panel clearly said 0 met and explained why (step 27), but there was nobody to talk to. |
| Pacing and fun | 4/10 | Fun was flat at 3, and it sank to 2 during the Settlers wait and the empty late turns. |
| Save and load | 3/10 | The player looked in the Menu and Settings and found nothing (steps 29 to 31). This is unclear: it may exist elsewhere or be automatic. |
| Economy and gold | 5/10 | The Empire panel showed the treasury readably (step 33), but it covers half the map and End Turn overlaps it. The +50 gold event was appealing (step 17). |
| Wars and AI behaviour | not reached | No contact with anyone by turn 9. The player also noted that nothing explains how wars start (step 34). |
| RTS battles (deploy, orders, workers, sieges) | not reached | No enemies existed to fight. |
| Naval | not reached | The player had no ships or coast use by turn 9. |

## 3. Fun curve

- **Steps 1 to 3:** fun 3, frustration 1. This was the best moment of the run. "Guided start sounds good for a newbie like me."
- **Steps 4 to 8:** frustration rose to 2 as the intro kept going ("Lots of text", "one more to go probably"). Fun held at 3.
- **Steps 9 to 22:** flat at fun 3, frustration 2. The advisor pick, the Settlers queue and the two event cards all worked, but nothing lifted the mood. The city hunt in steps 18 to 22 (a wrong panel, then a close, then tapping the city name) added friction without moving the scores.
- **Steps 23 to 25:** first sink, to fun 2 and frustration 3. Seeing that Settlers need 12 turns: "Twelve turns is a long wait, a bit bored."
- **Steps 26 to 37:** recovered to 3/2. The Peoples panel (step 26) gave a small curiosity bump. The Menu and Empire panel checks kept the player busy without delighting them.
- **Steps 38 to 39:** second sink, to fun 2 and frustration 3. Ending turn after turn with "hoping for an enemy or ship to show up" and nothing appearing.

There was never a real peak. Fun did not go above 3 in 39 steps. Both low points share one cause: **waiting with nothing to do.**

## 4. Top issues (ranked by harm to a real player)

### 1. The early game is slow and empty, so a newcomer will quit
- **What happened:** the first Settlers cost 112 production at 7 per turn, which is 12 turns. Between turns 6 and 9 nothing new happened: no neighbours, no ships, no threats. The player ended turns repeatedly (steps 12, 14 to 16, 28, 36 to 38) and stopped out of boredom.
- **Steps:** 23, 34, 36 to 39
- **Screenshots:** shots/step-023.jpg, shots/step-034.jpg
- **Suggested fix:**
  - Speed up the first Settlers in the guided start, with a cheaper first Settler or a production boost on turn 1.
  - Give the player small things to do while they wait: a scout to explore, a goody hut, an early neighbour or independent within sight, or a timed event.
  - Have the guide show "Settlers ready in N turns, meanwhile try X".

### 2. The guide stops after one instruction, leaving the player lost
- **What happened:** the guide helped with Settlers (step 11), but after that the player did not know what to do. They poked at icons to see what they were (Peoples, Menu, Empire) and said "Nothing to fight yet, a bit lost." They also found nothing explaining how wars or contact begin.
- **Steps:** 26, 29, 32, 34, 35
- **Screenshot:** shots/step-034.jpg
- **Suggested fix:**
  - Keep a persistent "next goal" hint in the guided start (explore with your unit, find a neighbour, found a second city).
  - Add a one-line tip that wars and diplomacy open once you meet another people.

### 3. Save/load not found
- **What happened:** the player opened the Menu, scrolled Settings, closed it, and concluded "nothing about save here."
- **Steps:** 29 to 31, also repeated in the summaries at 35 and 39
- **Screenshots:** none
- **Unclear:** the player scrolled once and may have missed the option, or the game may autosave. Either way, a phone player expecting a visible save did not find one.
- **Suggested fix:**
  - Put Save and Load (or a visible "Game autosaved" indicator) at the top level of the Menu, not inside Settings.

### 4. Empire panel covers half the map, and End Turn overlaps its content
- **What happened:** on 844x390 the Empire panel took about half the screen, and the End Turn button sat on top of the panel's content.
- **Step:** 33
- **Screenshot:** shots/step-033.jpg
- **Suggested fix:**
  - On short landscape screens, make side panels narrower or full-screen with a clear close button.
  - Hide or move End Turn while a panel is open, or give it reserved space the panel never draws under.

### 5. Getting back into the city takes several taps
- **What happened:** tapping the city opened an army panel instead (step 19). The player then tried the city name (step 20), opened the city (step 21) and finally reached the Build tab (step 22).
- **Steps:** 18 to 22
- **Screenshots:** none
- **Unclear:** this was probably a unit standing on the city tile catching the tap, which may be intended. A newcomer read it as "I tapped wrong."
- **Suggested fix:**
  - When a city and a unit share a tile, offer a small chooser or make the city take priority on the first tap.
  - Show production progress ("Settlers 3/12") on the city banner on the map, so the player does not need to open the city at all.

### 6. The intro is long for a phone player who reads little
- **What happened:** seven Next taps before play. Frustration rose from 1 to 2 and stayed there.
- **Steps:** 2 to 8
- **Screenshots:** none
- **Suggested fix:**
  - Cut the intro to two or three tips.
  - Deliver the rest in context, when the related button first appears.

## 5. Bugs

No page errors were recorded. The items below are layout or behaviour problems as seen by the player. Some may be design choices.

**B1. End Turn button overlaps Empire panel content (layout, 844x390)**
1. Start a guided game on a phone-sized landscape screen (844x390).
2. Play to around turn 6.
3. Tap the Empire icon (top right, about x 757, y 60).
4. The panel covers about half the map, and the End Turn button (about x 667, y 346) draws over the panel's content. See shots/step-033.jpg.

**B2. Tapping your own city opens an army panel (possible, unclear)**
1. Guided start, queue Settlers, end a few turns.
2. Tap the city on the map (step 18, about x 580, y 205).
3. An army panel opens instead of the city (step 19).

This may be a unit on the city tile receiving the tap rather than a bug. Worth checking which element wins the tap.

**B3. Closing the city panel may need two taps (unclear)**
1. Open the city, then its Build tab (steps 21 and 22).
2. Tap close (step 24, about x 384, y 69).
3. The player tapped close again on a "panel" at step 25 (about x 321, y 80).

It is not clear whether the first close failed or a second panel lay underneath. Check the screenshots for steps 24 and 25.

**B4. Save/load not present in Menu or Settings (possibly missing, possibly not found)**
1. Tap Menu (about x 757, y 370).
2. Scroll Settings down (drag from y 300 to y 60).
3. No save or load option was seen.

## 6. What was good

- **The guided start was inviting.** A newcomer chose it right away and it put them in the game without confusion (steps 1 and 8).
- **The intro was "clear"**, even if long.
- **The advisor research pick** let a player who knows nothing about techs keep going (step 9).
- **The guide's Settlers hint and the plus button** made the first build decision easy (step 11).
- **Event cards were readable and tempting.** The player picked options confidently both times ("more manpower sounds good", "Gold +50 sounds nice"), at steps 13 and 17.
- **The Peoples panel explained the empty state well:** "0 met, 35 not met", and why (step 27).
- **The Empire panel was readable**, apart from its size (step 33).
- **No crashes or page errors** in 39 steps.

## 7. Coverage

**Played:**
- Guided start and intro
- City build queue and Settlers
- Event cards
- End turn loop

**Glanced at:**
- Tech tree (advisor button only)
- Diplomacy (empty Peoples panel)
- Economy (Empire panel)
- Era goals (seen in the Empire panel)
- Units (accidental army panel)
- Save/load (Menu and Settings, not found)
- Help (tutorial tips only, glossary never opened)

**Missed:**
- Map pan, zoom, close view and fog (no map gestures at all)
- World setup options
- Moving any unit
- Founding a second city
- Wars and AI behaviour
- RTS battles (deploy, orders, workers, sieges)
- Naval
- Crises, independents, raids, World Congress

**What the next run should aim at:**
1. **Start from a mid-game save or a scenario with a neighbour close by.** That reaches diplomacy, war, RTS battles and naval, which this session could not get to by turn 9. The harness refused to stop at step 35 for exactly this reason, but more End Turn taps could not fix it.
2. **Ask the player to use the map:** pinch-zoom, pan, open close view, and move a unit into the fog. None of this was touched.
3. **Play the Settlers through to founding a second city,** to judge the city-founding flow on a phone.
4. **Open the tech tree and the glossary directly,** to judge readability at 844x390.
5. **Look for save/load more thoroughly** (Menu top level, pause screen, title screen) to settle whether it is missing or just hard to find.

---
39 steps, play $0.29 (claude-sonnet-5-5) + report $0.14 (claude-opus-5-5) = $0.42. Diary: `diary.jsonl`, noted screens: `shots/`.
