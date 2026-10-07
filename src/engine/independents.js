// src/engine/independents.js
// Independent cities, the engine (plans/independent-cities.md, phase W1: passive independents;
// plans/MASTER-PLAN.md sections 2, 3 and 7 row 6). The data and the small rules live in
// src/data/independents.js; who may fight whom in src/engine/hostility.js.
//
// The model in plain words:
// - A new peoples world (phase W0) draws its major nations; every other people of the pool with a
//   capital tile becomes an INDEPENDENT (Standard and Large: all of them; Small: the
//   WORLD_SIZES.small.independents best by weight x a seeded roll). It is a nation record with
//   `kind: 'independent'` and one equal city, like every major (roadmap decision 10).
// - The late peoples (`arrives`: Lapita, Bau, Dorset, Merina...) arrive as independents in their
//   year if their capital tile is still free and the settling rule allows a city there; never as
//   majors (no emergence of majors: master plan section 3, "Emergence").
// - An independent's own cheap logic is its city's queue (aiProduction.js reads the context below):
//   it trains land units up to its garrison target (1 + size / 2, x1.5 for a Fortress), else
//   builds; it never settles or builds wonders, grows to independentSizeCap and claims land only
//   within INDEPENDENT_BORDER_KM. It has no economy pool, ruler, estates or research: every heavy
//   per-nation phase skips it (no `economy`, `ruler: null`, `estates: null`, no AI tier).
// - It declares no wars and besieges nothing (hostility.js canAttack). Since phase W2 it raids,
//   sacks, holds grudges, demands tribute and sells mercenaries (raids.js, mercenaries.js); its
//   queue keeps RAID_RESERVE units above the garrison for raiding. Anyone may attack it without a
//   war; taking its city costs half the usual AE and is no war (no war score, no peace). Its city
//   never flips to it by loyalty either.
// - A city whose loyalty hits 0 with nobody to join becomes a NEW independent ("the free city of
//   X", independents 14.4) in a world with independents; the legacy worlds keep ownerless free cities.
// Pure and deterministic (seeded rolls, fixed orders).
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { PEOPLES, PEOPLES_LIST } from '../data/peoples';
import { WORLD_SIZES, DEFAULT_WORLD_SIZE, EQUAL_START_SIZE } from '../data/worldSizes';
import { createRng } from '../utils/rng';
import {
  INDEPENDENT_KIND, INDEPENDENT_BORDER_KM, isIndependentNation, independentSizeCap, garrisonTarget,
  personalityFor, independentTitle, RAID_RESERVE
} from '../data/independents';
import { canFoundCity, foundCity, sizeToPeople } from './world/cities';

const MIX = 0x51ed270b; // the independents' roll: its own stream of the world seed

/**
 * The independents of a peoples world: { ids, late } (both sorted). `ids` start with a city;
 * `late` arrive in their year. The majors are left out; late arrivals are never drawn as majors.
 */
