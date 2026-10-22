// src/battle/sim/effects.js
// Generals, perk abilities and commander powers (Tactical Battles plan §8.4, §8.8, §8.9).
//
// Every timed buff/debuff is an "effect" centred on a squad (it moves with it) or a point, with a
// radius and an end tick; combat/movement ask `effectMult(w, q, kind)` what applies to a squad.
// Area strikes (arrow storms, barrages, air strikes) are scheduled "impacts" that land on
// later ticks — the renderer draws them from the same events. Everything is deterministic.
import { hasPerk } from '../../data/promotions';
import { powerCooldownMult } from './buildings';
import { nextRandom } from './rng';
import { distSq, polarX, polarY } from './fixed';
import { isFighting } from './combat';
import { Q, SIDE_DEFENDER, secondsToTicks as S } from './constants';
import { moraleFromLosses } from './moraleMath';
import { loseStrength } from './losses';
import { generalsOf } from './squadLists';
import { collapseFootprint } from './cityStructures';
import { isAgeAtLeast } from '../../data/ages';
import { canRout } from './morale';

// ---- general & perk abilities ----------------------------------------------------------------
export const ABILITIES = {
  forcedMarch: { label: 'Forced March', cooldown: S(60), duration: S(15), radius: 8 * Q, kind: 'speed', value: 1.5 },
  entrench: { label: 'Entrench', cooldown: S(90), duration: S(20), radius: 6 * Q, kind: 'frontalArmor', value: 0.7 },
  ambush: { label: 'Ambush', cooldown: S(120), duration: S(60), radius: 6 * Q, kind: 'hide' },
  charge: { label: 'Charge', cooldown: S(60), duration: S(10), radius: 8 * Q, kind: 'damage', value: 1.25, personality: 'reckless' },
  bombard: { label: 'Bombard', cooldown: S(75), duration: S(20), radius: 10 * Q, kind: 'siegeRate', value: 1.5, personality: 'siegemaster' },
  fieldHospital: { label: 'Field Hospital', cooldown: S(90), duration: S(20), radius: 6 * Q, kind: 'heal', value: 0.005, personality: 'logistician' },
  shieldWall: { label: 'Shield Wall', cooldown: S(90), duration: S(20), radius: 6 * Q, kind: 'frontalArmor', value: 0.6, personality: 'cautious', anywhere: true },
  volley: { label: 'Volley', cooldown: S(40), duration: S(6), radius: 0, kind: 'selfRate', value: 2, perk: 'volleyFire' }
};
const GENERAL_AURA_RADIUS = 8 * Q;
const AMBUSH_FIRST_STRIKE = 1.5;
const ENTRENCH_POINT_RADIUS = 8 * Q;

// Which abilities a squad can use: its general's (if it has one) and its own capstone perks.
export const getSquadAbilities = (w, q) => {
  const out = [];
  const general = q.commanderId ? w.setup.generals?.[q.commanderId] : null;
  if (general) {
    out.push('forcedMarch', 'entrench', 'ambush');
    Object.entries(ABILITIES).forEach(([id, a]) => { if (a.personality && a.personality === general.personality) out.push(id); });
  }
  if (hasPerk(q, 'volleyFire') && q.classId === 'ranged') out.push('volley');
  return out;
};

const abilityBlockedReason = (w, q, id) => {
  const a = ABILITIES[id];
  if (!a || !getSquadAbilities(w, q).includes(id)) return 'unavailable';
  if ((q.cooldowns?.[id] || 0) > w.tick) return 'cooldown';
  if (id === 'entrench' && !a.anywhere) {
    const onOwnGround = q.side === SIDE_DEFENDER || w.points.some((p) => p.owner === q.side && distSq(p.x, p.y, q.x, q.y) <= ENTRENCH_POINT_RADIUS * ENTRENCH_POINT_RADIUS);
    if (!onOwnGround) return 'notOwnGround';
  }
  return null;
};

// Ambush (a general's ability, or the Stone commander power): the side's squads around (x, y) hide
// until `until` and strike their first blow at AMBUSH_FIRST_STRIKE (shooting gives them away).
const hideAround = (w, side, x, y, radius, until) => w.squads.forEach((o) => {
  if (o.side === side && isFighting(o) && distSq(o.x, o.y, x, y) <= radius * radius) { o.hiddenUntil = until; o.ambushReady = true; }
});

export const activateAbility = (w, q, id) => {
  if (!q || !isFighting(q) || q.routed || abilityBlockedReason(w, q, id)) return false;
  const a = ABILITIES[id];
  q.cooldowns = { ...(q.cooldowns || {}), [id]: w.tick + a.cooldown };
  if (id === 'ambush') hideAround(w, q.side, q.x, q.y, a.radius, w.tick + a.duration);
  else {
    w.effects.push({ side: q.side, kind: a.kind, value: a.value, sourceIdx: q.idx, radius: a.radius, until: w.tick + a.duration, ability: id });
  }
  w.events.push({ t: w.tick, type: 'ability', id: q.idx, ability: id });
  return true;
};

