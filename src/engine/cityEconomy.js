// src/engine/cityEconomy.js
// One place for what a city sheet SAYS and what the engine DOES (playtest audits, lane L3: I036,
// I039, I052 and the plan's rule that every price, ETA and eligibility shown comes from the
// selector that executes it). Pure selectors over game state; the city panel, the city rail and
// the reducer read these, so a number on a button is the number that is charged.
//
//   cityCtx       the context the turn gives a city (the same inputs resolveTurn's cities phase
//                 builds: the owner's research and age, the speed table, the nation's luxuries,
//                 its governor, a wonder's culture). The sheet used to pass less (this city's
//                 luxuries only, no governor), so its yields could differ from the turn's.
//   cityLive      the tiles worked and the yields for the city as it stands NOW (focus, locks and
//                 investment included), optionally under another focus (the focus preview).
//   growthView    food bank, threshold, the housing brake and the turns to the next citizen.
//   queueView     every queued item with its own progress, cost and the turn it finishes, counted
//                 down the queue (item 2 finishes after item 1). The rail and the sheet both read it.
//   buildTurns    the turns an item would take on its own from what is stored for it.
//   landQuotes / quoteBuyTile   the tiles the city may buy and the gold each costs. BUY_TILE
//                 charges exactly this (the reducer used to leave the research discounts out).
//   focusPreview  the yields under each focus, and why they are all the same when they are.
//   LONG_BUILD_TURNS / isLongBuild   the "this will take a long time" line of the Build tab.
import { getTiles } from '../data/geo/tiles';
import { getEffectiveAgeId, speedCostMult } from '../data/ages';
import { cityWonderTotal } from '../data/greatProjects';
import { IMPROVEMENTS, RESOURCES_ON_TILES, tileFacts, tileYields } from '../data/tileYields';
import { TECH_TREE } from '../data/techTree';
import { getResearched, getTechAgeId } from './nationState';
import { governorEffects } from './governors';
import { isIndependent } from '../data/independents';
import { independentCityCtx } from './independents';
import { logisticGrowthMult } from './population';
import { nextTemplateUnit, templateProgress } from './armyTemplates';
import {
  FOCUS, MAX_SIZE, FOOD_PER_CITIZEN, allocateTiles, cityYields, housingOf, amenitiesOf, growthThreshold, productionCost,
  claimCandidates, buyTileCost, itemProgress, itemKey, addPeople, sizeToPeople
} from './world/cities';

export const worldOf = (state) => ({ cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} });

// Per regions map: how many cities each nation holds and which luxuries it works (one pass).
const nationFactsMemo = new WeakMap();
const nationFacts = (regions) => {
  let hit = nationFactsMemo.get(regions);
  if (hit) return hit;
  hit = { cities: {}, luxuries: {} };
  Object.values(regions || {}).forEach((c) => {
    if (!c.owner) return;
    hit.cities[c.owner] = (hit.cities[c.owner] || 0) + 1;
    if (c.lastYields?.luxuries) { const set = (hit.luxuries[c.owner] ||= new Set()); c.lastYields.luxuries.forEach((l) => set.add(l)); }
  });
  nationFactsMemo.set(regions, hit);
  return hit;
};

/** The context the turn gives this city (resolveTurn.js runCitiesPhase `ctxFor`), from the state
 * as it stands. */
export const cityCtx = (state, city) => {
  const nid = city.owner;
  const facts = nationFacts(state.regions);
  const ageId = getEffectiveAgeId(state.age, nid ? getTechAgeId(state, nid) : state.age);
  let ctx = {
    researched: nid ? getResearched(state, nid) : [],
    ageId,
    turnNumber: state.turnNumber,
    citiesOwned: facts.cities[nid] || 1,
    speedMult: speedCostMult(state.gameSpeed, ageId),
    luxuries: facts.luxuries[nid] ? facts.luxuries[nid].size : 0,
    greatProjects: state.greatProjects || {},
    ...(isIndependent(state.nations, nid) ? independentCityCtx(state, nid, state.age) : {})
  };
  const wonderCulture = cityWonderTotal(state.greatProjects, city.id, 'local.culture');
  if (wonderCulture) ctx = { ...ctx, cultureBonus: (ctx.cultureBonus || 0) + wonderCulture };
  if (!nid || !state.nations?.[nid]?.governors || city.id == null) return ctx;
  const g = governorEffects(state, nid, city.id, state.turnNumber);
  if (!g.governed) return ctx;
  return { ...ctx, foodBonus: g.food, productionMult: (ctx.productionMult || 0) + g.productionMult, cultureBonus: (ctx.cultureBonus || 0) + g.culture };
};

