// src/effects/scenes/spectacle.js
// The big moments: the dawn of a new age, culture spreading across the world.
import { ease, phase, envelope, hash, setAttrs, placeIcon } from '../engine';
import { buildLine, buildRings, buildParticles, buildLabel } from '../fx';

// ---------------------------------------------------------------------------------------------
// ageAdvance — the showpiece: a golden sunburst of rotating rays, expanding halos, laurels, and
// fireworks shot up from around the capital bursting into colour.
export const ageAdvance = {
  duration: 3600,
  impactAt: () => 400,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      rays: Array.from({ length: 16 }, () => stage.el('path', { fill: base, opacity: 0 })),
      laurels: stage.icon('laurels', hot),
      crown: stage.icon('crown', '#fde047'),
      rings: buildRings(stage, 5, base),
      rockets: Array.from({ length: 5 }, (_, i) => ({
        trail: buildLine(stage, '#fde68a', 1.4),
        burst: buildParticles(stage, 14, [['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#f87171'][i], '#ffffff'], { size: 2.2 })
      })),
      label: buildLabel(stage, p.label || 'A new age dawns', hot)
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 3600, 0.03, 0.15) : 0;
    const grow = ease.outCubic(phase(f.t, 0, 700));
    s.rays.forEach((ray, i) => {
      const a = (i / 16) * Math.PI * 2 + f.t / 1400;
      const r0 = 14 * z; const r1 = r0 + (40 + 22 * (i % 2)) * z * grow;
      const w = 0.09;
      setAttrs(ray, { d: `M ${x + Math.cos(a - w) * r0} ${y + Math.sin(a - w) * r0} L ${x + Math.cos(a) * r1} ${y + Math.sin(a) * r1} L ${x + Math.cos(a + w) * r0} ${y + Math.sin(a + w) * r0} Z`, opacity: (0.45 * fade * grow).toFixed(2) });
    });
    placeIcon(s.laurels, x, y, 52 * z * ease.outBack(phase(f.t, 200, 600)), { opacity: fade });
    placeIcon(s.crown, x, y - 4 * z, 24 * z * ease.outBack(phase(f.t, 450, 500)), { opacity: fade });
    s.rings.draw(x, y, visible ? phase(f.t, 200, 1600) : -1, { r1: 70, z, stagger: 0.12 });
    s.rockets.forEach((r, i) => {
      const launchAt = 700 + i * 260;
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      const sx = x + (i - 2) * 22 * z; const sy = y + 10 * z;
      const up = ease.outCubic(phase(f.t, launchAt, 550));
      const ex = sx + Math.cos(a) * 20 * z * up; const ey = sy - (60 + hash(i, 2) * 30) * z * up;
      r.trail.draw(up > 0 && up < 1 ? [{ x: sx, y: sy }, { x: ex, y: ey }] : null, fade * (1 - up * 0.5));
      r.burst.draw(ex, ey, visible ? phase(f.t, launchAt + 550, 900) : -1, { mode: 'radial', reach: 30, z, stagger: 0.05 });
    });
    s.label.draw(x, y - 58 * z, visible ? phase(f.t, 500, 2600) : -1, z * 1.2);
  }
};

// ---------------------------------------------------------------------------------------------
// culture — a trumpet sounds over the capital and waves of musical notes ripple outward in every
// direction in shifting colours, carrying the nation's culture abroad.
export const culture = {
  duration: 3000,
  impactAt: () => 300,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      trumpet: stage.icon('trumpet', hot),
      notes: Array.from({ length: 14 }, () => stage.icon('notes', '#ffffff')),
      waves: buildRings(stage, 4, base, { first: hot }),
      label: buildLabel(stage, p.label || 'Culture spreads', hot)
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 3000, 0.03, 0.15) : 0;
    placeIcon(s.trumpet, x, y - 8 * z, 24 * z, { opacity: fade, rotate: -20 + Math.sin(f.t / 100) * 6 });
    const hues = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb7185'];
    s.notes.forEach((n, i) => {
      const start = 200 + i * 110;
      const u = phase(f.t, start, 1500);
      const a = (i / 14) * Math.PI * 2 + hash(i, 1) * 0.4;
      const r = (10 + ease.outCubic(u) * 80) * z;
      const wob = Math.sin(u * 10 + i) * 4 * z;
      placeIcon(n, x + Math.cos(a) * r + wob, y - 8 * z + Math.sin(a) * r * 0.55 - u * 16 * z, 12 * z, { opacity: fade * (u > 0 && u < 1 ? 1 - u * 0.7 : 0), rotate: Math.sin(u * 8) * 15 });
      n.firstChild && n.firstChild.setAttribute('fill', hues[i % hues.length]);
    });
    s.waves.draw(x, y, visible ? phase(f.t, 150, 2200) : -1, { r1: 80, z, squash: 0.55, stagger: 0.2 });
    s.label.draw(x, y - 44 * z, visible ? phase(f.t, 600, 2000) : -1, z);
  }
};
