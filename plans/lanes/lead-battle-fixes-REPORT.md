# Lane lead-battle-fixes: report

Ponytail read in full at 17:45 UTC, 28 Oct (whole SKILL.md printed with `cat`, plus the session start hook).
Branch `claude/lead-battle-fixes` from `origin/claude/integration` 37cbf067. No sim rule changed, so no
SETUP_VERSION bump and no parityEco rerun. No API use.

## 1. The sandbox army that died for 50 kills

### What the taps send
A real-browser run of the lead's steps (844x390, `?battleSandbox`, Start, All, Enemy, Attack, tap the field
centre, each game minute at 3x; the Worker's postMessage logged) shows the order the game sent:

    {"type":"attack","squads":[0,1,2,3,4,5,6,18],"target":{"kind":"structure","index":0}}

The Enemy button points the camera at their keep, so the tap after Attack lands on the keep, and a tap on
an enemy building (and the "Attack it" button) sends a focused `attack` on that building for every squad.

### Why that kills the army
Headless trace of the sandbox's exact default battle (new tool `.claude/skills/battle-lab/sandboxTrace.sim.js`:
mixed, kingdoms, balanced v balanced, fort 2, the economy on, the real sample tile, the order repeated every
minute), seeds 1 to 8:

| order (same taps) | wins | your losses | their regiments lost | tower losses |
|---|---|---|---|---|
| `attack` on the keep (before) | 0 of 8 (camp burned) | 8,600 of 8,600 every seed | 2,091 to 3,109 of 7,700 | 2,843 to 4,266 |
| attack-move to the keep (after) | 7 of 8 (base destroyed, keep 0) | 6,504 to 8,392 | 6,402 to 7,384 | 2,520 to 3,575 |

The 5 s trace shows why: a squad on a focused attack walks to the building and ignores the enemy squads it
passes until one hits it (combat.js retaliation), each at its own pace (the user's ruling Q6), so the cavalry
reaches the walls alone at 20 s and dies, the infantry at 30 to 40 s, the archers walk into melee, the siege
engine arrives alone at 120 s. They die one by one under the keep, the tower and the garrison, which stands
inside out of reach; the defender trains its base back (7 to 9 buildings). An attack-move fights whatever is
in sight on the way, so the army meets the defenders together, then razes on (movement.js continueAssault).

Real browser, the lead's taps (logs in the shots folder):
- before: army 8,920 at 38 s, 3,784 at 103 s, 500 at 293 s; them 8,020 rising to 8,577; ended (camp) at 335 s.
- after (en): the same taps now send `attackMove`; you 8,895 / them 7,995 at 36 s, 4,214 / 4,413 at 130 s,
  the keep down at 238 s, them 1,934 at 512 s with their base at 6 and the fight going on.
- after (he): an even trade to 128 s (3,320 / 4,871), then lost: the taps land at slightly different ticks
  each run, and an assault on walls with near-equal armies can go either way (below).

How the outcome depends on how often the order is repeated (headless, seeds 1 to 8, wins for the attacker):

| repeat every | attack-move (now) | focused attack (before) |
|---|---|---|
| 30 s | 5 | 0 |
| 45 s | 5 | 0 |
| 60 s | 7 | 0 |
| 90 s | 2 | 0 |
| once | 0, but they lose 4,223 to 6,324 of 7,700 | 0, they lose 0 to 3,302 (seed 4: 0, the "50 kills") |

So the fix removes the blind loss; it does not make the sandbox's defaults a sure win (8,600 against 7,700
behind walls, a garrison out of reach and their training). No balance change was made for that.

### The fix (UI only, the sim untouched)
`src/battle/input/selection.js` `buildingAttackOrders`: an attack on an enemy building by a GROUP (a tap on a
structure or an enemy economy building, or "Attack it") is an attack-move to it; ONE squad keeps the plain
attack the player chose. TacticalBattleScreen.jsx uses it in the three places. The target ring, marker and
note stay as before. An attack on a squad is unchanged.

Why not a sim rule ("an attack on a building fights what it meets on the way"): the AI sends siege engines
and raiders at buildings with that same order on purpose (tacticalAI.js thinkAttacker, thinkRaider), so a sim
rule would change raid and assault balance and need SETUP_VERSION and parityEco; the order the player meant
already exists. Proven games: in StarCraft and Age of Empires an attack-move is the order for "take the army
there"; an explicit target is the focus order for a unit or a few, which is what one squad still gets.

Tests: `src/battle/input/buildingAttack.test.js` (the helper; the sandbox battle at seed 7: the old order
loses, the new one ends `baseDestroyed` for the attacker).

## 2. The sack defence goal and its end

- The goal (battleType.js, he.battle.js) now says the player's goal first:
  "Save the town to the clock: you lose if they burn 2 buildings or houses and get away. If they burn
  them, catch every raider" (the raid the same with the loot targets). Hebrew the same.
- The bar for the defender reads "They burned 0: at 2 you lose" (`bt.status.lootDef`, en and he); the
  raider's own bar keeps "Burned 0 of 2 needed".
- The end rule (step.js raidEnd) was checked: with fewer than the needed burned, a sack ends for the raiders
  only on `defendersBroken`, which needs no defender squad standing (isBroken). In Hazor the player's one
  regiment (2,200 against 20,000) was destroyed in 46 s: the end was right, the words were not. The result
  screen's reason already said "Your army is broken: nobody left to fight."; the campaign line under it said
  "broke into Hazor and got away with the loot". Now battleOutcome.js raidAdapter says, when the end was
  `defendersBroken`: "The Libu horde cut down every defender of Hazor; with nobody left to stop them, they
  sacked it." (`m.battle.sackOverrun`, `m.battle.raidOverrun`, en and he).
- Tests: raidBattle.test.js (a sack ended for the raiders with fewer than the needed burned has reason
  `defendersBroken` and no defender standing, seeds 1 to 3, two of them hit the case; the overrun line vs
  the got-away line), battleHudModel.test.js (the defender's goal text).

Not changed: the battle reports list headline for a lost sack still reads "{place} sacked: the raiders got
away with the loot" (battleReportView.js; the report entry does not carry the end reason). The "Housing ·
ruined 0/7" chip counts houses, not the loot rule's buildings or houses.

## Evidence
- Shots (844x390, en and he): plans/lanes/lead-battle-fixes-shots/.
- Commands: `ORDER=attack|attackMove|split SEEDS=1-8 VERBOSE=0 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/sandboxTrace`
  (`split` is what the game now sends).

## Checks
- Full `npx vitest run`: 512 files passed, 2 skipped; 4,792 tests passed, 17 skipped. `npm run lint` clean.
- Real browser: before and after at 844x390, en and he (assault), sack goal en and he. No page errors.
- Not done: the engine-rules-reviewer (the engine diff is one message line in battleOutcome.js; the lead runs it before merging).
- Seen, not fixed: the order note "Attack-move: 1 squads on their way" (plural for one, assault-after-en-3min.jpg).

## For the lead
- Design call made (please confirm): a group's attack on a building is an attack-move to it; one squad keeps the focused attack. Evidence above.
- The sandbox defaults (8,600 against 7,700 behind fort 2 walls) win 0 to 7 of 8 depending on how often the player re-orders; if the sandbox should be an easy demo, give the attacker more, not the rules.
