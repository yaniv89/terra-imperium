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
// Promotions (src/data/promotions.js) and generals (src/data/generals.js) both bias combat through
// the same per-hit multiplier stack in dealDamage — every phase stays consistent by construction.
//
// What this deliberately does NOT model yet, because the systems don't exist: rivers, doctrines,
// winter attrition. Those are each their own plan item; bolting fake modifiers on now would just be
// dead weight until those land. The amphibious-assault landing penalty DOES apply here, via the
// caller-supplied attackerPenaltyMultiplier — this engine stays agnostic to WHY the attacker is
// penalized. Terrain (src/data/terrain.js) and each side's roster age (src/data/unitClasses.js's
// getRosterCombatMultiplier, replacing the old flat ages-behind malus) apply here directly, since
// both are inputs this engine already needs for combat width and IS the natural place to fold them
// into the same per-hit multiplier stack as everything else.

import { getCounterMultiplier, getSiegeMultiplier, getRosterCombatMultiplier } from '../data/unitClasses';
import { getCombatWidth, getTerrainCombatModifier } from '../data/terrain';
import {
  getPromotionDamageMultiplier,
  getPromotionDefenseMultiplier,
  getPromotionMoraleLossMultiplier,
  applySapperToSiegeMultiplier,
  hasPerk
} from '../data/promotions';
import { getGeneralDamageMultiplier, getGeneralDefenseMultiplier } from '../data/generals';

const RANGED_CLASSES = ['ranged', 'siege'];
const MORALE_ROUT_THRESHOLD = 20;
const BASE_DAMAGE_RATE = 0.1; // fraction of an attacking unit's strength dealt per exchange, before multipliers
// Plan §M14: tighter variance than M0-M13's baseline (was +/-20%) — now that counters (1.75/0.6) and
// roster stats both swing outcomes harder, a wide RNG band on top would drown both signals out.
const RNG_VARIANCE = 0.1; // +/-10% swing per damage roll, seeded so it's still reproducible
const FLANK_BONUS_MULT = 1.3;
const PURSUIT_EXTRA_LOSS_MULT = 0.5; // routed units lose another 50% of their remaining strength when pursued

const isRangedClass = (classId) => RANGED_CLASSES.includes(classId);
const clone = (unit) => ({ ...unit });

const deploy = (units, combatWidth) => {
  const sorted = [...units].sort((a, b) => b.strength - a.strength);
  return { front: sorted.slice(0, combatWidth).map(clone), reserve: sorted.slice(combatWidth).map(clone) };
};

// Computes one hit's damage and applies it to `target` in place. Folds in class counters, siege's
// fortification context, and every promotion/general multiplier on both the dealing and receiving
// unit — the single place all of combat's number-crunching happens, so every phase (ranged, shock,
// flanking, volley fire, pursuit) stays consistent by construction.
const dealDamage = (rng, phase, unit, target, { sourceIsInvadingFortification, generals, targetIsDefendingSide, baseMultiplier = 1 }, log) => {
  if (unit.strength <= 0 || target.strength <= 0) return;
  const roll = rng.next();
  const variance = 1 + (roll * 2 - 1) * RNG_VARIANCE;
  let multiplier = getCounterMultiplier(unit.classId, target.classId) * baseMultiplier;
  if (unit.classId === 'siege') {
    multiplier *= applySapperToSiegeMultiplier(unit, sourceIsInvadingFortification, getSiegeMultiplier(sourceIsInvadingFortification));
  }
  multiplier *= getPromotionDamageMultiplier(unit, { phase, isAttackingFortification: sourceIsInvadingFortification });
  multiplier *= getGeneralDamageMultiplier(generals[unit.commanderId], phase, unit.classId);
  multiplier *= getPromotionDefenseMultiplier(target, { isDefendingSide: targetIsDefendingSide });
  multiplier *= getGeneralDefenseMultiplier(generals[target.commanderId]);
  const damage = Math.max(0, Math.round(unit.strength * BASE_DAMAGE_RATE * multiplier * variance));
  if (damage <= 0) return;
  target.strength = Math.max(0, target.strength - damage);
  const moraleLoss = Math.round((damage / 25) * getPromotionMoraleLossMultiplier(target));
  target.morale = Math.max(0, target.morale - moraleLoss);
  // `roll` (plan §M14: "the battle report shows the dice for each phase") is the raw 0-1 draw behind
  // this hit's variance swing, exposed alongside the multiplier it already logged — a UI battle
  // report can render either as a literal die without re-deriving anything from `damage`.
  log.push({ phase, attackerId: unit.id, attackerClass: unit.classId, defenderId: target.id, defenderClass: target.classId, damage, multiplier: Math.round(multiplier * 100) / 100, roll: Math.round(roll * 100) / 100 });
};

