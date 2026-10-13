// src/battle/art/workerLoads.js
// What a battle worker carries (src/assets/battle/props/worker-loads.glb, built by
// scripts/blender/build_worker_loads.py): which object of the kit stands for a resource, and where
// and how big it is drawn on a worker. Pure: no three.js, no loading, no rules. The kit is drawn
// with kitInstances.js like every other kit; nothing draws it yet (plans/art-pilot/
// md06-nodes-loads/LOG.md lists what the battle view must carry first).
/** A person's height in tiles: unitModels.js ART_UNIT_WORLD (workerLoads.test.js holds the two equal). */
export const PERSON_TILES = 0.95;

/** The kit's key in the art index (artIndex.js `workerLoads`). */
export const WORKER_LOADS_KEY = 'battle/props/worker-loads.glb';

/** The object carried on the back, and the barrow that hauls it, per resource. */
export const LOAD_OBJECTS = {
  food: { back: 'load-food', barrow: 'barrow-food' },
  wood: { back: 'load-logs', barrow: 'barrow-logs' },
  stone: { back: 'load-stone', barrow: 'barrow-stone' },
  gold: { back: 'load-gold', barrow: 'barrow-gold' }
};
export const BARROW_EMPTY = 'barrow-empty';

// Until the rules split `materials` into wood and stone, the node a worker came from says which.
const KIND_RESOURCE = { tree: 'wood', stone: 'stone', ore: 'stone', gold: 'gold', herd: 'food', cattle: 'food', fish: 'food', farm: 'food' };

/**
 * The resource a load shows: `res` when it is one of the four (food, wood, stone, gold), else the
 * node kind's (a `materials` load from a grove is wood, from a quarry stone), else null.
 */
export const loadResource = (res, nodeKind = null) => (LOAD_OBJECTS[res] ? res : KIND_RESOURCE[nodeKind] || null);

/** The kit object for a carried resource: 'load-logs' ..., or the barrow with `barrow`; null when unknown. */
export const loadObjectName = (res, { nodeKind = null, barrow = false } = {}) => {
  const r = loadResource(res, nodeKind);
  return r ? LOAD_OBJECTS[r][barrow ? 'barrow' : 'back'] : null;
};

// The kit is true size at 1 unit = 10 m, so a 1.8 m person is 0.18 units; the battle draws that
// person PERSON_TILES tiles tall (1.92 times a kit's 2.75 tiles a unit). A load rides a figure,
// so it takes the figure's scale.
const PERSON_UNITS = 0.18;
/** Battle tiles per model unit for a load or barrow with a worker: 5.278. */
export const LOAD_TILES_PER_UNIT = PERSON_TILES / PERSON_UNITS;
/** Where a `load-*` object's origin sits on the worker, in model units: up the back, behind the centre. */
export const WORKER_LOAD_BACK = { up: 0.095, behind: 0.022 };
/** How far ahead of the worker a `barrow-*` object's origin stands, in model units. */
export const WORKER_BARROW_AHEAD = 0.115;

/**
 * Where to draw a load for a worker at (x, z) on ground height y, facing `yaw` (radians, 0 = +Z,
 * as Matrix4.makeRotationY turns a kit's front): { x, y, z, yaw, scale } in tiles.
 */
export const workerLoadPlacement = (x, y, z, yaw, { barrow = false } = {}) => {
  const s = LOAD_TILES_PER_UNIT;
  const fx = Math.sin(yaw); const fz = Math.cos(yaw); // the worker's forward
  const d = barrow ? WORKER_BARROW_AHEAD * s : -WORKER_LOAD_BACK.behind * s;
  return { x: x + fx * d, y: y + (barrow ? 0 : WORKER_LOAD_BACK.up * s), z: z + fz * d, yaw, scale: s };
};
