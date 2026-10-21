// src/engine/rulerBias.js
// A ruler's virtues bias the AI (RULER-PLAN 5, differentiation plan U11): a warlike ruler raises
// the war roll, a builder ruler puts the building lines of its branches first.
//   War roll   x RULER_WAR_ROLL[branch] per virtue taken, clamped to [RULER_WAR_ROLL_MIN,
//              RULER_WAR_ROLL_MAX] (aiLogic.js warTemper and shouldDeclareWar)
//   Build      RULER_BUILD_LINES[branch] moves those lines to the front of the doctrine's order,
//              in the order the virtues were taken (aiProduction.js)
// A ruler without virtues changes nothing. Pure.
import { VIRTUES } from '../data/rulerVirtues';

export const RULER_WAR_ROLL = { conqueror: 1.1, diplomat: 0.9 };
export const RULER_WAR_ROLL_MIN = 0.25;
export const RULER_WAR_ROLL_MAX = 2.5;
export const RULER_BUILD_LINES = {
  builder: ['industry', 'logistics'], sage: ['science', 'culture'], conqueror: ['military', 'defense'],
  diplomat: ['economy', 'naval'], prophet: ['culture', 'food']
};

const branchesOf = (nation) => (nation?.ruler?.traits || []).map((id) => VIRTUES[id]?.branch).filter(Boolean);

/** The multiplier a nation's ruler puts on its war roll (1 with no virtues). */
export const rulerWarMult = (nation) => {
  const m = branchesOf(nation).reduce((acc, b) => acc * (RULER_WAR_ROLL[b] ?? 1), 1);
  return Math.max(RULER_WAR_ROLL_MIN, Math.min(RULER_WAR_ROLL_MAX, m));
};

/** `order` (the doctrine's building lines) with the ruler's branches' lines moved to the front. */
export const rulerBuildOrder = (nation, order) => {
  const liked = [];
  branchesOf(nation).forEach((b) => (RULER_BUILD_LINES[b] || []).forEach((line) => { if (!liked.includes(line) && order.includes(line)) liked.push(line); }));
  if (!liked.length) return order;
  return [...liked, ...order.filter((line) => !liked.includes(line))];
};
