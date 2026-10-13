# Playtest audit plan: addendum of 13 October 2026

Adds to [the implementation plan](playtest-audits-implementation-plan.md) and
[the conflicts and schedule](playtest-audits-conflicts.md). Source: five read-only research passes on
`0c08cf85` (battle result bridge, phone UI, economy and AI with a 250-turn probe on seeds 11 and 12,
battle controls, prior decisions) plus two new user rules. Item IDs here are `X01` to `X24`; each
names the work package and code batch it joins. Nothing here is implemented yet.

## 1. New user rules (decisions)

| ID | Rule | Joins | Notes |
|---|---|---|---|
| X01 | **Decision 40: a won city battle takes the city, and a capture card always follows.** Any city battle the attacker wins (Command or Auto), and any siege surrender, changes ownership at once and shows Conquer / Raze / Make tributary / Free (D6, Q10). Field battles never show it. | W12, CB11 (after CB02) | "Win" is the Q3/Q4 definition (the defender's base buildings are gone, or the clock rule), not "all defenders routed". Replaces today's control rule where a won assault often only drops control by 30 (`invasionAdapter` + `resolveSiegeControlDamage`, siege.js 54-61). Hook both capture points: `placed.captured` in `applyBattleOutcome` and the siege fall in resolveTurn.js 295-312. Use the soft turn-blocker pattern (`joinOffers`, turnBlockers.js 59), not a hard resolveTurn block, and test "attacker is the viewer" (AI invasions run on a state copy where `playerNationId` is the AI). Raze reuses `RAZE_CITY` / razing.js; Free reuses `breakAwayAsIndependent` (not available in legacy worlds: show the option disabled with a reason). |
| X02 | **Decision 41: clashes outside both sides' borders are Auto only.** When two armies fight on a tile owned by neither side (unowned land, or a third party's land), there is no Command offer. On either side's own land Command is still offered. Overrides decision 24 and UI-DESIGN rule 5 for this case only. | W06, CB18 (pre-battle), CB02 | Owner of a tile: `state.regions[state.world.tileOwner[tile]]?.owner` (add one helper, e.g. in hostility.js). Apply in PreBattleModal (copy the `blockedAtSea` Auto-only pattern), BEGIN_TACTICAL_BATTLE, DefenseSheet and BEGIN_DEFENSE_BATTLE for kinds field, fort and raid. Say why on the card ("No man's land: this battle is fought on Auto"). **Assumption until the user rules:** sea battles are not covered (sea tiles are never owned, so a literal reading would make every naval battle Auto); city battles are never covered. |

## 2. Battle trust: additions to W01 / W02 (CB01, CB02)

| ID | Finding | Fix direction |
|---|---|---|
| X03 | The replay in `RESOLVE_TACTICAL_BATTLE` (gameReducer.js 1605-1611) builds `buildInvasionSetup(state, pb)` **without `commandedSetup`**, while the live screen applies it (TacticalBattleScreen.jsx 726). In the replay the player's squads can rout; live they cannot. Together with the dropped orders (plan 2.1) this is why Kerma replayed as a defeat. | The verified setup must be built by one function used by both the live screen and the reducer, including `commandedSetup`. Add a test: live result equals replay result for a battle with deploy, build, train and a squad that would rout without the rule. |
| X04 | `sanitizeTacticalResult` `clampUnits` (gameReducer.js 579-587) gives a unit missing from the result its full strength back; reinforcements not in `joinedReinforcements` are untouched. This is the ghost cavalry (355 in battle, 1,000 on the map). | A unit that took the field and is missing from the result is an error, not "unharmed". Conserve casualties: sum(before) = sum(after) + fallen + fled per side, asserted in the adapter. |
| X05 | Loss numbers use two scales: the battle report multiplies by `MEN_PER_STRENGTH` (10), the result screen shows raw strength and calls it men (5,647 vs 48,760). | One formatter for men everywhere (result screen, report, log). |
| X06 | Existing tests cannot catch X03: replay.test.js and tacticalBattle.test.js 101-112 replay without the no-rout rule and without deploy or economy orders. | Extend both with an economy, commanded fixture (W00 fixtures). |
| X07 | Per-selection Retreat ends the battle because `isBroken` (step.js 44) counts retreating squads as gone at once; in field battles survivors get `disposition: 'field'` and are destroyed. | D4 as planned, plus: retreating squads count as present until they exit; exited squads survive in the outcome. |

## 3. Battle placement and controls: additions to W05 (CB15, CB19)

