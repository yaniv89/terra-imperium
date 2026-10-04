// src/engine/tradeValue.js
// What a trade pact is worth: the gravity model of trade (plans/math-ideas.md 6.1). Trade between
// two economies grows with both their sizes and falls with the distance goods travel:
//
//   flow     = G x sqrt(Y_me x Y_partner) / (1 + km / TRADE_DISTANCE_KM)
//   goldMult = flow / Y_me = G x sqrt(Y_partner / Y_me) / (1 + km / TRADE_DISTANCE_KM)
//
// Y is a nation's economy: the summed size of its cities (one population model, population.js).
// The bonus is a share of the player's own gold (national.goldMult, as the flat +5% a pact used to
// be), so it is the flow divided by the player's own economy. km is the route the caravan or the
// fleet really takes (tradeRoutes.js): a land route's tile path in km, a sea route's two land legs
// (capital to port) plus the crossing at SEA_KM_MULT (ships carry more for less). Without a route
// (an old save with no scenario) it is the straight line between capitals.
//
// Each route is soft-capped at TRADE_ROUTE_MAX_MULT by x / sqrt(1 + (x / cap)^2): near linear at
// normal values, never above the cap, so a tiny nation trading with a giant gains a lot but not
// without bound. Calibrated so a typical pact (an equal partner about 1,000 km away) is worth
// about the old +5% (plans/math/world-systems.md).
//
// Distances are kilometres, so a denser grid changes nothing; the cost is one pass over the
// cities per state (cached) plus one route per pact.
import { getTiles } from '../data/geo/tiles';
import { getCapital } from '../data/regions';
import { getTradeRoute } from './tradeRoutes';
import { distanceKm } from '../data/geo/geodesic';

/** Km between two tiles (the shared exact distance), or Infinity when either is missing. */
export const tileKm = (tiles, a, b) => (a == null || b == null || !tiles.centres[a] || !tiles.centres[b] ? Infinity : distanceKm(tiles.centres[a], tiles.centres[b]));

/** The length in km of a path of adjacent tiles. */
export const pathKm = (tiles, path) => {
  let km = 0;
  for (let i = 1; i < (path?.length || 0); i++) km += distanceKm(tiles.centres[path[i - 1]], tiles.centres[path[i]]);
  return km;
};

export const TRADE_GRAVITY_G = 0.1;
export const TRADE_DISTANCE_KM = 1000;
export const SEA_KM_MULT = 0.5;
export const TRADE_ROUTE_MAX_MULT = 0.2;

const economyCache = new WeakMap(); // state.regions -> Map nationId -> summed city size
/** Each nation's economy Y: the summed size of the cities it owns (outposts excluded). */
export const economySizes = (state) => {
  const regions = state.regions || {};
  let m = economyCache.get(regions);
  if (m) return m;
  m = new Map();
  Object.values(regions).forEach((c) => {
    if (!c?.owner || c.outpost || c.occupiedBy) return;
    m.set(c.owner, (m.get(c.owner) || 0) + Math.max(1, c.size || 1));
  });
  economyCache.set(regions, m);
  return m;
};

const tileOfCity = (state, id) => state.regions?.[id]?.tile;

/** The km goods travel on a route from getTradeRoute (land or sea), or between capitals without one. */
export const routeKm = (state, nationId, partnerId, route) => {
  const tiles = getTiles();
  if (route?.ok && route.kind === 'land' && route.tiles?.length) return pathKm(tiles, route.tiles);
  const capA = tileOfCity(state, getCapital(state, nationId));
  const capB = tileOfCity(state, getCapital(state, partnerId));
  if (route?.ok && route.kind === 'sea' && route.regions?.length === 2) {
    const [pa, pb] = route.regions.map((id) => tileOfCity(state, id));
    const legs = (capA != null && pa != null ? tileKm(tiles, capA, pa) : 0) + (capB != null && pb != null ? tileKm(tiles, capB, pb) : 0);
    return legs + SEA_KM_MULT * tileKm(tiles, pa, pb);
  }
  return tileKm(tiles, capA, capB);
};

/** x / sqrt(1 + (x / cap)^2): linear for small x, approaches cap. */
export const softCap = (x, cap) => (x <= 0 ? 0 : x / Math.sqrt(1 + (x / cap) * (x / cap)));

/** The gravity value of one route: the gold multiplier it adds. */
export const gravityMult = (yMe, yPartner, km) => {
  if (!(yMe > 0) || !(yPartner > 0) || !Number.isFinite(km)) return 0;
  return softCap(TRADE_GRAVITY_G * Math.sqrt(yPartner / yMe) / (1 + Math.max(0, km) / TRADE_DISTANCE_KM), TRADE_ROUTE_MAX_MULT);
};

/**
 * The player's trade routes and what each is worth: [{ partnerId, name, km, kind, mult }] for every
 * pact partner with an open route (or any pact partner in a game without a scenario).
 */
export const tradeRoutesValue = (state, nationId = state.playerNationId) => {
  if (nationId !== state.playerNationId) return [];
  const sizes = economySizes(state);
  const yMe = sizes.get(nationId) || 0;
  const out = [];
  Object.entries(state.nations || {}).forEach(([id, n]) => {
    if (!n?.hasTradeAgreement || n.isEliminated || id === nationId) return;
    const route = state.scenario ? getTradeRoute(state, id) : null;
    if (state.scenario && !route?.ok) return;
    const km = routeKm(state, nationId, id, route);
    const mult = gravityMult(yMe, sizes.get(id) || 0, km);
    if (mult > 0) out.push({ partnerId: id, name: n.name || id, km: Math.round(km), kind: route?.kind || 'direct', mult });
  });
  return out;
};
