// src/data/taxRates.js
// Set Tax Rate (plan §5): "empire-wide slider: more gold <-> more unrest". Implemented as three
// discrete levels rather than a continuous slider — the same shape every other empire-wide choice
// in this game already takes (government, doctrine, difficulty), so the UI and save format don't
// need a one-off continuous-value case just for this. goldMult folds into calcIncome the same way
// government/policy/wonder goldMult bonuses do; unrestDeltaPerTurn is a flat addition applied in
// resolveTurn.js's unrest drift, on top of (not replacing) the existing control%-based drift.
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
    description: '+25% Gold income, +2 unrest/turn empire-wide.',
    goldMult: 0.25,
    unrestDeltaPerTurn: 2
  }
};

export const TAX_RATE_IDS = Object.keys(TAX_RATES);

export const DEFAULT_TAX_RATE = 'normal';
