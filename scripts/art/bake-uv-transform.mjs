// scripts/art/bake-uv-transform.mjs
// Writes a plain (unpacked, float) GLB's KHR_texture_transform into its TEXCOORD_0 values and drops
// the extension, so tools that read the UVs straight (Blender bakes in assemble_kit_towns.load_kit)
// see the texture where the game does. Packed game files carry the transform from gltfpack's UV
// quantization; unpack them first (gltfpack -noq).
//   node scripts/art/bake-uv-transform.mjs <in.glb> <out.glb>
import { readFileSync, writeFileSync } from 'node:fs';

const [src, dst] = process.argv.slice(2);
const raw = readFileSync(src);
const jsonLen = raw.readUInt32LE(12);
const json = JSON.parse(raw.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen;
const bin = Buffer.from(raw.subarray(binStart + 8, binStart + 8 + raw.readUInt32LE(binStart)));
const done = new Set();
json.meshes.forEach((mesh) => mesh.primitives.forEach((prim) => {
  const mat = json.materials?.[prim.material];
  const tt = mat?.pbrMetallicRoughness?.baseColorTexture?.extensions?.KHR_texture_transform;
  const ai = prim.attributes.TEXCOORD_0;
  if (!tt || ai === undefined || done.has(ai)) return;
  const acc = json.accessors[ai]; const view = json.bufferViews[acc.bufferView];
  if (acc.componentType !== 5126) throw new Error('TEXCOORD_0 is not float: unpack with gltfpack -noq first');
  const stride = view.byteStride || 8; const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const [sx, sy] = tt.scale || [1, 1]; const [ox, oy] = tt.offset || [0, 0];
  for (let i = 0; i < acc.count; i++) {
    const o = base + i * stride;
    bin.writeFloatLE(bin.readFloatLE(o) * sx + ox, o);
    bin.writeFloatLE(bin.readFloatLE(o + 4) * sy + oy, o + 4);
  }
  delete acc.min; delete acc.max;
  done.add(ai);
}));
(json.materials || []).forEach((m) => {
  const strip = (t) => { if (t?.extensions?.KHR_texture_transform) { delete t.extensions.KHR_texture_transform; if (!Object.keys(t.extensions).length) delete t.extensions; } };
  strip(m.pbrMetallicRoughness?.baseColorTexture); strip(m.pbrMetallicRoughness?.metallicRoughnessTexture); strip(m.normalTexture);
});
json.extensionsUsed = (json.extensionsUsed || []).filter((e) => e !== 'KHR_texture_transform');
json.extensionsRequired = (json.extensionsRequired || []).filter((e) => e !== 'KHR_texture_transform');
if (!json.extensionsRequired.length) delete json.extensionsRequired;
let text = Buffer.from(JSON.stringify(json), 'utf8');
if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + text.length + bin.length, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(text.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004e4942, 4);
writeFileSync(dst, Buffer.concat([head, c1, text, c2, bin]));
console.log(`${dst}: ${done.size} texcoord sets baked`);
