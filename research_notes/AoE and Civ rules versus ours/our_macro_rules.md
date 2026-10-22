# Terra Imperium: our campaign map and empire (macro) rules, as the code stands on 2026-10-22

All facts below were read from the repository (branch claude/integration, commit 15e06f83). Paths are relative to
C:/GitWotkspace/terra-imperium. "f100" = the frequency-100 hex grid now loaded; many constants are written in km and
turned into rings with `ringsForKm(km)` (src/data/geo/gridScale.js:45, `round(km / mean neighbour spacing)`).

## 1. Map: grid, terrain, rivers, movement, routes, zone of control, sight, fleets, stacking

### Takeaway
A real-Earth geodesic hex grid (100,002 cells, 29,250 land, about 77 km between neighbours) with Civ-style movement
points derived from km per turn, tile step costs, river-edge crossing costs, A* routes, Civ-style zone of control,
km-based sight, age-gated naval depth, and NO hard one-unit-per-tile rule: stacks are allowed, limited only by a
supply penalty above 2x the tile's combat width, and drawn as one model per tile.

### Cited Findings
- Grid: frequency-100 geodesic hex grid, 100,002 cells, 29,250 land, about 77 km between neighbours, built from Natural Earth, Köppen climate and terrain tiles; every hex is all land or all water — [CLAUDE.md](CLAUDE.md) (Architecture, "New map").
- Terrain is composed: base (grassland, plains, desert, tundra, snow, coast, ocean, lake) + relief (flat, hills, mountains) + feature (forest, jungle, marsh, oasis, floodplain, ice) — [src/data/tileYields.js:7-9](src/data/tileYields.js).
- Base yields: grassland 2F; plains 1F 1P; desert 0; tundra 1F; snow 0; coast 1F 1G; ocean 1F; lake 2F 1G. Hills -1F +2P; mountains yield nothing (until mined); forest +1P; jungle/marsh +1F -1P; oasis +3F; floodplain +3F +1G; river +1G — [src/data/tileYields.js:12-40](src/data/tileYields.js).
- Movement in km a turn by class: `MOVE_KM = { infantry: 306, ranged: 306, cavalry: 613, siege: 204, support: 306, settler: 306, air: 613 }`, default 204, explorer 408, Forced March +102 km — [src/engine/armies.js:44-47](src/engine/armies.js). At f100 that is 4/4/8/3 points (foot/ranged/cavalry/siege) — [armies.js:40-43 comment](src/engine/armies.js).
- Stack pace = slowest unit's points (`stackPace`) — [armies.js:76](src/engine/armies.js).
- Tile step cost: open land 1; +1 hills (or a pass); +1 forest/jungle/marsh; +1 desert/tundra; mountains `TILE_COST_MOUNTAINS = 4` (a mountain pass costs as hills); road 0.5 (`ROAD_COST`), railway 0.25 (`RAIL_COST`); enemy or held land at least `ENEMY_TILE_COST = 2`; snow, ice and water impassable — [armies.js:9-18, 50-58, 137-155](src/engine/armies.js).
- Rivers live on hex EDGES with size classes; crossing adds `RIVER_CROSSING_KM = [0, 38, 77, 154]` km of march (stream/river/great river = 0.5 / 1 / 2 points at f100); a road on both banks halves it; with the Stone Bridges tech a road edge is free and other crossings half — [armies.js:13-17, 53, 125-131](src/engine/armies.js). River data built by scripts/geo/build-tile-terrain.mjs, read via src/data/geo/terrainData.js — [CLAUDE.md](CLAUDE.md).
- Unspent move points bank up to `BANK_CAP = 4` so slow armies cross mountains — [armies.js:59, 9](src/engine/armies.js).
- Harsh-ground attrition: `MARCH_ATTRITION = 0.03` of strength per step into mountains, desert or arctic — [armies.js:64](src/engine/armies.js).
- A* routes (`findTilePath`), max route `ringsForKm(6100)` steps, ties broken on tile id, AI plans with the same costs; enemy tiles on the way to elsewhere cost `ENEMY_PATH_PENALTY = 6` more — [armies.js:62-63, 201](src/engine/armies.js).
- Multi-turn marches (CK3/Civ way): order steps at once with this turn's points, rest walked at the start of later turns; unspent points carry; marching units eat `MARCH_SUPPLY_PER_UNIT = 0.5` supplies (double in enemy land) and +`MARCH_UPKEEP_SHARE = 0.25` gold upkeep — [src/engine/routes.js:1-36, 52](src/engine/routes.js); [src/engine/supplies.js:27](src/engine/supplies.js).
- Access: at peace a route may cross own, vassal, ally and free land; at war it may plan into enemy land but halts at the border of every enemy tile not held; cities are taken via the attack card — [armies.js:19-22](src/engine/armies.js).
- Zone of control: entering a tile next to an enemy army or an enemy fort (manned or not) ends the move for the turn ("Civ") — [armies.js:23-25, 173](src/engine/armies.js). A manned fort also forces a field battle on an army it stops — [src/engine/forts.js:3-17](src/engine/forts.js).
- Sight (fog): `SIGHT_LAND_KM = 200` around own cities' land, `SIGHT_ARMY_KM = 200` for land units (+`SIGHT_HILLS_BONUS_KM = 100` on hills), `SIGHT_FLEET_KM = 200`; 3/3/1/3 rings at f100; shared with allies and vassals — [src/engine/sight.js:2-23](src/engine/sight.js). Start knowledge radius `START_KNOWN_KM = 1000` — [src/engine/fog.js:44](src/engine/fog.js). Explored maps can be swapped/given/bought/sold with majors (value = new land + 0.25 x new sea + 10 per city) — [src/engine/mapTrade.js:1-35, 56-69](src/engine/mapTrade.js).
- Fleets: pace by owner's age `NAVAL_KM_BY_AGE = { stone: 300, bronze: 409, classical: 613, kingdoms: 715, gunpowder: 818, modern: 1124 }`, every water tile costs 1; coast/shelf open to all from Classical (`SHELF_OK_FROM`), deep ocean opens with Gunpowder (`DEEP_OK_FROM`), lakes never — [src/engine/fleets.js:6-10, 32-47](src/engine/fleets.js).
- Embarking: armies are CARRIED by fleets (`unit.embarkedOn`; cargo tile = carrier tile); a fleet next to a coast disembarks onto that tile on own/allied/free land; landing on enemy land is AMPHIBIOUS_ASSAULT — [fleets.js:3-15](src/engine/fleets.js). Blockade: an enemy warship beside a city with no owner warship stops its sea trade — [fleets.js:16-18](src/engine/fleets.js). (No Civ V/VI-style self-embark of land units: they need a transport.)
- Stacking: no one-unit-per-tile limit. Supply cap per tile = combat width x `STACK_WIDTH_MULT = 2` units of one nation; above it each unit loses `STACK_OVER_LOSS = 10` supply a turn — [src/engine/supplyMeter.js:9-10, 41-42, 52](src/engine/supplyMeter.js). Combat width by terrain: plains 6, mixed 5, desert 5, urban 4, forest 4, island 4, hills 4, mountains 3, arctic 3, sea 5 — [src/data/combatWidth.js:8-19](src/data/combatWidth.js). So a plains tile holds 12 units, mountains 6, before penalty.
- Display: "one flag and one model per tile" (a soldier of the tile hides a settler there) — [src/components/map/gl/sceneModel.js:299](src/components/map/gl/sceneModel.js). Map models stay constant size at every zoom (user memory note).
- World sizes: Small 24 majors / 30 independents, Standard 36 / 45, Large 42 / 60; independents density x0.6 / x1 / x1.3; start gap `START_MIN_GAP_KM = 880`, majors `MAJOR_MIN_GAP_KM = 612` — [src/data/worldSizes.js:8-33](src/data/worldSizes.js).

