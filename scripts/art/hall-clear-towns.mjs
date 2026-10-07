// scripts/art/hall-clear-towns.mjs
// Makes the battle's town hall the largest building of every town file (src/assets/map/towns), in
// the shipped models themselves so the map's close view and the battle (townLayouts.json) match.
// The rule is assemble_kit_towns.py HALL_CLEAR, applied to the finished files instead of a Blender
// rebuild: each landmark (the kit's temples, towers, pylons, as townComponents.mjs finds them)
//   - keeps out of the square round the centre that the hall needs (medium and big towns: the
//     20 m hall, 5.5 battle tiles, cityBattle.js HALL_TILES; small towns: 4.2 tiles), and
//   - is no wider than CAP[size][0] and no taller than CAP[size][1] model units (1 unit = 10 m),
// by scaling it down uniformly about the middle of its far edge (the side away from the centre),
// so it only ever shrinks inside its own plot: nothing new overlaps, nothing moves into a street.
// The same scale is applied to the landmark's triangles in LOD0, LOD1 and LOD2. Textures, UVs,
// node names and materials are untouched. Unpacks with gltfpack, edits the positions, writes a
// plain file and packs it again with the repository's flags (pack-map-models.mjs).
//   node scripts/art/hall-clear-towns.mjs [--dry] [files...]     (default: every town file)
// Then run `npm run build:town-layouts`.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, readdirSync, renameSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { meshNodes, nodeTriangles, glbReady } from './glbGeometry.mjs';
import { townComponents } from './townComponents.mjs';
import { packFlags } from './glbInfo.mjs';

const TOWNS_DIR = 'src/assets/map/towns';
const GLTFPACK = join('node_modules', 'gltfpack', 'cli.js');
// Battle tiles per model unit (cityBattle.js CITY_TILES_PER_UNIT: 5.5 tiles = 20 m = 2 units).
const S = 2.75;
// The square the landmarks keep out of (Chebyshev half size, units): the hall's half size plus
// hallPlacement's 0.1-tile gap, with a margin.
export const CLEAR = { small: (4.2 / 2 + 0.1) / S + 0.04, medium: 1.1, big: 1.1 };
// [max footprint side, max height] of a landmark (units): narrower than the hall (20 m, 15.3 m in
// a small town) and about as tall as it (11 m, 8.5 m).
// Modern towns keep their towers' height (art spec 3b: modern landmarks up to 50 m): there the hall
// is the largest by footprint only.
export const CAP = { small: [1.15, 0.95], medium: [1.5, 1.2], big: [1.5, 1.2] };
const MODERN_HEIGHT = 5.0;
const MIN_SCALE = 0.3;

const sizeOf = (file) => file.match(/-(small|medium|big)-/)[1];

const RADIUS = { small: 2.0, medium: 3.0, big: 4.0 }; // the town's ground (assemble_kit_towns.py SIZES)
const GAP = 0.04; // between a moved landmark and its neighbours
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2))
  * Math.max(0, Math.min(a.z + a.d / 2, b.z + b.d / 2) - Math.max(a.z - a.d / 2, b.z - b.d / 2));
const grow = (b, g) => ({ ...b, w: b.w + 2 * g, d: b.d + 2 * g });
const within = (a, b) => a.x - a.w / 2 >= b.x - b.w / 2 - 1e-6 && a.x + a.w / 2 <= b.x + b.w / 2 + 1e-6 && a.z - a.d / 2 >= b.z - b.d / 2 - 1e-6 && a.z + a.d / 2 <= b.z + b.d / 2 + 1e-6;
const corners = (b) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => Math.hypot(b.x + (i * b.w) / 2, b.z + (j * b.d) / 2));

/** The scale, anchor and outward shift that make a landmark box { x, z, w, d, h } obey the rule, or
 * null if it already does. The landmark shrinks about the middle of its far edge on one axis and,
 * where its neighbours (`others`, boxes) leave room, steps outward along that axis so it shrinks as
 * little as it can: it never moves onto a neighbour or off the solid ground. */
