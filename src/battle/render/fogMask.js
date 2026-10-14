// src/battle/render/fogMask.js
// Fog of war for the battlefield's static instanced props (trees, rocks, tufts, houses): the black
// veil lies on the ground, so a tree or a house standing on ground the player's side has never seen
// would show above it. Each instance is hidden (its matrix scaled to nothing) while its tile is
// "never seen" (grid 0) and put back the first time the tile is explored or visible; after that it
// keeps its remembered look, like a strategy game's map. Seen is one way (a tile never goes back to
// unseen), so a mesh with nothing left hidden costs nothing on later grids. The grid is the player's
// fog grid (0 never seen, 1 explored, 2 visible), the same one the veil texture is made from, so
// there is no per-frame cost: the work happens when a new grid arrives (a few times a second).

const SCALE_ELEMENTS = [0, 1, 2, 4, 5, 6, 8, 9, 10];

export class FogMask {
  constructor(w, h) { this.w = w; this.h = h; this.records = []; this.grid = null; }

  /** Watch an InstancedMesh whose matrices are final (positions are tile units, y up). */
  add(mesh) {
    const arr = mesh.instanceMatrix.array; const n = mesh.instanceMatrix.count;
    const tile = new Int32Array(n);
    for (let j = 0; j < n; j++) {
      const x = Math.max(0, Math.min(this.w - 1, Math.floor(arr[j * 16 + 12])));
      const z = Math.max(0, Math.min(this.h - 1, Math.floor(arr[j * 16 + 14])));
      tile[j] = z * this.w + x;
    }
    const rec = { mesh, orig: arr.slice(), tile, hidden: new Uint8Array(n), hiddenCount: 0 };
    this.records.push(rec);
    if (this.grid) this.apply(rec);
    return rec;
  }

  remove(mesh) { this.records = this.records.filter((r) => r.mesh !== mesh); }

  /** A new fog grid of the player's side (or null: no fog, everything is shown). */
  update(grid) {
    this.grid = grid;
    this.records.forEach((rec) => { if (!grid || rec.hiddenCount !== 0 || !rec.sawGrid) this.apply(rec); });
  }

  apply(rec) {
    const { mesh, orig, tile, hidden } = rec; const arr = mesh.instanceMatrix.array; const grid = this.grid;
    let changed = false; let count = 0;
    for (let j = 0, n = tile.length; j < n; j++) {
      const want = grid && grid[tile[j]] === 0 ? 1 : 0;
      if (want) count++;
      if (want === hidden[j]) continue;
      hidden[j] = want; changed = true;
      const o = j * 16;
      if (want) for (let k = 0; k < 9; k++) arr[o + SCALE_ELEMENTS[k]] = 0;
      else for (let k = 0; k < 16; k++) arr[o + k] = orig[o + k];
    }
    rec.hiddenCount = count; rec.sawGrid = !!grid;
    if (changed) mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() { this.records = []; this.grid = null; }
}
