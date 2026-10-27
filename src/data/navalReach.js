// src/data/navalReach.js
// Age-gated naval reach on the world grid (plans/civ-map-rework.md, D1): a city is coastal when
// its centre or a ring-1 tile touches the sea; two coastal cities are in reach when a path over
// water tiles of the age's allowed depth joins their coasts within the age's range. Shelf (coast)
// tiles are open to everyone, deep ocean needs the Age of Gunpowder, as in the old sea lanes.
import { REGIONS_DATA } from './regions';
import { getTiles } from './geo/tiles';
import { kmPerRing, ringsForKm } from './geo/gridScale';
import { agesFrom, LAST_AGE_ID } from './ages';

export const NAVAL_REACH_KM = {
  stone: 150,
  bronze: 200,
  classical: 500,
  kingdoms: 1000,
  gunpowder: 5000,
  modern: Infinity,
  information: Infinity,
  future: Infinity
};
const DEEP_OK_FROM = agesFrom('gunpowder');

export const isCoastal = (regionId) => !!REGIONS_DATA[regionId]?.isCoastal;

// The sea tiles beside a city's land depend on its tiles alone: memoised per `includes` array (a
// city keeps the same array until it claims or loses a tile, while every registry rebuild makes a
// new entry object). The length guards against an array grown in place, the grid against a new world.
const coastMemo = new WeakMap(); // includes array -> { length, tiles, water }
const coastTilesOf = (regionId) => {
  const tiles = getTiles();
  const data = REGIONS_DATA[regionId];
  if (!data) return [];
  const hit = data.includes && coastMemo.get(data.includes);
  if (hit && hit.length === data.includes.length && hit.tiles === tiles) return hit.water;
  const own = data.includes || [data.tile];
  const water = new Set();
  own.forEach((t) => tiles.neighbors[t].forEach((n) => { if (!tiles.land[n] && tiles.terrainOf(n) !== 'lake') water.add(n); }));
  const out = [...water];
  if (data.includes) coastMemo.set(data.includes, { length: data.includes.length, tiles, water: out });
  return out;
};

// Water tiles reachable from `regionId`'s coast within `maxTiles` steps at this age.
const reachCache = new WeakMap();
const seaReach = (regionId, ageId) => {
  const data = REGIONS_DATA[regionId];
  if (!data || !data.isCoastal) return new Map();
  // The reach follows from the coast tiles alone (coastTilesOf): keyed like them on `includes`.
  const key = data.includes || data;
  let perAge = reachCache.get(key);
  const tiles = getTiles();
  if (perAge && (perAge.length !== (data.includes || []).length || perAge.tiles !== tiles)) perAge = null;
  if (!perAge) { perAge = new Map(); perAge.length = (data.includes || []).length; perAge.tiles = tiles; reachCache.set(key, perAge); }
  if (perAge.has(ageId)) return perAge.get(ageId);
  // Whole tiles only, so a lane's km never exceeds the age's reach (one tile at Bronze).
  // One tile is the measured spacing of the grid (gridScale.js); the open-ended Modern reach stops
  // at about 40,900 km of water (400 tiles at frequency 75).
  const maxTiles = NAVAL_REACH_KM[ageId] === Infinity ? ringsForKm(40_900) : Math.max(1, Math.floor((NAVAL_REACH_KM[ageId] || 0) / kmPerRing()));
  const deepOk = DEEP_OK_FROM.includes(ageId);
  const dist = new Map();
  let frontier = coastTilesOf(regionId);
  frontier.forEach((t) => dist.set(t, 0));
  for (let d = 1; d <= maxTiles && frontier.length; d++) {
    const next = [];
    frontier.forEach((t) => tiles.neighbors[t].forEach((n) => {
      if (dist.has(n) || tiles.land[n]) return;
      if (!deepOk && tiles.terrainOf(n) === 'ocean') return;
      dist.set(n, d); next.push(n);
    }));
    frontier = next;
  }
  perAge.set(ageId, dist);
  return dist;
};

// Every coastal city within this age's reach of `regionId`, nearest first.
export const getSeaLanesWithinReach = (regionId, ageId) => {
  const reach = seaReach(regionId, ageId);
  if (!reach.size) return [];
  const out = [];
  Object.values(REGIONS_DATA).forEach((r) => {
    if (r.id === regionId || !r.isCoastal) return;
    let best = Infinity;
    coastTilesOf(r.id).forEach((t) => { const d = reach.get(t); if (d != null && d < best) best = d; });
    if (best < Infinity) out.push({ to: r.id, km: best * kmPerRing() });
  });
  return out.sort((a, b) => a.km - b.km || (a.to < b.to ? -1 : 1));
};

export const getAllSeaLanes = (regionId) => getSeaLanesWithinReach(regionId, LAST_AGE_ID);

export const isReachableBySea = (fromRegionId, toRegionId, ageId) => {
  const reach = seaReach(fromRegionId, ageId);
  return coastTilesOf(toRegionId).some((t) => reach.has(t));
};
