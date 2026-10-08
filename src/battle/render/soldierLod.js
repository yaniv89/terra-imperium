// src/battle/render/soldierLod.js
// Level of detail for the mass of soldiers (plans/MASTER-PLAN.md 6.2, RTS plan 13.1 and 13.4).
// The battlefield camera is orthographic, so every soldier on screen is the same size: "distance"
// is the zoom, and one detail level per frame serves the whole field. Three levels per (age, class):
//   0 full    the model as authored (procedural or GLB), and the only level that casts shadows
//   1 mid     the same model simplified (edge collapse) within about a pixel of error
//   2 far     simplified further, a few hundred triangles that keep the class's silhouette
// The lower levels keep every rig attribute (limb, pivot, team, part, emblem uv, surface), so the
// same material animates and colours them, and they share the full level's per-instance buffers.
// pickSoldierTier() picks the finest level the soldiers' size on screen calls for that still fits
// the triangle budget for the figures in view.
import { BufferGeometry, BufferAttribute } from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';

// Soldier height on screen (css px) at which a finer level is worth drawing.
export const TIER_PX = [44, 18];
export const TIER_HYSTERESIS = 0.12;
// Target triangles per level: a cap the simplifier aims under while it stays within TIER_ERROR.
export const TIER_TRIS = [Infinity, 700, 260];
// The largest shape error a level may make, in model units (a soldier stands about 1 tall). One
// css px is about 2% of a soldier's height at 44 px (the mid level's top) and 5% at 18 px (the far
// level's top): the levels stay under a pixel or two, so a squad never changes shape at a switch.
export const TIER_ERROR = [0, 0.012, 0.03];

// Simplification (meshoptimizer, the quadric edge-collapse simplifier three ships as WASM). The old
// vertex clustering snapped a whole figure to a 3 or 4 cell grid at the far level: bodies, legs,
// horses and spears collapsed to nothing and only the team-coloured cloth (clustered on a finer
// grid) was left, so squads read as rows of blue arrows. Edge collapse keeps the silhouette: it
// removes the triangles that change the shape least first and stops at the error bound.
let simplifierReady = false;
const readyPromise = MeshoptSimplifier.ready.then(() => { simplifierReady = true; }, () => { simplifierReady = false; });
/** Resolves once the simplifier can build detail levels (a few ms of WASM set-up at start). */
export const soldierLodReady = () => readyPromise;
export const isSoldierLodReady = () => simplifierReady;

// Weld the flat-shaded soup (every triangle its own three vertices) into an indexed mesh: corners
// that share a position AND every rig and look attribute (limb, pivot, team, part, colour, emblem
// uv, surface) become one vertex. Parts of another colour or limb stay their own islands, so a
// swinging arm never stretches into the body and the tunic keeps its edge.
const weld = (geo) => {
  const names = Object.keys(geo.attributes).filter((n) => n !== 'normal');
  const attrs = names.map((n) => geo.attributes[n]);
  const pos = geo.attributes.position;
  const n = pos.count;
  const remap = new Uint32Array(n);
  const firsts = [];
  const keyOf = new Map();
  for (let i = 0; i < n; i++) {
    let key = '';
    for (let a = 0; a < attrs.length; a++) {
      const at = attrs[a]; const q = at === pos ? 1e4 : 1e3;
      for (let k = 0; k < at.itemSize; k++) key += `${Math.round(at.getComponent(i, k) * q)},`;
    }
    let v = keyOf.get(key);
    if (v === undefined) { v = firsts.length; keyOf.set(key, v); firsts.push(i); }
    remap[i] = v;
  }
  const idx = geo.index;
  const count = idx ? idx.count : n;
  const indices = new Uint32Array(count);
  for (let k = 0; k < count; k++) indices[k] = remap[idx ? idx.getX(k) : k];
  const positions = new Float32Array(firsts.length * 3);
  firsts.forEach((i, v) => { positions[v * 3] = pos.getX(i); positions[v * 3 + 1] = pos.getY(i); positions[v * 3 + 2] = pos.getZ(i); });
  return { names, indices, positions, firsts };
};

// Back to a flat-shaded soup (one face normal per triangle, the low-poly look of the full model).
const unweld = (geo, names, firsts, indices) => {
  const out = new BufferGeometry();
  names.forEach((name) => {
    const attr = geo.attributes[name]; const size = attr.itemSize;
    const arr = new Float32Array(indices.length * size);
    for (let k = 0; k < indices.length; k++) {
      const src = firsts[indices[k]];
      for (let c = 0; c < size; c++) arr[k * size + c] = attr.getComponent(src, c);
    }
    out.setAttribute(name, new BufferAttribute(arr, size));
  });
  out.computeVertexNormals();
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
};

