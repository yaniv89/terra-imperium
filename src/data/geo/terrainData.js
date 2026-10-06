// src/data/geo/terrainData.js
// Phase F, the data half (plans/MASTER-PLAN.md 6.9 and 14; world art plan sections 3 to 7): small,
// pure read APIs over the terrain columns of the world grid, for the map renderer, the battle setup
// and the engine. Static data only (built by scripts/geo/build-tile-terrain.mjs into tiles.json and
// tiles.bin.gz); the one dynamic input is the road layer (state.world.tileState), passed in.
//
//   Rivers     on hex EDGES with a size class (RIVER_SIZE): which of a tile's six edges a river
//              crosses. Edge k of a tile is the edge it shares with neighbors[k]; it runs between
//              polygon corners k-1 and k (geodesic.js cellPolygon), and `edgeCorners` returns the
//              two corners with a canonical sum so both tiles of an edge get the very same points
//              (rivers join across cells with identical crossing positions, world plan 6).
//   Crossings  per river edge: fords by size (FORDS_BY_SIZE) and a bridge where a road runs on
//              both banks (a road edge). Battles read these (src/battle/setup/tileContext.js).
//   Mountains  a mountain tile belongs to a named range (`rangeOf`); ridge lines join the range's
//              tiles into one chain along its high ground (`ridgeEdgesOf`), and passes are the
//              saddles armies cross at the hills cost (`isPass`, armies.js).
//   Descriptor `tileTerrainDescriptor(tile, state)`: the geography half of the world plan's
//              TileVisualDescriptor (section 7), one plain object per tile.
// Every function is pure and cheap (no allocation beyond its result); none scans the world except
// `mountainRanges` and `riverEdgeList`, which cache per grid object.
import { getTiles } from './tiles';
import { toLatLon } from './geodesic';

export const TERRAIN_DATA_VERSION = 1;
export const RIVER_SIZE = Object.freeze({ NONE: 0, STREAM: 1, RIVER: 2, GREAT: 3 });
export const RIVER_SIZE_NAMES = Object.freeze(['none', 'stream', 'river', 'great river']);
// Fords a battle map gets on a river edge of each size: a stream is crossable in many places,
// a great river in one (master plan 6.9: the defender holds the fords as chokepoints).
export const FORDS_BY_SIZE = Object.freeze([0, 3, 2, 1]);
// The river's width on the battle map, in battlefield tiles, by size.
export const RIVER_WIDTH_BY_SIZE = Object.freeze([0, 1, 2, 3]);

const norm = ([x, y, z]) => { const l = Math.sqrt(x * x + y * y + z * z) || 1; return [x / l, y / l, z / l]; };
// lat/lon for drawing only (geodesic.js toLatLon); the engine never compares these.
const latLonOf = (v) => toLatLon(v);

/** The river size class (0..3) on the edge from `tile` to its neighbour `other`. */
export const riverSizeBetween = (tile, other, tiles = getTiles()) => tiles.riverSizeBetween(tile, other);

/** The river edges of a tile: [{ k, neighbour, size }] in neighbour order (k = edge index). */
export const riverEdgesOf = (tile, tiles = getTiles()) => {
  const out = [];
  const ns = tiles.neighbors[tile] || [];
  for (let k = 0; k < ns.length; k++) {
    const size = tiles.riverSizeBetween(tile, ns[k]);
    if (size) out.push({ k, neighbour: ns[k], size });
  }
  return out;
};

/** The largest river touching a tile (0 when none). */
export const riverSizeAt = (tile, tiles = getTiles()) => riverEdgesOf(tile, tiles).reduce((m, e) => Math.max(m, e.size), 0);

/**
 * The two ends of edge k of `tile` as unit vectors and lat/lon: the corners it shares with
 * neighbours k-1 / k and k / k+1. The sum of the three centres is taken in tile-id order, so the
 * neighbour computes bit-identical points for the same edge.
 */
export const edgeCorners = (tile, k, tiles = getTiles()) => {
  const ns = tiles.neighbors[tile];
  const m = ns.length;
  const corner = (a, b, c) => {
    const ids = [a, b, c].sort((x, y) => x - y).map((id) => tiles.centres[id]);
    return norm([ids[0][0] + ids[1][0] + ids[2][0], ids[0][1] + ids[1][1] + ids[2][1], ids[0][2] + ids[1][2] + ids[2][2]]);
  };
  const a = corner(tile, ns[(k + m - 1) % m], ns[k]);
  const b = corner(tile, ns[k], ns[(k + 1) % m]);
  return { a, b, from: latLonOf(a), to: latLonOf(b) };
};

const listCache = new WeakMap();
/**
 * Every river edge of the world once: [{ a, b, size }] with a < b (tile ids). Cached per grid.
 * A renderer draws each as the segment edgeCorners(a, k) (or joins edge midpoints into lines).
 */
