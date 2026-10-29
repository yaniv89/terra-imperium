ponytail loaded at session start (the session start hook printed PONYTAIL MODE ACTIVE, and the Skill `ponytail:ponytail` printed the whole SKILL.md).

# Lane odds-truth: report

Branch `claude/odds-truth` (from `claude/integration` 039d3c18). No API use. Local session on the shared PC: targeted tests only.
Source: round 3b Opus playtests civ-veteran 40746164607 (steps 129 to 133, 295 to 332) and warmonger 40746170250 (215 to 219, 269 to 297).

## For the lead

**Q1 (design, rule change): should Auto fight with the troops standing by?** A commanded battle calls in
both sides' idle troops within 410 km (`reinforcementSources`, gameReducer.js BEGIN_TACTICAL_BATTLE and the
commanded defence). Auto (autoBattle.js, every battleOdds estimate) never does. So on one state the card's
Auto odds, the result screen's "Auto wins this battle N%" and the commanded battle read different forces.
This is the main reason of finding 1 at Zafar: a 14,900-man garrison (scouts said "Likely win"), 30,000 Saba
men beside it, a commanded battle of 44,900, and then "Auto wins this battle 100%" under a total loss (civ-veteran 297, 314, 316).
- A (my recommendation): Auto takes the same standby, both sides, through battleInputs.js, and their losses
  go through applyBattleOutcome as a commanded battle's do. One truth on every surface. Costs: an autoCalib
  and parityEco run (battle-lab), AI assaults on the player get the player's own standby too.
- B (built in this lane, needed either way): keep Auto as is and say it on every card: "30,000 more enemy men
  stand near it. They join a battle you command; Auto fights without them." (march line, attack card) and
  "20,000 of your men stand near it ..." (siege card).

**Q2 (finding 3, the passive war): which fix may I build?** The AI does attack: on the era saves, a passive
player at war 30 turns (peace refused) got 7 battle cards in 30 turns (classical, Akkad) and 6 in 30 (gunpowder,
Saba), and lost one city each. What feels passive is the gaps: classical turns 116 to 123 and 132 to 142 show
no enemy within 2 rings (Akkad's war plan switched to Pontus at 136); gunpowder Saba stacks march routes of
13 to 18 tiles and arrive at 0 supply (starved, strength 343 to 515 of 1000). Proposal, smallest first:
- P1 (UI only, no rule change): a turn-report line each turn an enemy stack marches on one of your cities:
  "Saba: 6 regiments (5,900 men) march on Gaza, about 3 turns away" with Show on map. The war is visible
  between battles. Reads unit.route and warPlan, already in state. My recommendation.
- P2 (rule, balance-sim needed): a war plan keeps its target while its strike is on the road (no switch to
  another enemy mid-march), and picks a muster point within supply reach of the target, so stacks arrive fed.

## Findings

| # | Finding | Root cause (checked on current integration) | Fix | Evidence |
|---|---|---|---|---|
| 1a | Zafar: scouts 11,920 to 17,880 "Likely win", battle report 44,900, two turns later the march line 294,900 "Hopeless" (civ-veteran 297, 314, 331) | All three numbers were true but none said why. (1) A commanded battle brings the 30,000 Saba men standing near Zafar; the scouts' card counted the garrison only, and Auto fights without them (Q1). (2) Saba then moved its army into Zafar: on the gunpowder era save (turn 331) Zafar holds 9 regiments, 93,500 men with militia (headless probe, `estimateMarchOdds`). (3) "Likely win" at 14,900 to 10,000 came from Technology x1.96 (Rifle Infantry against Musketeers), hidden on a scouts' card | The attack card and the march line name the standby troops, their allies by name, and that they join only a commanded battle (`seenStandby`, battleOdds.js; one function for both). Both say when the garrison changed since an earlier turn the player saw it: "Up from 14,900 on turn 130: more troops marched in." (oddsMemory.js, UI memory). The scouts' verdict names what weighs most: "What weighs most: Technology, Units' age." | Tests below; shots |
| 1b | Jerusalem, 3,000 militia against 33,340: "Auto holds 100%", next turn "0% Hopeless, Numbers x0.10" against 30,220 (civ-veteran 130, 132); warmonger 271 against 296 the same | A city with militia only is taken on Auto when its walls break (cityAssault.js). The 100% turn its walls held the battle; by the next they were down. The odds were right, but the warning blamed Numbers x0.10 and nothing said the walls had fallen | The siege card now says how far the walls fell since an earlier turn ("Its walls had 120 of 240 HP on turn 130; now 0."), and the hopeless warning of a militia-only city gives the walls as the reason ("Hopeless: Auto holds only 0% of the time: no regiment holds it and its walls are at 0 of 640 HP"), not Numbers | Tests below; shots |
| 2 | Huge enemy armies, no reason shown | Same as 1a: the standby troops and the AI's moves were never named; no levy exists in the engine (no synthetic attackers are created: `synthetic: []` in every queue record) | Standby troops with their allies on the march line and the attack card; your own standby on the siege card; garrison jumps explained | as 1a |
| 3 | The war felt passive (warmonger 219) | Not a missing attack: 7 and 6 battle cards in 30 war turns on the classical and gunpowder era saves (probe below), but long quiet gaps (war plan switching enemies, 13 to 18 tile marches) and stacks arriving starved | Proposal only (Q2), not built | Probe `scripts/ai/zzwar` (not committed): classical cards 7, near-turns 11 of 30, lost 1; gunpowder cards 6, near-turns 22 of 30, lost 1, Saba stacks at supply 0. balance-sim playerWar (TURNS=90 DECLARE_AT=40 SEEDS=11-14 WHO=player PEACE=refuse PLAYER=akkad): enemy reaches player land after 13 to 23 turns at 11.7 rings; first queued battle in 1 of 4 seeds, 3 to 8 battle reports, 1 city lost in 3 of 4 |

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
