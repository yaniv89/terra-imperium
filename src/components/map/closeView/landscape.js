// src/components/map/closeView/landscape.js
// What stands on the land in the close view besides towns and armies (plans/playtest-1.md P1.3):
// trees in forest and jungle hexes and a small work on every improved tile. Pure and three.js
// free, so it is unit tested; landscapeModels.js builds the meshes.
//   Trees   TREES_PER_HEX on every forest or jungle tile on screen that holds no city, district,
//           wonder or improvement, at places hashed from the tile id (they never shuffle), from
//           TREES_FROM_K up, at most MAX_TREES. The kind follows the tile: palms in the jungle,
//           pines north of CONIFER_LAT (and south of -CONIFER_LAT), broadleaf trees elsewhere.
//   Works   one per improved tile (farm, pasture, mine, quarry, ...), a little off the tile centre
//           so a city badge never hides it; pillaged works are drawn darker. Roads are drawn by
//           the map already, so they have no work.
// Model units: a hex is about HEX_UNITS across (the towns' scale, unitPx in scale.js).
import { getTiles } from '../../../data/geo/tiles';
import { hexSizeVsF75 } from '../../../data/geo/gridScale';
import { tilesInWindow } from '../../../data/geo/tileSpatialIndex';

export const TREES_FROM_K = 14 / hexSizeVsF75(); // 14 at frequency 75: trees come with the close view's look, not a fixed zoom
export const TREES_PER_HEX = 22;
export const MAX_TREES = 4000;
export const CONIFER_LAT = 48;
export const HEX_UNITS = 4;
// In the super zoom (k 40 to 200) the woods get denser and each tree smaller, up to these factors.
export const SUPER_TREE_COUNT = 3;
export const SUPER_TREE_SIZE = 0.75;
export const superShare = (k) => Math.max(0, Math.min(1, Math.log(Math.max(1, k) / 40) / Math.log(5)));
// The radius trees are spread over, in degrees of latitude: 0.42 on the frequency-75 grid (a hex
// about 102 km, 0.92 deg), scaled with the hex.
const SPREAD_DEG = 0.42 * hexSizeVsF75();
export const WORK_KINDS = ['farm', 'pasture', 'camp', 'mine', 'quarry', 'plantation', 'lumber_camp', 'oil_well', 'fort', 'fishing_boats'];

let landCache = null;
const landTiles = () => {
  if (landCache) return landCache;
  const tiles = getTiles();
  const ids = []; const lat = []; const lon = [];
  for (let i = 0; i < tiles.count; i++) {
    if (tiles.land[i] !== 1) continue;
    ids.push(i); lat.push(tiles.lat[i] / 1000); lon.push(tiles.lon[i] / 1000);
  }
  landCache = { ids, lat: Float32Array.from(lat), lon: Float32Array.from(lon) };
  return landCache;
};

/**
 * The land tiles whose centre falls on screen (plus `margin` px): [{ tile, x, y, lat, lon }].
 * `toScreen(lat, lon)` returns { x, y } in screen pixels.
 */
// `area` ({ south, north, west, east } in degrees, a little larger than the screen) narrows the
// scan to the spatial index's cells in view (tileSpatialIndex.js) instead of every land tile.
export const landTilesOnScreen = (toScreen, width, height, margin = 60, area = null) => {
  const out = [];
  const keep = (tile, la, lo) => {
    const p = toScreen(la, lo);
    if (!p || p.x < -margin || p.y < -margin || p.x > width + margin || p.y > height + margin) return;
    out.push({ tile, x: p.x, y: p.y, lat: la, lon: lo });
  };
  if (area) {
    const tiles = getTiles();
    tilesInWindow(area).forEach((t) => keep(t, tiles.lat[t] / 1000, tiles.lon[t] / 1000));
    return out;
  }
  const { ids, lat, lon } = landTiles();
  for (let i = 0; i < ids.length; i++) keep(ids[i], lat[i], lon[i]);
  return out;
};

