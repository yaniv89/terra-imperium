// src/components/map/closeView/buildingLayer.js
// Draws the towns' landmark buildings (buildingModels.js) with instancing: one InstancedMesh per
// model file, level of detail and material, shared by every town on screen, so the draw calls grow
// with the kinds of landmark in view and not with the number of towns (a phone sees a dozen towns
// at once). A model's Team cloth takes each town's colour and its Ground the town's ground tint
// through the instance colour, as instanceTownAsset does for a cloned town. The improvement
// models (improvementModels.js) use a second layer of the same kind.
import { BufferGeometry, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Vector3, DynamicDrawUsage } from 'three';

const LOD_NAME = /^LOD(\d)/;
const lodOf = (o) => { const m = LOD_NAME.exec(o.name || ''); return m ? Number(m[1]) : null; };

/**
 * A model's parts per level of detail: [[{ geometry, material, kind, local }], ...] where `local`
 * places the part in the root object's space and `kind` is 'team', 'ground' or 'plain'. A mesh
 * with several materials becomes one part per material (each shares the mesh's buffers).
 */
export const prepareBuildingModel = (root) => {
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const lods = [];
  root.children.forEach((lodNode) => {
    const lod = lodOf(lodNode);
    if (lod === null) return;
    const parts = (lods[lod] ||= []);
    lodNode.traverse((o) => {
      if (!o.isMesh) return;
      const local = new Matrix4().multiplyMatrices(toRoot, o.matrixWorld);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const groups = Array.isArray(o.material) && o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
      groups.forEach((g) => {
        const src = mats[g.materialIndex];
        if (!src) return;
        let geometry = o.geometry;
        if (groups.length > 1) {
          geometry = new BufferGeometry();
          Object.entries(o.geometry.attributes).forEach(([n, a]) => geometry.setAttribute(n, a));
          if (o.geometry.index) geometry.setIndex(o.geometry.index);
          geometry.setDrawRange(g.start, g.count);
        }
        const kind = src.name === 'Team' ? 'team' : src.name === 'Ground' ? 'ground' : 'plain';
        // Team and Ground take their colour from the instance; the rest keeps its own
        const material = kind === 'plain' ? src : src.clone();
        const base = src.color ? src.color.clone() : new Color(1, 1, 1);
        if (kind !== 'plain' && material.color) material.color.setRGB(1, 1, 1);
        parts.push({ geometry, material, kind, base, local });
      });
    });
  });
  return Array.from(lods, (p) => p || []);
};

// ---- the far levels' guard ---------------------------------------------------------------------
// A level that draws black where LOD0 does not: every base-set improvement file of the art session
// (mine-bronze, farm-bronze, quarry-bronze ... src/assets/map/improvements/*-bronze.glb and
// *-modern.glb) has a LOD1 and LOD2 Ground that is one square whose UVs fall on an empty, black
// corner of the atlas, so a mine showed as a black square from zoom 13 to 40 (lodForZoom). Such a
// part takes LOD0's part of the same material instead (the Ground disc is a few hundred vertices).
export const DARK_LUMINANCE = 0.06;
export const LIT_LUMINANCE = 0.15;
/**
 * Swap each part of LOD1 and up whose texture is black at its UVs (`lumOf(part)`: mean luminance
 * 0..1, or null when it cannot tell) for LOD0's parts of the same material, where those are lit.
 * Changes `lods` in place; returns what it swapped: [{ lod, material }].
 */
export const repairDarkLods = (lods, lumOf) => {
  const fixed = [];
  const lit = new Map(); // material name -> LOD0's parts, when they are lit
  const lum = (p) => { try { return lumOf(p); } catch { return null; } };
  (lods[0] || []).forEach((p) => {
    const name = p.material?.name || '';
    if (!lit.has(name)) lit.set(name, []);
    lit.get(name).push(p);
  });
  lit.forEach((parts, name) => { const l = parts.map(lum); if (l.some((x) => x == null || x < LIT_LUMINANCE)) lit.delete(name); });
  for (let l = 1; l < lods.length; l++) {
    const parts = lods[l] || [];
    const dark = new Set(parts.filter((p) => lit.has(p.material?.name || '') && (lum(p) ?? 1) < DARK_LUMINANCE).map((p) => p.material?.name || ''));
    if (!dark.size) continue;
    lods[l] = [...parts.filter((p) => !dark.has(p.material?.name || '')), ...[...dark].flatMap((name) => lit.get(name))];
    dark.forEach((material) => fixed.push({ lod: l, material }));
  }
  return fixed;
};

