# Terra Imperium: full review and the Civ-style map rework

Date: 2026-10-02. Status: plan v3, all nine decisions settled, implementation starts with workstream 1. Written against branch
`claude/gallant-pasteur-rfkma8` at commit `d08ded8` (the features branch; `main` is the live site).

This document has two halves. **Part A** reviews and criticises every game system as it is in the
code today, with a grade and the fix direction. **Part B onward** designs the new map (no more
regions: tiles, cities with growing borders, nation borders) and reworks every system, the RTS
battles and the UI for phones and desktop on top of it. It ends with balance targets, the order of
work, risks and the decisions you need to make.

Facts marked **(measured)** were read from the code or produced by the balance sim on this branch.
Everything else is design.

---

## 0. The game today in numbers (measured)

| Fact | Value |
|---|---|
| Map | 2,028 regions (merged from 4,482 real admin-1 provinces), 240 nations, real adjacency, 7 terrain classes by name matching, sea lanes, coastal flags |
| Turn engine | `resolveTurn` runs 26 fixed phases (time, income, maintenance, unrest, rebellion, supply, morale, AI growth, AI economy, succession, national power, capitals, estates, disasters, economy, diplomacy, great projects, AI recruitment, AI wars, ABM, AI war progress, elimination, war exhaustion, space, debris, victory) |
| Turn time | about 120 to 250 ms per turn in this sandbox at turns 50 to 100 |
| Player actions | 109 reducer action types |
| Units | 7 classes (infantry, cavalry, ranged, siege, naval, air, support), a unit is 1,000 strength = 10,000 men, costs 60 gold + 100 HR + 1 MIL, upkeep 5 gold a turn |
| Movement | routes over region adjacency, 2 march points for foot, 3 cavalry, 1 siege; terrain step cost 1, 2 or 4 |
| Research | 50 techs in 5 linear lines, Civ-style science per turn, a queue, border diffusion |
| Buildings | 9 categories, one tier line each, instant construction, 100 gold + 1 ADM |
| Economy | gold, HR, supplies, copper, iron, oil, rare metals, helium-3; income = dev x control x infrastructure x population factor; loans and bankruptcy for the player only |
| Politics | 5 government types with reform tiers, 26 laws in 6 categories, 3 estates (+ labour in the modern age), identity sliders, stability -3 to +3, legitimacy, prestige |
| Diplomacy | wars with goals and war score, peace terms, truces, trade pacts, alliances, defensive pacts, vassals, AE, rivals, marriages, espionage, intel |
| Colonies | a colony grows over 8 to 15 turns, slots per age 1/2/2/3/3, natives raid |
| AI | only Tier 1 (at war, bordering the player, or top-20 military) thinks each turn; 2% base war roll; standing caps 8 to 30 units by age; AI vs AI wars are abstract |
| Battles | integer 20 Hz sim in a worker; 5 min field, 7.5 min siege; 12 order types; 5 AI difficulty levels; auto-resolve shares the same inputs |
| UI | 4 layouts: desktop (1024 px+), tablet, phone landscape (short side 500 px or less), phone portrait with a rotate overlay; flat SVG map with a three.js close view from 10x, and a globe |
| Content | 40 scripted events, 9 procedural templates, 15 great projects, 7 victory conditions, satellites, missiles, space missions |

The balance-sim baseline (seeds 11 and 12, 120 turns, player France) is in section 0.1 once the
run finishes; the plan is written so that every balance target in Part H is checked against it.

### 0.1 Balance baseline (measured on this branch, full world, player France passive)

| Key | Seed 11 | Seed 12 | Reading |
|---|---|---|---|
| Wars in 120 turns (2000 BCE to 750 CE) | 6 | 8 | about one war every 15 to 20 turns in a 240-nation world |
| Conquests in 120 turns | 5 | 6 | the map is essentially frozen for 2,750 years |
| Largest nation's share of provinces | 0.042 at turn 40, 80 and 120 | same | Russia's 86 regions stay the top from start to end; nobody grows |
| Median nation provinces | 4 | 4 | unchanged all game |
| Unclaimed provinces | 0 | 0 | nothing to settle in the full world |
| Devastated provinces | 0 to 2 | 0 to 2 | wars barely touch land |
| Average unrest | 0.6 to 2.4 | 0.9 to 2.2 | the world is calm to the point of inert |
| Pacts and leagues | 2 members, 2 leagues | 3 members, 3 leagues | the only diplomacy that forms |
| Player gold (does nothing) | 13.6k at turn 40, 42k at turn 120 | 41k | a passive player hoards; no sinks |
| Player units | 0 | 0 | passive policy; nobody attacks France in 120 turns |
| Player techs / median AI techs | 22 / 16 | 22 / 16 | research pace fine, player leads by a third |
| ms per turn | 58 to 83 | 58 to 69 | fast on this sandbox |
| Audit violations, non-finite | 0 | 0 | engine health is good |

Two conclusions for the review. First, **the engine is sound** (no violations, determinism, fast
turns). Second, **the world is dead**: in 2,750 simulated years the map's largest nation never
changes, the median nation never grows, nothing is settled, and a player who clicks nothing
reaches the Age of Kingdoms unbothered with 42,000 gold. That is the strongest argument for the
map rework below: a map with land to settle, cities that grow and fall, and AI nations that
expand and fight for visible reasons.

---

# Part A. Review and critique, system by system

Grades: **A** works and is fun, **B** works but shallow or opaque, **C** exists but barely matters or
is confusing, **D** broken, missing or actively harmful to fun.

## A1. Map and territory: **C**

**What exists.** 2,028 polygons of very different sizes. A nation is the set of regions with the
same owner. Control (0 to 100) per region is both "how much income you get" and "siege HP". There
is no concept of a city: the region card shows population, development, buildings. The close view
draws one synthetic town per region sized by its building count.

**What is wrong.**
1. **Every region is the same kind of thing.** A desert region with 20,000 people and the
   Nile delta are both "a region with 9 building slots". Nothing on the map tells you where the
   people and the wealth are. Civ makes this obvious at a glance: cities, their size, their rings.
2. **Borders are frozen 2024 borders in 2000 BCE.** Every nation starts owning its whole modern
   territory at full control. There is no land to settle in the Bronze Age except in the emergent
   modes, so "expansion" means conquest from turn 1. The settle-a-colony system (4h) only has
   land to work with in the emergent modes.
3. **Polygons fight the phone.** Even after the merge, the smallest regions are tap targets of a
   few pixels; the chooser popup (section 3 of the previous plan) is a patch over a data problem.
4. **Adjacency is a graph, not a space.** There is no distance, no rivers, no chokepoints, no
   "the mountains are between us". Terrain is one label per region guessed from its name.
5. **Control doubles as siege HP and as income multiplier**, so taking a province and taxing it are
   the same number, which makes occupation and integration hard to read.

**Fix direction.** Part B replaces regions with tiles, cities and borders.

## A2. Economy: **B-**

**What exists.** Income per region from three development numbers (tax, production, manpower),
each raised by spending ADM/DIP/MIL (EU4 monarch points), multiplied by control, infrastructure
(+10% a level) and a clamped population factor. Buildings add flat and percentage lines through a
proper modifier sheet. Supplies are foraged per province and made by industry from metal. Loans
and bankruptcy exist for the player; the AI has a parallel `nation.economy` with its own simpler
rules. Taxes have 4 levels with cooldowns and estate reactions.

**What is right.** The modifier sheet (`src/engine/modifiers/`) is good engineering: one place
that explains every number. The supplies model is a real logistics constraint. Bankruptcy has
teeth (desertion).

**What is wrong.**
1. **Three economies.** The player uses `state.resources` and `calcIncome`; the AI uses
   `nation.economy` and `calcAllNationIncomes`; war progress for AI vs AI uses the abstract
   `militaryStrength`. Three truths means three sets of bugs and no fair difficulty.
2. **Development is EU4's weakest idea.** Spending abstract points to click a province from 3 to
   4 is a chore, invisible on the map, and it makes the economy grow by clicking rather than by
   geography. The user already called settling "too easy and boring"; developing is the same
   click.
3. **Nothing is spatial.** A market in a province next to a trade route earns the same as one in
   the mountains. Infrastructure is a number, not roads you can see.
4. **Money has few sinks.** Buildings are instant and cheap (100 gold), upkeep is a flat 5 per
   unit. A mid-game treasury has nothing to do but recruit.
5. **Resources are binary.** A country either "has a deposit" (by modern country id!) or not;
   amounts are flat 20 a turn.

**Fix direction.** Tile yields worked by cities, improvements you can see, roads as tiles,
trade routes between cities, resources as tile features with amounts. One economy for everyone.

## A3. Population and growth: **C+**

**What exists.** Each region carries a real population that grows 0.02% a turn, plus 0.2% per food
building tier, plus infrastructure, minus unrest, capped at 5x the modern baseline. War drains 2%
a turn. Population feeds a clamped factor into income and nothing else.

**What is wrong.**
1. Population is **a display number**. It does not eat, it does not need housing, it does not
   work land, it does not limit recruitment directly (HR does, separately).
2. Growth is **the same everywhere**: a desert grows like a river valley.
3. There is no migration, no cities, no urban vs rural.

**Fix direction.** Population per city, fed by food from worked tiles, housing from buildings and
water, growth that depends on where the city is. Recruitment draws from city population.

## A4. Research and technology: **B+**

**What exists.** Civ-style accumulation, queue, turns-to-complete, diffusion, a choice sheet.
Costs calibrated per age. 50 techs, each gating buildings, units and some modifiers.

**What is wrong.**
1. **Linear lines.** Five parallel chains with no cross-links, so there are no interesting paths,
   only "which line first".
2. **Many techs still do nothing** except unlock the next one (the file header admits it:
   movement, attrition, siege, naval, trade capacity are not wired).
3. **No boosts (Eurekas)** yet, so research has no connection to what you do on the map.
4. Techs do not change **what you can see or do on the map** (roads, rivers crossing, ocean
   travel), which is where Civ's tech feels best.

**Fix direction.** Keep the engine. Rebuild the tree as a web of about 60 techs with
prerequisites across lines, every tech with a visible map effect, and boosts tied to tiles
(own a mine, settle on a coast, win a river battle).

## A5. Government, laws, estates, identity, national power: **B-**

**What exists.** A lot: 5 government types with age reforms, 26 laws, 3 to 4 estates with loyalty,
influence and privileges, crown land, identity sliders, stability with decay, legitimacy,
prestige, civil wars from stability streaks, disasters.

**What is wrong.**
1. **It is a wall of sliders with no map consequence.** Estates have no land on the map; crown
   land is a percentage. The player never sees the nobility's estates or the clergy's temples.
2. **Too many parallel meters** (stability, legitimacy, prestige, unrest per region, war
   exhaustion, AE, estate loyalty x3, identity x3) with overlapping effects. New players cannot
   tell which one is hurting them.
3. **Reforms with "not yet a mechanic" in their description** (Chieftaincy, Tolerance,
   Mercantilism's opinion part).
4. **AI does not use any of it**: AI nations never change government, laws, estates or identity,
   so the systems are player-only flavour.

**Fix direction.** Estates own cities' land on the map (the nobility holds the countryside
tiles of certain cities, the clergy holds the temple tile, the burghers hold the market tiles).
Merge meters: stability and legitimacy become one "authority" with a visible breakdown; prestige
stays. Every reform gets a real effect or is cut. AI picks laws and reforms by doctrine.

## A6. Succession and court: **C**

**What exists.** A ruler with 3 skills and traits, an heir only under a monarchy, reigns of 3 to 25
turns, marriages, royal births at 25% a turn, advisors with a salary that only add +level to a
pool, generals with XP.

**What is wrong.**
1. Everyone starts **Tribal with no heir**, and the Monarchy costs 300 ADM, so for a whole age
   succession looks like nothing (plan 5b already found this).
2. Rulers **do nothing visible**: skills add a couple of points to a pool. In CK3 a ruler's traits
   drive events and AI personalities; here traits are modifiers.
3. Advisors are **a salary for +1**. Plan section 5 (delegation) fixes this and should stay.
4. **No characters anywhere else**: generals are a name and an XP bar, no court, no governors.

**Fix direction.** Families for everyone (plan 5b stays). Rulers and heirs become characters with
opinions used by events and the AI. Governors per city group (a character assigned to a group
of cities, with a skill that changes yields and unrest) replace invisible per-region bonuses.
Advisors become delegations (plan section 5).

## A7. Diplomacy: **B**

**What exists.** Wars with goals, battle and tick war score, occupation score, peace terms
(cede, gold, reparations, humiliate, vassalize), AI peace offers, truces, trade pacts, alliances,
defensive pacts, AE with coalitions against a runaway, vassals with liberty desire and
independence wars, rivals, royal marriages, gifts, insults, espionage, counter-intel, intel that
reveals region details, diplomats you can assign.

**What is right.** This is the most complete layer in the game. War score and peace terms are
EU4-grade. AE and coalitions are a real anti-snowball.

**What is wrong.**
1. **Claims are not on the map.** "Fabricate claim" gives a casus belli on a nation. In Civ and
   EU4 you look at a province and want it. Here the war goal is picked for you.
2. **Hostility is one number per nation** with no reasons shown. Civ shows "you settled near me
   (-10)", which teaches the player the rules.