/** What a production item costs in this city (the cost the turn will ask for). */
export const costCtxOf = (ctx) => ({ ageId: ctx.ageId, citiesOwned: ctx.citiesOwned, speedMult: ctx.speedMult });

const NO_YIELDS = Object.freeze({ food: 0, production: 0, gold: 0, science: 0, culture: 0, strategic: {}, luxuries: [], raw: { food: 0, production: 0, gold: 0 } });

/** The city as the next turn will work it: { city, ctx, worked, yields, housing, amenities }.
 * `over` replaces fields of the city for a what-if (another focus, a building tier). An outpost
 * or a burning city yields nothing. */
export const cityLive = (state, cityId, over = null) => {
  const base = state.regions?.[cityId];
  if (!base) return null;
  const city = over ? { ...base, ...over } : base;
  const ctx = cityCtx(state, base);
  if (city.outpost || city.razing || city.tile == null || !city.tiles) return { city, ctx, worked: [], yields: NO_YIELDS, housing: 0, amenities: { need: 0, supply: 0, net: 0 } };
  const tiles = getTiles();
  const world = worldOf(state);
  const worked = allocateTiles(city, tiles, world, ctx.researched);
  return { city, ctx, worked, yields: cityYields(city, tiles, world, worked, ctx.researched, ctx), housing: housingOf(city, ctx.researched), amenities: amenitiesOf(city, ctx) };
};

/** Food and growth: { bank, threshold, housing, speed, turns, state } with `state` one of
 * 'growing', 'full' (housing stops it), 'starving', 'still' (no surplus), 'max', 'outpost'. */
export const growthView = (state, cityId, live = cityLive(state, cityId)) => {
  if (!live) return null;
  const { city, ctx, yields, housing } = live;
  if (city.outpost) return { bank: 0, threshold: 0, housing: 0, speed: 0, turns: null, state: 'outpost' };
  const threshold = growthThreshold(city.size, ctx.speedMult || 1);
  const speed = logisticGrowthMult(city.size, housing);
  const bank = city.food || 0;
  const cap = Math.min(MAX_SIZE, ctx.maxSize ?? MAX_SIZE);
  let status = 'growing';
  if (city.size >= cap) status = 'max';
  else if (yields.food < 0) status = 'starving';
  else if (yields.food <= 0) status = 'still';
  else if (speed <= 0) status = 'full';
  const turns = status === 'growing' ? Math.max(1, Math.ceil(Math.max(0, threshold - bank) / (yields.food * speed))) : null;
  return { bank, threshold, housing, speed, turns, state: status };
};

/** The city after Invest in growth (POPULATION_POLICY, I032): `rate` of its people banked as food
 * toward the next citizen, at this game's growth threshold (the speed table). The same object
 * when the bank is already full. The reducer and the button's preview both call this. */
export const investInGrowth = (state, cityId, rate) => {
  const city = state.regions?.[cityId];
  if (!city || city.size == null) return city;
  return addPeople(city, (city.currentPopulation || sizeToPeople(city.size)) * rate, { speedMult: cityCtx(state, city).speedMult || 1 });
};

// An army order is built piece by piece: what is left of it costs the sum of its missing pieces.
const armyRemainingCost = (item, costCtx) => {
  let order = item; let total = 0;
  for (let guard = 0; guard < 200; guard++) {
    const next = nextTemplateUnit(order);
    if (!next) break;
    total += productionCost({ kind: 'unit', classId: next }, costCtx);
    order = { ...order, built: { ...(order.built || {}), [next]: ((order.built || {})[next] || 0) + 1 } };
  }
  return total;
};

