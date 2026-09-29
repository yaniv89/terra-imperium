// src/effects/scenes/domestic.js
// Building up a province: construction, fortifications, roads, mines, settlements, control,
// public order, development.
import { clamp, ease, phase, envelope, hash, hide, setAttrs, placeIcon, lerp, DEG } from '../engine';
import { buildLine, buildRings, buildBurst, buildParticles, buildLabel, buildFlag, buildRevealIcon } from '../fx';
import { getBuildingIconPath, getExtractionIconPath } from '../../data/buildingIcons';
import { getEffectIconPath } from '../../data/effectIcons';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { getNeighborIds } from '../../data/regions';
import { REGION_COORDINATES } from '../../data/regionCoordinates';

// ---------------------------------------------------------------------------------------------
// construct — scaffolding goes up, the building rises out of the ground behind it while hammer
// sparks fly off the build line, the scaffold drops away and a shine sweeps across the finished
// structure. `grand` (great projects) adds golden rays and laurels.
export const construct = {
  duration: 2900,
  impactAt: () => 2000,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    const iconD = p.iconKey
      ? getEffectIconPath(p.iconKey)
      : (getBuildingIconPath(effect.variant, effect.age) || getBuildingIconPath(effect.variant, 'modern') || getEffectIconPath('castle'));
    const label = p.label || (BUILDING_CATEGORIES[effect.variant]?.label ? `${BUILDING_CATEGORIES[effect.variant].label} built` : 'Construction complete');
    return {
      scaffold: Array.from({ length: 7 }, () => stage.el('line', { stroke: '#d6d3d1', 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0 })),
      crane: buildLine(stage, '#fbbf24', 2),
      hook: stage.el('line', { stroke: '#e7e5e4', 'stroke-width': 1, opacity: 0 }),
      building: buildRevealIcon(stage, iconD, hot),
      hammer: stage.icon('hammer', '#e2e8f0'),
      sparks: buildParticles(stage, 10, ['#fde68a', '#ffffff', base], { size: 2 }),
      dust: buildParticles(stage, 10, ['#a8a29e', '#d6d3d1']),
      shine: stage.el('rect', { fill: '#ffffff', opacity: 0 }),
      rays: p.grand ? Array.from({ length: 12 }, () => stage.el('path', { fill: '#facc15', opacity: 0 })) : null,
      laurels: p.grand ? stage.icon('laurels', '#fde68a') : null,
      rings: buildRings(stage, p.grand ? 4 : 2, base),
      label: buildLabel(stage, label, hot),
      p
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z * (s.p.grand ? 1.35 : 1);
    const size = 40 * z;
    const fade = visible ? envelope(f.t, 0, 2900, 0.04, 0.15) : 0;
    const baseY = y + 8 * z;
    // Scaffold: verticals grow up, then crossbars; falls away once the building is done.
    const up = ease.outCubic(phase(f.t, 0, 500));
    const fall = phase(f.t, 1900, 500);
    const sw = size * 0.55; const sh = size * 0.95;
    s.scaffold.forEach((ln, i) => {
      if (fade <= 0) { hide(ln); return; }
      const o = (1 - fall) * fade;
      const drop = fall * 18 * z;
      if (i < 4) { // verticals
        const lx = x - sw + (i * 2 * sw) / 3;
        setAttrs(ln, { x1: lx, y1: baseY + drop, x2: lx + fall * (i - 1.5) * 6 * z, y2: baseY - sh * up + drop, opacity: o.toFixed(2) });
      } else { // crossbars
        const k = i - 3; const ly = baseY - (sh * k) / 3.2 + drop;
        const g = phase(f.t, 300 + k * 90, 250);
        setAttrs(ln, { x1: x - sw, y1: ly, x2: x - sw + 2 * sw * g, y2: ly + fall * 8 * z, opacity: (o * (g > 0 ? 1 : 0)).toFixed(2) });
      }
    });
    // Crane arm swinging over the site, a hook line lowering.
    const swing = Math.sin(f.t / 380) * 0.35;
    const craneBase = { x: x + sw + 6 * z, y: baseY };
    const craneTop = { x: craneBase.x, y: baseY - sh * 1.25 * up };
    const armEnd = { x: craneTop.x - Math.cos(swing) * size * 0.9, y: craneTop.y + Math.sin(swing) * 4 * z };
    s.crane.draw([craneBase, craneTop, armEnd], (1 - fall) * fade);
    setAttrs(s.hook, { x1: armEnd.x, y1: armEnd.y, x2: armEnd.x, y2: armEnd.y + (10 + 8 * Math.sin(f.t / 300)) * z, opacity: ((1 - fall) * fade * up).toFixed(2) });
    // The building rising out of the ground.
    const reveal = ease.inOutCubic(phase(f.t, 400, 1500));
    const top = s.building.draw(x, baseY - size / 2, size, reveal, fade);
    // Hammering at the build line, with sparks.
    const building = f.t > 400 && f.t < 1900;
    const strike = Math.abs(Math.sin(f.t / 110));
    placeIcon(s.hammer, x + (hash(Math.floor(f.t / 220), 1) - 0.5) * size * 0.8, top - 6 * z, 14 * z, { opacity: building ? fade : 0, rotate: -40 + strike * 50 });
    s.sparks.draw(x, top, building ? (f.t % 220) / 220 : -1, { mode: 'radial', reach: 14, z, stagger: 0.7, seed: Math.floor(f.t / 220) });
    s.dust.draw(x, baseY, visible ? phase(f.t, 1900, 800) : -1, { mode: 'dust', reach: 44, z, stagger: 0.3 });
    // Shine sweep across the finished building.
    const sweep = phase(f.t, 2050, 450);
    if (sweep > 0 && sweep < 1 && fade > 0) setAttrs(s.shine, { x: (x - size * 0.7 + sweep * size * 1.4).toFixed(1), y: (baseY - size).toFixed(1), width: (5 * z).toFixed(1), height: size.toFixed(1), opacity: (0.55 * Math.sin(sweep * Math.PI) * fade).toFixed(2), transform: `translate(${x} ${baseY}) skewX(-18) translate(${-x} ${-baseY})` });
    else hide(s.shine);
    if (s.rays) {
      const g = ease.outCubic(phase(f.t, 1950, 500));
      s.rays.forEach((ray, i) => {
        const a = (i / 12) * Math.PI * 2 + f.t / 1500;
        const r0 = size * 0.6; const r1 = r0 + size * (0.5 + 0.3 * (i % 2)) * g;
        const w = 0.07;
        setAttrs(ray, { d: `M ${x + Math.cos(a - w) * r0} ${baseY - size / 2 + Math.sin(a - w) * r0} L ${x + Math.cos(a) * r1} ${baseY - size / 2 + Math.sin(a) * r1} L ${x + Math.cos(a + w) * r0} ${baseY - size / 2 + Math.sin(a + w) * r0} Z`, opacity: (0.5 * g * fade).toFixed(2) });
      });
      placeIcon(s.laurels, x, baseY - size / 2, size * 1.5, { opacity: fade * ease.outCubic(phase(f.t, 2100, 400)) * 0.9 });
    }
    s.rings.draw(x, baseY - size / 2, visible ? phase(f.t, 1950, 900) : -1, { r1: 50, z });
    s.label.draw(x, baseY - size - 12 * z, visible ? phase(f.t, 2000, 900) : -1, f.z);
  }
};

