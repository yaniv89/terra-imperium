# Playtest 4: full audit and re-scored baseline (phone landscape, 300 turns as Kemet)

Date: 2026-10-20. Unit U1 of `plans/2026-10-20-002-feat-differentiation-plan.md` (R1, R33). Build:
claude/integration on the user's dev server (localhost:3000), 06602931 at turn 1 to e6745c9c at turn 300.
Played by Claude in a Playwright Chromium page at 844x390 with mobile and touch emulation
(`data-layout=phone-landscape`). Settings: Kemet, Real Earth peoples world, Standard, Normal speed, King.

Sources: this session (running log `plans/playtest-4-test-log.md`, 102 rows), a headless 300-turn run of
the scripted telemetry player on the same settings (`audits/playtest-4/data/scripted300-seed4.json`), and
the playtest 3 audit (`plans/playtest-3-audit.md`) with its item inventory
(`plans/playtest-audits-item-inventory.md`, I-numbers below). Facts are marked by how I know them; opinions
are marked as such. Nothing in the game was changed during the audit; the only code in this unit is the
per-action counter in `scripts/campaignTelemetry.mjs`.

Final state at turn 300 (1360 CE): 13 cities (Men-nefer 11, Waset 12, Abdju 7, Nubt 4 retaken, Iunu 4,
Nekhen 4, Djanet 4 and six of size 1-3), 29th of 36 majors by city count (top AI: Mapungubwe 41 cities),
28,521 gold, ADM 1,700, DIP 2,040, MIL 1,824 banked, Age of Kingdoms, Monarchy, 4 wars with me (2 declared
by me), 3 cities lost (Zau and Nubt stormed by Akkad, Djedu flipped to Pontus by loyalty), 1 retaken.

Caveat on the build: about 15 merges landed on claude/integration during the session and each hot reload
of the shared server reloaded the page (about 20 times). Findings that only a reload exposes are marked
"reload"; a player on the live site meets them when the app updates, the phone kills the tab or they come
back to the game the next day.

---

## 1. Executive summary

The fixes since playtest 3 show: the cards explain both outcomes (tribute, demands, government, capture),
tribute is priced by power (7 gold a turn with a 14,000 bank), a siege no longer takes a city by itself, the
capture card offers Conquer / Raze / Tributary / Free, research says when it waits for a date, upkeep folds
into one log line, and on a phone one card shows at a time with the rest waiting as chips. The AI now
fights: Akkad stormed two of my cities in ten turns and Pontus sieged Nubt for eight.

Three things break trust, and two of them are new. The battle you watch still is not the battle that
counts: two of three commanded battles ended with "the campaign counted this battle again and reached a
different end than your screen showed", once turning a total loss on screen into a 2 minute 35 second
Victory. The default WebGL map crashes on load once a city you founded flips to another people out of
sight, which made the save unplayable until I switched to the old map. And after any reload a city cannot
be opened until some other action is taken, which can leave End Turn blocked.

The economy is unchanged in kind: 28,500 gold and about 1,800 of each power at turn 300, with rush buying
the only real sink. Rulers change every 3 turns. Research waits 40 to 80 turns at a time for a calendar
date. Most of turns 160 to 260 were End Turn.

Verdict in one line: the layer of explanation and the AI improved a lot; stability fell; fix the battle
result, the ghost-city crash and the post-load registry before anything new.

## 2. Test coverage

| Area | Covered | How |
|---|---|---|
| Start screen | people search, world, rules (King), ready, intro | rows 1-6 |
| Settings and menu | 25 controls read; Old map drawing used as a workaround | rows 58, 77 |
| Map | march, march to attack, Hold, Explore, Idle chip, settle lens and Best site, zoom, contact cards, raid chips | rows 15-24, 39-42, 78 |
| City panel | Build (effects, slow warnings, queue, rush, move), Citizens (buy land), Overview (focus), Politics (governor, quell) | rows 8-14, 28-31, 35-38, 62 |
| Empire | overview, authority, advisors, government change with reforms | rows 32-33, 82 |
| Research | first pick, advisor, date gate | rows 7, 61 |
| Diplomacy | trade, opinion reasons, declare war twice, demand (Promise), map offer, peace, More actions | rows 19-21, 41, 64, 69, 84-85 |
| Events | 64 answered in the browser game, 65 in the scripted run | rows 17, 26, 95 |
| Battles | 3 commanded (Nubt defence won, Amisus assault lost, Nubt assault "won"), 13 Auto (defences, field battle, sieges), capture card | rows 43-56, 88-94 |
| AI | wars on me (Pontus, Akkad), sieges, raids, tribute, headless census of 12 wars between majors | rows 56, 71, 79, 101 |
| Playtest 3 "not tested" row | naval (Carrack built and sailed), landing (4 units ashore), vassals (looked; never eligible), saves (Export 2.46 MB file, Import restores) | rows 59-60, 63-69 |
| Not tested | Cloud saves account, real finger gestures, sound, globe, portrait rotate screen, amphibious assault on an enemy coast, vassalize (3x strength never reached) | row 102 |

