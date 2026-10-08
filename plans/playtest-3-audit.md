# Playtest 3: full audit (phone landscape, 300 turns as Kemet)

Date: 2026-10-08. Build: claude/integration on localhost:3000 (same code as the live site).
Played by Claude in the built-in browser at 844x340 (iPhone landscape 844x390 minus Safari bars,
`data-layout=phone-landscape`). Touch was not emulated: taps arrive as mouse clicks, so gestures that
need a finger (one-finger pan in battle) were done through the same pan call a finger uses.
Settings: Kemet (Egypt), Real Earth, Standard world, Normal speed, King.

Sources: this session (running log `plans/playtest-3-test-log.md`, 164 rows, every row seen in play
or read from the live game state), plus sessions 1 and 2 (`plans/playtest-2-report.md`: 154 turns
desktop Akkad, 200 turns phone Akkad, one sandbox battle). Facts are marked by what I saw; opinions
are marked as such. Nothing in the game was changed during the audit.

Final state at turn 300 (1360 CE): 8 cities (Men-nefer 10, Iunu 12, Abdju 10, Siwa 7, Waset 6,
Nekhen 4, Zau 3, Nubt 3), 26th of 36 majors by city count (top AI: Chaco 36 cities), 7,453 gold,
ADM 1,393, DIP 1,474, MIL 1,821 banked, 3 majors met, 20 tributes paid out of 21 demands, 2 wars
declared on me, 6 settlers standing idle, Age of Kingdoms.

---

## 1. Executive summary

Terra Imperium has two strong cores: a real-Earth map with a readable settling flow, and a real-time
battle with a working economy (gather, build, train, siege). Around them sit systems that produce
numbers but no decisions: gold, ADM, DIP and MIL pile up into the thousands with almost nothing to
buy; AI armies stand in their cities; tribute demands arrive every ~5 turns and scale with your bank;
conquests rebel away within ten turns; and the campaign sometimes records a different result than the
battle you just won (the Kerma Victory was logged as "repelled").

On a phone in landscape the game is playable but tiring: two or three sheets regularly open at once,
some cards squeeze into a 170 px column with one word per line, chips and buttons move under the
finger, and the battle HUD leaves a strip of field in the middle.

Verdict in one line: the foundation is good and the fixes are mostly wiring, feedback and pacing,
not new systems. Fix the result bug, the dead economy and the phone layering first.

## 2. Test coverage

| Area | Covered | How |
|---|---|---|
| Start screen | search, random, region chips, steps, difficulty, Enter key | session 3 rows 13-19 |
| Settings and menu | all 22 controls read; globe, overlay, copy log, cloud sign-in form | rows 1-12 |
| Map | march, march to attack, Move now, tile sheet, lenses, settle lens, zoom levels | rows 26-31, 37-47, 74-75, 120, 131-132 |
| City panel | all 6 tabs in 8 cities: focus, build, queue, remove, citizens, lock, buy land, buildings, develop, infrastructure, defenses | rows 21-23, 49-56, 128-130 |
| Empire | advisors, government change, laws, treasury, national identity | rows 41, 104-108 |
| Research | pick, queue, advisor pick, boosts, Fund Scholars, era goals | rows 20, 42-43, 76-78, 105, 127 |
| Diplomacy | trade, diplomat, gift list, more actions, peace offer, tribute pay and refuse, independents panel | rows 59-66, 80, 88, 122-124 |
| Events | ~30 events answered; repeats noted | rows 35, 73, 84, 89 |
| Battles | 2 commanded sieges on the phone (Cyrene lost, Kerma won), 3 auto defences, 2 siege surrenders, report and replay | rows 57-58, 86, 90-103, 133-158 |
| AI | world census at T172 and T300; Kanesh war watched 14 turns | rows 121-125 |
| Not tested | Export/Import save (needs a download / file picker), Cloud saves sign-in (no account creation), naval combat, landings, vassals, real touch gestures, sound, globe deep use, Portrait rotate screen in this session | |

