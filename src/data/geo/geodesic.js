// src/data/geo/geodesic.js
// The world grid of the Civ-style map (plans/civ-map-rework.md, B2): a class-I geodesic
// subdivision of the icosahedron. Frequency f gives 10 f² + 2 cells (12 pentagons, the rest
// hexagons), all of nearly equal area, with no poles problem. Cells are the VERTICES of the
// subdivided icosahedron; a cell's polygon is the dual (one corner per surrounding triangle).
//
// Pure math, no data: the build script (scripts/geo/build-tiles.mjs) uses it to generate the grid
// once, and the client uses it to turn a tile's centre and neighbour ids back into a polygon for
// rendering, so only centres and neighbours need to be shipped. Everything is deterministic
// (no randomness, integer-keyed dedupe), so the tile ids are stable for a given frequency and
// orientation.
import { sinCosDeg, asinExact } from '../../utils/exactMath.js';

// Icosahedron with a vertex at each pole: the 12 vertices are the two poles and two rings of five
// at latitude ±atan(1/2). `rotation` turns the whole solid about the polar axis by that many
// degrees and `tilt` then tips it about the x axis, which is how the build picks an orientation
// that keeps the 12 pentagons out of important land (B2).
export const icosahedronVertices = ({ rotation = 0, tilt = 0 } = {}) => {
  const verts = [[0, 0, 1], [0, 0, -1]];
  const z = 1 / Math.sqrt(5);
  const r = 2 / Math.sqrt(5);
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180;
    verts.push([r * Math.cos(a), r * Math.sin(a), z]);
    const b = ((i * 72 + 36) * Math.PI) / 180;
    verts.push([r * Math.cos(b), r * Math.sin(b), -z]);
  }
  const rot = (rotation * Math.PI) / 180;
  const tl = (tilt * Math.PI) / 180;
  return verts.map(([x, y, zz]) => {
    const x1 = x * Math.cos(rot) - y * Math.sin(rot);
    const y1 = x * Math.sin(rot) + y * Math.cos(rot);
    const y2 = y1 * Math.cos(tl) - zz * Math.sin(tl);
    const z2 = y1 * Math.sin(tl) + zz * Math.cos(tl);
    return [x1, y2, z2];
  });
};

// The 20 faces as index triples into icosahedronVertices (north pole 0, south pole 1, upper ring
// 2,4,6,8,10, lower ring 3,5,7,9,11).
export const ICOSAHEDRON_FACES = (() => {
  const faces = [];
  for (let i = 0; i < 5; i++) {
    const u = 2 + i * 2; const uNext = 2 + ((i + 1) % 5) * 2;
    const l = 3 + i * 2; const lNext = 3 + ((i + 1) % 5) * 2;
    faces.push([0, u, uNext]);      // polar cap, north
    faces.push([u, l, uNext]);      // upper belt
    faces.push([uNext, l, lNext]);  // lower belt
    faces.push([1, lNext, l]);      // polar cap, south
  }
  return faces;
})();

const normalize = (v) => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

export const toLatLon = ([x, y, z]) => ({
  lat: (Math.asin(Math.max(-1, Math.min(1, z))) * 180) / Math.PI,
  lon: (Math.atan2(y, x) * 180) / Math.PI
});

export const fromLatLon = (lat, lon) => {
  const la = (lat * Math.PI) / 180; const lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
};

// The same unit vector with trigonometry that agrees to the last bit on every JavaScript engine
// (exactMath.js). The tile centres the engine measures distances with are built with it.
export const fromLatLonExact = (lat, lon) => {
  const [sLa, cLa] = sinCosDeg(lat); const [sLo, cLo] = sinCosDeg(lon);
  return [cLa * cLo, cLa * sLo, sLa];
};

export const cellCount = (frequency) => 10 * frequency * frequency + 2;

