// src/engine/world/cultureZones.js
// "Towns follow the land" off the real Earth (plans/MAP-VARIATIONS-PLAN.md 6.4). On Historical Earth
// the land of a tile is its modern country (architecture.js styleOfLand reads the country code). A
// generated world has no countries, so every land tile belongs to the CULTURE ZONE of the start
// (major or independent) nearest to it over land at world creation: `landOf(tile)` returns that
// people's id, which styleOfLand already accepts. It is derived from the game's site table and the
// world, never saved, and fixed for the game, so a conquered town keeps its look, as on Earth. The
// same lookup answers a national wonder's homeland ("Israel's land" is Israel's zone).
//
// The site table of the running game is noted by syncWorldRegistry (registry.js), which every
// reducer call and turn passes through; readers without the state (site rules, renderers) ask here.
import { getTiles, onWorldChange } from '../../data/geo/tiles';
import { PEOPLES } from '../../data/peoples';

let currentSites = null;
/** The site table of the game being played (null on the real Earth). */
export const noteZoneSites = (sites) => { currentSites = sites || null; };

const zoneCache = new WeakMap(); // sites -> { owner: Int16Array, ids }
onWorldChange(() => { currentSites = null; });

const zonesOf = (tiles, sites) => {
  let z = zoneCache.get(sites);
  if (z && z.tiles === tiles) return z;
  const ids = Object.keys(sites).sort();
  const owner = new Int16Array(tiles.count).fill(-1);
  const isLand = (i) => tiles.land[i] === 1 && tiles.terrainOf(i) !== 'lake';
  let queue = [];
  ids.forEach((id, k) => { const t = sites[id]; if (t != null && owner[t] < 0) { owner[t] = k; queue.push(t); } });
  while (queue.length) {
    const next = [];
    queue.forEach((i) => tiles.neighbors[i].forEach((j) => { if (owner[j] < 0 && isLand(j)) { owner[j] = owner[i]; next.push(j); } }));
    queue = next;
  }
  z = { owner, ids, tiles };
  zoneCache.set(sites, z);
  return z;
};

/** The land a tile belongs to for art and homelands: the modern country on Earth, the culture
 * zone's people on a generated world (null on land no start reaches, and on water). */
export const landOf = (tile, sites = currentSites) => {
  if (tile == null || tile < 0) return null;
  const tiles = getTiles();
  if (!sites || tiles.world?.kind !== 'generated') return tiles.countryOf(tile);
  const z = zonesOf(tiles, sites);
  return z.owner[tile] >= 0 ? z.ids[z.owner[tile]] : null;
};

/** Whether a tile lies on a homeland (a country code): that country on Earth, the zone of the
 * people of that land on a generated world. */
export const onHomeland = (tile, homeland, sites = currentSites) => {
  const land = landOf(tile, sites);
  return !!land && (land === homeland || PEOPLES[land]?.land === homeland);
};
