// src/engine/pacts.js
// Defensive leagues against aggressive expanders (plan: threat & coalition balances). Aggressive
// Expansion (expansion.js) is each nation's grudge against a conqueror: nation.ae[X]. Once at least
// PACT_MIN_MEMBERS nations each hold PACT_FORM_AE or more against the same X, they bind themselves
// in a defensive pact against X (nation.defensivePact = { against: X, since }). A member leaves when
// its grudge fades below PACT_KEEP_AE, and a pact with fewer than PACT_MIN_MEMBERS left dissolves.
// When X declares war on any member, every other member is called to arms and declares on X too
// (diplomacy.js declareWar). X can be the player: over-expansion now has a price that arrives all
// at once.
//
// AI nations only: the player chooses their own alliances. A vassal answers to its overlord and a
// nation already fighting the maximum number of wars sits a call out (checked at call time).
import { isIndependentNation } from '../data/independents';

export const PACT_FORM_AE = 40;
export const PACT_KEEP_AE = 15;
export const PACT_MIN_MEMBERS = 2;

// Independents join no pacts (plans/independent-cities.md 3.2), and nobody forms a league against one.
const eligible = (id, n, playerNationId) => n && id !== playerNationId && !n.vassalOf && !n.eliminated && !isIndependentNation(n);

// One pass per turn. Returns { nations, logs } (same nations reference when nothing changed).
export const updateDefensivePacts = (nations, { playerNationId, turnNumber } = {}) => {
  let next = nations;
  const set = (id, pact) => { next = next === nations ? { ...nations } : next; next[id] = { ...next[id], defensivePact: pact }; };
  const logs = [];

  // 1. Members whose grudge has faded leave.
  Object.entries(nations).forEach(([id, n]) => {
    const p = n.defensivePact;
    if (!p) return;
    if (!nations[p.against] || (n.ae?.[p.against] || 0) < PACT_KEEP_AE) set(id, null);
  });

  // 2. Who fears whom: the strongest grudge each eligible nation holds, if it's pact-worthy.
  const fearers = {};
  Object.entries(next).forEach(([id, n]) => {
    if (!eligible(id, n, playerNationId) || n.defensivePact) return;
    let worst = null; let worstAe = PACT_FORM_AE - 1;
    Object.entries(n.ae || {}).forEach(([x, v]) => { if (v > worstAe && next[x] && x !== id && !isIndependentNation(next[x])) { worst = x; worstAe = v; } });
    if (worst) (fearers[worst] ||= []).push(id);
  });

  // 3. Existing pacts against X take in newly afraid nations; enough of them form a new one.
  Object.keys(fearers).sort().forEach((x) => {
    const existing = Object.entries(next).filter(([, n]) => n.defensivePact?.against === x).map(([id]) => id);
    const joining = fearers[x].sort();
    if (existing.length + joining.length < PACT_MIN_MEMBERS) return;
    const since = existing.length ? next[existing[0]].defensivePact.since : turnNumber;
    joining.forEach((id) => set(id, { against: x, since }));
    if (!existing.length) {
      const names = joining.map((id) => next[id]?.name || id);
      logs.push({
        message: x === playerNationId
          ? `Alarmed by your conquests, ${names.join(', ')} form a defensive league against you: attack one and the others will answer.`
          : `${names.join(', ')} form a defensive league against ${next[x]?.name || x}.`,
        type: 'diplomacy'
      });
    }
  });

  // 4. A pact left with a single member dissolves.
  const counts = {};
  Object.values(next).forEach((n) => { if (n.defensivePact) counts[n.defensivePact.against] = (counts[n.defensivePact.against] || 0) + 1; });
  Object.entries(next).forEach(([id, n]) => { if (n.defensivePact && counts[n.defensivePact.against] < PACT_MIN_MEMBERS) set(id, null); });

  return { nations: next, logs };
};

// Members of a pact against `aggressorId` who would answer a call to arms for `targetId`.
export const pactAllies = (nations, targetId, aggressorId) => {
  const target = nations[targetId];
  if (target?.defensivePact?.against !== aggressorId) return [];
  return Object.keys(nations).filter((id) => id !== targetId && id !== aggressorId && nations[id].defensivePact?.against === aggressorId).sort();
};
