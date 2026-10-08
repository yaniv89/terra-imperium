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
import { ART } from './artFiles';

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

// Texture space per uv unit of a bundle (a packed file scales its quantized uvs by the material's
// texture transform, which three puts on the map's repeat).
const uvScale = (bundle) => {
  const r = bundle.materials.find((m) => m?.map)?.map?.repeat;
  return r ? Math.max(Math.abs(r.x), Math.abs(r.y), 1e-6) : 1;
};
const faceGroups = (geo) => (geo.groups.length ? geo.groups : [{ start: 0, count: geo.index.count, materialIndex: 0 }]);
const centroid = (pos, idx, t, out) => {
  out[0] = 0; out[1] = 0; out[2] = 0;
  for (let j = 0; j < 3; j++) { const v = idx.getX(t + j); out[0] += pos.getX(v) / 3; out[1] += pos.getY(v) / 3; out[2] += pos.getZ(v) / 3; }
  return out;
};

// How far (texture space) a lower LOD's uvs sit from the full model's at the same places: about 0
// for a sound decimation; the temperate vegetation kit's LOD1 and LOD2 trees came out of the
// decimator with scrambled uvs (about 0.5: bark, leaves and ground from all over the atlas), which
// drew a forest of dark camouflage blobs at every zoom but the closest.
export const lodUvMismatch = (low, full) => {
  const p = low.geometry.attributes.position; const u = low.geometry.attributes.uv;
  const p0 = full.geometry.attributes.position; const u0 = full.geometry.attributes.uv;
  if (!u || !u0 || !p.count) return 0;
  let sum = 0;
  for (let i = 0; i < p.count; i++) {
    let best = Infinity; let bj = 0;
    for (let j = 0; j < p0.count; j++) {
      const d = (p.getX(i) - p0.getX(j)) ** 2 + (p.getY(i) - p0.getY(j)) ** 2 + (p.getZ(i) - p0.getZ(j)) ** 2;
      if (d < best) { best = d; bj = j; }
    }
    sum += Math.hypot(u.getX(i) - u0.getX(bj), u.getY(i) - u0.getY(bj));
  }
  return (sum / p.count) * uvScale(full);
};
export const LOD_UV_TOLERANCE = 0.15;

// Repair: every face of the lower LOD takes the uv at the centre of the nearest face of the full
// model with the same material (flat colour per face, the low-poly look), so the far trees wear
// the same bark and leaves as the near ones.
export const transferLodUvs = (low, full) => {
  const src = low.geometry.toNonIndexed();
  const n = src.attributes.position.count;
  src.setIndex(Array.from({ length: n }, (_, i) => i));
  const pos = src.attributes.position; const idx = src.index;
  const p0 = full.geometry.attributes.position; const i0 = full.geometry.index; const u0 = full.geometry.attributes.uv;
  const refs = []; // per material index of the low bundle: [cx, cy, cz, u, v] of the full model's faces
  const c = [0, 0, 0];
  faceGroups(full.geometry).forEach((g) => {
    const mi = low.materials.indexOf(full.materials[g.materialIndex]);
    const list = refs[mi] || (refs[mi] = []);
    for (let t = g.start; t < g.start + g.count; t += 3) {
      centroid(p0, i0, t, c);
      let uu = 0; let vv = 0;
      for (let j = 0; j < 3; j++) { uu += u0.getX(i0.getX(t + j)) / 3; vv += u0.getY(i0.getX(t + j)) / 3; }
      list.push([c[0], c[1], c[2], uu, vv]);
    }
  });
  const uv = new Float32Array(n * 2);
  faceGroups(src).forEach((g) => {
    const list = refs[g.materialIndex] || refs.find(Boolean) || [];
    for (let t = g.start; t < g.start + g.count; t += 3) {
      centroid(pos, idx, t, c);
      let best = Infinity; let pick = null;
      list.forEach((r) => { const d = (r[0] - c[0]) ** 2 + (r[1] - c[1]) ** 2 + (r[2] - c[2]) ** 2; if (d < best) { best = d; pick = r; } });
      if (pick) for (let j = 0; j < 3; j++) { uv[(t + j) * 2] = pick[3]; uv[(t + j) * 2 + 1] = pick[4]; }
    }
  });
  src.setAttribute('uv', new BufferAttribute(uv, 2));
  src.computeBoundingBox(); src.computeBoundingSphere();
  return { ...low, geometry: src };
};

/**
 * Parse a loaded glTF scene into { objects: { name: { lods: [bundle, bundle, bundle], sockets:
 * { name: Vector3 }, box: Box3 } } } (positions in the object's own space, glTF axes).
 */
export const parseKit = (scene, { repairLodUvs = false } = {}) => {
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
    for (let l = 1; repairLodUvs && l < lods.length; l++) {
      if (lods[l] && lods[l] !== lods[0] && lods[l] !== lods[l - 1] && lodUvMismatch(lods[l], lods[0]) > LOD_UV_TOLERANCE) lods[l] = transferLodUvs(lods[l], lods[0]);
    }
    const sockets = {};
    root.traverse((o) => { if (isSocket(o)) sockets[o.name] = new Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(toRoot); });
    objects[root.name] = { name: root.name, lods, sockets, box: new Box3().copy(lods[0].geometry.boundingBox) };
  });
  if (!Object.keys(objects).length) throw new Error('no objects with meshes');
  return { objects };
};

const kits = new Map(); // [url, repair policy] -> Promise<kit>
/** Preserve authored UV charts except for the exact known legacy kit, or an explicit opt-in. */
export const loadKit = (url, { load = loadGltf, repairLodUvs = url === ART.url('battle/nature/vegetation-temperate.glb') } = {}) => {
  if (!url) return Promise.resolve(null);
  const key = JSON.stringify([url, !!repairLodUvs]);
  if (!kits.has(key)) {
    kits.set(key, Promise.resolve().then(() => load(url)).then((gltf) => parseKit(gltf.scene, { repairLodUvs })).catch((e) => { kits.delete(key); throw new Error(`${url}: ${e.message}`); }));
  }
  return kits.get(key);
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
