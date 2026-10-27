# Terra Imperium

A grand-strategy game on a real Earth globe, 2000 BCE to 2300 CE, any of 150 peoples, with
real-time tactical battles. React 18 + Vite, three.js, Vitest, Playwright, Capacitor for mobile.
The live site is Cloudflare Pages (https://terra-imperium.pages.dev), built and deployed by .github/workflows/deploy-cloudflare.yml on every push to main. docs/ only holds a redirect from the old GitHub Pages address.

## Working rules (from the user)
- Big features on a side branch. Merge to `main` only when the user asks; the push deploys the site.
- Mobile-friendly always: phones play in landscape (844x390 is the reference screen).
- Automate rather than hand the user manual work.
- Every session, lane and subagent loads the ponytail skill (`ponytail:ponytail`) first and follows it, to save tokens; every lane brief says so in its first line.
- Plain English in messages to the user, no em dashes.

## Project skills (in .claude/skills/, use them without being asked)
- `add-mechanic`: before adding or changing any macro game rule, formula or per-turn system.
- `balance-sim`: whole-world headless runs and before/after comparisons for balance changes.
- `battle-lab`: tactical battle bugs and changes (headless squad traces, parity, browser screenshot).
- `ship`: commits, merging, rebuilding docs, the final summary.
- `perf`: turn time, map frame time and soaks, always against the base commit.
- `mobile-check`: real-browser shots at 844x390 and 1600x900, en and he, after UI changes.
- Agent `engine-rules-reviewer`: read-only check of an engine diff against the rules below, before merging.
- Hooks: lint runs on every edited .js/.jsx file; hand edits to generated map and layout files are blocked.

## Architecture
- `src/engine/` is the deterministic macro engine. `resolveTurn(state)` (resolveTurn.js) runs one
  turn in fixed phases; `gameReducer` (gameReducer.js) handles player actions. Both are pure and
  seeded from `state.rngSeed`. Never `Math.random()` or `Date.now()` in game logic.
  Systems live in their own modules: economy.js, population.js, development.js, diplomacy.js
  (wars, war progress, `declareWar`), peace.js, invasion.js / defense.js (battle results),
  aftermath.js (war costs), vassals.js, pacts.js, techDiffusion.js, supplies.js, expansion.js (AE),
  aiEconomy.js, research.js (Civ-style science: a current tech, a queue, overflow; player and AI),
  battleReports.js (the player's last 30 battles), raidBattle.js (raids and sacks as battles),
  aiLanding.js (AI landings on the player's coast, queued), forts.js (manned forts start battles), stateAudit.js (invariant checks), plus src/utils/aiLogic.js (AI recruitment and
  war decisions). Balance harness: scripts/simulate.mjs.
- Modifiers: src/engine/modifiers/ (`getModifier` = full sheet; `getNationBonusTotal` = static only).
- Ages: `src/data/ages.js` is the one age registry (`AGE_ORDER`, `FIRST_AGE_ID`, `LAST_AGE_ID`, `isAgeAtLeast`, `isAgeBefore`, `agesFrom`, `nextAgeId`, `formatYear`, `artAgeFor`, per-age `power` and `unitCostMult`); never write a literal age check. Ages by tech (plans/2026-10-20-001-feat-eight-ages-plan.md, phase A): a nation's age is its research age only, read through `ageOf(state, id)` (src/engine/nationState.js); there is no world age and no `state.age` (an independent reads its strongest known major's age, `sideAgeOf` / `independentAgeOf`, and waits run at `waitAgeOf`: src/engine/ageRefs.js); no rule reads `state.year` (a label from src/engine/displayYear.js; ruleYearPurity.test.js); speed is `speedCostMult(speed, payer's age)` and the game ends on `endingSignal` (src/engine/ending.js: the speed's turn limit or the Future's goal). Fast and Marathon follow Normal's turns per age scaled by the turn limit (U96; an age lasts about the square of its multiplier; check with balance-sim worldStats `halfIn_<age>` and `leaderIn_<age>`). Town file budget (KTD16): `node scripts/art/town-size-check.mjs`.
- `src/data/`: static game data (peoples, nations, techTree, buildings, resources).
- New map (plans/civ-map-rework.md, in progress on the features branch): `src/data/geo/tiles.json`
  is a frequency-100 geodesic hex grid (100,002 cells, 29,250 land, about 77 km between neighbours; plans/math/grid-f100.md) built by `npm run build:tiles`
  from Natural Earth, Köppen climate and terrain tiles (`npm run fetch:tiles` first, raw data is
  gitignored). `src/data/geo/geodesic.js` is the grid math, `tiles.js` the loader, `tileGeometry.js`
  turns ownership into GeoJSON territories, borders and the hex mesh, `src/data/scenarios.js` the
  starts (Dawn: one city per nation). Terrain data (phase F): `scripts/geo/build-tile-terrain.mjs`
  (in the build:tiles chain, or `npm run build:terrain`) adds river sizes per hex edge, mountain
  ranges, ridges and passes to tiles.json; read them through `src/data/geo/terrainData.js`
  (renderer integration notes: plans/phase-f-terrain-data.md). `npm run build:raster-detail`
  (after `node scripts/geo/fetch-tiles-raw.mjs --detail`) adds land-only level 6 tiles and land
  cover tiles (`src/data/geo/rasterDetail.js`); per-tile footprints in local km (town, fields,
  road and river bands): `src/data/geo/footprints.js`. The coast follows the hexes (every hex all land or all water, corners softened): `src/data/geo/hexCoast.js`, built into `hexLand.json` by `node scripts/geo/build-hex-coast.mjs` (run after build:tiles, before build:raster and build:pyramid); the flat map, globe and close view clip and mask with it. `npm run build:raster` renders the realistic Earth
  (`public/map/world-*.webp`), the globe texture and flat map background. `/?tileViewer` is the
  prototype of the new map. The look is decided: real Earth, hexes only as a faint overlay.
  The engine now runs on it: `state.regions` holds one city record per city (`src/engine/world/
  cities.js`), `state.world.tileOwner` the borders; `src/engine/world/registry.js` rebuilds the
  old static readers (`REGIONS_DATA`, `getNeighborIds`, `getNationCapital`) from the last synced
  state. Tests that need more cities use `src/engine/testWorld.js` (`addCity`, `addCities`,
  `borderPair`); tests that build their own `regions` map must pass real city ids (`cap('fr')`).
  Save version 10 is a clean break (7 was the frequency-53 grid, 8 and 9 frequency 75). Distances are
  rules in km, never rings: write `ringsForKm(km)` (src/data/geo/gridScale.js; tech reach bonuses in
  src/data/techMapEffects.js are km too), movement is km a turn (armies.js MOVE_KM), a new city claims
  `foundingDisk` (the same land on any grid) and culture tile costs are per area. The one settling rule (306 km, one ring less across water) for founding, starts and the audit: `src/data/geo/citySpacing.js`. Settlers and outposts: `src/engine/settlers.js`; what AI cities
  build: `src/engine/aiProduction.js`. Armies on tiles (unit.tile, move points, tile costs, A*
  routes, zone of control, `normalizeUnitTiles`): `src/engine/armies.js`; marches: routes.js (Attack on a city the army does not border is a march to attack: marchAttack.js);
  the supply meter: supplyMeter.js; tile sight (fog): sight.js; fleets on sea tiles: fleets.js; sieges (walls, HP,
  encirclement, falls): sieges.js. Battlefields come from the tile and its six
  neighbours: src/battle/setup/tileContext.js feeds mapgen.js. Field battles between stacks on
  tiles: src/engine/fieldBattle.js (ATTACK_ARMY, kind 'field'). The campaign bridge (phase R2):
  every battle ends in ONE call, `applyBattleOutcome` (src/engine/battleOutcome.js, idempotent by
  operation id, every row of master plan 6.7; invasion/defense/field/naval apply functions are thin
  wrappers); battleInputs.js is what Command and Auto both read (supply, starvation, plague, walls'
  HP, the city's militia, allied reinforcements); autoBattle.js is the honest auto-resolve
  (auxiliaries from the battle economy, the walls' gate, calibrated with battle-lab parityEco);
  battleQueue.js holds battles others start against the player (pendingDefenses: city, field and
  sea), Command or Auto each, waiting for events and peace offers. The participant ledger
  (battleLedger.js: per side before = after + fallen + fled, checked against the committed map;
  `menOf` / `menText` are the one strength-to-men conversion) rides on every battle report entry;
  the result screen shows the campaign's receipt (battleReceipt.js: the reducer Continue runs,
  on the same state and action), never its own reading. Opinion with reasons (AI war
  roll, casus belli): src/engine/opinion.js over src/data/opinion.js. Majors' demands (when one may
  be made: `demandBlock`; the card and the answer: `demandTerms`; a met demand buys a truce):
  src/engine/aiAccords.js over accords.js; every tribute price: tributePricing.js; a cut trade route
  is an event with an end: tradeDisruptions.js (`tradeRouteStatus` for every surface). Waits there
  are reference turns through `speedTurns` (src/data/ages.js), never a fixed number of turns.
  Loyalty and culture per
  city (flips, free cities): src/engine/loyalty.js. AI fronts (attacks from touching tiles,
  tile marches, sieges and assaults): src/engine/aiOperations.js. Research boosts from map facts:
  src/engine/boosts.js over src/data/boosts.js. Era goals and legacies: src/engine/eraGoals.js.
  Independent cities (phase W1, one-city `kind: 'independent'` nations of a peoples world): src/engine/independents.js
  over src/data/independents.js; who may fight whom (`canFight`, `canAttack`: no war needed against an
  independent): src/engine/hostility.js. Use it instead of a bare war check in new combat code. Their AI (W2):
  raids, sacks and tribute in src/engine/raids.js (the raid battle R3 replaces: raidBattle.js `fightRaidBattle`),
  grudges.js, mercenaries.js. No captives: units lost are gone (master plan decision 37). Majors and
  independents (W3): src/engine/indepPolicy.js (AI campaigns, `nation.indepGoal`, siege force `unit.indepOp`
  marched by aiOperations.js; joining by attitude; trade; tribute to majors; the player's actions) and
  razing.js (one size a turn, `city.razing`).
  City manifest (phase B): src/data/townLayout.js (from src/data/townLayouts.json, `npm run
  build:town-layouts` after town art), src/engine/cityManifest.js (from the city record; damage in
  region.cityDamage, the 50% rule, free repairs), battle: src/battle/setup/cityBattle.js and
  src/battle/render/cityLayer.js, map: src/components/map/closeView/townDamage.js.
  Progress and open balance items: plan section J3.
  Phase F rendering (WebGL map): rivers are vector lines from Natural Earth (`npm run build:rivers`
  writes public/map/rivers.bin.gz; src/data/geo/riverLines.js, gl/riverModel.js and riverLayer.js;
  the raster has no painted rivers, river-paint.mjs PAINT_RIVERS = false); bridges, mountain chains
  and passes in src/components/map/gl/terrainModel.js (drawn in GLMapView's terrain pass, under the fog);
  level 6 raster and land cover streamed by glLayers.createRasterLayer; the close view's towns and
  field plots from footprints, 3D ridges and river bands in closeView/terrainPlacement.js and
  mountainModels.js (`createCloseScene(..., { footprintOf })` is the hook for phase B's manifest).
- Peoples (phase W0): new games use scenario mode `peoples`: majors drawn from the 150-people
  pool (src/data/peoples.js, built facts in src/data/geo/peopleCapitals.json via
  `npm run build:peoples`), world sizes in src/data/worldSizes.js, the pick in
  src/engine/worldgen/peoplesWorld.js. Nation ids are people slugs (`akkad`, `israel`);
  `createInitialState` builds only peoples worlds (the old 240-country world is retired; its saves are kept but refused with the old-version notice). Titles, regiment numbers: src/engine/peopleNames.js;
  battle names: src/engine/battleNames.js.
- Map data: the old balanced-regions pipeline (2,028 merged provinces) is retired; `src/data/regions.js` and `regionCoordinates.js` are views over the city registry. `subregions-*.json` stay as runtime map features.
- `src/battle/`: the tactical RTS. `sim/` is an integer fixed-point 20 Hz deterministic sim
  driven only by orders, run in a Web Worker (`worker/`); `render/` is the three.js battlefield;
  `setup/` builds a battle from macro armies. UI in src/components/battle/.
  A commanded battle is verified by replay (src/engine/battleVerify.js): the screen and the reducer build the same setup (`buildCommandedSetup`), and the live loop and the replay admit orders through one schema (sim/orderSchema.js: a new order needs its row there).
  Battle economy (phase R1, `setup.economy`, on for campaign battles, off by default in
  `buildSetupFromArmies` so tests/parity/bench hash as before): catalog src/battle/data/economy.js,
  nodes and camp src/battle/setup/economySetup.js, sim src/battle/sim/economy.js (workers, building,
  training, housing cap, `tactical.economy` in the result) and economyAI.js, drawing
  render/economyLayer.js, HUD EconomyHud.jsx. Workers are squads with `q.worker` (excluded from the
  end rules and the army AI). `node scripts/battle-bench.mjs --eco`; `.claude/skills/battle-lab/eco-shot.mjs`.
  Every tree is wood (W12): each 5-tile forest square is one wood node felled tree by tree (economySetup.js
  woodNodes, sim/economy.js fellTrees; stumps in render/treeFelling.js through fogMask.js), plus mirrored
  nodes scattered over the field (scatterPairs). Check with battle-lab nodeCount.sim.js and wood-shot.mjs.
- Differentiation plan (plans/2026-10-20-002-feat-differentiation-plan.md; live: U1 to U33, U35, U38 to U41, U43; U36 built, off until the Supabase deploy (`CHALLENGES_ON` false); U34 parked; U42 and U44 wait on the user):
  - Ruler: src/engine/rulers.js over src/data/rulers.js (one fixed ruler, attributes capped by the nation's research age), renown.js over rulerVirtues.js (renown, levels, five-branch Virtue tree), decrees.js over data/decrees.js (the ruler's bank of decrees replaces the old admin/diplomatic/military pools; every cost goes through src/utils/costs.js, data/actionCosts.js), ambitions.js over data/ambitions.js and ambitionsByPeople.js (age goals), UI in src/components/ruler/.
  - Score and story: legacy.js (the one legacy score, ranks every major at the ending signal) over data/victoryConditions.js; chronicle.js (state.chronicle, one chapter per age) read by src/components/chronicle/ (sheet and share image); glossary src/data/glossary/ and src/components/glossary/ (tap a name for its entry; `useHoldHelp.js` opens one by holding `data-help="kind:id"`).
  - Events: eventDeck.js (the one picker of the player's events; data/eventDeck/) and predicates.js (the shared test language of ambitions, the deck and crises); crises.js over data/crises.js (world crises from conditions, `state.settings.crises === 'off'` stops them).
  - Battles: battleThreshold.js (small towns fall on Auto, no battle screen), battleOdds.js (auto range and reasons on the pre-battle card, data/autoParity.json), consequences.js (coalition and loyalty previews before an assault), data/battleCards.js (event-granted battle cards read by battleInputs.js), worker presets in battle/sim/economy.js, touch gestures in battle/input/gestures.js (draw a path, circle select), tutorial copy in tutorial.js.
  - Proof: actionLog.js (a game is its start plus its actions) and macroVerify.js (replay to a state hash) are the base of challenges.js (weekly seeded challenge, supabase/ and the verify-challenges workflow, steps in plans/U36-DEPLOY.md). Async play is designed only: plans/ASYNC-MULTIPLAYER.md. Business model: plans/BUSINESS-MODEL.md.
  - Explore mode (U43): `state.settings.explore` (start screen Rules step, RESET_GAME `explore`): `exploreOn` (hostility.js) makes `canFight` false for every pair, `declareWar` a no-op, and stops crises, rebels, civil wars and event uprisings. A new fight source must check it.
- `src/components/`: React UI (panels, modals, globe, map, battle screens).
- The flat map is one WebGL canvas (phase A2): `src/components/map/gl/GLMapView.jsx`. Territories,
  borders, hexes, fog and lens tints are one full-screen shader that finds each pixel's tile
  (territoryShader.js over the data textures of tileGpuData.js and territoryData.js); badges,
  banners, markers and glyphs are instanced sprites from a canvas atlas (sceneModel.js,
  spriteArt.js); the close view's models come from closeView/closeViewScene.js in the same scene.
  The world wraps east-west (mapView.js; a resize keeps the place at the centre: carryTransform). Camera moves from outside the map (after a battle, Show on map, prompts, the turn report) go through src/components/map/mapCamera.js (`cameraTarget`: the place, else the selected army, else the capital, never a default spot; `focusPlace` in marchEvents.js). The old SVG map (Map2DView.jsx) and the globe stay behind
  settings (map/mapPrefs.js) for one release. Map speed: `node scripts/perf/map-pan.mjs --gpu`.
- Layout: `src/hooks/useLayoutMode.js` picks desktop / tablet / phone-landscape / phone-portrait and
  sets `<html data-layout>`. Phones play landscape (slim top bar, tab rail on the right, side
  sheets); portrait shows a rotate screen. CSS follows it with the `pl:` Tailwind variant and the
  `.sheet-backdrop` / `.sheet-panel` classes (index.css). `useIsMobile` = the bottom-bar layout only.
- Who is on screen: every card, sheet, dock and notice registers with `useInteraction(id, open, { priority, kind, label })` (src/hooks/useExclusivePanel.js; rules in interactionModel.js). On a phone or tablet one shows and the rest wait as chips (ui/WaitingChips.jsx); a desktop keeps panels beside cards. A new overlay joins it instead of keeping its own "busy" list. Decision cards never close on a backdrop tap. End Turn is anchored to `--rail-w` (never `--rail-inset`); the "Idle N" chip beside it and the stacked "needs you" chips come from ui/promptStack.js. Real-browser check: `node scripts/ui/panels-shots.mjs` (dev server on 5197).

## Commands
- `npm run lint` (zero warnings allowed), `npx vitest run`, `npm run build` (writes dist/, gitignored).
- Fast local checks: `npm run test:quick` (skips the 17 slowest files listed in vitest.config.js, about 2 minutes), `npm run test:related -- <files>` (only tests that import them). CI runs the full suite on every push to claude/integration and main.
- Tests of the differentiation plan (each next to its module in src/engine/): rulers, decrees, renown, ambitions, legacy, eventDeck, crises, chronicle, battleThreshold, battleOdds.range, consequences, macroVerify (also covers actionLog), challenges, exploreMode; UI models: src/components/ruler/rulerSheetModel.test.js, chronicle/chronicleModel.test.js, data/glossary/glossary.test.js.
- e2e: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium npx playwright test`.
- Battle sandbox in the browser: `npx vite`, then open `/?battleSandbox`.

## Known quirks
- Timing budgets (80 ms/turn) run only with `PERF_CHECKS=1`. The sandbox varies by 10-20 ms run
  to run: compare against the base commit on the same machine (balance-sim compare.sh), never
  against an old number. Long full-game tests can time out under full-suite load; rerun alone.
  Known load-only flakes (pass when run alone): stoneAI "two raids at once", battleLoop, sim,
  worldgen "same bytes", endgameReachability, pack-map-models, battleReportView; Windows only:
  src/services/challengeFiles.test.js.
- Invariants: `auditGameState` / `assertGameState` in src/engine/stateAudit.js.
- A commanded battle never opens with nobody on a side, and any set-up, worker or drawing error shows BattleFailure (Auto or Try again): src/components/battle/battleOpenGuard.js, TacticalBattleHost.jsx. Checkpoints resume only into the battle they were saved from (setupKeyOf; battle ids repeat between games).
- Plans and audits live in `plans/` (stabilization audit, Civ-style research, unit art brief).
- Tests that create a game must pass a fixed `rngSeed`; a fresh game gets a random one.
- resolveTurn does nothing while an event, a `pendingPeaceOffer` or a pending defense battle is
  open: long-run loops must answer them.
- The AI world is quiet by design (only Tier-1 AI nations declare wars).
- Unit models: CC0 packs go in src/assets/raw-models/, then `npm run import:models`.

## Lead workflow (how the lead session runs lanes)
- Current state and open user decisions: the newest `plans/HANDOFF-*.md`; loop progress: `plans/LOOP-REPORT.md`;
  open items: `plans/FOLLOW-UPS-2026-10-21.md`. Status page data: artifact XwVgyvXzntx58knL5nMVyb (datasets `agents`, `plans`).
- Big lanes run as sub sessions (their own machine and branch); small lanes as local worktrees:
  `git worktree add --no-checkout -b <branch> ../wt-<name> origin/claude/integration`, then sparse checkout
  without `/plans/art/downloads/ /plans/art-pilot/ /plans/art/kits/ /docs/`, `git checkout`, and symlink
  `node_modules` to the main checkout (no npm install). A worktree is about 1.9 GB; remove it after the merge.
- Every lane brief: ponytail first; targeted tests only when the machine is shared; kill only its own
  processes by PID (never `pkill -f`, it can kill the caller); push its branch, never merge.
- A sub session lane also follows all of CLAUDE.md, dispatches API work (AI playtests, content jobs) only with a
  budget the lead granted by send_message (the lead checks it against the $90 total and records it; the lane
  sets that job's `max_usd` to its grant and reports the real cost), and when done
  reports back with the claude-code-remote send_message tool to the lead session (its id in the brief), plus a
  report file plans/lanes/<lane>-REPORT.md on its branch.
- Before merging a lane that touches src/engine/ or src/battle/sim/: run the `engine-rules-reviewer` agent
  and fix real findings. Then merge into claude/integration, lint, `npm run test:quick`, push integration;
  push main only when that is green (main deploys).
- After any user interrupt, check every lane is still alive (a stopped agent cannot be resumed: start a new
  lane on its worktree's edits).
- Design decisions (user, 27 Oct): the lead session is the manager and gives the yes for design and rule
  changes; lanes ask the lead, not the user. Keep the user's own past decisions (battle rule Q3: a side with
  bases loses only when its buildings are gone; a city falls only when its defence is beaten; units keep
  their age and upgrade with gold on own land) and the game's core identity. Each design call rests on research (how proven strategy
  games solve it) and checked evidence (balance-sim, battle-lab parity, shots), never a guess; record it in
  plans/LOOP-REPORT.md with its reason and evidence.
- AI playtester (dev only, never for live players): workflow `.github/workflows/claude-content.yml`, job
  `human-playtest` (`scripts/ai/human-playtest.mjs`), inputs persona, scene (`campaign` or `battle`), limit,
  max_usd, slices, size, lang; dispatch on ref claude/integration; results on branch `ai/human-playtest-<run_id>`
  (report.md, diary.jsonl, shots/). About $0.01 a step. One queue per job, persona and scene.
- API budget (the user's rule, 27 Oct): **$90 in total, never beyond.** Before any dispatch, add the job's
  `max_usd` cap to the spend so far in the dashboard's spend data; if the sum would pass $90, do not
  dispatch and tell the user. Record each run's real cost there when it finishes.

## Lessons (mistakes not to repeat; add one line each time)
- Never edit a file while `npm run test:quick` runs on it: the run reports a false failure. Rerun before calling it red.
- A design call must respect the player's build phase: a 60 s AI march-out in economy battles skipped towers and training (battle-stall, 27 Oct). Check every timer against the battle clocks and the RTS identity, not only AI-vs-AI traces.
- A choice stored for later (crisis answered early) must be re-checked when it is paid: if it can no longer be afforded, reopen the card, never drop it silently.
- Sub sessions stall on a permission prompt for send_message: create them with `extra_allowed_tools: ["mcp__claude-code-remote__send_message"]`, and read a stuck lane's report from its transcript (list_events).
- Playtest issues marked "open" in an old summary may be fixed already: check the code or a fresh run before starting a lane on them.
- Dashboard datasets: upload the JSON as an asset first, then point `datasets/<id>` source.url at it with the last `if_version`; one JSON file per upload call.
- Every evaluation round grades art and animation too (map, units, animations, VFX, transitions), not only rules and UI (user, 27 Oct).
