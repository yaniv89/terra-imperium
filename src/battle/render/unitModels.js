// src/battle/render/unitModels.js
// Which soldiers use an artist's GLB instead of their procedural model. Drop a file into
// src/assets/units/ and it is picked up at build time (see that folder's README):
//   {age}-{class}.glb   one age's model, e.g. bronze-infantry.glb (a hoplite), modern-infantry.glb
//   {class}.glb         every age of that class without its own file
//   {same name}.json    optional bake options: { "rotateY": 3.1416, "quadruped": true,
//                       "restClip": "Idle", "height": 1.0, "tags": { "team": "Tunic|Cloak" } }
// Before a battle opens, preloadUnitModels() loads just the models that battle needs (in parallel,
// each once per session), bakes and registers them; anything that fails or is too slow falls back
// to the procedural model, so a bad or missing file can never block a battle.
import { loadUnitModel } from './gltfUnitLoader';
import { registerSoldierGeometry, hasSoldierOverride, getProceduralSoldierGeometry } from './soldierFactory';

// { '../../assets/units/bronze-infantry.glb': '/terra-imperium/assets/bronze-infantry-abc123.glb' }
const FILES = import.meta.glob('../../assets/units/*.{glb,gltf}', { query: '?url', import: 'default', eager: true });
const OPTIONS = import.meta.glob('../../assets/units/*.json', { import: 'default', eager: true });

const baseName = (path) => path.split('/').pop().replace(/\.(glb|gltf|json)$/i, '');
const BY_NAME = Object.fromEntries(Object.entries(FILES).map(([path, url]) => [baseName(path), url]));
const OPTS_BY_NAME = Object.fromEntries(Object.entries(OPTIONS).map(([path, o]) => [baseName(path), o]));

// JSON can't hold RegExps: tag and clip patterns arrive as strings.
const reviveOptions = (o = {}) => ({
  ...o,
  ...(typeof o.restClip === 'string' && o.restClip !== 'bind' ? { restClip: new RegExp(o.restClip, 'i') } : {}),
  ...(o.tags ? { tags: Object.fromEntries(Object.entries(o.tags).map(([k, v]) => [k, new RegExp(v, 'i')])) } : {})
});

export const findUnitModel = (ageId, classId) => {
  const name = BY_NAME[`${ageId}-${classId}`] ? `${ageId}-${classId}` : BY_NAME[classId] ? classId : null;
  return name ? { name, url: BY_NAME[name], options: reviveOptions(OPTS_BY_NAME[name]) } : null;
};

// Every (age, class) a battle setup will put on the field (including reinforcements).
export const battleModelPairs = (setup) => {
  const seen = new Set();
  (setup?.sides || []).forEach((sd) => [...(sd.units || []), ...(sd.reinforcements || [])].forEach((u) => {
    if (u?.classId && u.classId !== 'naval') seen.add(`${u.ageId || sd.ageId}:${u.classId}`);
  }));
  return [...seen].map((k) => k.split(':'));
};

// True when some model this battle needs still has to be downloaded.
export const needsUnitModels = (setup) => battleModelPairs(setup).some(([a, c]) => findUnitModel(a, c) && !hasSoldierOverride(a, c));

const inflight = new Map(); // `${url}@${height}` → Promise<geometry>
const withTimeout = (p, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

/**
 * Load, bake and register the GLB models a battle needs. Resolves (never rejects) with
 * { loaded: [...names], failed: [{ name, error }] }; failures keep the procedural model.
 */
export const preloadUnitModels = async (setup, { timeoutMs = 8000, load = loadUnitModel } = {}) => {
  const loaded = []; const failed = [];
  await Promise.all(battleModelPairs(setup).map(async ([ageId, classId]) => {
    if (hasSoldierOverride(ageId, classId)) return;
    const model = findUnitModel(ageId, classId);
    if (!model) return;
    // Stand exactly as tall as the procedural model it replaces, so squads keep their spacing.
    const proc = getProceduralSoldierGeometry(ageId, classId);
    const height = model.options.height ?? Math.round((proc.boundingBox.max.y - proc.boundingBox.min.y) * 1000) / 1000;
    const key = `${model.url}@${height}`;
    if (!inflight.has(key)) inflight.set(key, load(model.url, { quadruped: classId === 'cavalry', ...model.options, height }).then((r) => r.geometry));
    try {
      const geo = await withTimeout(inflight.get(key), timeoutMs);
      registerSoldierGeometry(ageId, classId, geo);
      loaded.push(`${ageId}-${classId}`);
    } catch (error) {
      inflight.delete(key);
      failed.push({ name: model.name, error: String(error?.message || error) });
      console.warn(`[units] ${model.name}: ${error?.message || error} — using the procedural model`);
    }
  }));
  return { loaded, failed };
};
