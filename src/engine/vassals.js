// src/engine/vassals.js
// Liberty desire (plan §M12/§M15) as a reading of the overlord's REAL weakness, not a coin flip on
// who has more troops. Each turn a vassal's liberty desire drifts toward a target built from:
//
//   power ratio   35 x (vassal strength / overlord strength), ratio capped at 2      (0..70)
//   entanglement  +8 per war the overlord is fighting, up to 3 wars                  (0..24)
//   exhaustion    +0.25 x the overlord's war exhaustion                              (0..25)
//   insolvency    +12 while the overlord's treasury is in debt                        (0 or 12)
//   loyalty       -15 baseline (a content, protected vassal stays put)
//
// so an overlord that is overstretched, bled and broke sees its vassals stir even without being
// out-muscled, and one that is strong, at peace and solvent keeps them. It moves at most
// LD_RISE per turn up and LD_FALL down, so it's a trend the player can watch and act on.
//
// At or above LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD an AI vassal may issue its ultimatum: each
// turn, a chance that grows with how far past the threshold it is and how entangled the overlord
// is, it declares an independence war (the same war the player's own DECLARE_INDEPENDENCE starts).
import { LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD } from '../data/actionCosts';

export const LD_RISE = 3;
export const LD_FALL = 2;
export const LD_POWER_WEIGHT = 35;
export const LD_WAR_WEIGHT = 8;
export const LD_EXHAUSTION_WEIGHT = 0.25;
export const LD_INSOLVENCY = 12;
export const LD_LOYALTY = 15;
export const INDEPENDENCE_BASE_CHANCE = 0.04;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const activeWars = (wars, id) => (wars || []).filter((w) => w.active && (w.aggressor === id || w.enemy === id)).length;

// A nation's strength for this comparison: its abstract army plus what it fields for real.
export const vassalPower = (nation, fielded = 0) => Math.max(0, (nation?.militaryStrength || 0) + fielded);

export const libertyDesireTarget = ({ vassalStrength, overlordStrength, overlordWars = 0, overlordExhaustion = 0, overlordInDebt = false }) => {
  const ratio = clamp(vassalStrength / Math.max(1, overlordStrength), 0, 2);
  const raw = LD_POWER_WEIGHT * ratio
    + LD_WAR_WEIGHT * clamp(overlordWars, 0, 3)
    + LD_EXHAUSTION_WEIGHT * clamp(overlordExhaustion, 0, 100)
    + (overlordInDebt ? LD_INSOLVENCY : 0)
    - LD_LOYALTY;
  return clamp(Math.round(raw), 0, 100);
};

export const nextLibertyDesire = (current, target) => {
  const cur = current || 0;
  if (target > cur) return Math.min(target, cur + LD_RISE);
  if (target < cur) return Math.max(target, cur - LD_FALL);
  return cur;
};

// Chance this turn that an AI vassal at `libertyDesire` declares independence.
export const independenceChance = (libertyDesire, overlordWars = 0) => {
  if ((libertyDesire || 0) < LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD) return 0;
  const past = (libertyDesire - LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD) / (100 - LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD);
  return clamp(INDEPENDENCE_BASE_CHANCE * (1 + 3 * past) * (1 + 0.5 * clamp(overlordWars, 0, 3)), 0, 0.5);
};

// The inputs for one vassal, read from the turn's state.
export const libertyInputs = (nations, wars, vassalId, fieldedOf, isInDebt) => {
  const vassal = nations[vassalId]; const overlordId = vassal?.vassalOf; const overlord = nations[overlordId];
  return {
    vassalStrength: vassalPower(vassal, fieldedOf(vassalId)),
    overlordStrength: vassalPower(overlord, fieldedOf(overlordId)),
    overlordWars: activeWars(wars, overlordId),
    overlordExhaustion: overlord?.warExhaustion || 0,
    overlordInDebt: isInDebt(overlordId)
  };
};
