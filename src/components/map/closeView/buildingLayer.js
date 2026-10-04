// src/components/map/closeView/buildingLayer.js
// Draws the towns' landmark buildings (buildingModels.js) with instancing: one InstancedMesh per
// model file, level of detail and material, shared by every town on screen, so the draw calls grow
// with the kinds of landmark in view and not with the number of towns (a phone sees a dozen towns
// at once). A model's Team cloth takes each town's colour and its Ground the town's ground tint
// through the instance colour, as instanceTownAsset does for a cloned town.
import { BufferGeometry, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, DynamicDrawUsage } from 'three';

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

const START = 16;

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
    setModel: (url, root) => { if (!models.has(url)) models.set(url, { lods: prepareBuildingModel(root), meshes: [] }); },
    hasModel: (url) => models.has(url),
    /** Start a layout drawn at this level of detail: every count goes back to 0. */
    begin: (level) => {
      lod = level;
      models.forEach((e) => e.meshes.forEach((ms) => ms?.forEach((m) => { m.count = 0; })));
      touched.clear();
    },
    /** Draw a model with this world matrix, Team cloth colour and ground tint ([r, g, b] or null). */
    add: (url, matrix, teamColor, tint = null) => {
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