// One side's units deal damage to the other side's front line, index-paired (wrapping if uneven).
// `classFilter` scopes this to just the ranged or just the melee units for that phase.
const exchangeDamage = (rng, phase, sourceUnits, targetUnits, ctx, log) => {
  sourceUnits.forEach((unit, i) => {
    if (unit.strength <= 0) return;
    if (ctx.classFilter && !ctx.classFilter(unit.classId)) return;
    if (targetUnits.length === 0) return;
    dealDamage(rng, phase, unit, targetUnits[i % targetUnits.length], ctx, log);
  });
};

// Volley Fire's capstone: a ranged unit that already fired gets a second shot, aimed independently
// at whichever enemy on the front line is currently weakest rather than its original index-paired
// target (which may already be dead).
const volleyFirePhase = (rng, sourceFront, targetFront, ctx, log) => {
  const volleyUnits = sourceFront.filter((u) => u.classId === 'ranged' && hasPerk(u, 'volleyFire') && u.strength > 0);
  volleyUnits.forEach((unit) => {
    const target = [...targetFront].filter((t) => t.strength > 0).sort((a, b) => a.strength - b.strength)[0];
    if (!target) return;
    dealDamage(rng, 'ranged', unit, target, ctx, log);
  });
};

// Cavalry held in reserve (beyond combat width) wraps the flank instead of joining the front line —
// it hits the enemy front for a bonus and, since it was never deployed, takes no return damage.
const flankingPhase = (rng, sourceReserve, targetFront, ctx, log) => {
  const flankers = sourceReserve.filter((u) => u.classId === 'cavalry' && u.strength > 0);
  flankers.forEach((unit, i) => {
    if (targetFront.length === 0) return;
    dealDamage(rng, 'flanking', unit, targetFront[i % targetFront.length], { ...ctx, baseMultiplier: (ctx.baseMultiplier ?? 1) * FLANK_BONUS_MULT }, log);
  });
};

// Unbreakable's capstone: the first time a unit's morale would break it this battle, it shrugs the
// rout off instead — a fresh immunity every engagement, not a permanently-spent charge.
const markRouted = (units) => units.map((u) => {
  const wouldRout = u.strength > 0 && u.morale <= MORALE_ROUT_THRESHOLD;
  if (wouldRout && hasPerk(u, 'unbreakable')) return { ...u, morale: MORALE_ROUT_THRESHOLD + 1, routed: false };
  return { ...u, routed: wouldRout };
});

const isBroken = (frontLine) => frontLine.length === 0 || frontLine.every((u) => u.strength <= 0 || u.routed);

// The winning side's strongest surviving cavalry runs down the loser's routed units for extra
// casualties — Overrun and Relentless (both pursuit-phase promotion/capstone perks) apply here via
// the same multiplier stack as every other hit.
const pursuitPhase = (winnerUnits, loserFront, generals, log) => {
  const cavalry = winnerUnits.filter((u) => u.classId === 'cavalry' && u.strength > 0);
  if (cavalry.length === 0) return;
  const pursuer = cavalry.reduce((a, b) => (a.strength >= b.strength ? a : b));
  let mult = PURSUIT_EXTRA_LOSS_MULT;
  mult *= getPromotionDamageMultiplier(pursuer, { phase: 'pursuit', isAttackingFortification: false });
  mult *= getGeneralDamageMultiplier(generals[pursuer.commanderId], 'pursuit', pursuer.classId);
  loserFront.forEach((u) => {
    if (!u.routed || u.strength <= 0) return;
    const extraLoss = Math.round(u.strength * mult);
    u.strength = Math.max(0, u.strength - extraLoss);
    log.push({ phase: 'pursuit', attackerId: pursuer.id, attackerClass: pursuer.classId, defenderId: u.id, defenderClass: u.classId, damage: extraLoss });
  });
};