export const pickIndependents = (majorIds, sizeId = DEFAULT_WORLD_SIZE, seed = 1) => {
  const size = WORLD_SIZES[sizeId] || WORLD_SIZES[DEFAULT_WORLD_SIZE];
  const majors = new Set(majorIds);
  const pool = PEOPLES_LIST.filter((p) => !majors.has(p.id) && p.tile != null);
  const late = pool.filter((p) => p.arrives != null).map((p) => p.id).sort();
  const now = pool.filter((p) => p.arrives == null);
  if (size.independents === 'all' || size.independents >= now.length) return { ids: now.map((p) => p.id).sort(), late };
  const rng = createRng(((seed >>> 0) ^ MIX) >>> 0);
  const ids = now.map((p) => ({ id: p.id, score: p.weightValue * (0.5 + rng.next()) }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, size.independents).map((x) => x.id).sort();
  return { ids, late };
};

/** Marks a start record (createInitialState's nation source) as an independent's. */
export const asIndependentSource = (record) => ({ ...record, kind: INDEPENDENT_KIND });

// The fields a fresh independent starts with on top of a template record: no court, no economy
// pool, no diplomacy (its record keeps the generic fields every nation carries).
const FRESH = {
  kind: INDEPENDENT_KIND, isPlayer: false, isAtWar: false, isEliminated: false, hasPeaceTreaty: false, hasTradeAgreement: false, hasMilitaryPact: false,
  hostility: 5, hostilityFloor: 0, claims: [], warExhaustion: 0, vassals: [], vassalOf: null, vassalizedTurn: 0, truces: {}, ae: {}, rivals: [],
  diplomatTasks: [], marriageWith: [], regiments: {}, ruler: null, heir: null, estates: null, civilWar: null, defensivePact: null,
  capitalOccupied: false, stability: 0, prestige: 0, legitimacy: 50, loans: [], government: { type: 'tribal', reforms: {} }
};
const DROP = ['economy', 'openBordersWith', 'demandCooldowns', 'demandCasusBelli', 'claimsInProgress', 'governors', 'governorCandidates', 'lodSettledTurn', 'lowStabilityStreak', 'civilWarEndedTurn', 'warHeat'];

/** An independent's record built on `base` (any nation record: the fields every nation carries). */
export const independentRecord = (base, { id, name, color, people = null, personality = 'tribal', seaRaiders = false, since = 1, capitalRegionId = null, freeCity = false }) => {
  const out = { ...base, ...FRESH, id, name, color, capitalRegionId, startRegionCount: 1, indep: { personality, seaRaiders, since, ...(freeCity ? { freeCity: true } : {}) } };
  if (people) out.people = people; else delete out.people;
  DROP.forEach((k) => { delete out[k]; });
  return out;
};

const COLD = new Set(['Dfc', 'Dfd', 'Dsc', 'Dsd', 'Dwc', 'Dwd', 'ET', 'EF']);
const isSeaRaider = (tiles, tile, personality) => personality === 'raiders' && tile != null && COLD.has(tiles.climateNames?.[tiles.climate?.[tile]]);

/** An independent's shown name today (independents 14.2): the people's form by personality and age. */
export const independentNameOf = (state, nation) => {
  const city = state.regions?.[nation.capitalRegionId];
  const people = PEOPLES[nation.people];
  return independentTitle({ adjective: people?.adjective, cityName: city?.name, personality: nation.indep?.personality, ageId: state.age, seaRaiders: !!nation.indep?.seaRaiders, freeCity: !!nation.indep?.freeCity });
};

/**
 * After the scenario founded every city: each `kind: 'independent'` record gets its personality
 * (from its city's land), its name, and loses what a major carries (economy pool, ruler, estates).
 * `late`: the late peoples ({ id: year }) to arrive later; `template` keeps one blank independent
 * record for them and for free cities (scenario.independentTemplate).
 */
export const finalizeIndependents = (state, { late = [] } = {}) => {
  const tiles = getTiles();
  const ids = Object.keys(state.nations).filter((id) => state.nations[id].kind === INDEPENDENT_KIND).sort();
  if (!ids.length && !late.length) return state;
  const nations = { ...state.nations };
  ids.forEach((id) => {
    const n = nations[id];
    const tile = state.regions[n.capitalRegionId]?.tile;
    const personality = personalityFor(tiles, tile, id);
    const rec = independentRecord(n, { id, name: n.name, color: n.color, people: n.people || null, personality, seaRaiders: isSeaRaider(tiles, tile, personality), since: state.turnNumber || 1, capitalRegionId: n.capitalRegionId });
    nations[id] = { ...rec, name: independentNameOf(state, rec) };
  });
  const templateBase = ids.length ? nations[ids[0]] : Object.values(state.nations).find((n) => !n.isPlayer);
  const independentTemplate = templateBase ? independentRecord(templateBase, { id: null, name: null, color: null }) : null;
  const lateArrivals = {};
  late.forEach((id) => { if (PEOPLES[id]?.arrives != null) lateArrivals[id] = PEOPLES[id].arrives; });
  return { ...state, nations, scenario: { ...state.scenario, independents: true, independentIds: ids, lateArrivals, independentTemplate } };
};

/** The city context of an independent's city for the cities phase (resolveTurn.js runCitiesPhase). */
export const independentCityCtx = (state, nationId, ageId) => {
  const n = state.nations[nationId];
  const capital = state.regions?.[n?.capitalRegionId];
  return {
    maxSize: independentSizeCap(ageId),
    maxBorderRing: ringsForKm(INDEPENDENT_BORDER_KM),
    garrisonTarget: garrisonTarget(capital?.size || 1, n?.indep?.personality),
    raidReserve: RAID_RESERVE[n?.indep?.personality] || 0, // the raid party (phase W2, raids.js)
    personality: n?.indep?.personality || 'tribal',
    wonders: false
  };
};

/** A fresh independent from the world's template (null in a world without independents). */
const fromTemplate = (state, fields) => {
  const t = state.scenario?.independentTemplate;
  return t ? independentRecord(t, fields) : null;
};

/**
 * The late peoples arrive (independents 4.6, peoples 4.2): in the first turn at or after its year a
 * late people founds its capital as an independent, if its tile and the ring around it are nobody's
 * and the settling rule allows a city there; otherwise its land was taken and it never comes.
 */
export const processLateArrivals = (state) => {
  const pending = state.scenario?.lateArrivals;
  if (state.gameStatus !== 'ACTIVE' || !pending) return state;
  const due = Object.keys(pending).filter((id) => pending[id] <= state.year).sort();
  if (!due.length) return state;
  const tiles = getTiles();
  let next = { ...state, scenario: { ...state.scenario, lateArrivals: { ...pending } } };
  due.forEach((id) => {
    delete next.scenario.lateArrivals[id];
    const p = PEOPLES[id];
    // Its start site on a generated world (the scenario's site table), else its real capital.
    const tile = next.scenario?.sites?.[id] ?? p?.tile;
    const tileOwner = next.world?.tileOwner || {};
    if (tile == null || tileOwner[tile] || next.nations[id] || tiles.neighbors[tile].some((x) => tileOwner[x])) return;
    const world = { cities: next.regions, tileOwner, tileState: next.world?.tileState || {} };
    if (!canFoundCity(world, tiles, tile, id).ok) return;
    const { world: built, city } = foundCity(world, tiles, { nationId: id, tile, name: p.capital?.name, size: EQUAL_START_SIZE, turn: next.turnNumber, isCapital: true });
    const region = { ...city, founderId: id, owner: id, control: 100, currentPopulation: sizeToPeople(city.size), currentInfrastructure: 0, underInvasion: false, unrest: 0, defenseLevel: 0, climateResilience: 0, dev: { tax: city.size, production: city.size, manpower: city.size } };
    const personality = personalityFor(tiles, tile, id);
    const rec = fromTemplate(next, { id, name: p.name, color: p.color, people: id, personality, seaRaiders: isSeaRaider(tiles, tile, personality), since: next.turnNumber, capitalRegionId: city.id });
    if (!rec) return;
    const regions = { ...built.cities, [city.id]: region };
    const named = { ...rec, name: independentNameOf({ ...next, regions }, rec) };
    const unitId = `arrived_${id}`;
    next = {
      ...next,
      nations: { ...next.nations, [id]: named },
      regions,
      world: { ...next.world, tileOwner: built.tileOwner },
      units: { ...next.units, [unitId]: { id: unitId, ownerId: id, regionId: city.id, homeRegionId: city.id, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, rank: 'recruit', commanderId: null, promotions: [], xp: 0 } },
      scenario: { ...next.scenario, independentIds: [...(next.scenario.independentIds || []), id].sort() },
      logs: [...(next.logs || []), { year: next.year, type: 'milestone', message: `${named.name} settle ${city.name}: a new independent city.` }]
    };
  });
  return next;
};

/**
 * A breakaway city (loyalty 0, nobody to join) becomes a new independent in a world with
 * independents (independents 14.4). Writes into the turn's working `nations` and `regions`
 * (loyalty.js). Returns the new nation id, or null where free cities stay ownerless (legacy worlds).
 */
export const breakAwayAsIndependent = (state, nations, regions, cityId, turn) => {
  const city = regions[cityId];
  if (!city || !state.scenario?.independentTemplate) return null;
  const id = `free_${cityId}`;
  if (nations[id] && !nations[id].isEliminated) return null;
  const tiles = getTiles();
  const personality = personalityFor(tiles, city.tile, id);
  const rec = fromTemplate(state, { id, name: null, color: '#8b8f99', personality, since: turn, capitalRegionId: cityId, freeCity: true });
  nations[id] = { ...rec, name: independentTitle({ cityName: city.name, ageId: state.age, freeCity: true }) };
  return id;
};

/** Independents in a state, sorted (for the UI and tests). */
export const independentIdsOf = (state) => Object.keys(state.nations || {}).filter((id) => isIndependentNation(state.nations[id]) && !state.nations[id].isEliminated).sort();
