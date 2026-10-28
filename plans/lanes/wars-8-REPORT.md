# Lane wars-8: report

ponytail read in full at 12:09 UTC (28 Oct) (`cat .claude/skills/ponytail/SKILL.md`, whole file; the session start hook also printed PONYTAIL MODE ACTIVE).

Branch `claude/wars-8` from claude/integration cece290d. Areas: "Wars and AI" (3.3 / 4 in round 2), "Units and armies" (4.3 / 6), "Diplomacy" (5 / 7). Target 8.

## Every round 2 complaint in my areas, and where it stands

Runs: newcomer 40650969714 (N), warmonger 40650973042 (W), civ veteran Sonnet 40650976677 (S), civ veteran Opus 40651416284 (O). The playtests ran on integration 8a6d1234 / c2276bd8; 47 commits have landed since.

| # | Complaint (run, step, shot) | Status |
|---|---|---|
| 1 | Peoples header "0 MET" over listed peoples (W 27-31 step-031, S 23 step-023, O 25) | already fixed on integration (peoplesModel counts every listed people) |
| 2 | War declared on an unmet, unseen people for 300 gold, nothing to fight (W 28-31, 46) | already fixed (73e89eff, `declareWarModel` blocks it) |
| 3 | Tapping a foreign unit opened Declare war (N 116 step-116) | already fixed (66614b14, safe foreign-unit tap) |
| 4 | Peoples actions cut off by End Turn on 844x390 (S 21-23, N 28, 98) | checked now: the tab scrolls its last row clear of the dock (shot war-card-bottom-phone-en.jpg) |
| 5 | Forced peace "the war is lost" with no warning while a 20k army marched (O 100) | **fixed here**: a warning turn and an offer first |
| 6 | Wars with no clear goal or end; war score is a bare number (O 348, S 164) | **fixed here**: the enemy card says the war's aim and how it ends |
| 7 | A siege marker vanished with no message (O 148) | **fixed here**: both sides are told the siege is lifted |
| 8 | "Still at war with Kerma" right after accepting a white peace (S 214-215) | **fixed here**: accepting one peace names the war that goes on |
| 9 | March-to walked into a 228k-342k garrison with no warning (O 286 step-286) | already fixed (8c0a3ab9 march warnings; 6186df1e hopeless odds) |
| 10 | Odds card left out auxiliaries (O 231-237) | already fixed (7c47beae) |
| 11 | Unordered amphibious assault on Sinope, 6,720 lost (O 197) | naval-8's area (aiLanding / player landings), not touched |
| 12 | Idle badge counts stranded settlers (O 385) | already fixed (c4f34252) |
| 13 | First-contact card opened the wrong people (N 165) | already fixed (deep links survive StrictMode, 31b712a3) |
| 14 | No war or AI aggression seen by turn 57 (N, Wars 2/10); a warmonger gets no early fight (W 48) | evidence below, raised with the lead, no change |
| 15 | Raids badly outnumber cities (W 146, 175; O 152) | battle-odds lane made raid warnings actionable (635e2e25, 8c0a3ab9) |
| 16 | Army idles after a march and needs a new order (W 45, 57) | by design: a march ends on its tile; the Idle chip points to it |
| 17 | Merge, split, strength, supply hard to see | checked ArmySheet: merge buttons, per-unit pick to split a march, men, morale, supply state and resupply route are all there; no change |

## Changes

1. **A warning before a dictated peace** (src/engine/diplomacy.js). EU4 enforces only at 100% war score after the loser had the chance to answer; Humankind shows war support falling before a forced surrender. Here: when the AI side's score reaches `PEACE_WARN_SCORE` (70) the player gets a combat line ("X is winning the war (score N for them). At 90 they dictate the peace, from next turn on...") and `war.peaceWarnedTurn` is set. The AI dictates at 90 only on a later turn than the warning; the first turn over 90 sends an offer with its terms instead (the player can still accept them). Falling under 70 clears the warning so a new push warns again. Thresholds are exported for the UI.
2. **The war's aim and end on the enemy card** (src/components/panels/warStatusModel.js, NationCard.jsx). Under the war score: "Their aim: take Kish." / "Your aim: break their army." and one line where the score stands against the engine's lines: even, winning (offer a peace with demands), losing, close to defeat (at 90 they dictate). en and he.
3. **Siege lifted** (src/engine/sieges.js): the besieger and the owner each get a line when the last besieger leaves. The lead's item (map-8, O 148): it is a combat news item in the turn report that matters (the sheet opens), names the city and carries it as its place, so the report's jump shows it on the map (turnReportModel.test.js). A city that falls is already in the report's Cities group (taken or lost, with the why), and broken walls already had their line (m.battle.siegeBrokeWalls).
4. **Still at war** (gameReducer.js ACCEPT_PENDING_PEACE): one line per war of the player's that goes on.
5. Harness: playerWar.sim.js reports `peaceWarns` and `forcedPeaces`.

## Evidence

Tests: diplomacy.test.js (warning then enforcement, warning cleared, still-at-war line), sieges.test.js (lifted lines once), warStatusModel.test.js.

Real browser (scripts/ui/wars8-shots.mjs, dev server 5197, 844x390 and 1600x900, en and he, no page errors): plans/lanes/wars-8-shots/. The text on all four: "Their aim: take Kish. Close to defeat: at 90 they dictate the peace. Win a battle, retake a city or offer peace now." (he mirrored and in order).

BALANCE_PLACEHOLDER

## For the lead: is the AI world too quiet?

Base telemetry (worldStats, POLICY=scripted, Normal, 200 turns, seeds 11-14, Akkad):

| seed | AI wars total | wars on the player | major demands | tribute demands | raids on the player |
|---|---|---|---|---|---|
| 11 | 11 | 0 | 2 | 4 | 4 |
| 12 | 9 | 0 | 2 | 2 | 3 |
| 13 | 8 | 0 | 2 | 2 | 5 |
| 14 | 7 | 2 (from T116) | 1 | 2 | 3 |

AI wars are not empty: 4 to 11 battles each, 25-31 sieges and 9-16 captures per game. But a player who does not start wars meets a major's war in 1 of 4 games in 200 turns, and something hostile (raid, demand, war) about every 20 turns. Two of four round 2 players called the early game "End Turn plus cards" and found no fight. I did not change it (CLAUDE.md: quiet by design). Proposal if the lead agrees: let a Tier-1 neighbour that borders the player and outnumbers it use the war roll on the player at 1.5x after turn 40 (Civ VI and Old World AIs pick the weak neighbour), checked with balance-sim warsOnPlayer and playerWar.sim.

Also measured, not changed: aggressor stacks of 2+ units stand idle at home in 61% of their war turns (warstacks.jsonl). Instrumented: almost all are 2-unit stacks in a "threatened" border city that hold as their own muster point and never reach the strike size. Wars still produce battles and captures, so I left it; a fix belongs with arming before the declaration (Civ VI war preparation), a bigger change for a later lane.

## Not done

- naval-8: the unordered Sinope landing (O 197).
- The AI aggression question above waits on the lead.
