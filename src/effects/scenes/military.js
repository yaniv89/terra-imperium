// src/effects/scenes/military.js
// Armies, fleets and strikes. Every scene: { duration, impactAt, build(stage, effect, params, ctx),
// draw(state, f) } — see src/effects/EffectsLayer.jsx for the frame object `f`.
import { clamp, ease, phase, envelope, hash, hide, setAttrs, makeTrajectory, sampleTrajectory, pointOnTrajectory, placeIcon, lerp } from '../engine';
import { buildTrail, buildLine, buildRings, buildBurst, buildParticles, buildLabel, buildFlag } from '../fx';
import { getUnitIconPath } from '../../data/unitIcons';
import { UNIT_CLASSES } from '../../data/unitClasses';

const unitPath = (ageId, classId) => getUnitIconPath(ageId || 'kingdoms', classId || 'infantry')
  || getUnitIconPath('modern', classId || 'infantry') || getUnitIconPath('kingdoms', 'infantry');

// Faces a prop along its direction of travel without turning it upside down.
const facing = (heading) => (Math.cos((heading * Math.PI) / 180) < 0 ? -1 : 1);

// ---------------------------------------------------------------------------------------------
// strike — ballistic munitions arcing over the Earth into a detonation (missiles, air strikes,
// ASAT). The original arc renderer, ported onto the shared engine.
const HEAD_SHAPES = {
  warhead: 'M 13 0 L 1 -4.5 L -10 -3 L -10 3 L 1 4.5 Z',
  dart: 'M 12 0 L -6 -4 L -3 0 L -6 4 Z',
  chevron: 'M 10 0 L -6 -8 L -1 0 L -6 8 Z'
};
const TRAVEL_MS = 1050;
const BURST_MS = 850;
export const strike = {
  duration: TRAVEL_MS + 250 + BURST_MS + 300,
  impactAt: (p) => TRAVEL_MS + Math.max(...(p.projectiles || [{ delay: 0 }]).map((x) => x.delay)),
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    const munitions = (p.projectiles || [{ lateral: 0, loft: 1, delay: 0, scale: 1, spread: 0 }]).map((proj) => ({
      proj,
      trail: buildTrail(stage, base, hot, p.trailWidth || 3),
      sparks: buildParticles(stage, 6, [base, hot], { size: 3 }),
      head: (() => {
        const g = stage.el('g', { opacity: 0 });
        stage.el('circle', { r: 15, fill: base, opacity: 0.16 }, g);
        stage.el('circle', { r: 7, fill: base, opacity: 0.5 }, g);
        stage.el('path', { d: HEAD_SHAPES[p.head] || HEAD_SHAPES.warhead, fill: hot, stroke: '#fff', 'stroke-width': 0.8 }, g);
        return g;
      })(),
      flash: stage.el('circle', { fill: hot, r: 0, opacity: 0 })
    }));
    return { munitions, burst: buildBurst(stage, base, hot, { rings: p.rings || 2, debris: p.debris || 8, fireball: p.fireball ?? 0.6 }), p };
  },
  draw(s, f) {
    const easing = ease[s.p.ease] || ease.accelerate;
    s.munitions.forEach((m) => {
      if (!m.traj) m.traj = makeTrajectory(f.from, f.to, { lateral: m.proj.lateral, loft: m.proj.loft, spread: m.proj.spread * 0.007 * f.z, archPow: s.p.archPow || 1 });
      const local = (f.t - m.proj.delay) / TRAVEL_MS;
      if (local < 0) { m.trail.draw(null); hide(m.head, m.flash); m.sparks.draw(0, 0, -1); return; }
      const prog = easing(clamp(local, 0, 1));
      const pts = sampleTrajectory(f, m.traj, 0, prog, 26);
      const fade = local <= 1 ? 1 : clamp(1 - (local - 1) * (TRAVEL_MS / 420), 0, 1);
      m.trail.draw(pts, fade);
      if (local <= 1 && pts.length > 1) {
        const hp = pointOnTrajectory(f, m.traj, prog);
        setAttrs(m.head, { opacity: 1, transform: `translate(${hp.x.toFixed(1)} ${hp.y.toFixed(1)}) rotate(${hp.heading.toFixed(1)}) scale(${((m.proj.scale || 1) * f.z).toFixed(2)})` });
        m.sparks.draw(hp.x, hp.y, (f.t % 400) / 400, { mode: 'radial', reach: 10, z: f.z, stagger: 0.8, seed: 3 });
      } else { hide(m.head); m.sparks.draw(0, 0, -1); }
      const sinceHit = (f.t - m.proj.delay - TRAVEL_MS) / 260;
      const end = pts[pts.length - 1];
      if (sinceHit >= 0 && sinceHit <= 1 && end) setAttrs(m.flash, { cx: end.x, cy: end.y, r: (ease.outCubic(sinceHit) * 26 * (m.proj.scale || 1) * f.z).toFixed(1), opacity: (0.75 * (1 - sinceHit)).toFixed(2) });
      else hide(m.flash);
    });
    const impact = strike.impactAt(s.p);
    s.burst.draw(f.dst.x, f.dst.y, f.dst.visible ? (f.t - impact) / BURST_MS : -1, f.z);
  }
};

