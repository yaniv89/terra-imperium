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
import { getOwnedRegionIds } from '../data/regions';
import { mapEffectsFor } from './techMapEffects';

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

// Memoised on the nation's city set and capital (the turn replaces the regions object several
// times, but a nation's cities change rarely): key -> { groups, byCity }. Bounded.
const groupsMemo = new Map();
const GROUPS_MEMO_MAX = 4000;
const entryByRegions = new WeakMap(); // regions object -> Map nationId -> entry (a turn asks per city; the key below costs a join per ask)
const groupsEntry = (state, nationId) => {
  const regions = state.regions || {};
  let perNation = entryByRegions.get(regions);
  if (!perNation) { perNation = new Map(); entryByRegions.set(regions, perNation); }
  const quick = perNation.get(nationId);
  if (quick && quick.capitalId === state.nations?.[nationId]?.capitalRegionId) return quick.entry;
  const capitalId = state.nations?.[nationId]?.capitalRegionId;
  const ids = getOwnedRegionIds(regions, nationId);
  const rings = GOVERNOR_GROUP_RINGS + mapEffectsFor(state, nationId).governorRings; // techs that widen a governor's reach (techMapEffects.js)
  const key = `${nationId}|${capitalId}|${rings}|${ids.length}|${ids.join(',')}`;
  const hit = groupsMemo.get(key);
  if (hit) { perNation.set(nationId, { capitalId, entry: hit }); return hit; }
  const groups = buildGroups(regions, ids, capitalId, rings);
  const byCity = new Map();
  groups.forEach((g) => g.cities.forEach((id) => byCity.set(id, g)));
  if (groupsMemo.size >= GROUPS_MEMO_MAX) groupsMemo.clear();
  const entry = { groups, byCity };
  groupsMemo.set(key, entry);
  perNation.set(nationId, { capitalId, entry });
  return entry;
};
/** The city groups of a nation: [{ seat, cities }] in a fixed order. */
export const cityGroups = (state, nationId) => groupsEntry(state, nationId).groups;
const buildGroups = (regions, ids, capitalId, groupRings = GOVERNOR_GROUP_RINGS) => {
  const tiles = getTiles();
  const mine = ids.map((id) => regions[id]).filter((c) => c && c.tile != null).sort((a, b) => (a.id < b.id ? -1 : 1));
  const left = new Map(mine.map((c) => [c.id, c]));
  const groups = [];
  const seatOrder = [];
  if (capitalId && left.has(capitalId)) seatOrder.push(capitalId);
  while (left.size) {
    const seatId = seatOrder.length ? seatOrder.shift() : [...left.keys()][0];
    if (!left.has(seatId)) continue;
    const seat = left.get(seatId);
    left.delete(seatId);
    const rings = ringsAround(tiles, seat.tile, groupRings);
    const near = [...left.values()].map((c) => ({ c, d: rings.get(c.tile) })).filter((x) => x.d !== undefined).sort((a, b) => a.d - b.d || (a.c.id < b.c.id ? -1 : 1)).slice(0, GOVERNOR_GROUP_MAX - 1);
    near.forEach((x) => left.delete(x.c.id));
    groups.push({ seat: seatId, cities: [seatId, ...near.map((x) => x.c.id)] });
  }
  return groups;
};

/** The group a city belongs to, or null. */
export const groupOfCity = (state, nationId, cityId) => groupsEntry(state, nationId).byCity.get(cityId) || null;

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
