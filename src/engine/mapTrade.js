// src/engine/mapTrade.js
// Map trading (playtest audit I116; the user asked for it). The player trades what it has explored
// with a major it has met, from the nation card (NationCard.jsx "Maps"):
//   swap   both learn what the other has explored
//   give   they learn yours for nothing (they remember it: opinion GAVE_US_MAP, fading)
//   ask    they hand theirs over for nothing (only a friend: opinion MAP_ASK_OPINION or more)
//   buy    you pay gold for theirs
//   sell   they pay gold for yours
// What a map holds: the explored tiles (fog.js) and, for the player, the picture of those tiles as
// they stand now (who holds them, the cities on them). Never live sight: no army shows, nobody is
// met (contact still needs sight), and the explored map is all an AI gains (it settles only
// explored land, settlers.js). Independents trade no maps (their own sheet has their deals).
//
// What a map is worth to the one who learns it: the tiles it does not know yet, land counted
// whole, sea at MAP_SEA_WEIGHT, each city on them MAP_CITY_VALUE more:
//   value = new land + MAP_SEA_WEIGHT x new sea + MAP_CITY_VALUE x cities
// A trade needs MAP_MIN_VALUE on the side that learns (nothing new is no trade). The AI's answer:
//   at war with you, or opinion under MAP_REFUSE_OPINION (they dislike you): no trade at all
//   swap   they accept when their value >= yours x swapNeed, swapNeed = clamp(1 - opinion / 100, 0.3, 1.2)
//          (a friend gives more than it gets; a cool neighbour wants a fair deal)
//   give   they take it
//   ask    only at opinion MAP_ASK_OPINION or more
//   buy    price = your value x MAP_GOLD_PER_POINT x clamp(1.4 - opinion / 100, 0.6, 1.6)
//   sell   price = their value x MAP_GOLD_PER_POINT x clamp(0.6 + opinion / 200, 0.3, 0.9), at most
//          MAP_SELL_BANK_SHARE of their gold; under MAP_PRICE_MIN they decline
// Prices are clamped to MAP_PRICE_MIN..MAP_PRICE_MAX. A trade itself costs nothing (no DIP: maps
// matter most in the first turns, when the DIP bank is empty); a refusal changes nothing.
//
// The AI may offer a swap itself (processAIMapOffers, end of the turn): on its accords slot
// (aiAccords.js AI_ACCORD_PERIOD), a major that met the player, is at peace with it and thinks
// MAP_OFFER_OPINION of it or more, when both sides would learn at least MAP_OFFER_MIN_VALUE and it
// would accept the swap itself, rolls MAP_OFFER_CHANCE (a hash of its id and the turn). One offer at
// a time (`state.pendingMapOffer` = { from, turn, until }), at most one per mapOfferGapTurns, open
// for MAP_OFFER_TURNS. It never blocks the turn: a card on the Peoples tab and a chip.
//
// Persisted fields (all default on read): state.pendingMapOffer (null), state.mapOfferTurn (the
// turn of the last offer), nation.mapsFrom[otherId] = { turn, gift } (opinion.js), and
// state.mapTradeStats = { offers, accepted, declined, trades } (counts for the balance harness).
// Pure and deterministic: no Math.random, no clock.
import { fogOn, hasMet, shareExploredMap, bitsHas } from './fog';
import { getTiles } from '../data/geo/tiles';
import { opinionOf } from './opinion';
import { isWarBetween } from './diplomacy';
import { isIndependentNation } from '../data/independents';
import { getPool } from './nationState';
import { hashRoll } from './aftermath';
import { speedTurns } from '../data/ages';
import { AI_ACCORD_PERIOD } from './aiAccords';
import { msg, msgText, sub, people } from './messages';
import { waitAgeOf } from './ageRefs';

// A reason as the English `reason` and its message `reasonMsg` (a sub), spread into a result.
const why = (key, vars) => ({ reason: msgText(key, vars), reasonMsg: sub(key, vars) });
const textOf = (m) => msgText(m.key, m.vars);

