// scripts/art/improvement-far-ground.mjs
// The far Ground of the tile improvement files (src/assets/map/improvements/): measures what the
// LOD1 and LOD2 Ground faces sample in the atlas, and repoints a far Ground that samples a dark
// region at the LOD0 Ground's own soil.
//
// Why: the 13 base files of the 2026-10-07 LOD repair (camp, farm, fishing_boats, lumber_camp, mine,
// pasture, plantation, quarry and road; plans/art/downloads/wave0-backlog/checkpoint-01/
// LOD-REPAIR-QA.md) share one 4-vertex Ground square between LOD1 and LOD2. Its UVs cover a top-down
// projection of the patch that the repair baked into a spare corner of the atlas, but the bake wrote
// linear-light values as sRGB bytes: the disc is the LOD0 soil with a 2.2 gamma applied (LOD0 soil
// about 159,146,102, the disc 93,77,36), and the square's corners are transparent black, so at far
// map zoom the mine and the farm read as a black square (buildingLayer.js repairDarkLods hides it at
// run time and logs a warning). The repair's builder is not in the repository, so this script
// patches the packed files: it only rewrites the far Ground square's 4 UVs, onto the largest square
// of opaque LOD0 Ground texels (kept INSET texels clear of the island's edge for the mip levels).
// The square of soil takes the land tint like LOD0's patch. Positions, triangles, other objects,
// LOD0, materials and the atlas do not change; the 4 new UVs are written to a small plain buffer
// view appended to the binary chunk (the rest of the file stays meshopt-packed as gltfpack wrote it).
//
// A far Ground whose LOD0 patch does not fill its square (fishing boats: LOD0 is a shore strip, the
// far square spans the sea too) is left alone: a square of sand would cover the water. Its
// projection keeps the beach's shape and repairDarkLods draws LOD0's strip instead.
//
//   node scripts/art/improvement-far-ground.mjs [files]          report (every improvement file)
//   node scripts/art/improvement-far-ground.mjs --fix [files]    rewrite the dark far Ground squares
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import { readGlb, accessor, glbReady } from './glbGeometry.mjs';

export const IMPROVEMENT_DIR = 'src/assets/map/improvements';
/** A far Ground is dark when its opaque texels' mean luminance is under this share of LOD0's. */
export const DARK_SHARE = 0.8;
/** Texels kept between the new square and the edge of the LOD0 Ground island (mip bleed). */
export const INSET = 8;
/** LOD0's Ground must cover this share of the far square's footprint for a square of soil to stand in. */
export const MIN_FILL = 0.6;
const OPAQUE = 128; // alpha cut of the Ground's MASK (0.5)

export const improvementFiles = () => readdirSync(IMPROVEMENT_DIR).filter((f) => f.endsWith('.glb')).map((f) => `${IMPROVEMENT_DIR}/${f}`);

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const groundAtlas = async (glb) => {
  const J = glb.json;
  const material = J.materials.findIndex((m) => m.name === 'Ground');
  if (material < 0) return null;
  const info = J.materials[material].pbrMetallicRoughness?.baseColorTexture;
  if (!info) return null;
  const tex = J.textures[info.index];
  const view = J.bufferViews[J.images[tex.source ?? tex.extensions?.EXT_texture_webp?.source].bufferView];
  const bytes = glb.bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const { data, info: size } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const tt = info.extensions?.KHR_texture_transform;
  return { material, data, w: size.width, h: size.height, offset: tt?.offset || [0, 0], scale: tt?.scale || [1, 1] };
};

/** The Ground primitives under each LOD node: [{ lod, mesh, prim, positions, uvs (atlas 0..1), indices }]. */
const groundPrims = (glb, atlas, cache) => {
  const J = glb.json;
  const out = [];
  J.nodes.forEach((n) => {
    const m = /^LOD(\d)/.exec(n.name || '');
    if (!m) return;
    const walk = (node) => {
      if (node.mesh !== undefined) {
        J.meshes[node.mesh].primitives.forEach((prim, p) => {
          if (prim.material !== atlas.material) return;
          const raw = accessor(glb, prim.attributes.TEXCOORD_0, cache);
          const uvs = Array.from(raw, (x, i) => x * atlas.scale[i % 2] + atlas.offset[i % 2]);
          const indices = prim.indices !== undefined ? Array.from(accessor(glb, prim.indices, cache)) : uvs.map((_, i) => i).slice(0, uvs.length / 2);
          out.push({ lod: Number(m[1]), mesh: node.mesh, prim: p, positions: accessor(glb, prim.attributes.POSITION, cache), uvs, indices });
        });
      }
      (node.children || []).forEach((c) => walk(J.nodes[c]));
    };
    walk(n);
  });
  return out;
};

