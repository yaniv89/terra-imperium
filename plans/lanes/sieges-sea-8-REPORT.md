# Lane sieges-sea-8: report (U9, wave 5)

ponytail loaded at session start (Skill `ponytail`, whole SKILL.md printed; the session start hook also printed "PONYTAIL MODE ACTIVE").

Base: claude/integration b25b72a4. Targets: battle buildings and walls, battle naval, battle fun at 8.

## For the lead

1. **Walled mirror assault (F98) is not fixed.** I measured the root cause and tried four levers; none moved the row, so all are reverted and nothing in assaults changed. A design call is needed (options below).
2. **Sack length** is fixed in the sandbox the graders play, not in the rules: the sandbox sack now follows the campaign's own rule (garrison under half the party). The campaign already does this (raids.js SACK_GARRISON_RATIO 0.5). One seed of 21 lasts 86 s, the rest 97 to 239 s.
3. **Sea start** is fixed: the fleets form up 20 tiles apart (was 12). SETUP_VERSION 30 to 31.

### Walled mirror assault: what decides it (parityEco N=16 to 32, MATCH=0, fort 2, AI v AI)

| Lever tried | Attacker wins bronze / classical>kingdoms | Defender auxiliaries trained | Battle |
|---|---|---|---|
| Base | 32/32 and 29/32 (N=32; Auto 28/32 and 26/32) | 7.9 (attacker 25.9) | 517 s |
| City stores: the keep gives 1.2 food, 0.6 wood a second | 16/16, 13/16 | 17.7 | 523 s |
| Stores x2 (2.5 food, 1.2 wood) | 15/16 | 28.6 (more than the attacker) | 509 s |
| Stores x2 and walls, gate 3x HP | 16/16, 16/16 | 30.3 | 544 s |
| Stores x2 and the town hall trains foot inside the ring | 16/16, 13/16 | 28.2 | 505 s |
| Storm bonus on the keep (KEEP_STORM_MULT) only once the garrison is under a regiment | 16/16, 13/16 | 7.8 | 636 s |
| Storm rule and stores x2 | 16/16, 13/16 | 34.5 | 625 s |

What the probes show (ecoProbe, siegeProbe N=8):
- The defender's 4 laborers walk out of the 9-tile ring and are all dead by 120 s; its food stays at 18 and it never trains again. The attacker's camp is 79 tiles away and never threatened: 14 laborers all battle.
- The defender's barracks goes up 12 tiles out, outside the ring, where the attacker stands. Its trained men come out there one at a time: each deals 19 damage against 104 for an attacker auxiliary.
- So giving the defender income or HP does not help: it feeds men into the same trap, and over a 20-minute clock the attacker's free economy always wins.

Options for the lead (each needs aiDuel and parityEco, and the Auto retune through autoCalib in autoBattle.js, which this lane may not touch):
- A. Defender AI in a walled city keeps its laborers and new soldiers inside the ring while it stands (no barracks outside, trained men hold at the keep), plus the city's stores so it can still train. Closest to "a city falls only when its defence is beaten".
- B. The siege camp pays: an attacker outside a walled city loses supply (attrition) over time, so a long siege costs it. Total War and Civ both make the besieger pay.
- C. Shorter siege clock for a walled city (the defender holds at the clock, Q5). Cheap but changes the 20-minute rule in master plan 6.1.

## Findings

| # | Finding | Root cause | Fix | Before | After |
|---|---|---|---|---|---|
| 1 | Sea battle: ships hit before any order (BC 47) | The fleets formed up 12 tiles apart (NAVAL_GAP 6); both close at about 5 tiles a second | world.js NAVAL_GAP 10; mapgen.js naval map: open water 22 tiles each side, attacker zone from 20 tiles out, the anchorage 18 tiles east (behind the new line). SETUP_VERSION 31 | navalOpen: first hit 2.3 s (tick 46) in classical, information; 4.0 s gunpowder | First hit 5.2 s bronze, classical; 8.4 kingdoms; 6.8 gunpowder; 4.3 s modern, information, future (tick 86 or later, 28 seeds, no ship lost). Test naval.test.js "no ship is hit before tick 60" (fails at NAVAL_GAP 6) |
| 2 | Sack defence over in 44 s (BC 56, F78) | The sandbox sack put 4,000 raiders against a 6,300 garrison plus help; the campaign never makes that sack (a party sacks only a city held by under half its strength, SACK_GARRISON_RATIO 0.5) | BattleSandbox.jsx: in a sack the garrison is under half the party (284 a regiment for the balanced army) and no reinforcements come on either side. Raid and field sandbox battles unchanged | sackTrace 7 seeds kingdoms fort 2: raiders retreat at 41 to 54 s, burn 0 | 21 seeds (bronze, kingdoms, gunpowder): 86 to 239 s, median about 185 s; an idle player loses 8 of 21, so powers matter. One seed 86 s (kingdoms: pikes counter the riders) |
| 3 | Raider party arrives in pieces | Riders reach the town at 15 s, foot at 35 s, each dies alone | Tried: raiders keep together (keepTogether in thinkRaider). Reverted: parityEco raid and sack rows IN 11 of 12 to 9 of 12, and some sacks stalled to the clock | 41 to 54 s | Not shipped. Worth a battle-AI lane with aiDuel |
| 4 | Walled mirror assault 32/32 to the attacker (F98) | See "For the lead" | None shipped | 32/32, 29/32 | Unchanged |

