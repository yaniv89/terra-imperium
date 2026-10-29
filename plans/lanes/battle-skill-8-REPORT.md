# Lane battle-skill-8 report (29 Oct)

Goal (user): a player who commands a battle reasonably well should win; the AI crushed the player.
Source: GPT math report section 2 (plans/research/math-balance-gpt-2026-10-29.md).

## For the lead (design questions)

1. **A plain player still loses almost every battle on Normal (novice 1%, Easy 20%).** The novice
   attack-moves the whole army every 10 s. Their side never routs (commandedSetup), so a beaten squad
   goes Shaken (deals 0.6x, takes 1.3x) and fights to the death, while the AI's beaten squads rout,
   rally and come back. The novice keeps 0% of the army; the AI keeps 55 to 75%. A probe with Shaken at
   0.85 / 1.1 lifted skilled on Normal to 78% and 71% (24 battles a row) but did not help the novice.
   Do we soften Shaken (it is meant to be "a soft penalty only"), or give the player's beaten squads an
   automatic fall-back like the AI's rout? I did not change it.
2. **The campaign difficulty no longer picks the battle AI.** New games take the start screen's battle
   difficulty (default Normal). Saves from before the setting map their campaign difficulty: Settler and
   Chieftain to Easy, Prince to Normal, King and Emperor to Hard. OK?
3. **Hard is King's micro fought to the end.** King as it was (withdraw at 30%, pull back spent squads)
   lost more field battles than Normal (skilled 65% against it). With withdrawal at 10% and no pull-backs
   skilled wins 48%. OK to keep King and Emperor (the old campaign levels, still used by tests) as they are?
4. **Cavalry into the rear does not pay in this sim.** A scripted rear charge (cavalry round the line onto
   their engaged foot or archers) dropped the skilled win rate from about 50% to 0 to 15%: the infantry
   counter (cavalry deals 0.6x to foot, takes 1.75x) outweighs the +30% rear bonus, and the ride takes
   the horse out of the fight. Flank edges reward foot on foot and horse on archers, not horse on foot.

## What was built

1. **Bounded position edges** (src/battle/sim/combat.js). The sim already had flank x1.3, rear x1.5 and
   height up to +10%, with no hold time, no cap and no cover. Now: flank x1.15, rear x1.3, applied only
   once the striker has held that arc on the same target for 1 s (`heldArc`, squad fields `flankOn`,
   `flankSince`; contact broken restarts the clock); flank or rear times height capped at x1.35
   (`POSITION_CAP`); ranged blows into a squad standing in a wood x0.75 (`COVER_RANGED_MULT`). No focus-fire
   bonus. Morale panic by arc (ARC_MORALE_MULT) and frontal armor still read the raw arc. Stone squads
   (`noFormation`) get no flank edge, as before. The macro auto-resolve (engine/battle.js) keeps its 1.3.
2. **Battle difficulty Easy / Normal / Hard** (tacticalAI.js AI_DIFFICULTY `easy`, `normal`, `hard`;
   economyAI.js runs Chieftain, Prince and King bases for them). Easy thinks every 2 s with no micro (no
   focus fire, no flank rides). Normal thinks every 1.5 s, keeps counters and guards, never focuses its
   fire or rides round a flank (`focus: false`, `cavFlank: false`). Hard is King's micro at 0.3 s without
   the early withdrawal. Stored in `state.battleSettings.difficulty` (src/data/battleDifficulty.js
   `battleAiOf`), set on the start screen's Rules step and in Settings > Battles, en and he. Every battle
   setup reads it (buildBattleSetup.js, 7 places). SETUP_VERSION 31.
3. **Flank mark** (BattleRenderer.js pushEvents): a held flank or rear blow (event field `flank`) puts a
   small ring on the target, gold when it is yours, red when the enemy has your flank, at most once per
   1.5 s per target. Shot: audits/battle-skill/phone-flank-ring.png (844x390).

## Proof

`skillDuel.sim.js` (battle-lab, new): mirrored even field battles, plains, the player's side commanded
(never routs), each seed fought from both sides. Controllers: novice (attack-move all every 10 s), baseline
(the Prince battle AI playing for the player), skilled (baseline plus never chasing routers; the rear
habit is off, see question 4). N=20 seeds x 2 sides x 2 armies x 2 ages (bronze, kingdoms) = 160 battles
a cell, Wilson 95% intervals per row in the raw output.

| AI level | novice | baseline | skilled |
|---|---|---|---|
| Easy | 32/160 = 20% | 135/160 = 84% | 135/160 = 84% |
| **Normal** | 1/160 = 1% | 104/160 = 65% | **103/160 = 64%** |
| Hard (final tuning) | not rerun | 86/160 = 54% | 77/160 = 48% |
| Prince (the old default) | 2/160 = 1% | 90/160 = 56% | 96/160 = 60% |

Before this lane the commanded battle used the campaign difficulty (Prince by default): skilled 50 to 55%
on 48 battles before the rule change. Normal tuning tried (skilled, 160 battles): think every 1 s 61%,
1.5 s 65% (taken), 1.5 s with withdrawal at 30% 67%, no micro at all 91%.

- parityEco (N=32, field/assault/town, bronze and classical>kingdoms, mixed): **IN 18 of 18** after every
  change (ratios 0.64x to 2.15x). autoCalib on that output finds no constant set better than the shipped
  one, so Auto is unchanged.
- Tests: src/battle (all), battleVerify, macroVerify, challenges, gameReducer, context, i18n: green. New
  tests in orders.test.js: the held flank clock and its reset, the cap bites, cover is x0.75.
- Lint: zero warnings.
- Mobile (scripts/ui/battle-skill-shots.mjs, own vite 5231): start screen Rules step and Settings at
  844x390 and 1600x900, en and he: default Normal, the pick reaches the game, Settings sets Hard, button
  40 px tall on screen, no horizontal scroll, no page errors (24 checks ok). Shots in audits/battle-skill/.
- engine-rules-reviewer: 3 findings (old saves fell to Normal, Easy faster than Normal, the flank clock
  did not reset after a break), all fixed.

## Not done or not checked
- Hard's final tuning was run with baseline and skilled only (no novice row).
- No battle in the browser at 1600x900 for the flank ring (phone only); the ring is rare in the sandbox
  (4 flank blows of 69 in 45 s).
- Sieges and naval battles were not duelled with the scripted controllers (field only).
- Did not touch BattleHud.jsx, EconomyHud.jsx, PreBattleModal.jsx, BattleResultScreen.jsx.
