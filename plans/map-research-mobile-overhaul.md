# Plan: landscape mobile, Civ-style research, a living map, working advisors, battle reports

Date: 2026-10-01. Status: proposal for review. Nothing implemented yet.
Supersedes Parts 1 and 2 of `plans/civ-research-landscape-units.md`, which still holds the research
background and sources. Part 3 there (unit art) continues in `plans/unit-art-brief.md`.

Each workstream below has the same layout: what the game does today (checked in the code),
the design, the engine and UI work, tests, and a critique with the fixes it led to.
Section 9 critiques the plan as a whole. Section 10 gives the order of work.

---

## 0. Facts this plan is built on (measured, not assumed)

- **2D map.** It is SVG with 4,482 province paths, d3-zoom 1x to 40x, and opens at 5x on the
  capital (`Map2DView.jsx`). A tap that misses every polygon falls back to the nearest centre
  within 24 px (`regionClickAssist.js`).
- **Globe.** react-globe.gl with polygons only. It has no zoom limit of its own and no army or
  building markers. It is the default map mode (`MapContainer.jsx`).
- **No army or building markers anywhere on the map today.**
- **Units.** A new game has 0 units. A 100-turn world (seed 11) had 252 units in only 37
  provinces, because the AI keeps them stacked. Markers are cheap: tens, not thousands.
- **Moving.** `MOVE_ARMY` moves one unit to a neighbouring province you own and costs 1 MIL per
  unit. The player starts with a cap of 3 MIL. A 5-unit stack cannot be moved in one turn.
  Fleets move along sea lanes (`isReachableBySea`). Entering foreign land is always
  `LAUNCH_INVASION` (2 MIL) or `AMPHIBIOUS_ASSAULT` and goes through `PreBattleModal`.
- **Battle odds already exist.** `battleOdds.js` runs the real auto-resolve 200 times.
  PreBattleModal shows win / take / hold percentages and a bar, but only with intelligence on
  the target (`canSeeRegionDetails`). Without intel the player sees no numbers. That is
  probably why the odds "disappeared". DefenseSheet shows a hold chance.
- **Battle reports.** `state.lastBattleReport` keeps one report: rounds, fortune, deployed IDs
  and a round log. MilitaryPanel shows it. Auto-resolved fights end in a small text toast.
  Only commanded battles get a full result screen. `MEN_PER_STRENGTH = 10` (aftermath.js)
  turns strength into soldiers.
- **Research.** An instant purchase of techPoints plus an ADM/DIP/MIL power cost. 50 techs:
  5 lines times 2 per age. Science buildings are the only real source of science.
  techPoints also come from Fund Scholars, espionage and events.
- **Advisors.** Three pools: ADM, DIP and MIL. A hired advisor only adds +level to its pool
  and costs a salary. Nothing is automated.
- **Taxes.** `SET_TAX_RATE` has 4 levels (low, normal, high, extortionate), a cooldown, and
  estate politics (burghers' loyalty, `actionPolitics.js`).
- **AI economy.** The AI already decides buildings, research, stability and recruitment
  (`aiEconomy.js`, `aiLogic.js`), but on `nation.economy`. The player uses `state.resources`
  and `state.techTree`, a different shape.
- **Mobile layout.** Below 1024 px wide the game uses a bottom tab bar and bottom sheets
  (`PanelDrawer.jsx`). Native shells exist (`android/`, `ios/`). No orientation is set.
- **Speed.** About 230 to 250 ms per turn in this sandbox at turns 50 to 100. The CPU budget
  is already tight, so new per-turn work must stay player-only or cached.

---

## 1. Landscape-first on phones

### Design
- **Phones are landscape only.** Detected as a short side of 500 px or less, plus touch.
  Tablets and desktop keep their current layouts.
- **Native app.** Lock orientation:
  - Android: `android:screenOrientation="sensorLandscape"` on MainActivity.
  - iOS: Info.plist `UISupportedInterfaceOrientations` set to landscape left and right.
- **Web on phones.** Browsers can't reliably lock orientation (iOS Safari has no
  `screen.orientation.lock`). Show a "Rotate your phone" overlay in portrait. Also try
  `screen.orientation.lock('landscape')` after entering fullscreen where the browser allows it,
  so Android Chrome can lock.
