// src/engine/battle.js
// Phased battle resolution (plan §7): Deployment -> Ranged -> Shock -> Flanking -> Morale checks
// -> Pursuit. Pure and RNG-threaded like resolveTurn.js — no Math.random(), no React/DOM/browser
// imports — so combat replays identically from a seed, which is what the multiplayer story (plan
// §10, server-authoritative replay) depends on.
//
// One call resolves one engagement, fought in ROUNDS until a line breaks (at most MAX_BATTLE_ROUNDS):
// the units each side deploys (bounded by combat width) trade ranged fire and melee, cavalry held
// in reserve wraps the flank on the first round, and after every round morale is checked — a unit
// routs once it has lost enough of itself (morale falls with the SHARE of the unit lost, so a big
// regiment and a small one break at the same casualty rate). Dead and routed units leave the line
// and fresh ones step in from reserve. A side loses when it has no unbroken unit left to put in
// the line; pursuit then converts the loser's routs into real casualties. Both sides strike at the
// same instant each phase (no first-strike bias), so on open ground equal armies are a coin flip —
// terrain, walls, age, counters, promotions and generals are what tilt it. A battle still
// undecided after the last round counts as the defender holding: the attacker failed to take the
// ground. (Before, a battle was a single exchange whose morale damage could never break anyone,
// so every auto-resolved attack on a garrison ended as a "defender" win.)
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
import { autoAttackerMult } from '../battle/setup/battleType';
import { getCombatWidth, getTerrainCombatModifier } from '../data/terrain';
import {
  getPromotionDamageMultiplier,
  getPromotionDefenseMultiplier,
  getPromotionMoraleLossMultiplier,
  applySapperToSiegeMultiplier,
  hasPerk
} from '../data/promotions';
import { getGeneralDamageMultiplier, getGeneralDefenseMultiplier } from '../data/generals';
import { navalLineOf, navalCombatMult } from '../data/navalLines';

const RANGED_CLASSES = ['ranged', 'siege'];
const MORALE_ROUT_THRESHOLD = 20;
const BASE_DAMAGE_RATE = 0.1; // fraction of an attacking unit's strength dealt per exchange, before multipliers
// Plan §M14: tighter variance than M0-M13's baseline (was +/-20%) — now that counters (1.75/0.6) and
// roster stats both swing outcomes harder, a wide RNG band on top would drown both signals out.
const RNG_VARIANCE = 0.1; // +/-10% swing per damage roll, seeded so it's still reproducible
const FLANK_BONUS_MULT = 1.3;
const PURSUIT_EXTRA_LOSS_MULT = 0.5; // routed units lose another 50% of their remaining strength when pursued
export const MAX_BATTLE_ROUNDS = 8;
export const BATTLE_FORTUNE = 0.3; // ± per side, per battle
// Morale lost per 1% of a unit's own (battle-start) strength lost: ~27% casualties breaks a fresh unit.
export const MORALE_LOSS_PER_PERCENT = 3;

// Shared with the tactical sim (src/battle/sim) so both resolution paths use the same constants.
export { BASE_DAMAGE_RATE, RNG_VARIANCE, MORALE_ROUT_THRESHOLD, FLANK_BONUS_MULT, PURSUIT_EXTRA_LOSS_MULT };

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
// The full per-hit multiplier for `unit` hitting `target`: class counters, siege's fortification
// context, and every promotion/general multiplier on both sides. Exported so the real-time tactical
// sim (src/battle/sim/combat.js) applies exactly the same stack per hit as this engine does per
// exchange — auto-resolve and commanded battles can never drift apart on "how hard does this hit".
export const computeHitMultiplier = (unit, target, { phase, sourceIsInvadingFortification, generals = {}, targetIsDefendingSide, baseMultiplier = 1 }) => {
  let multiplier = getCounterMultiplier(unit.classId, target.classId) * baseMultiplier;
  if (unit.classId === 'naval') multiplier *= navalCombatMult(navalLineOf(unit)); // a transport fights badly, a raider lightly (navalLines.js)
  if (unit.classId === 'siege') {
    multiplier *= applySapperToSiegeMultiplier(unit, sourceIsInvadingFortification, getSiegeMultiplier(sourceIsInvadingFortification));
  }
  multiplier *= getPromotionDamageMultiplier(unit, { phase, isAttackingFortification: sourceIsInvadingFortification });
  multiplier *= getGeneralDamageMultiplier(generals[unit.commanderId], phase, unit.classId);
  multiplier *= getPromotionDefenseMultiplier(target, { isDefendingSide: targetIsDefendingSide });
  multiplier *= getGeneralDefenseMultiplier(generals[target.commanderId]);
  return multiplier;
};