3. **AI vs AI wars are abstract dice** (`AI_CAPTURE_BASE_CHANCE`), so the world map rarely
   changes and never for a visible reason. Over 150 turns about 10 wars happen (measured in the
   skill's notes). The world is quiet by design, but quiet reads as dead.
4. **Trade is a pact, not a route.** `getTradeRoute` finds a path for validation only; nothing
   flows along it, so blockades mean "pact off".
5. **Nothing between peace and war**: no border friction, no raids, no tribute demands, no
   "stop settling here".

**Fix direction.** Claims on cities and tiles. Opinion with itemised reasons. Trade routes as
visible lines between cities with gold flowing per tile crossed. Real AI vs AI wars fought by
armies on tiles (abstracted only when far from the player's sight). Demands and ultimatums.

## A8. Army: **B-**

**What exists.** Units recruited in a region, stacks, routes over several turns with supply and
attrition, embark and amphibious assault, naval engagement, invasions that damage control (siege
HP) or trigger a battle, garrison defence battles at the start of your turn, generals,
promotions, XP, morale, reinforcement, desertion on bankruptcy, war exhaustion.

**What is wrong.**
1. **Every unit is 1,000 strength of one class.** There is no army composition on the map: a
   stack of 5 infantry and 2 archers is 7 icons. The RTS then deals the stack out as squads.
   Players cannot design an army.
2. **Sieges are "control damage"**, an invisible number that goes down. There is no encirclement,
   no walls on the map, no supply cut, no sally.
3. **Movement is region hops**, so distance is meaningless: crossing Russia and crossing Belgium
   are each "one region" if they are one region.
4. **HR and supplies are national pools**, so an army in Siberia recruits from Lisbon's manpower.
5. **Naval is a separate mini-game** (embark, lanes, engagements) with 1 class and no visible
   ships on the map until the close view.
6. **No zone of control, no fog, no scouting**: you see every region's owner always.

**Fix direction.** Armies as named stacks of units on tiles with movement points, roads, rivers
and ZOC; sieges of cities with walls, encirclement and supply; recruitment from the city's own
population; fog of war with scouts; fleets on sea tiles.

## A9. Settlers, colonies and expansion: **B** (in emergent modes), **D** (in the full world)

**What exists.** The colony project (4h) is good: slots, settlers from the source province,
native policies, raids, upkeep, AI parity. Frontier expeditions in emergent modes. AE and
coalitions brake conquest.

**What is wrong.**
1. In the **default full world there is nothing to settle**: all 2,028 regions are owned from turn
   1 in 2000 BCE, which is historically absurd and removes the best early-game loop in the genre.
2. Colonies are **"an owner flag flips"**, not a new city appearing with a border that grows.
3. There is no **settler unit** moving across the map: settling is a menu action on a neighbour.

**Fix direction.** The world starts mostly unclaimed in 2000 BCE. Settlers are units. A new city
starts as an outpost (the colony progress bar reused) and its border grows from a 1-tile ring.

## A10. Tactical battles (RTS): **B+**

**What exists.** A deterministic integer sim in a worker, replayable, with formations, attack
move, hold, garrisons in keeps and towers, reserves and reinforcements paid with battle supply,
abilities and powers, terrain tiles from `mapgen`, buildings of the province standing on the
field, 5 AI levels, a thumb-zone HUD, parity with auto-resolve, result and report screens.

**What is right.** The architecture (orders only, fixed point, worker, replay) is correct for a
phone RTS. Auto-resolve and manual battles sharing one aftermath contract is the right call.

**What is wrong.**
1. **The battlefield is generic.** `mapgen` is seeded from the region, not from where the battle
   really is: no river you can see on the map, no coast on the side the fleet came from, no
   walls of the real city.
2. **Every battle is "take the keep or hold it"**, even an open field meeting of two armies.
   The audit's "battle objectives" row is still open.
3. **Composition comes from the stack**, so the player cannot bring "a mostly cavalry army".
4. **No pre-battle deployment**: squads appear in a template.
5. **Clock-based**, which is right for phones, but a field battle ending with "time ran out,
   defender holds" when both armies are intact is unsatisfying.
6. Art: stylised procedural figures; the sprite pipeline (art brief v3) is the fix in flight.

**Fix direction.** The battle map is generated from the real tile and its neighbours (terrain,
river edges, coast, roads, the city's walls and districts). Battle types with their own
objectives: field, river crossing, ambush, siege assault, sally, landing. Deployment phase. The
army composition the player built is what fights.

## A11. AI: **C+**

**What exists.** Tiered thinking, doctrine personalities, counter-recruiting, operational
planner for Tier 1 (`aiOperations`: capital defence, reinforcement, reclamation, naval
transport), an AI economy with buildings, research and stability, coalitions.

**What is wrong.**
1. **Only Tier 1 acts**; the other 200 nations are frozen scenery. AI vs AI wars are dice.
2. **AI never uses politics or diplomacy** beyond war and peace: no alliances between AI
   nations, no trade pacts, no vassals, no laws.
3. **AI does not expand** in the full world (nothing to settle) and barely in emergent worlds
   after the colony brake.
4. Difficulty is multipliers on aggression and capture chance, not better play.

**Fix direction.** With cities and tiles the AI gets cheap, local decisions: settle the best
scored tile, work tiles automatically, build what the city lacks, defend the city under
threat. All nations think, on a budget: cities think every turn, armies plan on fronts, the
diplomacy pass runs every 3 turns for everyone. AI vs AI wars move real armies on tiles when
within the player's sight radius, dice elsewhere, with the same expected outcome.

## A12. Events, disasters, great projects, space, victory: **B-**

**What exists.** 40 scripted events, 9 procedural templates, event chains, disasters with
progress bars, 15 great projects with tiers, satellites, missiles and ABM, space missions,
7 victory conditions, achievements and meta progression.

**What is wrong.**
1. Events are **modal interruptions** without map location, so they feel like pop quizzes.
2. Great projects are **a list in a panel**, not wonders on the map.
3. Space and missiles are a **late-game bolt-on** few games reach (Modern is 200 turns away).
4. Victory conditions are checked but the game gives **no mid-game goals** (eras, agendas,
   missions).

**Fix direction.** Events pinned to a city or tile with a map marker. Wonders as tiles. Era
goals (Civ VII legacy paths, EU4 missions) so each age has a target.

## A13. UX and UI: **B-** desktop, **C+** phone

**What exists.** A full-bleed map with a right drawer on desktop; a bottom bar and sheets on
tablet and portrait; a right rail with a docked tab on phone landscape; a province modal of 711
lines; panels for domestic (647 lines), diplomacy (520), military, research, space, legacy,
log; the battle HUD with 44 px targets; onboarding; cloud saves.

**What is wrong.**
1. **The map is not the UI.** Almost every decision happens in a panel. The map shows owners and
   banners; it shows no yields, no cities, no roads, no trade, no threats.
2. **The province modal is a 711-line everything-sheet.** Building, development, buildings,
   colony, defence, population policy, resource sites, all in one scroll.
3. **Panels are organised by engine module** (Domestic, Diplomacy, Military) rather than by
   player intent (what should I do now?). There is no "next action" prompt like Civ's.
4. **Numbers without reasons**: unrest 37, hostility 64, stability -1. Breakdowns exist in the
   modifier sheet but few screens show them.
5. **Phone portrait is a rotate overlay.** That is acceptable for battles, not for checking your
   empire on the bus.
6. **No desktop keyboard flow** (no hotkeys, no unit cycling, no space to end turn).

**Fix direction.** Part E: map-first UI, a city screen as a half sheet, tile cards, a
"next" prompt, lenses (yield, borders, trade, threat), one design for both inputs with
hover on desktop and long press on touch, portrait allowed for the empire view.

## A14. Engine quality, determinism, performance: **A-**

**What exists.** Pure reducer and turn engine, seeded RNG everywhere, state audit invariants,
save migrations (v6), long-run determinism tests, balance-sim and compare scripts, perf hooks.

**What is wrong.** Turn time (120 to 250 ms) is already near the budget with per-region loops,
and three parallel economies triple the surface for bugs. `gameReducer.js` is 2,918 lines.

**Fix direction.** Keep every discipline. Per-turn loops over cities and units, never over
tiles. Split the reducer by domain (the `nationActions` folder already started).

## A15. Scorecard and the three root problems

| System | Grade | Root problem |
|---|---|---|
| Map | C | regions are not places |
| Economy | B- | three economies, click-to-develop, nothing spatial |
| Population | C+ | a display number |
| Research | B+ | linear, many dead techs |
| Politics | B- | sliders without map consequence |
| Succession | C | invisible rulers |
| Diplomacy | B | claims and trade not on the map, dead AI world |
| Army | B- | no composition, invisible sieges, no distance |
| Settlers | B / D | nothing to settle in the full world |
| Battles | B+ | generic battlefield, one objective |
| AI | C+ | 200 frozen nations |
| Events etc. | B- | not on the map, no mid-game goals |
| UX | B- / C+ | the map is not the UI |
| Engine | A- | keep |

The three root problems, which the rest of this plan is built to solve:
1. **The map is not a place.** Regions have no cities, no distance, no features, no borders that
   move for reasons you can see.
2. **Systems are numbers in panels, not things on the map**, so they cannot be read, taught or
   felt.
3. **The world is static**: no land to settle, 200 frozen nations, abstract AI wars.

---

# Part B. The new map: tiles, cities, borders

## B1. Goals

1. One continuous world: the real Earth, any of 240 nations, 2000 BCE to 2300 CE, kept.
2. **Civ-style readability**: cities you can see, borders that grow from cities, tiles with
   terrain, rivers, resources, improvements and roads.
3. **Phone first**: a tile is a tap target of at least 44 px at the default zoom; a city sheet
   fits a 390 px tall landscape screen.
4. **Deterministic and fast**: per-turn cost grows with cities and units, not with tiles.
5. **Every system lands on the map**: economy (yields, improvements, trade lines), politics
   (estate land, governors), war (armies, sieges, ZOC, fog), expansion (settlers, outposts),
   events (pins), wonders (tiles).

## B2. The tile grid

**Options, ranked.**
1. **A geodesic hex grid on the sphere (recommended).** Subdivide an icosahedron so the average
   cell is about **18,000 km²** (hex edge about 80 km). That is about **28,000 cells** worldwide and
   about **8,500 land cells**. Twelve cells are pentagons (unavoidable on a sphere); put them in
   oceans or Antarctica by choosing the icosahedron orientation. Equal-area, no poles problem, the
   globe and the flat map show the same grid, rivers and coasts follow cell edges.
   - Why 18,000 km²: Civ VI's huge map has about 2,800 land tiles for 12 civs; we have 240
     nations at start (most tiny) and 8,500 land tiles gives the median modern country (about
     110,000 km²) about 6 tiles, France about 30, Russia about 950. That is enough for borders
     to grow in rings and for armies to take 3 to 6 turns to cross a mid-size country. In the
     Dawn start a nation holds only its core, so the modern area matters less than the number
     of good city sites inside it. (Checked: 510M km² / 18,000 = 28,300 cells; 149M km² of land
     / 18,000 = 8,300 land cells. An icosahedral grid of frequency 53 has 10 x 53² + 2 = 28,092
     cells, 12 of them pentagons.)
   - Cost: a new geo build script, new rendering, a full save break.
2. **A coarser grid (about 35,000 km², 4,300 land cells).** Faster and fewer things to draw, but
   small countries become 2 to 4 tiles and city borders cannot grow (Belgium is one tile).
3. **Keep the 2,028 polygons as "tiles" and add cities on top.** Cheapest, keeps saves, but keeps
   every problem of A1 (uneven sizes, no distance, polygon taps) and city borders cannot grow
   across polygons.

**Decision proposed: option 1.** The rest of the plan assumes it.

**Tile data (static, built once by `scripts/geo/build-tiles.mjs`, shipped as a binary blob
`src/data/geo/tiles.bin` plus `tiles-meta.json`):**

| Field | Source |
|---|---|
| id (0..N), centre lat/lon, 5 or 6 neighbour ids | the grid |
| terrain: ocean, coast, lake, grassland, plains, desert, tundra, snow, hills, mountains | ETOPO elevation (already planned for the close view) + Köppen climate raster (public domain) |
| features: forest, jungle, marsh, oasis, floodplain, reef, ice | land cover raster (ESA WorldCover or Natural Earth), rivers |
| river edges (which of the 6 edges a river runs along) | Natural Earth rivers, snapped to cell edges |
| elevation class for the close view shading | ETOPO |
| resources: a resource id and an amount class (small, rich) | existing `deposits.js` plus a seeded scatter by terrain (iron on hills, horses on grassland, fish on coast, oil in desert/sea) |
| base yields: food, production, gold (per terrain and feature, section C1) | a table |
| historical owner at 2000 BCE, 800 BCE, 500, 1500, 1900 (for scenario starts) | hand-curated per nation core, see B6 |
| modern country (the 240 ids) | the existing geo |
| name (for the close view and the tile card) | nearest populated place from Natural Earth |

About 8,500 land tiles x roughly 40 bytes is under 400 KB. Ocean tiles store only neighbours and
depth class (coast, shelf, deep).

## B3. Cities

A **city** is the unit of the economy, population, buildings, recruitment and borders.

```js
// state.cities[cityId]
{
  id, name, ownerId, tileId,
  founded: turnNumber,
  population: 12400,          // real people, displayed as "12.4k" and as a size 1-20 badge
  food: { stored, growthTarget },
  housing: 4,                 // cap on size from buildings, water, terrain
  amenities: 1,               // happiness supply; negative = unrest grows
  unrest: 0..100,             // the per-region unrest moves here
  loyalty: 0..100,            // cultural pressure from neighbours (Civ VI loyalty), see C5
  buildings: { categories: {...}, districts: [...] },   // the 9 categories stay; districts are tiles
  tilesOwned: [tileIds],      // the city's border; nation border = union
  workedTiles: [tileIds],     // chosen automatically by the governor (C1); the player can lock tiles
  production: { current: { kind: 'building'|'unit'|'improvement'|'project'|'wonder', id, tileId }, queue: [], progress },
  walls: 0..3, hp, maxHp,      // sieges, D2
  garrison: [unitIds],
  governorId,                 // a character, A6 fix
  isCapital, founderId, culture: { [nationId]: share },
  outpost: { progress, policy, escortUnitId } | null   // colony phase (C7)
}
```

**Size.** City size for display is `floor(log2(population / 2000)) + 1` clamped to 1..20, so a
2k outpost is size 1, 32k is size 5, 1M is size 10, 32M is size 15.

**Founding rules.** A settler founds a city on a land tile that is not within 3 tiles of another
city and not inside another nation's border. The tile becomes the city centre (yields 2 food, 1
production, 1 gold minimum, like Civ). The city owns its centre and the 6 adjacent tiles at once
if free; the rest grows.

**Capital.** The nation's capital city. Losing it still relocates (existing `relocateLostCapital`).

**How many cities.** At 2000 BCE every nation starts with 1 to 4 cities (section B6). Over a game
a mid-size nation reaches 8 to 15, a large one 30 to 60. World total at turn 150 of about 1,200
to 2,000 cities, which is the per-turn loop size (same order as the 2,028 regions today).

## B4. Borders

- **City borders grow with culture.** Each city makes culture a turn (buildings, population,
  wonders, the Temple line). Each tile has a cost `20 + 10 x ring + 5 x tilesOwned` culture; when
  the city's culture bank exceeds the cheapest unowned eligible tile, it claims it. Eligible: free
  (not owned by any city), within ring 3 of the centre (ring 5 with Civic Assemblies), land or
  coast. Score = yields + resource + adjacency to owned tiles + 2 if it closes a gap.
- **Nation border** = union of its cities' tiles. Rendered as one line mesh per nation.
- **Tiles can be bought** for gold (Civ style) at 3 x their culture cost in gold. This is the
  "develop province" click replaced by something you can see.
- **Border conflict.** When two cities want the same tile, the one with more culture pressure
  on it gets it; a tile already owned never flips through culture (only through loyalty
  flipping of whole cities, C5, or war).
- **Unclaimed land** is wilderness: anyone can walk, settle or pillage; native tribes live there
  (the existing `inhabitants` and `resistance` of the emergent world become tile data).

## B4b. How the grid looks (decided 2026-10-02: realistic, never blocky)

The grid is the logic layer only. The map keeps the real Earth look: real coastlines, a shaded
relief base map built from real elevation and climate (hillshade, hypsometric tints, forests,
deserts, ice, bathymetry), used on the flat map and as the globe texture. City and nation
borders are smooth lines along cell boundaries, clipped to the real coast. Units, cities and
improvements stand at cell centres on the real terrain. The hex outline is a faint overlay
that appears when zoomed in, or with the grid lens, like Civ VI's grid toggle or Humankind's
map. Nothing on screen is ever a flat-coloured hexagon field.

## B5. Zoom levels and what the map shows

| Zoom | Shows |
|---|---|
| World (globe, far) | nation fills, nation borders, capitals as stars, nothing else |
| Region (globe near or flat 1x to 3x) | city badges with size, nation borders, city borders dotted, army banners, trade lines (lens), fog |
| Local (flat 3x to 10x) | tiles with terrain colours and feature icons, improvements, roads, rivers, resources, units as figures, city districts as icons |
| Close (flat 10x+) | the existing three.js close view: town models by size, soldiers, walls, fields on improved tiles |

The globe remains the world and region view. The flat map handles local and close. The hand-over
(previous plan 4f) stays.

## B6. The world at 2000 BCE and the scenario starts

The full-world scenario changes meaning: **the modern 240 nations exist as peoples with a
capital, not as modern borders.** Decided 2026-10-02: **every nation starts with exactly one
city**, its capital, on the real capital's tile (or the historically right ancient site where
one is curated: Memphis for Egypt, Babylon for Iraq, Anyang for China), owning the centre and
its first ring. Everything else is wilderness with native tribes scaled by the real historical
population density (the existing `historicalPopulation.js` gives the per-nation curve). This
matches the emergent-world starts already on the features branch (equal, small, connected
starts) and makes the first 30 turns the same for everyone: grow the capital, build a settler,
pick the second site. The later starts (Classical onward) give more cities per nation from a
curated core list; only Dawn is one city.

Scenario starts (one table in `src/data/scenarios.js`):

| Start | Year | Who exists | Land claimed |
|---|---|---|---|
| Dawn (default) | 2000 BCE | all 240 as peoples, **one city each (the capital)** | the capital's first ring only, about 10% of land (measured) |
| Classical | 800 BCE | all 240 | cores plus ring 2, about 30% |
| Kingdoms | 500 | all 240 | about 50% |
| Gunpowder | 1500 | all 240 | about 65% |
| Modern | 1900 | all 240 | modern borders, every tile owned |
| Emergent 15/30/45/60/75 | 2000 BCE | the chosen count | cores only |

The existing emergent world generator (`worldgen/emergentWorld.js`) becomes the only generator:
the full world is the 240-nation case.

**Starting size** comes from `historicalPopulation.js` at the start year: the capital's size is
2 to 5 by the nation's share of the world population at that date (Egypt and China start at
size 5, most nations at 2), plus one warrior unit, and a settler for the five largest
peoples. Nations whose land was unpeopled in 2000 BCE (Iceland, New Zealand, the Pacific
microstates) start as a size-1 outpost with a settler and a "hard start" warning, so any of
the 240 stays pickable.

