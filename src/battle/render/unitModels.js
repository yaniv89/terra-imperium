// src/battle/render/unitModels.js
// Which soldiers use an artist's GLB instead of their procedural model. Drop a file into
// src/assets/units/ and it is picked up at build time (see that folder's README):
//   {age}-{class}.glb   one age's model, e.g. bronze-infantry.glb (a hoplite), modern-infantry.glb
//   {class}.glb         every age of that class without its own file
//   {same name}.json    optional bake options: { "rotateY": 3.1416, "quadruped": true,
//                       "restClip": "Idle", "height": 1.0, "tags": { "team": "Tunic|Cloak" } }
//   {age}-{class}.json  with a "base": a RECIPE — one archetype from _src/ dressed for that age and
//                       class (weapons, a mount, a crew…), see unitComposer.js. This is how
//                       scripts/fetch-models.js fills the whole matrix from a few CC0 models.
//   _src/*.glb          archetypes and parts that recipes refer to by name
//   {age}-general.glb   the age's general (a mounted commander; Modern: a command car), drawn
//                       beside the standard of every squad with a commander (general.glb: every age);
//                       without it a general is only the standard
//   {age}-raider.glb, {age}-mercenary.glb  the irregulars' looks (LOOK_CLASS): a raid party's
//                       cavalry squads and a hired band's infantry squads draw these instead
//   signature/{model}.glb  a people's signature unit (data/signatureUnits.js: its age, role and
//                       model id): replaces that people's base unit of the role in that age
// Before a battle opens, preloadUnitModels() loads just the models that battle needs (in parallel,
// each once per session), bakes and registers them; anything that fails or is too slow falls back
// to the procedural model, so a bad or missing file can never block a battle.
import { loadUnitModel } from './gltfUnitLoader';
import { composeUnitModel } from './unitComposer';
import { registerSoldierGeometry, hasSoldierOverride, getProceduralSoldierGeometry, MODEL_SCALE } from './soldierFactory';
import { soldierLodReady } from './soldierLod';
import { trainableRoles } from '../data/economy';
import { UNIT_ROSTER } from '../../data/unitClasses';
import { ART } from '../art/artFiles';
import { signatureUnitFor, signatureKey, SIGNATURE_UNITS, QUADRUPED_RIGS } from '../../data/signatureUnits';
import { peopleForNationId } from '../../data/peoples';
import { AGE_ORDER } from '../../data/ages';

// { '../../assets/units/bronze-infantry.glb': '/terra-imperium/assets/bronze-infantry-abc123.glb' }
const FILES = import.meta.glob('../../assets/units/*.{glb,gltf}', { query: '?url', import: 'default', eager: true });
const OPTIONS = import.meta.glob('../../assets/units/*.json', { import: 'default', eager: true });
const SOURCES = import.meta.glob('../../assets/units/_src/*.{glb,gltf}', { query: '?url', import: 'default', eager: true });
const SIGNATURE_OPTIONS = import.meta.glob('../../assets/units/signature/*.json', { import: 'default', eager: true });

const baseName = (path) => path.split('/').pop().replace(/\.(glb|gltf|json)$/i, '');
const BY_NAME = Object.fromEntries(Object.entries(FILES).map(([path, url]) => [baseName(path), url]));
const OPTS_BY_NAME = Object.fromEntries(Object.entries(OPTIONS).map(([path, o]) => [baseName(path), o]));
const SOURCE_BY_NAME = Object.fromEntries(Object.entries(SOURCES).map(([path, url]) => [baseName(path), url]));
export const resolveSource = (name) => SOURCE_BY_NAME[name] || BY_NAME[name] || null;
const isRecipe = (name) => !!OPTS_BY_NAME[name]?.base;

// JSON can't hold RegExps: tag and clip patterns arrive as strings.
const reviveOptions = (o = {}) => ({
  ...o,
  ...(typeof o.restClip === 'string' && o.restClip !== 'bind' ? { restClip: new RegExp(o.restClip, 'i') } : {}),
  ...(o.tags ? { tags: Object.fromEntries(Object.entries(o.tags).map(([k, v]) => [k, new RegExp(v, 'i')])) } : {})
});

