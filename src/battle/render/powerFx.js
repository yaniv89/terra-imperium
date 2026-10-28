// src/battle/render/powerFx.js
// What a fired commander power shows (playtest 40650979770 step 130: "War Cry and Rally Cry show no
// visible effect"): an area ring over the ground it covers, a burst on every squad it touched and
// the key of a short label. Pure: the renderer draws it, the screen says the label. Every power of
// every age has a row here (powerFx.test.js walks POWERS).
import { POWERS, empTicks } from '../sim/effects';

const Q = 256;
export const POWER_FX_COLOR = { strike: '#fbbf24', rally: '#fde047', hide: '#a78bfa', emp: '#22d3ee', jam: '#c084fc', recon: '#38bdf8', hijack: '#f472b6' };
const MAX_BURSTS = 24;

const fighting = (q) => q.alive && q.onField && !q.fled && q.classId !== 'worker';
const centreOf = (list) => ({ x: list.reduce((s, q) => s + q.x, 0) / list.length / Q, z: list.reduce((s, q) => s + q.y, 0) / list.length / Q });
// a ring round a group of squads: its centre and the farthest squad plus a margin
const ringRound = (list, color) => {
  if (!list.length) return null;
  const c = centreOf(list);
  const r = Math.max(...list.map((q) => Math.hypot(q.x / Q - c.x, q.y / Q - c.z))) + 2;
  return { x: c.x, z: c.z, r: Math.min(r, 14), color }; // past 14 tiles the ring leaves a phone's view
};
const burstsOf = (list) => list.slice(0, MAX_BURSTS).map((q) => ({ x: q.x / Q, z: q.y / Q }));

/**
 * e: the sim's power event { side, power, x, y }; view: the frame's view; map: the field ({ w, h } in tiles).
 * Returns { ring: { x, z, r, color } | null, bursts: [{ x, z }], count?, color, effect } in tiles (count:
 * the squads touched, bursts stop at MAX_BURSTS); effect is
 * 'rally' | 'strike' | 'hide' | 'emp' | 'jam' | 'recon' | 'hijack' (the label's key), or null.
 */
export const powerFx = (e, view, map = null) => {
  const p = POWERS[e.power];
  if (!p) return null;
  const squads = view?.squads || [];
  const own = squads.filter((q) => q.side === e.side && fighting(q));
  const foes = squads.filter((q) => q.side !== e.side && fighting(q) && q.visible !== false);
  const at = { x: e.x / Q, z: e.y / Q };
  const near = (list, rq) => list.filter((q) => (q.x - e.x) ** 2 + (q.y - e.y) ** 2 <= rq * rq);
  if (e.power === 'rallyCry') return { ring: ringRound(own, POWER_FX_COLOR.rally), bursts: burstsOf(own), count: own.length, color: POWER_FX_COLOR.rally, effect: 'rally' };
  if (p.hide) return { ring: { ...at, r: p.hide.radius / Q, color: POWER_FX_COLOR.hide }, bursts: burstsOf(near(own, p.hide.radius)), color: POWER_FX_COLOR.hide, effect: 'hide' };
  if (p.emp) {
    const hit = near(foes, p.emp.radius).filter((q) => empTicks(q, p.emp) > 0);
    return { ring: { ...at, r: p.emp.radius / Q, color: POWER_FX_COLOR.emp }, bursts: burstsOf(hit), count: hit.length, color: POWER_FX_COLOR.emp, effect: 'emp' };
  }
  if (p.hijack) return { ring: { ...at, r: p.hijack.radius / Q, color: POWER_FX_COLOR.hijack }, bursts: [], color: POWER_FX_COLOR.hijack, effect: 'hijack' };
  if (p.jam) return { ring: ringRound(foes, POWER_FX_COLOR.jam), bursts: burstsOf(foes), color: POWER_FX_COLOR.jam, effect: 'jam' };
  if (p.reveal) {
    const w = map?.w || 0; const h = map?.h || 0;
    return { ring: w ? { x: w / 2, z: h / 2, r: Math.min(w, h) / 2, color: POWER_FX_COLOR.recon } : null, bursts: burstsOf(foes), color: POWER_FX_COLOR.recon, effect: 'recon' };
  }
  if (p.impacts) {
    const r = p.line ? (p.impacts * 1.2) / 2 + p.radius / Q : ((p.spread || 0) + p.radius) / Q;
    return { ring: { ...at, r, color: POWER_FX_COLOR.strike }, bursts: [], color: POWER_FX_COLOR.strike, effect: 'strike' };
  }
  return null;
};
