# Lane battle-stall: report

Bug from AI battle playtest 40550100958 (branch ai/human-playtest-40550100958, diary steps 7 to 30):
a Bronze open-field sandbox battle ran to the clock with 0 men lost on either side and was scored
the player's Defeat. The walled-city (Kingdoms) assault never reached the walls.

## Cause

The sandbox makes the player the attacker and the AI the defender. In a field battle the AI defender
(src/battle/sim/tacticalAI.js `thinkDefender`) only moved for a threat within 24 tiles of its keep
(`DEFENSE_RADIUS`), or, at prince and above, for an enemy it saw that was 1.5 times weaker. It never
went out otherwise. So:

1. **An idle attacker:** the player's army stood at its camp 75 tiles away, so the defender never
   moved and the clock gave it the win (`timeLimit`) with nobody fighting. In the playtest the
   player's second tap on the ground replaced the armed attack-move with a plain short move, so the
   army stopped near its camp. That is the same idle case.
2. **A beaten attacker's remnant:** after a real fight the player's last squads (here the idle
   reinforcement, 2 squads) stayed on the field. The player's side cannot rout in a commanded
   battle, so `enemyArmyGone` stayed false and the defender never went out to burn the camp. The
   clock decided again.

The walled assault is a different story. Headless, an attack-move on the keep reaches the walls and
fights (seed 7 won `baseDestroyed` at 213 s, seed 8 fought to 969 defenders left). The playtest's
trouble there was input: taps on the ground and the radial menu, and no "attack this building"
from the Enemy button. That is UI work and is left open (see below).

## Fix (one design call)

In a **field** battle (`battleType` field, which also covers unwalled towns), once 60 s have passed
(`FIELD_WAIT`) and no threat stands at home, the AI defender marches as one army (the existing
`keepTogether` path) on the nearest visible enemy that is not retreating, or on the enemy's nearest
base building when it sees none. Walled assaults, sallies, river crossings, ambushes, landings,
raids and sacks are unchanged. Q3 is untouched: a side with bases still loses only when its base
buildings are gone. The defender goes out and burns the camp, which is how it now wins.

