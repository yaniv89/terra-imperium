// src/engine/world/cities.js
// Cities on the world grid (plans/civ-map-rework.md, B3, B4, C1, C2): the unit of economy,
// population, production and borders. Pure functions over `world` (the tile-world part of game
// state) and the loaded grid (`tiles`, src/data/geo/tiles.js). Nothing here touches the rest of
// game state; src/engine/resolveTurn.js calls processCities and materialises what it returns
// (units built, buildings finished, tiles claimed) into nations, units and logs.
//
// The model, in plain words:
//   size        citizens (1..30). The engine's true variable; people are derived for display.
//   worked      a city works `size` of its tiles plus its centre (free). Allocation is automatic
//               by focus (balanced, food, production, gold) with optional locks, deterministic.
//   yields      food, production, gold from src/data/tileYields.js; science and culture from size
//               and buildings. Food eaten = FOOD_PER_CITIZEN x size; the surplus fills the food
//               bank; at the threshold the city grows. Growth is logistic with a soft cap
//               (src/engine/population.js logisticGrowthMult): it slows smoothly as size nears
//               housing + 1.75 and stops past it; a negative bank starves a citizen.
//   housing     HOUSING_BASE + water + Food building tier + housing techs: the carrying capacity.
//   people      population.js PEOPLE_BY_SIZE, the one population model (size and food bank).
//   amenities   need floor(size / 2); supplied by the nation's luxuries (ctx.luxuries) and the
//               Culture building tier. Short cities grow slower and gain unrest.
//   production  one item at a time with a queue; overflow carries; buildings use the existing
//               9 category lines (src/data/buildings.js), units the age roster, improvements
//               src/data/tileYields.js, settlers cost a citizen.
//   borders     culture fills a bank; the cheapest eligible tile (ring, count) is claimed when the
//               bank covers it, by yield score; tiles can be bought for gold at BUY_TILE_MULT.
//
// World shape:
//   world.cities[cityId]   the city records below
//   world.tileOwner[tile]  cityId owning the tile (every owned tile, including the centre)
//   world.tileState[tile]  { improvement, pillaged, road } for tiles that have any of it
//
// Deterministic: no randomness at all; ties break by tile id and city id. Returns the same world
// object when nothing changed.
import { DISTRICTS, districtSite, districtEntry, districtYields, hasDistrict, repairedDistrict } from '../districts';
import { AGE_ORDER } from '../../data/ages';
import { BUILDING_CATEGORIES, getBuildingTierCost, canBuildTier, createEmptyRegionBuildings } from '../../data/buildings';
import { getAvailableClasses } from '../../data/unitClasses';
import { tileFacts, tileYields, canImprove, IMPROVEMENTS, strategicSupply, RESOURCES_ON_TILES } from '../../data/tileYields';
import { disasterMults } from '../cityDisasters';
import { mapEffectsOf } from '../techMapEffects';
import { nextTemplateUnit, templateProgress, validateTemplate } from '../armyTemplates';
import { navalLinesFor } from '../../data/navalLines';
import { logisticGrowthMult, sizeToPeople as peopleForSize, foodForPeople, peopleOf } from '../population';

export const FOOD_PER_CITIZEN = 2;
export const MAX_SIZE = 30;
export const HOUSING_BASE = 2;
export const HOUSING_WATER = 1;
export const HOUSING_TECHS = { infrastructure_aqueducts: 2, infrastructure_canal_locks: 2, infrastructure_highway_systems: 4 };
export const CENTRE_MIN_YIELDS = { food: 2, production: 1, gold: 1 };
export const STARVE_LOSS = 1;
export const AMENITY_NEED_PER_CITIZENS = 2;
export const AMENITY_GROWTH_BONUS = 0.1;   // at +2 or more
export const AMENITY_GROWTH_PENALTY = 0.25; // when short
export const AMENITY_UNREST_PER_MISSING = 2;
export const CULTURE_PER_SIZE = 0.25;
export const CULTURE_BASE = 1;
export const CULTURE_PER_TIER = 2; // Culture building line
export const SCIENCE_PER_SIZE = 0.5;
// The capital's palace (C2): a flat income every nation starts with, so a one-city Dawn nation
// can pay for its first army and still save a little.
export const PALACE_YIELDS = { gold: 4, production: 2, science: 2, culture: 1 };
// A city's border reaches two rings in every age (the user's call: a five-ring city was half
// the size of France); the two border techs add a ring each, capped at BORDER_RING_MAX.
export const BORDER_RING_BY_AGE = { bronze: 2, classical: 2, kingdoms: 2, gunpowder: 2, modern: 2 };
export const BORDER_RING_MAX = 3;
export const TILE_COST_BASE = 20;
export const TILE_COST_PER_RING = 10;
export const TILE_COST_PER_TILE = 5;
export const BUY_TILE_MULT = 3;
export const SETTLER_BASE_COST = 60;
export const SETTLER_COST_PER_CITY = 10;
export const SETTLER_MIN_SIZE = 2;
export const UNIT_BASE_COST = 40;
export const UNIT_COST_PER_AGE = 0.6;
export const UNIT_CLASS_COST = { infantry: 1, ranged: 1.1, cavalry: 1.5, siege: 1.6, naval: 1.4, support: 1.2, air: 2.2 };
export const IMPROVEMENT_COST_PER_TURN = 10;
// Tiles are about 150 km across, so one free tile between cities is already Civ's spacing.
export const MIN_CITY_SPACING = 3; // rings between city centres; 2 on the 150 km grid, 3 on the 106 km grid keeps the city count near the old one
export const FOCUS = ['balanced', 'food', 'production', 'gold'];

