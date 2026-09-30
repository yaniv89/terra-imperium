// src/battle/sim/objectives.js
// The fixed parts of the battlefield (Tactical Battles plan §8.5–8.6): the keep and its towers
// shoot back; capture points (the region's real deposits) feed Battle Supply; and once the keep's
// HP hits zero, attacking infantry/cavalry holding it uncontested assimilate it (RoN) for a
// decisive capture.
import { OCCUPATION_CAPABLE_CLASSES } from '../../engine/siege';
import { RNG_VARIANCE } from '../../engine/battle';
import { getPromotionMoraleLossMultiplier } from '../../data/promotions';
import { nextRandom } from './rng';
import { distSq } from './fixed';
import { queryRadius } from './pathing';
import { isFighting } from './combat';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER, secondsToTicks } from './constants';

export const ASSIMILATION_TICKS = secondsToTicks(30);
export const ASSIMILATION_RADIUS = 6 * Q;
export const CAPTURE_TICKS = secondsToTicks(8);
export const CAPTURE_RADIUS = Math.round(1.5 * Q);
export const SUPPLY_BASE_PER_SEC = 1;
export const SUPPLY_PER_POINT_PER_SEC = 2;

// Towers and the (unbreached) keep fire at the nearest attacking squad in range.
export const resolveStructureFire = (w) => {
  w.structures.forEach((s) => {
    if (!s.alive || !s.damage) return;
    if (s.cooldown > 0) { s.cooldown -= 1; return; }
    let target = null; let bestD = Infinity;
    queryRadius(w, s.x, s.y, s.range).forEach((j) => {
      const q = w.squads[j];
      if (q.side !== SIDE_ATTACKER || !isFighting(q) || q.stats.flying) return;
      const d = distSq(q.x, q.y, s.x, s.y);
      if (d < bestD) { bestD = d; target = q; }
    });
    if (!target) return;
    const variance = 1 + (nextRandom(w) * 2 - 1) * RNG_VARIANCE;
    const damage = Math.max(1, Math.round(s.damage * variance));
    target.strength = Math.max(0, target.strength - damage);
    target.morale = Math.max(0, target.morale - Math.round((damage / 25) * getPromotionMoraleLossMultiplier({ promotions: target.promotions })));
    target.lastHitTick = w.tick;
    target.engaged = true;
    if (target.strength === 0) { target.alive = false; w.events.push({ t: w.tick, type: 'destroyed', id: target.idx }); }
    w.events.push({ t: w.tick, type: 'towerShot', structure: s.id, to: target.idx, damage });
    s.cooldown = s.attackTicks;
  });
};

// Squads (non-air, not routed) of each side near a point.
const presence = (w, x, y, radius) => {
  const count = [0, 0];
  queryRadius(w, x, y, radius).forEach((j) => {
    const q = w.squads[j];
    if (isFighting(q) && !q.routed && !q.stats.flying) count[q.side] += 1;
  });
  return count;
};

export const updateCapturePoints = (w) => {
  w.points.forEach((p) => {
    const [att, def] = presence(w, p.x, p.y, CAPTURE_RADIUS);
    const holder = att > 0 && def === 0 ? SIDE_ATTACKER : def > 0 && att === 0 ? SIDE_DEFENDER : -1;
    if (holder === -1 || holder === p.owner) { if (holder === -1 && att + def === 0) p.progress = 0; return; }
    if (p.capturingSide !== holder) { p.capturingSide = holder; p.progress = 0; }
    p.progress += 1;
    if (p.progress >= CAPTURE_TICKS) {
      p.owner = holder; p.progress = 0;
      w.events.push({ t: w.tick, type: 'pointCaptured', point: p.id, side: holder });
    }
  });
};

export const updateSupply = (w) => {
  if (w.tick % 20 !== 0) return;
  const cap = w.setup.supplyCap;
  [SIDE_ATTACKER, SIDE_DEFENDER].forEach((side) => {
    const held = w.points.filter((p) => p.owner === side).length;
    w.supply[side] = Math.min(cap, w.supply[side] + SUPPLY_BASE_PER_SEC + SUPPLY_PER_POINT_PER_SEC * held);
  });
};

// Keep breached → attacker infantry/cavalry within the radius with no defender there assimilate
// it; contested, the timer pauses (RoN); abandoned, it slowly decays.
export const updateAssimilation = (w) => {
  const keep = w.structures[0];
  if (!keep || keep.alive) return;
  let attackers = 0; let defenders = 0;
  queryRadius(w, keep.x, keep.y, ASSIMILATION_RADIUS).forEach((j) => {
    const q = w.squads[j];
    if (!isFighting(q) || q.routed) return;
    if (q.side === SIDE_DEFENDER) defenders += 1;
    else if (OCCUPATION_CAPABLE_CLASSES.includes(q.classId)) attackers += 1;
  });
  if (attackers > 0 && defenders === 0) {
    w.assimilation += 1;
    if (w.assimilation === 1) w.events.push({ t: w.tick, type: 'assimilationStarted' });
  } else if (attackers === 0 && defenders === 0 && w.assimilation > 0) {
    w.assimilation -= 1;
  }
};
