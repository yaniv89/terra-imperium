// scripts/art/glbInfo.mjs
// Reads the JSON chunk of a binary glTF file (no dependencies), for the model packing script
// and its test.
import { closeSync, openSync, readdirSync, readSync } from 'node:fs';
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
export const MAP_MODEL_DIRS = ['src/assets/map/towns', 'src/assets/map/shared', 'src/assets/map/buildings', 'src/assets/map/wonders', 'src/assets/map/improvements'];
/** Every map model file, as paths from the repository root. */
export const mapModelFiles = () => MAP_MODEL_DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.glb')).map((f) => join(d, f)));
