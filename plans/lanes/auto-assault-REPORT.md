# Lane auto-assault: report

ponytail read in full at 2026-10-28 11:04 UTC.

## Problem
Even walled assaults (i+i+r against i+i+r, fort level 2): the attacker won 31/32 commanded but 13/32 on Auto (Bronze), 29/32 against 2/32 (Classical against Kingdoms walls). Exchange ratios were IN, the winner flipped.

## Cause
resolveBattle (battle.js) ends a battle when a side's own army breaks; its auxiliaries "never hold the line alone". In the real-time assault the attacker trains about 26 companies (the city 8, capped by housing) and they keep storming after the army's regiments break, because a side with bases loses only when its base is gone (the user's rule Q3). On Auto the attacker's three regiments broke around round 9 with thousands of fresh auxiliaries still in reserve, so the defender held. Raising AUX_TRAINED.assault alone did almost nothing (A 12 to 24: 13 to 15 wins), nor did the gate (W 1.2: 18) or the age relief (only the cross-age row).

## Fix (no sim change)
- `ASSAULT_AUX_HOLD = true` (autoBattle.js): on a walled assault the auxiliaries go into resolveBattle marked `holdsLine`, so a side is beaten only when its army AND its auxiliaries are broken (both sides; the defender's never mattered in the runs). They keep `auxiliary`, so they are still stripped from the result, counted only in `report.auxiliaries`, and the report's strength timeline and the mutual-collapse tie-break stay army-only.
- **Outside my two files, for the lead to OK:** src/engine/battle.js `ownLeft` reads `holdsLine` (one line plus a comment). The engine-rules-reviewer flagged that clearing the `auxiliary` flag instead (my first version) put the auxiliaries' men into the battle report's strength chart (battleReports.js timeline, BattleReportSheet StrengthChart). No other caller sets `holdsLine`, so every other battle resolves as before. The city still falls only when its defence is beaten. Unwalled towns, field, raid, sack, landing on an open coast: unchanged.
- `AUX_TRAINED.assault` [12, 8] to [22, 5]: what the real-time sides train (25.9 and 7.9 companies) at the parity stockpile (x 1.33): 22 x 200 x 1.33 = 5,850 against the measured 5,180; 5 x 200 x 1.33 = 1,330 against 1,580. Chosen from autoCalib over A 20/22/24, D 4/5/6/8, WAR 1.2/1.6: [20, 4] put Auto level with Command (31/30, 29/28), [22, 6] left classical 9 points too low; [22, 5] keeps Auto a little below Command. WALLS_AGE_RELIEF stays 1.2 (1.6 put Auto above Command on the classical row and moves the fort and sally rows).
- src/data/autoParity.json assault: 6/6 inside, ratio 1.05 to 2.06 (was 0.74 to 2.2).
- Test: autoBattle.test.js "on a walled assault the auxiliaries hold the line": the even bronze assault wins 24 to 31 of 32 on Auto, fewer with the hold off, no auxiliary in the result.

## Evidence: parityEco N=32, TYPES=field,assault,town, AGES=bronze:bronze,classical:kingdoms, TERRAIN=mixed
Before (cece290d):

| type | ages | matchup | tactical | auto | ratio | wins cmd | wins auto |
|---|---|---|---|---|---|---|---|
| field | bronze>bronze | i+i+r vs i+i+r | 1.174 | 1.034 | ratio=1.14x IN | 4/32 | 15/32 |
| field | classical>kingdoms | i+i+r vs i+i+r | 2.539 | 2.549 | ratio=1.00x IN | 0/32 | 0/32 |
| field | bronze>bronze | i+i+i+c+r vs i+r | 0.489 | 0.652 | ratio=0.75x IN | 32/32 | 32/32 |
| field | classical>kingdoms | i+i+i+c+r vs i+r | 1.038 | 1.358 | ratio=0.76x IN | 29/32 | 31/32 |
| field | bronze>bronze | i+i+c+r+s vs i+i+r | 0.469 | 0.555 | ratio=0.85x IN | 32/32 | 32/32 |
| field | classical>kingdoms | i+i+c+r+s vs i+i+r | 1.771 | 1.376 | ratio=1.29x IN | 6/32 | 20/32 |
| assault | bronze>bronze | i+i+r vs i+i+r | 0.795 | 1.055 | ratio=0.75x IN | 31/32 | 13/32 |
| assault | classical>kingdoms | i+i+r vs i+i+r | 0.963 | 1.520 | ratio=0.63x IN | 29/32 | 2/32 |
| assault | bronze>bronze | i+i+i+c+r vs i+r | 1.196 | 1.116 | ratio=1.07x IN | 32/32 | 32/32 |
| assault | classical>kingdoms | i+i+i+c+r vs i+r | 1.983 | 1.476 | ratio=1.34x IN | 26/32 | 32/32 |
| assault | bronze>bronze | i+i+c+r+s vs i+i+r | 0.640 | 0.520 | ratio=1.23x IN | 32/32 | 32/32 |
| assault | classical>kingdoms | i+i+c+r+s vs i+i+r | 1.121 | 0.712 | ratio=1.57x IN | 32/32 | 32/32 |
| town | bronze>bronze | i+i+r vs i+i+r | 1.200 | 1.081 | ratio=1.11x IN | 2/32 | 14/32 |
| town | classical>kingdoms | i+i+r vs i+i+r | 2.489 | 2.631 | ratio=0.95x IN | 0/32 | 0/32 |
| town | bronze>bronze | i+i+i+c+r vs i+r | 0.419 | 0.581 | ratio=0.72x IN | 32/32 | 32/32 |
| town | classical>kingdoms | i+i+i+c+r vs i+r | 0.824 | 1.219 | ratio=0.68x IN | 32/32 | 30/32 |
| town | bronze>bronze | i+i+c+r+s vs i+i+r | 0.603 | 0.396 | ratio=1.53x IN | 32/32 | 32/32 |
| town | classical>kingdoms | i+i+c+r+s vs i+i+r | 2.043 | 1.024 | ratio=2.00x IN | 5/32 | 20/32 |

After:

| type | ages | matchup | tactical | auto | ratio | wins cmd | wins auto |
|---|---|---|---|---|---|---|---|
| field | bronze>bronze | i+i+r vs i+i+r | 1.174 | 1.034 | ratio=1.14x IN | 4/32 | 15/32 |
| field | classical>kingdoms | i+i+r vs i+i+r | 2.539 | 2.549 | ratio=1.00x IN | 0/32 | 0/32 |
| field | bronze>bronze | i+i+i+c+r vs i+r | 0.489 | 0.652 | ratio=0.75x IN | 32/32 | 32/32 |
| field | classical>kingdoms | i+i+i+c+r vs i+r | 1.038 | 1.358 | ratio=0.76x IN | 29/32 | 31/32 |
| field | bronze>bronze | i+i+c+r+s vs i+i+r | 0.469 | 0.555 | ratio=0.85x IN | 32/32 | 32/32 |
| field | classical>kingdoms | i+i+c+r+s vs i+i+r | 1.771 | 1.376 | ratio=1.29x IN | 6/32 | 20/32 |
| assault | bronze>bronze | i+i+r vs i+i+r | 0.795 | 0.760 | ratio=1.05x IN | 31/32 | 28/32 |
| assault | classical>kingdoms | i+i+r vs i+i+r | 0.963 | 0.872 | ratio=1.10x IN | 29/32 | 27/32 |
| assault | bronze>bronze | i+i+i+c+r vs i+r | 1.196 | 0.833 | ratio=1.43x IN | 32/32 | 32/32 |
| assault | classical>kingdoms | i+i+i+c+r vs i+r | 1.983 | 1.141 | ratio=1.74x IN | 26/32 | 32/32 |
| assault | bronze>bronze | i+i+c+r+s vs i+i+r | 0.640 | 0.404 | ratio=1.58x IN | 32/32 | 32/32 |
| assault | classical>kingdoms | i+i+c+r+s vs i+i+r | 1.121 | 0.543 | ratio=2.06x IN | 32/32 | 32/32 |
| town | bronze>bronze | i+i+r vs i+i+r | 1.200 | 1.081 | ratio=1.11x IN | 2/32 | 14/32 |
| town | classical>kingdoms | i+i+r vs i+i+r | 2.489 | 2.631 | ratio=0.95x IN | 0/32 | 0/32 |
| town | bronze>bronze | i+i+i+c+r vs i+r | 0.419 | 0.581 | ratio=0.72x IN | 32/32 | 32/32 |
| town | classical>kingdoms | i+i+i+c+r vs i+r | 0.824 | 1.219 | ratio=0.68x IN | 32/32 | 30/32 |
| town | bronze>bronze | i+i+c+r+s vs i+i+r | 0.603 | 0.396 | ratio=1.53x IN | 32/32 | 32/32 |
| town | classical>kingdoms | i+i+c+r+s vs i+i+r | 2.043 | 1.024 | ratio=2.00x IN | 5/32 | 20/32 |

After the `holdsLine` fix (autoCalib over the after run, auto only) the classical even assault reads 29 / 26 (ratio 1.10); every other row is the same. Assault winner gaps after: 9, 9, 0, 19 (Auto above, as before), 0, 0 points. All 18 rows IN. Field and town rows are byte for byte the same as before.

Robot garrisons (ASSAULT_ROBOT_MULT was calibrated on the old auxiliaries), parityEco ROBOT=defender TYPES=assault AGES=future:future,information:information N=16, after:

| type | ages | matchup | tactical | auto | ratio | wins cmd | wins auto |
|---|---|---|---|---|---|---|---|
| assault | future>future | i+i+r vs i+i+r | 1.022 | 0.531 | ratio=1.92x IN | 16/16 | 14/16 |
| assault | information>information | i+i+r vs i+i+r | 0.969 | 0.531 | ratio=1.82x IN | 15/16 | 14/16 |
| assault | future>future | i+i+i+c+r vs i+r | 0.652 | 0.589 | ratio=1.11x IN | 16/16 | 16/16 |
| assault | information>information | i+i+i+c+r vs i+r | 0.882 | 0.589 | ratio=1.50x IN | 16/16 | 16/16 |
| assault | future>future | i+i+c+r+s vs i+i+r | 0.586 | 0.316 | ratio=1.86x IN | 16/16 | 16/16 |
| assault | information>information | i+i+c+r+s vs i+i+r | 0.782 | 0.364 | ratio=2.15x IN | 16/16 | 16/16 |

6/6 IN, winners within 2 of 16.

## Open (not in this lane's files, for the lead)
Four field/town rows still disagree, the other way (Auto too generous to the attacker), the same before and after: field even bronze 4 cmd / 15 auto, town even bronze 2 / 14, field classical>kingdoms with siege 6 / 20, town classical>kingdoms with siege 5 / 20. None responds to AUX_TRAINED.field (2 to 10), AUX_CLOSENESS (1.5, 3) or the town counts. The even rows look like Auto's fortune band (battle.js BATTLE_FORTUNE 0.3) letting an even attacker win where the real-time defender holds its base to the clock; the siege rows like Auto counting a classical siege engine against kingdoms troops in the open. Both need battle.js or the sim, owned by other lanes. Proposal: a lane on battle.js to test BATTLE_FORTUNE 0.15 to 0.2 and the siege class's field weight with parityEco field,town.

## Checks
lint clean on the touched files; autoBattle, battleOdds, battleOutcome, battleThreshold, battleSwitch, battleVerify tests green; full `npx vitest run` (before the battle.js one-liner): 504 files, 4720 tests passed, 17 skipped; after it, `npm run test:related -- src/engine/battle.js src/engine/autoBattle.js`: 321 files, 2937 tests passed, 17 skipped. engine-rules-reviewer: one finding (the timeline), fixed as above.