Play styles used: peaceful expansion (T1-100), commanded defence (Nubt T121), commanded assault (Amisus T122,
Nubt T273), defensive war (Pontus T108-196, Akkad T164-182), siege conquest (Nubt T265-273), diplomacy and
trade (Garamantes trade, Pontus promise, map offers), deliberate bad decisions (Monarchy at T261 dropping
Authority under the law threshold, refusing every demand T162-290, keeping 1-production desert cities),
exploit checks (siege-and-wait, rush buying with a large bank).

How the 300 turns were played: about 110 turns by hand through the UI (T1-25, 25-40, 70, 100-122, 148-162,
201-206, 261-273) and the rest by an in-page scripted player that taps the same buttons End Turn names
(first event option, research advisor, a build from a preference list, Auto for defences, Refuse or Pay,
Best site). The headless scripted telemetry player ran a second 300-turn game on the same settings for the
AI and economy numbers.

## 3. Scorecard (out of 10, my judgement)

| # | Category | Playtest 3 | Playtest 4 | Delta | Why |
|---|---|---|---|---|---|
| 1 | Core loop and fun | 5 | 5 | 0 | Expansion and the first battles are fun; T160-260 is still End Turn with a growing bank |
| 2 | Pacing | 4 | 5 | +1 | First builds 4-16 turns (was 20-105); but research waits 40-80 turns for a date and Waset sat at 1 production for 150 turns |
| 3 | Economy and sinks | 3 | 3 | 0 | Rush is a real sink, tribute is small; still 28,500 gold and about 1,800 of each power unspent at T300 |
| 4 | AI (macro) | 4 | 5 | +1 | Akkad took two cities in ten turns and made peace; war stacks move (0.62 a turn at war); 52% of war stacks still sit at home |
| 5 | AI (battle) | 5 | 5 | 0 | Defends, towers punish idle squads; no sally seen |
| 6 | Combat (RTS) | 6 | 6 | 0 | Green placement ground, alerts and powers help; squads still go idle after a target and orders on buildings do not stick |
| 7 | Diplomacy | 4 | 5 | +1 | Demand and tribute cards with both outcomes, map offers, opinion reasons; war needs no confirm, odd "would accept" at -38 |
| 8 | Systems consistency | 3 | 3 | 0 | Old ones fixed (siege surrender, research gate, buy land price); new ones: screen vs result, ghost city, raw ids, "{name}" |
| 9 | Map UI | 6 | 5 | -1 | Settle lens and Best site excellent; default map crashed the save, fleet in port cannot be tapped, no embark button |
| 10 | City UI | 5 | 6 | +1 | Effect text on every row, slow-build warning, focus that shows its effect, rush confirm; move arrow unlabeled |
| 11 | Mobile landscape layout | 4 | 6 | +2 | One card at a time with chips, full-width cards; rush confirm opens off-screen, End Turn draws over the log |
| 12 | Feedback and clarity | 3 | 5 | +2 | Turn report, outcome previews, siege and capture messages; war declared on one tap, AI refusals in my log |
| 13 | Art and animation | 6 | 6 | 0 | Towns, walls and the battle economy read well; the Enemy camera opens on a black fogged field |
| 14 | Performance | 8 | 7 | -1 | 200-900 ms a turn in the browser, 0.28 s headless; battle load 20-30 s (shared, loaded dev server) |
| 15 | Stability | 7 | 4 | -3 | A crash that bricks the save on the default map, battle results that differ from the screen, a battle restarted from zero after a reload, dead city taps after load |

