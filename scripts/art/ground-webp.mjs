// scripts/art/ground-webp.mjs
// Ships the ground materials built by scripts/blender/build_ground_materials.py: each
// <build_dir>/<id>/color.png becomes src/assets/terrain/<id>/color.webp (WebP q85, the only file the
// game needs; normal.png and orm.png stay in the build folder until the lit ground reads them).
//   node scripts/art/ground-webp.mjs [build_dir=art-build/ground]
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const src = process.argv[2] || 'art-build/ground';
for (const id of readdirSync(src)) {
  const png = join(src, id, 'color.png');
  if (!existsSync(png)) continue;
  const dir = join('src', 'assets', 'terrain', id);
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'color.webp');
  await sharp(png).webp({ quality: 85 }).toFile(out);
  console.log(out, statSync(out).size);
}
