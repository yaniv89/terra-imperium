// src/engine/nationalPower.js
// Plan §M4: national stability, legitimacy/tradition/devotion, prestige, and overextension.
// Several of the plan's own listed sources/effects for these four numbers name systems that don't
// exist yet in this codebase — estates and their loyalty (M9), buildings/Civic Center governing
// capacity (M6), war score (M13), great projects (M10), capital occupation/loss (M15), bankruptcy
// (M11) — this ships the honest subset that's mechanically real today, and adapts a couple of the
// plan's own named triggers onto what M3 already built (a heirless/low-claim succession IS a real,
// working trigger for -1 stability, so that one ships). M8's government reform tiers now DO
// contribute to governing capacity (`reformCapacityBonus` below), supplied by the caller the same
// way `getIncreaseStabilityCost`'s `stabilityCostMult` is. Every trim is called out inline with
// `// adapted:` or `// deferred:`.
import { getSuccessionStyle } from './succession';
import { TECH_TREE } from '../data/techTree';
import { TechCategories } from '../data/types';
import { TAX_RATES } from '../data/taxRates';
import { getOwnedRegionIds } from '../data/regions';

export const STABILITY_MIN = -3;
export const STABILITY_MAX = 3;
export const STABILITY_DECAY_TURNS = 10; // plan: "drifts toward 0 by 1 every 10 turns when no source is active"
export const LEGITIMACY_MIN = 0;
export const LEGITIMACY_MAX = 100;
export const PRESTIGE_MIN = -100;
export const PRESTIGE_MAX = 100;
export const PRESTIGE_DECAY_RATE = 0.05; // 5%/turn toward 0

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const clampStability = (value) => clamp(value, STABILITY_MIN, STABILITY_MAX);
export const clampLegitimacy = (value) => clamp(value, LEGITIMACY_MIN, LEGITIMACY_MAX);
export const clampPrestige = (value) => clamp(value, PRESTIGE_MIN, PRESTIGE_MAX);

// Base 10 (plan) + startRegionCount (relative to the nation's OWN starting size, so a 50-region
// nation and a 1-region nation are equally "at capacity" at the same overextension% — the plan's
// own point in calling this out) + Governance techs + `reformCapacityBonus` (plan §M8.1: Imperial
// Bureaucracy/Dutch-style Federal Republic reforms) — caller-supplied the same way
// getIncreaseStabilityCost's `stabilityCostMult` is, so this file never has to import the modifier
// engine (see that function's own header comment on the circular-import reasoning, which applies
// here too). Buildings (Civic Center) are M6 work not yet wired into this specific number.
export const getGoverningCapacity = (state, nationId, reformCapacityBonus = 0) => {
  const nation = state.nations?.[nationId];
  const base = (nation?.startRegionCount || 0) + 10 + reformCapacityBonus;
  if (nationId !== state.playerNationId) return base;
  const governanceTechs = Object.values(state.techTree || {})
    .filter((t) => t.researched && TECH_TREE[t.id]?.category === TechCategories.GOVERNANCE)
    .length;
  return base + governanceTechs;
};

// Plan §M16: routed through src/data/regions.js's own memoized owned-region index (built once per
// `state.regions` object reference, O(1) per nation after that) rather than a fresh O(4,482) scan —
// this was a real, measured cost once M16's AI-economy phase became the first production caller to
// invoke getModifier (and therefore this, via contextSources' overextension term) for every one of
// 240 AI nations every turn; a raw `Object.values(state.regions).reduce(...)` here made that
// O(nations x regions) instead of O(regions + nations), the exact perf trap this file's own sibling
// comments elsewhere already warn about avoiding.
export const getOwnedRegionCount = (state, nationId) => getOwnedRegionIds(state.regions || {}, nationId).length;

// Vassals and occupied-but-not-owned regions are excluded per the plan, but neither concept exists
// yet (M12/M13) — every currently-owned region already counts toward the numerator, which is the
// correct behavior once those land too (an occupied region isn't `owner`-flagged to the occupier).
export const getOverextension = (state, nationId, reformCapacityBonus = 0) => {
  const capacity = getGoverningCapacity(state, nationId, reformCapacityBonus);
  if (capacity <= 0) return 0;
  const owned = getOwnedRegionCount(state, nationId);
  return Math.max(0, ((owned - capacity) / capacity) * 100);
};

