# World systems (math wave, ideas 8, 9, 10)

Branch `math/world-systems`, from `ee575e7` (the brief). Session `world-systems`.

## What changed

### 8. One population model, logistic growth with soft caps
- **One model.** A city's people are its size (the city model in `world/cities.js`: food bank,
  threshold, housing). `src/engine/population.js` is now that model's maths: `PEOPLE_BY_SIZE`
  (Civ V's 1,000 x size^2.8 as an integer table, identical numbers, no `**` with a fractional
  exponent), `peopleOf(city, threshold)` (people interpolated by the food bank, so a levy or a
  plague shows at once), `foodForPeople` (the bank's exchange rate).
- Before, `region.currentPopulation` was written by levies, casualties, Develop Province and
  Population Policy, and then overwritten by `sizeToPeople(size)` the next turn: those effects
  were silently erased. Now they go through the city stock (`cities.js drawPeople / addPeople`):
  - levy and casualty scars (`aftermath.js drawPopulation`) take men out of the food bank, never a
    whole size: a heavy levy costs a small city turns of growth, a big one barely notices;
  - Develop Province (player and AI) and Population Policy bank the new people as food;
  - plague deaths use `drawPeople(..., { canShrink: true })` and can cost whole sizes.
- `getPopFactor` is 1 for a city (its size already drives its yields, and `dev` is rewritten from
  yields each turn). This also removes a quirk: a city that grew read up to 2x income against the
  registry's stale baseline. Size-less records (hand-built tests) keep the ratio, now soft-capped
  (`softCapAbove`) instead of clamped at 2.
- **Logistic growth.** The food a city banks is multiplied by
  `logisticGrowthMult(size, housing) = 1 - (size / K)^THETA`, `K = housing + 1.75`, `THETA = 2`,
  replacing the old steps (full speed below housing, a quarter for two sizes, then a wall). Housing
  (Granary tiers, water, aqueduct techs) is the carrying capacity. The largest size is still
  housing + 2. The fallback for size-less records is Verhulst's `P + r P (1 - P / K)`.
- City sheet: the housing box shows "growth at N%" and "grows in N turns" now includes the soft
  cap (before, it ignored the housing slowdown).
- **Save shape:** unchanged. `currentPopulation` stays as a derived field; no migration and no
  version bump are needed.

### 9a. Gravity-model trade (`src/engine/tradeValue.js`)
- A pact is worth `G x sqrt(Y_partner / Y_me) / (1 + km / 1000)` of the player's gold
  (`national.goldMult`), soft-capped per route at 0.2 by `x / sqrt(1 + (x / cap)^2)`. Y is the
  summed city size. km is the route really travelled: a land route's tile path in km, a sea route's
  two land legs plus the crossing at half cost, or the straight line without a scenario.
- One modifier line per partner: "Trade with Germany (1004 km)". The region card's trade line
  shows the km and the percent.
- Calibration over 43 real routes (10 players, up to 8 bordering partners each, Dawn start):
  median **5.1%**, mean 4.9% (the old flat value was 5%), p10 3.0%, p90 6.5%, median 774 km.

### 9b. Tech diffusion by contact share (`src/engine/techDiffusion.js`)
- Known nations: bordering, capitals within `CONTACT_KM[age]` (1,500 / 2,500 / 4,000 / 10,000 /
  40,000 km from Bronze to Modern), and trade partners (both ways). Each weighted by its economy
  (summed city size), trade partners x2.
- `mult = 1 - 0.3 x share` (share = weight of known holders / weight of known), x1.2 pioneer as
  before. Same 30% ceiling as the old "6% per bordering holder, up to 5".
- Tech panel: "3 of the 7 nations you know have it: -12%".

### 10a. Plague as an SIR epidemic on the city graph (`src/engine/plague.js`)
- Inside a city, a turn is a generation (Reed-Frost): `new = s x F / (1 + F)`, `F = beta x i`;
  the infected recover or die (MORTALITY 0.3) next turn; immunity wanes 2% a turn. beta grows with
  size and falls with Aqueducts (x0.8), Scientific Method (x0.75), Genomics (x0.5).
- Between cities: a seeded jump roll, `P = s x J / (1 + J)`, `J = 0.15 x pressure`, pressure from a
  land kernel `1 / (1 + (km / 300)^2)` to 900 km, a sea kernel between ports to 3,000 km, the
  player's trade routes (weight 2) and armies (weight 3, home city to the land they stand on).
- Seeds: a rare roll in cities of size 4+ (1e-4 a turn x size / 4, none while immune) and the
  scripted Antonine Plague and Black Death, which now start a real outbreak near Mesopotamia and
  the Black Sea steppe. The old independent 0.3% roll in `cityDisasters.js` is gone; the 'plague'
  mark (no growth, shown on the card) is reused while a city is visibly infected, and the region
  card shows the share sick.
- Calibration (24 outbreaks seeded in a turn-120 world, 40 turns each): median **3 cities**,
  mean 7, max 35, heavy-tailed; about 0.8 city sizes lost per outbreak plus stalled growth; an
  outbreak lasts 8 to 15 turns in a city.

### 10b. War contagion as a Hawkes process (`src/engine/warContagion.js`)
- `heat' = 0.85 x heat + sum over wars begun this turn of 1 / (1 + (km / 1000)^2)` (to 3,000 km,
  km from capital to the nearer belligerent's capital; belligerents excluded). Kept as
  `nation.warHeat`: the exponential kernel's own recursion, so no `exp`.
- AI war roll x `1 + heat / (1 + heat)` (at most double). Hook: one line in
  `src/utils/aiLogic.js` (`processAIWarDecisions`), the `ai` session's file.
- Stability: a war gives a neighbour at most 1 / (1 - 0.85) = 6.7 heat-turns; with a Tier-1 base
  roll of about 0.5 to 2.4% a turn that is under 0.15 extra wars per Tier-1 neighbour, a branching
  ratio well below 1. The nation sheet shows "Wars nearby: +N% war chance".

## Numbers: balance-sim, 150 turns, seeds 11 and 12, PLAYER=au, base `ee575e7`, run side by side

| key | s11 base | s11 new | s12 base | s12 new |
|---|---|---|---|---|
| status at 150 | ACTIVE | ACTIVE | ACTIVE | ACTIVE |
| warsTotal | 3 | 12 | 7 | 5 |
| conquests | 0 | 1 | 1 | 0 |
| civilWarsStarted | 30 | 25 | 31 | 23 |
| rebelStacks | 42 | 35 | 58 | 27 |
| avgUnrest | 5.4 | 5.1 | 7.0 | 4.0 |
| maxProvinceShare | 0.018 | 0.017 | 0.020 | 0.018 |
| topMilitaryToMedian | 1.7 | 1.7 | 1.7 | 1.7 |
| avgCitySize | 3.04 | 3.08 | 3.04 | 3.09 |
| people (millions) | 23.9 | 35.8 | 23.4 | 36.6 |
| playerGold | 2283 | 2457 | 2288 | 2474 |
| playerIncome | 21 | 21 | 21 | 23 |
| playerTechs | 12 | 11 | 10 | 10 |
| AI techs p10 / median / p90 | 3 / 5 / 8 | 4 / 5 / 8 | 3 / 5 / 8 | 4 / 5 / 8 |
| cities struck by plague | 1 | 15 | 1 | 19 |
| max warHeat at 150 | 0 | 0.24 | 0 | 0.68 |
| nonFinite / auditViolations | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| msPerTurn | 294 | 329 | 289 | 294 |

Reading it:
- **Wars** 10 -> 17 over both seeds. With contagion switched off (same tree, `HEAT_MULT_MAX = 0`)
  it is 9 + 5 = 14, so contagion adds about 3 wars in 300 world-turns (seed 11's go in a cluster
  after turn 100) and the rest is path variance (the base alone swings 3 vs 7). Still under the
  skill's "about 10 per 150 turns".
- **Cities** +1.5% average size. Growth curve variants tried on the full sim: Verhulst (THETA 1,
  K = housing + 2) gave 2.80; THETA 4 with K = housing + 1.25 gave 3.18 (more unrest and civil
  wars on seed 11); THETA 2 with K = housing + 1.75 gives 3.08, kept. Most cities sit at their
  housing, so what matters is the speed there (old 0.25, now 0.4 to 0.6) and one above (old 0.25,
  now 0.2 to 0.3).
- **People** read about 50% higher because they now include the food bank's progress toward the
  next size (display only; nothing reads the total for balance).
- **Player gold** +8%: the passive player's city reaches size 4 around turn 100 instead of 150.
- **Diffusion**: the bottom 10% of AI nations gain a tech; median and top unchanged. The
  intended effect (laggards near the known world catch up), no leader boost.
- **Unrest and civil wars** at or below base on both seeds.
- **Turn time** +35 ms on seed 11 (the one with 12 wars) and +5 ms on seed 12, measured side by
  side. The new systems themselves are cheap (below).

## Scaling from 56k to 100k cells
- Every distance is km (`src/engine/geoKm.js`: chord to arc by the asin series, `Math.sqrt` only,
  within 0.1% up to 8,000 km). Nothing counts rings or cells; a denser grid changes no rule.
- Per-turn costs are in cities and nations, not cells:
  - population: one pass over cities (already there);
  - trade: one route per pact (the route search is the existing `getTradeRoute`, BFS over tiles,
    capped at `TRADE_ROUTE_MAX_TILES`: that cap is in tiles and belongs to the grid-math helper);
  - diffusion: O(nations) per researching nation, cached per state, independent of cells;
  - plague: one pass over cities on a quiet turn; with an outbreak, infected x cities km checks
    plus one pass over units;
  - war heat: O(nations) plus O(nations) per new war.
- City count grows with land area over `MIN_CITY_SPACING` (in rings, `cities.js`, grid-math's area).
  If that becomes km-based, city counts stay put and so do my calibrations.

## Determinism
- No `Math.random`, `Date.now`, `exp`, `log`, `acos`, `asin` or fractional `pow` in the new code.
  Rolls are FNV hashes of id and turn. `PEOPLE_BY_SIZE` replaces `size ** 2.8` with a table.
- `growthThreshold` in `cities.js` still uses `size ** 1.8` (pre-existing, not changed here);
  grid-math's guard may flag it.

## Files outside my list (kept minimal)
- `src/utils/aiLogic.js`: one import and one factor in the war roll (`ai` session's file).
- `src/engine/resolveTurn.js`: the population block, the plague call after city disasters, the
  scripted-plague seed at the events phase, and the war-heat update after AI war declarations
  (`perf` touches phase plumbing here).
- `src/engine/modifiers/sources.js`: the trade line. `src/engine/aftermath.js`,
  `gameReducer.js` (Develop Province, Population Policy), `aiEconomy.js` (AI develop).
- UI: `CityPanel.jsx`, `TechPanel.jsx`, `RegionInfoModal.jsx`, `map/nationSheetModel.js`.

## Open questions
- AI nations never trade with each other, so gravity trade is the player's only, and AI diffusion
  counts only the player as a possible trade partner. AI-to-AI trade would feed both.
- A turn is 25 years in the Bronze Age at Normal speed. Plague and heat constants are per turn,
  like the existing disasters, so an outbreak spans 8 to 15 turns whatever the age. Per-year
  rates would need integer powers per age; not done.
- No quarantine action yet (close the ports, keep the money or the health); the trade and army
  links are the place to hook it.
- `geoKm.js` duplicates what grid-math's shared distance helper will provide; merge onto theirs.
