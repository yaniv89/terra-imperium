// src/effects/fx.js
// Reusable building blocks the scenes compose: a stage (per-effect SVG group + element factory),
// explosions, expanding rings, particle sprays, glowing trails, rising labels. Each block is a
// `build(...)` returning an object with a `draw(...)` that sets attributes for the current frame.
import { make, setAttrs, hide, HIDDEN, clamp, ease, hash, makeIcon, placeIcon, polyPoints } from './engine';
import { getEffectIconPath } from '../data/effectIcons';

// A stage is one effect's private corner of the overlay SVG.
export const createStage = (svg, defs, key) => {
  const root = make('g');
  svg.appendChild(root);
  const owned = [];
  const stage = {
    root,
    defs,
    key,
    el: (tag, attrs, parent = root) => { const n = make(tag, attrs); parent.appendChild(n); return n; },
    group: (parent = root) => { const g = make('g'); parent.appendChild(g); return g; },
    // `name` is an effectIcons.js key, or a raw 512-viewBox path string.
    icon: (name, fill, parent = root, extra) => makeIcon(parent, name && name.length < 40 ? getEffectIconPath(name) : name, fill, extra),
    defsEl: (tag, attrs) => { const n = make(tag, attrs); defs.appendChild(n); owned.push(n); return n; },
    destroy: () => { root.remove(); owned.forEach((n) => n.remove()); }
  };
  return stage;
};

// A trail whose opacity fades from tail to head: a user-space gradient re-anchored every frame.
export const buildTrail = (stage, color, hot, width, { glow = true, dash = null } = {}) => {
  const id = `fx-trail-${stage.key}-${Math.round(Math.random() * 1e9)}`;
  const gradient = stage.defsEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse' });
  [['0', color, '0'], ['0.55', color, '0.6'], ['0.9', color, '0.95'], ['1', hot, '1']].forEach(([offset, c, o]) => {
    gradient.appendChild(make('stop', { offset, 'stop-color': c, 'stop-opacity': o }));
  });
  const common = { fill: 'none', stroke: `url(#${id})`, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 };
  const glowLine = glow ? stage.el('polyline', { ...common, 'stroke-width': width * 3.2 }) : null;
  const core = stage.el('polyline', { ...common, 'stroke-width': width, ...(dash ? { 'stroke-dasharray': dash } : {}) });
  return {
    // pts in tail -> head order
    draw: (pts, opacity = 1, widthScale = 1) => {
      if (!pts || pts.length < 2 || opacity <= 0) { hide(glowLine, core); return; }
      const tail = pts[0]; const head = pts[pts.length - 1];
      setAttrs(gradient, { x1: tail.x, y1: tail.y, x2: head.x, y2: head.y });
      const points = polyPoints(pts);
      if (glowLine) setAttrs(glowLine, { points, opacity: (0.4 * opacity).toFixed(2), 'stroke-width': (width * 3.2 * widthScale).toFixed(2) });
      setAttrs(core, { points, opacity: (0.95 * opacity).toFixed(2), 'stroke-width': (width * widthScale).toFixed(2) });
    }
  };
};

// A plain solid polyline (roads, claim lines, links) with an optional dash pattern.
export const buildLine = (stage, color, width, extra = {}) => {
  const line = stage.el('polyline', { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0, ...extra });
  return {
    node: line,
    draw: (pts, opacity = 1, attrs = {}) => {
      if (!pts || pts.length < 2 || opacity <= 0) { hide(line); return; }
      setAttrs(line, { points: polyPoints(pts), opacity: opacity.toFixed(2), ...attrs });
    }
  };
};

// Expanding rings, staggered: `u` is 0..1 over the whole ring phase.
export const buildRings = (stage, count, color, { first = '#ffffff', width = 3.5 } = {}) => {
  const rings = [];
  for (let i = 0; i < count; i += 1) rings.push(stage.el('circle', { fill: 'none', stroke: i === 0 ? first : color, 'stroke-width': width, r: 0, opacity: 0 }));
  return {
    draw: (cx, cy, u, { r0 = 6, r1 = 60, z = 1, stagger = 0.17, squash = 1, maxOpacity = 0.9 } = {}) => {
      rings.forEach((ring, i) => {
        const start = i * stagger;
        const v = (u - start) / (1 - start);
        if (v <= 0 || v >= 1 || !Number.isFinite(cx)) { setAttrs(ring, HIDDEN); return; }
        const r = (r0 + ease.outCubic(v) * (r1 + i * r1 * 0.4)) * z;
        if (squash !== 1) {
          // Ellipse for a "ground ring" seen at an angle.
          ring.setAttribute('transform', `translate(${cx} ${cy}) scale(1 ${squash}) translate(${-cx} ${-cy})`);
        }
        setAttrs(ring, { cx, cy, r: r.toFixed(1), 'stroke-width': (width * (1 - v) + 0.6).toFixed(2), opacity: (maxOpacity * (1 - v) ** 1.3).toFixed(2) });
      });
    }
  };
};