// An explicit {age}-{class}.glb wins, then an {age}-{class} recipe, then the class-wide file/recipe.
export const findUnitModel = (ageId, classId) => {
  for (const name of [`${ageId}-${classId}`, classId]) {
    if (OPTS_BY_NAME[name]?.enabled === false) continue;
    if (BY_NAME[name]) return { name, url: BY_NAME[name], options: reviveOptions(OPTS_BY_NAME[name]) };
    if (isRecipe(name) && resolveSource(OPTS_BY_NAME[name].base)) return { name, recipe: OPTS_BY_NAME[name], url: `recipe:${name}` };
  }
  return null;
};

/** The irregular looks and the one class each replaces (plans/ART-MODELS-PLAN.md 4.3). */
export const LOOK_CLASS = { raider: 'cavalry', mercenary: 'infantry' };
/** A setup unit's (or a sim squad's) irregular look: 'mercenary', 'raider' or null. A raid or a sack's
 * attackers are the raiders. */
export const unitLookOf = (u, setup = null, side = -1) => (u?.mercenary ? 'mercenary'
  : u?.raidOf || u?.raider || (side === 0 && (setup?.battleType === 'raid' || setup?.battleType === 'sack')) ? 'raider' : null);
/** The soldier layer key of a look (null: none), registered under the age like the general. */
export const lookKey = (look, classId) => (look && LOOK_CLASS[look] === classId ? look : null);

/** A side's general model (`{age}-general.glb`, else `general.glb`), or null (the standard only). */
export const findGeneralModel = (ageId) => findUnitModel(ageId, 'general');

const SIG_OPTS = Object.fromEntries(Object.entries(SIGNATURE_OPTIONS).map(([path, o]) => [baseName(path), o]));
/** The people's signature model for this age and role (any role, vehicles included), or null (the
 * base unit): src/assets/units/signature/<model>.glb with the roster's model id. */
export const findSignatureModel = (peopleId, ageId, classId, { table = SIGNATURE_UNITS, art = ART, options = SIG_OPTS } = {}) => {
  const entry = signatureUnitFor(peopleId, ageId, classId, table);
  if (!entry) return null;
  const ref = art.signature(entry.model);
  const opts = options[entry.model];
  if (!ref || opts?.enabled === false) return null;
  return { name: `signature/${entry.model}`, url: ref.url, options: { quadruped: QUADRUPED_RIGS.includes(entry.rig), ...reviveOptions(opts) } };
};

// Every (age, class) a battle setup will put on the field (including reinforcements).
export const battleModelPairs = (setup) => {
  const seen = new Set();
  (setup?.sides || []).forEach((sd) => [...(sd.units || []), ...(sd.reinforcements || [])].forEach((u) => {
    if (u?.classId && u.classId !== 'naval') seen.add(`${u.ageId || sd.ageId}:${u.classId}`);
  }));
  // A general's guard (sim/world.js spawnGenerals) is a cavalry squad, also in an army with no cavalry.
  (setup?.sides || []).forEach((sd) => {
    if ([...(sd.units || []), ...(sd.reinforcements || [])].some((u) => u?.commanderId)) seen.add(`${sd.ageId}:cavalry`);
  });
  // With a battle economy every class the side can train (workers too) may take the field.
  if (setup?.economy) (setup.sides || []).forEach((sd) => trainableRoles(sd.ageId).forEach((c) => seen.add(`${sd.ageId}:${c}`)));
  return [...seen].map((k) => k.split(':'));
};