// A deterministic 0..1 number from two integers.
export const hash01 = (a, b) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** The kind of tree a tile grows, or null for a tile without trees. */
export const treeKindOf = (tiles, tile) => {
  const f = tiles.featureOf(tile);
  if (f === 'jungle') return 'palm';
  if (f !== 'forest') return null;
  return Math.abs(tiles.lat[tile] / 1000) >= CONIFER_LAT ? 'conifer' : 'broad';
};

/** Is something built on the tile that clears its trees (a city, a district, a wonder, a work)? */
export const tileIsCleared = (world, cityTiles, tile) => {
  if (cityTiles.has(tile)) return true;
  const st = world?.tileState?.[tile];
  return !!(st && (st.improvement || st.district || st.wonder));
};

/**
 * The trees of one tile: [{ dLat, dLon, size, turn }], `count` of them in a disc around the
 * centre, an empty middle where the hex would hold a road crossing.
 */
export const treeSpots = (tile, lat, count = TREES_PER_HEX) => {
  const out = [];
  const cos = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i < count; i++) {
    const a = hash01(tile, i * 3 + 1) * Math.PI * 2;
    const r = SPREAD_DEG * Math.sqrt(0.08 + 0.92 * hash01(tile, i * 3 + 2));
    out.push({ dLat: Math.sin(a) * r, dLon: (Math.cos(a) * r) / cos, size: 0.75 + hash01(tile, i * 3 + 3) * 0.5, turn: hash01(i, tile) * Math.PI * 2 });
  }
  return out;
};

/** The work drawn on a tile, or null: { kind, pillaged }. */
export const workOf = (world, tile) => {
  const st = world?.tileState?.[tile];
  if (!st?.improvement || !WORK_KINDS.includes(st.improvement)) return null;
  return { kind: st.improvement, pillaged: !!st.pillaged };
};

/** Where a work stands: off the tile centre toward the south-east, in model units. */
export const WORK_OFFSET = { x: -1.1, y: 0.9 };

/**
 * Everything to draw on the land: { trees: [{ kind, x, y, size, turn }], works: [{ kind, pillaged,
 * x, y, turn }] } in screen pixels, from the tiles on screen. `toScreen(lat, lon)` as above;
 * `k` the zoom; `cityTiles` a Set of the tiles that hold a city.
 */
export const landscapeOnScreen = ({ toScreen, width, height, k, world, cityTiles, tiles = getTiles(), maxTrees = MAX_TREES, isExplored = null, area = null }) => {
  const trees = []; const works = [];
  // Works from the sparse tile state (sea tiles too: fishing boats).
  Object.keys(world?.tileState || {}).forEach((key) => {
    const tile = Number(key);
    const work = workOf(world, tile);
    if (!work) return;
    const p = toScreen(tiles.lat[tile] / 1000, tiles.lon[tile] / 1000);
    if (!p || p.x < -60 || p.y < -60 || p.x > width + 60 || p.y > height + 60) return;
    works.push({ ...work, tile, x: p.x, y: p.y, turn: hash01(tile, 99) * Math.PI * 2 });
  });
  if (k < TREES_FROM_K) return { trees, works };
  const sup = superShare(k);
  const perHex = Math.round(TREES_PER_HEX * (1 + (SUPER_TREE_COUNT - 1) * sup));
  const sizeMul = 1 - (1 - SUPER_TREE_SIZE) * sup;
  landTilesOnScreen(toScreen, width, height, 60, area).forEach((t) => {
    if (trees.length >= maxTrees) return;
    const kind = treeKindOf(tiles, t.tile);
    if (!kind || tileIsCleared(world, cityTiles, t.tile) || (isExplored && !isExplored(t.tile))) return; // no trees in the unexplored dark
    treeSpots(t.tile, t.lat, perHex).forEach((s) => {
      if (trees.length >= maxTrees) return;
      const p = toScreen(t.lat + s.dLat, t.lon + s.dLon);
      if (p && p.x > -40 && p.y > -40 && p.x < width + 40 && p.y < height + 40) trees.push({ kind, x: p.x, y: p.y, size: s.size * sizeMul, turn: s.turn });
    });
  });
  return { trees, works };
};
