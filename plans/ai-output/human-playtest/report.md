# Human playtest: civ-veteran

# Playtest Report: civ-veteran, campaign (desktop 1600x900, en)

## 1. Summary

A Civilization and Paradox veteran played 201 steps across six sessions: start, bronze, classical, gunpowder, modern and information. The modern session holds only a wrap-up line, so it was not really played. The basics hold up:

- World setup is quick.
- Save and load worked all three times.
- Buying peace was clean and fast.
- The Empire panel was praised.

The middle and late game, though, became a loop of End Turn, event cards and "needs production" prompts. About 53 of 201 steps went to refilling empty city queues. Fun sat at 3 out of 5 for almost the whole run. It rose to 4 only when founding the first city, when a battle finally started, and when peace was bought. No page errors were caught.

**The three things that matter most:**

1. **The production queue chore.** City queues keep emptying, and End Turn is blocked until each one is refilled. Builds take up to 36 turns. This was the single biggest drain on the session.
2. **The war loop rarely delivers a fight, and the one battle that was played went badly.** An army marched for 10 or more turns, starved, and never reached a battle. The one real-time battle that was played ended with the player's squad wiped out while a tutorial tip was still on screen, because the battle did not pause.
3. **Gold has nothing to do.** Treasury grew to 1,379 and then 9,351, and almost every event choice was made because "gold is plentiful". This flattens events and makes the economy feel pointless.

## 2. Scorecard

| Area | Score | Why |
|---|---|---|
| Start screen and world setup | 7/10 | Kemet picked and four setup steps clicked through on defaults with no friction (steps 1-5). The options themselves were not explored. |
| Glossary and help | 4/10 | Tutorial skipped after two pages (steps 6-8) and the glossary was never opened. The battle tutorial tip did not pause play (step 158). |
| Tech tree | 4/10 | Advisor button needed a second tap (steps 9-10). Landmark picks reflowed the panel and chained confusingly. The era header disagreed with the tab count (steps 77-79, 105-107). |
| Units and armies | 4/10 | A 21-turn march was accepted despite a starvation warning, and the army starved without a fight (steps 43-62). Little else was done with units. |
| Cities, builds and settlers | 3/10 | Founding felt good (step 12). After that, queues emptied constantly, prompts blocked End Turn, and builds ran 18 to 36 turns. |
| Speed feel | 6/10 | No complaints about UI lag, and turns and menus advanced promptly. The slowness the player felt was game pacing, not interface speed. |
| Crises, events, era goals, independents, raids, World Congress | 4/10 | About 14 event cards appeared. They felt flavourful early (step 16) but became filler because gold was always plentiful. The landmark chain was confusing. World Congress, independents and raids were never seen. |
| Map pan, zoom, close view and fog | 6/10 (glanced) | One zoom-out pinch with no problems (step 17). Pan, close view and fog were not really tested. |
| Diplomacy | 7/10 | Sue for peace was instant and clear, and disabled actions show reasons (step 94). The Offer pact tap gave no visible feedback at first (steps 19-20). |
| Economy and gold | 4/10 | The Empire panel is clear (step 25). Gold piled up with no visible use (steps 123-126). |
| Save and load | 9/10 | Save, then load, worked in three separate sessions with state intact (steps 26-30, 71-75, 111-115). |
| Pacing and fun | 3/10 | Long quiet stretches and repetitive chores. Fun stayed at 3 for most of the run. |
| Wars and AI behaviour | 3/10 | Already at war from the start of the bronze session, but no contact for about 40 steps of turns. The army starved on the march. |
| RTS battles (deploy, orders, workers, sieges) | 3/10 | Deploy worked. The squad was overrun right after being selected, with no pause. Orders, workers and sieges were never tested. |
| Naval | not reached | The only contact was a locked War Galley tooltip, "needs Early Astronomy" (steps 65-66). |

## 3. Fun curve

The curve is very flat. Fun was 3 and frustration 2 for roughly 170 of 201 steps.