| ID | Finding | Fix direction |
|---|---|---|
| X08 | The renderer draws a 40-tile land skirt past the map edge (terrainSurface.js 20) that looks like playable field; the attacker camp sits ~2 tiles from the west edge (economySetup.js 64-69) with a 20-tile build radius, so about 40% of its build circle always fails "Too close to the edge". | Move the camp inward (or shrink the margin for the camp side), and draw the real field edge. Tint legal ground while placing. |
| X09 | Placement needs "visible now" (economy.js 232) but buildings see only 4 tiles (fog.js 60), so most of the camp area reads "You cannot see this ground". | Allow building on explored ground inside the camp radius, or widen building sight. Change `sim/economy.js placementBlock` and `input/placement.js placementCheck` together; update placement.test.js. |
| X10 | A resource blocks its whole footprint plus half a tile, and nodes are hard to see. | Show node footprints while placing; shrink the padding. |
| X11 | After placing, the build menu reopens because the laborers stay selected; in the laborers-only view the menu has no close button and "Stop" sends a stop order; a tap near the ghost (spawned at screen centre) builds at once. | U13 / U05 as planned; these are the concrete causes. |
| X12 | "All" re-centres the camera (`selectClass`, TacticalBattleScreen.jsx 591), so the next tap lands elsewhere. | Split: select without moving; a separate "find army". |
| X13 | An attack order zeroes group pace (cavalry 10-15 tiles ahead at tick 201). | Per Q6 each unit keeps its own speed: no code change to pace; instead warn on the order ("cavalry will arrive first") or offer attack-move at the staging point. Close I192 against Q6. |
| X14 | Build icons are `loading="lazy"` with no preload (blank on first open). Battle supply is hidden in economy battles though powers cost supply. The pre-battle text promises an automatic second wave that only arrives when called. | Preload the atlas with the battle; U12 shows supply; U10 removes the wave text. |
| X15 | No Playwright test covers battles. `squadTrace` lacks `ORDER=attackStructure` and `ECO=1`, needed to reproduce "idle after the target falls". | Add both options in W00; add one battle e2e at 844x340. |

## 4. Phone UI: additions to W04 (CB13)

| ID | Finding | Fix direction |
|---|---|---|
| X16 | No active-sheet coordinator: about 25 overlays decide on their own; three keep different "busy" lists (IndependentsHost.jsx 24, MarchAttackPrompt.jsx 23, DefenseSheet.jsx 35). | Generalise `useExclusivePanel.js` into one priority registry; reuse the "tuck into a button" pattern of DefenseSheet and PeaceOfferSheet for the chip queue. |
| X17 | The 170 px squeeze is arithmetic: seven cards use `100vw - 1rem - var(--rail-inset)`; with Peoples or Research open `--rail-inset` is 652, leaving 176 px. End Turn moves with the same variable (TurnDock.jsx 72). | Decision cards never share the row with a dock (the coordinator tucks the dock); End Turn anchored independent of `--rail-inset`. |
| X18 | The pre-battle card's full-screen backdrop (z-70) closes it on any tap, including one aimed at a dimmed control beneath; from MarchAttackPrompt, closing dispatches `CANCEL_ROUTE`, losing the attack. | Backdrop taps do not close decision cards; closing never cancels the march without an explicit choice. |
| X19 | Era banner: its 5 s timer is cleared whenever the turn changes (App.jsx 117-130), so it stays until dismissed; `NationEliminatedBanner` (App.jsx 137-146) has a worse form. | Timer independent of turn changes; both banners. |
| X20 | Settler tints draw only with the Political lens (GLMapView.jsx 101) and are tied to the selected tile; lens state is a plain `useState` (MapContainer.jsx 85). The Cities list only sets `selectedRegion` (App.jsx 174) with no camera move. | Settling is a mode that forces its lens and survives sheet close; copy `selectRegion` + `focusPlace` from TurnReportSheet.jsx 83. |

## 5. Economy, tribute, AI: additions to W07, W10, W11

