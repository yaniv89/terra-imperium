// src/battle/sim/spatial.js
// Packed uniform grids for the sim's neighbour queries (plans/MASTER-PLAN.md 6.2, phase C).
// A grid is rebuilt from the squads with a counting sort into flat typed arrays (CSR layout):
// `start[cell]..start[cell + 1]` indexes `items` (squad idx), and `px`/`py` hold each item's
// position packed next to it, so a radius query reads contiguous integers instead of chasing
// squad objects. Squads are inserted in ascending idx order, so every cell lists ascending ids.
// Optionally the grid is split by side (`bySide`): each cell then holds side 0's squads first and
// side 1's after `mid[cell]`, so "enemies near me" never walks past friends.
// The bounds come from the squads themselves (not the map), so a cell key is exactly
// floor(coord / cell) for every squad, wherever it stands: queries find the same squads at any
// cell size as long as nobody has moved since the build.
// Scratch arrays are kept on the grid and grow as needed: no allocation per tick once warm.

const grow = (arr, n, Ctor) => (arr && arr.length >= n ? arr : new Ctor(Math.max(n, (arr?.length || 16) * 2)));

export const makeGrid = (cell, bySide = false) => ({ cell, bySide, cx0: 0, cy0: 0, cols: 0, rows: 0, n: 0, start: null, mid: null, items: null, px: null, py: null, keys: null });

// Rebuild `g` from every squad that `include(q)` accepts.
export const rebuildGrid = (g, squads, include) => {
  const { cell } = g;
  let n = 0;
  let cx0 = Infinity; let cy0 = Infinity; let cx1 = -Infinity; let cy1 = -Infinity;
  g.keys = grow(g.keys, squads.length * 2, Int32Array);
  const keys = g.keys; // pairs (cx, cy) per squad, or a marker for "not in the grid"
  for (let i = 0; i < squads.length; i++) {
    const q = squads[i];
    if (!include(q)) { keys[i * 2] = 0x7fffffff; continue; }
    const cx = Math.floor(q.x / cell); const cy = Math.floor(q.y / cell);
    keys[i * 2] = cx; keys[i * 2 + 1] = cy;
    if (cx < cx0) cx0 = cx; if (cx > cx1) cx1 = cx;
    if (cy < cy0) cy0 = cy; if (cy > cy1) cy1 = cy;
    n += 1;
  }
  g.n = n;
  if (!n) { g.cols = 0; g.rows = 0; return g; }
  const cols = cx1 - cx0 + 1; const rows = cy1 - cy0 + 1;
  const buckets = cols * rows * (g.bySide ? 2 : 1);
  g.cx0 = cx0; g.cy0 = cy0; g.cols = cols; g.rows = rows;
  g.start = grow(g.start, buckets + 1, Int32Array);
  g.items = grow(g.items, n, Int32Array);
  g.px = grow(g.px, n, Int32Array);
  g.py = grow(g.py, n, Int32Array);
  const { start, items, px, py } = g;
  start.fill(0, 0, buckets + 1);
  // A bucket is (cell, side) when split by side, so side 0 then side 1 sit next to each other.
  const bucketOf = (i) => {
    const c = (keys[i * 2 + 1] - cy0) * cols + (keys[i * 2] - cx0);
    return g.bySide ? c * 2 + squads[i].side : c;
  };
  for (let i = 0; i < squads.length; i++) if (keys[i * 2] !== 0x7fffffff) start[bucketOf(i) + 1] += 1;
  for (let b = 0; b < buckets; b++) start[b + 1] += start[b];
  // Fill in ascending idx order; `keys` is reused as the write cursor per bucket afterwards.
  const cursor = grow(g.cursor, buckets, Int32Array); g.cursor = cursor;
  cursor.set(start.subarray(0, buckets));
  for (let i = 0; i < squads.length; i++) {
    if (keys[i * 2] === 0x7fffffff) continue;
    const at = cursor[bucketOf(i)]++;
    items[at] = i; px[at] = squads[i].x; py[at] = squads[i].y;
  }
  return g;
};

// Ascending sort of out[0..n) in place: insertion sort for the usual short radius results, the
// native numeric typed-array sort for long ones.
export const sortInts = (out, n) => {
  if (n > 32) { out.subarray(0, n).sort(); return out; }
  for (let i = 1; i < n; i++) {
    const v = out[i]; let j = i - 1;
    while (j >= 0 && out[j] > v) { out[j + 1] = out[j]; j -= 1; }
    out[j + 1] = v;
  }
  return out;
};