// ---------------------------------------------------------------------------------------------
// declareWar — a war banner is raised at home, a line of fire races across the map, and crossed
// swords slam down on the enemy with a red, pulsing war border.
export const declareWar = {
  duration: 3000,
  impactAt: () => 1400,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      traj: null,
      flag: buildFlag(stage, base, hot),
      drums: buildRings(stage, 2, base),
      fire: buildTrail(stage, '#f97316', '#fde68a', 4),
      embers: buildParticles(stage, 10, ['#f97316', '#fbbf24', '#ef4444']),
      border: stage.el('circle', { fill: 'none', stroke: base, 'stroke-width': 3, 'stroke-dasharray': '6 5', opacity: 0 }),
      burst: buildBurst(stage, base, hot, { rings: 3, debris: 12, fireball: 0.8 }),
      swords: stage.icon('swords', hot),
      smoke: buildParticles(stage, 8, ['#475569', '#334155'], { size: 6 }),
      label: buildLabel(stage, 'WAR!', '#fca5a5')
    };
  },
  draw(s, f) {
    if (!s.traj) s.traj = makeTrajectory(f.from, f.to, { lateral: 0.15, loft: 0.25 });
    const z = f.z;
    // 1. banner at home
    s.flag.draw(f.src.x, f.src.y, phase(f.t, 0, 500), f.t, z, f.src.visible ? envelope(f.t, 0, 2000, 0.05, 0.3) : 0);
    s.drums.draw(f.src.x, f.src.y, f.src.visible ? phase(f.t, 250, 900) : -1, { r1: 26, z, squash: 0.5 });
    // 2. line of fire
    const run = ease.inOutCubic(phase(f.t, 300, 1100));
    const pts = f.t >= 300 ? sampleTrajectory(f, s.traj, 0, run, 24) : null;
    s.fire.draw(pts, f.t < 2300 ? 1 : clamp(1 - (f.t - 2300) / 500, 0, 1), 1 + 0.25 * Math.sin(f.t / 50));
    const head = pts && pts[pts.length - 1];
    if (head && f.t < 1500) s.embers.draw(head.x, head.y, (f.t % 500) / 500, { mode: 'rise', reach: 16, z, stagger: 0.9 });
    else s.embers.draw(0, 0, -1);
    // 3. swords + war border at the enemy
    const hit = f.t - 1400;
    if (f.dst.visible && hit > 0) {
      const slam = phase(hit, 0, 280);
      placeIcon(s.swords, f.dst.x, f.dst.y - 18 * z, lerp(70, 34, ease.outBack(slam)) * z, { opacity: envelope(hit, 0, 1600, 0.05, 0.3), rotate: (1 - slam) * -25 });
      const pulse = 1 + 0.12 * Math.sin(hit / 90);
      setAttrs(s.border, { cx: f.dst.x, cy: f.dst.y, r: (46 * z * pulse).toFixed(1), opacity: (0.9 * envelope(hit, 0, 1600)).toFixed(2), transform: `rotate(${(hit / 12).toFixed(1)} ${f.dst.x} ${f.dst.y})` });
      s.smoke.draw(f.dst.x, f.dst.y, phase(hit, 150, 1400), { mode: 'rise', reach: 45, z, stagger: 0.5 });
      s.label.draw(f.dst.x, f.dst.y - 44 * z, phase(hit, 200, 1300), z);
    } else { hide(s.swords, s.border); s.smoke.draw(0, 0, -1); s.label.draw(0, 0, -1); }
    s.burst.draw(f.dst.x, f.dst.y, f.dst.visible ? hit / 900 : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// march — a column of real unit silhouettes marching along the ground from one province to the
// next, kicking up dust. `clash`: they hit the defenders in a burst of steel; otherwise they
// settle into formation and plant a flag. `boats`: an amphibious landing — ships first, then
// troops wading ashore.
export const march = {
  duration: 3000,
  impactAt: () => 1750,
  build(stage, effect, p, ctx) {
    const { base, hot } = p.palette;
    const count = p.count || 4;
    const troopPath = unitPath(effect.age || ctx.ageId, p.unitClass || effect.variant || 'infantry');
    const shipPath = unitPath(effect.age || ctx.ageId, 'naval');
    return {
      route: buildLine(stage, base, 2.2, { 'stroke-dasharray': '2 6' }),
      units: Array.from({ length: count }, () => ({
        troop: stage.icon(troopPath, hot),
        ship: p.boats ? stage.icon(shipPath, '#e0f2fe') : null,
        dust: buildParticles(stage, 4, ['#a8a29e', '#d6d3d1'])
      })),
      wake: p.boats ? buildParticles(stage, 8, ['#bae6fd', '#e0f2fe']) : null,
      burst: p.clash ? buildBurst(stage, base, hot, { rings: 2, debris: 10, fireball: 0.55 }) : null,
      clash: p.clash ? stage.icon('swordClash', '#fef3c7') : null,
      sparks: p.clash ? buildParticles(stage, 12, ['#fde68a', '#ffffff', base], { size: 2.5 }) : null,
      flag: p.clash ? null : buildFlag(stage, base, hot),
      settle: buildRings(stage, 1, base),
      p
    };
  },
  draw(s, f) {
    if (!s.traj) s.traj = makeTrajectory(f.from, f.to, { lateral: 0.12, loft: 0.03 });
    const z = f.z;
    const TRAVEL = 1750;
    const lead = ease.inOutCubic(phase(f.t, 100, TRAVEL - 100));
    s.route.draw(sampleTrajectory(f, s.traj, 0, Math.max(0.02, lead), 20), envelope(f.t, 0, s.p.clash ? 2400 : 2900, 0.05, 0.25));
    s.units.forEach((u, i) => {
      const along = clamp(lead - i * 0.07, 0, 1);
      const arrived = f.t > TRAVEL + i * 90;
      let pt = pointOnTrajectory(f, s.traj, along);
      let fightShake = 0;
      if (arrived) {
        // Formation slot around the destination (a loose line abreast), or the melee scrum.
        const slot = (i - (s.units.length - 1) / 2) * 13 * z;
        const settle = ease.outCubic(phase(f.t, TRAVEL + i * 90, 350));
        pt = { ...f.dst, x: lerp(pt.x, f.dst.x + slot, settle), y: lerp(pt.y, f.dst.y + (i % 2) * 7 * z - 4 * z, settle), heading: pt.heading };
        if (s.p.clash) fightShake = Math.sin(f.t / 40 + i) * 2.5 * z * envelope(f.t, TRAVEL, 800);
      }
      const visible = pt.visible && f.t > i * 90;
      const fade = s.p.clash ? envelope(f.t, 0, 2700, 0.06, 0.2) : envelope(f.t, 0, 2950, 0.06, 0.15);
      const bob = Math.abs(Math.sin(f.t / 85 + i * 1.3)) * -3 * z * (arrived ? 0.3 : 1);
      const onBoat = s.p.boats && along < 0.62;
      placeIcon(u.troop, pt.x + fightShake, pt.y + bob, (onBoat ? 0 : 17) * z, { opacity: visible ? fade : 0, sx: facing(pt.heading) });
      if (u.ship) placeIcon(u.ship, pt.x, pt.y + Math.sin(f.t / 160 + i) * 1.5 * z, (onBoat ? 20 : 0) * z, { opacity: visible && onBoat ? fade : 0, sx: facing(pt.heading) });
      if (visible && !arrived && !onBoat) u.dust.draw(pt.x, pt.y + 7 * z, ((f.t + i * 97) % 380) / 380, { mode: 'dust', reach: 9, z, stagger: 0.6, seed: i });
      else u.dust.draw(0, 0, -1);
    });
    if (s.wake) {
      const lp = pointOnTrajectory(f, s.traj, lead);
      if (lead < 0.62 && lp.visible) s.wake.draw(lp.x, lp.y + 4 * z, (f.t % 600) / 600, { mode: 'dust', reach: 16, z, stagger: 0.7 });
      else s.wake.draw(0, 0, -1);
    }
    const hit = f.t - TRAVEL;
    if (s.p.clash) {
      s.burst.draw(f.dst.x, f.dst.y, f.dst.visible ? hit / 850 : -1, z, 0.9);
      if (f.dst.visible && hit > 0 && hit < 1100) {
        placeIcon(s.clash, f.dst.x, f.dst.y - 26 * z, lerp(46, 28, ease.outBack(phase(hit, 0, 250))) * z, { opacity: envelope(hit, 0, 1100, 0.05, 0.35), rotate: Math.sin(hit / 60) * 6 });
        s.sparks.draw(f.dst.x, f.dst.y - 10 * z, (hit % 450) / 450, { mode: 'radial', reach: 26, z, stagger: 0.5 });
      } else { hide(s.clash); s.sparks.draw(0, 0, -1); }
    } else {
      s.flag.draw(f.dst.x + 22 * z, f.dst.y + 6 * z, f.dst.visible ? phase(hit, 150, 450) : 0, f.t, z, envelope(f.t, TRAVEL, 1250, 0.05, 0.3));
      s.settle.draw(f.dst.x, f.dst.y + 6 * z, f.dst.visible ? phase(hit, 300, 900) : -1, { r1: 34, z, squash: 0.45 });
    }
  }
};

// ---------------------------------------------------------------------------------------------
// navalBattle — two fleets close on each other and trade broadsides: muzzle flashes, cannonballs
// arcing across, splashes, drifting smoke, until the enemy ship is hit, lists and goes down.
export const navalBattle = {
  duration: 3300,
  impactAt: () => 2350,
  build(stage, effect, p, ctx) {
    const { base, hot } = p.palette;
    const shipPath = unitPath(effect.age || ctx.ageId, 'naval');
    return {
      ours: stage.icon(shipPath, hot),
      theirs: stage.icon(shipPath, '#fecaca'),
      shots: Array.from({ length: 6 }, () => ({
        flash: stage.el('circle', { fill: '#fef08a', r: 0, opacity: 0 }),
        ball: stage.el('circle', { fill: '#0f172a', stroke: '#f8fafc', 'stroke-width': 0.8, r: 0, opacity: 0 }),
        splash: buildRings(stage, 2, '#bae6fd', { first: '#e0f2fe', width: 2 })
      })),
      smoke: buildParticles(stage, 12, ['#94a3b8', '#64748b', '#cbd5e1'], { size: 7 }),
      wake: buildParticles(stage, 8, ['#bae6fd', '#e0f2fe']),
      burst: buildBurst(stage, base, hot, { rings: 2, debris: 10, fireball: 0.6 })
    };
  },
  draw(s, f) {
    if (!s.traj) s.traj = makeTrajectory(f.from, f.to, { lateral: 0.2, loft: 0.02 });
    const z = f.z;
    const approach = ease.outCubic(phase(f.t, 0, 1200));
    const a = pointOnTrajectory(f, s.traj, 0.2 + approach * 0.62);
    const dst = f.dst;
    // The enemy closes from the far side of the target, on the same line of approach.
    const dir = Math.atan2(dst.y - a.y, dst.x - a.x);
    const gap = lerp(70, 34, approach) * z;
    const bx = dst.x + Math.cos(dir) * gap * 0.35;
    const by = dst.y + Math.sin(dir) * gap * 0.35;
    const ax = lerp(a.x, dst.x - Math.cos(dir) * gap * 0.65, approach);
    const ay = lerp(a.y, dst.y - Math.sin(dir) * gap * 0.65, approach);
    const sink = phase(f.t, 2350, 900);
    const roll = (k) => Math.sin(f.t / 230 + k) * 5;
    const vis = dst.visible;
    placeIcon(s.ours, ax, ay + Math.sin(f.t / 200) * 1.4 * z, 24 * z, { opacity: vis ? envelope(f.t, 0, 3300, 0.06, 0.12) : 0, rotate: roll(0), sx: Math.cos(dir) < 0 ? -1 : 1 });
    placeIcon(s.theirs, bx, by + sink * 14 * z + Math.sin(f.t / 210) * 1.4 * z, 24 * z, { opacity: vis ? envelope(f.t, 0, 3250, 0.06, 0.25) * (1 - sink * 0.9) : 0, rotate: roll(2) + sink * 35, sx: Math.cos(dir) < 0 ? 1 : -1 });
    s.wake.draw(ax, ay + 6 * z, vis && f.t < 1300 ? (f.t % 500) / 500 : -1, { mode: 'dust', reach: 14, z, stagger: 0.7 });
    // Broadsides: alternate sides, each shot = muzzle flash, arcing ball, splash (or the final hit).
    s.shots.forEach((shot, i) => {
      const fire = 1150 + i * 190;
      const fromOurs = i % 2 === 0;
      const [sx, sy, tx, ty] = fromOurs ? [ax, ay, bx, by] : [bx, by, ax, ay];
      const u = phase(f.t, fire, 320);
      const live = vis && f.t >= fire && f.t < fire + 900;
      setAttrs(shot.flash, live && u < 0.35 ? { cx: sx, cy: sy - 4 * z, r: (9 * z * (1 - u / 0.35)).toFixed(1), opacity: 0.9 } : { opacity: 0 });
      if (live && u < 1) {
        const miss = (hash(i, 9) - 0.5) * 22 * z;
        setAttrs(shot.ball, { cx: lerp(sx, tx + miss, u).toFixed(1), cy: (lerp(sy, ty, u) - Math.sin(Math.PI * u) * 16 * z).toFixed(1), r: (2.2 * z).toFixed(1), opacity: 1 });
      } else hide(shot.ball);
      shot.splash.draw(tx + (hash(i, 9) - 0.5) * 22 * z, ty + 4 * z, live ? phase(f.t, fire + 320, 500) : -1, { r1: 12, z, squash: 0.4 });
    });
    s.smoke.draw((ax + bx) / 2, (ay + by) / 2 - 4 * z, vis ? phase(f.t, 1150, 2000) : -1, { mode: 'rise', reach: 40, z, spread: 2, stagger: 0.6 });
    s.burst.draw(bx, by, vis ? (f.t - 2350) / 850 : -1, z, 0.8);
  }
};

// ---------------------------------------------------------------------------------------------
// muster — recruiting: a banner goes up, recruits march in from the countryside into ranks under
// it, stamp to attention, and a "+1 <unit>" caption rises.
export const muster = {
  duration: 2500,
  impactAt: () => 250,
  build(stage, effect, p, ctx) {
    const { base, hot } = p.palette;
    const classId = effect.variant || 'infantry';
    const path = unitPath(effect.age || ctx.ageId, classId);
    const count = 5;
    return {
      flag: buildFlag(stage, base, hot),
      glow: stage.el('ellipse', { fill: base, opacity: 0 }),
      units: Array.from({ length: count }, (_, i) => ({ icon: stage.icon(path, i === 2 ? '#ffffff' : hot), dust: buildParticles(stage, 5, ['#a8a29e', '#e7e5e4']) })),
      rings: buildRings(stage, 2, base),
      sparkle: buildParticles(stage, 10, [hot, '#fde68a'], { size: 2.4 }),
      label: buildLabel(stage, `+1 ${UNIT_CLASSES[classId]?.name || 'Unit'}`, hot)
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2500, 0.04, 0.15) : 0;
    s.flag.draw(x - 2 * z, y - 10 * z, phase(f.t, 0, 450), f.t, z, fade);
    setAttrs(s.glow, { cx: x, cy: y + 8 * z, rx: (40 * z).toFixed(1), ry: (12 * z).toFixed(1), opacity: (0.18 * fade * phase(f.t, 200, 500)).toFixed(2) });
    const slots = [[-26, 4], [-13, 10], [0, 4], [13, 10], [26, 4]];
    s.units.forEach((u, i) => {
      const start = 250 + i * 130;
      const m = phase(f.t, start, 620);
      const ang = -Math.PI / 2 + (i - 2) * 0.95 + Math.PI; // come in from below/sides
      const fromX = x + Math.cos(ang) * 70 * z;
      const fromY = y + Math.sin(ang) * 40 * z;
      const [sx, sy] = slots[i];
      const px = lerp(fromX, x + sx * z, ease.outCubic(m));
      const py = lerp(fromY, y + sy * z, ease.outCubic(m));
      const marching = m > 0 && m < 1;
      const salute = f.t > 1500 ? -Math.max(0, Math.sin(((f.t - 1500) / 380) * Math.PI)) * 4 * z : 0;
      const bob = marching ? -Math.abs(Math.sin(f.t / 70 + i)) * 3.5 * z : salute;
      placeIcon(u.icon, px, py + bob, (i === 2 ? 20 : 16) * z, { opacity: m > 0 ? fade : 0, sx: px < x + sx * z - 1 ? 1 : -1 });
      u.dust.draw(px, py + 8 * z, marching ? (f.t % 300) / 300 : phase(f.t, start + 620, 400), { mode: 'dust', reach: marching ? 8 : 16, z, stagger: 0.5, seed: i });
    });
    s.rings.draw(x, y + 6 * z, visible ? phase(f.t, 1150, 900) : -1, { r1: 46, z, squash: 0.45 });
    s.sparkle.draw(x, y - 18 * z, visible ? phase(f.t, 1300, 1000) : -1, { mode: 'rise', reach: 30, z, spread: 1.6 });
    s.label.draw(x, y - 42 * z, visible ? phase(f.t, 1250, 1250) : -1, z);
  }
};

// disband — the ranks break up: the banner is lowered and the soldiers walk off in every
// direction, fading into the countryside.
export const disband = {
  duration: 2100,
  impactAt: () => 200,
  build(stage, effect, p, ctx) {
    const { base, hot } = p.palette;
    const path = unitPath(effect.age || ctx.ageId, effect.variant || 'infantry');
    return {
      flag: buildFlag(stage, '#64748b', '#94a3b8'),
      units: Array.from({ length: 5 }, () => stage.icon(path, hot)),
      dust: buildParticles(stage, 10, ['#78716c', '#a8a29e']),
      rings: buildRings(stage, 1, base),
      label: buildLabel(stage, 'Disbanded', '#fecaca')
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const lower = phase(f.t, 300, 700);
    s.flag.draw(x, y - 10 * z + lower * 26 * z, 1, f.t, z, visible ? 1 - lower : 0);
    s.units.forEach((icon, i) => {
      const leave = ease.inCubic(phase(f.t, 500 + i * 70, 1300));
      const ang = (i / 5) * Math.PI * 2 + 0.5;
      const px = x + (i - 2) * 13 * z + Math.cos(ang) * leave * 60 * z;
      const py = y + 6 * z + Math.sin(ang) * leave * 30 * z;
      placeIcon(icon, px, py - Math.abs(Math.sin(f.t / 90 + i)) * 2 * z * (leave > 0 ? 1 : 0), 16 * z, { opacity: visible ? envelope(f.t, 0, 2100, 0.08, 0.05) * (1 - leave) : 0, sx: Math.cos(ang) < 0 ? -1 : 1 });
    });
    s.dust.draw(x, y + 10 * z, visible ? phase(f.t, 500, 1300) : -1, { mode: 'dust', reach: 50, z, stagger: 0.4 });
    s.rings.draw(x, y + 6 * z, visible ? phase(f.t, 400, 900) : -1, { r1: 30, z, squash: 0.45, maxOpacity: 0.5 });
    s.label.draw(x, y - 34 * z, visible ? phase(f.t, 400, 1500) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// promotion — a medal rises into a sunburst while rank chevrons stamp onto it one by one.
// Used for promotions, hiring and appointing generals, hiring advisors (params.icon/label).
export const promotion = {
  duration: 2200,
  impactAt: () => 500,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    const rays = Array.from({ length: 10 }, () => stage.el('path', { fill: base, opacity: 0 }));
    return {
      rays,
      medal: stage.icon(p.icon || 'medal', hot),
      chevrons: Array.from({ length: 3 }, () => stage.el('path', { fill: '#fde68a', stroke: '#92400e', 'stroke-width': 0.8, opacity: 0 })),
      sparkle: buildParticles(stage, 12, [hot, '#fde68a', '#ffffff'], { size: 2.2 }),
      rings: buildRings(stage, 2, base),
      label: buildLabel(stage, p.label || 'Promoted!', hot)
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const fade = visible ? envelope(f.t, 0, 2200, 0.05, 0.18) : 0;
    const rise = ease.outBack(phase(f.t, 0, 500));
    const my = y - rise * 22 * z;
    const rayGrow = ease.outCubic(phase(f.t, 350, 600));
    s.rays.forEach((ray, i) => {
      const a = (i / s.rays.length) * Math.PI * 2 + f.t / 900;
      const r0 = 14 * z; const r1 = (26 + 12 * (i % 2)) * z * rayGrow;
      const w = 0.12;
      const d = `M ${x + Math.cos(a - w) * r0} ${my + Math.sin(a - w) * r0} L ${x + Math.cos(a) * (r0 + r1)} ${my + Math.sin(a) * (r0 + r1)} L ${x + Math.cos(a + w) * r0} ${my + Math.sin(a + w) * r0} Z`;
      setAttrs(ray, { d, opacity: (0.55 * fade * rayGrow).toFixed(2) });
    });
    placeIcon(s.medal, x, my, 30 * z, { opacity: fade * phase(f.t, 0, 200) });
    s.chevrons.forEach((c, i) => {
      const land = phase(f.t, 700 + i * 220, 260);
      const cy = my + 20 * z + i * 6 * z - (1 - ease.outBounce(land)) * 30 * z;
      const w = 11 * z; const h = 5 * z;
      setAttrs(c, { d: `M ${x - w} ${cy} L ${x} ${cy + h} L ${x + w} ${cy} L ${x + w} ${cy + 3 * z} L ${x} ${cy + h + 3 * z} L ${x - w} ${cy + 3 * z} Z`, opacity: land > 0 ? fade.toFixed(2) : 0 });
    });
    s.rings.draw(x, my, visible ? phase(f.t, 450, 900) : -1, { r1: 40, z });
    s.sparkle.draw(x, my, visible ? phase(f.t, 500, 1500) : -1, { mode: 'swirl', reach: 40, z });
    s.label.draw(x, my - 30 * z, visible ? phase(f.t, 700, 1400) : -1, z);
  }
};

// ---------------------------------------------------------------------------------------------
// suppress — rebels with torches swarm the province; the garrison's steel clashes into them and
// the uprising scatters and gutters out.
export const suppress = {
  duration: 2600,
  impactAt: () => 900,
  build(stage, effect, p) {
    const { base, hot } = p.palette;
    return {
      rebels: Array.from({ length: 6 }, () => ({ body: stage.icon('person', '#fca5a5'), torch: stage.icon('torch', '#fb923c') })),
      clash: stage.icon('swordClash', '#e2e8f0'),
      burst: buildBurst(stage, base, hot, { rings: 2, debris: 8, fireball: 0.45 }),
      calm: buildRings(stage, 2, '#60a5fa', { first: '#dbeafe' }),
      embers: buildParticles(stage, 10, ['#f97316', '#fbbf24']),
      label: buildLabel(stage, 'Revolt crushed', '#bfdbfe')
    };
  },
  draw(s, f) {
    const { x, y, visible } = f.dst;
    const z = f.z;
    const scatter = ease.inCubic(phase(f.t, 1000, 1200));
    s.rebels.forEach((r, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const rad = (22 + Math.sin(f.t / 120 + i) * 3) * z + scatter * 60 * z;
      const px = x + Math.cos(a) * rad; const py = y + Math.sin(a) * rad * 0.5;
      const o = visible ? envelope(f.t, 0, 2400, 0.1, 0.05) * (1 - scatter) : 0;
      placeIcon(r.body, px, py, 13 * z, { opacity: o, sx: Math.cos(a) < 0 ? -1 : 1 });
      placeIcon(r.torch, px + 5 * z, py - 8 * z + Math.sin(f.t / 60 + i) * 1.2 * z, 9 * z, { opacity: o, rotate: Math.sin(f.t / 90 + i) * 10 });
    });
    s.embers.draw(x, y - 8 * z, visible && f.t < 1300 ? (f.t % 600) / 600 : -1, { mode: 'rise', reach: 30, z, spread: 2, stagger: 0.8 });
    const hit = f.t - 900;
    placeIcon(s.clash, x, y - 6 * z, lerp(50, 30, ease.outBack(phase(hit, 0, 260))) * z, { opacity: visible && hit > 0 ? envelope(hit, 0, 1000, 0.05, 0.35) : 0 });
    s.burst.draw(x, y, visible ? hit / 800 : -1, z, 0.8);
    s.calm.draw(x, y, visible ? phase(f.t, 1400, 1000) : -1, { r1: 60, z, squash: 0.6 });
    s.label.draw(x, y - 36 * z, visible ? phase(f.t, 1300, 1200) : -1, z);
  }
};
