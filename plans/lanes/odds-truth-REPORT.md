ponytail loaded at session start (the session start hook printed PONYTAIL MODE ACTIVE, and the Skill `ponytail:ponytail` printed the whole SKILL.md).

# Lane odds-truth: report

Branch `claude/odds-truth` (from `claude/integration` 039d3c18). No API use. Local session on the shared PC: targeted tests only.
Source: round 3b Opus playtests civ-veteran 40746164607 (steps 129 to 133, 295 to 332) and warmonger 40746170250 (215 to 219, 269 to 297).

## For the lead

Answers received 29 Oct: Q1 = A (built, below), Q2 = P1 (built, below) and P2 (waits for ai-armies on
integration; not started). Nothing waits on a design call.

## Q1 = A: Auto fights with the troops standing by

- `standbyFor` (battleInputs.js): the troops a commanded city battle calls in, from the same
  `reinforcementSources`: the player's assault brings both sides' (the player's not from the attack's
  origin), an assault on the player's city brings the player's. AI against AI, field, sea and landings: none
  (their commanded twins call none, or are not player battles).
- `resolveAutoBattle` (autoBattle.js, `withStandby`) and every battleOdds estimate (`simulate`) fight with
  them: the march line, the attack card, the siege card, the result screen's "Auto wins N%" and the game's
  Auto read one force count.
- battleOutcome.js: a standby unit outside the city takes its losses where it stands; it is not deleted
  when the city falls, nor driven out with a beaten garrison, and an attacker's keeps its own city. This also
  applies to a commanded battle's joined standby (it used to vanish with the city).
- Card lines for A: "40,000 more enemy men stand near it and join the battle: with them and about 1,500
  auxiliaries it trains, it meets about 55,000." With a spy report the count is Auto's own (every man standing
  by); without, the men in sight. Siege card: "20,000 of your men stand near it and join the battle, on Auto
  or in command."