- **Layout at 844x390 (base phone) to 932x430.**
  - **Top bar, 36 px.** Treasury, science, stability, date, and a research pill
    ("Bronze Working · 3"). Resources collapse to icons with numbers. Tapping one opens its
    breakdown.
  - **Left rail, 56 px.** Domestic, Military, Diplomacy, Research, Space and Log, as icons with
    tiny labels and badges ("2 idle armies", "research done").
  - **Right dock, 38% wide, at most 380 px.** The open tab's content. It scrolls inside itself
    and collapses with a swipe right or by tapping the open tab again. The map stays live
    beside it.
  - **Bottom right.** A large End Turn button, above a small Fast-forward button.
  - **Sheets.** Modals (province, pre-battle, events, research choice) become right-hand side
    sheets the height of the screen, never bottom sheets. A full-screen moment such as a
    battle report or an age change can use a centred card at most 92% of the height.
  - **Notches.** Use `env(safe-area-inset-left/right)` so nothing sits under the notch or the
    home bar.
  - **Text and targets.** Minimum text 11 px. Tap targets at least 40x40 px.
- **One layout switch.** Add a `useLayoutMode()` hook that returns `desktop`,
  `phone-landscape`, `phone-portrait` or `tablet`. It replaces the scattered `useIsMobile`
  width checks (`max-width: 1023px`), which would wrongly treat a phone in landscape
  (844 px wide) as mobile portrait.

### Work
1. Add `useLayoutMode`, then migrate `useIsMobile` callers to it.
2. Build a `GameShell` with three slots (top bar, rail, dock) and move ActionPanelTabs and
   ActionPanel into it. The panel bodies stay the same at first.
3. Make each panel fit 380x350 px. The dense ones are Domestic, Military and Diplomacy: give
   them collapsible sections, sticky section headers and no fixed heights.
4. Turn sheets into side sheets: ProvinceModal, PreBattleModal, EventModal, DefenseSheet,
   PeaceOfferSheet and the new research sheet.
5. Add the rotate overlay and the native orientation lock (Capacitor config, then
   `npx cap sync`).
6. The battle screen is already landscape. Check its HUD at 390 px height.

### Tests
- Add Playwright projects for phone landscape (844x390, touch) and phone portrait
  (390x844, which must show the overlay).
- Screenshot every tab and every sheet in landscape.
- Assert there is no horizontal page scroll and every button sits inside the viewport.

### Critique and fixes
- **Height is the scarce resource now.** At 390 px tall, the top bar, a sheet header and a
  footer leave about 300 px. Some current sections (Domestic court, laws) are long.
  Fix: collapsible sections, and a rule that a panel never needs two scroll areas.
- **Portrait web players get blocked.** The overlay is a hard stop.
  Fix: a "Play in portrait anyway" link that keeps today's layout, remembered in
  localStorage. That costs nothing because the portrait layout already exists. Removing
  portrait later is a separate decision.
- **This touches every panel.** It is the riskiest piece for regressions.
  Fix: do it first, behind the layout hook, with screenshot tests, so every later feature's
  UI is built once for the new shell instead of twice.

---

## 2. Civ-style research, with a choice popup at the start and after each tech

### Engine design (follows the add-mechanic skill)
- **Science per turn**, shown as `+N`:
  `science = base 2 + Science buildings + round(totalDev x 0.02) + modifiers`.
  - The development share ties growth to research.
  - Fund Scholars becomes a one-off lump of science (unchanged value).
  - Espionage steals science into the thief's current research.
  - Event techPoints add to current research.
- **State.** `research = { current: techId|null, queue: [techId], progress: { techId: pts },
  bank: pts }`. The player's copy lives on `state.research`. Each AI nation keeps its own
  copy on `nation.research` (parity).