// Spears, pikes, lances, bows and poles are thin: collapsing one to nothing moves it by less than its
// radius, far under the error bound, so the far level lost every spear and lance. They are what
// tells a spearman from a swordsman at a glance, and cost a few dozen triangles: any island (a
// connected part) long and thin against the error bound keeps all of its vertices.
const lockShafts = (indices, positions, maxError) => {
  const nv = positions.length / 3;
  const parent = new Int32Array(nv).map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let k = 0; k < indices.length; k += 3) {
    const a = find(indices[k]); const b = find(indices[k + 1]); const c = find(indices[k + 2]);
    parent[b] = a; parent[find(c)] = a;
  }
  const box = new Map();
  for (let v = 0; v < nv; v++) {
    const r = find(v); let b = box.get(r);
    if (!b) { b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; box.set(r, b); }
    for (let a = 0; a < 3; a++) { const x = positions[v * 3 + a]; if (x < b[a]) b[a] = x; if (x > b[a + 3]) b[a + 3] = x; }
  }
  const shaft = new Set();
  box.forEach((b, r) => {
    const ext = [b[3] - b[0], b[4] - b[1], b[5] - b[2]].sort((x, y) => x - y);
    if (ext[2] > 0.25 && ext[1] < Math.max(0.06, maxError * 2)) shaft.add(r);
  });
  const lock = new Uint8Array(nv);
  if (shaft.size) for (let v = 0; v < nv; v++) if (shaft.has(find(v))) lock[v] = 1;
  return lock;
};

const triangles = (geo) => (geo.index ? geo.index.count : geo.attributes.position.count) / 3;

// A copy of `geo` with at most `maxTris` triangles where the shape allows it within `maxError`
// (model units), or `geo` itself when it already fits. Thin parts that carry a figure's class (a
// spear, a bow, a horse's legs) are long, so they outlast the error bound; only details smaller
// than it (buckles, fingers, rivets) are pruned.
export const simplifyRigged = (geo, maxTris, maxError = TIER_ERROR[TIER_ERROR.length - 1]) => {
  if (triangles(geo) <= maxTris || !simplifierReady) return geo;
  const { names, indices, positions, firsts } = weld(geo);
  const target = Math.min(indices.length, Math.max(3, Math.floor(maxTris) * 3));
  const lock = lockShafts(indices, positions, maxError);
  const [out] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, new Float32Array(0), 0, [], lock, target, maxError, ['ErrorAbsolute', 'Prune']);
  if (!out.length || out.length >= indices.length) return geo;
  return unweld(geo, names, firsts, out);
};

export const triangleCount = triangles;

// [full, mid, far] for one soldier geometry, built once per geometry (GLB overrides outlive a
// battle, so the cache is keyed by the geometry object itself). Before the simplifier is ready
// every level is the full model (never a broken one), and nothing is cached.
const lodCache = new WeakMap();
export const soldierLodGeometries = (geo) => {
  let lods = lodCache.get(geo);
  if (!lods) {
    if (!simplifierReady) return [geo, geo, geo];
    const mid = simplifyRigged(geo, TIER_TRIS[1], TIER_ERROR[1]);
    lods = [geo, mid, simplifyRigged(mid, TIER_TRIS[2], TIER_ERROR[2])];
    lodCache.set(geo, lods);
  }
  return lods;
};

// The detail level for this frame. `px` is a soldier's height on screen in css px; `figures` how
// many soldiers are drawn this frame per layer and `tris[level]` their triangles per level, as
// [{ figures, tris: [t0, t1, t2] }]; `budget` the triangles the figures may use (level 0 counts
// twice: it also draws into the shadow map). `prev` is last frame's level, for hysteresis.
// `bias` (adaptive detail, BattleRenderer.adaptDetail): that many levels finer than the size on
// screen asks for; with a bias the budget is lifted 3x a level (the frame time is then the judge;
// the plain budget is the floor for slow devices).
export const pickSoldierTier = ({ px, layers, budget, prev = 2, bias = 0 }) => {
  const levels = TIER_TRIS.length;
  let tier = levels - 1;
  for (let k = 0; k < levels - 1; k++) {
    const need = TIER_PX[k] * (prev <= k ? 1 - TIER_HYSTERESIS : 1 + TIER_HYSTERESIS); // stay on a level until clearly past it
    if (px >= need) { tier = k; break; }
  }
  tier = Math.max(0, tier - bias);
  const lifted = budget * 3 ** bias;
  const cost = (k) => layers.reduce((s, l) => s + l.figures * l.tris[k] * (k === 0 ? 2 : 1), 0);
  // Coarser while over the budget; a finer level than last frame only with some room to spare.
  while (tier < levels - 1 && cost(tier) > lifted * (tier < prev ? 0.85 : 1)) tier += 1;
  return tier;
};
