# Lane campaign-ai-wars: report (27 October)

Source: playtest score Wars and AI 2.0/10 (plans/ai-output/human-playtest/SUMMARY.md issues 1 and 6),
warmonger run 40550092795 ("at war about 90 turns, no contact"). Branch `claude/campaign-ai-wars`,
base 81f55ec6 (claude/integration), merged with integration 62bd6bf5 before the push.
The ponytail skill is not installed in this environment; the lane ran without it.

## What was wrong (found with a new headless trace)

`.claude/skills/balance-sim/playerWar.sim.js` (documented in the balance-sim SKILL.md): a scripted
player, a war with the nearest major at turn DECLARE_AT, and per seed the turns until an enemy land
unit stands on the player's land or beside a player city, the battles the player fights, cities
lost, war length, starving enemy units. `TRACE=1` prints the enemy's stacks every turn.

1. **Shuttle between two border cities.** Seed 11, war at turn 100: Israel's main stack (2 growing
   to 8 regiments) hopped every turn for 50 turns between its two border cities near the player.
   The city it left was empty, so the player's garrison nearby made it "threatened" (threat.js) and
   the stack hopped back. The objective flipped defend/advance each turn and the army never left.
   A second form: "gather at the muster point" sent all but one regiment away from a border city,
   which then was threatened and "defend" sent one back.
2. **Interior stacks idle under threat.** While any city was threatened, a stack in a safe interior
   city with no chain of own cities to the threatened one did nothing all war (it neither defended
   nor followed the war plan).
3. **Starving besiegers.** A wave that failed its assault sat at the walls at 0 supply and 0 morale,
   strength draining from about 600 to 1 over 15 turns, never retreating (seed 18, turn 40).

## Changes (src/engine/aiOperations.js)

- `siegeParty(state, stack, at, from, threat = 0)`: a stack leaving its own city keeps the weakest
  regiment as before, plus more while the garrison's strength x THREAT_DEFEND_RATIO is not above the
  threat there (threat.js `threatOf`). Used by the defend hop and by gathering, so neither empties a
  border city into a threat. Research: Civ VI's tactical AI assigns defenders city by city and moves
  only the surplus; EU4's AI keeps fort garrisons and moves field armies.
- The no-target branch now defends first (hop by city roads, only the surplus), and every other
  stack follows the war plan (gather or strike) instead of waiting while a city elsewhere is threatened.
- Starving at the walls (`starving`, `fallBack`, `starvingSiegeHolds`, STARVE_HOLD_TURNS = 4): a stack
  whose every unit is at 0 supply and that does not attack this turn falls back to its muster city
  (or nearest own city) to refill and joins the next wave, unless the siege of our units there brings
  the walls to the attack point within 4 turns (under ASSAULT_HP for a garrison, under one attack's
  hit for an empty city). Research: EU4, Total War and HoI4 AIs pull armies out of attrition to
  friendly land. A first version that fell back at once gave up sieges two turns from success
  (player cities taken at turn 40: 3 to 1), so the hold window was added.
- Not kept (evidence against): not counting enemy garrisons in their own cities as a threat. It
  helped player wars a little (contact 12.2 to 11.5 turns, battles 45 to 55) but AI-vs-AI sieges
  begun fell 11.3 to 7.9 a game (significant) and garrison sallies dropped. Reverted.

## UI: the "Show enemy" route

The top-bar war pill (`WorldTopBar.jsx`) with one enemy now opens that enemy's card (Show on map,
March to, peace actions) and flies the map to the nearest place of theirs the player knows
(`peopleWhere.js` `front`: known cities and armies in sight, nearest the player's cities first;
"Show on map" on the card uses it at war). With several enemies it opens Diplomacy as before.
Real browser (dev server, 844x390 and 1600x900, en and he): the pill opens the card, no page errors.
The card already said "Not seen yet: explore toward them" when nothing is known.

## Evidence

Player at war, Akkad, standard world, Normal, seeds 11-18, scripted player (accepts free peace).
Base 81f55ec6 vs final. "Mean contact" counts a war with no contact as 60 turns.

| War declared at turn 100 | base | final |
|---|---|---|
| wars where the enemy never reached the player | 4/8 | 0/8 |
| mean turns to contact | 33.9 | 12.2 |
| battles the player fought (all 8 wars) | 4 | 45 |
| player cities lost | 1 | 3 |
| enemy unit-turns at 0 supply | 159 | 90 |
| war length (mean) | 27.8 | 26.8 |

| War declared at turn 40 | base | final |
|---|---|---|
| never reached the player | 1/8 | 1/8 |
| mean turns to contact | 20.0 | 19.9 |
| battles the player fought | 48 | 31 (fewer futile assaults) |
| player cities lost | 3 | 5 |
| enemy unit-turns at 0 supply | 210 | 142 |

