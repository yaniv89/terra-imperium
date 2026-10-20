// src/engine/tribalCamps.js
// Tribal camps (eight-ages plan U26, R8, R14): about TRIBAL_CAMP_COUNT neutral hunter camps on the
// free land of a new game, placed from the world seed and never within the settling distance of a
// people's home (citySpacing.js) or CAMP_SPACING_KM of another camp. A unit standing on a camp when
// the turn resolves makes contact:
//   the player chooses (state.pendingCamp, the camp card):
//     absorb  the camp joins: +1 size to the player's nearest city (needs a city)
//     trade   CAMP_TECH_SHARE of the current research's cost, or with no research the land within
//             CAMP_REVEAL_KM of the camp is mapped
//   an AI unit's camp is absorbed at once (the AI grows by doctrine).
// A camp is gone once it has chosen, and once a border covers its tile. Pure.
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { CITY_SPACING_KM } from '../data/geo/citySpacing';
import { ringsForKm } from '../data/geo/gridScale';
import { hashRoll } from './aftermath';
import { getResearchCost } from './research';
import { withExplored } from './fog';

export const TRIBAL_CAMP_COUNT = 150;
export const CAMP_SPACING_KM = 400;
export const CAMP_TECH_SHARE = 0.25;
export const CAMP_REVEAL_KM = 400;

/** Camp tiles for a world: { [tile]: { tile } }, the same for the same seed and homes. */
export const placeCamps = (seed, homeTiles, count = TRIBAL_CAMP_COUNT) => {
  const tiles = getTiles();
  const homes = homeTiles.map((t) => tiles.centres[t]);
  const order = [];
  for (let t = 0; t < tiles.count; t++) if (tiles.land[t] && tiles.terrainOf(t) !== 'snow' && tiles.featureOf(t) !== 'ice') order.push(t);
  order.sort((a, b) => hashRoll(`${seed}|camp|${a}`) - hashRoll(`${seed}|camp|${b}`) || a - b);
  const camps = {}; const placed = [];
  for (const t of order) {
    if (placed.length >= count) break;
    const c = tiles.centres[t];
    if (homes.some((h) => distanceKm(h, c) < CITY_SPACING_KM) || placed.some((p) => distanceKm(p, c) < CAMP_SPACING_KM)) continue;
    camps[t] = { tile: t };
    placed.push(c);
  }
  return camps;
};

const withoutCamp = (state, tile) => {
  const rest = { ...state.tribalCamps };
  delete rest[tile];
  return { ...state, tribalCamps: rest, ...(state.pendingCamp?.tile === tile ? { pendingCamp: null } : {}) };
};

const nearestCity = (state, nationId, tile) => {
  const tiles = getTiles();
  let best = null; let bestKm = Infinity;
  Object.values(state.regions || {}).forEach((c) => {
    if (c.owner !== nationId || c.outpost) return;
    const km = distanceKm(tiles.centres[c.tile], tiles.centres[tile]);
    if (km < bestKm) { bestKm = km; best = c; }
  });
  return best;
};

/** What the camp on `tile` offers `nationId`: { absorb: city or null, trade: 'tech' | 'map' }. */
export const campOffer = (state, nationId, tile) => ({
  absorb: nearestCity(state, nationId, tile),
  trade: (nationId === state.playerNationId ? state.research : state.nations[nationId]?.research)?.current ? 'tech' : 'map'
});

/** The camp on `tile` makes its choice for `nationId`. Returns the state without the camp, or the
 * same state when there is no camp there or the choice is not open. */
export const resolveCamp = (state, nationId, tile, choice) => {
  if (!state.tribalCamps?.[tile]) return state;
  const offer = campOffer(state, nationId, tile);
  if (choice === 'absorb') {
    if (!offer.absorb) return state;
    const city = offer.absorb;
    return withoutCamp({ ...state, regions: { ...state.regions, [city.id]: { ...city, size: city.size + 1 } } }, tile);
  }
  if (choice !== 'trade') return state;
  if (offer.trade === 'map') {
    const tiles = getTiles();
    const near = [];
    const reach = ringsForKm(CAMP_REVEAL_KM);
    let frontier = [tile]; const seen = new Set(frontier);
    for (let d = 0; d < reach; d++) { const next = []; frontier.forEach((t) => tiles.neighbors[t].forEach((n) => { if (!seen.has(n)) { seen.add(n); next.push(n); } })); frontier = next; }
    seen.forEach((t) => near.push(t));
    return withoutCamp(withExplored(state, nationId, near), tile);
  }
  const isPlayer = nationId === state.playerNationId;
  const research = isPlayer ? state.research : state.nations[nationId].research;
  const tech = research.current;
  const gain = Math.round(getResearchCost(state, nationId, tech) * CAMP_TECH_SHARE);
  const next = { ...research, progress: { ...research.progress, [tech]: (research.progress?.[tech] || 0) + gain } };
  const after = isPlayer ? { ...state, research: next } : { ...state, nations: { ...state.nations, [nationId]: { ...state.nations[nationId], research: next } } };
  return withoutCamp(after, tile);
};

/** The camps phase (start of resolveTurn): covered camps vanish; an AI unit on a camp absorbs it
 * (or trades, with no city yet); a player's unit on one opens the camp card if none is open. */
export const updateCamps = (state) => {
  if (!state.tribalCamps) return state;
  const owner = state.world?.tileOwner || {};
  let next = state;
  Object.keys(state.tribalCamps).forEach((key) => { if (owner[key]) next = withoutCamp(next, Number(key)); });
  Object.values(next.units || {}).sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((u) => {
    if (u.domain === 'naval' || u.tile == null || !next.tribalCamps[u.tile]) return;
    if (u.ownerId === next.playerNationId) {
      if (!next.pendingCamp) next = { ...next, pendingCamp: { tile: u.tile, unitId: u.id } };
      return;
    }
    if (!next.nations[u.ownerId] || next.nations[u.ownerId].kind === 'independent') return;
    next = resolveCamp(next, u.ownerId, u.tile, campOffer(next, u.ownerId, u.tile).absorb ? 'absorb' : 'trade');
  });
  return next;
};