Sum of the 15 rows: 73 in playtest 3, 76 now. The layer the player reads went up; the layer the player trusts went down.

## 4. Detailed findings

Format: ID, category, severity (Critical / High / Medium / Low), where, how to reproduce, expected,
actual, impact, evidence (log row), fix, priority (P0-P3), confidence (Seen = on screen, State = read
from game state, Code = read in source). "Was" compares with playtest 3 and the item inventory. The fix
lines are suggestions for later units; nothing was fixed here.

### Critical

**P4-C1. The default map crashes and the save cannot be played after a city flips out of sight**
- Category: stability. Where: `src/components/map/fogView.js` (ghost records), `src/components/city/cityRailModel.js`, `src/engine/cityEconomy.js` cityLive, `src/engine/world/cities.js` allocateFresh.
- Repro: lose a city you founded by a loyalty flip while you cannot see it (Djedu went over to Pontus at the end of T201), then be at close zoom (the camera opens there after a turn or a load). Save: `audits/playtest-4/data/save-t202-ghost-city.json` (Import save; not committed) reproduced it on every load.
- Expected: the map draws the remembered city greyed.
- Actual: fogView keeps the remembered record with `owner: kemet`, `tiles: []` and no `locked`; cityRailModel takes it as one of my cities and cityLive calls `city.locked.filter`: "Cannot read properties of undefined (reading 'filter')" in GLMapView, the app unmounts and reloads, and crashes again on every load. The crash log (it keeps the last 12 sessions) shows 10 sessions in 4 minutes ending this way.
- Impact: a 200-turn game is unplayable on the default map; a player would think the save is lost.
- Evidence: rows 75-77. Workaround found: Settings "Old map drawing". Fix: ghost records never count as the player's cities (cityRailModel and every "mine" filter skip `ghost`), and cityLive treats a record without `locked` as empty; add a fog test with a city flipped out of sight. P0. Confidence: State + Code. Was: new.

**P4-C2. The battle you watch is not the battle that counts**
- Category: systems. Where: commanded battle verification (`src/engine/battleVerify.js`, `src/engine/battleReceipt.js`), the result screen.
- Repro A (Amisus, T122): command an assault, a page reload mid-battle, Finish the battle resumes from the checkpoint, run out the clock. Repro B (Nubt, T273): command an assault, page reload at tick 8,031, Finish the battle restarts at tick 0, fight to tick 36,000 losing every squad.
- Expected: the result is the battle on screen.
- Actual: A: banner "The campaign counted this battle again and reached a different end than your screen showed", Repelled. B: my screen ended with 0 squads and "Base 1 vs 4"; the result screen said VICTORY, "battle lasted 2 min 35 s", 7,920 of 40,000 lost, all four regiments alive with XP, city taken, with the same banner.
- Impact: same class as playtest 3 C1, now visible but not fixed: the player cannot trust what they played, in either direction. Both cases involved a reload, which the live site triggers on an update or when the phone drops the tab.
- Evidence: rows 54, 90-92. Fix: after a reload, resume only from a checkpoint whose order log matches the replay (setupKeyOf plus the order log), else replay to the checkpoint tick; never verify against orders from an earlier attempt; test "reload, resume, finish" gives the screen's outcome. P0. Confidence: Seen + State. Was: C1 / I001, I002.

### High

**P4-H1. After Continue, cities cannot be opened until some action is taken** (stability, reload). Tapping a
city, a Cities row, a "can build" chip or the "Choose production" CTA does nothing; `REGIONS_DATA` holds 54 of
81 (T1) or 452 cities until the first dispatch, because the registry is synced only inside the reducer. With
a "Choose production" blocker End Turn is stuck until the player happens to take another action (I declined a
map offer). Seen at T1 and T162 (rows 11, 70). Fix: sync the registry when the state is loaded
(loadOrCreateState / LOAD_GAME), and a test that opens a city right after load. P0. State + Code. Was: new.

**P4-H2. A commanded battle restarts from zero after a reload** (stability, reload). Nubt T273: reload at tick
8,031, Finish the battle started at tick 0 with full strength; Amisus T122 resumed at tick 34,200. About 7
minutes of play lost, and it fed P4-C2 (row 90). Fix: write a checkpoint early and on a timer, and say on
resume where it picks up. P1. State. Was: new.

