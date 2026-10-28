// src/engine/spending.js
// What gold buys, and what it costs (playtest audits lane CB04: I017, I019, I021, I024, X24).
//
// The treasury used to pile up with nothing to spend it on (a peaceful player held about 19,000
// gold at turn 250). Gold now has three recurring uses in a city, all priced here so the button,
// the reducer and the AI read one number:
//
// 1. RUSH (I019). Pay gold for the production an order still lacks. The order is not conjured: its
//    progress is filled to its cost and the turn completes it like any other (so a settler still
//    needs its people, a wonder its race), which is why a rushed order arrives on the next turn.
//      gold = ceil(missing production x RUSH_GOLD_PER_HAMMER x rushRate(item) x (1 + RUSH_HEAT_STEP x heat))
//    `heat` is how many rushes the city has had lately: +1 per rush, capped at RUSH_HEAT_MAX, one
//    cools every RUSH_COOL_REF_TURNS reference turns (speedTurns). A city buying a whole army in a
//    turn pays up to double for the last pieces; a city that rushes now and then pays the base.
//    Production costs already carry the speed multiplier, so the gold price follows the speed too.
//    Bought production is progress, never yield: it pays no gold back (a city's production is also
//    income, addendum X24), it is never refunded, and it stays with the order it was bought for
//    (cities.js keeps progress per item). Feeds: the queue (the order completes), the treasury
//    (the sink), and through `city.rush` the next price. Not for wonders, and not in a city the
//    enemy holds, besieges or fights over.
// 2. STANDING WORKS (I021). Infrastructure and Defenses were 80 and 60 gold flat for ten levels,
//    next to nothing after the first age. Their gold now follows the age, the game speed and the
//    level already built:
//      gold = round5(base x eraGoldFactor(age) x speedCostMult x (1 + LEVEL_COST_STEP x level))
//    Never the size of the treasury.
// 3. INVEST IN GROWTH. One purchase banks GROWTH_BUY_SHARE of the food the next citizen needs
//    (it used to add about 2 food of 49), priced like a standing work with the city's size as the
//    level, so it stays a real choice for a big city.
import { getTiles } from '../data/geo/tiles';
import { AGE_ORDER, speedCostMult, speedTurns, FIRST_AGE_ID } from '../data/ages';
import { ACTION_COSTS } from '../data/actionCosts';
import { BUILDING_CATEGORIES, getBuildingTierCost, getBuildingBuildCost } from '../data/buildings';
import { unitDisplayName } from '../data/unitNames';
import { ROBOT_VARIANTS } from '../data/unitClasses';
import { IMPROVEMENTS } from '../data/tileYields';
import { ageOf } from './nationState';
import { nextTemplateUnit } from './armyTemplates';
import { canQueue, itemKey } from './world/cities';
import { cityLive, queueView, worldOf } from './cityEconomy';
import { reasonOf } from './messages';

// --- Rush ---------------------------------------------------------------------------------------
/** Gold per missing point of production (provisional). A city earns about 3 gold for every point
 * of production it makes, so a treasury spent only on rushing adds about three quarters to what
 * the cities build: a premium, never the cheap way. Civilization VI charges 4 as well. */
export const RUSH_GOLD_PER_HAMMER = 4;
export const RUSH_HEAT_STEP = 0.2;
export const RUSH_HEAT_MAX = 5;
export const RUSH_COOL_REF_TURNS = 5;
/** Settlers cost more to buy (provisional): a scripted player that rushed everything founded about
 * 60% more cities by turn 250 at Normal, most of the gain from bought settlers. They still need
 * their citizen (size 2), so gold cannot replace growth. */
export const RUSH_KIND_MULT = { settler: 1.5 };
const RUSH_BLOCKED_KINDS = { wonder: 'A wonder cannot be bought: it is built.' };


