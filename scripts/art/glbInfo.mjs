// scripts/art/glbInfo.mjs
// Reads the JSON chunk of a binary glTF file (no dependencies), for the model packing script
// and its test.
import { closeSync, existsSync, openSync, readdirSync, readSync } from 'node:fs';
import { join } from 'node:path';

/** The glTF JSON of a .glb file (reads only the header and the JSON chunk, not the buffers). */
export const readGlbJson = (path) => {
  const fd = openSync(path, 'r');
  try {
    const head = Buffer.alloc(20);
    readSync(fd, head, 0, 20, 0);
    if (head.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a binary glTF file`);
    const json = Buffer.alloc(head.readUInt32LE(12));
    readSync(fd, json, 0, json.length, 20);
    return JSON.parse(json.toString('utf8'));
  } finally {
    closeSync(fd);
  }
};

/** Whether the file's meshes are already meshopt-compressed (packed by pack-map-models.mjs). */
export const isPacked = (json) => (json.extensionsUsed || []).includes('EXT_meshopt_compression');

/** The close view's map model folders. */
export const MAP_MODEL_DIRS = ['src/assets/map/towns', 'src/assets/map/shared', 'src/assets/map/buildings', 'src/assets/map/wonders', 'src/assets/map/improvements', 'src/assets/map/ships'];
/** The Wave 0 art folders (plans/ART-MODELS-PLAN.md; each has a README.md): kit files with LOD0..LOD2
 * objects, packed the same way. */
export const KIT_MODEL_DIRS = ['src/assets/map/terrain', 'src/assets/battle/rts', 'src/assets/battle/city', 'src/assets/battle/nature', 'src/assets/battle/terrain', 'src/assets/battle/props'];
/** Folders whose objects need not have LOD levels: projectiles (one level), the base units and
 * generals (src/assets/units/<age>-<class>.glb) and signature units (the runtime builds a unit's
 * levels, plan D1). Units are packed WITHOUT quantization (the unit bake reads exact positions and
 * skins), the rest with it. */
export const SINGLE_LOD_DIRS = ['src/assets/battle/projectiles', 'src/assets/units', 'src/assets/units/signature'];
export const UNQUANTIZED_DIRS = ['src/assets/units', 'src/assets/units/signature'];
// Paths use forward slashes on every system: the folder checks below compare prefixes.
const slashes = (file) => file.replace(/\\/g, '/');
const glbsIn = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.glb')).map((f) => slashes(join(d, f))) : []);
/** Every map model file, as paths from the repository root. */
export const mapModelFiles = () => MAP_MODEL_DIRS.flatMap(glbsIn);
/** Every model file the packing script covers: the map models, the kits, projectiles and signature units. */
export const modelFiles = () => [...MAP_MODEL_DIRS, ...KIT_MODEL_DIRS, ...SINGLE_LOD_DIRS].flatMap(glbsIn);
/** Whether a file's objects must carry LOD levels (every folder but SINGLE_LOD_DIRS). */
export const needsLods = (file) => !SINGLE_LOD_DIRS.some((d) => slashes(file).startsWith(`${d}/`));
/** gltfpack's flags for a file: meshopt compression, names, materials and extras kept. */
export const packFlags = (file) => ['-cc', '-kn', '-km', '-ke', ...(UNQUANTIZED_DIRS.some((d) => slashes(file).startsWith(`${d}/`)) ? ['-noq'] : [])];
