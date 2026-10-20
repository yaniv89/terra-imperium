# Playtest 4: running test log

Environment: the user's dev server at localhost:3000/terra-imperium (main checkout on claude/integration),
driven from a Playwright Chromium page (real GPU, `scripts/lib/browserLaunch.mjs` flags) at 844x390,
`isMobile` and `hasTouch` on, device scale 2, iPhone user agent, so `data-layout=phone-landscape`. Taps are
touch taps (`page.touchscreen.tap`) unless the row says "click". The build moved during the session:
claude/integration was 06602931 at turn 1 and e6745c9c at turn 300 (about 15 merges landed meanwhile,
among them ruler names RU0, fix-h01, fix-logic, ages-u1, stone art); each hot reload of the shared server
reloaded the page, so the session resumed through Continue about 20 times. From turn 273 the page blocked
the Vite hot-reload socket to stop those reloads.

Session 4: Kemet, Real Earth peoples world, Standard size, Normal speed, King (`difficultyId: king`,
multiplier 1.25), seed 1270408618. Play styles: peaceful expansion (T1-100), commanded defence (Nubt
T121), commanded assault (Amisus T122, Nubt T273), defensive war (Pontus T108-196, Akkad T164-182),
siege conquest (Nubt T265-273), diplomacy and trade (Garamantes, Pontus demand, map offers), deliberate bad
choices (Monarchy switch at T261, refusing every demand T162-290, a 0-production desert city), exploit
checks (siege-and-wait, rush buying), plus the playtest 3 "not tested" row: naval (Carrack built and
sailed), landing (army landed at Tel Aviv), vassals (looked for the action), saves (Export and Import).

Long stretches were played by an in-page scripted player (`audits/playtest-4/tools/autoplay.js`): it
answers what End Turn names through the same buttons a player taps (first event option, the research
advisor, a build from a fixed preference list, Auto for defences, Refuse or Pay for demands, Best site for
settlers) and taps End Turn. Turns 1-25, 25-40, 70, 100-122, 148-162, 201-206, 261-273 were played by hand.
Every dispatched action was counted by `installBrowserActionCounter` (scripts/campaignTelemetry.mjs).

Legend: PASS works as expected; FAIL defect; UX usability issue; NOTE observation; UNTESTED.
Screenshots: `audits/playtest-4/<name>.png` in the worktree (not committed, 47 MB).

