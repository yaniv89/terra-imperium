// src/battle/art/vegetationProps.js
// The battlefield's trees, rocks and grass from the battle's vegetation kit (S9:
// src/assets/battle/nature/vegetation-<kit>.glb, objects tree-s, tree-m, tree-l, stump, felled,
// bush, rock-s, rock-m, grass-tuft). BattleRenderer places the procedural props in instanced
// chunks; once the kit is in:
//   rocks, tufts   every chunk keeps its instances (positions, turns, sizes, shades) and takes
//                  the kit object's geometry and materials at true scale, the LOD by zoom
//   trees          (MD05) the kit holds several species at three sizes (tree-s, tree-m-2,
//                  tree-l-3 ...). Every tree keeps its place and shade and takes a species, a
//                  size and a rank from a hash of its place (treeMix.js), so woods are mixed
//                  stands and always the same ones. One instanced mesh per chunk and species
//                  draws that species' medium tree at the zoom's LOD, scaled to each tree's size
//                  (small, medium or large: the heights of the kit's own tree-s, tree-m, tree-l),
//                  so a wood costs the same draw calls at every zoom. Close up (LOD0) every tree
//                  is drawn; further out (LOD1, LOD2) only those whose rank is under KEEP_AT_LOD:
//                  a wood thins to separate crowns with ground between them instead of closing
//                  into one dark mass over the men under it. Wind-bent species (their crown
//                  stands off the trunk's foot) all lean one way, the battle's wind.
//                  The level follows a medium tree's height on screen, not the raw zoom, and the
//                  trees keep to a triangle budget a frame (BATTLE_GRAPHICS.treeTriangles, shadows
//                  counted): past it they draw a simpler level, never fewer trees. Close up the
//                  trees come from 16-tile chunks and full trees go to the chunks nearest the
//                  middle of the view while the budget lasts (a chunk on screen is drawn whole).
//                  Only the drawing thins: the forest tiles block and hide exactly as before.
// No kit file: nothing changes (the procedural trees stay).
import { InstancedMesh, Matrix4, Vector3, Quaternion, Color, Frustum } from 'three';
import { ART } from './artFiles';
import { loadKit, kitObject } from './kitLoader';
import { vegetationKitFor } from './vegetation';
import { treeSpecies, treeAt, nearestSize, keptCount, windYaw, leanOf, hash2, FAR_CROWN_SCALE, treeLodForPx, pickTreeLod, REFERENCE_TREE_UNITS } from './treeMix';
import { CITY_TILES_PER_UNIT } from '../setup/cityBattle';

/** Which kit objects stand in for each procedural prop, first found wins (the trees only when a
 * kit has no tree the species rule can read). */
export const PROP_OBJECTS = { pine: ['tree-l', 'tree-m'], oak: ['tree-m', 'tree-l', 'tree-s'], rock: ['rock-m', 'rock-s'], tuft: ['grass-tuft', 'bush'] };
/** The procedural props that are trees. */
export const TREE_KINDS = ['pine', 'oak'];
/** The vegetation LOD for a battle zoom: the full trees only when close. */
export const vegetationLodForZoom = (zoom) => (zoom >= 2 ? 0 : zoom >= 0.9 ? 1 : 2);
/** Trees are instanced per square of this many tiles (BattleRenderer's PROP_CHUNK). */
export const TREE_CHUNK = 48;
/** Close up (the full-tree size level) trees are drawn from chunks this many tiles square. */
export const TREE_NEAR_CHUNK = 16;
const dist2 = (c, p) => (c.x - p.x) ** 2 + (c.z - p.z) ** 2;

const M = new Matrix4(); const P = new Vector3(); const Q = new Quaternion(); const SC = new Vector3(); const C = new Color();
const UP = new Vector3(0, 1, 0);
const FRUSTUM = new Frustum(); const PV = new Matrix4();
const trianglesOf = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

export class VegetationProps {
  constructor(r, meshes, { ref = ART.vegetation(vegetationKitFor(r.setup)), load = loadKit } = {}) {
    this.r = r; this.meshes = meshes; this.lod = -1; this.kinds = null; this.trees = null;
    if (!ref || !Object.keys(meshes).length) return;
    this.ready = Promise.resolve().then(() => load(ref.url)).then((kit) => { if (!this.disposed) this.setKit(kit); })
      .catch((e) => console.warn(`[art] ${e.message}: keeping the procedural trees`));
  }

  // one scaled copy per LOD bundle (the kit's own geometry is shared with other users)
  level(obj, lod, k = 1) {
    const b = obj.lods[lod] || obj.lods[0];
    const s = CITY_TILES_PER_UNIT * k;
    return { geometry: this.r.track(b.geometry.clone().scale(s, s, s)), material: b.materials.length === 1 ? b.materials[0] : b.materials };
  }