export const growthThreshold = (size, speedMult = 1) => Math.round((15 + 6 * size + size ** 1.8) * speedMult); // the speed table (ages.js speedCostMult)
// The first two citizens are content for free, so a young city never starts restless.
export const amenityNeed = (size) => Math.max(0, Math.floor((size - 2) / AMENITY_NEED_PER_CITIZENS));

export const emptyWorld = () => ({ cities: {}, tileOwner: {}, tileState: {} });

export const cityId = (tile) => `c${tile}`;

// ---------------------------------------------------------------------------------------------
// Geography helpers
export const ringDistance = (tiles, from, to, maxRing = 6) => {
  if (from === to) return 0;
  let frontier = [from]; const seen = new Set(frontier);
  for (let d = 1; d <= maxRing; d++) {
    const next = [];
    for (const id of frontier) for (const n of tiles.neighbors[id]) { if (seen.has(n)) continue; if (n === to) return d; seen.add(n); next.push(n); }
    frontier = next;
  }
  return Infinity;
};

const isWorkable = (tiles, id) => tiles.land[id] === 1 || ['coast', 'lake'].includes(tiles.terrainOf(id));

// Tiles too close to an existing city (within MIN_CITY_SPACING - 1 rings), cached per cities map:
// the AI asks about hundreds of sites a turn, and a ring walk per city per site was the cost.
const blockedCache = new WeakMap();
const blockedTiles = (cities, tiles) => {
  let map = blockedCache.get(cities);
  if (map) return map;
  map = new Map();
  Object.values(cities).forEach((city) => {
    let frontier = [city.tile]; const seen = new Set(frontier);
    map.set(city.tile, city.name);
    for (let d = 1; d < MIN_CITY_SPACING; d++) {
      const next = [];
      frontier.forEach((t) => tiles.neighbors[t].forEach((n) => { if (!seen.has(n)) { seen.add(n); next.push(n); if (!map.has(n)) map.set(n, city.name); } }));
      frontier = next;
    }
  });
  blockedCache.set(cities, map);
  return map;
};
// A city founded into a cities map that is written in place (processSettlers): its ring joins the
// cached index instead of a rebuild per founding.
const noteFoundedCity = (cities, tiles, city) => {
  const map = blockedCache.get(cities);
  if (!map) return;
  let frontier = [city.tile]; const seen = new Set(frontier);
  map.set(city.tile, city.name);
  for (let d = 1; d < MIN_CITY_SPACING; d++) {
    const next = [];
    frontier.forEach((t) => tiles.neighbors[t].forEach((n) => { if (!seen.has(n)) { seen.add(n); next.push(n); if (!map.has(n)) map.set(n, city.name); } }));
    frontier = next;
  }
};

export const canFoundCity = (world, tiles, tile, nationId) => {
  if (!tiles.land[tile]) return { ok: false, reason: 'A city needs land.' };
  if (tiles.terrainOf(tile) === 'snow' || tiles.featureOf(tile) === 'ice') return { ok: false, reason: 'Nothing can live on the ice.' };
  const owner = world.tileOwner[tile];
  if (owner && world.cities[owner]?.ownerId !== nationId) return { ok: false, reason: 'This land belongs to another nation.' };
  const near = blockedTiles(world.cities, tiles).get(tile);
  if (near) return { ok: false, reason: `Too close to ${near}.` };
  return { ok: true };
};

const cityFacts = (tiles, id) => ({ river: tiles.rivers[id] !== 0, coastal: tiles.coastal[id] === 1, lake: tiles.neighbors[id].some((n) => tiles.terrainOf(n) === 'lake') });

/** Founds a city: the centre and every free workable ring-1 tile are claimed. Returns the new
 * world and the city. */
