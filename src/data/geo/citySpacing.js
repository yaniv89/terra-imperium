// src/data/geo/citySpacing.js
// The settling rule, Civilization VI style, shared by founding (world/cities.js canFoundCity) and
// the scenario starts (scenarios.js), so no two city centres ever break it, start capitals included.
//
//   Same landmass:       city centres at least CITY_SPACING_KM apart (4 rings at frequency 100,
//                        3 at 75): Civ VI's "4 hexes apart, 3 hexes between".
//   Different landmasses: one ring less (Civ VI: water between two cities drops the rule to 3
//                        hexes), so facing coasts and nearby islands can both hold a city, while
//                        the first rings of the two cities still never touch.
//
// A landmass is a set of land tiles joined through land neighbours (landmassOf, cached per grid).
// Pure and deterministic.
import { ringsForKm } from './gridScale';

export const CITY_SPACING_KM = 306;

/** Rings between city centres on the same landmass (at least 2). */
export const citySpacingRings = (tiles) => Math.max(2, ringsForKm(CITY_SPACING_KM, { tiles }));

const landmassMemo = new WeakMap();
/** Int32Array: a landmass id per tile (joined through land neighbours), -1 for water. */
export const landmassOf = (tiles) => {
  let ids = landmassMemo.get(tiles);
  if (ids) return ids;
  ids = new Int32Array(tiles.count).fill(-1);
  let next = 0;
  for (let s = 0; s < tiles.count; s++) {
    if (tiles.land[s] !== 1 || ids[s] >= 0) continue;
    ids[s] = next;
    const queue = [s];
    for (let i = 0; i < queue.length; i++) {
      for (const n of tiles.neighbors[queue[i]]) if (tiles.land[n] === 1 && ids[n] < 0) { ids[n] = next; queue.push(n); }
    }
    next += 1;
  }
  landmassMemo.set(tiles, ids);
  return ids;
};

export const sameLandmass = (tiles, a, b) => { const ids = landmassOf(tiles); return ids[a] >= 0 && ids[a] === ids[b]; };

/** Whether a city centred on `centre` bars a new city on `tile`, `ring` rings away. */
export const spacingBlocks = (tiles, centre, tile, ring) => {
  const rings = citySpacingRings(tiles);
  if (ring < rings - 1) return true;
  return ring === rings - 1 && sameLandmass(tiles, centre, tile);
};

/** The furthest ring a city can bar (walk this far round a centre, then ask spacingBlocks). */
export const spacingReach = (tiles) => citySpacingRings(tiles) - 1;

/** Pairs of city centres that break the rule, as [a, b] tile pairs with a < b (two cities on one
 * tile count too). The invariant of stateAudit.js (settle-rules R7): nothing founds a city
 * against the rule, and conquest, flips and free cities never found one, so a pair means a bug.
 * Linear in the cities: a walk of `spacingReach` rings round each centre. */
export const spacingBreaches = (tiles, centres) => {
  const reach = spacingReach(tiles);
  const count = new Map();
  centres.forEach((c) => count.set(c, (count.get(c) || 0) + 1));
  const out = [];
  [...count.keys()].sort((a, b) => a - b).forEach((c) => {
    if (count.get(c) > 1) out.push([c, c]);
    const dist = new Map([[c, 0]]);
    const queue = [c];
    for (let i = 0; i < queue.length; i++) {
      const d = dist.get(queue[i]);
      if (d >= reach) continue;
      for (const n of tiles.neighbors[queue[i]]) {
        if (dist.has(n)) continue;
        dist.set(n, d + 1); queue.push(n);
        if (n > c && count.has(n) && spacingBlocks(tiles, c, n, d + 1)) out.push([c, n]);
      }
    }
  });
  return out;
};
