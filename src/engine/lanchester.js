// src/engine/lanchester.js
// A closed-form battle estimate for AI decisions (plans/math-ideas.md 2.1; plans/math/ai.md).
// The real auto-resolve (battle.js) deals damage in proportion to each side's standing strength,
// which is Lanchester's square law: a side's fighting power goes as effectiveness x numbers².
//   effA   = unit matchups (counters, siege vs walls) x terrain x walls x age x battle type
//   effB   = unit matchups x age
//   power  = (effA x NA²) / (effB x NB²)                  the square law's power ratio
//   ratio  = LANCHESTER_EDGE x power^SHARPNESS            the odds of an attacker win
//   pWin   = ratio / (1 + ratio)                          a logistic in ln(power)
//   lossA  = LOSS_BASE / (1 + power^LOSS_EXP), lossB = LOSS_BASE x power^LOSS_EXP / (1 + power^LOSS_EXP)
// SHARPNESS, LANCHESTER_EDGE and the loss constants are fitted against the real resolver over
// thousands of seeded battles (lanchester.calibration.test.js; CALIBRATE=1 refits and prints the
// error table). A free fit of separate exponents on effectiveness and numbers lands on 1 : 2, the
// square law, so the model keeps that shape. The exponents are quarters so powers are built from
// sqrt and products only: sqrt is exactly rounded on every device, pow with a fractional exponent
// is not (BRIEF.md).
// This is the AI's estimate, never the combat rule: battles are still fought by battle.js.
// Pure and cheap (O(units of both sides) for the matchup), no randomness.
import { getCounterMultiplier, getSiegeMultiplier, getRosterCombatMultiplier } from '../data/unitClasses';
import { getTerrainCombatModifier } from '../data/terrain';
import { autoAttackerMult } from '../battle/setup/battleType';

// Fitted by lanchester.calibration.test.js (CALIBRATE=1); see plans/math/ai.md for the error table.
export const SHARPNESS = 4.5; // battle fortune (±30%) and the morale snowball make battles far more decisive than a coin
export const LANCHESTER_EDGE = 0.94; // the defender's edge: an undecided battle counts as the defender holding
export const LOSS_BASE = 0.72;
export const LOSS_EXP = 1.25;

/** x^q for q a multiple of 0.25 (|q| <= 8), from products and square roots only (deterministic). */
export const powQuarter = (x, q) => {
  if (!(x > 0)) return 0;
  const quarters = Math.round(Math.abs(q) * 4);
  const whole = quarters >> 2; const rest = quarters & 3;
  let out = 1;
  for (let i = 0; i < whole; i++) out *= x;
  if (rest & 2) out *= Math.sqrt(x);
  if (rest & 1) out *= Math.sqrt(Math.sqrt(x));
  return q < 0 ? 1 / out : out;
};

const sumStrength = (units) => {
  let s = 0;
  for (const u of units) s += Math.max(0, u.strength || 0);
  return s;
};

// The strength-weighted damage multiplier `from` deals to `to` (counters, and siege engines'
// context: x3 against walls, x0.5 in the open). 1 = an even matchup.
export const matchupMult = (from, to, attackingFortification = false) => {
  const a = sumStrength(from); const b = sumStrength(to);
  if (!a || !b) return 1;
  let acc = 0;
  for (const u of from) {
    const su = Math.max(0, u.strength || 0);
    if (!su) continue;
    const context = u.classId === 'siege' ? getSiegeMultiplier(attackingFortification) : 1;
    let vs = 0;
    for (const d of to) vs += Math.max(0, d.strength || 0) * getCounterMultiplier(u.classId, d.classId);
    acc += su * context * (vs / b);
  }
  return acc / a;
};

/** The two sides' effectiveness (per point of strength) from resolveBattle's own arguments. */
export const battleEffectiveness = ({
  attackerUnits, defenderUnits, terrain = 'plains', isAttackingFortification = false,
  attackerAgeId = 'bronze', defenderAgeId = 'bronze', defenderDamageReductionMultiplier = 1,
  attackerPenaltyMultiplier = 1, battleType = 'field'
}) => ({
  att: matchupMult(attackerUnits, defenderUnits, isAttackingFortification)
    * getTerrainCombatModifier(terrain).attackerMult * defenderDamageReductionMultiplier
    * getRosterCombatMultiplier(attackerAgeId, defenderAgeId) * autoAttackerMult(battleType) * attackerPenaltyMultiplier,
  def: matchupMult(defenderUnits, attackerUnits, false) * getRosterCombatMultiplier(defenderAgeId, attackerAgeId)
});

/** The square law's power ratio (effA x NA²) / (effB x NB²). */
export const lanchesterPower = (attStrength, defStrength, attEff = 1, defEff = 1) => {
  if (!(attStrength > 0)) return 0;
  if (!(defStrength > 0)) return Infinity;
  const n = attStrength / defStrength;
  return (attEff / Math.max(1e-6, defEff)) * n * n;
};

/** pWin and expected loss shares from a power ratio. */
export const oddsFromPower = (power, constants = {}) => {
  const { sharpness = SHARPNESS, edge = LANCHESTER_EDGE, lossBase = LOSS_BASE, lossExp = LOSS_EXP } = constants;
  if (power === Infinity) return { pWin: 1, attackerLossShare: 0, defenderLossShare: 0, power };
  if (!(power > 0)) return { pWin: 0, attackerLossShare: lossBase, defenderLossShare: 0, power: 0 };
  const ratio = edge * powQuarter(power, sharpness);
  const r = powQuarter(power, lossExp);
  return { pWin: ratio / (1 + ratio), attackerLossShare: lossBase / (1 + r), defenderLossShare: lossBase * r / (1 + r), power };
};

/**
 * The estimate for one battle from resolveBattle's arguments (attackerUnits, defenderUnits,
 * terrain, isAttackingFortification, ages, walls, penalty, battleType): { pWin, attackerLossShare,
 * defenderLossShare, power, attackerStrength, defenderStrength, attackerEff, defenderEff }.
 */
export const estimateBattle = (args, constants) => {
  const attackerStrength = sumStrength(args.attackerUnits || []);
  const defenderStrength = sumStrength(args.defenderUnits || []);
  const eff = battleEffectiveness({ ...args, attackerUnits: args.attackerUnits || [], defenderUnits: args.defenderUnits || [] });
  const power = lanchesterPower(attackerStrength, defenderStrength, eff.att, eff.def);
  return { ...oddsFromPower(power, constants), attackerStrength, defenderStrength, attackerEff: eff.att, defenderEff: eff.def };
};

/** pWin for two plain strengths with no context (a whole-army comparison, an out-of-sight war). */
export const strengthOdds = (attStrength, defStrength, attEff = 1, defEff = 1) => oddsFromPower(lanchesterPower(attStrength, defStrength, attEff, defEff));
