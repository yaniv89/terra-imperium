# Human playtest: newcomer-phone

# Playtest report: newcomer-phone, campaign (phone 844x390, en)

## 1. Summary

A first-time player on a sideways phone played 60 steps across three prepared sessions: start, bronze and classical. The opening worked well. Setup took four taps, the tutorial was short, and the gold "do this next" button carried the player through choosing a tech, founding a village and picking a build with no friction (frustration 1 for steps 1 to 13). Once the game asked the player to act on their own, especially in war, the experience turned into steady low-level confusion. The player could not reliably find their own army. The "Defend" link on a threat opened an unrelated city page. A march preview called a 10,000 vs 1,600 attack "Hopeless" without saying why. A diplomacy offer did nothing when tapped. Fun barely moved: it sat at 3 almost the whole run, peaked at 4 twice, and dipped to 2 twice. No page errors were caught.

**The three things that matter most**

1. **The war loop has no guided path for a newcomer.** The player could not answer "where is my army and how do I fight?" from step 31 to step 59, and only saw one battle, run on Auto, at the very end.
2. **The march/attack preview contradicted itself.** It said "Hopeless: Sippar holds 1,600 men to your 10,000" (step 50). The battle that followed was 8,590 vs 20,000 (step 59). Either the preview text or the numbers in it are wrong or incomplete.
3. **Tappable things gave no feedback.** "Offer pact" (step 18) and "Defend" (step 39) are the clearest cases. Taps either did nothing or went somewhere unexpected, which leaves a newcomer stuck.

## 2. Scorecard

| Area | Score /10 | Why |
|---|---|---|
| Start screen and world setup | 8 | Four taps, sensible defaults, big Next button (steps 1 to 4). |
| Glossary and help | 6 | The welcome tutorial was short and readable (5 to 8). The glossary was never opened, and no help appeared when the player was lost later. |
| Tech tree | 5 | Glanced at only: the player took the "recommended" Chiefdoms in one tap (9) and never browsed the tree. |
| Units and armies | 3 | The player struggled to find their own army (44 to 48), tapped an enemy by mistake (44 to 45), and was unsure whether March took (35). |
| Cities, builds and settlers | 7 | Founding and the advisor pick were smooth (11 to 13, 55 to 56). Settlers taking 28 turns felt long (14). |
| Map pan, zoom, close view and fog | 5 | Pinch did nothing with the city panel open (14 to 15). The magnifier zoom buttons worked once found (46 to 47). |
| Diplomacy | 3 | "Offer pact" gave no response at all (17 to 18). The player never returned to diplomacy. |
| Speed feel | 6 | End turn was quick and autosave was visible (58). Several end-turn steps in a row were just waiting for a march (52 to 53, 57 to 58). |
| Crises, events, era goals, independents, raids, World Congress | 7 | Event and era goal cards were clear and pleasant (20, 21, 36, 54). Independents, raids and World Congress were not reached. |
| Economy and gold | 4 | Gold was always too low to buy anything (26: 264 vs 7; 57: 432 vs 234). Tribute left 7 gold (22). |
| Naval | 2 | Glanced at only: the player saw a galley in a build queue (23 to 26) and did nothing naval. |
| Wars and AI behaviour | 3 | Threats felt real (28, 38), but there was no clear way to respond, and the strength preview was contradictory (50). |
| Save and load | 6 | Manual save worked with clear confirmation (29 to 30) and autosave showed (58). Load was never tried. |
| RTS battles (deploy, orders, workers, sieges) | not reached (glanced) | One battle started on Auto at the final step (59). Deploy, orders, workers and sieges were never seen. |
| Pacing and fun | 4 | Strong guided opening, then a long flat stretch of mild confusion. The first battle came at step 59. |

## 3. Fun curve

- **Steps 1 to 13: steady and easy.** Fun 3, frustration 1 throughout. The gold button and the tutorial did the work.
- **Peak 1, step 12 (fun 4):** "Village founded!" This was the first visible result of the player's own action.
- **Step 14: first friction (frustration 2).** Settlers take 28 turns, and the pinch zoom was ignored.
- **Step 18: first dip (fun 2, frustration 3).** "Offer pact" did nothing.
- **Peak 2, step 20 (fun 4):** An event card ("More manpower sounds good").
- **Steps 21 to 37: flat at fun 3, frustration 2.** Being broke (22, 26) and the scary war with Pontus (27 to 28) kept a background unease. Frustration dropped back to 1 only briefly, during calm menu tasks: opening cities (23 to 25), saving (29 to 30) and picking an era goal (36).
- **Steps 39 to 40: frustration 3.** "Defend" opened the Battle Housing page, and the army sat next to an enemy without a battle.
- **Step 50: lowest point (fun 2, frustration 3).** The "Hopeless" preview for 10k vs 1.6k. Frustration stayed at 3 into step 51.
- **Steps 52 to 60: back to fun 3, frustration 2.** These were mostly end-turn taps while waiting. Reaching a battle at step 59 ("Finally a battle!") did not raise fun, probably because it was a likely loss on Auto.