// The extra models a battle draws beside its base units: the generals of sides with commanders and
// the signature units of the sides' peoples. [{ ageId, key, classId, model }]: registered under
// (ageId, key), baked as tall as the procedural `classId`.
export const battleExtraModels = (setup, { findGeneral = findGeneralModel, findSignature = findSignatureModel, findLook = findUnitModel } = {}) => {
  const out = []; const seen = new Set();
  const push = (ageId, key, classId, model) => { if (model && !seen.has(`${ageId}:${key}`)) { seen.add(`${ageId}:${key}`); out.push({ ageId, key, classId, model }); } };
  (setup?.sides || []).forEach((sd) => {
    const units = [...(sd.units || []), ...(sd.reinforcements || [])];
    if (units.some((u) => u?.commanderId)) push(sd.ageId, 'general', 'cavalry', findGeneral(sd.ageId));
    const side = setup.sides.indexOf(sd);
    units.forEach((u) => { const key = lookKey(unitLookOf(u, setup, side), u?.classId); if (key) push(sd.ageId, key, u.classId, findLook(sd.ageId, key)); });
    const people = peopleForNationId(sd.nationId);
    if (!people) return;
    const classes = new Set(units.map((u) => u?.classId).filter(Boolean));
    if (setup.economy) trainableRoles(sd.ageId).forEach((c) => classes.add(c));
    classes.forEach((c) => push(sd.ageId, signatureKey(c, people), c, findSignature(people, sd.ageId, c)));
  });
  return out;
};

// True when some model this battle needs still has to be downloaded.
export const needsUnitModels = (setup, extras = battleExtraModels) => battleModelPairs(setup).some(([a, c]) => findUnitModel(a, c) && !hasSoldierOverride(a, c))
  || extras(setup).some((e) => !hasSoldierOverride(e.ageId, e.key));

// The art set (src/assets/units, signature/) is built on one rig at one scale: a person stands
// about 1 unit, a horse's back about 0.75 and its rider's head about 1.37. Every figure is drawn at
// that scale (ART_UNIT_WORLD tiles per unit, after the renderer's MODEL_SCALE for its class), so a
// man stands shoulder-high to a horse's back in every age. Fitting each model to the procedural
// model's height instead (which counts a pike, a lance or a banner) blew the Kingdoms spearman up
// to twice a horseman's size. Only aircraft and ships (air, naval) and files whose JSON gives a
// `height` keep that fit.
// Machines on land are drawn at the same scale as the men beside them (MD09, MD10: only machines
// get bigger, never their crews): a siege engine, a gun, a tank or a truck is authored in Blender
// at about two thirds of its real size against a 1.8 m person (the user's cap: big enough to read
// as a machine beside its crew, small enough for the ground between squads), its crew at 1.0 like
// every soldier, and the whole file is drawn at ART_UNIT_WORLD. Fitting such a file to a height
// shrank the crew with the machine (the ballista and cannon crews stood half as tall as the
// infantry). Its JSON carries `footprint`: [width, length] in authored units, crew included, which
// machineLayout turns into the squad's spacing and how many machines the squad draws.
// Camels and elephants the same way: no fitted height, the animal at its true size (a dromedary
// about 1.9 m at the hump, a war elephant about 2.8 m at the shoulder), its riders at 1.0.
export const ART_UNIT_WORLD = 0.95;
const FIT_TO_HEIGHT = new Set(['air', 'naval']);
/** The ground a squad's drawn block of machines may cover (tiles). The sim deploys squads 3 tiles
 * apart along a line and the two lines 4 tiles apart (sim/world.js spawnSides), so a block wider
 * than about 3 tiles runs into the squad beside it and a deeper one into the line behind. A
 * trebuchet, howitzer or tank fills that ground alone: such a squad draws one machine; guns and
 * ballistas their three, two abreast and one behind. */
export const MACHINE_BLOCK = Object.freeze({ width: 2.9, depth: 5.2, gap: 0.3 });
/** How a squad of machines is drawn (drawing only, the sim never sees figures): the gap between
 * machines side by side (`spacing`) and between rows (`rowGap`), tiles; at most `cols` abreast and
 * `figures` machines, as many of the role's `soldiers` as fit MACHINE_BLOCK (at least one).
 * `footprint`: [width, length] of one machine with its crew, authored units. Null without one. */
