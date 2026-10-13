# Playtest 3 audit: running test log

Environment: localhost:3000/terra-imperium (claude/integration, same as live), built-in Chromium,
viewport 844x340 (iPhone landscape 844x390 minus Safari bars), `data-layout=phone-landscape`,
touch not emulated (taps arrive as mouse clicks). Earlier sessions: plans/playtest-2-report.md
(session 1 desktop Akkad marathon 154 turns + sandbox battle; session 2 phone Akkad marathon 200 turns).

Session 3: Kemet (Egypt), Real Earth, Standard, Normal speed, King. Style: aggressive expansion and
military, diplomacy, exploits, deliberate bad decisions, edge cases.

Legend: PASS works as expected; FAIL defect; UX usability issue; NOTE observation; UNTESTED.

| # | Turn | Area | Action | Result |
|---|---|---|---|---|
| 1 | old T200 | Settings | Read all controls (22) | NOTE: Globe view, Fog explored (disabled), Old map drawing, Clear cached worlds (disabled, 0 worlds), battle default mode, Always Auto for defences, Instant AI battles, Battle size, sound x5, Performance overlay, Warn before End Turn, Copy turn log, Export/Import save, Cloud saves, New game. No in-game save/load slots |
| 2 | old T200 | Settings | Layout at 844x340 | UX: two section headers both called "Map"; panel needs scrolling; switches readable |
| 3 | old T200 | Settings > Globe view | Toggle on, close | PASS: globe renders, Globe/Map switch appears top right |
| 4 | old T200 | Globe | Look at unexplored lands | FAIL (probable): globe shows peoples' territories in Europe/Africa never explored (fog not applied on globe) |
| 5 | old T200 | Globe/Map switch | Tap Map | PASS: back to flat map; switch stays on screen while the setting is on |
| 6 | old T200 | Map prompts | "Choose research" chip while a tech is researching (Provincial Administration 18t) | FAIL: misleading prompt |
| 7 | old T200 | Map at full zoom-out | Labels | UX: city badges, names and "Raid party" labels overlap into a pile |
| 8 | old T200 | Settings > Performance overlay | Toggle on | PASS (battle-only, as labelled) |
| 9 | old T200 | Settings > Copy turn log | Tap | PASS: "Turn log copied"; text starts with user agent and worker ping lines |
| 10 | old T200 | Settings > Cloud saves | Tap | NOTE: email/password sign-in sheet; not signed in (no account creation by policy) = UNTESTED beyond the form |
| 11 | - | Settings > Export/Import save | - | UNTESTED: export downloads a file (needs user OK); import needs a file picker |
| 12 | - | Menu > New game | Tap | PASS: native browser confirm "Reset game? All progress will be lost." then start screen. UX: native dialog style breaks the game look |
| 13 | - | Start > Search | "Egypt", "Kemet", "Cairo", "xyzzy" | PASS for people and modern country; FAIL-ish: placeholder promises capitals but searches the game's capital names only ("Cairo" 0, Men-nefer works); empty state "No people matches your search." PASS |
| 14 | - | Start > Random | 3 taps | PASS: Akkad, Funan, Illyria |
| 15 | - | Start > region chips | View at 844px | UX: chip row overflows (Oceania cut) with no scroll hint |
| 16 | - | Start > step 4 button | Jump from step 1 | PASS |
| 17 | - | Start > Ready > Change (difficulty) | Tap | PASS: jumps to Rules |
| 18 | - | Start > King | Read | NOTE: "AI nations get +25% resources and are more aggressive" (difficulty = bonuses) |
| 19 | - | Start > Enter key | Enter on Rules, Enter on Ready | PASS: next step, then begins |
| 20 | 1 | Research choice | 3 options shown, 23 turns each on Normal | NOTE: Normal pace much better than Marathon (58 turns) |
| 21 | 1 | End Turn CTA | "Choose production: Men-..." | UX: CTA truncates the city name |
| 22 | 1 | City > Overview focus | Food/Gold/Balanced/Production at size 2 | NOTE: identical yields 4/7/10/3 at size 2 (no visible effect, no explanation) |
| 23 | 1 | City > Build | Tap Spearmen arrow 5x fast | FAIL: list reflows under the finger; queued Spearmen, Chariots, Settlers (3 items, 2 taps lost, 2 wrong items) |
| 24 | 11 | Peoples panel | Open with Jerusalem visible next to my army | NOTE: "0 met"; UX: panel covers ~75% of the screen, End Turn jumps to the left over the Political button |
| 25 | 11 | Map labels | Jerusalem (independent) | UX: an independent city's label looks like a major's (same green badge style); only the owner check revealed "free city of Jerusalem" |
| 26 | 11 | Army sheet | Army in Sinai | FAIL: header says "Army at Men-nefer ... based at Men-nefer" while the army is in Sinai (repeat of session 1/2 bug) |
| 27 | 11 | March to attack | Tap Jerusalem with army selected | PASS: "Attack Jerusalem: march 2 turns, then the assault" (no war needed vs independent) |
| 28 | 15 | March arrival | Pre-battle card opens on arrival | PASS: Siege of Jerusalem card, odds "Unlikely", 788 vs 3,380-5,060 |
| 29 | 15 | Pre-battle close (X) | Call off | PASS: closed; NOTE: army stays parked and the city shows a siege bar (army besieges on its own) |
| 30 | 15 | March banner | Army at Jerusalem | FAIL: banner says "march to from Men-nefer" (wrong origin label); route preview itself is correct (4 turns) |
| 31 | 15 | Map labels vs HUD | Men-nefer label under the World button | UX: city label hidden behind the bottom-left map buttons |
| 32 | ~20 | "Army idle" chip | Tap while the army is marching home | FAIL: chip opened the marching army (it was not idle) |
| 33 | ~20 | Unit data | Read both units' regionId (army at Jerusalem, spearmen at home) | FAIL: both report c85418 (Men-nefer). Root cause of the wrong "Army at Men-nefer" labels (tile marches never update regionId) |
| 34 | ~20 | City card (Men-nefer) | Units "here" | FAIL: lists the far-away army as here; one March button moves the whole stack, no per-unit split |
| 35 | ~30 | Events | Bronze Age Collapse on Normal around T30 | NOTE: very early for a collapse; heavy for a 1-city start |
| 36 | 12-51 | Independents | Tribute demands paid T12, T47, T51 | NOTE: demands repeat; paying is the only shown option that is clearly safe |
| 37 | ~45 | Settling lens | Tap a red site, then a second site | UX: the green/red lens vanishes after the first tap; must reopen Settlers wait |
| 38 | ~45 | Site sheet | "Go and found city" | UX: main button below the fold at 844x340, needs a scroll |
| 39 | ~45 | Site sheet | Several sites near Adumattu | UX: "Too close to Adumattu" on most taps, no hint where the nearest legal site is |
| 40 | 49 | Founding | Settler founds at the chosen site | PASS: city appears (named Iunu, not the site name shown, small surprise) |
| 41 | 66 | Empire > Advisors | Hire first advisor, then second | NOTE: first hire 200 gold, second 50; Seat advisor free. Costs not explained up front |
| 42 | 66 | Research > Fund Scholars | Tap | PASS: -100 gold; effect on turns not shown before paying |
| 43 | 66 | Research > Boosts > "Map" (Build a road) | Tap | UX: nothing visible happens; the panel stays open. After closing it, the map had moved to Hegra and switched to the Supply lens with no highlighted road spot |
| 44 | 66 | Settlers wait chip with Supply lens on | Tap | FAIL: opens a plain tile sheet, no settle lens. Turning the lens off (X) fixed it: one lens silently blocks the other |
| 45 | 66 | Settling lens | Look for green sites | UX: all sites near my cities are red; legal sites (engine bestSites: 8 sites 6-9 steps) sit off-screen south and behind the left sheet. No "next good site" button |
| 46 | 66 | Site sheet | Desert site with Oil | NOTE: Oil shown as a resource in 596 BCE; site sheet shows "Nearest city Iunu, 277 km" although the spacing rule is 306 km (probable: one ring less rule, not explained) |
| 47 | 66 | Go and found city | Tap | PASS: "Settlers arrive in 2 turns, then found" with Cancel. Founded Abdju T68 |
| 48 | 66 | City card (Men-nefer) | Units list | UX: settler listed like a soldier (Recruit, 100/100, MOR 100, SUP 100) |
| 49 | 66 | City card | Buildings | NOTE: capital has 0/4 buildings at T66; Iunu +1 production a turn, every build 80-170 turns. Partly my helper's picks, but the game never warned that a city builds Swordsmen in 105 turns |
| 50 | 66 | City > Overview focus Production (size 1) | Tap | FAIL-ish: +1 production stays +1; no feedback why |
| 51 | 66 | City > Build list | Read | UX: identical rows ("Fishing boats on coast" x7, "Farm on desert, floodplain, river" x2) with no tile shown; inland river city Iunu offers Trireme, Longship, Bireme (confirms user claim) |
| 52 | 66 | Queue | Remove item | PASS, but progress lost (2/107); no reorder, no "move to front", no buy/hurry button anywhere |
| 53 | 66 | Queue add | Tap + | UX: no toast or scroll to the queue; the queue is off-screen at the top, so there is no sign the tap worked |
| 54 | 66 | All city tabs | Search for gold purchases | NOTE: only "Buy land" (Citizens tab, 108-120g a tile). User's claim "you can buy population and production" = NOT FOUND in UI (Develop Tax costs ADM, not gold) |
| 55 | 66 | Buy land (Iron, label 120g) | Tap | PASS: tile joins Waset and the citizen moves to it. FAIL (probable): gold went 739 to 604 (135, not 120). Prices rise after each buy (108 to 114, 120 to 123). Iron tile yields 0/3/0 like a plain hill, an "Iron Ring 3" row is still listed |
| 56 | 66 | Citizens tab | Read | NOTE: Waset (hills, coast) has 0 food surplus; it can never grow without fishing boats. Bad founding site, the lens let me pick it |
| 57 | 79 | Defence (auto) | Libu sack of Iunu | NOTE: first raid, 1,000 infantry vs 200 militia, city sacked. Correction after seeing the card: numbers are men (strength x10), consistent. UX: card says "ROUTED!" and the attacker won the sack, yet the headline is "Iunu held, but its walls are damaged" (Iunu has no walls). Three layers open at once at 844x340: result card over a First contact card over a side panel |
| 58 | 80 | Battle report > Full report > View replay | Tap | PASS: bar replay, round 1 of 1, Tap to skip. NOTE: an auto battle is one round, nothing to watch |
| 59 | 80 | First contact card (D'mt) > Open diplomacy | Tap | PASS: opens Peoples on D'mt. NOTE: only 1 major met by T80 (34 unmet) |
| 60 | 80 | Opinion "Why?" | Tap | UX: expands to one line "Standing +8", no reason behind it |
| 61 | 80 | Diplomacy > Trade | Tap | PASS: -100 gold, opinion +5 (trade line), status FRIENDLY, chip "Trade agreement". No confirmation step |
| 62 | 80 | More actions | Read | NOTE: fabricate claim, open borders, stop settling, gift, espionage, insult, rival, assign diplomat. No map or intel trade (user request confirmed missing) |
| 63 | 80 | Assign diplomat | Tap | PASS: -5 DIP. NOTE: the bank holds ADM 537, DIP 505, MIL 492 at T80; actions cost 1-16, so the points pile up with nothing to spend them on (supports "data without effect") |
| 64 | 80 | Resources | iron 0, copper 0 | NOTE: owning (buying) an Iron tile gives no iron; needs a mine, not said in the buy row |
| 65 | 80 | Libu (raiders) panel | Read | FAIL (logic): after Libu sacked Iunu, Libu's grudge against me rose +20 "Killed their soldiers, T79" (my militia defending). Attitude still "Warm +16" (kin +10, culture +10) while they raid me. "Pay tribute 3 gold a turn, no raids" is a trivial price for full safety (balance) |
| 67 | 84 | Turn report | Read | NOTE: "Rebels plunder your land trade route to D'mt: no trade this turn" at T83, rebels exist without any warning of unrest in my cities |
| 68 | 84 | Cities tab | Read | NOTE: Abdju is an "outpost, growing into a city" (settler made an outpost, the site sheet said "found city") |
| 69 | 84 | Settle lens at normal zoom | Find green | UX: green and red are faint at strategic zoom; the lens does not centre on the settler |
| 70 | 87 | Founding on an iron hill | Go | PASS: Nekhen founded T88 |
| 71 | 90-100 | AI expansion | Kanesh (Anatolia) | NOTE: Kanesh founded Durhumit T90 in Sinai on tile 82324, one of my own best sites and ~1,000 km from Kanesh. Then its first-contact card says "Your scouts crossed into their land" (I have no scouts; they came to me) |
| 72 | 100 | Helper paid Kanesh 219 gold tribute (T~88) | - | NOTE: a far major demands tribute through the Empire tab; opinion of me -69 even after I paid |
| 73 | 100 | Event "Refugees at the Border" | Take them in | PASS (+1 size Iunu). UX at 844x340: the event text sits in a narrow scrolling column, options below the fold |
| 74 | 100 | March from city card > tap a moving raid party | Tap | FAIL/UX: there is no "attack this army"; tapping the raiders' tile gives "To open country: 3 turns, about 4.5 supplies" |
| 75 | 100 | March to attack Siwa | Tap Siwa | PASS: "Attack Siwa: march 4 turns, then the assault", route drawn. NOTE: no supplies estimate on the attack route (open country route had one) |
| 76 | 100 | Research | Read | NOTE: techs are date gated ("Available from 150 BCE: science banks until then", Stone Bridges 500 CE, Postal Relay 1000 CE). You cannot out-tech history. "Choose research" chip shows while Aqueducts is current (repeat of row 6) |
| 78 | 100 | Research > Let my advisor pick | Toggle | PASS: chip gone |
| 79 | 104 | Arrival at Siwa | Pre-battle card + Kanesh tribute demand same turn | FAIL (UX, severe): the demand opened the Peoples panel and squeezed the Siege of Siwa card into a ~170 px column: one word per line ("You / lead / 300 / a / side"), sideways scrollbar, Begin battle cut off |
| 80 | 104 | Kanesh second demand (246 gold, 16 turns after the first) | Refuse | PASS: opinion -67 to -72. NOTE: paying the first one bought nothing |
| 81 | 104 | Siege card | Disappeared after the Refuse tap | FAIL: the pre-battle card closed without a choice; only "Army idle" remained |
| 82 | 104 | Army sheet at Siwa | Read | FAIL (repeat): "Army at Men-nefer ... based at Men-nefer" while besieging Siwa. FAIL: Libu panel says Siwa "no walls", army sheet says "walls 215/260" (walls HP vs wall level, two different words for the same thing) |
| 83 | 104 | "Army idle" chip on a besieging army | Tap | UX: a besieging army counts as idle |
| 84 | 108 | Event "A Harsh Winter" in Abdju (Upper Egypt) | Open granaries | NOTE: setting mismatch, harsh winter on the Nile |
| 85 | 108 | Gold chip in top bar | Tap | PASS: income breakdown (income +78, upkeep -25, advisors -10). UX: "All your stores" is 10 numbers with icons and no labels; the popover stays open over the army sheet |
| 86 | 108 | Siege of Siwa | Wait 5 turns | NOTE (balance): Siwa (3,975 defenders) surrendered to my 3,000 when walls hit 0. +400 gold treasury, no battle, no losses. Siege-and-wait beats every assault; the garrison never sallied |
| 87 | 108 | Siwa capture feedback | - | UX: no card for the capture itself; I only saw it as "Army at Siwa ... in your land" and in the Log |
| 88 | 108 | Refusing Kanesh's tribute | Consequence | NOTE: a few turns later the top bar shows "AT WAR: KANESH" with no war-declared card I noticed (refusal does have teeth with majors, unlike independents) |
| 89 | 117 | Event "Refugees at the Border" | Second time (T100 Iunu, T117 Abdju) | NOTE: repeated event within 17 turns. Centered event card is readable here (good) |
| 90 | 118 | Arrival at Cyrene | Pre-battle card | NOTE: my run loop closed the card on arrival in an earlier turn; the army just waited. A real player who taps the X loses the card too: reopening needs the army sheet |
| 91 | 118 | Siege of Cyrene card (full width) | Read | PASS: yours 3,000, theirs 2,700-4,040, "Unlikely", walls Palisade HP 54%, 13 houses, 50% rule, Command/Auto, "About 30 minutes" |
| 92 | 118 | Command > Begin battle | Load | PASS: "Mustering the troops" then deploy in ~5 s, 100-118 fps. UX: the field is dark and the deploy text sits under the perf overlay (my setting) |
| 93 | 118 | Battle camera | Pan with mouse drag / wheel at cursor | NOTE: mouse left-drag is a lasso; wheel zooms to the centre only. Touch drag pans (code), not testable with my tool; I moved the camera with the same pan call a finger uses. "Keep 54%" button centres on the keep (PASS, slow to show) |
| 94 | 118 | Base > Train Laborer x2 | Tap | PASS (queued, "training 1, 1 more"). UX: no cost deducted until it starts, no toast |
| 95 | 118 | Laborer > Build menu | First open | FAIL (minor): most building icons blank on first open, they appear on the second open |
| 96 | 118 | Build Barracks | Tap ghost spots | FAIL (UX): a valid tap places the building at once with no "Build here" step, then the build menu reopens under the finger; my next tap armed another Barracks. Panel kept saying "On top of a resource" after the range was already placed |
| 97 | 118 | Build panel "Stop" | Tap to close the menu | FAIL (UX): "Stop" stops the laborer, both sites froze at 36% and 40%; the menu stayed open |
| 98 | 118 | Laborer + tap a site (mouse) | Assign builder | UX: left tap selects the building instead; right-click works. On a phone this depends on tap-order rules that are not explained |
| 99 | 118 | Archery range > 5 Composite Archers | Train | PASS: trained in ~20 s at 3x. NOTE: battle-trained squads are 200 strong (a macro unit is 1,000) |
| 100 | 118 | Attack order on the keep, all 8 squads | Tap Attack then keep | FAIL (feel): cavalry outran the column, hit the wall alone and died (68 then 0 strength, morale 0) before the infantry arrived; no group pace |
| 101 | 118 | Move order (right-click open ground near the wall) | Pull back | FAIL: squads stayed idle under the towers |
| 102 | 118 | Towers vs archers | Watch | NOTE (balance): two towers (538 HP each) shredded 5 archer squads in ~20 s; gate fell to 0 but only 1 infantry (346) was left |
| 103 | 118 | Retreat button with survivors | Tap | FAIL (repeat of session 1): Retreat ends the whole battle as Defeat, and the result counts "3000 of 3000 lost, 3 regiments destroyed" though one squad was alive. "Auto wins this battle 0% of the time" shown only after the fight; the pre-battle card said only "Unlikely" |
| 104 | 119-140 | Economy | Gold 3,535 (+98), ADM 1,057, DIP 962, MIL 828 at T140 | NOTE (balance): every currency piles up. Gold sinks: advisors (50-450), buy land, Fund Scholars; ADM sinks: laws 100-250, government 300. None of them scale with a 3,500 bank |
| 105 | 140 | Research | Top bar "Choose research" | FAIL (UX): "Let my advisor pick" was on, yet "Nothing under way"; science is banked (209), not lost, but the advisor does not pick when every next tech is date gated. I picked Feudal Levies: panel and top bar say "1 turn" while the red line below says "Available from 500 CE" (it is 292 CE, ~17 turns away). The turn count ignores the gate |
| 106 | 140 | Empire > Overview | Read | UX: the section headers (Government, Laws, National Identity, Treasury) are collapsible text rows, not buttons; screen readers and find see them as plain text. Opening one collapses another |
| 107 | 140 | Government > Become a Monarchy (300 ADM) | Tap | FAIL (trap): applied at once, no confirm. The card warns "-2 stability" only. Real effect: Authority 33 to 17 (stability -16 in the breakdown), which locks all laws: "Too low for new laws. Under 25: no new laws." Reforms picked automatically (despotic rule, feudal nobility) without asking |
| 108 | 140 | Laws | Read | UX: law names show only cost (e.g. "Land Tax (100 ADM)"); only Land shows an effect ("+0.1% pop growth"). No effects, no comparison |
| 109 | 140 | Map at 844x340 with Empire open | Screenshot | UX: Empire sheet takes half the screen; three stacked chips (can build, army idle, low supply) plus the CTA cover the other half; raid labels "Raid target: the land of Iunu (Iunu)" and "Raid party 9t" overlap city names |
| 110 | 165 | Turn report at 844x340 | Screenshot | UX: five layers at once: city card, Peoples panel, turn report, "A new era dawns" banner and the production CTA. The era banner then sat over the top bar (gold, research) for 5+ turns until closed |
| 111 | 165 | Peoples | Count | NOTE: still 2 majors met at T165 (33 unmet). Without explorers the diplomacy layer stays empty all game |
| 112 | 140-164 | Turn reports | Rebels | NOTE: "Rebels plunder your land trade route to D'mt" repeats; rebellions in many foreign cities every report |
| 113 | 170 | Units after the Cyrene battle | Check | FAIL (state): the battle result said "3,000 of 3,000 lost, 3 regiments destroyed", yet unit_153 cavalry still exists at Cyrene with 627 strength and supply 0, 50 turns later, still showing "Army idle" and "Army low on supply". The commanded Cyrene battle is missing from battle reports (latest report is still T79 Sack of Iunu) |
| 114 | 170 | Legacy tab | Read | PASS: era goals (Kingdoms 1/2), achievements list, difficulty for next game. UX: achievements have no progress bars |
| 115 | 170 | Log tab | Open, filter Crisis | PASS: 1,075 entries, filters (Action 502, Event 36, Combat 117, Milestone 69, Crisis 237, Tech 66, Diplomacy 48). UX: only ~4 lines visible at 844x340; a per-turn "Upkeep" line floods Action |
| 116 | 83-170 | Trade agreement with D'mt | Log | FAIL (balance/feedback): "Rebels plunder your land trade route to D'mt: no trade this turn" 90 times, every turn since ~T83. The agreement I paid 100 gold for has paid nothing for 87 turns; no warning, no fix offered (guard the route? where are the rebels?) |
| 117 | 170 | "Achievement unlocked: Dynasty" | Read | NOTE: Dynasty = 10 rulers of one house. 10 rulers in 170 turns (~17 turns a reign), and ruler changes are not written to the Log at all |
| 118 | 170 | Era banner "A new era dawns" | X | PASS closes it. UX: it blocked the top bar for 5 turns because nothing else dismisses it |
| 119 | 170 | Army sheet (cavalry at Cyrene) | Read | FAIL: "Supply 0/100 (0 turns left)" next to "a supply line from your border feeds this stack at half cost"; the unit sat at 0 supply for ~50 turns and never starved further or died |
| 120 | 170 | March > "Move now" (new button next to March) | Tap | PASS: unit moves this turn (answers the user's "march starts next turn" point). FAIL (probable): preview said "To Siwa: 2 turns", the unit arrived in Siwa immediately |
| 121 | 172 | AI activity census (state) | Count | NOTE (AI): 35 majors own 321 cities (262 founded during play; leaders van_lang 18, kanesh 17, rasenna 17) vs my 6. Majors have 330 units: 32 moved last turn (10%), 36 outside a city; Kanesh 26 units, 0 moved, 0 outside, though it fought me T~108-125. 2 majors at war. World log in 172 turns: 13 wars declared, 14 peaces, 11 sieges, 15 raids/sacks, 144 uprisings. Independents: 84 one-city peoples, 336 units, 23 moving. Verdict: AI expands well, its armies stand still |
| 122 | 176-186 | Kanesh tribute demands | 3rd and 4th demand | NOTE (AI/balance): demands grow with my treasury (219, 246, 1,125, 1,239 gold) and come every ~10 turns once I am rich; opinion stays -36 after paying 1,125 |
| 123 | 186 | Kanesh demand of 1,239 | Paid | FAIL (logic): the log, same year 664 CE: "declared war on Kingdom of Kemet!" and "You pay The Kaneshite Empire 1239 gold in tribute." Paying did not stop the war. The Kanesh card then shows a green "Peace treaty" chip next to the red AT WAR badge |
| 124 | 186-200 | Kanesh war | Watch 14 turns | NOTE (AI): all 30 Kanesh units piled into Durhumit (size 2 colony next to Waset, 15 visible); none attacked my 4 units or 8 cities. Then T~199 "as worn out by the war as you are, offers a white peace" with zero battles fought |
| 125 | 186 | Kanesh took Jerusalem | Map | NOTE: the free city of Jerusalem is now Kanesh's (red); Ugarit, Kussara too. Kanesh is the only AI that projects power here |
| 126 | 176-186 | Settling the last sites | Lens | FAIL (UX): two 0 food / 0 production / 0 gold desert sites offered as "Chosen site" with no warning (I founded Nubt and Zau on purpose). Engine's own best remaining sites score 9-15 vs 27 at T66: the land is full by T170, but Men-nefer kept offering Settlers |
| 127 | 192 | Top bar research | "Plate Armor 1t" | FAIL (repeat of 105): shows "1t" for 20+ turns while the tech waits for its date |
| 113b | 200 | Correction to row 113 | Battle reports | The Cyrene battle IS in the reports (T118, defender won); I read the wrong end of the list. The ghost cavalry stands |
| 128 | 220 | Buildings tab (Siwa) | Read, tap rows | UX: one row per category (Granary, next Irrigation 96); tapping a row shows nothing; no building says what it does. Harbor row in inland Siwa ("needs a coast") still has a queue + button |
| 129 | 220 | Infrastructure (80 g), Defenses (60 g), Develop x3 (123 ADM/DIP/MIL) in 6 cities | Tap | PASS: all applied (Siwa dev production 17 to 18, infra 1, def 1). NOTE (balance): spending in all 6 cities moved gold 9,969 to 9,129; sinks are tiny next to the bank |
| 130 | 220 | Build tab, same unit twice fast | Tap Longbowmen x2, Knights x2 | FAIL (repeat of row 23): second tap of the same row lost every time (list reflows) |
| 131 | 232 | Opening a city from the Cities list | Map | UX: the map does not centre on the chosen city (Siwa opened while the map showed the Nile far south) |
| 132 | 236 | Map at strategic zoom | Tap Kerma's big icon in march mode | FAIL (UX): nothing happens; it works only after zooming in. One wheel step zooms in very far |
| 133 | 244 | Siege of Kerma card | Read | NOTE: my units read "Musketeers x4, Riflemen, Dragoons" in 1024 CE (anachronistic names vs Pikemen/Knights for the enemy) |
| 134 | 244 | Command battle load | Time | NOTE: ~20 s to the deploy screen (first battle ~5 s); green farmland in Nubia |
| 135 | 244 | Camp name | Read | NOTE: "Expedition camp" in battle 1, "Headquarters tent" in battle 2, no explanation |
| 136 | 244 | Build menu first open | Look | FAIL (repeat of 95): icons blank on first open again |
| 137 | 244 | Place Farm on open grass | Tap | UX: "Too close to the edge of the field" on visible open land; the playable edge is not drawn |
| 138 | - | User suggestion | Idle notifications | IDEA (user): stack the idle-unit notifications into one "Idle N" chip; each tap selects the next idle unit (map chips and battle "Idle 1" button alike) |
| 139 | - | User suggestion | Hold order | IDEA (user): a "Hold" action for map units: stays put (garrison, siege, guard) and is not counted as idle. Ties to row 83 (besieging army shown as idle) |
| 140 | 244 | Place Barracks in battle 2 | 6 spots tried | FAIL (UX): "Too close to the edge" (twice), "Too close to another building", then "On top of a resource" three times on grass that looks open. Resource nodes (herd, gold, ore, stone, cattle) are small and blend into the ground; no grid or footprint preview of legal ground. On a phone this is a guessing game |
| 141 | 244 | Battle HUD at 844x340 | Screenshot | UX: the "Defender housing / 50% rule" panel stays open top-right (~30% of the screen) all battle and is not what you need mid-fight; alerts stack top-left ("Musketeers shaken", "Enemy knights broke", "8 older alerts"); bottom has All/Base left and Attack/Hold/Line/Retreat + Rally Cry right. The field you actually play is a strip in the middle |
| 142 | 244 | Build placement feedback | Musketry yard | FAIL (UX): the ghost stuck on the camp ("Overlaps a building") and ignored my taps; "Build here" disabled with no reason shown in the panel |
| 143 | 244 | Hover detail on build tiles | Mouse hover | PASS: "Village house, HP 400, 2x2, 15 s, +10 housing". Phones get this only with "hold a tile", which the header mentions in small text |
| 144 | 244 | Barracks > 7 Musketeers | Train | PASS: queued 7, all trained in ~40 s at 3x |
| 145 | 244 | Move to staging point (right-click) | 12 squads | PASS: they formed a line and waited (good, unlike battle 1). Cavalry did not move: it was the "second wave" off the field |
| 146 | 244 | Attack the near tower | All squads | NOTE (balance): the tower fell and enemy knights broke, but all 7 new 200-strength musketeer squads and one 1,000 regiment died. Battle-trained squads are paper |
| 147 | 244 | After the tower fell | Watch | FAIL (feel): every squad went idle in the middle of the enemy counterattack; no auto-engage of units in reach |
| 148 | 244 | Second wave (cavalry) | Look for a way to call it | FAIL: "Reserve 1" button seen at deploy disappeared; the cavalry never entered while 12 squads died beside its entry point. "1 more join in a second wave" has no trigger I could find |
| 149 | 244 | Selection count | "All 12" became "All 5" | UX: dead squads drop from the count without any casualty summary; you learn about losses only from that number |
| 150 | 244 | My own play (user caught it) | Siege units | NOTE: I attacked walls/towers with infantry in both battles instead of bringing a Trebuchet from the map or building the Gun foundry. The game never hints "bring siege" on the pre-battle card even with towers 2/2 |
| 151 | 244 | Selecting my building | Tap where my barracks should be | FAIL (UX): the camera had moved; I opened the ENEMY barracks ("Destroy it for a quarter of its price in gold"); no visual difference between own and enemy buildings at a glance |
| 152 | 244 | "Reserve 1" button | Tap | PASS: brings the second-wave cavalry onto the field. UX: it showed only now and then (hidden during most of the battle) |
| 153 | 244 | Gun foundry > 3 Field Cannon (120 mat, 60 gold) | Build + train | PASS: placed first try, trained in ~30 s |
| 154 | 244 | "All N" button | Tap | FAIL (UX): it also moves the camera to the army, so the next tap lands somewhere else. Several of my orders silently failed because of this |
| 155 | 244 | Attack button then tap a structure | Order | FAIL (UX): sometimes no order is given and no feedback says why; right-click (desktop) works every time |
| 156 | 244 | Cannons + 12 musketeers on the last tower | Attack | PASS: tower fell fast, enemy pikemen broke, every enemy squad routed |
| 157 | 244 | Battle end | Victory | PASS: battle ended when all defenders routed (keep still 1,243 HP), 24 min 4 s. "Yours 5,647 of 6,000, 5 regiments destroyed; theirs 6,733 of 7,720". Loot 65 gold. "Auto wins this battle 38% of the time" (again shown only afterwards). Dragoons +31 XP. NOTE: units trained inside the battle vanish after it (not carried to the map) |
| 158 | 244-245 | Campaign result of the Kerma Victory | Map, log, battle report | FAIL (CRITICAL): the battle screen said VICTORY (all defenders routed), but the campaign recorded outcome "defender", captured false; Log: "Siege of Kerma: Your invasion on Kerma was repelled." Kerma stays Kerman. Report fallen 48,760 / 50,660 vs result screen 5,647 / 6,733. Survivors on the map: two infantry at 53 and 71, while my cavalry shows 1,000 (it ended the battle at 355). The 24-minute fight bought nothing |
| 159 | 244 | First contact | Akkad | NOTE: met the 3rd major (Akkad) only at T244 |
| 160 | - | User decision | "50% rule" text | CUT (user): remove "at most N houses can be lost (the 50% rule)" from the pre-battle card, the in-battle Defender housing panel and the result screen. Unneeded information |
| 161 | 245-254 | Kerma | Owner | NOTE: Kerma (size 10) became mine by T254 without another battle (siege surrender after the "repelled" record); no capture card noticed |
| 162 | 254-260 | Tribute demands | Kanesh 2,818; D'mt 2,370 | NOTE: even D'mt (Friendly, trade agreement, diplomat assigned) demands 2,370 gold. Demands scale with my bank and come from everyone |
| 163 | 252-262 | Kerma after capture | Log | NOTE (balance): surrendered 1072 CE (+400 gold), rebellion 1096 CE (4 turns), loyalty 25 warning in the Log only, uprising succeeds 1132 CE: "The Kerman horde rises again!", rebellion again 1186. A conquered raider city is lost within ~10 turns unless garrisoned; nothing on the map or a card told me |
| 164 | 260-276 | Tribute | Kanesh 2,360, D'mt 2,009, Kanesh 2,084 | NOTE: a demand every ~5 turns now; gold 14,091 at T254 down to ~8,300-8,900 |
| 165 | 108, 244, 252 | After Siwa surrender, Kerma Victory, Kerma surrender | Look for a choice | FAIL (missing): no "Conquer / Raze / Make tributary / Free it" choice was offered at any point. Cities simply changed owner (or, for the Kerma Victory, did not). Razing exists in code (razing.js) but was never offered to me (user note) |
| 66 | 80 | Libu panel | Last raid line | NOTE: "the city shrinks to 1" but the same turn report says "Iunu grew to size 2" and Iunu is size 2 now |
