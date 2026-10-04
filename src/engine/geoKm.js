// src/engine/geoKm.js
// Km between tiles for the world-systems rules (trade, diffusion, plague, war contagion), written
// in km so a denser grid changes nothing. Built on the shared exact distance
// (src/data/geo/geodesic.js distanceKm: sqrt and asinExact, the same on every device).
import { distanceKm } from '../data/geo/geodesic';

/** Great-circle km between two unit vectors (tiles.centres entries). */
export const arcKm = distanceKm;

/** Km between two tiles of a grid, or Infinity when either is missing. */
export const tileKm = (tiles, a, b) => (a == null || b == null || !tiles.centres[a] || !tiles.centres[b] ? Infinity : distanceKm(tiles.centres[a], tiles.centres[b]));

/** The length in km of a path of adjacent tiles. */
export const pathKm = (tiles, path) => {
  let km = 0;
  for (let i = 1; i < (path?.length || 0); i++) km += distanceKm(tiles.centres[path[i - 1]], tiles.centres[path[i]]);
  return km;
};
