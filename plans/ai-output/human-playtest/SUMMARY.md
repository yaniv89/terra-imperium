# Human playtest summary (2026-10-21)

Seven AI persona runs. Five ran at 18:52 after the age slice fix; two (hebrew-speaker, first newcomer) ran before it, so their five later sessions were black screens and only their start sessions count. Findings that are only about the black screen are left out.

Each report lives on its branch at `plans/ai-output/human-playtest/report.md`; screenshot paths below are relative to `plans/ai-output/human-playtest/` on that branch.

| Short name | Branch |
|---|---|
| civ | ai/human-playtest-39656548730 |
| war | ai/human-playtest-39656553202 |
| build | ai/human-playtest-39656557949 |
| rts | ai/human-playtest-39656562658 |
| new2 | ai/human-playtest-39656566773 |
| heb | ai/human-playtest-39648464704 |
| new1 | ai/human-playtest-39648439799 |

## 1. Personas

"Turns reached" is rough: the diaries rarely log the turn. Each run has a start session (a fresh game, about 3 to 8 turns) and five era sessions loaded from prepared saves (the classical save is about turn 105, modern and information about turn 151). "Fun" is the report's own "Pacing and fun" score; the diary average of the per-step fun score (out of 5) is in brackets.

| Persona | Size / lang | Steps | Turns reached | Ages played | Cost | Fun /10 |
|---|---|---|---|---|---|---|
| civ-veteran | desktop 1600x900, en | 214 | start about turn 8; about 50 End Turns over the era saves | start, bronze, classical, gunpowder, modern, information | $3.44 | 3 (2.55) |
| warmonger | phone 844x390, en | 182 | start turn 8; era saves | all six | $1.73 | 3 (2.95) |
| builder | phone 844x390, en | 197 | start about turn 8; classical to turn 108 | all six | $1.94 | 4 (2.95) |
| rts-commander | phone 844x390, en | 220 | start about turn 8; era saves | all six | $2.12 | 2 (2.89) |
| newcomer-phone (2nd) | phone 844x390, en | 172 | start about turn 4; classical about turn 104 | all six | $1.73 | 4 (2.99) |
| hebrew-speaker | phone 844x390, he | 75 | start about turn 8 | start only (rest black) | $0.78 | 3 (2.48) |
| newcomer-phone (1st) | phone 844x390, en | 78 | start about turn 8 | start only (rest black) | $0.77 | 3 (2.37) |

**Total cost: $12.51.**

## 2. Scores per area

Averaged over the personas that reached the area (n = how many). Scores come from each report's scorecard.

| Area | Avg /10 | n | Note |
|---|---|---|---|
| Start screen and setup (extra) | 7.0 | 7 | Four taps to a game, everyone liked it. |
| Map (pan, zoom, fog, close view) | 4.8 | 5 | Only pinches; close view never tried. Map went blank twice. |
| Cities, builds, settlers | 4.3 | 7 | Settlers stuck at "1 turn" dominates. |
| Units and armies | 4.1 | 7 | March works; selection, targets and supply hurt. |
| Tech | 4.0 | 6 | Tree cramped, ETAs of 950 to 1800 turns in era saves. |
| Economy and gold | 4.7 | 6 | Numbers visible, but gold drain unexplained. |
| Diplomacy | 6.2 | 6 | Best system: pacts, map trade, refusal reasons. |
| Wars and AI | 2.0 | 2 | War declared twice, never any contact. |
| RTS battles | not reached | 0 | Zero battles in 1,138 steps. |
| Naval | not reached | 0 | No coast or ships found. |
| Crises, events, era goals | 5.9 | 7 | Event cards loved; crises, raids, World Congress never seen. |
| Glossary and help | 3.5 | 6 | Nobody found a glossary or help. |
| Save and load | 1.6 | 5 | Nobody found save or load. |
| Speed feel | 4.7 | 6 | No lag; slow because many turns have nothing to do. |
| Mobile UX | not scored | 6 | No scorecard row; every phone run hit End Turn covering panels (issue 5). |
| Hebrew | 5.0 | 1 | Mostly good; log and banner leak English. |
| Fun | 3.1 | 7 | Flat at 3 of 5 per step; peaks came from diplomacy and founding cities. |

## 3. Top 20 issues

Severity: B blocker, H high, M medium, L low. "Hit" is how many of the 7 personas ran into it.