| Steps | Fun / frustration | What happened |
|---|---|---|
| 1-11 | 3 / 1 | Setup and tutorial skip went smoothly. Frustration ticked to 2 at step 10, when the advisor button did nothing on the first tap. |
| 12-16 | 4 / 1 | **First peak.** Founding the city on the Nile ("good yields"), queuing scouts and the first flavour event. Early agency feels good. |
| 19-21 | 3 / 2 | The Offer pact tap gave no visible response. |
| 33-61 | 3 / 2 | A long plateau of end turns, with thoughts like "pacing feels slow with little to do" (step 37) and "nothing to fight yet" (step 38). Production prompts start interrupting (steps 33, 46, 57). |
| 62-64 | 2 / 3 | **First low.** The army is starving on a 21-turn march and there is still no battle (note at step 62). |
| 81-82 | 4 / 2 | **Second peak.** "A battle at last." What happened inside the battle is not in the diary, because the next step is a new session. |
| 94 | 4 / 1 | **Third peak.** Sue for peace for 180 gold: "Peace achieved cheaply, satisfying." |
| 95-157 | 3 / 2 | The longest plateau. Repeated "same chore again" production prompts, idle gold ("9351 gold idle is odd", step 124) and a landmark backlog. |
| 158 | 2 / 3 | **Lowest point.** The real-time battle was lost almost instantly while the tutorial tip was still showing. |
| 159-160 | 3 / 3 | Frustrated wrap-ups. |
| 161-201 | 3 / 2 | Information age. Seven mechanized infantry queued one city at a time, with remarks like "8 production is painfully slow" (step 166), "36 turns is slow" (step 195) and "same loop, getting repetitive" (step 199). |

**Why it moved:** every rise came from a moment of real agency (founding, fighting, negotiating). Every dip came from the game withholding or wasting that agency, through a fruitless march, a battle with no time to learn, or chores.

## 4. Top issues (ranked by harm to a real player)

### 1. Empty production queues block End Turn every few turns
- **What happened:** Cities kept running out of things to build. The player had to open the prompt and queue a unit city by city. At step 46 the prompt blocked End Turn outright. In late eras each build takes 18 to 36 turns, yet queues still emptied, so it is unclear why. Possibly the queue holds only one item, or units completed and nothing repeats. The player always picked the same unit (musketeers, then mechanized infantry), which shows the choice had stopped being meaningful.
- **Steps:**
  - Early: 33-34, 46-47, 57-58, 64-66
  - Classical: 85-86, 97-98, 100-101, 117-118
  - Gunpowder: 121-130, 136-137, 148-149, 151-152
  - Information: 161-170, 175-176, 182-183, 185-186, 191-192, 194-195
- **Screenshots:** none attached to these steps.
- **Suggested fix:**
  - Add a "repeat last build" toggle and multi-item queues.
  - Add a city-governor or auto-build option.
  - Show a single list of all idle cities with a "queue for all" action.
  - Make an empty queue a warning rather than a hard block on End Turn.

### 2. The war loop does not produce fights, and armies starve on the way
- **What happened:** The bronze session started at war with Tiwanaku (step 42). The player ordered a march despite a 21-turn route and a starvation warning (step 44), then ended turn about 10 times. The units starved and never reached a battle (note at step 62). The AI also did not come to the player until step 81. Part of this is the player's own choice, since a warning was shown at order time (step 44). The note, however, says that during the march the warning only shows up in the turn report, where it is hard to act on.
- **Steps:** 42-62, 63.
- **Screenshot:** shots/step-062.jpg
- **Suggested fix:**
  - Show supply range along the planned path.
  - Require a stronger confirmation for routes that will starve.
  - Offer the nearest reachable target or a staging city.
  - Put a persistent "army starving" alert on the map rather than only in the report.
  - Review AI aggression when it is at war and nearby.

### 3. Gold piles up with nothing meaningful to spend it on
- **What happened:** The treasury held 1,379 in the classical session (step 93) and 9,351 in gunpowder (steps 123-126). Nearly every event choice was justified with "gold is plentiful" (steps 54, 60, 89, 109, 132, 135, 172, 179, 189). Event trade-offs lose their weight, and 36-turn builds sit beside a huge idle treasury. It is unclear whether a buy or rush option exists, because the player never looked for one. If it exists, it is not discoverable from the production prompt.
- **Steps:** 54, 60, 89, 93, 109, 123-126, 132, 135, 172, 179, 189.
- **Screenshots:** none attached.
- **Suggested fix:**
  - Put a visible "buy with gold" option on the production prompt.
  - Scale event costs to the size of the treasury.
  - Add more gold sinks, such as diplomacy, mercenaries or upgrades.

