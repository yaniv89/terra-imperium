// src/engine/plunder.js
// Raids on trade routes (plans/civ-map-rework.md, D6 and D5b). The player's trade route to a
// pact partner (tradeRoutes.js) runs over real tiles: a LAND route is plundered when an enemy
// land stack (a nation at war with the player, or rebels) stands on one of its tiles and no
// other open path exists; a SEA route is plundered when an enemy RAIDER fleet (navalLines.js)
// lies within RAIDER_REACH_RINGS of either port's waters. A plundered route pays nothing this
// turn (the pact's gold line in modifiers/sources.js reads `getTradeRoute(...).ok`) and the
// plunderer takes PLUNDER_GOLD; the player is told. Pure; resolveTurn applies it once a turn.
import { getTiles } from '../data/geo/tiles';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { isWarBetween } from './diplomacy';
import { unitTile } from './armies';
import { getTradeRoute, findCaravanPath, enemyTilesOf } from './tradeRoutes';
import { getCapital } from '../data/regions';
import { isFleet, portWaters } from './fleets';
import { navalLineOf } from '../data/navalLines';
import { ringsAround } from './world/cities';
import { lawRulesOf } from './lawRules';

export const PLUNDER_GOLD = 15;
export const RAIDER_REACH_RINGS = 2;

const hostileTo = (state, me, ownerId) => ownerId === REBEL_OWNER_ID || (state.wars || []).some((w) => w.active && isWarBetween(w, me, ownerId));

/** Enemy land stacks of the player by tile: Map tile -> ownerId (the strongest owner on it). */
const enemyLandByTile = (state, me) => {
  const map = new Map();
  Object.values(state.units || {}).forEach((u) => {
    if (u.domain === 'naval' || u.embarkedOn || u.classId === 'settler' || !(u.strength > 0) || u.ownerId === me || !hostileTo(state, me, u.ownerId)) return;
    const t = unitTile(state, u);
    if (t == null) return;
    const cur = map.get(t);
    if (!cur || u.strength > cur.strength) map.set(t, { ownerId: u.ownerId, strength: u.strength });
  });
  return map;
};

/** Enemy raider fleets of the player by tile: Map tile -> ownerId. */
const enemyRaidersByTile = (state, me) => {
  const map = new Map();
  Object.values(state.units || {}).forEach((u) => {
    if (!isFleet(u) || !(u.strength > 0) || u.ownerId === me || navalLineOf(u) !== 'raider' || !hostileTo(state, me, u.ownerId)) return;
    const t = unitTile(state, u);
    if (t != null && !map.has(t)) map.set(t, u.ownerId);
  });
  return map;
};

/**
 * The player's plundered routes this turn: [{ partnerId, kind, by, tile }]. A land route is
 * plundered when the open caravan path is cut by an enemy stack (the route the enemy stands on,
 * with no way around); a sea route when a raider lies within reach of a port.
 */
export const plunderedRoutes = (state) => {
  const me = state.playerNationId;
  const partners = Object.values(state.nations || {}).filter((n) => !n.isPlayer && n.hasTradeAgreement && !n.isEliminated);
  if (!partners.length) return [];
  const tiles = getTiles();
  if (!enemyTilesOf(state, me).size && !Object.values(state.units || {}).some((u) => isFleet(u) && u.ownerId !== me && navalLineOf(u) === 'raider')) return [];
  const land = enemyLandByTile(state, me);
  const raiders = enemyRaidersByTile(state, me);
  if (!land.size && !raiders.size) return [];
  const out = [];
  const start = getCapital(state, me);
  partners.forEach((partner) => {
    const route = getTradeRoute(state, partner.id);
    if (route.ok && route.kind === 'land' && land.size) {
      const hit = route.tiles.find((t) => land.has(t));
      if (hit != null) out.push({ partnerId: partner.id, kind: 'land', by: land.get(hit).ownerId, tile: hit });
      return;
    }
    if (route.ok && route.kind === 'sea' && raiders.size) {
      const near = new Set();
      route.regions.forEach((port) => portWaters(state, tiles, port).forEach((w) => { near.add(w); ringsAround(tiles, w, RAIDER_REACH_RINGS).forEach((r) => near.add(r)); }));
      const hit = [...raiders.keys()].find((t) => near.has(t));
      if (hit != null) out.push({ partnerId: partner.id, kind: 'sea', by: raiders.get(hit), tile: hit });
      return;
    }
    if (!route.ok && land.size && start) {
      // No open route at all: was it an enemy stack that cut the only path? Then it is plundered.
      const target = getCapital(state, partner.id);
      const allowed = (id) => { const c = state.regions[id]; if (!c || c.occupiedBy || !c.owner) return false; const o = c.owner; return o === me || o === partner.id || (!!state.nations[o] && !hostileTo(state, me, o)); };
      const path = target ? findCaravanPath(state, state.regions[start]?.tile, state.regions[target]?.tile, allowed) : null;
      const hit = path?.tiles.find((t) => land.has(t));
      if (hit != null) out.push({ partnerId: partner.id, kind: 'land', by: land.get(hit).ownerId, tile: hit });
    }
  });
  return out;
};

/** Gold a plunderer takes from one route, doubled by Chieftaincy (lawRules.js pillageGoldMult). */
export const plunderGoldFor = (state, nationId) => Math.round(PLUNDER_GOLD * Math.max(0, 1 + (lawRulesOf(state.nations?.[nationId]).pillageGoldMult || 0)));