// attackerUnits/defenderUnits: arrays of unit state objects (id, classId, strength, morale,
// commanderId, promotions, ...). `generals` is an optional {id: general} lookup (src/data/
// generals.js) resolved by each unit's commanderId. `rng` is a src/utils/rng.js createRng()
// instance, threaded and advanced by the caller (mirrors resolveTurn.js's rngSeed handling).
// `attackerPenaltyMultiplier` (default 1, no penalty) folds together every OTHER "why is the
// attacker's damage output reduced" source the caller already knows about (currently just the
// amphibious-assault landing malus — the old ages-behind combat malus is gone, replaced by the
// attackerAgeId/defenderAgeId roster comparison below) — a flat multiplier on every hit the
// attacker lands, applied by the caller (src/engine/gameReducer.js) rather than known to this
// generic engine.
// `defenderDamageReductionMultiplier` (default 1, no reduction) is the SAME idea from the other
// side: src/engine/siege.js's defenseLevel bonus ("Walls"), kept as its own param rather than
// folded into the attacker one so it stays independently unit-testable and reads as what it is —
// a property of the region being defended, not of the attacking force.
// `attackerAgeId`/`defenderAgeId` (plan §M14, default 'bronze' each — i.e. no roster skew unless a
// caller supplies real ages): each side's current effective tech age, used to derive a roster
// combat multiplier (src/data/unitClasses.js's getRosterCombatMultiplier) that replaces the old
// flat "ages-behind" combat malus (src/data/ages.js's now-removed getAgesBehindCombatMultiplier) —
// a real comparison of BOTH sides' ages instead of a one-sided penalty, netting to 1.0 whenever the
// two sides share an age, whichever age that is. `attackerPenaltyMultiplier` still exists
// separately for context-specific mali the roster comparison knows nothing about (the amphibious-
// assault landing malus).
export const resolveBattle = ({
  attackerUnits, defenderUnits, terrain, isAttackingFortification, rng, generals = {},
  attackerPenaltyMultiplier = 1, defenderDamageReductionMultiplier = 1,
  attackerAgeId = 'bronze', defenderAgeId = 'bronze'
}) => {
  const combatWidth = getCombatWidth(terrain);
  const terrainMod = getTerrainCombatModifier(terrain);
  const log = [];

  const { front: attFront, reserve: attReserve } = deploy(attackerUnits, combatWidth);
  const { front: defFront, reserve: defReserve } = deploy(defenderUnits, combatWidth);

  const attackerRosterMult = getRosterCombatMultiplier(attackerAgeId, defenderAgeId);
  const defenderRosterMult = getRosterCombatMultiplier(defenderAgeId, attackerAgeId);

  // Terrain favors the DEFENDER (plan §M14's own table: hills/forest/mountains all reduce the
  // attacker's output, none reduce the defender's) — folded only into the attacker's own multiplier.
  const attackerCtx = { classFilter: isRangedClass, sourceIsInvadingFortification: isAttackingFortification, generals, targetIsDefendingSide: true, baseMultiplier: attackerPenaltyMultiplier * defenderDamageReductionMultiplier * attackerRosterMult * terrainMod.attackerMult };
  const defenderCtx = { classFilter: isRangedClass, sourceIsInvadingFortification: false, generals, targetIsDefendingSide: false, baseMultiplier: defenderRosterMult };

  // Ranged phase: archers/artillery on both sides fire before contact, no return fire this phase.
  exchangeDamage(rng, 'ranged', attFront, defFront, attackerCtx, log);
  exchangeDamage(rng, 'ranged', defFront, attFront, defenderCtx, log);
  volleyFirePhase(rng, attFront, defFront, attackerCtx, log);
  volleyFirePhase(rng, defFront, attFront, defenderCtx, log);

  // Shock phase: everyone else (infantry, cavalry, air, support) trades blows.
  const isMelee = (classId) => !isRangedClass(classId);
  exchangeDamage(rng, 'shock', attFront, defFront, { ...attackerCtx, classFilter: isMelee }, log);
  exchangeDamage(rng, 'shock', defFront, attFront, { ...defenderCtx, classFilter: isMelee }, log);

  // Flanking: reserve cavalry on both sides wraps the opposing front line.
  flankingPhase(rng, attReserve, defFront, attackerCtx, log);
  flankingPhase(rng, defReserve, attFront, defenderCtx, log);

  const attFrontResolved = markRouted(attFront);
  const defFrontResolved = markRouted(defFront);

  const attackerBroken = isBroken(attFrontResolved);
  const defenderBroken = isBroken(defFrontResolved);

  // An inconclusive exchange (neither line breaks) counts as the defender holding — the attacker
  // failed to take the ground, same as real warfare.
  const outcome = defenderBroken ? (attackerBroken ? 'stalemate' : 'attacker') : 'defender';

  if (outcome === 'attacker') pursuitPhase([...attFrontResolved, ...attReserve], defFrontResolved, generals, log);
  if (outcome === 'defender') pursuitPhase([...defFrontResolved, ...defReserve], attFrontResolved, generals, log);

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
      // Only deployed units actually fought — this is what the caller should award battle XP to.
      deployedAttackerIds: attFront.map((u) => u.id),
      deployedDefenderIds: defFront.map((u) => u.id),
      outcome,
      log
    }
  };
};
