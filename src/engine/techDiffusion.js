// src/engine/techDiffusion.js
// Technology spreads by contact (plans/math-ideas.md 6.2, the Bass model's imitation term in the
// form Civilization IV uses for tech cost). A breakthrough is cheaper the larger the share of the
// world you know that already has it; being first in the world is costlier:
//
//   known     nations you border, nations whose capital lies within CONTACT_KM[age] of yours, and
//             your trade partners (a pact with the player, either way round)
//   weight    each known nation's economy (its summed city size, tradeValue.js economySizes),
//             x TRADE_CONTACT_WEIGHT for a trade partner: merchants carry ideas
//   share     weight of the known nations that have the tech / weight of all known nations
//   mult      1 - DIFFUSION_MAX x share; x PIONEER_MULT when no nation in the world has it yet
//
// The multiplier applies to the power and the tech-point cost of a tech. A laggard among
// advanced neighbours catches up up to 30% faster (the same ceiling as the old 6% per bordering
// holder, up to 5), an isolated nation gets little help (Japan before 1853), and one with many
// tiny neighbours no longer gets a big discount from them. The contact radius is in km and grows
// with the age (ships and roads), so a denser grid changes nothing; the cost is O(nations) per
// nation, cached per turn, independent of the number of cells.
import { getBorderingNationIds, getCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { tileKm } from './geoKm';
import { economySizes } from './tradeValue';

export const DIFFUSION_MAX = 0.3;
export const TRADE_CONTACT_WEIGHT = 2;
export const PIONEER_MULT = 1.2;
// How far a capital "knows" other capitals, by calendar age (km).
export const CONTACT_KM = { bronze: 1500, classical: 2500, kingdoms: 4000, gunpowder: 10000, modern: 40000 };

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

// nationId -> Map(knownId -> weight). Cached per (regions, nations, age).
const contactCache = new WeakMap();
const isTradePartner = (state, a, b) => {
  const p = state.playerNationId;
  if (a === p) return !!state.nations?.[b]?.hasTradeAgreement;
  if (b === p) return !!state.nations?.[a]?.hasTradeAgreement;
  return false;
};

/** The nations `nationId` knows, with their weights: Map(id -> weight). */
export const contactsOf = (state, nationId) => {
  const regions = state.regions || {};
  let entry = contactCache.get(regions);
  if (!entry || entry.nations !== state.nations || entry.age !== state.age) {
    entry = { nations: state.nations, age: state.age, byNation: new Map(), capitals: null };
    contactCache.set(regions, entry);
  }
  const hit = entry.byNation.get(nationId);
  if (hit) return hit;
  const tiles = getTiles();
  if (!entry.capitals) {
    entry.capitals = new Map();
    Object.entries(state.nations || {}).forEach(([id, n]) => {
      if (n?.isEliminated) return;
      const t = regions[getCapital(state, id)]?.tile;
      if (t != null) entry.capitals.set(id, t);
    });
  }
  const sizes = economySizes(state);
  const reach = CONTACT_KM[state.age] ?? CONTACT_KM.bronze;
  const known = new Map();
  const add = (id) => {
    if (id === nationId || known.has(id) || !state.nations?.[id] || state.nations[id].isEliminated) return;
    known.set(id, Math.max(1, sizes.get(id) || 0) * (isTradePartner(state, nationId, id) ? TRADE_CONTACT_WEIGHT : 1));
  };
  getBorderingNationIds(regions, nationId).forEach(add);
  const mine = entry.capitals.get(nationId);
  if (mine != null) entry.capitals.forEach((t, id) => { if (id !== nationId && tileKm(tiles, mine, t) <= reach) add(id); });
  Object.keys(state.nations || {}).forEach((id) => { if (isTradePartner(state, nationId, id)) add(id); });
  entry.byNation.set(nationId, known);
  return known;
};

export const getTechDiffusion = (state, nationId, techId) => {
  const holders = holderIndex(state).get(techId);
  if (!holders || holders.size === 0) return { mult: PIONEER_MULT, share: 0, knownWithIt: 0, known: 0, pioneer: true };
  const known = contactsOf(state, nationId);
  let total = 0; let withIt = 0; let knownWithIt = 0;
  known.forEach((w, id) => { total += w; if (holders.has(id)) { withIt += w; knownWithIt += 1; } });
  const share = total > 0 ? withIt / total : 0;
  return { mult: 1 - DIFFUSION_MAX * share, share, knownWithIt, known: known.size, pioneer: false };
};

// Folds diffusion into the (1 + researchCostMult) factor every research-cost formula already uses,
// so callers keep passing a single researchCostMult.
export const withDiffusion = (state, nationId, techId, researchCostMult = 0) =>
  (1 + researchCostMult) * getTechDiffusion(state, nationId, techId).mult - 1;
