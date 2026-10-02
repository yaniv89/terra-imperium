// src/engine/estateLand.js
// Estates on the map (plans/civ-map-rework.md, C4.2). The player's COUNTRYSIDE (every tile their
// cities own, centres aside) is split between the crown and the estates: the crown works
// `nation.crownLand` percent of it directly; the rest is held by the estates in proportion to
// their influence (plus the land their privileges grant, `landShare`). Which tiles each estate
// holds is derived, never stored: the nobility takes farmland first (grassland, plains, farms),
// the clergy hills, forests and river banks, the burghers coasts, rivers and luxuries; ties go
// to the lower tile id. So Seize Land (crownLand +10) hands tiles back to the crown at once and
// "crown land %" is a share of real ground. Under ESTATE_LAND_MIN_COUNTRYSIDE tiles the crown works
// everything (a Dawn chiefdom has no landed estates yet).
//   a worked estate tile   the estate keeps ESTATE_TILE_GOLD_SHARE of its gold (calcIncome)
//   nobility               returns NOBLE_LEVY_PER_TILE manpower a turn per worked tile
//   clergy                 returns CLERGY_CULTURE_PER_TILE culture a turn to the tile's city
//   burghers               return BURGHER_TRADE_GOLD_PER_TILE gold per worked tile while the
//                          nation has a trade pact
// Player only, like the rest of the estate game (estates.js). Pure, memoised per regions object.
import { getTiles } from '../data/geo/tiles';
import { tileFacts, tileYields, RESOURCES_ON_TILES } from '../data/tileYields';
import { ESTATE_IDS, LABOR_ESTATE_ID, getPrivilege, CROWN_LAND_DEFAULT } from '../data/estates';
import { getResearched } from './nationState';

export const ESTATE_LAND_MIN_COUNTRYSIDE = 12; // a one-city Dawn chiefdom has no landed estates yet: the crown works it all
export const ESTATE_TILE_GOLD_SHARE = 0.5;
export const NOBLE_LEVY_PER_TILE = 1;
export const CLERGY_CULTURE_PER_TILE = 0.5;
export const BURGHER_TRADE_GOLD_PER_TILE = 1;
export const ESTATE_COLOUR = { nobility: 'rgba(168,85,247,0.45)', clergy: 'rgba(250,204,21,0.45)', burghers: 'rgba(45,212,191,0.45)', labor: 'rgba(248,113,113,0.45)' };
export const ESTATE_CREST = { nobility: 'N', clergy: 'C', burghers: 'B', labor: 'L' };

/** How much each estate wants a tile: { nobility, clergy, burghers, labor }. */
export const estatePreference = (facts) => ({
  nobility: (['grassland', 'plains'].includes(facts.terrain) ? 2 : 0) + (facts.improvement === 'farm' ? 2 : 0) + (facts.relief === 'flat' || !facts.relief ? 1 : 0),
  clergy: (facts.relief === 'hills' ? 2 : 0) + (facts.feature === 'forest' ? 1 : 0) + (facts.river ? 1 : 0),
  burghers: (facts.coastal ? 2 : 0) + (facts.river ? 1 : 0) + (RESOURCES_ON_TILES[facts.resource]?.kind === 'luxury' ? 1 : 0) + (facts.improvement === 'mine' ? 1 : 0),
  labor: (facts.improvement === 'mine' ? 2 : 0) + (facts.relief === 'hills' ? 1 : 0)
});

/** The share of the countryside an estate's privileges add on top of its influence split. */
export const privilegeLandShare = (estateId, estate) => (estate?.privileges || []).reduce((s, id) => s + (getPrivilege(estateId, id)?.landShare || 0), 0);

const EMPTY = Object.freeze({ byTile: new Map(), byEstate: {}, byCity: {}, countryside: 0, crownTiles: 0, worked: {}, workedByCity: {} });
const cache = new WeakMap(); // state.regions -> { world, byKey: Map key -> value } (a few crown-land or privilege variants per map)

