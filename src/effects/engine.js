// src/effects/engine.js
// The shared toolkit every action choreography (src/effects/scenes/) is written against. One
// scene implementation drives BOTH map renderers: the 3D globe and the flat map each supply a
// `project(lat, lng, alt)` function (EffectsLayer.jsx's `getProjector`), and everything a scene
// draws is expressed in lat/lng + screen-pixel offsets on top of that. Flights between two places
// are computed on the unit sphere (a lofted Bezier between direction vectors, the same math the
// original missile arc used), so a trade caravan or an invasion column bends over the curvature
// of the Earth on the globe and still reads as a gentle arc on the flat map.
//
// Elements are created ONCE per effect (scene.build) and only have attributes updated per frame
// (scene.draw) — see GlobeEffectsOverlay.jsx's history for why clearing and rebuilding the SVG
// every frame raced the compositor and produced blank frames.

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const DEG = Math.PI / 180;
export const BASE_ALTITUDE = 0.015; // just clear of the globe's extruded region polygons

// ---------- small numeric helpers ----------
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// Progress of a sub-phase: 0 before `start`, 1 after `start + dur`.
export const phase = (t, start, dur) => clamp((t - start) / dur, 0, 1);
// 0 -> 1 -> 0 over a window: fades a piece in, holds it, fades it out.
export const envelope = (t, start, dur, fadeIn = 0.15, fadeOut = 0.25) => {
  const u = (t - start) / dur;
  if (u <= 0 || u >= 1) return 0;
  if (u < fadeIn) return u / fadeIn;
  if (u > 1 - fadeOut) return (1 - u) / fadeOut;
  return 1;
};
// Deterministic pseudo-random in [0,1) from integers — scenes must look the same every frame,
// so no Math.random() at draw time.
export const hash = (a, b = 0) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBounce: (t) => {
    const n1 = 7.5625; const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
    if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
    t -= 2.625 / d1; return n1 * t * t + 0.984375;
  },
  accelerate: (t) => Math.pow(t, 1.45),
  smooth: (t) => t * t * (3 - 2 * t)
};

// ---------- SVG construction ----------
export const setAttrs = (el, attrs) => { Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); };
export const make = (name, attrs) => {
  const node = document.createElementNS(SVG_NS, name);
  if (attrs) setAttrs(node, attrs);
  return node;
};
export const HIDDEN = { opacity: 0 };
export const hide = (...els) => els.forEach((el) => el && el.setAttribute('opacity', 0));

