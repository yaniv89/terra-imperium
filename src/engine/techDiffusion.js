// src/engine/techDiffusion.js
// Technology spreads along borders (plan: disruptive technology & diffusion). A breakthrough that
// neighbours already have is cheaper to adopt — their scholars, traders and deserters carry it
// across — while being first in the world to reach one is costlier: nobody to copy, every dead end
// yours to find. The multiplier applies to both the power and the tech-point cost of a tech:
//
//   diffusion  1 - DIFFUSION_PER_NEIGHBOR x (bordering nations that already have it, up to 5)
//   pioneer    x PIONEER_MULT when no nation in the world has it yet
//
// so a laggard in a developed neighbourhood catches up up to 30% faster, and a runaway leader
// pays 20% more to keep pushing the frontier (a brake on snowballing, never a wall).
import { getBorderingNationIds } from '../data/regions';

export const DIFFUSION_PER_NEIGHBOR = 0.06;
export const DIFFUSION_MAX_NEIGHBORS = 5;
export const PIONEER_MULT = 1.2;

// techId -> Set of nations that have it. Cached per (nations, techTree) object pair: the index is
// rebuilt only when either changes identity, so a turn's many lookups share one pass.
const cache = new WeakMap();
const holderIndex = (state) => {
  let byTree = cache.get(state.nations);
  if (!byTree) { byTree = new WeakMap(); cache.set(state.nations, byTree); }
  const treeKey = state.techTree || cache;
  let index = byTree.get(treeKey);
  if (index) return index;
  index = new Map();
  const add = (techId, nationId) => { let s = index.get(techId); if (!s) { s = new Set(); index.set(techId, s); } s.add(nationId); };
  Object.entries(state.nations || {}).forEach(([id, n]) => {
    if (id === state.playerNationId) return;
    (n.tech?.researched || []).forEach((t) => add(t, id));
  });
  Object.entries(state.techTree || {}).forEach(([t, v]) => { if (v?.researched && state.playerNationId) add(t, state.playerNationId); });
  byTree.set(treeKey, index);
  return index;
};

export const getTechDiffusion = (state, nationId, techId) => {
  const holders = holderIndex(state).get(techId);
  if (!holders || holders.size === 0) return { mult: PIONEER_MULT, neighborsWithIt: 0, pioneer: true };
  const neighborsWithIt = getBorderingNationIds(state.regions || {}, nationId).filter((id) => holders.has(id)).length;
  return { mult: 1 - DIFFUSION_PER_NEIGHBOR * Math.min(DIFFUSION_MAX_NEIGHBORS, neighborsWithIt), neighborsWithIt, pioneer: false };
};

// Folds diffusion into the (1 + researchCostMult) factor every research-cost formula already uses,
// so callers keep passing a single researchCostMult.
export const withDiffusion = (state, nationId, techId, researchCostMult = 0) =>
  (1 + researchCostMult) * getTechDiffusion(state, nationId, techId).mult - 1;
