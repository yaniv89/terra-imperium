// src/components/map/closeView/townAssets.js
// Artist town models (plans/model-brief-for-claude.md) that take the place of the procedural town
// for an (age, size). A file src/assets/map/towns/{age}-town-{size}-{variant}.glb holds one root
// object with LOD0, LOD1, LOD2 children sharing one atlas (materials Town, Ground and Team). The
// close view loads a file the first time a town of that age and size is on screen, clones it per
// town (geometry and textures shared), shows the LOD for the zoom and tints Team in the owner's
// colour. Until a file arrives, and for any (age, size) without one, the procedural town stays.
// The age's shared file, src/assets/map/shared/shared-{age}.glb, adds the rest with the town's
// transform: a capital's palace in the free centre (palace-small for a small town, palace for a
// medium or big one), the wall ring of the town's size round a town with a defense building, and
// the colony camp that stands in place of a town on an outpost.
import { Color } from 'three';
import { loadGltf } from '../../../battle/render/gltfUnitLoader';

// { '../../../assets/map/towns/bronze-town-small-a.glb': '/terra-imperium/assets/bronze-town-small-a-abc123.glb' }
const FILES = import.meta.glob('../../../assets/map/towns/*.glb', { query: '?url', import: 'default', eager: true });
const BY_KEY = {};
Object.entries(FILES).forEach(([path, url]) => {
  const m = path.match(/\/([a-z]+)-town-(small|medium|big)-([ab])\.glb$/);
  if (m) (BY_KEY[`${m[1]}:${m[2]}`] ||= {})[m[3]] = url;
});

// { bronze: '/terra-imperium/assets/shared-bronze-abc123.glb' }
const SHARED_FILES = import.meta.glob('../../../assets/map/shared/shared-*.glb', { query: '?url', import: 'default', eager: true });
const SHARED_BY_AGE = {};
Object.entries(SHARED_FILES).forEach(([path, url]) => {
  const m = path.match(/\/shared-([a-z]+)\.glb$/);
  if (m) SHARED_BY_AGE[m[1]] = url;
});
/** The age's shared file (palaces, walls, camps, fields), or null. */
export const sharedAssetUrl = (ageId) => SHARED_BY_AGE[ageId] || null;
/** The palace a capital of this town size stands on its free centre. */
export const palaceFor = (tierId) => (tierId === 'small' ? 'palace-small' : 'palace');
/** The wall ring just outside a town of this size (one gate at the front). */
export const wallsFor = (tierId) => `walls-${tierId === 'big' || tierId === 'medium' ? tierId : 'small'}`;
/** The shared object an outpost shows instead of a town. */
export const COLONY_CAMP = 'colony-camp';
/** An outpost (a settler's new city that is still growing) or a colony with no owner yet. */
export const isCamp = (region) => !!region && (!!region.outpost || (!region.owner && !!region.colony));

// Until the regional kits arrive (art spec section 3b), the two variants carry two traditions:
// a is Mesopotamian, b is Egyptian. Nations of those lands get their own; everyone else mixes
// both by city so neighbours differ.
export const TOWN_VARIANT_BY_NATION = {
  eg: 'b', sd: 'b', ss: 'b', ly: 'b', er: 'b',
  iq: 'a', sy: 'a', kw: 'a', ir: 'a', jo: 'a', il: 'a', ps: 'a', lb: 'a', tr: 'a', sa: 'a', bh: 'a', qa: 'a', ae: 'a', om: 'a', ye: 'a'
};

/** The model for a town of this age and size, or null. The nation's tradition picks the variant
 * when one is set; otherwise `seed` picks a or b when both exist. */
export const townAssetUrl = (ageId, tierId, seed = 0, nationId = null) => {
  const v = BY_KEY[`${ageId}:${tierId}`];
  if (!v) return null;
  const pinned = nationId && v[TOWN_VARIANT_BY_NATION[nationId]];
  if (pinned) return pinned;
  if (v.a && v.b) return seed % 2 ? v.b : v.a;
  return v.a || v.b;
};

/** The level of detail the brief assigns to a zoom k: LOD2 below 20, LOD1 below 40, LOD0 above. */
export const lodForZoom = (k) => (k < 20 ? 2 : k < 40 ? 1 : 0);

// A level-of-detail node: LOD0..LOD2, or LOD0001 for a file's second object (Blender's LOD0.001
// after three.js strips the dot from node names).
const LOD_NAME = /^LOD(\d)/;
const lodOf = (o) => { const m = LOD_NAME.exec(o.name || ''); return m ? Number(m[1]) : null; };

const files = new Map(); // url -> Promise<{ [object name]: Object3D }>
/** Load a model file once; resolves to its objects (every node holding LOD children), by name. */
export const loadAssetObjects = (url, load = loadGltf) => {
  if (!files.has(url)) {
    files.set(url, load(url).then((gltf) => {
      const out = {};
      gltf.scene.traverse((o) => { if (lodOf(o) === null && o.children.some((c) => lodOf(c) === 0)) out[o.name] = o; });
      if (!Object.keys(out).length) throw new Error(`${url}: no object with LOD children`);
      Object.values(out).forEach((root) => root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }));
      return out;
    }).catch((e) => { files.delete(url); throw e; }));
  }
  return files.get(url);
};
/** Load a town file once; resolves to its root object (the node holding LOD0..LOD2). */
export const loadTownAsset = (url, load = loadGltf) => loadAssetObjects(url, load).then((objs) => Object.values(objs)[0]);

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

/** Show one LOD of an instance (and of anything placed in it, such as a palace). */
export const showLod = (inst, lod) => {
  inst.traverse((o) => { const l = lodOf(o); if (l !== null) o.visible = l === lod; });
};
