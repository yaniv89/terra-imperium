// src/effects/scenes/statecraft.js
// Running the state from the capital: research, decrees and laws, the treasury.
import { clamp, ease, phase, envelope, setAttrs, placeIcon, lerp } from '../engine';
import { buildLine, buildRings, buildParticles, buildLabel } from '../fx';

// ---------------------------------------------------------------------------------------------
// knowledge — an atom spins up over the capital (electrons racing round three orbits), a book
// opens beneath it, and at the moment of insight a light bulb flares with rays while ideas rise.
// `coins` (fund scholars): coins stream into the book first. `focus` (research focus): a
// spyglass reticle narrows onto the atom.
export const knowledge = {
  duration: 2600,
  impactAt: () => 1500,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      orbits: [0, 1, 2].map(() => stage.el('ellipse', { fill: 'none', stroke: base, 'stroke-width': 1.2, opacity: 0 })),
      electrons: [0, 1, 2].map(() => stage.el('circle', { fill: hot, r: 0, opacity: 0 })),
      nucleus: stage.el('circle', { fill: hot, r: 0, opacity: 0 }),
      book: stage.icon('book', hot),
      bulb: stage.icon('bulb', '#fde68a'),
      rays: Array.from({ length: 8 }, () => stage.el('line', { stroke: '#fde68a', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0 })),
      ideas: buildParticles(stage, 12, [hot, base, '#fde68a'], { size: 2.6 }),
      coins: p.coins ? Array.from({ length: 5 }, () => stage.icon('coin', '#fde047')) : null,
      reticle: p.focus ? [0, 1].map(() => stage.el('circle', { fill: 'none', stroke: '#e2e8f0', 'stroke-width': 1.4, 'stroke-dasharray': '3 3', opacity: 0 })) : null,
      spyglass: p.focus ? stage.icon('spyglass', '#e2e8f0') : null,
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Breakthrough!', hot),
      p
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2600, 0.04, 0.15) : 0;
    const ay = y - 26 * z;
    const spin = ease.outCubic(phase(f.t, 0, 500));
    const speed = 1 + phase(f.t, 400, 1100) * 3;
    s.orbits.forEach((o, i) => {
      const rot = i * 60 + f.t / 40;
      setAttrs(o, { cx: x, cy: ay, rx: (22 * z * spin).toFixed(1), ry: (8 * z * spin).toFixed(1), transform: `rotate(${rot.toFixed(1)} ${x} ${ay})`, opacity: (fade * 0.8).toFixed(2) });
      const a = (f.t / 1000) * speed * Math.PI * 2 + i * 2.1;
      const ex = 22 * z * spin * Math.cos(a); const ey = 8 * z * spin * Math.sin(a);
      const r = (rot * Math.PI) / 180;
      setAttrs(s.electrons[i], { cx: (x + ex * Math.cos(r) - ey * Math.sin(r)).toFixed(1), cy: (ay + ex * Math.sin(r) + ey * Math.cos(r)).toFixed(1), r: (2.6 * z).toFixed(1), opacity: fade.toFixed(2) });
    });
    setAttrs(s.nucleus, { cx: x, cy: ay, r: (4 * z * spin * (1 + 0.2 * Math.sin(f.t / 80))).toFixed(1), opacity: fade.toFixed(2) });
    placeIcon(s.book, x, y + 6 * z, 22 * z, { opacity: fade * phase(f.t, 150, 300), sy: 0.3 + 0.7 * ease.outBack(phase(f.t, 150, 450)) });
    if (s.coins) s.coins.forEach((c, i) => {
      const u = ease.inCubic(phase(f.t, 200 + i * 130, 500));
      const a = -Math.PI / 2 + (i - 2) * 0.7;
      placeIcon(c, lerp(x + Math.cos(a) * 60 * z, x, u), lerp(y + 6 * z + Math.sin(a) * 40 * z - 20 * z, y + 6 * z, u), 11 * z, { opacity: fade * (u > 0 && u < 1 ? 1 : 0), rotate: u * 300 });
    });
    if (s.reticle) {
      const narrow = ease.inOutCubic(phase(f.t, 300, 1000));
      s.reticle.forEach((c, i) => setAttrs(c, { cx: x, cy: ay, r: (lerp(60, 26, narrow) * z * (1 + i * 0.25)).toFixed(1), opacity: (fade * (1 - phase(f.t, 1400, 400))).toFixed(2), transform: `rotate(${((i ? -1 : 1) * f.t / 15).toFixed(1)} ${x} ${ay})` }));
      placeIcon(s.spyglass, x - 34 * z, ay + 20 * z, 22 * z, { opacity: fade * (1 - phase(f.t, 1400, 400)), rotate: -20 });
    }
    // Eureka: the bulb flares above the atom.
    const eureka = phase(f.t, 1450, 250);
    const by = ay - 30 * z;
    placeIcon(s.bulb, x, by, lerp(10, 22, ease.outBack(eureka)) * z, { opacity: fade * (eureka > 0 ? 1 : 0) });
    s.rays.forEach((ray, i) => {
      const a = (i / 8) * Math.PI * 2;
      const g = envelope(f.t, 1450, 900, 0.2, 0.5);
      setAttrs(ray, { x1: x + Math.cos(a) * 14 * z, y1: by + Math.sin(a) * 14 * z, x2: x + Math.cos(a) * (14 + 10 * g) * z, y2: by + Math.sin(a) * (14 + 10 * g) * z, opacity: (fade * g).toFixed(2) });
    });
    s.ideas.draw(x, ay, visible ? phase(f.t, 1450, 1100) : -1, { mode: 'rise', reach: 50, z, spread: 2 });
    s.rings.draw(x, ay, visible ? phase(f.t, 1450, 900) : -1, { r1: 44, z });
    s.label.draw(x, by - 22 * z, visible ? phase(f.t, 1550, 1000) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// decree — a scroll unrolls over the capital, a quill writes lines across it, and a wax seal
// stamps it with a thump. `crack` (revoking a privilege): the seal cracks with a red slash.
// `throne` (new government): the old throne sinks and a new seat of power rises in a burst of
// rays. `scales` (identity shift): a balance tips across the scroll before the seal lands.
export const decree = {
  duration: 2700,
  impactAt: () => 1700,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      parchment: stage.el('rect', { fill: '#fef3c7', stroke: '#b45309', 'stroke-width': 1, rx: 2, opacity: 0 }),
      rollL: stage.el('rect', { fill: '#d97706', rx: 2, opacity: 0 }),
      rollR: stage.el('rect', { fill: '#d97706', rx: 2, opacity: 0 }),
      lines: Array.from({ length: 4 }, () => buildLine(stage, '#78350f', 1.2)),
      quill: stage.icon('quill', '#f8fafc'),
      seal: stage.icon('seal', p.crack ? '#94a3b8' : base),
      slash: p.crack ? buildLine(stage, '#ef4444', 3) : null,
      throneOld: p.throne ? stage.icon('throne', '#94a3b8') : null,
      throneNew: p.throne ? stage.icon('capitol', hot) : null,
      scales: p.scales ? stage.icon('scales', hot) : null,
      rays: p.throne ? Array.from({ length: 10 }, () => stage.el('line', { stroke: hot, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0 })) : null,
      dust: buildParticles(stage, 8, ['#a8a29e', '#fde68a']),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Decree enacted', hot),
      p
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2700, 0.04, 0.15) : 0;
    const cy = y - 22 * z;
    const unroll = ease.outCubic(phase(f.t, 100, 500));
    const w = 50 * z * unroll; const h = 30 * z;
    setAttrs(s.parchment, { x: (x - w / 2).toFixed(1), y: (cy - h / 2).toFixed(1), width: w.toFixed(1), height: h.toFixed(1), opacity: fade.toFixed(2) });
    setAttrs(s.rollL, { x: (x - w / 2 - 3 * z).toFixed(1), y: (cy - h / 2 - 2 * z).toFixed(1), width: (5 * z).toFixed(1), height: (h + 4 * z).toFixed(1), opacity: fade.toFixed(2) });
    setAttrs(s.rollR, { x: (x + w / 2 - 2 * z).toFixed(1), y: (cy - h / 2 - 2 * z).toFixed(1), width: (5 * z).toFixed(1), height: (h + 4 * z).toFixed(1), opacity: fade.toFixed(2) });
    // Writing: each line is written left to right in turn, the quill riding its tip.
    let quillAt = null;
    s.lines.forEach((ln, i) => {
      const wr = phase(f.t, 550 + i * 230, 230);
      const ly = cy - h / 2 + (7 + i * 6) * z;
      const x0 = x - w / 2 + 6 * z; const x1 = x0 + (w - 12 * z) * (i === 3 ? 0.6 : 1) * wr;
      const wiggle = [];
      for (let k = 0; k <= 8; k += 1) { const xx = lerp(x0, x1, k / 8); wiggle.push({ x: xx, y: ly + Math.sin(k * 2.3 + i) * 0.8 * z }); }
      ln.draw(wr > 0 ? wiggle : null, fade);
      if (wr > 0 && wr < 1) quillAt = { x: x1, y: ly };
    });
    placeIcon(s.quill, quillAt ? quillAt.x + 6 * z : x + w / 2, quillAt ? quillAt.y - 8 * z : cy - 10 * z, 18 * z, { opacity: fade * (f.t < 1550 ? phase(f.t, 450, 150) : 1 - phase(f.t, 1550, 200)), rotate: quillAt ? Math.sin(f.t / 40) * 8 : 0 });
    if (s.scales) placeIcon(s.scales, x, cy - h, 22 * z, { opacity: fade * envelope(f.t, 500, 1300), rotate: Math.sin(f.t / 150) * 25 * (1 - phase(f.t, 1300, 400)) });
    // The seal slams down.
    const slam = phase(f.t, 1650, 220);
    placeIcon(s.seal, x + w / 2 - 8 * z, cy + h / 2 - 6 * z, lerp(40, 16, ease.outBack(slam)) * z, { opacity: fade * (slam > 0 ? 1 : 0), rotate: (1 - slam) * 30 });
    s.dust.draw(x + w / 2 - 8 * z, cy + h / 2 - 6 * z, visible ? phase(f.t, 1850, 500) : -1, { mode: 'radial', reach: 14, z });
    if (s.slash) {
      const cut = phase(f.t, 2000, 200);
      const sx = x + w / 2 - 8 * z; const sy = cy + h / 2 - 6 * z;
      s.slash.draw(cut > 0 ? [{ x: sx - 10 * z, y: sy - 10 * z }, { x: lerp(sx - 10 * z, sx + 10 * z, cut), y: lerp(sy - 10 * z, sy + 10 * z, cut) }] : null, fade);
    }
    if (s.throneOld) {
      const swap = phase(f.t, 1900, 500);
      placeIcon(s.throneOld, x, y + 14 * z + swap * 12 * z, 24 * z, { opacity: fade * (1 - swap) * phase(f.t, 200, 300) });
      placeIcon(s.throneNew, x, y + 30 * z - ease.outBack(swap) * 16 * z, 26 * z, { opacity: fade * swap });
      s.rays.forEach((ray, i) => {
        const a = (i / 10) * Math.PI * 2 + f.t / 800; const g = envelope(f.t, 2000, 700);
        setAttrs(ray, { x1: x + Math.cos(a) * 16 * z, y1: y + 14 * z + Math.sin(a) * 16 * z, x2: x + Math.cos(a) * (16 + 14 * g) * z, y2: y + 14 * z + Math.sin(a) * (16 + 14 * g) * z, opacity: (fade * g).toFixed(2) });
      });
    }
    s.rings.draw(x, cy, visible ? phase(f.t, 1700, 900) : -1, { r1: 44, z });
    s.label.draw(x, cy - h / 2 - 12 * z, visible ? phase(f.t, 1800, 900) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// treasury — streams of coins (or, for levies, marching recruits) converge on the capital from
// the countryside and pile up into a growing hoard.
export const treasury = {
  duration: 2400,
  impactAt: () => 1300,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    const n = 10;
    return {
      movers: Array.from({ length: n }, () => stage.icon(p.figures ? 'person' : 'coin', p.figures ? '#fecaca' : '#fde047')),
      streaks: Array.from({ length: n }, () => buildLine(stage, p.figures ? '#fca5a5' : '#fde68a', 1)),
      hoard: stage.icon(p.figures ? 'fist' : 'coinPile', hot),
      glints: buildParticles(stage, 10, ['#ffffff', '#fde68a'], { size: 2 }),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Treasury filled', hot),
      p
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2400, 0.04, 0.15) : 0;
    const n = s.movers.length;
    let arrived = 0;
    s.movers.forEach((m, i) => {
      const a = (i / n) * Math.PI * 2 + 0.3;
      const u = ease.inCubic(phase(f.t, 100 + i * 90, 700));
      if (u >= 1) arrived += 1;
      const r = lerp(70, 0, u) * z;
      const px = x + Math.cos(a) * r; const py = y + Math.sin(a) * r * 0.55 - Math.sin(u * Math.PI) * 10 * z;
      placeIcon(m, px, py, (s.p.figures ? 12 : 11) * z, { opacity: fade * (u > 0 && u < 1 ? 1 : 0), rotate: s.p.figures ? 0 : u * 540, sx: s.p.figures && Math.cos(a) > 0 ? -1 : 1 });
      const tail = lerp(70, 0, Math.max(0, u - 0.12)) * z;
      s.streaks[i].draw(u > 0 && u < 1 ? [{ x: x + Math.cos(a) * tail, y: y + Math.sin(a) * tail * 0.55 }, { x: px, y: py }] : null, fade * 0.7);
    });
    const grow = clamp(arrived / n, 0, 1);
    placeIcon(s.hoard, x, y - 2 * z - grow * 4 * z, (12 + 18 * ease.outBack(grow)) * z, { opacity: fade * (f.t > 500 ? 1 : 0) });
    s.glints.draw(x, y - 10 * z, visible ? phase(f.t, 1200, 1100) : -1, { mode: 'rise', reach: 30, z, spread: 1.8 });
    s.rings.draw(x, y, visible ? phase(f.t, 1250, 900) : -1, { r1: 40, z, squash: 0.6 });
    s.label.draw(x, y - 34 * z, visible ? phase(f.t, 1300, 1000) : -1, z);
  }
};

