// src/components/map/gl/tileGpuData.js
// The tile grid as GPU data for the WebGL map (plans/MASTER-PLAN.md 5.4): the territory shader
// finds the tile under each pixel itself, so territories, borders, the hex overlay and the fog are
// one full-screen pass with no geometry per tile.
//   centres   one RGBA float texel per tile: the unit vector of its centre and its land flag;
//   neighbours two texels per tile: up to six neighbour ids, -1 where a pentagon has none;
//   lookup    a LOOKUP_W x LOOKUP_H equirectangular grid of tile ids (the tile nearest each
//             texel's centre). A pixel starts at its texel's tile and walks to the nearest centre
//             (WALK_STEPS steps over the neighbours), which is exactly the tile `tiles.nearest`
//             picks: the cells are the nearest-centre (Voronoi) cells of the grid.
// Pure (no three.js): built once per grid, cached on the tiles object.
export const DATA_W = 1024; // texels per row of the per-tile textures
export const LOOKUP_W = 1024;
export const LOOKUP_H = 512;
export const WALK_STEPS = 3;

const cache = new WeakMap();

const dot = (c, v) => c[0] * v[0] + c[1] * v[1] + c[2] * v[2];

/** From tile `start`, step to whichever neighbour is nearer `v` until none is (greedy walk). */
export const walkNearest = (tiles, v, start, maxSteps = 64) => {
  let a = start;
  for (let s = 0; s < maxSteps; s++) {
    let best = dot(tiles.centres[a], v); let next = a;
    const ns = tiles.neighbors[a];
    for (let i = 0; i < ns.length; i++) { const d = dot(tiles.centres[ns[i]], v); if (d > best) { best = d; next = ns[i]; } }
    if (next === a) return a;
    a = next;
  }
  return a;
};

/** The unit vector of a lat/lon in degrees (the shader's own formula). */
export const unitOf = (lat, lon) => {
  const la = (lat * Math.PI) / 180; const lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
};

/** The lookup texel's lat/lon centre (row 0 is the north edge). */
export const lookupTexelLatLon = (ix, iy, w = LOOKUP_W, h = LOOKUP_H) => ({ lat: 90 - ((iy + 0.5) * 180) / h, lon: -180 + ((ix + 0.5) * 360) / w });

const rowsFor = (count, perTile) => Math.ceil((count * perTile) / DATA_W);

/**
 * { count, rows, centres, neighbours, neighbourRows, lookup } for a grid (see the header). Built
 * once per tiles object.
 */
export const tileGpuData = (tiles) => {
  const hit = cache.get(tiles);
  if (hit) return hit;
  const n = tiles.count;
  const rows = rowsFor(n, 1);
  const centres = new Float32Array(DATA_W * rows * 4);
  for (let i = 0; i < n; i++) {
    const c = tiles.centres[i];
    centres[i * 4] = c[0]; centres[i * 4 + 1] = c[1]; centres[i * 4 + 2] = c[2]; centres[i * 4 + 3] = tiles.land[i] === 1 ? 1 : 0;
  }
  const neighbourRows = rowsFor(n, 2);
  const neighbours = new Float32Array(DATA_W * neighbourRows * 4).fill(-1);
  for (let i = 0; i < n; i++) {
    const ns = tiles.neighbors[i];
    for (let k = 0; k < ns.length && k < 6; k++) neighbours[i * 8 + k] = ns[k];
  }
  const lookup = new Float32Array(LOOKUP_W * LOOKUP_H);
  let start = 0;
  for (let iy = 0; iy < LOOKUP_H; iy++) {
    const { lat } = lookupTexelLatLon(0, iy);
    const near = tiles.nearest(lat, -180 + 180 / LOOKUP_W);
    start = near != null && near >= 0 ? near : start;
    for (let ix = 0; ix < LOOKUP_W; ix++) {
      const ll = lookupTexelLatLon(ix, iy);
      start = walkNearest(tiles, unitOf(ll.lat, ll.lon), start);
      lookup[iy * LOOKUP_W + ix] = start;
    }
  }
  const data = { count: n, rows, centres, neighbours, neighbourRows, lookup };
  cache.set(tiles, data);
  return data;
};

/** The shader's search in JS (for tests): the lookup texel's tile, then WALK_STEPS walk steps. */
export const shaderTileAt = (tiles, data, lat, lon) => {
  const ix = Math.min(LOOKUP_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * LOOKUP_W)));
  const iy = Math.min(LOOKUP_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * LOOKUP_H)));
  return walkNearest(tiles, unitOf(lat, lon), data.lookup[iy * LOOKUP_W + ix], WALK_STEPS);
};