export const fitLandmark = (b, size, age = 'bronze', others = []) => {
  const [cw, capH] = CAP[size];
  const ch = age === 'modern' ? MODERN_HEIGHT : capH;
  const clear = CLEAR[size];
  const capScale = Math.min(1, cw / Math.max(b.w, b.d), ch / b.h);
  const roomOf = (n) => Math.max(Math.abs(n.x) - n.w / 2, Math.abs(n.z) - n.d / 2);
  // within the measuring noise of a file already cleared (centimetre layouts, quantized vertices)
  if (capScale >= 0.98 && roomOf(b) >= clear - 0.01) return null;
  const edge = Math.max(0.9 * RADIUS[size], ...corners(b));
  const sign = (v) => (v < 0 ? -1 : 1);
  // n: the landmark shrunk and stepped out; n0: shrunk in place (inside its old plot). Stepping out
  // must not reach further into any neighbour than n0 does.
  const ok = (n, n0) => {
    if (roomOf(n) < clear || Math.max(...corners(n)) > edge) return false;
    const g = grow(n, GAP); const g0 = grow(n0, GAP);
    return n === n0 || others.every((o) => overlap(g, o) <= overlap(g0, o) + 1e-6);
  };
  let best = null;
  ['x', 'z'].forEach((k) => {
    const anchor = k === 'x' ? { x: b.x + sign(b.x) * b.w / 2, z: b.z } : { x: b.x, z: b.z + sign(b.z) * b.d / 2 };
    const dir = k === 'x' ? { x: sign(b.x), z: 0 } : { x: 0, z: sign(b.z) };
    for (let s = capScale; s >= MIN_SCALE - 1e-9; s -= 0.01) {
      if (best && s <= best.s) break;
      const n0 = { x: anchor.x + s * (b.x - anchor.x), z: anchor.z + s * (b.z - anchor.z), w: s * b.w, d: s * b.d };
      for (let t = 0; t <= 1.2; t += 0.02) {
        const n = t === 0 ? n0 : { ...n0, x: n0.x + t * dir.x, z: n0.z + t * dir.z };
        if (ok(n, n0)) { best = { s, anchor, axis: k, shift: { x: t * dir.x, z: t * dir.z } }; break; }
      }
      if (best && best.axis === k) break;
    }
  });
  if (best) return best;
  // nowhere to go: the smallest size at its far edge (reported as LOW)
  const k = Math.abs(b.x) + b.w / 2 - clear > Math.abs(b.z) + b.d / 2 - clear ? 'x' : 'z';
  const anchor = k === 'x' ? { x: b.x + sign(b.x) * b.w / 2, z: b.z } : { x: b.x, z: b.z + sign(b.z) * b.d / 2 };
  return { s: MIN_SCALE, anchor, axis: k, shift: { x: 0, z: 0 } };
};

/** A landmark box after its fit. */
export const moveBox = (b, { s, anchor, shift }) => ({
  x: anchor.x + s * (b.x - anchor.x) + shift.x, z: anchor.z + s * (b.z - anchor.z) + shift.z, w: s * b.w, d: s * b.d, h: s * b.h
});

const run = (args) => execFileSync(process.execPath, [GLTFPACK, ...args], { stdio: ['ignore', 'ignore', 'pipe'] });

