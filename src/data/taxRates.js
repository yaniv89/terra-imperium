// src/data/taxRates.js
// Set Tax Rate (plan §M11): a convex low <-> extortionate curve replacing the old 3-tier, capped
// (+25% max) version. Implemented as discrete levels rather than a continuous slider — the same
// shape every other empire-wide choice in this game already takes (government, doctrine,
// difficulty), so the UI and save format don't need a one-off continuous-value case just for this.
// goldMult folds into calcIncome the same way government/law/great-project goldMult bonuses do;
// unrestDeltaPerTurn is a flat addition applied in resolveTurn.js's unrest drift, on top of (not
// replacing) the existing control%-based drift. extortionateStabilityPenaltyTurns is read by
// nationalPower.js's processNationalPowerTurn, the same "every N turns while a condition holds"
// counter shape STABILITY_DECAY_TURNS already uses for stability's own drift-to-0.
export const TAX_RATES = {
  low: {
    id: 'low',
    name: 'Low Taxes',
    description: '-15% Gold income, -1 unrest/turn empire-wide.',
    goldMult: -0.15,
    unrestDeltaPerTurn: -1
  },
  normal: {
    id: 'normal',
    name: 'Normal Taxes',
    description: 'No change to income or unrest.',
    goldMult: 0,
    unrestDeltaPerTurn: 0
  },
  high: {
    id: 'high',
    name: 'High Taxes',
    description: '+15% Gold income, +1 unrest/turn empire-wide.',
    goldMult: 0.15,
    unrestDeltaPerTurn: 1
  },
  extortionate: {
    id: 'extortionate',
    name: 'Extortionate Taxes',
    description: '+30% Gold income, +3 unrest/turn empire-wide, -1 stability every 10 turns while active.',
    goldMult: 0.30,
    unrestDeltaPerTurn: 3,
    extortionateStabilityPenaltyTurns: 10
  }
};

export const TAX_RATE_IDS = Object.keys(TAX_RATES);

export const DEFAULT_TAX_RATE = 'normal';

// Plan §M11: "cooldown 3 turns" on Set Tax Rate, the same shape laws (M8.2) and identity shifts
// (M8.3) already cooldown-gate — SET_TAX_RATE (gameReducer.js) checks this against
// nation.taxRateChangedTurn before allowing another change.
export const TAX_RATE_CHANGE_COOLDOWN_TURNS = 3;
