// src/effects/scenes/spectacle.js
// The big moments: rockets and satellites, missile silos, the dawn of a new age, culture
// spreading across the world.
import { ease, phase, envelope, hash, setAttrs, placeIcon, lerp } from '../engine';
import { buildLine, buildRings, buildParticles, buildLabel, buildBurst } from '../fx';

// ---------------------------------------------------------------------------------------------
// launch — the rocket lifts off on a flickering exhaust plume with billowing smoke at the pad,
// arcs up, and releases its payload: a satellite drops into an orbit ring around the capital
// (`mission`: stages separate and the craft races off into space in a starburst).
export const launch = {
  duration: 3200,
  impactAt: () => 500,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      pad: stage.el('rect', { fill: '#475569', opacity: 0 }),
      smoke: buildParticles(stage, 16, ['#e2e8f0', '#cbd5e1', '#94a3b8'], { size: 8 }),
      rocket: stage.icon(p.mission ? 'rocketFlight' : 'rocket', '#f8fafc'),
      flame: stage.el('path', { fill: '#fb923c', opacity: 0 }),
      flameCore: stage.el('path', { fill: '#fef08a', opacity: 0 }),
      trail: buildLine(stage, '#fdba74', 2, { 'stroke-dasharray': '1 4' }),
      stage2: p.mission ? stage.icon('rocket', '#cbd5e1') : null,
      orbit: p.mission ? null : stage.el('ellipse', { fill: 'none', stroke: base, 'stroke-width': 1.6, 'stroke-dasharray': '4 4', opacity: 0 }),
      satellite: p.mission ? null : stage.icon('satellite', hot),
      star: p.mission ? buildBurst(stage, base, hot, { rings: 3, debris: 10, fireball: 0.4 }) : null,
      twinkle: buildParticles(stage, 10, ['#ffffff', hot], { size: 2 }),
      label: buildLabel(stage, p.label || (p.mission ? 'Mission launched!' : 'Satellite in orbit'), hot),
      p
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 3200, 0.03, 0.12) : 0;
    setAttrs(s.pad, { x: (x - 10 * z).toFixed(1), y: (y + 2 * z).toFixed(1), width: (20 * z).toFixed(1), height: (3 * z).toFixed(1), opacity: fade.toFixed(2) });
    const ignite = phase(f.t, 0, 400);
    const climb = ease.inCubic(phase(f.t, 400, 1500));
    const alt = climb * 110 * z;
    const drift = climb * climb * 30 * z;
    const rx = x + drift; const ry = y - 10 * z - alt;
    const tilt = climb * 25;
    const flying = f.t < 1900;
    const shake = f.t < 600 ? Math.sin(f.t / 15) * 1.2 * z * ignite : 0;
    placeIcon(s.rocket, rx + shake, ry, 22 * z, { opacity: flying ? fade : 0, rotate: -45 + tilt });
    // Exhaust plume under the rocket, flickering.
    const fl = (8 + 6 * Math.abs(Math.sin(f.t / 35))) * z * ignite;
    const ang = ((90 + tilt) * Math.PI) / 180;
    const bx = rx - Math.sin(tilt * Math.PI / 180) * 10 * z; const by = ry + 10 * z;
    const tipX = bx + Math.cos(ang) * fl * 1.6; const tipY = by + Math.sin(ang) * fl * 1.6;
    const w = 4 * z;
    setAttrs(s.flame, { d: `M ${bx - w} ${by} Q ${bx} ${by + fl * 0.4} ${tipX} ${tipY} Q ${bx} ${by + fl * 0.4} ${bx + w} ${by} Z`, opacity: flying ? (fade * 0.9).toFixed(2) : 0 });
    setAttrs(s.flameCore, { d: `M ${bx - w * 0.5} ${by} Q ${bx} ${by + fl * 0.25} ${lerp(bx, tipX, 0.6)} ${lerp(by, tipY, 0.6)} Q ${bx} ${by + fl * 0.25} ${bx + w * 0.5} ${by} Z`, opacity: flying ? fade.toFixed(2) : 0 });
    s.smoke.draw(x, y + 2 * z, visible ? phase(f.t, 100, 1800) : -1, { mode: 'dust', reach: 40, z, stagger: 0.7, sizeScale: 1.6 });
    s.trail.draw(climb > 0.02 ? [{ x, y: y - 10 * z }, { x: x + drift * 0.3, y: y - 10 * z - alt * 0.5 }, { x: rx, y: ry }] : null, fade * (1 - phase(f.t, 1900, 800)));
    if (s.p.mission) {
      const sep = phase(f.t, 1300, 500);
      placeIcon(s.stage2, rx - sep * 14 * z, ry + sep * 26 * z, 14 * z, { opacity: fade * (sep > 0 && sep < 1 ? 1 - sep : 0), rotate: -45 + tilt + sep * 90 });
      s.star.draw(rx, ry, visible ? (f.t - 1850) / 900 : -1, z, 0.7);
      s.twinkle.draw(rx, ry, visible ? phase(f.t, 1850, 1200) : -1, { mode: 'radial', reach: 50, z, stagger: 0.2 });
    } else {
      const orbitIn = ease.outCubic(phase(f.t, 1800, 500));
      const R = 50 * z;
      setAttrs(s.orbit, { cx: x, cy: y - 30 * z, rx: (R * orbitIn).toFixed(1), ry: (R * 0.32 * orbitIn).toFixed(1), opacity: (fade * orbitIn).toFixed(2), transform: `rotate(-12 ${x} ${y - 30 * z})` });
      const oa = f.t / 380;
      const ox = R * Math.cos(oa); const oy = R * 0.32 * Math.sin(oa);
      const r = (-12 * Math.PI) / 180;
      const sx = f.t > 1900 ? x + ox * Math.cos(r) - oy * Math.sin(r) : rx;
      const sy = f.t > 1900 ? y - 30 * z + ox * Math.sin(r) + oy * Math.cos(r) : ry;
      placeIcon(s.satellite, sx, sy, 16 * z, { opacity: fade * phase(f.t, 1750, 200), rotate: f.t / 20 });
      s.twinkle.draw(sx, sy, visible ? phase(f.t, 1900, 1100) : -1, { mode: 'radial', reach: 16, z, stagger: 0.6 });
    }
    s.label.draw(x, y - 90 * z, visible ? phase(f.t, 1900, 1200) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// silo — the ground hatch slides open, a missile rises into launch position through venting
// steam, a warning light pulses, and the hatch seals again around it.
export const silo = {
  duration: 2600,
  impactAt: () => 400,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      pit: stage.el('ellipse', { fill: '#0f172a', stroke: '#475569', 'stroke-width': 1, opacity: 0 }),
      doorL: stage.el('rect', { fill: '#64748b', opacity: 0 }),
      doorR: stage.el('rect', { fill: '#64748b', opacity: 0 }),
      missile: stage.icon('missile', hot),
      steam: buildParticles(stage, 14, ['#f1f5f9', '#cbd5e1'], { size: 7 }),
      light: stage.el('circle', { fill: '#ef4444', r: 0, opacity: 0 }),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Missile ready', hot)
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2600, 0.03, 0.15) : 0;
    const open = ease.inOutCubic(phase(f.t, 0, 500)) * (1 - ease.inOutCubic(phase(f.t, 1900, 400)));
    const W = 18 * z;
    setAttrs(s.pit, { cx: x, cy: y, rx: W.toFixed(1), ry: (W * 0.35).toFixed(1), opacity: fade.toFixed(2) });
    setAttrs(s.doorL, { x: (x - W - open * W * 0.9).toFixed(1), y: (y - 2 * z).toFixed(1), width: W.toFixed(1), height: (4 * z).toFixed(1), opacity: fade.toFixed(2) });
    setAttrs(s.doorR, { x: (x + open * W * 0.9).toFixed(1), y: (y - 2 * z).toFixed(1), width: W.toFixed(1), height: (4 * z).toFixed(1), opacity: fade.toFixed(2) });
    const rise = ease.outCubic(phase(f.t, 450, 900)) * (1 - 0.35 * phase(f.t, 1900, 400));
    placeIcon(s.missile, x, y - rise * 26 * z, 30 * z, { opacity: fade * (rise > 0.02 ? 1 : 0), rotate: -45 });
    s.steam.draw(x, y, visible ? phase(f.t, 400, 1700) : -1, { mode: 'rise', reach: 44, z, spread: 2.4, stagger: 0.7, sizeScale: 1.4 });
    const blink = Math.sin(f.t / 90) > 0 ? 1 : 0.2;
    setAttrs(s.light, { cx: (x + W + 6 * z).toFixed(1), cy: (y - 6 * z).toFixed(1), r: (2.8 * z).toFixed(1), opacity: (fade * blink).toFixed(2) });
    s.rings.draw(x, y, visible ? phase(f.t, 1300, 900) : -1, { r1: 36, z, squash: 0.5 });
    s.label.draw(x, y - 52 * z, visible ? phase(f.t, 1400, 1100) : -1, z);
  }
};

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
