# Lane naval-9: report

ponytail loaded at session start (Skill `ponytail:ponytail`, full text printed; the session start hook also printed "PONYTAIL MODE ACTIVE").

Target: Naval (2, 6 and 6 in round 3b) at 8 or more. Base: claude/integration 039d3c18. The round 3b runs played a0312e08, which already had lane naval-8 (AI fleets, ship rows with cargo and pace), so every finding below still stood on the current build.

## For the lead

**Design call (finding 4): naval combat almost never happens, and fleet against fleet never.** Over 8 headless games of 150 turns (below) the player fought 0 or 1 sea battles a game (3 in all, every one an AI landing) and no nation, player or AI, fought a single fleet-against-fleet battle. UI hints cannot fix that: there is nothing at sea to fight. Proposal, smallest first:
1. **Pirate fleets (recommended).** From the Bronze age, an independent with a sea coast (the `seaRaiders` names already exist in data/independents.js) now and then puts one weak raider ship off a coastal major's port (once per N reference turns via `speedTurns`, never in Explore mode). It blockades the port's sea trade until sunk; it uses the existing `aiFleetAttack` gate and navalBattle.js, so the player's first warship has a target and a reason. Civ VI barbarian galleys and EU4 pirates/privateers do this job.
2. AI fleets at war hunt the player's fleets within a few tiles (today only the one-tile `aiFleetAttack`).
Both are engine changes (add-mechanic, balance-sim, engine-rules-reviewer). I have not started either. Say which (or neither) and I will build it on this branch.

## Findings

| # | Finding (playtest step) | Root cause | Fix | Before | After |
|---|---|---|---|---|---|
| 1 | No city could build ships until step 145 (civ-veteran 82 to 139); no ship row, no hint why (newcomer 70 to 76) | cityBuildModel.js listed ship rows only in sea-coast cities (I039 removed them inland so they did not look available), so an inland city said nothing at all. The veteran's three cities were inland; the port was Jerusalem | A **Ships** filter (its own group, so a chip in the build list's filter row). An inland city shows one greyed, locked ship row: "Not on the sea: build ships in Tartessos." (up to three of the player's ports), or "None of your cities is on the sea: found one on the coast to build ships." The advisor's existing "Build a ship" next step stays | Inland city: no ship row, no Ships filter | Shot `plans/ui/naval9/1-inland-ships-*`: Ships chip, Trireme row with the port named, en and he. Test cityBuildModel.test.js (inland: exactly one locked row in Ships, names the port when the owner has one) |
| 2 | A Frigate was bought (273) and never sailed; no player saw naval combat | Nothing pointed at a ship once built: the next-step chip went from "Build a ship" straight to other steps | New next step **sail** (nextStepModel.js): a ship in its own port while none of the player's ships is at sea, sailing or carrying troops: "Sail your Warship from Tartessos" (hint: board an army in port first, or sail out to scout and meet enemy ships). The tap opens the sail order for that ship (`startMarch(..., { naval: true })`, as the army sheet's Sail does). It goes away once a ship sails or carries troops. A sea target to fight: see "For the lead" | No chip after the ship was built | Shots `2-sail-step-*` (chip) and `3-sail-order-*` (the tap opens "The fleet at Tartessos: tap a port or a sea tile to sail to."). Test nextStepModel.test.js |
| 3a | Unclear whether a marching army boards a ship by itself (warmonger 198 to 201) | From the Classical age a land army crosses water on its own (armies.js self-embark); the march bar said only "4 turns" | The march bar says so: "Crosses the sea on its own boats, no ship needed (sea tiles: 3)." for any land march whose route has water tiles (march to a place and march to attack) | "To X: 4 turns" with no word about the sea | Shot `4-self-embark-*`. Test marchBar.test.js (`seaSteps` 2 for a route with two water tiles, 0 for a dry route and for a fleet) |
| 3b | Open ocean locked with little explanation (warmonger 118) | The reasons named only the age ("The open ocean needs the Age of Gunpowder.") | The three sea reasons say what ships do now and what to tap: "The open ocean is too rough for ships before the Age of Gunpowder: they keep to coastal waters. Pick a sea tile nearer land."; coast waters name Early Astronomy too; the no-route reason says the route is along the coast. en, he, and the i18n key list (scripts/i18n-keys/left.mjs) | One-line age rule | Text in left.en.js / left.he.js; i18n tests pass |
| 4 | Do sea battles happen to the player in a 150-turn game? | Measured (the brief's `pendingDefenses` kind 'sea' is the queue kinds 'naval', 'intercept' and 'landing'); every battle goes through `applyBattleOutcome`, which navalTrace.sim.js counts | navalTrace.sim.js now prints `playerSeaBattles` | Not measured | Table below: **3 sea battles to the player in 8 games, all landings; 0 fleet battles anywhere**. Design call above |

### Finding 4 numbers

`TURNS=150 SEEDS=11,12 PLAYERS=ahhiyawa,tartessos [NAVAL=1] npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/navalTrace.sim.js` (NAVAL=1: a player who builds a ship, boards, sails and lands, as the UI would).

| player, seed | passive player: sea battles (first turn) | naval player: sea battles (first turn) | all sea battles in the world (kind) |
|---|---|---|---|
| Ahhiyawa 11 | 1 (127) | 1 (143) | landing 1 / landing 2 |
| Ahhiyawa 12 | 0 | 1 (129) | landing 2 / landing 1 |
| Tartessos 11 | 0 | 0 | landing 3 / landing 2 |
| Tartessos 12 | 0 | 0 | landing 2 / landing 1 |

AI coastal majors own a ship in 6 to 10 of 12 by turn ~105 but only 0 to 2 of 12 ever have one at sea (they sail only at war).

## Checks

- Tests: `npx vitest run` on nextStepModel.test.js, cityBuildModel.test.js, marchBar.test.js (14 + the build model file, all pass) and src/i18n i18n, messages, hardcodedText, copyPass (96 pass). Each new assertion fails without its change (new step id, new group, new field).
- Lint: eslint `--max-warnings 0` on every changed file, clean.
- mobile-check: `node scripts/ui/naval9-shots.mjs --he` (new, dev server on 5363): 28 of 28 checks at 844x390 and 1600x900, en and he, no page errors. Shots in plans/ui/naval9/. Looked at: phone en and he build list, desktop sail order, phone he march bar; nothing cut off, Hebrew reads right to left.
- No engine rule changed (UI models, text, the sim harness), so no balance or battle-lab run beyond finding 4's trace.

## Not done

- A sea enemy for the first ship (pirates or hunting AI fleets): waits for the lead.
- The sail step shows while every ship stays in port; a player who keeps ships home on purpose sees it until one sails. Same as the "take" step's standing advice.
