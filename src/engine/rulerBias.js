// src/engine/rulerBias.js
// A ruler's traits bias the AI (plans/civ-map-rework.md, C8): a warlike ruler raises the war
// roll, a builder ruler puts the building lines they care about first. Every AI nation already
// has a real ruler with 0 to 2 traits (rulers.js, traits.js); until now nothing read them.
//   War roll   the chance multiplier is the product of RULER_WAR_ROLL over the ruler's traits,
//              clamped to [RULER_WAR_ROLL_MIN, RULER_WAR_ROLL_MAX] (aiLogic.js shouldDeclareWar).
//   Build      RULER_BUILD_LINES names the building lines a trait moves to the front of the
//              doctrine's order, in trait order (aiProduction.js buildingOrder).
// A ruler without traits changes nothing. Pure.
export const RULER_WAR_ROLL = {
  warrior: 1.5, tyrant: 1.3, strategist: 1.2, cruel: 1.1, paranoid: 1.1, genius: 1.1,
  coward: 0.5, diplomat: 0.7, kind: 0.8, just: 0.9, sickly: 0.8, lazy: 0.8
};
export const RULER_WAR_ROLL_MIN = 0.25;
export const RULER_WAR_ROLL_MAX = 2.5;
export const RULER_BUILD_LINES = {
  builder: ['industry', 'logistics'], architect: ['culture', 'industry'], scholar: ['science'], merchant: ['economy', 'naval'],
  warrior: ['military'], strategist: ['military', 'defense'], tyrant: ['military'], paranoid: ['defense'], just: ['culture'],
  administrator: ['economy', 'logistics'], genius: ['science'], zealot: ['culture'], kind: ['food', 'culture'], diplomat: ['economy']
};

const traitsOf = (nation) => (Array.isArray(nation?.ruler?.traits) ? nation.ruler.traits : []);

/** The multiplier a nation's ruler puts on its war roll (1 with no traits). */
export const rulerWarMult = (nation) => {
  const m = traitsOf(nation).reduce((acc, t) => acc * (RULER_WAR_ROLL[t] ?? 1), 1);
  return Math.max(RULER_WAR_ROLL_MIN, Math.min(RULER_WAR_ROLL_MAX, m));
};

/** `order` (the doctrine's building lines) with the ruler's favourite lines moved to the front. */
export const rulerBuildOrder = (nation, order) => {
  const liked = [];
  traitsOf(nation).forEach((t) => (RULER_BUILD_LINES[t] || []).forEach((line) => { if (!liked.includes(line) && order.includes(line)) liked.push(line); }));
  if (!liked.length) return order;
  return [...liked, ...order.filter((line) => !liked.includes(line))];
};