### Inferences
- Our movement is Civ-like (points, tile costs, ZOC, A*) but our stacking is closer to Civ I-IV / EU stacks than Civ V/VI 1UPT; the closest analogue to Civ VI corps/armies is the stack cap of 2x combat width.
- Rivers on edges with crossing costs match Civ VI/VII (Civ V also uses edge rivers); our three river sizes are richer than Civ's single river type.

### Gaps
- Per-tile combat values (defence bonus of hills/forest on the macro map) are inside battle.js / battleType.js; I did not read them.
- The UI had no Embark button in playtest 4 (P4-H6) — [plans/playtest-4-audit.md:146-150](plans/playtest-4-audit.md); I did not check whether it was added since.

## 2. Cities: founding, growth, buildings, districts, tiles, borders, culture and loyalty, buying, production

### Takeaway
Cities are Civ-style (citizens work tiles, food bank with a growth threshold, housing and amenities, one production
queue with overflow, culture-driven border growth, buy tiles for gold) but buildings are nine upgrade-in-place
category lines, and only three lines put a district on a tile with Civ VI-like adjacency. Loyalty is Civ VI-style
culture pressure with flips to neighbours or to free/independent cities.

### Cited Findings
- Settling rule: `CITY_SPACING_KM = 306` (min 2 rings; "one ring less across water" per CLAUDE.md) used for founding, starts and audit — [src/data/geo/citySpacing.js:15-18](src/data/geo/citySpacing.js).
- Settler: built in a city's queue, city must be size `SETTLER_MIN_SIZE = 2` and loses one citizen; cost `SETTLER_BASE_COST = 60` + `SETTLER_COST_PER_CITY = 10` per city owned — [src/engine/world/cities.js:94-96](src/engine/world/cities.js); [src/engine/settlers.js:4-8](src/engine/settlers.js). Settler moves 306 km/turn, strength 100, no combat — [settlers.js:56-58](src/engine/settlers.js).
- Founding makes an OUTPOST (size 1, claims land, yields and builds nothing) until progress reaches `OUTPOST_DONE = 100` at `OUTPOST_PROGRESS = 14`/turn x terrain (hills/forest 0.7; mountains/desert/arctic 0.4), divided by the speed multiplier: about 8 turns on open land, 18 in desert at reference pace — [settlers.js:10-16, 59-61](src/engine/settlers.js).
- Outpost slots by age: stone 1, bronze 2, classical 3, kingdoms 3, gunpowder 4, modern 4 — [settlers.js:62](src/engine/settlers.js).
- A new city claims `foundingDisk` of `FOUNDING_AREA_KM2 = 63_470` km² (same land on any grid) — [src/data/geo/gridScale.js:79-86](src/data/geo/gridScale.js).
- AI site choice: `scoreSite` (yields of centre and ring, resource, river, coast, distance from capital), min quality `SITE_SCORE_MIN = 4`, search `AI_SETTLE_KM = 1122`, max send 1734 km, retry 5 turns, disband after 15 idle — [settlers.js:20-28, 63-69](src/engine/settlers.js).
- City model: size 1..`MAX_SIZE = 30` citizens; works `size` tiles plus the free centre; automatic allocation by focus (balanced, food, production, gold) with optional tile locks — [cities.js:8-12, 57-58, 106](src/engine/world/cities.js). Centre minimum 2F 1P 1G — [cities.js:62](src/engine/world/cities.js).
- Food: `FOOD_PER_CITIZEN = 2`; growth threshold `round((15 + 6 x size + size^1.8) x speedMult)` — [cities.js:57, 112](src/engine/world/cities.js). Growth is logistic and stops past housing + `GROWTH_HEADROOM = 1.75` — [cities.js:14-16](src/engine/world/cities.js); [src/engine/population.js:40](src/engine/population.js). Starving loses `STARVE_LOSS = 1` citizen — [cities.js:63](src/engine/world/cities.js). Granary-type techs keep up to 50% food on growth — [cities.js:648](src/engine/world/cities.js).
- Housing = `HOUSING_BASE = 2` + `HOUSING_WATER = 1` + Food-line tier + techs (aqueducts +2, canal locks +2, highway systems +4) — [cities.js:17, 59-61](src/engine/world/cities.js). Market towns and the capital add housing (`MARKET_PER_HOUSING`, `CAPITAL_HOUSING_MAX = 4`, central place up to 12) — [src/engine/world/market.js:30-45](src/engine/world/market.js).
- Amenities: need `floor((size - 2) / 2)`; supplied by national luxuries and the Culture line; +10% growth at +2 surplus, -25% growth when short, +2 unrest per missing — [cities.js:64-67, 114](src/engine/world/cities.js).
- Science per city: `SCIENCE_PER_SIZE = 0.5`; culture `CULTURE_BASE = 1` + 0.25 x size + 2 per Culture tier; Palace +4G +2P +2S +1C — [cities.js:68-74](src/engine/world/cities.js).
- Production: one item at a time with a queue; overflow carries; progress belongs to the item (kept if reordered or removed) — [cities.js:21-27](src/engine/world/cities.js). Units: `UNIT_BASE_COST = 40` x class (infantry 1, ranged 1.1, cavalry 1.5, siege 1.6, naval 1.4, support 1.2, air 2.2) x age `unitCostMult` (stone/bronze 1, classical 1.6, kingdoms 2.2, gunpowder 2.8, modern 3.4) — [cities.js:97-98](src/engine/world/cities.js); [src/data/ages.js:17-77](src/data/ages.js). Tile improvements are built from the city queue at `IMPROVEMENT_COST_PER_TURN = 10` per improvement turn (no worker/builder unit) — [cities.js:100, 394](src/engine/world/cities.js). Improvements: farm, pasture, camp, mine, quarry, lumber_camp, fishing_boats, plantation, oil_well, road, fort — [src/data/tileYields.js:107-164](src/data/tileYields.js).
- Buildings: nine category lines, one building per category per city, upgraded in place, tiers gated by tech: Food (Storage Pits, Granary, Irrigation, Farm Estate, Crop Rotation Farm, Mechanized Farm), Economy (Market +15% tax +3G ... Stock Exchange +50% +12G), Military (Warrior Lodge ... War College), Defense (Earthwork Ditch fort 0.5, Palisade 1, Stone Walls 2, Star Fort 4, Bunker Network 6), Science (Tablet House 0.5, Library 2, Scriptorium 4, University 6, Research Lab 9 tech points), Industry (Workshop, Manufactory, Factory; later tiers add unrest), Culture & Order (Stone Circle ... Civic Center, stability), Naval (coastal only, trade income), Logistics (supply range) — [src/data/buildings.js:22-133](src/data/buildings.js). Extraction buildings (Copper Mine stone, Iron Foundry kingdoms, Oil Well modern) are separate per-resource sites — [buildings.js:139-141](src/data/buildings.js).
- Districts: only Science (Campus: +1 base, +1 per adjacent mountain max 2, +1 river), Culture (Temple Quarter: +1 per adjacent wonder, +1 beside centre) and Economy (Market Quarter: +1 river, +1 coast, +1 road) take a tile, placed automatically on the best-adjacency border tile when the line's first post-Stone tier completes; `DISTRICT_BASE = 1`; pillaged districts pay nothing for 5 turns — [src/engine/districts.js:1-16](src/engine/districts.js).
- Borders: culture fills a bank; the cheapest eligible tile (by ring and count) is claimed by yield score; tile cost constants `TILE_COST_BASE = 20`, `TILE_COST_PER_RING = 10`, `TILE_COST_PER_TILE = 5`; buy with gold at `BUY_TILE_MULT = 3`; border reach 204 km in every age, max 306 km — [cities.js:33-34, 79-93](src/engine/world/cities.js).
- Buying production (rush): `gold = ceil(missing production x 4 x (1 + 0.2 x heat))`, heat +1 per rush capped at 5, cools every 5 reference turns; settlers x1.5; never wonders or contested cities; arrives next turn — [src/engine/spending.js:9-24, 44-51](src/engine/spending.js). Also "standing works" (infrastructure/defence levels, +25% a level) and "invest in growth" — [spending.js:25-34, 135-137](src/engine/spending.js).
- Loyalty (0..100) and culture shares per city: pressure from cities within `PRESSURE_KM = 1330`, weight size / (1 + rings)²; own people press at `SELF_WEIGHT = 0.6`; target = 50 + 100 x (owner share - biggest other share), never loyal under 25% owner share; + 10 per garrison unit (cap 30); amenities (cap 10); -20 conquered (20 turns); -20 capital lost; governor +2+skill (-5 ungoverned); moves 5 a turn — [src/engine/loyalty.js:1-30, 52-74](src/engine/loyalty.js).
- Flip at 0: non-capital flips to the bordering nation pressing most, else becomes a free city/new independent; joins best neighbour after 10 turns; 30-turn flip cooldown; 30-turn founding grace — [loyalty.js:22-29, 71-74](src/engine/loyalty.js).
- Governors: groups within 816 km, up to 6 cities, +1 food, +10% production, +1 culture, +2 loyalty, x0.9 unrest — [src/engine/governors.js:22-34](src/engine/governors.js).
- Sieges reduce a besieged city to working ring 1 for production and taxes at x0.75 — [cities.js:338](src/engine/world/cities.js); [src/engine/sieges.js:11-12](src/engine/sieges.js).
- AI production: utility scoring per option (settler, next building tier = doctrine x need x affordability, wonder, units) — [src/engine/aiProduction.js:1-20](src/engine/aiProduction.js).