// One hit, computed from the dealer's strength NOW but applied later (applyHits), so both sides of
// a phase strike simultaneously.
const rollHit = (rng, phase, unit, target, ctx, log, round, share = 1) => {
  if (unit.strength <= 0 || target.strength <= 0) return null;
  const roll = rng.next();
  const variance = 1 + (roll * 2 - 1) * RNG_VARIANCE;
  const multiplier = computeHitMultiplier(unit, target, { ...ctx, phase });
  const damage = Math.max(0, Math.round(unit.strength * BASE_DAMAGE_RATE * multiplier * variance * share));
  if (damage <= 0) return null;
  // `roll` (plan §M14: "the battle report shows the dice for each phase") is the raw 0-1 draw behind
  // this hit's variance swing, exposed alongside the multiplier it already logged — a UI battle
  // report can render either as a literal die without re-deriving anything from `damage`.
  log.push({ round, phase, attackerId: unit.id, attackerClass: unit.classId, defenderId: target.id, defenderClass: target.classId, damage, multiplier: Math.round(multiplier * 100) / 100, roll: Math.round(roll * 100) / 100 });
  return { target, damage };
};

// Casualties cost morale in proportion to the share of the unit lost this battle.
const applyHits = (hits) => hits.forEach((h) => {
  if (!h) return;
  const { target, damage } = h;
  const dealt = Math.min(target.strength, damage);
  target.strength = Math.max(0, target.strength - damage);
  const pct = (100 * dealt) / Math.max(1, target._start);
  target.morale = Math.max(0, target.morale - Math.round(pct * MORALE_LOSS_PER_PERCENT * getPromotionMoraleLossMultiplier(target)));
});

// One side's units hit the other side's front line, index-paired. A side with more units in the
// line than the enemy has overlaps it: the surplus units spread their blows across the whole enemy
// line (an overlapping wing presses everywhere) rather than piling onto one unit, which used to
// rout it at once and snowball a small numbers edge into a certain win.
// `classFilter` scopes this to just the ranged or just the melee units for that phase.
const collectHits = (rng, phase, sourceUnits, targetUnits, ctx, log, round) => {
  const hits = [];
  const n = targetUnits.length;
  if (n === 0) return hits;
  sourceUnits.forEach((unit, i) => {
    if (unit.strength <= 0) return;
    if (ctx.classFilter && !ctx.classFilter(unit.classId)) return;
    if (i < n) { hits.push(rollHit(rng, phase, unit, targetUnits[i], ctx, log, round)); return; }
    targetUnits.forEach((target) => hits.push(rollHit(rng, phase, unit, target, ctx, log, round, 1 / n)));
  });
  return hits;
};

// Volley Fire's capstone: a ranged unit that already fired gets a second shot, aimed independently
// at whichever enemy on the front line is currently weakest rather than its original index-paired
// target (which may already be dead).
const volleyHits = (rng, sourceFront, targetFront, ctx, log, round) => sourceFront
  .filter((u) => u.classId === 'ranged' && hasPerk(u, 'volleyFire') && u.strength > 0)
  .map((unit) => {
    const target = [...targetFront].filter((t) => t.strength > 0).sort((a, b) => a.strength - b.strength)[0];
    return target ? rollHit(rng, 'ranged', unit, target, ctx, log, round) : null;
  });

// Cavalry held in reserve (beyond combat width) wraps the flank instead of joining the front line —
// it hits the enemy front for a bonus and, since it was never deployed, takes no return damage.
const flankHits = (rng, sourceReserve, targetFront, ctx, log, round) => sourceReserve
  .filter((u) => u.classId === 'cavalry' && u.strength > 0)
  .map((unit, i) => (targetFront.length
    ? rollHit(rng, 'flanking', unit, targetFront[i % targetFront.length], { ...ctx, baseMultiplier: (ctx.baseMultiplier ?? 1) * FLANK_BONUS_MULT }, log, round)
    : null));