/** How many recent rushes still weigh on this city's price (0 to RUSH_HEAT_MAX). */
export const rushHeat = (city, turnNumber, gameSpeed, ageId = FIRST_AGE_ID) => {
  const r = city?.rush;
  if (!r || !(r.heat > 0)) return 0;
  const cooled = Math.floor(Math.max(0, (turnNumber || 0) - (r.turn || 0)) / speedTurns(RUSH_COOL_REF_TURNS, gameSpeed, ageId));
  return Math.max(0, Math.min(RUSH_HEAT_MAX, r.heat) - cooled);
};
export const rushPriceMult = (heat) => 1 + RUSH_HEAT_STEP * Math.min(RUSH_HEAT_MAX, Math.max(0, heat));
// Buildings cost less production since lane city-builds but not less gold (lead's call, 28 Oct; Civ VI
// prices purchases apart from production): a building's missing point is priced at its gold-table
// cost over its production cost, so buying one costs what it did before.
/** The gold factor of one missing point of `item` (kind premium and the building ratio), before heat. */
export const rushRate = (item) => {
  const built = item?.kind === 'building' && getBuildingBuildCost(item.category, item.tier);
  return (RUSH_KIND_MULT[item?.kind] || 1) * (built ? getBuildingTierCost(item.category, item.tier) / built : 1);
};
export const rushGold = (hammers, heat = 0, item = null) => (hammers > 0 ? Math.ceil(hammers * RUSH_GOLD_PER_HAMMER * rushRate(item) * rushPriceMult(heat) - 1e-9) : 0);

/** The most of `missing` production `budget` gold buys at the rush price: { hammers, gold } (whole
 * points, gold never above the budget) or null when not even one point. The AI buys this way
 * (aiEconomy.js tryRushProduction). */
export const rushAffordable = (missing, budget, heat = 0, item = null) => {
  if (!(missing > 0) || !(budget > 0)) return null;
  const perPoint = RUSH_GOLD_PER_HAMMER * rushRate(item) * rushPriceMult(heat);
  const hammers = Math.min(Math.ceil(missing - 1e-9), Math.floor(budget / perPoint));
  if (hammers < 1) return null;
  const gold = rushGold(hammers, heat, item);
  return gold <= budget ? { hammers: Math.min(hammers, missing), gold } : null;
};

const treasuryOf =(state, nationId) => (nationId === state.playerNationId ? state.resources?.gold : state.nations?.[nationId]?.economy?.gold) || 0;

/**
 * The quote to rush the order at `index` of [current, ...queue] in a city:
 * { ok, reason, gold, hammers, cost, progress, item, key, heat, mult, turns }. `gold` is what
 * RUSH_PRODUCTION takes, `hammers` the production it buys, `turns` the wait it replaces (null when
 * the city makes no production). With `ok: false`, `reason` says why in the player's words and
 * `gold` is still the price when there is one (so a button can show what is missing).
 */
export const rushQuote = (state, cityId, index = 0, nationId = state.playerNationId, treasury = null) => {
  const city = state.regions?.[cityId];
  if (!city || city.owner !== nationId) return { ok: false, ...reasonOf('m.why.notYourCity') };
  if (city.outpost || city.razing || city.tile == null || !city.production) return { ok: false, ...reasonOf('m.why.rush.nothingBuilt') };
  const live = cityLive(state, cityId);
  const row = queueView(state, cityId, live)[index];
  if (!row) return { ok: false, ...reasonOf('m.why.rush.nothing') };
  const { item, cost, progress, key } = row;
  const base = { item, key, cost, progress, ageId: live.ctx.ageId };
  if (RUSH_BLOCKED_KINDS[item.kind]) return { ok: false, reason: RUSH_BLOCKED_KINDS[item.kind], ...base };
  if (city.occupiedBy || city.underInvasion || city.siege) return { ok: false, ...reasonOf('m.why.rush.enemy'), ...base };
  if (!(cost > 0) || cost >= 9999) return { ok: false, ...reasonOf('m.why.rush.cannot'), ...base };
  const list = [city.production.current, ...(city.production.queue || [])].filter(Boolean);
  if (index > 0 && list.findIndex((it) => itemKey(it) === key) !== index) return { ok: false, ...reasonOf('m.why.rush.firstKind'), ...base };
  const can = canQueue(city, getTiles(), worldOf(state), item, { researched: live.ctx.researched, ageId: live.ctx.ageId, techFree: item.kind === 'unit' }); // a queued unit was allowed when queued (old saves): rushing does not re-gate it
  // A later building tier waits for the tier queued before it.
  if (!can.ok) return { ok: false, reason: item.kind === 'building' && index > 0 && can.reason === 'Tiers are built in order.' ? 'Rush the tier before it first.' : can.reason, ...base };
  const hammers = Math.max(0, Math.round((cost - progress) * 10) / 10);
  if (!(hammers > 0)) return { ok: false, ...reasonOf('m.why.rush.paid'), ...base, hammers: 0, gold: 0 };
  const heat = rushHeat(city, state.turnNumber, state.gameSpeed, live.ctx.ageId);
  const gold = rushGold(hammers, heat, item);
  const quote = { ...base, hammers, gold, heat, mult: rushPriceMult(heat), turns: row.pieceTurns ?? row.turns };
  if ((treasury ?? treasuryOf(state, nationId)) < gold) return { ok: false, ...reasonOf('m.why.needsGold', { gold }), ...quote };
  return { ok: true, ...quote };
};

