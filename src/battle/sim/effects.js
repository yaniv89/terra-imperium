// src/battle/sim/effects.js
// Generals, perk abilities and commander powers (Tactical Battles plan §8.4, §8.8, §8.9).
//
// Every timed buff/debuff is an "effect" centred on a squad (it moves with it) or a point, with a
// radius and an end tick; combat/movement ask `effectMult(w, q, kind)` what applies to a squad.
// Area strikes (arrow storms, barrages, air strikes, missiles) are scheduled "impacts" that land on
// later ticks — the renderer draws them from the same events. Everything is deterministic.
import { hasPerk } from '../../data/promotions';
import { powerCooldownMult } from './buildings';
import { nextRandom } from './rng';
import { distSq, polarX, polarY } from './fixed';
import { isFighting } from './combat';
import { Q, SIDE_DEFENDER, secondsToTicks as S } from './constants';
import { moraleFromLosses } from './moraleMath';
import { generalsOf } from './squadLists';
import { collapseFootprint } from './cityStructures';

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

export const activateAbility = (w, q, id) => {
  if (!q || !isFighting(q) || q.routed || abilityBlockedReason(w, q, id)) return false;
  const a = ABILITIES[id];
  q.cooldowns = { ...(q.cooldowns || {}), [id]: w.tick + a.cooldown };
  if (id === 'ambush') {
    w.squads.forEach((o) => {
      if (o.side === q.side && isFighting(o) && distSq(o.x, o.y, q.x, q.y) <= a.radius * a.radius) { o.hiddenUntil = w.tick + a.duration; o.ambushReady = true; }
    });
  } else {
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
export const attackRateMult = (w, q) => effectMult(w, q, 'selfRate') * (q.classId === 'siege' ? effectMult(w, q, 'siegeRate') : 1);
export const speedMult = (w, q) => effectMult(w, q, 'speed') * (hasPerk(q, 'forcedMarch') ? 1.2 : 1);

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
};

// ---- commander powers ----------------------------------------------------------------------
export const POWERS = {
  rallyCry: { label: 'Rally Cry', cost: 120, cooldown: S(90) },
  arrowStorm: { label: 'Arrow Storm', cost: 150, cooldown: S(60), impacts: 6, spread: 3 * Q, every: 10, radius: Math.round(1.5 * Q), damage: 45, structureMult: 0.5, delay: 10 },
  artilleryBarrage: { label: 'Artillery Barrage', cost: 250, cooldown: S(75), impacts: 8, spread: 4 * Q, every: 10, radius: Math.round(1.8 * Q), damage: 90, structureMult: 3, delay: 20 },
  airStrike: { label: 'Air Strike', cost: 300, cooldown: S(90), impacts: 8, line: true, every: 4, radius: Math.round(1.4 * Q), damage: 120, structureMult: 2, delay: 40 },
  satelliteSweep: { label: 'Satellite Sweep', cost: 0, cooldown: S(60) },
  missileTactical: { label: 'Tactical Missile', cost: 0, cooldown: S(5), tier: 'tactical', impacts: 1, radius: 3 * Q, damage: 380, structureMult: 4, delay: S(3), friendly: true },
  missileTheatre: { label: 'Theatre Missile', cost: 0, cooldown: S(5), tier: 'theatre', impacts: 1, radius: 4 * Q, damage: 650, structureMult: 4, delay: S(3), friendly: true },
  // The invasion fleet's guns (amphibious landings): they only reach the shore half of the field.
  navalBombardment: { label: 'Naval Bombardment', cost: 0, cooldown: S(40), impacts: 6, spread: 3 * Q, every: 8, radius: Math.round(1.6 * Q), damage: 100, structureMult: 2.5, delay: 30, reachFrac: 0.5 },
  nuclearStrike: { label: 'Nuclear Strike', cost: 0, cooldown: S(5), tier: 'nuclear', impacts: 1, radius: 14 * Q, damage: 1000000, structureMult: 1000, delay: S(4), friendly: true }
};

// setup.powers[side] = [{ id, uses? }] — which powers each side brought (fed by real strategic
// assets: satellites, missiles, air units, siege). Uses default to unlimited (cooldown-gated).
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
  if (id === 'satelliteSweep') { w.revealUntil[side] = w.tick + S(10); return true; }
  const maxX = p.reachFrac ? Math.floor(w.map.w * p.reachFrac) * Q : w.map.w * Q - 1;
  const cx = Math.max(0, Math.min(maxX, Math.round(x))); const cy = Math.max(0, Math.min(w.map.h * Q - 1, Math.round(y)));
  for (let i = 0; i < p.impacts; i++) {
    let ix = cx; let iy = cy;
    if (p.line) { ix = cx + (i - (p.impacts - 1) / 2) * Math.round(1.2 * Q); }
    else if (p.spread) {
      const a = Math.floor(nextRandom(w) * 256); const r = Math.floor(nextRandom(w) * p.spread);
      ix = cx + polarX(a, r); iy = cy + polarY(a, r);
    }
    w.impacts.push({ tick: w.tick + p.delay + i * (p.every || 0), x: ix, y: iy, radius: p.radius, damage: p.damage, structureMult: p.structureMult, side, friendly: !!p.friendly, power: id });
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
      if (!isFighting(q) || q.inside >= 0 || (!imp.friendly && q.side === imp.side)) return; // walls shelter a garrison
      if (distSq(q.x, q.y, imp.x, imp.y) > imp.radius * imp.radius) return;
      const damage = Math.min(q.strength, Math.round(imp.damage * (0.9 + nextRandom(w) * 0.2)));
      q.strength -= damage;
      q.morale = Math.max(0, q.morale - Math.round(moraleFromLosses(q, damage) * 1.25)); // bombardment terrifies
      q.lastHitTick = w.tick; q.engaged = true;
      if (q.strength <= 0) { q.strength = 0; q.alive = false; w.events.push({ t: w.tick, type: 'destroyed', id: q.idx }); }
    });
    w.structures.forEach((s) => {
      if (!s.alive || imp.side === SIDE_DEFENDER) return; // the defender never shells its own keep
      if (distSq(s.x, s.y, imp.x, imp.y) > (imp.radius + s.radius) * (imp.radius + s.radius)) return;
      s.hp = Math.max(0, s.hp - Math.round(imp.damage * imp.structureMult));
      if (s.hp === 0) { s.alive = false; w.events.push({ t: w.tick, type: s.kind === 'keep' ? 'keepBreached' : 'structureDestroyed', structure: s.id }); collapseFootprint(w, s); }
    });
  });
};
