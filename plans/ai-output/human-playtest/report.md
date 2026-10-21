# Human playtest: newcomer-phone, battles

# Playtest report: newcomer-phone, battle sandbox (844x390, English)

## 1. Summary

A first-time player on a sideways phone played 111 steps across four sessions: bronze-field (two battles), classical-walls, gunpowder-naval and modern-sack. Every battle started, and the basic loop worked every time: tap "All", tap "Attack", tap the map, and the army moves. Past that loop, the player was lost most of the time. They could rarely see their own units, could not tell who was winning, and twice watched their whole army die without understanding why. The sea battle had no sea. Result screens arrived late, never arrived, or said things that contradicted what the player saw. Fun never rose above 3 out of 5, and frustration reached 4 during the naval session. No page errors and no harness errors were recorded.

**The three things that matter most:**
1. **The naval battle is broken.** It had no water, the ships sat on grass, the ships could not be found again, and the battle ended in a Defeat with 0 losses on both sides (steps 82 to 102).
2. **The player cannot read the fight on a phone.** Units are tiny, the player's own army is hard to locate, and there is no clear "who is winning" signal. This came up in every land battle.
3. **Battle endings are slow, missing or contradictory.** The battle kept running after the whole army was gone (steps 30 to 31, 76 to 77). One Defeat screen said "Mixed". Another Defeat showed zero losses. A win had no explanation.

## 2. Scorecard by area

| Area | Score /10 | Why |
|---|---|---|
| Battle setup screen | 6 | Labels are clear (step 34), but the player had to scroll to reach Fight in every session. A Terrain tap opened the Age list (step 35), and no sea option was visible. |
| Deploy phase | 5 | The tutorial tips helped but felt crowded (step 3). In practice deploy was just pressing Start. The player never placed a unit. |
| Selection and orders on touch | 6 | All, then Attack, then tap worked reliably every time (steps 9, 23, 42, 54, 69, 83, 108). Circle select, paths and single-squad orders were never tried. |
| Powers | 4 | Charge could be used and the counter dropped from 7 to 6 (step 59). The player never described any visible effect. |
| Camera pan and zoom | 4 | Find and Enemy helped (step 20). The first pinch "did little" (step 12), Map seemed to only highlight (steps 17 to 18), and minimap taps landed on empty ground (steps 62, 88, 94). |
| Unit readability and size | 3 | "Units are tiny" was repeated at steps 28, 66 and 77, and in both done summaries for land battles. |
| Combat clarity | 3 | The player kept saying it was hard to see who was winning (steps 44, 45, 60, 70). The army shrank without warning (step 28). The alerts and the Base counter were the only clear signals. |
| Economy and workers HUD | not scored | Glanced at only. There was one "train laborer" tap (step 16) and no reported outcome. |
| Buildings, sieges and walls | 4 | The walls were hard to see until the player zoomed out (steps 56, 59, 66). No gate or siege moment was ever reported. |
| Speed and smoothness | 7 | No lag, no page errors. The only complaint was that the bronze base defense dragged on (steps 43 to 48). |
| End of battle and result screen | 3 | Results were late (step 32) or never shown (step 77), were contradictory (steps 32, 100) and were unexplained (step 109). The Continue button is big and clear. |
| Layout on this screen and language | 5 | English text is readable. However, panels cover much of the screen (steps 20, 66), the result text is small (step 32) and Fight sits below the fold. |
| Naval | 1 | No water and no findable ships, and the battle played as a land keep battle (notes 92, 96, 100). |
| Fun | 3 | Fun sat flat at 3 and dropped to 2 whenever the player got lost or lost the army. It never went above 3. |

## 3. Scorecard by age

| Session | Kind of battle | Score /10 | Started | Played to end | Who won | Why |
|---|---|---|---|---|---|---|
| bronze-field (battle 1) | Open-field attack on an enemy camp | 4 | Yes | Yes | Enemy (Defeat, labelled "Mixed") | The player lost the army without understanding why. The result came late and read confusingly. |
| bronze-field (battle 2) | Base defense against raiders | 4 | Yes | No (still running at step 48 after about 42 s of watching) | Unknown | The player could not tell who was winning and gave up waiting. |
| classical-walls | Walled city assault | 3 | Yes | Army wiped (step 76), but no result screen was seen before the session ended (step 77) | Effectively the enemy (not confirmed) | Walls only became visible after zooming out, units were tiny and there was no ending. |
| gunpowder-naval | Sea battle | 1 | Yes | Yes (timer ran out) | Enemy (Defeat, 0 losses on both sides) | There was no sea, the ships were lost and no real fight happened. |
| modern-sack | Town defense against raiders | 5 | Yes | Yes (about 59 s) | Player ("Held", attackers withdrew) | A quick and painless win, but the player was puzzled about why it ended. |

