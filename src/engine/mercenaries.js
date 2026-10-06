// src/engine/mercenaries.js
// Mercenaries (plans/independent-cities.md 5, plans/MASTER-PLAN.md 6.7 and decision 38, phase W2).
// Mercantile and raiders independents (MERC_SELLERS) sell bands of one land unit:
//   offer      a seller with a band in stock (MERC_STOCK, one more every MERC_RESTOCK_TURNS), a
//              buyer city within MERC_KM of its city and a grudge against the buyer under
//              MERC_MAX_GRUDGE. Raiders sell horsemen (the age's cavalry), mercantile cities
//              spearmen (its infantry): the calendar age's roster, as every independent's.
//   hire       mercPrice(age) gold at once to the seller; a full unit appears in the buyer's
//              nearest city with `mercenary: { from, until, upkeep }` and is then a unit like any
//              other (moves, fights, garrisons, joins battles).
//   contract   every turn the buyer pays mercUpkeep(age) gold to the seller; unpaid, the band
//              leaves at once; after MERC_CONTRACT_TURNS it leaves anyway.
//   AI         a major at war with MERC_AI_GOLD_MULT x the price in its treasury hires one band
//              from the nearest seller (at most MERC_AI_MAX at once, thinking every MERC_AI_PERIOD
//              turns). A mercantile independent under threat hires a defender from its own market
//              (raids.js).
// Ripples: gold flows from majors to independents (their walls and own hires), the band adds to
// the buyer's strength (war decisions, battles) and to its unit upkeep like any unit.
// Pure and deterministic.
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { LogTypes } from '../data/types';
import { getAvailableClasses } from '../data/unitClasses';
import {
  isIndependentNation, INDEPENDENT_GOLD_CAP, MERC_SELLERS, MERC_STOCK, MERC_RESTOCK_TURNS, MERC_CONTRACT_TURNS, MERC_KM, MERC_MAX_GRUDGE,
  mercPrice, mercUpkeep, MERC_AI_GOLD_MULT, MERC_AI_MAX, MERC_AI_PERIOD
} from '../data/independents';
import { ringsAround } from './world/cities';
import { hashRoll } from './aftermath';
import { grudgeOf } from './grudges';

// ---------------------------------------------------------------------------------------------
// Treasuries in a turn's working set `w` ({ playerId, resources, nations }): the player's
// resources, an AI major's economy pool, an independent's indep.gold (capped).
export const goldIn = (w, id) => {
  if (id === w.playerId) return w.resources.gold || 0;
  const n = w.nations[id];
  if (isIndependentNation(n)) return n.indep?.gold || 0;
  return n?.economy?.gold || 0;
};
export const addGoldIn = (w, id, amount) => {
  if (!amount || !w.nations[id]) return;
  if (id === w.playerId) { w.resources.gold = (w.resources.gold || 0) + amount; return; }
  const n = w.nations[id];
  if (isIndependentNation(n)) { w.nations[id] = { ...n, indep: { ...n.indep, gold: Math.max(0, Math.min(INDEPENDENT_GOLD_CAP, (n.indep?.gold || 0) + amount)) } }; return; }
  w.nations[id] = { ...n, economy: { ...(n.economy || {}), gold: (n.economy?.gold || 0) + amount } };
};

/** Bands a seller has on `turn` (restocked one every MERC_RESTOCK_TURNS since its last sale). */
export const mercStockOf = (seller, turn) => {
  const ind = seller?.indep;
  if (!ind) return 0;
  const stock = ind.mercStock ?? MERC_STOCK;
  if (stock >= MERC_STOCK || ind.mercTurn == null) return Math.min(MERC_STOCK, stock);
  return Math.min(MERC_STOCK, stock + Math.floor((turn - ind.mercTurn) / MERC_RESTOCK_TURNS));
};

const classFor = (personality, ageId) => {
  const roster = getAvailableClasses(ageId);
  const want = personality === 'raiders' ? 'cavalry' : 'infantry';
  return roster.includes(want) ? want : 'infantry';
};

/**
 * What `sellerId` offers `buyerId` now: { ok, price, upkeep, classId, cityId, km } or { ok: false,
 * reason }. A mercantile independent may buy from itself (cityId: its own city). Gold is not
 * checked here (the caller pays).
 */