/** A short name of an order for the log ("Granary", "Spearmen", "settlers"). */
export const rushItemName = (item, ageId = FIRST_AGE_ID) => {
  if (!item) return 'order';
  if (item.kind === 'building') return BUILDING_CATEGORIES[item.category]?.tiers[item.tier]?.name || item.category;
  if (item.kind === 'unit' && item.explorer) return 'scouts';
  if (item.kind === 'unit' && item.robot) return ROBOT_VARIANTS[item.classId];
  if (item.kind === 'unit') return unitDisplayName(ageId, item.classId, item.navalLine);
  if (item.kind === 'army') { const next = nextTemplateUnit(item); return next ? `${unitDisplayName(ageId, next)} for ${item.name}` : item.name; }
  if (item.kind === 'improvement') return IMPROVEMENTS[item.improvement]?.name || item.improvement;
  if (item.kind === 'settler') return 'settlers';
  return item.kind;
};

/** The city with the quoted order paid for: its progress filled to its cost, the city's rush heat
 * one higher. Pure; the caller takes the gold. */
export const applyRush = (city, index, quote, turnNumber) => {
  const p = city.production;
  const rush = { heat: Math.min(RUSH_HEAT_MAX, (quote.heat || 0) + 1), turn: turnNumber || 0 };
  if (index === 0) return { ...city, rush, production: { ...p, progress: Math.max(p.progress || 0, quote.cost) } };
  return { ...city, rush, production: { ...p, stored: { ...(p.stored || {}), [quote.key]: Math.max(p.stored?.[quote.key] || 0, quote.cost) } } };
};

// --- Standing works and growth --------------------------------------------------------------------
/** Gold prices follow the age on the curve unit costs use (src/data/ages.js unitCostMult: 1 + 0.6 an age so far). */
export const ERA_GOLD_STEP = 0.6;
export const eraGoldFactor = (ageId) => 1 + ERA_GOLD_STEP * Math.max(0, AGE_ORDER.indexOf(ageId));
export const LEVEL_COST_STEP = 0.25;
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

/** The gold a priced action costs now: the base of ACTION_COSTS[key] by age, game speed and the
 * `level` already built. Other currencies of the action (adm, dip, mil) are untouched. */
export const scaledGold = (state, key, level = 0, nationId = state.playerNationId) => {
  const base = ACTION_COSTS[key]?.gold || 0;
  const ageId = ageOf(state, nationId);
  return round5(base * eraGoldFactor(ageId) * speedCostMult(state.gameSpeed, ageId) * (1 + LEVEL_COST_STEP * Math.max(0, level)));
};
/** The full cost object of a level-priced action (what canAfford and applyCosts read). */
export const scaledCosts = (state, key, level = 0, nationId = state.playerNationId) => ({ ...ACTION_COSTS[key], gold: scaledGold(state, key, level, nationId) });

export const infrastructureCosts = (state, city) => scaledCosts(state, 'buildInfrastructure', city?.currentInfrastructure || 0);
export const defensesCosts = (state, city) => scaledCosts(state, 'buildDefenses', city?.defenseLevel || 0);

/** Invest in growth (cityEconomy.js investInGrowth banks GROWTH_BUY_SHARE of the next citizen's
 * food): the price, with the city's size beyond 1 as the level (feeding a big city costs more). */
export const growthCosts = (state, city) => scaledCosts(state, 'populationPolicy', Math.max(0, (city?.size || 1) - 1));
