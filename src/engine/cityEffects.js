// src/engine/cityEffects.js
// What a building tier or a tile improvement really gives THIS city (playtest audits I043, M9;
// addendum X24). The data table's `effects` are not the whole truth: the Food line has no entry
// there (the engine gives +1 food and +1 housing a tier), Culture gives culture and an amenity as
// well as order, a Library pays science twice (the city's own and the realm's), every hammer is
// also gold, and Logistics' supply range has no reader at all. So nothing here reads a
// description: the effect is MEASURED. The city is evaluated as the turn would evaluate it
// (cityEconomy.js cityLive, the same context resolveTurn builds) with and without the change, the
// realm's income (helpers.js calcIncome through economy.js calcNationBalance) is computed for both,
// and the difference is the text. cityEffects.test.js checks it against a real resolved turn.
//
//   buildingEffect(state, cityId, category, toTier, fromTier?)   { deltas, parts, text }
//   improvementEffect(state, cityId, item)                         { deltas, parts, text, ... }
// `deltas` (per turn unless noted): food, production, gold (treasury income), upkeep, manpower,
// science (treasury), culture, housing, amenities, unrest, walls, siegeHp, fort.
import { getTiles } from '../data/geo/tiles';
import { IMPROVEMENTS, RESOURCES_ON_TILES, tileFacts, tileYields, strategicSupply } from '../data/tileYields';
import { getRegionModifier } from './modifiers/sheet';
import { calcNationBalance } from './economy';
import { devFromYields } from './development';
import { wallsOf, siegeMaxHp } from './sieges';
import { cityLive, worldOf, cityCtx } from './cityEconomy';

const r1 = (v) => Math.round(v * 10) / 10;
const KEYS = ['food', 'production', 'gold', 'upkeep', 'manpower', 'science', 'culture', 'housing', 'amenities', 'unrest', 'walls', 'siegeHp', 'fort'];

// The nation's units, once per units map (calcNationBalance would filter them on every call).
const unitsMemo = new WeakMap();
const unitsOf = (state, nationId) => {
  let byOwner = unitsMemo.get(state.units);
  if (!byOwner) { byOwner = {}; Object.values(state.units || {}).forEach((u) => { (byOwner[u.ownerId] ||= []).push(u); }); unitsMemo.set(state.units, byOwner); }
  return byOwner[nationId] || [];
};

// The city, and the realm around it, measured with `over` laid on the city record.
const measure = (state, cityId, over = null) => {
  const live = cityLive(state, cityId, over);
  const { city, yields } = live;
  const out = { food: yields.food, production: yields.production, culture: yields.culture, housing: live.housing, amenities: live.amenities.supply, gold: 0, upkeep: 0, manpower: 0, science: yields.science, unrest: 0, walls: wallsOf(city), siegeHp: siegeMaxHp(city, state.greatProjects), fort: 0 };
  // The record as the turn would leave it: the mirror fields the income reads (resolveTurn's cities phase).
  const mirrored = { ...city, lastYields: { gold: yields.gold, production: yields.production, food: yields.food, science: yields.science, culture: yields.culture, luxuries: yields.luxuries, strategic: yields.strategic }, dev: yields.raw ? devFromYields(yields, city) : city.dev };
  const view = { ...state, regions: { ...state.regions, [cityId]: mirrored } };
  out.unrest = -getRegionModifier(view, cityId, 'local.stabilityBonus').total;
  out.fort = getRegionModifier(view, cityId, 'local.fortLevel').total;
  if (city.owner && city.owner === state.playerNationId) {
    const bal = calcNationBalance(view, city.owner, undefined, unitsOf(state, city.owner));
    out.gold = bal.income.gold || 0;
    out.manpower = bal.income.hr || 0;
    out.science = bal.income.techPoints || 0;
    out.upkeep = bal.expenses.fortUpkeep || 0;
  }
  return out;
};

const diff = (a, b) => Object.fromEntries(KEYS.map((k) => [k, r1((b[k] || 0) - (a[k] || 0))]));

const signed = (v) => `${v > 0 ? '+' : ''}${v}`;
const WORDS = {
  food: (v) => `${signed(v)} food`,
  production: (v) => `${signed(v)} production`,
  gold: (v) => `${signed(v)} gold`,
  manpower: (v) => `${signed(v)} manpower`,
  science: (v) => `${signed(v)} science`,
  culture: (v) => `${signed(v)} culture`,
  housing: (v) => `${signed(v)} housing`,
  amenities: (v) => `${signed(v)} amenit${Math.abs(v) === 1 ? 'y' : 'ies'}`,
  unrest: (v) => `${signed(v)} unrest a turn`,
  walls: (v, d) => `walls ${signed(v)} (siege HP ${signed(d.siegeHp)})`,
  fort: (v) => `fort level ${signed(v)} in battle`,
  upkeep: (v) => `${v} gold upkeep`
};
const ORDER = ['food', 'production', 'gold', 'science', 'culture', 'manpower', 'housing', 'amenities', 'unrest', 'walls', 'fort', 'upkeep'];
/** The words for a set of deltas: [{ key, value, text }] in a fixed order, zeros left out. */
export const effectParts = (deltas) => ORDER.filter((k) => deltas[k]).map((k) => ({ key: k, value: deltas[k], text: WORDS[k](deltas[k], deltas) }));
export const NO_EFFECT_TEXT = 'No effect on this city in the current rules';
export const effectText = (deltas) => { const parts = effectParts(deltas); return parts.length ? parts.map((p) => p.text).join(', ') : NO_EFFECT_TEXT; };