// Flash + fireball + shockwave rings + radial debris — the classic impact.
export const buildBurst = (stage, color, hot, { rings = 2, debris = 8, fireball = 0.6 } = {}) => {
  const ball = stage.el('circle', { fill: hot, r: 0, opacity: 0 });
  const debrisLines = [];
  for (let i = 0; i < debris; i += 1) debrisLines.push(stage.el('line', { stroke: i % 3 === 0 ? hot : color, 'stroke-linecap': 'round', opacity: 0 }));
  const ringSet = buildRings(stage, rings, color);
  const flash = stage.el('circle', { fill: '#ffffff', r: 0, opacity: 0 });
  return {
    draw: (cx, cy, u, z = 1, size = 1) => {
      if (u <= 0 || u >= 1 || !Number.isFinite(cx)) { hide(ball, flash, ...debrisLines); ringSet.draw(cx, cy, -1); return; }
      const fl = clamp(u / 0.16, 0, 1);
      setAttrs(flash, { cx, cy, r: (ease.outCubic(fl) * 40 * fireball * size * z).toFixed(1), opacity: fl >= 1 ? 0 : (1 - fl).toFixed(2) });
      const fb = clamp(u / 0.45, 0, 1);
      setAttrs(ball, { cx, cy, r: (ease.outCubic(fb) * 34 * fireball * size * z).toFixed(1), opacity: fb >= 1 ? 0 : (0.9 * (1 - fb) ** 1.3).toFixed(2) });
      ringSet.draw(cx, cy, u, { r1: 62 * size, z });
      debrisLines.forEach((line, i) => {
        const v = clamp(u / 0.6, 0, 1);
        if (v >= 1) { setAttrs(line, HIDDEN); return; }
        const a = (i / debrisLines.length) * Math.PI * 2 + 0.4;
        const reach = (0.65 + hash(i, 3) * 0.7) * z * size;
        const inner = 10 + ease.outCubic(v) * 52 * reach;
        const len = (10 + hash(i, 5) * 13) * reach * (1 - v * 0.5);
        setAttrs(line, {
          x1: (cx + Math.cos(a) * inner).toFixed(1), y1: (cy + Math.sin(a) * inner).toFixed(1),
          x2: (cx + Math.cos(a) * (inner + len)).toFixed(1), y2: (cy + Math.sin(a) * (inner + len)).toFixed(1),
          'stroke-width': (2.6 * (1 - v) + 0.6).toFixed(2), opacity: (0.9 * (1 - v) ** 1.2).toFixed(2)
        });
      });
    }
  };
};

// Particles with a few motion modes:
//  'rise'   — drift up and sideways off the centre (sparkles, embers, steam)
//  'radial' — fly straight out (sparks)
//  'fall'   — pop up then fall with gravity (coins, ore chunks, confetti)
//  'dust'   — puff outward along the ground and fade (footfalls, impacts)
//  'swirl'  — orbit outward in a spiral (magic, knowledge)
export const buildParticles = (stage, count, colors, { shape = 'circle', size = 3 } = {}) => {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const fill = colors[i % colors.length];
    parts.push(shape === 'rect'
      ? stage.el('rect', { fill, width: size, height: size, opacity: 0 })
      : stage.el('circle', { fill, r: 0, opacity: 0 }));
  }
  return {
    draw: (cx, cy, u, { mode = 'rise', reach = 30, z = 1, spread = 1, sizeScale = 1, seed = 0, stagger = 0.3, angle0 = 0, arc = Math.PI * 2 } = {}) => {
      parts.forEach((p, i) => {
        const delay = (i / count) * stagger;
        const v = (u - delay) / (1 - delay);
        if (v <= 0 || v >= 1 || !Number.isFinite(cx)) { setAttrs(p, HIDDEN); return; }
        const a = angle0 + (i / count) * arc + hash(i, seed) * 0.8;
        const r = reach * (0.6 + hash(i, seed + 1) * 0.8) * z;
        let x = cx; let y = cy; let fade = 1 - v;
        if (mode === 'rise') { x = cx + Math.cos(a) * r * 0.45 * spread * ease.outCubic(v); y = cy - ease.outCubic(v) * r; }
        else if (mode === 'radial') { x = cx + Math.cos(a) * r * ease.outCubic(v); y = cy + Math.sin(a) * r * ease.outCubic(v); }
        else if (mode === 'fall') {
          const vx = Math.cos(a) * r * 0.9; const up = r * (0.9 + hash(i, seed + 2) * 0.6);
          x = cx + vx * v; y = cy - up * (4 * v * (1 - v)) + v * r * 0.25; fade = v < 0.8 ? 1 : (1 - v) / 0.2;
        } else if (mode === 'dust') {
          x = cx + Math.cos(a) * r * ease.outCubic(v); y = cy + Math.sin(a) * r * 0.35 * ease.outCubic(v) - v * 4 * z; fade = (1 - v) * 0.7;
        } else if (mode === 'swirl') {
          const sa = a + v * 4; x = cx + Math.cos(sa) * r * v; y = cy + Math.sin(sa) * r * v * 0.6 - v * r * 0.3;
        }
        const s = (mode === 'dust' ? (2 + v * 4) : size * (1 - v * 0.6)) * sizeScale * z;
        if (shape === 'rect') setAttrs(p, { x: (x - s / 2).toFixed(1), y: (y - s / 2).toFixed(1), width: s.toFixed(1), height: s.toFixed(1), opacity: fade.toFixed(2), transform: `rotate(${(v * 540 + i * 40).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})` });
        else setAttrs(p, { cx: x.toFixed(1), cy: y.toFixed(1), r: s.toFixed(2), opacity: (fade * 0.9).toFixed(2) });
      });
    }
  };
};

