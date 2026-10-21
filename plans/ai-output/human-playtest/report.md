# Human playtest: newcomer-phone

# Playtest Report: newcomer-phone (phone 844x390, English)

## 1. Summary

A first-time strategy player on a sideways phone played 172 steps across six sessions (start, bronze, classical, gunpowder, modern, information). The guided start, event cards, founding a city and offering pacts all worked and felt clear. The rest of the run was a long, flat middle. Fun sat at 3 for almost every step, and the player often said "a bit lost" or "a bit bored." The worst moment was the map turning blank after closing the Peoples panel, which ended the gunpowder session. Beyond that, the player hit repeated dead ends: no save, load or help anywhere, a research panel where tech cards were hard to find, and research and build times (1799 turns, 91 turns) that read as broken. Wars, naval play and RTS battles never happened. Every session's closing summary says "covered all areas," but the diary does not support that claim.

**The three things that matter most:**
1. **The map went blank** (dark blue, HUD only) after closing the Peoples panel, and the player could not recover (#126 to #132).
2. **Save, load and help could not be found.** The player looked four times across four sessions and found only Settings (#28 to #32, #92 to #95, #150 to #154, #170 to #171).
3. **Newcomers get no direction.** The army wandered empty land while supply drained, gold slowly fell with no explanation, research and build times looked impossible, and nothing pointed toward a goal. The result was long stretches of tapping End Turn (#40 to #58, #73 to #75, #104 to #114).

## 2. Scorecard

| Area | Score | Why |
|---|---|---|
| Start screen and world setup | 6/10 | Guided start and intro were friendly, but there were 7 pages of Next to skim (#2 to #8). The advisor picked the setup, so world options were never really seen (#9). |
| Tech tree | 3/10 | Tech cards were hidden behind the tab row and scrolling (#82 to #86). The modern session showed 1799 turns for one tech (#135). The player never chose a tech on purpose. |
| Cities, builds and settlers | 5/10 | The production banner and the "Best site" button worked well, and founding a city was a high point (#116, #117). Reaching the Build tab takes four taps every time. Numbers like 453/140 and 91 turns confused the player (#143, #146). |
| Speed feel | 5/10 | No complaints about lag. The game felt slow because of many End Turn taps with little happening (#73 to #75, #104 to #114). |
| Crises, events, era goals, independents, raids, World Congress | 6/10 | Event cards were consistently clear and the player liked them (#13, #65, #101, #106, #119, #162). Era goals were seen in Legacy (#157). The independent (Caral) tile card was thin (#77). Crises, raids and World Congress were not seen. |
| Map pan, zoom, close view and fog | 4/10 | Pinch zoom and fog worked (#14). The map then went fully blank (#128) and once "looked odd and empty" (#25). |
| Diplomacy | 7/10 | The empty Peoples panel explained what to do (#16). Pacts gave clear feedback twice (#125, #167). The Military pact button gave no feedback (#169). |
| Units and armies | 4/10 | March, ETA and the idle prompt worked. Exploring with no target while supply drained left the player lost (#51 to #59). |
| Economy and gold | 4/10 | The Empire panel was cut off by End Turn (#27). Gold kept dropping with no explanation (#74, #113). Log lines like "-800: +5g" give no source (#90). |
| Save and load | 1/10 | Never found in four searches (#32, #95, #154, #171). |
| Glossary and help | 2/10 | Searched for in the Menu but never found (#28 to #32). The player saw no help entry point. |
| Wars and AI behaviour | not reached | Only saw an "unjustified" war button on a tile card (#77). No war happened. |
| Pacing and fun | 4/10 | Fun stayed at 3 nearly throughout, with long idle stretches. The player ranked 36 of 36 (#157). |
| Naval | not reached | No coast or ship was found (#51). |
| RTS battles (deploy, orders, workers, sieges) | not reached | No battle occurred. |

## 3. Fun curve

- **Start (#1 to #33): calm and hopeful.** Fun 3 and frustration 1 through #24. Following the guide's prompts (production banner #10, settlers #11, first event #13, zoom #14) kept frustration low. Frustration crept to 2 when the map "looked odd and empty" (#25) and the Empire panel was cut off (#27). It reached 3 at #32, when the Menu turned out to be Settings only, with no save or help.
- **Bronze (#34 to #66): the first sink.** Marching the army into empty land repeated three times (#37 to #56), with the supply warning arriving at #51. Frustration held at 3 from #51 to #64. A late event card (#65) dropped it back to 2: "an event card finally, kind of fun."
- **Classical (#67 to #99): flat.** Ruler points (#69 to #72) were fine but unclear. Several bare End Turns followed (#73 to #75, "not much happening"). Frustration rose to 3 while hunting for tech cards (#82 to #86) and save options (#95).
- **Gunpowder (#100 to #132): peak, then crash.** This was the best stretch. Clear event cards led to founding a second city at #117 (fun 4). First contact with Muisca came at #121 and #122 (fun 4), and the pact succeeded at #125 (fun 4). Right after, the map went blank at #128. Fun dropped to 2 and frustration rose to 3 until the session ended at #132.
- **Modern (#133 to #160): second sink.** The 1799-turn research time (#135) pushed fun back to 2. Odd build numbers (#143, #146) and another failed save search (#154) kept frustration at 3. Legacy and Log were readable but showed the player in last place.
- **Information (#161 to #172): small lift.** The pact worked again and frustration fell to its lowest since the start (#167, #168: fun 4, frustration 1). The silent Military pact button (#169) undid some of that.

**Peaks:** #117, #121 to #125 and #167 to #168. All came from actions with immediate, visible results.
**Troughs:** #128 to #132 (blank map) and #135 to #136 (hopeless research).

## 4. Top issues (ranked by harm to a real player)

### 1. Map goes blank after closing the Peoples panel
- **What happened:** After a pact, the player closed the panel with the top-right X (#126). They thought the Peoples panel was still open, so they tapped the Peoples icon (#127). The map area became solid dark blue, with no terrain, cities or units. Tapping World opened a tile card for "On the Guainía," a tile they could not see (#129, #130). Closing that card did not help (#131), and the player quit the session (#132). The modern session started with the map back (#133). That was a new session, so it is unclear whether the map ever recovers within a running game.
- **Steps:** #126 to #132. Possibly related: #25 ("the map looks odd and empty now").
- **Screenshots:** shots/step-128.jpg, shots/step-130.jpg
- **Suggested fix:** Check how the map renderer resumes after the Peoples panel closes, especially when the panel is closed twice (X, then icon toggle). Add a failsafe: if the map canvas is empty while the HUD is up, force a redraw and recenter on the capital.

### 2. No findable save, load or help
- **What happened:** Menu opens Settings only. Scrolling the whole page shows sound, battle, performance, language and fog options. The note "Saved as you change them" only covers settings. The player could not tell whether their game saves or how to load one. Help and glossary were never found.
- **Steps:** #28 to #32, #92 to #95, #150 to #154, #170 to #171
- **Screenshots:** shots/step-032.jpg, shots/step-095.jpg, shots/step-151.jpg, shots/step-154.jpg
- **Suggested fix:** Put Save, Load and Help at the top of the Menu. If the game autosaves, say so in plain words there ("Your game saves automatically every turn") and show the last save time. Add a visible "?" or Help entry on the HUD.

### 3. Research and build numbers read as broken
- **What happened:**
  - In the modern session, Civil Service showed 10800 research at +6 a turn, which is 1799 turns (#135).
  - Rifle Infantry showed 91 turns, and 26 builds were flagged "slow here" (#143, #146).
  - Settlers showed 453/140 progress yet still "1 turn" (#143).
  - In classical, the player scrolled four times and never found the tech cards past the goals and boosts sections (#82 to #86).
- **Unclear:** This may be the one-city late-era test save rather than normal play. Even so, a newcomer read it as "broken or hopeless."
- **Steps:** #80 to #86, #135, #143, #146
- **Screenshots:** shots/step-084.jpg, shots/step-135.jpg, shots/step-143.jpg, shots/step-146.jpg
- **Suggested fix:** Show tech cards first on phone, with goals and boosts collapsed below. When a time exceeds a threshold, replace raw turns with a reason and a tip, for example "Very slow: your research is only +6. Build libraries or found more cities." Check why progress above cost (453/140) does not complete the item.

### 4. Exploring armies have no direction and starve
- **What happened:** The player marched the army to arbitrary tiles three times (#37 to #56). The note at #51 says supply drains 10 a turn and the army starves in 6 turns, with "nothing tells me where to go." The player fell back to Hold (#57). No contact, coast or battle resulted.
- **Steps:** #36 to #59
- **Screenshots:** shots/step-051.jpg
- **Suggested fix:** Add an "Explore" or "Auto-explore" order that respects supply. Alternatively, show suggested destinations (nearest unexplored coast, likely neighbours) on the March picker. Warn before confirming a march that will leave supply range.

### 5. End Turn button covers panel content
- **What happened:** The floating End Turn button hid the bottom of many panels on 844x390: Empire income (#27), Settings (#32, #95, #151), the report's own close button (#35), Research (#84, #135), Log (#90, #159), Peoples (#125) and Legacy (#157).
- **Screenshots:** shots/step-027.jpg, shots/step-032.jpg, shots/step-084.jpg, shots/step-090.jpg, shots/step-095.jpg, shots/step-125.jpg, shots/step-135.jpg, shots/step-151.jpg, shots/step-157.jpg, shots/step-159.jpg
- **Suggested fix:** Hide End Turn while a full panel is open, or reserve bottom padding in every panel equal to the button's height in phone landscape.

### 6. Long idle stretches and unexplained gold drain
- **What happened:** The player repeatedly tapped End Turn with "nothing much changes" (#73 to #75, #104 to #105, #112 to #114, #164). Gold "slowly dropping" was never explained (#74, #113). Log lines like "-800: +5g" give no source (#90). The Empire income list was cut off (#27). The player stayed on one city for a long stretch and ranked 36 of 36 (#157).
- **Screenshots:** shots/step-027.jpg, shots/step-090.jpg, shots/step-157.jpg
- **Suggested fix:** When the player has nothing queued or pending, the advisor banner should propose a next step (build settlers, explore toward X, research Y). Label log lines with their source ("Trade with Muisca +5g"). Add a one-line gold trend explanation on the treasury.

### 7. Military pact button gives no feedback
- **What happened:** After a successful pact, the player tapped the newly appeared Military pact button. Nothing visibly changed, and no message appeared (#168, #169).
- **Screenshots:** shots/step-169.jpg
- **Suggested fix:** Always show an outcome: accepted, refused with a reason, or unavailable with what is needed (gold, opinion, turns).

### 8. Closing the city panel opens a stray tile card
- **What happened:** Closing the city panel was twice followed by an unwanted info or tile card that had to be closed separately (#23 then #24, #147 then #148). Tapping the city banner opened an army card instead of the city (#138), probably because an army stood on the city tile.
- **Unclear:** The taps may have landed on the map. Worth checking for tap-through.
- **Suggested fix:** Consume the close tap so it does not reach the map. When a tile holds both a city and an army, offer a small chooser.

### 9. Thin information on independents and small HUD icons
- **Independents:** The purple "?" tile card showed a war button but little about who the Caral tribes are or what to do with them (#77, shots/step-077.jpg).
- **HUD icons:** The player once opened Research instead of Cities (#17, #18). The diary suggests a misremembered icon position rather than a bug. Unlabeled side icons are hard for a newcomer on a phone.
- **Suggested fix:** Give independents a short "who they are / what you can do" line. Add labels or long-press tooltips to the HUD icons.

## 5. Bugs

No page errors were caught by the harness.

1. **Map stops drawing after the Peoples panel** (severity high)
   1. Open Peoples (side HUD icon, about x770 y230) and select a known people.
   2. Tap Offer pact (#124).
   3. Close with the top-right X (about x758 y34) (#126).
   4. Tap the Peoples icon again (#127).
   - **Result:** The map is solid dark blue with only the HUD visible (shots/step-128.jpg). Tapping World opens a tile card for an invisible tile (shots/step-130.jpg). Closing the card does not restore the map.
   - **Note:** The player believed the panel was still open after step 3. It is unclear whether the X failed or the second tap re-toggled something.

2. **Military pact has no response**
   1. In the information session, open Peoples and Offer pact (#165, #166).
   2. Tap the new Military pact button (#168).
   - **Result:** No visible change or message (shots/step-169.jpg). This could be a silent refusal or a missing handler.

3. **Production progress above cost does not complete**
   1. In the modern session, open Cities, then Tiwanaku, then the city view, then the Build tab (#139 to #142).
   - **Result:** Settlers shows 453/140 and "1 turn" (shots/step-143.jpg). This is possibly a stuck item, though it may be a scenario artifact.

4. **Close tap on the city panel may pass through to the map**
   1. Open the city panel and Build tab.
   2. Tap close at about x385 y69 (#23, #147).
   - **Result:** An info or tile card appears that must be closed separately (#24, #148). Not confirmed, because a misplaced tap cannot be ruled out.

5. **End Turn overlaps panels at 844x390** (layout)
   1. Open Empire, Settings, Research, Log, Peoples, Legacy or a turn report.
   - **Result:** The bottom content, and in #35 the report's own button, is covered. See issue 5 for the screenshots.

## 6. What was good

- **Guided start and advisor:** A newcomer could go from title to a queued Settlers and first End Turn in 12 taps with almost no friction (#1 to #12).
- **Event cards:** These were consistently "clear" and were the most reliable small pleasure in the run (#13, #65, #101, #103, #106, #119, #162).
- **Founding a city:** The Settlers idle button led to "Best site" and then Found. The player called it "clear and inviting," and it was a fun peak (#115 to #117).
- **Diplomacy feedback:** The empty Peoples panel explains how to meet others (#16). Pacts show the cost, the opinion change and a PACT tag right away (#125, #167). First contact arriving in the turn report felt rewarding (#121, #122).
- **Army march basics:** The ETA, turn countdown and "Army idle" prompt kept the player oriented on what the army was doing, if not why (#39 to #43).
- **Legacy panel:** Readable score, rank, rivals and era goals (#157).
- **Pinch zoom and fog:** Worked on the first try (#14).

## 7. Coverage

**Played properly:**
- Start and guided intro
- Cities, builds and settlers (including founding a second city)
- Events
- Diplomacy (pacts, twice)
- Units and armies (marching and holding)
- Save and load (searched thoroughly, never found)

**Glanced at:**
- Tech tree (opened, scrolled, never chose a tech)
- Economy and gold (Empire panel, Log)
- Map zoom and fog (one pinch)
- Speed feel and pacing (implied by the End Turn runs)
- Era goals (seen in Legacy)
- Independents (one tile card)
- Ruler points and virtues (#69 to #71)

**Missed:**
- Wars and AI behaviour
- Naval
- RTS battles (deploy, orders, workers, sieges)
- Crises, raids and World Congress
- Glossary and help (never located)
- World setup options (the advisor chose)
- Map pan and close view

The sessions' "covered all areas" summaries (#66, #99, #132, #160, #172) overstate coverage.

**Next run should aim at:**
1. Reproducing the blank map bug. Close Peoples with X versus the icon, and check whether ending a turn or panning restores the map.
2. Forcing a war. Declare one on a neighbour such as the Caral tribes or Muisca, or load a session with a hostile AI, so the player reaches wars and an RTS battle (deploy, orders, a siege).
3. A coastal start or a naval-focused session.
4. Deliberately locating Help, Glossary and any save or load path, including starting from the title screen.
5. Picking a tech on purpose in Research, to judge the tree itself rather than the scrolling.
6. Waiting for or triggering a crisis, a raid and World Congress.

---
172 steps, play $1.49 (claude-sonnet-5-5) + report $0.24 (claude-opus-5-5) = $1.73. Diary: `diary.jsonl`, noted screens: `shots/`.
