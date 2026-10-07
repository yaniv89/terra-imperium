// Tundra-only shipping conversion. Keep q95: q85 exaggerates decoded edge differences.
// node scripts/art/tundra-webp.mjs [build-dir=art-build/tundra]
import sharp from 'sharp';
import {mkdirSync,statSync} from 'node:fs';
const build=process.argv[2]||'art-build/tundra';
const out='src/assets/terrain/tundra/color.webp';
mkdirSync('src/assets/terrain/tundra',{recursive:true});
await sharp(`${build}/tundra/color.png`).webp({quality:95}).toFile(out);
console.log(`${out}: ${statSync(out).size} bytes`);
