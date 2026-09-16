// src/engine/battle.js
// Phased battle resolution (plan §7): Deployment -> Ranged -> Shock -> Flanking -> Morale checks
// -> Pursuit. Pure and RNG-threaded like resolveTurn.js — no Math.random(), no React/DOM/browser
// imports — so combat replays identically from a seed, which is what the multiplayer story (plan
// §10, server-authoritative replay) depends on.
//
// One call resolves one engagement: the units each side actually deploys (bounded by combat
// width) fight a single round of ranged fire, melee, and flanking, then morale checks decide who
// routs and pursuit converts a broken loser's routs into real casualties. A side only loses the
// engagement if its deployed line is entirely destroyed or routed — an inconclusive exchange counts
// as the defender holding, matching how an attacker that fails to break the defense has failed to
// take the ground.
//
// What this deliberately does NOT model yet, because the systems don't exist: rivers, generals,
// supply state, tech-era gaps, doctrines, amphibious penalties, winter attrition. Those are each
// their own plan items (Promotions/Generals, Supply attrition, Naval, Government/AI); bolting fake
// modifiers on now would just be dead weight until those land.

import { getCounterMultiplier, getSiegeMultiplier } from '../data/unitClasses';
import { getCombatWidth } from '../data/combatWidth';

const RANGED_CLASSES = ['ranged', 'siege'];
const MORALE_ROUT_THRESHOLD = 20;
const BASE_DAMAGE_RATE = 0.1; // fraction of an attacking unit's strength dealt per exchange, before multipliers
const RNG_VARIANCE = 0.2; // +/-20% swing per damage roll, seeded so it's still reproducible
const FLANK_BONUS_MULT = 1.3;
const PURSUIT_EXTRA_LOSS_MULT = 0.5; // routed units lose another 50% of their remaining strength when pursued

const isRangedClass = (classId) => RANGED_CLASSES.includes(classId);
const clone = (unit) => ({ ...unit });

const deploy = (units, combatWidth) => {
  const sorted = [...units].sort((a, b) => b.strength - a.strength);
  return { front: sorted.slice(0, combatWidth).map(clone), reserve: sorted.slice(combatWidth).map(clone) };
};

// One side's units deal damage to the other side's front line, index-paired (wrapping if uneven).
// `classFilter` scopes this to just the ranged or just the melee units for that phase.
const exchangeDamage = (rng, phase, sourceUnits, targetUnits, { classFilter, sourceIsInvadingFortification }, log) => {
  sourceUnits.forEach((unit, i) => {
    if (unit.strength <= 0) return;
    if (classFilter && !classFilter(unit.classId)) return;
    if (targetUnits.length === 0) return;
    const target = targetUnits[i % targetUnits.length];
    if (target.strength <= 0) return;
    const variance = 1 + (rng.next() * 2 - 1) * RNG_VARIANCE;
    let multiplier = getCounterMultiplier(unit.classId, target.classId);
    if (unit.classId === 'siege') multiplier *= getSiegeMultiplier(sourceIsInvadingFortification);
    const damage = Math.max(0, Math.round(unit.strength * BASE_DAMAGE_RATE * multiplier * variance));
    if (damage <= 0) return;
    target.strength = Math.max(0, target.strength - damage);
    target.morale = Math.max(0, target.morale - Math.round(damage / 25));
    log.push({ phase, attackerId: unit.id, attackerClass: unit.classId, defenderId: target.id, defenderClass: target.classId, damage, multiplier: Math.round(multiplier * 100) / 100 });
  });
};

// Cavalry held in reserve (beyond combat width) wraps the flank instead of joining the front line —
// it hits the enemy front for a bonus and, since it was never deployed, takes no return damage.
const flankingPhase = (rng, sourceReserve, targetFront, log) => {
  const flankers = sourceReserve.filter((u) => u.classId === 'cavalry' && u.strength > 0);
  flankers.forEach((unit, i) => {
    if (targetFront.length === 0) return;
    const target = targetFront[i % targetFront.length];
    if (target.strength <= 0) return;
    const variance = 1 + (rng.next() * 2 - 1) * RNG_VARIANCE;
    const damage = Math.max(0, Math.round(unit.strength * BASE_DAMAGE_RATE * FLANK_BONUS_MULT * variance));
    if (damage <= 0) return;
    target.strength = Math.max(0, target.strength - damage);
    target.morale = Math.max(0, target.morale - Math.round(damage / 25));
    log.push({ phase: 'flanking', attackerId: unit.id, attackerClass: unit.classId, defenderId: target.id, defenderClass: target.classId, damage });
  });
};