const turnsFor = (hammers, production) => (production > 0 ? Math.max(1, Math.ceil(Math.max(0, hammers) / production)) : null);

/** The queue with its numbers: [{ index, item, key, cost, progress, turns, pieceTurns }] for
 * [current, ...queue]. `cost` is what the turn asks for (the next piece of an army), `turns` the
 * turn the whole order is done counting everything ahead of it, `pieceTurns` (armies only) the
 * turns to its next unit. `turns` is null while the city makes no production. */
export const queueView = (state, cityId, live = cityLive(state, cityId)) => {
  if (!live) return [];
  const { city, ctx, yields } = live;
  const costCtx = costCtxOf(ctx);
  const list = [city.production?.current, ...(city.production?.queue || [])].filter(Boolean);
  let ahead = 0;
  return list.map((item, index) => {
    const cost = productionCost(item, costCtx);
    const progress = itemProgress(city, index);
    const whole = item.kind === 'army' ? armyRemainingCost(item, costCtx) : cost;
    ahead += Math.max(0, whole - progress);
    return {
      index, item, key: itemKey(item), cost, progress,
      turns: turnsFor(ahead, yields.production),
      pieceTurns: item.kind === 'army' ? turnsFor(cost - progress, yields.production) : null,
      pieces: item.kind === 'army' ? templateProgress(item) : null
    };
  });
};

/** { cost, stored, turns } for an item built on its own from what is stored for it (the build
 * list's "N production, M turns"). */
export const buildQuote = (state, cityId, item, live = cityLive(state, cityId)) => {
  if (!live) return null;
  const cost = productionCost(item, costCtxOf(live.ctx));
  const stored = live.city.production?.stored?.[itemKey(item)] || 0;
  return { cost, stored, turns: turnsFor(cost - stored, live.yields.production) };
};

// --- Long builds (plan W07 task 9) --------------------------------------------------------------
// A build that would take more than about 20 turns at Normal speed deserves a word before it is
// queued. Slower speeds stretch every build by the speed table, so the line moves with it.
export const LONG_BUILD_TURNS = 20;
export const longBuildTurns = (state, ageId) => Math.round(LONG_BUILD_TURNS * speedCostMult(state.gameSpeed, ageId) / speedCostMult('normal', ageId));
export const isLongBuild = (state, ageId, turns) => turns == null || turns > longBuildTurns(state, ageId);

// --- Land (I036, I037, I038) ------------------------------------------------------------------
/** What a resource on a tile needs before it pays: { resource, kind, improvement, improvementName,
 * needsTech, needsTechName, text } or null without a resource. Owning the land is not enough: a
 * strategic resource reaches the stocks, and a luxury counts, only from a worked tile with the
 * right improvement (tileYields.js strategicSupply, cities.js cityYields). */
export const resourceNeed = (facts, researched = []) => {
  const r = RESOURCES_ON_TILES[facts?.resource];
  if (!r) return null;
  const imp = IMPROVEMENTS[r.improvement];
  const built = facts.improvement === r.improvement && !facts.pillaged;
  const needsTech = imp?.requiresTech && !researched.includes(imp.requiresTech) ? imp.requiresTech : null;
  const needsTechName = needsTech ? TECH_TREE[needsTech]?.name || needsTech : null;
  const name = facts.resource[0].toUpperCase() + facts.resource.slice(1);
  const a = /^[aeiou]/i.test(imp?.name || '') ? 'an' : 'a';
  let text;
  if (built) text = r.kind === 'strategic' ? `${name}: the ${imp.name} supplies it while a citizen works the tile.` : `${name}: the ${imp.name} is built.`;
  else if (r.kind === 'strategic') text = `${name}: owning the tile gives no ${facts.resource}. It needs ${a} ${imp.name} here and a citizen working it${needsTechName ? ` (the ${imp.name} needs ${needsTechName})` : ''}.`;
  else if (r.kind === 'luxury') text = `${name}: counts as a luxury only with ${a} ${imp.name} here and a citizen working it${needsTechName ? ` (the ${imp.name} needs ${needsTechName})` : ''}.`;
  else text = `${name}: ${a} ${imp.name} here adds its bonus again${needsTechName ? ` (needs ${needsTechName})` : ''}.`;
  return { resource: facts.resource, kind: r.kind, improvement: r.improvement, improvementName: imp?.name || r.improvement, built, needsTech, needsTechName, text };
};