**P4-H3. Every currency still piles up** (economy). 28,521 gold, ADM 1,700, DIP 2,040, MIL 1,824 at T300
(playtest 3: 7,453 gold, 1,393 / 1,474 / 1,821). The scripted run ends with 15,774 gold and about 1,700 of each
power. Rush buying works and costs 76-960 gold an item (row 38) but needs taps in every city; nothing else
scales. The use count shows the powers are spent on almost nothing: 2 quells, 2 war declarations, 1
government change, 1 governor in 300 turns (section 9). P1. State. Was: H1 / I021 (open).

**P4-H4. Squads go idle after a target, and attack orders on buildings do not stick** (RTS). Amisus: three
trebuchets idle beside the broken gate, infantry bled to 0 under towers. Nubt: after the field army fell my
four squads stood idle under the towers; Attack on the keep, re-sent every 15 seconds, set them moving and they
went idle again, until all died (rows 52, 91). Fix: attack-move picks up structures in reach; an order on a
building holds until it falls; an idle squad under fire fights back or withdraws. P1. Seen + State. Was: H7 /
I189, I191 (open).

**P4-H5. Rulers change every 3 turns** (mechanics). "reigned 3 turns" on every succession, 25 successions in
the last 800 log lines, against decision 39 (one ruler a game, phase RU). The log line now exists (playtest 3
L6 half fixed) but the churn makes the ruler meaningless (rows 25, 32). P1 (U5 in the plan). State. Was: L6 /
I146.