const effectCovers = (w, e, q) => {
  if (e.side !== q.side || e.until <= w.tick) return false;
  if (e.radius === 0) return e.sourceIdx === q.idx;
  const src = e.sourceIdx >= 0 ? w.squads[e.sourceIdx] : null;
  const cx = src ? src.x : e.x; const cy = src ? src.y : e.y;
  if (src && !isFighting(src)) return false;
  return distSq(cx, cy, q.x, q.y) <= e.radius * e.radius;
};

// Product of every active effect of `kind` covering squad `q`.
export const effectMult = (w, q, kind) => {
  let m = 1;
  (w.effects || []).forEach((e) => { if (e.kind === kind && effectCovers(w, e, q)) m *= e.value; });
  return m;
};

// A general's passive aura (RoN: +armor, steadier troops): 0.9x damage taken, 0.8x morale loss.
export const generalAura = (w, q) => generalsOf(w).some((o) => o.side === q.side && isFighting(o) && !o.routed
  && distSq(o.x, o.y, q.x, q.y) <= GENERAL_AURA_RADIUS * GENERAL_AURA_RADIUS);

export const damageTakenMult = (w, q, arc) => {
  let m = generalAura(w, q) ? 0.9 : 1;
  if (arc === 0) m *= effectMult(w, q, 'frontalArmor');
  return m;
};
export const moraleLossMult = (w, q) => (generalAura(w, q) ? 0.8 : 1) * ((q.routImmuneUntil || -1) > w.tick ? 0 : 1);
export const damageDealtMult = (w, q) => {
  let m = effectMult(w, q, 'damage');
  if (q.ambushReady) { m *= AMBUSH_FIRST_STRIKE; q.ambushReady = false; }
  return m;
};
// A squad under machine-gun fire (combat.js `suppress`) fires at SUPPRESSED_RATE.
export const SUPPRESSED_RATE = 0.75;
export const attackRateMult = (w, q) => effectMult(w, q, 'selfRate') * (q.classId === 'siege' ? effectMult(w, q, 'siegeRate') : 1) * (q.suppressedUntil > w.tick ? SUPPRESSED_RATE : 1) * empSlow(w, q);
export const speedMult = (w, q) => effectMult(w, q, 'speed') * (hasPerk(q, 'forcedMarch') ? 1.2 : 1) * empSlow(w, q);

export const updateEffects = (w) => {
  if (!w.effects) return;
  // Field Hospital heals once a second while it lasts.
  if (w.tick % 20 === 0) {
    w.effects.forEach((e) => {
      if (e.kind !== 'heal' || e.until <= w.tick) return;
      w.squads.forEach((q) => {
        if (isFighting(q) && effectCovers(w, e, q) && q.strength < q.startStrength) q.strength = Math.min(q.startStrength, q.strength + Math.max(1, Math.round(q.maxStrength * e.value)));
      });
    });
  }
  w.effects = w.effects.filter((e) => e.until > w.tick);
  w.squads.forEach((q) => { if (q.hijack && q.hijack.until <= w.tick) endHijack(q); });
};

// ---- commander powers ----------------------------------------------------------------------
export const POWERS = {
  rallyCry: { label: 'Rally Cry', cost: 120, cooldown: S(90) }, // Stone calls it War Cry (invasion.js getBattlePowers)
  ambush: { label: 'Ambush', cost: 100, cooldown: S(90), hide: { radius: 6 * Q, duration: S(60) } }, // Stone (U39), aimed at your own troops
  arrowStorm: { label: 'Arrow Storm', cost: 150, cooldown: S(60), impacts: 6, spread: 3 * Q, every: 10, radius: Math.round(1.5 * Q), damage: 45, structureMult: 0.5, delay: 10 },
  artilleryBarrage: { label: 'Artillery Barrage', cost: 250, cooldown: S(75), impacts: 8, spread: 4 * Q, every: 10, radius: Math.round(1.8 * Q), damage: 90, structureMult: 3, delay: 20 },
  airStrike: { label: 'Air Strike', cost: 300, cooldown: S(90), impacts: 8, line: true, every: 4, radius: Math.round(1.4 * Q), damage: 120, structureMult: 2, delay: 40 },
  // Information (eight-ages U58): a quick, tight drone strike; Cyber Jam holds every order the
  // enemy gives for JAM_ORDER_DELAY while it lasts (orders.js applyOrders); Drone Recon shows the
  // whole field to its side for a while (fog.js revealUntil).
  droneStrike: { label: 'Drone Strike', cost: 200, cooldown: S(45), impacts: 3, spread: Q, every: 6, radius: Math.round(1.2 * Q), damage: 140, structureMult: 1, delay: 10 },
  cyberJam: { label: 'Cyber Jam', cost: 200, cooldown: S(90), jam: S(12) },
  droneRecon: { label: 'Drone Recon', cost: 100, cooldown: S(60), reveal: S(15) },
  // Future (eight-ages U68): Orbital Strike is one huge, slow blast; EMP stops the enemy's machines
  // around the point (empTicks: vehicles and aircraft 5 seconds, robots 10); Hijack turns the enemy
  // robot squad nearest the point to the caster's side for a while (never a human squad).
  orbitalStrike: { label: 'Orbital Strike', cost: 400, cooldown: S(180), impacts: 1, radius: 4 * Q, damage: 300, structureMult: 3, delay: 60 },
  emp: { label: 'EMP', cost: 250, cooldown: S(90), emp: { radius: 6 * Q, vehicle: S(5), robot: S(10) } },
  hijack: { label: 'Hijack', cost: 300, cooldown: S(120), hijack: { radius: 5 * Q, duration: S(5) } },
  // The invasion fleet's guns (amphibious landings): they only reach the shore half of the field.
  navalBombardment: { label: 'Naval Bombardment', cost: 0, cooldown: S(40), impacts: 6, spread: 3 * Q, every: 8, radius: Math.round(1.6 * Q), damage: 100, structureMult: 2.5, delay: 30, reachFrac: 0.5 }
};

