// src/components/map/closeView/mountainModels.js
// Phase F: the close view's mountain chains and foothills (world plan 5) as low-poly meshes built
// in code, the placeholder for the `map-terrain/mountain-ridges` and `map-terrain/hills` kits of
// ART-PRODUCTION-PLAN batches 14 and 27 (they will arrive as src/assets/map/terrain/
// mountain-ridges.glb and hills.glb, spec S11). A ridge is ELONGATED along model x (2 units long,
// about 1.1 wide, its crest along x), so the placement (terrainPlacement.js) turns it along the
// ridge line of the grid and overlaps neighbours into one chain; never one cone per tile.
// Faceted (flat normals) with vertex colours: grass at the foot, rock, snow on the snowy variant.
import { BufferGeometry, Float32BufferAttribute, Color } from 'three';

import { RIDGE_LENGTH } from './terrainPlacement';

export { RIDGE_LENGTH };
export const RIDGE_HEIGHT = 1.15;
export const RIDGE_VARIANTS = 3;

const FOOT = new Color('#6b7a4a'); const ROCK = new Color('#8a7a66'); const DARK = new Color('#5f5246'); const SNOW = new Color('#f1f5f9');

// A heightfield over [-1, 1] x [-w, w] made of flat-shaded triangles.
const heightfield = ({ nx, nz, w, height, colourAt }) => {
  const pos = []; const col = [];
  const P = (i, j) => { const x = -1 + (2 * i) / nx; const z = -w + (2 * w * j) / nz; return [x, height(x, z), z]; };
  const tri = (a, b, c) => {
    const hMax = Math.max(a[1], b[1], c[1]);
    if (hMax <= 1e-4) return; // flat ground round the foot: the map shows through
    const ux = b[0] - a[0]; const uy = b[1] - a[1]; const uz = b[2] - a[2];
    const vx = c[0] - a[0]; const vy = c[1] - a[1]; const vz = c[2] - a[2];
    const ny = uz * vx - ux * vz; const len = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx) || 1;
    const colour = colourAt((a[1] + b[1] + c[1]) / 3, hMax, ny / len);
    [a, b, c].forEach((p) => { pos.push(p[0], p[1], p[2]); col.push(colour.r, colour.g, colour.b); });
  };
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = P(i, j); const b = P(i + 1, j); const c = P(i + 1, j + 1); const d = P(i, j + 1);
      // counter-clockwise seen from above (+y)
      tri(a, d, c); tri(a, c, b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

const cache = new Map();
/** A ridge mesh: `variant` 0..2 (crest shape), `snow` a white cap above 62% of its height. */
export const getRidgeGeometry = (variant, snow) => {
  const key = `ridge|${variant}|${snow ? 1 : 0}`;
  if (cache.has(key)) return cache.get(key);
  const v = variant % RIDGE_VARIANTS;
  // a chain of pointed summits along the crest: [x, height share, half length], each an
  // elongated cone, the ridge their union (jagged, never a flat-topped wall)
  const summits = [
    [[-0.55, 0.7, 0.5], [-0.1, 1, 0.6], [0.45, 0.8, 0.55]],
    [[-0.6, 0.85, 0.45], [0.05, 0.65, 0.5], [0.55, 1, 0.5]],
    [[-0.45, 1, 0.6], [0.25, 0.75, 0.5], [0.7, 0.55, 0.35]]
  ][v];
  const w = 0.5;
  const height = (x, z) => summits.reduce((m, [sx, sh, ax]) => {
    const d = Math.sqrt(((x - sx) / ax) ** 2 + (z / w) ** 2);
    return Math.max(m, RIDGE_HEIGHT * sh * Math.max(0, 1 - d) ** 1.15);
  }, 0);
  const colourAt = (h, hMax, up) => {
    const t = h / RIDGE_HEIGHT;
    if (snow && hMax / RIDGE_HEIGHT > 0.62 && t > 0.5) return SNOW;
    const base = t < 0.12 ? FOOT : ROCK;
    return up < 0.55 ? base.clone().lerp(DARK, 0.5) : base;
  };
  const g = heightfield({ nx: 20, nz: 8, w, height, colourAt });
  cache.set(key, g);
  return g;
};

/** A foothill: a low rounded mound, 2 units across, green at the foot. */
export const getHillGeometry = () => {
  if (cache.has('hill')) return cache.get('hill');
  const g = heightfield({
    nx: 8, nz: 8, w: 1,
    height: (x, z) => 0.6 * Math.max(0, 1 - (x * x + z * z)) ** 1.4,
    colourAt: (h, hMax, up) => FOOT.clone().lerp(ROCK, Math.min(1, h * 1.2)).lerp(DARK, up < 0.75 ? 0.3 : 0)
  });
  cache.set('hill', g);
  return g;
};