  setKit(kit) {
    this.kinds = {};
    this.stumpObj = kitObject(kit, ['stump']); // W12: a felled tree's stump (render/treeFelling.js)
    const species = treeSpecies(kit);
    const treeMeshes = species.length ? TREE_KINDS.flatMap((k) => this.meshes[k] || []) : [];
    Object.entries(this.meshes).forEach(([kind, list]) => {
      if (species.length && TREE_KINDS.includes(kind)) return;
      const obj = kitObject(kit, PROP_OBJECTS[kind] || []);
      if (!obj) return;
      this.kinds[kind] = { list, levels: obj.lods.map((_, l) => this.level(obj, l)) };
    });
    if (treeMeshes.length) this.buildTrees(species, treeMeshes);
    this.lod = -1; this.sizeLod = null; this.baseLod = null; this.active = null;
    this.update(this.r.camera?.zoom ?? 1);
  }

  /** The kit's trees in place of the procedural ones: see the header. */
  buildTrees(species, sources) {
    const base = species.map((row) => row[nearestSize(row, 1)]);
    const height = (obj) => Math.max(1e-6, obj.box.max.y - obj.box.min.y);
    const sizeScale = species.map((row, i) => row.map((obj) => (obj ? height(obj) / height(base[i]) : 1)));
    const levels = base.map((obj) => [this.level(obj, 0), this.level(obj, 1), this.level(obj, 2, FAR_CROWN_SCALE)]);
    const lean = base.map((obj) => leanOf(obj.box)); // null, or the way the crown stands off the foot
    const wind = windYaw(this.r.setup?.seed ?? 0);
    const all = [];
    sources.forEach((src) => {
      for (let j = 0; j < src.count; j++) {
        src.getMatrixAt(j, M); M.decompose(P, Q, SC);
        const t = treeAt(P.x, P.z, species.length);
        const size = nearestSize(species[t.species], t.size);
        if (size < 0) continue;
        const bend = lean[t.species];
        // a wind-bent tree turns its lean onto the wind, give or take 15 degrees
        if (bend !== null) Q.setFromAxisAngle(UP, wind - bend + (hash2(Math.round(P.x * 16), Math.round(P.z * 16), 9) - 0.5) * 0.52);
        if (src.instanceColor) src.getColorAt(j, C); else C.setRGB(1, 1, 1);
        all.push({ p: P.clone(), q: Q.clone(), c: C.clone(), species: t.species, size, rank: t.rank, s: t.scale * sizeScale[t.species][size], shadow: !!src.castShadow, parent: src.parent || this.r.scene || null });
      }
      src.visible = false; // the procedural trees stand down; their instances are drawn by the meshes below
    });
    // the same trees twice: in 48-tile chunks for the middle and far levels (few draw calls over a
    // whole wood), in 16-tile chunks close up, where a chunk is drawn whole if any of it is on
    // screen and full trees are costly: small chunks let the ones in the middle of the view draw
    // full trees while the budget lasts.
    const makeSet = (size, visible) => {
      const chunks = new Map();
      all.forEach((it) => {
        const key = `${Math.floor(it.p.x / size)},${Math.floor(it.p.z / size)}`;
        if (!chunks.has(key)) chunks.set(key, { items: [], shadow: false, parent: it.parent });
        const chunk = chunks.get(key);
        chunk.shadow = chunk.shadow || it.shadow;
        chunk.items.push(it);
      });
      const out = [];
      chunks.forEach((chunk) => {
        const bySpecies = new Map();
        chunk.items.forEach((it) => {
          if (!bySpecies.has(it.species)) bySpecies.set(it.species, []);
          bySpecies.get(it.species).push(it);
        });
        bySpecies.forEach((items, sp) => {
          items.sort((a, b) => a.rank - b.rank); // the first trees are the ones every level keeps
          const mesh = new InstancedMesh(levels[sp][0].geometry, levels[sp][0].material, items.length);
          items.forEach((it, j) => {
            mesh.setMatrixAt(j, M.compose(it.p, it.q, SC.set(it.s, it.s, it.s)));
            mesh.setColorAt(j, it.c);
          });
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere(); mesh.computeBoundingBox();
          mesh.castShadow = chunk.shadow; mesh.receiveShadow = true; mesh.visible = visible;
          chunk.parent?.add(mesh);
          this.r.fogMask?.add(mesh); // never-seen ground keeps its trees hidden (render/fogMask.js)
          out.push({ mesh, species: sp, levels: levels[sp], ranks: items.map((it) => it.rank), total: items.length, sizes: items.map((it) => it.size), tris: levels[sp].map((l) => trianglesOf(l.geometry)), kept: items.length, lod: -1 });
        });
      });
      return out;
    };
    this.trees = { meshes: makeSet(TREE_CHUNK, true), near: makeSet(TREE_NEAR_CHUNK, false), count: all.length, species: species.length };
  }

