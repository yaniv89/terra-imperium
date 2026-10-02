// src/battle/setup/tileContext.js
// What a tactical battlefield is built from on the tile world (plans/civ-map-rework.md, D5): the
// fought-over tile and its six neighbours. Each neighbour fills the edge SECTOR of the field that
// faces it, rivers run along the edges that carry them, the coast is where the sea is, the city's
// walls set the keep, and the attacker always comes from the WEST, so the sectors are rotated
// until the neighbour the attacker approaches from sits at bearing 180.
//   { tile, terrain, attackerBearing, sectors: [{ tile, bearing, terrain, water, river, road }],
//     coastal, walls, hpRatio, roads }
// `bearing`: degrees on the battlefield after the rotation (0 = east, 90 = north, 180 = west).
// Pure of the battle seed: the same tile is always the same ground.
import { getTiles } from '../../data/geo/tiles';
import { legacyTerrainOf } from '../../engine/world/registry';
import { siegeHpOf, siegeMaxHp, wallsOf } from '../../engine/sieges';

const bearingDeg = (tiles, from, to) => {
  const a = tiles.latLonOf(from); const b = tiles.latLonOf(to);
  const dx = (b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180); const dy = b.lat - a.lat;
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
};

/**
 * The context of a battle on `tile`, approached from `fromTile` (a neighbour, or any tile whose
 * bearing gives the attacker's side; null puts the attacker due west). `city`: the city record on
 * the tile, when the battle is for a city.
 */
export const tileContextOf = (state, tile, { fromTile = null, city = null } = {}) => {
  const tiles = getTiles();
  if (tile == null || tile < 0) return null;
  const tileState = state?.world?.tileState || {};
  const approach = fromTile != null && fromTile !== tile ? bearingDeg(tiles, tile, fromTile) : 180;
  const rot = 180 - approach; // turns the approach bearing into west
  const sectors = tiles.neighbors[tile].map((n) => ({
    tile: n,
    bearing: ((bearingDeg(tiles, tile, n) + rot) % 360 + 360) % 360,
    terrain: tiles.land[n] === 1 ? legacyTerrainOf(tiles, n) : null,
    water: tiles.land[n] !== 1,
    lake: tiles.land[n] !== 1 && tiles.terrainOf(n) === 'lake',
    river: tiles.riverBetween(tile, n),
    road: !!tileState[n]?.road && !tileState[n]?.pillaged
  })).sort((a, b) => a.bearing - b.bearing);
  return {
    tile,
    terrain: tiles.land[tile] === 1 ? legacyTerrainOf(tiles, tile) : 'island',
    attackerBearing: 180,
    sectors,
    coastal: sectors.some((s) => s.water && !s.lake),
    walls: city ? wallsOf(city) : 0,
    hpRatio: city ? Math.max(0, Math.min(1, siegeHpOf(city) / Math.max(1, siegeMaxHp(city)))) : 1,
    roads: (!!tileState[tile]?.road && !tileState[tile]?.pillaged ? 1 : 0) + sectors.filter((s) => s.road).length
  };
};

/** The sector a battlefield cell at angle `deg` (0 = east, 90 = north) belongs to, or null. */
export const sectorAt = (sectors, deg) => {
  if (!sectors?.length) return null;
  let best = null; let bestGap = 361;
  sectors.forEach((s) => { const gap = Math.abs((((deg - s.bearing) % 360) + 540) % 360 - 180); if (gap < bestGap) { bestGap = gap; best = s; } });
  return best;
};
