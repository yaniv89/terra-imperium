// src/battle/sim/combat.js
// Targeting and damage (Tactical Battles plan §6.3, §8.11). Every hit runs through battle.js's
// computeHitMultiplier — the exact stack auto-resolve uses per exchange — then adds only what a
// real battlefield knows and auto-resolve can't: which side of the target was hit (flank/rear),
// a cavalry charge's impact, pursuit of routed squads, and whether a defender is fighting from
// behind its walls. Damage is always rounded to an integer immediately, so replays stay exact.
import { computeHitMultiplier, BASE_DAMAGE_RATE, RNG_VARIANCE, FLANK_BONUS_MULT, PURSUIT_EXTRA_LOSS_MULT } from '../../engine/battle';
import { getCounterMultiplier, getSiegeMultiplier } from '../../data/unitClasses';
import { getPromotionMoraleLossMultiplier, applySapperToSiegeMultiplier } from '../../data/promotions';
import { nextRandom } from './rng';
import { angleBetween, angleDiff, distSq, isqrt, turnToward } from './fixed';
import { queryRadius } from './pathing';
import { Q, SQUAD_RADIUS, SIDE_ATTACKER, TICK_HZ, secondsToTicks } from './constants';
import { canSeeSquad } from './fog';
import { razeBuilding } from './buildings';
import { damageTakenMult, moraleLossMult, damageDealtMult, attackRateMult } from './effects';
import { moraleFromLosses } from './moraleMath';

const REVEAL_ON_ATTACK_TICKS = secondsToTicks(3);

// Seconds of continuous contact that equal one auto-resolve exchange; tuned by the parity harness.
export const EXCHANGE_SECONDS = 6;
export const REAR_BONUS_MULT = 1.5;          // RoN: rear hits +50% (flank uses battle.js's 1.3)
export const CHARGE_BONUS_MULT = 1.25;
export const CHARGE_DISTANCE = 4 * Q;
export const NON_SIEGE_STRUCTURE_MULT = 0.15; // only siege really cracks walls
const WALLS_MULT = 0.6;                       // keep with intact walls (fortLevel ≥ 2, above half HP)

export const perHitFraction = (stats) => (BASE_DAMAGE_RATE * (stats.attackTicks / TICK_HZ)) / EXCHANGE_SECONDS;

export const isFighting = (q) => q.alive && q.onField && !q.fled;
// A garrisoned squad doesn't fight on its own: its building shoots for it (objectives.js).
export const canAttack = (q) => isFighting(q) && !q.routed && !q.retreating && q.stats.attackTicks > 0 && !(q.inside >= 0);

// Plain unit view for battle.js's multiplier functions.
const view = (q) => ({ id: q.unitId, classId: q.classId, strength: q.strength, promotions: q.promotions, commanderId: q.commanderId });

// 0 front (±60°: a 120° arc), 1 flank (60–120° either side), 2 rear (±60° behind: 120°).
// Angles are 256 to the turn, so 60° ≈ 43 and 120° ≈ 85.
export const hitArc = (attacker, target) => {
  const from = angleBetween(target.x, target.y, attacker.x, attacker.y);
  const d = Math.abs(angleDiff(from, target.facing));
  return d <= 43 ? 0 : d <= 85 ? 1 : 2;
};

// Reach from centre to centre: melee needs the two squads touching; shooters measure to the edge.
export const reachOf = (q) => q.stats.range + (q.stats.melee ? SQUAD_RADIUS * 2 : SQUAD_RADIUS);

export const inRangeOfSquad = (q, t) => {
  const d2 = distSq(q.x, q.y, t.x, t.y);
  const reach = reachOf(q);
  if (d2 > reach * reach) return false;
  return !q.stats.minRange || d2 >= q.stats.minRange * q.stats.minRange;
};

export const inRangeOfStructure = (q, s) => {
  const reach = reachOf(q) + s.radius;
  return distSq(q.x, q.y, s.x, s.y) <= reach * reach;
};

const insideDefenderTerritory = (w, q) => distSq(q.x, q.y, w.structures[0].x, w.structures[0].y) <= w.setup.territoryRadius * w.setup.territoryRadius;

const sideCtx = (w, attacker, target) => {
  const m = w.setup.modifiers;
  if (attacker.side === SIDE_ATTACKER) {
    // Fortifications only shield defenders who are actually fighting from behind them.
    const walls = insideDefenderTerritory(w, target) ? m.defenseReduction : 1;
    return { sourceIsInvadingFortification: m.isAttackingFortification, targetIsDefendingSide: true, baseMultiplier: m.attackerBase * walls, generals: w.setup.generals };
  }
  return { sourceIsInvadingFortification: false, targetIsDefendingSide: false, baseMultiplier: m.defenderBase, generals: w.setup.generals };
};