### Inferences
- Buildings are closer to EU4/Civ "one per category" upgrade lines than Civ VI's district + many buildings; the three adjacency districts are a thin Civ VI layer.
- No builder/worker unit: improvements come from the city queue (closer to Civ VII than V/VI).

### Gaps
- The header of src/data/buildings.js (lines 10-14) still says construction is INSTANT; cities.js says buildings go through the production queue. The cities.js description matches the current production code; the buildings.js comment looks stale. Not verified by running the game.
- The exact tile culture-cost formula (how the three constants combine) was not read line by line.

## 3. Science, research, boosts and ages

### Takeaway
Civ-style science into a current tech with a queue and overflow; 60 techs (5 lines x 2 per age x 6 ages). A nation's
age is its own research age: it advances after 6 of the current age's 10 techs. Cost is priced by age only and scaled
by game speed per payer's age; map-fact boosts give 40% of a tech once (Civ VI eurekas); a Civ IV/V-style diffusion
discount helps laggards. The code has 6 ages; the 8-age plan (adding Information and Future) is not in code yet.

### Cited Findings
- Research loop: science goes into the current tech; overflow carries into the queue; with nothing picked it banks; switching keeps progress; picking a deep tech queues prerequisites — [src/engine/research.js:1-17](src/engine/research.js).
- Cost: `RESEARCH_AGE_BASE[age] x speedCostMult(speed, payer's age) x (1 + cost modifiers and diffusion)`; `RESEARCH_AGE_BASE = { stone: 15, bronze: 17, classical: 82, kingdoms: 1200, gunpowder: 2400, modern: 6000 }`; a nation's first tech costs x0.25; Research Focus +10% science on the focused line; AI spends banked science every 3 turns — [research.js:10-11, 42-53](src/engine/research.js).
- Calibration target: about half the majors past Bronze at turn 48, past Classical at turn 157, Kingdoms ending near 324 (Normal); Gunpowder and Modern are "first guesses" — [research.js:19-23 comment](src/engine/research.js).
- Tech tree: 10 techs per age in each of 6 ages (60 total), five lines with two techs per age, linear within each line — counted from `age:` fields in [src/data/techTree.js](src/data/techTree.js); header [techTree.js:2-4](src/data/techTree.js).
- Age advance: `TECH_AGE_ADVANCEMENT_THRESHOLD = 6` techs of the current age — [techTree.js:188](src/data/techTree.js); [research.js:140](src/engine/research.js). No calendar gate: "no calendar floor and no cap" — [techTree.js:7-9](src/data/techTree.js).
- Ages in code: stone, bronze, classical, kingdoms, gunpowder, modern (`AGE_ORDER`), unit power attack/defence 7/6, 10/8, 18/14, 26/20, 34/26, 42/32 — [src/data/ages.js:13-77](src/data/ages.js). The plan requires eight ages adding `information` and `future`, ending in robot armies — [plans/2026-10-20-001-feat-eight-ages-plan.md, R1](plans/2026-10-20-001-feat-eight-ages-plan.md).
- Boosts: a met map fact gives `BOOST_SHARE = 0.4` of a tech's cost once; 60 boost entries; facts include cities, sizes, resources, river, coast, forest, hills, roads, harbour, science building, trade, at war, sieges laid, wonders, battles won; works for AI too — [src/data/boosts.js:1-9](src/data/boosts.js); [src/engine/boosts.js:1-6, 84](src/engine/boosts.js).
- Diffusion: cost x (1 - 0.3 x share of known economy that has it), x (1 - 0.45 x share) when a known holder is in a later age, x1.2 if nobody has it; contact radius by age 900 / 1500 / 2500 / 4000 / 10000 / 40000 km; trade partners weigh x2 — [src/engine/techDiffusion.js:1-36](src/engine/techDiffusion.js).
- Stone phase: first cities need `economy_agriculture` and `governance_chiefdoms`; without writing costs x2; foraging villages capped at size 3 outside agricultural hearths — [src/engine/stonePhase.js:12-16](src/engine/stonePhase.js); [src/data/hearths.js:10-11](src/data/hearths.js).
- Era goals: scored when a nation leaves its age; 2+ goals met (`ERA_GOALS_FOR_LEGACY = 2`) gives a 50-turn national bonus (`ERA_LEGACY_TURNS = 50`) — [src/data/eraGoals.js:8-9](src/data/eraGoals.js); [src/engine/eraGoals.js:1-7](src/engine/eraGoals.js).