/** The estates' holdings for `nationId` (default the player). */
export const estateHoldings = (state, nationId = state.playerNationId) => {
  const nation = state.nations?.[nationId];
  if (!nation?.estates || !state.regions) return EMPTY;
  const estates = Object.keys(nation.estates).filter((id) => ESTATE_IDS.includes(id) || id === LABOR_ESTATE_ID);
  const key = `${nationId}|${nation.crownLand ?? CROWN_LAND_DEFAULT}|${estates.map((id) => `${id}:${Math.round(nation.estates[id].influence || 0)}:${(nation.estates[id].privileges || []).join(',')}`).join('|')}`;
  let entry = cache.get(state.regions);
  if (!entry || entry.world !== state.world) { entry = { world: state.world, byKey: new Map() }; cache.set(state.regions, entry); }
  if (entry.byKey.has(key)) return entry.byKey.get(key);
  const tiles = getTiles();
  const tileState = state.world?.tileState || {};
  const countryside = []; const cityOf = new Map(); const workedSet = new Set();
  Object.values(state.regions).forEach((c) => {
    if (c.owner !== nationId || c.tile == null) return;
    (c.worked || []).forEach((t) => workedSet.add(t));
    (c.tiles || []).forEach((t) => { if (t !== c.tile && tiles.land[t] === 1) { countryside.push(t); cityOf.set(t, c.id); } });
  });
  countryside.sort((a, b) => a - b);
  if (countryside.length < ESTATE_LAND_MIN_COUNTRYSIDE) {
    const value = { ...EMPTY, countryside: countryside.length, crownTiles: countryside.length, byEstate: {}, worked: {}, byCity: {}, workedByCity: {}, byTile: new Map() };
    entry.byKey.set(key, value);
    return value;
  }
  const crownShare = Math.max(0, Math.min(100, nation.crownLand ?? CROWN_LAND_DEFAULT)) / 100;
  const influence = estates.map((id) => Math.max(0, nation.estates[id].influence || 0));
  const sumInfluence = influence.reduce((s, v) => s + v, 0) || estates.length;
  const quotas = {};
  estates.forEach((id, i) => {
    const split = (1 - crownShare) * ((sumInfluence ? influence[i] : 1) / (sumInfluence || 1));
    quotas[id] = Math.round(countryside.length * Math.min(1, split + privilegeLandShare(id, nation.estates[id])));
  });
  const prefs = new Map(countryside.map((t) => [t, estatePreference(tileFacts(tiles, t, tileState[t]))]));
  const byTile = new Map(); const byEstate = {}; const byCity = {}; const worked = {}; const workedByCity = {};
  estates.forEach((id) => {
    const ranked = countryside.filter((t) => !byTile.has(t)).sort((a, b) => (prefs.get(b)[id] || 0) - (prefs.get(a)[id] || 0) || a - b);
    const take = ranked.slice(0, Math.min(quotas[id], ranked.length));
    byEstate[id] = take; worked[id] = 0;
    take.forEach((t) => {
      byTile.set(t, id);
      const city = cityOf.get(t);
      (byCity[city] ||= {})[id] = (byCity[city][id] || 0) + 1;
      if (workedSet.has(t)) { worked[id] += 1; (workedByCity[city] ||= {})[id] = (workedByCity[city][id] || 0) + 1; }
    });
  });
  const value = { byTile, byEstate, byCity, countryside: countryside.length, crownTiles: countryside.length - byTile.size, worked, workedByCity };
  if (entry.byKey.size >= 8) entry.byKey.clear();
  entry.byKey.set(key, value);
  return value;
};

/** What the estates take and give this turn: { goldToEstates, levies, tradeGold, cultureByCity }. */
export const estateLandEffects = (state, nationId = state.playerNationId) => {
  const h = estateHoldings(state, nationId);
  if (!h.byTile.size) return { goldToEstates: 0, levies: 0, tradeGold: 0, cultureByCity: {} };
  const tiles = getTiles();
  const tileState = state.world?.tileState || {};
  const researched = getResearched(state, nationId);
  const workedTiles = new Set();
  Object.values(state.regions).forEach((c) => { if (c.owner === nationId) (c.worked || []).forEach((t) => workedTiles.add(t)); });
  let goldToEstates = 0;
  h.byTile.forEach((estateId, t) => { if (workedTiles.has(t)) goldToEstates += tileYields(tileFacts(tiles, t, tileState[t]), researched).gold * ESTATE_TILE_GOLD_SHARE; });
  const hasPact = Object.values(state.nations || {}).some((n) => !n.isPlayer && n.hasTradeAgreement && !n.isEliminated);
  const cultureByCity = {};
  Object.entries(h.workedByCity).forEach(([city, counts]) => { if (counts.clergy) cultureByCity[city] = counts.clergy * CLERGY_CULTURE_PER_TILE; });
  return {
    goldToEstates: Math.round(goldToEstates * 10) / 10,
    levies: (h.worked.nobility || 0) * NOBLE_LEVY_PER_TILE,
    tradeGold: hasPact ? (h.worked.burghers || 0) * BURGHER_TRADE_GOLD_PER_TILE : 0,
    cultureByCity
  };
};

/** One line per estate for the estates card. */
export const describeHoldings = (state, nationId = state.playerNationId) => {
  const h = estateHoldings(state, nationId);
  const e = estateLandEffects(state, nationId);
  return Object.keys(h.byEstate).map((id) => {
    const gives = id === 'nobility' ? `${(h.worked[id] || 0) * NOBLE_LEVY_PER_TILE} manpower` : id === 'clergy' ? `${Math.round((h.worked[id] || 0) * CLERGY_CULTURE_PER_TILE * 10) / 10} culture` : id === 'burghers' ? `${e.tradeGold} trade gold` : 'nothing yet';
    return { estateId: id, tiles: h.byEstate[id].length, worked: h.worked[id] || 0, gives };
  });
};
