# Battle sandbox playtests: summary (2026-10-21)

Sources: the report.md and diary.jsonl on each branch `ai/human-playtest-<run>`, plus the earlier
trial run 39675315200. Run 39678805364 (rts-commander, desktop, all ages) had not pushed a branch
when this was written, so it is **not included**.

## 1. Runs

| Run (branch) | Persona | Size / lang | Steps | Battles started / finished | Ages | Cost | Fun |
|---|---|---|---|---|---|---|---|
| 39678800731 | battle-commander | phone 844x390, en | 207 | 8 / 3 | all eight | $2.38 | 3/10 (fun never above 3 of 5) |
| 39678805364 | rts-commander | desktop, en | - | not finished, no branch | all eight (planned) | - | - |
| 39678809332 | newcomer-phone | phone 844x390, en | 111 | 5 / 3 (a 4th wiped but no result screen) | bronze, classical, gunpowder, modern | $1.35 | 3/10 |
| 39678813909 | hebrew-speaker | phone 844x390, he | 151 | 4 / 1 | stone, kingdoms, information, future | $1.74 | 3/10 |
| 39675315200 (trial) | battle-commander | phone 844x390, en | 40 | 8 / 0 (about 5 steps each) | all eight | $0.47 | flat 3 of 5, not scored |

Total cost of the four runs read: **$5.94** ($5.47 without the trial).
Finished counts a result screen seen. Of the 7 results seen: 3 wins (all sack defenses held),
4 defeats (modern walls, bronze field, gunpowder naval at the clock, future sack at the clock).

## 2. Scores

### By battle area (average of the three full runs, out of 10)

| Area | commander | newcomer | hebrew | Average |
|---|---|---|---|---|
| Setup | 7 | 6 | 6 | 6.3 |
| Deploy | 5 | 5 | 5 | 5.0 (never really tested: nobody placed a unit) |
| Selection and orders on touch | 5 | 6 | 4 | 5.0 |
| Unit readability and size | 3 | 3 | 6 | 4.0 |
| Camera | 5 | 4 | 5 | 4.7 |
| Combat clarity | 3 | 3 | 3 | **3.0** |
| Economy / workers HUD | 6 | not scored | 6 | 6.0 (one laborer trained per run) |
| Powers | 5 | 4 | 5 | 4.7 |
| Buildings and walls | 5 | 4 | 3 | 4.0 |
| Naval | 1 | 1 | 1 | **1.0** (trial: 3) |
| End of battle and result screen | 6 | 3 | 3 | 4.0 |
| Speed and smoothness | 4 | 7 | 7 | 6.0 |
| Mobile layout | 4 | 5 | 5 | 4.7 |
| Hebrew | - | - | 5 | 5.0 (one run) |
| Fun | 3 | 3 | 3 | **3.0** |

### By age (session scores out of 10)

| Age | Sessions (persona: kind score) | Average |
|---|---|---|
| Stone | commander field 3, hebrew field 3 | 3.0 |
| Bronze | commander walls 3, newcomer field 4, newcomer base defense 4 | 3.7 |
| Classical | commander naval 1, newcomer walls 3 | 2.0 |
| Kingdoms | commander sack 5, hebrew walls 3 | 4.0 |
| Gunpowder | commander field 4, newcomer naval 1 | 2.5 |
| Modern | commander walls 5, newcomer sack 5 | 5.0 |
| Information | commander naval 1, hebrew naval 1 (trial naval 2) | 1.0 |
| Future | commander sack 6, hebrew sack 4 | 5.0 |

By kind the picture is clearer than by age: naval 1.0 (4 sessions), walls 3.5, field 3.6, sack 5.0.
The age averages mostly follow which kind of battle each age happened to get.

## 3. Top 15 issues

Severity: 3 = blocks play, 2 = hurts a lot, 1 = friction. Screenshots are on the run's branch
under `plans/ai-output/human-playtest/`. Personas: C = battle-commander, N = newcomer-phone,
H = hebrew-speaker, T = trial.