- **Each turn**, in the income phase:
  - Science goes into `current`.
  - On completion the tech is researched, its effects apply (tech age advance unchanged), the
    overflow moves to the next queued tech, and an event is logged.
  - With no current tech, science goes into `bank` and nothing is lost. The bank pays into
    the next pick at once (Civ-style overflow).
- **Switching** keeps the partial progress on each tech.
- **Picking a locked tech** queues its missing prerequisites in order (a path). With 5
  linear lines this is always one line, so it is simple.
- **Cost.**
  `cost(tech) = AGE_BASE[age] x speedMult x diffusion x agesBehindMult x (1 + sizePenalty)`.
  - AGE_BASE is fitted with balance-sim so the median nation finishes 6 to 8 of an age's 10
    techs before the calendar age ends. Rough starting points: 4, 9, 14, 14 and 28 turns per
    tech by age.
  - speedMult follows game speed (Fast halves turn length, so costs halve too).
  - `diffusion` is today's `withDiffusion` (cheaper next to knowers, +20% as a pioneer).
  - sizePenalty is optional: +0.5% per province above 10, capped at +30%.
- **Power pools leave research.** ADM, DIP and MIL no longer pay for techs. Research Focus
  becomes +10% science toward the focused line instead of a power discount.
- **Calendar gate.** Keep the hard `yearAvailable` gate in the first slice, so balance can be
  compared like for like. A soft "+50% before its year" is slice 5.
- **Boosts ("Eurekas"), slice 4.** Each tech gets one trigger worth 40% of its cost, from
  things the engine already tracks: own a deposit, win a battle or siege, build a tier,
  sign a pact, reach a population, launch a ship.
- **AI.** `aiEconomy` stops buying techs. Each AI nation's science accumulates the same way.
  When it has no target, it picks one by `DOCTRINE_TECH_CATEGORY_PRIORITY` (deterministic).
  This is one addition per nation per turn, so it is cheap.
- **Save migration.** `saveMigrations.js` keeps researched techs, sets research to empty and
  converts the old techPoints stock into `bank` one for one.

### The choice popup
- **Game start.** After onboarding, a "Choose your first research" sheet opens. It shows:
  - three suggested cards, one per doctrine-relevant line, with name, effect in plain words,
    cost, turns ("6 turns at +4"), and the boost hint once boosts exist;
  - "Show full tree", which opens the Research tab;
  - "Let my advisor choose", which picks by doctrine and turns on the research advisor
    (section 5).
- **On completion.** If the queue is empty, the same sheet opens at the start of the
  player's next turn, headed "Bronze Working researched: +10% copper" with a short flourish.
  It shows the next three picks.
- **It never blocks.** End Turn stays usable and science banks. That avoids adding another
  "resolveTurn does nothing while…" lock, a known pitfall in this codebase.
- **The queue avoids nagging.** Picking a tech three steps ahead queues the path, so the
  popup only appears when the queue runs out. A setting can turn the popup off entirely.
- **Research tab.**
  - Current tech with a progress bar and turns left.
  - Queue chips that can be reordered by drag and removed with an x.
  - 5 line columns as horizontal scrollers in landscape.
  - Each card shows cost, turns, progress, diffusion or pioneer badges and the boost.
- **Top bar pill.** Shows "Researching X · N" and opens the tab.

### Tests
- **Unit:** accumulation, overflow, switching keeps progress, the queue path, banking, cost
  edges, migration.
- **Integration:** with `resolveTurn` and a fixed seed, the first tech completes on the
  predicted turn.
- **longRun determinism:** unchanged in spirit.
- **balance-sim:** median techs per age, before and after.
- **e2e:** a new game shows the sheet. Pick a tech, end turns until it completes, and the
  sheet appears again.

### Critique and fixes
- **Calibration is the real work.** A bad AGE_BASE either races to the Modern age or stalls in
  the Bronze age. Fix: calibrate in its own slice with balance-sim on 2 seeds and 150 turns,
  and change nothing else in the same commit.