// Plan's own formula for this one action, verbatim: 100 ADM x (1 + overextension%) x (1 + 0.1 x
// (stability + 3)) x (1 + national.stabilityCost). The plan's broader "+overextension%/2 on ADM
// and DIP costs" for EVERY action is deferred: every other action's cost is still a flat table
// read by canAfford/applyCosts (src/data/actionCosts.js), with no per-action modifier-aware cost
// pipeline yet — retrofitting one just for this single multiplier would be a bigger, separate
// refactor, not an M4-sized change. `stabilityCostMult` is caller-supplied (via getModifier)
// rather than looked up here, so this file (and nationalPower.js in general) never has to import
// the modifier engine — src/engine/modifiers/sources.js already imports FROM this file
// (getOverextension/getRulerBestPool), and importing back would be a real circular dependency.
export const getIncreaseStabilityCost = (state, nationId, stabilityCostMult = 0) => {
  const overextension = getOverextension(state, nationId);
  const stability = state.nations?.[nationId]?.stability || 0;
  return Math.round(100 * (1 + overextension / 100) * (1 + 0.1 * (stability + 3)) * (1 + stabilityCostMult));
};

// The pool a ruler is best at (adm > dip > mil on ties) — used by the legitimacy-below-50 penalty,
// which the plan aims at "the ruler's best pool" rather than a fixed one.
export const getRulerBestPool = (ruler) => {
  if (!ruler) return null;
  const pools = ['adm', 'dip', 'mil'];
  return pools.reduce((best, pool) => (ruler[pool] > ruler[best] ? pool : best), 'adm');
};

// Runs once per nation per turn (resolveTurn.js), mirroring succession.js's processSuccession
// shape: pure, no state dependency beyond what's passed in, caller writes the result back.
export const processNationalPowerTurn = (nation) => {
  let stability = nation.stability || 0;
  let stabilityDecayProgress = nation.stabilityDecayProgress || 0;
  if (stability !== 0) {
    stabilityDecayProgress += 1;
    if (stabilityDecayProgress >= STABILITY_DECAY_TURNS) {
      stability += stability > 0 ? -1 : 1;
      stabilityDecayProgress = 0;
    }
  } else {
    stabilityDecayProgress = 0;
  }

  // Plan §M11: Extortionate taxes cost "-1 stability every 10 turns while active" — the same
  // progress-counter shape as stability's own drift-to-0 above, but keyed off tax rate instead of
  // the stability value itself, and reset whenever the nation isn't on that tier.
  let extortionateTaxProgress = nation.extortionateTaxProgress || 0;
  const extortionatePenaltyTurns = TAX_RATES[nation.taxRate]?.extortionateStabilityPenaltyTurns;
  if (extortionatePenaltyTurns) {
    extortionateTaxProgress += 1;
    if (extortionateTaxProgress >= extortionatePenaltyTurns) {
      stability = clampStability(stability - 1);
      extortionateTaxProgress = 0;
    }
  } else {
    extortionateTaxProgress = 0;
  }

  // Legitimacy/tradition/devotion (plan groups all three government-flavored labels into the one
  // resource; the UI can relabel by government style without needing three separate fields).
  // Tribal has no legitimacy system yet — the plan's replacement (Cohesion, raised by raiding) is
  // M8 work, so a tribal nation's legitimacy is simply left untouched here rather than faked.
  let legitimacy = nation.legitimacy ?? 50;
  const style = getSuccessionStyle(nation.government);
  if (style !== 'tribal') {
    const rulerAdm = nation.ruler?.adm || 0;
    const baseGain = style === 'hereditary' ? 0.5 * (rulerAdm / 6)
      : style === 'theocratic' ? 0.5 * (rulerAdm / 6) // devotion: adapted to ruler ADM, no clergy loyalty system (M9) yet to drive it instead
      : style === 'elective' ? 0.5 // republican tradition
      : 0.3; // autocratic: adapted, no clergy/devotion system (M9) to drive this instead
    const prestigeGain = (nation.prestige || 0) / 500; // plan: "prestige ... legitimacy gain"
    legitimacy = clampLegitimacy(legitimacy + baseGain + prestigeGain);
  }

  // Math.trunc, not Math.round: rounding to the NEAREST integer has a fixed point below 10 in
  // magnitude (e.g. 9 -> round(8.55) -> 9, stuck forever) since a half rounds away from zero as
  // often as toward it. Truncating toward zero strictly shrinks |prestige| every turn until it
  // actually reaches 0, which "decays toward 0" requires.
  const prestige = clampPrestige(Math.trunc((nation.prestige || 0) * (1 - PRESTIGE_DECAY_RATE)));

  return { stability, stabilityDecayProgress, extortionateTaxProgress, legitimacy, prestige };
};