// Builds the grid: unit vectors for every cell centre and each cell's neighbours, ordered
// counter-clockwise seen from outside the sphere (so consecutive neighbours share a triangle,
// which is what cellPolygon needs). Shared edge and corner vertices are deduplicated by a
// quantised key, which is exact because the same barycentric point on a shared edge is computed
// from the same two icosahedron vertices on both faces.
export const buildGrid = (frequency, orientation = {}) => {
  const base = icosahedronVertices(orientation);
  const f = frequency;
  const index = new Map();
  const centres = [];
  const keyOf = (v) => `${Math.round(v[0] * 1e7)},${Math.round(v[1] * 1e7)},${Math.round(v[2] * 1e7)}`;
  const idOf = (v) => {
    const k = keyOf(v);
    let id = index.get(k);
    if (id === undefined) { id = centres.length; index.set(k, id); centres.push(v); }
    return id;
  };
  const adjacency = [];
  const link = (a, b) => {
    (adjacency[a] ||= new Set()).add(b);
    (adjacency[b] ||= new Set()).add(a);
  };
  ICOSAHEDRON_FACES.forEach(([ia, ib, ic]) => {
    const A = base[ia]; const B = base[ib]; const C = base[ic];
    // ids[i][j] for i + j <= f
    const ids = [];
    for (let i = 0; i <= f; i++) {
      ids.push([]);
      for (let j = 0; j <= f - i; j++) {
        const k = f - i - j;
        const v = normalize([
          (A[0] * k + B[0] * i + C[0] * j) / f,
          (A[1] * k + B[1] * i + C[1] * j) / f,
          (A[2] * k + B[2] * i + C[2] * j) / f
        ]);
        ids[i].push(idOf(v));
      }
    }
    for (let i = 0; i <= f; i++) {
      for (let j = 0; j <= f - i; j++) {
        if (i + 1 <= f && j <= f - i - 1) link(ids[i][j], ids[i + 1][j]);
        if (j + 1 <= f - i) link(ids[i][j], ids[i][j + 1]);
        if (i + 1 <= f && j + 1 <= f - i - 1 + 1 && i + 1 + j <= f) link(ids[i + 1][j], ids[i][j + 1]);
      }
    }
  });
  if (centres.length !== cellCount(f)) throw new Error(`geodesic: expected ${cellCount(f)} cells, got ${centres.length}`);
  // Order each cell's neighbours counter-clockwise around the outward normal.
  const neighbors = centres.map((c, id) => {
    const list = [...adjacency[id]];
    // Tangent basis at c.
    const up = Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1 = normalize([up[1] * c[2] - up[2] * c[1], up[2] * c[0] - up[0] * c[2], up[0] * c[1] - up[1] * c[0]]);
    const e2 = [c[1] * e1[2] - c[2] * e1[1], c[2] * e1[0] - c[0] * e1[2], c[0] * e1[1] - c[1] * e1[0]];
    const angle = (n) => {
      const v = centres[n];
      return Math.atan2(v[0] * e2[0] + v[1] * e2[1] + v[2] * e2[2], v[0] * e1[0] + v[1] * e1[1] + v[2] * e1[2]);
    };
    return list.sort((a, b) => angle(a) - angle(b));
  });
  return { frequency: f, centres, neighbors };
};

// A cell's polygon corners (unit vectors), one per pair of consecutive neighbours: the centroid
// of the triangle (cell, n_k, n_k+1), which is the dual cell of the triangulation.
export const cellPolygon = (centres, neighbors, id) => {
  const c = centres[id];
  const ns = neighbors[id];
  return ns.map((n, k) => {
    const m = centres[ns[(k + 1) % ns.length]];
    const v = centres[n];
    return normalize([c[0] + v[0] + m[0], c[1] + v[1] + m[1], c[2] + v[2] + m[2]]);
  });
};

// Great-circle distance in km between two unit vectors, from the chord: 2 R asin(|a - b| / 2).
// Unlike acos of the dot product it is accurate for neighbouring tiles and gives the same last bit
// on every engine (exactMath.js), so the engine may compare and weigh with it.
export const EARTH_RADIUS_KM = 6371;
export const distanceKm = (a, b) => {
  const dx = a[0] - b[0]; const dy = a[1] - b[1]; const dz = a[2] - b[2];
  return 2 * EARTH_RADIUS_KM * asinExact(Math.sqrt(dx * dx + dy * dy + dz * dz) / 2);
};

// A coarse lat/lon bucket index for nearest-cell queries (used by the build and by the client's
// hit test). Buckets are `step` degrees; a query looks at the 3x3 buckets around the point.
export const buildLatLonIndex = (centres, step = 2) => {
  const buckets = new Map();
  const key = (lat, lon) => `${Math.floor((lat + 90) / step)},${Math.floor((lon + 180) / step)}`;
  centres.forEach((c, id) => {
    const { lat, lon } = toLatLon(c);
    const k = key(lat, lon);
    (buckets.get(k) || buckets.set(k, []).get(k)).push(id);
  });
  const nearest = (lat, lon, count = 1) => {
    const v = fromLatLon(lat, lon);
    const bl = Math.floor((lat + 90) / step); const bo = Math.floor((lon + 180) / step);
    const cols = Math.ceil(360 / step);
    const found = [];
    const visit = (k) => {
      const list = buckets.get(k);
      if (!list) return;
      list.forEach((id) => {
        const c = centres[id];
        found.push([c[0] * v[0] + c[1] * v[1] + c[2] * v[2], id]);
      });
    };
    if (Math.abs(lat) > 75) {
      // Near the poles a longitude bucket is only a few km wide, so the 3x3 neighbourhood can be
      // empty: look at every longitude in the nearby rows instead (a few hundred cells at most).
      for (let row = Math.max(0, bl - 2); row <= Math.min(Math.floor(180 / step), bl + 2); row++) {
        for (let col = 0; col < cols; col++) visit(`${row},${col}`);
      }
    } else {
      for (let dl = -1; dl <= 1; dl++) {
        for (let dn = -1; dn <= 1; dn++) visit(`${bl + dl},${((bo + dn) % cols + cols) % cols}`);
      }
    }
    found.sort((a, b) => b[0] - a[0]);
    return count === 1 ? (found[0] ? found[0][1] : -1) : found.slice(0, count).map((x) => x[1]);
  };
  return { nearest };
};