| # | Sev | Personas | Issue | Evidence | Likely code |
|---|---|---|---|---|---|
| 1 | 3 | C, N, H, T | Sea battles draw grass, rock and road: ships sit on land, the minimap shows land or a pond, the trial even had tanks in the fleet. All 6 naval sessions. | C #82 shots/step-082.jpg, #184 shots/step-184.jpg; N #92 shots/step-092.jpg; H #108 shots/step-108.jpg; T #35 shots/step-035.jpg | src/components/battle/BattleSandbox.jsx (the `&sea` setup, line ~109) and sandboxTile.js; src/battle/setup/mapgen.js generateNavalMap; src/battle/render/BattleRenderer.js ground pass (naval tint, ~407-480) |
| 2 | 3 | C, N, H | At sea the fleets never meet: orders seem ignored, Find and Enemy land on "their keep" / "take the keep now", ships get lost, and N got a Defeat at the clock with 0 losses on both sides. | C #179 shots/step-179.jpg, #195 shots/step-195.jpg; N #96 shots/step-096.jpg, #100 shots/step-100.jpg; H #102 shots/step-102.jpg | src/battle/setup/mapgen.js (naval map still has a `keep`), src/battle/sim/objectives.js, battleHudModel.js (Enemy/Find targets and wording) |
| 3 | 3 | C, N, H | Nobody can tell who is winning: no strength bar, "Base 1 vs 9" is not explained, the army shrinks with no warning (6 squads to 1, modern army to 0). | C #113 shots/step-113.jpg, #152 shots/step-152.jpg; N #28 shots/step-028.jpg; H #85 shots/step-085.jpg | src/components/battle/BattleHud.jsx, battleHudModel.js |
| 4 | 3 | C, N, H | Field and wall battles drag with no visible goal: minutes at 3x to 4x with no end (5 of 8 C battles never ended), the enemy trickles in unit by unit (H stone), and sacks end before the player acts (C kingdoms, 44 s). | C #37 shots/step-037.jpg, #136 shots/step-136.jpg; H #50 shots/step-050.jpg; C #102 shots/step-102.jpg | src/battle/sim/step.js end rules, src/battle/sim/tacticalAI.js (enemy arrival), BattleHud.jsx (objective line) |
| 5 | 3 | H | Sack defence ends in Defeat at the clock with 2 of 12 houses lost, the player down 1,750 of 63,000 and the raiders 19,050 of 40,000. Confirmed on the screen: "you defend", Defeat, 12 min. Cause in code: once enough loot burned (`w.looted`), the clock gives the raiders the win, and nothing on screen said the loot was taken or that the last raider must be caught. | H #149 shots/step-149.jpg, diary #123 to #149 | src/battle/sim/step.js line ~69 and ~78 (looted, timeLimit), HUD loot meter in BattleHud.jsx |
| 6 | 2 | C, N, H | Units are tiny, hidden under tree canopy and city buildings, melee is a blob, health bars are thin; pinch-out "did little". | C #16 shots/step-016.jpg, #49 shots/step-049.jpg; N #66 shots/step-066.jpg; H #89 shots/step-089.jpg | src/battle/render/ (trees and buildings over units, squad markers when zoomed out) |
| 7 | 2 | N, C | The battle keeps running after the whole army is gone (All 0, no result for 8 s to over 10 s; classical never showed one). | N #30 to #32 shots/step-032.jpg, #76 to #77 | src/battle/sim/step.js (isBroken / end check), src/battle/sim/morale.js |
| 8 | 2 | N, C, H | Result screen contradicts or does not explain itself: "Defeat" with "Mixed" and "attackers' camp destroyed" for the attacker, Defeat with zero losses, "Held" with no reason. | N #32 shots/step-032.jpg, #100, #109 shots/step-109.jpg; C #168 shots/step-168.jpg | src/components/battle/BattleResultScreen.jsx, battleText.js |
| 9 | 2 | C, H | Powers menu clipped under the top bar or cut off at the bottom over the selection chip, and it stays open over the HUD (may also swallow the speed button taps). | C #48 shots/step-048.jpg, #66 shots/step-066.jpg; H #8 shots/step-008.jpg, #63 shots/step-063.jpg | src/components/battle/BattleHud.jsx (powers menu position) |
| 10 | 2 | C, N, H | Camera shortcuts land in the wrong place: Map lights up but opens nothing, Enemy goes to a building or the player's own HQ, minimap taps land on empty ground (maybe mirrored in Hebrew). | C #132 shots/step-132.jpg; N #20 shots/step-020.jpg, #62; H #72 shots/step-072.jpg | src/components/battle/BattleMinimap.jsx, minimapModel.js, battleHudModel.js |
| 11 | 2 | H, C | The last enemies cannot be found or reached: Enemy only says the base is unseen, units stick at a bridge; a modern army barely moved for 40 s after attack-move. | H #130 shots/step-130.jpg, #138; C #152 shots/step-152.jpg | src/battle/sim/pathing.js, movement.js; Enemy target in battleHudModel.js |
| 12 | 2 | C, N, H, T | Phone layout: info card, queue, pause menu and a lingering path tooltip cover the map; result text small; Fight sits below the fold on setup (every session of every run). | C #22 shots/step-022.jpg, #117 shots/step-117.jpg; N #66 shots/step-066.jpg, #34 shots/step-034.jpg; T #1 | BattleHud.jsx, EconomyHud.jsx, BattleSandbox.jsx (sticky Fight) |
| 13 | 2 | C, N, H | Powers fire with no visible effect; only the counter drops. No cost or cooldown shown. | C #19 shots/step-019.jpg, #113; N #59; H #8 shots/step-008.jpg | src/battle/sim/effects.js, src/battle/render/ (effect drawing), BattleHud.jsx |
| 14 | 2 | H | English power and order names (Entrench, Volley, Charge...) in the Hebrew kingdoms session, while the stone session was Hebrew; arrival toasts read badly and name fortress and longbowmen in the stone age. | H #63 shots/step-063.jpg, #66 shots/step-066.jpg, #28 shots/step-028.jpg | BattleHud.jsx powers/orders labels, battleText.js, locale strings (battleHebrew.test.js) |
| 15 | 2 | C | Top-bar speed button is unclear: cycles past the wanted speed, seemed stuck at 1x for five taps in bronze; the pause panel picker works. | C #32, #58 to #62, shots/step-066.jpg | BattleHud.jsx speed control |

