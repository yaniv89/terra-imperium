# Lane ai-armies: report

ponytail read in full at 16:30 UTC, 28 Oct (`cat .claude/skills/ponytail/SKILL.md`, whole file; the session start hook also printed PONYTAIL MODE ACTIVE).

Branch `claude/ai-armies` from claude/integration 31193b6b (the base of every comparison below). Owned: AI recruitment, garrisons and war preparation (aiLogic.js, aiOperations.js, warPlans.js, threat.js). No API use.

## What was wrong (measured on the base, seeds 11-16, 200 turns, scripted)

**Idle war stacks.** Aggressor stacks of 2+ units stood idle in one of their own cities in 53% of their war turns. A debug trace of every decision in aiOperations.js (removed before the commit) found three causes:
1. The threat radius (THREAT_KM, about 2 turns of march) counted the same enemy army against every border city in range. So each city "needed" a garrison bigger than that whole army and held every unit at home. No city had a regiment to spare for the muster point.
2. A threatened city's stack held as "its own muster point" and waited for a strike size it never reached. A 2-unit stack sends 1 unit, and a strike needs at least 2.
3. A muster whose target had no land road (for example an island) retried every turn and never marched. Rasenna gathered 2 to 16 units against Brigantes over 25 turns and never left.

**Absurd garrisons.** The largest AI garrison was 16 to 18 units (160,000 to 180,000 men) in the Kingdoms age. About 80% of the city-turns with 8+ units were a capital at peace. Every Tier-1 recruit went to the most populous city (chooseAIRecruitRegion broke ties by population) and stayed there; nothing moves an army at peace. The rest were the leftovers of a finished war's muster. The armies were not too big for the economy (about 1.3 units per city, inside the payable cap); they were all in one place. That is how a march on Zafar (round 2, civ veteran O, step 286) met 228k to 342k men. Independents' garrisons are small (6 to 7 units at most).

## Changes

Proven-game references: Civ VI and Old World AIs build up and move to the border before they declare war, concentrate one army per operation, and keep troops spread across their cities in peace.

1. **Threat in reach** (threat.js `threatOf(..., reach)`, used by aiOperations.js). Only enemy units that can reach the city next turn count (armies.js MOVE_POINTS by class). The player's threat lens is unchanged.
2. **One muster point** (aiOperations.js). A threatened city keeps the garrison its threat needs (siegeParty with the threat) and sends the rest to the war plan's staging city. The staging city no longer hops units out to defend (that would shuttle).
3. **Unreachable targets** (warPlans.js `dropTarget`, `plan.unreachable`). A strike with no road drops its target, and the next updateWarPlan picks another city.
4. **Arm before declaring** (warPlans.js `armedFor`, `prepLive`, `WAR_PREP_REF_TURNS = 8`; aiLogic.js processAIWarDecisions).
   - A Tier-1 AI that decides on a war with a casus belli first sets `nation.warPrep = { target, since }`.
   - While it prepares, its war plan arms (the plan cap trains, spare regiments gather) and recruits join the staging city.
   - It declares, without a new roll, when the stack at staging minus its garrison reaches goSize, or after 8 reference turns (speedTurns at `waitAgeOf`).
   - A prep is dropped when its target can no longer be fought, and is ignored when stale (twice the wait), for example after the nation leaves Tier 1.
   - A prep that only the weak-neighbour factor let through stays under that factor's rule: never an unjustified war.
   - Arming is skipped in explore mode and for nations with no economy (hand-built fixtures, as in processAIRecruitment).
5. **Garrisons at peace** (aiOperations.js `spreadGarrisons`, warPlans.js `PEACE_GARRISON_MAX = 6`).
   - With no war, no plan and no campaign on an independent, a city keeps at most 6 land units. The rest march to the nearest own city under 6.
   - First try was a cap of 3, sent to the emptiest city. It scattered armies beyond reach of independents, and captures of free cities fell from 6.7 to 3.5 a game. That is why the cap is 6 and the extra goes to the nearest city.
6. **Recruit placement** (aiLogic.js chooseAIRecruitRegion).
   - At war or arming, recruits go to the staging city, unless a city of ours is besieged or invaded.
   - Otherwise the order is threat first, then a city under 6 units, then population.
7. **Harness** (scripts/campaignTelemetry.mjs, worldStats.sim.js, additive keys):
   - per age: `garrisonMax_<age>`, `garrisonP99_<age>` and `unitsPerCity_<age>` (plus `_indep`);
   - `aggrStack2IdleHomeShare` and `aggrStack2IdleNoReachShare` (idle at home with no enemy that can reach the city next turn);
   - `bigGarrisons` in telemetry-<seed>.json;
   - `reach`, `city`, `threatened` and `staging` on warstacks rows.

## Evidence

compare.sh against 31193b6b, 200 turns, PLAYER=akkad. `*` = 95% interval excludes 0.

**Scripted, seeds 11-18**

