# Human playtest: newcomer-phone

# Playtest report: newcomer-phone, campaign, phone 844x390 (190 steps)

## 1. Summary

A first-time player on a sideways phone got through the guided start without trouble. They founded two more cities with the "Best site" helper, saved and loaded, signed two pacts, and reached about turn 57 and a new era. Nothing crashed and the harness caught no page errors. The session was flat, though. Fun sat at 3 on every step but one. About 61 of 190 steps were End Turn taps and about 26 more were event-card answers, so close to half the session was "tap End Turn, pick an option". From step 58 on, the player went looking for battles, wars and ships and never found any. Several buttons that promise something (Glossary, Appoint a governor, Free law change, a Ruler virtue) took them somewhere else or did nothing. They ended the run with Ruler points and governor prompts unspent because they never learned what those were.

**The three things that matter most:**
1. **The new player has nothing to do between event cards.** Long builds (Settlers 13 turns, Spearmen 43 turns) and no visible military or naval path left them ending turns for most of the run. Boredom is noted at steps 35, 80, 81, 137, 158, 159 and 184.
2. **Buttons lead to the wrong place.**
   - Glossary opens a Kemet people page from both the Menu and the Help panel.
   - "Appoint a governor" and "Free law change" open the Empire overview.
   - Tapping a Ruler virtue gives no feedback.
3. **Tapping a foreign unit to see who it is opened a Declare war dialog (step 116).** A newcomer could start a war by accident.

## 2. Scorecard

| Area | Score | Why |
|---|---|---|
| Start screen and world setup | 8/10 | Guided start and the three-page tutorial were smooth. Frustration was 1 through step 10. |
| Tech tree | 5/10 | Only glanced at. The advisor picked research (step 5), and later the red dot led to picking Great Ziggurat (steps 141-142). No sense of the tree itself. |
| Cities, builds and settlers | 6/10 | "Best site" and "Advisor builds" are strong newcomer aids. Settlers took 13 turns, Spearmen 43, build chips are cut off, and the governor and law prompts misroute. |
| Speed feel | 6/10 | Turns processed without complaint, but the rhythm became endless End Turn taps. "Repetitive" from step 137. |
| Crises, events, era goals, independents, raids, World Congress | 6/10 | Many readable event cards with clear costs and rewards, and a new era was reached (step 183). The choices felt interchangeable because gold was plentiful. World Congress was never seen. |
| Map pan, zoom, close view and fog | 5/10 (barely tested) | One pinch-zoom at step 10 with no comment. Too little to judge. |
| Save and load | 8/10 | Save gave a confirmation (steps 65, 108). The Load screen is clear (step 110), Continue worked, and autosaves showed up. |
| Glossary and help | 3/10 | Glossary never opened a glossary (steps 66-71). "How to play" did replay the tutorial (steps 74-77). |
| Economy and gold | 5/10 | Gold was always plentiful (918, 871, 832) and never a decision. The player did not learn what drives it. |
| Units and armies | 3/10 | Queued a Warband and Hunters, then could not tell whether they were built (step 103). Never selected or moved a unit. The virtue tap did nothing. |
| Diplomacy | 6/10 | The pact gave clear feedback (step 100). Actions sit below the fold (steps 28, 98), and the first-contact card opened the wrong people (step 165). |
| Wars and AI behaviour | 2/10 | No war or AI aggression seen. The only war content was an accidental Declare war prompt (step 116). |
| Pacing and fun | 3/10 | Fun was flat at 3 for 189 of 190 steps. The player's own verdict was "repetitive but stable". |
| Naval | not reached | Looked for ships from step 58 onward and never found any. |
| RTS battles (deploy, orders, workers, sieges) | not reached | No battle happened in the session. |

## 3. Fun curve

- **Steps 1-10 (fun 3, frustration 1):** The guided start, first production pick and first event card all went smoothly. Step 5 ticked frustration to 2 ("Too much to read").
- **Step 11 onward:** Frustration settled at 2 and stayed there for almost the whole run. The cause was waiting on 13-turn Settlers (step 14) and repeated trips into the city screen to check progress (steps 11-16, 45-49).
- **Frustration spikes to 3:**
  - Steps 71-74: Glossary opened the Kemet page twice.
  - Steps 96-97: diplomacy actions could not be found.
  - Step 103: the queued Warband seemed to vanish.
  - Steps 116-117: accidental Declare war prompt.
  - Step 122: Spearmen at 43 turns.
  - Step 139: the governor prompt opened the Empire panel.
  - Step 146: the law-change prompt opened the Empire panel.
