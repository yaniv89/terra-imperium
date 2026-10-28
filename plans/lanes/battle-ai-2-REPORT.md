# Lane report: battle-ai-2

ponytail read in full at 14:33 UTC, 28 Oct 2026 (`cat .claude/skills/ponytail/SKILL.md`, whole file; the session start hook also printed PONYTAIL MODE ACTIVE).

Branch `claude/battle-ai-2`, merged with `origin/claude/integration` (2f4fab48) before the push. SETUP_VERSION 29 -> 30. No API use.
Files: src/battle/sim/tacticalAI.js, src/battle/setup/buildBattleSetup.js (version), stances.test.js (2 new tests, 1 updated),
kernel.test.js (sample tick), battle-lab aiDuel.sim.js (siege row, larger sea rows, target column) and SKILL.md.
Evidence files: plans/lanes/battle-ai-2/ (three headless traces, the sea shot).

## Where the Gunpowder-to-Future AI was weak (traces)

1. **The line arrived squad by squad.** `keepTogether` let a squad run 6 tiles ahead of the slowest. A musket reaches 4 tiles,
   so the lead squad walked into the enemy line alone and took every volley (gunpowder field, seed 1: attacker infantry #1 at
   x=77 while the rest stood at 64 to 70; it routed at 44 s before the others were in range).
2. **Musket and rifle foot never focused.** Focus fire only covered class `ranged`. From Gunpowder on, the foot are shooters too
   (`melee: false`), so the bulk of the army spread its fire.
3. **A focus-fire bug.** The "switch only for a 1.5x better target" check scored the current target without its threat bonus,
   so an archer left an enemy rider that was on top of our archers for another target.
4. **Cavalry at Prince stayed off escorted targets and never rode round the flank** (King+ only).
5. **Squads sent on alone to the army's point** (one squad = no formation slot) walked onto the same spot as the rest.

## What changed (Prince+ unless noted; all through ordinary orders and the AI's own fog)