Reason and references:
- Total War: on even open ground the AI field army usually advances. It camps only on a hill or
  behind walls, and players keep the timer on so a passive AI cannot stall the battle
  ([twcenter: Why does the AI always advance](https://www.twcenter.net/threads/why-does-the-ai-always-advance.555403/),
  [Shogun 2 discussion](https://steamcommunity.com/app/34330/discussions/0/2990917484148196162),
  [Rome II discussion](https://steamcommunity.com/app/214950/discussions/0/864978109782892886):
  a defending AI that sits for the whole battle reads as a bug to players). These are community
  sources, not official ones.
- Age of Empires II: AI scripts send attacks on timers (`enable-timer` / `timer-triggered`), so an
  army does not wait forever for contact
  ([AoE forums: simple AI scripts](https://forums.ageofempires.com/t/creating-simple-ai-scripts-for-your-custom-campaigns/210881),
  [Three ways to get the AI to attack](https://forums.ageofempires.com/t/three-ways-to-get-the-ai-to-attack/205476/4)).
- A walled defender holding its walls is what those games do too, so assaults keep the old
  behaviour.
- Why 60 s: in AI against AI field battles the attacker makes contact in about 15 to 20 s, so the
  wait almost never fires there (parity below). Against an idle player the defender reaches them at
  about 90 s, well inside the 10-minute economy clock.

SETUP_VERSION 26 -> 27: commanded field battles with an AI defender now play differently from the
same order log, so old checkpoints must not resume into them.

## Traces (new battle-lab tool `.claude/skills/battle-lab/stallTrace.sim.js`: the sandbox's own battle, balanced armies, economy on, reinforcements, commanded rules)

`SEEDS=7,8,9 AGE=bronze FORT=0 ORDER=none|attackMove QUIET=1`

| Case | Before | After |
|---|---|---|
| Bronze field, idle player, seed 7 | defender timeLimit at 600 s, first blood never, A 8600->8600 | defender campDestroyed at 194 s, first blood 96 s, A 8600->4039, D 7700->3423 |
| seed 8 | timeLimit 600 s, no blood | campDestroyed 179 s, first blood 85 s |
| seed 9 | timeLimit 600 s, no blood | campDestroyed 206 s, first blood 96 s |
| Bronze field, attack-move, seed 7 | timeLimit 600 s (fight at 17 s, then 2 player squads left idle) | campDestroyed 256 s |
| seed 8 | timeLimit 600 s | campDestroyed 226 s |
| seed 9 | timeLimit 600 s | campDestroyed 164 s |
| Kingdoms field, idle, seeds 7, 8 | (as Bronze) | campDestroyed 184 s, 348 s |
| Kingdoms walls (fort 2, medium city), idle, seeds 7, 8 | timeLimit 1200 s, no blood | unchanged (the walls are held, as the assault intends) |
| Kingdoms walls, attack-move, seed 7 / 8 | attacker baseDestroyed 213 s / defender timeLimit | unchanged |

## Parity (parityEco, N=16, TYPES=field,assault,town,sack, AGES=bronze:bronze,kingdoms:kingdoms, TERRAIN=mixed)

Exchange is tactical / auto; the guardrail is [auto / 2, auto x 3.5]. 23 of 24 rows IN, before and after.
Only field and town rows moved. Every assault and sack row is byte-identical.

| Type | Age | Matchup | Before: tactical, ratio, wins, length | After: tactical, ratio, wins, length |
|---|---|---|---|---|
| field | bronze | 3 v 3 | 1.221, 1.17x IN, 4/16, 233 s | 1.244, 1.19x IN, 4/16, 192 s |
| field | kingdoms | 3 v 3 | 1.221, 1.17x IN, 4/16, 233 s | 1.244, 1.19x IN, 4/16, 192 s |
| field | bronze | 5 v 2 | 0.464, 0.70x IN, 16/16, 236 s | 0.381, 0.57x IN, 16/16, 219 s |
| field | kingdoms | 5 v 2 | 0.573, 0.86x IN, 16/16, 239 s | 0.474, 0.72x IN, 16/16, 220 s |
| field | bronze | 5 with siege v 3 | 0.904, 1.59x IN, 16/16, 129 s | 0.943, 1.66x IN, 16/16, 122 s |
| field | kingdoms | 5 with siege v 3 | 0.947, 1.66x IN, 16/16, 131 s | 0.985, 1.73x IN, 15/16, 112 s |
| assault | both | all 3 | unchanged (0.89x to 1.59x IN, 133 to 572 s) | unchanged |
| town | bronze | 3 v 3 | 1.053, 0.97x IN, 3/16, 211 s | 1.088, 1.01x IN, 2/16, 201 s |
| town | kingdoms | 3 v 3 | 1.187, 1.11x IN, 1/16, 124 s | 1.255, 1.17x IN, 0/16, 112 s |
| town | bronze | 5 v 2 | 0.274, 0.47x **OUT**, 16/16, 195 s | 0.291, 0.49x **OUT**, 16/16, 191 s |
| town | kingdoms | 5 v 2 | 0.399, 0.68x IN, 16/16, 202 s | 0.399, 0.68x IN, 16/16, 202 s |
| town | both | 5 with siege v 3 | 1.79x / 2.10x IN, 108 / 127 s | unchanged |
| sack | both | all 3 | unchanged (0.65x to 2.73x IN) | unchanged |

Auto was not retuned. The field 5 v 2 rows are IN before and after, so the lead's condition for a
retune is not met. The one OUT row (town, bronze, 5 v 2) was already OUT on the base and moved
toward the guardrail (0.47x to 0.49x). It is a pre-existing gap, not this change, so the evidence
does not back a retune here.

## Tests

- New: src/battle/sim/stances.test.js "a field battle never runs to the clock with nobody fighting":
  a Bronze field battle with the economy on, an idle player and an AI defender ends before the clock,
  not by `timeLimit`, with men lost. It fails on the base commit and passes with the fix.
- `npx vitest run src/battle`: 68 files, 873 passed, 1 skipped.
- src/engine/battleResume, defense and battleVerify tests plus src/components/battle: 26 files, 161 passed.
- eslint on the changed files: clean.

## Left open

- The input side of the playtest: a second ground tap after arming Attack turns the attack-move
  into a plain move; there is no visible order feedback; the Enemy button cannot order an attack
  on a building; there is no siege hint. That is UI work for another lane.
- The result screen's contradictory counts (playtest steps 82, 102) are not part of this lane.
- In the attack-move traces the player's 8,600 men lose to 7,700 defenders at their base. That is
  the existing base and towers balance, not the stall.