/** Every atlas texel centre inside the primitive's triangles (UV space), as callback(x, y). */
const eachTexel = (g, atlas, fn) => {
  const { w, h } = atlas;
  const P = (i) => [g.uvs[i * 2] * w, g.uvs[i * 2 + 1] * h];
  const edge = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let t = 0; t + 2 < g.indices.length; t += 3) {
    const [a, b, c] = [P(g.indices[t]), P(g.indices[t + 1]), P(g.indices[t + 2])];
    const area = edge(a, b, c);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.floor(Math.min(a[0], b[0], c[0])); const x1 = Math.ceil(Math.max(a[0], b[0], c[0]));
    const y0 = Math.floor(Math.min(a[1], b[1], c[1])); const y1 = Math.ceil(Math.max(a[1], b[1], c[1]));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const p = [x + 0.5, y + 0.5];
        const s = Math.sign(area);
        if (s * edge(b, c, p) < 0 || s * edge(c, a, p) < 0 || s * edge(a, b, p) < 0) continue;
        fn(((x % w) + w) % w, ((y % h) + h) % h);
      }
    }
  }
};

/** The opaque texels' mean colour and luminance under the primitive, and the opaque share. */
const texelMean = (g, atlas) => {
  const s = [0, 0, 0]; let n = 0; let all = 0;
  eachTexel(g, atlas, (x, y) => {
    const p = (y * atlas.w + x) * 4;
    all += 1;
    if (atlas.data[p + 3] < OPAQUE) return;
    s[0] += atlas.data[p]; s[1] += atlas.data[p + 1]; s[2] += atlas.data[p + 2]; n += 1;
  });
  const rgb = s.map((v) => (n ? Math.round(v / n) : 0));
  // what buildingLayer.js partLuminance reads: the texels at the vertices' UVs, alpha ignored
  let v = 0;
  for (let i = 0; i < g.uvs.length; i += 2) {
    const wrap = (x) => x - Math.floor(x);
    const x = Math.min(atlas.w - 1, Math.floor(wrap(g.uvs[i]) * atlas.w));
    const y = Math.min(atlas.h - 1, Math.floor(wrap(g.uvs[i + 1]) * atlas.h));
    const p = (y * atlas.w + x) * 4;
    v += lum(atlas.data[p], atlas.data[p + 1], atlas.data[p + 2]);
  }
  return { rgb, lum: +lum(...rgb).toFixed(3), opaque: all ? +(n / all).toFixed(3) : 0, vertexLum: +(v / (g.uvs.length / 2)).toFixed(3) };
};

const footprint = (g) => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < g.positions.length; i += 3) {
    x0 = Math.min(x0, g.positions[i]); x1 = Math.max(x1, g.positions[i]);
    z0 = Math.min(z0, g.positions[i + 2]); z1 = Math.max(z1, g.positions[i + 2]);
  }
  return { x0, x1, z0, z1 };
};

/**
 * One file's Ground per LOD: [{ lod, mesh, verts, triangles, rgb, lum, opaque }] (rgb and lum of
 * the opaque texels under the faces, opaque the share of texels the MASK draws), and `far`: the
 * LOD1+ Ground primitives that are dark against LOD0 (lum under DARK_SHARE of LOD0's).
 */
export const measureFarGround = async (path) => {
  await glbReady;
  const glb = readGlb(path);
  const atlas = await groundAtlas(glb);
  if (!atlas) return { path, levels: [], dark: [] };
  const prims = groundPrims(glb, atlas, new Map());
  const levels = prims.map((g) => ({ lod: g.lod, mesh: g.mesh, verts: g.uvs.length / 2, triangles: g.indices.length / 3, ...texelMean(g, atlas) }));
  const base = levels.filter((l) => l.lod === 0);
  const baseLum = base.length ? Math.max(...base.map((l) => l.lum)) : 0;
  const dark = levels.filter((l) => l.lod > 0 && l.lum < DARK_SHARE * baseLum);
  return { path, levels, baseLum, dark };
};

