// scripts/art/build-town-layouts.mjs
// Writes src/data/townLayouts.json: the buildings of every assembled town model
// (src/assets/map/towns/*.glb), split back into houses and landmarks by townComponents.mjs. The
// city manifest (src/data/cityManifest.js) reads it, so the close view and the tactical battle
// list the same houses with the same ids. Run after every town art merge (and after
// npm run pack:models, which does not move anything):
//   npm run build:town-layouts
// Format (compact, it ships in the game): { version, unit: 'cm', towns: { 'bronze-town-medium-a':
// [houses, landmarks] } }, each a flat list of integers x, z, w, d, h (centimetres of model space,
// 1 model unit = 100 cm = 10 m on the ground; x east, z south). Deterministic: the same files give
// the same JSON byte for byte.
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { townComponents, glbReady } from './townComponents.mjs';

export const TOWNS_DIR = 'src/assets/map/towns';
export const LAYOUTS_FILE = 'src/data/townLayouts.json';
export const LAYOUT_VERSION = 1;

const cm = (list) => list.flatMap((b) => b.map((v) => Math.round(v * 100)));

export const buildLayouts = async (dir = TOWNS_DIR) => {
  await glbReady;
  const towns = {};
  readdirSync(dir).filter((f) => f.endsWith('.glb')).sort().forEach((f) => {
    const { houses, landmarks } = townComponents(join(dir, f));
    towns[f.replace(/\.glb$/, '')] = [cm(houses), cm(landmarks)];
  });
  return { version: LAYOUT_VERSION, unit: 'cm', towns };
};

if (process.argv[1] && process.argv[1].endsWith('build-town-layouts.mjs')) {
  const out = await buildLayouts();
  const text = `{"version":${out.version},"unit":"cm","towns":{\n${Object.entries(out.towns).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',\n')}\n}}\n`;
  writeFileSync(LAYOUTS_FILE, text);
  const counts = Object.values(out.towns).map(([h]) => h.length / 5);
  console.log(`${LAYOUTS_FILE}: ${counts.length} towns, ${Math.min(...counts)} to ${Math.max(...counts)} houses, ${(text.length / 1024).toFixed(0)} KB`);
}