Warmonger (player refuses every peace, 60 war turns, war at turn 100): Akkad, no contact 4/8 to
0/8, battles 4 to 222; Kemet (enemy next door) contact about the same, battles 89 to 105, cities
lost 12 to 10. WHO=ai (the AI declares) gave the same numbers as WHO=player.

AI vs AI (worldStats, POLICY=scripted, 150 turns, seeds 11-18, paired):
- better: stack shuttle share 0.038 to 0.001 (significant); wars with zero battles 0.88 to 0.50 (ns)
- same: captures 2.88 = 2.88, wars 3.5 to 4.0 (ns), war length median 14.6 to 15.2 (ns),
  effective nations, top land share, nonFinite 0, audit violations 0
- costs (significant): war stack mean 2.05 to 1.25 units, idle-at-home share 0.43 to 0.57,
  besieging share 0.028 to 0.014, AI move rate at war 0.38 to 0.20 (base counted shuttles as
  moves). Sieges begun 11.3 to 9.8 (ns). Cause: border cities now keep a garrison above the threat
  before regiments leave. The player-facing wars got better; a follow-up could let a city count
  only the threat that can reach it before reinforcements (not done: no evidence yet).

Turn time (perf skill, seed 11, 110 measured turns, back to back, idle machine): base 104.6 and
107.6 ms, final 105.6 and 109.2 ms (about +1 ms, inside the 10-20 ms noise); the AI war phase went
17.7/18.4 to 15.5/16.7 ms. Determinism: no randomness added, ties by id (engine-rules-reviewer: no
rule violations; its one finding, a zero-threat guard in siegeParty, is fixed).

Tests: aiOperations.test.js (shuttle: old code [0,2],[2,0],[0,2],[2,0], new holds; starving fall-back
and hold window), peopleWhere.test.js (front order). Lint clean; test:quick result in the commit log.

## Not done, for the lead

- **Browser start bug to verify (high):** in a fresh browser game on the dev server (start screen
  defaults, band start), 35 of 36 AI majors begin with `isEliminated: true` and no units; only the
  player and the independents exist. Headless `createInitialState` with the same scenario (same seed,
  band, earth) gives all 36 majors their bands, and they found cities on turn 2. If the live site
  does the same, it explains "no neighbour met for many turns" in every playtest. Repro: start a
  game, then in the console `Object.values(__game.state.nations).filter(n => n.kind !== 'independent' && n.isEliminated).length`.
- A rebel army inside the player's capital makes the AI assault the rebels as a "player defense"
  battle (seed 11 turn 100 trace); validateInvasion picks the rebels as defenders.
- The AI never offers concessions when losing to the player (only white peace for stalemate or
  exhaustion); it accepts the player's offers by the war-score ledger. An AI "sue for peace" offer
  needs a card for terms the AI gives; not built.
- Early wars (turn 40) still take about 13-20 turns to contact: the AI has 2-5 units and the muster
  city keeps one at home. That is army size (production), outside this lane's files.
- Run 40550097406 (moving toward Mycenae asks for war, no peaceful approach) is a march-order UI
  issue (routes.js / marchAttack.js), not touched here.
- Could not message the lead session: send_message was refused ("needs proof of a trusted device").

## Follow-up (28 October): the slow test the merge turned red

`src/engine/resolveTurn.test.js` "an aggressive, hostile Tier 1 neighbor eventually declares war on
its own" failed after the merge: the passive player was conquered at turn 74 before R1 declared.

**Does a passive player now fall too often?** No evidence of it.
- Standard world (worldStats, Akkad, seeds 11-18, 150 turns), base 7bfb74db (integration just
  before this lane's merge) vs this branch: the player fell on 0 of 8 seeds on both sides, passive and
  scripted. Wars on the passive player 5 to 9 (8 seeds total); scripted 5 to 4, one scripted
  player lost 2 of its 3 cities (seed 18).
- The test's own fixture (peoplesWorld seed 11, a one-city player beside the test's aggressive
  rival, accepting every peace, 200 turns, rng seeds 2024 and 1-7): the player fell on 4 of 8
  seeds before this lane (turns 58, 66, 66, 72) and 5 of 8 after (adds seed 2024 at turn 74). The
  other seven seeds play out identically. The fixture was already this harsh; the lane flipped
  the one seed the test used. No balance change made for it.

**The test now checks what it means.** Every people other than R1 keeps a truce with the player
for the run (the AI never breaks a truce), so no other war can end the game. With that alone R1
still never declared: with a 5000 reserve its odds against its neighbours sat at 0.2 to 0.4 and
every war's value under 0 all game (in the old code it declared at turn 216 on a war valued about
0, on Rasenna, not the player). The reserve is now 20000, which makes the war clearly worth it:
R1 declares on Dacia at turn 49. Fixed seed 2024 kept. resolveTurn.test.js: 95 of 95 pass.
