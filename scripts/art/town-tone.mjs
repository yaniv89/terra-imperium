// scripts/art/town-tone.mjs
// Measures how light a map model reads: the mean HSV value and saturation (sRGB, 0..1) of the
// base colour texels under each material's LOD0 faces (Town, Ground, Team), sampled at four
// points per triangle, and the effective value once COLOR_0 (vertex AO, which three.js multiplies
// in) is applied: e<value> in the listing. Reads packed (meshopt, quantized) and unpacked files. Use it to compare a
// new regional file with the base or neighbouring style of the same age:
//   node scripts/art/town-tone.mjs src/assets/map/towns/kingdoms-town-big-a-levant.glb ...
//   node scripts/art/town-tone.mjs --json <files>
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

const readGlb = (path) => {
  const raw = readFileSync(path);
  const jsonLen = raw.readUInt32LE(12);
  const json = JSON.parse(raw.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen;
  const bin = raw.subarray(binStart + 8, binStart + 8 + raw.readUInt32LE(binStart));
  return { json, bin };
};

const viewBytes = (glb, index, cache) => {
  if (cache.has(index)) return cache.get(index);
  const v = glb.json.bufferViews[index];
  const ext = v.extensions?.EXT_meshopt_compression;
  let out;
  if (ext) {
    const src = glb.bin.subarray(ext.byteOffset || 0, (ext.byteOffset || 0) + ext.byteLength);
    out = new Uint8Array(ext.count * ext.byteStride);
    MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, new Uint8Array(src), ext.mode, ext.filter || 'NONE');
  } else {
    out = new Uint8Array(glb.bin.buffer, glb.bin.byteOffset + (v.byteOffset || 0), v.byteLength).slice();
  }
  cache.set(index, out);
  return out;
};

/** An accessor as an array of numbers (normalized ints mapped to 0..1 / -1..1), with its width. */
const accessor = (glb, index, cache) => {
  const a = glb.json.accessors[index];
  const n = COMPONENTS[a.type];
  const T = TYPES[a.componentType];
  const bytes = viewBytes(glb, a.bufferView, cache);
  const stride = glb.json.bufferViews[a.bufferView].byteStride || glb.json.bufferViews[a.bufferView].extensions?.EXT_meshopt_compression?.byteStride || n * T.BYTES_PER_ELEMENT;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
  const out = new Float64Array(a.count * n);
  for (let i = 0; i < a.count; i++) {
    for (let k = 0; k < n; k++) {
      let x = dv[get]((a.byteOffset || 0) + i * stride + k * T.BYTES_PER_ELEMENT, true);
      if (a.normalized) x = Math.max(x / NORM[a.componentType], -1);
      out[i * n + k] = x;
    }
  }
  return out;
};

const hsv = (r, g, b) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return [mx > 1e-6 ? (mx - mn) / mx : 0, mx];
};

const imageCache = new Map();
const imagePixels = async (glb, imageIndex) => {
  const img = glb.json.images[imageIndex];
  const v = glb.json.bufferViews[img.bufferView];
  const bytes = glb.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};

/** { [material name]: { value, sat, samples } } for one file's LOD0 meshes. */
export const measureTone = async (path) => {
  const glb = readGlb(path);
  const cache = new Map();
  const sums = {};
  const lod0Meshes = new Set();
  (glb.json.nodes || []).forEach((n) => { if (/^LOD0/.test(n.name || '') && n.mesh !== undefined) lod0Meshes.add(n.mesh); });
  if (!lod0Meshes.size) (glb.json.nodes || []).forEach((n) => { if (n.mesh !== undefined) lod0Meshes.add(n.mesh); });
  for (const mi of lod0Meshes) {
    for (const prim of glb.json.meshes[mi].primitives) {
      const mat = glb.json.materials[prim.material];
      const texInfo = mat?.pbrMetallicRoughness?.baseColorTexture;
      if (!texInfo || prim.attributes.TEXCOORD_0 === undefined) continue;
      const tex = glb.json.textures[texInfo.index];
      const imageIndex = tex.source ?? tex.extensions?.EXT_texture_webp?.source;
      const key = `${path}|${imageIndex}`;
      if (!imageCache.has(key)) imageCache.set(key, await imagePixels(glb, imageIndex));
      const { data, w, h } = imageCache.get(key);
      const tt = texInfo.extensions?.KHR_texture_transform;
      const off = tt?.offset || [0, 0];
      const sc = tt?.scale || [1, 1];
      const uv = accessor(glb, prim.attributes.TEXCOORD_0, cache);
      const col = prim.attributes.COLOR_0 !== undefined ? accessor(glb, prim.attributes.COLOR_0, cache) : null;
      const cw = col ? COMPONENTS[glb.json.accessors[prim.attributes.COLOR_0].type] : 0;
      const ao = (i) => Math.max(col[i * cw], col[i * cw + 1], col[i * cw + 2]);
      const idx = prim.indices !== undefined ? accessor(glb, prim.indices, cache) : Float64Array.from({ length: uv.length / 2 }, (_, i) => i);
      const s = (sums[mat.name] ||= { v: 0, s: 0, n: 0, e: 0 });
      for (let t = 0; t + 2 < idx.length; t += 3) {
        const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
        for (const [r1, r2] of [[0.33, 0.33], [0.6, 0.2], [0.2, 0.6], [0.2, 0.2]]) {
          let u = uv[a * 2] + r1 * (uv[b * 2] - uv[a * 2]) + r2 * (uv[c * 2] - uv[a * 2]);
          let vv = uv[a * 2 + 1] + r1 * (uv[b * 2 + 1] - uv[a * 2 + 1]) + r2 * (uv[c * 2 + 1] - uv[a * 2 + 1]);
          u = u * sc[0] + off[0];
          vv = vv * sc[1] + off[1];
          u -= Math.floor(u);
          vv -= Math.floor(vv);
          const x = Math.min(w - 1, Math.floor(u * w));
          const y = Math.min(h - 1, Math.floor(vv * h)); // glTF UV: v down from the top row
          const p = (y * w + x) * 4;
          const [sat, val] = hsv(data[p] / 255, data[p + 1] / 255, data[p + 2] / 255);
          // three.js multiplies the base colour by COLOR_0 (vertexColors): the value as rendered
          const shade = col ? ao(a) + r1 * (ao(b) - ao(a)) + r2 * (ao(c) - ao(a)) : 1;
          s.v += val; s.s += sat; s.n += 1; s.e += val * shade;
        }
      }
    }
  }
  return Object.fromEntries(Object.entries(sums).map(([k, s]) => [k, { value: +(s.v / s.n).toFixed(3), effective: +(s.e / s.n).toFixed(3), sat: +(s.s / s.n).toFixed(3), samples: s.n }]));
};

if (process.argv[1] && process.argv[1].endsWith('town-tone.mjs')) {
  const args = process.argv.slice(2);
  const json = args[0] === '--json';
  const files = json ? args.slice(1) : args;
  const out = {};
  for (const f of files) out[f] = await measureTone(f);
  if (json) console.log(JSON.stringify(out, null, 1));
  else Object.entries(out).forEach(([f, m]) => console.log(f.split('/').pop().padEnd(44), Object.entries(m).map(([k, x]) => `${k} v${x.value.toFixed(3)}${x.effective !== x.value ? ` e${x.effective.toFixed(3)}` : ''} s${x.sat.toFixed(3)}`).join('  ')));
}