export const foundCity = (world, tiles, { nationId, tile, name, size = 1, turn = 1, isCapital = false, inPlace = false }) => {
  const id = cityId(tile);
  const claim = [tile, ...tiles.neighbors[tile].filter((n) => !world.tileOwner[n] && isWorkable(tiles, n))];
  // `inPlace`: the caller already copied the ownership and cities maps for the whole pass
  // (processSettlers founds several outposts a turn; a copy of 9,000 tiles each was the cost).
  const tileOwner = inPlace ? world.tileOwner : { ...world.tileOwner };
  // A city centre is always its own: if another city's border already covered this tile
  // (capitals of neighbouring peoples can start a tile apart), that city gives it up.
  let cities = world.cities;
  const previous = tileOwner[tile];
  if (previous && cities[previous]) {
    const p = cities[previous];
    const trimmed = { ...p, tiles: p.tiles.filter((t) => t !== tile), worked: p.worked.filter((t) => t !== tile), locked: p.locked.filter((t) => t !== tile) };
    if (inPlace) cities[previous] = trimmed; else cities = { ...cities, [previous]: trimmed };
  }
  claim.forEach((t) => { tileOwner[t] = id; });
  const facts = cityFacts(tiles, tile);
  const city = {
    id, name: name || tiles.names[tile] || `City ${tile}`, ownerId: nationId, founderId: nationId, tile, founded: turn,
    size: Math.max(1, Math.min(MAX_SIZE, size)), food: 0, focus: 'balanced', locked: [], worked: [],
    tiles: claim, cultureBank: 0, unrest: 0, loyalty: 100,
    production: { current: null, queue: [], progress: 0 },
    buildings: createEmptyRegionBuildings(),
    walls: 0, isCapital, water: facts.river || facts.coastal || facts.lake,
    outpost: null
  };
  if (inPlace) { cities[id] = city; noteFoundedCity(cities, tiles, city); return { world, city }; }
  return { world: { ...world, cities: { ...cities, [id]: city }, tileOwner }, city };
};

// ---------------------------------------------------------------------------------------------
// Yields and allocation
// A tile's facts and yields change only with its sparse state entry and the owner's researched
// list: both are memoised on those identities, so the thousands of tiles a turn cost one
// computation each (and none when nothing changed since the last turn).
const factsMemo = new Map(); // tile -> { dyn, facts }
const yieldMemo = new Map(); // tile -> { dyn, researched, y }
const factsOf = (tiles, world, id) => {
  const dyn = world.tileState[id];
  const hit = factsMemo.get(id);
  if (hit && hit.dyn === dyn) return hit.facts;
  const facts = tileFacts(tiles, id, dyn);
  factsMemo.set(id, { dyn, facts });
  return facts;
};
const yieldsOfTile = (tiles, world, id, researched) => {
  const dyn = world.tileState[id];
  const hit = yieldMemo.get(id);
  if (hit && hit.dyn === dyn && hit.researched === researched) return hit.y;
  const y = tileYields(factsOf(tiles, world, id), researched);
  yieldMemo.set(id, { dyn, researched, y });
  return y;
};

export const housingOf = (city, researched = []) => {
  const foodTier = (city.buildings?.categories?.food ?? -1) + 1;
  let h = HOUSING_BASE + (city.water ? HOUSING_WATER : 0) + foodTier;
  Object.entries(HOUSING_TECHS).forEach(([tech, n]) => { if (researched.includes(tech)) h += n; });
  return h;
};

const focusScore = (y, focus) => {
  switch (focus) {
    case 'food': return y.food * 3 + y.production + y.gold;
    case 'production': return y.production * 3 + y.food + y.gold;
    case 'gold': return y.gold * 3 + y.food + y.production;
    default: return y.food * 2 + y.production * 2 + y.gold;
  }
};

/** Which tiles the city works this turn: locked tiles first, then enough food not to starve, then
 * the focus score. Returns tile ids (the centre is always worked and not listed). */
export const allocateTiles = (city, tiles, world, researched = [], blocked = new Set()) => {
  const candidates = city.tiles.filter((t) => t !== city.tile && !blocked.has(t) && isWorkable(tiles, t));
  const yields = new Map(candidates.map((t) => [t, yieldsOfTile(tiles, world, t, researched)]));
  const chosen = [];
  const locked = city.locked.filter((t) => yields.has(t)).sort((a, b) => a - b);
  locked.forEach((t) => { if (chosen.length < city.size) chosen.push(t); });
  const rest = candidates.filter((t) => !chosen.includes(t));
  const centre = centreYields(tiles, world, city, researched);
  let food = centre.food + chosen.reduce((s, t) => s + yields.get(t).food, 0);
  const need = FOOD_PER_CITIZEN * city.size;
  const byScore = rest.slice().sort((a, b) => focusScore(yields.get(b), city.focus) - focusScore(yields.get(a), city.focus) || a - b);
  const byFood = rest.slice().sort((a, b) => yields.get(b).food - yields.get(a).food || focusScore(yields.get(b), city.focus) - focusScore(yields.get(a), city.focus) || a - b);
  while (chosen.length < city.size) {
    const pool = food < need ? byFood : byScore;
    const next = pool.find((t) => !chosen.includes(t));
    if (next === undefined) break;
    chosen.push(next);
    food += yields.get(next).food;
  }
  return chosen;
};