## 4. Fun curve

- **Steps 1 to 27 (bronze, battle 1):** Flat at fun 3. Frustration went from 1 to 2 at step 3, when the crowded tutorial tips appeared, and stayed at 2 while the player wandered. Find and Enemy (steps 19 to 20) and the Go/Rally alerts (steps 26 to 27) kept it from sinking.
- **Steps 28 to 38:** The first dip, to fun 2 and frustration 3. The army collapsed from 6 squads to 1 with no clear warning. The result screen came late and said "Mixed". Step 36 reads "Not much fun left, battle felt confusing."
- **Steps 39 to 47 (bronze, battle 2):** Back to fun 3 and frustration 2 with a fresh start. Frustration rose to 3 at step 48, "the battle drags on".
- **Steps 49 to 62 (classical):** Fun 3, frustration 2.
- **Steps 63 to 71:** Frustration rose to 3 when the minimap jump went to empty ground and the player said they were "a bit bored" (step 64).
- **Steps 72 to 73:** A small lift (frustration back to 2) as the "Enemy units broke" moment arrived.
- **Steps 74 to 77:** The army melted away and no result screen appeared. Fun 2, frustration 3.
- **Steps 78 to 85 (naval):** Fun 3 and frustration 2 despite "ships on grass".
- **Steps 86 to 91:** Frustration rose to 3 at step 86 and fun dropped to 2 at step 88 once the ships were lost.
- **Steps 92 to 102:** **Low point: frustration 4 for eleven steps in a row.** No water, no ships, and a zero-loss Defeat.
- **Steps 103 to 111 (modern):** Fun 3, frustration 2. A fast win, but no emotional peak.

The curve never went up. The best moments were relief, not delight: the first "enemy broke" alerts (step 26, step 72) and the Find toast (step 20). Every sink came from the same cause: losing track of the army or of what was happening.

## 5. Top issues (ranked by harm to a real player)

### 1. The sea battle has no sea and cannot be played
- **What happened:** The ships appeared on grass (steps 82, 84, 85). After Find, the camera went to an empty keep (step 86). From then on, All, Find, Enemy, the minimap and zooming out never showed the ships again (steps 87 to 95). A banner said "take the keep now" (step 96). The timer ran out and the result was Defeat, "defenders held ground", with 0 of 50,000 and 0 of 36,000 lost (step 100).
- **Unclear points:**
  - At step 85 the player thought the ships were "fighting", but the zero losses suggest no combat happened at all.
  - It is unclear whether the session preset really selected naval terrain. The setup never showed a sea option (steps 34, 102).
- **Screenshots:** shots/step-092.jpg, shots/step-096.jpg, shots/step-100.jpg
- **Suggested fix:**
  - Make sure a naval preset forces a water tile, or refuses to start with a clear message.
  - Never place ships on land.
  - Make the All button (or a "My fleet" button) center the camera on the player's units.
  - Show a sea option in the setup Terrain picker.

### 2. The player cannot see their own army or tell who is winning
- **What happened:**
  - The player was lost from step 13 onward ("still lost" at steps 14, 15, 19, 22 and 25: "I still can't see my units").
  - The army went from 6 squads to 1 without the player noticing until afterwards (step 28).
  - "Hard to see who wins" came up at steps 44, 45 and 60. "Units are tiny" came up at steps 28 and 66.
  - The only clear signal was the "Base 1 vs 10" counter (step 77).
- **Screenshots:** shots/step-028.jpg, shots/step-066.jpg
- **Suggested fix:**
  - Add a simple, always-visible strength bar (my side versus their side) at the top of the HUD.
  - Make friendly squads larger, or give them bold team-colored markers when zoomed out.
  - Show a warning toast when the player loses half their squads.
  - Have the All button also move the camera to the selected army.

### 3. The battle does not end when the whole army is gone
- **What happened:**
  - Bronze: the HUD showed All 0 at step 30, the timer kept running at step 31, and the Defeat screen only appeared around step 32, after more than 8 seconds of waiting with nothing left.
  - Classical: All 0 at step 76, then nothing after a 10-second wait. The player quit at step 77 without ever seeing a result.