## 4. What players liked

- The launch flow: setup, deploy, Start worked in every session of every run, with no page errors and no harness errors in any run.
- The core touch loop: select all, attack-move, tap works first time on land; bottom-bar buttons are big enough.
- Result screens are tidy and readable at phone size (men lost, XP per regiment, houses ruined, general's fate), Continue is easy to hit.
- The minimap jump to the enemy fort and the walled city, with readable buildings and health bars (C #135, #154).
- Actionable alerts: "archers broke", "Shaken" with Go and Rally buttons were the most commander-like moments.
- The powers menu "has real choices"; Retreat had a visible effect.
- Worker training feedback: cost, queue progress, food drop, confirmation, clear in Hebrew too.
- Hebrew right-to-left layout correct on the result screen and most of the HUD.
- The future sack ran smoothly with the lowest frustration of all runs.

## 5. Proposed fix lanes

1. **Naval lane:** make `?battleSandbox&sea` and campaign sea battles draw water and spawn ships on it, drop the keep objective and land units at sea, aim Enemy/Find at the fleet, and add a naval end condition (issues 1, 2).
2. **Battle state and endings lane:** strength bar and objective line in the HUD (with the loot meter in sacks), end at once when a side has no squads, faster rout endings and enemy arrival in one block, and a result screen whose headline, reason and one plain sentence agree (issues 3, 4, 5, 7, 8, 11).
3. **Readability lane:** cut away trees and buildings over units, squad markers and strength bars when zoomed out, more zoom-out, visible power effects with a short toast (issues 6, 13).
4. **Phone HUD lane:** powers menu inside the safe area and closing on map tap, compact cards and pause panel, tooltips that time out, sticky Fight, a clear speed picker, camera shortcut and minimap fixes (checked in RTL), and the missing Hebrew strings (issues 9, 10, 12, 14, 15).

Not covered by any run: deploy placement, circle select, path drawing, workers gathering and building, a wall breach, desktop (the rts-commander run).