export const machineLayout = (footprint, soldiers, baseSpacing = 0) => {
  if (!Array.isArray(footprint) || !(footprint[0] > 0) || !(footprint[1] > 0)) return null;
  const spacing = Math.max(baseSpacing, footprint[0] * ART_UNIT_WORLD + MACHINE_BLOCK.gap);
  const rowGap = Math.max(baseSpacing, footprint[1] * ART_UNIT_WORLD + MACHINE_BLOCK.gap);
  const across = Math.max(1, Math.floor((MACHINE_BLOCK.width + MACHINE_BLOCK.gap) / spacing));
  const rows = Math.max(1, Math.floor((MACHINE_BLOCK.depth + MACHINE_BLOCK.gap) / rowGap));
  const figures = Math.max(1, Math.min(soldiers, across * rows));
  return { spacing, rowGap, cols: Math.min(across, figures), figures };
};
/** The footprint of the model a squad draws ([width, length], authored units), or null. */
export const footprintOf = (model) => model?.options?.footprint || null;
export const POLEARM_M = { spear: 2.5, pike: 5, lance: 3.5 };
/** Bake options for a model registered under `regKey` (a class, 'general', a look or signature key). */
export const bakeOptionsFor = (ageId, regKey, classId, model) => {
  const opts = { quadruped: classId === 'cavalry', ...model.options };
  if (opts.height == null) {
    const proc = getProceduralSoldierGeometry(ageId, classId);
    opts.height = Math.round((proc.boundingBox.max.y - proc.boundingBox.min.y) * 1000) / 1000;
    if (!FIT_TO_HEIGHT.has(classId) && model.options.scale == null) {
      const drawn = (regKey === 'general' ? MODEL_SCALE.general : MODEL_SCALE[classId]) || 0.62;
      opts.scale = Math.round((ART_UNIT_WORLD / drawn) * 1e4) / 1e4;
    }
  }
  // The base line's polearms at true length against a 1.8 m man: a spear 2.5 m, the Pikemen's pike
  // 5 m, a horseman's lance 3.5 m (a signature unit keeps its own weapon).
  if (opts.polearm == null && regKey === classId) {
    if (classId === 'infantry') opts.polearm = /pike/i.test(UNIT_ROSTER[ageId]?.infantry?.name || '') ? POLEARM_M.pike : POLEARM_M.spear;
    else if (classId === 'cavalry') opts.polearm = POLEARM_M.lance;
  }
  return opts;
};

