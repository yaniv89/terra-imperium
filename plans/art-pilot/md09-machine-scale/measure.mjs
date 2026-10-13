// plans/art-pilot/md09-machine-scale/measure.mjs
// One row per unit GLB: the crew's height (top of the head's skin, authored units; a person is 1 unit
// = 1.8 m), the machine's length, width and height in metres (the meshes on a rig with no head: no
// people, no animals), triangles. Markdown table rows on stdout.
//   node plans/art-pilot/md09-machine-scale/measure.mjs src/assets/units/classical-siege.glb ...
import { readFileSync } from 'node:fs';
import { Vector3, Box3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const measureUnit = async (file) => {
  const b = readFileSync(file);
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const v = new Vector3(); const machine = new Box3(); const all = new Box3(); const heads = []; let tris = 0; let crew = 0;
  gltf.scene.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry; const n = g.attributes.position.count; tris += (g.index ? g.index.count : n) / 3;
    const bones = m.isSkinnedMesh ? m.skeleton.bones.map((x) => x.name) : [];
    const person = bones.some((x) => /^Head(_\d+)?$/.test(x)); const animal = bones.some((x) => /^Mount_/.test(x));
    const skin = !Array.isArray(m.material) && /skin/i.test(m.material.name);
    let top = -Infinity;
    for (let i = 0; i < n; i++) {
      if (m.isSkinnedMesh) m.getVertexPosition(i, v); else v.fromBufferAttribute(g.attributes.position, i);
      v.applyMatrix4(m.matrixWorld); all.expandByPoint(v);
      if (!person && !animal) machine.expandByPoint(v);
      if (person && skin) {
        const si = g.attributes.skinIndex; const sw = g.attributes.skinWeight; let best = 0;
        for (let q = 1; q < 4; q++) if (sw.getComponent(i, q) > sw.getComponent(i, best)) best = q;
        if (/^Head/.test(m.skeleton.bones[si.getComponent(i, best)].name)) top = Math.max(top, v.y);
      }
    }
    if (person && skin && top > -Infinity) { crew += 1; heads.push(top); }
  });
  // a person's height: the head top above his own feet (a rider or a man on a deck stands higher)
  return { crew, heads, machine, all, tris };
};

const M = 1.8; const f = (n) => (Number.isFinite(n) ? n.toFixed(2) : '-');
if (process.argv[1] && process.argv[1].endsWith('measure.mjs')) {
  for (const file of process.argv.slice(2)) {
    const r = await measureUnit(file); const s = r.machine;
    console.log(`| ${file.replace(/^.*units\//, '').replace('.glb', '')} | ${r.crew} | ${f(Math.min(...r.heads))} to ${f(Math.max(...r.heads))} | ${f((s.max.z - s.min.z) * M)} | ${f((s.max.x - s.min.x) * M)} | ${f(s.max.y * M)} | ${f(r.all.max.z - r.all.min.z)} x ${f(r.all.max.x - r.all.min.x)} | ${r.tris} |`);
  }
}
