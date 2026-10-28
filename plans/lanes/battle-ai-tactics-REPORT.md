# Lane report: battle-ai-tactics

Branch `claude/battle-ai-tactics` (integration merged at 6ee09ec4). SETUP_VERSION 27 -> 28.
Files: src/battle/sim/tacticalAI.js, src/battle/sim/economyAI.js, stances.test.js (2 tests),
battle-lab tools aiTrace.sim.js, aiDuel.sim.js, aiDuel-prep.mjs (+ SKILL.md note).

## Where the AI was dumb (aiTrace, prince, 4 seeds, field / walled city / sea x bronze, classical, gunpowder)
1. Field, seed 1, t=37 s, attacker cavalry #2 nine tiles ahead of its infantry, alone against 3,000
   men, routed by 45 s. Cause: keepTogether sent fast squads a Stop; an idle squad chases anything it
   sees, so the waiting rider charged alone. Same pattern in gunpowder (cavalry in the front row of the
   line formation, faster than the foot).
2. Walled city, every seed, t=32 to 33 s: the defender's infantry and cavalry marched out through the
   gate to meet the attacker 18 tiles from the keep (DEFENSE_RADIUS 24) and lost the field army in the
   open. Old vs old: attacker won 19 to 20 of 20 walled mirror assaults (auto-resolve: 7 of 16).
3. Field, t=40 s: both sides' archers (#3, #8, #9) shooting cavalry at x0.6 while infantry was in reach
   (BADMATCH 17 to 34 s per battle); no spear went to meet riders on the archers.
4. Walled city attacker: 36 to 66 squad-seconds idle per battle with enemies in sight (cavalry #2
   idle at 33 s; trained auxiliaries #39 to #41 idle).
5. Sea: wounded ships stay in the fight (128 to 175 s per battle under 30%).

## What changed (references in brackets)
- Waiting squads Hold, not Stop; a squad under fire is not held (cohesion fix, all levels).
- Walled defence: behind standing walls the defender meets only what comes within the wall ring + 3
  tiles; the 1.5x sally and the siege-engine hunt stay (Total War garrison AI). All levels.
- Prince+ micro (`micro` in AI_DIFFICULTY), through ordinary orders and its own fog only:
  - Cavalry reserve on the wings 3 tiles behind the foot until the lines meet, then on enemy archers
    and engines; escorted ones only at king+ and round the flank (Total War cavalry reserve, AoE
    knights on archers). Spent riders (under 40%) do not charge.
  - Guards: the nearest infantry onto a rider near our archers or engines (AoE pikes guarding
    archers); the nearest free soldier onto any raider among our laborers (AoE town defence).
  - Focus fire: archers take the target most of them reach, that they counter, with the fewest men,
    foot on top of our archers first; switch only for a 1.5x better target (StarCraft focus fire).
  - King+: riders with nothing to do raid unguarded laborers (AoE villager raids); melee squads under
    25% (emperor 30%) still being hit leave the field and keep their men (StarCraft pull-back).
  - Economy (prince+): production buildings raised and fed in counter order against the enemy it can
    see (AoE counter-unit training); siege stays last.
- Removed: the old king pre-contact cavalry swing (rode off alone: old king field battles ended in
  60 s at exchange 2 to 3.5) and archer kiting (tested: lost battles both sides, archers stop shooting).
- Not changed: battle-stall's field march-out rule, Q3 base rule, city falls rule, unit ages.

## Evidence
Mirror win rate, new vs old AI (aiDuel, 20 seeds per row, economy on, mixed terrain; OO = old vs old).
Attacker wins out of 20 per row: OO / new attacker vs old defender (NO) / old attacker vs new defender (ON).

| level, type | rows | OO | NO | ON |
|---|---|---|---|---|
| prince field (2 armies x bronze, kingdoms, gunpowder, modern) | 8 | 29 | 62 | 34 |
| prince walled city (2 armies x 3 ages) | 6 | 94 | 107 | 86 |
| king field | 8 | 9 | 37 | 1 |
| king walled city | 6 | 29 | 37 | 17 |
| sea, prince and king, 3 to 4 ages | 7 | same | same | same |

Land total: new attacker 243 of 520 wins (old 161); new defender lets 138 through (old 161).
Weak spot left: prince field in gunpowder and modern, mixed army (old attacker 14 and 7 of 20, new 6
and 4): the musket line wins by standing, and the battle turns on the attacker's 25% retreat line.
Sea is unchanged: ships are class `naval`, none of the new behaviours applies (focus fire on ships
was tried and swung rows both ways, so it is off at sea).

parityEco (N=16, field/assault/town x bronze, classical, kingdoms, gunpowder x 3 armies): 36 of 36 IN
(before 35 of 36; the OUT row, town bronze i+i+i+c+r vs i+r 0.49x, is now 0.76x). The walled mirror
assault exchange moved from 0.78 to 0.95 to 0.80 to 0.87 (the defender now holds its walls).

aiTrace after (prince, 4 seeds): walled-city attacker idle 36 to 66 s -> 0 to 2 s per battle, archer
focus 0.78 to 0.94. Field battles now last about twice as long (both sides fight on), so raw mistake
seconds there grew (LONE 2 -> 16 s, attacker archers in melee 6 -> 23 s); the trace is not normalised
per battle second and the before run was on the pre-battle-stall base. Raw outputs were in the lane's
scratchpad; rerun with the commands in battle-lab SKILL.md.

Checks: npm run lint clean, npm run test:quick 477 files passed, src/battle/sim 16 files passed,
the two new stances tests fail with the features off. No API spend.

## Open
- Gunpowder/modern prince field attack (above). Next lever: the attacker's retreat threshold counts
  trained auxiliaries, so close battles flip on it.
- Sea AI: ships still fight to the last and in ones; needs its own line (naval classes) to act on.
- Laborers lost in walled assaults (12.5 per battle) are the attacker sweeping the town: no change.
- Commander powers: unchanged (rally at 3 shaken squads, strikes on a 1,200-strength cluster).
