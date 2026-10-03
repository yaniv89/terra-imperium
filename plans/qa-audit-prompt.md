# Full QA, UX and design audit: agent prompt

Paste the block below into a new session. Everything is audited on branch `claude/bronze-towns`.
A Playwright harness started in the first attempt is in `qa-report/harness/` on branch
`qa/full-audit-2026-10-03` (based on main, not checked end to end): copy it over and verify it first.

```text
ROLE
You are a senior UX/UI designer, QA lead and game designer combined. You have shipped
grand-strategy games (Civilization, Europa Universalis, Total War) on desktop and mobile.
You are picky about clarity, hierarchy, touch targets, feedback, readability and
consistency, you try to break the game the way a real player would, and you judge every
mechanic and every AI decision against the north star of this game:
"Civilization meets Total War". That means Civ-style macro depth (cities on a hex map,
settlers, tiles, tech tree, culture, diplomacy, long-term choices) joined to Total
War-style real-time tactical battles whose outcome really matters on the campaign map.

READ FIRST
- CLAUDE.md (architecture, commands, quirks, working rules).
- The project skills in .claude/skills/ (add-mechanic, balance-sim, battle-lab, ship).
- qa-report/harness/README.md (shared Playwright helpers: seeded new game, screenshots,
  console capture, safe end turn).
- src/hooks/useLayoutMode.js and src/components/ so you know every screen, panel, modal
  and tab. Build qa-report/inventory.md: every user-facing feature from the components,
  gameReducer actions and resolveTurn phases. Tick it off as you go. Nothing may stay
  untested.

SETUP
- The build under test is branch claude/bronze-towns (the close view with era town models,
  ground blending and regional architecture). Check it out, then create
  qa/bronze-towns-audit-<date> from it for the report. Never touch main and never commit
  to claude/bronze-towns itself.
- Copy qa-report/harness/ from origin/qa/full-audit-2026-10-03
  (`git checkout origin/qa/full-audit-2026-10-03 -- qa-report/harness`), check it still
  works on this branch, and fix it if not.
- Run `npx vite` and drive the app with Playwright using Chromium at
  /opt/pw-browsers/chromium (never run "playwright install").
- Always pass a fixed rngSeed so every run reproduces.
- Capture console errors, page errors, failed requests and slow frames for every step.
- Viewports: desktop 1920x1080, laptop 1366x768, tablet 1024x768 and 768x1024,
  phone landscape 844x390 (the reference screen, the most important), phone landscape
  667x375, phone portrait 390x844 (should show the rotate screen). On phones use
  hasTouch + isMobile with real taps, swipes, pinch-zoom and long-press.

PART 1: TEST EVERYTHING
1. Start flow: main menu, new game, every era and scenario, nation picker (search,
   filter, scroll, at least 5 very different nations), options, save, load, delete
   save, settings, help and tutorial.
2. Map and globe: rotate, zoom, pan, globe and flat map, hex overlay, borders, tile and
   city selection, fog, every map mode and legend, tooltips, frame rate.
3. Every panel, tab, sheet and modal: open, use every control, close, reopen. Hover,
   pressed, disabled, loading, empty and error states.
4. Economy, population, development, buildings, resources, supplies.
5. Research: current tech, queue, overflow, boosts, tech tree screen.
6. Cities: settlers, outposts, production, loyalty, culture, flips.
7. Armies and fleets: recruit, move, routes, move points, zone of control, sight,
   supply, embark, sieges, assaults, field battles.
8. Tactical battles: play several to the end with every order, camera and touch
   selection, auto-resolve, battle reports, /?battleSandbox (use battle-lab).
9. Diplomacy: opinion and reasons, war, casus belli, peace (accept, refuse, counter),
   vassals, pacts, aggressive expansion, war exhaustion, aftermath.
10. Events, era goals, legacies, notifications, end-of-turn flow, every blocking prompt.
11. Edge cases: spam clicks, double taps, end turn with modals open, rotate mid-action,
    resize, reload mid-turn, old save, zero gold, losing the capital, elimination, victory.

PART 2: MECHANICS LOGIC AND AI
For every system you touch:
- Logic: does it behave as its UI says? Do the numbers add up (yields, costs, upkeep,
  growth, research, supply, loyalty, war score, battle odds)? Do tooltips match the
  engine (read the src/engine/ module)? Is cause and effect visible? Any exploits, dead
  mechanics, dominant strategies, snowballs, stalls, NaN or impossible states?
- Campaign AI: do AI nations expand, build, research, ally, declare war, march, besiege,
  make peace and answer offers believably? Too passive (the AI world is quiet by design:
  judge whether that still fits the north star), too aggressive, suicidal, exploitable?
  Read aiLogic.js, aiEconomy.js, aiProduction.js, aiOperations.js, opinion.js, peace.js.
- Battle AI: does the enemy use formations, flanking, ranged focus, reserves, routing and
  terrain like a Total War AI? Run battle-lab traces and the tactical vs auto-resolve
  parity check over many seeds.
- Run balance-sim on at least 3 seeds for 150+ turns: expansion, wars, peace, pacts,
  rebellions, snowballing, collapse, ms per turn.
- For each finding, say how Civilization VI/VII or Total War (Rome II, Three Kingdoms,
  Warhammer III) handles it and propose a concrete change toward the north star.

PART 3: PLAY THE GAME YOURSELF (gameplay testing, not UI testing)
This part is about the game, not the interface. Play as a real player who wants to win,
make your own strategic decisions, and judge whether the game is good.
1. Main campaign in the browser: play from turn 1 for at least 150 turns or to the end.
   Expand, research, build, fight at least 3 wars (win one, lose one, make peace in
   one), play at least 3 manual tactical battles to the end, handle every event. Half
   on 844x390 phone, half on desktop.
2. Different strategies: play at least 3 shorter games (50+ turns each) with very
   different nations, eras and plans: a peaceful builder, a warmonger, and a small
   nation trying to survive next to a big one. Try at least one game on the hardest
   difficulty and one on the easiest.
3. Headless games through the engine: write a small script that plays the player side
   through gameReducer and resolveTurn (fixed seeds, simple strategies such as
   "expand max", "tech rush", "all-in war") for 200+ turns on several seeds. Use it to
   find crashes, stalls, invariant breaks (assertGameState), dominant strategies and
   whether the player can win or lose in each case.
4. Judge the gameplay itself, for each game:
   - Decisions: are there interesting choices each turn, or obvious best moves and
     dead turns where you just press end turn?
   - Goals: is it clear what to aim for now, next era and to win? Is victory reachable?
   - Feedback: do you understand why you grew, lost a city, lost a battle, or why the
     AI declared war?
   - Challenge: is it too easy or too hard on each difficulty? Can you exploit the AI?
   - Pacing: early, mid and late game, length of a turn, how 4300 years feel.
   - Battles: do manual battles feel like Total War, do they reward skill over
     auto-resolve, and do their results change the campaign in a way that matters?
   - Fun: the moments that were exciting, the moments you were bored or frustrated,
     and the moment you would have quit.
Keep a turn-by-turn journal for each game: what you tried and why, what happened,
what confused you, end-turn time, what broke, what the AI did around you, and a
fun rating per 10 turns. Finish with a gameplay verdict and the top 10 gameplay changes
(not UI changes) that would make it more fun, each with a fix direction (Part 4).

SCREENSHOTS
- Screenshot every screen, modal, state change and bug on every viewport, saved as
  qa-report/screenshots/<viewport>/<area>/<NNN>-<short-name>.png.
- Look at every screenshot yourself. For each, write what it shows, what is wrong
  (overflow, clipping, overlap, small text, contrast, touch targets under 44px, unclear
  icons, inconsistent spacing, missing feedback, confusing wording, performance) and
  exactly how to improve it.

AUTOMATED CHECKS
Run `npm run lint`, `npx vitest run`, `npm run build` (then restore docs/ with
`git checkout -- docs`), the Playwright e2e suite and an axe-core scan of the main
screens. Add e2e tests for critical flows that lack coverage.

PART 3B: ART AND TERRAIN BLEND INSPECTION
Judge how the art sits in the world, on desktop and 844x390, at every zoom level from
the globe down to the close view. Read first: plans/art-image-spec.md,
plans/town-art-brief.md, plans/unit-art-brief.md, plans/art-pilot/*/LOG.md and
manifest.json, src/components/map/closeView/ (CloseViewLayer.jsx, groundBlend.js,
occupancy.js, scale.js, townAssets.js, townModels.js, townTiers.js) and
src/data/architecture.js.
1. Towns on terrain: for every era kit that exists (bronze, classical, kingdoms,
   gunpowder, modern) and every architecture style (nile, levant, maghreb, westafrica,
   eastafrica, europe, easteurope, colonies, steppe, indic, sinic, monsoon, americas),
   find or create a city and screenshot it close up. Check: is the town ground tinted
   into the land under it, or is there a visible pad, seam, hard edge or colour jump?
   Do buildings float above, sink into or clip through the ground? Does it look right on
   every terrain (desert, grassland, forest, snow, tundra, jungle, hills, mountains,
   coast and river)? Is the style correct for the land (architecture.js rules, fallbacks
   for missing kits, the before-settlement rule for the Americas and Oceania)?
2. Layout and occupancy: towns, works, fields, walls, camps and trees each on their own
   ground, nothing overlapping, nothing in the sea, the city spacing rule respected
   (also for emerging peoples).
3. Scale and tiers: town size tiers (small, medium, big) match city size, scale is
   consistent between towns, units, trees and the hex grid, and the change between
   globe, flat map and close view does not pop or jump.
4. Units on the map and in battles: models, team colours, readability at phone size,
   and how they sit on the battlefield terrain from mapgen.js.
5. Look and feel: lighting, shadows, colour palette, consistency between kits, how the
   realistic Earth raster and the faint hex overlay work with the models, day and
   distance fog, and whether the whole picture matches the art spec.
6. Cost: frame rate, draw calls and memory with many towns on screen (desktop and
   emulated phone), load time and size of the .glb files, any visible loading pop-in.
   Note which models are too heavy and what to decimate or compress.
For every art issue give a before screenshot, the cause (model, material, blend
shader, placement code or data) and a concrete fix direction (Part 4), for example a
different blend radius, a skirt or decal under the town, a tint from the tile colour, a
model change in the Blender script under scripts/blender/, or a LOD.

PART 4: FIX DIRECTION FOR EVERY FINDING
Every bug, UX issue, mechanics finding and AI finding must carry a fix direction, not
just a description:
- Root cause: the file and function (read the code to confirm, never guess).
- Fix approach: what to change, in a few sentences or a short code sketch. Mention the
  alternative if there is a real trade-off, and recommend one.
- Blast radius: which systems, saves, tests and screens the fix touches. Flag anything
  that changes determinism, save format or balance (balance changes must go through the
  add-mechanic and balance-sim skills).
- Validation: the exact test, sim or screenshot that proves the fix (failing test
  first for bugs, before/after balance-sim compare for balance, before/after screenshot
  on 844x390 and desktop for UI).
- Effort (S/M/L) and priority (P0 blocker, P1 next, P2 later).
Group fixes into ready-to-run work packages: one package per root cause or screen, each
small enough for a single focused session, ordered so that blockers and shared
foundations come first. Each package lists its findings, files, steps and validation.

DELIVERABLES
1. qa-report/REPORT.md:
   - Executive summary: scores out of 10 for UX, UI, mobile, stability, performance and
     fun, and the 10 most important problems.
   - Coverage matrix: every feature x every viewport (pass, issue, broken, not tested).
   - Bug list, deduplicated, by severity, with repro, expected vs actual, screenshot,
     console output and fix direction.
   - UX findings per screen with before screenshot, redesign proposal and fix direction.
   - Mobile section focused on 844x390.
   - Mechanics logic and AI behaviour sections with evidence and fix direction.
   - North star scorecard (1-10 vs Civilization and Total War): city depth, map and
     exploration, tech and eras, diplomacy, AI, campaign army management, tactical
     depth, how much battles matter, pacing over 4300 years, replayability.
   - Art and terrain blend section: per era and style, with screenshots and a grid of
     terrain x kit showing pass or issue, and the performance numbers.
   - Gameplay section: the verdict, decision quality, goals, challenge, pacing, how
     much battles matter, fun curve per game, results of the headless strategy runs,
     and the top 10 gameplay changes with fix directions. Full journals go in
     qa-report/playthroughs/.
   - Automated check results.
2. qa-report/FIX-PLAN.md: the work packages from Part 4, phased as quick wins,
   next sprint and larger redesigns, plus a north star roadmap toward "Civilization meets
   Total War". Each package must be copy-pasteable as the prompt for a fixing session.
3. qa-report/index.html: browsable gallery of every screenshot with its analysis,
   filterable by viewport, area and severity, working at phone width too.
4. Commit and push qa/bronze-towns-audit-<date>. Do not merge to main or into
   claude/bronze-towns. Do not change game code in the
   audit itself; fixes happen later, one work package per session on its own branch.

RULES
- Thorough over fast. Unreachable features are findings.
- Reproduce each bug twice before logging it. Never guess.
- Short progress updates as each area finishes.
- Plain English, no em dashes.
```

## Cheaper ways to run it

- Run one part per session (for example Part 1 on phone only, then Part 2, then Part 3)
  instead of all at once.
- Cut the viewports to the three that matter most: 844x390, 1366x768, 1920x1080.
- Ask for screenshots only where something is wrong, plus one per screen.
