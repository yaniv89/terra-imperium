// src/engine/sight.js
// What a nation sees on the tile map (plans/civ-map-rework.md, D1 "fog of war", first slice):
// the tiles within SIGHT_LAND of its cities' land, within SIGHT_ARMY of its land units (+1 on
// hills), within SIGHT_FLEET of its fleets, and the same around the cities of its allies and
// vassals (sight is shared). Foreign armies outside this set are fog (mapMarkers.js); intel
// (intel.js) still reveals a whole nation. The greyed "seen before" memory and the darkened map
// arrive with the lenses of workstream 12. Pure; cached on the state's units and cities.
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { unitTile } from './armies';
import { mapEffectsFor } from './techMapEffects';
import { navalLineOf, navalSightBonus } from '../data/navalLines';

// In km as rings of the loaded grid (gridScale.js): 2, 2, 1 and 2 rings at frequency 75.
export const SIGHT_LAND = ringsForKm(200);
export const SIGHT_ARMY = ringsForKm(200);
export const SIGHT_HILLS_BONUS = ringsForKm(100);
export const SIGHT_FLEET = ringsForKm(200);

const cache = new WeakMap(); // state.units -> { regions, nationId, set }

const grow = (tiles, seeds, rings, out) => {
  let frontier = seeds;
  frontier.forEach((t) => out.add(t));
  for (let d = 0; d < rings; d++) {
    const next = [];
    for (const t of frontier) for (const n of tiles.neighbors[t]) if (!out.has(n)) { out.add(n); next.push(n); }
    frontier = next;
  }
};

const friendsOf = (state, nationId) => {
  const me = state.nations[nationId];
  const out = new Set([nationId]);
  Object.values(state.nations).forEach((n) => {
    if (n.isEliminated) return;
    if (n.vassalOf === nationId || me?.vassalOf === n.id || (n.hasMilitaryPact && me?.hasMilitaryPact)) out.add(n.id);
  });
  return out;
};

/** The set of tiles `nationId` can see this turn. */
export const visibleTiles = (state, nationId = state.playerNationId) => {
  const hit = cache.get(state.units);
  if (hit && hit.regions === state.regions && hit.nations === state.nations && hit.techTree === state.techTree && hit.nationId === nationId) return hit.set;
  const tiles = getTiles();
  const set = new Set();
  const extra = mapEffectsFor(state, nationId).sight; // techs that see further (techMapEffects.js)
  const friends = friendsOf(state, nationId);
  const landSeeds = [];
  Object.values(state.regions).forEach((c) => { if (friends.has(c.owner) && c.tile != null) landSeeds.push(...(c.tiles || [c.tile])); });
  grow(tiles, landSeeds, SIGHT_LAND + extra, set);
  Object.values(state.units).forEach((u) => {
    if (u.ownerId !== nationId || u.embarkedOn) return;
    const t = unitTile(state, u);
    if (t == null) return;
    const rings = extra + (u.domain === 'naval' ? SIGHT_FLEET + navalSightBonus(navalLineOf(u)) : SIGHT_ARMY + (tiles.reliefOf(t) === 'hills' ? SIGHT_HILLS_BONUS : 0));
    grow(tiles, [t], rings, set);
  });
  cache.set(state.units, { regions: state.regions, nations: state.nations, techTree: state.techTree, nationId, set });
  return set;
};

export const canSeeTile = (state, tile, nationId = state.playerNationId) => tile != null && visibleTiles(state, nationId).has(tile);