- **Peak, step 100 (fun 4, frustration 1):** Offer pact visibly cost 150 gold, added a badge and raised opinion from 8 to 18. This was the one moment where an action had a clear, felt result.
- **Steps 110-111 (frustration 1):** The Load screen was easy to read.
- **Low point:** Fun never fell below 3, but it never rose either. The boredom notes come in clusters: steps 35-36 waiting for settlers, steps 80-81 "hoping something happens", and steps 137-189 nearly pure End Turn and event taps.

The flat line is the main finding. The game never frustrated this player badly, but it never gave them a goal they could act on.

## 4. Top issues (ranked by harm to a real player)

**1. Long stretches with no meaningful action for a newcomer.**
- **What happened:** About 87 of 190 steps were End Turn or event answers. Settlers took 13 turns (step 14), Spearmen 43 turns in a new city (step 122). The player wanted battles and ships from step 58 and never saw any. Gold piled up with nothing to spend it on.
- **Steps:** 31-44, 78-81, 136-137, 150-189. Screenshot: shots/step-014.jpg.
- **Fix:**
  - Shorten early build times on the guided start.
  - After the first city, surface a "next goal" the player can act on, such as "Build a warrior and clear the raiders nearby".
  - Have the guide point at things to spend gold on.
  - Consider an early guided skirmish so new players reach the battle layer.

**2. Glossary is unreachable.**
- **What happened:** The Glossary in the Menu (step 66) and the Glossary in the Help panel (step 70) both opened a Kemet people history page.
- **Steps:** 66-71. Screenshots: shots/step-067.jpg, shots/step-071.jpg.
- **Fix:** Open the glossary index. If it deep-links to the player's own people, show the list and search alongside the entry.

**3. Tapping a foreign unit opens a Declare war dialog.**
- **What happened:** The player tapped a blue unit with a question mark to see who it was and got a 300-gold Declare war prompt (opinion 8 to -52). They cancelled.
- **Steps:** 115-117. Screenshot: shots/step-116.jpg.
- **Fix:** A first tap on a foreign unit should show an info card: who it is, their relation to you, and an optional "Diplomacy" button. War should never be the default action.
- **Unclear:** We cannot tell from the diary whether the tap landed on a war button inside a card that opened first.

**4. Prompts route to the wrong screen or give no feedback.**
- **What happened:**
  - "Appoint a governor" (step 138) and "Free law change" (step 145) both opened the Empire overview, with no visible way to do the promised action.
  - Tapping the Warlord virtue twice (steps 21-22) changed nothing and gave no explanation.
- **Result:** The player left Ruler points and governor slots unspent all game (step 190 summary).
- **Steps:** 21-23, 138-139, 145-146. Screenshots: shots/step-023.jpg, shots/step-139.jpg.
- **Fix:**
  - Deep-link each prompt to the exact control and highlight it.
  - On a virtue tap, show a selected state, or a reason it cannot be picked, plus a one-line description.

**5. Queued military units seem to disappear.**
- **What happened:** The player queued a Warband and Hunters (steps 87-88). Later the Cities list showed only Settlers (step 103), and the player never found out what happened to the units.
- **Steps:** 87-88, 102-103. Screenshot: shots/step-103.jpg.
- **Fix:** Show the full queue, or "+2 more", in the Cities list. Send a "unit trained" notification that can be tapped to select the unit.
- **Unclear:** Settlers may simply have been ahead in the queue, which would make this a display problem rather than a lost queue.

