# Lane battle-truth: report

Ponytail loaded first (Skill `ponytail:ponytail`, the whole SKILL.md printed; the session start hook also printed PONYTAIL MODE ACTIVE).
Local worktree session, branch `claude/battle-truth` from claude/integration 039d3c18. No API use. No sim rule changed
(src/battle/sim untouched), so no SETUP_VERSION bump and no parity rerun. No file under src/engine/ changed.

Source: civ-veteran 40746164607 and warmonger 40746170250 diaries (scratch copies), steps named below, played on a0312e08.

## Findings

| # | Finding | Root cause (checked on integration) | Fix | Evidence |
|---|---|---|---|---|
| 1 | Whole army lost fast, out of sight | Three causes, none in deploy. **Orders:** civ-veteran 101, 233, 305 and warmonger 79 to 83, 245, 290 all end in "Enemy, then Attack it" on a building. On a0312e08 that sent a focused `attack` on the building for every squad: they walk past the enemy army, one by one, and die under the walls. lead-battle-fixes (merged after the playtests) made a group's attack on a building an attack-move: sandbox 0 of 8 wins and 8,600 of 8,600 lost before, 7 of 8 wins after (its report). **Odds:** warmonger 240 and civ-veteran 302 sent one regiment (the whole army) at a city: the gunpowder save's army is one Kingdoms-age infantry regiment against 11 defending squads (eraBattle.sim.js below); the card said "bad odds". That loss is honest. **Camera:** the fight happened where the camera was not (the Enemy button had moved it to their keep), and the only sign was "Pikemen destroyed" | The battle's first clash brings the camera there once; "Your Pikemen are under attack" (with Go) whenever your soldiers are struck, at most every 20 s (battleHudModel.js `nextAlerts` kind `troopsHit`, BattleHud.jsx) | Test battleHudModel.test.js "your soldiers struck are told". Browser (844x390, sandbox small army vs balanced, open field): battle-truth-shots/finish-en-clash.jpg, "Your Longbowmen are under attack" with Go and the camera on the fight |
| 2 | "Finish now" does not end the battle; Retreat "failed" | Finish now set 16x, and the loop caps a frame at 250 ms of clock, so a 20-minute economy siege needs 75 s or more of real time, far more on a slow phone or the CI browser; the banner then vanished and nothing said the battle was finishing (civ-veteran 238, 313; warmonger 88, 250). Retreat: the last squad fled, and armyGone counts fled squads as gone, so the banner said "Your army is gone" while the chip showed the fleeing squad at 97% (civ-veteran 311) | At FINISH_SPEED the loop runs as many ticks as fit in 40 ms of each frame (battleLoop.js), no sounds for those ticks; the screen shows "Finishing the battle at full speed: m:ss of m:ss. The result comes next." After a retreat the banner says "Your army has left the field". The old "Attack it" note no longer covers the banner (civ-veteran 102) | battleLoop.test.js "Finish now runs the battle flat out": ends with a frozen clock and replays to the same hash. No browser shot (see Not checked) |
| 3 | Switch to Auto returns to the map with no result | r3-campaign (merged after the playtests) already opens the report of the player's own Auto battle of this turn with nothing to replay (Auto defences: warmonger 218, 273, 298; its shot 7b-after-auto). Still silent: a Command switched to Auto when the rest has no rounds to replay (army already gone: civ-veteran 106, warmonger 294), because the entry is `commanded` and was skipped | `reportToTell` (battleReportEvents.js): a switched battle always opens its report, "instant battles" or not | battleReportEvents.test.js |
| 4 | "Yours 16,160 of 16,160" after a total loss; "Auto wins 100%" after it | The row sits under "Men lost" and was right (16,160 lost of 16,160), but read as "16,160 kept". The Auto line is Auto's chance from the battle's start (autoCompare.js), and Auto does not fight the enemy's standby troops that a commanded battle calls in (Zafar: "30,000 men are coming to relieve them", 44,900 at the end), so "it counts the same either way" was false there | Row reads "16,160 lost of 16,160" (en, he). When their relief joined, the line reads "Auto wins this battle 100% of the time, but Auto does not fight the 30,000 men who came to their aid here." | battleHudModel.test.js "the Auto line names the relief", battleReceiptView.test.js. Browser: battle-truth-shots/receipt-en-844.jpg ("20,000 lost of 36,000") |
| 5 | Unit type did not match the army (civ-veteran 308) | Not a bug: units keep their age (the user's rule). The gunpowder save's army near Zafar is `infantry`, age kingdoms, strength 1000: Pikemen in the macro state too. The modern army had a Pikemen regiment beside Rifle Infantry; "All" names the first squad | None | `AGE=gunpowder TARGET=Zafar npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/eraBattle`: `macro army: infantry(infantry) 1000 age kingdoms`, `side 0 (player): infantry 1000`, `side 1 (ai): 11 squads` |

## The lead's manual playtest (plans/playtests/manual-2026-10-29.md, section battle-truth)

| Item | Root cause | Fix | Evidence |
|---|---|---|---|
| Assault melted the army; warn before walls without siege engines (lead's design call) | The warning existed since I213 (14 Oct, warModel.js `siegeAdvice`) but was plain brass text among other notes | The card shows it as a warning box like "Hopeless", led by "No siege engines." (en, he). Not a block: the player chooses | PreBattleModal.jsx `pre-battle-siege-advice` |
| Finish now did nothing | As finding 2 | As finding 2 | As finding 2 |
| Attack-move clicks eaten by the top objective bar | The status panel (Army, objective, Base) was `pointer-events-auto` with nothing to press in it, so taps and clicks on the field under it were lost | `pointer-events-none` on that panel (BattleHud.jsx `battle-status`); its buttons live elsewhere | |
| Sandbox Switch to Auto skipped the result | The sandbox has no campaign Auto: its onAbandon only closed the battle | Switch to Auto is offered only with a campaign Auto behind it (`onSwitchAuto`): HUD menu, retreat dialog's "Auto instead" and the army-gone banner | |
| "Defeat" beside "Pylos holds on" | The defender lost the battle but kept the city; the line read like a win | "Pylos is still yours, but you lost the battle and the enemy gained ground" (en, he) | battleReceiptView.test.js |
| "1 of your regiments lost" when only militia defended | The report counted the militia row (temp troops, never a map unit) as a regiment | Rows with `temp` (militia, synthetic) are not counted as regiments lost or destroyed | battleReportsModel.test.js "a city's militia wiped out" |
| Enemy base count rose mid-battle (3 to 5, 7 to 9) | Not a bug: their laborers finish buildings. Already told by an alert with the new count ("One more base building to burn: 9 now") (battleHudModel.js kind `enemyBuilt`, playtest 40650979770) | None | battleHudModel.test.js "their laborers finishing a base building is told" |
| Arrow Storm ring over own troops | Not a bug in the sim: impacts skip the caster's side (effects.js:244 `q.side === imp.side`) | The power's description says "Your own troops in it are not hurt." (en, he) | |
| Camera "All" does not centre | All only selected | All with none of the army on screen frames it (TacticalBattleScreen.jsx `offScreen`, shared with Idle) | |
| Spearmen shown as Swordsmen on the card | warModel.js `armyView` named every unit by the nation's age; units keep their own age | Each unit is named (and grouped) by its own `ageId` | warModel.test.js |
| Roof fading, squad bars as a blob, no default follow | Not taken (time; the lead said only after the core items) | | |

Q3 kept: Finish now runs the same sim to its own end (base buildings or the clock); nothing ends a side with bases early.

## Tools added

- `.claude/skills/battle-lab/eraBattle.sim.js`: an era save's commanded attack (BEGIN_TACTICAL_BATTLE, buildCommandedSetup), the macro army next to the battle's squads, then seeds with POLICY keep or idle.
- `.claude/skills/battle-lab/finish-shot.mjs`: a lost battle in a real browser (small army, open field, 3x): the clash, the banner, Finish now, the result; prints the wall-clock seconds Finish now took.

## Tests

- New: battleLoop.test.js (Finish now), battleReportEvents.test.js, two cases in battleHudModel.test.js; battleReceiptView.test.js updated to "lost of".
- `npm run test:related` over the changed files: 16 files. Failures under the shared machine's load were 5 s timeouts (battleLoop live replay, kernel, tacticalBattle, build-edge-engine hook); all pass rerun alone with longer timeouts. battleReceiptView needed the new wording.
- `npx eslint --max-warnings 0` on every changed src file: clean.

## For the lead

1. Decided by the lead (odds-truth Q1 A): Auto will fight with the same standby troops as Command; odds-truth builds it. Once it lands, the "Auto does not fight the N men" line here never fires and can be removed.
2. Not done: a stronger "Unlikely" or "Hopeless" warning before Command (warmonger report fix 5). Odds wording is odds-truth's.

## Not checked / risks

- No real-browser shot of Finish now or the "finishing" line. Three sandbox runs (finish-shot.mjs: 844x390 twice, 1600x900 once) never reached the army-gone banner. The player's side keeps training soldiers (16,000 "came through" in receipt-en-1600.jpg), so the camp burns first. That is right: "none is coming" would be false. The banner needs a commanded campaign battle with no training. The headless loop test (frozen clock, same hash) is the evidence. Lead: superseded standby call, decided in odds-truth (Q1 A).
- mobile-check: shots done for 844x390 en (finish-en-clash.jpg, receipt-en-844.jpg), 844x390 he (he-844-clash.jpg: the Hebrew alert, right to left, truncated by the chip width as other alerts are) and 1600x900 en (desk-en-clash.jpg, receipt-en-1600.jpg). Not shot: the pre-battle siege warning box (campaign only), "finishing", "left the field" and he at 1600x900.
- The first-clash camera moves once per battle, with no off-screen test. A player who is placing a building at that moment sees the camera jump.
- Status panel `pointer-events-none`: its `title` tooltips no longer show on desktop hover.
