// src/engine/legacy.js
// The legacy score (differentiation plan KTD7, R10, R11): what ranks every major once, when the
// one ending signal fires (ending.js). It adds, at each part's age points (src/data/legacy.js):
//   each era goal met     nation.eraGoals[age].met (eraGoals.js scores an age when the nation leaves it, the last one at the ending)
//   each era legacy       nation.eraGoals[age].legacy
//   each ambition done    nation.ambitions.done[], times its own legacy weight (ambitions.js)
// The same rules for the player and every AI major. Pure.
import { legacyPoints } from '../data/legacy';

/** { total, parts }: each part { reason, ageId, ref, points }, reason a key `legacy.<part>`. */
export const legacyScore = (state, nationId) => {
  const n = state.nations?.[nationId];
  const parts = [];
  Object.entries(n?.eraGoals || {}).forEach(([ageId, rec]) => {
    const pts = legacyPoints(ageId);
    (rec.met || []).forEach((goal) => parts.push({ reason: 'legacy.eraGoal', ageId, ref: goal, points: pts.eraGoal }));
    if (rec.legacy) parts.push({ reason: 'legacy.eraLegacy', ageId, ref: ageId, points: pts.eraLegacy });
  });
  (n?.ambitions?.done || []).forEach((a) => parts.push({ reason: 'legacy.ambition', ageId: a.ageId, ref: a.id, points: (a.legacy ?? 1) * legacyPoints(a.ageId).ambition }));
  return { total: parts.reduce((s, p) => s + p.points, 0), parts };
};