**Overall:** the curve peaked whenever the game told the player exactly what to tap, and sank whenever the player had to work out a military action alone. Frustration never returned to 1 after the bronze session began, apart from a few short menu tasks.

## 4. Top issues (ranked by harm to a real player)

### 1. No clear way to find your army and start a fight

**What happened:**
- The player tapped a "10k banner" hoping it was their army (31) and pressed March (32 to 33). They were unsure whether the order took because a Cities list opened (35).
- The army then "stopped next to an enemy" and nothing happened: "I never got a battle or a clear 'attack' button" (37, 39).
- In the classical session the player tapped an enemy Akkadian army thinking it was their own (44 to 45). They only found their army after discovering the magnifier zoom (46 to 48).
- The first battle came at step 59, out of 60.

**Steps:** 31 to 35, 37, 39, 44 to 48, 59.

**Screenshot:** shots/step-039.jpg.

**Suggested fix:**
- Add a "My armies" button or list, or a "next army" cycle button, that centres the camera on your own army.
- Make friendly and enemy banners clearly different at phone size, in both colour and shape.
- When your army ends a move next to a hostile army, show an explicit "Attack" prompt or explain why no battle happened.

### 2. March preview says "Hopeless" with numbers that say the opposite

**What happened:**
- With March mode on, the preview read "Hopeless: Sippar holds 1,600 men to your 10,000. Auto takes it 0%" (50). The player marched anyway (51).
- On arrival the battle was 8,590 of the player's men against 20,000 (59).
- So the shown garrison figure (1,600) did not match the force actually fought. The "Hopeless" verdict may have been correct for reasons it never showed (walls, reinforcements, nearby armies, supply), but the text the player saw undercut it.

**Steps:** 49 to 51, 59.

**Screenshot:** shots/step-050.jpg.

**Suggested fix:**
- Make the preview list the forces it is actually counting: garrison, walls, armies that will join, and attrition on the way.
- Show the main reason for the verdict, for example "Hopeless: 18,000 more men will reinforce Sippar".
- Check that the "your 10,000" figure accounts for losses during the march.

### 3. "Defend" on a threat opens an unrelated city page

**What happened:**
- The turn report warned "25,770 men marching on Jerusalem". Its "Defend" action opened Jerusalem's Battle Housing page, which gave no instruction (38 to 39).
- The player closed it and was lost (40).

**Steps:** 38 to 40.

**Screenshot:** shots/step-039.jpg.

**Suggested fix:** Make "Defend" either select the nearest friendly army and pre-fill a march to the threatened city, or open a short defence panel ("Move army here", "Raise levies", "Build walls") with one recommended option highlighted.

### 4. "Offer pact" gives no response

**What happened:**
- In Peoples > Kingdom of Israel, the player tapped the "Offer pact" card. It said Israel "would accept for 150 Gold, 1 decree", and nothing happened: no confirm, no message (17 to 18).
- Gold at the time is not visible in the diary.
- It is unclear whether the card is a button at all, or whether it was disabled because something was missing (gold or a decree).

**Steps:** 16 to 18.

**Screenshot:** shots/step-018.jpg.

**Suggested fix:**
- If it is actionable, make the card look like a button and show a confirm dialog.
- If it is not affordable, grey it out and say what is missing, for example "Need 1 decree".

### 5. Taps land on the wrong thing during map actions

**What happened:**
- During a march, a tap opened a Cities list instead (34 to 35).
- Tapping a figure near Kish opened an enemy army (44 to 45).

**Steps:** 34 to 35, 44 to 45.

**Note:** These may be imprecise taps on a small screen rather than game bugs. Even so, they show that hit areas and overlapping map elements are a problem at 844x390.

**Suggested fix:**
- While March mode is active, block taps on HUD buttons that sit over the map, or require the March confirm first.
- Enlarge army hit areas and show a disambiguation popup when units overlap.

### 6. Newcomer pacing: long builds and nothing affordable

**What happened:**
- Settlers took 28 turns (14).
- Buying a galley cost 264 gold against 7 in the bank (26), and archers cost 432 against 234 (57).
- Tribute took 80 of 87 gold (21 to 22).
- The player never got to spend gold on anything they chose.

**Steps:** 14, 21 to 22, 26, 57.

**Suggested fix:** Consider a cheaper or faster first settler on lower difficulty, and show the expected turns until a purchase becomes affordable, so waiting feels like progress.

### 7. Pinch zoom ignored while the city panel is open

**What happened:** The pinch did nothing until the player closed the panel (14 to 15).

**Steps:** 14 to 15.

**Note:** This is likely by design, since the panel is modal.

**Suggested fix:** Either let the map zoom behind the panel or auto-close the panel on a pinch.

## 5. Bugs

Only the first two below look like real bugs. The rest are listed with their uncertainty.

