// scripts/art/pack-map-models.mjs
// Compresses the model files in place with gltfpack: the close-view map models (src/assets/map/
// towns, shared, buildings, wonders, improvements, terrain) and the battle art (src/assets/battle/
// rts, city, nature, terrain, projectiles; src/assets/units/signature, without quantization):
// meshopt geometry compression and quantized vertices, the WebP textures as they are. Node names
// (the objects and their LOD0..LOD2 children) and the Town / Ground / Team materials are kept, so
// the game reads the files unchanged (gltfUnitLoader sets the meshopt decoder). A town drops from
// about 7 MB to 3 MB. Files already packed are skipped, so run it after every art merge:
//   npm run pack:models            pack every unpacked file
//   npm run pack:models -- <files> pack only these
import { execFileSync } from 'node:child_process';
import { renameSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { isPacked, modelFiles, packFlags, readGlbJson } from './glbInfo.mjs';

const GLTFPACK = join('node_modules', '.bin', 'gltfpack');

const pack = (file) => {
  const tmp = `${file}.packing.glb`;
  try {
    execFileSync(GLTFPACK, ['-i', file, '-o', tmp, ...packFlags(file)], { stdio: ['ignore', 'ignore', 'pipe'] });
    if (!isPacked(readGlbJson(tmp))) throw new Error('gltfpack wrote no meshopt data');
    const before = statSync(file).size;
    renameSync(tmp, file);
    return [before, statSync(file).size];
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* nothing to remove */ }
    throw new Error(`${file}: ${e.stderr?.toString() || e.message}`);
  }
};

const files = process.argv.length > 2 ? process.argv.slice(2) : modelFiles();
let before = 0, after = 0, packed = 0;
files.forEach((file) => {
  if (isPacked(readGlbJson(file))) return;
  const [b, a] = pack(file);
  before += b; after += a; packed += 1;
  console.log(`${file}: ${(b / 1e6).toFixed(1)} MB -> ${(a / 1e6).toFixed(1)} MB`);
});
console.log(packed ? `packed ${packed} files: ${(before / 1e6).toFixed(0)} MB -> ${(after / 1e6).toFixed(0)} MB` : 'every model is already packed');