| ID | Finding | Fix direction |
|---|---|---|
| X21 | A major's demand (resolveTurn.js 962) and the war roll (1016) run in the same turn; `answerDemand` (aiAccords.js 125) never checks for war, so the player pays while already at war. Paying lowers hostility by 5 only: no truce, no opinion reason. The amount is 20% of the target's treasury (accords.js 44), every 10 turns per demander; relative power gates it (ratio 2+), opinion does not. Reproduced on seed 12. | No war roll against a people with an open demand; paying grants a truce and an opinion reason; demands gated by opinion too; amount from relative power and a cap, not the target's bank. |
| X22 | War exhaustion rises a flat 5 a turn (resolveTurn.js 114), so both sides reach the white-peace threshold of 80 (diplomacy.js 384) after 16 turns, shorter than a march plus a wall grind. A stack with odds under 0.45 just waits (aiOperations.js 243); `routeStep` (36-47) can shuttle stacks between fronts; independents never sally (the check sits behind `if (!wars.length) continue`, aiOperations.js 170) and a non-player city at 0 HP falls at once (resolveTurn.js 295-312). | Exhaustion from battles, losses and occupied land; AI lays siege from its own land when it cannot assault; sally for independents; trace one stack per turn in a war before changing the planner (W00 telemetry). |
| X23 | The soft city limit already exists as overextension (capacity 11, nationalPower.js 36-62) but AI cities skip it in the unrest phase (resolveTurn.js 376-381): top AIs sat 127-145% overextended with authority 48-56. | D9 builds on this lever and applies it to the AI. |
| X24 | Production is also gold income (helpers.js 204-262; yield copied to `dev.production`, resolveTurn.js 190), so a production floor raises gold and a rush price under ~1 gold per hammer is a money loop (civ-map-rework C1 specified 2 gold per hammer). Power points bank 1,400+ from base income; new uses must cost tens to hundreds and recur. The AI's instant gold buy (aiEconomy.js 170-200) builds the same building twice; share the player's rush helper. `describeTierEffects` (buildings.js 217) is unused and wrong against what cities.js applies: do not surface it as effect text. Conquests have two ways back (loyalty to 0 within 10 turns unless garrisoned, and the unrest rebellion after 6 turns): a loyalty floor alone will not hold a city. `worldStats` has no player-gold, demand, siege, capture or kept-conquest metrics and `simulate.mjs` runs the legacy world: measure with `SCENARIO=peoples PLAYER=au .claude/skills/balance-sim/compare.sh <base> 150 11-18`. | Inputs to W07 task rush, W08 effect text, W12 occupation and W00 telemetry. |

## 6. Effect on the schedule

- X03 to X06 go into lane L1 (CB01, then CB02). X07, X13 and X02 go into the wave 3 battle-rules chain.
- X16 to X20 go into lane L4 (CB13). X20's settle mode is shared with CB06.
- X08 to X12, X14 go into CB15 / CB19 (wave 3). X15 goes into W00.
- X21 goes into CB08 (wave 2); X22, X23 into CB09 (wave 4); X24 into CB04 rules (wave 2) and W00.
- X01 goes into CB11 (wave 4), after CB02 and CB13.
- Open with the user: are sea battles covered by X02; and (from Q8) remove the old SVG map setting too.

## 7. City-states and the peoples pool (decision 42, proposed)

X25. Discussed with the user on 13 October; recorded as proposed until the user confirms the
counts and the list of majors. Joins CB08 (diplomacy), wave 2.

Measured on the map data: 150 peoples; South and East Asia 45, Europe 32, Near East and North
Africa 27, Americas 19, Sub-Saharan Africa 17, Central Asia 8, Oceania 2. The median distance from
a capital to its nearest neighbour is 458 km; 100 of 150 have a neighbour within 612 km and 128
within 900 km. The land holds at most about 1,840 city sites at the 306 km spacing, so the world is
not full, but Europe and the Near East are. A Standard world today starts 36 majors and 84
one-city independents (2.3 per major; Civ VI uses 1.5).

1. **Two tiers of peoples.** About 50 full majors (pickable, and met as majors); the other ~100
   are the names city-states are drawn from. A flag per people in `src/data/peoples.js`; nothing is
   deleted. All 150 signature units already exist and stay.
2. **Fewer city-states.** Standard about 36 to 54 (1 to 1.5 per major), Small about 30, Large
   about 60 (`src/data/worldSizes.js`).
3. **Spaced by density, not a flat cut.** A minimum gap of about 900 km between any two starting
   cities (today 612 km, majors only: `MAJOR_MIN_GAP_KM`), applied in
   `src/engine/worldgen/peoplesWorld.js`.
4. **Raiders capped at about a third.** The rest are Civ-style types (trade, military, science,
   culture) with a bonus for the major they favour (`src/engine/independents.js`,
   `src/data/independents.js`).
5. **A start-screen setting:** City-states Few / Normal / Many.

Open: which 50 are majors (a list from the user, or a proposal by region: every region keeps 4 to
6 choices). Art consequence: UI18 in [the art update](playtest-audits-art-update-2026-10-13.md),
on hold until confirmed.

## 8. Title screen on launch (X26, user request of 13 October)

Today the game reopens the last game with no choice, even days later; the only way out is Menu,
New game, and a native browser confirm (test log row 12), and there is one autosave and no slots
(I165). Resuming is the right default, but the player must be able to choose.

X26 joins I165 (W15, CB13 for the screen). On launch, when a saved game exists, show a title
screen:
1. **Continue**: the people, turn, year and date of the last save, so the player knows what is
   resumed. One tap.
2. **New game**: goes to the start steps. The current game is kept as a save, never overwritten
   silently. Replaces the native confirm with an in-game one.
3. **Load**: a few local save slots (the autosave plus manual saves), each with people, turn, year
   and date; delete with a confirm.
With no saved game, launch goes straight to the start steps as today. The stale-version reload
guard and the v-number save migrations still apply to every slot; a slot that cannot be migrated is
shown as "from an older version" and is not deleted. Phone landscape first (844x340). Art: none
beyond the existing start-screen style.