export const mercOffer = (state, sellerId, buyerId, { buyerCities = null } = {}) => {
  const seller = state.nations?.[sellerId];
  if (!isIndependentNation(seller) || seller.isEliminated) return { ok: false, reason: 'Not an independent city.' };
  const personality = seller.indep?.personality;
  if (!MERC_SELLERS.includes(personality)) return { ok: false, reason: 'They do not sell mercenaries.' };
  const turn = state.turnNumber || 0;
  if (mercStockOf(seller, turn) <= 0) return { ok: false, reason: 'No band is free: come back later.' };
  const home = state.regions?.[seller.capitalRegionId];
  if (!home || home.tile == null || home.owner !== sellerId) return { ok: false, reason: 'Their city is lost.' };
  const ageId = state.age || 'bronze';
  const base = { price: mercPrice(ageId), upkeep: mercUpkeep(ageId), classId: classFor(personality, ageId) };
  if (buyerId === sellerId) return { ok: true, ...base, cityId: home.id, rings: 0 };
  const buyer = state.nations?.[buyerId];
  if (!buyer || buyer.isEliminated || isIndependentNation(buyer)) return { ok: false, reason: 'Only a nation can hire them.' };
  if (grudgeOf(seller, buyerId) >= MERC_MAX_GRUDGE) return { ok: false, reason: 'They hold a grudge against you and will not sell.' };
  if (seller.indep?.raid?.targetNationId === buyerId) return { ok: false, reason: 'They are raiding you.' };
  const near = ringsAround(getTiles(), home.tile, ringsForKm(MERC_KM));
  let best = null;
  (buyerCities || Object.values(state.regions || {})).forEach((c) => {
    if (c.owner !== buyerId || c.outpost || c.tile == null) return;
    const d = near.get(c.tile);
    if (d == null) return;
    if (!best || d < best.rings || (d === best.rings && c.id < best.cityId)) best = { cityId: c.id, rings: d };
  });
  if (!best) return { ok: false, reason: 'None of your cities is close enough.' };
  return { ok: true, ...base, ...best };
};

const unitIdFor = (state, sellerId) => {
  const base = `merc_${sellerId}_${state.turnNumber || 0}`;
  let k = 0;
  while (state.units?.[`${base}_${k}`]) k += 1;
  return `${base}_${k}`;
};

/**
 * The band itself: { ok, unit, stock, mercTurn } (the seller's new stock fields). Pure: the caller
 * adds the unit and moves the gold. `offer`: a mercOffer result.
 */
export const hireMercenary = (state, sellerId, buyerId, { offer = mercOffer(state, sellerId, buyerId) } = {}) => {
  if (!offer.ok) return offer;
  const turn = state.turnNumber || 0;
  const city = state.regions[offer.cityId];
  const id = unitIdFor(state, sellerId);
  const unit = {
    id, ownerId: buyerId, regionId: city.id, homeRegionId: city.id, tile: city.tile, domain: 'land', classId: offer.classId,
    strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 0, xp: 0, rank: 'recruit', promotions: [], commanderId: null,
    mercenary: { from: sellerId, until: turn + MERC_CONTRACT_TURNS, upkeep: buyerId === sellerId ? 0 : offer.upkeep }
  };
  const seller = state.nations[sellerId];
  return { ok: true, unit, stock: mercStockOf(seller, turn) - 1, mercTurn: turn };
};

/** The player's HIRE_MERCENARY (gameReducer): pays, adds the band, logs. Returns a new state or { reason }. */
export const hireMercenaryForPlayer = (state, sellerId) => {
  const me = state.playerNationId;
  const offer = mercOffer(state, sellerId, me);
  if (!offer.ok) return { reason: offer.reason };
  if ((state.resources?.gold || 0) < offer.price) return { reason: `You need ${offer.price} gold.` };
  const hired = hireMercenary(state, sellerId, me, { offer });
  const seller = state.nations[sellerId];
  const w = { playerId: me, resources: { ...state.resources }, nations: { ...state.nations } };
  addGoldIn(w, me, -offer.price);
  addGoldIn(w, sellerId, offer.price);
  w.nations[sellerId] = { ...w.nations[sellerId], indep: { ...w.nations[sellerId].indep, mercStock: hired.stock, mercTurn: hired.mercTurn } };
  const stats = { ...(state.indepStats || {}), mercsHired: (state.indepStats?.mercsHired || 0) + 1 };
  return {
    ...state, resources: w.resources, nations: w.nations, units: { ...state.units, [hired.unit.id]: hired.unit }, indepStats: stats,
    logs: [...state.logs, { year: state.year, message: `You hire a band of mercenaries from ${seller.name} for ${offer.price} gold: ${offer.upkeep} gold a turn for ${MERC_CONTRACT_TURNS} turns. They wait in ${state.regions[offer.cityId].name}.`, type: LogTypes.ACTION }]
  };
};