// The machines an EMP stops: from the Modern age on these classes are vehicles, guns and aircraft.
const EMP_MACHINES = new Set(['cavalry', 'siege', 'air', 'support']);
/** How long an EMP stops squad `q`: a robot (engine/robots.js) twice a vehicle's time, a soldier not at all. */
export const empTicks = (q, emp) => (q.original?.robot ? emp.robot : isAgeAtLeast(q.ageId, 'modern') && EMP_MACHINES.has(q.classId) ? emp.vehicle : 0);
/** Is the squad stopped by an EMP this tick? It neither moves nor fires. Never a squad of a side that
 * cannot rout (the player's in a commanded battle: no forced loss of control), which only slows (EMP_SLOW). */
export const isStunned = (w, q) => q.stunnedUntil > w.tick && canRout(w, q.side);
export const EMP_SLOW = 0.5;
const empSlow = (w, q) => (q.stunnedUntil > w.tick && !canRout(w, q.side) ? EMP_SLOW : 1);
/** The side a squad belongs to, a hijacked one included: the battle's tallies and its end read this. */
export const homeSide = (q) => (q.hijack ? q.hijack.side : q.side);
/** The enemy robot squad on the field nearest (x, y) within `radius`, or null: Hijack's target. */
export const hijackTarget = (w, side, x, y, radius) => {
  let best = null; let bestD = radius * radius;
  // Never the squad of a side that cannot rout (the player's: no forced loss of control), nor one inside a building.
  w.squads.forEach((q) => { if (q.side === side || !q.original?.robot || !isFighting(q) || q.hijack || q.inside >= 0 || !canRout(w, q.side)) return; const d = distSq(q.x, q.y, x, y); if (d <= bestD) { best = q; bestD = d; } });
  return best;
};
/** A hijacked squad goes back to its own side (when its time is up, and at the battle's end before the result). */
export const endHijack = (q) => { q.side = q.hijack.side; q.hijack = null; q.target = -1; q.targetKind = null; q.order = { type: 'idle' }; };

/** Does the power land where the commander taps (a strike, an ambush, an EMP, a hijack)? */
export const isTargetedPower = (id) => !!(POWERS[id]?.impacts || POWERS[id]?.hide || POWERS[id]?.emp || POWERS[id]?.hijack);

/** How long a jammed side's orders wait (Cyber Jam): 3 seconds. */
export const JAM_ORDER_DELAY = S(3);

// setup.powers[side] = [{ id, uses? }] — which powers each side brought (fed by real strategic
// assets: air units, siege, the fleet). Uses default to unlimited (cooldown-gated).
export const powerState = (w, side, id) => {
  const entry = (w.setup.powers?.[side] || []).find((p) => p.id === id);
  if (!entry) return { available: false };
  const used = (w.powersUsed[side][id] || 0);
  const usesLeft = entry.uses === undefined ? Infinity : entry.uses - used;
  const readyAt = w.powerCooldowns[side][id] || 0;
  return { available: true, usesLeft, readyAt, cost: POWERS[id].cost };
};

