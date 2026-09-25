// src/data/identity.js
// National Identity (plan §M8.3): three independent axes a nation leans toward over time, shifted a
// step at a time via the Domestic tab's Shift National Identity action (SHIFT_IDENTITY). Before M8
// these granted flat gold/stability multipliers on the same hooks government/policy/wonders used
// (getNationBonusTotal) — the plan retires that outright ("stop granting flat gold/stability
// multipliers") and replaces it with GATING and DISCOUNTS instead: leaning far enough one way
// unlocks a government type or a law tier, or cuts that law category's enactment cost. The actual
// gates/discounts live where they're consumed — src/data/government.js (Theocracy's religiosity
// gate) and src/data/laws.js (the Secularism law's identity gate, and the collectivism/
// individualism law-cost discounts) — this file only owns the axis definitions and the one shared
// "does this nation lean this way" check every one of those consumers is built from.
export const IDENTITY_AXES = {
  collectivism: {
    id: 'collectivism',
    positivePole: 'Collectivist',
    negativePole: 'Individualist',
    description: 'Collectivist discounts Conscription/Land law changes; Individualist discounts Taxation/Trade law changes.'
  },
  secularism: {
    id: 'secularism',
    positivePole: 'Religious',
    negativePole: 'Secular',
    description: 'Religious allows adopting Theocracy and discounts Religion law changes; Secular unlocks the Secularism law.'
  },
  globalism: {
    id: 'globalism',
    positivePole: 'Globalist',
    negativePole: 'Isolationist',
    description: 'Leans the realm toward outward or inward statecraft — the full trade-pact/aggressive-expansion payoff arrives with M12 diplomacy.'
  }
};
export const IDENTITY_AXIS_IDS = Object.keys(IDENTITY_AXES);

export const IDENTITY_SHIFT_STEP = 10;
export const IDENTITY_SHIFT_COOLDOWN_TURNS = 5;
export const IDENTITY_MAX = 100;
export const IDENTITY_MIN = -100;
// How far past 0 an axis has to lean before it gates or discounts anything — the same threshold the
// plan's own examples use ("Religiosity > 40 allows Theocracy").
export const IDENTITY_GATE_THRESHOLD = 40;

export const clampIdentity = (value) => Math.max(IDENTITY_MIN, Math.min(IDENTITY_MAX, value));

// The one check every identity gate/discount in government.js and laws.js is built from: has this
// nation leaned far enough toward an axis's positive or negative pole to unlock/discount something.
export const leansPositive = (identity, axis) => (identity?.[axis] || 0) > IDENTITY_GATE_THRESHOLD;
export const leansNegative = (identity, axis) => (identity?.[axis] || 0) < -IDENTITY_GATE_THRESHOLD;
