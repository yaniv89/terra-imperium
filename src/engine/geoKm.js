// src/engine/geoKm.js
// Distances in kilometres between tile centres, for rules written in km so a denser grid changes
// nothing (plans/math/BRIEF.md). geodesic.js distanceKm uses Math.acos, whose last bit can differ
// between browsers; here the chord (a square root, exact in IEEE 754) is turned into the arc by
// the asin series 2R (x + x^3/6 + 3x^5/40 + 5x^7/112), x = chord / 2R: within 0.1% up to 8,000 km,
// and plain arithmetic on every device. Past that it under-reads a little (6% at the antipode),
// which no rule here cares about.
import { EARTH_RADIUS_KM } from '../data/geo/geodesic';

/** Great-circle km between two unit vectors (tiles.centres entries). */
export const arcKm = (a, b) => {
  const dx = a[0] - b[0]; const dy = a[1] - b[1]; const dz = a[2] - b[2];
  const x = Math.min(1, Math.sqrt(dx * dx + dy * dy + dz * dz) / 2);
  const x2 = x * x;
  return 2 * EARTH_RADIUS_KM * x * (1 + x2 * (1 / 6 + x2 * (3 / 40 + x2 * (5 / 112))));
};

/** Km between two tiles of a grid, or Infinity when either is missing. */
export const tileKm = (tiles, a, b) => (a == null || b == null || !tiles.centres[a] || !tiles.centres[b] ? Infinity : arcKm(tiles.centres[a], tiles.centres[b]));

/** The length in km of a path of adjacent tiles. */
export const pathKm = (tiles, path) => {
  let km = 0;
  for (let i = 1; i < (path?.length || 0); i++) km += arcKm(tiles.centres[path[i - 1]], tiles.centres[path[i]]);
  return km;
};