const applyDamage = (w, attacker, target, damage) => {
  target.strength = Math.max(0, target.strength - damage);
  const moraleLoss = Math.round(moraleFromLosses(target, damage) * getPromotionMoraleLossMultiplier(view(target)) * moraleLossMult(w, target));
  target.morale = Math.max(0, target.morale - moraleLoss);
  target.lastHitTick = w.tick;
  target.engaged = true;
  attacker.engaged = true;
  // Retaliation (standard RTS behaviour): a squad that isn't under a specific order fights back
  // against whoever is hitting it, even from beyond its own sight range.
  // A squad battering a wall turns on whoever attacks it, too.
  const free = target.order.type === 'idle' || target.order.type === 'attackMove' || (target.order.type === 'attack' && target.targetKind === 'structure');
  const hasTarget = target.target >= 0 && target.targetKind === 'squad' && isFighting(w.squads[target.target]);
  if (target.order.type === 'attack' && target.targetKind === 'structure' && !hasTarget) target.order = { type: 'idle' };
  if (free && !hasTarget && !target.routed && !target.retreating && target.stats.attackTicks > 0 && validTargetFor(target, attacker)) {
    target.targetKind = 'squad'; target.target = attacker.idx;
    target.anchorX = attacker.x; target.anchorY = attacker.y; // chasing its attacker is not "leaving its post"
  }
  attacker.damageDealt += damage;
  if (target.strength === 0) {
    target.alive = false;
    w.events.push({ t: w.tick, type: 'destroyed', id: target.idx });
  }
};

// Running totals per (side, phase, class pair) for the battle report — the same {phase, damage}
// entries auto-resolve's report log carries, so the Military panel's report renders either.
const tally = (w, phase, a, t, damage) => {
  const key = `${a.side}|${phase}|${a.classId}|${t.classId}`;
  const entry = w.tally[key] || (w.tally[key] = { side: a.side, phase, attackerClass: a.classId, defenderClass: t.classId, damage: 0, hits: 0 });
  entry.damage += damage;
  entry.hits += 1;
};

export const attackSquad = (w, a, t) => {
  const phase = t.routed ? 'pursuit' : (a.stats.melee ? 'shock' : 'ranged');
  let mult = computeHitMultiplier(view(a), view(t), { ...sideCtx(w, a, t), phase });
  const arc = hitArc(a, t);
  if (arc === 1) mult *= FLANK_BONUS_MULT;
  else if (arc === 2) mult *= REAR_BONUS_MULT;
  if (a.stats.charge && a.movedSinceAttack >= CHARGE_DISTANCE) mult *= CHARGE_BONUS_MULT;
  if (t.routed) mult *= 1 + PURSUIT_EXTRA_LOSS_MULT;
  mult *= damageDealtMult(w, a) * damageTakenMult(w, t, arc);
  // Shooting gives your position away (and breaks an ambush).
  a.hiddenUntil = 0;
  a.revealedUntil = w.tick + REVEAL_ON_ATTACK_TICKS;
  const roll = nextRandom(w);
  const variance = 1 + (roll * 2 - 1) * RNG_VARIANCE;
  const damage = Math.max(0, Math.round(a.strength * perHitFraction(a.stats) * mult * variance));
  a.movedSinceAttack = 0;
  a.lastStrikeTick = w.tick;
  w.events.push({ t: w.tick, type: a.stats.melee ? 'melee' : 'shot', from: a.idx, to: t.idx, damage, arc });
  if (damage > 0) { applyDamage(w, a, t, damage); tally(w, phase, a, t, damage); }
  // Siege splash: half damage to every other enemy squad around the impact.
  if (a.stats.splash) {
    queryRadius(w, t.x, t.y, a.stats.splash).forEach((j) => {
      const other = w.squads[j];
      if (j === t.idx || other.side === a.side || !isFighting(other) || other.inside >= 0) return;
      const splash = Math.round(damage / 2);
      if (splash > 0) applyDamage(w, a, other, splash);
    });
  }
};

