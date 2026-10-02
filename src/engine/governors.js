// src/engine/governors.js
// Governors (plans/civ-map-rework.md, C4.3; workstream 8). A nation's cities fall into GROUPS: the
// capital and the cities within GOVERNOR_GROUP_RINGS of it (nearest first, up to
// GOVERNOR_GROUP_MAX), then the next ungrouped city by id seats the next group, and so on
// (`cityGroups`, cached per cities map). Each group has one seat (its first city) and may have a
// GOVERNOR (`nation.governors[seatId] = { id, name, skill, since, ready }`), a character from the
// court's candidates (`nation.governorCandidates`, GOVERNOR_CANDIDATES refreshed every
// GOVERNOR_REFRESH_TURNS turns; the heir may serve too). Taking office takes
// GOVERNOR_ASSIGN_TURNS turns. A governed city gets:
//   +GOVERNOR_FOOD food, +GOVERNOR_PRODUCTION_MULT production, +GOVERNOR_CULTURE culture (cities.js)
//   +GOVERNOR_LOYALTY + skill loyalty (loyalty.js), unrest x GOVERNOR_UNREST_MULT a turn (resolveTurn)
// A group without a governor costs its cities UNGOVERNED_LOYALTY loyalty. AI nations seat the best
// candidate in every empty group on their economy think (aiEconomy.js autoGovern). Pure.
import { getTiles } from '../data/geo/tiles';
import { generateGivenName } from '../data/names';
import { createRng } from '../utils/rng';
import { ringsAround } from './world/cities';

export const GOVERNOR_GROUP_RINGS = 6;
export const GOVERNOR_GROUP_MAX = 6;
export const GOVERNOR_ASSIGN_TURNS = 2;
export const GOVERNOR_FOOD = 1;
export const GOVERNOR_PRODUCTION_MULT = 0.1;
export const GOVERNOR_CULTURE = 1;
export const GOVERNOR_LOYALTY = 2;
export const GOVERNOR_UNREST_MULT = 0.9;
export const UNGOVERNED_LOYALTY = -5;
export const GOVERNOR_CANDIDATES = 3;
export const GOVERNOR_REFRESH_TURNS = 10;
export const GOVERNOR_MAX_SKILL = 3;

const hash = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };

const groupsCache = new WeakMap(); // regions -> Map nationId -> groups
/** The city groups of a nation: [{ seat, cities }] in a fixed order. */
export const cityGroups = (state, nationId) => {
  const regions = state.regions || {};
  let byNation = groupsCache.get(regions);
  if (!byNation) { byNation = new Map(); groupsCache.set(regions, byNation); }
  if (byNation.has(nationId)) return byNation.get(nationId);
  const tiles = getTiles();
  const mine = Object.values(regions).filter((c) => c.owner === nationId && c.tile != null).sort((a, b) => (a.id < b.id ? -1 : 1));
  const capitalId = state.nations?.[nationId]?.capitalRegionId;
  const left = new Map(mine.map((c) => [c.id, c]));
  const groups = [];
  const seatOrder = [];
  if (capitalId && left.has(capitalId)) seatOrder.push(capitalId);
  while (left.size) {
    const seatId = seatOrder.length ? seatOrder.shift() : [...left.keys()][0];
    if (!left.has(seatId)) continue;
    const seat = left.get(seatId);
    left.delete(seatId);
    const rings = ringsAround(tiles, seat.tile, GOVERNOR_GROUP_RINGS);
    const near = [...left.values()].map((c) => ({ c, d: rings.get(c.tile) })).filter((x) => x.d !== undefined).sort((a, b) => a.d - b.d || (a.c.id < b.c.id ? -1 : 1)).slice(0, GOVERNOR_GROUP_MAX - 1);
    near.forEach((x) => left.delete(x.c.id));
    groups.push({ seat: seatId, cities: [seatId, ...near.map((x) => x.c.id)] });
  }
  byNation.set(nationId, groups);
  return groups;
};

/** The group a city belongs to, or null. */
export const groupOfCity = (state, nationId, cityId) => cityGroups(state, nationId).find((g) => g.cities.includes(cityId)) || null;