Evidence:
- **Zafar case** (civ-veteran 297/314/316 rebuilt on the gunpowder era save: Zafar 1,000 garrison plus
  militia, 30,000 Saba men beside it, 10,000 Israelis at its gates, spy report on Saba; probe not committed):
  | | before | after |
  |---|---|---|
  | Auto, 40 seeds (resolveAutoBattle) | 32 of 40 wins, against 13,500 men | 0 of 40, against 53,500 men |
  | attack card | (scouts' "Likely win") | autoP 0, "Likely loss", Hopeless, "40,000 more enemy men stand near it ... meets about 55,000" |
  | result screen "Auto wins N%" (autoCompare.js) | 100% (the playtest) | 0% |
  | the game's Auto, LAUNCH_INVASION, 20 seeds | | 0 of 20; a Saba standby unit stays on its tile and city |
  Card, Auto and result agree. Auto's 40,000 standby is 10,000 more than the 30,000 placed: other Saba
  troops within 410 km; the card names them all because there is a spy report.
- **parityEco** (N=16, field, assault, town; bronze:bronze, classical:kingdoms; mixed): IN 18 of 18 before
  and after, every row identical (it tests `autoFromInputs` on fixed armies; A changes which armies, not the
  fight). Logs: scratchpad parity-before.log, parity-after.log.
- **autoCalib** at the shipped constants on both runs: out 0 of 18, logSum 5.42, winGap 2.44, before and after.
- engine-rules-reviewer on the diff: no rule breaks (determinism, purity, ages, rings, i18n, ledger sound). Its three
  behaviour gaps are fixed: a standby attacker keeps its own tile and city on Auto (it was moved onto the
  taken city from up to 410 km away); a unit aboard a ship, a settler or one already in another battle never
  stands by; an AI landing on the player's city brings the player's standby, as the commanded landing does.
- Tests: new `src/engine/autoStandby.test.js` (standby equals the commanded set; none for AI against AI or
  field; the card's estimate, Auto's inputs and its result count the same defenders; on Auto a standby unit
  keeps its tile and city). 27 related files, 332 tests, green.

## P1: a march on your city warns when it sets out

`warnMarches` (aiOperations.js) warned once, 3 tiles out; marches of 13 to 18 tiles went unsaid. Now a march
on one of your cities warns when it sets out ("The Sabaean Empire sets out for Gaza with 59,000 men, about 4
turns away", `unit.marchSeen`) and again 3 tiles out (as before). The turn report gives both a Defend button.
Agreement fixed in both lines ("The Ahhiyawan tribes set out", "march on"). Test: marchWarning.test.js.

## P2: strikes that arrive fed (lead go 29 Oct, after ai-armies 41d3a0af; branch merged with integration first)

Built (warPlans.js header block, aiOperations.js):
- **Target switching (report: only for a 15% better target):** already stricter. updateWarPlan keeps a target
  as long as the enemy holds it; it changes only when the city is taken, peace removes the enemy, or the
  target is dropped (no road, or the two rules below). No new rule needed; written in the header.
- **Supplied routes only, about 3 turns of supply:** a strike or siege party leaves only on a march where no
  unit's meter empties on the way and it holds `STRIKE_SUPPLY_TURNS` = 3 turns of supply at the target
  (`supplyAllows` over supplyMeter.js `supplyAlongMarch`, the same forecast as the player's march bar). A plan
  target it cannot reach that way is dropped like one with no road (`dropTarget`), so the next nearest one is
  picked. The muster point was already the plan's own city nearest the target (pickStaging).
- **Replan after 3 turns without progress:** `strikeProgress`: the fewest steps left of a launched strike's units
  on the road to the target, kept on the plan (`near`, `nearTurn`); no nearer for `REPLAN_REF_TURNS` = 3 reference
  turns (speedTurns) drops the target and stops those units.
- **Mobilization visible ahead:** a war on the player is declared only after the mustering line (warPrep, on the
  nation card) has shown for `PREP_VISIBLE_REF_TURNS` = 2 reference turns, even when the muster is already full
  (ai-armies' ARM_SLACK shortcut used to declare at once). AI-vs-AI wars are unaffected. Plus P1's set-out line.

Evidence: compare.sh, base 1249feb9 (integration with ai-armies, before P2), head 7515bb8a, POLICY=scripted,
PLAYER=akkad, 200 turns, seeds 11-18 (paired). New harness counters in worldStats.sim.js (run on both sides):
strikes = units of a nation setting out on one turn for its plan's target; attrition = strength lost on turns a
unit stood at an empty meter.

| metric | base | head | diff | 95% CI | up/down |
|---|---|---|---|---|---|
| strikes arriving under 80% of departure strength from attrition (target under 10%) | 5.0% | 0% | -5.0 pts | [-10, 0.04] | 0/6 |
| strikes with a unit arriving at an empty meter | 8.4% | 1.2% | -7.2 pts | [-12, -1.9] * | 0/7 |
| AI wars a game (warsDeclaredMajors; floor 7) | 8.25 | 7.00 | -1.25 | [-3.33, 0.83] | 2/5 |
| AI attacks on the player per 30 turns (queued battles) | 0.22 | 0.19 | -0.04 | [-0.13, 0.05] | 0/1 |
| wars on the player | 1.13 | 0.75 | -0.38 | [-1.14, 0.39] | 1/3 |
| battles between majors | 56.8 | 48.0 | -8.75 | [-20.3, 2.78] | 2/6 |
| captures (all / from majors) | 6.50 / 1.75 | 7.13 / 1.63 | +0.63 / -0.13 | n.s. | |
| strikes | 31.9 | 27.3 | -4.6 | [-16.5, 7.2] | 3/5 |

Read: the arrival target is met (it was already under 10% at the base: 5%; now 0) and starving arrivals fall
sharply (the one starred row). AI wars a game sit at the floor (7.00, not significantly below the base); battles
and wars on the player lean down, not significantly. The AI-attacks metric is per 30 turns of the whole game, and
with a scripted player rarely at war (about 1 war on it a game) it is near 0 on both sides: it does not measure
how hard the AI presses a war once it is on (my era-save probe earlier in this report did: 6 to 7 battle cards in
30 war turns).

Passive endgame test (`endgameReachability.test.js` "a passive run ... never wins by default", which ends the
game on `{ reason: 'turnLimit' }`): passes on head (283 s). Related tests (23 files importing warPlans,
aiOperations or aiLogic, plus autoStandby): 278 passed. Two fixture updates: aiArmies.test.js (a war on the
player now waits for the mustering line), aiOperations.test.js (the march test's stack forages: unfed, its
6-turn march arrives at 30 supply and the new rule keeps it home). Not run: the full suite, engine-rules-reviewer
on the P2 diff (the lead's step before merging).


## Findings

| # | Finding | Root cause (checked on current integration) | Fix | Evidence |
|---|---|---|---|---|
| 1a | Zafar: scouts 11,920 to 17,880 "Likely win", battle report 44,900, two turns later the march line 294,900 "Hopeless" (civ-veteran 297, 314, 331) | All three numbers were true but none said why. (1) A commanded battle brings the 30,000 Saba men standing near Zafar; the scouts' card counted the garrison only, and Auto fights without them (Q1). (2) Saba then moved its army into Zafar: on the gunpowder era save (turn 331) Zafar holds 9 regiments, 93,500 men with militia (headless probe, `estimateMarchOdds`). (3) "Likely win" at 14,900 to 10,000 came from Technology x1.96 (Rifle Infantry against Musketeers), hidden on a scouts' card | The attack card and the march line name the standby troops, their allies by name, and that they join only a commanded battle (`seenStandby`, battleOdds.js; one function for both). Both say when the garrison changed since an earlier turn the player saw it: "Up from 14,900 on turn 130: more troops marched in." (oddsMemory.js, UI memory). The scouts' verdict names what weighs most: "What weighs most: Technology, Units' age." | Tests below; shots |
| 1b | Jerusalem, 3,000 militia against 33,340: "Auto holds 100%", next turn "0% Hopeless, Numbers x0.10" against 30,220 (civ-veteran 130, 132); warmonger 271 against 296 the same | A city with militia only is taken on Auto when its walls break (cityAssault.js). The 100% turn its walls held the battle; by the next they were down. The odds were right, but the warning blamed Numbers x0.10 and nothing said the walls had fallen | The siege card now says how far the walls fell since an earlier turn ("Its walls had 120 of 240 HP on turn 130; now 0."), and the hopeless warning of a militia-only city gives the walls as the reason ("Hopeless: Auto holds only 0% of the time: no regiment holds it and its walls are at 0 of 640 HP"), not Numbers | Tests below; shots |
| 2 | Huge enemy armies, no reason shown | Same as 1a: the standby troops and the AI's moves were never named; no levy exists in the engine (no synthetic attackers are created: `synthetic: []` in every queue record) | Standby troops with their allies on the march line and the attack card; your own standby on the siege card; garrison jumps explained | as 1a |
| 3 | The war felt passive (warmonger 219) | Not a missing attack: 7 and 6 battle cards in 30 war turns on the classical and gunpowder era saves (probe below), but long quiet gaps (war plan switching enemies, 13 to 18 tile marches) and stacks arriving starved | Proposal only (Q2), not built | Probe `scripts/ai/zzwar` (not committed): classical cards 7, near-turns 11 of 30, lost 1; gunpowder cards 6, near-turns 22 of 30, lost 1, Saba stacks at supply 0. balance-sim playerWar (TURNS=90 DECLARE_AT=40 SEEDS=11-14 WHO=player PEACE=refuse PLAYER=akkad): enemy reaches player land after 13 to 23 turns at 11.7 rings; first queued battle in 1 of 4 seeds, 3 to 8 battle reports, 1 city lost in 3 of 4 |
| 4 | Lead's acceptance case (manual playtest 29 Oct, af3ee70e, Ahhiyawa against Dacia): march to Blidaru "Hopeless on Auto", the card on arrival "Likely win" and "about 33,440 to 50,160", the real enemy 61,800, the army lost | Two readings of one sim. The march line read Auto's chance to take a city held by militia alone (its walls hold: 0%); the card's verdict read the chance to beat the militia in the battle, with the walls still standing ("Likely win"). Neither counted the troops standing near the city or the auxiliaries the defender trains, so the men shown were the garrison with its militia only | One chance for every surface, `autoChance` (battleOdds.js): a garrison is a battle to win, a militia-held city is its capture. The march line, the card's verdict (exact and scouts'), the scouts' band and the hopeless line all read it. One enemy count, `allInText`: "20,000 more enemy men stand near it: a battle you command meets about 61,800 with them and about 8,360 auxiliaries it trains. Auto fights without the men near it." (or "With about N auxiliaries it trains, the battle meets about M men.") on the march line and the card | preBattleModel.test.js: with a garrison and with militia alone (walls level 3), the card's `autoP` equals `autoChance` of the march odds on the same state and samples, and the hopeless call matches; oddsMemory.test.js: the all-in count. Not replayed on the Blidaru game itself (no save of it) |

## Test: the preview and Auto read the same strength

`src/components/battle/preBattleModel.test.js` "odds truth": on one state, `estimateMarchOdds` (march line),
`preBattleModel` (attack card) and `battleInputs` (what Auto fights) give the same defender strength and the
same attacker strength. Also: the standby line names 20,000 men beside the city; a garrison that grew since an
earlier turn says "Up from ... on turn N". `src/components/battle/oddsMemory.test.js`: the memory, the jump
threshold (a quarter), the walls line, the allies text.

## Shots (real Chrome, dev server, `PW_CHANNEL=chrome node scripts/ui/odds-truth-shots.mjs`)

`plans/lanes/odds-truth-shots/after/`:
- `1-zafar-attack-desktop-{en,he}`: the attack card on Zafar (spy report): 93,500 garrison, footer "30,000 more
  enemy men stand near it. They join a battle you command; Auto fights without them." The hopeless line still
  says "mostly from Numbers x0.11"; the chips show Technology x1.96 and Units' age x0.81.
- `2-siege-militia-{phone,desktop}-{en,he}`: the siege of Jerusalem held by militia alone: the walls line and
  "30,000 of your men stand near it. They join a battle you command; Auto fights without them." No overflow at 844x390.
- **Not captured:** the attack card on the phone. In this harness the Invade tap on the phone closes the city
  sheet and no card shows (desktop opens it). Its text is covered by the model test; the footer is the same
  ForceCard slot as before. Worth a look in the next playtest.
- No page errors in any run. The jump lines ("Up from ... on turn N", "Its walls had ...") need two turns and
  are covered by tests, not shots.

## Tests run (targeted; six lanes share this PC)

- `oddsMemory.test.js`, `preBattleModel.test.js`, `marchOddsText.test.js`, `defenseSheetModel.test.js`: 31 passed.
- `src/i18n` (all 10 files, en/he key parity and copy rules), `marchBar.test.js`, `battleOdds.range.test.js`, `cityAssault.test.js`: 153 passed.
- Lint: `npx eslint --no-ignore --max-warnings 0` on every changed file: clean (plain eslint skips worktrees under .claude/).
- Not run: the full suite and `npm run test:quick`.

## Files

- `src/engine/battleOdds.js`: `seenStandby` (one function for the march line and the attack card; adds `allies`);
  `estimateMarchOdds` returns `cityId` and `turn`. Pure, no new rule, no new rings.
- `src/components/battle/oddsMemory.js` (new): what the player saw on an earlier turn (UI only, not saved).
- `preBattleModel.js`, `marchOddsText.js`, `defenseSheetModel.js`, `DefenseSheet.jsx`, en/he strings.
- `scripts/ui/odds-truth-shots.mjs` (new).
