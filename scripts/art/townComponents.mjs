// scripts/art/townComponents.mjs
// Splits an assembled town model back into its buildings (plans/MASTER-PLAN.md phase B, the world
// plan section 7: "if a merged GLB has lost individual house boundaries, recover them"). The town
// assemblers (scripts/blender/assemble_kit_towns.py and the build_town_*.py builders) merge every
// house into one LOD0 mesh; each house is still its own set of connected triangles standing on
// its own ground plot. So: take LOD0's Town and Team triangles (not Ground, the town's patch),
// join triangles that share a corner, then join pieces whose ground rectangles overlap (a roof
// and its walls, a door, a chimney), and read each group's footprint and height.
//   house     an ordinary group (the town's poor, common and rich houses)
//   landmark  a group far bigger than the town's typical house (the kit's landmark-1 and -2,
//             or a big town's keep or temple), by footprint or height
//   prop      a group too small to be a building (a well, a cart, a pile of jars): left out
// Output per group: [x, z, w, d, h] in the model's own units (10 m), x east, z south (glTF),
// rounded to centimetres. Pure apart from reading the file.
import { readGlb, meshNodes, nodeTriangles, glbReady } from './glbGeometry.mjs';

export { glbReady };

// A group whose footprint (w x d) is below PROP_AREA of the town's median house is a prop.
export const PROP_AREA = 0.18;
// A group whose footprint is LANDMARK_AREA times the median, or LANDMARK_HEIGHT times its height,
// is a landmark (and at least LANDMARK_MIN_AREA model units square, so a town of huts has none
// by accident).
export const LANDMARK_AREA = 3.2;
export const LANDMARK_HEIGHT = 2.0;
export const LANDMARK_MIN_AREA = 0.9;

const find = (p, i) => { while (p[i] !== i) { p[i] = p[p[i]]; i = p[i]; } return i; };
const union = (p, a, b) => { const ra = find(p, a); const rb = find(p, b); if (ra !== rb) p[Math.max(ra, rb)] = Math.min(ra, rb); };

/** Pieces: { x0, x1, z0, z1, y0, y1 } bounding boxes of the connected triangle sets. */
export const pieces = (prims) => {
  const boxes = [];
  prims.forEach(({ positions, indices }) => {
    const n = positions.length / 3;
    const parent = Int32Array.from({ length: n }, (_, i) => i);
    // vertices split at uv seams share a position: weld them first
    const at = new Map();
    for (let i = 0; i < n; i++) {
      const key = `${Math.round(positions[i * 3] * 1e4)},${Math.round(positions[i * 3 + 1] * 1e4)},${Math.round(positions[i * 3 + 2] * 1e4)}`;
      const j = at.get(key);
      if (j === undefined) at.set(key, i); else union(parent, i, j);
    }
    for (let t = 0; t + 2 < indices.length; t += 3) { union(parent, indices[t], indices[t + 1]); union(parent, indices[t], indices[t + 2]); }
    const byRoot = new Map();
    for (let t = 0; t < indices.length; t++) {
      const v = indices[t];
      const r = find(parent, v);
      let b = byRoot.get(r);
      if (!b) { b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity }; byRoot.set(r, b); }
      const x = positions[v * 3]; const y = positions[v * 3 + 1]; const z = positions[v * 3 + 2];
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      if (z < b.z0) b.z0 = z; if (z > b.z1) b.z1 = z;
    }
    boxes.push(...byRoot.values());
  });
  return boxes;
};

// A building's base: a piece standing on the ground (its bottom below SEED_FLOOR), at least
// SEED_AREA square and SEED_HEIGHT tall. Flat paving and lone tufts are not bases.
export const SEED_FLOOR = 0.12;
export const SEED_AREA = 0.1;
export const SEED_HEIGHT = 0.12;
// A town with fewer than STILT_RETRY houses is read again with bases up to STILT_FLOOR high.
export const STILT_RETRY = 3;
export const STILT_FLOOR = 0.6;
const centreIn = (p, b, pad = 0) => {
  const cx = (p.x0 + p.x1) / 2; const cz = (p.z0 + p.z1) / 2;
  const px = (b.x1 - b.x0) * pad; const pz = (b.z1 - b.z0) * pad;
  return cx >= b.x0 - px && cx <= b.x1 + px && cz >= b.z0 - pz && cz <= b.z1 + pz;
};
const areaOf = (b) => (b.x1 - b.x0) * (b.z1 - b.z0);

