// src/components/map/closeView/glbFixture.js
// A tiny binary glTF (GLB) in the map models' format, for tests and local browser checks: one root
// object named `name` with LOD0..LOD2 children, each a box of `size` model units on the ground with
// two materials, Town and Team (the Team part a flag on top). No three.js, no files: returns bytes.
const box = (x0, y0, z0, x1, y1, z1) => {
  const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]];
  const pos = []; const idx = [];
  faces.forEach((f) => {
    const b = pos.length / 3;
    f.forEach((i) => pos.push(...c[i]));
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { pos, idx };
};

/** GLB bytes (Uint8Array) of a landmark-shaped model. */
export const buildingGlb = (name = 'granary', size = 1.4) => {
  const h = size / 2;
  const parts = [box(-h, 0, -h, h, size * 0.8, h), box(-0.05, size * 0.8, -0.05, 0.25, size * 1.1, 0.05)];
  // one buffer: per part positions (float32) then indices (uint16)
  const chunks = []; const views = []; const accessors = []; let offset = 0;
  const push = (typed, target) => {
    const bytes = new Uint8Array(typed.buffer.slice(0));
    const pad = (4 - (bytes.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    chunks.push(bytes, new Uint8Array(pad));
    offset += bytes.length + pad;
    return views.length - 1;
  };
  const prims = parts.map((p, i) => {
    const pos = new Float32Array(p.pos);
    const min = [0, 1, 2].map((k) => Math.min(...p.pos.filter((_, j) => j % 3 === k)));
    const max = [0, 1, 2].map((k) => Math.max(...p.pos.filter((_, j) => j % 3 === k)));
    accessors.push({ bufferView: push(pos, 34962), componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max });
    const posAcc = accessors.length - 1;
    accessors.push({ bufferView: push(new Uint16Array(p.idx), 34963), componentType: 5123, count: p.idx.length, type: 'SCALAR' });
    return { attributes: { POSITION: posAcc }, indices: accessors.length - 1, material: i };
  });
  const json = {
    asset: { version: '2.0', generator: 'terra-imperium glbFixture' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, children: [1, 2, 3] }, { name: 'LOD0', mesh: 0 }, { name: 'LOD1', mesh: 0 }, { name: 'LOD2', mesh: 0 }],
    meshes: [{ primitives: prims }],
    materials: [
      { name: 'Town', pbrMetallicRoughness: { baseColorFactor: [0.85, 0.75, 0.6, 1], metallicFactor: 0, roughnessFactor: 1 } },
      { name: 'Team', pbrMetallicRoughness: { baseColorFactor: [0.75, 0.75, 0.75, 1], metallicFactor: 0, roughnessFactor: 1 } }
    ],
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: offset }]
  };
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jpad = (4 - (jsonBytes.length % 4)) % 4;
  jsonBytes = Uint8Array.from([...jsonBytes, ...new Array(jpad).fill(0x20)]);
  const total = 12 + 8 + jsonBytes.length + 8 + offset;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true); dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  let o = 20 + jsonBytes.length;
  dv.setUint32(o, offset, true); dv.setUint32(o + 4, 0x004e4942, true);
  o += 8;
  chunks.forEach((c) => { out.set(c, o); o += c.length; });
  return out;
};
