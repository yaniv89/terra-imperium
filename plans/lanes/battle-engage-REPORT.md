# battle-engage lane report

ponytail read in full at 08:43 UTC, 28 Oct 2026 (`cat .claude/skills/ponytail/SKILL.md`, whole file; the session start hook also printed PONYTAIL MODE ACTIVE).

Target: Battles 8/10. Round 2 battle playtest 40650979770 (battle-commander) and 40650976677 (civ-veteran). Branch `claude/battle-engage`, merged with `origin/claude/integration` (d8c816e6) before the push. SETUP_VERSION 28 -> 29. No API use.

## 1. CRITICAL: the gunpowder "field" battle never engaged (step 108)

**Root cause, traced.** The playtest's "field" link has no `&fort`, and the sandbox defaults to `fort=2`. With no city, fort 2 makes `battleTypeOf` an **assault** (20-minute clock, "hold to the clock" for the defender). The player's attack-move tap (step 86) landed on its own base (shot step-094: the army stands in its own blue-outlined camp, Idle 19). The defender AI only marched out in **field** battles (`fieldMarchDue`), so it held its unwalled base for all 20 minutes and won on the clock with 0 losses on both sides.

Reproduced headless with the sandbox's exact inputs (new `REAL=1` mode of battle-lab `stallTrace`: the river-mouth tile, generals, powers, the six region buildings, fort 2), the player idle:

| age, fort 2, player idle | before | after |
|---|---|---|
| stone seeds 7, 8 | timeLimit 1200 s, enemy march never, first blood never | defender campDestroyed 601 s / 598 s, march 433 s, first blood 490 s |
| bronze seeds 7, 8 | timeLimit 1200 s, never, never | timeLimit 1200 s (defender won), march 414 s, first blood 464 s, attacker army 7120 -> 0 / 394 |
| gunpowder seeds 7, 8 | timeLimit 1200 s, never, never | campDestroyed 634 s / 659 s, march 444 s, first blood 495 s |