### Inferences
- Per-nation ages by tech match Civ VII's per-civ progression less than they match Civ V/VI eras (Civ VI's era is world-wide); our "6 of 10 techs" advance is like Civ V's era by tech count.
- With only 10 techs per age, our tree is much smaller than Civ V (about 80) or Civ VI (about 77 techs plus 61 civics); there is no separate civics tree.

### Gaps
- No tech "value" scoring for the AI: a fixed sort order — [plans/research-ai-math.md:28](plans/research-ai-math.md).

## 4. Economy: gold, upkeep, loans, resources, trade

### Takeaway
Gold comes from city tax/production development, buildings and trade; spent on unit upkeep (5 a unit), building
upkeep (0.5 x (tier+1)), fort upkeep, advisors, loans, rush buying and standing works. Resources are Civ-style
bonus/luxury/strategic on tiles. Trade pacts use a gravity model. Playtests show gold piling up with few sinks.

### Cited Findings
- Expense ledger (player): army upkeep, marching upkeep, navy upkeep, fort upkeep, building upkeep, advisor salaries, loan interest — [src/engine/economy.js:114](src/engine/economy.js).
- `UNIT_UPKEEP_GOLD_PER_TURN = 5` (scaled by a maintenance slider); `FORT_UPKEEP_GOLD_PER_FORT_LEVEL = 1`; `BUILDING_UPKEEP_GOLD = 0.5` x (tier + 1) per standing building (H-13), Defense line excluded — [src/data/actionCosts.js:135-156](src/data/actionCosts.js); [economy.js:131-156 comments](src/engine/economy.js).
- Loans: only after Banking Houses; capacity 3 + bank tiers (max +3) + 1; interest 4% +1% per existing loan, -1% with Banking Houses, min 1%; size max(200, 5 x current net income) — [actionCosts.js:160-170](src/data/actionCosts.js); [economy.js:55-75](src/engine/economy.js).
- Bankruptcy: loans cleared, -3 stability, -20 prestige, a 10-turn modifier — [actionCosts.js:181-187](src/data/actionCosts.js); [economy.js:128-147](src/engine/economy.js).
- AI economy: real gold/manpower/tech points per AI nation with loans and bankruptcy, spending on a cadence (government, buildings, research) — [src/engine/aiEconomy.js:1-12](src/engine/aiEconomy.js). The economy.js header still says several functions are "honestly player-only" — [economy.js:2-7](src/engine/economy.js).
- Tile resources: bonus (wheat, rice, cattle, sheep, deer, fish, bananas, dates, stone, timber, reeds), luxury (whales, gold, silver, gems, salt, furs, honey, spices, dyes, sugar, cotton, silk, tea, wine, olives, incense, papyrus), strategic (horses, copper, iron, coal, oil, uranium, rubber); strategic counted per turn from improved tiles; luxuries give amenities and gold — [src/data/tileYields.js:10-12, 44-80](src/data/tileYields.js). Coal known from Gunpowder, oil/rubber/uranium Modern; copper and horses from techs — [tileYields.js:89-91](src/data/tileYields.js).
- Recruiting needs the age's strategic resource; missing it raises the gold price (`RECRUIT_STRATEGIC_RESOURCE_BY_AGE`) — [economy.js:150-157](src/engine/economy.js); [actionCosts.js:197](src/data/actionCosts.js).
- Trade pact value (gravity model): `goldMult = 0.1 x sqrt(Y_partner / Y_me) / (1 + km / 1000)`, sea legs x0.5 km, soft-capped at +20% per route; Y = summed city size — [src/engine/tradeValue.js:1-40](src/engine/tradeValue.js). Cut routes are timed events (tradeDisruptions.js) — [CLAUDE.md](CLAUDE.md).
- Tribute is priced on the payer's city income (`TRIBUTE_INCOME_SHARE`), at least 2 + age rank — [src/engine/tributePricing.js:1-18](src/engine/tributePricing.js).
- Devastation from battles cuts income up to 50% (`DEVASTATION_INCOME_PENALTY = 0.5`), decays 4 a turn — [src/engine/aftermath.js:33-39](src/engine/aftermath.js).
- Playtest 4 (300 turns as Kemet): 28,521 gold and about 1,700-2,040 of each ADM/DIP/MIL power unspent at T300; rush was the only real sink — [plans/playtest-4-audit.md:138-143](plans/playtest-4-audit.md).
- Use measurement (6 worlds x 301 turns): e.g. Crop Rotation Farm never built by anyone; no AI path buys infrastructure, defences, growth or loans; highest age reached Gunpowder (94 AI nations) — [plans/economy-use-2026.md:1-17, 339-352](plans/economy-use-2026.md).