| # | Turn | Area | Action | Result |
|---|---|---|---|---|
| 1 | - | Start | Home screen at 844x390 | PASS: Continue / New game / Load / Settings; language switch (00b-start-3000) |
| 2 | - | Start > People | Search "Kemet", pick | PASS (01-pick-kemet) |
| 3 | - | Start > World | Defaults | NOTE: Real Earth, Standard, Normal city states (02-world) |
| 4 | - | Start > Rules | Normal, King | PASS: King reads "AI +25% resources" (03-rules, 04-king) |
| 5 | - | Start > Ready | Summary, Begin | PASS (05b-ready) |
| 6 | 1 | Intro | 5-page intro, Start | PASS (06-t1, 07-after-intro) |
| 7 | 1 | Research | First pick card | PASS: 3 options with turns; picked Irrigation Canals (08, 09) |
| 8 | 1 | City > Build | Queue Scouts, Settlers, Granary | PASS: every row has its effect and turns ("Granary +1 food, +1 housing, 77 production, 11 turns"); compare playtest 3 H9 (Swordsmen 105 turns) (10, 11) |
| 9 | 1 | City > Build | First build times | NOTE: Scouts 4 t, Spearmen 10 t, Settlers 16 t, Granary 11 t, Palisade 20 t at 7 production |
| 10 | 1 | Page reload | Shared server reloaded the page | NOTE: Continue restored the game; queue intact (12-reloaded) |
| 11 | 1 | Map | Tap own city after Continue | FAIL: nothing opens; Cities list row tap also does nothing. `REGIONS_DATA` holds 54 of 81 cities until any action is dispatched (13, 14, 16, 18). Works after End Turn |
| 12 | 2 | City > Build | Rush Scouts | PASS: confirm card "Pay 76", 508 to 432 gold (22-rush) |
| 13 | 2 | City > Citizens | Buy a wheat tile shown 120g | PASS: 432 to 312, the price shown was charged (playtest 3 M18 fixed) (23-buyland) |
| 14 | 2 | City > Citizens | Read tiles | PASS: resource notes ("Wheat: a Farm here adds its bonus again") |
| 15 | 3 | Map > Army | Select scouts only, March, target | PASS: route preview "To ...: N turns, sets out at End Turn" (28-30) |
| 16 | 3 | Map > Army | Copy | UX: "it sets out at End Turn. , about 10 supplies" (stray ". ,") repeated on every march preview |
| 17 | 7-24 | Events | Great Flood, Merchants, Tin Trade, River Rises | NOTE: events fit the Nile; River Rises later repeats (T24, T48, T115, T150, T259, T297) |
| 18 | 25 | Contact | Met Garamantes and Kerma | PASS: contact card with Later / Open diplomacy (33) |
| 19 | 25 | Diplomacy | Garamantes sheet | PASS: each action shows "would accept / would refuse" and the cost (34) |
| 20 | 25 | Diplomacy > Why? | Opinion reasons | PASS: lines with reasons (35-why); playtest 3 L5 better |
| 21 | 25 | Diplomacy > Trade | Sign trade | PASS: "Signed a trade agreement", 100 gold (36) |
| 22 | 25 | Idle chip | "Idle 2", "Settlers wait" | PASS: one chip, taps cycle (37) |
| 23 | 25 | Settle | Best site, Go and found | PASS: green site, "Go and found city: 2 turns" (38, 39) |
| 24 | 25 | Army | Hold, Explore | PASS: scouts explore by themselves; Hold removes the idle count (41, 42) |
| 25 | 25 | Ruler | Log line | NOTE: "Hassan reigned 3 turns. Nadia now rules" - rulers change every 3 turns all game (25 changes in the last 800 log lines) |
| 26 | 49 | Event | "The Bronze Age Collapse" at 650 BCE | NOTE: fits the date this time |
| 27 | 70 | State | 4 cities, 944 gold, ADM 457 / DIP 486 / MIL 420 banked | NOTE |
| 28 | 70 | City | Iunu size 1 at 0 food, Waset production 1, Abdju production 1 | NOTE: many 1-production river and desert cities; Waset still 1.1 production at size 10 on T148 |
| 29 | 70 | City > Overview | Focus at size 6 | PASS: focus now changes the numbers (Food +15 / 5.3, Production +13 / 8.3); playtest 3 row 22 fixed |
| 30 | 70 | City > Build | Slow-build warning | PASS: "2 builds are slow here: over 20 turns at 8.3 production" (47) |
| 31 | 70 | City > Politics | Seat a governor, Quell unrest | PASS: costs and effects shown; unrest 70 to 40 (48) |
| 32 | 70 | Empire | Overview | PASS: Authority with reasons, era goals 1/2, treasury breakdown; NOTE: "Reign ends turn 73" (49) |
| 33 | 70 | Empire | Advisors | NOTE: advisors cost 50-450 gold; still the only steady pool sink |
| 34 | 100 | State | 4 cities, 2,316 gold, met 2 majors | NOTE |
| 35 | 100 | City > Build | Iunu list | PASS: no seagoing ship offered where the city has no coast; coastal Iunu offers Trireme, Longship, Bireme (playtest 3 M8 fixed) |
| 36 | 100 | City > Build | Queue 4 army units | PASS: "4 more queued" |
| 37 | 100 | City > Build | Rush settlers 197 | UX: the confirm opens above the scrolled view; the first tap on the price did nothing visible until scrolled up (53-55) |
| 38 | 104-108 | Rush | Rushed 3 units for 2,133 to 497 gold | PASS: rush is a real gold sink (about 400-960 gold a unit) |
| 39 | 108 | Map | Zoom out, find enemies | NOTE: nearest major city 921 km away; first contact with Akkad at T108 (57-61) |
| 40 | 108 | Map > March | Tap a city of a people at peace | PASS: "At peace with ...: declare war before attacking" (62, 64) |
| 41 | 108 | Diplomacy | Declare war on Pontus | UX: war declared on one tap, no confirm card (the button shows cost and "no cause for war") (65) |
| 42 | 108 | Map | March to attack Amisus | PASS: 21-tile route, all 4 units (66) |
| 43 | 121 | Defence card | Pontus attack Nubt | PASS: card shows both sides, Auto odds bar, Command / Auto (67) |
| 44 | 121 | Battle 1 (Command) | Defend Nubt | PASS: battle loads in about 25 s; tutorial tips; "All 5", Attack, 3x speed (68-75) |
| 45 | 121 | Battle 1 result | Victory, garrison repels | PASS: campaign units match the report (933, 939, 941, 265 strength); Pontus left with 21 and 510 |
| 46 | 122 | Defence card | Second Pontus attack on Nubt | PASS: Auto chosen, "Fight on Auto", result card (76-78) |
| 47 | 122 | Map offer chip | Siege of Amisus card | PASS: one card at a time, others wait as chips (79, 80) |
| 48 | 122 | Battle 2 (Command) | Assault Amisus | PASS: battle economy: villagers, gather, siege workshop (81-95) |
| 49 | 122 | Battle 2 > Build | Place a siege workshop | UX: green legal ground and "Good spot" now shown, but 4 tries: "Overlaps a building", "Too close to the edge", "On top of a resource" x2 (90-94); playtest 3 H6 improved, not fixed |
| 50 | 122 | Battle 2 > Build | After placing | FAIL (minor): the build menu reopens under the finger (95) |
| 51 | 122 | Battle 2 | Page reload mid-battle | PASS: Continue then "Finish the battle" resumed at tick 34,200 from the checkpoint (108) |
| 52 | 122 | Battle 2 | Squads after the last target fell | FAIL: all 3 trebuchets idle beside the walls; infantry bled from 881 to 0 standing "attackMove" with no target; playtest 3 H7 still open (99-106) |
| 53 | 122 | Battle 2 | Battle alerts | PASS: bell with "Gate breached", "Enemy swordsmen broke", Go buttons (100) |
| 54 | 122 | Battle 2 result | Time ran out | FAIL: banner "The campaign counted this battle again and reached a different end than your screen showed"; Repelled, 20,050 of 28,860 lost; Auto would win 15% (109) |
| 55 | 123 | Defence | Field battle at Amisus | PASS: card warns "Auto holds 0%. Badly outnumbered" before the choice (110); playtest 3 M11 fixed for defences |
| 56 | 123-131 | Siege of Nubt | Pontus siege engines only | FAIL: the same Auto battle 8 turns in a row with the same line "broke the defences ... has no foot or horse to take it. Fallen: 1,700 of yours, 1,640 of theirs" |
| 57 | 132 | Peace | Pontus offer | PASS: accepted |
| 58 | 148 | Settings | Read Menu | NOTE: 25 controls incl. English / Hebrew, Full screen, Fog, Old map drawing, battle default, Always Auto, sounds, Export / Import save, Cloud saves |
| 59 | 148 | Export save | Export | PASS: file terra-imperium-kemet-388.json, 2.46 MB, version 13 (113) |
| 60 | 150 | Import save | Import the T148 file at T150 | PASS: back to T148, 4,948 gold, map and chips restored (114) |
| 61 | 148 | Research | Gate | PASS: "Nothing can be researched yet: Banking Houses opens in 1000 CE, about 78 turns"; top bar "Waiting for 1000 CE" (142); playtest 3 M1 fixed. NOTE: 78 turns with nothing to research |
| 62 | 148 | City > Build | Carrack in Iunu, move to front | UX: the queue row has a move-to-front arrow (117) but it has no label (Buy and Remove rows do), so it was not found by name; MOVE_PRODUCTION by dispatch worked (115-117) |
| 63 | 151 | Naval | Carrack built | PASS: unit_571 at Iunu, capacity 4 |
| 64 | 151 | Demand | Pontus: stop settling near them | PASS: card with both outcomes, ratio 2.53, 2 turns to answer; Promise chosen (118) |
| 65 | 154 | Map | Tap the fleet in port | FAIL: the fleet badge sits on the city; taps open the city sheet; the fleet is reached only from the city sheet's unit list ("Sail...") (129-134) |
| 66 | 160 | Naval | Embark the army | FAIL: no embark button anywhere (no component dispatches EMBARK_UNIT); done by dispatch: 4 units aboard |
| 67 | 160 | Naval | Sail to a sea tile | PASS: "Sail", "1 turn", fleet moved with its cargo (135-137) |
| 68 | 162 | Landing | Disembark next to own coast | PASS by dispatch: 4 units ashore. Log: "A infantry unit disembarked at Tel Aviv." (grammar; modern place name in 526 CE) |
| 69 | 162 | Vassals | Look for Vassalize | NOTE: hidden in More actions unless military is 3x theirs; no disabled button with the reason |
| 70 | 162 | City CTA | "Choose production: Djedu" after a reload | FAIL: the CTA and the chip only centre the map; city never opens; End Turn blocked until a map offer was declined (any action) (139-141) |
| 71 | 164 | War | Akkad declares war | PASS (AI acts): Akkad stormed Zau (T171) and Nubt (T174) in 10 turns, then offered peace at T182 |
| 72 | 171-216 | Log | After Nubt and Zau fell | FAIL: "Nubt completes a Market", "Zau's borders grow" keep appearing in my log for cities I no longer own |
| 73 | 196 | Log | Raw ids | FAIL: "The Lac Viet Commonwealth attacks from c7102 toward c7026." and "That army has already moved or fought this turn." (an AI's refusal shown to me) every turn |
| 74 | 201 | Loyalty | Djedu flips to Pontus | NOTE: one log line "Djedu is losing its loyalty (21)" (742 CE, T196), then "Djedu has gone over to Kingdom of Pontus" (772 CE, T202); the turns between were played by the scripted player, so a chip may have shown |
| 75 | 201 | Map | End Turn at T201 | FAIL (Critical): GLMapView crashes "Cannot read properties of undefined (reading 'filter')" in allocateFresh via cityRailModel; app unmounts, page reloads, crash again on every load (144-149) |
| 76 | 201 | Diagnosis | fogView on the save | NOTE: Djedu (flipped to Pontus out of sight) is remembered as mine; the ghost record has `tiles: []` and no `locked`; cityRailModel runs cityLive on it at close zoom |
| 77 | 205 | Workaround | Settings key "Old map drawing" (svg) | PASS: the game loads and plays on the old map (150); rest of the session on the old map |
| 78 | 206 | AI | Raid party chips | PASS: "Raid party, in 2 turns" and "going home" chips on the map |
| 79 | 231 | Tribute | Libu demand | PASS: "7 gold a turn for 20 turns" with a 14,052 bank; Pay / Refuse and prepare / Refuse and hire mercenaries, each with its result (151); playtest 3 H2 fixed |
| 80 | 231 | Tribute | Refuse twice | NOTE: the scripted refusal first chose "Refuse and prepare" (a row), then the Refuse button |
| 81 | 260 | Upkeep log | Log sheet | PASS: upkeep folded to one line "103 turns so far" (177); playtest 3 L7 fixed |
| 82 | 261 | Government | Become a Monarchy | PASS: preview "Authority 35 to 19, no laws until it recovers", reforms per age, Cancel / Change government (152-154); playtest 3 M2 fixed |
| 83 | 261 | Units | Upgraded army | NOTE: "Field Cannon", "Musketeers" in 1126 CE; top bar "Waiting for 1500 CE" (157) |
| 84 | 261 | Diplomacy | Akkad at opinion -38 | FAIL: "Offer pact: Would accept" at -38 |
| 85 | 261 | Diplomacy | Declare war on Akkad (cause: claim on Djedu, Zau, Nubt) | FAIL: sheet shows "War exhaustion 56.830065359477146" (155); no confirm card |
| 86 | 261 | Map > Army | Army sheet buttons | FAIL: "Pillage the {name} (+20 gold)" placeholder in a button (164) |
| 87 | 265-273 | Siege-and-wait | Besiege Nubt 8 turns | PASS: walls 840 HP to 0 in 7 turns, then "A siege never takes a city: attack it to take it." (playtest 3 M12 fixed) |
| 88 | 273 | Assault card | Siege of Nubt | PASS: "Likely win" bar, walls 0%, houses, 300 a side, Command / Auto (165) |
| 89 | 273 | Battle 3 (Command) | Assault Nubt | NOTE: goal "Burn every enemy base building before the clock runs out" (166) |
| 90 | 273 | Battle 3 | Page reload at tick 8,031 | FAIL: Finish the battle restarted at tick 0 with full strength (169); about 7 minutes of battle lost (battle 2 resumed from a checkpoint) |
| 91 | 273 | Battle 3 | Second try, tick 0 to 36,000 | FAIL: after the field army fell, my 4 squads stood "idle" under the towers; re-sent Attack on the keep every 15 s; they went idle again and died (bwatch log); my screen ended with 0 squads, Base 1 vs 4 |
| 92 | 273 | Battle 3 result | Result screen | FAIL (Critical): "VICTORY, Nubt is conquered ... battle lasted 2 min 35 s", men lost 7,920 of 40,000, 4 regiments with XP, "The campaign counted this battle again and reached a different end than your screen showed" (172) |
| 93 | 273 | Capture card | Conquer / Raze / Make tributary / Free | PASS: each with its effect ("restless, control 25%, loyalty 50, cannot break away for 10 turns") (173, 174); playtest 3 H4b fixed |
| 94 | 287 | Conquest | Nubt 14 turns later | PASS: still mine, loyalty 35, control 77 (playtest 3 H4 better) |
| 95 | 298 | Event | The Black Death | NOTE: 1348-1360 CE; fits the date |
| 96 | 300 | State | Final | NOTE: 13 cities, 29th of 36 by cities (top: Mapungubwe 41), 28,521 gold, ADM 1,700 / DIP 2,040 / MIL 1,824, Age of Kingdoms, Monarchy (175) |
| 97 | 300 | Legacy tab | Read | NOTE: achievements and difficulty only, no score (176) |
| 98 | 300 | Log | Rebellions in unknown lands | UX: "Rebellion breaks out in Hopewell Works" and 3 more in the crisis filter (110 crisis lines) (177) |
| 99 | 300 | Log sheet | Tap Cities while the log is open | UX: the log stays; End Turn and the Idle chip draw over the log sheet (177, 178) |
| 100 | 1-300 | Turn time | Browser, shared server | NOTE: 200-260 ms a turn to T100, 400-900 ms T150-300 (scripted runs); battle load 20-30 s |
| 101 | 1-300 | Headless | Scripted telemetry player, 300 turns, seed 4 | NOTE: 0.28 s a turn; 11 cities; gold 15,774; first unit T144; second city T29; 12 wars between majors, 4.4 battles per war; AI war move rate 0.62; 52% of war stacks idle at home (`audits/playtest-4/data/scripted300-seed4.json`) |
| 102 | - | Not tested | Cloud saves (account), real finger gestures, sound, globe, portrait rotate screen, amphibious assault on an enemy coast, vassalize (never eligible) | UNTESTED |