export const riverEdgeList = (tiles = getTiles()) => {
  let c = listCache.get(tiles);
  if (c) return c;
  c = [];
  for (let a = 0; a < tiles.count; a++) {
    if (!tiles.rivers[a]) continue;
    for (const b of tiles.neighbors[a]) {
      if (b <= a) continue;
      const size = tiles.riverSizeBetween(a, b);
      if (size) c.push({ a, b, size });
    }
  }
  listCache.set(tiles, c);
  return c;
};

const hasRoad = (state, tile) => { const ts = state?.world?.tileState?.[tile]; return !!ts?.road && !ts.pillaged; };

/**
 * The river crossings of a tile for a battle or a renderer: [{ k, neighbour, size, fords, bridge }].
 * `bridge`: a road runs on both banks (state.world.tileState), so the crossing has a bridge.
 */
export const crossingsOf = (tile, state = null, tiles = getTiles()) => riverEdgesOf(tile, tiles).map((e) => ({
  ...e,
  fords: FORDS_BY_SIZE[e.size],
  bridge: hasRoad(state, tile) && hasRoad(state, e.neighbour)
}));

/** Neighbours of `tile` joined to it by a road edge (a road on both tiles). */
export const roadEdgesOf = (tile, state, tiles = getTiles()) => (hasRoad(state, tile) ? tiles.neighbors[tile].filter((n) => hasRoad(state, n)) : []);

// ---- mountains ---------------------------------------------------------------------------------

/** True on a mountain pass. */
export const isPass = (tile, tiles = getTiles()) => tiles.isPass(tile);

/** The range a mountain tile belongs to: { id, name, size } or null. */
export const rangeOf = (tile, tiles = getTiles()) => {
  const r = tiles.range ? tiles.range[tile] : -1;
  if (r == null || r < 0) return null;
  return { id: r, name: tiles.rangeNames?.[r] ?? null, size: tiles.rangeSizes?.[r] ?? 0 };
};

/** Neighbours a ridge line runs to from `tile` (mountain tiles of its range, along the crest). */
export const ridgeEdgesOf = (tile, tiles = getTiles()) => {
  const mask = tiles.ridge ? tiles.ridge[tile] : 0;
  if (!mask) return [];
  return tiles.neighbors[tile].filter((_, k) => mask & (1 << k));
};

const rangeCache = new WeakMap();
/** Every range: [{ id, name, size, tiles: [ids], passes: [ids] }]. Cached per grid. */
export const mountainRanges = (tiles = getTiles()) => {
  let c = rangeCache.get(tiles);
  if (c) return c;
  const names = tiles.rangeNames || [];
  c = names.map((name, id) => ({ id, name, size: tiles.rangeSizes?.[id] ?? 0, tiles: [], passes: [] }));
  if (tiles.range) {
    for (let t = 0; t < tiles.count; t++) {
      const r = tiles.range[t];
      if (r < 0 || !c[r]) continue;
      c[r].tiles.push(t);
      if (tiles.isPass(t)) c[r].passes.push(t);
    }
  }
  rangeCache.set(tiles, c);
  return c;
};

/**
 * The relief class of a tile for renderers and battles: 'flat' | 'hills' | 'pass' | 'mountains'
 * (water reads 'flat'). A pass is still mountain ground to look at; it is lower and crossable.
 */
export const reliefClassOf = (tile, tiles = getTiles()) => {
  if (tiles.land[tile] !== 1) return 'flat';
  const r = tiles.reliefOf(tile);
  return r === 'mountains' && tiles.isPass(tile) ? 'pass' : r;
};

// ---- the descriptor ----------------------------------------------------------------------------

/**
 * The geography of one tile as the world plan's TileVisualDescriptor (section 7) has it, for the
 * map's close view and the battle map. Edge arrays are in neighbour order (index k = edge k).
 * `state` is optional: without it the road edges are empty.
 */
export const tileTerrainDescriptor = (tile, state = null, tiles = getTiles()) => {
  const ns = tiles.neighbors[tile];
  const land = tiles.land[tile] === 1;
  return {
    tileId: tile,
    geographyVersion: TERRAIN_DATA_VERSION,
    terrainSeed: tile, // the tile id: the same tile is always the same ground
    land,
    terrain: tiles.terrainOf(tile),
    relief: reliefClassOf(tile, tiles),
    feature: tiles.featureOf(tile),
    climate: tiles.climate[tile] >= 0 ? tiles.climateNames[tiles.climate[tile]] : null,
    elevation: tiles.elevation[tile],
    roughness: tiles.roughness[tile],
    coastal: tiles.coastal[tile] === 1,
    neighbours: ns.slice(),
    waterEdges: ns.map((n) => tiles.land[n] !== 1),
    riverEdges: ns.map((n) => tiles.riverSizeBetween(tile, n)),
    roadEdges: ns.map((n) => hasRoad(state, tile) && hasRoad(state, n)),
    ridgeEdges: ns.map((_, k) => !!(tiles.ridge && tiles.ridge[tile] & (1 << k))),
    range: land ? rangeOf(tile, tiles) : null,
    pass: land && tiles.isPass(tile),
    riverName: tiles.riverNames?.[tile] || null
  };
};
