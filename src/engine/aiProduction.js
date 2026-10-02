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
import { bestSites, outpostsOf, outpostSlots, settlersOf, SITE_SCORE_MIN } from './settlers';

export const SETTLER_FROM_SIZE = 3;
export const SETTLER_THINK_PERIOD = 5; // a city looks for a site one turn in five (the site search is the costly part)
export const MAX_BUILD_TURNS = 40;
export const UNITS_PER_CITY = 1;
export const BUILDING_PRIORITY = ['food', 'economy', 'culture', 'science', 'industry', 'military', 'infrastructure', 'defense', 'naval'];

/** The item an AI city with an empty queue should build, or null. `ctx`: { researched, ageId,
 * citiesOwned, units }. */
export const chooseProduction = (state, city, ctx) => {
  if (city.outpost || city.production?.current) return null;
  const tiles = getTiles();
  const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
  const nationId = city.owner;
  const units = ctx.units || state.units || {};
  const production = Math.max(1, city.lastYields?.production ?? city.dev?.production ?? city.size ?? 1);
  const affordable = (item) => productionCost(item, { ageId: ctx.ageId, citiesOwned: ctx.citiesOwned }) / production <= MAX_BUILD_TURNS;

  const thinks = ((ctx.turnNumber || 0) + city.tile) % SETTLER_THINK_PERIOD === 0;
  if (thinks && city.size >= SETTLER_FROM_SIZE && settlersOf(units, nationId).length === 0 && outpostsOf(state.regions, nationId).length < outpostSlots(ctx.ageId)) {
    const site = bestSites(state, nationId, city.tile, ctx.ageId, { limit: 1 })[0];
    const item = { kind: 'settler' };
    if (site && site.score >= SITE_SCORE_MIN && canQueue(city, tiles, world, item, ctx).ok) return item;
  }
  for (const category of BUILDING_PRIORITY) {
    const tier = (city.buildings?.categories?.[category] ?? -1) + 1;
    if (!BUILDING_CATEGORIES[category]?.tiers[tier]) continue;
    const item = { kind: 'building', category, tier };
    if (canQueue(city, tiles, world, item, ctx).ok && affordable(item)) return item;
  }
  const landUnits = Object.values(units).filter((u) => u.ownerId === nationId && u.domain === 'land' && u.classId !== 'settler').length;
  if (landUnits < ctx.citiesOwned * UNITS_PER_CITY && getAvailableClasses(ctx.ageId).includes('infantry')) {
    const item = { kind: 'unit', classId: 'infantry' };
    if (canQueue(city, tiles, world, item, ctx).ok && affordable(item)) return item;
  }
  return null;
};