const ICON_VIEWBOX = 512;
// A game-icons.net path (0..512 viewBox) wrapped in a group whose transform `placeIcon` sets.
export const makeIcon = (parent, d, fill, extra = {}) => {
  const g = make('g', { opacity: 0 });
  if (d) g.appendChild(make('path', { d, fill, ...extra }));
  parent.appendChild(g);
  return g;
};
// Centres an icon on (x, y) at `size` screen pixels wide, optionally rotated/squashed.
export const placeIcon = (g, x, y, size, { rotate = 0, opacity = 1, sx = 1, sy = 1 } = {}) => {
  if (opacity <= 0.001 || size <= 0.01 || !Number.isFinite(x) || !Number.isFinite(y)) { g.setAttribute('opacity', 0); return; }
  const k = size / ICON_VIEWBOX;
  setAttrs(g, {
    opacity: opacity.toFixed(3),
    transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate.toFixed(1)}) scale(${(k * sx).toFixed(4)} ${(k * sy).toFixed(4)}) translate(-256 -256)`
  });
};

export const polyPoints = (pts) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

// ---------- sphere math (mirrors three-globe's conventions) ----------
export const latLngToVec = (lat, lng) => {
  const phi = (90 - lat) * DEG;
  const theta = (90 - lng) * DEG;
  const s = Math.sin(phi);
  return { x: s * Math.cos(theta), y: Math.cos(phi), z: s * Math.sin(theta) };
};
export const vecToLatLng = (v) => {
  const r = Math.hypot(v.x, v.y, v.z) || 1;
  const theta = Math.atan2(v.z, v.x);
  return {
    lat: 90 - Math.acos(clamp(v.y / r, -1, 1)) / DEG,
    lng: 90 - theta / DEG - (theta < -Math.PI / 2 ? 360 : 0)
  };
};
export const normalize = (v) => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
export const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const mix3 = (a, b, c, wa, wb, wc) => ({ x: a.x * wa + b.x * wb + c.x * wc, y: a.y * wa + b.y * wb + c.y * wc, z: a.z * wa + b.z * wb + c.z * wc });
const bezierDir = (a, ctrl, b, t) => { const u = 1 - t; return normalize(mix3(a, ctrl, b, u * u, 2 * u * t, t * t)); };

// One flight between two lat/lngs: `lateral` bows it sideways, `loft` lifts it off the ground
// (0 = hugs the surface, like a marching column), `spread` scatters the landing point, `archPow`
// shifts the apex earlier (<1) or later (>1). Returns a sampler usable every frame.
export const makeTrajectory = (from, to, { lateral = 0, loft = 0, spread = 0, archPow = 1 } = {}) => {
  const a = latLngToVec(from.lat, from.lng);
  const rawB = latLngToVec(to.lat, to.lng);
  const angle = Math.acos(clamp(dot(a, rawB), -1, 1));
  let perp = cross(a, rawB);
  if (Math.hypot(perp.x, perp.y, perp.z) < 1e-6) perp = cross(a, Math.abs(a.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 });
  perp = normalize(perp);
  const tangent = normalize(cross(perp, rawB));
  const b = spread
    ? normalize({ x: rawB.x + perp.x * spread + tangent.x * spread * 0.4, y: rawB.y + perp.y * spread + tangent.y * spread * 0.4, z: rawB.z + perp.z * spread + tangent.z * spread * 0.4 })
    : rawB;
  const mid = normalize({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const bow = Math.max(angle, 0.035) * 0.42 * lateral;
  const ctrl = normalize({ x: mid.x + perp.x * bow, y: mid.y + perp.y * bow, z: mid.z + perp.z * bow });
  const apex = loft * (0.045 + angle * 0.3);
  return {
    angle,
    // { lat, lng, alt } at parameter t in [0, 1]
    at: (t) => {
      const ll = vecToLatLng(bezierDir(a, ctrl, b, t));
      return { lat: ll.lat, lng: ll.lng, alt: BASE_ALTITUDE + apex * Math.sin(Math.PI * Math.pow(clamp(t, 0, 1), archPow)) };
    }
  };
};

// Screen-space samples of a trajectory from t0 to t1, stopping where it dips behind the globe's
// horizon (so a polyline never jumps across the sphere). Head-first when `fromHead` is set.
export const sampleTrajectory = (f, traj, t0, t1, samples = 22) => {
  const pts = [];
  for (let s = 0; s <= samples; s += 1) {
    const t = t0 + ((t1 - t0) * s) / samples;
    const p = traj.at(t);
    const sc = f.project(p.lat, p.lng, p.alt);
    if (!sc.visible) { if (pts.length) break; continue; }
    pts.push(sc);
  }
  return pts;
};

// The point at t plus its screen heading (degrees), for orienting a travelling prop.
export const pointOnTrajectory = (f, traj, t) => {
  const p = traj.at(t);
  const sc = f.project(p.lat, p.lng, p.alt);
  const q = traj.at(Math.min(1, t + 0.01));
  const sq = f.project(q.lat, q.lng, q.alt);
  const back = t >= 0.99 ? f.project(traj.at(t - 0.01).lat, traj.at(t - 0.01).lng, traj.at(t - 0.01).alt) : null;
  const heading = back
    ? Math.atan2(sc.y - back.y, sc.x - back.x) / DEG
    : Math.atan2(sq.y - sc.y, sq.x - sc.x) / DEG;
  return { ...sc, heading };
};
