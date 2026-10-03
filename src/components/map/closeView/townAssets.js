// src/components/map/closeView/townAssets.js
// Artist town models (plans/model-brief-for-claude.md) that take the place of the procedural town
// for an (age, size). A file src/assets/map/towns/{age}-town-{size}-{variant}.glb holds one root
// object with LOD0, LOD1, LOD2 children sharing one atlas (materials Town, Ground and Team). The
// close view loads a file the first time a town of that age and size is on screen, clones it per
// town (geometry and textures shared), shows the LOD for the zoom and tints Team in the owner's
// colour. Until a file arrives, and for any (age, size) without one, the procedural town stays.
import { Color } from 'three';
import { loadGltf } from '../../../battle/render/gltfUnitLoader';

// { '../../../assets/map/towns/bronze-town-small-a.glb': '/terra-imperium/assets/bronze-town-small-a-abc123.glb' }
const FILES = import.meta.glob('../../../assets/map/towns/*.glb', { query: '?url', import: 'default', eager: true });
const BY_KEY = {};
Object.entries(FILES).forEach(([path, url]) => {
  const m = path.match(/\/([a-z]+)-town-(small|medium|big)-([ab])\.glb$/);
  if (m) (BY_KEY[`${m[1]}:${m[2]}`] ||= {})[m[3]] = url;
});

/** The model for a town of this age and size, or null. `seed` picks variant a or b when both exist. */
export const townAssetUrl = (ageId, tierId, seed = 0) => {
  const v = BY_KEY[`${ageId}:${tierId}`];
  if (!v) return null;
  if (v.a && v.b) return seed % 2 ? v.b : v.a;
  return v.a || v.b;
};

/** The level of detail the brief assigns to a zoom k: LOD2 below 20, LOD1 below 40, LOD0 above. */
export const lodForZoom = (k) => (k < 20 ? 2 : k < 40 ? 1 : 0);

const roots = new Map(); // url -> Promise<Object3D>
/** Load a town file once; resolves to its root object (the node holding LOD0..LOD2). */
export const loadTownAsset = (url, load = loadGltf) => {
  if (!roots.has(url)) {
    roots.set(url, load(url).then((gltf) => {
      let root = null;
      gltf.scene.traverse((o) => { if (!root && o.children.some((c) => c.name === 'LOD0')) root = o; });
      if (!root) throw new Error(`${url}: no object with LOD children`);
      root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      return root;
    }).catch((e) => { roots.delete(url); throw e; }));
  }
  return roots.get(url);
};

const teamMaterials = new Map(); // `${uuid}|${color}` -> material
/** A town instance: shares the file's geometry and textures; Team takes `teamColor`. */
export const instanceTownAsset = (root, teamColor) => {
  const inst = root.clone(true);
  inst.position.set(0, 0, 0);
  inst.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      if (!m || m.name !== 'Team') return m;
      const key = `${m.uuid}|${teamColor}`;
      if (!teamMaterials.has(key)) {
        const t = m.clone();
        // the cloth is authored mid grey (#BFBFBF), so lift the tint to land on the nation colour
        t.color = new Color(teamColor).multiplyScalar(1.3);
        teamMaterials.set(key, t);
      }
      return teamMaterials.get(key);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  return inst;
};

/** Show one LOD of an instance. */
export const showLod = (inst, lod) => {
  const want = `LOD${lod}`;
  inst.children.forEach((c) => { c.visible = c.name === want; });
};
