// src/engine/world/landChanges.js
// Repairs a saved game after a grid rebuild turned some tiles from land to water or back
// (plans/math/straits.md: the real straits opened in scripts/geo/build-tiles.mjs). Tile ids are
// grid ids and never move, so only the facts that depend on a tile's land flag need fixing:
//   - a city centred on a tile that is now water moves its centre to the nearest land tile it
//     already owns (or a free land neighbour it then claims); the city keeps its id and name;
//   - improvements, roads and districts on a tile that is now water are gone (tileState cleared);
//   - a tile that is now water and that no city can work (open ocean) loses its owner; coast
//     water stays owned, as any coastal city's sea tiles are;
//   - units: normalizeUnitTiles (armies.js) sends a land unit on water, or a fleet on land, home.
// Pure: returns the same state when nothing applies. Deterministic: ties break by tile id.
import { normalizeUnitTiles } from '../armies';

const workable = (tiles, t) => tiles.land[t] === 1 || ['coast', 'lake'].includes(tiles.terrainOf(t));

/** The new centre for a city whose centre tile is water now, or null when none is in reach. */
export const relocatedCentre = (tiles, tileOwner, city) => {
  const from = city.tile;
  const own = (city.tiles || []).filter((t) => t !== from && tiles.land[t] === 1);
  // Nearest first: the old centre's neighbours, then the rest of the city's land by distance.
  const dist = (t) => {
    const a = tiles.centres[from]; const b = tiles.centres[t];
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  };
  const byDistance = (list) => list.slice().sort((a, b) => dist(a) - dist(b) || a - b);
  if (own.length) return byDistance(own)[0];
  const free = tiles.neighbors[from].filter((t) => tiles.land[t] === 1 && tileOwner[t] == null);
  return free.length ? byDistance(free)[0] : null;
};

/**
 * Applies a list of land-flag changes to a loaded state. `toWater` / `toLand` are tile ids whose
 * flag changed; `tiles` is the current grid (getTiles()).
 */
export const applyLandChanges = (state, { toWater = [], toLand = [] }, tiles) => {
  if (!state?.world || (!toWater.length && !toLand.length)) return state;
  const wet = new Set(toWater.filter((t) => tiles.land[t] !== 1));
  let regions = state.regions;
  let tileOwner = state.world.tileOwner || {};
  let tileState = state.world.tileState || {};
  let changed = false;
  const copyWorld = () => {
    if (changed) return;
    changed = true;
    regions = { ...regions }; tileOwner = { ...tileOwner }; tileState = { ...tileState };
  };
  wet.forEach((t) => { if (tileState[t] != null) { copyWorld(); delete tileState[t]; } });
  Object.keys(regions).sort().forEach((id) => {
    const city = regions[id];
    if (city?.tile == null) return;
    let next = city;
    if (wet.has(city.tile)) {
      const centre = relocatedCentre(tiles, tileOwner, city);
      if (centre != null) {
        copyWorld();
        tileOwner[centre] = id;
        const owned = next.tiles || [city.tile];
        next = { ...next, tile: centre, tiles: owned.includes(centre) ? owned : [...owned, centre] };
      }
    }
    const lost = (next.tiles || []).filter((t) => wet.has(t) && t !== next.tile && !workable(tiles, t));
    if (lost.length) {
      copyWorld();
      lost.forEach((t) => { if (tileOwner[t] === id) delete tileOwner[t]; });
      next = { ...next, tiles: next.tiles.filter((t) => !lost.includes(t)), worked: (next.worked || []).filter((t) => !lost.includes(t)) };
    }
    if (next !== city) { copyWorld(); regions[id] = next; }
  });
  const out = changed ? { ...state, regions, world: { ...state.world, tileOwner, tileState } } : state;
  // Units on a tile whose flag changed either way go home (fleets to port, armies to their city).
  const flipped = new Set([...toWater, ...toLand]);
  const unitsAffected = Object.values(state.units || {}).some((u) => flipped.has(u.tile));
  return changed || unitsAffected ? normalizeUnitTiles(out) : out;
};
