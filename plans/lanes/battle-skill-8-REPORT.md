# Lane battle-skill-8 report (29 Oct)

Goal (user): a player who commands a battle reasonably well should win; the AI crushed the player.
Source: GPT math report section 2 (plans/research/math-balance-gpt-2026-10-29.md).

## For the lead

Answers taken (lead, 29 Oct): same rules for both sides, so in a commanded battle the AI's squads no
longer rout and rally either (buildBattleSetup.js commandedSetup: canRout false on both sides), and Shaken
is now x0.85 dealt, x1.1 taken (morale.js). Save mapping, King/Emperor kept, Hard as built: done.

Open question: **the targets conflict on Normal.** One AI habit decides the novice: holding its cavalry
back until the lines meet. With it, novice 0% and skilled 66%. Without it (now shipped as Normal,
`reserve: false`), novice 29% and skilled 79%. Faster thinking, focus fire or flank rides on top did not
pull skilled under 77% (160 battles each). I chose the novice target. Say if you want the reserve back.

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

`skillDuel.sim.js` (battle-lab, new): mirrored even field battles, plains, commanded rules (no side
routs), each seed fought from both sides. Controllers: novice (attack-move everything every 10 s),
baseline (the Prince battle AI playing for the player), skilled (baseline plus never chasing routers;
since nobody routs now, skilled equals baseline). N=20 seeds x 2 sides x 2 armies x 2 ages (bronze,
kingdoms) = 160 battles a cell, Wilson 95% intervals per row in the raw output.

| AI level | novice | skilled |
|---|---|---|
| Easy | 45/160 = 28% | 112/160 = 70% |
| **Normal** | **47/160 = 29%** | **127/160 = 79%** |
| Hard | 9/160 = 6% | 69/160 = 43% |

The novice's split: with 3 foot, 1 horse and 2 archers it wins about 55% on Easy and Normal; with 2 foot,
2 horse and 2 archers it wins 0% everywhere (its horse charges the enemy pikes). Changing how often it
attack-moves (every 10 s, 30 s or once) did not change that.

Before this lane (Prince AI, the player alone unable to rout, Shaken 0.6 / 1.3): novice 1%, skilled 60%.

- parityEco (N=32, field/assault/town, bronze and classical>kingdoms, mixed): **IN 18 of 18** (ratios 0.64x
  to 2.15x), and **IN 18 of 18** with neither side routing (`NOROUT=both`, the commanded rules). autoCalib on that output finds no constant set better than the shipped
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
- A rear charge by horse on engaged foot does not pay (horse deals 0.6x to foot): worth a later pass (lead).
- Easy is short of its target for the novice (28%, target about 50%) because of the two-horse army.
- No battle in the browser at 1600x900 for the flank ring (phone only); the ring is rare in the sandbox
  (4 flank blows of 69 in 45 s).
- Sieges and naval battles were not duelled with the scripted controllers (field only).
- Did not touch BattleHud.jsx, EconomyHud.jsx, PreBattleModal.jsx, BattleResultScreen.jsx.

## After merging integration (sieges-sea-8, SETUP_VERSION 34) and the Auto retune

Lead call: neither side routs in a commanded battle, so Auto models those rules; the walled mirror band is
12-24 attacker wins of 32. parityEco N=32, field, assault and town, bronze and classical>kingdoms, mixed.

| Run | Before (WALLS_AGE_RELIEF 1.2) | After (0.8) |
|---|---|---|
| Neither side routs (`NOROUT=both`, commanded rules) | IN 17 of 18 | **IN 18 of 18** |
| Everyone routs (as before this lane) | IN 18 of 18 | IN 18 of 18 |
| The OUT row: assault, classical 3 foot, horse, archers against Kingdoms foot and archers | 3.57x OUT | 3.36x IN |
| Walled mirror (bronze 3 v 3), attacker wins real time / Auto | 23 / 14 of 32 | 23 / 14 of 32 |
| Cross-age walled mirror (classical>kingdoms 3 v 3), Auto wins | 13 of 32 | 7 of 32 (real time 0) |

- The one change: `WALLS_AGE_RELIEF` 1.2 to 0.8 (src/engine/autoBattle.js). autoCalib over the
  `NOROUT=both` output (K 1.5, R 0, U 1000, EFF 1, F 6, A 18-30, D 10-24, W 0.8-1, WAR 0.8-1.2): the
  lowest-error set was assault auxiliaries [18, 24] with WAR 0.8, but it took Auto's walled mirror to
  0 of 32 wins against 23 in real time; WAR 0.8 alone is 0 of 18 out and keeps the mirror at 14 of 32.
- KEEP_HELD_MULT stays 0.3: the mirror (23 of 32) is inside 12-24. Probes 0.2 / 0.35 / 0.4 / 0.45 under
  no-rout gave mirror 0 / 25 / 26 / 25 and did not move the OUT row (3.44x to 3.50x).
- The field win-rate table (skillDuel) is the same after the merge: Normal novice 29% / skilled 79%,
  Easy 28% / 70%, Hard 6% / 43% (160 battles a cell).
- Not refreshed: src/data/autoParity.json (the pre-battle card's parity summary, parityTable.sim.js).

## After the second integration merge (early-pace-8, battle-art-8: buildings block movement; SETUP_VERSION 36)

parityEco N=32, field, assault, town, WALLS_AGE_RELIEF 0.8, KEEP_HELD_MULT 0.3:
- Everyone routs: **IN 18 of 18**; walled mirror 16/32 attacker wins (Auto 14/32).
- Neither side routs (commanded rules): **IN 17 of 18**; walled mirror 21/32 (in 12-24; Auto 14/32).
  OUT again: the classical-against-Kingdoms 5-against-2 assault, 4.83x (real-time attacker exchange 8.1,
  was 5.6 before battle-art-8; attacker wins 4/32, Auto 31/32).
- autoCalib on the merged numbers (A 22-26, D 10-18, WAR 0.4-0.8): every set that brings that row IN
  needs defender auxiliaries 18 ([22, 18] WAR 0.8: 0 of 18 out), and then Auto wins the even walled
  mirror only 4 of 32 against 21 in real time. Not shipped: lead's call between the one OUT row and an
  Auto that undersells an even walled assault. [22, 14] WAR 0.4 is the middle (3.63x, still OUT; mirror
  Auto 9/32).
- Battle tests (src/battle, autoBattle, tacticalBattle, battleVerify, gameReducer: 77 files) and lint: green.
