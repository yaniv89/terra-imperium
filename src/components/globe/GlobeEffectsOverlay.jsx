// src/components/globe/GlobeEffectsOverlay.jsx
// Phase 14 combat effects (missile/airstrike/invasion) for the globe view.
//
// WHY SVG AND NOT THREE.JS: this does NOT use react-globe.gl's built-in arcsData/ringsData, nor a
// custom Three.js object injected into its scene graph — both were built, and both were verified
// (via direct Three.js scene inspection: correct geometry, correct world position on the globe
// surface, correct color, opacity, and visibility all the way up the parent chain) to be
// constructed completely correctly, yet neither painted a single pixel under this environment's
// software WebGL renderer (no real GPU available here). So the effects are drawn as a plain SVG
// overlay instead — but the TRAJECTORY is still genuinely three-dimensional: every frame, the
// flight path is computed in 3D on the unit sphere (a lofted quadratic Bezier between the two
// regions' direction vectors), each sample is converted back to lat/lng, and the globe's own
// getScreenCoords() projects it into current screen pixels. The arc therefore bends over the
// curvature of the Earth, re-projects correctly as the camera flies/rotates, and is clipped at the
// horizon (samples whose world position falls behind the globe's limb are dropped) exactly as a
// real 3D object would be — without ever asking the software renderer to draw anything.
//
// WHY ELEMENTS ARE NEVER RECREATED: elements are created ONCE per effect and updated in place
// every frame (never removed and re-appended) — an earlier version cleared and rebuilt the whole
// SVG on every tick, which was confirmed (via DOM polling) to genuinely place the right elements
// with the right attributes at the right times, yet screenshots kept catching an empty SVG anyway:
// the clear-then-rebuild cycle raced the browser's paint scheduling under this environment's heavy
// WebGL load, so a paint could land in the brief window where the SVG had just been cleared but
// not yet repopulated. Persistent elements remove that window entirely — something is always
// present for the compositor to paint, confirmed visually before trusting this.
import React, { useEffect, useRef } from 'react';
import { REGION_COORDINATES } from '../../data/regionCoordinates';

export const TRAVEL_MS = 1050; // launch -> impact, for a projectile with zero launch delay
export const BURST_MS = 850;   // impact -> shockwave fully expanded
const FADE_MS = 300;           // slack so nothing is torn down mid-fade
// Air strikes send several munitions in a ripple; the last one leaves this long after the first,
// so the whole effect has to stay alive that much longer than a single projectile's flight.
const MAX_LAUNCH_DELAY_MS = 250;

// Total time an effect needs to stay live — CombatEffectsContext's EFFECT_LIFETIME_MS must be at
// least this long, or the DOM elements would be torn down mid-fade.
export const COMBAT_EFFECT_DURATION_MS = TRAVEL_MS + MAX_LAUNCH_DELAY_MS + BURST_MS + FADE_MS;

const EFFECT_COLORS = {
  missile: '#f87171',
  airstrike: '#fb923c',
  invasion: '#60a5fa'
};

// The near-white end of each effect's gradient — a hot core reads as energy in a way a single
// flat stroke color never does.
const EFFECT_HOT_COLORS = {
  missile: '#fee2e2',
  airstrike: '#fef3c7',
  invasion: '#dbeafe'
};

// Head silhouettes, drawn pointing along +x and rotated into the direction of travel each frame.
const HEAD_SHAPES = {
  warhead: 'M 13 0 L 1 -4.5 L -10 -3 L -10 3 L 1 4.5 Z',
  dart: 'M 12 0 L -6 -4 L -3 0 L -6 4 Z',
  chevron: 'M 10 0 L -6 -8 L -1 0 L -6 8 Z'
};

