// scripts/art/town-landmark-hints.mjs
// Writes a town file's landmark hints (extras.landmarks on its root node: the format
// hall-clear-towns.mjs writes and townComponents.mjs reads, [x, z, w, d, h] per landmark in model
// units and glTF axes) from a JSON table { '<file name without .glb>': [[x, z, w, d, h], ...] }, so
// build-town-layouts.mjs takes exactly those plots as the town's landmarks. Only the JSON chunk
// changes (packed files stay packed). The Mesopotamian kit prints its table:
//   "<blender python>" -I scripts/blender/ti_mesopotamia_layout.py build_town_bronze_mesopotamia bronze > hints.json
//   node scripts/art/town-landmark-hints.mjs hints.json src/assets/map/towns/bronze-town-*-mesopotamia.glb
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const [table, ...files] = process.argv.slice(2);
const hints = JSON.parse(readFileSync(table, 'utf8').trim());
files.forEach((file) => {
  const key = basename(file, '.glb');
  if (!hints[key]) { console.log(`${file}: no hints`); return; }
  const raw = readFileSync(file);
  const jsonLen = raw.readUInt32LE(12);
  const json = JSON.parse(raw.subarray(20, 20 + jsonLen).toString('utf8'));
  const rest = raw.subarray(20 + jsonLen); // the BIN chunk, header and all
  const node = json.nodes[json.scenes[json.scene || 0].nodes[0]];
  node.extras = { ...(node.extras || {}), landmarks: hints[key] };
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + text.length + rest.length, 8);
  head.writeUInt32LE(text.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  writeFileSync(file, Buffer.concat([head, text, rest]));
  console.log(`${file}: ${hints[key].length} landmarks`);
});