### Inferences
- Civ V's empire-wide happiness and Civ VI's amenities are mirrored by our per-city amenities from luxuries; Civ-style "gold purchase" exists as rush with a heat surcharge.

### Gaps
- The full gold income formula (helpers.js calcIncome, tax rates in src/data/taxRates.js) was not read.

## 5. Government, laws, reforms, decrees, rulers, renown, virtues, ambitions, legacy and victory

### Takeaway
Five government types with per-age reform tiers that stack; six law categories with tiered options; a decree bank
(cap 3, +1 at Majesty 4 and 8) earned by deeds that pays for acts of state; one ruler for the whole game who levels
with renown and buys virtues in five branches; per-age ambitions; and one legacy score ranked at the ending, with
domination (25% of other capitals) as the only direct win.

### Cited Findings
- Government types: Tribal Council (stone), Monarchy and Theocracy (stone, after first cities), Republic (classical), Dictatorship (modern); a reform per age tier, picked tiers stack; changing type costs 2 decrees and -2 stability and resets reforms; a reform costs 1 decree — [src/data/government.js:1-31](src/data/government.js).
- Laws: categories include taxation (Tribute, Land Tax +10% ... Progressive Tax +30%), conscription (Warrior Caste ... Volunteer Army), religion (State Cult ... Secularism), trade (Barter, Mercantilism, Free Trade, Autarky), land (Communal ... Collectivization), justice (Customary Law ... Martial Law); `LAW_CHANGE_COOLDOWN_TURNS = 5` — [src/data/laws.js:19-74](src/data/laws.js); category names from [plans/economy-use-2026.md:95-150](plans/economy-use-2026.md).
- Authority 0..100 = 50 + 8 x stability + (legitimacy - 50)/2 + (ADM+DIP+MIL - 9) + 5 x law stability - WE/4 - overextension/4 (cap 25) - 20 capital lost; under 25 no law can be enacted; under 10 counts toward civil war — [src/engine/authority.js:1-30](src/engine/authority.js).
- Decrees: cap `DECREE_CAP_BASE = 3` (+1 at Majesty 4 and 8); deeds grant one (war won, era goal met, wonder, ambition); trickle while below 2: every `speedTurns(max(6, 10 - 0.5 x (adm - 3 + pace)) x (1.5 if legitimacy < 50))` — [src/engine/decrees.js:1-11](src/engine/decrees.js); [src/data/decrees.js:7-28](src/data/decrees.js). Acts costing decrees: justified war 1, demand 1, fabricate claim 1, alliance 1, royal marriage 1, vassalize 1, annex vassal 1, change government 2, reform 1, move capital 1, shift identity 1, change law 1, raise stability 1, reshape ruler 1 — [src/data/decrees.js:43-58](src/data/decrees.js).
- Ruler: one per major for the whole game, no death or heir; attributes capped by research age; levels from renown give attribute points, virtue points every even level and per era legacy — [src/engine/rulers.js:1-9](src/engine/rulers.js). Advisors: hire 50 x level², salary 2 x level² — [rulers.js:121-122](src/engine/rulers.js).
- Renown grants: +2 per reference turn holding the capital, city founded 15, city taken 25 (+50 capital), independent city 15, battle won 5 (+5 outnumbered), war won 40, defence survived 15, tech 4 + 4 x age index, wonder 30, era goal 40, ambition 30; conquest renown damped by empire size; catch-up multiplier for rulers below the median level — [src/data/rulers.js:20-34](src/data/rulers.js); [src/engine/renown.js:1-13](src/engine/renown.js).
- Virtues: five branches (Conqueror, Builder, Sage, Diplomat, Prophet), six tiers costing 1, 1, 1, 2, 2, 3 points, capstone at tier 6 — [src/data/rulerVirtues.js:36-40](src/data/rulerVirtues.js).
- Ambitions: 3 offers per age (`AMBITION_OFFERS = 3`) drawn by hash, plus the people's historical one in its peak age; each pays renown, one decree and a legacy record — [src/engine/ambitions.js:1-13](src/engine/ambitions.js); [src/data/ambitions.js:9-12](src/data/ambitions.js).
- Legacy score: era goal 10 + 5 x age index, era legacy 20 + 10 x i, ambition 30 + 10 x i — [src/data/legacy.js](src/data/legacy.js); [src/engine/legacy.js:1-8](src/engine/legacy.js).
- Victory: domination = capitals of `DOMINATION_CAPITAL_SHARE = 0.25` of every other nation; otherwise the game ends on the ending signal and legacy ranks majors — [src/data/victoryConditions.js:1-13](src/data/victoryConditions.js).
- Ending: turn limit Fast 440, Normal 923, Marathon 1514, or a nation finishing every tech of the Future age (nothing fires it while that age does not exist) — [src/data/ages.js:137-140](src/data/ages.js); [src/engine/ending.js:1-7](src/engine/ending.js).
- Playtest 4 saw rulers change every 3 turns (P4-H5); the code now states one ruler a game — [plans/playtest-4-audit.md:152-155](plans/playtest-4-audit.md); [rulers.js:2-3](src/engine/rulers.js).

