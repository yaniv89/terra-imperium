# Playtest audits: campaign baseline (W00), 2026-10-13

Measured on `claude/pa-w00-telemetry` (base `claude/integration` at b90623d9), before any audit fix.
Every number below is from the files in [playtest-audits-baseline-2026-10-13/](playtest-audits-baseline-2026-10-13/);
the full tables (every metric, every seed, every checkpoint) are in `tables.md` there. Nothing here
changes a game rule. Later lanes compare against this with the same commands.

## What was run

World: the peoples world (`SCENARIO=peoples`, standard size, world seed = game seed), whole world,
all AI nations playing. The player is a **scripted player** (`POLICY=scripted`, see
`.claude/skills/balance-sim/SKILL.md`): it answers every blocker (events, peace offers, defenses by
Auto, demands, tribute, join offers), queues what an AI would build in each idle city, and sends its
settlers to the best site in reach. It never declares war and never moves an army. Demands are
refused by default (`DEMANDS=refuse`); one set of runs pays them (`DEMANDS=pay`).

| set | player | speed | seeds | turns | folder |
|---|---|---|---|---|---|
| Australia start, Normal | gunditjmara (`au`) | normal | 11, 12, 13, 14 | 200 | `au-normal` |
| Australia start, Marathon | gunditjmara | marathon | 11, 12 | 200 | `au-marathon` |
| Egypt start, demands refused | kemet | normal | 11, 12 | 250 | `kemet-normal-refuse` |
| Egypt start, demands paid | kemet | normal | 11, 12 | 250 | `kemet-normal-pay` |

The Australia start never meets another major and is never demanded from, so it is the quiet
reference. The Egypt start meets 4 to 6 majors and gets the demands, so it carries the tribute and
contact numbers. Same seeds give the same numbers; the kemet pair is identical until the first demand
(turn 159) and then differs because of the answer.

## Commands

```bash
# the four sets (about 10 to 30 minutes each on this machine, 2 to 4 seeds at a time)
scripts/w00-baseline.sh                                                       # au, normal, seeds 11-14, 200 turns
SPEED=marathon SEEDS=11,12 JOBS=2 scripts/w00-baseline.sh                     # au, marathon
PLAYER=kemet TURNS=250 SEEDS=11,12 JOBS=2 OUT=<dir>/kemet-normal-refuse scripts/w00-baseline.sh
PLAYER=kemet TURNS=250 SEEDS=11,12 JOBS=2 DEMANDS=pay OUT=<dir>/kemet-normal-pay scripts/w00-baseline.sh
node scripts/w00-baseline-report.mjs plans/data/playtest-audits-baseline-2026-10-13 > tables.md

# one run by hand (what the script runs per seed)
SCENARIO=peoples PLAYER=au POLICY=scripted SPEED=normal TURNS=200 EVERY=25 SEEDS=11 \
  OUT_DIR=/tmp/w00 TRACE_WARS=1 \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/worldStats.sim.js

# before and after a change (paired seeds, with the new keys): same env, then
SCENARIO=peoples PLAYER=au POLICY=scripted .claude/skills/balance-sim/compare.sh <base-ref> 150 11-18

# the standalone harness
node scripts/simulate.mjs --games 2 --turns 100 --scenario peoples --policy scripted --player au

# battle-lab (X15)
ORDER=attackStructure FORT=2 STRUCT=1 DEF=ranged ATT=infantry,infantry,infantry,infantry,ranged,ranged TICKS=4000 \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/squadTrace
ECO=1 FORT=2 ORDER=attackStructure TICKS=4800 \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/squadTrace
```

All runs ended `ACTIVE` with `auditViolations=0` and `nonFinite=0`. `msPerTurn` is 150 to 350 ms
here (the sandbox is slow and 2 to 4 runs shared the machine; telemetry time is left out of it).

## Headline numbers

Mean over seeds, final turn. Range in the tables.

| | Australia, Normal (T200) | Australia, Marathon (T200) | Egypt, refuse (T250) | Egypt, pay (T250) |
|---|---:|---:|---:|---:|
| player gold | 11,437 | 3,942 | 21,137 | 5,979 |
| player ADM / DIP / MIL | 1394 / 1329 / 1197 | 1357 / 1260 / 1252 | 1732 / 1724 / 1479 | 1714 / 1698 / 1471 |
| player cities (outposts not counted) | 7 | 3 | 6 | 5 |
| player production per city (mean) | 7.7 | 8.3 | 7.2 | 7.1 |
| AI city production, median of all AI cities | 8.8 | 8.5 | 8.8 | 8.8 |
| top AI nation: cities / production per city | 17.8 / 12.3 | 11 / 11.5 | 25.5 / 12.7 | 26 / 12.4 |
| first settler / second city / first building | T20 / T34 / T35 | T42 / T73 / T64 | T16 / T29 / T27 | same |
| **first unit (not a settler)** | **T112** | **T184** | **T133 (T89, T176)** | same |
| majors met | 0 | 0 | 5 | 5 |
| wars between majors declared | 8 | 11.5 | 12.5 | 10.5 |
| war length, median / longest | 12 / 17 | 11 / 17 | 12 / 17 | 12 / 17 |
| sieges begun / cities captured | 8 / 26 | 18.5 / 15 | 12.5 / 34 | 10.5 / 36 |
| conquests still held 20 turns later / lost within 20 | 16 / 5 | 8.5 / 5 | 26 / 4 | 27.5 / 5.5 |
| rebellions started (whole world) | 109 | 116 | 130 | 132 |
| AI land units that moved in a turn, all / in a war | 4% / 60% | 3% / 46% | 5% / 79% | 4% / 70% |
| top AI overextension / authority | 82 / 55 | 18 / 53 | 150 / 55 | 155 / 50 |
| top five AI overextension / authority (mean) | 61 / 59 | 4 / 52 | 126 / 51 | 125 / 50 |
| demands from majors / tribute demands from independents | 0 / 0 | 0 / 0 | 0.5 / 19.5 | 0.5 / 18 |

