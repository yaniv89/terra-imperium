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

## Fix, version 2 (the lead's rework of 27 Oct: keep the RTS build phase)

Version 1 (commit 7bc78ebb) sent the field defender out after 60 s. The lead (on user feedback)
found that too short in economy battles: a player who builds first was marched on before any tower
or training. Version 2, in src/battle/sim/tacticalAI.js `fieldMarchDue`:

1. **Grace, 180 s (`FIELD_GRACE`).** No field march-out before 3 minutes, the lead's figure. Checked
   against the clocks: the economy clocks are 10 minutes (field) and 20 minutes (siege), so 180 s
   leaves at least 7 minutes of battle. In the traces a player who builds for 3 minutes and then
   attack-moves makes contact at 201 to 205 s, before the defender's march (241 to 303 s), so the
   build phase belongs to the player. References (from general knowledge of the games, not checked
   against official docs in this lane): Age of Empires II's Treaty mode forbids attacks for a set
   time so both sides can build, and its AI attacks in waves once its army is big enough rather
   than on first sight; in StarCraft an early rush costs the rusher its economy, so it is a choice,
   not the default.
2. **Early only when clearly stronger.** Before the march is due, the only early trigger is the
   existing prince+ rule (go out at 1.5 times the strength it can see). It is unchanged. In the
   traces it fires at 55 to 90 s only after the player's own attack has been beaten.
