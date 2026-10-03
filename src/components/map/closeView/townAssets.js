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
// A file may carry a regional kit after the variant: bronze-town-small-a-europe.glb is layout a
// built with the Europe kit (art spec section 3b).
const FILES = import.meta.glob('../../../assets/map/towns/*.glb', { query: '?url', import: 'default', eager: true });
const BY_KEY = {}; // 'bronze:small' -> { base: { a, b }, europe: { a, b }, ... }
Object.entries(FILES).forEach(([path, url]) => {
  const m = path.match(/\/([a-z]+)-town-(small|medium|big)-([ab])(?:-([a-z]+))?\.glb$/);
  if (m) ((BY_KEY[`${m[1]}:${m[2]}`] ||= {})[m[4] || 'base'] ||= {})[m[3]] = url;
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
// ---- fields ------------------------------------------------------------------------------------
// The age's field-1 to field-4 (crop, orchard, pasture, the age's own field) lie round a town on
// a ring outside its ground and wall, and stand in for the farm, pasture and plantation works.
const FIELD_ORDER = ['field-1', 'field-4', 'field-2', 'field-1', 'field-3', 'field-4'];
// The ring's radius per town size, model units: the wall ring's outer edge plus half a field.
const FIELD_RING = { small: 3.25, medium: 4.35, big: 5.45 };
/** Field models for an improvement, or null (the procedural work stays). */
export const FIELDS_FOR_WORK = { farm: ['field-1', 'field-4'], pasture: ['field-3'], plantation: ['field-2'] };
/** How many fields a town lays out: two, plus one per food building tier, at most six. */
export const fieldCount = (region) => Math.max(2, Math.min(6, 3 + (region?.buildings?.categories?.food ?? -1)));
/**
 * The fields round a town: [{ name, x, z, yaw }] in the town's model space (glTF: x east, z
 * south, yaw about y). Spread over the ring with the front (south, where the gate is) left
 * open, turned to run along the ring, the first slot and the kinds picked by `seed`.
 */
export const fieldsAround = (tierId, seed = 0, count = 2) => {
  const r = FIELD_RING[tierId] || FIELD_RING.small;
  const n = Math.max(0, Math.min(6, count));
  const out = [];
  const arc = 290; // degrees, from the south-east round the north to the south-west
  const shift = ((seed % 7) - 3) * 2;
  for (let i = 0; i < n; i++) {
    const deg = -55 + shift + (arc * (i + 0.5)) / n + ((seed >> 3) % 3) - 1;
    const a = (deg * Math.PI) / 180;
    out.push({ name: FIELD_ORDER[(seed + i) % FIELD_ORDER.length], x: r * Math.cos(a), z: -r * Math.sin(a), yaw: a + Math.PI / 2 });
  }
  return out;
};

/** The shared object an outpost shows instead of a town. */
export const COLONY_CAMP = 'colony-camp';
/** An outpost (a settler's new city that is still growing) or a colony with no owner yet. */
export const isCamp = (region) => !!region && (!!region.outpost || (!region.owner && !!region.colony));

// Each age's two layouts carry two traditions until every region has its kit (art spec 3b).
// Bronze: a is Mesopotamian, b Egyptian; the Nile builds b, the Levant a. Classical: a is Roman,
// b Han; East and South-East Asia and Mongolia build b. Kingdoms: a is European, b Abbasid and
// Andalusian; the Nile, the Levant and the Maghreb build b. Elsewhere, and in the Gunpowder and
// Modern Ages, the city's seed mixes both so neighbours differ.
export const TOWN_VARIANT_BY_AGE = {
  bronze: { nile: 'b', levant: 'a' },
  classical: { sinic: 'b', monsoon: 'b', steppe: 'b', others: 'a' },
  kingdoms: { nile: 'b', levant: 'b', maghreb: 'b', others: 'a' }
};

/** The variant ('a' or 'b') a city builds in this age on land of this style. */
export const townVariant = (ageId, style, seed = 0) => {
  const rule = TOWN_VARIANT_BY_AGE[ageId];
  return (rule && (rule[style] || rule.others)) || (seed % 2 ? 'b' : 'a');
};

/** The model for a town of this age and size, or null: the layout the land's tradition (or the
 * seed) picks, built with the land's regional kit when that file exists, else the age's base kit.
 * Falls back to the other layout when only one exists. */
export const townAssetUrl = (ageId, tierId, seed = 0, style = null) => {
  const kits = BY_KEY[`${ageId}:${tierId}`];
  if (!kits) return null;
  const v = townVariant(ageId, style, seed);
  const pick = (k) => k && (k[v] || k.a || k.b);
  return pick(style && kits[style]) || pick(kits.base) || null;
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
