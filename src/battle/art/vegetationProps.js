// src/battle/art/vegetationProps.js
// The battlefield's trees, rocks and grass from the battle's vegetation kit (S9:
// src/assets/battle/nature/vegetation-<kit>.glb, objects tree-s, tree-m, tree-l, stump, felled,
// bush, rock-s, rock-m, grass-tuft). BattleRenderer places the procedural props in instanced
// chunks; once the kit is in:
//   rocks, tufts   every chunk keeps its instances (positions, turns, sizes, shades) and takes
//                  the kit object's geometry and materials at true scale, the LOD by zoom
//   trees          (MD05) the kit holds several species at three sizes (tree-s-2, tree-m-3 ...;
//                  vegetation-<kit>-species.glb adds more to a kit that cannot be rebuilt). Every
//                  tree keeps its place, turn and shade and takes a species, a size and a rank
//                  from a hash of its place (treeMix.js), so woods are mixed stands and always the
//                  same ones. Close up (LOD0) every tree is drawn, one instanced mesh per chunk,
//                  species and size. Further out (LOD1, LOD2) one mesh per chunk and species draws
//                  the medium tree's far level scaled to each tree's size, and only the trees
//                  whose rank is under KEEP_AT_LOD: a wood thins to separate crowns with ground
//                  between them instead of closing into one dark mass over the men under it.
//                  Only the drawing thins: the forest tiles block and hide exactly as before.
// No kit file: nothing changes (the procedural trees stay).
import { InstancedMesh, Matrix4, Vector3, Quaternion, Color } from 'three';
import { ART } from './artFiles';
import { loadKit, kitObject } from './kitLoader';
import { vegetationKitFor } from './vegetation';
import { treeSpecies, treeAt, nearestSize, keptCount, FAR_CROWN_SCALE } from './treeMix';
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

const M = new Matrix4(); const P = new Vector3(); const Q = new Quaternion(); const SC = new Vector3(); const C = new Color();

export class VegetationProps {
  constructor(r, meshes, { ref = ART.vegetation(vegetationKitFor(r.setup)), more = ref?.kit ? ART.vegetationSpecies(ref.kit) : null, load = loadKit } = {}) {
    this.r = r; this.meshes = meshes; this.lod = -1; this.kinds = null; this.trees = null;
    if (!ref || !Object.keys(meshes).length) return;
    // the file of more species is an extra: without it the kit's own trees are drawn
    const extra = more ? Promise.resolve().then(() => load(more.url)).catch((e) => { console.warn(`[art] ${e.message}: the kit's own species only`); return null; }) : null;
    this.ready = Promise.all([load(ref.url), extra]).then(([kit, added]) => { if (!this.disposed) this.setKit(kit, added); })
      .catch((e) => console.warn(`[art] ${e.message}: keeping the procedural trees`));
  }

  // one scaled copy per LOD bundle (the kit's own geometry is shared with other users)
  level(obj, lod, k = 1) {
    const b = obj.lods[lod] || obj.lods[0];
    const s = CITY_TILES_PER_UNIT * k;
    return { geometry: this.r.track(b.geometry.clone().scale(s, s, s)), material: b.materials.length === 1 ? b.materials[0] : b.materials };
  }

  setKit(kit, added = null) {
    this.kinds = {};
    const species = treeSpecies(kit, added);
    const treeMeshes = species.length ? TREE_KINDS.flatMap((k) => this.meshes[k] || []) : [];
    Object.entries(this.meshes).forEach(([kind, list]) => {
      if (species.length && TREE_KINDS.includes(kind)) return;
      const obj = kitObject(kit, PROP_OBJECTS[kind] || []);
      if (!obj) return;
      this.kinds[kind] = { list, levels: obj.lods.map((_, l) => this.level(obj, l)) };
    });
    if (treeMeshes.length) this.buildTrees(species, treeMeshes);
    this.lod = -1;
    this.update(this.r.camera?.zoom ?? 1);
  }

