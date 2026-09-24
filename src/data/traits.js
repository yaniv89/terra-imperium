// src/data/traits.js
// Plan §M3: ruler traits. Each trait's effect is expressed on the SAME modifier hooks government/
// policies/wonders/identity already use (src/engine/modifiers/registry.js's LEGACY_HOOK) — a
// ruler is just one more static source the modifier engine sums, not a parallel system. The
// plan's own trait table names a few effects nothing in this codebase computes yet (a flat
// techPoints%, a per-trait diplomat count, rebel-strength scaling) — those are honestly adapted
// onto the closest hook that exists today rather than faked; grep TRAITS for `// adapted:` to see
// exactly which ones and why.
export const TRAITS = {
  just: { id: 'just', name: 'Just', description: '+0.5 legitimacy/turn (once M4 exists), −2 unrest', effects: { stabilityBonus: 2 } },
  scholar: { id: 'scholar', name: 'Scholar', description: '+10% Tech Point income', effects: { techPointsMult: 0.1 } }, // adapted: no legitimacy system yet (M4)
  warrior: { id: 'warrior', name: 'Warrior', description: '+1 MIL/turn', effects: { milBonus: 1 } },
  diplomat: { id: 'diplomat', name: 'Diplomat', description: '+1 DIP/turn', effects: { dipBonus: 1 } },
  architect: { id: 'architect', name: 'Architect', description: '+8% Gold income (efficient construction)', effects: { goldMult: 0.08 } }, // adapted: no building-cost system yet (M6)
  merchant: { id: 'merchant', name: 'Merchant', description: '+12% Gold income', effects: { goldMult: 0.12 } },
  administrator: { id: 'administrator', name: 'Administrator', description: '−10% Develop Province cost', effects: { developmentCost: -0.1 } }, // wired for real once M5 added the hook (was admBonus before)
  strategist: { id: 'strategist', name: 'Strategist', description: '+6% HR income', effects: { hrMult: 0.06 } }, // adapted: no generals-as-modifier system yet
  kind: { id: 'kind', name: 'Kind', description: '−3 unrest', effects: { stabilityBonus: 3 } },
  builder: { id: 'builder', name: 'Builder', description: '+6% HR income (faster-growing works crews)', effects: { hrMult: 0.06 } }, // adapted: no construction-time system yet (M6)
  genius: { id: 'genius', name: 'Genius', description: '+1 to every power pool per turn', effects: { admBonus: 1, dipBonus: 1, milBonus: 1 } },

  tyrant: { id: 'tyrant', name: 'Tyrant', description: '+1 MIL/turn, +3 unrest', effects: { milBonus: 1, stabilityBonus: -3 } },
  incompetent: { id: 'incompetent', name: 'Incompetent', description: '−1 to every power pool per turn', effects: { admBonus: -1, dipBonus: -1, milBonus: -1 } },
  coward: { id: 'coward', name: 'Coward', description: '−6% HR income', effects: { hrMult: -0.06 } },
  spendthrift: { id: 'spendthrift', name: 'Spendthrift', description: '−10% Gold income', effects: { goldMult: -0.1 } },
  sickly: { id: 'sickly', name: 'Sickly', description: '−1 to every power pool per turn', effects: { admBonus: -1, dipBonus: -1, milBonus: -1 } }, // adapted: reign-length penalty is M3's own reignLengthTurns, not a modifier
  cruel: { id: 'cruel', name: 'Cruel', description: '+2 unrest', effects: { stabilityBonus: -2 } },
  lazy: { id: 'lazy', name: 'Lazy', description: '−1 ADM/turn', effects: { admBonus: -1 } },
  paranoid: { id: 'paranoid', name: 'Paranoid', description: '−1 DIP/turn', effects: { dipBonus: -1 } },
  zealot: { id: 'zealot', name: 'Zealot', description: '−4% Gold income (isolationist trade policy)', effects: { goldMult: -0.04 } }
};

export const TRAIT_IDS = Object.keys(TRAITS);
export const POSITIVE_TRAIT_IDS = ['just', 'scholar', 'warrior', 'diplomat', 'architect', 'merchant', 'administrator', 'strategist', 'kind', 'builder', 'genius'];
export const NEGATIVE_TRAIT_IDS = ['tyrant', 'incompetent', 'coward', 'spendthrift', 'sickly', 'cruel', 'lazy', 'paranoid', 'zealot'];