const centreYields = (tiles, world, city, researched) => {
  const y = yieldsOfTile(tiles, world, city.tile, researched);
  return { food: Math.max(CENTRE_MIN_YIELDS.food, y.food), production: Math.max(CENTRE_MIN_YIELDS.production, y.production), gold: Math.max(CENTRE_MIN_YIELDS.gold, y.gold) };
};

const tierEffect = (city, category, key) => {
  const tier = city.buildings?.categories?.[category];
  if (tier == null || tier < 0) return 0;
  return BUILDING_CATEGORIES[category]?.tiers[tier]?.effects?.[key] || 0;
};

/** The city's yields this turn with the given worked tiles. */
export const cityYields = (city, tiles, world, worked, researched = [], ctx = {}) => {
  const centre = centreYields(tiles, world, city, researched);
  // A city under invasion lives off its centre alone: the enemy holds the countryside. One under
  // siege (sieges.js) works ring 1 only.
  const ring1 = city.siege ? new Set(tiles.neighbors[city.tile]) : null;
  const fields = city.underInvasion ? [] : ring1 ? worked.filter((t) => ring1.has(t)) : worked;
  const sum = fields.reduce((acc, t) => { const y = yieldsOfTile(tiles, world, t, researched); acc.food += y.food; acc.production += y.production; acc.gold += y.gold; return acc; }, { ...centre });
  const districts = districtYields(tiles, world, city); // the Campus, Temple Quarter and Market Quarter on their tiles (districts.js)
  sum.gold += districts.gold;
  const palace = city.isCapital ? PALACE_YIELDS : { gold: 0, production: 0, science: 0, culture: 0 };
  const foodTier = (city.buildings?.categories?.food ?? -1) + 1;
  const dm = disasterMults(city, ctx.turnNumber); // a flood or a fire (cityDisasters.js)
  const food = Math.round((sum.food * dm.food + foodTier + (ctx.foodBonus || 0) - FOOD_PER_CITIZEN * city.size) * 10) / 10;
  const production = Math.round((sum.production + palace.production) * (1 + tierEffect(city, 'industry', 'local.productionIncome') + (ctx.productionMult || 0)) * dm.production * 10) / 10;
  const gold = Math.round(((sum.gold + palace.gold) * (1 + tierEffect(city, 'economy', 'local.taxIncome') + (ctx.goldMult || 0)) + tierEffect(city, 'economy', 'local.flatGold') + tierEffect(city, 'industry', 'local.flatGold') + tierEffect(city, 'naval', 'local.tradeIncome')) * 10) / 10;
  const science = Math.round((SCIENCE_PER_SIZE * city.size + palace.science + tierEffect(city, 'science', 'local.techPoints') + districts.science) * 10) / 10;
  const cultureTier = (city.buildings?.categories?.culture ?? -1) + 1;
  const culture = Math.round((CULTURE_BASE + palace.culture + CULTURE_PER_SIZE * city.size + CULTURE_PER_TIER * cultureTier + districts.culture + (ctx.cultureBonus || 0)) * 10) / 10;
  const strategic = {};
  worked.forEach((t) => { const s = strategicSupply(factsOf(tiles, world, t), researched); if (s) strategic[s.resource] = (strategic[s.resource] || 0) + s.amount; });
  const luxuries = new Set();
  worked.forEach((t) => { const f = factsOf(tiles, world, t); const r = RESOURCES_ON_TILES[f.resource]; if (r?.kind === 'luxury' && f.improvement === r.improvement && !f.pillaged) luxuries.add(f.resource); });
  return { food, production, gold, science, culture, strategic, luxuries: [...luxuries].sort(), raw: sum };
};

export const amenitiesOf = (city, ctx = {}) => {
  const need = amenityNeed(city.size);
  const supply = (ctx.luxuriesFor ? ctx.luxuriesFor(city) : ctx.luxuries || 0) + ((city.buildings?.categories?.culture ?? -1) + 1) + (ctx.amenityBonus || 0);
  return { need, supply, net: supply - need };
};