## B7. What is deleted

`regions.js` and `worldRegions.json` as game state (kept only in the geo build pipeline for
country membership of tiles), `regionCoordinates.js`, `regionMerge.json`, `regionClickAssist`,
`mapRegionStyle`, `RegionChooser`, the region modal, `regionTransfer.js` (becomes
`cityTransfer.js`), development points (`development.js`), control as a stat (replaced by
city loyalty and siege HP), `GAIN_CONTROL`, `DEVELOP_PROVINCE`, `BUILD_INFRASTRUCTURE`
(roads are tile improvements), `SETTLE_COLONIZE` (settlers), `POPULATION_POLICY` (city
focus), the per-region `defenseLevel` (walls), `climateResilience` (a city building), the
`MOVE_ARMY` one-hop (routes are the only move).

---

# Part C. Every macro system on the new map

Each section follows the add-mechanic checklist shape: today, design, state, turn phase, player
actions, AI, UI, tests, balance target.

## C1. Economy: yields, worked tiles, improvements, roads, trade

**Yields.** Four per tile: food, production, gold, science (science comes only from districts and
buildings, never raw terrain; culture is city-level). Base table:

| Terrain | Food | Prod | Gold | Notes |
|---|---|---|---|---|
| Grassland | 2 | 0 | 0 | +1 food with river |
| Plains | 1 | 1 | 0 | |
| Floodplain (feature) | 3 | 0 | 1 | desert river tiles: Egypt, Mesopotamia |
| Hills | 0 | 2 | 0 | +1 food on grassland hills |
| Forest (feature) | +0 | +1 | 0 | can be cleared for a one-time production boost |
| Jungle | +1 | -1 | 0 | |
| Marsh | +1 | -1 | 0 | drainable with Aqueducts |
| Desert | 0 | 0 | 0 | oasis +3 food |
| Tundra | 1 | 0 | 0 | |
| Snow, mountains | 0 | 0 | 0 | mountains impassable without Mountaineering |
| Coast | 1 | 0 | 1 | +1 food with fish |
| Ocean | 1 | 0 | 0 | needs Shipbuilding to work |

A river edge adds +1 gold to the tile. A resource adds its line (wheat +1 food, iron +1 prod,
gold +2 gold, horses +1 prod and a strategic amount, and so on; the full table is a data file).

**Worked tiles.** A city works `min(size, tilesOwned)` tiles. Allocation is **automatic** every
turn by the city focus (balanced, food, production, gold, science), with optional locks. No
citizen micro: this is the single biggest UX choice for a phone, and Civ's own auto-assign is
good enough when the focus is explicit.

**City yields.** `food = sum(worked food) + buildings - 2 x size` (each citizen eats 2 food, as
in Civ; see C2 for why the engine runs on size, not raw people). Production builds the city's
queue. Gold goes to the treasury after building upkeep. Science goes to the research engine
(which already exists and stays).

**Improvements** (on a tile, built by the city as a production item that costs 1 to 3 turns, no
builder units to push around on a phone; the "builder" is implicit):

| Improvement | On | Effect | Tech |
|---|---|---|---|
| Farm | grassland, plains, floodplain | +1 food, +1 more with Crop Rotation | none |
| Pasture | horses, cattle, sheep | +1 food, +1 prod | Animal Husbandry |
| Mine | hills, iron, copper, gold | +1 prod (+1 with Iron Working), extracts the resource | Mining |
| Quarry | stone, marble | +1 prod, +1 culture for wonders | Masonry |
| Lumber camp | forest | +1 prod | Bronze Working |
| Fishing boats | fish, coast | +1 food, +1 gold | Sailing |
| Plantation | spices, sugar, cotton, tea | +2 gold | Irrigation |
| Oil well | oil | extracts oil | Combustion |
| Road | any land | movement x2 along roads, +1 gold if on a trade route | none; Rail Networks make railways |
| Fort | any land | +50% defence, a ZOC tile | Siege Engineering |

Improvements show as icons at local zoom and models at close zoom; a pillaged improvement shows
burning and yields nothing until repaired (1 turn).

**Roads.** Tiles, not a number. Cities auto-build a road to a neighbour city when a trade route
runs between them (Civ VI's trader builds roads). The player can also queue a road segment.
Roads matter for movement (D1), trade (below) and supply (D3).

**Trade routes.** A city with a Market sends one trade route (two with Bazaar, three with Bank)
to another city within 15 tiles by land or 30 by sea (needs a Harbour). The route yields gold
to both ends: `2 + 0.5 x tiles crossed + partner size / 4`, more with Silk Road Trade and Free
Trade. Routes are drawn as lines on the trade lens. A route through a tile with an enemy unit
or a besieged city is **plundered**: the gold goes to the plunderer that turn and the route is
suspended. This replaces trade pacts with something on the map; pacts stay as the diplomatic
permission to route through another nation's land.

**One economy for all.** The AI's `nation.economy` and the player's `state.resources` merge into
`nation.treasury` and per-city yields computed by the same function. `calcIncome` is deleted.
Difficulty changes only AI reserves, planning horizon and reaction speed, as the audit asked.

**Gold sinks.** Buildings cost production (turns), not gold; gold buys tiles, rush-buys
production at 2 gold per hammer, pays unit upkeep that rises with army size (`1 + 0.02 x units`
per unit), building maintenance (1 to 3 a turn per tier), and mercenaries.

**Supplies** stay as the campaign resource: produced per city from food surplus (granary) and
industry, consumed by armies outside friendly borders (D3).

**Strategic resources** (horses, copper, iron, saltpetre, coal, oil, uranium) are counted per
turn from worked and improved tiles; a unit type needs N of its resource to be built and 1 a
turn to be maintained (Civ VI). Shortage halves the unit's combat strength instead of the
current gold penalty.

**Turn phase.** `cities` replaces `income` and `regionUnrestAndPopulation`: for each city, in id
order: allocate tiles, compute yields, grow or starve, advance production, advance border, update
loyalty and amenities, pay upkeep. One loop, one place.

**Tests.** Yield tables per tile; auto-allocation picks the focus's best tiles deterministically;
a starving city shrinks; improvements only on legal tiles; plunder suspends a route; one economy
gives identical results for a player and an AI with identical cities.

**Balance target.** A 5-city nation at turn 50 earns about what France earns today at turn 50
(from the baseline in 0.1), so existing unit and building prices keep their meaning.

## C2. Population, growth, housing, amenities

**The engine runs on `size` (citizens, 1 to 30); real people are derived.** v1 tried to run
growth on raw population and the food math did not add up (a 32,000-person city on five
2-food tiles). Civ's citizen model is readable and balanced, so: `size` is the true variable
(worked tiles = size, food eaten = 2 x size, growth threshold in food), and `population` for
display, score and history is `sizeToPeople(size, age, buildings) = 1,000 x 1.6^(size-1) x
ageScale`, with ageScale from `historicalPopulation.js` so a size-8 city reads as 30k people in
the Bronze Age and 1.5M in the Modern Age. A3's complaint (population is a display number)
is answered differently: the display number now follows something that is simulated (size)
instead of floating free.

- Growth: stored food accumulates the surplus; the threshold for the next citizen is
  `15 + 6 x size + size^1.8` food. At the housing cap growth is a quarter; two over it stops.
  Negative stored food loses a citizen (starvation) and resets the bank.
- **Housing**: 2 from the centre, +1 river or coast, +1 per Food tier, +2 Aqueduct, +4 Sewers,
  +1 per farm after Feudal Charters, +N from Housing buildings in the modern age. Expressed in
  size steps, which keeps it readable ("Housing 6 / size 5").
- **Amenities**: each city needs `size / 2` amenities; luxury resources (one per distinct
  resource, shared across up to 4 cities), entertainment buildings, wonders and the Religion
  line supply them. Shortfall adds unrest; surplus lifts growth and loyalty.
- **Unrest** per city (the existing region unrest moves here, with the same thresholds for
  rebels). Rebel units spawn on tiles around the city, siege it, and a city that falls to rebels
  becomes a free city (C5).
- **Migration**: a city at its housing cap with a full food bank sends that citizen to the
  nearest friendly city under cap within 10 tiles instead of wasting it, which is how big
  empires fill their new cities without a click.
- **Manpower** replaces HR as an accumulating stock: a regenerating pool `manpower = sum over
  cities of (size - 1) x 100 x conscription law` per turn up to a cap of 10 turns' worth.
  Recruiting a unit costs production in the city plus manpower; a settler costs 1 citizen
  of its city (never below size 2). HR as a traded resource, the hr income lines and the
  `national.hrMult` sources map onto manpower one to one.

**Tests.** Growth curve against housing; starvation; migration conserves people; recruitment
takes people; amenity shortfall raises unrest and nothing else.

## C3. Research

Engine stays. Changes:
1. The tree becomes a **web of about 60 techs**: prerequisites cross lines (Siege Engineering
   needs Iron Weapons and Masonry). Data only, in `techTree.js`, drawn as a graph in the research
   sheet (nodes in columns per age).
2. **Every tech has at least one map effect**: unlocks an improvement, a unit, a building, a
   district, a movement rule (rivers, mountains, ocean), a border ring, a trade range, or a
   combat rule. The ones that today "do nothing yet" are rewired or cut. The audit table of
   "Technology changes capabilities" is satisfied by construction.
3. **Boosts** (40% of the cost) from tile facts: Mining when you own a hill mine, Sailing when a
   city is coastal, Iron Weapons when you own iron, Siege Engineering after a siege, Feudal
   Levies with 6 cities, Banking Houses with 3 trade routes, Combustion with an oil well,
   Flight after a Modern war. Checked in the cities phase and in battle aftermath.
4. Science comes from districts (Library tile) and buildings, plus 1 per 10k population, so
   bigger empires research faster but the size factor (+0.5% per city over 10) keeps a brake.

## C4. Government, laws, estates, identity, authority

1. **Merge stability and legitimacy into Authority (0 to 100)** with a breakdown card: ruler
   skill, legitimacy of succession, laws, estate loyalty, war exhaustion, overextension (cities
   over the governing capacity), capital occupied. Under 25: no new laws, estates demand; under
   10: civil war check. Prestige stays as a separate, slowly decaying score. Every modifier
   source that writes stability or legitimacy today writes authority. (`nationalPower.js`.)
2. **Estates own land on the map**: when a privilege "grant land" is given, the nobility holds
   named countryside tiles (shown with a small crest in the politics lens) whose gold goes to
   them in exchange for levies; the clergy holds temple districts; the burghers hold trade
   routes. Crown land = tiles the state works directly. Seize Land takes tiles back with a
   loyalty cost. This makes the EU4 estate game visible and gives "crown land %" a meaning.
3. **Governors**: a character per city group (a capital region of up to 6 cities within 6
   tiles). Skills: +1 food per city, +10% production, +2 loyalty, -10% unrest, +1 culture.
   Assigning takes 2 turns. Unassigned groups suffer -5 loyalty. The ruler's court supplies
   governor candidates (A6 fix), so rulers and heirs become people you use.
4. **Laws and reforms**: every entry with "not yet a mechanic" gets a real effect on the new
   systems or is removed. Chieftaincy: pillaging wilderness tiles and plundering routes gives
   double gold. Tolerance: no loyalty penalty for foreign-culture cities. Mercantilism: +2 gold
   per internal trade route, -1 opinion with partners. The 6 categories stay.
5. **AI uses them**: a doctrine table picks a government type at the first age change, a law
   when the prerequisite tech lands, and a reform at each age, every 3 turns in the diplomacy
   pass.

## C5. Loyalty and culture (new)

Each city has a culture share per nation (`culture: { fr: 0.8, de: 0.2 }`). Each turn:
pressure from the city's own nation's nearby cities (within 9 tiles, weighted by size and
distance) and from foreign nearby cities. Loyalty moves toward the share of the owner's
culture, +amenities, +governor, +garrison, -recently conquered (-20 for 20 turns),
-occupied capital. **At loyalty 0 the city flips**: to the nation with the most pressure if it
borders it, or becomes a free city (rebels), which can be retaken or will ask to join a
neighbour. This replaces control as "how integrated is this land" and gives conquest a real
cost at distance (Civ VI's best anti-snowball). AE stays as the diplomatic cost.

## C6. Diplomacy on the map

1. **Claims on cities.** A claim is on a city (and its tiles). Fabricate Claim targets a city
   within 5 tiles of your border, costs DIP and takes 5 turns, visible to the target (opinion
   -10). Cores: a city you held for 50 turns, or that has your culture majority, is a core;
   wars for cores have no AE.
2. **War goals are cities**: conquer city X, liberate city Y for an ally, humiliate, subjugate.
   War score adds occupied cities weighted by size, battles won, and plundered routes.
3. **Opinion with itemised reasons** replaces the single hostility number (-100 to +100).
   Reasons are a list with their own decay; the panel shows the list; the AI uses the same
   list to decide. The table is data (`src/data/opinion.js`):

   | Reason | Value | Decay |
   |---|---|---|
   | Shared border tiles over 5 | -1 each, max -20 | none while true |
   | You settled within 4 tiles of my city | -15 per city | -1 a turn |
   | You hold a city with my culture majority | -10 per city | none while true |
   | You have a claim on my city | -10 per claim | none while true |
   | Trade route between us | +5 per route, max +15 | none while true |
   | Open borders, alliance, defensive pact | +10, +25, +15 | none while true |
   | Royal marriage | +15 | none while true |
   | Gift | +10 to +25 by size | -1 a turn |
   | Same identity lean (all three axes) | +5 per axis | none while true |
   | You declared war on my ally or vassal | -40 | -1 a turn |
   | You broke a truce | -50 | -1 a turn, and a floor of -20 for 50 turns |
   | Aggressive expansion (AE) | -1 per AE point above 20 | with AE |
   | You razed a city | -30 to every nation within 10 tiles | -1 a turn |
   | Rival | -30 | none while true |
   | Liberated a city for me | +40 | -1 a turn |
   | Insult | -30 | -1 a turn |

   The AI's war roll multiplies by `max(0, (20 - opinion) / 60)`, so a friend never gets a
   surprise war and an enemy at -60 is at the full roll. Alliance offers need +40, trade +10,
   open borders +20. These replace `hostility`, `hostilityFloor` and `ALLIANCE_HOSTILITY_CEILING`.
4. **Trade routes need access**: open borders (a pact) to route through, else the route is
   blocked at the border. Embargo as an action.
5. **Demands and ultimatums**: demand tribute, demand a city with a claim, demand to stop
   settling near me; the AI accepts by relative strength and opinion; refusal gives a casus
   belli.
6. **AI vs AI wars are real within sight** (D6): armies move on tiles and besiege cities. Out of
   sight the same expected outcome is resolved by dice per city per turn, with the dice
   calibrated against the real sim so the world changes at the same rate either way.
7. Vassals keep their cities; annexation absorbs cities one at a time (DIP per city size).
8. Everything else (truces, pacts, alliances, defensive leagues, marriages, espionage, intel,
   rivals) is kept as is, retargeted to cities where it names a region.

## C7. Settlers, outposts, expansion

1. **Settler unit**: built in a city for 60 production (rising 10 per city owned), takes 2,000
   people (never below size 2), moves 2 tiles a turn, no combat, captured if caught.
2. **Found city** on a legal tile. The city starts as an **outpost** with the colony progress
   bar (the 4h mechanics reused: policy toward natives, raids, escort, upkeep, abandon). At 100
   it is a city of size 1 with its ring. Progress speed by terrain and native resistance as
   today. Slots per age as today cap how many outposts you run at once.
3. **Native tribes** live on wilderness tiles as camps (a tile feature with a strength); they
   raid outposts and pillage improvements within 3 tiles; you can trade with them (gift for
   peace), convert them (religion line), or clear them (a battle; the tactical sim gets a
   "tribal camp" setup). Clearing a camp gives a boost and -opinion with Tolerance nations.
4. **Loyalty** (C5) stops forward settling deep in a foreign culture zone: a new outpost far
   from your cities bleeds loyalty unless garrisoned and governed.
5. **AI** scores settle targets: yields in rings 1 to 2, resources, river, coast, distance to
   capital, loyalty pressure, native strength. All nations settle, within their slot cap, so the
   world fills in over the ages at a historically plausible pace (target: about 50% of land
   claimed by 500 CE, 80% by 1800).

## C8. Succession and characters

Plan 5b (families for everyone) stays. Additions on the new map: governors come from the
court; an adult heir can govern; generals are characters with the same skill model; a ruler's
traits bias the AI (a warlike ruler raises the war roll, a builder ruler raises the building
budget). Events reference characters by name and pin to the capital.

## C9. Events, disasters, wonders, era goals

1. **Every event pins to a city or tile** and the modal becomes a side sheet with a map marker;
   choices that affect a place show it. Procedural templates pick a city by its facts (a
   flooding river city, a starving city, a border city with a foreign majority).
2. **Wonders are tiles**: a great project takes a tile in the city's border (shown as a model at
   close zoom, an icon at local zoom) and finishes over turns of production, not gold. The 15
   existing projects map to tiles with terrain requirements (Pyramids on desert, Lighthouse on
   coast).
3. **Era goals**: each age has 3 goals per playstyle (expand: 6 cities; wealth: 3 routes; war:
   a capital taken; culture: 2 wonders; science: 6 techs). Hitting 2 of 3 gives a legacy bonus
   for the next age (Civ VII's idea, EU4 missions' feel). Shown as a small progress strip, no
   popup.
4. Disasters (famine, plague, flood, fire) pick cities by their tile facts and leave visible
   marks (a burnt district for 5 turns).

## C10. Victory

Unchanged conditions, retargeted: domination counts capitals held; conqueror counts cities;
economic counts gold and routes; score counts population, wonders, techs. The era goals give
the mid-game shape the audit asked for.

---

# Part D. Armies, movement, sieges and the RTS battles on tiles

## D1. Armies and movement

- A **unit** keeps its class and strength but gains a **size** (1 to 3 squads worth; strength
  1,000 per squad) and an **army** grouping: `state.armies[armyId] = { ownerId, tileId, unitIds,
  generalId, name, movePoints, route, supply }`. Units are always in an army; a lone unit is an
  army of one. The map draws armies, not units.
- **Movement points per turn**: foot 2, cavalry 4, siege 1, settler 2, scout 5, modern
  mechanised 4. Tile costs: open 1, hills and forest 2, mountains impassable until
  Mountaineering (then 3), desert 2, river crossing +1 (0 with a bridge, Stone Bridges tech),
  road: every road tile costs 0.5, railway 0.25. Embark at a coast tile of a city with a Harbour
  or any coast after Navigation. An army moves at its slowest unit.
- **Routes** stay (A* on tiles with those costs), drawn with a number per turn, as designed in
  4g, now with real distance.
- **Zone of control**: an enemy army or fort in an adjacent tile stops movement after entering
  that tile (Civ). This is what makes lines, chokepoints and flanks exist on the map.
- **Fog of war**: tiles you see this turn (own tiles plus 2, armies plus 2, scouts plus 3,
  hills plus 1, allies' sight shared), tiles you have seen (greyed, last-known owner), unknown
  (dark). Intel (espionage) reveals a nation's cities and armies for 10 turns as today. The
  globe at world zoom shows known nations only.
- **Stacking**: an army holds at most `combatWidth(terrain) x 2` squads worth (4 to 12 units);
  bigger stacks suffer supply (D3). Two friendly armies can share a tile; they merge or split
  with one tap.
- **Naval**: fleets are armies on sea tiles with ship units (the naval class splits into
  galley/warship/transport/carrier lines per age, data only); they carry `capacity` land units.
  Coastal tiles with a Harbour are ports. A fleet adjacent to a coast tile lands its army there
  (an amphibious battle if defended). Fleets blockade a city by sitting on its coast tiles (no
  sea trade, siege supply cut).

## D2. Sieges

- A city has **walls** (0 to 3: none, palisade, stone, star fort, by the Defense line) and
  **HP** `200 x (1 + walls) x (1 + size / 10)`. An enemy army on an adjacent tile **besieges**
  it: the city's tiles beyond ring 1 stop yielding, routes are plundered, HP drops each turn by
  the army's siege strength (siege units 20 each, others 3, +50% with Siege Engineering) minus
  the walls' regen (5 x walls if not encircled). **Encircled** (every land neighbour occupied or
  sea blockaded) doubles the damage and starves the city (-5% population a turn).
- **Assault**: at any time the attacker may assault: a tactical battle of type **siege** with
  the real walls at their current HP. Winning takes the city. Losing costs the units and
  resets nothing.
- **Fall by siege**: at HP 0 the garrison surrenders without a battle unless the defender
  chooses to fight (a **last stand** battle with no walls).
- **Sally**: the defender's garrison may attack the besiegers (battle type sally, defender is
  the attacker with the city at its back).