### Inferences
- Laws + reform tiers sit between Civ VI policy cards (swappable) and Civ V social policy trees (permanent); stacking per-age reforms resemble Civ VII's per-age civics.
- Legacy score with era goals and ambitions mirrors Civ VII's Legacy Paths more than Civ V/VI victory types; we have no science, culture, religious or diplomatic victory.

### Gaps
- Exact per-age reform list for every type and the full virtue list were not transcribed.

## 6. Diplomacy, wars, peace, pacts, demands, tribute, independents, AI war decisions

### Takeaway
Opinion is an itemised Civ VI-style sum; war declarations are rare, made only by Tier-1 AIs through a flat roll
scaled by an expected-value target pick; peace uses EU-style terms (5 of 8); AE builds defensive leagues;
independents are Civ VI/VII city-state analogues that raid, demand tribute, trade and can be courted to join.

### Cited Findings
- Opinion reasons, clamped -100..100: stranger baseline 8; -0.6 per hostility point; shared border tiles -1 each beyond 5 (max -20); settled within 612 km -15 (fades 1/turn); holds my people's city -10 each; claim -10; trade +5 (max 15), alliance +25, open borders +10, defensive pact +15, royal marriage +15, same identity lean +5; AE -1 per point above 20; rival -30; broken truce -20 — [src/engine/opinion.js:1-15](src/engine/opinion.js); [src/data/opinion.js:7-31](src/data/opinion.js).
- AI war roll: base chance `BASE_WAR_ROLL_CHANCE = 0.02` per turn for Tier-1 nations (top 20 by military plus neighbours), x doctrine x difficulty x coalition x opinion factor max(0, (20 - opinion)/60) x ruler; at most 2 own wars (`MAX_AI_WARS`), target fighting under 3; second front x0.35 — [src/utils/aiLogic.js:80-92](src/utils/aiLogic.js); [opinion.js:13-15](src/engine/opinion.js); [plans/research-ai-math.md:14-16](plans/research-ai-math.md).
- Target choice by expected value: `EV = 0.5 x (p x gain - (1 - p) x risk) - 4`, p from a soft Lanchester war model (`WAR_EDGE = 0.85`, `WAR_SHARPNESS = 1`), perceived enemy army off by up to 35% outside sight, refreshed every 10 turns — [src/engine/warOdds.js:1-37](src/engine/warOdds.js).
- Runaway coalition: a nation with 15% of world military triggers a x4 war roll from Tier-1 members; hostility rises 3/turn — [aiLogic.js:99-115](src/utils/aiLogic.js).
- Casus belli at hostility 70 — [src/engine/diplomacy.js:67](src/engine/diplomacy.js). Truce 10 turns (`TRUCE_DURATION_TURNS = 10`); the AI never breaks one, the player may at a cost — [src/data/actionCosts.js:299](src/data/actionCosts.js); [diplomacy.js:9-16](src/engine/diplomacy.js).
- Peace terms implemented: cede, gold, reparations, humiliate, vassalize (annul treaties, change government, release dropped) — [src/engine/peace.js:7-12](src/engine/peace.js). Stalemate: 15 idle turns (min 20 turns of war) makes the AI offer the player white peace — [diplomacy.js:397-398](src/engine/diplomacy.js).
- AE: 1 per development point taken (`AE_PER_DEV_POINT = 1`), decays 2/turn, spreads to the captured city's neighbours and former owner; claims x0.5, cores x0 — [src/data/actionCosts.js:309-312](src/data/actionCosts.js); [src/engine/expansion.js:1-13](src/engine/expansion.js); [src/engine/claims.js:29-34](src/engine/claims.js). Defensive league forms when 2+ nations hold AE 40+ against one nation, members leave under 15 — [src/engine/pacts.js:1-20](src/engine/pacts.js).
- Vassals: liberty desire target = 35 x power ratio (cap 2) + 8 per overlord war (max 3) + 0.25 x WE + 12 if in debt - 15; moves +3/-2 a turn; independence-war chance base 4% — [src/engine/vassals.js:1-27](src/engine/vassals.js).
- Demands (AI majors): on a period, a Tier-1 nation at least `AI_DEMAND_RATIO` times stronger with troops near demands a claimed city (never a capital), a stop to settling, or tribute; refusal gives a casus belli; blocked by war, truce, agreements, friendship, cooldowns — [src/engine/aiAccords.js:1-40](src/engine/aiAccords.js).
- Independents: one-city nations (`kind: 'independent'`); count by world size and density; at most a third raiders, the rest city-state types with patron bonuses; no research, ruler or economy pool; garrison target 1 + size/2; never settle; anyone may attack them without a war; their city costs half AE — [src/engine/independents.js:1-28](src/engine/independents.js).
- Independent AI: thinks every few turns; raids improvements, trade routes, settlers, outposts, or sacks weak cities by a score; demands tribute; tribute = truce both ways; grudges — [src/engine/raids.js:1-38](src/engine/raids.js). Joining a major by attitude held for some turns or by overwhelming nearby strength; mercantile ones trade; majors court, conquer or demand tribute — [src/engine/indepPolicy.js:1-34](src/engine/indepPolicy.js).
- `canFight` / `canAttack` is the single hostility gate — [src/engine/hostility.js:1-20](src/engine/hostility.js).
- AI operations: fixed pWin bars — fight 0.25, assault 0.30 (and city HP at or under 30%), field seek 0.35, relief and landing 0.40, sally 0.50 (and 1.3x strength), strike 0.50 — [src/engine/aiOperations.js:59-84, 250](src/engine/aiOperations.js).
- Playtest 4 headless: 12 wars between majors in 300 turns, median length 12 turns, 4.4 battles a war; 52% of war stacks idle at home — [plans/playtest-4-audit.md:237-242](plans/playtest-4-audit.md).