export const firePower = (w, side, id, x, y) => {
  const p = POWERS[id];
  const st = powerState(w, side, id);
  if (!p || !st.available || st.usesLeft <= 0 || st.readyAt > w.tick || w.supply[side] < p.cost) return false;
  const seized = p.hijack ? hijackTarget(w, side, Math.round(x), Math.round(y), p.hijack.radius) : null;
  if (p.hijack && !seized) return false; // no enemy robot there: nothing is spent
  w.supply[side] -= p.cost;
  w.powerCooldowns[side][id] = w.tick + Math.round(p.cooldown * powerCooldownMult(w, side));
  w.powersUsed[side][id] = (w.powersUsed[side][id] || 0) + 1;
  w.events.push({ t: w.tick, type: 'power', side, power: id, x, y });
  if (id === 'rallyCry') {
    w.squads.forEach((q) => {
      if (q.side !== side || !isFighting(q)) return;
      q.morale = Math.min(100, q.morale + 30);
      q.routImmuneUntil = w.tick + S(8);
      if (q.routed) { q.routed = false; q.order = { type: 'idle' }; q.anchorX = q.x; q.anchorY = q.y; }
    });
    return true;
  }
  if (p.jam) { w.jammedUntil[1 - side] = w.tick + p.jam; return true; }
  if (p.emp) {
    w.squads.forEach((q) => { const t = q.side !== side && isFighting(q) && distSq(q.x, q.y, Math.round(x), Math.round(y)) <= p.emp.radius * p.emp.radius ? empTicks(q, p.emp) : 0; if (t) q.stunnedUntil = Math.max(q.stunnedUntil ?? -1, w.tick + t); });
    return true;
  }
  if (seized) {
    seized.hijack = { side: seized.side, until: w.tick + p.hijack.duration };
    seized.side = side; seized.target = -1; seized.targetKind = null; seized.order = { type: 'idle' };
    w.events.push({ t: w.tick, type: 'hijacked', id: seized.idx });
    return true;
  }
  if (p.reveal) { if (w.revealUntil) w.revealUntil[side] = Math.max(w.revealUntil[side], w.tick + p.reveal); return true; }
  if (p.hide) { hideAround(w, side, Math.round(x), Math.round(y), p.hide.radius, w.tick + p.hide.duration); return true; }
  const maxX = p.reachFrac ? Math.floor(w.map.w * p.reachFrac) * Q : w.map.w * Q - 1;
  const cx = Math.max(0, Math.min(maxX, Math.round(x))); const cy = Math.max(0, Math.min(w.map.h * Q - 1, Math.round(y)));
  for (let i = 0; i < p.impacts; i++) {
    let ix = cx; let iy = cy;
    if (p.line) { ix = cx + (i - (p.impacts - 1) / 2) * Math.round(1.2 * Q); }
    else if (p.spread) {
      const a = Math.floor(nextRandom(w) * 256); const r = Math.floor(nextRandom(w) * p.spread);
      ix = cx + polarX(a, r); iy = cy + polarY(a, r);
    }
    w.impacts.push({ tick: w.tick + p.delay + i * (p.every || 0), x: ix, y: iy, radius: p.radius, damage: p.damage, structureMult: p.structureMult, side, power: id });
  }
  return true;
};

// Land the impacts due this tick.
export const processImpacts = (w) => {
  if (!w.impacts?.length) return;
  const due = w.impacts.filter((i) => i.tick <= w.tick);
  if (!due.length) return;
  w.impacts = w.impacts.filter((i) => i.tick > w.tick);
  due.forEach((imp) => {
    w.events.push({ t: w.tick, type: 'impact', x: imp.x, y: imp.y, radius: imp.radius, power: imp.power });
    w.squads.forEach((q) => {
      if (!isFighting(q) || q.inside >= 0 || q.side === imp.side) return; // walls shelter a garrison
      if (distSq(q.x, q.y, imp.x, imp.y) > imp.radius * imp.radius) return;
      const damage = Math.min(q.strength, Math.round(imp.damage * (0.9 + nextRandom(w) * 0.2)));
      loseStrength(q, damage, 'impact');
      q.morale = Math.max(0, q.morale - Math.round(moraleFromLosses(q, damage) * 1.25)); // bombardment terrifies
      q.lastHitTick = w.tick; q.engaged = true;
      if (q.strength <= 0) { q.strength = 0; q.alive = false; w.events.push({ t: w.tick, type: 'destroyed', id: q.idx }); }
    });
    w.structures.forEach((s) => {
      if (!s.alive || imp.side === SIDE_DEFENDER) return; // the defender never shells its own keep
      if (distSq(s.x, s.y, imp.x, imp.y) > (imp.radius + s.radius) * (imp.radius + s.radius)) return;
      s.hp = Math.max(0, s.hp - Math.round(imp.damage * imp.structureMult));
      s.lastHitTick = w.tick;
      if (s.hp === 0) { s.alive = false; w.events.push({ t: w.tick, type: s.kind === 'keep' ? 'keepBreached' : 'structureDestroyed', structure: s.id }); collapseFootprint(w, s); }
    });
  });
};