- **Unclear point:** There may be a deliberate grace period, for example for routed squads to rally. If so, it is invisible to the player.
- **Screenshots:** shots/step-032.jpg
- **Suggested fix:** End the battle as soon as the player has no squads left, or show "No troops left: battle ends in N s" so they are not left staring at an empty field.

### 4. Result screens contradict what the player saw
- **What happened:**
  - Step 32: the screen said Defeat, but also "Mixed" and "attackers' camp destroyed".
  - Step 100: Defeat with zero losses on both sides.
  - Step 109: "Held, attackers withdrew" after about a minute, with no explanation of why. The raiders lost 15,070 of 40,000 and the player lost 0.
- **Not a bug:** In the modern battle, the player thought "lasted 0 min 59 s" clashed with the clock showing 11:02 left. If the battle limit is 12 minutes, those two numbers agree.
- **Screenshots:** shots/step-032.jpg, shots/step-100.jpg, shots/step-109.jpg
- **Suggested fix:**
  - Make the headline and the reason line agree.
  - Add one plain sentence explaining the ending, such as "The raiders lost a third of their men and fled."
  - Use larger text on the reason line for phones.

### 5. Camera navigation is unreliable on touch
- **What happened:**
  - The first pinch "did little" (step 12). A later pinch worked (step 65).
  - Map seemed to only highlight on the first tap (steps 17 to 18).
  - Minimap taps went to empty ground (steps 62, 88, 89, 94).
  - The player confused the bottom-bar labels. The button at about x=170 was called "Find" at steps 19 and 64 and "Enemy" at step 90, and its own toast said "Tap Enemy again" (step 20). The button at about x=220 was called "Enemy" at step 15 and "Base" at step 63.
- **Unclear point:** This may be the model misreading labels rather than labels that change.
- **Screenshots:** shots/step-020.jpg
- **Suggested fix:**
  - Give clearer and more distinct icon labels.
  - Make the Map toggle state obvious.
  - Show a marker on the minimap where the camera will land.
  - Check the pinch sensitivity on small screens.

### 6. Panels cover too much of a phone screen
- **What happened:**
  - The info card covered the left part of the screen (step 20).
  - The selected camp panel covered a lot of the view (step 66).
  - The tutorial tips felt crowded (step 3).
  - The result text was small (step 32).
- **Screenshots:** shots/step-020.jpg, shots/step-066.jpg, shots/step-032.jpg
- **Suggested fix:** Use collapsible or narrower cards in landscape on phones, auto-hide them after a few seconds, and set a minimum text size.

### 7. Powers give no visible feedback
- **What happened:** Charge was used twice (steps 11, 58). The counter dropped (step 59), but the player never described seeing anything happen ("hope it is obvious what happens").
- **Suggested fix:** Add a clear on-unit effect and a short toast such as "Charge: +speed for 10 s".

### 8. Setup friction
- **What happened:**
  - Fight is below the fold, so the player scrolled in every session (steps 1, 37, 49, 78, 103).
  - A tap meant for Terrain opened the Age list (step 35). This may have been a missed tap.
  - The second bronze battle turned into a base defense without the player deliberately changing anything (steps 36 to 39). This is unclear.
- **Screenshots:** shots/step-034.jpg
- **Suggested fix:** Pin the Fight button to the bottom of the screen and enlarge the spacing between pickers.

## 6. Bugs

1. **The naval battle loads with no water** (sev 3, notes 92 and 96)
   - Steps to reproduce:
     1. Open the gunpowder-naval sandbox setup.
     2. Scroll down and tap Fight (step 79).
     3. Tap Start in the deploy panel (step 80).
     4. Observe that the ground is grass and stone, the minimap has no sea, the ships sit on land, and a "take the keep now" banner appears.

2. **The ships cannot be located again** (sev 3, note 92)
   - Steps to reproduce:
     1. In the naval battle, tap All, then Attack, then tap toward the enemy (steps 81 to 83).
     2. Wait about 16 s.
     3. Tap Find (about 170,346). The camera goes to an empty keep.
     4. Try All, the minimap red dot, Enemy and pinching out (steps 87 to 95). None of them show the ships.