  /**
   * Every frame. The size level comes from a medium tree's height on screen (`cssPxPerTile`, css
   * px a battle tile; without it, from the zoom as before): it sets the rocks' and tufts' LOD, how
   * much of a wood stands (KEEP_AT_LOD) and the finest tree detail. The trees then draw that
   * detail, or a coarser one while the trees in view (`camera`'s frustum, shadows counted twice)
   * would draw more than `budget` triangles: a dense wood zoomed in on a phone keeps every tree it
   * had and draws them simpler instead of drawing a million triangles.
   */
  update(zoom, { cssPxPerTile = null, camera = null, budget = Infinity } = {}) {
    if (!this.kinds) return;
    const sizeLod = cssPxPerTile ? treeLodForPx(REFERENCE_TREE_UNITS * CITY_TILES_PER_UNIT * cssPxPerTile, this.sizeLod ?? 1) : vegetationLodForZoom(zoom);
    if (sizeLod !== this.sizeLod) {
      this.sizeLod = sizeLod;
      Object.values(this.kinds).forEach(({ list, levels }) => {
        const l = levels[sizeLod] || levels[0];
        list.forEach((m) => { m.geometry = l.geometry; m.material = l.material; m.computeBoundingSphere(); m.computeBoundingBox(); });
      });
      [...(this.trees?.meshes || []), ...(this.trees?.near || [])].forEach((t) => { t.kept = keptCount(t.ranks, sizeLod); });
    }
    if (!this.trees) { this.lod = sizeLod; return; }
    // close up the small chunks draw, further out the large ones
    const close = sizeLod === 0;
    const trees = close ? this.trees.near : this.trees.meshes;
    (close ? this.trees.meshes : this.trees.near).forEach((t) => { t.mesh.visible = false; });
    const limited = camera && Number.isFinite(budget);
    if (limited) {
      FRUSTUM.setFromProjectionMatrix(PV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      trees.forEach((t) => { t.inView = !t.mesh.boundingSphere || FRUSTUM.intersectsSphere(t.mesh.boundingSphere); });
    } else trees.forEach((t) => { t.inView = true; });
    const costOf = (t, lod) => (t.inView ? t.kept * t.tris[lod] * (t.mesh.castShadow ? 2 : 1) : 0);
    const cost = (lod) => trees.reduce((s, t) => s + costOf(t, lod), 0);
    // the level every chunk in view can afford (the middle one close up), then, close up, full
    // trees chunk by chunk from the middle of the view out while the budget lasts
    const floor = close ? 1 : sizeLod;
    const base = pickTreeLod({ sizeLod: floor, cost, budget, prev: this.baseLod == null ? floor : Math.max(this.baseLod, floor) });
    trees.forEach((t) => { t.want = base; });
    let spent = cost(base);
    if (close) {
      if (!limited) { trees.forEach((t) => { t.want = 0; }); spent = cost(0); }
      else {
        const mid = this.r.target || { x: 0, z: 0 }; // the ground point in the middle of the view
        const order = trees.filter((t) => t.inView).sort((a, b) => dist2(a.mesh.boundingSphere.center, mid) - dist2(b.mesh.boundingSphere.center, mid));
        order.forEach((t) => {
          const extra = costOf(t, 0) - costOf(t, base);
          if (spent + extra <= budget * (t.lod === 0 ? 1 : 0.85)) { t.want = 0; spent += extra; }
        });
      }
    }
    this.cost = spent;
    trees.forEach((t) => {
      t.mesh.visible = true;
      if (t.lod === t.want && t.mesh.count === t.kept) return;
      const l = t.levels[t.want];
      t.mesh.count = t.total; // the bounds take every tree, then the level draws the ones it keeps
      t.mesh.geometry = l.geometry; t.mesh.material = l.material;
      t.mesh.computeBoundingSphere(); t.mesh.computeBoundingBox();
      t.mesh.count = t.kept; t.lod = t.want;
    });
    this.baseLod = base;
    this.lod = trees.reduce((m, t) => (t.inView ? Math.min(m, t.lod) : m), base); // the finest level drawn
    this.fullDetail = trees.filter((t) => t.inView && t.lod === 0).length;
    this.active = trees;
  }

  /** How many trees the field has and how many are drawn now (the perf readout and tests). */
  treeStats() {
    if (!this.trees) return null;
    const active = this.active || this.trees.meshes;
    return { trees: this.trees.count, drawn: active.reduce((s, t) => s + t.mesh.count, 0), species: this.trees.species, meshes: this.trees.meshes.length, nearMeshes: this.trees.near.length, lod: this.lod, sizeLod: this.sizeLod, fullDetail: this.fullDetail, cost: this.cost };
  }

  dispose() {
    this.disposed = true;
    if (!this.trees) return;
    [...this.trees.meshes, ...this.trees.near].forEach(({ mesh }) => { this.r.fogMask?.remove(mesh); mesh.parent?.remove(mesh); mesh.dispose(); });
    this.trees = null;
  }
}
