# Lane naval-9: report

ponytail loaded at session start (Skill `ponytail:ponytail`, full text printed; the session start hook also printed "PONYTAIL MODE ACTIVE").

Target: Naval (2, 6 and 6 in round 3b) at 8 or more. Base: claude/integration 039d3c18. The round 3b runs played a0312e08, which already had lane naval-8 (AI fleets, ship rows with cargo and pace), so every finding below still stood on the current build.

## For the lead

The lead chose pirate fleets (option 1) and added the shore-landing finding (manual playtest 29 Oct). Both are built (sections 5 and 6 below). engine-rules-reviewer ran on the engine diff: five real findings, all fixed (listed in section 5). Nothing waits on the lead.

Open small points the lead may want to tune: PIRATE_REF_TURNS 16 (a pirate off each major about every 25 turns at Normal, 3 or 4 per 150-turn game), PIRATE_STAY_REF_TURNS 5, PIRATE_STRENGTH 400. A beaten pirate falls back a tile (navalBattle.js) and is often attacked again, so a player who hunts them fights 7 to 22 sea battles a game. If that reads as too many, lower the chance or remove a pirate once it is beaten.

## Findings

| # | Finding (playtest step) | Root cause | Fix | Before | After |
|---|---|---|---|---|---|
| 1 | No city could build ships until step 145 (civ-veteran 82 to 139); no ship row, no hint why (newcomer 70 to 76) | cityBuildModel.js listed ship rows only in sea-coast cities (I039 removed them inland so they did not look available), so an inland city said nothing at all. The veteran's three cities were inland; the port was Jerusalem | A **Ships** filter (its own group, so a chip in the build list's filter row). An inland city shows one greyed, locked ship row: "Not on the sea: build ships in Tartessos." (up to three of the player's ports), or "None of your cities is on the sea: found one on the coast to build ships." The advisor's existing "Build a ship" next step stays | Inland city: no ship row, no Ships filter | Shot `plans/ui/naval9/1-inland-ships-*`: Ships chip, Trireme row with the port named, en and he. Test cityBuildModel.test.js (inland: exactly one locked row in Ships, names the port when the owner has one) |
| 2 | A Frigate was bought (273) and never sailed; no player saw naval combat | Nothing pointed at a ship once built: the next-step chip went from "Build a ship" straight to other steps | New next step **sail** (nextStepModel.js): a ship in its own port while none of the player's ships is at sea, sailing or carrying troops: "Sail your Warship from Tartessos" (hint: board an army in port first, or sail out to scout and meet enemy ships). The tap opens the sail order for that ship (`startMarch(..., { naval: true })`, as the army sheet's Sail does). It goes away once a ship sails or carries troops. A sea target to fight: see "For the lead" | No chip after the ship was built | Shots `2-sail-step-*` (chip) and `3-sail-order-*` (the tap opens "The fleet at Tartessos: tap a port or a sea tile to sail to."). Test nextStepModel.test.js |
| 3a | Unclear whether a marching army boards a ship by itself (warmonger 198 to 201) | From the Classical age a land army crosses water on its own (armies.js self-embark); the march bar said only "4 turns" | The march bar says so: "Crosses the sea on its own boats, no ship needed (sea tiles: 3)." for any land march whose route has water tiles (march to a place and march to attack) | "To X: 4 turns" with no word about the sea | Shot `4-self-embark-*`. Test marchBar.test.js (`seaSteps` 2 for a route with two water tiles, 0 for a dry route and for a fleet) |
| 3b | Open ocean locked with little explanation (warmonger 118) | The reasons named only the age ("The open ocean needs the Age of Gunpowder.") | The three sea reasons say what ships do now and what to tap: "The open ocean is too rough for ships before the Age of Gunpowder: they keep to coastal waters. Pick a sea tile nearer land."; coast waters name Early Astronomy too; the no-route reason says the route is along the coast. en, he, and the i18n key list (scripts/i18n-keys/left.mjs) | One-line age rule | Text in left.en.js / left.he.js; i18n tests pass |
| 4 | Do sea battles happen to the player in a 150-turn game? | Measured (the brief's `pendingDefenses` kind 'sea' is the queue kinds 'naval', 'intercept' and 'landing'); every battle goes through `applyBattleOutcome`, which navalTrace.sim.js counts | navalTrace.sim.js now prints `playerSeaBattles` | Not measured | Table below: **3 sea battles to the player in 8 games, all landings; 0 fleet battles anywhere**. Built: section 5 |

### Finding 4 numbers

`TURNS=150 SEEDS=11,12 PLAYERS=ahhiyawa,tartessos [NAVAL=1] npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/navalTrace.sim.js` (NAVAL=1: a player who builds a ship, boards, sails and lands, as the UI would).

| player, seed | passive player: sea battles (first turn) | naval player: sea battles (first turn) | all sea battles in the world (kind) |
|---|---|---|---|
| Ahhiyawa 11 | 1 (127) | 1 (143) | landing 1 / landing 2 |
| Ahhiyawa 12 | 0 | 1 (129) | landing 2 / landing 1 |
| Tartessos 11 | 0 | 0 | landing 3 / landing 2 |
| Tartessos 12 | 0 | 0 | landing 2 / landing 1 |

AI coastal majors own a ship in 6 to 10 of 12 by turn ~105 but only 0 to 2 of 12 ever have one at sea (they sail only at war).

| 5 | Pirates (lead's pick for finding 4): the first warship needs a target | No fleet battle ever happened (finding 4) | New `src/engine/pirates.js`, one phase in resolveTurn after the AI operations. From the Bronze age, once a major's wait is over (PIRATE_REF_TURNS 16 reference turns via `speedTurns`), each turn rolls PIRATE_CHANCE 0.15 (seeded hash). The nearest coastal independent within 2,500 km that is not under a truce with it (sea raiders first) puts ONE raider ship (400 men) on water beside one of its sea-coast cities, on water that major's ships can sail. It never moves, sails off after PIRATE_STAY_REF_TURNS 5 (about 8 turns at Normal), and goes with its people. Never in Explore mode. It cuts the player's sea trade through that port with no war (plunder.js, then the tradeDisruptions.js event with its end). AI majors get pirates too: their ships at peace attack a pirate beside them (`aiFleetAttack(f, true)`). The player sinks it with ATTACK_FLEET and no war (navalBattle.js, applyBattleOutcome). New next step "Sink the pirates off X": it opens the ship's sheet (Attack) when a ship is beside them, else that ship's sail order. Log lines when they come ("Pirates (...) lurk off Tartessos: ... sails off in 8 turns") and go, en and he | 0 fleet battles in 8 games | Naval player 7 to 22 sea battles a game in all 4 games, the first at turns 61 to 96. Fleet battles in the world 1 to 25 a game. Table below |
| 6 | Manual playtest 29 Oct: the fleet card says "Tap a shore to land the troops aboard", but sailing to a shore said "A fleet can only put in at a city" | The engine already lands troops from a fleet at sea on a free, own or allied shore tile next to it (DISEMBARK_UNIT; the TileSheet's Land here). In the sail order, a tapped shore was read as a port | routes.js `shorePlan`: in the sail order a shore tile is planned to the water beside it ("Sails beside Cádiz: 2 turns. Then tap the shore to land the troops aboard."). With the fleet already beside it, the bar says "The fleet is beside Cádiz: land the troops aboard here." and has a **Land here** button. With no troops aboard, or on enemy or closed land, it says why. The card text now matches | "A fleet can only put in at a city" | Shot `6-land-shore-*`: the troops land on the shore (browser check). fleets.test.js: plan from port, Land here beside it, none aboard, a sea tile is no shore |

### Pirates: numbers (navalTrace, 150 turns)

| player, seed | passive player: pirates off the player / player sea battles | naval player: pirates / player sea battles (first turn) | fleet battles in the world, naval player's game |
|---|---|---|---|
| Ahhiyawa 11 | 3 / 1 | 3 / 19 (66) | 25 |
| Ahhiyawa 12 | 3 / 0 | 4 / 22 (61) | 23 |
| Tartessos 11 | 4 / 0 | 4 / 12 (83) | 18 |
| Tartessos 12 | 3 / 0 | 3 / 7 (96) | 20 |

The naval player does what the advisor step says: a ship beside the pirates attacks; otherwise one sails beside them. A passive player lets them sail off and loses a few turns of sea trade.

Passive-player balance (worldStats, PLAYER=tartessos, seeds 11 to 14, 150 turns, base 50a0c0c4 against head): defeats 1 of 4 on both sides (seed 13, turn 124 on both); nonFinite 0 and auditViolations 0 on both. warsTotal 10 against 13 and sacks 57 against 54 over the 4 seeds. With 4 seeds these differences are not significant. msPerTurn was measured on a shared machine (head 108 to 125, base 156 to 261) and cannot be compared.

engine-rules-reviewer on the engine diff found five issues, all fixed. (1) A pirate kept its home city's `regionId`, so a landing on that city fought the faraway pirate and was forced onto Auto. invasion.js and gameReducer.js now skip pirates. (2) Pirates ignored a truce or tribute. pirates.js now picks only independents the major can fight (canFight), and plunder.js uses the same test. (3) Sinking pirates gave a grudge against you. battleOutcome.js now skips it when every defender was a pirate. (4) The rolls were not keyed by the game's seed. They now include `rngSeed`. (5) Land here could offer an impassable shore. shorePlan now checks `passableTile`. Two minor ones were also fixed: a pirate no longer refits at sea (unitLocation.js), and a pirate whose home is razed goes with it (razing.js). A trace bug was found and fixed too: a pirate on open-sea water that Classical ships cannot enter could never be reached, so pirates now pick water the major can sail.

## Checks

- Tests: pirates.test.js (5: who comes, where, the log, the trade cut without a war, the wait, the sailing off, Explore mode, before Bronze, a truce, sinking with no war and no grudge, an AI ship attacking at peace, the pirate staying put), fleets.test.js (shore plan), nextStepModel.test.js, cityBuildModel.test.js, marchBar.test.js, plunder, tradeDisruptions, navalBattle, aiLanding, aiOperations, sallyLanding, stateAudit, i18n (i18n, messages, hardcodedText, copyPass): all pass.
- Lint: eslint `--max-warnings 0` on every changed file, clean.
- mobile-check: `node scripts/ui/naval9-shots.mjs --he` (dev server on 5363): 44 of 44 checks at 844x390 and 1600x900, en and he, no page errors. Shots in plans/ui/naval9/ (1 inland Ships row, 2 sail step, 3 sail order, 4 self-embark, 5 pirates step, 6 Land here on a shore).
- Not run: the full suite (six lanes share the PC); battle-lab (no sim change).

## Not done

- The sail step shows while every ship stays in port; a player who keeps ships home on purpose sees it until one sails. Same as the "take" step's standing advice.
- The "Sink the pirates" step opens the ship's sheet on its tile; on a city tile with an army too, the sheet opens on the army first and the player taps the switch to the fleet.