| metric | base | head | diff | 95% CI | |
|---|---|---|---|---|---|
| aggressor 2+ stacks idle at home, no enemy in reach | 0.36 | 0.14 | -0.22 | [-0.34, -0.10] | * |
| aggressor 2+ stacks idle at home, all | 0.54 | 0.60 | +0.06 | [-0.09, 0.21] | |
| units per AI stack at enemy walls | 4.35 | 7.04 | +2.69 | [1.36, 4.01] | * |
| largest AI garrison, kingdoms | 16.5 | 14.0 | -2.5 | [-4.6, -0.4] | * |
| 99th percentile AI garrison, kingdoms | 13.3 | 6.5 | -6.75 | [-8.6, -4.9] | * |
| 99th percentile AI garrison, classical | 10.3 | 6.25 | -4.0 | [-5.2, -2.8] | * |
| AI land units (mean per major) | 19.2 | 19.0 | -0.2 | [-1.1, 0.6] | |
| AI gold (mean) | 2670 | 2638 | -31 | [-310, 247] | |
| wars (AI) | 8.38 | 6.00 | -2.4 | [-5.2, 0.5] | |
| wars on the player | 1.00 | 1.00 | 0 | | |
| captures | 11.4 | 9.5 | -1.9 | [-4.9, 1.2] | |
| player cities lost | 1.50 | 2.00 | +0.5 | [-1.0, 2.0] | |
| AI demands on the player | 0.13 | 1.00 | +0.88 | [0.18, 1.57] | * |
| scripted player units / gold | 9.9 / 11,880 | 6.1 / 15,658 | | | * |

No defeats, no audit violations, no non-finite values on either side.

**Passive, seeds 11-16**

| metric | base | head | diff | 95% CI | |
|---|---|---|---|---|---|
| idle at home, no enemy in reach | 0.33 | 0.15 | -0.18 | [-0.22, -0.14] | * |
| units at enemy walls | 4.87 | 5.83 | +0.97 | [-0.69, 2.62] | |
| 99th percentile garrison, kingdoms / classical | 13.0 / 10.3 | 6.5 / 6.0 | | | * |
| wars (AI) | 7.83 | 8.00 | +0.17 | [-3.05, 3.38] | |
| wars on the player | 0.67 | 0.50 | -0.17 | | |
| captures from majors | 5.67 | 3.67 | -2.0 | [-2.94, -1.06] | * |
| captures from independents | 6.17 | 5.50 | -0.67 | | |

**What the idle share means now.** The total idle-at-home share did not fall (0.54 to 0.60, inside noise). What is left is a garrison holding against an enemy that can strike it next turn, which is what the brief asked for ("a real garrison only where a threat is"). Idling with no enemy in reach fell from 36% to 14% of war turns. The strikes that do go are bigger: 7 units at the walls instead of 4.

**Long game.** endgameReachability's passive run, the same 923-turn game on base and head:
- Both end on the turn limit (COMPLETE, turnLimit, player rank 24), and AIs reach the Future around turn 600 on both.
- My first version failed this test: an AI ended the game on the Future goal. The current code passes.
- AI wars in that game: 49 on base, 32 on head.

Full suite before the merge: 512 files passed, 2 skipped (4,792 tests); lint clean. Tests: new src/engine/aiArmies.test.js (target drop, arming and its timer, a stale prep, recruit placement, the peace spread). processAIWarDecisions fixtures have no economy, so they declare at once as before. aiAccords.test.js accepts a war "declared or being armed for". The engine-rules-reviewer agent found two real bugs and two small issues, all fixed: a boosted prep could turn unjustified, a stale prep armed for ever, the wait age, and recruits taken away from a besieged city.

## For the lead (design calls)

1. **AI wars may be a little fewer.**
   - Scripted 8 seeds: 8.4 to 6.0 a game, not significant (5 seeds down). Passive 6 seeds: unchanged. The 923-turn game: 49 to 32.
   - Every prep I counted ended in a declaration (seed 13: 7 set, 7 declared; seed 16: 5 of 6). So the wars are not lost; they start up to 8 turns later.
   - A shorter wait (4) did not bring the count back on seeds 11, 14, 16; turning arming off did (7, 7, 8). The likely cause is the war-contagion chain (warContagion.js) spreading out when each war starts later.
   - Wars on the player are unchanged. If the world should stay as busy as before, the options are (a) skip arming when the nation's muster is already within 2 units of goSize, or (b) let a nation that is arming still roll on a second target. I did not build either without your yes.
2. **AI-vs-AI captures from majors fell** (passive 5.7 to 3.7, significant; scripted 4.75 to 3.25, not significant). Defenders now keep their garrison where an enemy can strike and gather the rest, so a city is harder to take. Captures from independents are unchanged after the cap-of-6 fix.
3. **AI demands on the player rose** (0.13 to 1.0 a game, significant). The arming major stands stronger at the border, which the demand rules read. I did not change them.
4. **The scripted player fields fewer units and banks more gold** (significant). It copies the AI's choices for its idle cities (campaignTelemetry createScriptedPlayer, aiProduction.chooseProduction); this lane did not change aiProduction, so this is likely a ripple of the AI world around it. Not investigated.

## Not done

- No UI line for "X is mustering on your border" while an AI arms against the player. The army is visible on the map. A nation-card line would be the natural place, but that is a UI lane.
- The `reach` threat uses base MOVE_POINTS, not the tech and perk bonuses (it slightly undercounts).
- The largest garrison at war is still 14 units: that is the muster point of a war, by design.