const markRouted = (units) => units.map((u) => ({ ...u, routed: u.strength > 0 && u.morale <= MORALE_ROUT_THRESHOLD }));

const isBroken = (frontLine) => frontLine.length === 0 || frontLine.every((u) => u.strength <= 0 || u.routed);

// The winning side's surviving cavalry runs down the loser's routed units for extra casualties.
const pursuitPhase = (winnerUnits, loserFront, log) => {
  const cavalry = winnerUnits.filter((u) => u.classId === 'cavalry' && u.strength > 0);
  if (cavalry.length === 0) return;
  loserFront.forEach((u) => {
    if (!u.routed || u.strength <= 0) return;
    const extraLoss = Math.round(u.strength * PURSUIT_EXTRA_LOSS_MULT);
    u.strength = Math.max(0, u.strength - extraLoss);
    log.push({ phase: 'pursuit', defenderId: u.id, defenderClass: u.classId, damage: extraLoss });
  });
};

// attackerUnits/defenderUnits: arrays of unit state objects (id, classId, strength, morale, ...).
// context: { terrain, isAttackingFortification, rng } — rng is a src/utils/rng.js createRng()
// instance, threaded and advanced by the caller (mirrors resolveTurn.js's rngSeed handling).
export const resolveBattle = ({ attackerUnits, defenderUnits, terrain, isAttackingFortification, rng }) => {
  const combatWidth = getCombatWidth(terrain);
  const log = [];

  const { front: attFront, reserve: attReserve } = deploy(attackerUnits, combatWidth);
  const { front: defFront, reserve: defReserve } = deploy(defenderUnits, combatWidth);

  // Ranged phase: archers/artillery on both sides fire before contact, no return fire this phase.
  exchangeDamage(rng, 'ranged', attFront, defFront, { classFilter: isRangedClass, sourceIsInvadingFortification: isAttackingFortification }, log);
  exchangeDamage(rng, 'ranged', defFront, attFront, { classFilter: isRangedClass, sourceIsInvadingFortification: false }, log);

  // Shock phase: everyone else (infantry, cavalry, air, support) trades blows.
  const isMelee = (classId) => !isRangedClass(classId);
  exchangeDamage(rng, 'shock', attFront, defFront, { classFilter: isMelee, sourceIsInvadingFortification: isAttackingFortification }, log);
  exchangeDamage(rng, 'shock', defFront, attFront, { classFilter: isMelee, sourceIsInvadingFortification: false }, log);

  // Flanking: reserve cavalry on both sides wraps the opposing front line.
  flankingPhase(rng, attReserve, defFront, log);
  flankingPhase(rng, defReserve, attFront, log);

  const attFrontResolved = markRouted(attFront);
  const defFrontResolved = markRouted(defFront);

  const attackerBroken = isBroken(attFrontResolved);
  const defenderBroken = isBroken(defFrontResolved);

  // An inconclusive exchange (neither line breaks) counts as the defender holding — the attacker
  // failed to take the ground, same as real warfare.
  const outcome = defenderBroken ? (attackerBroken ? 'stalemate' : 'attacker') : 'defender';

  if (outcome === 'attacker') pursuitPhase([...attFrontResolved, ...attReserve], defFrontResolved, log);
  if (outcome === 'defender') pursuitPhase([...defFrontResolved, ...defReserve], attFrontResolved, log);

  return {
    outcome,
    attackerUnits: [...attFrontResolved, ...attReserve],
    defenderUnits: [...defFrontResolved, ...defReserve],
    report: {
      combatWidth,
      terrain,
      isAttackingFortification,
      deployedAttackers: attFront.length,
      deployedDefenders: defFront.length,
      reserveAttackers: attReserve.length,
      reserveDefenders: defReserve.length,
      outcome,
      log
    }
  };
};
