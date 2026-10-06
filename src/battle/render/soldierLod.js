// src/battle/render/soldierLod.js
// Level of detail for the mass of soldiers (plans/MASTER-PLAN.md 6.2, RTS plan 13.1 and 13.4).
// The battlefield camera is orthographic, so every soldier on screen is the same size: "distance"
// is the zoom, and one detail level per frame serves the whole field. Three levels per (age, class):
//   0 full    the model as authored (procedural or GLB), and the only level that casts shadows
//   1 mid     the same model clustered down to a few hundred triangles
//   2 far     clustered down to a silhouette of about 60 triangles
// The lower levels keep every rig attribute (limb, pivot, team, part, emblem uv, surface), so the
// same material animates and colours them, and they share the full level's per-instance buffers.
// pickSoldierTier() picks the finest level the soldiers' size on screen calls for that still fits
// the triangle budget for the figures in view.
import { BufferGeometry, BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute } from 'three';

// Soldier height on screen (css px) at which a finer level is worth drawing.
export const TIER_PX = [44, 18];
export const TIER_HYSTERESIS = 0.12;
// Target triangles per level (the cap the clustering aims under).
export const TIER_TRIS = [Infinity, 360, 64];

// Vertex clustering: snap vertices to a grid (separately per rig limb, team and part flag, so arms
// still swing and tunics still take the side's colour), merge each cell to one vertex (mean
// position, mean normal, the first vertex's other attributes) and drop the triangles that
// collapse. Deterministic, attribute-agnostic and fast enough to run once per battle.
const clusterOnce = (geo, cells) => {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const n = pos.count;
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const size = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) || 1;
  const cell = size / cells;
  const limb = geo.attributes.aLimb; const team = geo.attributes.aTeam; const part = geo.attributes.aPart;
  const look = geo.attributes.aLook; // packed team/part (packForGPU)
  const keyOf = new Map();
  const clusterOf = new Int32Array(n);
  const members = [];
  for (let i = 0; i < n; i++) {
    const l = limb ? limb.getX(i) : 0;
    const t = team ? team.getX(i) : look ? look.getX(i) : 0;
    // The side's colour (tunic, shield) is what tells two tiny armies apart: a finer grid there.
    const g = t > 0.5 ? cell / 2 : cell;
    const ix = Math.floor((pos.getX(i) - min.x) / g); const iy = Math.floor((pos.getY(i) - min.y) / g); const iz = Math.floor((pos.getZ(i) - min.z) / g);
    const p = part ? part.getX(i) : look ? look.getY(i) : 0;
    const key = `${ix},${iy},${iz},${l},${t > 0.5 ? 1 : 0},${Math.round(p)}`;
    let c = keyOf.get(key);
    if (c === undefined) { c = members.length; keyOf.set(key, c); members.push([]); }
    clusterOf[i] = c;
    members[c].push(i);
  }
  const triCount = idx ? idx.count / 3 : n / 3;
  const tris = [];
  const seen = new Set();
  for (let t = 0; t < triCount; t++) {
    const a = clusterOf[idx ? idx.getX(t * 3) : t * 3];
    const b = clusterOf[idx ? idx.getX(t * 3 + 1) : t * 3 + 1];
    const c = clusterOf[idx ? idx.getX(t * 3 + 2) : t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((x, y) => x - y).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    tris.push(a, b, c);
  }
  return { members, tris };
};

const buildClustered = (geo, { members, tris }) => {
  // Only the clusters some triangle still uses become vertices.
  const used = new Int32Array(members.length).fill(-1);
  const order = [];
  tris.forEach((c) => { if (used[c] < 0) { used[c] = order.length; order.push(c); } });
  const out = new BufferGeometry();
  Object.entries(geo.attributes).forEach(([name, attr]) => {
    const size = attr.itemSize;
    const arr = new Float32Array(order.length * size);
    order.forEach((c, v) => {
      const ms = members[c];
      if (name === 'position' || name === 'normal') {
        for (let k = 0; k < size; k++) { let s = 0; ms.forEach((i) => { s += attr.getComponent(i, k); }); arr[v * size + k] = s / ms.length; }
        if (name === 'normal') {
          const len = Math.hypot(arr[v * 3], arr[v * 3 + 1], arr[v * 3 + 2]);
          if (len > 1e-3) for (let k = 0; k < 3; k++) arr[v * 3 + k] /= len;
          else for (let k = 0; k < 3; k++) arr[v * 3 + k] = attr.getComponent(ms[0], k); // opposite faces cancelled out
        }
      } else {
        for (let k = 0; k < size; k++) arr[v * size + k] = attr.getComponent(ms[0], k);
      }
    });
    out.setAttribute(name, new BufferAttribute(arr, size));
  });
  const index = tris.map((c) => used[c]);
  out.setIndex(order.length > 65535 ? new Uint32BufferAttribute(index, 1) : new Uint16BufferAttribute(index, 1));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
};

const triangles = (geo) => (geo.index ? geo.index.count : geo.attributes.position.count) / 3;

// A copy of `geo` with at most `maxTris` triangles (or `geo` itself when it already fits): the
// finest clustering grid that comes in under the cap.
export const simplifyRigged = (geo, maxTris) => {
  if (triangles(geo) <= maxTris) return geo;
  let lo = 2; let hi = 96; let best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = clusterOnce(geo, mid);
    if (r.tris.length / 3 <= maxTris) { best = r; lo = mid + 1; } else hi = mid - 1;
  }
  return buildClustered(geo, best || clusterOnce(geo, 2));
};

export const triangleCount = triangles;

// [full, mid, far] for one soldier geometry, built once per geometry (GLB overrides outlive a
// battle, so the cache is keyed by the geometry object itself).
const lodCache = new WeakMap();
export const soldierLodGeometries = (geo) => {
  let lods = lodCache.get(geo);
  if (!lods) {
    lods = [geo, simplifyRigged(geo, TIER_TRIS[1]), simplifyRigged(geo, TIER_TRIS[2])];
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
