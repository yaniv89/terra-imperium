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

/** The km of one ring on the frequency-75 grid the game was tuned on. Only for data that still
 * counts "tiles" (modifier totals such as national.supplyRange, a few bonuses): new rules are
 * written in km. */
export const F75_RING_KM = 102;

/** `n` rings of the frequency-75 grid as rings of the loaded grid (0 stays 0): for data written in
 * tiles. Same as ringsForKm(n x 102 km). */
export const ringsFromF75 = (n, { tiles = getTiles() } = {}) => (n ? Math.sign(n) * ringsForKm(Math.abs(n) * F75_RING_KM, { min: 0, tiles }) : 0);

/** A hex's size relative to the frequency-75 grid (0.75 at frequency 100), from the frequency
 * alone (spacing goes as 1 / frequency), so the UI can scale zoom thresholds and model sizes
 * without measuring the grid. Render-only: the engine uses the measured spacing above. */
export const hexSizeVsF75 = (tiles = getTiles()) => 75 / (tiles.frequency || 75);

/** The land a new city claims, in km²: the 7-tile ring 1 of the frequency-75 grid (9,067 km² a
 * tile). Founding claims land, not a tile count (plans/math/grid-f100.md), so a denser grid keeps
 * the same start territories while the culture costs (world/cities.js) stay per area. */
export const FOUNDING_AREA_KM2 = 63_470;

/** The founding disk around `centre`: the centre, then whole shells (ring 1; the six ring-2 tiles
 * that touch two ring-1 tiles, the hex's nearer corners; the rest of ring 2) until the area is the
 * closest to FOUNDING_AREA_KM2: ring 1 at frequency 75 (7 tiles), ring 1 and the near ring-2 tiles
 * at frequency 100 (13 tiles). Ordered centre first, then by shell and tile id. Pure grid
 * topology, so it is the same on every engine. */
export const foundingDisk = (tiles, centre, areaKm2 = FOUNDING_AREA_KM2) => {
  const cell = gridSpacing(tiles).cellKm2;
  const ring1 = [...tiles.neighbors[centre]].sort((a, b) => a - b);
  const inRing1 = new Set(ring1);
  const ring2 = new Map(); // tile -> how many ring-1 tiles it touches
  ring1.forEach((t) => tiles.neighbors[t].forEach((n) => { if (n !== centre && !inRing1.has(n)) ring2.set(n, (ring2.get(n) || 0) + 1); }));
  const near2 = [...ring2.keys()].filter((t) => ring2.get(t) >= 2).sort((a, b) => a - b);
  const far2 = [...ring2.keys()].filter((t) => ring2.get(t) < 2).sort((a, b) => a - b);
  const shells = [[centre, ...ring1], [centre, ...ring1, ...near2], [centre, ...ring1, ...near2, ...far2]];
  let best = shells[0];
  shells.forEach((s) => { if (Math.abs(s.length * cell - areaKm2) < Math.abs(best.length * cell - areaKm2)) best = s; });
  return best;
};