  /** The kit's trees in place of the procedural ones: see the header. */
  buildTrees(species, sources) {
    const base = species.map((row) => row[nearestSize(row, 1)]);
    const height = (obj) => Math.max(1e-6, obj.box.max.y - obj.box.min.y);
    const sizeScale = species.map((row, i) => row.map((obj) => (obj ? height(obj) / height(base[i]) : 1)));
    const near = species.map((row) => row.map((obj) => (obj ? this.level(obj, 0) : null)));
    const far = base.map((obj) => [null, this.level(obj, 1), this.level(obj, 2, FAR_CROWN_SCALE)]);
    const chunks = new Map();
    sources.forEach((src) => {
      for (let j = 0; j < src.count; j++) {
        src.getMatrixAt(j, M); M.decompose(P, Q, SC);
        const t = treeAt(P.x, P.z, species.length);
        const size = nearestSize(species[t.species], t.size);
        if (size < 0) continue;
        if (src.instanceColor) src.getColorAt(j, C); else C.setRGB(1, 1, 1);
        const key = `${Math.floor(P.x / TREE_CHUNK)},${Math.floor(P.z / TREE_CHUNK)}`;
        if (!chunks.has(key)) chunks.set(key, { items: [], shadow: false, parent: src.parent || this.r.scene || null });
        const chunk = chunks.get(key);
        chunk.shadow = chunk.shadow || !!src.castShadow;
        chunk.items.push({ p: P.clone(), q: Q.clone(), c: C.clone(), species: t.species, size, rank: t.rank, scale: t.scale });
      }
      src.visible = false; // the procedural trees stand down; their instances are drawn by the meshes below
    });
    const make = (level, items, chunk, scaleOf) => {
      const mesh = new InstancedMesh(level.geometry, level.material, items.length);
      items.forEach((it, j) => {
        const s = scaleOf(it);
        mesh.setMatrixAt(j, M.compose(it.p, it.q, SC.set(s, s, s)));
        mesh.setColorAt(j, it.c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere(); mesh.computeBoundingBox();
      mesh.castShadow = chunk.shadow; mesh.receiveShadow = true;
      chunk.parent?.add(mesh);
      return mesh;
    };
    this.trees = { near: [], far: [], count: 0, species: species.length };
    chunks.forEach((chunk) => {
      this.trees.count += chunk.items.length;
      const byVariant = new Map(); const bySpecies = new Map();
      chunk.items.forEach((it) => {
        const v = it.species * 3 + it.size;
        if (!byVariant.has(v)) byVariant.set(v, []);
        byVariant.get(v).push(it);
        if (!bySpecies.has(it.species)) bySpecies.set(it.species, []);
        bySpecies.get(it.species).push(it);
      });
      byVariant.forEach((items, v) => {
        const sp = Math.floor(v / 3); const size = v % 3;
        this.trees.near.push({ mesh: make(near[sp][size], items, chunk, (it) => it.scale), species: sp, size });
      });
      bySpecies.forEach((items, sp) => {
        items.sort((a, b) => a.rank - b.rank); // the first trees are the ones every level keeps
        const mesh = make(far[sp][1], items, chunk, (it) => it.scale * sizeScale[sp][it.size]);
        this.trees.far.push({ mesh, species: sp, levels: far[sp], ranks: items.map((it) => it.rank), total: items.length });
      });
    });
  }

  update(zoom) {
    if (!this.kinds) return;
    const lod = vegetationLodForZoom(zoom);
    if (lod === this.lod) return;
    this.lod = lod;
    Object.values(this.kinds).forEach(({ list, levels }) => {
      const l = levels[lod] || levels[0];
      list.forEach((m) => { m.geometry = l.geometry; m.material = l.material; m.computeBoundingSphere(); m.computeBoundingBox(); });
    });
    if (!this.trees) return;
    this.trees.near.forEach(({ mesh }) => { mesh.visible = lod === 0; });
    this.trees.far.forEach((f) => {
      f.mesh.visible = lod > 0;
      if (lod === 0) return;
      const l = f.levels[lod];
      f.mesh.count = f.total; // the bounds take every tree, then the level draws the ones it keeps
      f.mesh.geometry = l.geometry; f.mesh.material = l.material;
      f.mesh.computeBoundingSphere(); f.mesh.computeBoundingBox();
      f.mesh.count = keptCount(f.ranks, lod);
    });
  }

  /** How many trees the field has and how many are drawn now (the perf readout and tests). */
  treeStats() {
    if (!this.trees) return null;
    const drawn = this.lod === 0 ? this.trees.near.reduce((s, n) => s + n.mesh.count, 0) : this.trees.far.reduce((s, f) => s + f.mesh.count, 0);
    return { trees: this.trees.count, drawn, species: this.trees.species, meshes: this.lod === 0 ? this.trees.near.length : this.trees.far.length, lod: this.lod };
  }

  dispose() {
    this.disposed = true;
    if (!this.trees) return;
    [...this.trees.near, ...this.trees.far].forEach(({ mesh }) => { mesh.parent?.remove(mesh); mesh.dispose(); });
    this.trees = null;
  }
}
