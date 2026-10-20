// src/battle/render/treeFelling.js
// W12 (every tree is wood): the woods thin out as laborers cut them. A wood node (economySetup.js
// woodNodes) lists its forest tiles in the order they fall and the view says how many are down
// (`cut`, sim/economy.js fellTrees). Each frame this compares every wood's `cut` with the last one
// drawn; a tile whose tree fell has its trees hidden for good (render/fogMask.js fell: the same
// instance trick the fog uses, so the forest's chunks, LODs and draw calls stay as they were) and a
// stump stands where each of its trees stood. Stumps are instanced meshes for the whole field, one
// a stump variant (one draw call each): the vegetation kit's `stump`, `stump-2` (a snapped trunk, its
// top lying beside it) and `stump-3` (a low sawn stump, the log and chips) once the kit is loaded,
// each stump picking one by a hash of its tile (stumpVariant), else a short procedural trunk.
// Drawing only: nothing here reaches the sim.
import { InstancedMesh, MeshLambertMaterial, CylinderGeometry, Matrix4, Vector3, Quaternion } from 'three';

const M = new Matrix4(); const P = new Vector3(); const R = new Quaternion(); const S = new Vector3(); const UP = new Vector3(0, 1, 0);
const hash = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** Which of `n` stump variants the `k`th stump of tile `t` draws. Pure: the same tile always gets the same stump. */
export const stumpVariant = (t, k, n) => (n > 1 ? Math.min(n - 1, Math.floor(hash(t * 31 + k * 7 + 3) * n)) : 0);

/** The tiles felled when a wood's `cut` rises from `from` to `to` (its `trees` in felling order). Pure. */
export const newlyFelled = (trees, from, to) => trees.slice(Math.max(0, from), Math.max(0, Math.min(trees.length, to)));

export class TreeFelling {
  /** `r`: the renderer (setup, fogMask, scene, track, vegetation). */
  constructor(r) {
    this.r = r;
    const nodes = r.setup.economy?.nodes || [];
    this.woods = new Map(); // node index -> its trees (tiles in felling order)
    nodes.forEach((n, i) => { if (n.trees?.length) this.woods.set(i, n.trees); });
    this.cut = new Map(); // node index -> cut drawn
    this.mesh = null;
    this.meshes = [];
    if (!this.woods.size || !r.fogMask) return;
    // where each tree of a wood stands: the procedural trees' own instances (BattleRenderer.buildProps)
    const want = new Set(); this.woods.forEach((t) => t.forEach((i) => want.add(i)));
    this.spots = new Map(); // tile -> [[x, y, z, scale]]
    r.fogMask.records.forEach((rec) => {
      if (!rec.tree) return;
      for (let j = 0; j < rec.tile.length; j++) {
        const t = rec.tile[j];
        if (!want.has(t)) continue;
        const o = j * 16; const a = rec.orig;
        const s = Math.hypot(a[o], a[o + 1], a[o + 2]);
        if (!this.spots.has(t)) this.spots.set(t, []);
        this.spots.get(t).push([a[o + 12], a[o + 13], a[o + 14], s]);
      }
    });
    let capacity = 0; this.spots.forEach((l) => { capacity += l.length; });
    // a tile counted as a tree that drew none still leaves a stump
    want.forEach((t) => { if (!this.spots.has(t)) capacity += 1; });
    this.capacity = Math.max(1, capacity);
    const geo = r.track(new CylinderGeometry(0.09, 0.12, 0.16, 7).translate(0, 0.08, 0));
    this.mesh = this.addMesh(geo, r.track(new MeshLambertMaterial({ color: '#6b4a2e' })));
    this.kitStump = false;
  }

  addMesh(geometry, material) {
    const mesh = new InstancedMesh(geometry, material, this.capacity);
    mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
    this.r.scene.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  /** The kit's stumps in place of the procedural one, once the vegetation kit is in. */
  useKitStump() {
    const v = this.r.vegetation;
    if (this.kitStump || !v?.stumpObj || !this.mesh) return;
    const objs = v.stumpObjs?.length ? v.stumpObjs : [v.stumpObj];
    objs.forEach((obj, i) => {
      const l = v.level(obj, 0);
      if (i === 0) { this.mesh.geometry = l.geometry; this.mesh.material = l.material; } else this.addMesh(l.geometry, l.material);
    });
    this.kitStump = true;
    this.redraw();
  }

  stumpsOf(t) {
    const list = this.spots.get(t);
    if (list) return list;
    const w = this.r.setup.map.w; const x = t % w; const z = Math.floor(t / w);
    return [[x + 0.5, this.r.heightAt ? this.r.heightAt(x + 0.5, z + 0.5) : 0, z + 0.5, 0.8]];
  }

  writeStump(k, [x, y, z, s], t) {
    const mesh = this.meshes[this.kitStump ? stumpVariant(t, k, this.meshes.length) : 0];
    if (mesh.count >= this.capacity) return;
    // the kit's stump is true size already (scale about 1); the procedural one follows the tree's size
    const sc = this.kitStump ? 0.85 + hash(t * 7 + k) * 0.3 : s;
    R.setFromAxisAngle(UP, hash(t * 13 + k) * Math.PI * 2);
    mesh.setMatrixAt(mesh.count, M.compose(P.set(x, y, z), R, S.set(sc, sc, sc)));
    mesh.count += 1;
  }

  flush() { this.meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; }); }

  redraw() {
    if (!this.mesh) return;
    this.meshes.forEach((m) => { m.count = 0; });
    this.felledTiles?.forEach((t) => this.stumpsOf(t).forEach((spot, k) => this.writeStump(k, spot, t)));
    this.flush();
  }

  /** Every frame, with the frame's view: fell what the sim cut since the last frame. */
  update(view) {
    if (!this.mesh || !view?.eco) return;
    this.useKitStump();
    const fresh = [];
    const nodes = view.eco.nodes;
    for (let k = 0; k < nodes.length; k++) {
      const n = nodes[k];
      if (n.cut == null) continue;
      const before = this.cut.get(n.i) || 0;
      if (n.cut <= before) continue;
      const trees = this.woods.get(n.i);
      if (trees) fresh.push(...newlyFelled(trees, before, n.cut));
      this.cut.set(n.i, n.cut);
    }
    if (!fresh.length) return;
    this.felledTiles = this.felledTiles || [];
    this.r.fogMask.fell(fresh);
    fresh.forEach((t) => {
      this.felledTiles.push(t);
      this.stumpsOf(t).forEach((spot, k) => this.writeStump(k, spot, t));
    });
    this.flush();
  }

  /** How many trees are down and how many stumps are drawn (tests, the perf readout). */
  stats() {
    return { woods: this.woods.size, felled: this.felledTiles?.length || 0, stumps: this.meshes.reduce((s, m) => s + m.count, 0), variants: this.meshes.length };
  }
}