**6. Diplomacy actions are buried, and first contact opens the wrong people.**
- **What happened:**
  - Declare war, Offer pact, Trade and Demand tribute sit below the fold in the Peoples panel. The player missed them once and had to scroll twice.
  - The first-contact card opened the list on Akkad instead of the new tribe (step 165). The player then made a pact with "someone" (D'mt) while looking for the Garamantes (steps 167-168).
- **Steps:** 27-28, 96-98, 164-168. Screenshots: shots/step-028.jpg, shots/step-096.jpg, shots/step-098.jpg.
- **Fix:**
  - Put the action buttons at the top of the right panel on phone layouts.
  - Have the first-contact card open the contacted people directly.

**7. Tight tap targets on the right rail at 844x390.**
- **What happened:**
  - Step 19 opened the log by mistake.
  - Step 25 opened Research instead of Peoples.
  - Step 106 opened the log instead of the menu.
- **Steps:** 18-19, 24-25, 105-106.
- **Fix:** Increase rail button spacing and hit areas on short screens.
- **Unclear:** These may be persona mis-taps rather than layout faults.

**8. Build tab chips cut off at the right edge.**
- **What happened:** The Advisor and Ideas chips are clipped at the right edge, with no hint that the row scrolls.
- **Step:** 14. Screenshot: shots/step-014.jpg.
- **Fix:** Wrap the chips onto two rows, or add a fade or arrow to show they scroll.

## 5. Bugs

**B1. Glossary opens the Kemet people page (likely bug).**
1. In a campaign, open Menu (step 64) and tap Glossary (step 66). The Kemet people page appears.
2. Close it. Open Help (the "?" at the top right, step 69) and tap Glossary (step 70). The same Kemet page appears.

**B2. A tap on a foreign unit opens Declare war (likely bug or a dangerous default).**
1. Around turn 30, wait for a foreign unit (blue, question mark) to appear near your border.
2. Tap it (step 115). A Declare war dialog appears with a cost of 300 gold.

**B3. The "Appoint a governor" prompt opens the Empire overview.**
1. When the "Appoint a governor" prompt appears on the left (around turn 34), tap it (step 138).
2. The Empire overview opens, with no governor selection visible.

**B4. The "Free law change" prompt opens the Empire overview.**
1. When the prompt appears (step 145), tap it.
2. The Empire panel opens instead of a law list.

**B5. Ruler virtue tap does nothing.**
1. Open the Ruler tab while it shows a red dot (step 20).
2. Tap Warlord twice (steps 21-22). There is no visible change and no message.
3. **Unclear:** This may be working as intended, for example if no points were available, but the missing feedback is a fault either way.

**B6. Possible lost production queue (unconfirmed).**
1. In the capital, queue a Warband and Hunters (steps 87-88). End two turns.
2. Open Cities (step 102). Only Settlers is shown.
3. This needs checking: the queue may have been intact and simply not displayed.

## 6. What was good

- The guided start and tutorial were friendly and low-stress for a total newcomer (steps 1-4, 74-77).
- The "gold button" pattern ("choose production", "Settlers wait") reliably told the player what to do next.
- "Best site" plus a recommended site made founding cities easy with no map knowledge (steps 52-53, 131-132).
- "Advisor builds" and the advisor research pick let a player who reads little keep progressing (steps 5, 155, 185). The player praised this in the summary.
- Offer pact gave clear, satisfying feedback (step 100; shots/step-100.jpg).
- Save gave a confirmation, the Load screen is clear, Continue worked, and autosaves appeared regularly (steps 65, 108-111; shots/step-110.jpg).
- Event cards were readable, with costs and rewards the player could weigh quickly.
- The game was stable for 190 steps with no page errors.

## 7. Coverage

- **Played:**
  - Start screen and world setup
  - Cities, builds and settlers
  - Events and crises (about 26 cards, era change at step 183)
  - Save and load
  - Diplomacy (Peoples panel, two pacts)
  - Speed feel and pacing (heavily, via End Turn)
- **Glanced at:**
  - Tech tree (an advisor pick and one landmark choice)
  - Glossary and help (blocked by B1)
  - Economy and gold (watched gold rise, never used it)
  - Ruler and governance (virtues, Administration +1 at step 126)
  - Map zoom (one pinch at step 10)
  - Units and armies (queued only, never commanded)
- **Missed:**
  - Naval
  - RTS battles (deploy, orders, workers, sieges)
  - Actual wars and AI aggression
  - World Congress
  - Independents as a separate system
  - Map pan, close view and fog
  - Trade and Demand tribute actions

**Next run should aim at:**
- Starting from a scene or save with an army and a hostile neighbour, so the player reaches war, an RTS battle and naval units.
- Tapping a foreign unit again to confirm B2.
- Checking the production queue display (B6).
- Testing pan, close view and fog on the phone layout.
- Re-testing Glossary after a fix.
- A slightly more exploratory persona that spends Ruler points and gold, to judge whether those systems make sense once they are found.

---
190 steps, play $1.65 (claude-sonnet-5-5) + report $0.20 (claude-opus-5-5) = $1.85. Diary: `diary.jsonl`, noted screens: `shots/`.