/**
 * The square of `side` texels inside `mask` (w*h, 1 = usable) whose mean colour is nearest `target`
 * ([r, g, b]): { x, y, side, rgb }, or null when no such square fits. A farm's LOD0 Ground holds
 * crop rows and soil; the square nearest the patch's mean reads as the patch from afar.
 */
const nearestSquare = (mask, atlas, side, target) => {
  const { w, h, data } = atlas;
  const dp = new Uint16Array(w * h); // the largest square ending at each texel
  const W = w + 1;
  const sums = [0, 1, 2].map(() => new Float64Array(W * (h + 1))); // integral images
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) dp[i] = x && y ? 1 + Math.min(dp[i - 1], dp[i - w], dp[i - w - 1]) : 1;
      for (let c = 0; c < 3; c++) {
        const s = sums[c];
        s[(y + 1) * W + x + 1] = data[i * 4 + c] + s[y * W + x + 1] + s[(y + 1) * W + x] - s[y * W + x];
      }
    }
  }
  let best = null;
  for (let y = side - 1; y < h; y++) {
    for (let x = side - 1; x < w; x++) {
      if (dp[y * w + x] < side) continue;
      const [x0, y0, x1, y1] = [x - side + 1, y - side + 1, x + 1, y + 1];
      const rgb = sums.map((s) => (s[y1 * W + x1] - s[y0 * W + x1] - s[y1 * W + x0] + s[y0 * W + x0]) / (side * side));
      const d = rgb.reduce((a, v, c) => a + (v - target[c]) ** 2, 0);
      if (!best || d < best.d) best = { x: x0, y: y0, side, rgb: rgb.map(Math.round), d };
    }
  }
  return best;
};
/** Side of the far Ground's square in texels: at most SQUARE, less only when no such square fits. */
export const SQUARE = 160;

