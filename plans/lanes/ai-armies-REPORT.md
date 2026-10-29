# Lane ai-armies: report

ponytail read in full at 16:30 UTC, 28 Oct (`cat .claude/skills/ponytail/SKILL.md`, whole file; the session start hook also printed PONYTAIL MODE ACTIVE).

Branch `claude/ai-armies` from claude/integration 31193b6b (the base of every comparison below). Owned: AI recruitment, garrisons and war preparation (aiLogic.js, aiOperations.js, warPlans.js, threat.js). No API use.

## Round 4 (29 Oct): the lead's option (a)

Second session, ponytail loaded by the Skill tool (`ponytail:ponytail`, whole SKILL.md printed) and by the session start hook.

Built:
1. **Skip arming when the muster is close** (warPlans.js `ARM_SLACK = 2`, `armedFor`). A nation declares at once when the stack at its staging city, minus one regiment of garrison, is within 2 units of goSize. With no plan on that target yet (the first decision), `armedFor` reckons the plan it would make (pickTargetCity, pickStaging, strikeSize at its own age). Test: aiArmies.test.js (with and without a plan).
2. **"X is mustering an army on your border"** on the nation card (NationCard.jsx, `nc.mustering` en and he), shown while that nation arms for a war on the player (`warPrep.target` is the player and `prepLive`), not once the war is on. Shots at 844x390 and 1600x900, en and he: plans/lanes/ai-armies-shots/ (the first-contact card in the desktop shot comes from the test setup, which marks the people as met).

Evidence: compare.sh, base = this branch before round 4 (922449da), head = round 4, scripted, PLAYER=akkad, 200 turns, seeds 11-18 (the same seeds as the table below; the base column matches it).

| metric | before | after | diff | 95% CI | seeds up/down |
|---|---|---|---|---|---|
| wars (AI, warsDeclaredMajors) | 6.00 | 7.13 | +1.13 | [-1.04, 3.29] | 4/2 |
| aggressor 2+ stacks idle at home, no enemy in reach | 0.14 | 0.18 | +0.04 | [-0.02, 0.10] | 5/2 |
| aggressor 2+ stacks idle at home, all | 0.60 | 0.65 | +0.05 | [-0.11, 0.20] | |
| captures (all / from majors / from independents) | 9.5 / 3.25 / 6.25 | 10.6 / 3.88 / 6.75 | +1.1 / +0.6 / +0.5 | none starred | |
| wars on the player | 1.00 | 1.13 | +0.13 | [-0.17, 0.42] | |
| AI demands on the player | 1.00 | 0.50 | -0.50 | [-1.39, 0.39] | |
| 99th percentile garrison, kingdoms | 6.50 | 6.38 | -0.13 | | |
| largest garrison, kingdoms | 14.0 | 12.5 | -1.5 | [-5.1, 2.1] | |

Wars per seed (before/after): 11: 2/3, 12: 6/5, 13: 8/15, 14: 4/5, 15: 7/7, 16: 5/4, 17: 9/9, 18: 7/9. No row is starred.

Against the targets: idle at home with no enemy in reach 18%, inside the 20% target. AI wars 7.13 a game, short of 7.5 (the gain leans on seed 13, 8 to 15; the median seed went 6.5 to 6.0). Not significant either way with 8 seeds (seeds@80% = 42).

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

00. **endgameReachability passive run (29 Oct).** Head = this branch merged with integration 039d3c18, base = 039d3c18. Same seed 7, passive player:
   - base: COMPLETE on the turn limit at 923; the leader (gojoseon) never gets every Future goal tech.
   - head: gojoseon gets every Future goal tech at turn 794, so the game ends on 'futureGoal' 129 turns early and the test fails.
   - The ages are not faster: the first nation into each age arrives on the same turn within 3-6 turns (Future: 535 base, 538 head).
   - The gap opens inside the Future age. Gojoseon's science per turn at 702: base 596, head 1117. Its cities, development and laws are about equal. What differs is city control: base 0.80, falling to 0.54 at turn 662; head 0.99 until 702. AI science is multiplied by control (aiEconomy.js calcAllNationIncomes).
   - Control moves with the AI event deck (eventDeck.js AI_DRAWS; data/eventsAi.js cards with controlBonus and controlPenalty for every city of the nation). These are seeded draws. Any change to how many rolls the AI world makes reorders which nation draws which card.
   - So no rule of this lane speeds research. The lane changes the random stream, and on seed 7 the leader lands on good cards. Base passes by a thin margin: gojoseon had 80 techs at turn 902 and still missed the goal by turn 923. The same flip hit events-8 (Congress gold).
   - The cause is the margin: the passive Future goal lands near the turn limit. I did not change it, because the fix is a pacing call: Future tech costs (research.js FUTURE_TECH_COST_GROWTH, RESEARCH_AGE_BASE.future) or how far control scales AI science. Tuning this lane until seed 7 flips back would only hide the margin. Which do you want (or should pacing-8 own it)?

0. **Round 4: wars 7.13, target 7.5** (option (a) built; see Round 4 above). Idle is within target. To close the gap, which do you want?
   - accept 7.13 (not significantly below 7.5 on 8 seeds, base 31193b6b was 8.38, also not significant);
   - also build (b): a nation that is arming may still roll on a second target;
   - or widen ARM_SLACK from 2 to 3 (a change to your call, so not built).

1. **AI wars may be a little fewer** (round 3, before option (a)).
   - Scripted 8 seeds: 8.4 to 6.0 a game, not significant (5 seeds down). Passive 6 seeds: unchanged. The 923-turn game: 49 to 32.
   - Every prep I counted ended in a declaration (seed 13: 7 set, 7 declared; seed 16: 5 of 6). So the wars are not lost; they start up to 8 turns later.
   - A shorter wait (4) did not bring the count back on seeds 11, 14, 16; turning arming off did (7, 7, 8). The likely cause is the war-contagion chain (warContagion.js) spreading out when each war starts later.
   - Wars on the player are unchanged. If the world should stay as busy as before, the options are (a) skip arming when the nation's muster is already within 2 units of goSize, or (b) let a nation that is arming still roll on a second target. I did not build either without your yes.
2. **AI-vs-AI captures from majors fell** (passive 5.7 to 3.7, significant; scripted 4.75 to 3.25, not significant). Defenders now keep their garrison where an enemy can strike and gather the rest, so a city is harder to take. Captures from independents are unchanged after the cap-of-6 fix.
3. **AI demands on the player rose** (0.13 to 1.0 a game, significant). The arming major stands stronger at the border, which the demand rules read. I did not change them.
4. **The scripted player fields fewer units and banks more gold** (significant). It copies the AI's choices for its idle cities (campaignTelemetry createScriptedPlayer, aiProduction.chooseProduction); this lane did not change aiProduction, so this is likely a ripple of the AI world around it. Not investigated.

## Not done

- The mustering line is on the nation card only (round 4), not on the map or the turn report.
- engine-rules-reviewer not run on round 4 (the lead runs it before the merge).
- The `reach` threat uses base MOVE_POINTS, not the tech and perk bonuses (it slightly undercounts).
- The largest garrison at war is still 14 units: that is the muster point of a war, by design.