**P4-H6. Troops cannot board a ship from the UI** (naval). The Carrack builds and sails ("Sail..." in the city
sheet's unit list), and "land here" exists in the tile sheet, but no component dispatches EMBARK_UNIT, so a
player cannot load an army; the fleet badge in port sits on the city badge and taps open the city (rows 65-68).
Fix: an Embark button on the army sheet when a transport shares the tile, and a tappable fleet badge in port.
P1. Seen + Code. Was: not tested in playtest 3.

**P4-H7. Research waits 40 to 80 turns for a calendar date** (pacing). T148: "Banking Houses opens in 1000 CE,
about 78 turns", 5 of 10 Kingdoms techs known; T201-300 "Waiting for 1000 CE" then "Waiting for 1500 CE"; the
bank grows (710 science banked) with nothing to do. The UI is now honest (playtest 3 M1 fixed); the wait itself
is the problem, and it reads a calendar year in a rule (the plan's stop condition f, sibling ages plan) (row
61). P1. Seen. Was: M1 / I133, I134 (display fixed).

### Medium

- **P4-M1. Low-production cities never recover.** Waset 1.1 production from size 4 to size 12 over 150 turns;
  Iunu 3.9; six of thirteen cities under 5 at T300; the scripted run's minimum city is 1 (rows 28, 96). Was H9 /
  I026 (better at the start, not later).
- **P4-M2. Identical Auto battles repeat for 8 turns.** Pontus siege engines at Nubt, T124-131: the same line
  "broke the defences ... has no foot or horse to take it. Fallen: 1,700 of yours, 1,640 of theirs" each turn, and
  8 battle reports of 16 kept (row 56). Should be one ongoing siege, not a battle a turn. New.
- **P4-M3. My log shows news of cities I lost.** "Nubt completes a Market", "Zau's borders grow" after Akkad
  took them (row 72). New.
- **P4-M4. AI refusals and raw ids in my log.** "That army has already moved or fought this turn." (four a turn
  at T300) and "The Lac Viet Commonwealth attacks from c7102 toward c7026." (row 73). Was I171 (news noise).
- **P4-M5. War is declared on one tap.** Pontus and Akkad: the button shows the cost and the cause, then the war
  starts with no confirm card (rows 41, 85). New (playtest 3 did not declare).
- **P4-M6. Diplomacy reads oddly.** "Offer pact: Would accept" from Akkad at opinion -38; "War exhaustion
  56.830065359477146" unrounded on the sheet (rows 84-85). New.
- **P4-M7. Battle placement still takes tries.** Green ground and "Good spot" now show, but the siege workshop
  took 4 taps ("Overlaps a building", "Too close to the edge", "On top of a resource" twice) and the menu reopened
  under the finger (rows 49-50). Was H6 / I173 (improved).
- **P4-M8. Events repeat.** River Rises 6 times, the border dispute pair 8 and 7 times in the scripted run (row 17,
  section 9). Was M15 / I221 (open).
- **P4-M9. Vassals are hidden, not explained.** Vassalize appears only with 3 times their military; there is no
  disabled button with the reason, so the feature is invisible in a normal game (row 69). New.
- **P4-M10. Units named for later ages.** Musketeers and Field Cannon in 1126 CE while the gunpowder age waits for
  1500 CE (row 83). Was L4 / I148.
- **P4-M11. The rush confirm opens out of view.** On the Build tab scrolled down, tapping the price opens the
  confirm above the view; the first tap seems to do nothing (row 37). New.
- **P4-M12. Conquest loyalty holds now, flips still come quietly.** Retaken Nubt held 14 turns (loyalty 35,
  control 77), good; Djedu flipped five turns after the only warning, a log line "losing its loyalty (21)" (rows 74, 94).
  Was H4 / I126, I127 (better).

### Low

- L1. Stray punctuation in every march preview: "it sets out at End Turn. , about 10 supplies" (row 16).
- L2. "Pillage the {name} (+20 gold)": a placeholder in an army sheet button (row 86).
- L3. "A infantry unit disembarked at Tel Aviv": grammar, and a modern place name in 526 CE (row 68).
- L4. The Traveling Merchants event text uses two em dashes (around "and rarer opportunities"), against the copy
  rule (screenshot 159).
- L5. The queue's move-to-front arrow has no label (Buy and Remove rows have one) (row 62).
- L6. Rebellions in unmet lands fill the crisis filter (110 lines) (row 98). Was I171.
- L7. The Log sheet stays open when another rail tab is tapped; End Turn and the Idle chip draw over it (row 99).
- L8. The battle's Enemy camera opens on a black, fogged field with only "Their keep." (screenshot 96-b2-enemy).
- L9. Legacy tab shows achievements only; no score or ranking yet (row 97; U16 and U17 in the plan).

### Fixed or better since playtest 3 (verified in this session)

| Playtest 3 | Inventory | Now |
|---|---|---|
| C2 ghost units | I003 | After battle 1 the campaign strengths matched the report (933, 939, 941, 265; Pontus 21 and 510) |
| H2 tribute tax | I100, I101 | "7 gold a turn for 20 turns" with a 14,052 bank; 3 options each with its result |
| H4b no capture choice | I129 | Conquer / Raze / Make tributary / Free, each with loyalty and gold effects |
| H5 squeezed cards | I151 | One card at a time; the rest wait as chips |
| H9 early pacing | I026 | First builds 4-16 turns at 7 production |
| M1 research "1 turn" | I133, I134 | "opens in 1000 CE, about 78 turns"; top bar "Waiting for 1000 CE" |
| M2 government trap | I139-I141 | Preview of Authority and the law lockout, reforms chosen, Cancel |
| M8 inland ships | I039 | Men-nefer (Nile) listed no ships at T1; coastal Iunu lists Trireme, Longship, Bireme |
| M9 no effect text | I043 | Every build row shows its effect |
| M11 odds hidden | I010 | Defence card: "Auto holds 0%"; assault card: "Likely win" bar |
| M12 siege-and-wait | I131 | "A siege never takes a city: attack it to take it" |
| M18 buy land price | - | 120 shown, 120 charged |
| L5 one-line Why | - | Opinion reasons listed |
| L7 upkeep flood | I170 | One line, "103 turns so far" |
| I062 Hold, I157 Idle chip | I062, I157 | Hold and one "Idle N" chip on the map |

## 5. AI report

- **Wars: real.** Pontus declared at T108 and sieged Nubt for 11 turns; Akkad declared at T164, stormed Zau
  (T171) and Nubt (T174), offered peace at T182. Pontus declared again at T277. In the headless run 12 wars
  between majors, 4.4 battles a war, 2 with no battle, median length 12 turns, 23 captures (16 from
  independents), 14 of 17 conquests kept 20 turns.
- **Armies: moving at war, idle in peace.** Unit move rate 0.62 a turn at war, 0.05 in peace; war stacks:
  34% moved, 52% idle at home, 2.5% besieging; stacks at enemy walls average 10 units.
- **Expansion: strong.** Top majors at T300: Mapungubwe 41, Hopewell 38, Chaco 34, Kitara 32, Gojoseon 31 cities.
- **Contact: still slow.** 2 majors met by T25, 9 by T152; the headless player met 7 by T300.
- **Demands: sane.** 3 major demands and 2 tributes in the scripted run; in the browser 6 demand lines in 300
  turns. Tribute is priced by power, not the bank.
- **Battle AI:** defends inside the walls; towers kill squads that stand idle; no sally seen.
- **Independents:** raid parties with chips ("in 2 turns", "going home"); Libu sacked Hut-waret at T238.

## 6. Mechanics report

- **Pacing:** first builds 4-16 turns; late cities 2-20 production; research gated by calendar for long waits (P4-H7).
- **Rush:** the only active gold sink; the scripted harness's RUSH mode was not used (no rushQuote in the sim engine).
- **Siege:** walls 840 HP fall in 7 turns, then the city must be assaulted (good).
- **Capture and loyalty:** the capture card and a 10-turn grace work; loyalty flips of unwatched cities stay quiet.
- **Rulers:** 3-turn reigns (P4-H5).
- **Naval:** build, sail and land work in the engine; boarding has no UI (P4-H6).
- **Saves:** Export writes a 2.46 MB version 13 file; Import restores it (rows 59-60).

## 7. Mobile landscape UX (844x390)

1. One card at a time with waiting chips: done and it works.
2. Cards: full width, both outcomes; rush confirm sometimes out of view (P4-M11).
3. Map: the settle lens and Best site are the best flow in the game; fleets in port and embarking are not
   reachable (P4-H6); cities dead after load (P4-H1).
4. Battle HUD: collapsed bottom bar, alert bell, Find / Enemy / Base / Map; placement still trial and error.
5. Log: grouped upkeep; End Turn overlaps the open sheet (L7).

## 8. Fun analysis (opinion)

- **Most fun:** settling with Best site; the first defence of Nubt; watching Akkad's army arrive and take Zau;
  the capture card after retaking Nubt.
- **Least fun:** a 30-minute assault that bled out under towers because squads stood idle, followed by a Victory
  screen that did not match it; the map crash; 80 turns with nothing to research.
- **Missing tension:** the bank. With 28,000 gold nothing is scarce after T150.
- **Missing goals:** era goals sit at 2/2 for long stretches; Legacy has no score yet (U16, U17).

## 9. Per-action use counts

Counted by `createActionCounter` / `installBrowserActionCounter` (scripts/campaignTelemetry.mjs, dev only). The
browser column is every action dispatched to the game's reducer in the playtest game, by hand or by the in-page
scripted player, T1-T300 (86 `PT4_NOOP` dispatches used to work around P4-H1 are left out). The scripted column
is the headless 300-turn run of the scripted telemetry player (it answers blockers, queues builds and sends
settlers; it never moves an army). `APPLY_TURN_RESULT` counts turns arriving from the worker, more than 300
because reloads re-ran some turns. 30 of 133 action types were used in the browser game, 4 in the scripted run;
103 types were never used. Raw data: `audits/playtest-4/data/final-counts.json` and `scripted300-seed4.json`.

| Action type | Browser game (T1-T300) | Scripted run (300 turns) |
|---|---:|---:|
| APPLY_TURN_RESULT | 344 | 0 |
| QUEUE_PRODUCTION | 88 | 102 |
| RESOLVE_EVENT | 64 | 65 |
| SET_SETTLER_TARGET | 17 | 15 |
| RUSH_PRODUCTION | 14 | 0 |
| RESOLVE_DEFENSE_AUTO | 13 | 0 |
| ANSWER_DEMAND | 3 | 3 |
| SET_ROUTE | 6 | 0 |
| MOVE_PRODUCTION | 5 | 0 |
| ACCEPT_PENDING_PEACE | 4 | 0 |
| DISEMBARK_UNIT | 4 | 0 |
| EMBARK_UNIT | 4 | 0 |
| RESOLVE_TACTICAL_BATTLE | 3 | 0 |
| ANSWER_TRIBUTE_DEMAND | 2 | 0 |
| BEGIN_TACTICAL_BATTLE | 2 | 0 |
| DECLARE_WAR | 2 | 0 |
| QUELL_UNREST | 2 | 0 |
| RESEARCH_TECH | 2 | 0 |
| ADVANCE_TURN | 1 | 0 |
| ANSWER_MAP_OFFER | 1 | 0 |
| ASSIGN_GOVERNOR | 1 | 0 |
| BEGIN_DEFENSE_BATTLE | 1 | 0 |
| BUY_TILE | 1 | 0 |
| CANCEL_ROUTE | 1 | 0 |
| CHANGE_GOVERNMENT_TYPE | 1 | 0 |
| EXPLORE_ORDER | 1 | 0 |
| LOAD_GAME | 1 | 0 |
| RESOLVE_CAPTURE | 1 | 0 |
| SET_RESEARCH_AUTO | 1 | 0 |
| TRADE_AGREEMENT | 1 | 0 |
| ABANDON_COLONY | 0 | 0 |
| ABANDON_TACTICAL_BATTLE | 0 | 0 |
| ACTIVATE_FUSION_GRID | 0 | 0 |
| ADD_LOG | 0 | 0 |
| AMPHIBIOUS_ASSAULT | 0 | 0 |
| ANNEX_VASSAL | 0 | 0 |
| ANSWER_JOIN_OFFER | 0 | 0 |
| APPOINT_GENERAL | 0 | 0 |
| ASAT_STRIKE | 0 | 0 |
| ASSIGN_DIPLOMAT | 0 | 0 |
| ATTACK_ARMY | 0 | 0 |
| ATTACK_FLEET | 0 | 0 |
| BEGIN_AMPHIBIOUS_BATTLE | 0 | 0 |
| BREAK_ALLIANCE | 0 | 0 |
| BUILD_ABM_DEFENSE | 0 | 0 |
| BUILD_CLIMATE_RESILIENCE | 0 | 0 |
| BUILD_DEFENSES | 0 | 0 |
| BUILD_INFRASTRUCTURE | 0 | 0 |
| BUILD_MISSILE | 0 | 0 |
| CHANGE_LAW | 0 | 0 |
| CLOSE_BORDERS | 0 | 0 |
| CONSTRUCT_BUILDING | 0 | 0 |
| CONTINUE_AFTER_VICTORY | 0 | 0 |
| COUNTER_INTELLIGENCE | 0 | 0 |
| CULTURAL_EXPORT | 0 | 0 |
| DECLARE_INDEPENDENCE | 0 | 0 |
| DELETE_ARMY_TEMPLATE | 0 | 0 |
| DEMAND | 0 | 0 |
| DEMAND_INDEPENDENT_TRIBUTE | 0 | 0 |
| DEQUEUE_PRODUCTION | 0 | 0 |
| DEVELOP_PROVINCE | 0 | 0 |
| DEVELOP_RESOURCE_SITE | 0 | 0 |
| DISBAND_SETTLERS | 0 | 0 |
| DISBAND_UNIT | 0 | 0 |
| DISMISS_GOVERNOR | 0 | 0 |
| ENACT_GOVERNMENT_REFORM | 0 | 0 |
| ESPIONAGE | 0 | 0 |
| FABRICATE_CLAIM | 0 | 0 |
| FAST_FORWARD | 0 | 0 |
| FOUND_CITY | 0 | 0 |
| FOUND_COLONY | 0 | 0 |
| FRONTIER_EXPEDITION | 0 | 0 |
| FUND_SCHOLARS | 0 | 0 |
| GAIN_CONTROL | 0 | 0 |
| GIFT_BRIBE | 0 | 0 |
| GIFT_INDEPENDENT | 0 | 0 |
| HIRE_ADVISOR | 0 | 0 |
| HIRE_GENERAL | 0 | 0 |
| HIRE_MERCENARY | 0 | 0 |
| INCREASE_STABILITY | 0 | 0 |
| INSULT | 0 | 0 |
| LAUNCH_INVASION | 0 | 0 |
| LAUNCH_MISSION | 0 | 0 |
| LAUNCH_SATELLITE | 0 | 0 |
| MARK_TUTORIAL_STEP | 0 | 0 |
| MILITARY_ALLIANCE | 0 | 0 |
| MISSILE_STRIKE | 0 | 0 |
| MOVE_ARMY | 0 | 0 |
| MOVE_CAPITAL | 0 | 0 |
| NAVAL_ENGAGEMENT | 0 | 0 |
| OFFER_INDEPENDENT_TRIBUTE | 0 | 0 |
| OFFER_PEACE | 0 | 0 |
| OPEN_BORDERS | 0 | 0 |
| PILLAGE_TILE | 0 | 0 |
| POPULATION_POLICY | 0 | 0 |
| PROMOTE_UNIT | 0 | 0 |
| PROPOSE_INDEPENDENT_TRADE | 0 | 0 |
| PROPOSE_JOINING | 0 | 0 |
| PROPOSE_MARRIAGE | 0 | 0 |
| QUEUE_RESEARCH | 0 | 0 |
| RAZE_CITY | 0 | 0 |
| RECALL_DIPLOMAT | 0 | 0 |
| RECRUIT_UNIT | 0 | 0 |
| REJECT_PENDING_PEACE | 0 | 0 |
| RELEASE_VASSAL | 0 | 0 |
| RENAME_ARMY | 0 | 0 |
| REPAY_LOAN | 0 | 0 |
| REQUEST_LOAN | 0 | 0 |
| RESET_GAME | 0 | 0 |
| RESOLVE_ALL_DEFENSES_AUTO | 0 | 0 |
| RIVAL_NATION | 0 | 0 |
| SAVE_ARMY_TEMPLATE | 0 | 0 |
| SETTLE_COLONIZE | 0 | 0 |
| SET_AIR_PATROL | 0 | 0 |
| SET_ARMY_MAINTENANCE | 0 | 0 |
| SET_BATTLE_SETTINGS | 0 | 0 |
| SET_CITY_FOCUS | 0 | 0 |
| SET_HOLD | 0 | 0 |
| SET_NAVY_MAINTENANCE | 0 | 0 |
| SET_RESEARCH_FOCUS | 0 | 0 |
| SET_SETTLER_HOLD | 0 | 0 |
| SET_SIEGE | 0 | 0 |
| SET_TAX_RATE | 0 | 0 |
| SHIFT_IDENTITY | 0 | 0 |
| STOP_RAZING | 0 | 0 |
| SUE_FOR_PEACE | 0 | 0 |
| SUPPRESS_REBELLION | 0 | 0 |
| TOGGLE_TILE_LOCK | 0 | 0 |
| TRADE_MAPS | 0 | 0 |
| UNQUEUE_RESEARCH | 0 | 0 |
| UNRIVAL_NATION | 0 | 0 |
| VASSALIZE | 0 | 0 |
| WITHDRAW_FROM_DEFENSE | 0 | 0 |

## 10. Top 10 fixes

1. The commanded result is the battle on screen, including after a reload (P4-C2, P4-H2).
2. Ghost records never count as the player's cities; the map never crashes on a fog snapshot (P4-C1).
3. Sync the world registry on load so cities open at once (P4-H1).
4. Squads keep fighting after a target and hold orders on buildings (P4-H4).
5. A real use for the bank and the powers (P4-H3; the plan's decrees and gold, U6 to U9).
6. One ruler a game (P4-H5; U5).
7. Boarding a ship from the army sheet and a tappable fleet in port (P4-H6).
8. Research that does not wait 80 turns for a year (P4-H7; sibling ages plan).
9. One ongoing siege instead of a battle a turn, and a clean log (P4-M2 to P4-M4).
10. A confirm card for war, rounded numbers and no placeholders on screen (P4-M5, P4-M6, L1, L2).

## 11. Final verdict

The game now explains itself: nearly every card says what each choice does, and on a phone the cards no
longer pile up. The AI makes war and the map shows it. But a long game is fragile: one loyalty flip out of
sight bricked the default map, a reload makes the battle you fought and the battle that counts drift apart,
and a fresh load leaves cities that cannot be opened. Those three come before any new feature in the plan;
after them the old problem returns to the top: a bank of 28,000 gold with nothing to spend it on.

## 12. Considered and not built

- A dev hook in `src/context/GameContext.jsx` to count dispatches: not built; the browser counter reads
  GameProvider's own dispatch ref from outside (installBrowserActionCounter), so no game file changed.
- Fixes for P4-C1 and P4-H1 (both small and found in code): not built, this unit is findings only.
- A save-loading browser script for later re-scores: not built; the driver, the in-page scripted player and the
  counter installer used here are kept (not committed) in `audits/playtest-4/tools/`.
- RUSH in the headless scripted run: the sim engine bundle has no `rushQuote`, so the scripted run never rushed.
