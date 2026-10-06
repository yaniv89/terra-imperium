// src/battle/art/kitLoader.js
// A kit file (plans/ART-MODELS-PLAN.md D2, D12): one GLB holding several root objects by name
// (the roles of rts-<age>.glb, the pieces of walls-<age>.glb, the states of a node ...), each with
// LOD0, LOD1, LOD2 children (a file's second object has LOD0.001: three.js reads it as LOD0001) and
// optional socket empties (`socket-door`, `socket-fire-1`, `socket-end-a` ...). The battle draws
// every copy of a piece with one InstancedMesh (kitInstances.js), so a piece is baked once into one
// geometry per LOD in the object's own space (origin at its footprint centre on the ground, front
// to +Z in glTF), one draw group per material, sharing the file's materials (Town, Team, Ground).
// A root without LOD children (a projectile, a small prop) is its own LOD0; a missing LOD1 or LOD2
// reuses the level above it.
import { Matrix4, Vector3, BufferGeometry, BufferAttribute, Box3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadGltf } from '../render/gltfUnitLoader';

const LOD_NAME = /^LOD(\d)/;
export const lodOf = (o) => { const m = LOD_NAME.exec(o?.name || ''); return m ? Number(m[1]) : null; };
export const isSocket = (o) => /^socket[-_]/i.test(o?.name || '');
const hasMesh = (o) => { let found = false; o.traverse((c) => { if (c.isMesh) found = true; }); return found; };
/** The Team material (the side's colour) by its name. */
export const isTeamMaterial = (m) => /^team/i.test(m?.name || '');

// Any attribute as plain float32 (packed files carry quantized, normalized or interleaved data).
const toFloat = (attr, size = attr.itemSize) => {
  const out = new Float32Array(attr.count * size);
  for (let i = 0; i < attr.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = k < attr.itemSize ? attr.getComponent(i, k) : 0;
  return new BufferAttribute(out, size);
};

// One mesh's geometry in the root's space: position, normal and uv only, always indexed.
const bakePart = (mesh, toRoot) => {
  const src = mesh.geometry;
  const g = new BufferGeometry();
  g.setAttribute('position', toFloat(src.attributes.position, 3));
  if (src.attributes.normal) g.setAttribute('normal', toFloat(src.attributes.normal, 3));
  g.setAttribute('uv', src.attributes.uv ? toFloat(src.attributes.uv, 2) : new BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
  const n = src.attributes.position.count;
  if (src.index) g.setIndex(Array.from(src.index.array));
  else g.setIndex(Array.from({ length: n }, (_, i) => i));
  g.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
};

/** One LOD: every mesh under `nodes` baked into one geometry with a draw group per material. */
export const bakeBundle = (nodes, toRoot) => {
  const byMat = new Map(); // material -> [geometry]
  nodes.forEach((node) => node.traverse((o) => {
    if (!o.isMesh || isSocket(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g = bakePart(o, toRoot);
    if (mats.length === 1 || !o.geometry.groups.length) {
      if (!byMat.has(mats[0])) byMat.set(mats[0], []);
      byMat.get(mats[0]).push(g);
      return;
    }
    o.geometry.groups.forEach((grp) => {
      const m = mats[grp.materialIndex]; if (!m) return;
      const sub = new BufferGeometry();
      Object.entries(g.attributes).forEach(([k, a]) => sub.setAttribute(k, a));
      sub.setIndex(Array.from(g.index.array.slice(grp.start, grp.start + grp.count)));
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m).push(sub);
    });
  }));
  if (!byMat.size) return null;
  const materials = [...byMat.keys()];
  const merged = materials.map((m) => mergeGeometries(byMat.get(m), false));
  const geometry = merged.length === 1 ? merged[0] : mergeGeometries(merged, true);
  if (merged.length === 1) geometry.addGroup(0, geometry.index.count, 0);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, materials, team: materials.map(isTeamMaterial), triangles: geometry.index.count / 3 };
};

/**
 * Parse a loaded glTF scene into { objects: { name: { lods: [bundle, bundle, bundle], sockets:
 * { name: Vector3 }, box: Box3 } } } (positions in the object's own space, glTF axes).
 */
export const parseKit = (scene) => {
  scene.updateMatrixWorld(true);
  const lodRoots = [];
  scene.traverse((o) => { if (lodOf(o) === null && o.children.some((c) => lodOf(c) === 0)) lodRoots.push(o); });
  const lodSet = new Set(lodRoots);
  const holdsLodRoot = (o) => { let found = false; o.traverse((c) => { if (lodSet.has(c)) found = true; }); return found; };
  // and every top-level object without LOD levels (a multi-material mesh reads as a group of its
  // parts: one object all the same)
  const roots = [...lodRoots, ...scene.children.filter((o) => lodOf(o) === null && !isSocket(o) && !holdsLodRoot(o) && hasMesh(o))];
  const objects = {};
  roots.forEach((root) => {
    const toRoot = new Matrix4().copy(root.matrixWorld).invert();
    const lodNodes = [0, 1, 2].map((l) => root.children.filter((c) => lodOf(c) === l));
    if (!lodNodes[0].length) lodNodes[0] = [root];
    const lods = [];
    lodNodes.forEach((list, l) => { lods[l] = (list.length ? bakeBundle(list, toRoot) : null) || lods[l - 1] || null; });
    if (!lods[0]) return;
    const sockets = {};
    root.traverse((o) => { if (isSocket(o)) sockets[o.name] = new Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(toRoot); });
    objects[root.name] = { name: root.name, lods, sockets, box: new Box3().copy(lods[0].geometry.boundingBox) };
  });
  if (!Object.keys(objects).length) throw new Error('no objects with meshes');
  return { objects };
};

const kits = new Map(); // url -> Promise<kit>
/** Load a kit file once (url -> Promise of parseKit's result); a failed load can be retried. */
export const loadKit = (url, { load = loadGltf } = {}) => {
  if (!url) return Promise.resolve(null);
  if (!kits.has(url)) {
    kits.set(url, Promise.resolve().then(() => load(url)).then((gltf) => parseKit(gltf.scene)).catch((e) => { kits.delete(url); throw new Error(`${url}: ${e.message}`); }));
  }
  return kits.get(url);
};
/** The first object of `names` the kit has (a fallback list: 'barracks-damaged', 'barracks'). */
export const kitObject = (kit, ...names) => {
  if (!kit) return null;
  for (const n of names.flat()) if (n && kit.objects[n]) return kit.objects[n];
  return null;
};
/** The object's footprint (largest of width and depth) and height, model units. */
export const objectSize = (obj) => {
  const s = obj.box.getSize(new Vector3());
  return { footprint: Math.max(s.x, s.z), width: s.x, depth: s.z, height: s.y };
};
