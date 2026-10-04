// src/engine/boosts.js
// Research boosts from the map (plans/civ-map-rework.md, C3.3; workstream 10). The facts of a
// nation (src/data/boosts.js) are read once per nation and turn from its cities and tiles; every
// unresearched tech whose boost is met and not yet taken gets BOOST_SHARE of its cost as progress,
// once (`research.boosted[techId]`). Works for the player and for AI nations alike, so the AI
// that settles a river or mines iron learns the same way. Pure.
import { getTiles } from '../data/geo/tiles';
import { TECH_TREE } from '../data/techTree';
import { BOOSTS, BOOST_SHARE } from '../data/boosts';
import { getResearchCost } from './research';

// Cities by owner and the nations besieging a city, once per regions map: a scan of every city
// per nation was 240 x 700 reads a turn.
const byOwnerCache = new WeakMap(); // regions -> { byOwner: Map(nationId -> [city]), besiegers: Set }
const citiesIndex = (regions) => {
  let hit = byOwnerCache.get(regions);
  if (hit) return hit;
  hit = { byOwner: new Map(), besiegers: new Set() };
  Object.values(regions).forEach((c) => {
    if (c.siege?.by) hit.besiegers.add(c.siege.by);
    if (c.tile == null) return;
    let list = hit.byOwner.get(c.owner);
    if (!list) { list = []; hit.byOwner.set(c.owner, list); }
    list.push(c);
  });
  byOwnerCache.set(regions, hit);
  return hit;
};

/** The map facts of a nation, as the boost table reads them. */
export const nationFacts = (state, nationId) => {
  const tiles = getTiles();
  const tileState = state.world?.tileState || {};
  const index = citiesIndex(state.regions || {});
  const cities = index.byOwner.get(nationId) || [];
  const f = { cities: cities.length, maxSize: 0, resources: new Set(), river: false, coastal: false, forest: false, hills: false, hillsResource: false, roads: 0, riverTiles: 0, harbour: false, scienceBuildings: 0, scienceBuilding: false, trade: false, atWar: false, sieged: false, wonders: 0 };
  const n = state.nations?.[nationId];
  f.trade = nationId === state.playerNationId ? Object.values(state.nations || {}).some((o) => o.hasTradeAgreement) : !!n?.hasTradeAgreement;
  f.atWar = !!n?.isAtWar || (state.wars || []).some((w) => w.active && (w.aggressor === nationId || w.enemy === nationId));
  cities.forEach((c) => {
    f.maxSize = Math.max(f.maxSize, c.size || 1);
    if (tiles.rivers[c.tile]) f.river = true;
    if (tiles.coastal[c.tile] === 1) f.coastal = true;
    if ((c.buildings?.categories?.naval ?? -1) >= 0) f.harbour = true;
    if ((c.buildings?.categories?.science ?? -1) >= 0) { f.scienceBuildings += 1; f.scienceBuilding = true; }
    (c.tiles || [c.tile]).forEach((t) => {
      const res = tiles.resourceOf?.(t);
      if (res) f.resources.add(res);
      const feature = tiles.featureOf(t); const relief = tiles.reliefOf(t);
      if (feature === 'forest' || feature === 'jungle') f.forest = true;
      if (relief === 'hills') { f.hills = true; if (res === 'stone' || res === 'copper' || res === 'iron') f.hillsResource = true; }
      if (tiles.rivers[t]) f.riverTiles += 1;
      if (tileState[t]?.road && !tileState[t]?.pillaged) f.roads += 1;
    });
  });
  f.sieged = index.besiegers.has(nationId);
  return f;
};

/** The boost of a tech for a nation: { label, met, taken } or null. */
export const boostOf = (state, nationId, techId, facts = null, research = null) => {
  const b = BOOSTS[techId];
  if (!b) return null;
  const f = facts || nationFacts(state, nationId);
  const r = research || (nationId === state.playerNationId ? state.research : state.nations?.[nationId]?.research) || {};
  return { label: b.label, met: !!b.check(f), taken: !!r.boosted?.[techId] };
};

/**
 * Applies every newly met boost of a nation to its research record: returns { research, applied }
 * with `applied` the tech ids boosted this call (empty when nothing changed, research unchanged).
 */
export const applyBoosts = (state, nationId, research, researched) => {
  const facts = nationFacts(state, nationId);
  let next = research; const applied = [];
  Object.keys(BOOSTS).forEach((techId) => {
    if (!TECH_TREE[techId] || researched.has(techId) || research.boosted?.[techId]) return;
    if (!BOOSTS[techId].check(facts)) return;
    const cost = getResearchCost(state, nationId, techId);
    if (next === research) next = { ...research, progress: { ...(research.progress || {}) }, boosted: { ...(research.boosted || {}) } };
    next.progress[techId] = Math.min(cost, (next.progress[techId] || 0) + Math.round(cost * BOOST_SHARE));
    next.boosted[techId] = true;
    applied.push(techId);
  });
  return { research: next, applied };
};