## What the numbers say (for the lanes that follow)

1. **War length is capped at 17 turns, in every set.** Not one war between majors lasted longer
   (longest 17 in all 4 sets, 100 wars). That is the flat exhaustion of 5 a turn reaching the
   white-peace threshold (addendum X22). It also matches the shuttle and idle shares below.
2. **AI stacks in a war: about a third move, a quarter shuttle, a quarter sit at home.** Over
   3,000 stack-turns: moved 30 to 39 percent, shuttled (back to the tile left two turns before) 24 to
   28 percent in Normal, besieging 7 to 10 percent, waiting on a route 1 to 6 percent, idle at home 21
   to 25 percent, idle in the field 1 to 7 percent. Marathon shuttles far less (5 percent). The worst
   stacks go 15 to 16 turns (a whole war) without moving, and several shuttle 12 to 15 turns running.
   The per-turn rows (`warstacks-<seed>.jsonl`) say which stack, which tile and why.
3. **Outside a war the AI barely moves (2 to 3 percent of land units a turn), inside a war 46 to 79
   percent.** "Low unit movement" in the audit is mostly peace-time garrisons, which is correct.
4. **The player's first real unit comes very late.** First non-settler unit at turn 89 to 184 with
   the scripted player, while the first building comes at turn 27 to 64 and the second city at turn
   29 to 73. The advisor-style production queue builds economy first. A later pacing lane should
   decide whether that is a bug (it is also what AI cities do with the same chooser).
5. **Player production is lower than the AI's.** Player production per city 7 to 8 against 8.8 median
   for AI cities and 12 to 13 for the top AI nation's cities.
6. **Tribute is regular, escalating and almost never followed by war.** The Egypt start gets a demand
   from a major every 5 turns from turn 159 (media, kanesh, cyrene) and from independents all game.
   Refused, the quote grows with the treasury (1,905 gold at turn 159, 4,339 at turn 249: about 20
   percent of gold). Paid, it is 800 to 2,400 and the treasury stops growing (gold peaks near 8,000 at
   turn 150, then falls to 6,000). A war on the player followed within 10 turns in 2 of 40 refused
   demands and 1 of 37 paid ones. One quote was 0 gold (media, turn 179, both runs): worth a look.
   Independents ask 2 to 4 gold at a time (libu, nabataea).
7. **Contact is slow and missing for remote starts.** Egypt meets 1.5 majors by turn 75, 3 by turn
   150, 5 by turn 250. Australia meets none in 200 turns.
8. **Conquests mostly hold:** 60 to 90 percent are still held 20 turns later (Normal Australia 16 kept to 5 lost, Egypt 26 to 4, Marathon 8.5 to 5; means over
   seeds), so the retention problem is in the player's hands (occupation actions) more than the AI's.
   Rebellions are frequent: 110 to 130 whole-world rebel outbreaks in 200 to 250 turns, 0 to 2 in the
   player's cities, 0 to 3 that win outright.
9. **Overextension climbs only on the continent with room.** The top AI's overextension reaches 82
   (Normal Australia seeds) to 150 (Egypt) by the end; in Marathon it stays near 0 to 36. Authority
   of the top AIs stays 47 to 66, near the player's (42 to 54).
10. **Gold piles up when nothing is bought.** Refusing everything leaves the player with 11,000 to
    21,000 gold at the end, with nothing to spend it on: there is no gold sink the scripted
    player uses (X24). Power points (ADM/DIP/MIL) rise linearly to about 1,200 to 1,700 unspent.

## Scripted player limits (read before comparing)

- It builds what the AI chooser picks; a human would choose differently. First-unit and
  first-building turns are therefore a property of that chooser plus this economy.
- It never attacks, so `warsOnPlayer`, `capturesTotal` and `conquestsKept20` count AI wars only.
  Kept and lost conquests are judged for any capture, by anybody.
- `majorsMet` is 0 for the Australia start in all seeds: use the Egypt start for contact work.
- Stacks are keyed by their lowest-id unit; a stack that merges or splits gets a new key, so
  "longest run without moving" can under-count. Verdict is per stack per turn, not per unit.
- Settlers choose with the AI's own site search; their timing depends on it.
- Seeds 11 to 14 only. 4 seeds resolve a difference of roughly one sd (balance-sim says use 6 to 8
  for wars and conquests). Treat the war and conquest counts as orders of magnitude until a larger
  paired run.

## New measurements (what the harness now reports)

All additive; the old keys and their order are unchanged. Defined in
`scripts/campaignTelemetry.mjs`, listed in the balance-sim skill. Per player: ADM/DIP/MIL, gold range,
cities, production per city, first unit / settler / building / second city turn. AI: production per
city (p10, median, p90, top nation, top five), unit movement rate (all, war, peace), majors met,
overextension and authority (top, top five). Events: tribute and demand answers with the outcome and
whether a war followed in 10 turns, wars declared and their length, sieges begun, captures, conquests
kept or lost at 20 turns, rebellions (started, on the player, on conquered land, succeeded). Per war:
the one-stack-per-turn trace (`warstacks-<seed>.jsonl` and `warStacks` in `telemetry-<seed>.json`).

## Not measured (for later)

Treasury-to-income ratio and currency utilization (needs income per turn from `calcIncome`), reachable
war targets, trade uptime, and an expansion or military player policy. The scripted player is the
only policy so far.