/** Every tile the city may buy, best first: [{ tile, ring, culture, cost, affordable, facts,
 * yields, need }]. `cost` is the gold BUY_TILE takes. */
export const landQuotes = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city || city.outpost || city.tile == null || !city.tiles) return [];
  const tiles = getTiles();
  const world = worldOf(state);
  const ctx = cityCtx(state, city);
  const gold = state.resources?.gold || 0;
  return claimCandidates(city, tiles, world, { ageId: ctx.ageId, researched: ctx.researched, maxBorderRing: ctx.maxBorderRing ?? Infinity }).map((c) => {
    const facts = tileFacts(tiles, c.tile, world.tileState[c.tile]);
    const cost = buyTileCost(city, c);
    return { tile: c.tile, ring: c.ring, culture: c.cost, cost, affordable: gold >= cost, facts, yields: tileYields(facts, ctx.researched), need: resourceNeed(facts, ctx.researched) };
  });
};

/** The quote for one tile: { ok, reason, cost, tile }. What the button shows and what the reducer
 * charges are this one number. */
export const quoteBuyTile = (state, cityId, tile) => {
  const city = state.regions?.[cityId];
  if (!city || city.owner !== state.playerNationId) return { ok: false, reason: 'Not your city.' };
  const row = landQuotes(state, cityId).find((q) => q.tile === tile);
  if (!row) return { ok: false, reason: 'That tile cannot be claimed.' };
  if (!row.affordable) return { ok: false, reason: `Needs ${row.cost} gold.`, cost: row.cost, tile };
  return { ok: true, cost: row.cost, tile };
};

// --- Focus (I051, and "focus does nothing at size 1 to 2") --------------------------------------
const sameTiles = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).every((t, i) => t === [...b].sort((x, y) => x - y)[i]);

/** The yields under each focus and, when no focus changes anything, why:
 * { rows: [{ focus, current, food, production, gold, same }], allSame, reason }. */
export const focusPreview = (state, cityId) => {
  const base = cityLive(state, cityId);
  if (!base) return null;
  const { city } = base;
  const rows = FOCUS.map((focus) => {
    const live = focus === city.focus ? base : cityLive(state, cityId, { focus });
    return { focus, current: focus === city.focus, food: live.yields.food, production: live.yields.production, gold: live.yields.gold, same: sameTiles(live.worked, base.worked) };
  });
  const allSame = rows.every((r) => r.same);
  let reason = null;
  if (allSame) {
    const tiles = getTiles();
    const workable = city.outpost || !city.tiles ? 0 : city.tiles.filter((t) => t !== city.tile && (tiles.land[t] === 1 || ['coast', 'lake'].includes(tiles.terrainOf(t)))).length;
    const locked = (city.locked || []).length;
    const need = FOOD_PER_CITIZEN * city.size;
    if (city.outpost) reason = 'An outpost works no land yet. Focus starts to matter once it becomes a city.';
    else if (city.underInvasion) reason = 'The enemy holds the countryside: the city lives off its centre, whatever the focus.';
    else if (workable <= city.size) reason = `The city has ${workable} tile${workable === 1 ? '' : 's'} to work and ${city.size} citizen${city.size === 1 ? '' : 's'}: every tile is worked, so there is nothing to choose. More land (culture, or Buy land) gives focus something to do.`;
    else if (locked >= city.size) reason = 'Every citizen is locked to a tile (Citizens tab). Unlock one to let focus choose.';
    else if (city.size <= 2) reason = `At size ${city.size} the city works only ${city.size} tile${city.size === 1 ? '' : 's'}, and they must feed it first (${need} food). The same land wins under every focus. Focus starts to matter as the city grows.`;
    else reason = 'The same tiles are the best under every focus here: the city needs them for food first.';
  }
  return { rows, allSame, reason };
};