// ---------------------------------------------------------------------------------------------
// fortify — wall sections slam into place one after another around the province, each with a
// thud of dust, until the ring closes and flashes. `dome`: an ABM shield dome forms instead,
// with a shimmering lattice and an interceptor test-fire.
export const fortify = {
  duration: 2600,
  impactAt: () => 400,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    const N = 8;
    return {
      segs: Array.from({ length: N }, () => ({ path: stage.el('path', { fill: 'none', stroke: hot, 'stroke-width': 5, 'stroke-linecap': 'butt', opacity: 0 }), dust: buildParticles(stage, 4, ['#a8a29e', '#d6d3d1']) })),
      dome: p.dome ? stage.el('path', { fill: base, 'fill-opacity': 0.15, stroke: hot, 'stroke-width': 1.6, opacity: 0 }) : null,
      lattice: p.dome ? Array.from({ length: 4 }, () => stage.el('path', { fill: 'none', stroke: hot, 'stroke-width': 0.8, 'stroke-dasharray': '3 4', opacity: 0 })) : null,
      interceptor: p.dome ? buildBurst(stage, base, hot, { rings: 2, debris: 6, fireball: 0.35 }) : null,
      keep: stage.icon(p.dome ? 'eyeShield' : 'castle', hot),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Fortified', hot),
      p
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2600, 0.03, 0.15) : 0;
    const R = 38 * z; const squash = 0.5;
    const N = s.segs.length;
    s.segs.forEach((seg, i) => {
      const land = phase(f.t, 200 + i * 150, 220);
      const a0 = (i / N) * Math.PI * 2 + 0.06; const a1 = ((i + 1) / N) * Math.PI * 2 - 0.06;
      const r = R + (1 - ease.outBounce(land)) * 40 * z;
      const arc = `M ${x + Math.cos(a0) * r} ${y + Math.sin(a0) * r * squash} A ${r} ${r * squash} 0 0 1 ${x + Math.cos(a1) * r} ${y + Math.sin(a1) * r * squash}`;
      setAttrs(seg.path, { d: arc, opacity: (land > 0 ? fade : 0).toFixed(2), 'stroke-width': (5 * z).toFixed(1) });
      const am = (a0 + a1) / 2;
      seg.dust.draw(x + Math.cos(am) * R, y + Math.sin(am) * R * squash, visible ? phase(f.t, 420 + i * 150, 500) : -1, { mode: 'dust', reach: 10, z, seed: i });
    });
    if (s.dome) {
      const g = ease.outCubic(phase(f.t, 1400, 600));
      const h = R * 1.1 * g;
      setAttrs(s.dome, { d: `M ${x - R} ${y} A ${R} ${h || 0.1} 0 0 1 ${x + R} ${y} Z`, opacity: (fade * g).toFixed(2) });
      s.lattice.forEach((l, i) => {
        const k = (i + 1) / 5;
        setAttrs(l, { d: `M ${x - R * (1 - k * 0.2)} ${y} A ${R * (1 - k * 0.2)} ${h * (1 - k * 0.35) || 0.1} 0 0 1 ${x + R * (1 - k * 0.2)} ${y}`, opacity: (0.7 * fade * g).toFixed(2), 'stroke-dashoffset': (-f.t / 30).toFixed(1) });
      });
      s.interceptor.draw(x, y - h, visible ? (f.t - 2000) / 600 : -1, z, 0.5);
    }
    placeIcon(s.keep, x, y - 4 * z, 26 * z, { opacity: fade * ease.outCubic(phase(f.t, 1500, 400)) });
    s.rings.draw(x, y, visible ? phase(f.t, 1450, 900) : -1, { r1: 50, z, squash });
    s.label.draw(x, y - R - 6 * z, visible ? phase(f.t, 1600, 950) : -1, z);
  }
};

