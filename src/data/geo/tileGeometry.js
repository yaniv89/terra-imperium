// src/data/geo/tileGeometry.js
// Turns tile ownership into map geometry (plans/civ-map-rework.md, B4b): territories as GeoJSON
// MultiPolygons whose rings follow the cell boundaries, borders as the same rings, and the hex
// mesh as one MultiLineString. GeoJSON so d3-geo clips the antimeridian for the flat map and
// react-globe.gl can draw the very same shapes on the globe.
//
// Corners are identified by the three cells that meet there (a sorted id triple), so chaining
// boundary edges into closed rings is exact: no floating-point snapping. Rings come out with the
// owned land on the left when walking them (counter-clockwise seen from outside the sphere) and
// are reversed for d3-geo, whose exterior rings are clockwise.
import { cellPolygon } from './geodesic';

const cornerKey = (a, b, c) => {
  const s = a < b ? (b < c ? [a, b, c] : a < c ? [a, c, b] : [c, a, b]) : (a < c ? [b, a, c] : b < c ? [b, c, a] : [c, b, a]);
  return `${s[0]}-${s[1]}-${s[2]}`;
};

// Polygon corners of every cell as lon/lat, cached on the tiles object.
const cornersOf = (tiles, id) => {
  const cache = tiles._corners || (tiles._corners = new Map());
  let c = cache.get(id);
  if (!c) {
    c = cellPolygon(tiles.centres, tiles.neighbors, id).map((v) => {
      const lat = (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI;
      const lon = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
      return [lon, lat];
    });
    cache.set(id, c);
  }
  return c;
};

// Every boundary edge of `ownerOf` (a function id -> owner or null), as directed segments with the
// owner's cell on the left: { owner, from, to, a, b } where a and b are corner keys and from/to
// lon/lat points. An edge between two different owners yields one segment per owner.
export const boundaryEdges = (tiles, ownerOf) => {
  const out = [];
  const n = tiles.count;
  for (let i = 0; i < n; i++) {
    const owner = ownerOf(i);
    if (owner == null) continue;
    const ns = tiles.neighbors[i];
    const corners = cornersOf(tiles, i);
    const m = ns.length;
    for (let k = 0; k < m; k++) {
      const j = ns[k];
      if (ownerOf(j) === owner) continue;
      // The edge toward neighbour k runs from corner k-1 (cells i, ns[k-1], ns[k]) to corner k
      // (cells i, ns[k], ns[k+1]); the cell is on the left walking that way.
      const kPrev = (k - 1 + m) % m; const kNext = (k + 1) % m;
      out.push({
        owner, cell: i, neighbor: j,
        a: cornerKey(i, ns[kPrev], ns[k]), b: cornerKey(i, ns[k], ns[kNext]),
        from: corners[kPrev], to: corners[k]
      });
    }
  }
  return out;
};

// Chains an owner's segments into closed rings (lon/lat), owned land on the left.
export const chainRings = (segments) => {
  const byStart = new Map();
  segments.forEach((s) => { (byStart.get(s.a) || byStart.set(s.a, []).get(s.a)).push(s); });
  const used = new Set();
  const rings = [];
  segments.forEach((start) => {
    if (used.has(start)) return;
    const ring = [start.from];
    let cur = start;
    for (let guard = 0; guard < 200000; guard++) {
      used.add(cur);
      ring.push(cur.to);
      if (cur.b === start.a) break;
      const nexts = byStart.get(cur.b) || [];
      // At a pinch (two owned cells touching only at this corner) keep going round the same cell,
      // so each connected piece of land closes its own ring.
      const next = nexts.find((s) => !used.has(s) && s.cell === cur.cell) || nexts.find((s) => !used.has(s));
      if (!next) break;
      cur = next;
    }
    if (ring.length >= 4) rings.push(ring);
  });
  return rings;
};

// Signed area in lon/lat space (positive = counter-clockwise with latitude up). Exterior rings of a
// territory are counter-clockwise, holes clockwise; d3-geo wants the opposite, so callers reverse.
const signedArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
};

// Rings that cross the antimeridian have points far apart in longitude; d3-geo handles them as
// long as consecutive points are the short way round, so unwrap each ring to be continuous.
const unwrap = (ring) => {
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
};

/**
 * Territories: one GeoJSON Feature per owner, geometry MultiPolygon, rings oriented for d3-geo
 * (exterior clockwise, holes anticlockwise). `ownerOf(id)` returns an owner id or null.
 */
export const buildTerritories = (tiles, ownerOf) => {
  const edges = boundaryEdges(tiles, ownerOf);
  const byOwner = new Map();
  edges.forEach((e) => { (byOwner.get(e.owner) || byOwner.set(e.owner, []).get(e.owner)).push(e); });
  const features = [];
  byOwner.forEach((segments, owner) => {
    const rings = chainRings(segments).map(unwrap);
    const exteriors = []; const holes = [];
    rings.forEach((r) => (signedArea(r) > 0 ? exteriors : holes).push(r));
    // Each hole belongs to the exterior that contains its first point (ray cast in lon/lat).
    const polygons = exteriors.map((ext) => [ext.slice().reverse()]);
    holes.forEach((hole) => {
      const [x, y] = hole[0];
      const idx = exteriors.findIndex((ext) => pointInRing(ext, x, y));
      if (idx >= 0) polygons[idx].push(hole.slice().reverse());
    });
    features.push({ type: 'Feature', id: owner, properties: { owner, rings: rings.length }, geometry: { type: 'MultiPolygon', coordinates: polygons } });
  });
  return features;
};

const pointInRing = (ring, x, y) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Borders between different owners (and the edge of owned land): one MultiLineString, each
 * physical edge once. */
export const buildBorders = (tiles, ownerOf) => {
  const seen = new Set();
  const lines = [];
  boundaryEdges(tiles, ownerOf).forEach((e) => {
    const key = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(unwrap([e.from, e.to]));
  });
  return { type: 'MultiLineString', coordinates: lines };
};

/** The whole hex mesh (every edge once) as a MultiLineString, for the faint grid overlay. Land
 * only by default, since the sea grid is noise on a realistic map. */
export const buildHexMesh = (tiles, { landOnly = true } = {}) => {
  const lines = [];
  for (let i = 0; i < tiles.count; i++) {
    if (landOnly && !tiles.land[i]) continue;
    const ns = tiles.neighbors[i];
    const corners = cornersOf(tiles, i);
    const m = ns.length;
    for (let k = 0; k < m; k++) {
      const j = ns[k];
      if (j < i && (!landOnly || tiles.land[j])) continue; // drawn from the other side
      lines.push(unwrap([corners[(k - 1 + m) % m], corners[k]]));
    }
  }
  return { type: 'MultiLineString', coordinates: lines };
};

/** A cell as a GeoJSON Polygon (for highlights and hit areas). */
export const cellFeature = (tiles, id) => {
  const ring = unwrap([...cornersOf(tiles, id), cornersOf(tiles, id)[0]]);
  return { type: 'Feature', id, geometry: { type: 'Polygon', coordinates: [ring.slice().reverse()] } };
};