- **Relief**: an army arriving next to the besieger fights a field battle with the besieger;
  the garrison may join as reinforcements.
- **Taking a city**: ownership flips, loyalty set to 10, a 20-turn "recently conquered" malus,
  walls -1, population -10%, improvements in ring 1 pillaged, AE by city size, war score +size.
  Option to raze (only size 1 to 3 cities, big opinion cost) or liberate to a former owner.
- Capitals cannot be razed. The capital's fall doubles the authority hit.

## D3. Supply

Each army has a supply meter 0 to 100. Inside friendly borders or within 3 tiles of a friendly
city on a road: +20 a turn to 100. In wilderness: -10 a turn. In enemy land: -20, -10 if a
supply line of your tiles or roads reaches it within 6 tiles, 0 if it sits next to a captured
city with a Harbour or a road home. At 0 supply: -5% strength a turn and -10 morale. Siege armies
need supply or they melt, which makes deep sieges a plan and not a click. The national
supplies resource pays for the +20 abroad (1 per 2 squads) as today; without supplies the
meter only falls.

## D4. Recruitment and army composition

- Units are **built in a city's production queue** (production cost by class and age, taking
  population). A unit appears on the city tile. Mercenaries can be hired instantly for gold in a
  city with a Market (2x upkeep).
- **Army templates**: the player defines a composition ("Legion: 4 infantry, 2 archers, 1
  cavalry, 1 siege") and the city builds the missing pieces into the named army. This is the
  one piece of design to make the RTS armies the player's own.
- **Generals** attach to an army. Promotions and XP stay.

## D5. Battles from tiles

- **Battle types**, decided by the situation on the map, each with its own objective and
  battlefield layout:

| Type | When | Battlefield | Attacker wins by | Defender wins by |
|---|---|---|---|---|
| Field | armies meet on an open tile | the tile's terrain, neighbours on the edges | rout or destroy 60% | the same, or hold to the clock with more strength left |
| River crossing | the attacker crosses a river edge | the river across the field with 1 to 3 fords or a bridge | hold the far bank with 40% strength | hold the bank |
| Ambush | defender in forest/jungle/hills with no road and sight advantage | dense cover, attacker enters in column | survive and rout | 30% losses on the attacker in 2 minutes |
| Siege assault | assault on a city | the real city: walls at current HP, towers, districts as buildings, the keep | hold the keep 30 s | hold to the clock |
| Sally | garrison attacks besiegers | the camp and siege engines outside the walls | destroy 2 siege engines or the camp | hold |
| Landing | a fleet lands on a defended coast | beach, the fleet's ships bombarding, defender inland | hold a beachhead 60 s | push them back |
| Tribal camp | clearing natives | huts and a palisade | burn the camp | 3 minutes |

- **The battlefield is generated from the tile**: terrain of the tile and the 6 neighbours
  (each neighbour's terrain fills its edge sector), rivers on the right edges, coast on the
  fleet's side, roads as a corridor, the city's walls level and districts, improvements as
  farms, mines and lumber camps that can be burnt for supply. `mapgen.js` takes a
  `tileContext` instead of a region id. Seeded by tile id and turn, so replay works.
- **Deployment**: 30 s (or Start) in which the player drags squads within the deployment zone;
  the AI uses a template by battle type.
- **Composition**: the army's units become squads 1:1 (a size-3 unit is 3 squads), with
  reserves from the army's reserve units and reinforcements from friendly armies on adjacent
  tiles (the existing reinforcement sources, now by tile).
- **Aftermath on the map**: tile devastation (the existing aftermath) becomes pillaged
  improvements and a battle marker for 5 turns; routed armies retreat 1 to 2 tiles along their
  route; captured siege engines; a river battle lost leaves the attacker on the near bank.
- Auto-resolve keeps parity through the same `buildBattleSetup` inputs; the parity harness in
  the battle-lab skill adds the new types.

## D5b. Naval, air and the modern age on tiles

**Naval.** The single naval class becomes four lines (data only in `unitClasses.js`):

| Line | Ages | Role | Carries |
|---|---|---|---|
| Galley, Cog, Frigate, Ironclad, Destroyer | all | fights fleets, blockades, bombards a coastal city (siege damage 10 a turn) | 1 unit (galley) to 2 |
| Transport (Longship, Carrack, Galleon, Steamer, Landing ship) | from Classical | carries 3 to 6 units, weak | 3 to 6 |
| Raider (Bireme, Corsair, Privateer, Submarine) | from Classical | plunders sea trade routes, invisible outside 2 tiles | 0 |
| Carrier | Modern | holds 2 air units | 2 air |

Sea tiles have three depth classes: coast (anyone), shelf (needs Navigation), deep ocean (needs
Astrolabe or Ocean Shipbuilding). A fleet's sight is 2 tiles, 3 for raiders and carriers. Naval
battles use the tactical sim on an open-water field with ships as "squads" (a later slice; auto
resolve first). A blockade is a warship adjacent to a city's coast tiles with no enemy warship
present: the city's sea routes stop and its siege regen is lost.

**Air (Modern).** Air units live in a city with an Airfield or on a carrier and have a range of
8 tiles (12 with Jet Engines). Orders: strike an army or city tile in range (joins the next
battle there as the air squads of the existing sim), patrol (intercepts enemy strikes within 4
tiles), rebase. Support units with the Anti-Air flag on a tile shoot down 20% of strikes per
unit. No air units on the map as movers; they are range circles from their base, which keeps
them simple on a phone.

**Missiles, ABM, satellites, space.** Unchanged as nation-level stockpiles; a missile strike
targets a city (walls and population damage, a burnt district) or an army tile. Satellites keep
their modifiers. Space missions and the Fusion Grid are unchanged.

**Modern movement.** Railways (Rail Networks) cost 0.25 per tile along a line; motorised and
mechanised classes have 4 and 5 move points; rivers and mountains cost nothing with Combustion
and Highway Systems. Combat width per terrain grows by age (the existing `combatWidth.js`
gets an age column) so modern battles are bigger.

## D6. AI armies and fronts

`aiOperations` grows into a front planner on tiles: for each AI nation at war, a front per
enemy border; goals in order: defend threatened cities (threat = enemy army strength within 4
tiles), relieve sieges, take the war-goal city, raid routes. Armies plan A* routes with ZOC;
sieges when strong enough (strength ratio 1.5 against the garrison and walls); assault when
HP under 30% or when a relief army approaches. Within the player's sight all of this is real.
Out of sight (no player tile or army within 8 tiles) a nation pair resolves the war with one
roll per turn per contested city using the same strength ratio, which keeps the 240-nation turn
under budget. The tier system stays for the thinking frequency (every turn, 3, 10) but every
nation gets the city auto-governor every turn, so the world grows everywhere.

---

# Part E. UX and UI for phones and desktop

## E1. One design, two inputs

| Interaction | Touch (phone, tablet) | Desktop |
|---|---|---|
| Select a tile or city | tap | click |
| Peek (tooltip) | long press 250 ms | hover |
| Move an army | tap army, tap destination (path preview), tap again to confirm; or drag after 250 ms | click, right click destination, or drag |
| Pan and zoom | one finger pan, pinch | drag, wheel, +/- keys |
| Lenses | lens button, bottom left | the same, keys 1 to 6 |
| End turn | the big button bottom right; a "next" prompt before it | Enter or Space |
| Cycle units with moves | the "next" prompt | Tab |
| Sheets | half sheet from the bottom (portrait) or right dock (landscape, desktop) | right dock |

Minimum touch target 44 px; tiles at default region zoom are at least 48 px across on a 390 px
tall phone, which fixes the zoom scale: at 844 x 390 the default shows about 17 x 8 tiles.

## E2. Layouts

- **Phone landscape (primary for play)**: the existing shell (36 px top bar, right rail, right
  dock up to 380 px) stays. The dock holds sheets: city, tile, army, nation, research.
- **Phone portrait (allowed for the empire view)**: the map on top, a half sheet below (city,
  tile, army). Battles still ask to rotate. The rotate overlay becomes a soft hint.
- **Tablet**: landscape shell with a wider dock (420 px) and two sheets stacked.
- **Desktop**: map full bleed, a left city list rail (collapsible), the right dock 400 px,
  the top bar with yields per turn (gold +12, science +8, culture +5, supplies 40), hotkeys.

## E3. The "next" prompt (Civ's end-turn blocker, made optional)

A single pill above End Turn that cycles through: a city with an empty queue, an army with
moves and no route, research done, a settler idle, a peace offer, a city in unrest, an event.
Tapping it opens the sheet. End Turn is never blocked (a toggle "warn me" in settings).

## E4. Sheets (replacing the 711-line province modal and the engine-named panels)

- **City sheet**: header (name, size, growth in N turns, housing, amenities, loyalty with a
  reason list), tabs: Build (queue with turns, grouped by units, buildings, improvements,
  wonders; "buy" with gold), Tiles (the ring map with yields, locks, buy tile), Buildings,
  Politics (governor, estates holding, unrest reasons). Every number opens a breakdown.
- **Tile sheet**: terrain, features, yields, resource, improvement with build or pillage, owner
  city, river, road, units on it.
- **Army sheet**: units with strength and morale, general, supply with a reason, move points,
  route with ETA, actions: merge, split, template, fortify, pillage, siege, assault, embark.
- **Nation sheet** (tap a border or a capital): opinion list with reasons, relations, actions
  (the whole diplomacy panel).
- **Empire sheet** (the rail): overview (authority breakdown, era goals strip, treasury with
  income and upkeep lines), government and laws, estates, court, research, log. The Domestic
  and Diplomacy panels dissolve into the city, nation and empire sheets.
- **Research sheet**: the web graph in columns by age, the current tech with turns, boosts
  shown with their trigger and whether it is done.

## E5. Lenses

Political (default), Yields (numbers on tiles), Borders and loyalty (city loyalty colours,
pressure arrows), Trade (routes and plunder risk), Threat (enemy armies, sieges, ZOC tiles),
Supply (army supply and supply lines), Religion/culture (later). One button, a strip of icons.

## E6. On-map affordances

City badges show size and a growth arc, a wall icon when fortified, a siege icon with HP when
besieged, a red exclamation when starving or in unrest. Army banners show strength as a bar,
morale colour, a general's star. Settlers show a tent. Outposts show a progress ring. Routes
show numbered turn dots. Trade routes animate dashes at the trade lens. Fog is a desaturated
hatch, unknown is dark.

## E7. Battle UI changes

Deployment phase with drag; the objective banner per battle type ("Hold the ford for 2:00");
a mini map of the field; the existing HUD otherwise. Portrait battles are not supported.

## E8. Wireframes

Phone landscape, 844 x 390, the city sheet docked right (380 px), the map live on the left:

```
+------------------------------------------------------------------------------------+
| 1250 BCE  Gold 342 (+12)  Sci +8  Cul +5  Sup 40   [Memphis: 3 turns]  [Next: army] |
+----------------------------------------------------------+---------------+---------+
|   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .            | THEBES  size 5 | [Emp]   |
|  .  . ~  ~  .  .  . [F] [F] . ▲  ▲  .  .  .  .           | grows in 4   | [Mil]   |
|   . ~ ~  . (Memphis 3) [M] . ▲  .  .  . ⚔ .  .           | housing 6/5  | [Dip]   |
|  .  ~  .  .  .  .  .  . [F] .  .  .  .  .  .             | loyalty 92 ▾ | [Res]   |
|   .  .  .  . (Thebes 5) .  .  .  .  .  . (Ur 4) .        |--------------| [Log]   |
|  .  .  .  . [F] [F] . [Q] .  .  .  .  .  .  .            | Build  Tiles |         |
|   .  . ▲  ▲  .  .  .  .  .  .  .  .  .  .  .             | Bldgs  Pol.  |         |
|  [lens ◉]                                   [End turn ▶] | > Granary  3t|         |
|                                             [fast ▶▶]    |   Archer   2t|         |
|                                                          |   Farm (N) 1t|         |
|                                                          |   Walls    6t|         |
|                                                          | [+ queue] [buy 90g]    |
+----------------------------------------------------------+---------------+---------+
```
(F farm, M mine, Q quarry, ▲ hills, ~ river, ⚔ enemy army.) Tapping Thebes's badge opened the
sheet; the tabs are 44 px; the queue rows are 44 px with turns on the right. The rail on the
far right is the existing one.

Desktop, 1440 x 900: the same sheet in a 400 px right dock, a collapsible city list on the left
(name, size, growth, production item, turns), yields in the top bar, the next prompt and End
Turn bottom right, hotkeys shown on hover.

Phone portrait, 390 x 844, the empire view: map on the top 55%, a half sheet below with the
same tabs, draggable to full height; End Turn is a 56 px bar at the very bottom.

## E9. Onboarding

A 10-turn guided Dawn start as Egypt: settle the second city, work a floodplain, build a
granary, research Mining, meet a neighbour, fight one river battle. Each step is a "next"
prompt, no modal lectures.

---

# Part F. Data, migration, performance, determinism

- **Geo build** (built, workstream 1): `scripts/geo/build-tiles.mjs` produces the grid, terrain,
  relief, features, rivers, country ids, names and the 240 capitals. Inputs actually used (see
  `CREDITS.md`): Natural Earth land, lakes, rivers, glaciers, named physical regions and
  populated places; Köppen climate at 0.5° (`koppen-climate-lookup`); Mapzen/Tilezen terrain
  tiles at zoom 4 for relief (mean, max and roughness per cell). Terrain is a base (grassland,
  plains, desert, tundra, snow, coast, ocean, lake) plus a relief (flat, hills, mountains) plus
  a feature (forest, jungle, marsh, oasis, floodplain, ice), which is how the yield table in C1
  composes. Resources are not placed yet (workstream 3 scatters them by terrain). The build is
  deterministic (checked: identical bytes twice) and tested (28,092 cells, 29.5% land, 11 of 12
  pentagons off land, every nation a capital on its own land, Nile and Danube present, famous
  places classified). `/?tileViewer` shows it.
- **State**: `state.tiles` holds only dynamic tile data as sparse maps: `owner` (cityId),
  `improvement`, `pillaged`, `road`, `seenBy`, `nativeCamp`. Static tile data lives outside
  state in a typed array module, never serialised. A save is cities + armies + nations + the
  sparse tile maps: about the same size as today.
- **Saves**: old region saves **cannot be migrated** to tiles with any honesty. The save version
  bumps to 7 and old saves open a "this save is from the region map" screen with an export
  option. The emergent-world scenario record (versioned) carries the grid version.
- **Turn cost**: loops over cities (about 2,000 at most) and armies (hundreds); border growth
  looks at ring tiles only; loyalty pressure uses a per-city neighbour list cached per 10
  turns; AI pathfinding on a 28k-cell grid with A* and a cap of 400 nodes per route per turn,
  budgeted per nation. Target: under 150 ms a turn at turn 100 on the sandbox, measured by
  `compare.sh` against the branch before the rework. Rendering: one instanced hex mesh for the
  globe and one for the flat map, per-tile colour in a texture updated when ownership changes.
- **Multiplayer** (`src/services/multiplayer.js`: hot-seat-by-turn with submitted turns) keeps
  working because the reducer stays pure and the turn stays deterministic; the only change is
  that the initial state carries the grid version and the scenario record.
- **Determinism**: all loops in id order, all randomness from `state.rngSeed`, tile ids stable
  across builds (the grid version is in the save), the 150-turn determinism test and the audit
  keep running; the audit gains city invariants (every city has an owner and a tile, every
  tile owner is a live city, borders are contiguous or coastal, armies on land tiles, no two
  cities within 3 tiles).

---

# Part G. AI summary

| Layer | Runs | Decides |
|---|---|---|
| City governor | every city, every turn | tile allocation by focus, build queue by what the city lacks (food, housing, amenities, production, walls when threatened), improvements on the best unimproved tile, buy a tile when rich |
| Settler planner | every nation, every 3 turns | where to send the next settler, within the slot cap |
| Economy | every nation, every 3 turns | taxes, maintenance, loans, mercenaries, trade route targets |
| Politics | every nation at age change and every 10 turns | government, laws, reforms, estate actions, governors |
| Diplomacy | Tier 1 every turn, others every 3 | opinion-driven: pacts, alliances, claims, demands, war, peace |
| Fronts | nations at war, every turn | D6 |
| Tactical | in battle | the existing tactical AI with per-type templates |

Difficulty: AI reserves, how far it plans, how fast it reacts, and the dice calibration out of
sight. No yield bonuses above Prince; above it, small yield bonuses as in Civ, shown openly.

**Turn budget (target 150 ms at turn 100 on the sandbox, measured per phase with `PERF_CHECKS`):**

| Phase | Loop size | Budget | How it stays inside |
|---|---|---|---|
| Cities (yields, growth, queue, borders, loyalty, governor) | up to 2,000 cities | 50 ms | pure per-city arithmetic over at most 19 tiles each; neighbour lists cached; no allocation per tile |
| Armies and supply | hundreds of armies | 10 ms | routes precomputed when ordered; one step per turn |
| Sieges and in-sight AI battles | tens | 10 ms | auto-resolve shares the existing `resolveBattle` |
| Fronts (AI at war) | 10 to 40 nations | 30 ms | A* capped at 400 nodes per route, 3 routes per nation per turn, paths cached until blocked |
| Settler and economy planners | 80 nations per turn (every 3 turns each) | 15 ms | candidate tiles limited to ring 6 around owned cities |
| Diplomacy and politics | Tier 1 every turn, 80 others | 15 ms | opinion reasons updated incrementally (events push, decay is a scalar per pair) |
| Out-of-sight war dice | pairs at war | 5 ms | one roll per contested city |
| Research, succession, events, victory, audit | nations | 15 ms | unchanged |

If a phase exceeds its budget on the sandbox the fix is in that phase, never a global cap on
how many nations think.

---

# Part H. Balance targets and how they are checked

Every target is a number the balance-sim prints (new keys added to the skill):

| Target | Value at Normal speed | Why |
|---|---|---|
| Land claimed | 10% at start (measured), 50% by 500 CE, 80% by 1800, 100% by 1950 | historical plausibility, room to settle |
| Cities per nation | median 6 at turn 100, 12 at turn 200; largest under 60 | readable empires, no runaway |
| Max land share of one nation | under 0.25 at turn 150 | anti-snowball (today's red flag is 0.33) |
| Wars | 20 to 40 active worldwide per 150 turns, each 5 to 20 turns | a living world without chaos |
| Cities changing hands | 1 to 3% of cities per 10 turns | visible history |
| City loyalty flips | 0.5 to 1% per 10 turns, mostly from conquest | distance costs |
| Player income | a 5-city player at turn 50 earns within 20% of today's France | prices keep meaning |
| Research pace | 7 of 10 age techs on time (already calibrated) | keep |
| Turn time | under 150 ms at turn 100 | phones |
| Audit violations, nonFinite | 0 | always |
| Battle parity | auto-resolve vs tactical within 5% win rate per battle type over 200 seeds | fairness |

A calibration slice follows each engine workstream, with a before/after table in the commit
message, as the ship skill requires.

---

# Part I. Order of work

Each workstream is its own branch off `claude/gallant-pasteur-rfkma8`, playable alone, merged
when you say so. S is a day, M two to three days, L four to six, XL more than a week.

| # | Workstream | Size | Depends on | Delivers |
|---|---|---|---|---|
| 1 | **Tile grid and geo build**: the geodesic grid, terrain, features, rivers, resources, cores, scenario starts; tests on the data | L | none | `tiles.bin`, `scenarios.js`, a viewer page |
| 2 | **Map rendering**: hex mesh on the globe and the flat map, nation and city borders, fog, lenses scaffold, tap and hover on tiles, zoom levels | L | 1 | the new map, empty of game logic |
| 3 | **Cities and the one economy**: city state, yields, worked tiles, housing, amenities, growth, production queue, improvements, roads, border growth, buildings retargeted; delete development and the three economies; the cities turn phase; the city and tile sheets | XL | 1 | a playable peaceful game |
| 4 | **Settlers, outposts, natives, migration** | M | 3 | expansion loop |
| 5 | **Armies, movement, ZOC, supply, fleets, recruitment from cities, templates** | L | 3 | war on the map without battles |
| 6 | **Sieges and battle types**: walls, HP, encirclement, assault, sally, relief, landing; `mapgen` from tiles; deployment; aftermath on tiles; parity | L | 5 | the RTS on the real place |
| 7 | **Diplomacy on cities**: claims, opinion reasons, war goals, peace on cities, trade routes with plunder, demands | L | 3, 5 | |
| 8 | **Loyalty and culture, authority merge, estates on land, governors** | M | 3 | |
| 9 | **AI**: governors for all, settler planner, fronts on tiles, in-sight real wars, politics | XL | 4 to 8 | a living world |
| 10 | **Research web, boosts, map effects per tech** | M | 3 | |
| 11 | **Events pinned, wonders as tiles, era goals, disasters** | M | 3 | |
| 12 | **UI**: next prompt, empire sheet, nation sheet, army sheet, lenses, portrait empire view, desktop hotkeys, onboarding | L | 2 to 8 | |
| 13 | **Calibration and the balance-sim keys of Part H**, performance pass, audit invariants, save v7 screen | M | all | |

Sprite renderer and unit art (previous plan section 8, art brief v3) continue in parallel and
plug into workstream 6.

Suggested sequence: 1, 2, 3 (the long one), then 5 and 4 in parallel, 6, 7 and 8 in parallel,
10 and 11, 9, 12 throughout from 3 on, 13 last. About 12 to 16 weeks of work at this pace.

---

# Part I2. Pacing across the ages

At Normal speed the game is about 495 turns (Bronze 30, Classical 65, Kingdoms 100, Gunpowder
100, Modern 200). The map rules are tuned per age so the world fills at the historical pace of
Part H:

| Age | Turns | Border ring max | Settler cost | Outpost slots | Typical cities (mid nation) | Army move (foot) |
|---|---|---|---|---|---|---|
| Bronze | 30 | 2 | 60 prod | 1 | 1 to 3 | 2 |
| Classical | 65 | 3 | 80 | 2 | 3 to 6 | 2 (roads 4) |
| Kingdoms | 100 | 3 | 100 | 2 | 5 to 10 | 2 (roads 4) |
| Gunpowder | 100 | 4 | 120 | 3 | 8 to 14 | 3 (roads 6) |
| Modern | 200 | 5 | 150 | 3, then no free land | 10 to 20 | 4 (rail 16) |

Border growth culture costs are scaled by `1 / ageScale` so later ages claim faster. City growth
thresholds are the same every age, but later buildings give more food, so cities grow to size
15 to 25 in the Modern age and 5 to 8 in the Bronze Age.

# Part K. Test and acceptance plan per workstream

| # | Unit and engine tests | e2e (Playwright, 844 x 390 and 1440 x 900) | Acceptance (what you check by hand) |
|---|---|---|---|
| 1 Grid | cell count 28,000 ± 2%; land share 27 to 31%; 12 pentagons all in water or Antarctica; every nation has a core on land; rivers only on land edges; deterministic build hash | the viewer page renders and a tap reports a tile | the Nile, Mesopotamia, the Indus and the Yellow River are floodplains; the Alps, Andes and Himalayas are mountain chains; Britain and Japan are islands |
| 2 Rendering | hit test by lat/lon returns the tile under the pointer at 3 zoom levels; border mesh rebuilds only for the nation whose tiles changed; 60 fps at region zoom with 240 nations on the sandbox GPU | tap a tile, pinch to local zoom, the globe to flat hand-over | borders read at a glance on a phone; no seams at the pentagons |
| 3 Cities | yield table; allocation by focus; growth and starvation; housing and amenities; production and rush buy; improvements legal tiles; border claim order; one economy identical for player and AI; the cities phase under 60 ms for 2,000 cities | found the second city via the sheet, queue a granary, buy a tile | a 10-turn peaceful game feels like Civ's opening |
| 4 Settlers | settler founding rules (distance 3, not in borders); outpost progress and raids; natives trade, convert, clear; migration | build a settler, walk it, found, watch the ring grow | the AI settles at the Part H pace |
| 5 Armies | move points and costs; ZOC; fog and seen tiles; stacking cap; supply meter in and out of borders; embark and land; army merge and split; templates | tap army, tap destination, path with turn numbers, confirm | crossing France takes 3 to 4 turns on foot, 2 by road |
| 6 Sieges and battles | HP and walls; encirclement doubling; assault, sally, relief, landing setups; mapgen from tile context (river edges, coast side, walls level); each battle type's objective; parity within 5% per type over 200 seeds; replay hash stable | start a siege, assault, play 60 s, result sheet | the river is where the map says it is |
| 7 Diplomacy | claims within 5 tiles; opinion reason list sums; war goals on cities; peace cedes cities with tiles; routes need access; plunder; demands | fabricate a claim, declare, win, take the city in peace | opinion reasons explain every AI choice |
| 8 Loyalty and politics | pressure math; flip at 0; authority breakdown equals its parts; estates hold tiles; governor effects | assign a governor, watch loyalty | distant conquests are hard to keep |
| 9 AI | governors keep every AI city fed and growing; settler planner respects slots; fronts defend and besiege; out-of-sight dice match in-sight outcomes within 10% over 50 seeds; 150-turn determinism | none | the balance-sim world keys of Part H |
| 10 Research | web prerequisites; boosts trigger from tile facts; every tech has an effect (a test asserts no effect-less tech) | queue a tech, see turns | |
| 11 Events and wonders | pins resolve to a live city; wonders need a legal tile; era goals count | an event sheet with a marker | |
| 12 UI | next prompt cycle order; sheets fit 390 px tall; 44 px targets (a test measures every button) | the onboarding 10 turns on a phone and on desktop | a new player finishes onboarding without help |
| 13 Calibration | the Part H table within tolerance on 3 seeds; turn time under 150 ms at turn 100; audit 0; save v7 screen | | |

# Part L. The thin first slice (if decision 9 picks it)

A playable vertical slice in about 4 weeks: workstreams 1 and 2 complete, workstream 3 without
trade routes, estates or amenities (yields, growth, housing, queue, improvements, borders),
workstream 4 without natives, workstream 5 without naval, and auto-resolve only for battles
(the existing `resolveBattle` on the army's units, sieges by HP). Diplomacy stays the existing
nation-level one with war goals mapped to "any city". That is enough to feel the map and tune
the pacing table before the long tail.

# Part J. Risks, critique of this plan, and decisions

## J1. Critique

1. **This is a new game on the old engine.** Workstream 3 alone replaces the economy, the
   province, the buildings' home and the player's main screen. Mitigation: the engine
   disciplines (pure reducer, seeded RNG, audit, determinism test) carry over unchanged, and
   workstreams 1 and 2 can ship as a map viewer before any rule changes.
2. **Save break.** Unavoidable with a new map. Say so plainly in the app and keep the current
   build on `main` until the rework is playable end to end.
3. **8,500 land tiles on a phone globe.** One instanced mesh is fine for the GPU; the risk is
   the hit test and the border mesh rebuild. Mitigation: a tile lookup by lat/lon is O(1) on a
   geodesic grid, and border meshes rebuild per nation only when its tiles change.
4. **AI cost with real armies everywhere.** The in-sight rule bounds it: at most a few dozen
   AI armies move for real each turn. Dice out of sight are calibrated, which is a test, not a
   hope.
5. **Civ's citizen micro would kill the phone.** Auto-allocation with focus and locks is the
   right trade. If players want more, locks are enough.
6. **Too many meters still.** Authority merges two; opinion reasons replace hostility; loyalty
   replaces control. The remaining list (authority, prestige, unrest per city, loyalty per city,
   war exhaustion, AE, supply per army) each has a reason list, which is what makes a meter
   acceptable.
7. **Historical cores are hand work** for 240 nations. Mitigation: generate a first pass (the
   capital plus the largest cities by modern population within the modern border) and curate
   the 40 nations that matter at 2000 BCE (Egypt, Mesopotamia, Indus, China, Minoans, Hittites,
   Nubia, Elam and so on). The rest get a one-city start, which is right for most.
8. **What is lost.** Development points as a currency, control %, the trade pact as the only
   trade, HR as a pool, region names for places that are now tiles. Each was reviewed above as
   not worth keeping. ADM/DIP/MIL stay for politics and diplomacy only.
9. **Deliberately left out of this plan**, each a follow-up with its own plan: religion as a
   system (the identity axes and the Religion building line stand in for it; a religion lens
   and spread would be the next CK3-style layer), great people, espionage on tiles (spies as
   units), weather and seasons on tiles, a world congress, naval tactical battles (auto-resolve
   first), and multiplayer beyond the existing submitted-turns mode.

## J2. Decisions

All settled 2026-10-02: **1** the 18,000 km² grid; **2** Dawn is the default and every nation
starts with one city; **3** automatic tile work by focus is the default, with a manual mode and
locks for players who want it; **4** improvements come from the city's build queue, no builder
units; **5** a clean save break; **6** HR and development points are deleted in favour of
manpower and tiles; **7** a city at loyalty 0 flips to the bordering nation with the most
culture pressure, and becomes a free city when no nation borders it; **8** the naval class
splits into four lines; **9** the full sequence of Part I, everything in the end, order at my
discretion.

1. **Grid size.** About 18,000 km² tiles (8,500 land). **Settled.**
2. **Default start.** Dawn 2000 BCE, one city per nation. **Settled.**
3. **Citizens.** Automatic by focus, with a manual mode and locks. **Settled.**
4. **Builders.** Improvements from the city queue. **Settled.**
5. **Saves.** A clean save break with a notice. **Settled.**
6. **HR and development.** Deleted. **Settled.**
7. **Loyalty flips.** To the bordering nation with the most pressure, else a free city, with a
   20-turn warning on the badge. **Settled.**
8. **Naval classes.** Four lines. **Settled.**
9. **Order.** The full sequence of Part I. **Settled.**

## J3. Progress log

**Workstream 3.3 (2026-10-02): the game state runs on the tile world.** Full suite green (2,116
tests, 16 skipped). What it settled and what it found:

- Every nation's state is one city record per city (`state.regions`, keyed `c<tile>`), with
  `state.world.tileOwner` and `tileState`; the registry bridge (`src/engine/world/registry.js`)
  keeps the old static readers (`REGIONS_DATA`, `getNeighborIds`, `getNationCapital`) working
  until each is migrated. City neighbours: touching land, within 3 rings, a capital-to-capital
  bridge between adjacent modern countries within 12 rings, and a landlocked city with no
  neighbour at all links to the nearest city (islands stay sea-only).
- **Straits.** Seven cells narrower than a tile are opened as water by `scripts/geo/build-tiles.mjs`
  (Bab-el-Mandeb, Dardanelles, Sea of Marmara, Oresund, the White Sea throat, Malacca west and
  east), so the Red Sea, the Black Sea, the Baltic, the White Sea and the Strait of Malacca reach
  the ocean. The Caspian stays closed. Suez stays closed until a canal mechanic.
- **Coastal.** A city is coastal when its centre, or an owned tile of its founder's own country,
  touches the sea. Bern's first ring reaches a Lombard tile on the Ligurian Sea at this grid
  size; without the rule Switzerland was a sea power.
- **People.** `sizeToPeople(size) = 1000 x size^2.8` (size 2 is 7,000, size 5 is 90,000, size 30 is
  14 million). The historical share is no longer used.
- **The Palace.** The capital yields +4 gold, +2 production, +2 science, +1 culture flat, so a
  one-city Dawn nation nets about +3 gold after its first army's upkeep instead of bleeding.
- **Siege.** A city under invasion lives off its centre tile alone, so it starves and shrinks.
- **AI.** A capital counts as threatened only when an enemy army stands next to it (on the Dawn
  world every capital borders its neighbours' capitals, so the old rule kept every AI on the
  defensive). Troops aboard a ship never join a land attack (they walked off with the flag set).
- **Open balance items for workstream 13.** A passive player with neighbours loses its only city
  by turn 42 (every bordering capital is a Tier-1 attacker, and one city is the whole nation):
  the long-run harness plays Australia for now. The space-race affordability test is skipped
  until yields are calibrated per age. Western Europe is saturated at Dawn (no free tile touches
  Paris), which matters for settlers (workstream 4).

---

**Workstream 3.4, first wave (2026-10-02): the map draws the tile world.** Both views read one
geometry module, `src/data/geo/cityFeatures.js`: a territory per city from `tileOwner`, cut to the
real coastline once with polygon-clipping (never an SVG clip path: a clip of every coastline on
Earth wedged software rendering), a territory per nation (the union of its cities) whose outline
is the nation border, the hex mesh for the part of the world on screen, and the city under a
point by nearest tile. The flat map draws translucent city fills over the Earth raster, nation
outlines, faint city borders from 2.5x, the hex mesh from 3x and a badge per city with its size
and name. The globe composites the same fills and outlines into its texture
(`src/components/globe/politicalTexture.js`) and resolves taps by nearest tile: the 4,482
province meshes are gone. The city sheet's first two views (`src/components/city/CityPanel.jsx`:
size, growth, housing, amenities, focus, live yields, the build queue with units, buildings and
tile improvements; the tiles list with yields, worked tiles, locks and tiles to buy) are the
first two tabs of Manage Region. Found on the way: polygon-clipping's ring winding is the
opposite of d3-geo's (a territory read as the rest of the world), and a dash pattern on 240
coastline paths never finishes rasterising. Still to come in 3.4: the tile sheet for free land,
the army and nation sheets, and the end of the province modal's old tabs.

---

**Workstream 4, first wave (2026-10-02): settlers, outposts and the AI's first production.**
`src/engine/settlers.js`: a settler is a queue item (the city gives up a citizen), a land unit of
no combat that stands on a tile and walks 2 tiles a turn over free, own, allied or enemy land to
a target the player picks on the map (SET_SETTLER_TARGET, FOUND_CITY) or the AI scores
(`bestSites`: yields of the site and its ring, resource, river, coast, minus distance). On arrival
it founds an outpost: a size-1 city that claims its ring but yields and builds nothing until its
progress (14 a turn, 0.7 on hills and forest, 0.4 in desert, mountains and the arctic) reaches
100. A nation runs at most 1 outpost at Dawn, 2 in the Classical and Kingdoms ages, 3 later.
`src/engine/aiProduction.js`: an AI city with an empty queue builds a settler when it is size 3,
has a free slot and a worthwhile site (checked one turn in five), else the next building line in
a fixed order it can finish within 40 turns, else infantry up to one unit per city. The tile
sheet (`src/components/map/TileSheet.jsx`) opens on a tap on open land on either map: terrain,
yields, resource, the owning city, the site score, and the send and found buttons; settlers are
drawn as tents on their tiles. Measured at 330 cities (turn 40, Australia passive, seed 11): 106
ms a turn, of which the cities phase is 40, the AI economy 28 and the registry rebuild 17; the
spacing check, the AI site search, settler paths and city neighbours are now cached, which took
the turn from 200 ms down. Natives, loyalty on far outposts and migration are still to come.


---

**Workstream 5, first wave (2026-10-02): armies stand on tiles and march real routes.**
`src/engine/armies.js`: every land unit has a `tile`; its `regionId` is the city whose land it
stands on, or on free land the nearest own city (its supply base, and the record every older
reader keeps using). Move points a turn by class (foot 2, cavalry 4, siege 1, +1 Forced March),
banked up to 4. Tile cost: 1 on open land, +1 for hills, +1 for forest, jungle or marsh, +1 for
desert or tundra, mountains 4, a river crossing +1 until Stone Bridges, a road 0.5 (a railway
0.25 with Rail Networks), enemy land at least 2; snow, ice and water are impassable. Routes are
A* over tiles (`findTilePath`); a march halts at the border of enemy land you do not hold and
before an enemy army, and entering a tile next to an enemy army ends the move for the turn (zone
of control). `routes.js` runs on tiles (`route` is a list of tiles; a target is a city or a tile
of free land, SET_ROUTE `toTile`). A city is attacked from any tile next to its land, and still
from inside a neighbouring city's land (the registry bridge of the sparse Dawn world). Every
mover that still thinks in cities (a manual move, a captured city, a defence fallback, AI
operations, civil wars, colonies) places the unit on the city centre, and `normalizeUnitTiles`
at the start and end of a turn re-anchors a unit whose land changed hands. The maps draw
armies at their tiles (flat map, globe, close view); the flat map draws the march lines with
turn numbers; the march bar takes a tile as target. Found on the way: at Dawn, Paris can reach
only seven free tiles at peace (its neighbours' capitals enclose it), so the route tests play
India and Pakistan. Mountains are not impassable yet (no Mountaineering tech exists; it comes
with the research web of workstream 10). Still to come in 5: fog of war, the supply meter,
stacking limits, fleets on sea tiles, army templates and the AI front planner (workstream 9).


---

**Workstream 5, second wave (2026-10-02): the supply meter and sight by tile.**
`src/engine/supplyMeter.js` replaces the old "beyond the supply range" attrition (one rate, by
province hops) with the plan's meter: every land unit carries `supply` 0 to 100; a turn at home
(own, vassal or allied land) gives +20, free land costs 10, enemy land 20 (10 when own land is
within 6 tiles, more with the supply range modifiers, 0 next to a city it holds), an empty
national supplies stock 10 more everywhere abroad, and a stack above the tile's cap (combat
width x 2 units) 10 more. Losses are scaled by national.attrition (the player's Paved Roads),
halved by Forager and by a logistician commander. At 0 the unit starves: 5% of its strength
(floored, so it can die) and 10 morale a turn, and it neither recovers nor reinforces. The
unit line in the region card shows SUP; a banner's description names a short supply.
`src/engine/sight.js`: a nation sees its land and allies' land plus 2 tiles, its armies plus 2
(3 on hills), its fleets plus 2; foreign armies and colonies outside that are fog unless intel
reveals the nation (the region-neighbour rule is gone). The greyed memory and the darkened map
wait for the lenses of workstream 12. Still open in 5: fleets on sea tiles, recruitment to the
city tile, army templates, the AI front planner (9).


---

**Workstream 5, third wave (2026-10-02): fleets on sea tiles.** `src/engine/fleets.js`: a fleet
is in port on its city's centre tile and at sea on a water tile (its `regionId` stays its last
port); cargo rides on the fleet's tile. Pace by the owner's age (3 water tiles a turn at Dawn,
4 Classical, 5 Kingdoms, 6 Gunpowder, 8 Modern), one point a tile; coast and shelf tiles open
to all, the deep ocean from the Age of Gunpowder, lakes never. Sea routes are A* over water
(`findSeaPath`): a voyage leaves a port by any water beside the city's land, puts in at an own
or allied port, halts outside an enemy port at war and before an enemy fleet. "Sail…" on the
region card, a port or a sea tile as the target, drawn like a march. A fleet beside a shore
lands its troops on own, allied or free land from the tile sheet ("Land N units here");
enemy shores are an amphibious assault, now also from any tile beside the city's coast, and a
naval engagement can be fought from beside the coast. A warship beside a city's coast with no
warship of the owner there blockades it: its sea trade stops (siege regen is workstream 6's).
Found on the way: with depth as the only gate, a Dawn fleet could hug the coasts to America in
a long voyage; MAX_SEA_STEPS (120) refuses such a route for one order. The AI's fleets keep
the port-to-port operations until the front planner. Not done: the four naval lines (galley,
transport, raider, carrier) as data, carriers and air; army templates.


---

**Workstream 6, first wave (2026-10-02): walls, siege HP, encirclement, cities that fall.**
`src/engine/sieges.js`: walls 0 to 3 from the Defense line (none, Palisade, Stone Walls, Star
Fort and better), siege HP 200 x (1 + walls) x (1 + size / 10). At war an army now walks into
enemy land (the march halts before the city centre itself; the city is taken through the attack
card) and every enemy land unit on the six tiles around the centre besieges: damage a turn is
the besiegers' siege strength (20 per siege unit, 3 per other, x1.5 with Siege Engineering)
minus 5 x walls of regen; encircled (all land neighbours held, every water tile beside the city
blockaded) doubles it and shrinks the city by one size every four turns. A besieged city works
ring 1 only. A turn without besiegers heals a tenth of the HP. At 0 HP the city falls: an AI
city surrenders to the besieger through conquest.js (war score, AE, capital rules as a capture),
the player's city makes a last stand through the pending-defence flow (auto or commanded). A
unit's `regionId` is now strictly its base: its own city, never the enemy's land it stands on,
so the garrison and attacker readers stay right; campaigning and march supply read the tile
the unit stands on. The region card shows the siege, walls and HP. Not yet: sally, relief
battles, the siege and last-stand battle types in the RTS (D5, next waves), the capture extras
(loyalty, pillage, raze, liberate: with loyalty in workstream 8), and AI sieges (the AI still
hops city to city; the front planner of workstream 9 will stand its armies beside cities).


---

**Workstream 6, second wave (2026-10-02): the battlefield is built from the tile.**
`src/battle/setup/tileContext.js` describes a battle's ground from the fought-over tile and its
six neighbours (terrain, water, river on the edge, road), rotated so the neighbour the attacker
comes from lies due west, with the city's walls and its current siege HP. `mapgen.js` paints
the outer band of the field by sector: each neighbour's ground (forest, rock for mountains,
sand for desert, the sea beyond a beach for water), a river on an edge as a band of water
across that sector's rim with one or two fords, hills and mountains rising beyond the rim; the
middle keeps the tile's own template, and the map is a pure function of the tile. Every setup
(invasion, defence, landing) passes the context; a city battered by a siege starts the assault
with its keep and towers at the siege HP. The battle sandbox fights on a real river-mouth
tile so the ground can be seen. Still to come in 6: field battles between armies on tiles
(attack an army, sally, relief), the battle types' own objectives and deployment, aftermath on
tiles (pillage, retreat along the route), parity for the new types.


---

**Workstream 6, third wave (2026-10-02): field battles between armies.** `src/engine/fieldBattle.js`:
a stack attacks an enemy stack on an adjacent tile that is not a city (ATTACK_ARMY, auto; or
BEGIN_TACTICAL_BATTLE with a tile, commanded on the tile's own ground with the defender's camp
as the keep). The same gate and consequences for both: the tile's terrain, a Fort improvement
on it (damage x0.75), a river between the two tiles (attack x0.85, the plan's river-crossing
type), the ages. A beaten defender stack retreats one tile towards its base, or is destroyed
when every way out is held; a beaten attacker stays. War score and a battle report of kind
"field" follow. Tapping a foreign army on the flat map opens its tile; the tile sheet offers
the attack from each adjacent stack, and the pre-battle sheet shows the odds. Sally and relief
are this attack from the city or from outside; an AI garrison sallies (auto-resolved) when it
outweighs the besiegers on one tile by 1.3. Open: the battle types' own objectives (a sally's
siege engines, the landing's beachhead), aftermath on tiles (pillage), parity for the field
type over seeds, the player commanding a defence in the field.


---

**Workstream 7, first wave (2026-10-02): opinion with itemised reasons.** `src/data/opinion.js`
holds the table, `src/engine/opinion.js` computes a nation's opinion of another as a list of
reasons: a baseline of 8, the grudge ledger (0.6 per point of the existing `hostility`, which
keeps carrying insults, gifts, wars and broken truces with their decay), shared border tiles
beyond 5 (-1 each, at most -20), a city settled within 4 tiles of mine (-15, fading 1 a turn),
holding a city of my people (-10 each), a claim on me (-10), trade (+5), alliance (+25), a
defensive pact together (+15), royal marriage (+15), the same lean on an identity axis (+5
each), aggressive expansion above 20 (-1 a point), rival (-30), a broken truce (-20), vassalage
(-10). The AI's war roll multiplies by max(0, (20 - opinion) / 60), which equals the old
hostility / 100 + 0.2 when no map reason applies (the old tests hold), so a friend never rolls
for war and never picks the player as a target; an opinion of -40 or less gives a casus belli
and reads as Hostile. The Diplomacy panel shows the opinion with its reasons. Still open in 7:
claims on cities (fabricate within 5 tiles, cores), city war goals and war score by city size,
open borders for trade routes, demands and ultimatums, and the AI using the full list for
alliances and trade (today alliance needs +40 only through the old acceptance score).


---

**Workstream 8, first wave (2026-10-02): loyalty and culture.** `src/engine/loyalty.js`: every
city carries culture shares per nation and a loyalty of 0 to 100. Cities within 9 tiles press
their nation's culture on it (size over distance); the shares drift 5% of the way to the
pressure each turn. Loyalty moves 5 a turn toward 100 x the owner's share, +10 per own land unit
on the centre (up to +30), the amenities balance (within +-10), -20 for 20 turns after a
conquest, -20 while the owner's capital is in enemy hands. A taken city starts at 50. At 0 a
city that is not a capital goes over to the nation with the most pressure among those whose
land borders it, else stands as a free city (owner none, control 0): settle it peacefully,
retake it, or watch it join the bordering nation that presses it most after 10 turns. The
region card shows loyalty, its target with the parts, and the culture shares. Control stays
the siege and battle ground. Not yet: governors (C4), the authority merge, estates on land,
the AI reading loyalty for its conquests (workstream 9).


---

**Workstream 9, first wave (2026-10-02): AI fronts on tiles.** `aiOperations.js`: an AI stack
attacks a city only from tiles that touch its land (the registry's city bridge no longer lets
an army strike a city eight tiles away). A stack at a front with no city in reach marches on
tiles toward its goal (the war-goal city, else the most valuable enemy city next door by the
registry) on an A* route of at most 40 tiles, walked by the same march phase as the player's
(the nation as the actor): it halts before the city, besieges it (sieges.js), and assaults when
it outweighs the garrison by 1.25 or the walls are under 30% HP. Stacks are grouped by tile,
so an army on the road stands apart from its base's garrison; the hop between own cities
toward a threatened front stays. Garrisons sally (workstream 6). Not yet: the threat radius
of 4 tiles for defence, raiding routes, out-of-sight dice calibrated against the real sim,
the city auto-governor for every nation every turn, opinion-driven alliances and claims.


---

**Workstream 10, first wave (2026-10-02): research boosts from the map.** `src/data/boosts.js`
gives every one of the 50 techs a fact that pays 40% of its cost once: own copper for Bronze
Casting, a forest for Composite Bow, iron for Iron Weapons, lay a siege for Siege Engineering,
rule 6 cities for Feudal Levies, a river city for Irrigation Canals, build a road for Paved
Roads, a coastal city for Early Astronomy, a harbour for Canal Locks, coal for Rail Networks,
oil for Mechanized Warfare, and so on. `src/engine/boosts.js` reads a nation's facts once a
turn (its cities, the resources, rivers, roads and buildings on their tiles, its wars and
sieges) and applies the newly met boosts to the player every turn and to each AI nation on its
research period; the research sheet shows each tech's boost and whether it is met or taken.
Still open in 10: the tree as a web with crossing prerequisites, a map effect for every tech
(a Mountaineering tech for mountain crossings, districts), science from districts.


---

**Workstream 11, first wave (2026-10-02): era goals and legacies.** `src/data/eraGoals.js` sets
one goal per playstyle for every age with targets that grow with the age (expand: 4, 6, 9, 12,
16 cities; wealth: 1 to 5 trade agreements; war: 1 to 5 cities taken; culture: 1 to 5 wonders;
science: 4, 8, 14, 20, 28 techs). `src/engine/eraGoals.js` reads the player's numbers from the
state; when the calendar age turns, the ending age is scored: two goals or more met give a
legacy for 50 turns made of the met playstyles' bonuses (+10% growth, +10% gold, +1 military
power, +1 stability, -10% research cost) as a timed national modifier, and the result is kept
on the player nation. The Legacy tab shows the strip with the five goals and past eras. Still
open in 11: events pinned to cities or tiles, wonders as tiles, disasters by tile facts.


---

**Workstream 12, first wave (2026-10-02): on-map affordances.** The flat map's city badges now
carry the plan's marks (E6): an orange arc with the siege HP left and a crossed-swords mark on
a besieged city, a wall bar under a walled city, a dashed badge with a yellow progress ring on
an outpost, a red dot on a city whose loyalty is 25 or less, and a grey badge for a free city.
Earlier waves already gave armies their tiles and banners with a supply note, settlers their
tents, marches their numbered turn dots and the tile sheet its attack and landing buttons.
Still open in 12: the army and nation sheets, the empire sheet with the era strip, lenses, the
fog hatch, the portrait empire view, desktop hotkeys, onboarding, retiring the province modal.


---

**Workstream 13, first calibration slice (2026-10-02).** The balance sim now prints the Part H
keys (cities, land claimed, cities changed hands, loyalty flips, free cities, sieges, armies on
the road). Measured on seed 11, player France passive, 150 turns, before and after this slice:

| Key | Before | After | Target |
|---|---|---|---|
| Land claimed at 550 CE (turn 100) | 39% | 44% | 50% |
| Land claimed at 1050 CE (turn 150) | 50% | 54% | about 65% |
| Cities at turn 150 | 616 | 682 | |
| Loyalty flips, turns 50 to 100 | 275 (5% of cities per 10 turns) | 75 (1.4%) | 0.5 to 1% |
| Siege phase, ms a turn at 460 cities | 50 | 7 | 10 |
| Supply and loyalty phases, ms a turn | 52 | 13 | 10 |
| Cities phase, ms a turn at 550 cities | 115 | 86 | 50 at 2,000 |
| Whole turn, ms at 550 cities (turn 80) | 320 | 267 | 150 at turn 100 |
| Audit violations | 0 | 0 | 0 |

The cities phase: the AI production choice scanned every unit and every city per city (95 ms of the phase); the nation counts are now built once a turn, the city map is copied once, tile facts and yields are memoised on the tile's state entry and the researched list (the player's list is memoised on the tech tree). What changed in the rules: a flipped city's people take 60% of its shares for the new owner and the city
cannot flip again for 30 turns (no ping-pong), a newly founded city holds for 30 turns, a
city's own people press at 0.6 of its size and loyalty needs 40% of the owner's culture; the
siege and loyalty phases share one land-unit-by-tile index and culture drifts every third
turn; AI cities build settlers from size 2 and every nation runs 2 outposts at Dawn (3 and 4
later). Still open in 13: the cities phase (114 ms at 546 cities, 0.2 ms a city: the
allocation and yield arithmetic need the per-city caching the budget assumes), the AI economy
phase (67 ms), median cities per nation (1 at turn 100 against 6: growth to size 2 is the
bottleneck, food and housing need the next slice), the registry's city bridge (cities 12 tiles
apart still count as neighbours for the player's attacks and trade; AI fronts no longer use
it), the Dawn geography (Paris and Berlin cannot reach each other over land at peace), and the
space-race affordability test.

