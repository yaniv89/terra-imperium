// src/battle/sim/objectives.js
// The fixed parts of the battlefield (Tactical Battles plan §8.5–8.6): the keep and its towers
// shoot back; capture points (the region's real deposits) feed Battle Supply; and once the keep's
// HP hits zero, attacking infantry/cavalry holding it uncontested assimilate it (RoN) for a
// decisive capture.
import { OCCUPATION_CAPABLE_CLASSES } from '../../engine/siege';
import { RNG_VARIANCE } from '../../engine/battle';
import { getPromotionMoraleLossMultiplier } from '../../data/promotions';
import { nextRandom } from './rng';
import { distSq, polarX, polarY } from './fixed';
import { queryRadius } from './pathing';
import { isFighting, perHitFraction } from './combat';
import { buildingSupplyPerSec } from './buildings';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER, secondsToTicks } from './constants';
import { moraleFromLosses } from './moraleMath';

export const ASSIMILATION_TICKS = secondsToTicks(30);
export const ASSIMILATION_RADIUS = 6 * Q;
export const CAPTURE_TICKS = secondsToTicks(8);
export const CAPTURE_RADIUS = Math.round(1.5 * Q);
export const SUPPLY_BASE_PER_SEC = 1;
export const SUPPLY_PER_POINT_PER_SEC = 2;

// --- Garrisons (plan §8.10) ---
// The defender's infantry and ranged squads can man the keep (3) or a tower (1). Inside they're
// hidden and can't be hurt, and the building fires with their firepower (×0.8) on top of its own.
// Only fortified buildings take a garrison. When the building drops below 25% HP (or falls), the
// garrison is thrown out with −20 morale.
export const GARRISON_SLOTS = { keep: 3, tower: 1 };
export const GARRISON_EJECT_HP = 0.25;
const GARRISON_FIRE_MULT = 0.8;
const EJECT_MORALE = 20;

export const canGarrison = (q) => q.side === SIDE_DEFENDER && (q.classId === 'infantry' || q.classId === 'ranged');
export const garrisonOf = (w, structureIndex) => w.squads.filter((q) => q.inside === structureIndex && q.alive);
const holdsGarrison = (s) => s.alive && s.hp >= s.maxHp * GARRISON_EJECT_HP;
export const garrisonRoom = (w, structureIndex) => {
  const s = w.structures[structureIndex];
  // Only real fortifications can be manned: an unwalled town's "keep" (no defenses, no fire of its
  // own) has nothing to hold.
  if (!s || !GARRISON_SLOTS[s.kind] || !holdsGarrison(s) || (s.kind === 'keep' && !s.damage)) return 0;
  return (GARRISON_SLOTS[s.kind] || 0) - garrisonOf(w, structureIndex).length;
};

export const leaveGarrison = (w, q, penalty = false) => {
  if (!(q.inside >= 0)) return;
  const s = w.structures[q.inside];
  const angle = (128 + q.idx * 37) & 255; // spill out on the side facing the attacker's approach
  q.x = s.x + polarX(angle, s.radius + Q); q.y = s.y + polarY(angle, s.radius + Q);
  q.inside = -1;
  q.anchorX = q.x; q.anchorY = q.y;
  if (penalty) q.morale = Math.max(0, q.morale - EJECT_MORALE);
  w.events.push({ t: w.tick, type: 'ejected', id: q.idx, forced: penalty });
};

export const updateGarrisons = (w) => {
  w.structures.forEach((s, si) => { if (GARRISON_SLOTS[s.kind] && !holdsGarrison(s)) garrisonOf(w, si).forEach((q) => { leaveGarrison(w, q, true); q.order = { type: 'idle' }; }); });
  w.squads.forEach((q) => {
    if (q.order.type !== 'garrison' || q.inside >= 0) return;
    const si = q.order.structure;
    const s = w.structures[si];
    if (!isFighting(q) || q.routed || !canGarrison(q) || garrisonRoom(w, si) <= 0) { q.order = { type: 'idle' }; return; }
    // A walled keep is entered through its gate, from just outside the wall ring.
    const reach = s.radius + (s.walls ? 5 * Q : Q + (Q >> 1));
    if (distSq(q.x, q.y, s.x, s.y) > reach * reach) return; // still walking there (movement.js)
    q.inside = si; q.x = s.x; q.y = s.y;
    q.target = -1; q.targetKind = null; q.order = { type: 'idle' }; q.anchorX = s.x; q.anchorY = s.y;
    w.events.push({ t: w.tick, type: 'garrisoned', id: q.idx, structure: s.id });
  });
};

// Extra damage per shot from a building's garrison (its squads in index order, as garrisonOf).
const garrisonFire = (garrison, s) => garrison.reduce((sum, q) => sum + q.strength * perHitFraction({ attackTicks: s.attackTicks }) * GARRISON_FIRE_MULT, 0);

// Towers and the (unbreached) keep fire at the nearest attacking squad in range.
export const resolveStructureFire = (w) => {
  // Every structure's garrison in one pass over the army (none of them changes while buildings fire:
  // they only ever hit attackers, and a garrison is the defender's).
  const garrisons = w.structures.map(() => []);
  w.squads.forEach((q) => { if (q.inside >= 0 && q.alive && garrisons[q.inside]) garrisons[q.inside].push(q); });
  w.structures.forEach((s, si) => {
    if (!s.alive) return;
    const garrison = garrisons[si];
    const bonus = garrisonFire(garrison, s);
    if (!s.damage && !bonus) return;
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
    const damage = Math.max(1, Math.round((s.damage + bonus) * variance));
    // The garrison shares the credit (battle XP goes to squads that fought).
    if (bonus) garrison.forEach((q) => { q.engaged = true; q.damageDealt += Math.round((damage * (q.strength * perHitFraction({ attackTicks: s.attackTicks }) * GARRISON_FIRE_MULT)) / (s.damage + bonus)); });
    target.strength = Math.max(0, target.strength - damage);
    target.morale = Math.max(0, target.morale - Math.round(moraleFromLosses(target, damage) * getPromotionMoraleLossMultiplier({ promotions: target.promotions })));
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
    if (isFighting(q) && !q.routed && !q.stats.flying && !(q.inside >= 0) && !q.worker) count[q.side] += 1;
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
    w.supply[side] = Math.min(cap, w.supply[side] + SUPPLY_BASE_PER_SEC + SUPPLY_PER_POINT_PER_SEC * held + buildingSupplyPerSec(w, side));
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
    if (!isFighting(q) || q.routed || q.worker) return; // laborers neither take nor hold the keep
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
