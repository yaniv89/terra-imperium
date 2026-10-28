# Lane raids-march: report

ponytail read in full at 14:37 UTC, 28 Oct 2026 (`cat .claude/skills/ponytail/SKILL.md`; the session start hook also printed PONYTAIL MODE ACTIVE).

Branch `claude/raids-march`, from `origin/claude/integration` 2f4fab48 (integration has not moved since). No API use.

## 1. Raids that ignored defence

### What the code did
- A raider picked a city to sack when the **army units** on its tile were under half the party (`raids.js` scanTargets). The town's militia and its walls were never weighed, though the sack battle fights both (raidBattle.js).
- A sack already on its way never looked at the city again: a garrison sent after the 3-tile warning changed nothing.
- The player's only warning came 3 tiles out, with no numbers. Hazor (playtest 40651416284): 20,000 raiders against 2,000 militia, sacked every 24 turns.

### What changed (raids.js)
- `cityHeld`: garrison + militia, divided by the walls' damage factor (siege.js), the defence as the sack battle fights it. A sack target needs the party to outweigh it 2 to 1 (`SACK_GARRISON_RATIO`, unchanged). The sack's score uses the same number.
- A running sack weighs the city again each turn. If it now holds half the party, the party turns back (`m.battle.raidDeterred`, stat `raidsDeterred`).
- When a raid sets out against the player, a warning (`m.battle.raidSetsOut`, crisis log) gives the party's men, the target, the turns to arrive (`raidEta`, the real march cost) and the number that turns it back: for a sack, the city's held defence and the target; for anything else, an army of party / `RAID_FIGHT_RATIO` in its path. It names the three answers: garrison, tribute, a strike on their city.
- Militia is cached per city per turn (cleared after a sack).

So the counters are now real and visible: one regiment in a town (10,000 men) turns back a 20,000-man party; walls multiply it. Tribute and a punitive strike already existed (indepPolicy.js offerIndependentTribute, canAttack on independents); the warning now points to them. References: Civ VI barbarians (a scout finds you first, a garrisoned walled city is not worth their while), EU4 rebels (you see the stack and its target before it arrives).

### Evidence: balance-sim (new `.claude/skills/balance-sim/raids.sim.js`)
Scripted player (answers blockers, never moves an army), seeds 11-16, 300 turns, Normal. Base 2f4fab48 vs this branch. Ages reached: up to Gunpowder.

| Seeds 11-16 | Base | Lane |
|---|---|---|
| Raids started | 1,353 | 1,354 |
| Sacks | 357 | 321 |
| Sacks that took the city | 313 (88%) | 279 (87%) |
| Sacks of a city holding at least half the party (held defence) | 6 (1 fell) | 0 |
| Raids turned back on the way | 0 | 14 |
| Raids at the player | 62 | 62 |
| Player cities sacked | 17 | 12 |

Per age (raids per 100 major city-turns; sacks; player cities sacked), base then lane:

| Age | Raid rate | Sacks | Player sacked |
|---|---|---|---|
| Stone | 0.45 / 0.45 | 21 / 21 | 0 / 0 |
| Bronze | 0.44 / 0.45 | 58 / 51 | 0 / 0 |
| Classical | 0.26 / 0.25 | 132 / 109 | 5 / 4 |
| Kingdoms | 0.13 / 0.13 | 123 / 111 | 12 / 8 |
| Gunpowder | 0.05 / 0.06 | 23 / 29 | 0 / 0 |

Median party / (garrison + militia) of a sack stays 5 to 15 to 1: almost every sacked city had no regiment at all. That is the intended reading now: an empty town is fair game, a guarded one is not, and the player is told the number in time. The scripted player never garrisons, so the counter itself is shown by tests, not by the sim.

Turn time and world stats (`compare.sh 2f4fab48 100 11-12`, JOBS=1, passive player): msPerTurn on seed 12 is 209 (base) against 216 (lane), within the sandbox's run-to-run noise. Seed 11's base run (485) overlapped the browser shots and is not usable for timing. nonFinite and auditViolations are 0 on both sides. Starred rows are small: sacks 9.0 to 7.5 (not starred), mercsHired +1, courtships -1, aiDevTotal -29 (0.6%).

### Tests (src/engine/raids.test.js)
- A sack warns the player as it sets out (men, turns, "they turn back if it reaches 15,000"); two regiments sent then turn the party home, no sack, the deterred line logged.
- A walled city (level 10) with one regiment is never sacked by a party of three in 40 turns.
- Both fail on the base code and pass here.

## 2. "March to Zafar" with no warning

- `battleOdds.js estimateMarchOdds(state, units, cityId)`: the marching land units against the city's garrison and militia (air support on both sides, as validateInvasion), through the same `simulate` as the attack card. Only what the player knows: the city's tile in sight or intel on its owner (intel.js), else `{ known: false }`. No new battle math.
- Shown before the march starts:
  - the march bar (MarchBar.jsx, memoized), right under the plan line: "Hopeless: Siwa holds 311,200 men to your 10,000. Auto takes it 0%." in red under 15% (`HOPELESS_HOLD`, the attack card's line), else brass; out of sight: "Siwa is out of sight: its garrison is unknown. March closer or spy on it first."
  - the city card's "March on" button description (RegionInfoModal.jsx), only for a drawable march.
- Text: src/components/map/marchOddsText.js; keys `march.odds`, `march.oddsHopeless`, `march.oddsUnseen` (en, he).
- Tests: src/components/map/marchBar.test.js (known hopeless garrison; out of sight).

### Shots (scripts/ui/raids-march-shots.mjs, plans/ui/raids-march/)
844x390 and 1600x900, en and he: march bar and city card. The odds line reads in full on the phone (two lines, above supply). No page errors. One run (1600x900 he) drew a world where the nearest independent was beyond march range: no plan, so correctly no odds line.

## Engine review
`engine-rules-reviewer` on the diff: no rule violations. Its three findings were fixed: the city card ran the odds on every render (now only for a valid march), air support left out of the march odds (added), militia rebuilt per candidate city (cached per turn).

## Questions for the lead
- Raid parties still outweigh an unguarded town 5 to 15 to 1. I did not shrink parties or raise the town militia (battleInputs.js is shared by every battle and the parityEco calibration). If raids should be weaker against empty towns too, that needs your yes.
- The set-out warning is given even when the party is in the fog (read as scouts' report). Say if it should need sight of the party.

## Not done
- No fresh AI playtest (needs a budget).
- The sim covers Stone to Gunpowder only (300 turns).