// Screen bearings (radians, y down) for the roads out of a province: toward each real neighbour
// first — only the direction is used, since a neighbour's centroid can sit almost on top of a small
// capital province — then filled into the widest gaps so there are always at least five roads.
const roadBearings = (regionId) => {
  const home = REGION_COORDINATES[regionId];
  const out = [];
  if (home) {
    getNeighborIds(regionId).forEach((id) => {
      const n = REGION_COORDINATES[id];
      if (!n) return;
      const dx = (n.lng - home.lng) * Math.cos(home.lat * DEG); const dy = home.lat - n.lat;
      if (Math.hypot(dx, dy) < 1e-4) return;
      const a = Math.atan2(dy, dx);
      if (out.every((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) > 0.6)) out.push(a);
    });
  }
  if (out.length === 0) out.push(-Math.PI / 2 + 0.3);
  while (out.length < 5) {
    const sorted = [...out].sort((p, q) => p - q);
    let best = 0; let gap = -1;
    sorted.forEach((b, i) => {
      const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2;
      if (next - b > gap) { gap = next - b; best = b + gap / 2; }
    });
    out.push(best);
  }
  return out.slice(0, 6);
};

// ---------------------------------------------------------------------------------------------
// roads — paved roads unroll from the province toward each real neighbouring province, then
// wagons start rolling along them.
export const roads = {
  duration: 2700,
  impactAt: () => 300,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    const bearings = roadBearings(effect.toRegionId);
    return {
      bearings,
      roads: bearings.map(() => ({ bed: buildLine(stage, '#78716c', 5), paving: buildLine(stage, hot, 1.6, { 'stroke-dasharray': '4 4' }), cart: stage.el('circle', { fill: '#fde68a', stroke: '#78350f', 'stroke-width': 0.8, r: 0, opacity: 0 }), node: stage.el('circle', { fill: base, r: 0, opacity: 0 }) })),
      hub: stage.icon('cog', hot),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Infrastructure improved', hot)
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2700, 0.04, 0.15) : 0;
    placeIcon(s.hub, x, y, 20 * z, { opacity: fade, rotate: f.t / 6 });
    s.roads.forEach((r, i) => {
      const a = s.bearings[i];
      const len = (40 + (i % 3) * 9) * z;
      const grow = ease.inOutCubic(phase(f.t, 200 + i * 140, 700));
      // A gentle bend halfway, so the roads read as roads rather than spokes.
      const bend = (i % 2 ? 1 : -1) * 6 * z;
      const mid = { x: x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, y: y + (Math.sin(a) * len * 0.5 + Math.cos(a) * bend) * 0.8 };
      const tip = { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len * 0.8 };
      const end = grow < 0.5
        ? { x: lerp(x, mid.x, grow * 2), y: lerp(y, mid.y, grow * 2) }
        : { x: lerp(mid.x, tip.x, grow * 2 - 1), y: lerp(mid.y, tip.y, grow * 2 - 1) };
      const pts = grow < 0.5 ? [{ x, y }, end] : [{ x, y }, mid, end];
      r.bed.draw(pts, grow > 0 ? fade * 0.8 : 0);
      r.paving.draw(pts, grow > 0 ? fade : 0);
      setAttrs(r.node, grow >= 1 ? { cx: end.x, cy: end.y, r: (3.5 * z * (1 + 0.3 * Math.sin(f.t / 150 + i))).toFixed(1), opacity: fade.toFixed(2) } : { opacity: 0 });
      const cartT = ((f.t - 1100 - i * 120) % 900) / 900;
      const cart = cartT < 0.5 ? { x: lerp(x, mid.x, cartT * 2), y: lerp(y, mid.y, cartT * 2) } : { x: lerp(mid.x, tip.x, cartT * 2 - 1), y: lerp(mid.y, tip.y, cartT * 2 - 1) };
      if (f.t > 1100 + i * 120 && grow >= 1) setAttrs(r.cart, { cx: cart.x.toFixed(1), cy: cart.y.toFixed(1), r: (2.6 * z).toFixed(1), opacity: fade.toFixed(2) });
      else hide(r.cart);
    });
    s.rings.draw(x, y, visible ? phase(f.t, 150, 900) : -1, { r1: 30, z });
    s.label.draw(x, y - 26 * z, visible ? phase(f.t, 1200, 1300) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// mine — a pickaxe bites into the rock three times; each strike sprays sparks and knocks ore
// chunks tumbling onto a pile, and the resource itself rises gleaming from the heap.
export const mine = {
  duration: 2600,
  impactAt: () => 350,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      rock: stage.el('path', { fill: '#57534e', stroke: '#a8a29e', 'stroke-width': 1, opacity: 0 }),
      pick: stage.icon('pickaxe', '#e2e8f0'),
      sparks: [0, 1, 2].map(() => buildParticles(stage, 8, ['#fde68a', '#ffffff', base], { size: 2 })),
      ore: [0, 1, 2].map(() => buildParticles(stage, 5, [base, hot, '#a16207'], { shape: 'rect', size: 4 })),
      pile: stage.el('ellipse', { fill: base, opacity: 0 }),
      resource: stage.icon(getExtractionIconPath(effect.variant) || getEffectIconPath('pickaxe'), hot),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || `${effect.variant ? `${effect.variant[0].toUpperCase()}${effect.variant.slice(1)} site` : 'Resource site'} opened`, hot)
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2600, 0.04, 0.15) : 0;
    const rx = x - 10 * z; const ry = y;
    setAttrs(s.rock, { d: `M ${rx - 14 * z} ${ry + 8 * z} L ${rx - 9 * z} ${ry - 8 * z} L ${rx + 2 * z} ${ry - 12 * z} L ${rx + 12 * z} ${ry - 4 * z} L ${rx + 14 * z} ${ry + 8 * z} Z`, opacity: fade.toFixed(2) });
    const cycle = 420;
    const k = Math.min(2, Math.floor((f.t - 150) / cycle));
    const within = ((f.t - 150) % cycle) / cycle;
    const swinging = f.t > 150 && f.t < 150 + cycle * 3;
    const angle = swinging ? (within < 0.7 ? lerp(-70, 20, ease.inCubic(within / 0.7)) : lerp(20, -10, (within - 0.7) / 0.3)) : -40;
    placeIcon(s.pick, rx + 14 * z, ry - 16 * z, 24 * z, { opacity: fade * (f.t < 1600 ? 1 : 1 - phase(f.t, 1600, 300)), rotate: angle });
    s.sparks.forEach((sp, i) => sp.draw(rx + 6 * z, ry - 6 * z, visible ? phase(f.t, 150 + i * cycle + cycle * 0.7, 380) : -1, { mode: 'radial', reach: 20, z, seed: i, stagger: 0.2 }));
    s.ore.forEach((o, i) => o.draw(rx + 6 * z, ry - 6 * z, visible ? phase(f.t, 150 + i * cycle + cycle * 0.7, 650) : -1, { mode: 'fall', reach: 18, z, seed: i + 4, stagger: 0.25, angle0: -0.3, arc: 1.2 }));
    const pileGrow = clamp((k + (swinging ? within : 1)) / 3, 0, 1);
    setAttrs(s.pile, { cx: x + 14 * z, cy: y + 8 * z, rx: (12 * z * pileGrow).toFixed(1), ry: (4 * z * pileGrow).toFixed(1), opacity: (0.9 * fade).toFixed(2) });
    const rise = ease.outBack(phase(f.t, 1500, 500));
    placeIcon(s.resource, x + 14 * z, y - rise * 20 * z, 26 * z, { opacity: fade * phase(f.t, 1500, 200) });
    s.rings.draw(x + 14 * z, y - 20 * z, visible ? phase(f.t, 1650, 900) : -1, { r1: 36, z });
    s.label.draw(x, y - 48 * z, visible ? phase(f.t, 1700, 900) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// growth — settlement: (optionally) a flag is planted first, then houses pop up in a spiral while
// settlers walk in and green shoots rise. Population policy, settle/colonize.
export const growth = {
  duration: 2600,
  // With a flag, the settlement lands once the flag is planted.
  impactAt: (p) => (p.flag ? 800 : 300),
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      flag: p.flag ? buildFlag(stage, base, hot) : null,
      houses: Array.from({ length: 7 }, () => stage.icon('house', hot)),
      walkers: Array.from({ length: 6 }, () => stage.icon('person', '#e2e8f0')),
      shoots: buildParticles(stage, 12, ['#4ade80', '#86efac', '#bbf7d0'], { size: 2.4 }),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Population grows', hot),
      p
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2600, 0.04, 0.15) : 0;
    const offset = s.flag ? 450 : 0;
    if (s.flag) s.flag.draw(x, y, phase(f.t, 0, 450), f.t, z, fade);
    s.houses.forEach((h, i) => {
      const a = i * 2.4; const r = (8 + i * 4.5) * z;
      const pop = ease.outBack(phase(f.t, offset + 150 + i * 150, 300));
      placeIcon(h, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55 + 4 * z, 13 * z * pop, { opacity: fade });
    });
    s.walkers.forEach((w, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const m = ease.outCubic(phase(f.t, offset + 200 + i * 120, 900));
      const px = x + Math.cos(a) * lerp(70, 18, m) * z; const py = y + Math.sin(a) * lerp(40, 10, m) * z;
      placeIcon(w, px, py - Math.abs(Math.sin(f.t / 80 + i)) * 2 * z, 10 * z, { opacity: fade * (m > 0 && m < 1 ? 1 : 0), sx: Math.cos(a) > 0 ? -1 : 1 });
    });
    s.shoots.draw(x, y + 6 * z, visible ? phase(f.t, offset + 400, 1500) : -1, { mode: 'rise', reach: 34, z, spread: 2.2, stagger: 0.6 });
    s.rings.draw(x, y + 4 * z, visible ? phase(f.t, offset + 300, 1100) : -1, { r1: 48, z, squash: 0.5 });
    s.label.draw(x, y - 32 * z, visible ? phase(f.t, offset + 1000, 1200) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// claim — a flag drops in and plants itself, then a dashed border draws itself around the
// province, ticking outward. `crown` (move capital): a crown descends onto the flag. `chains`
// (declare independence): chains around the province snap apart first. `pull` (seize land):
// the border contracts, drawing motes inward. `coins` (sell land): coins spill outward.
export const claim = {
  duration: 2600,
  // Breaking the chains comes first, so the flag lands later.
  impactAt: (p) => (p.chains ? 1200 : 500),
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      flag: buildFlag(stage, base, hot),
      dust: buildParticles(stage, 8, ['#a8a29e', '#d6d3d1']),
      border: stage.el('ellipse', { fill: base, 'fill-opacity': 0.08, stroke: hot, 'stroke-width': 2, 'stroke-dasharray': '6 5', opacity: 0 }),
      ticks: Array.from({ length: 12 }, () => stage.el('line', { stroke: hot, 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0 })),
      crown: p.crown ? stage.icon('crown', '#fde047') : null,
      chainL: p.chains ? stage.icon('brokenChain', '#cbd5e1') : null,
      chainR: p.chains ? stage.icon('brokenChain', '#cbd5e1') : null,
      fireworks: p.chains ? buildParticles(stage, 16, ['#f87171', '#fbbf24', '#ffffff'], { size: 2.4 }) : null,
      motes: (p.pull || p.coins) ? buildParticles(stage, 10, p.coins ? ['#fde047', '#facc15'] : [hot, base], { size: 3 }) : null,
      coinIcons: p.coins ? Array.from({ length: 5 }, () => stage.icon('coin', '#fde047')) : null,
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Control tightened', hot),
      p
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2600, 0.04, 0.15) : 0;
    const lead = s.p.chains ? 700 : 0;
    if (s.p.chains) {
      const snap = ease.outCubic(phase(f.t, 400, 600));
      placeIcon(s.chainL, x - 10 * z - snap * 40 * z, y - snap * 10 * z, 24 * z, { opacity: fade * (1 - phase(f.t, 700, 400)), rotate: -snap * 50 });
      placeIcon(s.chainR, x + 10 * z + snap * 40 * z, y - snap * 10 * z, 24 * z, { opacity: fade * (1 - phase(f.t, 700, 400)), rotate: snap * 50, sx: -1 });
      s.fireworks.draw(x, y - 40 * z, visible ? phase(f.t, 1500, 1000) : -1, { mode: 'radial', reach: 34, z, stagger: 0.15 });
    }
    s.flag.draw(x, y, phase(f.t, lead, 450), f.t, z, fade);
    s.dust.draw(x, y, visible ? phase(f.t, lead + 250, 600) : -1, { mode: 'dust', reach: 16, z });
    let R = 44 * z * ease.outCubic(phase(f.t, lead + 400, 700));
    if (s.p.pull) R *= 1.25 - 0.35 * ease.inOutCubic(phase(f.t, lead + 1100, 800));
    const draw = phase(f.t, lead + 400, 900);
    const circumference = 2 * Math.PI * R;
    setAttrs(s.border, { cx: x, cy: y, rx: R.toFixed(1), ry: (R * 0.5).toFixed(1), opacity: (fade * (R > 0 ? 1 : 0)).toFixed(2), 'stroke-dasharray': `${(circumference * draw).toFixed(1)} ${circumference.toFixed(1)}`, transform: `rotate(${(f.t / 40).toFixed(1)} ${x} ${y})` });
    s.ticks.forEach((tk, i) => {
      const a = (i / 12) * Math.PI * 2;
      const g = phase(f.t, lead + 900 + i * 30, 300);
      setAttrs(tk, { x1: x + Math.cos(a) * R, y1: y + Math.sin(a) * R * 0.5, x2: x + Math.cos(a) * (R + 7 * z * g), y2: y + Math.sin(a) * (R + 7 * z * g) * 0.5, opacity: (fade * g).toFixed(2) });
    });
    if (s.crown) {
      const drop = ease.outBounce(phase(f.t, 900, 600));
      placeIcon(s.crown, x + 10 * z, y - 70 * z + drop * 30 * z, 22 * z, { opacity: fade * phase(f.t, 900, 150) });
    }
    if (s.motes) {
      if (s.p.pull) s.motes.draw(x, y, visible ? 1 - phase(f.t, lead + 1100, 900) : -1, { mode: 'radial', reach: 55, z, stagger: 0 });
      else s.motes.draw(x, y, visible ? phase(f.t, 600, 1300) : -1, { mode: 'fall', reach: 34, z });
    }
    if (s.coinIcons) s.coinIcons.forEach((c, i) => {
      const u = phase(f.t, 600 + i * 120, 900);
      const a = (i / 5) * Math.PI * 2;
      placeIcon(c, x + Math.cos(a) * u * 50 * z, y + Math.sin(a) * u * 22 * z - Math.sin(u * Math.PI) * 18 * z, 12 * z, { opacity: fade * (u > 0 && u < 1 ? 1 : 0), rotate: u * 360 });
    });
    s.rings.draw(x, y, visible ? phase(f.t, lead + 400, 1000) : -1, { r1: 50, z, squash: 0.5 });
    s.label.draw(x, y - 48 * z, visible ? phase(f.t, lead + 800, 1200) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// order — unrest flickers as red sparks and torches around the province; a shield slams down at
// its centre and a calming blue wave rolls outward, turning the sparks blue and settling them.
// `scales` (increase stability): the scales of justice tip wildly then settle level.
export const order = {
  duration: 2500,
  impactAt: () => 800,
  build(stage, effect, p) {
    const { hot } = p.palette;
    return {
      sparks: Array.from({ length: 12 }, () => stage.el('circle', { r: 0, opacity: 0 })),
      torches: p.scales ? null : Array.from({ length: 3 }, () => stage.icon('torch', '#fb923c')),
      emblem: stage.icon(p.scales ? 'scales' : 'shield', hot),
      wave: buildRings(stage, 3, '#60a5fa', { first: '#dbeafe' }),
      label: buildLabel(stage, p.label || 'Unrest quelled', '#bfdbfe'),
      p
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2500, 0.04, 0.15) : 0;
    const calm = phase(f.t, 800, 900);
    s.sparks.forEach((sp, i) => {
      const a = (i / 12) * Math.PI * 2 + hash(i, 1);
      const r = (16 + hash(i, 2) * 30) * z;
      const jitter = (1 - calm) * 3 * z;
      const px = x + Math.cos(a) * r + Math.sin(f.t / 37 + i * 3) * jitter;
      const py = y + Math.sin(a) * r * 0.55 + Math.cos(f.t / 41 + i * 5) * jitter + calm * 6 * z;
      const reached = calm > (r / z - 16) / 30;
      setAttrs(sp, { cx: px.toFixed(1), cy: py.toFixed(1), r: (2.6 * z * (1 - calm * 0.5)).toFixed(1), fill: reached ? '#93c5fd' : (i % 2 ? '#f87171' : '#fb923c'), opacity: (fade * (1 - phase(f.t, 1500, 800))).toFixed(2) });
    });
    if (s.torches) s.torches.forEach((tc, i) => {
      const a = (i / 3) * Math.PI * 2 + 0.8;
      placeIcon(tc, x + Math.cos(a) * 28 * z, y + Math.sin(a) * 14 * z - 6 * z, 14 * z, { opacity: fade * (1 - calm), rotate: Math.sin(f.t / 70 + i) * 12 });
    });
    const slam = phase(f.t, 600, 260);
    const tilt = s.p.scales ? Math.sin(f.t / 120) * 22 * Math.max(0, 1 - phase(f.t, 600, 1200)) : 0;
    placeIcon(s.emblem, x, y - 8 * z, lerp(56, 28, ease.outBack(slam)) * z, { opacity: fade * (slam > 0 ? 1 : 0), rotate: tilt });
    s.wave.draw(x, y, visible ? phase(f.t, 800, 1300) : -1, { r1: 60, z, squash: 0.55 });
    s.label.draw(x, y - 34 * z, visible ? phase(f.t, 1000, 1400) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// develop — the province's economy, industry and manpower (coin, cog, figure) orbit and spiral
// inward, stacking into rising chevrons: "+1 development".
export const develop = {
  duration: 2400,
  impactAt: () => 1200,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      orbiters: ['coin', 'cog', 'person'].map((k) => stage.icon(k, hot)),
      trails: buildParticles(stage, 12, [base, hot], { size: 2 }),
      arrows: Array.from({ length: 3 }, () => stage.el('path', { fill: base, stroke: hot, 'stroke-width': 0.8, opacity: 0 })),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || '+1 Development', hot)
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2400, 0.04, 0.15) : 0;
    const spiral = ease.inCubic(phase(f.t, 0, 1200));
    s.orbiters.forEach((o, i) => {
      const a = f.t / 260 + (i / 3) * Math.PI * 2;
      const r = lerp(40, 4, spiral) * z;
      placeIcon(o, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55, 14 * z, { opacity: fade * (1 - phase(f.t, 1150, 150)), rotate: a * 30 });
    });
    s.trails.draw(x, y, visible && f.t < 1200 ? (f.t % 400) / 400 : -1, { mode: 'swirl', reach: 36, z, stagger: 0.8 });
    s.arrows.forEach((ar, i) => {
      const g = ease.outBack(phase(f.t, 1150 + i * 140, 300));
      const ay = y - 10 * z - i * 11 * z - g * 6 * z;
      const w = 12 * z * g; const h = 7 * z * g;
      setAttrs(ar, { d: `M ${x - w} ${ay + h} L ${x} ${ay} L ${x + w} ${ay + h} L ${x + w * 0.6} ${ay + h + 3 * z} L ${x} ${ay + 3 * z * 1.4} L ${x - w * 0.6} ${ay + h + 3 * z} Z`, opacity: (fade * (g > 0 ? 1 : 0)).toFixed(2) });
    });
    s.rings.draw(x, y, visible ? phase(f.t, 1150, 900) : -1, { r1: 44, z });
    s.label.draw(x, y - 50 * z, visible ? phase(f.t, 1300, 1000) : -1, z);
  }
};
