// src/effects/scenes/diplomacy.js
// Capital-to-capital diplomacy. Most of these travel along a trajectory between the two capitals
// (f.from -> f.to); counter-intelligence is the one single-capital scene.
import { clamp, ease, phase, envelope, hash, setAttrs, makeTrajectory, sampleTrajectory, pointOnTrajectory, placeIcon, lerp } from '../engine';
import { buildTrail, buildLine, buildRings, buildBurst, buildParticles, buildLabel, buildFlag } from '../fx';

const trajFor = (s, f, opts) => { if (!s.traj) s.traj = makeTrajectory(f.from, f.to, opts); return s.traj; };

// ---------------------------------------------------------------------------------------------
// tradeRoute — the route is surveyed as a dotted line, then caravans of coins and goods shuttle
// both ways along it; a handshake seals it in the middle.
export const tradeRoute = {
  duration: 3000,
  impactAt: () => 1800,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      route: buildLine(stage, base, 2.4, { 'stroke-dasharray': '1 5' }),
      goods: Array.from({ length: 8 }, (_, i) => stage.icon(i % 2 ? 'coin' : 'chest', i % 2 ? '#fde047' : '#fdba74')),
      shake: stage.icon('handshake', hot),
      ends: [0, 1].map(() => buildRings(stage, 1, base)),
      sparkle: buildParticles(stage, 10, [hot, '#ffffff'], { size: 2 }),
      label: buildLabel(stage, p.label || 'Trade agreement', hot)
    };
  },
  draw(s, f) {
    const traj = trajFor(s, f, { lateral: 0.18, loft: 0.12 });
    const z = f.z;
    const fade = envelope(f.t, 0, 3000, 0.04, 0.15);
    const survey = ease.inOutCubic(phase(f.t, 0, 700));
    s.route.draw(sampleTrajectory(f, traj, 0, Math.max(0.02, survey), 30), fade);
    s.goods.forEach((g, i) => {
      const forward = i % 2 === 0;
      const start = 600 + Math.floor(i / 2) * 260;
      const u = phase(f.t, start, 1100);
      const t = forward ? u : 1 - u;
      const pt = pointOnTrajectory(f, traj, t);
      placeIcon(g, pt.x, pt.y - 4 * z, 11 * z, { opacity: pt.visible && u > 0 && u < 1 ? fade : 0, rotate: forward ? 0 : 0 });
    });
    const mid = pointOnTrajectory(f, traj, 0.5);
    const seal = phase(f.t, 1800, 260);
    placeIcon(s.shake, mid.x, mid.y - 16 * z, lerp(10, 26, ease.outBack(seal)) * z, { opacity: mid.visible ? fade * (seal > 0 ? 1 : 0) : 0 });
    s.sparkle.draw(mid.x, mid.y - 16 * z, mid.visible ? phase(f.t, 1800, 1000) : -1, { mode: 'radial', reach: 28, z });
    s.ends[0].draw(f.src.x, f.src.y, f.src.visible ? phase(f.t, 1700, 900) : -1, { r1: 26, z, squash: 0.5 });
    s.ends[1].draw(f.dst.x, f.dst.y, f.dst.visible ? phase(f.t, 1700, 900) : -1, { r1: 26, z, squash: 0.5 });
    s.label.draw(mid.x, mid.y - 34 * z, mid.visible ? phase(f.t, 1900, 1000) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// gift — a treasure chest is lobbed high across the map and bursts open over the recipient in a
// shower of bouncing coins.
export const gift = {
  duration: 2700,
  impactAt: () => 1300,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      trail: buildTrail(stage, base, hot, 2, { glow: true }),
      chest: stage.icon('chest', '#fdba74'),
      coins: Array.from({ length: 10 }, () => stage.icon('coin', '#fde047')),
      glints: buildParticles(stage, 10, ['#ffffff', '#fde68a'], { size: 2 }),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Gift received', hot)
    };
  },
  draw(s, f) {
    const traj = trajFor(s, f, { lateral: 0.1, loft: 0.6 });
    const z = f.z;
    const fade = envelope(f.t, 0, 2700, 0.04, 0.15);
    const fly = ease.inOutCubic(phase(f.t, 100, 1200));
    const pts = sampleTrajectory(f, traj, Math.max(0, fly - 0.25), fly, 16);
    s.trail.draw(f.t < 1300 ? pts : null, fade);
    const pt = pointOnTrajectory(f, traj, fly);
    placeIcon(s.chest, pt.x, pt.y, 18 * z, { opacity: pt.visible && f.t < 1350 ? fade : 0, rotate: f.t / 5 });
    const { x, y, visible } = f.dst;
    s.coins.forEach((c, i) => {
      const u = phase(f.t, 1300 + i * 40, 900);
      const a = -Math.PI / 2 + (hash(i, 1) - 0.5) * 2.4;
      const v = 36 * (0.6 + hash(i, 2) * 0.6) * z;
      const px = x + Math.cos(a) * v * u; const bounce = Math.abs(Math.sin(u * Math.PI * 2)) * (1 - u);
      const py = y - 24 * z - Math.sin(a) * -1 * v * u * 0.2 + u * 26 * z - bounce * 14 * z;
      placeIcon(c, px, py, 10 * z, { opacity: visible && u > 0 && u < 1 ? fade : 0, rotate: u * 720 });
    });
    s.glints.draw(x, y - 10 * z, visible ? phase(f.t, 1300, 1100) : -1, { mode: 'rise', reach: 30, z, spread: 2 });
    s.rings.draw(x, y, visible ? phase(f.t, 1300, 900) : -1, { r1: 40, z, squash: 0.55 });
    s.label.draw(x, y - 44 * z, visible ? phase(f.t, 1400, 1100) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// envoy — an emissary carries a sealed scroll across the map (dotted trail behind), and on
// arrival an embassy flag goes up. `dove` (sue for peace): a white dove flaps across instead and
// laurels bloom over the enemy capital.
export const envoy = {
  duration: 2800,
  impactAt: () => 1500,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      trail: buildLine(stage, base, 1.6, { 'stroke-dasharray': '2 4' }),
      carrier: stage.icon(p.dove ? 'dove' : 'scroll', p.dove ? '#ffffff' : '#fde68a'),
      feathers: p.dove ? buildParticles(stage, 8, ['#ffffff', '#e2e8f0'], { size: 2 }) : null,
      flag: p.dove ? null : buildFlag(stage, base, hot),
      laurels: p.dove ? stage.icon('laurels', '#bef264') : null,
      rings: buildRings(stage, 2, base, { first: p.dove ? '#ffffff' : '#ffffff' }),
      label: buildLabel(stage, p.label || 'Envoy arrives', hot),
      p
    };
  },
  draw(s, f) {
    const traj = trajFor(s, f, { lateral: 0.12, loft: s.p.dove ? 0.35 : 0.15 });
    const z = f.z;
    const fade = envelope(f.t, 0, 2800, 0.04, 0.15);
    const go = ease.inOutCubic(phase(f.t, 0, 1450));
    s.trail.draw(sampleTrajectory(f, traj, 0, Math.max(0.02, go), 24), fade * 0.8);
    const pt = pointOnTrajectory(f, traj, go);
    const flap = s.p.dove ? 0.55 + 0.45 * Math.abs(Math.sin(f.t / 70)) : 1;
    placeIcon(s.carrier, pt.x, pt.y - 6 * z + (s.p.dove ? Math.sin(f.t / 140) * 3 * z : 0), 18 * z, { opacity: pt.visible && f.t < 1500 ? fade : 0, sy: flap, sx: Math.cos((pt.heading * Math.PI) / 180) < 0 ? -1 : 1 });
    if (s.feathers) s.feathers.draw(pt.x, pt.y, pt.visible && f.t < 1500 ? (f.t % 500) / 500 : -1, { mode: 'fall', reach: 12, z, stagger: 0.8 });
    const { x, y, visible } = f.dst;
    if (s.flag) s.flag.draw(x, y, phase(f.t, 1450, 450), f.t, z, visible ? fade : 0);
    if (s.laurels) placeIcon(s.laurels, x, y - 10 * z, 34 * z * ease.outBack(phase(f.t, 1450, 400)), { opacity: visible ? fade : 0 });
    s.rings.draw(x, y, visible ? phase(f.t, 1450, 1000) : -1, { r1: 40, z, squash: 0.55 });
    s.label.draw(x, y - 44 * z, visible ? phase(f.t, 1600, 1100) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// claimLine — a map unrolls at home, a dashed claim line creeps across to the target, and a
// stamp slams down on it, leaving a dashed claim border.
export const claimLine = {
  duration: 2700,
  impactAt: () => 1600,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      map: stage.icon('map', '#fde68a'),
      line: buildLine(stage, hot, 2, { 'stroke-dasharray': '7 5' }),
      stamp: stage.icon('stamp', base),
      border: stage.el('ellipse', { fill: 'none', stroke: hot, 'stroke-width': 2, 'stroke-dasharray': '4 4', opacity: 0 }),
      dust: buildParticles(stage, 8, [base, hot]),
      label: buildLabel(stage, p.label || 'Claim fabricated', hot)
    };
  },
  draw(s, f) {
    const traj = trajFor(s, f, { lateral: 0.1, loft: 0.05 });
    const z = f.z;
    const fade = envelope(f.t, 0, 2700, 0.04, 0.15);
    placeIcon(s.map, f.src.x, f.src.y - 12 * z, 24 * z, { opacity: f.src.visible ? fade * (1 - phase(f.t, 1500, 400)) : 0, sx: 0.2 + 0.8 * ease.outBack(phase(f.t, 0, 400)) });
    const creep = phase(f.t, 400, 1150);
    s.line.draw(sampleTrajectory(f, traj, 0, Math.max(0.02, creep), 24), fade, { 'stroke-dashoffset': (-f.t / 20).toFixed(1) });
    const { x, y, visible } = f.dst;
    const slam = phase(f.t, 1550, 220);
    placeIcon(s.stamp, x, y - 14 * z - (1 - slam) * 30 * z, 24 * z, { opacity: visible ? fade * (slam > 0 ? 1 : 0) * (1 - phase(f.t, 2200, 300)) : 0 });
    s.dust.draw(x, y, visible ? phase(f.t, 1770, 500) : -1, { mode: 'dust', reach: 18, z });
    const R = 36 * z * ease.outCubic(phase(f.t, 1770, 400));
    setAttrs(s.border, { cx: x, cy: y, rx: R.toFixed(1), ry: (R * 0.5).toFixed(1), opacity: visible ? (fade * (R > 0 ? 1 : 0)).toFixed(2) : 0, transform: `rotate(${(f.t / 30).toFixed(1)} ${x} ${y})` });
    s.label.draw(x, y - 42 * z, visible ? phase(f.t, 1700, 1000) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// hostility — rival_nation: two glaring eyes with crackling lightning between the capitals.
// insult: a megaphone blares shockwave arcs across, and the target recoils in a red splash.
export const hostility = {
  duration: 2500,
  impactAt: () => 1200,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      bolt: buildLine(stage, '#fde047', 2.4),
      boltGlow: buildLine(stage, base, 7, { 'stroke-opacity': 0.4 }),
      eyeA: p.insult ? stage.icon('megaphone', hot) : stage.icon('eye', hot),
      eyeB: p.insult ? null : stage.icon('eye', hot),
      waves: p.insult ? Array.from({ length: 4 }, () => stage.el('path', { fill: 'none', stroke: hot, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0 })) : null,
      splash: buildParticles(stage, 12, [base, '#ef4444', '#fca5a5'], { size: 3 }),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || (p.insult ? 'Insulted!' : 'Rivalry declared'), hot),
      p
    };
  },
  draw(s, f) {
    const traj = trajFor(s, f, { lateral: 0, loft: 0.08 });
    const z = f.z;
    const fade = envelope(f.t, 0, 2500, 0.04, 0.15);
    const glare = ease.outBack(phase(f.t, 0, 400));
    placeIcon(s.eyeA, f.src.x, f.src.y - 14 * z, 22 * z * glare, { opacity: f.src.visible ? fade : 0, sy: s.p.insult ? 1 : 0.3 + 0.7 * glare });
    if (s.eyeB) placeIcon(s.eyeB, f.dst.x, f.dst.y - 14 * z, 22 * z * glare, { opacity: f.dst.visible ? fade : 0, sy: 0.3 + 0.7 * glare });
    if (!s.p.insult) {
      // Lightning: the path, re-jittered every ~70ms.
      const pts = sampleTrajectory(f, traj, 0.05, 0.95, 14);
      const seed = Math.floor(f.t / 70);
      const jag = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : { ...p, x: p.x + (hash(i, seed) - 0.5) * 12 * z, y: p.y + (hash(i, seed + 7) - 0.5) * 12 * z }));
      const live = envelope(f.t, 400, 1700, 0.05, 0.2);
      s.bolt.draw(jag, fade * live * (0.6 + 0.4 * hash(seed, 3)));
      s.boltGlow.draw(jag, fade * live * 0.7);
    } else {
      s.waves.forEach((w, i) => {
        const u = phase(f.t, 200 + i * 220, 1000);
        const pt = pointOnTrajectory(f, traj, u);
        const r = (8 + i) * z;
        const a = (pt.heading * Math.PI) / 180;
        const nx = -Math.sin(a) * r; const ny = Math.cos(a) * r;
        setAttrs(w, { d: `M ${pt.x - nx} ${pt.y - ny} Q ${pt.x + Math.cos(a) * r} ${pt.y + Math.sin(a) * r} ${pt.x + nx} ${pt.y + ny}`, opacity: pt.visible && u > 0 && u < 1 ? (fade * (1 - u * 0.5)).toFixed(2) : 0 });
      });
    }
    const { x, y, visible } = f.dst;
    s.splash.draw(x, y - 8 * z, visible ? phase(f.t, 1200, 700) : -1, { mode: 'radial', reach: 30, z, stagger: 0.15 });
    s.rings.draw(x, y, visible ? phase(f.t, 1200, 900) : -1, { r1: 36, z, squash: 0.55 });
    s.label.draw(x, y - 40 * z, visible ? phase(f.t, 1250, 1100) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// pact — two emblems (shields for an alliance, hearts for a marriage) set out from each capital,
// meet in the middle and lock together in a flash; a glowing bond then links the two capitals.
export const pact = {
  duration: 3000,
  impactAt: () => 1300,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      a: stage.icon(p.emblem || 'shield', hot),
      b: stage.icon(p.emblem || 'shield', hot),
      union: stage.icon(p.union || 'handshake', '#ffffff'),
      bond: buildLine(stage, base, 3),
      bondCore: buildLine(stage, hot, 1.2, { 'stroke-dasharray': '3 3' }),
      burst: buildBurst(stage, base, hot, { rings: 2, debris: 0, fireball: 0.35 }),
      motes: buildParticles(stage, 12, [hot, base, '#ffffff'], { size: 2.4 }),
      label: buildLabel(stage, p.label || 'Alliance formed', hot)
    };
  },
  draw(s, f) {
    const traj = trajFor(s, f, { lateral: 0.1, loft: 0.2 });
    const z = f.z;
    const fade = envelope(f.t, 0, 3000, 0.04, 0.15);
    const meet = ease.inOutCubic(phase(f.t, 0, 1300));
    const pa = pointOnTrajectory(f, traj, meet * 0.5);
    const pb = pointOnTrajectory(f, traj, 1 - meet * 0.5);
    const joined = f.t > 1300;
    placeIcon(s.a, pa.x, pa.y - 6 * z, 18 * z, { opacity: pa.visible && !joined ? fade : 0, rotate: Math.sin(f.t / 150) * 8 });
    placeIcon(s.b, pb.x, pb.y - 6 * z, 18 * z, { opacity: pb.visible && !joined ? fade : 0, rotate: -Math.sin(f.t / 150) * 8, sx: -1 });
    const mid = pointOnTrajectory(f, traj, 0.5);
    placeIcon(s.union, mid.x, mid.y - 8 * z, lerp(14, 28, ease.outBack(phase(f.t, 1300, 300))) * z, { opacity: mid.visible && joined ? fade : 0 });
    s.burst.draw(mid.x, mid.y - 8 * z, mid.visible ? (f.t - 1300) / 700 : -1, z, 0.7);
    s.motes.draw(mid.x, mid.y - 8 * z, mid.visible ? phase(f.t, 1300, 1300) : -1, { mode: 'rise', reach: 34, z, spread: 2 });
    const grow = ease.inOutCubic(phase(f.t, 1400, 900));
    const bondPts = sampleTrajectory(f, traj, 0.5 - grow * 0.5, 0.5 + grow * 0.5, 30);
    s.bond.draw(grow > 0 ? bondPts : null, fade * 0.5);
    s.bondCore.draw(grow > 0 ? bondPts : null, fade, { 'stroke-dashoffset': (-f.t / 25).toFixed(1) });
    s.label.draw(mid.x, mid.y - 34 * z, mid.visible ? phase(f.t, 1500, 1100) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// rupture — the bond between two capitals appears, strains, and snaps in the middle with sparks;
// the broken ends whip back home. Breaking an alliance, releasing a vassal.
export const rupture = {
  duration: 2600,
  impactAt: () => 1000,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      left: buildLine(stage, hot, 3),
      right: buildLine(stage, hot, 3),
      chain: stage.icon('brokenChain', '#e2e8f0'),
      sparks: buildParticles(stage, 14, ['#fde68a', '#ffffff', base], { size: 2.4 }),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Alliance broken', hot)
    };
  },
  draw(s, f) {
    const traj = trajFor(s, f, { lateral: 0.08, loft: 0.12 });
    const z = f.z;
    const fade = envelope(f.t, 0, 2600, 0.04, 0.15);
    const appear = ease.outCubic(phase(f.t, 0, 500));
    const snap = phase(f.t, 1000, 700);
    const recoil = ease.outCubic(snap);
    const strain = f.t < 1000 ? Math.sin(f.t / 30) * 1.2 * z * phase(f.t, 500, 500) : 0;
    const lEnd = 0.5 * appear * (1 - recoil * 0.9);
    const rStart = 1 - 0.5 * appear * (1 - recoil * 0.9);
    const L = sampleTrajectory(f, traj, 0, Math.max(0.01, lEnd), 16).map((p) => ({ ...p, y: p.y + strain }));
    const R = sampleTrajectory(f, traj, Math.min(0.99, rStart), 1, 16).map((p) => ({ ...p, y: p.y - strain }));
    s.left.draw(L, fade * (1 - snap * 0.6));
    s.right.draw(R, fade * (1 - snap * 0.6));
    const mid = pointOnTrajectory(f, traj, 0.5);
    placeIcon(s.chain, mid.x, mid.y - 8 * z, 26 * z, { opacity: mid.visible ? fade * envelope(f.t, 600, 1400) : 0, rotate: Math.sin(f.t / 25) * 6 * (1 - snap) });
    s.sparks.draw(mid.x, mid.y - 8 * z, mid.visible ? phase(f.t, 1000, 700) : -1, { mode: 'radial', reach: 34, z, stagger: 0.1 });
    s.rings.draw(mid.x, mid.y, mid.visible ? phase(f.t, 1000, 900) : -1, { r1: 34, z });
    s.label.draw(mid.x, mid.y - 34 * z, mid.visible ? phase(f.t, 1100, 1200) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// vassalize — a chain of links is laid across the map, pulling taut, and a crown descends onto
// the new subject, which is bound by a purple ring.
export const vassalize = {
  duration: 2900,
  impactAt: () => 1500,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      links: Array.from({ length: 9 }, () => stage.el('ellipse', { fill: 'none', stroke: '#cbd5e1', 'stroke-width': 1.8, opacity: 0 })),
      crown: stage.icon('crown', '#fde047'),
      bind: buildRings(stage, 3, base),
      shackle: stage.el('ellipse', { fill: 'none', stroke: hot, 'stroke-width': 3, 'stroke-dasharray': '5 3', opacity: 0 }),
      label: buildLabel(stage, p.label || 'Vassal bound', hot)
    };
  },
  draw(s, f) {
    const traj = trajFor(s, f, { lateral: 0.05, loft: 0.1 });
    const z = f.z;
    const fade = envelope(f.t, 0, 2900, 0.04, 0.15);
    const lay = phase(f.t, 0, 1200);
    const taut = phase(f.t, 1200, 300);
    s.links.forEach((ln, i) => {
      const t = (i + 0.5) / s.links.length;
      const on = lay > t;
      const pt = pointOnTrajectory(f, traj, t);
      const sag = Math.sin(t * Math.PI) * 10 * z * (1 - taut);
      setAttrs(ln, { cx: pt.x.toFixed(1), cy: (pt.y + sag).toFixed(1), rx: (5 * z).toFixed(1), ry: (2.6 * z).toFixed(1), transform: `rotate(${(pt.heading + (i % 2) * 90).toFixed(1)} ${pt.x.toFixed(1)} ${(pt.y + sag).toFixed(1)})`, opacity: pt.visible && on ? fade.toFixed(2) : 0 });
    });
    const { x, y, visible } = f.dst;
    const drop = ease.outBounce(phase(f.t, 1400, 600));
    placeIcon(s.crown, x, y - 60 * z + drop * 42 * z, 22 * z, { opacity: visible ? fade * phase(f.t, 1400, 150) : 0 });
    s.bind.draw(x, y, visible ? phase(f.t, 1800, 900) : -1, { r1: 40, z, squash: 0.5 });
    const R = 32 * z * ease.outCubic(phase(f.t, 1900, 400));
    setAttrs(s.shackle, { cx: x, cy: y, rx: R.toFixed(1), ry: (R * 0.5).toFixed(1), opacity: visible ? (fade * (R > 0 ? 1 : 0)).toFixed(2) : 0, transform: `rotate(${(f.t / 20).toFixed(1)} ${x} ${y})` });
    s.label.draw(x, y - 44 * z, visible ? phase(f.t, 1900, 900) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// espionage — a hooded agent slips across the map on a zig-zag route, flickering in and out of
// sight and leaving fading footprints; at the target an eye opens and a scan sweeps the capital.
export const espionage = {
  duration: 2900,
  impactAt: () => 1600,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      steps: Array.from({ length: 14 }, () => stage.icon('footprint', '#94a3b8')),
      agent: stage.icon('hood', '#cbd5e1'),
      eye: stage.icon('eye', hot),
      scan: stage.el('path', { fill: base, 'fill-opacity': 0.25, stroke: hot, 'stroke-width': 1, opacity: 0 }),
      rings: buildRings(stage, 1, base, { width: 1.5 }),
      label: buildLabel(stage, p.label || 'Intelligence gathered', hot)
    };
  },
  draw(s, f) {
    const traj = trajFor(s, f, { lateral: 0.25, loft: 0.02 });
    const z = f.z;
    const fade = envelope(f.t, 0, 2900, 0.04, 0.15);
    const go = phase(f.t, 0, 1550);
    const zig = (t) => Math.sin(t * 22) * 7 * z;
    s.steps.forEach((st, i) => {
      const t = (i + 1) / (s.steps.length + 1);
      const pt = pointOnTrajectory(f, traj, t);
      const age = (go - t) * 4;
      placeIcon(st, pt.x + zig(t), pt.y + (i % 2 ? 2 : -2) * z, 6 * z, { opacity: pt.visible && go > t ? fade * 0.7 * clamp(1 - age, 0, 1) : 0, rotate: pt.heading + 90 });
    });
    const pt = pointOnTrajectory(f, traj, go);
    const flicker = 0.35 + 0.45 * Math.abs(Math.sin(f.t / 120));
    placeIcon(s.agent, pt.x + zig(go), pt.y - 8 * z, 16 * z, { opacity: pt.visible && f.t < 1600 ? fade * flicker : 0 });
    const { x, y, visible } = f.dst;
    const open = ease.outBack(phase(f.t, 1550, 350));
    placeIcon(s.eye, x, y - 18 * z, 22 * z, { opacity: visible ? fade * (open > 0 ? 1 : 0) : 0, sy: Math.max(0.05, open) });
    const sweep = f.t > 1700 ? ((f.t - 1700) / 900) * Math.PI * 2 : 0;
    const R = 40 * z;
    setAttrs(s.scan, { d: `M ${x} ${y} L ${x + Math.cos(sweep) * R} ${y + Math.sin(sweep) * R * 0.5} A ${R} ${R * 0.5} 0 0 0 ${x + Math.cos(sweep - 0.7) * R} ${y + Math.sin(sweep - 0.7) * R * 0.5} Z`, opacity: visible && f.t > 1700 ? (fade * 0.9).toFixed(2) : 0 });
    s.rings.draw(x, y, visible ? phase(f.t, 1700, 1000) : -1, { r1: 40, z, squash: 0.5, maxOpacity: 0.6 });
    s.label.draw(x, y - 44 * z, visible ? phase(f.t, 1800, 1000) : -1, z);
  }
};

// counterIntel — a radar sweep circles the capital; foreign agents show up as red blips and
// are struck off one by one as the sweep passes them.
export const counterIntel = {
  duration: 2800,
  impactAt: () => 600,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      dish: stage.el('ellipse', { fill: base, 'fill-opacity': 0.1, stroke: hot, 'stroke-width': 1.4, opacity: 0 }),
      grid: [0, 1].map(() => stage.el('ellipse', { fill: 'none', stroke: hot, 'stroke-width': 0.8, 'stroke-dasharray': '2 3', opacity: 0 })),
      sweep: stage.el('path', { fill: hot, 'fill-opacity': 0.3, opacity: 0 }),
      blips: Array.from({ length: 5 }, () => ({ dot: stage.el('circle', { fill: '#ef4444', r: 0, opacity: 0 }), x1: stage.el('line', { stroke: '#fecaca', 'stroke-width': 1.6, opacity: 0 }), x2: stage.el('line', { stroke: '#fecaca', 'stroke-width': 1.6, opacity: 0 }) })),
      shield: stage.icon('eyeShield', hot),
      label: buildLabel(stage, p.label || 'Spies rooted out', hot)
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2800, 0.04, 0.15) : 0;
    const R = 46 * z * ease.outCubic(phase(f.t, 0, 400));
    setAttrs(s.dish, { cx: x, cy: y, rx: R.toFixed(1), ry: (R * 0.5).toFixed(1), opacity: fade.toFixed(2) });
    s.grid.forEach((g, i) => setAttrs(g, { cx: x, cy: y, rx: (R * (i + 1) / 3).toFixed(1), ry: (R * 0.5 * (i + 1) / 3).toFixed(1), opacity: fade.toFixed(2) }));
    const a = f.t / 260;
    setAttrs(s.sweep, { d: `M ${x} ${y} L ${x + Math.cos(a) * R} ${y + Math.sin(a) * R * 0.5} A ${R} ${R * 0.5} 0 0 0 ${x + Math.cos(a - 0.8) * R} ${y + Math.sin(a - 0.8) * R * 0.5} Z`, opacity: fade.toFixed(2) });
    s.blips.forEach((b, i) => {
      const ba = hash(i, 4) * Math.PI * 2; const br = (0.35 + hash(i, 5) * 0.55) * R;
      const bx = x + Math.cos(ba) * br; const by = y + Math.sin(ba) * br * 0.5;
      const found = f.t > 500 + i * 150;
      const struck = f.t > 1300 + i * 200;
      setAttrs(b.dot, { cx: bx, cy: by, r: (2.8 * z * (1 + 0.3 * Math.sin(f.t / 90 + i))).toFixed(1), opacity: found && !struck ? fade.toFixed(2) : 0 });
      const k = 3.5 * z;
      setAttrs(b.x1, { x1: bx - k, y1: by - k, x2: bx + k, y2: by + k, opacity: struck ? (fade * 0.9).toFixed(2) : 0 });
      setAttrs(b.x2, { x1: bx - k, y1: by + k, x2: bx + k, y2: by - k, opacity: struck ? (fade * 0.9).toFixed(2) : 0 });
    });
    placeIcon(s.shield, x, y - 6 * z, 22 * z, { opacity: fade });
    s.label.draw(x, y - R * 0.5 - 16 * z, visible ? phase(f.t, 1600, 1100) : -1, z);
  }
};