/** The governor in office over `cityId` (assigned and arrived), else null. */
export const governorOf = (state, nationId, cityId, turn = state.turnNumber || 1) => {
  const nation = state.nations?.[nationId];
  if (!nation?.governors) return null;
  const g = groupOfCity(state, nationId, cityId);
  const gov = g ? nation.governors[g.seat] : null;
  return gov && turn >= (gov.ready ?? 0) ? gov : null;
};

/** A fresh slate of candidates for a nation (deterministic in the seed). */
export const generateGovernorCandidates = (nationId, seed) => {
  const rng = createRng(hash(`${nationId}|gov|${seed}`));
  return Array.from({ length: GOVERNOR_CANDIDATES }, (_, i) => ({ id: `gov_${nationId}_${seed}_${i}`, name: generateGivenName(nationId, rng), skill: 1 + Math.floor(rng.next() * GOVERNOR_MAX_SKILL) }));
};

/** The people the player may seat: the candidates and the heir (skill from ADM). */
export const governorChoices = (nation) => {
  const out = [...(nation.governorCandidates || [])];
  if (nation.heir) out.push({ id: nation.heir.id, name: `${nation.heir.name} (heir)`, skill: Math.max(1, Math.min(GOVERNOR_MAX_SKILL, Math.ceil((nation.heir.adm || 1) / 2))), heir: true });
  const seated = new Set(Object.values(nation.governors || {}).map((g) => g.id));
  return out.filter((c) => !seated.has(c.id));
};

/** The nation with `candidate` on its way to `seatId` (in office at turn + GOVERNOR_ASSIGN_TURNS). */
export const assignGovernor = (nation, seatId, candidate, turn) => ({
  ...nation,
  governors: { ...(nation.governors || {}), [seatId]: { id: candidate.id, name: candidate.name, skill: candidate.skill, heir: !!candidate.heir, since: turn, ready: turn + GOVERNOR_ASSIGN_TURNS } },
  governorCandidates: (nation.governorCandidates || []).filter((c) => c.id !== candidate.id)
});

export const dismissGovernor = (nation, seatId) => {
  if (!nation.governors?.[seatId]) return nation;
  const governors = { ...nation.governors }; delete governors[seatId];
  return { ...nation, governors };
};

/** Drops governors whose seat the nation no longer holds (a lost city). Same nation when nothing changed. */
export const pruneGovernors = (state, nation) => {
  if (!nation.governors || !Object.keys(nation.governors).length) return nation;
  const seats = new Set(cityGroups(state, nation.id).map((g) => g.seat));
  const kept = Object.fromEntries(Object.entries(nation.governors).filter(([seat]) => seats.has(seat)));
  return Object.keys(kept).length === Object.keys(nation.governors).length ? nation : { ...nation, governors: kept };
};

/** An AI nation seats its best candidate in every empty group at once (its court is abstract). */
export const autoGovern = (state, nation, turn) => {
  const groups = cityGroups(state, nation.id);
  const empty = groups.filter((g) => !nation.governors?.[g.seat]);
  if (!empty.length) return nation;
  let next = nation;
  empty.forEach((g, i) => {
    const best = generateGovernorCandidates(nation.id, `${turn}|${g.seat}|${i}`).sort((a, b) => b.skill - a.skill)[0];
    next = assignGovernor(next, g.seat, best, turn - GOVERNOR_ASSIGN_TURNS); // in office at once
  });
  return next;
};

/** The city's bonuses from its governor: { food, productionMult, culture, loyalty } (zeros without one). */
export const governorEffects = (state, nationId, cityId, turn) => {
  const gov = governorOf(state, nationId, cityId, turn);
  if (gov) return { food: GOVERNOR_FOOD, productionMult: GOVERNOR_PRODUCTION_MULT, culture: GOVERNOR_CULTURE, loyalty: GOVERNOR_LOYALTY + (gov.skill || 1), governed: true };
  const nation = state.nations?.[nationId];
  const matters = !!nation && (nationId === state.playerNationId || !!nation.governors);
  return { food: 0, productionMult: 0, culture: 0, loyalty: matters ? UNGOVERNED_LOYALTY : 0, governed: false };
};
