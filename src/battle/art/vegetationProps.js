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
//                  Only the drawing thins: the forest tiles block and hide exactly as before.
// No kit file: nothing changes (the procedural trees stay).
import { InstancedMesh, Matrix4, Vector3, Quaternion, Color } from 'three';
import { ART } from './artFiles';
import { loadKit, kitObject } from './kitLoader';
import { vegetationKitFor } from './vegetation';
import { treeSpecies, treeAt, nearestSize, keptCount, windYaw, leanOf, hash2, FAR_CROWN_SCALE } from './treeMix';
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
const UP = new Vector3(0, 1, 0);

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
    const species = treeSpecies(kit);
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
    const levels = base.map((obj) => [this.level(obj, 0), this.level(obj, 1), this.level(obj, 2, FAR_CROWN_SCALE)]);
    const lean = base.map((obj) => leanOf(obj.box)); // null, or the way the crown stands off the foot
    const wind = windYaw(this.r.setup?.seed ?? 0);
    const chunks = new Map();
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
        const key = `${Math.floor(P.x / TREE_CHUNK)},${Math.floor(P.z / TREE_CHUNK)}`;
        if (!chunks.has(key)) chunks.set(key, { items: [], shadow: false, parent: src.parent || this.r.scene || null });
        const chunk = chunks.get(key);
        chunk.shadow = chunk.shadow || !!src.castShadow;
        chunk.items.push({ p: P.clone(), q: Q.clone(), c: C.clone(), species: t.species, size, rank: t.rank, s: t.scale * sizeScale[t.species][size] });
      }
      src.visible = false; // the procedural trees stand down; their instances are drawn by the meshes below
    });
    this.trees = { meshes: [], count: 0, species: species.length };
    chunks.forEach((chunk) => {
      this.trees.count += chunk.items.length;
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
        mesh.castShadow = chunk.shadow; mesh.receiveShadow = true;
        chunk.parent?.add(mesh);
        this.trees.meshes.push({ mesh, species: sp, levels: levels[sp], ranks: items.map((it) => it.rank), total: items.length, sizes: items.map((it) => it.size) });
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
    (this.trees?.meshes || []).forEach((t) => {
      const l = t.levels[lod];
      t.mesh.count = t.total; // the bounds take every tree, then the level draws the ones it keeps
      t.mesh.geometry = l.geometry; t.mesh.material = l.material;
      t.mesh.computeBoundingSphere(); t.mesh.computeBoundingBox();
      t.mesh.count = keptCount(t.ranks, lod);
    });
  }

  /** How many trees the field has and how many are drawn now (the perf readout and tests). */
  treeStats() {
    if (!this.trees) return null;
    return { trees: this.trees.count, drawn: this.trees.meshes.reduce((s, t) => s + t.mesh.count, 0), species: this.trees.species, meshes: this.trees.meshes.length, lod: this.lod };
  }

  dispose() {
    this.disposed = true;
    if (!this.trees) return;
    this.trees.meshes.forEach(({ mesh }) => { mesh.parent?.remove(mesh); mesh.dispose(); });
    this.trees = null;
  }
}