// ---------------------------------------------------------------------------------------------
// Production
export const productionCost = (item, { ageId = 'bronze', citiesOwned = 1, speedMult = 1 } = {}) => Math.round(baseProductionCost(item, { ageId, citiesOwned }) * speedMult);
const baseProductionCost = (item, { ageId = 'bronze', citiesOwned = 1 } = {}) => {
  switch (item.kind) {
    case 'building': return getBuildingTierCost(item.category, item.tier) ?? 9999;
    case 'unit': return Math.round(UNIT_BASE_COST * (1 + UNIT_COST_PER_AGE * AGE_ORDER.indexOf(ageId)) * (UNIT_CLASS_COST[item.classId] || 1));
    case 'improvement': return (IMPROVEMENTS[item.improvement]?.turns || 2) * IMPROVEMENT_COST_PER_TURN;
    case 'settler': return SETTLER_BASE_COST + SETTLER_COST_PER_CITY * citiesOwned;
    case 'army': { const next = nextTemplateUnit(item); return next ? baseProductionCost({ kind: 'unit', classId: next }, { ageId, citiesOwned }) : 0; } // the next piece of the army (armyTemplates.js)
    case 'wonder': return item.cost || 100; // stamped by wonders.js wonderItem at queue time (no import: the registry would cycle)
    default: return item.cost || 9999;
  }
};

export const canQueue = (city, tiles, world, item, { researched = [], ageId = 'bronze' } = {}) => {
  switch (item.kind) {
    case 'building': {
      const current = city.buildings?.categories?.[item.category] ?? -1;
      if (item.tier !== current + 1) return { ok: false, reason: 'Tiers are built in order.' };
      if (!canBuildTier(item.category, new Set(researched), item.tier)) return { ok: false, reason: 'Needs a technology.' };
      if (BUILDING_CATEGORIES[item.category]?.coastalOnly && !tiles.coastal[city.tile]) return { ok: false, reason: 'Needs a coast.' };
      return { ok: true };
    }
    case 'unit':
      if (item.classId === 'naval' && item.navalLine && !navalLinesFor(ageId).includes(item.navalLine)) return { ok: false, reason: 'Not available in this age.' };
      return getAvailableClasses(ageId).includes(item.classId) ? { ok: true } : { ok: false, reason: 'Not available in this age.' };
    case 'improvement': {
      if (!city.tiles.includes(item.tile)) return { ok: false, reason: 'Not this city\'s land.' };
      const facts = tileFacts(tiles, item.tile, world.tileState[item.tile]);
      if (facts.improvement === item.improvement && !facts.pillaged) return { ok: false, reason: 'Already built.' };
      return canImprove(facts, item.improvement, researched) ? { ok: true } : { ok: false, reason: 'Cannot be built here.' };
    }
    case 'settler':
      return city.size >= SETTLER_MIN_SIZE ? { ok: true } : { ok: false, reason: `Needs size ${SETTLER_MIN_SIZE}.` };
    case 'army':
      return validateTemplate(item, ageId);
    case 'wonder':
      // The reducer checks the project's rules with the whole state (wonders.js canQueueWonder); here the tile.
      return item.tile != null && (item.tier > 1 || city.tiles.includes(item.tile)) ? { ok: true } : { ok: false, reason: 'No site for it in the city.' };
    default:
      return { ok: false, reason: 'Unknown item.' };
  }
};

export const queueItem = (city, item) => {
  if (!city.production.current) return { ...city, production: { ...city.production, current: item } };
  return { ...city, production: { ...city.production, queue: [...city.production.queue, item] } };
};
export const dequeueItem = (city, index) => {
  if (index === 0) {
    const [next, ...rest] = city.production.queue;
    return { ...city, production: { current: next || null, queue: rest, progress: 0 } };
  }
  return { ...city, production: { ...city.production, queue: city.production.queue.filter((_, i) => i !== index - 1) } };
};
export const setFocus = (city, focus) => (FOCUS.includes(focus) && focus !== city.focus ? { ...city, focus } : city);
export const toggleLock = (city, tile) => (city.locked.includes(tile) ? { ...city, locked: city.locked.filter((t) => t !== tile) } : { ...city, locked: [...city.locked, tile] });

// ---------------------------------------------------------------------------------------------
// Borders
export const tileCultureCost = (city, ring, costMult = 0) => Math.round((TILE_COST_BASE + TILE_COST_PER_RING * ring + TILE_COST_PER_TILE * city.tiles.length) * Math.max(0.5, 1 + costMult));

