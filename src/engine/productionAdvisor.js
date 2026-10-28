// src/engine/productionAdvisor.js
// The production advisor (lane turn-pacing; Civ VI marks a "recommended" item in its production
// list, Civ IV lets a city automate its production). One tap fills every player city that has
// nothing to build with what an AI city in its place would build (aiProduction.js chooseProduction,
// with the player's own research, age, speed and laws), so End Turn's "Choose production" is one
// tap for all cities instead of a sheet per city (playtest: about five taps a city, 50 of 61 steps
// of a modern session). When the AI scoring wants nothing (every building too slow, the army big
// enough) the first building the city can queue, in its doctrine's order, then infantry, is the pick:
// the city is not left idle. Pure; the reducer queues the picks through QUEUE_PRODUCTION.
import { chooseProduction, nationCounts, buildingOrder } from './aiProduction';
import { idleCities } from './turnBlockers';
import { getResearched, ageOf } from './nationState';
import { speedCostMult, speedTrainMult } from '../data/ages';
import { rulerCityCtx } from './lawRules';
import { isBound } from '../data/worldCongress';
import { canQueue, queueItem } from './world/cities';
import { getTiles } from '../data/geo/tiles';
import { BUILDING_CATEGORIES } from '../data/buildings';

/** The context chooseProduction reads, for the player's cities. */
export const playerProductionCtx = (state) => {
  const me = state.playerNationId;
  const ageId = ageOf(state, me);
  return {
    researched: getResearched(state, me),
    ageId,
    turnNumber: state.turnNumber || 1,
    citiesOwned: Object.values(state.regions || {}).filter((c) => c.owner === me).length || 1,
    speedMult: speedCostMult(state.gameSpeed, ageId),
    trainMult: speedTrainMult(state.gameSpeed, ageId),
    greatProjects: state.greatProjects || {},
    ...rulerCityCtx(state.nations?.[me]),
    ...(isBound(state, 'weaponsBan', me) ? { noRobots: true } : {})
  };
};

const fallbackPick = (state, city, ctx) => {
  const tiles = getTiles();
  const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
  const buildings = buildingOrder(state.nations?.[city.owner]?.doctrine)
    .map((category) => ({ kind: 'building', category, tier: (city.buildings?.categories?.[category] ?? -1) + 1 }))
    .filter((item) => BUILDING_CATEGORIES[item.category]?.tiers[item.tier]);
  return [...buildings, { kind: 'unit', classId: 'infantry' }].find((item) => canQueue(city, tiles, world, item, ctx).ok) || null;
};

// chooseProduction remembers "this nation already weighed a settler" per regions map (one site
// search a turn for the AI). The advisor reads its own copy so a preview never changes what the
// action then queues (the same state always gets the same picks); one copy per call, shared by its cities.
const ownView = (state) => ({ ...state, regions: { ...state.regions } });
const pickIn = (view, cityId, ctx, counts) => {
  const city = view.regions?.[cityId];
  if (!city || city.owner !== view.playerNationId || city.outpost || city.razing || city.production?.current) return null;
  return chooseProduction(view, city, { ...ctx, units: view.units, counts }) || fallbackPick(view, city, ctx);
};
const countsOf = (state) => ({ settlers: 0, outposts: 0, landUnits: 0, ...(nationCounts(state)[state.playerNationId] || {}) });

/** The advisor's pick for one player city with an empty queue, or null. */
export const advisorPick = (state, cityId) => pickIn(ownView(state), cityId, playerProductionCtx(state), countsOf(state));

/**
 * The picks for every idle city (turnBlockers.js idleCities), in id order: [{ cityId, item }].
 * Each pick counts toward the next one (one settler at a time, regiments in training), as the AI's
 * own pass does.
 */
export const advisorPicks = (state) => {
  const ctx = playerProductionCtx(state);
  const counts = countsOf(state);
  const view = ownView(state);
  const out = [];
  idleCities(state).forEach((city) => {
    const item = pickIn(view, city.id, ctx, counts);
    if (!item) return;
    if (item.kind === 'settler') counts.settlers += 1;
    if (item.kind === 'unit') counts.queuedUnits = (counts.queuedUnits || 0) + 1;
    out.push({ cityId: city.id, item });
  });
  return out;
};

// --- Keep building (lane city-builds) ----------------------------------------------------------
// A standing order per city (Civ IV's "repeat" and automated production, Humankind's repeat
// toggle): `city.production.keep` is 'repeat' (the last unit again, cities.js processCity) or
// 'advisor' (the advisor's pick whenever the queue runs dry). The cities phase calls keepBuilding
// after the cities have worked, so a city with a standing order never meets the player as idle.
// A 'repeat' city whose last order was not a unit takes the advisor's pick too.
export const KEEP_MODES = ['repeat', 'advisor'];
export const setKeep = (city, keep) => {
  const next = KEEP_MODES.includes(keep) ? keep : undefined;
  if (city.production?.keep === next) return city;
  const production = { ...city.production };
  if (next) production.keep = next; else delete production.keep;
  return { ...city, production };
};

/** The player's cities with a standing order and nothing to build, each given the advisor's pick
 * (counted like advisorPicks). The same state when there is nothing to fill. */
export const keepBuilding = (state) => {
  const me = state.playerNationId;
  const waiting = idleCities(state).filter((c) => c.owner === me && c.production?.keep);
  if (!waiting.length) return state;
  const ctx = playerProductionCtx(state);
  const counts = countsOf(state);
  const view = ownView(state);
  const regions = { ...state.regions };
  waiting.forEach((city) => {
    const item = pickIn(view, city.id, ctx, counts);
    if (!item) return;
    if (item.kind === 'settler') counts.settlers += 1;
    if (item.kind === 'unit') counts.queuedUnits = (counts.queuedUnits || 0) + 1;
    regions[city.id] = queueItem(regions[city.id], item);
  });
  return { ...state, regions };
};
