// src/engine/aiProduction.js
// What an AI city builds (plans/civ-map-rework.md, C7.5 and workstream 9's first piece). Pure and
// deterministic: the same city in the same state picks the same item. One choice when the
// queue is empty:
//   1. A settler, when the city is size SETTLER_FROM_SIZE or more, the nation has no settler on
//      the road, an outpost slot is free, and a site worth SITE_SCORE_MIN is within reach.
//   2. The next tier of a building line, in BUILDING_PRIORITY order, that the city can build and
//      finish within MAX_BUILD_TURNS at its current production.
//   3. An infantry unit while the nation fields fewer land units than UNITS_PER_CITY per city.
//   4. Nothing (production is banked by the queue's overflow).
// Ripples: AI expansion fills the map over the ages (C7's 50% of land by 500 CE target), AI
// buildings feed the same yields the player's do, and AI armies come from the same cities.
import { getTiles } from '../data/geo/tiles';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { getAvailableClasses } from '../data/unitClasses';
import { canQueue, productionCost } from './world/cities';
import { bestSites, outpostsOf, outpostSlots, settlersOf } from './settlers';

export const SETTLER_FROM_SIZE = 2;
export const SETTLER_THINK_PERIOD = 3; // a city looks for a site one turn in three (the site search is the costly part)
export const MAX_BUILD_TURNS = 40;
export const UNITS_PER_CITY = 1;
export const BUILDING_PRIORITY = ['food', 'economy', 'culture', 'science', 'industry', 'military', 'infrastructure', 'defense', 'naval'];

/** The nation-wide counts the choice reads, computed once a turn for every nation (the per-city
 * scans of units and cities were the cost of the phase): { settlers, outposts, landUnits }. */
export const nationCounts = (state) => {
  const out = {};
  const of = (id) => (out[id] ||= { settlers: 0, outposts: 0, landUnits: 0 });
  Object.values(state.units || {}).forEach((u) => { if (!u.ownerId) return; if (u.classId === 'settler') of(u.ownerId).settlers += 1; else if (u.domain === 'land') of(u.ownerId).landUnits += 1; });
  Object.values(state.regions || {}).forEach((c) => { if (c.owner && c.outpost) of(c.owner).outposts += 1; });
  return out;
};

/** The item an AI city with an empty queue should build, or null. `ctx`: { researched, ageId,
 * citiesOwned, units, counts? (nationCounts(state)[nation]) }. */
export const chooseProduction = (state, city, ctx) => {
  if (city.outpost || city.production?.current) return null;
  const tiles = getTiles();
  const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
  const nationId = city.owner;
  const units = ctx.units || state.units || {};
  const counts = ctx.counts || { settlers: settlersOf(units, nationId).length, outposts: outpostsOf(state.regions, nationId).length, landUnits: Object.values(units).filter((u) => u.ownerId === nationId && u.domain === 'land' && u.classId !== 'settler').length };
  const production = Math.max(1, city.lastYields?.production ?? city.dev?.production ?? city.size ?? 1);
  const affordable = (item) => productionCost(item, { ageId: ctx.ageId, citiesOwned: ctx.citiesOwned }) / production <= MAX_BUILD_TURNS;

  const thinks = ((ctx.turnNumber || 0) + city.tile) % SETTLER_THINK_PERIOD === 0;
  if (thinks && city.size >= SETTLER_FROM_SIZE && counts.settlers === 0 && counts.outposts < outpostSlots(ctx.ageId)) {
    const site = bestSites(state, nationId, city.tile, ctx.ageId, { limit: 1 })[0];
    const item = { kind: 'settler' };
    if (site && canQueue(city, tiles, world, item, ctx).ok) return item; // bestSites already holds the quality floor
  }
  for (const category of BUILDING_PRIORITY) {
    const tier = (city.buildings?.categories?.[category] ?? -1) + 1;
    if (!BUILDING_CATEGORIES[category]?.tiers[tier]) continue;
    const item = { kind: 'building', category, tier };
    if (canQueue(city, tiles, world, item, ctx).ok && affordable(item)) return item;
  }
  if (counts.landUnits < ctx.citiesOwned * UNITS_PER_CITY && getAvailableClasses(ctx.ageId).includes('infantry')) {
    const item = { kind: 'unit', classId: 'infantry' };
    if (canQueue(city, tiles, world, item, ctx).ok && affordable(item)) return item;
  }
  return null;
};