Fixes:
- `src/battle/sim/tacticalAI.js` thinkDefender: an assault with no wall ring standing marches out like a field defender (same rule: never before the 3-minute grace, only after a third of the clock with 30 s of nobody hit). Behind standing walls it still holds (Total War garrison rule, unchanged).
- `scripts/ai/human-playtest.mjs`: the "field" setup is now `&fort=0`, so the next playtest's field battle really is one.
- The "Attack it" caption (Enemy button) now stays 30 s instead of 7 s (it timed out between the model's steps 96 to 107; a human has more time now too).

Re-run with the player's attack-move on the keep (`ORDER=attackMove`, gunpowder fort 2): first blood 19 s, ends 405 s, as before.

## 2. CRITICAL: a lost battle could not be ended (civ-veteran step 129)

With "All 0" the clock ran for minutes. Q3 is kept (the sim still ends only on base buildings or the clock); the screen now offers the end at once:
- `armyGone(hud, side)` (battleHudModel.js): no soldier of yours on the field and none on the way (laborers apart).
- TacticalBattleScreen.jsx shows a bar over the field: "Your army is gone and none is coming. The battle still runs to its end (base buildings or the clock)." with **Finish now** (the same battle run at 16x: the speed is not in the order log, so the verified replay and result are identical) and **Switch to Auto** (the existing switch).
- Real browser, 844x390: the bar appeared 33 s after the last squad died; Finish now reached the result screen in **15 s real time** (Defeat, "Your camp and base buildings were burned"), 0 page errors. Shots: `plans/lanes/battle-engage/en-gone.jpg`, `he-gone.jpg` (Hebrew, right to left).

## 3. Units idle mid-assault (step 130)

Auto-continue after a **building** falls already existed (H-26). The gap: a squad sent at an enemy **squad** (or one fighting a squad on its own) stood idle when that foe died. Now (`movement.js` acquireTargets), when its foe is dead or gone and nothing else is in sight, it goes on to the enemy's nearest base building within `CONTINUE_NEAR` (18 tiles), AoE's attack-move feel. Far from their base it stands, as before; Hold is never touched. Test: autoContinue.test.js (fails without the fix).

Not changed (design calls for the lead): reinforcements and newly trained squads still arrive idle at their edge or rally point, which is part of the "Idle 7" count in the shot.

## 4. Win bar and the base count

- The bar row is now labelled **Army** (tooltip: it is the army's strength, the battle is decided by base buildings).
- The old text "Base buildings: yours 4, theirs 9" is now a **Base** bar row, same look as the Army row, each bar against the most that side has had, so every burned building shows as the bar shrinking (shot `en-status.jpg`).
- When their count rises, an alert says why: "Their laborers finished a Barracks / One more base building to burn: 9 now" (the 8 -> 10 of step 41).

## Evidence

- parityEco N=32 (field, assault, town; bronze:bronze, classical:kingdoms; mixed): base **IN 18 of 18**, after **IN 18 of 18**. Field and town rows identical; assault rows move by 0.01 to 0.02 in ratio (e.g. classical 3-v-3 0.61x -> 0.63x).
- Tests added: stances.test.js (an unwalled assault ends in a fight, not the clock; fails without the fix), autoContinue.test.js (continue after a chased squad dies; fails without), battleHudModel.test.js (enemy-built alert, armyGone), human-playtest.test.mjs (field URL).
- Full `npx vitest run`: 499 files, 4,695 tests passed (17 skipped); `npm run lint` clean.
- engine-rules-reviewer: no rule violations; one UI defect (Finish now while paused did nothing visible) fixed: it resumes first.

## 5. Lead's added items (messages of 09:09 and 09:58)

**Warmonger 40650973042 step 84: a commanded battle with 0 squads.** Root cause traced: the defence of Shechem had no regiment in the city, only its militia (DEF-01: a militia-only defence is still a battle, so the open guard counts the militia as defenders). Headless (sandbox town, classical, 5 x 800 attackers): the one militia squad (140 to 250 men) is dead in about 130 s, while the base buildings keep the battle going (Q3). The defence card already said "Militia only" and pre-selected Auto (c5e74ddd, 27 Oct); the persona chose Command on purpose. What was broken is what came after: "All 0", Attack it silently doing nothing, no way out. Fixed by item 2's bar (Finish now / Switch to Auto; the order caption with Attack it is hidden while it shows). Test: src/components/battle/armyGone.test.js (a real militia-only defence: not gone at the start, gone once the militia falls, battle still running). I did not make the guard refuse such battles: the user's rule keeps an intentional Command playable.

**Opus 40651418969:**
1. *Squads drift to idle near home; trained squads idle at camp (step 181).* The gunpowder "field" battle there is the same fort-2 assault as item 1 (fixed, and the harness link now asks for fort 0). Trained soldiers with a rally point now **attack-move** to it instead of a plain move (economy.js spawnUnit): they fight on the way and, if the rally is in the enemy's base, raze on (H-26). The AI never sets a rally, so parity is unaffected. Test: economy.test.js. The dropped Attack taps (radial, minimap, Attack plus tap: steps 32, 66, 69) are touch input, for the battle-touch lane.
2. *Sack defence ends at 0:44 "they withdrew" (step 126).* New battle-lab `sackTrace.sim.js` (the sandbox's sack, the player idle): kingdoms seed 7, five raider squads (4,000) ride into seven 900-strong regiments plus towers, lose 76% in 50 s and the AI withdraws at its 25% line (`retreatAt`), 0 burned. The trigger is honest; the sandbox's default sack matchup is lopsided (raiders 5 x 800 against your full balanced army). Suggest for the lead: the sandbox's sack should give the defender `small` (as a campaign raid finds a weak town), or the raiders more. Not changed here. The "22,000 unaccounted" were the raiders who withdrew in order: the result card now adds a third line, "{men} came through", so lost + fled + came through = brought.
3. *Future sack: the last raider tank takes no damage (step 306).* Not reproduced. Headless (future, sack, tank placed in the town after the loot): seven defenders sent at it take it 800 -> 575 in 4 s, then the hover tank outruns them to its edge (`escaped`); counters are positive (infantry 1.75x against it). Idle defenders also pick it up. My guess: the tank was stuck (no path out) and the squads' Attack order never went out (the touch drops above). The burn limit is shown in the HUD ("Burned 2 of 2 needed"). Left open.
4. *No surrender after a wipe-out:* item 2.

## For the lead

- SETUP_VERSION 29 is taken here. battle-touch and battle-odds are active: whichever merges second takes 30.
- TacticalBattleScreen.jsx and BattleHud.jsx are touched; battle-touch may touch them too (merge by hand).
- Open: bronze fort 2 with an idle player still runs to the clock (defender wins) because the defenders chase one leftover attacker squad back and forth before going for the camp (`enemyArmyGone` needs zero squads). It is the field march's existing behaviour; Finish now covers the player's wait.

Skipped: the touch tap misses (report issue 5), powers feedback (issue 6) and the naval wording (issue 8), outside this lane's four items.

## 6. Lead's message of 10:16 (campaign playtest 40651416284)

- *Army drops to 0 with no message (steps 87, 132, 175, 224):* every regiment of yours wiped out now raises an alert, "Swordsmen destroyed", with Go to where it fell. Laborers and enemy squads don't raise it. Once the last one falls, the army-gone bar (item 2) shows at once with Finish now and Switch to Auto. In a battle with an economy, the bar also says "Your laborers can build a barracks to train more" (the HQ trains only laborers, step 224). Test: battleHudModel.test.js.
- *Goal count 2 to 3 to 5 to 6 (step 171):* the enemy-built alert (item 4) says each rise.
- *Enemy hut 1% to 82% (step 132):* not traced. Likely the inspect card moving to another building after the hut fell, or laborers repairing it. Left open.
- Tests: src/components/battle and src/i18n, 262 passed; lint clean.