Play styles used: peaceful expansion (T1-100), siege conquest (Siwa, Kerma), commanded assault
(Cyrene, Kerma), defensive war (Kanesh), diplomacy and trade (D'mt), deliberate bad decisions
(0-yield desert cities, Monarchy switch, refusing tribute), exploit check (siege-and-wait, tribute
pricing).

## 3. Scorecard (out of 10, my judgement)

| # | Category | Score | Why |
|---|---|---|---|
| 1 | Core loop and fun | 5 | Expansion and battles are fun; T1-100 and T200-300 are mostly End Turn |
| 2 | Pacing | 4 | Normal is better than Marathon, but early builds take 20-105 turns and late ones 5 |
| 3 | Economy and sinks | 3 | Every currency piles up; demands are the only real sink |
| 4 | AI (macro) | 4 | Expands well (top AI 36 cities); armies static; tribute spam |
| 5 | AI (battle) | 5 | Defends sensibly, trains reinforcements; never sallies or counterattacks smartly |
| 6 | Combat (RTS) | 6 | Economy, siege weapons and formations work; placement and orders fight you |
| 7 | Diplomacy | 4 | Clear sheets, but few majors met, actions cheap, trade plundered every turn |
| 8 | Systems consistency | 3 | Result bug, ghost units, walls words, regionId labels, 1t research |
| 9 | Map UI | 6 | Settle lens and site card are excellent; jumps, lens conflicts, chips |
| 10 | City UI | 5 | Complete, but no effect text, duplicate rows, no reorder, reflow |
| 11 | Mobile landscape layout | 4 | Stacked sheets, squeezed cards, HUD covers the field |
| 12 | Feedback and clarity | 3 | Many actions apply silently; key warnings only in the Log |
| 13 | Art and animation | 6 | Real Earth and towns good; trees, blank icons, dark battle start |
| 14 | Performance | 8 | 90-118 fps in battle; battle load 5-20 s; turns fast |
| 15 | Stability | 7 | No crash in 300 turns; one state bug class (battle result to campaign) |

## 4. Detailed findings

Format: ID, category, severity (Critical / High / Medium / Low), where, how to reproduce, expected,
actual, impact, evidence (log row), fix, priority (P0-P3), confidence (Seen = on screen, State = read
from game state, Code = read in source).

### Critical

**C1. Battle Victory recorded as a defeat**
- Category: systems. Where: battle result to campaign (battleOutcome).
- Repro: Siege of Kerma T244, Command, win by routing every defender while the keep stands.
- Expected: Victory screen means the city falls (or the screen says "field won, city holds").
- Actual: screen "VICTORY, 24 min"; campaign: outcome "defender", captured false, Log "Your invasion
  on Kerma was repelled". Fallen 48,760 / 50,660 in the report vs 5,647 / 6,733 on the screen.
  Cavalry ends the battle at 355 strength and appears on the map at 1,000.
- Impact: 24 minutes of play thrown away; the player cannot trust any result.
- Evidence: row 158. Fix: one result object from the sim to applyBattleOutcome; the screen reads the
  campaign verdict, not its own; add a test "all defenders routed equals capture". P0. Confidence: State.

**C2. Commanded results disagree with the map (ghost units)**
- Repro: Siege of Cyrene T118: result "3,000 of 3,000 lost, 3 regiments destroyed".
- Actual: the cavalry still exists at Cyrene with 627 strength and supply 0 for 50 turns, shown as
  "Army idle" and "Army low on supply". Same class as session 2 (902 of 902 lost, 175 men left).
- Evidence: rows 113, 119. Fix: same as C1; plus the state audit should flag units at 0 supply for
  N turns. P0. Confidence: State.

### High

**H1. Every currency piles up** (economy). Gold 3.5k at T140, 11k at T244; ADM/DIP/MIL 1,000-1,800.
Sinks: advisors 50-450, buy land ~110, Infrastructure 80, Defenses 60, Develop 123 points, laws
100-250, government 300. Spending in all six cities moved gold 9,969 to 9,129. Fix: gold purchase of
production (rush) with a premium, scaling costs, power points capped or spent on real choices
(row 104, 129). P1. State.

**H2. Tribute demands are a tax that scales with your bank** (AI). 21 demands, 219 to 2,818 gold,
every ~5 turns late game, even from Friendly D'mt with a trade deal. Paying 1,239 the same turn Kanesh
declared war did not stop the war. Opinion stays -36 after paying 1,125 (rows 72, 80, 122-123, 162,
164). Fix: demands based on relative power, cooldown per people, paying buys a truce and opinion. P1.

**H3. AI armies do not act** (AI). T172: 32 of 330 major units moved, 36 outside a city. During the
Kanesh war all 30 Kanesh units piled into one size-2 colony and never attacked; then "worn out by the
war" white peace with zero battles (rows 121, 124). Fix: aiOperations must stage, march and siege when
at war; peacetime exploring. P1. State.

**H4. Conquests fall away** (balance). Kerma: surrender, rebellion after 4 turns, lost after 10.
Session 2: Hagmatana surrendered 5 times and broke away 4 times. The only warning is a Log line
(row 163). Fix: loyalty floor after conquest, a "Hold the city" card with clear steps, garrison bonus.
P1.

**H4b. No choice after taking a city** (mechanics). Siwa and Kerma fell by surrender and Kerma by a
won battle; no card offered Conquer, Raze, Make tributary or Free it. Razing exists in code
(razing.js) but was never offered (row 165, user note). Fix: a capture card with those choices and
their loyalty, gold and grudge effects; this also answers H4 (raze or free a city you cannot hold). P1.

**H5. Squeezed cards on phone** (mobile UX). When the Peoples panel opens (tribute demand), the
pre-battle card and event cards squeeze into ~170 px: one word per line, sideways scroll, options
off-screen (rows 79, Raiders event at T206). Fix: one sheet at a time; demands go to a queue chip, not
an auto-opened panel. P1. Seen.

**H6. Build placement in battle is a guessing game** (RTS UX). Battle 2: 7 tries for a barracks
("too close to the edge" on open grass, "on top of a resource" on grass, "you cannot see this ground").
Session 1: 8 failures, 6 valid points of 160. Battle 1: a valid tap places at once and reopens the
menu under the finger (rows 96, 137, 140, 142). Fix: tint legal ground green while placing, draw the
field edge, show resource footprints, keep the menu closed after placing. P1. Seen.

**H7. Orders silently fail in battle** (RTS UX). "All N" also moves the camera, so the next tap lands
elsewhere; Attack then tap a structure sometimes gives no order and no message; after a target falls
every squad goes idle in the middle of a counterattack; a move order near the wall left squads idle
under the towers (rows 101, 147, 154-155). Fix: "All" selects without moving the camera (or a
separate "Find army"); attack-move by default; squads auto-engage enemies in reach. P1. Seen.

**H8. Retreat forfeits the whole battle** (RTS). Third time seen. Survivors counted as destroyed
(row 103). Fix: Retreat withdraws the selected squads; the full withdrawal needs a confirm and keeps
survivors. P1.

**H9. Early pacing** (pacing). Iunu: +1 production, Swordsmen 105 turns, every building 80-170 turns.
Focus does nothing at size 1-2. Capital at T66 had 0 of 4 buildings (partly my picks; the game never
warned). Late: Men-nefer 27 production, Pikemen 5 turns (rows 49-50, 130). Fix: a production floor per
city (e.g. 3), cheaper first builds, a warning on any build over ~20 turns, costs that scale with the
age (user note). P1.

### Medium

- **M1. Research shows "1 turn" while date-gated.** "Feudal Levies 1 turn" with "Available from 500 CE"
  at 292 CE; top bar "Plate Armor 1t" for 20+ turns; advisor does not pick when all next techs are
  gated (rows 105, 127). Show "waits for 500 CE (17 turns)".
- **M2. Government change is a trap.** Monarchy for 300 ADM applied instantly; card warned "-2
  stability"; real effect Authority 33 to 17, which locks all laws ("Under 25: no new laws") (row 107).
- **M3. Trade route plundered every turn.** "Rebels plunder your land trade route to D'mt" 90 times;
  the 100-gold agreement paid nothing for 87 turns; no fix offered (row 116).
- **M4. Wrong army labels.** "Army at Men-nefer" while in Sinai or at Siwa; root cause: tile marches
  never update unit.regionId (rows 26, 33, 82). Session 1 and 2 too.
- **M5. Lenses block each other.** Research boost "Map" turns on the Supply lens silently; then
  "Settlers wait" opens a plain tile sheet instead of the settle lens (rows 43-44).
- **M6. Settle lens UX.** Lens vanishes after closing the sheet; does not centre on the settler;
  legal sites can be off-screen under the sheet; 0/0/0 desert sites offered with no warning; no
  disband for settlers, so extra settlers block the turn helper and stand idle (rows 37, 45, 69, 126).
- **M7. City build list.** Identical rows with no tile ("Fishing boats on coast" x7); second tap on the
  same row lost (reflow); no reorder or move-to-front; removing loses progress; no toast (rows 23, 51-53,
  130).
- **M8. Inland cities offer ships.** Iunu and Siwa (river / oasis) list Trireme, Longship, Bireme;
  Harbor row has a queue button in Siwa while "needs a coast" (rows 51, 128). User request confirmed.
- **M9. Buildings never say what they do.** Granary, Irrigation, Bazaar, Drill Yard: no effect text;
  tapping a row shows nothing (row 128). Battle build menu does show effects on hover (row 143).
- **M10. Grudge logic inverted.** Libu sacked Iunu and their grudge against me rose +20 "Killed their
  soldiers"; attitude still "Warm +16" (row 65).
- **M11. Pre-battle odds hidden.** "Unlikely" / "Uncertain" before; "Auto wins this battle 0% / 38% of
  the time" only after (rows 103, 157). Show the number before the choice.
- **M12. Siege-and-wait beats assault.** Siwa (3,975 defenders) surrendered to my 3,000 when walls hit
  0, no battle, no losses, +400 gold (row 86). Garrison should sally or the surrender needs a fight.
- **M13. Second wave invisible.** Cavalry "joins in a second wave"; the Reserve button appeared only
  late; 12 squads died beside the waiting cavalry (rows 148, 152).
- **M14. Walls words disagree.** Libu panel "no walls", army sheet "walls 215/260" (row 82).
- **M15. Events repeat and ignore setting.** Refugees at the Border twice in 17 turns; Harsh Winter on
  the Nile; Bronze Age Collapse at T30 (rows 35, 84, 89).
- **M16. Battle-trained squads are paper.** 200 strength vs 1,000 for a map unit; 7 musketeer squads
  died taking one tower (row 146).
- **M17. "Move now" preview mismatch.** Preview "2 turns", arrived at once (row 120). (Move now itself
  answers "march starts next turn": good.)
- **M18. Buy land charges more than shown.** 120 shown, 135 charged; session 1: 144 shown, 159 charged
  (row 55). Owning an iron tile gives no iron without a mine; not said.

### Low

- L1. Era banner covers the top bar for 5-30 turns (rows 110, 118).
- L2. Build menu icons blank on first open (rows 95, 136).
- L3. Camp name changes between battles ("Expedition camp" / "Headquarters tent") (row 135).
- L4. Anachronistic names: Riflemen and Dragoons in 1024 CE (row 133); Oil in 596 BCE (row 46).
- L5. "Why?" opinion shows one line "Standing +8" (row 60).
- L6. Ruler changes not in the Log; 10 rulers in 170 turns (row 117).
- L7. Log floods with per-turn Upkeep lines; 4 lines visible on a phone (row 115).
- L8. Independent cities look like majors on the map (row 25).
- L9. First-contact text "your scouts crossed into their land" when they came to you (row 71).
- L10. City opened from the list does not centre the map (row 131); strategic-zoom icons ignore taps in
  march mode (row 132).
- L11. Native browser confirm for New game (row 12).
- L12. "50% rule / at most N houses" text: cut per user decision (row 160).

## 5. AI report

- **Expansion: good.** 35 majors own 321 cities at T172 (262 founded in play); at T300 the top five
  hold 27-36 cities. Kanesh founded Durhumit ~1,000 km from home on one of my best sites (row 71).
- **Armies: idle.** ~10% of units move in a turn; wars rarely produce battles (13 wars declared in 172
  turns worldwide, 11 sieges). The Kanesh war was 14 turns of a stack sitting in one town.
- **Exploration: none.** I met 1 major by T80, 2 by T165, 3 by T244. AI never scouts me either.
- **Tribute: aggressive and mechanical.** Demands scale with my treasury (up to 2,818) and repeat every
  ~5 turns from two peoples, including a Friendly trade partner.
- **Independents: the only active actors.** Raid parties, sacks (Iunu T79), demands; they act and
  move (23 of 336 units moving).
- **Battle AI:** defends inside the walls, trains reinforcements (three 200-strength squads), breaks
  and routs when towers fall; never sallied against a besieging army.
- Recommendations: war goals that march and siege (aiOperations), peacetime scouts, demands based on
  relative power with long cooldowns, independents that react to being attacked by their victims.

## 6. Mechanics report

- **Pacing:** early city production 1-9; builds 20-170 turns; late 7-27 production and 5-8 turn units.
  Costs rise a little by era (Swordsmen 107 to Pikemen 147; Granary 80 to Irrigation 160) but not with
  production. User note: scale costs with age and with city output, and consider a soft city cap
  (no cap now except land; AI reaches 36 cities).
- **Focus:** no effect at size 1-2 (rows 22, 50).
- **Develop / Infrastructure / Defenses:** work (row 129) but are tiny next to the bank. Session 1 saw
  Develop undone next turn; this session's +1 stayed (17 to 18).
- **Research:** date-gated by history; science banks while waiting (good), the UI hides it (M1).
- **Siege:** walls HP fall 45 a turn; at 0 the city surrenders with no fight (M12).
- **Loyalty:** conquests rebel within ~10 turns (H4).
- **Tribute and war:** refusing a major leads to war within a few turns; paying does not always prevent
  it (H2).
- **Supply:** -10 a turn in the field; 0 supply left a unit alive for 50 turns (C2).
- **Battle economy:** works; squads trained in battle are 200 strength and vanish after the battle.
- **Victory rule (user):** lose only when all buildings are gone; Retreat currently ends the battle.

## 7. Mobile landscape UX redesign (844x340, Safari bars on)

1. **One sheet at a time.** Opening a sheet closes the others; demands, first contacts and era news go
   to a chip queue, never auto-open over a card.
2. **No squeezed cards.** Pre-battle, event and peace cards always take the full centre; minimum width
   480 px; never share the row with a side panel.
3. **Fixed controls.** End Turn, chips and speed buttons never move when panels open.
4. **Stacked idle chip (user idea).** One "Idle N" chip; each tap selects the next idle unit. Same in
   battle. Add a **Hold** order: the unit stays put and drops out of the idle count (user idea);
   besieging armies count as holding.
5. **Battle HUD.** Collapse the Defender housing panel by default (and drop the 50% text); alerts as a
   small stack that fades; field gets at least 70% of the screen; "Find army" and "Find enemy keep"
   buttons; minimap toggle.
6. **Placement.** Green legal ground, drawn edge, footprint preview, explicit "Build here", menu stays
   closed after placing; "Stop" renamed "Stop working" and placed away from the tiles.
7. **City panel.** Focus row at the top; effect text on every building and improvement; tile name and a
   map highlight on improvement rows; reorder by drag or "move up"; toast after queueing.
8. **Map.** Opening a city centres it; the settle lens stays on until a site is chosen and centres on
   the settler; a "next good site" button.
9. **Safari bars.** Every sheet sized to the visible height (the --app-height fix), tested at 340 px.

## 8. Fun analysis (opinion)

- **Most fun:** choosing a city site with the green/red lens; the first time the battle economy
  clicks (laborers, barracks, cannons, the tower falls and the enemy breaks); a siege that ends in a
  surrender and a treasury.
- **Least fun:** turns 1-60 with 1-3 production; paying the tenth tribute; watching a conquered city
  rebel with no way to act; a won battle logged as a loss; hunting a legal building spot.
- **Missing tension:** no real threat from majors (their armies sit), no use for the bank, no
  exploration. The world is busy in the Log but quiet on the map.
- **Missing goals:** era goals exist (Expand, Wealth, War, Culture, Science) and are good, but they are
  buried in Research and Legacy. A short goal tracker on the map would give each age a shape.

## 9. Top 10 fixes

1. Battle result and campaign result are one object (C1, C2).
2. One sheet at a time on phone; demands and contacts queue as chips (H5).
3. Real gold sink: rush production with gold, scaling with era; spend power points on real choices (H1).
4. Tribute rework: based on relative power, cooldowns, paying buys peace (H2).
5. AI armies that march, siege and explore (H3).
6. Battle placement with green ground and a drawn edge (H6).
7. Battle orders: "All" without camera jump, attack-move default, auto-engage; Retreat withdraws (H7, H8).
8. Early production floor, cost scaling by age, warning on long builds (H9).
9. Capture card (Conquer / Raze / Tributary / Free) plus a conquest loyalty floor (H4, H4b).
10. Research gate shown honestly; building effect text everywhere (M1, M9).

## 10. Roadmap

- **Wave 1 (P0, 1 week):** C1, C2; state audit for ghost units; test "routed defenders equals capture".
- **Wave 2 (phone UX):** single-sheet rule, chip queue, stacked idle chip, Hold order, battle HUD
  collapse, 50% text removed, placement overlay.
- **Wave 3 (economy and pacing):** gold rush purchase, age cost scaling, production floor, power point
  uses, laws with effect text, government change preview.
- **Wave 4 (AI):** war operations, scouts, tribute rework, independents' grudge fix.
- **Wave 5 (feel):** conquest loyalty, events by setting and cooldown, era goal tracker, names by era,
  unit regionId on tile marches.

## 11. Final verdict

The game works for 300 turns without a crash and has two genuinely good pieces (the map with its
settling flow, and the battle economy). It is not yet fun across a whole game: the macro layer gives
the player money and points with nothing to do with them, the AI fills the Log but not the map, and
on a phone the screens pile up. The most urgent problem is trust: a battle you win must count. Fix C1
and C2, give the bank a purpose, and enforce one sheet at a time on phones; those three changes would
move the game more than any new feature.