const inflight = new Map(); // `${url}@${height or scale}` → Promise<geometry>
// The page's `&noclips`: units keep the procedural rig even when their file has clips (I219 perf A/B).
// (read when a battle loads its models: the app may have tidied the address bar by then, so a test
// can also set window.__noClips)
const noClips = () => typeof window !== 'undefined' && (!!window.__noClips || /[?&]noclips(&|$|=)/.test(window.location?.search || ''));
const withTimeout = (p, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

/**
 * Load, bake and register the GLB models a battle needs. Resolves (never rejects) with
 * { loaded: [...names], failed: [{ name, error }] }; failures keep the procedural model.
 */
export const preloadUnitModels = async (setup, { timeoutMs = 8000, load = loadUnitModel, compose = composeUnitModel, find = findUnitModel, extras = battleExtraModels } = {}) => {
  const loaded = []; const failed = [];
  // the base units by (age, class), then the generals and signature units under their own keys
  const jobs = [
    ...battleModelPairs(setup).map(([ageId, classId]) => ({ ageId, key: classId, classId, model: hasSoldierOverride(ageId, classId) ? null : find(ageId, classId) })),
    ...extras(setup).filter((e) => !hasSoldierOverride(e.ageId, e.key))
  ];
  await Promise.all(jobs.map(async ({ ageId, key: regKey, classId, model }) => {
    if (!model) return;
    const key = model.recipe ? `${model.url}@${ageId}` : null;
    if (model.recipe) {
      if (!inflight.has(key)) inflight.set(key, compose(model.recipe, { resolve: resolveSource, ageId }).then((r) => r.geometry));
    } else {
      // People, mounts and land machines at the art set's own scale; aircraft and ships as tall as
      // the procedural model.
      const opts = bakeOptionsFor(ageId, regKey, classId, model);
      if (noClips()) opts.clips = null; // `&noclips`: the procedural rig for every unit (before / after checks)
      model.key = `${model.url}@${opts.scale ? `x${opts.scale}` : opts.height}`;
      if (!inflight.has(model.key)) inflight.set(model.key, load(model.url, opts).then((r) => r.geometry));
    }
    const k = key || model.key;
    try {
      const geo = await withTimeout(inflight.get(k), timeoutMs);
      registerSoldierGeometry(ageId, regKey, geo);
      loaded.push(`${ageId}-${regKey}`);
    } catch (error) {
      inflight.delete(k);
      failed.push({ name: model.name, error: String(error?.message || error) });
      console.warn(`[units] ${model.name}: ${error?.message || error} — using the procedural model`);
    }
  }));
  await soldierLodReady(); // the detail levels are built from these when the battlefield opens
  return { loaded, failed };
};

/**
 * The same for one (age, class) outside a battle: the map's close view draws an army with the
 * battle's own soldier. Resolves true when the artist's model is registered (now or already),
 * false when that unit keeps the procedural model (no file, or it failed to load).
 */
export const preloadSoldierModel = async (ageId, classId, deps = {}) => {
  if (hasSoldierOverride(ageId, classId)) return true;
  if (!(deps.find || findUnitModel)(ageId, classId)) return false;
  const r = await preloadUnitModels({ sides: [{ ageId, units: [{ classId }] }] }, { extras: () => [], ...deps });
  return r.loaded.length > 0;
};

// The settler party (src/assets/units/{age}-settler.glb, scripts/blender/build_units_settler.py): a
// cart or wagon with its animal and the family walking beside it, or a small truck. Drawn only by
// the map's close view, through the soldier layer under the key 'settler', baked at the baggage
// train's scale (class support: the same rigs and the same people). One file per age band: an age
// takes the latest band at or below it.
export const SETTLER_KEY = 'settler';
/** The settler model for an owner in this age: { name, url, options, ageId (the band's age) } or null. */
export const findSettlerModel = (ageId, find = findUnitModel) => {
  for (let i = AGE_ORDER.indexOf(ageId); i >= 0; i--) {
    const m = find(AGE_ORDER[i], SETTLER_KEY);
    if (m) return { ...m, ageId: AGE_ORDER[i] };
  }
  return null;
};
/**
 * Load and register the settler model of this age's band. Resolves to the band's age once the
 * model is registered under (that age, 'settler'), or null (no file, or it failed: the map keeps
 * its settler sprite).
 */
export const preloadSettlerModel = async (ageId, deps = {}) => {
  const model = findSettlerModel(ageId, deps.find);
  if (!model) return null;
  if (hasSoldierOverride(model.ageId, SETTLER_KEY)) return model.ageId;
  const r = await preloadUnitModels({ sides: [] }, { extras: () => [{ ageId: model.ageId, key: SETTLER_KEY, classId: 'support', model }], ...deps });
  return r.loaded.length > 0 ? model.ageId : null;
};

/**
 * A people's signature soldier outside a battle (the map's close view), registered under
 * signatureKey(classId, peopleId). Resolves true when registered, false when the people has none
 * for this age and role (or it failed: the base unit draws).
 */
export const preloadSignatureModel = async (peopleId, ageId, classId, deps = {}) => {
  const key = signatureKey(classId, peopleId);
  if (hasSoldierOverride(ageId, key)) return true;
  const model = (deps.findSignature || findSignatureModel)(peopleId, ageId, classId);
  if (!model) return false;
  const r = await preloadUnitModels({ sides: [] }, { extras: () => [{ ageId, key, classId, model }], ...deps });
  return r.loaded.length > 0;
};