/**
 * Group pieces into buildings: every base standing on the ground starts one (the larger first; a
 * base whose centre lies inside a larger one's joins it: a stepped temple, a tower on a hall), and
 * every other piece (a roof, a door, a parapet) joins the smallest building whose ground it stands
 * over, raising its height (its footprint stays the base's). Pieces over no building are props.
 * Returns the buildings' boxes and the count of loose pieces.
 */
export const joinBoxes = (boxes, floor = SEED_FLOOR) => {
  const seeds = boxes.filter((b) => b.y0 < floor && areaOf(b) >= SEED_AREA && b.y1 - b.y0 >= SEED_HEIGHT)
    .sort((a, b) => areaOf(b) - areaOf(a) || a.x0 - b.x0 || a.z0 - b.z0);
  const out = [];
  seeds.forEach((b) => {
    const host = out.find((o) => centreIn(b, o));
    if (host) host.y1 = Math.max(host.y1, b.y1);
    else out.push({ ...b, y0: Math.max(0, b.y0) });
  });
  let loose = 0;
  boxes.forEach((b) => {
    if (seeds.includes(b)) return;
    let best = null;
    out.forEach((o) => { if (centreIn(b, o, 0.05) && (!best || areaOf(o) < areaOf(best))) best = o; });
    if (best) best.y1 = Math.max(best.y1, b.y1); else loose += 1;
  });
  out.loose = loose;
  return out;
};

const r2 = (v) => Math.round(v * 100) / 100;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** Classify joined boxes: { houses: [[x, z, w, d, h]], landmarks: [...], props: n }. Houses and
 * landmarks in a stable order: by distance from the centre, then by angle (east first, counter-
 * clockwise seen from above with north up), so `house-0` is the house nearest the square. */
export const classify = (boxes) => {
  const items = boxes.map((b) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, w: b.x1 - b.x0, d: b.z1 - b.z0, h: b.y1 - Math.max(0, b.y0) }))
    .filter((b) => b.h > 0.02);
  const areas = items.map((b) => b.w * b.d);
  const big = median(areas.filter((a) => a > 0.05));
  const tall = median(items.filter((b) => b.w * b.d > 0.05).map((b) => b.h));
  const houses = []; const landmarks = []; let props = 0;
  items.forEach((b) => {
    const a = b.w * b.d;
    if (a < big * PROP_AREA) { props += 1; return; }
    if (a >= LANDMARK_MIN_AREA && (a >= big * LANDMARK_AREA || b.h >= tall * LANDMARK_HEIGHT)) landmarks.push(b);
    else houses.push(b);
  });
  const order = (list) => list
    .map((b) => ({ b, r: Math.hypot(b.x, b.z), a: (Math.atan2(-b.z, b.x) + 2 * Math.PI) % (2 * Math.PI) }))
    .sort((p, q) => p.r - q.r || p.a - q.a)
    .map(({ b }) => [r2(b.x), r2(b.z), r2(b.w), r2(b.d), r2(b.h)]);
  return { houses: order(houses), landmarks: order(landmarks), props: props + (boxes.loose || 0) };
};

/** The buildings of one town file (its first object's LOD0). */
export const townComponents = (path) => {
  const glb = readGlb(path);
  const nodes = meshNodes(glb).filter((n) => n.names.some((s) => /^LOD0/.test(s)));
  const cache = new Map();
  const prims = nodes.flatMap((n) => nodeTriangles(glb, n, cache)).filter((p) => p.material !== 'Ground');
  const all = pieces(prims);
  const town = classify(joinBoxes(all));
  // houses on stilts (the Monsoon and Pacific kits) have no base on the ground: their raised
  // floors start the buildings instead
  return town.houses.length >= STILT_RETRY ? town : classify(joinBoxes(all, STILT_FLOOR));
};