// Per-type choreography. Each entry in `projectiles` is one flying object: `lateral` bows its arc
// sideways (so a flight of three fans out instead of overlapping), `loft` scales the apex height,
// `delay` staggers the launch, and `spread` nudges its impact point off the exact target so a
// multi-munition strike lands as a cluster rather than a single stack.
const EFFECT_SPECS = {
  missile: {
    head: 'warhead',
    archPow: 1,
    ease: 'accelerate',
    trailWidth: 3.2,
    fireball: 1,
    rings: 3,
    debris: 12,
    projectiles: [{ lateral: 0, loft: 1, delay: 0, scale: 1, spread: 0 }]
  },
  airstrike: {
    head: 'dart',
    // <1 puts the apex early: the flight climbs out fast and spends most of its time in a long
    // shallow dive onto the target, which is what an air strike should look like.
    archPow: 0.7,
    ease: 'accelerate',
    trailWidth: 2.4,
    fireball: 0.85,
    rings: 2,
    debris: 10,
    projectiles: [
      { lateral: -0.62, loft: 0.6, delay: 0, scale: 0.85, spread: -1 },
      { lateral: 0.04, loft: 0.82, delay: 125, scale: 1, spread: 0.3 },
      { lateral: 0.66, loft: 0.58, delay: MAX_LAUNCH_DELAY_MS, scale: 0.85, spread: 1 }
    ]
  },
  invasion: {
    head: 'chevron',
    archPow: 1,
    // Ground forces don't accelerate like a warhead — they roll forward at a steady pace.
    ease: 'smooth',
    trailWidth: 3.8,
    fireball: 0.4,
    rings: 2,
    debris: 8,
    projectiles: [
      { lateral: -0.8, loft: 0.24, delay: 0, scale: 1, spread: -0.9 },
      { lateral: 0.8, loft: 0.24, delay: 90, scale: 1, spread: 0.9 }
    ]
  }
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
const BASE_ALTITUDE = 0.015; // keeps the path just clear of the extruded region polygons
const SAMPLES = 26;          // trail resolution; every sample costs one 3D->screen projection
const SPARKS = 6;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const setAttrs = (el, attrs) => { Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); };
const make = (name, attrs) => {
  const node = document.createElementNS(SVG_NS, name);
  if (attrs) setAttrs(node, attrs);
  return node;
};

// ---------- 3D math on the unit sphere ----------
// Mirrors three-globe's own polar2Cartesian/cartesian2Polar conventions exactly, so a direction
// vector computed here round-trips through getScreenCoords() to the pixel the globe would use.
const latLngToVec = (lat, lng) => {
  const phi = (90 - lat) * DEG;
  const theta = (90 - lng) * DEG;
  const s = Math.sin(phi);
  return { x: s * Math.cos(theta), y: Math.cos(phi), z: s * Math.sin(theta) };
};

const vecToLatLng = (v) => {
  const r = Math.hypot(v.x, v.y, v.z) || 1;
  const theta = Math.atan2(v.z, v.x);
  return {
    lat: 90 - Math.acos(clamp(v.y / r, -1, 1)) / DEG,
    lng: 90 - theta / DEG - (theta < -Math.PI / 2 ? 360 : 0)
  };
};

const normalize = (v) => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const mix3 = (a, b, c, wa, wb, wc) => ({
  x: a.x * wa + b.x * wb + c.x * wc,
  y: a.y * wa + b.y * wb + c.y * wc,
  z: a.z * wa + b.z * wb + c.z * wc
});

// A quadratic Bezier between two directions on the sphere, re-normalized so the result is always
// a direction. With the control point pushed off the great-circle midpoint, this both bows the
// path sideways (lateral spread) and keeps it smooth at both ends.
const bezierDir = (a, ctrl, b, t) => {
  const u = 1 - t;
  return normalize(mix3(a, ctrl, b, u * u, 2 * u * t, t * t));
};