### Inferences
- War frequency is EU-like rare and gated ("quiet by design" per CLAUDE.md); Civ AIs declare far more freely.

### Gaps
- Alliances, royal marriages and open borders for the player (accords.js) were not read in detail.

## 7. Campaign combat: field battles, sieges, auto-resolve, Lanchester, supply, war exhaustion, events

### Takeaway
Stacks fight adjacent stacks (field), assault cities (invasion/cityAssault) or are forced into battle by manned
forts; every battle can be commanded in real time or auto-resolved through the same outcome service. Sieges grind
wall HP but never take a city. An army supply meter, war exhaustion from real costs, devastation and an event deck
complete the war layer.

### Cited Findings
- Field battle: a stack attacks an enemy stack on an adjacent non-city tile; decisive — loser units still on the field destroyed, those that fled step back one tile; the winner does not advance — [src/engine/fieldBattle.js:1-17](src/engine/fieldBattle.js).
- All battles end in one call `applyBattleOutcome` (idempotent by operation id) — [CLAUDE.md](CLAUDE.md); [src/engine/battleOutcome.js](src/engine/battleOutcome.js).
- Auto-resolve uses the same inputs as a commanded battle (supply, starvation, plague, militia, walls' HP) plus auxiliaries trained in the battle economy; walls without siege engines hold the gate; routed units escape by chance (more pursued with cavalry) — [src/engine/autoBattle.js:1-35](src/engine/autoBattle.js).
- Small unwalled towns or empty outposts fall on Auto without a battle screen (setting) — [src/engine/battleThreshold.js:1-7](src/engine/battleThreshold.js).
- City assault on Auto: `CITY_DEF_BASE = 500` + 150 per size, walls x0.5 each, siege x2 vs city, cavalry x0.6, roll spread 30% — [src/engine/cityAssault.js:38-50](src/engine/cityAssault.js).
- Lanchester (AI estimate only, never the rule): power = (effA x NA²)/(effB x NB²); ratio = edge x power^SHARPNESS; pWin = ratio/(1+ratio); shaken units count by morale above 20 — [src/engine/lanchester.js:1-30](src/engine/lanchester.js); research note gives `r = 0.94 x power^4.5` — [plans/research-ai-math.md:11-13](plans/research-ai-math.md).
- Sieges: wall HP = 200 x (1 + walls) x (1 + size/10); damage/turn = 40 per siege unit + 15 per other (x1.5 Siege Engineering) - 5 x walls regen; encirclement (every ring-1 land tile + blockade) doubles damage and stops regen; relief heals 10% a turn; "A SIEGE NEVER TAKES A CITY" — assault required — [src/engine/sieges.js:1-48](src/engine/sieges.js). Playtest: 840-HP walls fall in 7 turns — [plans/playtest-4-audit.md:253](plans/playtest-4-audit.md).
- Supply meter 0..100 per unit: home +50, held 0, wild -10, enemy -20 (-10 within a supply line of 816 km, +204 km on roads), hungry nation -10 more, over stack cap -10; at 0 lose 5% strength and 10 morale a turn — [src/engine/supplyMeter.js:1-44](src/engine/supplyMeter.js).
- War exhaustion: per turn at war `2 + 1 x min(3, own cities besieged) + 10 x share of own cities held by the enemy`, x law multiplier; battles add loser 2 + 12 x loss share, winner 1; max 100 — [src/engine/warBurden.js:1-17](src/engine/warBurden.js); [src/engine/aftermath.js:41-44](src/engine/aftermath.js).
- Devastation: +12 per battle + 40 x share destroyed, -4/turn; -50% income and -0.4% growth at max — [aftermath.js:33-39](src/engine/aftermath.js).
- No captives; lost units are gone (decision 37) — [CLAUDE.md](CLAUDE.md).
- Events: one per turn at most — a due story (once per game, by age progress), else a due follow-up link, else sometimes a procedural card; cooldowns template 14, family 5, city 7 turns — [src/engine/eventDeck.js:1-13, 66](src/engine/eventDeck.js). Crises are civil wars, disasters and rebellions (civilWar.js, disasters.js, rebellion) — [src/engine/resolveTurn.js:411, 764](src/engine/resolveTurn.js).

### Inferences
- Unlike Civ's per-unit HP combat with ranged bombardment, our macro layer hands every engagement to a real-time battle or its calibrated auto-resolve; city capture needs a battle, as in Civ V/VI where a city must be reduced and then entered.

### Gaps
- battle.js (the auto-resolve core: damage per round, terrain modifiers, morale rout at 20) was not read here.

## 8. Turn structure, game length, player actions per turn

### Takeaway
One `resolveTurn` runs about 30 fixed phases for the whole world; game length is a turn limit by speed (440 / 923 /
1514). Speed scales research, production and growth costs per payer's age. No measured "clicks per turn" figure
exists; playtest action counts suggest very few actions per turn in the middle game.

### Cited Findings
- Phase order in resolveTurn: marches, time, sieges, cities, income, unrest drift, rebellion, supply, loyalty and culture, movement reset and morale, AI growth, AI economy, rulers, national power, capitals, disasters and civil war, economy upkeep, diplomacy (AE decay...), great projects, AI recruitment, AI war declarations, AI war progress, elimination, independents, majors and independents, war exhaustion, events, assemble, defeat, victory — [src/engine/resolveTurn.js:265-1203](src/engine/resolveTurn.js) (section markers).
- resolveTurn does nothing while an event, peace offer or pending defence battle is open — [CLAUDE.md](CLAUDE.md).
- Speeds: Fast cost x0.8 (kingdoms 10/12, modern 1), 440 turns; Normal x1.6 stone/bronze, 20/12 classical, 10/6 kingdoms, 2 gunpowder/modern, 923 turns; Marathon 2/4/4/(10/3)/4/2, 1514 turns; units and buildings take only 50% of the extra over Normal (`TRAIN_SPEED_SHARE`, `BUILD_SPEED_SHARE`) — [src/data/ages.js:137-177](src/data/ages.js).
- Waits are written in reference turns and scaled by `speedTurns` — [ages.js:179-183](src/data/ages.js).
- Playtest 4 per-action counts over 300 turns (browser): QUEUE_PRODUCTION 88, RESOLVE_EVENT 64, SET_SETTLER_TARGET 17, RUSH_PRODUCTION 14, RESOLVE_DEFENSE_AUTO 13, SET_ROUTE 6, MOVE_PRODUCTION 5, ACCEPT_PENDING_PEACE 4, DISEMBARK_UNIT 4, ANSWER_DEMAND 3; 30 of 133 action types used; "most of turns 160 to 260 were End Turn" — [plans/playtest-4-audit.md:41-43, 278-300](plans/playtest-4-audit.md).
- Turn time: 200-900 ms in the browser, 0.28 s headless; budget 80 ms/turn under PERF_CHECKS — [plans/playtest-4-audit.md:96](plans/playtest-4-audit.md); [CLAUDE.md](CLAUDE.md).

### Inferences
- About 0.8 non-End-Turn actions per turn over 300 turns (sum of the rows above is about 220, excluding APPLY_TURN_RESULT); this is far fewer decisions per turn than a typical Civ turn with many units.

### Gaps
- No direct measure of player clicks or taps per turn exists in the plans; the counts above are reducer actions, not taps.

## 9. Known gaps and open items in the plans

### Takeaway
The playtest-4 audit (pre-dating some fixes) flags trust breakers (battle result vs screen, map crash, post-load
registry), a gold bank with no sinks, missing embark UI and research waits; the AI-math research lists flat rolls
and fixed bars to replace with expected-value and utility curves; the eight-ages plan's Information and Future ages
are not in code yet.

### Cited Findings
- P4-C1 map crash after an unseen loyalty flip; P4-C2 commanded battle result differs from the screen after reload; P4-H1 cities cannot be opened after load; P4-H3 currencies pile up; P4-H4 squads go idle; P4-H5 rulers every 3 turns; P4-H6 no embark UI; P4-H7 research waits 40-80 turns for a calendar date — [plans/playtest-4-audit.md:109-165](plans/playtest-4-audit.md). (Research now has no calendar gate per [src/data/techTree.js:7-9](src/data/techTree.js); one ruler a game per [src/engine/rulers.js:2-3](src/engine/rulers.js). Whether C1, C2, H1, H6 are fixed was not checked.)
- Scorecard sum 76/150; economy and sinks 3/10, systems consistency 3/10, AI macro 5/10, diplomacy 5/10 — [plans/playtest-4-audit.md:80-100](plans/playtest-4-audit.md).
- AI-math gaps: battle go/no-go uses fixed pWin bars that ignore losses and prize; war declaration is a flat roll; recruitment a flat 35% roll with fixed class mix (infantry 45%, ranged 25%, cavalry 20%, siege 10%); research has no tech value — [plans/research-ai-math.md:9-30](plans/research-ai-math.md); [src/utils/aiLogic.js:57, 198](src/utils/aiLogic.js). The user parked this plan on 2026-10-20 (memory note).
- Economy use: several tiers, laws and reforms are never used by player or AI; no AI path buys infrastructure, defences, growth or loans; cut list waits for the user's pick (U34 parked) — [plans/economy-use-2026.md:347-352](plans/economy-use-2026.md).
- Eight ages: Information and Future, robot armies, retire the space race and nukes; R3 6-of-10 advance is in code, the new ages are not — [plans/2026-10-20-001-feat-eight-ages-plan.md](plans/2026-10-20-001-feat-eight-ages-plan.md); [src/data/ages.js:13](src/data/ages.js).
- Differentiation plan: retire ADM/DIP/MIL pools for gold, authority and decrees; one ruler with ambitions; one legacy score plus domination; small towns fall without a battle screen — [plans/2026-10-20-002-feat-differentiation-plan.md:1-40](plans/2026-10-20-002-feat-differentiation-plan.md). Decrees, authority, legacy, ambitions and battleThreshold exist in code (sections 5 and 7), but `getRecruitUnitCost` still reads the power pools — [src/engine/economy.js:150-157](src/engine/economy.js).
- Contact is slow: 2 majors met by T25, 9 by T152 — [plans/playtest-4-audit.md:244](plans/playtest-4-audit.md).

### Inferences
- The macro game's weakest Civ comparisons today are the mid-game (few decisions, piling gold) and the size of the tech tree; its strengths are the real-Earth map, km-based rules and the per-nation age model.

### Gaps
- No newer full playtest after playtest 4 was found in plans/ (HANDOFF-2026-10-21.md was not read).