### Bug 1 (likely): March preview shows numbers that contradict its verdict and the actual battle

**Reproduce:**
1. Load the classical session, at war with Akkad.
2. Tap your 10k army near Jerusalem and turn on March mode.
3. Tap Sippar.

**Result:** The preview reads "Hopeless: Sippar holds 1,600 men to your 10,000. Auto takes it 0%."

**Continue:**
4. Confirm March.
5. End turn about four times.

**Result:** The battle opens as 8,590 vs 20,000.

**Expected:** The preview's numbers explain the verdict and roughly match the fight that follows.

**Evidence:** Steps 48 to 53, 57 to 59; shots/step-050.jpg.

### Bug 2 (possible): "Offer pact" card does nothing

**Reproduce:**
1. In the start session, open Peoples and choose Kingdom of Israel.
2. Tap "Offer pact" ("would accept for 150 Gold, 1 decree").

**Result:** No dialog, no message, no state change.

**Expected:** A confirm dialog, or a visible reason why the offer is unavailable.

**Uncertainty:** It is unclear whether the card is meant to be tappable or the tap simply missed.

**Evidence:** Steps 16 to 18; shots/step-018.jpg.

### Bug 3 (possible, design or bug): "Defend" link opens the Battle Housing page

**Reproduce:**
1. In the bronze session, end turn until the report shows "25,770 men marching on Jerusalem".
2. Tap Defend.

**Result:** Jerusalem's Battle Housing page opens.

**Expected:** Some defence action or guidance.

**Evidence:** Steps 38 to 39; shots/step-039.jpg.

### Bug 4 (unclear): Army adjacent to an enemy army, no battle and no attack option

**Reproduce:**
1. In the bronze session, select the 10k army.
2. March next to the 2,823-strong Pontic army.
3. End turn twice.

**Result:** The army stops beside the enemy and no battle or attack prompt appears.

**Uncertainty:** This may be intended (attacking needs a separate order), but the player found no such order.

**Evidence:** Steps 31 to 39.

### Bug 5 (unclear, possibly a missed tap): Cities list opened during a march

**Reproduce:**
1. In the bronze session, with March mode active, tap near the enemy army at about (600, 288).

**Result:** A Cities list opened instead.

**Evidence:** Steps 34 to 35.

### Not a bug

At step 21 the player thought it "odd" that an 80 gold tribute was allowed with 87 gold. 87 covers 80, so this is correct behaviour.

## 6. What was good

- **Setup:** Four taps to start, with defaults a newcomer was happy to accept (1 to 4).
- **Tutorial:** Four short cards the player actually read (5 to 8).
- **The gold "next action" button:** It carried the player through tech choice, founding a village and picking a build with zero frustration (9 to 13, 55).
- **Founding the village:** "Village founded!" gave the first fun peak (12).
- **Advisor build suggestions:** The player relied on them happily (13, 56).
- **Event and era goal cards:** Clear, short, with progress shown ("Science is already 6 of 8"). These gave the second fun peak (20, 36, 54).
- **Save:** Manual save gave clear confirmation (29 to 30), and autosave was visibly reported (58).
- **The war threat:** It felt real and tense (28, 38). The player said the turn report and cards "keep things moving" (39).
- **The auto battle bar:** The player called it clear (60).
- **Stability:** No page errors.

## 7. Coverage

**Played properly**
- Start screen and setup
- Cities and builds
- Era goals and events
- Units and armies, and wars (with struggle)

**Glanced at**
- Tech tree: one recommended pick.
- Glossary and help: tutorial only, glossary never opened.
- Diplomacy: one failed offer.
- Naval: saw a galley in a build queue.
- Economy: read prices only.
- Map zoom: pinch and magnifier.
- Save: save only, no load.
- RTS battles: one Auto battle at the last step.

**Missed**
- Loading a save
- Independents, raids, World Congress
- Manual RTS control: deploy, orders, workers, sieges
- Naval movement or combat
- Browsing the tech tree beyond the recommendation
- Glossary lookups
- Any successful diplomacy

**Note on sessions:** The start session played Akkad, while the bronze and classical sessions put the player in Israel (Jerusalem, Samaria) at war with Pontus, then Akkad. This is the prepared saves, not a game fault, but it means the player never followed one empire through.

**Next run should aim at**
1. **An RTS battle under manual control.** Start a session at or just before a battle and have the player deploy and give orders instead of Auto, including one siege.
2. **Load a save** and confirm the state is restored.
3. **Diplomacy with enough gold and decrees** to tell whether "Offer pact" is broken or just unaffordable.
4. **Independents, raids and World Congress,** probably from a later-era save.
5. **A naval session:** build or buy a ship and move it.
6. **A tablet or desktop pass of the war loop,** to separate small-screen tap problems from real UI gaps.

---
60 steps, play $1.07 (claude-opus-5-5) + report $0.17 (claude-opus-5-5) = $1.24. Diary: `diary.jsonl`, noted screens: `shots/`.