export const attackStructure = (w, a, s) => {
  let mult = NON_SIEGE_STRUCTURE_MULT;
  if (a.stats.structureBonus) mult = applySapperToSiegeMultiplier(view(a), true, getSiegeMultiplier(true));
  if (s.kind === 'keep' && s.walls && s.hp > s.maxHp / 2) mult *= WALLS_MULT;
  const variance = 1 + (nextRandom(w) * 2 - 1) * RNG_VARIANCE;
  const damage = Math.max(0, Math.round(a.strength * perHitFraction(a.stats) * mult * variance * 3));
  a.engaged = true;
  a.lastStrikeTick = w.tick;
  a.damageDealt += Math.round(damage / 3); // structure HP is on a bigger scale; count it 1/3 toward XP
  s.hp = Math.max(0, s.hp - damage);
  w.events.push({ t: w.tick, type: a.stats.melee ? 'melee' : 'shot', from: a.idx, structure: s.id, damage });
  if (s.hp === 0) {
    s.alive = false;
    if (s.kind === 'building') razeBuilding(w, s, a.side);
    else w.events.push({ t: w.tick, type: s.kind === 'keep' ? 'keepBreached' : 'structureDestroyed', structure: s.id });
  }
};

// How attractive enemy squad `t` is to `q`: good counters, wounded, close, and the soft
// high-value targets (siege and supply wagons) first.
export const targetScore = (q, t) => {
  const counter = getCounterMultiplier(q.classId, t.classId);
  const wounded = 2 - t.strength / t.maxStrength;
  const soft = t.classId === 'siege' || t.classId === 'support' ? 1.3 : 1;
  const d = isqrt(distSq(q.x, q.y, t.x, t.y)) / Q + 1;
  // Running men are no threat: a squad still standing and fighting is worth far more attention.
  return (counter * wounded * soft * (t.routed ? 0.8 : 1)) / d;
};

const validTargetFor = (q, t, w = null) => {
  if (!isFighting(t) || t.side === q.side || t.inside >= 0) return false;
  if (q.stats.airOnly && !t.stats.flying) return false;
  if (w && !canSeeSquad(w, q.side, t)) return false; // can't shoot what you can't see
  return true;
};

// Pick the best enemy squad within `radius`, or the nearest living structure for attackers.
export const acquireTarget = (w, q, radius) => {
  let best = -1; let bestScore = 0;
  queryRadius(w, q.x, q.y, radius).forEach((j) => {
    const t = w.squads[j];
    if (!validTargetFor(q, t, w)) return;
    if (q.stats.minRange && distSq(q.x, q.y, t.x, t.y) < q.stats.minRange * q.stats.minRange) return;
    const score = targetScore(q, t);
    if (score > bestScore) { bestScore = score; best = j; }
  });
  if (best >= 0 && !(q.stats.structureBonus && structureTargetIndex(w, q, radius) >= 0)) return { kind: 'squad', index: best };
  const si = q.side === SIDE_ATTACKER && !q.stats.airOnly ? structureTargetIndex(w, q, radius) : -1;
  if (si >= 0) return { kind: 'structure', index: si };
  return best >= 0 ? { kind: 'squad', index: best } : null;
};

// Towers before the keep; only structures within `radius`.
const structureTargetIndex = (w, q, radius) => {
  let best = -1; let bestD = Infinity;
  w.structures.forEach((s, i) => {
    if (!s.alive) return;
    const d = distSq(q.x, q.y, s.x, s.y) - s.radius * s.radius;
    const limit = (radius + s.radius) * (radius + s.radius);
    if (d > limit) return;
    const weighted = s.kind === 'keep' ? d * 2 : d;
    if (weighted < bestD) { bestD = weighted; best = i; }
  });
  return best;
};

// Resolve this tick's attacks for every squad whose cooldown is ready and target is in reach.
export const resolveAttacks = (w) => {
  w.squads.forEach((q) => {
    if (q.cooldown > 0) q.cooldown -= 1;
    if (!canAttack(q) || q.target < 0) return;
    if (q.targetKind === 'squad') {
      const t = w.squads[q.target];
      // A target the player picked stays picked while it's still on the field, even if it slips
      // out of sight for a moment: the squad keeps after it and strikes once it can see it again.
      const explicit = q.order.type === 'attack';
      if (!validTargetFor(q, t, explicit ? null : w)) { q.target = -1; return; }
      if (explicit && !canSeeSquad(w, q.side, t)) return;
      if (!inRangeOfSquad(q, t)) return;
      q.facing = turnToward(q.facing, angleBetween(q.x, q.y, t.x, t.y), 32);
      if (q.cooldown === 0) { attackSquad(w, q, t); q.cooldown = Math.max(1, Math.round(q.stats.attackTicks / attackRateMult(w, q))); }
    } else if (q.targetKind === 'structure') {
      const s = w.structures[q.target];
      if (!s || !s.alive) { q.target = -1; return; }
      if (!inRangeOfStructure(q, s)) return;
      q.facing = turnToward(q.facing, angleBetween(q.x, q.y, s.x, s.y), 32);
      if (q.cooldown === 0) { attackStructure(w, q, s); q.cooldown = Math.max(1, Math.round(q.stats.attackTicks / attackRateMult(w, q))); }
    }
  });
};
