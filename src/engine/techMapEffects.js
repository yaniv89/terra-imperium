// src/engine/techMapEffects.js
// The summed map effects of a nation's researched techs (src/data/techMapEffects.js), memoised on
// the researched list's identity (the player's list is memoised per tech tree, nationState.js;
// an AI nation's is its own array). Pure.
import { TECH_MAP_EFFECTS } from '../data/techMapEffects';
import { getResearched } from './nationState';

const EMPTY = Object.freeze({ sight: 0, navalMoves: 0, deepOcean: 0, borderRing: 0, tileCostMult: 0, granaryKeep: 0, claimRange: 0, governorRings: 0, stackCap: 0, supplyMax: 0, lineRings: 0, hillsCost: 0, mountainCost: 0, roadCost: 0, movePoints: 0 });
const memo = new WeakMap();

/** The summed effects of a researched list: { sight, navalMoves, ... }. */
export const mapEffectsOf = (researched) => {
  if (!researched || !researched.length) return EMPTY;
  const hit = memo.get(researched);
  if (hit) return hit;
  const out = { ...EMPTY };
  researched.forEach((id) => {
    const e = TECH_MAP_EFFECTS[id];
    if (!e) return;
    Object.keys(out).forEach((k) => { if (typeof e[k] === 'number') out[k] += e[k]; });
  });
  memo.set(researched, out);
  return out;
};

/** The map effects of a nation today. */
export const mapEffectsFor = (state, nationId) => mapEffectsOf(getResearched(state, nationId));

/** The research sheet's line for a tech, or null. */
export const mapEffectLabel = (techId) => TECH_MAP_EFFECTS[techId]?.label || null;