## Proof

- parityEco N=32 TYPES=assault AGES=bronze:bronze,classical:kingdoms: IN 6 of 6 (base). TYPES=raid,sack: IN 11 of 12 (base; the one OUT, bronze cav+cav v 3, is old). The shipped change touches neither (naval map and the sandbox only), so these rows are the same after; autoCalib not rerun for that reason.
- Replay determinism: naval setups hash differently, so SETUP_VERSION is bumped once (31). Related tests below.
- sackTrace gained STR_A, STR_D and a loss-by-cause line (STR_D default 284, as the sandbox).

## Checks

- Lint: eslint --max-warnings 0 on every changed file, clean.
- Tests: `npm run test:related -- src/battle/sim/world.js src/battle/setup/mapgen.js src/components/battle/BattleSandbox.jsx` (result in the commit message); naval.test.js 6 of 6.
- Not run: full suite (shared PC), aiDuel sea rows, browser shot of the sandbox sack.

## Option A (lead, 29 Oct): built

### For the lead (decide before merge)

**The Siwa test now fails** (src/battle/sim/autoContinue.test.js, audit H-02/H-26). A player who makes one attack-move with 4 x 588 on a small walled capital (2 x 190 and militia) and never trains now wins 0 of 4 (was 4 of 4). Auto still says the attacker wins 4 of 4 with 142 men lost.
- Cause: option A lets even a weak walled town train companies at its hall (ranged fire is 4,277 of the attacker's losses). Auto assumes the attacker trains 22 companies; this player trains none.
- Not the stores (stores off: 1 of 4) and not the held keep (multiplier 1: 0 of 4). Tried and reverted: stores scaled by housing, stores scaled by the starting garrison (both 0 of 4).
- Options: (a) the hall trains only while the city's own garrison holds a regiment (a weak town cannot raise an army from nothing); (b) accept it, change the test to "a commanded assault that also trains wins", and give Auto the attacker's real training; (c) drop hall training, keep only the stores and laborers inside. I lean (a). The test is left red so the merge cannot miss it.

### What is built

- Stores (CITY_STORES_PER_SEC 2.5 food, 1.2 wood a second) while the keep stands. The walled city's hall trains infantry and ranged in turns (CITY_HALL_TRAINS, `trainsOf`); the HUD reads the hall's list (EconomyHud.jsx, TacticalBattleScreen.jsx), so the player can train there.
- Defender AI with a whole ring: laborers come in, nothing is raised outside (economyAI.js). Trained companies hold at the keep, released when hit (tacticalAI.js thinkDefender).
- A walled keep takes KEEP_HELD_MULT 0.3 of a blow while its own garrison (regiments and militia, not companies) holds CREW_FULL men (siegeRules.js `garrisonHolds`, combat.js): a city falls only when its defence is beaten. At 0 every mirror held to the clock (0 of 16); 0.25 gave 1 of 32; 0.33 gave 20 of 32.
- Auto: AUX_TRAINED.assault [22, 5] to [22, 10] (autoCalib over A and D, other constants fixed): 0 of 9 assault rows out.
- SETUP_VERSION 33. New test src/battle/sim/walledCity.test.js; siegeRules.test.js and autoBattle.test.js follow the new rule.

### Numbers (parityEco N=32, mixed, fort 2, AI v AI)

| Row | Attacker wins before | After: real time / Auto | Exchange |
|---|---|---|---|
| bronze mirror inf+inf+ranged | 32/32 (Auto 28) | **18/32** / 14/32 | 1.50x IN |
| classical mirror | not run | **21/32** / 14/32 | 1.46x IN |
| classical>kingdoms (defender one age ahead) | 29/32 (Auto 26) | 1/32 / 13/32 | IN |
| 5 v 2 rows (bronze, classical, cl>kg) | 32, -, 26 | 26, 29, 15 | IN |
| siege-engine rows (bronze, classical, cl>kg) | 32, -, 31 | 32, 32, 22 | IN at [22, 10] (2 OUT at [22, 5]) |
| town rows (no walls) | code path unchanged | as before | 9 of 9 IN |

aiDuel N=20 prince (old AI from origin/claude/integration; OO old v old, ON new defender): assault mirror bronze 19 to 15, kingdoms 18 to 17; 4 v 4 rows 14 to 9 and 17 to 9; siege rows 17 to 4 and 19 to 8. Attacker AI unchanged (NO = OO); sea rows unchanged. aiDuel-prep.mjs writes Windows backslash import paths; I fixed the copies by hand.

### Not done

- The Siwa decision above. classical>kingdoms: Auto 13 against real time 1 (WALLS_AGE_RELIEF not retuned; it moves the other age rows).
- Full suite; a mobile shot of the hall's training buttons.
