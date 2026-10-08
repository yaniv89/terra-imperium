// Checkpoint38 packed-buffer regression, independent of browser/Vite and scratch paths.
// Run only after the kit-loader owner declares code final:
//   node scripts/art/checkpoint38-lod-uvs.mjs --out /tmp/checkpoint38-lod-uvs.json
// Reads actual packed GLBs; writes only an explicitly requested JSON report.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import sharp from 'sharp';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXPECTED = {
  "src/assets/battle/terrain/river-kit.glb": "98b4b8d31de41b9d105d7f40782820985bfa553d82684d162e5b0b87da22e85a",
  "src/assets/battle/terrain/ford.glb": "9da93d98cdfe5f64dd514cd6157d83786d11bec4dccfc020319c89dcb61b2119",
  "src/assets/battle/terrain/bridge-wood.glb": "36b5b768a5d7ea0d288011591e50e5c2b9be7de3e32d184900e8bb5eecdb0812",
  "src/assets/battle/terrain/bridge-stone.glb": "35665c949376f7e91830a0f7d2fe40d84ca31d9e2f3f245927b386e348adb6c7",
  "src/assets/battle/terrain/bridge-steel.glb": "5612757d0a00241fa8f1e5ed1d29f0dced27c6dc43dab94a680534d5d2a5cd1c",
  "src/assets/battle/nature/vegetation-conifer.glb": "3e8f62642faa9099fa38a0317028ebd301cf30194de8caf60dd22dc6dd7bd8f1",
  "src/assets/battle/nature/vegetation-tropical.glb": "202f14f0cee224039be57258f6bb7c1576dab6da09c5d3dfdd2e8d28a03ecd6d",
  "src/assets/battle/nature/vegetation-cold.glb": "073be8c85915e539020f93c53b6e27fc2ab60777fbe173816f2c638da504e91b",
  "src/assets/battle/props/loot-sack.glb": "2847ea345fe421458c7e4161635086fd64202bc75503970fd8565a8840ebf187",
  "src/assets/battle/props/exit-marker.glb": "24dd3703cdd0de7e304cfd105013058a9d2cc486d1e77dad4207c56cdf08c00d",
  "src/assets/battle/props/burnt-field-overlay.glb": "5d07899b742664b1b2b08b9e0b0ad324a1fe392700e626fc57f6f5c73d15f921",
  "src/assets/battle/props/landing-ancient.glb": "8b7995aa3fed6f2996de95386d28caaf4486af4426c4964c076f7288f807e5e7",
  "src/assets/battle/props/landing-middle.glb": "50eab83668e4762398addbde21761683fb9a43cc49a3927de43b5fdf2688608b",
  "src/assets/battle/props/landing-modern.glb": "7262ed51d993460843032bfa3a4ae713de28fc158aae24db35c6a2083bf79c67"
};
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === '--out'), 'Usage: checkpoint38-lod-uvs.mjs [--out report.json]');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
sharp.concurrency(1);
globalThis.self = globalThis;
globalThis.ProgressEvent = class extends Event {
  constructor(name, init = {}) { super(name); Object.assign(this, init); }
};
// Deliberate Node limit: actual image dimensions and texture transforms survive,
// but no colour pixels, alpha rendering, material shaders or browser are tested.
globalThis.createImageBitmap = async blob => {
  const image = await sharp(Buffer.from(await blob.arrayBuffer())).metadata();
  return { width: image.width, height: image.height, close() {} };
};