// Unbreakable's capstone: the first time a unit's morale would break it this battle, it shrugs the
// rout off instead — once per engagement, a fresh immunity every battle.
const markRouted = (units) => units.forEach((u) => {
  const wouldRout = u.strength > 0 && u.morale <= MORALE_ROUT_THRESHOLD;
  if (wouldRout && hasPerk(u, 'unbreakable') && !u._shrugged) { u.morale = MORALE_ROUT_THRESHOLD + 1; u.routed = false; u._shrugged = true; return; }
  u.routed = wouldRout;
});

const canFight = (u) => u.strength > 0 && !u.routed;

// Between rounds: the dead and routed leave the line; fresh units step in from reserve.
const refillLine = (front, reserve, combatWidth, fought) => {
  const standing = front.filter(canFight);
  const fresh = reserve.filter(canFight).sort((a, b) => b.strength - a.strength);
  while (standing.length < combatWidth && fresh.length) {
    const u = fresh.shift();
    standing.push(u);
    fought.add(u.id);
  }
  return standing;
};

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
  attackerAgeId = 'bronze', defenderAgeId = 'bronze', battleType = 'field',
  // More rounds when the battle economy adds auxiliaries (autoBattle.js): the real-time battle has
  // the time to fight them all, an 8-round exchange would end in a stand-off.
  maxRounds = MAX_BATTLE_ROUNDS
}) => {
  const combatWidth = getCombatWidth(terrain);
  const terrainMod = getTerrainCombatModifier(terrain);
  const log = [];

  // Every unit's battle-start strength is the yardstick its morale losses are measured against.
  const prep = (units) => units.map((u) => ({ ...clone(u), _start: Math.max(1, u.strength), routed: false }));
  const attAll = prep(attackerUnits);
  const defAll = prep(defenderUnits);
  const { front: attDeployed, reserve: attReserveStart } = deploy(attAll, combatWidth);
  const { front: defDeployed, reserve: defReserveStart } = deploy(defAll, combatWidth);
  // deploy() clones; keep working on the same objects as attAll/defAll.
  const byId = (all) => new Map(all.map((u) => [u.id, u]));
  const attMap = byId(attAll); const defMap = byId(defAll);
  let attFront = attDeployed.map((u) => attMap.get(u.id));
  let defFront = defDeployed.map((u) => defMap.get(u.id));
  const attReserve = attReserveStart.map((u) => attMap.get(u.id));
  const defReserve = defReserveStart.map((u) => defMap.get(u.id));
  const attFought = new Set(attFront.map((u) => u.id));
  const defFought = new Set(defFront.map((u) => u.id));

  const attackerRosterMult = getRosterCombatMultiplier(attackerAgeId, defenderAgeId);
  const defenderRosterMult = getRosterCombatMultiplier(defenderAgeId, attackerAgeId);

  // Terrain favors the DEFENDER (plan §M14's own table: hills/forest/mountains all reduce the
  // attacker's output, none reduce the defender's) — folded only into the attacker's own multiplier.
  // The fortunes of war: one battle-wide roll per side (weather, a general's good day, the ground
  // underfoot), so the stronger side is favoured but an underdog can still carry the day.
  const attackerFortune = 1 + (rng.next() * 2 - 1) * BATTLE_FORTUNE;
  const defenderFortune = 1 + (rng.next() * 2 - 1) * BATTLE_FORTUNE;
  const attackerCtx = { classFilter: isRangedClass, sourceIsInvadingFortification: isAttackingFortification, generals, targetIsDefendingSide: true, baseMultiplier: attackerPenaltyMultiplier * autoAttackerMult(battleType) * defenderDamageReductionMultiplier * attackerRosterMult * terrainMod.attackerMult * attackerFortune }; // the battle type's own odds (battleType.js)
  const defenderCtx = { classFilter: isRangedClass, sourceIsInvadingFortification: false, generals, targetIsDefendingSide: false, baseMultiplier: defenderRosterMult * defenderFortune };
  const isMelee = (classId) => !isRangedClass(classId);

  let attackerBroken = attFront.length === 0;
  let defenderBroken = defFront.length === 0;
  let rounds = 0;
  // Each side's total strength at the start and after every round (and after the pursuit), for
  // the auto-resolve replay and the battle report chart. Display only: nothing reads it back.
  // (the army's own men: local auxiliaries, autoBattle.js, are not counted)
  const standing = (all) => all.reduce((sum, u) => sum + (u.auxiliary ? 0 : Math.max(0, u.strength)), 0);
  const timeline = [{ round: 0, att: Math.round(standing(attAll)), def: Math.round(standing(defAll)) }];
  while (!attackerBroken && !defenderBroken && rounds < maxRounds) {
    rounds += 1;
    // Ranged phase: archers/artillery on both sides fire (every round — they keep shooting).
    applyHits([
      ...collectHits(rng, 'ranged', attFront, defFront, attackerCtx, log, rounds),
      ...collectHits(rng, 'ranged', defFront, attFront, defenderCtx, log, rounds),
      ...volleyHits(rng, attFront, defFront, attackerCtx, log, rounds),
      ...volleyHits(rng, defFront, attFront, defenderCtx, log, rounds)
    ]);
    // Shock phase: everyone else (infantry, cavalry, air, support) trades blows.
    applyHits([
      ...collectHits(rng, 'shock', attFront, defFront, { ...attackerCtx, classFilter: isMelee }, log, rounds),
      ...collectHits(rng, 'shock', defFront, attFront, { ...defenderCtx, classFilter: isMelee }, log, rounds)
    ]);
    // Flanking: on the opening round, reserve cavalry on both sides wraps the opposing line.
    if (rounds === 1) {
      applyHits([
        ...flankHits(rng, attReserve, attFront.length ? defFront : [], attackerCtx, log, rounds),
        ...flankHits(rng, defReserve, attFront, defenderCtx, log, rounds)
      ]);
    }
    markRouted(attFront); markRouted(defFront);
    attFront = refillLine(attFront, attReserve, combatWidth, attFought);
    defFront = refillLine(defFront, defReserve, combatWidth, defFought);
    // Local auxiliaries (autoBattle.js, the battle economy's trained troops) fight in the line but
    // never hold it alone: a side whose own army has broken is beaten, its auxiliaries or not.
    const ownLeft = (front, reserve) => front.some((u) => !u.auxiliary) || reserve.some((u) => !u.auxiliary && canFight(u));
    attackerBroken = !ownLeft(attFront, attReserve);
    defenderBroken = !ownLeft(defFront, defReserve);
    timeline.push({ round: rounds, att: Math.round(standing(attAll)), def: Math.round(standing(defAll)), attBroken: attackerBroken, defBroken: defenderBroken });
  }

  // Both lines broke in the same round: whoever still has clearly more men on the field holds it.
  const mutual = attackerBroken && defenderBroken
    ? (standing(attAll) > standing(defAll) * 1.1 ? 'attacker' : standing(defAll) > standing(attAll) * 1.1 ? 'defender' : 'stalemate')
    : null;
  // Undecided after the last round: the defender holds — the attacker failed to take the ground.
  const outcome = mutual || (defenderBroken ? 'attacker' : 'defender');

  const finish = (all) => all.map((u) => {
    // eslint-disable-next-line no-unused-vars -- battle-internal bookkeeping, not unit state
    const { _start, _shrugged, ...rest } = u;
    return { ...rest, routed: !!rest.routed && rest.strength > 0 };
  });
  if (outcome === 'attacker') pursuitPhase(attAll, defAll, generals, log);
  if (outcome === 'defender' && attackerBroken) pursuitPhase(defAll, attAll, generals, log);
  // (a mutual collapse won on numbers still leaves the winner's own routed men to rally — no pursuit
  // of the winner; pursuit only ever runs the loser down.)
  const attOut = finish(attAll);
  const defOut = finish(defAll);
  const afterPursuit = { att: Math.round(standing(attAll)), def: Math.round(standing(defAll)) };
  const last = timeline[timeline.length - 1];
  if (afterPursuit.att !== last.att || afterPursuit.def !== last.def) timeline.push({ round: rounds + 1, pursuit: true, ...afterPursuit });

  return {
    outcome,
    attackerUnits: attOut,
    defenderUnits: defOut,
    report: {
      combatWidth,
      terrain,
      battleType,
      isAttackingFortification,
      rounds,
      timeline,
      fortune: { attacker: Math.round(attackerFortune * 100) / 100, defender: Math.round(defenderFortune * 100) / 100 },
      deployedAttackers: attFought.size,
      deployedDefenders: defFought.size,
      reserveAttackers: attAll.length - attFought.size,
      reserveDefenders: defAll.length - defFought.size,
      // Only units that actually stood in the line fought — this is what the caller should award
      // battle XP to (reserves that stepped in as the line thinned count).
      deployedAttackerIds: [...attFought],
      deployedDefenderIds: [...defFought],
      outcome,
      log
    }
  };
};
