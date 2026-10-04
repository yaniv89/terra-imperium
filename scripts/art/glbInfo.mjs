// scripts/art/glbInfo.mjs
// Reads the JSON chunk of a binary glTF file (no dependencies), for the model packing script
// and its test.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The glTF JSON of a .glb file. */
export const readGlbJson = (path) => {
  const b = readFileSync(path);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a binary glTF file`);
  const length = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + length).toString('utf8'));
};

/** Whether the file's meshes are already meshopt-compressed (packed by pack-map-models.mjs). */
export const isPacked = (json) => (json.extensionsUsed || []).includes('EXT_meshopt_compression');

/** The close view's map model folders. */
export const MAP_MODEL_DIRS = ['src/assets/map/towns', 'src/assets/map/shared'];
/** Every map model file, as paths from the repository root. */
export const mapModelFiles = () => MAP_MODEL_DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.glb')).map((f) => join(d, f)));
