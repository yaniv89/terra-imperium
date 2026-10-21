# Human playtest: battle-commander, battles

# Playtest Report: Battle Sandbox, battle-commander persona, phone 844x390 (en)

## 1. Summary

The model ran 8 sessions, one per age, in 40 steps. Each session got about 5 steps, and every one followed the same script: scroll to Fight, tap Fight, tap Start on the deploy panel, select all, tap attack-move. The setup flow is reliable: every Fight tap and every Start tap landed, and no page errors or harness errors were recorded. Select-all always picked up the expected army (8 squads, or 6 ships at sea).

The run tells us very little about battles themselves:

- No battle was played to its end.
- No winner was seen.
- No attack-move was completed with a target.
- No power was fired.
- No path, circle select, worker, building or speed control was touched.

Fun sat at 3 for 39 of 40 steps, which reflects a model that never saw a fight develop, not a verdict on the combat. The diary lines carry no checklist area tags, so areas below are inferred from the action and thought on each line.

**The three things that matter most:**

1. **The information-age sea battle looks broken.** Ships are drawn on grass and a stone road with no water visible, and the selection shows tanks mixed in with the ships (steps 34 to 35, shots/step-035.jpg). This was the only finding and the low point of the run.
2. **Fight is below the fold on a landscape phone.** The main call to action on the setup screen needed a scroll in all 8 sessions (steps 1, 6, 11, 16, 21, 26, 31, 36).
3. **Most of the battle is untested.** This includes actual combat, battle ends, powers in use, touch orders beyond select-all, the economy, sieges and walls. Five steps per session is too few to reach any of it, so the next run needs far fewer sessions with far more steps each.

## 2. Scorecard by area

The first five rows are the areas the player said it looked at. The rest are core battle features that the diary never reached, listed so the gap is visible.

| Area | Score /10 | Why |
|---|---|---|
| Battle setup screen (age, armies, terrain, walls) | 6 | Fight always worked, but it sat below the fold and needed a scroll every session. The model never changed age, armies, terrain or walls itself; the harness preset them. |
| Deploy phase | 5 | The panel and its tips appeared and Start always landed. The model skipped straight past deployment in all 7 sessions that reached it, so placement was never tested. |
| Selection and orders on touch | 5 | Select-all worked every time with correct counts. The attack-move button was found and tapped 5 times but never followed by a target tap. Tap, circle select and draw-a-path were never tried. |
| Powers | 4 | The powers list opened once (step 15) showing 4 available. None were used, so effects, targeting and cooldowns are unknown. |
| Naval | 3 | The classical sea battle started with 6 ships, with no comment on how it looked. The information-age sea battle rendered ships on land with tanks in the group (bug, sev 3). |
| Tutorial / first-run tips | 6 | It took 3 taps to get through in stone-field (steps 3 to 5), and frustration rose to 2. It did not reappear in later sessions. |
| Combat, focus fire, flanking | not reached | No fight was watched or directed. |
| Battle end and results | not reached | No session was played to a win or loss. |
| Workers, economy, buildings | not reached | Never mentioned. |
| Sieges and walls in play | not reached | Walled sessions were started, but walls were never interacted with or described. |
| Speed control | not reached | Never used, despite the persona saying it pushes speed up. |
| Camera (pan, zoom) | not reached | Never used. |

## 3. Scorecard by age

| Session | Score /10 | Started? | Played to end? | Winner | Why |
|---|---|---|---|---|---|
| stone-field (open field) | 4 | Unclear | No | Unknown | All 5 steps were spent on scroll, Fight and three tutorial taps (steps 3 to 5). The diary never confirms that the deploy screen or the battle appeared. |
| bronze-walls (walled city assault) | 5 | Yes (step 8) | No | Unknown | Selected 8 squads and tapped attack-move (step 10). The session ended before a target was given, and the walls were never described. |
| classical-naval (sea battle) | 5 | Yes (step 13) | No | Unknown | Selected 6 ships and opened powers showing 4 available (step 15). Nothing was used, and there was no comment on whether water rendered correctly. |
| kingdoms-sack (town defense) | 5 | Yes (step 18) | No | Unknown | Selected 8 squads and tapped attack-move toward raiders at the north gate (step 20). The model noted that the battle was "going on". |
| gunpowder-field (open field) | 5 | Yes (step 23) | No | Unknown | Same pattern: select all, attack-move tapped (step 25), no target. |
| modern-walls (walled city assault) | 5 | Yes (step 28) | No | Unknown | Same pattern (steps 29 to 30). The walls were not described. |
| information-naval (sea battle) | 2 | Yes (step 33) | No | Unknown | Ships on grass and road with no water, and tanks mixed into the selection (steps 34 to 35). The sea battle reads as a land map. |
| future-sack (town defense) | 5 | Yes (step 38) | No | Unknown | Same pattern. Attack-move tapped toward raiders at the west wall (step 40). |