const parse = (raw) => {
  const jsonLen = raw.readUInt32LE(12);
  const json = JSON.parse(raw.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen;
  const bin = Buffer.from(raw.subarray(binStart + 8, binStart + 8 + raw.readUInt32LE(binStart)));
  return { json, bin };
};
const write = (path, { json, bin }) => {
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
  let body = bin;
  if (body.length % 4) body = Buffer.concat([body, Buffer.alloc(4 - (body.length % 4))]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + text.length + 8 + body.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(text.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(body.length, 0); c2.writeUInt32LE(0x004e4942, 4);
  writeFileSync(path, Buffer.concat([head, c1, text, c2, body]));
};

// connected triangle sets of one primitive (positions welded), as vertex index lists with boxes
const components = ({ positions, indices }) => {
  const n = positions.length / 3;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };
  const at = new Map();
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(positions[i * 3] * 1e4)},${Math.round(positions[i * 3 + 1] * 1e4)},${Math.round(positions[i * 3 + 2] * 1e4)}`;
    const j = at.get(key); if (j === undefined) at.set(key, i); else union(i, j);
  }
  for (let t = 0; t + 2 < indices.length; t += 3) { union(indices[t], indices[t + 1]); union(indices[t], indices[t + 2]); }
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let g = groups.get(r);
    if (!g) { g = { verts: [], x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity }; groups.set(r, g); }
    g.verts.push(i);
    const x = positions[i * 3]; const y = positions[i * 3 + 1]; const z = positions[i * 3 + 2];
    if (x < g.x0) g.x0 = x; if (x > g.x1) g.x1 = x; if (z < g.z0) g.z0 = z; if (z > g.z1) g.z1 = z; if (y < g.y0) g.y0 = y; if (y > g.y1) g.y1 = y;
  }
  return [...groups.values()];
};

// LOD0: exactly the pieces townComponents joined into the landmark (matched by their bounds).
// LOD1 and LOD2 (simplified, other pieces): a set of triangles whose centre is on the landmark's
// plot and on no house's, not reaching far beyond the plot.
const pieceKey = (g) => [g.x0, g.x1, g.z0, g.z1, g.y0, g.y1].map((v) => Math.round(v * 500)).join(',');
const centreIn = (g, b, pad = 0) => Math.abs((g.x0 + g.x1) / 2 - b.x) <= b.w / 2 + pad && Math.abs((g.z0 + g.z1) / 2 - b.z) <= b.d / 2 + pad;
const inside = (g, b, houses) => {
  const reach = 0.2 * Math.max(b.w, b.d) + 0.05;
  return centreIn(g, b, 0.01) && !houses.some((h) => centreIn(g, h))
    && g.x0 >= b.x - b.w / 2 - reach && g.x1 <= b.x + b.w / 2 + reach && g.z0 >= b.z - b.d / 2 - reach && g.z1 <= b.z + b.d / 2 + reach;
};

const invert = (m) => {
  // affine 4x4 column-major inverse (rotation, scale, translation)
  const a = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
  const det = a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const inv = [
    [(a[1][1] * a[2][2] - a[1][2] * a[2][1]) / det, (a[0][2] * a[2][1] - a[0][1] * a[2][2]) / det, (a[0][1] * a[1][2] - a[0][2] * a[1][1]) / det],
    [(a[1][2] * a[2][0] - a[1][0] * a[2][2]) / det, (a[0][0] * a[2][2] - a[0][2] * a[2][0]) / det, (a[0][2] * a[1][0] - a[0][0] * a[1][2]) / det],
    [(a[1][0] * a[2][1] - a[1][1] * a[2][0]) / det, (a[0][1] * a[2][0] - a[0][0] * a[2][1]) / det, (a[0][0] * a[1][1] - a[0][1] * a[1][0]) / det]
  ];
  const t = [m[12], m[13], m[14]];
  return (p) => [0, 1, 2].map((r) => inv[r][0] * (p[0] - t[0]) + inv[r][1] * (p[1] - t[1]) + inv[r][2] * (p[2] - t[2]));
};

/** Apply the rule to one packed town file in place. Returns a report, or null when it obeys already. */
export const clearTown = (file, { dry = false } = {}) => {
  const size = sizeOf(file);
  const age = file.replace(/^.*[\\/]/, '').split('-')[0];
  const { houses, landmarks, landmarkParts } = townComponents(file);
  const box = ([x, z, w, d, h]) => ({ x, z, w, d, h });
  const placed = landmarks.map(box);
  // one landmark after another; the houses and the other landmarks (as already moved) are in the way
  const all = landmarks.map((l, i) => {
    const b = box(l);
    const fit = fitLandmark(b, size, age, [...houses.map(box), ...placed.filter((_, j) => j !== i)]);
    if (fit) placed[i] = moveBox(b, fit);
    return { b, fit };
  });
  const fits = all.filter((l) => l.fit);
  if (!fits.length) return null;
  // every landmark's rectangle after the change: the layout builder keeps reading them as
  // landmarks (a shrunk temple is no house), townComponents.mjs landmarkHints
  const r2 = (v) => Math.round(v * 100) / 100;
  const hints = all.map(({ b, fit }) => { const n = fit ? moveBox(b, fit) : b; return [n.x, n.z, n.w, n.d, n.h].map(r2); });
  const report = { file, size, landmarks: fits.map(({ b, fit }) => ({ ...b, s: Math.round(fit.s * 1000) / 1000, t: r2(Math.abs(fit.shift.x) + Math.abs(fit.shift.z)) })) };
  if (dry) return report;
  const byPiece = new Map();
  all.forEach((l, i) => { if (l.fit) landmarkParts[i].forEach((pc) => byPiece.set(pieceKey(pc), l)); });
  const houseBoxes = houses.map(box);
  const tmp = join(tmpdir(), `hall-clear-${process.pid}.glb`);
  run(['-i', file, '-o', tmp, '-noq', '-kn', '-km', '-ke']);
  const glb = parse(readFileSync(tmp));
  const edited = new Set();
  meshNodes(glb).forEach((node) => {
    const back = invert(node.matrix);
    const prims = nodeTriangles(glb, node);
    const lod0 = node.names.some((n) => /^LOD0/.test(n));
    glb.json.meshes[node.mesh].primitives.forEach((prim, pi) => {
      const p = prims[pi];
      if (p.material === 'Ground') return;
      const acc = glb.json.accessors[prim.attributes.POSITION];
      if (edited.has(prim.attributes.POSITION)) return;
      const view = glb.json.bufferViews[acc.bufferView];
      if (acc.componentType !== 5126 || view.extensions) throw new Error(`${file}: positions are not plain floats`);
      const stride = view.byteStride || 12;
      const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
      let changed = false;
      components(p).forEach((g) => {
        const hit = lod0 ? byPiece.get(pieceKey(g)) : fits.find(({ b }) => inside(g, b, houseBoxes));
        if (!hit) return;
        const { s, anchor, shift } = hit.fit;
        // scaled about the ground (y = 0): every part of the landmark, a roof too, keeps its place on it
        const A = [anchor.x, 0, anchor.z];
        g.verts.forEach((v) => {
          const w = [p.positions[v * 3], p.positions[v * 3 + 1], p.positions[v * 3 + 2]];
          const moved = [A[0] + s * (w[0] - A[0]) + shift.x, A[1] + s * (w[1] - A[1]), A[2] + s * (w[2] - A[2]) + shift.z];
          const local = back(moved);
          for (let k = 0; k < 3; k++) glb.bin.writeFloatLE(local[k], base + v * stride + k * 4);
        });
        changed = true;
      });
      if (changed) {
        edited.add(prim.attributes.POSITION);
        const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
        for (let v = 0; v < acc.count; v++) for (let k = 0; k < 3; k++) {
          const x = glb.bin.readFloatLE(base + v * stride + k * 4);
          if (x < min[k]) min[k] = x; if (x > max[k]) max[k] = x;
        }
        acc.min = min; acc.max = max;
      }
    });
  });
  write(tmp, glb);
  const out = `${file}.packing.glb`;
  run(['-i', tmp, '-o', out, ...packFlags(file)]);
  unlinkSync(tmp);
  const packed = parse(readFileSync(out));
  const root = packed.json.scenes[packed.json.scene || 0].nodes[0];
  const node = packed.json.nodes[root];
  // the old plots: the town ground's baked shade under them is lifted in the game
  // (townDamage.js fileGroundClear, setGroundClear)
  const plots = fits.map(({ b }) => [b.x, b.z, b.w, b.d].map(r2));
  node.extras = { ...(node.extras || {}), landmarks: hints, clearGround: [...(node.extras?.clearGround || []), ...plots] };
  write(out, packed);
  // a virus scanner may hold the fresh file for a moment (EPERM): copy over instead
  try { renameSync(out, file); } catch { copyFileSync(out, file); unlinkSync(out); }
  return report;
};

if (process.argv[1] && process.argv[1].endsWith('hall-clear-towns.mjs')) {
  await glbReady;
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const files = args.filter((a) => !a.startsWith('--'));
  const list = files.length ? files : readdirSync(TOWNS_DIR).filter((f) => f.endsWith('.glb')).sort().map((f) => `${TOWNS_DIR}/${f}`);
  let n = 0;
  list.forEach((file) => {
    const r = clearTown(file, { dry });
    if (!r) return;
    n += 1;
    const low = r.landmarks.filter((l) => l.s < MIN_SCALE);
    console.log(`${file}: ${r.landmarks.map((l) => `${l.w}x${l.d}x${l.h} @(${l.x},${l.z}) x${l.s}${l.t ? ` +${l.t}` : ''}`).join(', ')}${low.length ? '  LOW' : ''}`);
  });
  console.log(`${dry ? 'would change' : 'changed'} ${n} of ${list.length} town files`);
}