/** Rewrites the dark far Ground squares of one file; returns what it did. */
export const fixFarGround = async (path) => {
  await glbReady;
  const glb = readGlb(path);
  const J = glb.json;
  const atlas = await groundAtlas(glb);
  if (!atlas) return { path, skipped: 'no Ground' };
  const cache = new Map();
  const prims = groundPrims(glb, atlas, cache);
  const before = await measureFarGround(path);
  const darkMeshes = new Set(before.dark.map((d) => `${d.mesh}`));
  const targets = [...new Map(prims.filter((g) => g.lod > 0 && darkMeshes.has(`${g.mesh}`)).map((g) => [`${g.mesh}/${g.prim}`, g])).values()];
  if (!targets.length) return { path, skipped: 'far Ground already lit' };
  const lod0 = prims.filter((g) => g.lod === 0);
  // usable texels: inside a LOD0 Ground face and opaque, then eroded by INSET
  const { w, h } = atlas;
  let mask = new Uint8Array(w * h);
  lod0.forEach((g) => eachTexel(g, atlas, (x, y) => { if (atlas.data[(y * w + x) * 4 + 3] >= 250) mask[y * w + x] = 1; }));
  for (let k = 0; k < INSET; k++) {
    const next = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; next[i] = mask[i] & mask[i - 1] & mask[i + 1] & mask[i - w] & mask[i + w]; }
    mask = next;
  }
  const target = before.levels.filter((l) => l.lod === 0).sort((a, b) => b.lum - a.lum)[0].rgb;
  let sq = null;
  for (let side = SQUARE; side >= 16 && !sq; side = Math.floor(side / 2)) sq = nearestSquare(mask, atlas, side, target);
  if (!sq) return { path, skipped: 'no opaque LOD0 Ground square' };
  const done = [];
  for (const g of targets) {
    if (g.uvs.length !== 8) { done.push({ mesh: g.mesh, skipped: `${g.uvs.length / 2} vertices, not a square` }); continue; }
    const f = footprint(g);
    const base = lod0.map(footprint).reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) }));
    const fill = ((base.x1 - base.x0) * (base.z1 - base.z0)) / ((f.x1 - f.x0) * (f.z1 - f.z0));
    if (fill < MIN_FILL) { done.push({ mesh: g.mesh, skipped: `LOD0 Ground fills ${Math.round(fill * 100)}% of the far square (a square of soil would cover the water)` }); continue; }
    const prim = J.meshes[g.mesh].primitives[g.prim];
    const acc = J.accessors[prim.attributes.TEXCOORD_0];
    if (acc.componentType !== 5123 || !acc.normalized) throw new Error(`${path}: far Ground UVs are not normalized uint16`);
    const q = new Uint16Array(8);
    for (let i = 0; i < 4; i++) {
      const fx = (g.positions[i * 3] - f.x0) / (f.x1 - f.x0);
      const fz = (g.positions[i * 3 + 2] - f.z0) / (f.z1 - f.z0);
      const uv = [(sq.x + fx * sq.side) / w, (sq.y + fz * sq.side) / h];
      for (let k = 0; k < 2; k++) {
        const v = Math.round(((uv[k] - atlas.offset[k]) / atlas.scale[k]) * 65535);
        if (v < 0 || v > 65535) throw new Error(`${path}: UV ${uv[k]} outside the texture transform's range`);
        q[i * 2 + k] = v;
      }
    }
    // the 4 UVs in a plain buffer view at the end of the binary chunk (4-byte aligned)
    const at = Math.ceil(glb.bin.length / 4) * 4;
    const bin = Buffer.alloc(at + q.byteLength);
    glb.bin.copy(bin, 0);
    Buffer.from(q.buffer).copy(bin, at);
    glb.bin = bin;
    const bufferIndex = J.buffers.findIndex((b) => !b.uri && !b.extensions?.EXT_meshopt_compression?.fallback);
    J.bufferViews.push({ buffer: bufferIndex, byteOffset: at, byteLength: q.byteLength, byteStride: 4, target: 34962 });
    acc.bufferView = J.bufferViews.length - 1;
    acc.byteOffset = 0;
    J.buffers[bufferIndex].byteLength = bin.length;
    done.push({ mesh: g.mesh, square: [sq.x, sq.y, sq.side] });
  }
  if (!done.some((d) => d.square)) return { path, skipped: done.map((d) => d.skipped).join('; ') };
  writeGlb(path, J, glb.bin);
  const after = await measureFarGround(path);
  return { path, done, before: before.levels, after: after.levels };
};

const pad = (buf, fill) => { const n = Math.ceil(buf.length / 4) * 4; const out = Buffer.alloc(n, fill); buf.copy(out); return out; };

/** Writes a binary glTF: header, JSON chunk (space padded), BIN chunk (zero padded). */
const writeGlb = (path, json, bin) => {
  const j = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const b = pad(bin, 0);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(b.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  writeFileSync(path, Buffer.concat([head, jh, j, bh, b]));
};

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/art/improvement-far-ground.mjs')) {
  const args = process.argv.slice(2);
  const fix = args[0] === '--fix';
  const files = (fix ? args.slice(1) : args).length ? (fix ? args.slice(1) : args) : improvementFiles();
  for (const f of files) {
    if (fix) {
      const size = readFileSync(f).length;
      const r = await fixFarGround(f);
      if (r.skipped) { console.log(f, 'skipped:', r.skipped); continue; }
      const show = (ls) => ls.filter((l) => l.lod > 0).map((l) => `LOD${l.lod} ${l.rgb.join(',')} lum ${l.lum} opaque ${l.opaque}`).join(' | ');
      console.log(f, `${size} -> ${readFileSync(f).length} bytes`, JSON.stringify(r.done));
      console.log('  before', show(r.before));
      console.log('  after ', show(r.after));
    } else {
      const r = await measureFarGround(f);
      console.log(f.split('/').pop().padEnd(34), r.levels.map((l) => `LOD${l.lod} ${l.verts}v ${l.rgb.join(',')} lum ${l.lum} op ${l.opaque}`).join(' | '), r.dark.length ? 'DARK' : '');
    }
  }
}