Scores of 5 mean "started cleanly, nothing else learned". They are not a judgment of the battle.

## 4. Fun curve

**Fun was flat at 3 from step 1 to step 40, except for one dip to 2 at step 35.** There was no peak. The model never watched a fight resolve, used a power or won, so nothing gave it a reason to rise.

Frustration moved a little more:

- **Steps 1 to 2:** 1. The setup flow was smooth.
- **Steps 3 to 15:** rose to 2 at the stone-field tutorial (three taps before reaching anything playable) and stayed at 2 through bronze-walls and classical-naval. The thoughts do not say why it lingered. It may simply be carry-over from the tutorial and the repeated scroll to Fight.
- **Step 16:** dropped back to 1 at the start of kingdoms-sack.
- **Steps 20, 25, 30 and 40:** in each land session it ticked from 1 to 2 on the attack-move step. The thoughts give no reason. It may be that the session ended before a target could be chosen, or that units were already moving in real time while the model was still issuing orders. This is unclear from the diary.
- **Steps 34 to 35:** the low point. Frustration went 2 then 3 and fun dropped to 2 when the information-age ships appeared on land with tanks in the group.

## 5. Top issues (ranked by harm to a real player)

### 1. Information-age sea battle renders as a land battle

- **What happened:** In the information-naval session, ships were drawn on grass and a stone road with no water visible. The selected group showed 2 unit kinds with tanks mixed in. The model wrote that the sea battle "reads as a land map".
- **Steps:** 33 (Start), 34 (select all, noticed ships on land), 35 (bug note, sev 3).
- **Screenshot:** shots/step-035.jpg
- **Why it hurts:** A player who chose a sea battle gets a map that contradicts it and cannot trust what their units are or where they can go.
- **Suggested fix:** Check how the information-age naval scenario picks its tile and terrain. It may be falling back to a land tile or failing to draw the water layer. Also check the unit roster for that age's naval battle so it does not include land units such as tanks. Verify the classical-naval session draws water correctly too, since the diary is silent on it.

### 2. Fight button sits below the fold on a landscape phone

- **What happened:** In all 8 sessions the model had to drag the setup screen up before it could tap Fight (y 318 after scrolling).
- **Steps:** 1, 6, 11, 16, 21, 26, 31, 36.
- **Screenshot:** none recorded in the notes.
- **Why it hurts:** It adds a step before every battle on the most common phone orientation. A new player may not realise there is more below the setup options.
- **Suggested fix:** Pin Fight in a sticky footer or a side column on short landscape screens, or compact the setup options so it fits in 390 px of height.

### 3. Deploy phase is easy to skip, and its value is untested

- **What happened:** In every session that reached deploy, the model tapped Start straight away (steps 8, 13, 18, 23, 28, 33, 38) after "reading deploy tips", without placing a single unit.
- **Why it hurts:** This may be the model rushing under a 5-step budget rather than a game problem. If real players do the same, deployment adds no decisions.
- **Suggested fix:** Mainly retest. If it repeats with more steps, consider making placement more prominent, for example by highlighting the deploy zone or suggesting a default formation the player can drag.

### 4. First-battle tutorial takes three taps before anything is playable

- **What happened:** In stone-field the model tapped Next, Next, then Got it (steps 3 to 5). Frustration rose from 1 to 2, and the session ran out before the diary confirmed a battle.
- **Why it hurts:** It is minor for a real player, who has more time than the model did. It does push the first moment of play further away.
- **Suggested fix:** Offer a Skip on the first tip, or fold the tips into the deploy screen itself.

### 5. Attack-move on touch was never completed (needs a retest, not a fix yet)