// The rings around a centre, Map tile -> ring, up to maxRing. The grid is static, so one walk per
// (centre, maxRing) serves every turn: the claim step of 500 cities was a walk per candidate tile.
const ringsMemo = new Map();
export const ringsAround = (tiles, centre, maxRing) => {
  const key = centre * 64 + maxRing; // rings up to 63 (AIR_RANGE is 8)
  let rings = ringsMemo.get(key);
  if (rings) return rings;
  rings = new Map([[centre, 0]]); let frontier = [centre];
  for (let d = 1; d <= maxRing; d++) {
    const next = [];
    for (const id of frontier) for (const n of tiles.neighbors[id]) { if (!rings.has(n)) { rings.set(n, d); next.push(n); } }
    frontier = next;
  }
  ringsMemo.set(key, rings);
  return rings;
};

/** Tiles the city could claim next, best first: unowned, workable, adjacent to its land, inside
 * the age's ring. Each entry { tile, ring, cost, score }. */
export const claimCandidates = (city, tiles, world, { ageId = 'bronze', researched = [] } = {}) => {
  const fx = mapEffectsOf(researched); // techs that push the border and cheapen tiles (techMapEffects.js)
  const maxRing = Math.min(BORDER_RING_MAX, (BORDER_RING_BY_AGE[ageId] || 2) + fx.borderRing);
  const own = new Set(city.tiles);
  const out = new Map();
  const rings = ringsAround(tiles, city.tile, maxRing);
  city.tiles.forEach((t) => tiles.neighbors[t].forEach((n) => {
    if (own.has(n) || world.tileOwner[n] || !isWorkable(tiles, n) || out.has(n)) return;
    const ring = rings.get(n);
    if (ring === undefined) return;
    const y = yieldsOfTile(tiles, world, n, researched);
    const facts = factsOf(tiles, world, n);
    const adjacency = tiles.neighbors[n].filter((m) => own.has(m)).length;
    const score = y.food + y.production + y.gold + (facts.resource ? 3 : 0) + (facts.river ? 1 : 0) + adjacency * 0.5 - ring;
    out.set(n, { tile: n, ring, cost: tileCultureCost(city, ring, fx.tileCostMult), score });
  }));
  return [...out.values()].sort((a, b) => b.score - a.score || a.ring - b.ring || a.tile - b.tile);
};

export const buyTileCost = (city, candidate) => candidate.cost * BUY_TILE_MULT;

// `inPlace`: the caller owns `world.tileOwner` (processCities copies it once a turn), so the claim
// is written into it; a spread of the 4,000-key ownership map per claim was the cities phase's cost.
const claimTile = (world, city, tile, inPlace = false) => {
  if (inPlace) { world.tileOwner[tile] = city.id; return { world, city: { ...city, tiles: [...city.tiles, tile] } }; }
  return { world: { ...world, tileOwner: { ...world.tileOwner, [tile]: city.id } }, city: { ...city, tiles: [...city.tiles, tile] } };
};
const writeTileState = (world, tile, entry, inPlace = false) => {
  if (inPlace) { world.tileState[tile] = entry; return world; }
  return { ...world, tileState: { ...world.tileState, [tile]: entry } };
};

// ---------------------------------------------------------------------------------------------
// The turn
/**
 * One city's turn. `ctx`: { researched, ageId, turnNumber, citiesOwned, luxuries, amenityBonus,
 * goldMult, productionMult, foodBonus, cultureBonus (governors.js), blockedTiles (Set of tiles an enemy stands on),
 * greatProjects (state.greatProjects: a tier-1 wonder already built elsewhere is dropped from a queue) }.
 * Returns { city, world, yields, completed: [item...], logs: [string...] }. With `inPlace` the
 * world's tileOwner and tileState are the caller's own copies and are written directly.
 */