**Workstream 13, second performance slice (2026-10-02).** Four per-nation scans and one spread
per claim were most of the turn. Measured with the phase hook over 80 turns (seed 11, France
passive) and the balance sim (seed 11, 150 turns, which adds the audit and the snapshot to each
turn), before and after:

| Key | Before | After | Target |
|---|---|---|---|
| AI economy phase, ms a turn (average, turns 1 to 80) | 55 | 20 | |
| Reinforcement and morale phase | 22 | 5 | |
| AI growth and hostility phase (opinion) | 25 | 4 | |
| Cities phase | 70 | 45 | 50 at 2,000 cities |
| Whole resolveTurn, ms (average, turns 1 to 80) | 167 | 127 | 150 at turn 100 |
| Balance sim ms a turn, turns 50 to 100 (with audit) | 351 | 215 | |
| Balance sim ms a turn, turns 100 to 150 (with audit) | 431 | 262 | |
| Land claimed at 550 CE / 1050 CE | 43.7% / 55.4% | 46.7% / 59.1% | 50% / 65% |
| Cities at turn 150 | 686 | 756 | |
| Median cities per nation at turn 100 | 1 | 1 | 6 |
| Audit violations | 0 | 0 | 0 |

What changed: the supply flow and the upkeep of every AI nation scanned the whole unit map
(four scans per nation, 240 nations); `unitsByOwner` (supplies.js) groups the units once per
phase and the helpers take the nation's list. The opinion of 240 nations ran a ring walk per
city pair; `opinion.js` now indexes the cities by owner and the rings around every city founded
after the start once per turn. The border claim spread the 4,000-key tile ownership map per
claim (34 ms of the cities phase at 33 claims a turn); `processCities` copies the ownership and
tile state maps once and the cities write into them (`processCity(..., inPlace)`), the ring walk
of `claimCandidates` is memoised per city centre and age, and the outposts' growth writes one
copy of the cities map. A rule change found on the way: an AI settler that found no site sat
for the whole game and, as `aiProduction` builds a settler only when the nation has none,
blocked its nation's settling for good; an idle AI settler now looks again every
SETTLER_RETRY_TURNS (5) turns as far as MAX_SETTLE_RINGS and is disbanded after
SETTLER_GIVE_UP_TURNS (15) turns without a site. Still open in 13: the cities phase at 2,000
cities, the AI economy's `processAIEconomyTurn` (14 ms for 95 thinking nations), the rebellion
and disaster phases (10 and 7 ms), median cities per nation (growth to size 2 and the sites in
reach), the registry's city bridge, the Dawn geography, and the space-race affordability test.