const withTier = (city, category, tier) => ({ buildings: { ...(city.buildings || {}), categories: { ...(city.buildings?.categories || {}), [category]: tier } } });

// Per state: the city as it stands is measured once, however many rows ask.
const baseMemo = new WeakMap();
const baseOf = (state, cityId) => {
  let m = baseMemo.get(state);
  if (!m) { m = new Map(); baseMemo.set(state, m); }
  if (!m.has(cityId)) m.set(cityId, measure(state, cityId));
  return m.get(cityId);
};

/** What moving the `category` line of this city to `toTier` changes, measured: { deltas, parts,
 * text }. `fromTier` defaults to the tier that stands (so the default is "what the next tier
 * adds"); pass -1 and the standing tier for "what the line gives today". */
export const buildingEffect = (state, cityId, category, toTier, fromTier = undefined) => {
  const city = state.regions?.[cityId];
  if (!city) return null;
  const standing = city.buildings?.categories?.[category] ?? -1;
  const from = fromTier === undefined ? standing : fromTier;
  const before = from === standing ? baseOf(state, cityId) : measure(state, cityId, withTier(city, category, from));
  const after = toTier === standing ? baseOf(state, cityId) : measure(state, cityId, withTier(city, category, toTier));
  const deltas = diff(before, after);
  return { deltas, parts: effectParts(deltas), text: effectText(deltas) };
};

// What a road and a fort do is movement and battle, not yields (armies.js tile costs; forts.js).
const IMPROVEMENT_NOTES = {
  road: 'armies cross this tile faster',
  fort: 'an enemy army must stop beside it; garrison it and they must fight'
};

/** What building `item` (an improvement on a tile of the city) changes: the tile's yields with
 * and without it by the yield rules themselves (tileYields.js), the resource it starts to supply,
 * whether a citizen works the tile now, and what it replaces. */
export const improvementEffect = (state, cityId, item, live = null) => {
  const city = state.regions?.[cityId];
  if (!city || item?.kind !== 'improvement') return null;
  const tiles = getTiles();
  const world = worldOf(state);
  const { researched } = cityCtx(state, city);
  const dyn = world.tileState[item.tile] || {};
  const before = tileFacts(tiles, item.tile, dyn);
  // What cities.js processCity writes when the improvement is done.
  const after = tileFacts(tiles, item.tile, { ...dyn, improvement: item.improvement, pillaged: false, ...(item.improvement === 'road' ? { road: true } : {}) });
  const yb = tileYields(before, researched); const ya = tileYields(after, researched);
  const deltas = { food: ya.food - yb.food, production: ya.production - yb.production, gold: ya.gold - yb.gold };
  const supplyAfter = strategicSupply(after, researched); const supplyBefore = strategicSupply(before, researched);
  const supply = supplyAfter && !supplyBefore ? supplyAfter : null;
  const res = RESOURCES_ON_TILES[after.resource];
  const luxury = res?.kind === 'luxury' && res.improvement === item.improvement && !(before.improvement === item.improvement && !before.pillaged) ? after.resource : null;
  const repair = before.improvement === item.improvement && before.pillaged;
  const replaces = before.improvement && before.improvement !== item.improvement ? IMPROVEMENTS[before.improvement]?.name || before.improvement : null;
  const worked = (live || cityLive(state, cityId)).worked.includes(item.tile);
  const parts = effectParts(deltas);
  if (supply) parts.push({ key: 'supply', value: supply.amount, text: `supplies ${supply.amount} ${supply.resource} a turn` });
  if (luxury) parts.push({ key: 'luxury', value: 1, text: `${luxury} becomes a luxury (amenities)` });
  if (IMPROVEMENT_NOTES[item.improvement]) parts.push({ key: 'note', value: 0, text: IMPROVEMENT_NOTES[item.improvement] });
  const text = parts.length ? parts.map((p) => p.text).join(', ') : NO_EFFECT_TEXT;
  return { deltas, parts, text, supply, luxury, repair, replaces, worked, yieldsBefore: yb, yieldsAfter: ya };
};
