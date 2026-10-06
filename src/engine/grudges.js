// src/engine/grudges.js
// An independent's grudges (plans/independent-cities.md 4.5, phase W2): what it holds against each
// nation, 0..GRUDGE_MAX, in `nation.indep.grudges[otherId]`. It rises when a nation kills its units
// or pillages its land (+GRUDGE_ATTACKED), takes the city of its kin (an independent of the same
// art theme, +GRUDGE_KIN_CITY) or refuses its tribute (+GRUDGE_REFUSED), and falls GRUDGE_DECAY a
// turn (raids.js decays it). A grudge raises its raid score and chance against that nation
// (score x (1 + grudge / 50), chance x (1 + grudge / 100)), wakes a Fortress (revenge raids from
// FORTRESS_REVENGE_GRUDGE), drives tribute demands and closes its mercenary market to the nation.
// Pure: every helper returns new records and never mutates its inputs.
import { PEOPLES } from '../data/peoples';
import { isIndependentNation, GRUDGE_MAX, GRUDGE_DECAY, GRUDGE_KIN_CITY } from '../data/independents';

/** The grudge `indep` (a nation record) holds against `otherId`. */
export const grudgeOf = (indep, otherId) => indep?.indep?.grudges?.[otherId] || 0;

/** `indep` with `amount` more grudge against `otherId` (clamped). The same record when nothing changes. */
export const withGrudge = (indep, otherId, amount) => {
  if (!isIndependentNation(indep) || !otherId || otherId === indep.id || !amount) return indep;
  const cur = grudgeOf(indep, otherId);
  const next = Math.max(0, Math.min(GRUDGE_MAX, cur + amount));
  if (next === cur) return indep;
  const grudges = { ...(indep.indep.grudges || {}) };
  if (next > 0) grudges[otherId] = next; else delete grudges[otherId];
  return { ...indep, indep: { ...indep.indep, grudges } };
};

/** A nations map where `indepId` holds `amount` more against `otherId` (the same map when not an independent). */
export const addGrudge = (nations, indepId, otherId, amount) => {
  const n = nations?.[indepId];
  const next = withGrudge(n, otherId, amount);
  return next === n ? nations : { ...nations, [indepId]: next };
};

/** One turn of decay for one independent record (the same record when it holds no grudge). */
export const decayGrudges = (indep, by = GRUDGE_DECAY) => {
  const g = indep?.indep?.grudges;
  if (!g || !Object.keys(g).length) return indep;
  const grudges = {};
  Object.keys(g).forEach((k) => { const v = g[k] - by; if (v > 0) grudges[k] = v; });
  return { ...indep, indep: { ...indep.indep, grudges } };
};

/** The art theme of an independent's people (its kin share it), or null (a free city has none). */
export const kinOf = (nation) => (nation?.people ? PEOPLES[nation.people]?.theme || null : null);

/** A nations map after `conquerorId` took the city of independent `loserId`: every other living
 * independent of the same theme holds GRUDGE_KIN_CITY more against the conqueror. */
export const grudgeForKinCity = (nations, loserId, conquerorId) => {
  const theme = kinOf(nations?.[loserId]);
  if (!theme || !isIndependentNation(nations[loserId])) return nations;
  let out = nations;
  Object.keys(nations).forEach((id) => {
    const n = nations[id];
    if (id === loserId || id === conquerorId || n.isEliminated || !isIndependentNation(n) || kinOf(n) !== theme) return;
    out = addGrudge(out, id, conquerorId, GRUDGE_KIN_CITY);
  });
  return out;
};
