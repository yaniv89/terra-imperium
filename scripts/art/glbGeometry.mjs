// scripts/art/glbGeometry.mjs
// Reads the triangles of a binary glTF file in node (no three.js scene): packed (meshopt,
// quantized) or plain files, every mesh node's world transform applied. For build scripts that
// measure map models (build-town-layouts.mjs). Only translation, rotation and scale node
// transforms (no matrices), which is all our Blender exports and gltfpack write.
import { readFileSync } from 'node:fs';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
const GETTERS = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' };

/** Resolves once the meshopt decoder (WebAssembly) can decode: await it before reading packed files. */
export const glbReady = MeshoptDecoder.ready;

export const readGlb = (path) => {
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

/** An accessor as numbers (normalized ints mapped to 0..1 / -1..1). */
export const accessor = (glb, index, cache) => {
  const a = glb.json.accessors[index];
  const n = COMPONENTS[a.type];
  const T = TYPES[a.componentType];
  const bytes = viewBytes(glb, a.bufferView, cache);
  const bv = glb.json.bufferViews[a.bufferView];
  const stride = bv.byteStride || bv.extensions?.EXT_meshopt_compression?.byteStride || n * T.BYTES_PER_ELEMENT;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const get = GETTERS[a.componentType];
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

// 4x4 column-major matrices, as glTF writes them.
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const trs = (n) => {
  if (n.matrix) return n.matrix;
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1
  ];
};

/**
 * Every mesh node under the named object (or every root) with its path of names and world
 * matrix: [{ node, mesh, names: ['town-medium-a', 'LOD0'], matrix }].
 */
export const meshNodes = (glb) => {
  const out = [];
  const nodes = glb.json.nodes || [];
  const walk = (i, parent, names) => {
    const n = nodes[i];
    const m = mul(parent, trs(n));
    const path = n.name ? [...names, n.name] : names;
    if (n.mesh !== undefined) out.push({ node: i, mesh: n.mesh, names: path, matrix: m });
    (n.children || []).forEach((c) => walk(c, m, path));
  };
  const scene = glb.json.scenes?.[glb.json.scene || 0];
  (scene?.nodes || nodes.map((_, i) => i)).forEach((i) => walk(i, IDENTITY, []));
  return out;
};

/**
 * The triangles of one mesh node in world space, per primitive: [{ material, positions
 * (Float64Array xyz), indices (Uint32Array) }].
 */
export const nodeTriangles = (glb, { mesh, matrix }, cache = new Map()) => glb.json.meshes[mesh].primitives.map((prim) => {
  const pos = accessor(glb, prim.attributes.POSITION, cache);
  const world = new Float64Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const [x, y, z] = [pos[i], pos[i + 1], pos[i + 2]];
    world[i] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    world[i + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    world[i + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
  }
  const idx = prim.indices !== undefined ? Uint32Array.from(accessor(glb, prim.indices, cache)) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
  return { material: glb.json.materials?.[prim.material]?.name || '', positions: world, indices: idx };
});
