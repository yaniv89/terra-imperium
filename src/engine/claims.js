// src/engine/claims.js
// Claims on cities (plans/civ-map-rework.md, C6.1; workstream 7). A claim names a CITY, never a
// nation:
//   Fabricate   a nation may start a claim on a city whose owner's land it does not hold, when
//               its own border lies within CLAIM_RANGE_RINGS of the city; it costs the Fabricate
//               Claim action (gold and DIP, actionCosts.js) and takes CLAIM_FABRICATE_TURNS turns
//               (`nation.claimsInProgress: [{ cityId, done }]`), then sits in `nation.claims`
//               (city ids). The target sees it (opinion.js: -10 a claim).
//   Core        a city is a nation's core when that nation founded it or its people are mostly
//               of that nation's culture (loyalty.js shares): a standing claim that costs
//               nothing and never expires.
//   Casus belli a claim or a core on any city the target owns justifies a war (diplomacy.js
//               hasCasusBelli); the war's goal is that city (buildWarGoal) and the claim stays
//               until the city is taken (advanceClaims drops claims on own or vanished cities).
//   Discounts   taking a claimed city costs CLAIM_AE_MULT of the aggressive expansion, a core
//               CORE_AE_MULT (expansion.js through conquest.js and peace.js); ceding a claimed
//               city at the peace table costs half (peace.js getTermCost).
//   AI          a Tier-1 nation that rolls for war on a target it has no casus belli against
//               fabricates a claim first when it can pay, and declares once the claim is ready
//               (aiLogic.js processAIWarDecisions).
// Pure of randomness.
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { ringsAround } from './world/cities';
import { mapEffectsFor } from './techMapEffects';

export const CLAIM_RANGE_RINGS = 7;
export const CLAIM_FABRICATE_TURNS = 5;
export const CLAIM_AE_MULT = 0.5;
export const CORE_AE_MULT = 0;
export const CORE_CULTURE_SHARE = 0.5;

export const claimsOf = (nation) => nation?.claims || [];
export const claimsInProgressOf = (nation) => nation?.claimsInProgress || [];

const cultureOf = (city) => city.culture || { [city.founderId || city.owner]: 1 };

/** A core: the city's founder, or the nation whose culture most of its people share. */
export const isCore = (city, nationId) => {
  if (!city || !nationId) return false;
  if (city.founderId === nationId) return true;
  return (cultureOf(city)[nationId] || 0) > CORE_CULTURE_SHARE;
};

/** What `nationId` holds on `city`: 'claim', 'core' or null (never on its own city). */
export const claimOn = (state, nationId, city) => {
  if (!city || !city.owner || city.owner === nationId) return null;
  if (claimsOf(state.nations?.[nationId]).includes(city.id)) return 'claim';
  return isCore(city, nationId) ? 'core' : null;
};

/** The cities of `targetId` that `nationId` claims or holds as cores, by id order. */
export const claimsAgainst = (state, nationId, targetId) =>
  Object.values(state.regions || {}).filter((c) => c.owner === targetId && claimOn(state, nationId, c)).sort((a, b) => (a.id < b.id ? -1 : 1));

/** Rings from a city to the nearest tile `nationId` owns, Infinity beyond `max`. */
export const claimRange = (state, nationId) => CLAIM_RANGE_RINGS + mapEffectsFor(state, nationId).claimRange; // techs that reach further (techMapEffects.js)
export const ringsToBorder = (state, city, nationId, max = claimRange(state, nationId)) => {
  if (city.tile == null) return Infinity;
  const tileOwner = state.world?.tileOwner || {};
  const regions = state.regions || {};
  let best = Infinity;
  ringsAround(getTiles(), city.tile, max).forEach((d, t) => {
    if (d >= best) return;
    const c = tileOwner[t];
    if (c != null && regions[c]?.owner === nationId) best = d;
  });
  return best;
};