| # | Sev | Hit | Issue | Evidence | Likely code | Status |
|---|---|---|---|---|---|---|
| 1 | B | 7 | No path to a battle. Nobody fought once: no neighbour met for many turns, war declared twice but the enemy was never seen ("Army: ?"), no "show on map" or "march to" for a known people. | war 171 shots/step-171.jpg, 173 shots/step-173.jpg; rts 130 shots/step-130.jpg, 026 shots/step-026.jpg; new1 step 49 | Peoples panel + mapCamera.js `focusPlace`; aiOperations.js (AI never sends forces); peoplesWorld.js (island start, contact distance) | open |
| 2 | B | 4 | Settlers show "1 turn" forever with progress far over cost (126/112, 318/117, 450/140, 456/140). Cause is the silent size 2 rule; only small text says so. | civ 60 shots/step-060.jpg, 181 shots/step-181.jpg; war 180 shots/step-180.jpg; build 131 shots/step-131.jpg; new2 143 shots/step-143.jpg | settlers.js size gate; city build list ETA and progress cap | open |
| 3 | H | 7 | Save, load, help and glossary cannot be found. Menu opens Settings only; no "autosaved" notice. | civ 26 shots/step-026.jpg; war 116 shots/step-116.jpg; build 35 shots/step-035.jpg; new2 154 shots/step-154.jpg | Menu button / Settings panel; glossary entry point | open |
| 4 | H | 4 | Era saves cannot use their content: size 1 capital, production 3, science +6, research 951 to 1799 turns, builds 47 to 200 turns. | civ 191 shots/step-191.jpg; build 138 shots/step-138.jpg; new2 135 shots/step-135.jpg; war 180 shots/step-180.jpg | playtest era saves (harness); research cost scaling | partly: research pace being fixed today; era saves still need real empires |
| 5 | H | 5 | End Turn covers the bottom of Settings, Log, Empire, Research, Peoples (hiding Declare war) and Legacy on 844x390. | new2 027 shots/step-027.jpg, 125 shots/step-125.jpg; rts 110 shots/step-110.jpg; war 153 shots/step-153.jpg; civ 117 shots/step-117.jpg | index.css `.sheet-panel` bottom padding vs `--rail-w`; promptStack.js | open |
| 6 | H | 6 | Exploring is aimless: armies march into empty land, supply drains 10 a turn, they starve walking home. No supply range shown when picking a target, no explore order, no "go find neighbours" hint. | war 081 shots/step-081.jpg; build 081 shots/step-081.jpg, 095 shots/step-095.jpg; new2 051 shots/step-051.jpg | routes.js march preview + supplyMeter.js; advisor hints | open |
| 7 | H | 4 | Disabled actions are silent: Declare war (no cause, 300 gold), greyed build plus, Military pact. The tribute route to a cause is the hidden answer. | rts 076 shots/step-076.jpg, 082 shots/step-082.jpg; war 121 shots/step-121.jpg; new2 169 shots/step-169.jpg; civ 181 shots/step-181.jpg | Peoples war card, build row, pact buttons: show the block reason on tap | open (tech unlocks fix may cover the build plus) |
| 8 | H | 2 | Map goes blank or dark after closing Peoples or signing a pact; camera jumps into fog. | new2 128 shots/step-128.jpg, 130 shots/step-130.jpg; civ 148 shots/step-148.jpg, 203 shots/step-203.jpg | GLMapView.jsx resume after sheet close; mapCamera.js after pact | open |
| 9 | H | 1 | Late army rows cannot be queued ("Nothing in production"); End Turn turns into "Choose production", a possible soft lock. | rts 149 shots/step-149.jpg, 215 shots/step-215.jpg, 219 shots/step-219.jpg | city build list for late units; End Turn prompt in promptStack.js | partly: tech unlocks and unit upgrades fixed today; recheck the soft lock |
| 10 | M | 3 | Virtue pick has no confirm or cost; points look unspent; locked tiers unexplained; rows cut off on phone. | build 112 shots/step-112.jpg, 120 shots/step-120.jpg; war 109 shots/step-109.jpg; rts 057 shots/step-057.jpg | Ruler panel | open |
| 11 | M | 1 | Army selection fails and the left panel sticks half faded; Escape and close do not clear it (about 40 steps). | civ 049 shots/step-049.jpg, 089 shots/step-089.jpg, 120 shots/step-120.jpg | useExclusivePanel.js / interactionModel.js fade state | open |
| 12 | M | 2 | Tech tree is cramped: one row Web view, lists cut off, no drag scroll, tech cards hidden below goals and boosts on phone. | civ 031 shots/step-031.jpg, 111 shots/step-111.jpg, 157 shots/step-157.jpg; new2 084 shots/step-084.jpg | Research panel layout | open |
| 13 | M | 4 | Gold drains 1 a turn with no reason; log lines like "-800: +5g" have no source; per-turn gold spam; food fell 44 to 25 unexplained. | civ 070 shots/step-070.jpg; new2 090 shots/step-090.jpg; rts 085 shots/step-085.jpg | economy.js upkeep line items; event log formatting | open |
| 14 | M | 1 | Own and foreign armies look alike; marching onto a marker that was really your own says "already there". | rts 099 shots/step-099.jpg | sceneModel.js / spriteArt.js army sprites | partly: bigger map units today; owner colour still needed |
| 15 | M | 3 | Build list shows about 2 rows on phone, is unit heavy, tabs sit close; the Build tab is four taps away. | war 130 shots/step-130.jpg; new2 146 shots/step-146.jpg; build steps 143 to 150 (no shot) | city build sheet | open |
| 16 | M | 1 | Panel loop after declaring war: closing Peoples shows the Turn report, closing that shows Peoples, for about ten steps. | rts 190 shots/step-190.jpg | interactionModel.js queue order | open |
| 17 | M | 1 | Hebrew: the log shows English event names and flips number signs ("11g+"); an English "Add to Home Screen" banner covers the difficulty buttons. | heb 029 shots/step-029.jpg, 003 shots/step-003.jpg | event log strings (translate at display), bidi isolation; install banner | open |
| 18 | M | 2 | Sheets and taps overlap: the turn report covers End Turn and "Army idle"; closing the city panel taps through to a tile card. | build 095 shots/step-095.jpg; new2 steps 147 to 148 (no shot) | sheet close handlers; promptStack.js | open |
| 19 | L | 1 | One unit shows 10 times its men (913 strength reads 9,130 soldiers). | war 081 shots/step-081.jpg, 143 shots/step-143.jpg | battleLedger.js `menOf` / army panel | open |
| 20 | L | 2 | Art slips: Riflemen show an airplane icon; the Chronicle shows an orange placeholder block. | civ 135 shots/step-135.jpg; new1 044 shots/step-044.jpg | unit icon map; Chronicle panel | likely fixed: late art merged today; recheck |

