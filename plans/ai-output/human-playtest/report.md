# Human playtest: battle-commander, battles

# Playtest report: battle sandbox, persona "battle-commander", phone 844x390 landscape

## 1. Summary

The player spent all 40 steps, across all eight age sessions, on the battle setup screen and never started a battle. The setup form itself read well: the first note calls it "a clear two-column form" with terrain, age, armies, fortifications, battle type and options. But on an 844x390 landscape phone the Fight button sits below the visible area. The player tried every way it knew to reach it and nothing worked: vertical drags inside and outside the form, End, PageDown, Tab, Enter and a pinch to zoom out. No controls, tactics, economy, powers, sieges or naval play were tested, so this run says nothing about the battles themselves. The harness logged no page errors and no harness-error lines, so the failure looks like a layout problem, not a crash.

**The three things that matter most:**
1. **The Fight button cannot be reached on a landscape phone, so no battle can start.** The form does not scroll by touch, by keyboard, or by zoom (steps 1 to 40, notes #1 and #35).
2. **Keyboard focus seems to loop back to the terrain field without ever landing on Fight** (steps 19, 22), and Enter opens a dropdown instead of starting the battle (steps 16, 29). This leaves no fallback path.
3. **There is no obvious way to set up a sea battle.** The player guessed that "island" terrain means naval and may not have got it to apply (steps 11 to 15, 31 to 33). This is unclear from the diary but worth checking.

## 2. Scorecard by area

The diary lines carry no area tags, and the player named only one area it looked at: the battle setup screen. Apart from that row, the areas below are inferred from the game description, since the full checklist was not given.

| Area | Score /10 | Why |
|---|---|---|
| Battle setup screen (age, armies, terrain, walls) | 3 | The layout is clear and complete (note #1), but the Fight button is unreachable on this screen size, which blocks everything else. Terrain choice for naval is unclear. |
| Camera and controls (pan, zoom, select, orders) | not reached | No battle started. |
| Readability and HUD in battle | not reached | No battle started. |
| Deployment, flanking, focus fire | not reached | No battle started. |
| Battle economy (workers, buildings) | not reached | No battle started. |
| Powers | not reached | No battle started. |
| Sieges and walls in battle | not reached | Walls sessions (bronze-walls, modern-walls) never left setup. |
| Naval battles | not reached | Naval sessions only got as far as picking "island" terrain. |
| Game speed control | not reached | No battle started. |
| Battle end and results | not reached | No battle reached an end. |

## 3. Scorecard by age

Every session stayed on the setup screen. The scores below rate the setup experience only, because there was no battle to judge.

| Session | Score /10 | Started? | Played to end / winner | Why |
|---|---|---|---|---|
| stone-field (Stone, open field) | 1 | No | No / none | Drags at x=420 and x=720, End and PageDown did not reveal Fight (steps 2 to 5). |
| bronze-walls (Bronze, walls) | 1 | No | No / none | Longer drags and Tab did not reach Fight (steps 6 to 10). Walls never tested. |
| classical-naval (Classical, naval) | 1 | No | No / none | The player opened the age dropdown by mistake (step 11), then picked island terrain. Step 15 says terrain was "still mixed", so the selection may not have applied (unclear). |
| kingdoms-sack (Kingdoms, sack) | 1 | No | No / none | Setup already showed Kingdoms and sack (step 16). Enter, a margin drag and Tab all failed, and focus returned to terrain (step 19). |
| gunpowder-field (Gunpowder, open field) | 1 | No | No / none | Five Tabs in a row, with focus looping (step 22). Frustration rose to 4 (step 23). |
| modern-walls (Modern, walls) | 1 | No | No / none | Tab and Enter opened a dropdown instead of starting (steps 29 to 30). |
| information-naval (Information, naval) | 1 | No | No / none | The player picked island via the keyboard (steps 31 to 33), but a margin drag still did not scroll. Step 35 logs the blocking bug. |
| future-sack (Future, sack) | 1 | No | No / none | End, pinch to zoom out, a drag and Tab all failed (steps 36 to 40). |

## 4. Fun curve

- **Steps 1 to 4:** fun 3, frustration 2. The setup screen made a good first impression, and having to scroll seemed like a small annoyance (note #1, severity 1).
- **Steps 5 to 22:** fun 3, frustration 3. Frustration rose a notch at step 5, when PageDown also failed, and stayed there while the player tried drags, Tab and the dropdowns. Fun held at 3, probably because the player was still exploring setup options such as the naval terrain.
- **Step 23:** fun fell to 2 and frustration rose to 4. The thought reads: "Fight button is below the visible area and scrolling fails. Frustrated." This came right after Tab looped back to terrain at step 22.
- **Step 35:** frustration peaked at 5. The player concluded it could not start a battle at all and logged the severity 3 bug.
- **Steps 36 to 40:** fun 2, frustration 4. The last ideas (pinch zoom, more Tab) also failed.

**Peak fun:** 3, across steps 1 to 22, all on the setup form. **Low point:** step 35. The curve only goes down, because the session never got past the first screen.

## 5. Top issues (ranked by harm to a real player)

### 1. The Fight button is unreachable on a landscape phone, so no battle can start (blocker)
- **What happened:** At 844x390 the setup form is taller than the screen and the Fight button sits below the fold. Nothing the player tried scrolled the page:
  - vertical drags inside the form at x=420 (steps 2, 6, 7, 38)
  - vertical drags in the right margin at x=720 and x=740 (steps 3, 17, 34)
  - End and PageDown (steps 4, 5, 32, 36)
  - Tab (many steps)
  - pinch to zoom out (step 37)
- **Steps:** 1 to 40, with notes at #1 and #35.
- **Screenshots:** shots/step-001.jpg, shots/step-035.jpg.
- **Judgement:** This is very likely a real game bug, not a missed tap. Many different input methods failed, in many places, across all eight sessions. A 390 px tall viewport is an ordinary phone held sideways.
- **Suggested fix:**
  - Pin Fight in a sticky footer or in the header so it is always visible.
  - Make the setup container scroll (overflow-y: auto, and no touch-action: none or preventDefault on touchmove inherited from the battle canvas).
  - Add a compact layout for short viewports, for example three columns or collapsible option groups.

### 2. There is no keyboard path to Fight (high)
- **What happened:**
  - Tab moves through the form fields, but focus came back to the terrain field (steps 19, 22) without ever reaching Fight.
  - Enter did not submit the form (step 16), and at step 29 it opened a dropdown that then had to be closed (step 30).
- **Steps:** 8 to 10, 18 to 28, 39 to 40 (Tab); 16 and 29 (Enter).
- **Screenshots:** shots/step-035.jpg, which summarises the problem.
- **Judgement:** It is unclear whether Fight is missing from the tab order or the focus loop just wraps around the visible controls. Either way, Tab did not scroll Fight into view. Touch players will not use Tab, but desktop players with small windows would.
- **Suggested fix:**
  - Make sure Fight is a focusable button in the tab order and that it scrolls into view when focused.
  - Let Enter submit the setup form when focus is not on an open dropdown.

### 3. It is unclear how to set up a naval battle (medium)
- **What happened:**
  - In both naval sessions the player had to guess that "island" terrain means a sea battle (steps 11, 13, 14, 31 to 33). No option was labelled sea or naval.
  - In step 15 the terrain was "still mixed" after the player picked island at step 14. This could be a missed tap on the dropdown option or a selection that did not apply. The diary cannot tell which.
- **Steps:** 11 to 15, 31 to 33.
- **Screenshots:** none were attached to these steps.
- **Suggested fix:**
  - Add an explicit naval or sea option, either as a battle type or a terrain, with a hint that ships will be used.
  - Show the chosen terrain clearly after a selection.
  - Check that a touch selection in the terrain dropdown applies at the bottom of the list (y about 328, near the screen edge).

### 4. Dropdown targets are easy to confuse (low)
- **What happened:** At step 11 the player tapped at (536, 102) expecting terrain and got the age dropdown. Terrain turned out to be at (312, 102) (step 13).
- **Judgement:** This is mostly the player misreading the layout. Still, it hints that the labels sit too far from their fields or are too alike at this size.
- **Suggested fix:** Put the labels directly above their fields and keep them distinct at small sizes.

## 6. Bugs

The harness logged no harness-error lines and no page errors this run, so every bug below is one the player hit.

### Bug 1: The setup form does not scroll, so Fight is unreachable (severity 3, blocker)
1. Open the battle sandbox on a phone-sized viewport of 844x390, landscape, language en.
2. On the setup screen, try to reach the Fight button using any of these:
   - drag up inside the form, for example (420,330) to (420,60)
   - drag up in the right margin, for example (740,300) to (740,40)
   - press End or PageDown
   - pinch to zoom out at scale 0.5
3. **Expected:** the page scrolls and Fight becomes visible and tappable.
4. **Actual:** the view does not move, Fight stays hidden and no battle can start.

Seen in steps 2 to 7, 17, 34, 36 to 38. Screenshots: shots/step-001.jpg, shots/step-035.jpg.

### Bug 2: Tab focus loops without reaching Fight, and Enter does not submit
1. Same viewport, on the setup screen.
2. Press Tab repeatedly.
3. **Expected:** focus eventually reaches Fight and scrolls it into view.
4. **Actual:** focus cycles through the fields and returns to terrain (steps 19, 22). Fight never receives focus or comes into view.
5. Press Enter on a focused field.
6. **Expected:** the form submits and the battle starts.
7. **Actual:** nothing happens (step 16), or a dropdown opens (step 29).

### Bug 3 (unconfirmed): The island terrain choice may not apply after a tap
1. Open the terrain dropdown at (312,102).
2. Tap the island option at about (240,328).
3. **Expected:** terrain shows "island".
4. **Actual:** the player reported terrain was "still mixed" (step 15).

The later keyboard selection (End then Enter, steps 32 to 33) seemed to work. This may have been a missed tap near the bottom edge, so it needs a manual check.

## 7. What was fun, and what else was good

- **The setup form's content and layout:** The first note praises a clear two-column form covering terrain, age, armies, fortifications, battle type and options. Everything a player needs to set up a battle appears to be there.
- **Sessions arrived pre-configured:** At step 16 the player found the setup "already correct (Kingdoms, sack)", which suggests the presets per session work.
- **Keyboard selection in dropdowns works:** End then Enter picked island in step 32 to 33, and Escape closed open dropdowns (steps 12, 30).
- **No crashes:** There were no page errors and no harness failures across eight sessions.

Nothing in the battles themselves can be praised or criticised, because none was reached.

## 8. Coverage

| | Played | Glanced at | Missed |
|---|---|---|---|
| **Areas** | Battle setup screen (fully, but only because the player was stuck on it) | Terrain and age dropdowns | Everything else: camera and controls, selection and orders, readability, deployment and tactics, workers and buildings, powers, sieges and walls, naval, game speed, battle end and results |
| **Ages** | none | All eight, setup screen only: Stone, Bronze, Classical, Kingdoms, Gunpowder, Modern, Information, Future | All eight battles |

**What the next run should aim at:**
1. **Fix or work around the Fight button first.** Until that is done, a phone landscape run will repeat this result. Options:
   - add a sticky Fight button
   - rerun on a taller viewport, for example portrait 390x844 or a tablet, to unblock battle testing while the layout fix lands
   - have the harness start the battle directly after setup
2. Then **rerun all eight sessions on 844x390 landscape** to confirm the fix on the screen size that failed.
3. Once battles start, focus on what this persona is for:
   - deployment, flanking, focus fire and the speed control in the field sessions
   - walls and siege in bronze-walls and modern-walls
   - ship controls in the two naval sessions, after confirming how naval is chosen in setup
   - powers and workers in the sack sessions
   - each battle played to its end, recording the winner
4. **Check naval setup by hand:** whether "island" is the intended naval option and whether a touch selection of it applies (bug 3).

---
40 steps, play $0.32 (claude-sonnet-5-5) + report $0.14 (claude-opus-5-5) = $0.46. Diary: `diary.jsonl`, noted screens: `shots/`.
