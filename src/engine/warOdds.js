// src/engine/warOdds.js
// How an AI nation sizes up a war (plans/math-ideas.md 3.3, the bargaining model of war; see
// plans/math/ai.md). A war is a costly lottery: a side wins with probability p, and both pay to
// fight. So a nation goes to war only when it expects to gain, and settles once a deal is worth
// more to it than fighting on. Wars still happen by mistake, because each side judges p from what
// it can see:
//   perceived army  the other side's land units on tiles the viewer sees (sight.js) count at their
//                   real strength; the rest is a guess, off by up to INTEL_ERROR either way, from a
//                   report that changes every INTEL_PERIOD turns (a hash, no rng). Hidden armies and
//                   stale reports are the believable mistakes (Fearon's information problem).
//   war odds        the Lanchester square law over whole armies (lanchester.js): power = eff x N²
//                   (eff: unit matchups and age), each army split over the wars it already fights,
//                   then ratio = WAR_EDGE x power^WAR_SHARPNESS and p = ratio / (1 + ratio). One
//                   battle is sharp (lanchester.js SHARPNESS 4.5); a war is many battles with
//                   reinforcements, so it is much softer, and the defender fights at home.
//   exposure        the development of a nation's cities that touch the other's land (or that the
//                   other occupies), as a share of its own total, in peace-cost units (0..100):
//                   what it can lose (risk) or take (gain), the same scale peace terms are priced in.
//   EV(war)         DECISIVE x (p x gain - (1 - p) x risk) - WAR_COST: declare only when > 0.
// Pure and deterministic. Cost: O(units + cities of the two nations) per pair, and sight only for
// the nation deciding (visibleTiles is cached per state).
import { estimateBattle, powQuarter } from './lanchester';
import { visibleTiles } from './sight';
import { unitTile } from './armies';
import { hashRoll } from './aftermath';
import { getTotalDev } from './development';
import { getOwnedRegionIds, getNeighborIds } from '../data/regions';
import { getTechAgeId } from './nationState';
import { getEffectiveAgeId } from '../data/ages';

export const INTEL_ERROR = 0.35;
export const INTEL_PERIOD = 10;
export const WAR_SHARPNESS = 1;
export const WAR_EDGE = 0.85;
export const DECISIVE = 0.5; // the share of wars fought to a decision; the rest end white
export const WAR_COST = 4; // the cost of a war in peace-cost units (exhaustion, upkeep, lost trade)
// The abstract garrison (militaryStrength) counts like getEffectiveMilitaryPower's reserve.
export const RESERVE_WEIGHT = 0.1;

const isArmy = (u) => u.domain === 'land' && u.classId !== 'settler' && !u.embarkedOn && (u.strength || 0) > 0;
const countWars = (wars, id) => (wars || []).filter((w) => w.active && (w.aggressor === id || w.enemy === id)).length;

/** The land units of `nationId` as `viewerId` judges them: [{ classId, strength }] (seen ones exact, the rest scaled by the intel error). */
export const perceivedArmy = (state, viewerId, nationId) => {
  const units = Object.values(state.units || {}).filter((u) => u.ownerId === nationId && isArmy(u));
  const reserve = (state.nations?.[nationId]?.militaryStrength || 0) * RESERVE_WEIGHT;
  const out = units.map((u) => ({ classId: u.classId, strength: u.strength }));
  if (reserve > 0) out.push({ classId: 'infantry', strength: reserve });
  if (!viewerId || viewerId === nationId) return out;
  const seen = units.length ? visibleTiles(state, viewerId) : null;
  const report = 1 + INTEL_ERROR * (2 * hashRoll(`${viewerId}|${nationId}|${Math.floor((state.turnNumber || 0) / INTEL_PERIOD)}`) - 1);
  return out.map((u, i) => (i < units.length && seen && seen.has(unitTile(state, units[i])) ? u : { ...u, strength: u.strength * report }));
};

/** An age-and-matchup-aware Lanchester power ratio of `a`'s army against `b`'s, seen by `viewerId`. */
export const armyPower = (state, a, b, viewerId = a) => {
  const armyA = perceivedArmy(state, viewerId, a);
  const armyB = perceivedArmy(state, viewerId, b);
  const ageOf = (id) => getEffectiveAgeId(state.age, getTechAgeId(state, id));
  // Each side fights every war it is in with the same army: split it over its fronts (counting
  // this war when it has not started yet).
  const atWar = (state.wars || []).some((w) => w.active && ((w.aggressor === a && w.enemy === b) || (w.aggressor === b && w.enemy === a)));
  const splitA = 1 / Math.max(1, countWars(state.wars, a) + (atWar ? 0 : 1));
  const splitB = 1 / Math.max(1, countWars(state.wars, b) + (atWar ? 0 : 1));
  const est = estimateBattle({ attackerUnits: armyA.map((u) => ({ ...u, strength: u.strength * splitA })), defenderUnits: armyB.map((u) => ({ ...u, strength: u.strength * splitB })), attackerAgeId: ageOf(a), defenderAgeId: ageOf(b) });
  return est.power;
};

/** p that `a` wins a war against `b`, as `viewerId` sees it (default: `a`). */
export const warOdds = (state, a, b, viewerId = a) => {
  const power = armyPower(state, a, b, viewerId);
  if (power === Infinity) return 1;
  if (!(power > 0)) return 0;
  const ratio = WAR_EDGE * powQuarter(power, WAR_SHARPNESS);
  return ratio / (1 + ratio);
};

/** The development of `nationId`'s cities exposed to `otherId` (touching its land, or held by it), 0..100 of its own total. */
export const exposure = (state, nationId, otherId) => {
  const regions = state.regions || {};
  let total = 0; let exposed = 0;
  getOwnedRegionIds(regions, nationId).forEach((id) => {
    const city = regions[id];
    const dev = getTotalDev(city) || 1;
    total += dev;
    if (city.occupiedBy === otherId || getNeighborIds(id).some((n) => regions[n]?.owner === otherId || regions[n]?.occupiedBy === otherId)) exposed += dev;
  });
  return total > 0 ? Math.min(100, (100 * exposed) / total) : 0;
};

/** What `a` stands to take from `b`: b's exposed development, priced in a's own size (0..100). */
export const prizeOf = (state, a, b) => {
  const regions = state.regions || {};
  let mine = 0; let theirs = 0;
  getOwnedRegionIds(regions, a).forEach((id) => { mine += getTotalDev(regions[id]) || 1; });
  getOwnedRegionIds(regions, b).forEach((id) => {
    if (getNeighborIds(id).some((n) => regions[n]?.owner === a)) theirs += getTotalDev(regions[id]) || 1;
  });
  return mine > 0 ? Math.min(100, (100 * theirs) / mine) : 0;
};

/** The expected value to `a` of a war on `b`, with its terms: { ev, p, gain, risk }. `cost` is the war's price for this nation (WAR_COST scaled by its temper). */
export const warValue = (state, a, b, { cost = WAR_COST } = {}) => {
  const p = warOdds(state, a, b, a);
  const gain = prizeOf(state, a, b);
  const risk = exposure(state, a, b);
  return { ev: DECISIVE * (p * gain - (1 - p) * risk) - cost, p, gain, risk };
};