**Workstream 13, growth pace (2026-10-02).** Why the median nation had one city at turn 100
(seed 11, 120 of 239 nations): 101 had no legal site within 12 rings of their capital. Of those,
42 are islands with three or fewer land tiles in reach, 35 sit in land every neighbour already
owns (Europe, the Levant), 23 had free land whose site score fell under the floor, and one had
only tiles too close to a city. Letting settlers cross a neighbour's land at peace changed
nothing (117 one-city nations in the same run), so borders are not the lever and the rule
stays. The floor was: the AI rejected a site whose score, AFTER the 0.6-a-ring distance
penalty, fell under 6, so a good site ten rings away never counted. A site is now judged by its
quality (`siteQuality`: the yields of the centre and its ring, a resource, a river, the coast)
against SITE_SCORE_MIN (4), and the distance only ranks the candidates. Seed 11, 150 turns:

| Key | Before | After | Target |
|---|---|---|---|
| Land claimed at 550 CE / 1050 CE | 46.7% / 59.1% | 49.1% / 63.1% | 50% / 65% |
| Cities at turn 100 / 150 | 656 / 756 | 726 / 879 | |
| One-city nations at turn 100 | 120 | 111 | |
| Nations with 6 or more cities at turn 100 | 37 | 49 | |
| Median cities per nation at turn 100 | 1 | 2 | 6 (see below) |
| Loyalty flips, turns 100 to 150 | 92 (1.2% per 10 turns) | 149 (1.9%) | 0.5 to 1% |
| Audit violations | 0 | 0 | 0 |