export const MAP_SEA_WEIGHT = 0.25;
export const MAP_CITY_VALUE = 10;
export const MAP_MIN_VALUE = 15;
export const MAP_REFUSE_OPINION = -10;
export const MAP_ASK_OPINION = 30;
export const MAP_GOLD_PER_POINT = 0.25;
export const MAP_PRICE_MIN = 10;
export const MAP_PRICE_MAX = 500;
export const MAP_SELL_BANK_SHARE = 0.5;
export const MAP_OFFER_OPINION = 5;        // a stranger's standing is 8: any people without a grievance may offer
export const MAP_OFFER_MIN_VALUE = 40;
export const MAP_OFFER_CHANCE = 0.2;
export const MAP_OFFER_TURNS = 5;           // turns of play the offer stays open (a deadline on screen)
export const MAP_OFFER_GAP_REF_TURNS = 20;  // reference turns between two offers to the player (ages.js speedTurns)
// The player is the one who waits between offers: its own age (KTD7).
export const mapOfferGapTurns = (state) => speedTurns(MAP_OFFER_GAP_REF_TURNS, state?.gameSpeed, waitAgeOf(state, state?.playerNationId));
export const MAP_TRADE_KINDS = ['swap', 'give', 'ask', 'buy', 'sell'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const alive = (n) => !!n && !n.isEliminated;
const atWar = (state, a, b) => (state.wars || []).some((w) => w.active && isWarBetween(w, a, b));

/** What `toId` would learn from `fromId`'s map: { tiles, land, sea, cities, value }. */
export const mapGain = (state, fromId, toId) => {
  const none = { tiles: 0, land: 0, sea: 0, cities: 0, value: 0 };
  if (!fogOn(state)) return none;
  const from = state.fog.explored?.[fromId]?.bytes;
  if (!from) return none;
  const into = state.fog.explored?.[toId]?.bytes;
  const tiles = getTiles();
  let land = 0; let sea = 0;
  for (let i = 0; i < from.length; i++) {
    const v = from[i] & ~(into ? into[i] : 0);
    if (!v) continue;
    for (let k = 0; k < 8; k++) {
      if (!((v >> k) & 1)) continue;
      const t = i * 8 + k;
      if (t >= tiles.count) break;
      if (tiles.land[t] === 1) land++; else sea++;
    }
  }
  let cities = 0;
  const explored = state.fog.explored[fromId];
  const known = state.fog.explored?.[toId];
  Object.values(state.regions || {}).forEach((c) => {
    if (c.tile == null || c.owner === toId) return;
    if (bitsHas(explored, c.tile) && !bitsHas(known, c.tile)) cities++;
  });
  const value = Math.round(land + MAP_SEA_WEIGHT * sea + MAP_CITY_VALUE * cities);
  return { tiles: land + sea, land, sea, cities, value };
};

const price = (v) => clamp(Math.round(v), MAP_PRICE_MIN, MAP_PRICE_MAX);

/**
 * Everything the nation card shows and the reducer applies (one truth): { ok, reason, opinion,
 * theirs (what you would learn), ours (what they would learn), options: { [kind]: { accepted,
 * reason, gold } } }. `ok` false with `reason` when no map trade is possible at all.
 */
export const mapTradeQuote = (state, nationId, me = state.playerNationId) => {
  const nation = state.nations?.[nationId];
  const base = { ok: false, reason: null, opinion: 0, theirs: null, ours: null, options: {} };
  if (!fogOn(state)) return { ...base, ...why('m.diplo.mapAllExplored') };
  if (!alive(nation) || nationId === me) return { ...base, ...why('m.diplo.mapNoPeople') };
  if (isIndependentNation(nation)) return { ...base, ...why('m.diplo.mapIndependent') };
  if (!hasMet(state, me, nationId)) return { ...base, ...why('m.diplo.mapNotMet') };
  if (nation.vassalOf === me || state.nations[me]?.vassalOf === nationId) return { ...base, ...why('m.diplo.mapVassal') };
  if (atWar(state, me, nationId)) return { ...base, ...why('m.diplo.mapWar') };
  const opinion = opinionOf(state, nationId, me);
  const theirs = mapGain(state, nationId, me);
  const ours = mapGain(state, me, nationId);
  if (opinion < MAP_REFUSE_OPINION) return { ...base, ...why('m.diplo.mapDislike', { opinion, need: MAP_REFUSE_OPINION }), opinion, theirs, ours };
  const weLearn = theirs.value >= MAP_MIN_VALUE;
  const theyLearn = ours.value >= MAP_MIN_VALUE;
  const nothingFromThem = why('m.diplo.mapNothingFromThem');
  const nothingFromUs = why('m.diplo.mapNothingFromUs');
  const swapNeed = clamp(1 - opinion / 100, 0.3, 1.2);
  const options = {};
  options.swap = !weLearn ? { accepted: false, ...nothingFromThem }
    : !theyLearn ? { accepted: false, ...nothingFromUs }
      : ours.value >= theirs.value * swapNeed ? { accepted: true, reason: null }
        : { accepted: false, ...why('m.diplo.mapUnfair', { pct: Math.round((100 * ours.value) / Math.max(1, theirs.value)), want: Math.round(swapNeed * 100) }) };
  options.give = theyLearn ? { accepted: true, reason: null } : { accepted: false, ...nothingFromUs };
  options.ask = !weLearn ? { accepted: false, ...nothingFromThem }
    : opinion >= MAP_ASK_OPINION ? { accepted: true, reason: null }
      : { accepted: false, ...why('m.diplo.mapFriendOnly', { opinion, need: MAP_ASK_OPINION }) };
  const buyGold = price(theirs.value * MAP_GOLD_PER_POINT * clamp(1.4 - opinion / 100, 0.6, 1.6));
  const gold = Math.floor(state.resources?.gold || 0);
  options.buy = !weLearn ? { accepted: false, ...nothingFromThem, gold: 0 }
    : gold < buyGold ? { accepted: true, ...why('m.diplo.goldShort', { gold, amount: buyGold }), gold: buyGold }
      : { accepted: true, reason: null, gold: buyGold };
  const theirGold = Math.floor(getPool(state, nationId).gold || 0);
  const offer = Math.min(Math.round(ours.value * MAP_GOLD_PER_POINT * clamp(0.6 + opinion / 200, 0.3, 0.9)), Math.floor(theirGold * MAP_SELL_BANK_SHARE), MAP_PRICE_MAX);
  options.sell = !theyLearn ? { accepted: false, ...nothingFromUs, gold: 0 }
    : offer < MAP_PRICE_MIN ? { accepted: false, ...why('m.diplo.mapNoSpare'), gold: 0 }
      : { accepted: true, reason: null, gold: offer };
  return { ok: true, reason: null, opinion, theirs, ours, options };
};

const withMemory = (nations, holderId, otherId, turn, gift) => ({
  ...nations, [holderId]: { ...nations[holderId], mapsFrom: { ...(nations[holderId].mapsFrom || {}), [otherId]: { turn, gift } } }
});

const bumpStats = (state, key) => {
  const s = state.mapTradeStats || {};
  return { ...s, [key]: (s[key] || 0) + 1 };
};

const describe = (g) => (g.cities ? sub('m.diplo.mapTilesCities', { land: g.land, sea: g.sea, count: g.cities }) : sub('m.diplo.mapTiles', { land: g.land, sea: g.sea }));

/**
 * The player's map trade of `kind` with `nationId`: { state, message } on success, { reason } when
 * it cannot be made (nothing changes; a refusal costs nothing either).
 */
export const tradeMaps = (state, nationId, kind) => {
  const me = state.playerNationId;
  if (!MAP_TRADE_KINDS.includes(kind)) return why('m.diplo.mapNoTrade');
  const q = mapTradeQuote(state, nationId);
  if (!q.ok) return { reason: q.reason, reasonMsg: q.reasonMsg };
  const opt = q.options[kind];
  const name = people(nationId, state.nations[nationId].name);
  if (!opt.accepted) return why('m.diplo.mapRefuse', { nation: name, reason: opt.reasonMsg || opt.reason });
  if (opt.reason) return { reason: opt.reason, reasonMsg: opt.reasonMsg }; // accepted in principle, but you cannot pay
  const turn = state.turnNumber || 1;
  let next = state;
  let line;
  if (kind === 'swap' || kind === 'ask' || kind === 'buy') next = shareExploredMap(next, nationId, me).state;
  if (kind === 'swap' || kind === 'give' || kind === 'sell') next = shareExploredMap(next, me, nationId).state;
  if (kind === 'swap') {
    next = { ...next, nations: withMemory(next.nations, nationId, me, turn, false) };
    line = msg('m.diplo.mapSwap', { nation: name, theirs: describe(q.theirs), ours: describe(q.ours) });
  } else if (kind === 'give') {
    next = { ...next, nations: withMemory(next.nations, nationId, me, turn, true) };
    line = msg('m.diplo.mapGive', { nation: name, ours: describe(q.ours) });
  } else if (kind === 'ask') {
    line = msg('m.diplo.mapAsk', { nation: name, theirs: describe(q.theirs) });
  } else if (kind === 'buy') {
    const pool = next.nations[nationId].economy || {};
    next = { ...next, resources: { ...next.resources, gold: (next.resources.gold || 0) - opt.gold }, nations: { ...next.nations, [nationId]: { ...next.nations[nationId], economy: { ...pool, gold: (pool.gold || 0) + opt.gold } } } };
    line = msg('m.diplo.mapBuy', { nation: name, gold: opt.gold, theirs: describe(q.theirs) });
  } else {
    const pool = next.nations[nationId].economy || {};
    next = { ...next, resources: { ...next.resources, gold: (next.resources.gold || 0) + opt.gold }, nations: { ...next.nations, [nationId]: { ...next.nations[nationId], economy: { ...pool, gold: (pool.gold || 0) - opt.gold } } } };
    line = msg('m.diplo.mapSell', { nation: name, gold: opt.gold, ours: describe(q.ours) });
  }
  next = { ...next, mapTradeStats: bumpStats(next, 'trades') };
  return { state: next, ...line };
};

/** The AI's offer to swap maps that waits for the player, with its terms, or null. */
export const mapOfferTerms = (state) => {
  const o = state.pendingMapOffer;
  if (!o || !alive(state.nations?.[o.from])) return null;
  const q = mapTradeQuote(state, o.from);
  const ok = q.ok && !!q.options.swap?.accepted;
  const reason = q.ok ? q.options.swap?.reason : q.reason;
  const reasonMsg = (q.ok ? q.options.swap?.reasonMsg : q.reasonMsg) || null;
  const textMsg = ok ? sub('m.diplo.mapOfferText', { theirs: describe(q.theirs), ours: describe(q.ours) }) : sub('m.diplo.mapOfferGone', { reason: reasonMsg || String(reason) });
  return { from: o.from, name: state.nations[o.from].name, until: o.until, turnsLeft: Math.max(0, o.until - (state.turnNumber || 1)), ok, reason, reasonMsg, theirs: q.theirs, ours: q.ours, text: textOf(textMsg), textMsg };
};

/** The player's answer to the AI's offer: { state, message }. Accepting costs nothing (they asked). */
export const answerMapOffer = (state, accept) => {
  const o = state.pendingMapOffer;
  if (!o) return { state, message: null };
  const cleared = { ...state, pendingMapOffer: null };
  const from = state.nations?.[o.from];
  if (!alive(from)) return { state: cleared, message: null };
  if (!accept) return { state: { ...cleared, mapTradeStats: bumpStats(state, 'declined') }, ...msg('m.diplo.mapDecline', { nation: people(o.from, from.name) }) };
  const terms = mapOfferTerms(state);
  if (!terms?.ok) return { state: cleared, ...msg('m.diplo.mapSwapOff', { nation: people(o.from, from.name), reason: terms?.reasonMsg || terms?.reason || sub('m.diplo.mapNoLongerStands') }) };
  let next = shareExploredMap(cleared, o.from, state.playerNationId).state;
  next = shareExploredMap(next, state.playerNationId, o.from).state;
  next = { ...next, nations: withMemory(next.nations, o.from, state.playerNationId, state.turnNumber || 1, false), mapTradeStats: bumpStats(state, 'accepted') };
  return { state: next, ...msg('m.diplo.mapSwap', { nation: people(o.from, from.name), theirs: describe(terms.theirs), ours: describe(terms.ours) }) };
};

/**
 * The end-of-turn pass: an expired or void offer goes, and maybe a major offers a swap (header).
 * Returns the same state when nothing changes.
 */
export const processAIMapOffers = (state) => {
  if (!fogOn(state)) return state;
  const me = state.playerNationId;
  const turn = state.turnNumber || 1;
  let next = state;
  const o = state.pendingMapOffer;
  if (o) {
    if (turn <= o.until && mapOfferTerms(state)?.ok) return state; // still open and still worth it to them
    next = { ...state, pendingMapOffer: null };
  }
  if (!alive(state.nations?.[me])) return next;
  if (state.mapOfferTurn != null && turn - state.mapOfferTurn < mapOfferGapTurns(state)) return next;
  const ids = Object.keys(state.nations).filter((id) => id !== me && alive(state.nations[id]) && !state.nations[id].isPlayer && !isIndependentNation(state.nations[id])).sort();
  const slot = turn % AI_ACCORD_PERIOD;
  const from = ids.find((id, i) => {
    if (i % AI_ACCORD_PERIOD !== slot || !hasMet(state, me, id)) return false;
    if (hashRoll(`maps|${id}|${turn}`) >= MAP_OFFER_CHANCE) return false;
    if (opinionOf(state, id, me) < MAP_OFFER_OPINION) return false;
    const q = mapTradeQuote(state, id);
    return q.ok && q.options.swap.accepted && q.theirs.value >= MAP_OFFER_MIN_VALUE && q.ours.value >= MAP_OFFER_MIN_VALUE;
  });
  if (!from) return next;
  const name = people(from, state.nations[from].name);
  return {
    ...next,
    pendingMapOffer: { from, turn, until: turn + MAP_OFFER_TURNS },
    mapOfferTurn: turn,
    mapTradeStats: bumpStats(state, 'offers'),
    logs: [...(next.logs || []), { year: state.year, ...msg('m.diplo.mapOffer', { nation: name, turn: turn + MAP_OFFER_TURNS }), type: 'diplomacy' }]
  };
};