- **Power pools lose their main sink.** That inflates ADM, DIP and MIL. Fix: check in
  balance-sim that the pools still drain through stability, laws, development and
  diplomacy. If they sit at the cap, add a sink there, not in research.
- **AI parity.** If the AI keeps buying instantly while the player waits, the comparison is
  unfair. Fix: both use the same accumulation function, tested together.
- **A popup after every tech feels like nagging.** Fix: a queue, "let my advisor choose",
  and an off switch.

---

## 3. Mobile zoom and tapping small provinces

### Problem
Small nations such as Israel, Lebanon and the Gulf states have provinces a few pixels wide
at normal zoom. Zoom alone doesn't fix a fingertip that covers about 45 px.

### Design (ranked)
1. **Tap disambiguation.** Recommended, and the biggest win. On touch, when a 44 px circle
   around the tap overlaps two or more provinces, open a small floating chooser beside the
   finger. It lists up to 5 province names with owner flag colours, ordered by distance.
   One more tap picks a province. One province under the tap acts at once, as today.
   Hit-testing reuses the projected centres plus a bounding-box overlap test (cheap: only
   provinces inside the circle's box).
2. **More zoom on mobile.**
   - Flat map: raise the 2D cap from 40x to 80x on touch devices.
   - Globe: clamp `controls.minDistance` so it gets closer than today. At a very low
     altitude the globe is the wrong tool, so offer "Switch to flat map here" as a chip when
     the player pinches past it. Don't switch automatically, because that is disorienting.
   - Double-tap zooms 2x on the tapped point.
3. **Smart zoom.** Tapping a tiny province at low zoom first zooms in on it (to where it is
   at least 48 px wide) and only selects it on a second tap. This is optional and can feel
   slow, so it is off by default.

### Tests
- Unit-test the chooser candidate function (overlaps and ordering).
- e2e at 844x390: tap a known multi-province point near Israel and expect the chooser.
  Pick the second entry and expect the province sheet for it.

### Critique
Disambiguation adds one tap in crowded spots, but it never selects the wrong province, which
is the real complaint today. That trade is right.

---

## 4. A living map: armies, buildings, drag to move

### 4a. A shared marker model
- **One pure function** for both maps:
  `getMapMarkers(state, viewerId) -> { armies: [...], fleets: [...], buildings: [...], battles: [...] }`.
  It lives in `src/utils/mapMarkers.js`, is unit-tested and is memoised on
  `state.units`, `state.regions` and `state.wars`.
- **Own armies, one per province stack:**
  - a banner icon by dominant class (infantry, ranged, cavalry, siege, mixed);
  - total soldiers (`strength x MEN_PER_STRENGTH`, shortened as "12k");
  - a morale ring, green to red;
  - a moves-left dot;
  - an embarked badge;
  - an "in battle" pulse.
- **Foreign armies: presence only.** A smaller banner in the owner's colour with no number
  and no class. Shown only where the player could plausibly see them:
  - next to or inside their own territory;
  - in a province with an enemy at war, inside the player's war zone;
  - in a nation they have intel on;
  - in an ally's provinces.

  Otherwise there is nothing (fog). With intel, the banner may show a size band
  (small / medium / large) instead of an exact number.
- **Fleets** use a ship icon on the coast, with the same rules.
- **Battles last turn** show crossed swords for one turn. Tapping them opens the report
  (section 6).

### 4b. Rendering
- **Flat map:** an SVG `<g>` layer above the provinces, drawn at screen scale (divided by
  `transform.k`) so icons stay 28 px whatever the zoom.
  - When two banners would overlap, they merge into a cluster ("3 armies") at low zoom.
  - At most about 300 markers. Measured worlds have about 40 stacks, so it stays cheap.
- **Globe:** `htmlElementsData` handles up to about 100 DOM markers well. Above that, or for
  buildings, use a `customLayer` with instanced sprites. Markers on the far side are hidden.
- **Zoom levels (level of detail):**
  - Zoomed out: own armies plus clusters only.
  - Mid zoom: foreign presence too.
  - Close zoom (2D 8x and up, globe altitude 0.35 or lower): buildings appear.

### 4c. Buildings in the province (close zoom)
- **Icons.** A small cluster of up to 4 icons in the province, one per built category at its
  highest tier, chosen by score:
  - food = a farm, economy = a market, military = barracks, defense = walls or a fort,
    science = a library, industry = a workshop, culture = a temple, naval = a dock,
    logistics = a road or depot;
  - mines for copper, iron and oil extraction.
- **Tier pips** under each icon. Icons are age-styled (Bronze huts through Modern buildings):
  3 art variants per icon, 9 categories plus 3 mines, so 36 small SVGs. They can be made in
  code (simple vector glyphs) before final art.
- **The capital** gets a palace icon. A Great Project gets its own landmark icon.
- **Tapping** a building icon opens ProvinceModal on the buildings section.
- **Foreign buildings** show only with intel, and only walls and a palace (things visible
  from outside).

### 4d. Drag and drop to move or attack
- **Gesture.** Press and hold an own army banner for 250 ms. It lifts, with haptics on
  native. Then drag. Pressing anywhere else pans the map as today, so dragging never fights
  panning. On desktop, a plain drag on the banner works.
- **While dragging, valid targets light up:**
  - green: a neighbouring province you own (a move);
  - red: a neighbouring foreign province with a valid attack (opens PreBattleModal on
    release, which always asks first, as the game rule says);
  - blue: for a fleet carrying troops, coastal provinces reachable by sea lane (opens the
    landing PreBattleModal);
  - for a fleet without troops, the sea-lane moves.

  Everything else is greyed out. Releasing on something invalid snaps the army back with a
  one-line reason ("Not a neighbour", "No moves left", "Needs 1 MIL").
- **Movement path.** Only one step (to a neighbour) in the first slice. A multi-step path
  (drag far, queue the steps over turns) is a later option. See the critique.
- **New engine action: `MOVE_STACK { fromRegionId, toRegionId, unitIds? }`.**
  - Moves every own land unit in the province that has moves left, or the given subset, for
    one cost: 1 MIL per stack, not per unit.
  - Today's per-unit MIL cost makes stack drags impossible at a 3-MIL cap.
  - This is a rule change, so it goes through the add-mechanic checklist. AI parity is not
    affected, because AI movement is abstract.
- **Splitting.** Tapping a banner opens the stack card with a checkbox per unit. "Move
  selected" then means dragging that card's banner.

### Tests
- **mapMarkers unit tests:** fog rules (foreign presence hidden far away, shown at the
  border, banded with intel), stacking, clustering.
- **MOVE_STACK reducer tests:** cost once, moves left, embarked cargo, an own-province-only
  move, foreign province refused.
- **e2e:** drag a banner to a neighbour and the stack moves. Drag onto a foreign neighbour and
  PreBattleModal opens. A long press on empty map still pans.

### Critique and fixes
- **The fog decision is a design choice.** Showing every foreign army worldwide would break
  the intel system and clutter the globe. The visibility rule above keeps intel meaningful.
- **Drag versus pan is the classic touch conflict.** A 250 ms hold costs a moment but is
  unambiguous. Tap then tap-target stays as an alternative for players who prefer it.
- **Doing it twice.** Two renderers (globe and flat) is real work. The shared marker model
  keeps the logic in one place. If time is short, ship the flat map first, because that is
  where close zoom (buildings) makes sense anyway.

---

## 5. Advisors that actually do things (delegation)

### Today
An advisor only adds +level power to its pool. The player wants:
- a Domestic advisor that builds around the country;
- a Military advisor that recruits;
- an Economy advisor that sets taxes.

### Design: three delegations, each on or off
| Delegation | Linked advisor | Does each turn |
|---|---|---|
| **Domestic** | ADM | Builds or upgrades one building and develops one province, following doctrine priorities and placement scoring (food where population is high, defense on borders, science in big provinces, naval on coasts) |
| **Economy** | ADM (shared) | Sets the tax rate by unrest and treasury, adjusts army and navy maintenance in peace or war, repays loans when rich, takes a loan only to stop bankruptcy |
| **Military** | MIL | Recruits by doctrine mix and counters to known enemies (`chooseAIRecruitClass`), places new units on threatened borders, raises maintenance during a war; never declares war or attacks |
| **Research** | (any) | Picks the next tech when the queue is empty |

- **Budget guard.** Each delegation spends only above a reserve the player sets:
  - Domestic: never below 2 turns of upkeep in gold;
  - Military: keeps a manpower floor of 20%;
  - Economy: never sets extortionate taxes unless the player allows it.

  The guards are sliders on each delegation card.
- **Advisor level matters.** Without an advisor, a delegation still works but is "basic":
  - it decides every 3 turns;
  - Domestic only builds, it does not develop.

  With an advisor:
  - it decides every turn;
  - it looks ahead (saves up for a better building);
  - a level 3 or higher advisor also gives a 5% discount on the actions it takes.

  That gives hiring a visible point.
- **Every decision is a real player action.** A pure planner
  `planDelegatedActions(state) -> [action]` (new `src/engine/delegation.js`) runs at the start
  of the player's turn (in ADVANCE_TURN before `resolveTurn`). Each action is dispatched
  through `gameReducer`, so every cost, cooldown, estate reaction and log line works exactly
  as when the player clicks. No rules are duplicated. The planner reuses the AI scorers
  (`DOCTRINE_BUILDING_PRIORITY`, `chooseAIRecruitClass`, `chooseAIRecruitRegion`) through a
  small adapter, because the player's resources have a different shape from
  `nation.economy`.
- **The player sees it.**
  - An "Advisors this turn" line in the turn summary ("Built a Library in Lyon. Recruited 2
    infantry in Metz. Lowered taxes: unrest rising."). Each item can be tapped to go to the
    province.
  - Each delegation card shows its last 5 actions and a pause toggle.
  - A small advisor portrait animation plays on the map where something was built or
    recruited (reusing `triggerEffect`).
- **Overrides.** A manual action the player takes this turn in an area pauses that area's
  delegation for the rest of the turn. Delegation never undoes a player choice. For example,
  if the player set taxes by hand, Economy leaves taxes alone for 10 turns.

### Tests
- Unit tests for the planner with fixed states:
  - it never goes below a guard;
  - it respects the tax cooldown;
  - it never declares war;
  - it returns the same actions for the same state.
- A 100-turn balance-sim run with all delegations on, compared against a passive player:
  - the player's economy stays solvent;
  - no audit violations;
  - msPerTurn rises by less than 5%.

### Critique and fixes
- **Loss of agency.** An advisor that spends the gold the player was saving is infuriating.
  Fix: guards, off by default except Research. Turning it on is a deliberate toggle, and
  every action is reported.
- **The pools don't match the words.** The game has ADM, DIP and MIL, not "domestic" and
  "economy". Mapping both to ADM keeps the data model. DIP gets no delegation in this plan.
  Auto diplomats could come later.
- **The wrong place to run it.** Running the planner inside `resolveTurn` would mix player
  intent into the world phase and break the "pure world turn" rule. Running it as reducer
  actions just before the turn keeps replays exact: the same seed gives the same actions.
- **A weak AI makes a weak advisor.** If the AI's building choices are poor, so are the
  advisor's. A placement score per province (above) is better than the AI's current one, and
  the AI can adopt it later.

---

## 6. Auto-battle: odds, an animated "fight", and real battle reports

### 6a. Odds again, for every fight
- **Without intel**, PreBattleModal shows nothing today. Show a band instead, worked out from
  what is visible (the size band from section 4):
  - "Likely win (60-80%)";
  - "Uncertain (35-65%)";
  - "Unlikely".

  Exact numbers still need intel. This keeps intel valuable and never shows a blank.
- **The same odds component** is used in PreBattleModal, DefenseSheet and the naval
  engagement (one `OddsBar` component).

### 6b. The "fighting" animation before the result
- **Honest drama, not fake drama.** When the player presses Auto-resolve:
  1. The result is computed first, as today: the same seed and rules.
  2. A 2.5 to 3.5 second sequence then plays the battle's real course:
     - two strength bars (blue and orange) facing each other, shrinking round by round
       from the battle's actual numbers;
     - the win-chance needle moves with them, recomputed from the strength left;
     - small hit sparks, a shake on a heavy round, and a "Routed!" stamp when a side breaks.
  3. The result card appears.

  Tap to skip. With reduced motion, show the result straight away.
- **Data.** `resolveBattle` already returns `report.rounds` and a `log`. Add a compact
  `report.timeline = [{ round, att, def }]` (strength after each round, a few integers) so the
  animation doesn't parse log text. This touches only the battle report shape, not the
  outcome, so the golden battle tests and replays stay exact.
- **Small multiples during resolveTurn.** When several AI attacks on the player auto-resolve
  in one turn, the turn summary plays them as a row of mini bars, one per battle, about 1.5
  seconds each, all at the same time.

### 6c. Battle reports
- **Keep a history.** `state.battleReports` holds the last 30, newest first. It replaces the
  single `lastBattleReport`, which is kept as an alias for one release. Each entry has:
  - turn, year, province, attacker and defender, outcome, captured;
  - each side's units with class, strength before and after, and routed;
  - **soldiers fallen and wounded** = strength lost x `MEN_PER_STRENGTH`. Routed units' losses
    count as fled, not fallen;
  - commanders fallen (from `resolveCommanderCasualties`), rounds, terrain, the main factors;
  - control change and devastation.
- **The report card** (side sheet in landscape):
  - the outcome banner;
  - a "Fallen: 4,200 of ours, 7,900 of theirs" headline with two proportion bars;
  - a per-unit table (icon, before and after, lost);
  - the strength-over-rounds chart (the same timeline as 6b, as a small line chart);
  - the factors list ("Terrain: hills x0.85", "Walls x0.70");
  - a link to the province.
- **The Military tab** gets a "Battle reports" list (the last 30) with filters (mine, wars,
  lost). The map's crossed-swords marker opens the matching report.
- **AI against AI battles** are abstract (`resolveWarProgress`), so they get no detailed
  report. At most a log line ("Rome won near Capua"). That is honest and cheap.
- **Size.** 30 reports of about 1 KB each is fine for saves and cloud sync. Logs are not
  stored in the report history, only the timeline.

### Tests
- `report.timeline` exists and its last entry matches the final strength.
- The golden battle test is unchanged.
- The report history is capped at 30.
- A save migration moves `lastBattleReport` into the history.
- e2e: auto-resolve plays the animation, skipping works, and the report opens with "Fallen".

### Critique and fixes
- **An animation that shows a fake back-and-forth would be a lie** the player eventually
  notices. Fix: it plays the real rounds only.
- **A 3-second wait on every battle gets old.** Fix: tap to skip, a setting for "instant
  battles", and the sequence is at most 1.5 seconds when the odds were 90% or higher.

---

## 7. Other map and presentation upgrades, in the same direction

These are cheap once the marker layer exists.
- **War front lines.** Contested borders pulse red. Provinces being besieged show a control
  ring that depletes.
- **Unrest and rebels.** A smoke icon on provinces at high unrest, and a rebel banner for
  active rebellions.
- **Movement arrows.** An arrow shows last turn's moves (own, and foreign where visible), and
  fades in the next turn.
- **Trade and pacts.** At low zoom, faint lines between trade partners. This is optional and
  can come later.
- **Turn summary card.** At the start of each turn, a small card covers battles, research,
  advisor actions and events. Each line jumps to the place on the map.

---

## 8. Mechanics touched (for the add-mechanic checklist)
| Change | Module | Feeds into |
|---|---|---|
| Science accumulation and queue | new `research.js`, resolveTurn income phase, gameReducer | tech age, buildings and units unlocked, AI economy, score |
| Power pools leave research | gameReducer `RESEARCH_TECH`, aiEconomy | ADM, DIP and MIL pools, stability, laws |
| `MOVE_STACK`, 1 MIL per stack | gameReducer | war tempo, MIL demand |
| Delegation planner | new `delegation.js`, ADVANCE_TURN | economy, buildings, recruitment, taxes, estates |
| Battle timeline and history | battle.js report, invasion.js, defense.js, saveMigrations | UI only |

Each goes through: pure module, fixed-seed tests, `auditGameState`, balance-sim before and
after, and `compare.sh` for speed.

---

## 9. Critique of the plan as a whole

1. **It is too much for one branch.** These are six projects. Fix: each workstream gets its
   own branch and its own merge, in the order below. Each one ships and is playable alone.
2. **The order matters more than any single feature.** Building the research sheet, the
   battle report and the delegation cards before the landscape shell means designing every
   one of them twice. So the shell comes first, even though it is the least exciting.
3. **The real risk is the research balance, not the code.** It changes the pace of the whole
   game. Fix: a calibration slice with numbers (techs per age, years per age reached), and
   one tunable table in `src/data/`.
4. **Performance.** Turns are already about 240 ms here. Delegation (player only) and
   research (one addition per nation) are cheap. The marker model is UI side and memoised.
   Fix: `compare.sh` on every engine slice. Reject anything over +5%.
5. **What players will actually notice first** is the living map (armies, drag and drop,
   buildings) and the battle drama. Research is deeper but slower to appreciate. If you want
   quick visible wins, the battle odds and reports workstream (6) is small and independent,
   and can go in parallel with the shell.
6. **Things deliberately left out:**
   - multi-turn movement paths;
   - a DIP delegation;
   - a branching tech tree or masteries;
   - AI-vs-AI detailed reports;
   - portrait removal.

   Each is a follow-up, so scope stays honest.
7. **Unit art is separate.** Army banners on the map are icons, not the 3D units. They don't
   wait on ChatGPT's art.

---

## 10. Order of work and rough size

| # | Workstream | Size | Depends on |
|---|---|---|---|
| 1 | Landscape shell, rotate overlay, native lock, side sheets | L | none |
| 2 | Battle odds band, animated auto-resolve, battle report history | M | none (can run beside 1) |
| 3 | Research engine, calibration, choice popup, research tab | L | 1 for the UI |
| 4 | Tap disambiguation, more zoom | S | 1 |
| 5 | Map markers: own and foreign armies, battles; `MOVE_STACK`; drag and drop | L | 1, 4 |
| 6 | Delegation (Domestic, Economy, Military, Research) | M | 3 (research pick), 5 (report jump) |
| 7 | Building icons at close zoom, other map layers | M | 5 |

S is about a day of work, M two to three days, L four to six days. Each ends with lint, the
full test suite, e2e at 844x390, balance-sim where it touches the engine, and a merge only
when you say so.

## 11. Decisions for you
1. **Landscape.** Lock phones to landscape, with a "play in portrait anyway" escape hatch for
   web? (Recommended: yes.)
2. **Research.** Remove ADM, DIP and MIL from research costs? (Recommended: yes.) Keep hard
   year gates for now? (Recommended: yes, soft gate later.)
3. **Foreign armies.** Show them only near your borders, in wars, with intel or for allies?
   (Recommended: yes.) Or everywhere?
4. **Delegations.** Off by default except research, with spending guards? (Recommended: yes.)
5. **Moving armies.** Move a whole stack for 1 MIL? (Recommended: yes, needed for drag and
   drop.)
6. **Order.** The order in section 10, or the battle reports and odds first as a quick
   visible win?