### 4. Real-time battle does not pause for the tutorial, and the squad is overrun instantly
- **What happened:** The player chose to command the defence of Itaparica, deployed on default placement and started. The squad was selected and the clock ran. The squad was then wiped out ("You 0%", "All 0") while the tutorial tip still read 1 of 3. The player never got to issue a move order. The diary does not show whether the defence was hopeless from the start, which would point to a balance or odds-display problem, or whether it was lost to the lack of a pause.
- **Steps:** 154-158.
- **Screenshot:** shots/step-158.jpg
- **Suggested fix:**
  - Start battles paused, or pause automatically while tutorial tips are open.
  - Show the force comparison or odds before the player picks "command" over auto-resolve.
  - Give a short grace period before the enemy engages.

### 5. Landmark picks and the research panel are confusing
- **What happened:**
  - At step 78, picking Great Ziggurat seemed to flip a toggle. The card then vanished and the panel reflowed, with the tech list collapsed below the fold (note at step 79).
  - Later, "Pick a landmark" reopened a Bronze Age choice. The header read "Classical 0 of 10 known" while the Bronze tab showed 7/10 (note at step 105).
  - In gunpowder, landmark choices chained one era after another: Chariot Yards, then Forum, Castle Keep and Stock Exchange. The "Pick a landmark" task stayed listed and there was no clear confirmation of each pick (note at step 142).
- **Caution:** the sessions appear to load separate saves (see Coverage), so the Bronze choice "reappearing" may simply be a different save with an unpicked landmark. The reflow, the header mismatch, the missing confirmation and the lingering task are valid on their own.
- **Steps:** 77-79, 104-107, 140-145.
- **Screenshots:** shots/step-079.jpg, shots/step-105.jpg, shots/step-142.jpg
- **Suggested fix:**
  - Show a confirmation toast naming the landmark picked.
  - Show a backlog counter, for example "3 landmark picks pending".
  - Clear the task when the backlog is empty.
  - Make the era header match the tab being viewed.
  - Keep the tech list visible after a pick.

### 6. Long quiet stretches with nothing to do
- **What happened:** There were runs of four or more End Turns with no decisions. The player repeatedly said things like "pacing feels slow", "the world is quiet", "nothing else needs attention" and "same loop".
- **Steps:** 35-41, 49-53, 88-91, 178-181, 196-199.
- **Screenshots:** none attached.
- **Suggested fix:**
  - Surface optional goals or opportunities during quiet turns.
  - Offer a "skip until something happens" option.
  - Review the pacing of contact and war in the early game.

### 7. Taps without visible feedback
- **What happened:**
  - The advisor research button did nothing on the first tap but worked on a second tap nearer the label (steps 9-10).
  - Offer pact gave no visible response on two taps. The player only later understood that a decree was required (steps 19-21). Step 94 shows that disabled diplomacy actions do display reasons, so the reason may have been there and not noticed.
- These may be missed taps rather than game bugs.
- **Screenshots:** none attached.
- **Suggested fix:**
  - Make the full button area clickable.
  - Show a toast or shake animation with the reason when a disabled action is pressed.

## 5. Bugs

Page errors: none caught by the harness. All items below come from the player's notes and observations, and some may be intended behaviour.

### B1. Landmark task persists and the research header contradicts the tab (sev 2)
- **Reproduce:**
  1. Load the bronze session save.
  2. Open Research (right sidebar).
  3. Pick the Great Ziggurat landmark card.
  4. The card vanishes and the panel reflows. The header shows "Bronze 0 of 10 known" with nothing queued.
  5. In the gunpowder save, tap "Pick a landmark" at the top left.
  6. Pick Chariot Yards. The Classical choice appears, and "Pick a landmark" is still listed.
- **Expected:** a confirmation of the pick, a clear backlog count, and a header consistent with the tab.
- **Screenshots:** shots/step-079.jpg, shots/step-105.jpg, shots/step-142.jpg

