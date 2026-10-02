// src/data/navalReach.js
// Age-gated naval reach on the world grid (plans/civ-map-rework.md, D1): a city is coastal when
// its centre or a ring-1 tile touches the sea; two coastal cities are in reach when a path over
// water tiles of the age's allowed depth joins their coasts within the age's range. Shelf (coast)
// tiles are open to everyone, deep ocean needs the Age of Gunpowder, as in the old sea lanes.
import { REGIONS_DATA } from './regions';
import { getTiles } from './geo/tiles';

export const NAVAL_REACH_KM = {
  bronze: 200,
  classical: 500,
  kingdoms: 1000,
  gunpowder: 5000,
  modern: Infinity
};
const KM_PER_TILE = 147;
const DEEP_OK_FROM = ['gunpowder', 'modern'];

export const isCoastal = (regionId) => !!REGIONS_DATA[regionId]?.isCoastal;

const coastTilesOf = (regionId) => {
  const tiles = getTiles();
  const data = REGIONS_DATA[regionId];
  if (!data) return [];
  const own = data.includes || [data.tile];
  const water = new Set();
  own.forEach((t) => tiles.neighbors[t].forEach((n) => { if (!tiles.land[n] && tiles.terrainOf(n) !== 'lake') water.add(n); }));
  return [...water];
};

// Water tiles reachable from `regionId`'s coast within `maxTiles` steps at this age.
const reachCache = new WeakMap();
const seaReach = (regionId, ageId) => {
  const key = REGIONS_DATA[regionId];
  if (!key || !key.isCoastal) return new Map();
  let perAge = reachCache.get(key);
  if (!perAge) { perAge = new Map(); reachCache.set(key, perAge); }
  if (perAge.has(ageId)) return perAge.get(ageId);
  const tiles = getTiles();
  // Whole tiles only, so a lane's km never exceeds the age's reach (one tile at Bronze).
  const maxTiles = NAVAL_REACH_KM[ageId] === Infinity ? 400 : Math.max(1, Math.floor((NAVAL_REACH_KM[ageId] || 0) / KM_PER_TILE));
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
    if (best < Infinity) out.push({ to: r.id, km: best * KM_PER_TILE });
  });
  return out.sort((a, b) => a.km - b.km || (a.to < b.to ? -1 : 1));
};

export const getAllSeaLanes = (regionId) => getSeaLanesWithinReach(regionId, 'modern');

export const isReachableBySea = (fromRegionId, toRegionId, ageId) => {
  const reach = seaReach(fromRegionId, ageId);
  return coastTilesOf(toRegionId).some((t) => reach.has(t));
};
