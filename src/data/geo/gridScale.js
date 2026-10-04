// src/data/geo/gridScale.js
// The one place that turns kilometres into hex rings and back (plans/math/BRIEF.md: we are moving
// to more hexes). Nothing else may hard-code "km per ring", a ring count for a distance or a cell
// count: rules are written in kilometres and converted here, from the spacing MEASURED on the
// loaded grid, so a denser grid (frequency 100 or more) needs no hand edits.
//
//   meanKm   the mean distance between neighbouring tile centres (102.2 km at frequency 75): what
//            "one ring" means for a radius rule (culture pressure, sight, how far a unit looks).
//   maxKm    the longest neighbour step (112.5 km at frequency 75): no path of n steps spans
//            more than n x maxKm, which makes distance / maxKm an admissible A* guess.
//   minKm    the shortest step (76.5 km, beside the 12 pentagons).
//   cellKm2  the mean area of a tile (the Earth over the cell count): search budgets in area.
//
// Measured once per grid object in a fixed order with distanceKm (exact on every engine), so the
// numbers are the same everywhere. About 20 ms at 56k cells, linear in the cell count.
import { getTiles } from './tiles';
import { distanceKm, EARTH_RADIUS_KM } from './geodesic';

const measured = new WeakMap(); // tiles -> { meanKm, minKm, maxKm, cellKm2 }

/** The measured spacing of a grid: { meanKm, minKm, maxKm, cellKm2 }. */
export const gridSpacing = (tiles = getTiles()) => {
  let s = measured.get(tiles);
  if (s) return s;
  let sum = 0; let count = 0; let minKm = Infinity; let maxKm = 0;
  const { centres, neighbors } = tiles;
  for (let i = 0; i < centres.length; i++) {
    for (const j of neighbors[i]) {
      if (j <= i) continue; // each edge once
      const d = distanceKm(centres[i], centres[j]);
      sum += d; count += 1;
      if (d < minKm) minKm = d;
      if (d > maxKm) maxKm = d;
    }
  }
  s = Object.freeze({ meanKm: sum / count, minKm, maxKm, cellKm2: (4 * Math.PI * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / centres.length });
  measured.set(tiles, s);
  return s;
};

/** The km one ring stands for on this grid (the mean neighbour spacing). */
export const kmPerRing = (tiles = getTiles()) => gridSpacing(tiles).meanKm;

/** A radius in km as a whole number of rings (at least `min`). */
export const ringsForKm = (km, { min = 1, tiles = getTiles() } = {}) => Math.max(min, Math.round(km / gridSpacing(tiles).meanKm));

/** How many rings apart two tiles are, as a fraction: the great-circle km over the mean spacing. */
export const ringsApart = (a, b, tiles = getTiles()) => distanceKm(tiles.centres[a], tiles.centres[b]) / gridSpacing(tiles).meanKm;

/** A radius in km that surely holds every tile within `rings` steps (for a candidate prefilter
 * before an exact ring test): rings x the longest step. */
export const kmCoveringRings = (rings, tiles = getTiles()) => rings * gridSpacing(tiles).maxKm;

/** The fewest steps any path from tile `a` to tile `b` can take (never more than the true count,
 * so it is an admissible A* guess). The tiny factor absorbs rounding in the triangle inequality. */
export const minStepsBetween = (a, b, tiles = getTiles()) => (distanceKm(tiles.centres[a], tiles.centres[b]) / gridSpacing(tiles).maxKm) * (1 - 1e-9);

/** An area in km² as a number of tiles (at least `min`): search budgets that cover the same piece
 * of the world on any grid. */
export const cellsForAreaKm2 = (km2, { min = 1, tiles = getTiles() } = {}) => Math.max(min, Math.round(km2 / gridSpacing(tiles).cellKm2));
