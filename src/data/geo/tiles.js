// src/data/geo/tiles.js
// The world grid (plans/civ-map-rework.md, Part B): a loader over tiles.json, built by
// scripts/geo/build-tiles.mjs. Static data, never part of game state: a tile's dynamic facts
// (owner city, improvement, road, pillaged, seen) live in state as sparse maps keyed by tile id.
//
// The engine is synchronous (createInitialState, resolveTurn, the reducer), so the grid is a
// static import, decorated once on first use. `loadTiles()` stays as an async alias for callers
// written before the engine needed the grid.
import rawTiles from './tiles.json';
import { fromLatLon, buildLatLonIndex, cellPolygon, toLatLon } from './geodesic.js';

let cached = null;

const decorate = (raw) => {
  const n = raw.count;
  const centres = new Array(n);
  for (let i = 0; i < n; i++) centres[i] = fromLatLon(raw.lat[i] / 1000, raw.lon[i] / 1000);
  const neighbors = new Array(n);
  for (let i = 0; i < n; i++) {
    const ns = [];
    for (let k = 0; k < 6; k++) { const j = raw.neighbors[i * 6 + k]; if (j >= 0) ns.push(j); }
    neighbors[i] = ns;
  }
  const index = buildLatLonIndex(centres);
  const countryTiles = {};
  for (let i = 0; i < n; i++) {
    if (!raw.land[i] || raw.country[i] < 0) continue;
    const cid = raw.countryIds[raw.country[i]];
    (countryTiles[cid] ||= []).push(i);
  }
  return {
    ...raw,
    centres,
    neighbors,
    countryTiles,
    terrainOf: (id) => raw.terrainNames[raw.terrain[id]],
    reliefOf: (id) => raw.reliefNames[raw.relief[id]],
    featureOf: (id) => raw.featureNames[raw.feature[id]],
    countryOf: (id) => (raw.country[id] >= 0 ? raw.countryIds[raw.country[id]] : null),
    resourceOf: (id) => (raw.resource && raw.resource[id] >= 0 ? raw.resourceNames[raw.resource[id]] : null),
    isLand: (id) => raw.land[id] === 1,
    isWater: (id) => raw.land[id] !== 1,
    latLonOf: (id) => toLatLon(centres[id]),
    polygonOf: (id) => cellPolygon(centres, neighbors, id).map(toLatLon),
    nearest: (lat, lon, count = 1) => index.nearest(lat, lon, count),
    // True when the edge from `id` to its neighbour `other` carries a river.
    riverBetween: (id, other) => { const k = neighbors[id].indexOf(other); return k >= 0 && (raw.rivers[id] & (1 << k)) !== 0; }
  };
};

export const getTiles = () => {
  if (!cached) cached = decorate(rawTiles);
  return cached;
};

export const loadTiles = async () => getTiles();

// For tests and scripts that already hold a raw JSON of their own.
export const tilesFromRaw = (raw) => decorate(raw);