// The mean luminance of a part's base colour texture at its vertices' UVs (texture transform and
// flip applied), read once per image from a small copy on a 2D canvas. Null without a texture or
// a canvas (tests, a worker).
const SAMPLE = 128;
const pixelsOf = new WeakMap();
const imagePixels = (image) => {
  if (pixelsOf.has(image)) return pixelsOf.get(image);
  let data = null;
  try {
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(SAMPLE, SAMPLE)
      : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: SAMPLE, height: SAMPLE }) : null;
    const g = canvas?.getContext('2d', { willReadFrequently: true });
    if (g) { g.drawImage(image, 0, 0, SAMPLE, SAMPLE); data = g.getImageData(0, 0, SAMPLE, SAMPLE).data; }
  } catch { data = null; }
  pixelsOf.set(image, data);
  return data;
};
export const partLuminance = (part) => {
  const map = part.material?.map; const uv = part.geometry?.attributes?.uv;
  if (!map?.image || !uv) return null;
  const px = imagePixels(map.image);
  if (!px) return null;
  map.updateMatrix();
  const e = map.matrix.elements;
  const index = part.geometry.index;
  const total = index ? index.count : uv.count;
  const start = part.geometry.drawRange.start;
  const end = Math.min(total, start + part.geometry.drawRange.count);
  const step = Math.max(1, Math.floor((end - start) / 400));
  let sum = 0; let n = 0;
  const wrap = (x) => x - Math.floor(x);
  for (let i = start; i < end; i += step) {
    const vi = index ? index.getX(i) : i;
    const u0 = uv.getX(vi); const v0 = uv.getY(vi);
    const u = wrap(e[0] * u0 + e[3] * v0 + e[6]); let v = wrap(e[1] * u0 + e[4] * v0 + e[7]);
    if (map.flipY) v = 1 - v;
    const o = (Math.min(SAMPLE - 1, Math.floor(v * SAMPLE)) * SAMPLE + Math.min(SAMPLE - 1, Math.floor(u * SAMPLE))) * 4;
    sum += (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255; n += 1;
  }
  return n ? sum / n : null;
};

const START = 16;

/**
 * Sizes of a prepared model at LOD0 in its root's ground plane (glTF: x east, z south): `radius`
 * the farthest vertex from the origin, `ground` the mean [x, z] of its Ground faces' vertices
 * (null without Ground), so a caller can turn a shoreline toward the coast.
 */
export const modelInfo = (lods) => {
  let radius = 0; let gx = 0; let gz = 0; let gn = 0;
  const v = new Vector3();
  (lods[0] || []).forEach((part) => {
    const pos = part.geometry.attributes.position;
    if (!pos) return;
    const index = part.geometry.index;
    const total = index ? index.count : pos.count;
    const start = part.geometry.drawRange.start;
    const end = Math.min(total, start + part.geometry.drawRange.count);
    for (let i = start; i < end; i++) {
      v.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(part.local);
      radius = Math.max(radius, Math.hypot(v.x, v.z));
      if (part.kind === 'ground') { gx += v.x; gz += v.z; gn += 1; }
    }
  });
  return { radius, ground: gn ? [gx / gn, gz / gn] : null };
};

/** The layer: begin() each layout, add() each placed landmark, end() to upload. */
export const createBuildingLayer = (scene) => {
  const models = new Map(); // url -> { lods, meshes: [[InstancedMesh per part]] }
  const touched = new Set();
  const tmp = new Matrix4();
  const colour = new Color();
  let lod = 0;

  const meshFor = (entry, l, i, need) => {
    const meshes = (entry.meshes[l] ||= []);
    let mesh = meshes[i];
    if (mesh && mesh.instanceMatrix.count >= need) return mesh;
    const part = entry.lods[l][i];
    const cap = Math.max(START, mesh ? mesh.instanceMatrix.count * 2 : 0);
    const next = new InstancedMesh(part.geometry, part.material, cap);
    next.instanceMatrix.setUsage(DynamicDrawUsage);
    next.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(DynamicDrawUsage);
    next.frustumCulled = false;
    next.count = 0;
    if (mesh) {
      next.instanceMatrix.array.set(mesh.instanceMatrix.array.subarray(0, mesh.count * 16));
      next.instanceColor.array.set(mesh.instanceColor.array.subarray(0, mesh.count * 3));
      next.count = mesh.count;
      scene.remove(mesh); mesh.dispose();
    }
    scene.add(next);
    meshes[i] = next;
    return next;
  };

  return {
    /** Register a loaded model file (its root object). */
    setModel: (url, root, lumOf = partLuminance) => {
      if (models.has(url)) return;
      const lods = prepareBuildingModel(root);
      const fixed = repairDarkLods(lods, lumOf);
      if (fixed.length) console.warn(`${url}: black ${fixed.map((f) => `LOD${f.lod} ${f.material}`).join(', ')} drawn with LOD0's (rebuild the file)`);
      models.set(url, { lods, meshes: [] });
    },
    hasModel: (url) => models.has(url),
    /** Drop a model file's meshes and model (its file left memory and its textures were disposed:
     * drawn on, they come out black, H-05); the next setModel brings it back. True if it was here. */
    forget: (url) => {
      const entry = models.get(url);
      if (!entry) return false;
      entry.meshes.forEach((ms) => ms?.forEach((m) => { if (!m) return; scene.remove(m); touched.delete(m); m.dispose(); }));
      models.delete(url);
      return true;
    },
    /** The model's radius and Ground centre (modelInfo), measured once. */
    info: (url) => {
      const entry = models.get(url);
      if (!entry) return null;
      entry.info ||= modelInfo(entry.lods);
      return entry.info;
    },
    /** Start a layout drawn at this level of detail: every count goes back to 0. */
    begin: (level) => {
      lod = level;
      models.forEach((e) => e.meshes.forEach((ms) => ms?.forEach((m) => { m.count = 0; })));
      touched.clear();
    },
    /** Draw a model with this world matrix, Team cloth colour and ground tint ([r, g, b] or null);
     * `shade` darkens the whole model (a pillaged work). */
    add: (url, matrix, teamColor, tint = null, shade = 1) => {
      const entry = models.get(url);
      if (!entry) return false;
      const l = entry.lods[lod]?.length ? lod : entry.lods.findIndex((p) => p.length);
      if (l < 0) return false;
      entry.lods[l].forEach((part, i) => {
        const mesh = meshFor(entry, l, i, (entry.meshes[l]?.[i]?.count || 0) + 1);
        const n = mesh.count;
        mesh.setMatrixAt(n, tmp.multiplyMatrices(matrix, part.local));
        if (part.kind === 'team') colour.set(teamColor).multiplyScalar(1.3);
        else if (part.kind === 'ground') { if (tint) colour.setRGB(tint[0], tint[1], tint[2]); else colour.copy(part.base); }
        else colour.setRGB(1, 1, 1);
        if (shade !== 1) colour.multiplyScalar(shade);
        mesh.setColorAt(n, colour);
        mesh.count = n + 1;
        touched.add(mesh);
      });
      return true;
    },
    end: () => { touched.forEach((m) => { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }); },
    /** How many draw calls the layer makes now (meshes with instances). */
    drawCalls: () => { let n = 0; models.forEach((e) => e.meshes.forEach((ms) => ms?.forEach((m) => { if (m.count) n += 1; }))); return n; },
    dispose: () => {
      models.forEach((e) => e.meshes.forEach((ms) => ms?.forEach((m) => { scene.remove(m); m.dispose(); })));
      models.clear();
    }
  };
};