const loaderPath = resolve(repo, 'src/battle/art/kitLoader.js');
const loaderSource = readFileSync(loaderPath, 'utf8');
// Evaluate the exact checked-out loader body; substitute only its import bindings.
// ART is intentionally unavailable: parseKit must not depend on URL policy.
// URL routing / explicit legacy opt-in are tested separately by kitLodUv.test.js.
const imported = loaderSource.match(/^import .*?;\s*$/gm) || [];
assert(imported.every(line => /from ['"](?:three|three\/examples\/jsm\/utils\/BufferGeometryUtils\.js|\.\.\/render\/gltfUnitLoader|\.\/artFiles)['"]/.test(line)), 'New loader dependency: update checker explicitly');
const body = loaderSource.replace(/^import .*?;\s*$/gm, '').replace(/\bexport /g, '');
const loader = new Function('Matrix4', 'Vector3', 'BufferGeometry', 'BufferAttribute', 'Box3', 'mergeGeometries', 'loadGltf', 'ART',
  `${body}\nreturn {parseKit,bakeBundle,lodOf,isSocket};`)(
  T.Matrix4, T.Vector3, T.BufferGeometry, T.BufferAttribute, T.Box3, mergeGeometries,
  () => { throw Error('Network loading forbidden'); },
  { url() { throw Error('URL policy is covered separately by kitLodUv.test.js'); } }
);

// Original pre-repair parseKit root/LOD assembly, using actual bakeBundle only.
// This never calls parseKit or transferLodUvs, nor a repair-disable option.
function authoredBaseline(scene) {
  scene.updateMatrixWorld(true);
  const hasMesh = node => { let found = false; node.traverse(c => { if (c.isMesh) found = true; }); return found; };
  const roots = [];
  scene.traverse(node => { if (loader.lodOf(node) === null && node.children.some(c => loader.lodOf(c) === 0)) roots.push(node); });
  const set = new Set(roots);
  const holdsRoot = node => { let found = false; node.traverse(c => { if (set.has(c)) found = true; }); return found; };
  roots.push(...scene.children.filter(node => loader.lodOf(node) === null && !loader.isSocket(node) && !holdsRoot(node) && hasMesh(node)));
  const objects = {};
  for (const root of roots) {
    const toRoot = root.matrixWorld.clone().invert();
    const nodes = [0, 1, 2].map(level => root.children.filter(c => loader.lodOf(c) === level));
    if (!nodes[0].length) nodes[0] = [root];
    const lods = [];
    nodes.forEach((list, level) => { lods[level] = (list.length ? loader.bakeBundle(list, toRoot) : null) || lods[level - 1] || null; });
    if (lods[0]) objects[root.name] = { lods };
  }
  return objects;
}

function compareBundle(actual, baseline) {
  const attributes = {};
  for (const name of ['position', 'normal', 'uv']) {
    const a = actual.geometry.attributes[name], b = baseline.geometry.attributes[name];
    const identical = !!a && !!b && a.itemSize === b.itemSize && a.count === b.count && a.array.constructor === b.array.constructor && bytes(a.array).equals(bytes(b.array));
    attributes[name] = { identical, count: a?.count ?? null, sha256: a ? sha256(bytes(a.array)) : null };
  }
  const a = actual.geometry.index, b = baseline.geometry.index;
  const indicesIdentical = a.array.constructor === b.array.constructor && a.count === b.count && bytes(a.array).equals(bytes(b.array));
  const groupsIdentical = JSON.stringify(actual.geometry.groups) === JSON.stringify(baseline.geometry.groups);
  return { attributes, indices_identical: indicesIdentical, index_sha256: sha256(bytes(a.array)), triangles: actual.triangles, triangles_identical: actual.triangles === baseline.triangles, groups_identical: groupsIdentical };
}

const report = {
  status: 'running', kitLoader_sha256: sha256(loaderSource),
  baseline: 'Pre-repair root assembly + actual bakeBundle, independent of parseKit policy',
  loader: 'Actual GLTFLoader + MeshoptDecoder, real packed buffers',
  limits: 'ImageBitmap dimension stub only; no pixel/browser/alpha/shader acceptance. Legacy explicit opt-in and ART URL policy are covered separately by kitLodUv.test.js.',
  model_hash_baseline: 'Packed checkpoint38 SHA256s measured before loader fix',
  files: [], failures: []
};
for (const [gamePath, expectedHash] of Object.entries(EXPECTED)) {
  const file = resolve(repo, gamePath), raw = readFileSync(file), beforeHash = sha256(raw);
  const header = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)));
  assert(header.extensionsUsed?.includes('EXT_meshopt_compression'), `${gamePath}: expected packed model`);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
  const baseline = authoredBaseline(gltf.scene), actual = loader.parseKit(gltf.scene).objects;
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(baseline).sort(), `${gamePath}: root inventory`);
  const row = { game_path: gamePath, sha256: beforeHash, unchanged_since_uv_proof: beforeHash === expectedHash, unchanged_during_check: sha256(readFileSync(file)) === beforeHash, roots: [] };
  if (!row.unchanged_since_uv_proof || !row.unchanged_during_check) report.failures.push(`${gamePath}: asset hash changed`);
  for (const [name, object] of Object.entries(actual)) {
    const root = { root: name, lods: object.lods.map((bundle, level) => ({ level, ...compareBundle(bundle, baseline[name].lods[level]) })) };
    for (const lod of root.lods) {
      if (!Object.values(lod.attributes).every(a => a.identical) || !lod.indices_identical || !lod.triangles_identical || !lod.groups_identical) report.failures.push(`${gamePath}:${name}:LOD${lod.level}: authored buffer changed`);
    }
    row.roots.push(root);
  }
  report.files.push(row);
}
assert.equal(sha256(readFileSync(loaderPath)), report.kitLoader_sha256, 'Loader changed during check; rerun after code final');
const lower = report.files.flatMap(file => file.roots.flatMap(root => root.lods.filter(lod => lod.level > 0)));
report.summary = {
  models: report.files.length, roots: report.files.reduce((sum, file) => sum + file.roots.length, 0), lower_lods: lower.length,
  uv_rewrites: lower.filter(lod => !lod.attributes.uv.identical).length,
  index_changes: lower.filter(lod => !lod.indices_identical).length,
  triangle_changes: lower.filter(lod => !lod.triangles_identical).length,
  unchanged_model_hashes: report.files.filter(file => file.unchanged_since_uv_proof && file.unchanged_during_check).length
};
assert.equal(report.summary.models, 14);
assert.equal(report.summary.roots, 56);
assert.equal(report.summary.lower_lods, 112);
report.status = report.failures.length ? 'failed' : 'passed';
if (args.length) writeFileSync(resolve(args[1]), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, ...report.summary, failures: report.failures }));
if (report.failures.length) process.exitCode = 1;
