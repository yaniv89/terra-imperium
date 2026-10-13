// plans/art-pilot/md09-machine-scale/inspect.mjs
// Authored sizes inside a unit GLB: every mesh with its material, skeleton root, triangle count and
// bounds (x, y up, z), so a machine and its crew can be told apart and measured.
//   node plans/art-pilot/md09-machine-scale/inspect.mjs src/assets/units/classical-siege.glb [--bones]
import { readFileSync } from 'node:fs';
import { Vector3, Box3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const showBones = process.argv.includes('--bones');
const f2 = (n) => n.toFixed(2);
for (const file of files) {
  const b = readFileSync(file);
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  console.log(`\n== ${file}  clips: ${gltf.animations.map((a) => a.name).join(', ')}`);
  const v = new Vector3(); let total = 0;
  gltf.scene.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry; const box = new Box3(); const n = g.attributes.position.count;
    for (let i = 0; i < n; i++) { if (m.isSkinnedMesh) m.getVertexPosition(i, v); else v.fromBufferAttribute(g.attributes.position, i); v.applyMatrix4(m.matrixWorld); box.expandByPoint(v); }
    const tris = (g.index ? g.index.count : n) / 3; total += tris;
    const root = m.isSkinnedMesh ? m.skeleton.bones[0].name : '-';
    console.log(`${m.name.padEnd(26)} ${String(Array.isArray(m.material) ? 'multi' : m.material.name).padEnd(10)} root=${root.padEnd(14)} tris=${String(tris).padStart(5)} x[${f2(box.min.x)},${f2(box.max.x)}] y[${f2(box.min.y)},${f2(box.max.y)}] z[${f2(box.min.z)},${f2(box.max.z)}]`);
    if (showBones && m.isSkinnedMesh) console.log(`   bones: ${m.skeleton.bones.map((x) => x.name).join(' ')}`);
  });
  console.log(`total tris ${total}`);
}