3. **Fallback: a third of the clock, field quiet for 30 s (`FIELD_QUIET`).** When a third of
   `limitTicks` has passed (200 s of a 10-minute clock, 400 s of a 20-minute one, never under the
   grace) and nobody (workers aside) has been hit for 30 s, the defender goes out as one army
   (`keepTogether`) to the nearest visible enemy that is not retreating, else to the enemy's nearest
   base building. "Quiet for 30 s" rather than "no fight ever", so the remnant case (a fight, then a
   beaten attacker's last squads idle) is covered too.
4. **It keeps building and training through the wait.** economyAI.js `thinkEconomy` runs every think
   as before; the march takes what was trained: 12 to 15 squads at the march against 7 at the start.

Scope: battle type `field` only (unwalled towns are `field` too, but their AI attackers always come,
so their parity rows did not move). Walled assaults, sallies, rivers, ambushes, landings, raids and
sacks are unchanged. Q3 is untouched: with bases a side loses only when its base buildings are gone;
the defender wins by going out and burning the camp.

Other references (version 1): Total War's AI usually advances on even open ground and holds only
high ground or walls, and a defender sitting out the timer reads as a bug to players
([twcenter: Why does the AI always advance](https://www.twcenter.net/threads/why-does-the-ai-always-advance.555403/),
[Shogun 2 discussion](https://steamcommunity.com/app/34330/discussions/0/2990917484148196162),
[Rome II discussion](https://steamcommunity.com/app/214950/discussions/0/864978109782892886));
AoE II AI scripts time their attacks (`enable-timer` / `timer-triggered`,
[AoE forums: simple AI scripts](https://forums.ageofempires.com/t/creating-simple-ai-scripts-for-your-custom-campaigns/210881),
[Three ways to get the AI to attack](https://forums.ageofempires.com/t/three-ways-to-get-the-ai-to-attack/205476/4)).
These are community sources, not official documentation.

SETUP_VERSION stays at 27 (bumped once on this branch, not yet on claude/integration; no other
lane has taken 28).

## Traces, version 2 (`.claude/skills/battle-lab/stallTrace.sim.js`, seeds 7 to 9, field, fort 0)

`enemyMarch` is the first tick a defender soldier stands 30 tiles west of its keep. `BUILD=1` runs
the player's economy with the AI's economy brain; `AT=180` gives the attack-move at 180 s.

| Player | Age | Enemy march | First blood | Result |
|---|---|---|---|---|
| idle | bronze | 217, 212, 211 s (12 to 13 squads) | 232, 228, 245 s | defender campDestroyed 466, 367, 342 s |
| builds, never attacks | bronze | 218, 212, 217 s (12 to 13) | 268, 265, 285 s | campDestroyed 404, 406, 387 s |
| builds 3 min, then attack-move | bronze | 303, 242, 247 s (14 to 15) | 202, 205, 203 s (the player arrives first) | campDestroyed 399, 424, 493 s |
| attack-move at once | bronze | 200, 55, 74 s (after the player's attack is beaten: the 1.5x rule) | 17, 16, 17 s | campDestroyed 333, 267, 266 s |
| idle | kingdoms | 217, 212, 211 s | 232, 228, 245 s | campDestroyed 381, 345, 309 s |
| builds, never attacks | kingdoms | 218, 212, 217 s | 268, 279, 285 s | campDestroyed 389, 428, 387 s |
| builds 3 min, then attack-move | kingdoms | 303, 241, 294 s | 201, 204, 203 s | campDestroyed 405, 410, 427 s |
| attack-move at once | kingdoms | 90, 55, 70 s (1.5x rule) | 17, 16, 17 s | campDestroyed 274, 309, 272 s |

Before any fix every idle and building case ended `timeLimit` at 600 s with no blood, and every
attack-move case ended `timeLimit` at 600 s with the player's last 2 squads left idle (version 1
table below). The walled assault traces are unchanged by both versions.

## Parity, version 2 (same command as below)

23 of 24 IN, as on the base. Only the six field rows moved; town, assault and sack rows are
byte-identical to the base.

| Field matchup | Age | Base: tactical, ratio, wins, length | Version 2 |
|---|---|---|---|
| 3 v 3 | bronze | 1.221, 1.17x IN, 4/16, 233 s | 1.241, 1.19x IN, 4/16, 228 s |
| 3 v 3 | kingdoms | 1.221, 1.17x IN, 4/16, 233 s | 1.241, 1.19x IN, 4/16, 228 s |
| 5 v 2 | bronze | 0.464, 0.70x IN, 16/16, 236 s | 0.481, 0.73x IN, 16/16, 237 s |
| 5 v 2 | kingdoms | 0.573, 0.86x IN, 16/16, 239 s | 0.586, 0.88x IN, 16/16, 240 s |
| 5 with siege v 3 | bronze | 0.904, 1.59x IN, 16/16, 129 s | 0.898, 1.58x IN, 16/16, 129 s |
| 5 with siege v 3 | kingdoms | 0.947, 1.66x IN, 16/16, 131 s | 0.966, 1.70x IN, 16/16, 136 s |

The town bronze 5 v 2 row stays OUT at 0.47x, exactly as on the base (see the follow-up below).

## Version 1 (superseded), kept for the record

### Version 1 fix (one design call)

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

### Version 1 traces (new battle-lab tool `.claude/skills/battle-lab/stallTrace.sim.js`: the sandbox's own battle, balanced armies, economy on, reinforcements, commanded rules)

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

### Version 1 parity (parityEco, N=16, TYPES=field,assault,town,sack, AGES=bronze:bronze,kingdoms:kingdoms, TERRAIN=mixed)

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

- src/battle/sim/stances.test.js "a field battle never runs to the clock with nobody fighting":
  (1) the AI defender stays home through the first 3 minutes (no soldier 30 tiles toward the
  attacker) and trains more squads meanwhile: fails on version 1, passes on version 2;
  (2) against an idle player the battle ends before the clock, not by `timeLimit`, after real hits:
  fails on the base commit, passes on both versions.
- `npx vitest run src/battle` (version 2): 68 files, 874 passed, 1 skipped.
- src/engine/battleResume, defense and battleVerify tests plus src/components/battle: 26 files, 161 passed.
- eslint on the changed files: clean.

## Left open

- The input side of the playtest: a second ground tap after arming Attack turns the attack-move
  into a plain move; there is no visible order feedback; the Enemy button cannot order an attack
  on a building; there is no siege hint. That is UI work for another lane.
- The result screen's contradictory counts (playtest steps 82, 102) are not part of this lane.
- In the attack-move traces the player's 8,600 men lose to 7,700 defenders at their base. That is
  the existing base and towers balance, not the stall.