- **Battle line, one slot per squad** (Total War's AI deployment): foot in the front row, cavalry on its wings, archers a row behind
  melee foot but beside musket foot (a row back, their longer reach was spent on the gap), engines and support behind. All levels.
  Ships keep their old line order (no gain at sea).
- **Cohesion 3 tiles on land** (was 6): no squad more than a musket's reach ahead of the line. Ships keep 6.
- **Musket and rifle foot focus fire** with the archers (StarCraft focus fire; the same scoring: counter, how many of ours reach
  it, fewest men).
- **The focus-fire switch bug** fixed (one score for the pick and the current target).
- **Prince cavalry rides round the flank** to enemy archers and engines once the lines meet (Total War cavalry), as King did.
  Laborer raids and camp raids stay King+.
- Not changed: battle rule Q3, the 3-minute grace before a march-out, walls held, unit rules, Auto.

## Evidence: new AI against the old (aiDuel, economy on, mixed terrain)

Attacker wins per column. OO old vs old; NO new attacker vs old defender (higher = better attacker); ON old attacker vs new
defender (lower = better defender). Rows: 3 land armies (mixed mirror; two cavalry vs two archers; with a siege engine each).

| level, type, ages | battles per column | OO | NO | ON |
|---|---|---|---|---|
| Prince field, Gunpowder, Modern, Information, Future | 240 | 45 | **89** | **22** |
| Prince field, Bronze, Kingdoms | 120 | 53 | **72** | **39** |
| Prince walled city, Bronze, Kingdoms, Gunpowder, Modern (12 seeds) | 144 | 127 | 135 | 128 |
| King field, Bronze, Gunpowder, Modern, Future | 240 | 36 | **67** | **25** |

Exchange (attacker losses / defender losses) moves the same way, e.g. Gunpowder siege row: OO 1.36, NO 0.86, ON 1.94.
One row went the other way: King, Bronze, siege row, NO 3 of 20 vs OO 8.
Walled city: the attacker wins 88% either way. The new AI is neutral as defender there, with better exchanges (Modern siege row:
ON 0.68 vs OO 0.53).

aiTrace, AI against itself, 4 seeds, field (before -> after; attacker wins of 4): Gunpowder 0 -> 1, Modern 1 -> 1,
Future 0 -> 2 (4 seeds is a small sample; the duel table above is the measure). Shooters sharing a target: Modern 0.63 -> 0.79,
Future 0.51 -> 0.76, Gunpowder 0.67 -> 0.60 (the musket foot now count as shooters, so the pool is bigger). Bad-matchup
seconds in Gunpowder rose (13 -> 20 attacker, 23 -> 36 defender): musket foot now count, and infantry shooting archers is
counted as a bad matchup.

Headless traces (plans/lanes/battle-ai-2/): `trace-field-gunpowder.txt` (the NO run: the line arrives within 3 tiles, all four
shooters on the defender's cavalry at 60 s), `trace-siege-gunpowder.txt` (walled assault with a gun each), `trace-sea-gunpowder.txt`.

## Sea: tested, nothing beat the old AI, so it is unchanged

aiDuel sea, 30 seeds, Kingdoms to Future, 4 v 4, 6 v 6 mirror, 8 v 8 with transports. What I tried, and why each lost or tied:

| sea behaviour | result |
|---|---|
| per-ship focus fire (Lanchester, threat-weighted by line and rate of fire) | new attacker +11, new defender -10 of 150: a wash |
| whole fleet on one target | lost almost everything (ships chasing one target stop firing at the rest) |
| wing ships round the end of the enemy line for flank hits | lost almost everything (the flanker sat on a move order it could not finish and never fired) |
| wounded ships (under 25%) leave the field | both sides worse (fewer guns firing) |
| battle-line slots and 3-tile cohesion at sea | Gunpowder new attacker 7 -> 1 of 20: reverted |

Why targeting barely matters at sea: a ship hits for its own strength (combat.js), so spreading or focusing fire wears a fleet
down at about the same rate. What does matter is the hit arc (flank x1.3, rear x1.5 and extra morale loss), and a ship that
turns to a far target gives its flank to the ship opposite. The 6 v 6 mirror always goes to the defender because the attacker
retreats at 25% first.

Wind: the sim has no wind, so the AI cannot use it. It would be a new rule (design call, below).

Browser: a Gunpowder sea battle at 844x390 (`?battleSandbox&sea&age=gunpowder`, first-battle tips taken as seen, 3x, 20 s):
`plans/lanes/battle-ai-2/sea-gunpowder-844x390.png`. Ships fire, smoke shows, the HUD reads "Sink or scatter the enemy fleet",
no page errors (only the SwiftShader "GPU stall due to ReadPixels" warnings).

## parityEco (Auto stays honest)

N=16, field, walled assault and town x Bronze, Classical>Kingdoms, Gunpowder, Modern x 3 armies, mixed terrain.
Before (integration 2f4fab48): **36 of 36 IN**. After: **36 of 36 IN**. AUTO_TUNE unchanged.
Biggest moves: field Gunpowder 3 v 2 0.89x -> 0.57x, field Modern 3 v 2 0.75x -> 0.56x (the closest row to the 0.5x floor),
assault Modern siege 1.05x -> 1.54x. Outputs: the lane's scratchpad (parityEco-base.txt, parityEco-new.txt); rerun with the
command in battle-lab SKILL.md.

## Checks

- `npm run lint` clean. `npx vitest run src/battle`: all pass. Full `npx vitest run`: see the last section.
- New tests (stances.test.js "the AI in the Gunpowder ages and on"): musket foot focus on the weakest in reach (fails without
  the change: they did not focus); the battle line (one slot each, cavalry on a wing, archers behind melee foot, beside musket
  foot). The march-out test now checks each squad gets its own slot in the same think.
- kernel.test.js "target finding" samples tick 600 instead of 400: its own checks pass; its "at least 50 squads have a target"
  precondition fell to 39 at tick 400 because the bench armies now march in line and meet later.

## For the lead (design calls)

1. **Wind at sea** needs a sim rule first (for example: speed x1.2 with the wind, x0.8 against; or gun ships' reach). Then the AI
   can be taught to take the weather gauge. Not built: it changes the rules, your call.
2. **Ships' facing**: if broadside fire were a rule (a gun ship fires full only side-on), "keep formation" and "cross the T" would
   become real AI levers. Today a fleet's AI has almost nothing to win with.
3. **Prince cavalry now flanks** like King's. It keeps Prince below King (no laborer or camp raids, no pull-back). Fine?
4. **Walled assaults**: the attacker wins 88% of walled mirror assaults with either AI. That is balance (walls, militia), not this
   lane.
5. Not done: artillery that keeps range in field battles. Marching guns with the army made the attacker lose more (29 -> 14 of
   80 wins: the whole line slows to the guns' 0.9 tiles a second). The guns still go for the enemy's base on their own.

Skipped: King+ pull-back for shooters (tested at Prince: worse both ways), a halt-and-dress before contact (tested twice: the
attacker got worse, 2 of 20 vs 8 in Gunpowder; squads on attack-move lock targets the moment they see the enemy).