Also seen once, not ranked: the tutorial is seven wordy pages and still leaves the newcomer unsure what to do (new1); the independent tile card says little (new2 077 shots/step-077.jpg); the empty Peoples screen shows a bare search box (heb 021 shots/step-021.jpg); Hebrew army wording sounds translated and the disband trash icon sits close to the row (heb 034 shots/step-034.jpg).

Fixed today but not hit by these runs: Stone settle wording now says village, walls hidden until built, empty cities queue a defender, every lost city says why.

## 4. What players liked

- Setup: four taps from title to a game with good defaults (all seven).
- Event cards: clear trade-offs and flavour, the most reliable small pleasure (all seven).
- Founding a city: "Best site" picks a good spot and shows yields and travel time; a fun peak for builder and newcomer.
- Diplomacy: pact cost, opinion change and refusal reasons are instant and clear; the free map trade revealing 821 tiles was the civ-veteran's best moment; the empty Peoples screen explains how to meet people.
- The tribute demand that becomes a cause for war, and the war confirmation dialog: the warmonger's only fun 4.
- March orders: path preview with a turn count and a confirm step worked every time; the army panel shows supply and turns to starve clearly.
- Settings: battle mode (Command, Auto, Ask) and the rest are well explained.
- Fast turns, no page errors in any run, a readable Legacy panel and event log filters.

## 5. Proposed fix lanes

1. **Find a fight:** Peoples "Show on map" and "March to", enemy cities and armies highlighted at war, AI sends forces after a declaration, a neighbour or independent within a few turns of every start, owner colours on army sprites (issues 1, 6, 14).
2. **Say why it is blocked:** settlers "Needs size 2 (food +0)" instead of "1 turn" with progress capped, a reason toast on every disabled button (war, build plus, pacts), virtue confirm and cost, late army rows and the End Turn soft lock (issues 2, 7, 9, 10).
3. **Menu hub:** Save, Load, Help and Glossary at the top of Menu, an "Autosaved turn N" line, a "?" on the HUD (issue 3).
4. **Phone layout pass:** sheets padded clear of End Turn, the turn report collapses, the build list uses the full height with Buildings first, the tech tree goes full screen and scrolls, panel fade and loop fixes, no tap-through on close (issues 5, 11, 12, 15, 16, 18).
5. **Map and economy clarity:** map blank after Peoples or a pact, camera stays on revealed land, gold and food breakdowns with sources in the log, the men count, the Hebrew log and banner (issues 8, 13, 17, 19).
6. **Playtest harness:** era saves with era-sized empires, met neighbours, a coast and one save already at war, so the next run reaches RTS battles, sieges and naval (issue 4, and every "not reached" row).