- **What happened:** The model found and tapped the attack-move button 5 times (steps 10, 20, 25, 30, 40). Every session ended before it tapped a target. At step 10 the model explicitly planned to "use it then tap enemy side".
- **Why it matters:** We do not know whether the two-tap flow is clear, whether it gives feedback that it is armed, or whether it works.
- **What it is not:** Nothing points to a game bug. The session budget simply ran out.

## 6. Bugs

The harness recorded no page errors and no harness-error lines. Every session drew something and was at least partly played.

### Bug 1 (sev 3): Information-age sea battle drawn on land with tanks in the fleet

**Steps to reproduce:**

1. Open the battle sandbox on a phone in landscape (844x390, English).
2. Set up the information age, sea battle (session information-naval).
3. Scroll down the setup screen and tap Fight (steps 31 to 32).
4. Tap Start on the deploy panel at around (545, 218) (step 33).
5. Tap select-all at bottom left, around (70, 346) (step 34).

**Expected:** 6 ships on water, and the selection shows naval units only.

**Actual:** Ships drawn on grass and a stone road with no water visible. The selection shows 2 unit kinds, including tanks.

**Screenshot:** shots/step-035.jpg

### Unclear: stone-field may not have reached the battle

After Fight (step 2) and three tutorial taps (steps 3 to 5), the diary never confirms a deploy screen or a running battle. This is most likely just the 5-step budget running out, not a bug. It is worth a quick check that dismissing the last tip ("Got it") does land on deploy.

## 7. What was fun, and what else was good

**Nothing was rated above 3 fun**, so no moment stood out as fun. That is down to coverage, not evidence against the game.

**What worked well:**

- **The setup to battle flow was dependable.** Fight and Start landed on the first try in every session, across all 8 ages and all 4 battle kinds (open field, walled assault, sea, town defense).
- **Select-all is a sensible touch shortcut.** It sits in the same bottom-left spot in every mode and always grabbed the whole army with the right count (8 squads, 6 ships).
- **Attack-move has its own button**, consistently placed at bottom right (around x 617). The commander persona immediately looked for this RTS staple and found it.
- **Powers are easy to find.** The list opened at step 15 and showed 4 available.
- **Town-defense sessions read clearly.** The model knew where the threat was ("raiders at the north gate", "raiders at the west wall"), so the battle communicates objectives.
- **The deploy panel adapts per mode.** Start moved between y 190, 214 and 218, and the model still found it every time.
- **The tutorial appeared only once** and did not nag in later sessions.
- **No page errors, no crashes, no blank battles.**

## 8. Coverage

**Played (lightly):**

- Setup screen: Fight flow only, in all 8 sessions.
- Select-all, in 7 sessions.
- Starting a battle from deploy, in 7 sessions.

**Glanced at:**

- Deploy phase: tips read, no placement.
- Attack-move: button tapped, never targeted.
- Powers: list opened once, nothing used.
- Naval: one broken session, one with no comment.
- Walls: two walled sessions started, walls never described.

**Missed entirely:**

- Single-unit tap select, circle select, draw a path.
- Combat and focus fire.
- Battle end and results screen.
- Workers, economy and buildings.
- Sieges.
- Speed control.
- Camera pan and zoom.
- Changing setup options by hand.

**Ages and kinds:** All 8 ages and all 4 battle kinds were started. None got past the first order.

**What the next run should aim at:**

- **Shape the run differently.** Use 2 or 3 sessions with 15 to 20 steps each instead of 8 sessions of 5. Suggested picks are bronze-walls (siege), classical-naval (to compare with the information-age bug) and one field battle.
- **Play at least one battle to its end** and record who won and what the results screen shows. Use speed control to get there.
- **Complete the touch order flow.** Arm attack-move and tap a target, draw a path, circle-select a subgroup, and tap a single unit to focus fire.
- **Fire at least two powers** and note targeting, effect and cooldown.
- **Try workers and buildings** in a session that has an economy.
- **Interact with walls and gates** in a walled assault: breach, siege units, pathing through gates.
- **Retest information-naval** to confirm the land rendering bug, and **check classical-naval for water** to see whether the problem is age-specific.
- **Actually deploy once.** Place or move units before Start, to judge whether the deploy phase adds a real decision.
- **Add the checklist area tag to every diary line** so the area scores rest on tagged evidence rather than inference.

---
40 steps, play $0.31 (claude-sonnet-5-5) + report $0.16 (claude-opus-5-5) = $0.47. Diary: `diary.jsonl`, noted screens: `shots/`.