### B2. Army starves on a long march with no in-march alert (sev 2, possibly design)
- **Reproduce:**
  1. Bronze session, at war with Tiwanaku.
  2. Open the war banner and choose March to Tiwanaku.
  3. Confirm despite the 21-turn and starvation warning.
  4. End turn about 10 times.
  5. Starvation appears only in the turn report, and no battle occurs.
- **Screenshot:** shots/step-062.jpg

### B3. Real-time battle tutorial does not pause the simulation (sev 2)
- **Reproduce:**
  1. Gunpowder session.
  2. When the Itaparica defence prompt appears, tap Command defence.
  3. Tap Deploy, then Start battle.
  4. Select your squad.
  5. The clock runs and the squad is destroyed while the tip still shows 1 of 3.
- **Screenshot:** shots/step-158.jpg

### B4. End Turn hard-blocked by an empty production queue (design question)
- **Reproduce:**
  1. Bronze session.
  2. Found or own a city with nothing queued.
  3. Tap End Turn.
  4. A production prompt appears instead of the turn advancing.
- **Screenshot:** none.

### B5. Advisor research button unresponsive on first tap (unclear, may be a missed tap)
- **Reproduce:**
  1. Start a new game and skip the tutorial.
  2. Tap the advisor research button near x1340, y755.
  3. Nothing happens. A tap near x1250 works.
- **Screenshot:** none.

### B6. Offer pact gives no visible feedback when unavailable (unclear)
- **Reproduce:**
  1. Start session, turn about 3.
  2. Open Peoples.
  3. Tap Offer pact (both the button and the card).
  4. No visible response appears. A decree is required.
- **Screenshot:** none.

## 6. What was good

- **Save and load:** solid in every session. The save list is clear, loading is quick, and state was restored exactly (notes at steps 30, 75 and 115).
- **Sue for peace:** instant and clearly priced, with a truce end date and a map jump. Disabled diplomacy actions explain why, for example "open borders needs opinion 20" (note at step 94).
- **Empire panel:** treasury, income, upkeep, goals and court in one place (note at step 25).
- **World setup:** a fast four-step flow that a veteran could click straight through.
- **Founding the first city and early event cards:** gave the run its best early moments (fun 4 at steps 12-16).
- **Battle prompt and deploy screen:** both worked, and getting a battle made the player happy (step 81).
- **Locked build tooltip:** clearly states the requirement, "needs Early Astronomy" (step 66).

## 7. Coverage

**Played properly:**
- Save and load
- Cities and production (heavily, though mostly the same chore)
- Events (about 14 cards)
- Speed feel and pacing
- Diplomacy (peace deal)

**Only glanced at:**
- Start and world setup (defaults only)
- Glossary and help (tutorial skipped, glossary never opened)
- Tech tree (advisor pick and landmarks only, no manual research choices)
- Units and armies (one march order)
- Map (one pinch)
- Economy (one panel view)
- Wars and AI (one long march, one peace)
- Real-time battles (one deploy, one selection; the bronze battle at steps 81-82 is cut off by the session change)

**Missed:**
- Naval (only a locked tooltip)
- World Congress, independents, raids and crises
- Real-time orders, workers and sieges
- Close view and fog
- Settlers after the first city
- The whole modern session (step 160 is only a wrap-up)

**Unclear from the diary:**
- The player started as Kemet on the Nile (steps 1, 12). From the bronze session on, the cities have Tupi names around Guanabara and the turn numbers jump: 47, then 71, then 152, then about 165. The sessions appear to load separate preset saves rather than one continuous campaign. Treat cross-session comparisons, such as a landmark "reappearing", with care.
- Each session's wrap-up says "covered all areas", but the diary does not support that claim.

**Next run should aim at:**
- Actually play the modern session.
- Fight a real-time battle start to finish: issue move and attack orders, use workers, and attempt a siege.
- Reach naval units: research Early Astronomy and build and move a galley.
- Find World Congress, independents and raids.
- Check whether gold can rush production.
- Pick research manually in the tech tree, comparing it against Civ.
- Try settling a second city.
- Pan and use close view, and inspect fog.
- Open the glossary.

---
201 steps, play $2.97 (claude-sonnet-5-5) + report $0.28 (claude-opus-5-5) = $3.25. Diary: `diary.jsonl`, noted screens: `shots/`.