// Builds the fixed part of one projectile's flight: endpoints, control point, apex height.
const buildTrajectory = (from, to, projectile, spreadScale) => {
  const a = latLngToVec(from.lat, from.lng);
  const rawB = latLngToVec(to.lat, to.lng);
  const angle = Math.acos(clamp(dot(a, rawB), -1, 1));

  // Axis perpendicular to the flight plane. Degenerate when the two regions coincide (an effect
  // can legitimately target its own origin), so fall back to any orthogonal axis.
  let perp = cross(a, rawB);
  if (Math.hypot(perp.x, perp.y, perp.z) < 1e-6) {
    perp = cross(a, Math.abs(a.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 });
  }
  perp = normalize(perp);

  // Scatter the impact point a little for multi-munition strikes: sideways along `perp`, and
  // along-track via the tangent, so a flight of three lands as a cluster.
  const tangent = normalize(cross(perp, rawB));
  const off = projectile.spread * spreadScale;
  const b = off
    ? normalize({
      x: rawB.x + perp.x * off + tangent.x * off * 0.4,
      y: rawB.y + perp.y * off + tangent.y * off * 0.4,
      z: rawB.z + perp.z * off + tangent.z * off * 0.4
    })
    : rawB;

  const mid = normalize({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  // Short hops still need a visible fan, hence the floor on the angle — but keep it small, or a
  // 100km strike between neighbouring regions loops absurdly far out to sea and back.
  const bow = Math.max(angle, 0.035) * 0.42 * projectile.lateral;
  const ctrl = normalize({
    x: mid.x + perp.x * bow,
    y: mid.y + perp.y * bow,
    z: mid.z + perp.z * bow
  });

  // Longer flights loft proportionally higher, the way a ballistic arc actually does.
  const apex = projectile.loft * (0.045 + angle * 0.3);
  return { a, b, ctrl, apex };
};

const EASINGS = {
  // Slow off the rail, fastest at the moment of impact — the opposite of robotic linear motion.
  accelerate: (t) => Math.pow(t, 1.45),
  smooth: (t) => t * t * (3 - 2 * t)
};
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// When in the effect's life the main shockwave goes off (the last munition's impact).
export const getImpactDelay = (type) => {
  const spec = EFFECT_SPECS[type] || EFFECT_SPECS.missile;
  return TRAVEL_MS + spec.projectiles.reduce((m, p) => Math.max(m, p.delay), 0);
};

// Where to put the camera so the WHOLE trajectory is in frame, rather than only its target.
// Exported for GlobeView, which owns the camera.
export const getFramingPov = (fromRegionId, toRegionId) => {
  const from = REGION_COORDINATES[fromRegionId];
  const to = REGION_COORDINATES[toRegionId];
  if (!to) return null;
  if (!from) return { lat: to.lat, lng: to.lng, altitude: 0.45 };
  const a = latLngToVec(from.lat, from.lng);
  const b = latLngToVec(to.lat, to.lng);
  const angle = Math.acos(clamp(dot(a, b), -1, 1));
  const mid = vecToLatLng(normalize({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }));
  return { lat: mid.lat, lng: mid.lng, altitude: clamp(0.3 + angle * 0.85, 0.3, 1.3) };
};

// ---------- DOM construction (once per effect) ----------
const buildProjectile = (root, defs, color, hot, spec, key) => {
  // A single flat stroke can't fade along its own length, so the trail is stroked with a gradient
  // whose endpoints are moved to the tail and the head every frame: transparent at the back,
  // white-hot at the warhead.
  const gradientId = `roz-fx-trail-${key}`;
  const gradient = make('linearGradient', { id: gradientId, gradientUnits: 'userSpaceOnUse' });
  gradient.appendChild(make('stop', { offset: '0', 'stop-color': color, 'stop-opacity': '0' }));
  gradient.appendChild(make('stop', { offset: '0.5', 'stop-color': color, 'stop-opacity': '0.55' }));
  gradient.appendChild(make('stop', { offset: '0.86', 'stop-color': color, 'stop-opacity': '0.95' }));
  gradient.appendChild(make('stop', { offset: '1', 'stop-color': hot, 'stop-opacity': '1' }));
  defs.appendChild(gradient);

  const stroke = `url(#${gradientId})`;
  // Two passes rather than an SVG blur filter: a wide soft stroke under a thin bright one reads as
  // a glow, and costs the software compositor a fraction of what a per-frame feGaussianBlur would.
  const trailGlow = make('polyline', {
    fill: 'none', stroke, 'stroke-width': spec.trailWidth * 3.4,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0
  });
  const trailCore = make('polyline', {
    fill: 'none', stroke, 'stroke-width': spec.trailWidth,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0
  });

  const sparks = [];
  for (let i = 0; i < SPARKS; i += 1) {
    const spark = make('circle', { fill: i % 2 ? hot : color, r: 0, opacity: 0 });
    sparks.push(spark);
  }

  const head = make('g', { opacity: 0 });
  const halo = make('circle', { r: 15, fill: color, opacity: 0.16 });
  const glow = make('circle', { r: 7, fill: color, opacity: 0.5 });
  const body = make('path', { d: HEAD_SHAPES[spec.head], fill: hot, stroke: '#ffffff', 'stroke-width': 0.8 });
  head.appendChild(halo);
  head.appendChild(glow);
  head.appendChild(body);

  const flash = make('circle', { fill: hot, r: 0, opacity: 0 });

  root.appendChild(trailGlow);
  root.appendChild(trailCore);
  sparks.forEach((s) => root.appendChild(s));
  root.appendChild(head);
  root.appendChild(flash);

  return { gradient, trailGlow, trailCore, sparks, head, flash };
};

const buildImpact = (root, color, hot, spec) => {
  const fireball = make('circle', { fill: hot, r: 0, opacity: 0 });
  const flash = make('circle', { fill: '#ffffff', r: 0, opacity: 0 });
  const rings = [];
  for (let i = 0; i < spec.rings; i += 1) {
    rings.push(make('circle', {
      fill: 'none', stroke: i === 0 ? '#ffffff' : color, 'stroke-width': 4, r: 0, opacity: 0
    }));
  }
  const debris = [];
  for (let i = 0; i < spec.debris; i += 1) {
    debris.push(make('line', { stroke: i % 3 === 0 ? hot : color, 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0 }));
  }
  root.appendChild(fireball);
  debris.forEach((d) => root.appendChild(d));
  rings.forEach((r) => root.appendChild(r));
  root.appendChild(flash);
  return { fireball, flash, rings, debris };
};

const buildEntry = (svg, defs, effect) => {
  const spec = EFFECT_SPECS[effect.type] || EFFECT_SPECS.missile;
  const color = EFFECT_COLORS[effect.type] || EFFECT_COLORS.missile;
  const hot = EFFECT_HOT_COLORS[effect.type] || EFFECT_HOT_COLORS.missile;
  const root = make('g');
  const projectiles = spec.projectiles.map((p, i) =>
    buildProjectile(root, defs, color, hot, spec, `${effect.id}-${i}`)
  );
  const impact = buildImpact(root, color, hot, spec);
  svg.appendChild(root);
  return { root, spec, projectiles, impact };
};

const destroyEntry = (entry) => {
  entry.root.remove();
  entry.projectiles.forEach((p) => p.gradient.remove());
};

const HIDDEN = { opacity: 0 };

const GlobeEffectsOverlay = ({ globeRef, width, height, effects }) => {
  const svgRef = useRef(null);
  const defsRef = useRef(null);
  const entriesRef = useRef(new Map()); // effect id -> entry

  useEffect(() => {
    // Runs continuously while the globe view is mounted, even with zero active effects — cheap
    // (an empty forEach), and it's what promptly cleans up a just-expired effect's DOM elements
    // rather than leaving them behind forever once `effects` goes back to empty.
    let raf;

    const draw = () => {
      try {
        const svg = svgRef.current;
        const defs = defsRef.current;
        const globe = globeRef.current;
        if (!svg || !defs || !globe) return;

        const now = Date.now();
        const liveIds = new Set(effects.map((e) => e.id));
        entriesRef.current.forEach((entry, id) => {
          if (!liveIds.has(id)) {
            destroyEntry(entry);
            entriesRef.current.delete(id);
          }
        });
        if (effects.length === 0) return;

        const radius = (globe.getGlobeRadius && globe.getGlobeRadius()) || 100;
        const camera = globe.camera && globe.camera();
        const camPos = camera && camera.position;
        const camDist = camPos ? Math.hypot(camPos.x, camPos.y, camPos.z) : 0;

        // A point at world position P is hidden behind the globe's limb exactly when
        // P·C < R² (C = camera position, R = globe radius) — the same horizon test a real 3D
        // object would get for free from the depth buffer.
        const isVisible = (dir, alt) => {
          if (!camPos || camDist <= radius) return true;
          return dot(dir, camPos) * radius * (1 + alt) >= radius * radius;
        };

        // Blast sizes are in screen pixels, so they have to track how big the globe currently
        // looks: a shockwave sized for a close-up would swallow a continent when zoomed out.
        let zoom = 1;
        if (camera && camDist > radius && height) {
          const focal = height / (2 * Math.tan(((camera.fov || 50) * DEG) / 2));
          zoom = clamp(((radius / camDist) * focal) / 420, 0.7, 1.7);
        }

        effects.forEach((e) => {
          const from = REGION_COORDINATES[e.fromRegionId];
          const to = REGION_COORDINATES[e.toRegionId];
          if (!from || !to) return;

          let entry = entriesRef.current.get(e.id);
          if (!entry) {
            entry = buildEntry(svg, defs, e);
            entriesRef.current.set(e.id, entry);
          }

          const { spec, projectiles, impact } = entry;
          const elapsed = now - e.createdAt;
          const ease = EASINGS[spec.ease] || EASINGS.accelerate;
          const spreadScale = 0.007 * zoom;

          spec.projectiles.forEach((p, i) => {
            const parts = projectiles[i];
            const local = (elapsed - p.delay) / TRAVEL_MS;

            if (local < 0) {
              setAttrs(parts.trailGlow, HIDDEN);
              setAttrs(parts.trailCore, HIDDEN);
              setAttrs(parts.head, HIDDEN);
              setAttrs(parts.flash, HIDDEN);
              parts.sparks.forEach((s) => setAttrs(s, HIDDEN));
              return;
            }

            if (!parts.trajectory) {
              parts.trajectory = buildTrajectory(from, to, p, spreadScale);
            }
            const traj = parts.trajectory;
            const progress = ease(clamp(local, 0, 1));

            // Walk BACKWARDS from the head so the trail is the contiguous stretch of path that is
            // actually in front of the horizon; the moment a sample goes behind the limb we stop,
            // rather than letting the polyline jump straight across the globe.
            const pts = [];
            let headPoint = null;
            let priorPoint = null;
            for (let s = SAMPLES; s >= 0; s -= 1) {
              const t = (progress * s) / SAMPLES;
              const dir = bezierDir(traj.a, traj.ctrl, traj.b, t);
              const alt = BASE_ALTITUDE + traj.apex * Math.sin(Math.PI * Math.pow(t, spec.archPow));
              if (!isVisible(dir, alt)) break;
              const ll = vecToLatLng(dir);
              const sc = globe.getScreenCoords(ll.lat, ll.lng, alt);
              if (!sc || !Number.isFinite(sc.x) || !Number.isFinite(sc.y)) break;
              if (s === SAMPLES) headPoint = sc;
              else if (s === SAMPLES - 1) priorPoint = sc;
              pts.push(sc);
            }

            if (!headPoint || pts.length < 2) {
              setAttrs(parts.trailGlow, HIDDEN);
              setAttrs(parts.trailCore, HIDDEN);
              setAttrs(parts.head, HIDDEN);
              parts.sparks.forEach((s) => setAttrs(s, HIDDEN));
            } else {
              const tail = pts[pts.length - 1];
              setAttrs(parts.gradient, { x1: tail.x, y1: tail.y, x2: headPoint.x, y2: headPoint.y });
              const points = pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).reverse().join(' ');

              // After impact the track lingers for a beat and dissolves, so the eye can follow
              // where the strike came from instead of it vanishing the instant it lands.
              const trailFade = local <= 1 ? 1 : clamp(1 - (local - 1) * (TRAVEL_MS / 420), 0, 1);
              setAttrs(parts.trailGlow, { points, opacity: 0.42 * trailFade });
              setAttrs(parts.trailCore, { points, opacity: 0.95 * trailFade });

              if (local <= 1) {
                const angle = priorPoint
                  ? (Math.atan2(headPoint.y - priorPoint.y, headPoint.x - priorPoint.x) * 180) / Math.PI
                  : 0;
                setAttrs(parts.head, {
                  opacity: 1,
                  transform: `translate(${headPoint.x.toFixed(1)} ${headPoint.y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${(p.scale * zoom).toFixed(2)})`
                });
                // Embers shed off the back of the head, drifting off the track as they cool.
                parts.sparks.forEach((spark, k) => {
                  const idx = k + 1; // pts[0] is the head, so these are the samples just behind it
                  if (idx >= pts.length) { setAttrs(spark, HIDDEN); return; }
                  const q = pts[idx];
                  const wobble = ((k * 37) % 11) - 5;
                  const age = (k + 1) / (SPARKS + 1);
                  setAttrs(spark, {
                    cx: (q.x + wobble * age * 1.6).toFixed(1),
                    cy: (q.y + (((k * 53) % 9) - 4) * age * 1.6).toFixed(1),
                    r: (3.4 * p.scale * zoom * (1 - age)).toFixed(2),
                    opacity: (0.85 * (1 - age)).toFixed(2)
                  });
                });
              } else {
                setAttrs(parts.head, HIDDEN);
                parts.sparks.forEach((s) => setAttrs(s, HIDDEN));
              }
            }

            // Each munition pops its own small flash as it lands, so a ripple strike reads as
            // several distinct hits rather than one event.
            const sinceHit = (elapsed - p.delay - TRAVEL_MS) / 260;
            if (sinceHit >= 0 && sinceHit <= 1 && headPoint) {
              setAttrs(parts.flash, {
                cx: headPoint.x.toFixed(1),
                cy: headPoint.y.toFixed(1),
                r: (easeOutCubic(sinceHit) * 26 * p.scale * zoom).toFixed(1),
                opacity: (0.75 * (1 - sinceHit)).toFixed(2)
              });
            } else {
              setAttrs(parts.flash, HIDDEN);
            }
          });

          // ---- main detonation, centred on the real target (not on any one munition's
          // scattered impact point) ----
          const burst = (elapsed - getImpactDelay(e.type)) / BURST_MS;
          const target = globe.getScreenCoords(to.lat, to.lng, BASE_ALTITUDE);
          const targetDir = latLngToVec(to.lat, to.lng);
          const targetVisible = isVisible(targetDir, BASE_ALTITUDE);

          if (burst < 0 || burst > 1 || !target || !targetVisible) {
            setAttrs(impact.fireball, HIDDEN);
            setAttrs(impact.flash, HIDDEN);
            impact.rings.forEach((r) => setAttrs(r, HIDDEN));
            impact.debris.forEach((d) => setAttrs(d, HIDDEN));
          } else {
            const cx = target.x;
            const cy = target.y;

            // White-out flash: very fast, very short — the punch.
            const fl = clamp(burst / 0.16, 0, 1);
            setAttrs(impact.flash, {
              cx, cy,
              r: (easeOutCubic(fl) * 40 * spec.fireball * zoom).toFixed(1),
              opacity: fl >= 1 ? 0 : (1 - fl).toFixed(2)
            });

            // Fireball: a hot core that swells and burns down.
            const fb = clamp(burst / 0.45, 0, 1);
            setAttrs(impact.fireball, {
              cx, cy,
              r: (easeOutCubic(fb) * 34 * spec.fireball * zoom).toFixed(1),
              opacity: fb >= 1 ? 0 : (0.9 * (1 - fb) ** 1.3).toFixed(2)
            });

            // Staggered shockwave rings: each starts later, travels further, and thins as it goes.
            impact.rings.forEach((ring, i) => {
              const start = i * 0.17;
              const u = (burst - start) / (1 - start);
              if (u <= 0 || u >= 1) { setAttrs(ring, HIDDEN); return; }
              setAttrs(ring, {
                cx, cy,
                r: (6 + easeOutCubic(u) * (62 + i * 30) * zoom).toFixed(1),
                'stroke-width': (5.5 * (1 - u) + 0.8).toFixed(2),
                opacity: (0.95 * (1 - u) ** 1.4).toFixed(2)
              });
            });

            // Debris streaks thrown radially out of the crater.
            impact.debris.forEach((line, i) => {
              const u = clamp(burst / 0.6, 0, 1);
              if (u >= 1) { setAttrs(line, HIDDEN); return; }
              const a = (i / impact.debris.length) * Math.PI * 2 + 0.4;
              const reach = (0.65 + ((i * 29) % 7) / 10) * zoom;
              const inner = (10 + easeOutCubic(u) * 52 * reach);
              const len = (10 + ((i * 17) % 13)) * reach * (1 - u * 0.5);
              setAttrs(line, {
                x1: (cx + Math.cos(a) * inner).toFixed(1),
                y1: (cy + Math.sin(a) * inner).toFixed(1),
                x2: (cx + Math.cos(a) * (inner + len)).toFixed(1),
                y2: (cy + Math.sin(a) * (inner + len)).toFixed(1),
                'stroke-width': (2.6 * (1 - u) + 0.6).toFixed(2),
                opacity: (0.9 * (1 - u) ** 1.2).toFixed(2)
              });
            });
          }
        });
      } finally {
        raf = requestAnimationFrame(draw);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [effects, globeRef, height]);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
    >
      <defs ref={defsRef} />
    </svg>
  );
};

export default GlobeEffectsOverlay;
