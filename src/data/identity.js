// src/data/identity.js
// National Identity — added alongside Government/Policies but deliberately a separate axis (per
// the plan's statecraft section wanting personality beyond government type): three independent
// sliders a nation leans toward over time, shifted a step at a time via the Domestic tab's Shift
// National Identity action (SHIFT_IDENTITY) rather than adopted outright like a government reform.
// Feeds the same bonus hooks government/policy/wonders already use (getNationBonusTotal,
// src/utils/helpers.js), so calcIncome and nextUnrest pick up a nation's identity automatically
// with no separate wiring in either of those functions.
export const IDENTITY_AXES = {
  collectivism: {
    id: 'collectivism',
    positivePole: 'Collectivist',
    negativePole: 'Individualist',
    description: 'Collectivist raises stability; Individualist raises gold income.'
  },
  secularism: {
    id: 'secularism',
    positivePole: 'Religious',
    negativePole: 'Secular',
    description: 'Religious raises stability; Secular raises gold income.'
  },
  globalism: {
    id: 'globalism',
    positivePole: 'Globalist',
    negativePole: 'Isolationist',
    description: 'Globalist raises gold income; Isolationist raises manpower growth.'
  }
};
export const IDENTITY_AXIS_IDS = Object.keys(IDENTITY_AXES);

export const IDENTITY_SHIFT_STEP = 10;
export const IDENTITY_MAX = 100;
export const IDENTITY_MIN = -100;

export const clampIdentity = (value) => Math.max(IDENTITY_MIN, Math.min(IDENTITY_MAX, value));

// The bonus a nation's identity contributes to one getNationBonusTotal hook. Magnitude tuned to sit
// alongside government/policy bonuses of the same kind at full commitment (|value| === IDENTITY_MAX):
// stabilityBonus is 5-12 across GOVERNMENT_TYPES, goldMult is 0.08-0.2, hrMult has no government
// precedent but is kept in the same modest range. Math.max(0, ...) on each pole means only leaning
// that direction contributes to that hook — leaning the other way contributes to a different hook
// entirely (see IDENTITY_AXES' description), not a negative on this one.
export const getIdentityBonus = (identity, hookKey) => {
  const collectivism = identity?.collectivism || 0;
  const secularism = identity?.secularism || 0;
  const globalism = identity?.globalism || 0;
  switch (hookKey) {
    case 'stabilityBonus':
      return (Math.max(0, collectivism) / IDENTITY_MAX) * 10 + (Math.max(0, secularism) / IDENTITY_MAX) * 8;
    case 'goldMult':
      return (Math.max(0, -collectivism) / IDENTITY_MAX) * 0.12
        + (Math.max(0, -secularism) / IDENTITY_MAX) * 0.1
        + (Math.max(0, globalism) / IDENTITY_MAX) * 0.1;
    case 'hrMult':
      return (Math.max(0, -globalism) / IDENTITY_MAX) * 0.15;
    default:
      return 0;
  }
};
