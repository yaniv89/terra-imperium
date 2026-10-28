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

World balance (compare.sh origin/claude/integration, 150 turns, seeds 11-16, PLAYER=akkad): all 255 metrics identical on every seed (no player war reached 70 in these games); msPerTurn +20 ms of 1,209 under parallel load (timing, not starred).

Player at war (playerWar.sim.js, WHO=ai, PEACE=refuse: a warmonger refusing every offer, war at turn 40, 90 turns traced, seeds 11-18, base cece290d vs head):

| | base | head |
|---|---|---|
| wars ended within 90 turns | 4 / 8 | 7 / 8 |
| dictated peaces | 4 | 7 |
| dictated peaces warned a turn or more ahead | 0 | 7 |
| turns to the end where both ended (14, 15, 17, 18) | 26, 34, 25, 34 | 32, 40, 31, 40 |
| player cities lost (all seeds) | 7 | 5 |

The first head run found a second bug the warning exposed: once both sides were exhausted, the engine only offered a white peace every 5 turns, so a player who refused everything fought on for ever (base seeds 11, 12, 16 never ended either; head seeds 14 and 18 lost 3 cities each before the fix). The exhaustion offer now yields when the AI side already stands at the dictate line (test: "a warned, overwhelming AI dictates the peace even when both sides are exhausted").

Full suite before the merge: 505 files passed, 2 skipped (4,725 tests). After merging integration 54627085: lint clean, related tests (diplomacy, sieges, panels, turn report, i18n) 241 passed.

## The weak-neighbour war roll (the lead's yes, 28 Oct)

Asked: is the AI world too quiet? On the old base cece290d (seeds 11-14, 200 turns, scripted) a major's war reached the player in 1 of 4 games, and two of four round 2 players found no fight. The lead said yes to a 1.5x roll with guardrails; built as `weakNeighbourMult` in src/utils/aiLogic.js:
- only a Tier-1 major (the only ones that roll), only on the player, only when it borders the player and fields more (getEffectiveMilitaryPower), through declareWar (explore mode still blocks it);
- not before speedTurns(40) reference turns (waitAgeOf of both), not while a demand the player met still holds (demandMet), and pickWarTarget already skips a truce;
- one rng draw as before (`warRollChance` split out of shouldDeclareWar), so every other roll is unchanged; a roll only the factor let through never declares unjustified: it starts a claim, which the nation card shows ("Holds a claim on my city"), or does nothing.
- Tests: src/utils/weakNeighbour.test.js. engine-rules-reviewer: no rule findings; its one design note (the warning could repeat when the score swayed around 70) is fixed with a clear line at 50 (PEACE_WARN_CLEAR_SCORE). CLAUDE.md quirk updated.

Evidence, compare.sh origin/claude/integration 54627085, 200 turns, seeds 11-18, PLAYER=akkad:

| policy | significant changes | wars on the player per seed, base | head | defeats base / head |
|---|---|---|---|---|
| scripted | none (warsOnPlayer +0.13, [-0.17, 0.42]) | 1 1 1 2 1 1 1 1 | 1 1 2 2 1 1 1 1 | 0 / 0 |
| passive | none (263 metrics identical on every seed) | 1 0 1 1 0 1 2 2 | same | 0 / 0 |

Head, scripted: the first war on the player came at turns 190, 169, 180, 116, 100, 147, 116 and 137 (seeds 11 to 18), all after reference turn 40, in 8 of 8 games. AI-AI wars and world metrics: inside noise (warsTotal +0.13, no starred row).

Plainly: the lead's target (a major's war on the player in about 2 to 3 of 4 games) is already met by the current integration base (8 of 8 scripted, 6 of 8 passive). Lanes merged since cece290d changed that, not this roll. The factor adds little (one more war in one seed) and costs nothing measurable, so I kept it as approved, then lowered it (below).

**Lowered to 1.25.** The full suite after the roll went in failed endgameReachability's passive run: an AI (Gojoseon) completed the Future goal at turn 776 of 923, so the game ended on futureGoal, not the turn limit. It failed alone too, so it was not a load flake. I bisected it in two worktrees: without the roll the test passes, and without the diplomacy changes it still fails. Following the lead's rule (lower it rather than drop it), the factor is 1.25: the test passes. Head at 1.25, scripted, 200 turns, seeds 11-18: a war on the player in 8 of 8 games, the first at turns 170, 192, 122, 145, 92, 128, 190 and 117, no defeats. The compare tables above were run at 1.5; 1.25 is a smaller push. Full suite at 1.25 after merging integration 2f4fab48: 510 files passed, 2 skipped (4,768 tests); lint clean.

Note for the lead: this is one long seeded run, and a 1,200-turn passive game is chaotic, so 1.25 passing may be partly luck. If the pacing lane sees AIs reaching the Future early in its worldStats `leaderIn_future`, the roll is a suspect. What players still miss is an early fight: the first war comes at turn 100 or later. Bringing it forward means touching the wait (40 reference turns) or the Tier-1 roll itself, which is a design call for the lead.

Also measured, not changed (the lead's call): aggressor stacks of 2+ units stand idle at home in 61% of their war turns (warstacks.jsonl). Instrumented: almost all are 2-unit stacks in a "threatened" border city that hold as their own muster point and never reach the strike size. Wars still produce battles and captures, so I left it; a fix belongs with arming before the declaration (Civ VI war preparation), a bigger change for a later lane.

## Not done

- naval-8: the unordered Sinope landing (O 197).
- An earlier first war on the player (now turn 100 or later): the lead's call.
- Arming before a declaration (idle 2-unit stacks): a later lane, as the lead said.