3. **Defeat with zero losses on both sides** (sev 2, note 100)
   - Steps to reproduce: Continue from bug 2 and let the timer run out (steps 97 to 99). The result is Defeat, "time ran out, defenders held ground", with 0 of 50,000 and 0 of 36,000 lost.

4. **The battle keeps running after all player squads are gone** (sev 2, notes 32 and 77 summary)
   - Steps to reproduce: Start bronze-field or classical-walls, then tap All, Attack and a target, and wait.
   - Bronze: All 0 at step 30, and the result only came after a further wait (step 32).
   - Classical: All 0 at step 76, and no result appeared within 10 s.
   - Unclear whether this is an intended grace period.

5. **Result headline contradicts its own details** (sev 2, note 32)
   - Steps to reproduce: Lose the bronze-field open-field attack. The screen shows Defeat together with "Mixed" and "attackers' camp destroyed".
   - Unclear whether this is a deliberate partial-outcome label.

6. **Minimap tap sends the camera to empty ground** (sev 2, unclear)
   - Steps to reproduce: In classical-walls, tap Map (271,346), then tap the minimap at 720,150 (step 62). The camera lands somewhere empty.
   - The same happened in the naval battle at steps 88, 89 and 94.
   - This may be correct mapping with nothing at that spot, or a wrong mapping.

7. **Terrain picker tap opens the Age list** (sev 1, possibly a missed tap)
   - Steps to reproduce: On the bronze setup screen after a battle, tap 536,101 (step 35). The Age list opens instead of Terrain.

8. **To check: inconsistent squad counts**
   - The player read "8 squads" at step 7, "All 10" at step 13 and "6 squads" at step 28 within the same battle.
   - These could be reinforcements, different counters, or misreadings. Worth checking what the All counter actually counts.

**No harness errors and no page errors were recorded.**

## 7. What was fun, and what else was good

- **Find and Enemy navigation:** These rescued the player in bronze. The toast "Their keep, 1 of 3. Tap Enemy again" was called helpful (step 20, shots/step-020.jpg).
- **Actionable alerts:** The Go and Rally buttons on the "archers broke" and "spearmen shaken" alerts gave the player something meaningful to tap mid-fight (steps 26 to 27).
- **"Enemy units broke" moments:** These were the only times frustration dropped mid-battle (step 72).
- **Base counter:** "Base 1 vs 10" was the one clear read on the state of the battle (step 77).
- **The core order loop on touch:** All, then Attack, then tap worked first time in every battle. The bottom-bar buttons are big enough to hit reliably.
- **Readable screens:**
  - The setup screen labels are clear (step 34).
  - The result screens are tidy, and Continue is big and easy to hit (steps 32, 100).
- **Visible power counter:** It updated correctly (step 59).
- **Smooth performance:** No lag or errors were reported across 111 steps.
- **A quick win:** The modern sack defense felt fast and painless (step 109), even if unexplained.

## 8. Coverage

- **Played properly:**
  - Battle setup
  - Selection and orders, but only the All/Attack/tap pattern
  - Combat clarity
  - End of battle and result screens
  - Camera pan and zoom
- **Only glanced at:**
  - Deploy phase: the player only pressed Start and never placed units.
  - Powers: only Charge was used.
  - Economy and workers HUD: one tap with no outcome.
  - Buildings, sieges and walls: the player watched but never saw a gate or siege engine.
  - Speed and smoothness
  - Layout and language
  - Naval: attempted, but blocked by the missing water.
- **Missed entirely:**
  - Circle select, drawing a path, and single-squad selection and orders
  - Deploy positioning
  - Any power other than Charge
  - Worker and building play
  - Siege weapons and gate breaching
- **Ages:** Bronze, classical, gunpowder and modern were played. The other four ages, including stone and future, were not played.
- **The next run should aim at:**
  1. Re-test naval after a fix, checking that water, ship placement and fleet finding all work.
  2. Touch gestures beyond "select all": circle select, draw a path, attack-move on a single squad, and placing units during deploy.
  3. The economy: train workers, gather resources, place a building, and report what the HUD shows.
  4. A siege with engines against a gate, checking whether wall damage is readable on a phone.
  5. The timing of the battle ending when the player's army is wiped out.
  6. The unplayed ages, starting with stone and future.
  7. A base defense played to its end, to see a full defensive result.

---
111 steps, play $1.08 (claude-sonnet-5-5) + report $0.28 (claude-opus-5-5) = $1.35. Diary: `diary.jsonl`, noted screens: `shots/`.