export const processCity = (world, tiles, city, ctx = {}, inPlace = false) => {
  const researched = ctx.researched || [];
  const ageId = ctx.ageId || 'bronze';
  let w = world;
  // A pillaged district is rebuilt once DISTRICT_REPAIR_TURNS have passed (districts.js).
  (city.tiles || []).forEach((t) => { const e = w.tileState[t]; if (e?.district && e.pillaged) { const r = repairedDistrict(e, ctx.turnNumber || 0); if (r !== e) w = writeTileState(w, t, r, inPlace); } });
  let c = city;
  const logs = []; const completed = [];
  if (c.outpost) return { city: c, world: w, yields: null, completed, logs }; // outposts are grown by settlers.js

  // 1. Work the land.
  const worked = allocateTiles(c, tiles, w, researched, ctx.blockedTiles || new Set());
  const y = cityYields(c, tiles, w, worked, researched, ctx);
  const amen = amenitiesOf(c, ctx);

  // 2. Food, growth, starvation, housing.
  const housing = housingOf(c, researched);
  let size = c.size;
  let food = c.food + y.food;
  if (food < 0) {
    size = Math.max(1, size - STARVE_LOSS); food = 0;
    logs.push(c.underInvasion ? `${c.name} starves under siege and shrinks to ${size}.` : `${c.name} starves and shrinks to ${size}.`);
  } else if (y.food > 0 && !c.underInvasion) {
    let gain = y.food * disasterMults(c, ctx.turnNumber).growth; // no growth under plague
    gain *= logisticGrowthMult(size, housing); // the soft cap (population.js)
    if (amen.net >= 2) gain *= 1 + AMENITY_GROWTH_BONUS; else if (amen.net < 0) gain *= 1 - AMENITY_GROWTH_PENALTY;
    food = c.food + gain;
    const threshold = growthThreshold(size, ctx.speedMult || 1);
    if (food >= threshold && size < MAX_SIZE) { size += 1; food -= threshold * (1 - Math.min(0.5, mapEffectsOf(researched).granaryKeep)); logs.push(`${c.name} grows to size ${size}.`); } // granaries keep a share (techMapEffects.js)
  }
  // 3. Unrest from amenities.
  // Only the penalty lives here: resolveTurn's unrest drift (control, stability, taxes) owns the
  // decay, so the two never pull twice in the same direction.
  let unrest = c.unrest;
  if (amen.net < 0) unrest = Math.min(100, unrest + AMENITY_UNREST_PER_MISSING * -amen.net);

  // 4. Production.
  let production = { ...c.production, progress: c.production.progress + y.production };
  let buildings = c.buildings;
  let next = { ...c, size, food: Math.round(food * 10) / 10, unrest, worked };
  for (let guard = 0; guard < 6 && production.current; guard++) {
    const item = production.current;
    const cost = productionCost(item, { ageId, citiesOwned: ctx.citiesOwned || 1, speedMult: ctx.speedMult || 1 });
    if (production.progress < cost) break;
    production = { ...production, progress: production.progress - cost };
    if (item.kind === 'building') {
      buildings = { ...buildings, categories: { ...buildings.categories, [item.category]: item.tier } };
      logs.push(`${c.name} completes a ${BUILDING_CATEGORIES[item.category]?.tiers[item.tier]?.name || item.category}.`);
      // The line's district stands on a tile of the border from its first tier (districts.js).
      if (DISTRICTS[item.category] && !hasDistrict(w, next, item.category)) {
        const site = districtSite(tiles, w, next, item.category);
        if (site != null) { w = writeTileState(w, site, districtEntry(w.tileState[site], item.category), inPlace); logs.push(`${c.name} lays out its ${DISTRICTS[item.category].name}.`); }
      }
    } else if (item.kind === 'improvement') {
      w = writeTileState(w, item.tile, { ...(w.tileState[item.tile] || {}), improvement: item.improvement, pillaged: false, ...(item.improvement === 'road' ? { road: true } : {}) }, inPlace);
      logs.push(`${c.name} builds a ${IMPROVEMENTS[item.improvement]?.name || item.improvement}.`);
    } else if (item.kind === 'settler') {
      if (next.size >= SETTLER_MIN_SIZE) { next = { ...next, size: next.size - 1 }; completed.push({ ...item, city: c.id, tile: c.tile }); logs.push(`${c.name} sends out settlers.`); }
      else { production = { ...production, progress: production.progress + cost }; break; } // wait for people
    } else if (item.kind === 'wonder') {
      const built = ctx.greatProjects?.[item.projectId];
      if (item.tier === 1 && built && built.regionId !== c.id) {
        // Lost the race (another city finished it first): the order is dropped, the production banked.
        production = { ...production, progress: production.progress + cost };
        logs.push(`${c.name} abandons ${item.projectId.replace(/_/g, ' ')}: it stands elsewhere.`);
      } else {
        // A wonder on its tile (wonders.js): the turn's great projects phase records it.
        if (item.tile != null) w = writeTileState(w, item.tile, { ...(w.tileState[item.tile] || {}), wonder: item.projectId }, inPlace);
        completed.push({ kind: 'wonder', projectId: item.projectId, tier: item.tier, tile: item.tile, city: c.id });
        logs.push(`${c.name} completes ${item.projectId.replace(/_/g, ' ')} (tier ${item.tier}).`);
      }
    } else if (item.kind === 'army') {
      // One piece of the army at a time (armyTemplates.js); the order stays current until complete.
      const classId = nextTemplateUnit(item);
      const built = { ...(item.built || {}), [classId]: ((item.built || {})[classId] || 0) + 1 };
      completed.push({ kind: 'unit', classId, army: { id: item.armyId, name: item.name }, city: c.id, tile: c.tile });
      const order = { ...item, built };
      const { done, total } = templateProgress(order);
      logs.push(`${c.name} trains ${classId} for ${item.name} (${done}/${total}).`);
      if (done < total) { production = { ...production, current: order }; continue; }
      logs.push(`${item.name} is complete at ${c.name}.`);
    } else {
      completed.push({ ...item, city: c.id, tile: c.tile });
      if (item.kind === 'unit') logs.push(`${c.name} trains ${item.classId}.`);
    }
    const [following, ...rest] = production.queue;
    production = { current: following || null, queue: rest, progress: production.progress };
  }
  if (!production.current) production = { ...production, progress: Math.min(production.progress, 50) }; // idle cities bank a little

  // 5. Culture and borders.
  let cultureBank = c.cultureBank + y.culture;
  const candidates = claimCandidates({ ...next, tiles: c.tiles }, tiles, w, { ageId, researched });
  let claimed = [];
  if (candidates.length) {
    const best = candidates[0];
    if (cultureBank >= best.cost) { cultureBank -= best.cost; claimed = [best.tile]; }
  }
  next = { ...next, production, buildings, cultureBank: Math.round(cultureBank * 10) / 10 };
  if (claimed.length) {
    const r = claimTile(w, next, claimed[0], inPlace); w = r.world; next = r.city;
    logs.push(`${c.name}'s borders grow to ${tiles.names[claimed[0]] || 'new land'}.`);
  }
  return { city: next, world: w, yields: y, completed, logs };
};

