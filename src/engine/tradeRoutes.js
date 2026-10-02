// src/engine/tradeRoutes.js
// The player's trade route to a pact partner (plans/civ-map-rework.md, workstream 13). A LAND
// route is a caravan path over the tiles between the two capitals: land a caravan can cross
// (armies.js passableTile), at most TRADE_ROUTE_MAX_TILES steps, through free land and the land
// of any nation not at war with the player (Civ's rule: a caravan crosses a neighbour's land
// unless that neighbour is an enemy), never through an occupied city's land or a rebel's. A SEA route joins a port of each side over
// the sea (navalReach.js) when no port is blockaded. Memoised per state object: the trade pact
// modifier (modifiers/sources.js) asks for every partner each time the sheet is built.
import { isBlockaded } from './fleets';
import { getOwnedRegionIds, getCapital } from '../data/regions';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { getTiles } from '../data/geo/tiles';
import { passableTile } from './armies';

export const TRADE_ROUTE_MAX_TILES = 40;

const routeCache = new WeakMap(); // state.regions -> { wars, nations, world, units, byPartner } (the parts a route reads)

/** The caravan path between two tiles, or null: { tiles, regions } with the cities crossed. */
export const findCaravanPath = (state, from, to, allowedCity, maxSteps = TRADE_ROUTE_MAX_TILES) => {
  const tiles = getTiles();
  const tileOwner = state.world?.tileOwner || {};
  const open = (t) => { const c = tileOwner[t]; return c == null || allowedCity(c); };
  if (from == null || to == null || !passableTile(tiles, from) || !passableTile(tiles, to) || !open(to)) return null;
  const prev = new Map([[from, null]]);
  let frontier = [from];
  for (let d = 0; d <= maxSteps && frontier.length; d++) {
    if (prev.has(to)) break;
    const next = [];
    for (const t of frontier) for (const n of tiles.neighbors[t]) {
      if (prev.has(n) || !passableTile(tiles, n) || !open(n)) continue;
      prev.set(n, t); next.push(n);
    }
    frontier = next.sort((a, b) => a - b);
  }
  if (!prev.has(to)) return null;
  const path = []; for (let t = to; t != null; t = prev.get(t)) path.unshift(t);
  const regions = []; path.forEach((t) => { const c = tileOwner[t]; if (c != null && regions[regions.length - 1] !== c) regions.push(c); });
  return { tiles: path, regions };
};

const atWar = (state, a, b) => state.wars.some((w) => w.active && ((w.aggressor === a && w.enemy === b) || (w.enemy === a && w.aggressor === b)));

const computeTradeRoute = (state, partnerId) => {
  const me = state.playerNationId; const partner = state.nations[partnerId];
  if (!partner || partner.isEliminated) return { ok: false, reason: 'Partner is no longer active.' };
  if (atWar(state, me, partnerId)) return { ok: false, reason: 'Trade is suspended during war.' };
  const start = getCapital(state, me); const target = getCapital(state, partnerId);
  if (!start || !target) return { ok: false, reason: 'A trading capital is missing.' };
  const allowed = (id) => { const c = state.regions[id]; if (!c || c.occupiedBy || !c.owner) return false; const o = c.owner; return o === me || o === partnerId || (!!state.nations[o] && !atWar(state, me, o)); };
  const land = findCaravanPath(state, state.regions[start]?.tile, state.regions[target]?.tile, allowed);
  if (land) return { ok: true, kind: 'land', regions: land.regions, tiles: land.tiles };
  const ports=id=>getOwnedRegionIds(state.regions,id).filter(r=>isCoastal(r) && !state.regions[r].occupiedBy && (state.regions[r].buildings?.categories?.naval ?? -1)>=0);
  const blocked=r=>isBlockaded(state,r)||Object.values(state.units).some(u=>u.regionId===r && u.domain==='naval' && state.wars.some(w=>w.active && ((w.aggressor===me&&w.enemy===u.ownerId)||(w.enemy===me&&w.aggressor===u.ownerId))));
  for(const a of ports(me))for(const b of ports(partnerId))if(isReachableBySea(a,b,state.age) && !blocked(a) && !blocked(b))return {ok:true,kind:'sea',regions:[a,b]};
  return {ok:false,reason:'No open land route or reachable, unblocked ports.'};
};

export const getTradeRoute = (state, partnerId) => {
  if (!state.regions) return computeTradeRoute(state, partnerId);
  let entry = routeCache.get(state.regions);
  if (!entry || entry.wars !== state.wars || entry.nations !== state.nations || entry.world !== state.world || entry.units !== state.units || entry.age !== state.age) {
    entry = { wars: state.wars, nations: state.nations, world: state.world, units: state.units, age: state.age, byPartner: new Map() };
    routeCache.set(state.regions, entry);
  }
  if (!entry.byPartner.has(partnerId)) entry.byPartner.set(partnerId, computeTradeRoute(state, partnerId));
  return entry.byPartner.get(partnerId);
};