export const canFabricateClaim = (state, nationId, cityId) => {
  const city = state.regions?.[cityId];
  const nation = state.nations?.[nationId];
  if (!city || !nation) return { ok: false, reason: 'No such city.' };
  if (city.owner === nationId) return { ok: false, reason: 'The city is already yours.' };
  if (!city.owner) return { ok: false, reason: 'Nobody rules it: settle it instead.' };
  if (claimOn(state, nationId, city)) return { ok: false, reason: 'You already hold a claim on it.' };
  if (claimsInProgressOf(nation).some((c) => c.cityId === cityId)) return { ok: false, reason: 'Your agents are already at work there.' };
  if (ringsToBorder(state, city, nationId) > claimRange(state, nationId)) return { ok: false, reason: `Out of reach: a claim needs your border within ${claimRange(state, nationId)} tiles of the city.` };
  return { ok: true };
};

/** The cities a claim could be fabricated on (of `targetId` when given), nearest first: [{ city, rings }]. */
export const claimableCities = (state, nationId, targetId = null) => Object.values(state.regions || {})
  .filter((c) => c.owner && c.owner !== nationId && (!targetId || c.owner === targetId) && c.tile != null)
  .map((c) => ({ city: c, rings: ringsToBorder(state, c, nationId) }))
  .filter((x) => x.rings <= claimRange(state, nationId) && canFabricateClaim(state, nationId, x.city.id).ok)
  .sort((a, b) => a.rings - b.rings || (b.city.size || 0) - (a.city.size || 0) || (a.city.id < b.city.id ? -1 : 1));

/** The city of `targetId` nearest to `nationId`'s land that it holds no claim on, in reach or not
 * (an event's "a claim on X" names a nation). */
export const nearestCityOf = (state, nationId, targetId) => {
  const inReach = claimableCities(state, nationId, targetId)[0];
  if (inReach) return inReach.city;
  const tiles = getTiles();
  const cities = Object.values(state.regions || {});
  const mine = cities.filter((c) => c.owner === nationId && c.tile != null);
  const theirs = cities.filter((c) => c.owner === targetId && c.tile != null && !claimOn(state, nationId, c));
  if (!mine.length || !theirs.length) return null;
  let best = null; let bestKm = Infinity;
  theirs.forEach((c) => mine.forEach((m) => { const km = distanceKm(tiles.centres[c.tile], tiles.centres[m.tile]); if (km < bestKm || (km === bestKm && c.id < best.id)) { bestKm = km; best = c; } }));
  return best;
};

/** The nation with a claim on `cityId` being fabricated, ready at `turn + CLAIM_FABRICATE_TURNS`. */
export const startClaim = (nation, cityId, turn) => ({ ...nation, claimsInProgress: [...claimsInProgressOf(nation), { cityId, done: turn + CLAIM_FABRICATE_TURNS }] });

/** The nation holding a claim on `cityId` at once (events). */
export const grantClaim = (nation, cityId) => (claimsOf(nation).includes(cityId) ? nation : { ...nation, claims: [...claimsOf(nation), cityId] });

/**
 * The claims step of a turn on the working `nations` (mutated in place): claims in progress
 * complete, and claims on cities the nation now owns (or that are gone, or free) are dropped.
 * Returns logs [{ nationId, message }].
 */
export const advanceClaims = (nations, regions, turn) => {
  const logs = [];
  Object.keys(nations).forEach((id) => {
    const n = nations[id];
    const progress = claimsInProgressOf(n);
    const claims = claimsOf(n);
    if (!progress.length && !claims.length) return;
    const valid = (cid) => regions[cid] && regions[cid].owner && regions[cid].owner !== id;
    const kept = claims.filter(valid);
    const added = progress.filter((c) => turn >= c.done).map((c) => c.cityId).filter((cid) => valid(cid) && !kept.includes(cid));
    const waiting = progress.filter((c) => turn < c.done);
    if (kept.length === claims.length && !added.length && waiting.length === progress.length) return;
    nations[id] = { ...n, claims: [...kept, ...added], claimsInProgress: waiting };
    added.forEach((cid) => logs.push(
      { nationId: id, message: `Your claim on ${regions[cid].name} is ready: a war for it is justified.` },
      { nationId: regions[cid].owner, message: `${n.name || id} now lays claim to ${regions[cid].name}.` }
    ));
  });
  return logs;
};

/** The aggressive-expansion multiplier for `takerId` taking `city`: 0 for a core, CLAIM_AE_MULT for a claim, else 1. */
export const aeMultFor = (state, takerId, city) => {
  const kind = claimOn(state, takerId, city);
  return kind === 'core' ? CORE_AE_MULT : kind === 'claim' ? CLAIM_AE_MULT : 1;
};