/** Every city of the world, in id order. `ctxFor(city)` gives the per-nation context. */
export const processCities = (world, tiles, ctxFor) => {
  // One copy of the ownership and tile state maps for the whole pass; the cities write into it.
  let w = { ...world, tileOwner: { ...world.tileOwner }, tileState: { ...world.tileState } };
  const cities = {};
  const results = {};
  const logs = []; const completed = [];
  Object.keys(world.cities).sort().forEach((id) => {
    const city = w.cities[id] || world.cities[id];
    const r = processCity(w, tiles, city, ctxFor(city), true);
    w = r.world;
    cities[id] = r.city;
    results[id] = r.yields;
    r.logs.forEach((m) => logs.push({ cityId: id, nationId: city.ownerId, message: m }));
    completed.push(...r.completed.map((x) => ({ ...x, nationId: city.ownerId })));
  });
  return { world: { ...w, cities }, yields: results, logs, completed };
};

// People from size (C2), city and countryside together: 1,000 x size^2.8 (size 2 is 7,000, size 5
// is 90,000, size 12 is 1.1 million, size 30 is 14 million), the curve Civilization uses. The
// table lives in population.js, the one population model.
export const sizeToPeople = peopleForSize;

/**
 * Take `men` people from a city through its food bank (levies, casualties): the bank shrinks by
 * what those people are worth (population.js foodForPeople), never below 0. With `canShrink`
 * (plague) a loss bigger than the bank costs whole sizes, down to size 1. Returns the same city
 * when nothing changes.
 */
export const drawPeople = (city, men, { speedMult = 1, canShrink = false } = {}) => {
  if (!city || city.size == null || !(men > 0)) return city;
  let size = city.size;
  let food = city.food || 0;
  let left = men;
  for (let guard = 0; guard < PEOPLE_GUARD && left > 0; guard++) {
    const threshold = growthThreshold(size, speedMult);
    const worth = foodForPeople(size, left, threshold);
    if (worth <= food) { food -= worth; left = 0; break; }
    // The bank covers part; the rest is a whole size (or nothing more, for a levy).
    left -= food > 0 ? (left * food) / worth : 0;
    food = 0;
    if (!canShrink || size <= 1) break;
    size -= 1;
    food = growthThreshold(size, speedMult) - 0.1; // the smaller size starts (just short of) full
  }
  const roundedFood = Math.round(food * 10) / 10;
  if (size === city.size && roundedFood === city.food) return city;
  return withPeople({ ...city, size, food: roundedFood }, speedMult);
};
// The derived people number follows the stock at once (resolveTurn rewrites it each turn too).
const withPeople = (city, speedMult) => (city.currentPopulation == null ? city : { ...city, currentPopulation: peopleOf(city, growthThreshold(city.size, speedMult)) });
const PEOPLE_GUARD = 8;

/** Add `men` people to a city as food in its bank (Develop Province, Population Policy), up to just below the next threshold. */
export const addPeople = (city, men, { speedMult = 1 } = {}) => {
  if (!city || city.size == null || !(men > 0)) return city;
  const threshold = growthThreshold(city.size, speedMult);
  const food = Math.min(threshold - 0.1, (city.food || 0) + foodForPeople(city.size, men, threshold));
  const rounded = Math.round(food * 10) / 10;
  return rounded > (city.food || 0) ? withPeople({ ...city, food: rounded }, speedMult) : city;
};