The target of 6 cities for the median nation is out of reach by geometry, not by pace: the
grid has 8,274 land tiles, cities stand at least 2 tiles apart, so the world holds about 1,100
cities for 240 nations, and 77 nations (islands and the boxed in) can never have a second city
without conquest or overseas settling. The reachable target is a median of 2 at turn 100 and 3
at turn 150 with about 1,000 cities by 1500 CE, which the next slices aim at. The loyalty flip
rate rose with the city count (1.9% per 10 turns in the last window) and goes back on the list.

**Workstream 13, loyalty flips (2026-10-02).** Every one of the 259 flips in 150 turns (seed 11)
was a settled city, 64% younger than 60 turns, most on the turn the founding grace ended, and
in almost every case its owner was the nation pressing it MOST: in a dense region the pressure
field splits among four or five neighbours, so the owner's absolute share sat at 30 to 40%
under the 40% floor however strong its lead. The target is now the owner's LEAD: 50 +
LOYALTY_LEAD_SCALE (100) x (owner's share - the biggest other share), an even split holding at
50, with LOYALTY_SHARE_FLOOR lowered to 0.25 as the "never loyal" line. Seed 11, 150 turns:
flips 259 to 69 (17 by turn 100), the last window at 0.6% of cities per 10 turns (target 0.5 to
1%), cities at turn 150 885, land claimed 63.2% at 1050 CE, median cities per nation 2 at turns
100 and 150, audit 0. The city card lists the people term next to the culture shares.

**Workstream 7, wave 2: claims on cities (2026-10-02).** `src/engine/claims.js`. A claim names a
city: fabricated on a city whose owner's land lies within CLAIM_RANGE_RINGS (5) of your border,
for the Fabricate Claim cost (150 gold, 11 DIP), ready after CLAIM_FABRICATE_TURNS (5) turns
(`nation.claimsInProgress` then `nation.claims`, city ids). A core (the city's founder, or a
culture majority over CORE_CULTURE_SHARE 0.5) is a standing claim. A claim or core on any city
the target owns is a casus belli (diplomacy.js), the war's goal is that city (buildWarGoal),
the claim stays until the city is taken (advanceClaims in the diplomacy phase drops claims on
own, free or vanished cities), taking a claimed city costs CLAIM_AE_MULT (0.5) of the
aggressive expansion and a core CORE_AE_MULT (0) (expansion.js through conquest.js and the
peace cede), and ceding a claimed city at the peace table costs half. Opinion counts -10 per
claimed city of mine with the names. Events' `addClaim: nationId` grant a claim on that nation's
nearest city. The AI (processAIWarDecisions): a Tier-1 nation whose war roll passes against a
target it has no casus belli against fabricates a claim on the target's nearest city when it can
pay, and declares once the claim is ready without a new roll; with no city in reach or no DIP it
declares unjustified as before. UI: the diplomacy panel shows claims and claims in progress per
nation and fabricates on the nearest city; the city card has a claim card (core, claim, in
progress, or the fabricate button). Audit: a claim names an existing foreign city. Dawn and
founded cities carry `founderId`. Seed 11, 150 turns: cities 887, land 63.2%, flips 70, audit 0,
2 of 6 wars by turn 100 carried a claim and its city as the goal. Still open in C6: open
borders, demands and ultimatums, trade routes needing access, war score from occupied cities.

**Workstream 7, wave 3: open borders and demands (2026-10-02).** `src/engine/accords.js`. Open
borders are a pact on both records (`openBordersWith`): armies cross the other's land as a
friend's (armies.js regionAccess), settlers walk it (settlers.js), trade routes may pass
(tradeRoutes.js) and each side thinks OPEN_BORDERS (+10) better of the other. The player offers
them (OPEN_BORDERS, 50 gold and 5 DIP, paid either way); the AI accepts at opinion
OPEN_BORDERS_OPINION (20) or more when no war runs between them; CLOSE_BORDERS ends them, and a
war between the two closes them. Demands (DEMAND, 5 DIP): tribute (20% of their treasury, at
least 50), a city you hold a claim on (never a capital; changes hands peacefully, the claim is
settled, aggressive expansion at the claim's rate), and stop settling near you (no city of
theirs within 4 tiles of yours for 50 turns, read by the AI's site search and canSettle). The
target accepts when 20 x (strength ratio - 1) + opinion / 4 - base (10, 40, 5) is 0 or more,
the ratio capped at 3; a refusal gives a casus belli for 20 turns (hasCasusBelli), any demand
costs hostility (10, 20, 5) and the same nation hears no demand for 10 turns. The diplomacy
panel shows the open-borders badge, the offer or close button with the answer in its title, and
one button per demand with its score. Tests in accords.test.js. Still open in C6: AI-to-AI open
borders and demands, war score from occupied cities, trade routes blocked at closed borders
for the AI.

**Workstream 8, wave 2: governors (2026-10-02).** `src/engine/governors.js`. A nation's cities
fall into groups: the capital and the cities within GOVERNOR_GROUP_RINGS (6) of it, nearest
first, up to GOVERNOR_GROUP_MAX (6); the next ungrouped city by id seats the next group
(`cityGroups`, cached per cities map). Each group's seat may hold a governor from the court's
candidates (GOVERNOR_CANDIDATES 3, refreshed every GOVERNOR_REFRESH_TURNS 10 turns; the heir may
serve with a skill from ADM), in office GOVERNOR_ASSIGN_TURNS (2) turns after the assignment. A
governed city gets +1 food, +10% production, +1 culture (cities.js through the turn's per-city
context), +2 + skill loyalty (loyalty.js) and its unrest x0.9 a turn (resolveTurn); a city in an
ungoverned group loses 5 loyalty. AI nations seat the best candidate in every empty group on
their economy think (free, at once); a governor whose seat is lost leaves. Actions
ASSIGN_GOVERNOR and DISMISS_GOVERNOR; the Court section of the domestic panel lists the groups
with their governor or the candidates to seat; the city card's loyalty line shows the governor
term. Tests in governors.test.js. Still open in C4: authority (stability and legitimacy merged),
estates on the map, laws with real effects on the new systems, the AI picking laws by doctrine.

**Workstream 8, wave 3: authority (2026-10-02).** `src/engine/authority.js`. A deviation from
C4.1 on purpose: stability and legitimacy stay the stored numbers (a dozen writers across
events, peace, civil war, succession, disasters and the reducer keep working untouched) and
Authority is DERIVED from them each time, 0 to 100 with a breakdown card: 50 + 8 x stability +
(legitimacy - 50) / 2 + (the ruler's ADM + DIP + MIL - 9) + 5 x the laws' stability bonus +
(mean estate loyalty - 50) / 5 - war exhaustion / 4 - overextension / 4 (at most 25) - 20 while
the capital is in other hands or occupied. The gates of the plan hold on it: under
AUTHORITY_NO_LAWS (25) no law can be enacted (laws.js canEnactLaw, player and AI alike) and
every estate loses 1 loyalty a turn (estates.js); under AUTHORITY_CIVIL_WAR (10) the turn counts
toward the civil war streak (civilWar.js). Prestige stays its own score. The Court section
shows the meter, its parts and the gate in force. Tests in authority.test.js. Still open in C4:
estates on the map, laws with real effects on the new systems, the AI picking laws by doctrine.

**Workstream 9, wave 2: threats, relief, raids, dice out of sight (2026-10-02).**
`src/engine/threat.js`. A city's THREAT is the enemy land strength within THREAT_RINGS (4) of
its centre; it is threatened when besieged, under invasion, or the threat exceeds its garrison
x THREAT_DEFEND_RATIO (0.8), and the AI defends threatened cities before it advances
(aiOperations, replacing the old "enemy army next to the capital" rule). RELIEF: a stack beside
a besieger of an own city attacks it (a field battle) when it outweighs that besieger stack by
RELIEF_RATIO (1.2). RAIDS: a stack halted on an enemy tile with an improvement pillages it (the
improvement stops yielding, tileYields.js; RAID_GOLD 20 to the raider; the player is told when
it is their land). DICE: the AI war's capture roll (diplomacy.js resolveWarProgress) now fires
only when the goal city is out of the player's sight (sight.js); within sight the real sieges,
assaults and relief decide, as D6 asks. Tests in threat.test.js. Still open in D6: calibrating
the dice against the real sim (the world's wars stay few, see the Part H keys), raids on trade
routes, a pillage order for the player's armies.

**Workstream 11, wave 2: events pinned to cities, disasters by tile facts (2026-10-02).**
Procedural events (src/data/proceduralEvents.js) name the city they happen to: every template
lists the player's cities whose facts fit (`candidates`: a coastal city for the trade boom, a
river city for the new flood, a starving city for the failed harvest, a frontier city for
raiders and refugees, a northern one for the harsh winter, one with a foreign majority for the
new foreign quarter, an unsettled one for the pretender), one is drawn with the turn's rng, and
the event carries `cityId` and `tile`; the event sheet names the place. City-targeted effects
(`cityUnrest`, `cityFood`, `citySize`, `cityLoyalty`, applyEventEffects.js and describeEffects.js)
land on that city. Disasters on cities (`src/engine/cityDisasters.js`, the nation meters of
disasters.js stay politics): each city rolls once a turn by a hash of its id and the turn; a
river city floods (FLOOD_CHANCE 0.4%: half its food bank, food x0.75 for 5 turns), a city of
size 4 or more burns (0.3%: half its production progress, production x0.75), one of size 6 or
more sickens (0.3%: a citizen lost, no growth); one disaster at a time, a 30-turn cooldown, a
mark on the city card until it heals, a log line for the player. Tests in cityDisasters.test.js
and proceduralEvents.test.js. Still open in C9: the event sheet as a side sheet with a map
marker, wonders as tiles built from production, scripted events pinned to places.

**Workstream 10, wave 2: a map effect for every tech (2026-10-02).** `src/data/techMapEffects.js`
is the table (30 techs) and `src/engine/techMapEffects.js` sums a nation's researched techs
(memoised on the list): sight (+rings for land and armies, sight.js), naval moves and the open
ocean by tech (fleets.js), border ring and tile culture cost (cities.js claimCandidates), the
share of food a city keeps when it grows (granaries), claim range (claims.js), governor group
rings (governors.js), stack cap, supply meter and supply line reach (supplyMeter.js), hills,
mountain and road movement costs (armies.js tileStepCost). With the income effects of
techTree.js and the building, improvement and unit unlocks, every one of the 50 techs now
changes something (a test holds the line: no idle tech). The research sheet shows the map line
under each tech. Tests in techMapEffects.test.js. Still open in C3: the web of prerequisites
across lines and the graph view of the sheet, science from districts.

**Workstream 6, wave 2: battle types from the map (2026-10-02).** `src/battle/setup/battleType.js`
names the six types of D5 and chooses one from the situation: a landing, a sally (the attack
comes out of a besieged city onto its ring), an assault (a city with walls), a river crossing
(the approach sector carries a river), an ambush (the defender stands in forest, jungle or hills
with no road) or a field battle. The setup carries `battleType` and its clock; the sim ends on
the type's objective (step.js checkEnd): a side with LOSS_DECISIVE (60%) of its squads dead or
fled breaks and runs (a routed squad may still rally, so it does not count); an attacker down
AMBUSH_LOSS (30%) of its strength within AMBUSH_SECONDS (120) is ambushed; a river crossing is
won at the clock by holding the far bank (the defender's half of the field) with
RIVER_HOLD_SHARE (40%) of the attacker's strength; a field battle at the clock goes to an
attacker with 1.5x the defender's strength left, else to the defender; a sally is won by
burning SALLY_ENGINES (2) of the three siege engines or the camp (razable structures east of
the field); a landing by holding the beachhead point on the sand for LANDING_HOLD_SECONDS (60).
The HUD's objective line reads the type. A field battle leaves a `battle` mark on the tile's
state for BATTLE_MARK_TURNS (5). Parity (battle-lab, 16 seeds, AI against AI) after the change:
even armies 8/16 attacker wins against auto-resolve's 8/16 (was 3/16), exchange rate 0.96 against
1.01; 5 against 2 and cavalry against archers unchanged. Tests in battleType.test.js. Still open
in D5: the deployment phase by type, the AI's deployment templates, the parity harness over the
new types, the map's battle marker, auto-resolve reading the type.

**Workstream 5, wave 2: army templates (2026-10-02).** `src/engine/armyTemplates.js`. The player
names a composition (`nation.armyTemplates`; two defaults, Legion and Siege train, until they
write their own; at most TEMPLATE_MAX_UNITS 12) and queues it in a city as one production item
(`kind: 'army'`, expanded from the template at queue time so later edits never change an order):
the city builds the missing pieces one by one at each class's own cost (cities.js), every unit
appears on the city tile carrying `army: { id, name }`, and the order leaves the queue when the
last piece is done. Actions SAVE_ARMY_TEMPLATE and DELETE_ARMY_TEMPLATE; the city sheet's build
tab has an Armies group and a template editor (name, a counter per class of the age). Tests in
armyTemplates.test.js. Still open in D4: the army sheet grouping units by army (workstream 12),
mercenaries, generals attached to an army by name, the AI building templates.

**Workstream 5, wave 3: the four naval lines (2026-10-02).** `src/data/navalLines.js`. A fleet
keeps `classId: 'naval'` (the domain all 27 readers check) and carries `navalLine`; an older
record is a warship. Warship (every age: War Galley, Trireme, Cog, Frigate, Destroyer; carries
1, then 2 from the Kingdoms; bombards a besieged coastal city for NAVAL_BOMBARD 10 a ship a
turn from its port waters, sieges.js), transport (from the Classical age: Longship, Carrack,
Galleon, Landing ship; carries 3 to 6; fights at 0.4), raider (from the Classical age: Bireme,
Corsair, Privateer, Submarine; carries nothing, sees a tile further, fights at 0.8), carrier
(Modern: two air units, sees a tile further, fights at 0.6). The line scales the ship's hits
(battle.js), its sight (sight.js) and its cargo at recruiting (RECRUIT_UNIT `navalLine`) and
in the city queue (one build item per line of the age, cities.js canQueue). Tests in
navalLines.test.js. Still open in D5b: raiders plundering sea routes for gold, the carrier's air
units, sea tiles in three depths (coast, shelf, ocean; the ocean opens by tech today), naval
battles in the tactical sim.

**Workstream 12, wave 2: the army sheet (2026-10-02).** Tapping one of your army banners in the field on the
flat map (a garrison on its city tile still opens the city card) opens `ArmySheet.jsx` (a bottom sheet on a phone, a docked panel otherwise) for the
stack on that tile: units grouped by army (`unit.army`, from a template order or a name given
here), each with its roster name, strength, morale, supply meter, moves, general and
promotions; the supply zone with its reason; the route with its ETA; orders: March (the stack
on this tile only: `startMarch(regionId, { unitIds })` carries the ids through the march
context into SET_ROUTE), Halt the march, Name this army (RENAME_ARMY tags every unit of the
stack), Disband. The model (`armySheetModel.js`) is pure and tested. Still open in E4: the
sheet on the globe view (its banners still open the city card), merge and split, fortify,
pillage and siege orders from the sheet, the city, nation and empire sheets replacing the
province modal, lenses, the "next" prompt.

**Workstream 12, wave 3: lenses and the marks of E6 (2026-10-02).** `src/components/map/lenses.js`
(pure models, tested) and `LensStrip.jsx`: five lenses on the flat map, a strip of 44 px
buttons bottom left and keys 1 to 5 on a keyboard. Political is the map as before; Yields
writes food, production and gold on every tile your cities own from the local zoom (worked
tiles brighter); Loyalty draws a disc behind every city coloured from green (100) to red (0);
Threat draws a circle of THREAT_RINGS around every enemy stack at war with you (and the rebels)
with its strength; Supply tints the tile of every own army by its supply zone (home green, held
yellow, wild amber, enemy red). The city badge now shows a disaster mark (a flood, a fire, a
plague) and the ground shows crossed swords where a field battle was fought for 5 turns. Still
open in E5 and E6: the Trade lens (routes and plunder risk), the lenses on the globe, pressure
arrows on the loyalty lens, fog as a hatch, the growth arc on the city badge.

---

---

## Appendix 1. Mechanics touched (add-mechanic checklist index)

Economy (yields, upkeep, trade, supplies, strategic resources), population (growth, housing,
amenities, migration, recruitment), research (tree, boosts, science sources), politics
(authority, estates on land, governors, laws effects, AI politics), loyalty (new), diplomacy
(claims, opinion, war goals, peace, demands, AI vs AI), settlers (settler unit, outposts,
natives), succession (characters as governors and generals), events (pins, wonders, era
goals), armies (movement, ZOC, fog, stacking, naval), sieges (walls, HP, encirclement,
assault, sally, relief), supply (per-army meter), battles (types, mapgen from tiles,
deployment, aftermath), AI (all layers), victory (retargeted).

## Appendix 2. Files that change the most

`src/data/geo/*` (new build), `src/data/regions.js` (removed from state), `src/engine/resolveTurn.js`
(phases: cities, armies, sieges, loyalty replace income, unrest, control), `src/engine/gameReducer.js`
(split into `nationActions/`, `cityActions/`, `armyActions/`), `src/utils/helpers.js` (calcIncome
removed), `src/engine/aiEconomy.js` and `src/utils/aiLogic.js` (merged into `src/engine/ai/`),
`src/battle/setup/mapgen.js` and `buildBattleSetup.js` (tile context, battle types),
`src/components/map/*` and `globe/*` (hex rendering), `src/components/modals/ProvinceModal.jsx`
(replaced by sheets), `scripts/simulate.mjs` and the balance-sim skill (new keys).

## Appendix 3. Glossary

| Term | Meaning in this plan |
|---|---|
| Tile | one cell of the geodesic hex grid, about 18,000 km², with static terrain, features, river edges and resources |
| City | the unit of economy, population, production, recruitment and borders; stands on a tile |
| Size | a city's citizens (1 to 30); the simulated variable; works that many tiles |
| Population | people, derived from size, age and buildings, for display and score |
| Border | the tiles a city owns; a nation's border is the union of its cities' tiles |
| Core | a nation's starting city sites at the Dawn start; also a city held long enough to be claimed without AE |
| Outpost | a freshly founded city during its colony progress phase |
| Wilderness | land no city owns; natives may live there |
| Loyalty | a city's attachment to its owner, driven by culture pressure; at 0 the city flips |
| Authority | the merged stability and legitimacy meter of a nation, with a breakdown |
| Manpower | the regenerating pool of recruitable people, from city sizes and the conscription law |
| Supply | an army's provisioning meter, filled inside borders and on supply lines, drained abroad |
| ZOC | zone of control: adjacent enemy armies and forts stop movement |
| Claim | a diplomatic right to a specific city, giving a casus belli |
| Opinion | one nation's view of another, a sum of listed reasons |
| Lens | a map overlay that shows one kind of information (yields, trade, threat, supply, loyalty) |
| Next prompt | the pill that cycles through things that need the player's attention before End Turn |

## Appendix 4. Table of contents

Part A reviews (A1 map, A2 economy, A3 population, A4 research, A5 politics, A6 succession,
A7 diplomacy, A8 army, A9 settlers, A10 battles, A11 AI, A12 events, A13 UX, A14 engine,
A15 scorecard). Part B designs the map (B1 goals, B2 grid, B3 cities, B4 borders, B5 zoom,
B6 the Dawn world and scenario starts, B7 deletions). Part C reworks the macro systems (C1
economy, C2 population, C3 research, C4 politics, C5 loyalty, C6 diplomacy, C7 settlers, C8
characters, C9 events and wonders, C10 victory). Part D is war (D1 armies, D2 sieges, D3
supply, D4 recruitment, D5 battle types, D5b naval and air, D6 AI fronts). Part E is UI (E1
inputs, E2 layouts, E3 next prompt, E4 sheets, E5 lenses, E6 map affordances, E7 battle UI, E8
wireframes, E9 onboarding). Part F data and performance, G the AI layers and turn budget, H
balance targets, I the order of work, I2 pacing, K tests per workstream, L the thin slice, J
risks and decisions, then the appendices.