// A short caption that floats up off the action ("+1 Infantry", "Treaty signed").
export const buildLabel = (stage, text, color) => {
  const node = stage.el('text', {
    'text-anchor': 'middle', 'font-family': 'ui-sans-serif, system-ui, sans-serif', 'font-weight': 700,
    fill: color, stroke: '#0f172a', 'stroke-width': 3, 'paint-order': 'stroke', opacity: 0
  });
  node.textContent = text;
  return {
    draw: (x, y, u, z = 1) => {
      const o = u <= 0 || u >= 1 ? 0 : Math.min(1, u / 0.15, (1 - u) / 0.25);
      if (o <= 0 || !Number.isFinite(x)) { setAttrs(node, HIDDEN); return; }
      setAttrs(node, { x: x.toFixed(1), y: (y - ease.outCubic(u) * 16 * z).toFixed(1), 'font-size': (12 * z).toFixed(1), opacity: o.toFixed(2) });
    }
  };
};

// A flag on a pole that drops in from above, sticks with a bounce, and waves.
export const buildFlag = (stage, color, hot) => {
  const pole = stage.el('line', { stroke: '#e2e8f0', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0 });
  const cloth = stage.el('path', { fill: color, stroke: hot, 'stroke-width': 0.8, opacity: 0 });
  return {
    // `u` 0..1 is the drop; `t` (ms) drives the wave; returns the pole-top point.
    draw: (x, y, u, t, z = 1, opacity = 1) => {
      if (u <= 0 || opacity <= 0 || !Number.isFinite(x)) { hide(pole, cloth); return null; }
      const h = 30 * z;
      const drop = (1 - ease.outBounce(clamp(u, 0, 1))) * 60 * z;
      const baseY = y - drop;
      setAttrs(pole, { x1: x, y1: baseY, x2: x, y2: baseY - h, opacity: opacity.toFixed(2) });
      const w = 20 * z; const fh = 12 * z; const top = baseY - h;
      const wave = (k) => Math.sin(t / 110 + k * 2.2) * 2.4 * z * clamp(u * 2, 0, 1);
      const d = `M ${x} ${top} Q ${x + w * 0.5} ${top + wave(0)} ${x + w} ${top + wave(1)} L ${x + w} ${top + fh + wave(1)} Q ${x + w * 0.5} ${top + fh + wave(0)} ${x} ${top + fh} Z`;
      setAttrs(cloth, { d, opacity: opacity.toFixed(2) });
      return { x, y: top };
    }
  };
};

// Reveals an icon bottom-to-top through a clip rect — "rising out of the ground" for buildings.
export const buildRevealIcon = (stage, name, fill) => {
  const clipId = `fx-clip-${stage.key}-${Math.round(Math.random() * 1e9)}`;
  const clip = stage.defsEl('clipPath', { id: clipId });
  const rect = make('rect', { x: 0, y: 0, width: 0, height: 0 });
  clip.appendChild(rect);
  const holder = stage.el('g', { 'clip-path': `url(#${clipId})` });
  const icon = stage.icon(name, fill, holder);
  return {
    // `reveal` 0..1 bottom-up; returns the current top edge y (where sparks should fly).
    draw: (x, y, size, reveal, opacity = 1, opts = {}) => {
      placeIcon(icon, x, y, size, { opacity, ...opts });
      const top = y + size / 2 - size * clamp(reveal, 0, 1);
      setAttrs(rect, { x: (x - size).toFixed(1), y: top.toFixed(1), width: (size * 2).toFixed(1), height: (size * clamp(reveal, 0, 1) + 2).toFixed(1) });
      return top;
    }
  };
};

export { placeIcon };