/**
 * One turn of contracts and AI hiring in a turn's working set `w` ({ turn, year, playerId, view,
 * units, nations, resources, logs, stats }): upkeep paid to the seller, unpaid or ended bands
 * leave, then AI majors at war may hire. Writes into `w`'s maps.
 */
export const processMercenaries = (w) => {
  const bands = Object.values(w.units).filter((u) => u.mercenary).sort((a, b) => (a.id < b.id ? -1 : 1));
  const countBy = new Map();
  bands.forEach((u) => {
    const m = u.mercenary;
    const owner = w.nations[u.ownerId];
    let leave = null;
    if (!owner || owner.isEliminated) leave = 'gone';
    else if (m.until <= w.turn) leave = 'ended';
    else if (m.upkeep > 0) {
      if (goldIn(w, u.ownerId) >= m.upkeep) { addGoldIn(w, u.ownerId, -m.upkeep); if (w.nations[m.from] && !w.nations[m.from].isEliminated) addGoldIn(w, m.from, m.upkeep); }
      else leave = 'unpaid';
    }
    if (leave) {
      delete w.units[u.id];
      w.unitsChanged = true;
      if (u.ownerId === w.playerId) w.logs.push({ year: w.year, message: leave === 'unpaid' ? `Your mercenaries from ${w.nations[m.from]?.name || 'abroad'} leave: you could not pay them.` : `Your mercenaries' contract with ${w.nations[m.from]?.name || 'their city'} ends: they go home.`, type: LogTypes.ACTION });
      return;
    }
    countBy.set(u.ownerId, (countBy.get(u.ownerId) || 0) + 1);
  });
  // AI majors at war hire.
  const sellers = Object.keys(w.nations).filter((id) => { const n = w.nations[id]; return isIndependentNation(n) && !n.isEliminated && MERC_SELLERS.includes(n.indep?.personality); }).sort();
  if (!sellers.length) return;
  const atWar = new Set();
  (w.view.wars || []).forEach((war) => { if (war.active) { atWar.add(war.aggressor); atWar.add(war.enemy); } });
  const price = mercPrice(w.view.age || 'bronze');
  [...atWar].sort().forEach((id) => {
    const n = w.nations[id];
    if (!n || id === w.playerId || n.isEliminated || isIndependentNation(n)) return;
    if ((Math.floor(hashRoll(`${id}|merc`) * MERC_AI_PERIOD) + w.turn) % MERC_AI_PERIOD !== 0) return;
    if ((countBy.get(id) || 0) >= MERC_AI_MAX || goldIn(w, id) < price * MERC_AI_GOLD_MULT) return;
    let best = null;
    const buyerCities = Object.values(w.view.regions).filter((c) => c.owner === id);
    sellers.forEach((s) => { const o = mercOffer(w.view, s, id, { buyerCities }); if (o.ok && (!best || o.rings < best.offer.rings)) best = { seller: s, offer: o }; });
    if (!best) return;
    const hired = hireMercenary(w.view, best.seller, id, { offer: best.offer });
    if (!hired.ok) return;
    addGoldIn(w, id, -best.offer.price);
    addGoldIn(w, best.seller, best.offer.price);
    w.nations[best.seller] = { ...w.nations[best.seller], indep: { ...w.nations[best.seller].indep, mercStock: hired.stock, mercTurn: hired.mercTurn } };
    w.units[hired.unit.id] = hired.unit;
    w.unitsChanged = true;
    w.stats.mercsHired += 1;
  });
};
