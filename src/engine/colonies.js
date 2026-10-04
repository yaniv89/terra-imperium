// src/engine/colonies.js
// Settling free frontier land as a project, not a click (plan §4h). It replaces the instant
// frontier expedition: a colony is founded next to your land, grows over several turns while it
// costs you upkeep, may be raided by the people already living there, and only then becomes yours.
//
//   Founding    free frontier land (emergent worlds) next to yours, with one of your land armies
//               next to it (it moves in as the escort), a free colony slot, and the cost:
//               gold FOUND_GOLD_BASE + FOUND_GOLD_PER x provinces^FOUND_GOLD_EXP, ADM
//               FOUND_ADM_BASE + provinces / FOUND_ADM_PER_PROVINCES, and SETTLER_SHARE of the
//               population of the province the escort leaves from (at least SETTLER_MIN).
//   Slots       COLONY_SLOTS_BY_AGE (1 in the Bronze Age, 2 from the Classical, 3 from the
//               Gunpowder Age) plus static `national.colonySlots` bonuses.
//   Growing     each turn: BASE_PROGRESS x terrain x policy x (1 + BORDER_BONUS x your provinces
//               bordering it, at most BORDER_BONUS_CAP). About 8 to 15 turns.
//   Upkeep      UPKEEP_GOLD + UPKEEP_GOLD_PER_OTHER x (your other colonies) gold and UPKEEP_SUPPLIES
//               supplies a turn. Short of gold, the colony does not grow that turn.
//   Natives     the land's inhabitants and resistance (emergentWorld.js). Live alongside them
//               (slower, they stay as your people) or drive them out (faster, the land empties,
//               more unrest, the neighbours resent it).
//   Raids       each turn a seeded roll against resistance / RAID_DIVISOR (half when living
//               alongside, double with no escort in the colony): progress -RAID_SETBACK and the
//               escort loses RAID_ESCORT_LOSS of its strength. RAIDS_TO_LOSE raids in a row and
//               the colony is lost.
//   Completion  the province becomes yours at control 35, with the five-turn integration.
//
// The same rules for AI nations (aiOperations.js founds their colonies). Deterministic: raids roll
// on colonyRoll(`colony|region|turn`), never Math.random.
import { REGIONS_DATA, getNeighborIds, getOwnedRegionIds } from '../data/regions';
import { getRegionTerrain } from '../data/terrain';
import { getEffectiveAgeId } from '../data/ages';
import { powExact } from '../utils/exactMath';
import { getPool, getTechAgeId } from './nationState';
import { canAfford, applyCosts } from '../utils/helpers';
import { isUnitInBattle } from './invasion';
import { getNationBonusTotal } from './modifiers/sheet';

export const FOUND_GOLD_BASE = 60;
export const FOUND_GOLD_PER = 12;
export const FOUND_GOLD_EXP = 1.15;
export const FOUND_ADM_BASE = 2;
export const FOUND_ADM_PER_PROVINCES = 6;
export const SETTLER_SHARE = 0.04;
export const SETTLER_MIN = 2000;
export const COLONY_SLOTS_BY_AGE = { bronze: 1, classical: 2, kingdoms: 2, gunpowder: 3, modern: 3 };
export const BASE_PROGRESS = 14;
export const TERRAIN_GROWTH = { mountains: 0.4, desert: 0.4, arctic: 0.4, hills: 0.7, forest: 0.7 };
export const POLICY = {
  coexist: { growth: 0.75, raid: 0.5, startUnrest: 20, keepsNatives: true, neighbourHostility: 0 },
  driveOut: { growth: 1.25, raid: 1, startUnrest: 45, keepsNatives: false, neighbourHostility: 5 }
};
export const BORDER_BONUS = 0.05;
export const BORDER_BONUS_CAP = 0.25;
export const UPKEEP_GOLD = 4;
export const UPKEEP_GOLD_PER_OTHER = 2;
export const UPKEEP_SUPPLIES = 1;
export const RAID_DIVISOR = 350;
export const RAID_SETBACK = 15;
export const RAID_ESCORT_LOSS = 0.05;
export const RAIDS_TO_LOSE = 3;
export const COLONY_START_CONTROL = 35;
export const INTEGRATION_TURNS = 5;

const name = (id) => REGIONS_DATA[id]?.name || id;

// A seeded roll in [0, 1). FNV-1a plus a final avalanche mix: without the mix, keys that differ only
// in the turn number roll alike, so raids came three turns in a row 30 times too often.
export const colonyRoll = (key) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

// Colonies by owner, cached per regions object (every AI nation asks each turn).
const colonyIndexCache = new WeakMap();
const colonyIndex = (regions) => {
  let index = colonyIndexCache.get(regions);
  if (!index) {
    index = new Map();
    Object.keys(regions).forEach((id) => { const o = regions[id].colony?.ownerId; if (o) { if (!index.has(o)) index.set(o, []); index.get(o).push(id); } });
    colonyIndexCache.set(regions, index);
  }
  return index;
};
export const coloniesOf = (state, nationId) => colonyIndex(state.regions).get(nationId) || [];

export const colonySlots = (state, nationId) => {
  const age = getEffectiveAgeId(state.age, getTechAgeId(state, nationId));
  // Static bonuses only (government, policy, wonders): cheap enough for every AI nation every turn.
  const bonus = state.nations[nationId] ? Math.round(getNationBonusTotal(state.nations[nationId], 'national.colonySlots') || 0) : 0;
  return Math.max(1, (COLONY_SLOTS_BY_AGE[age] ?? 1) + bonus);
};

export const foundingCost = (state, nationId) => {
  const provinces = getOwnedRegionIds(state.regions, nationId).length;
  return { gold: Math.round(FOUND_GOLD_BASE + FOUND_GOLD_PER * powExact(provinces, FOUND_GOLD_EXP)), adm: FOUND_ADM_BASE + Math.floor(provinces / FOUND_ADM_PER_PROVINCES) };
};

export const settlersFrom = (region) => Math.max(SETTLER_MIN, Math.round((region?.currentPopulation || 0) * SETTLER_SHARE));

// Progress a colony makes this turn (before raids). Pure.
export const colonyGrowth = (state, regionId, ownerId, policy) => {
  const terrain = TERRAIN_GROWTH[getRegionTerrain(regionId, REGIONS_DATA)] ?? 1;
  const borders = getNeighborIds(regionId).filter((n) => state.regions[n]?.owner === ownerId).length;
  const border = Math.min(BORDER_BONUS_CAP, BORDER_BONUS * borders);
  return BASE_PROGRESS * terrain * (POLICY[policy]?.growth ?? 1) * (1 + border);
};

// The raid chance this turn. `escorted`: an own army stands in the colony.
export const raidChance = (state, regionId, policy, escorted) => {
  const resistance = state.regions[regionId]?.neutral?.resistance || 0;
  return Math.min(0.9, (resistance / RAID_DIVISOR) * (POLICY[policy]?.raid ?? 1) * (escorted ? 1 : 2));
};

// Everything the card needs: ok, or the first reason it is not, plus the checklist.
export const validateColony = (state, regionId, nationId = state.playerNationId, { quick = false } = {}) => {
  const target = state.regions[regionId];
  const checks = [];
  if (state.scenario?.mode !== 'emergent' || !target || target.owner !== null || !target.neutral) return { ok: false, reason: 'Choose free frontier land.', checks };
  if (target.colony) return { ok: false, reason: target.colony.ownerId === nationId ? 'Your colony is already growing here.' : `${state.nations[target.colony.ownerId]?.name || 'Another nation'} is already settling here.`, checks };
  const borders = getNeighborIds(regionId).some((n) => state.regions[n]?.owner === nationId);
  checks.push({ ok: borders, label: borders ? 'Borders your land' : 'Must border your land' });
  // The AI only needs yes or no: stop at the first cheap failure, before scanning the units.
  if (quick && (!borders || coloniesOf(state, nationId).length >= colonySlots(state, nationId) || !canAfford(getPool(state, nationId), foundingCost(state, nationId)))) return { ok: false, reason: 'not now', checks };
  const escort = Object.values(state.units).filter((u) => u.ownerId === nationId && u.domain === 'land' && !u.embarkedOn && u.strength > 0 && (u.movesLeft ?? 1) > 0
    && !isUnitInBattle(state, u.id) && state.regions[u.regionId]?.owner === nationId && getNeighborIds(u.regionId).includes(regionId))
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  checks.push({ ok: !!escort, label: escort ? 'An army next to it can escort the settlers' : 'Needs a land army next to it with a move left' });
  const used = coloniesOf(state, nationId).length; const slots = colonySlots(state, nationId);
  checks.push({ ok: used < slots, label: `Colony slots: ${used} of ${slots} in use` });
  const cost = foundingCost(state, nationId);
  const affordable = canAfford(getPool(state, nationId), cost);
  checks.push({ ok: affordable, label: `Costs ${cost.gold} gold and ${cost.adm} ADM` });
  const source = escort ? state.regions[escort.regionId] : null;
  const settlers = settlersFrom(source);
  const enoughPeople = !source || (source.currentPopulation || 0) > settlers * 2;
  checks.push({ ok: enoughPeople, label: `${settlers.toLocaleString('en-US')} settlers leave ${source ? name(escort.regionId) : 'home'}` });
  const failed = checks.find((c) => !c.ok);
  if (failed) return { ok: false, reason: failed.label, checks, cost, settlers };
  return { ok: true, checks, cost, settlers, escort, sourceRegionId: escort.regionId };
};

// FOUND_COLONY: pay, move the escort in, take the settlers, start the colony.
export const foundColony = (state, regionId, policy = 'coexist', nationId = state.playerNationId) => {
  const v = validateColony(state, regionId, nationId);
  if (!v.ok || !POLICY[policy]) return state;
  const isPlayer = nationId === state.playerNationId;
  const pool = applyCosts(getPool(state, nationId), v.cost);
  const source = state.regions[v.sourceRegionId];
  const target = state.regions[regionId];
  return {
    ...state,
    resources: isPlayer ? pool : state.resources,
    nations: isPlayer ? state.nations : { ...state.nations, [nationId]: { ...state.nations[nationId], economy: pool } },
    regions: {
      ...state.regions,
      [v.sourceRegionId]: { ...source, currentPopulation: Math.max(0, (source.currentPopulation || 0) - v.settlers) },
      [regionId]: { ...target, colony: { ownerId: nationId, policy, progress: 0, settlers: v.settlers, foundedTurn: state.turnNumber, raids: 0 } }
    },
    units: { ...state.units, [v.escort.id]: { ...v.escort, regionId, tile: state.regions[regionId]?.tile ?? null, movesLeft: 0, route: null } },
    logs: [...state.logs, { year: state.year, type: 'action', message: `${isPlayer ? 'Your' : `${state.nations[nationId].name}'s`} settlers found a colony in ${name(regionId)}${policy === 'driveOut' ? ', driving out its people' : ''}.` }]
  };
};

// When a colony is lost or abandoned, its escort walks back to a neighbouring province of its own
// (the first by id), so a small nation is not left without an army on empty land.
const sendEscortsHome = (regions, units, regionId, ownerId) => {
  const home = [...getNeighborIds(regionId)].sort().find((n) => regions[n]?.owner === ownerId);
  if (!home) return units;
  let next = units;
  Object.keys(units).sort().forEach((uid) => {
    const u = units[uid];
    if (u.ownerId === ownerId && u.regionId === regionId && u.domain === 'land') {
      if (next === units) next = { ...units };
      next[uid] = { ...u, regionId: home, tile: regions[home]?.tile ?? null, route: null };
    }
  });
  return next;
};

// ABANDON_COLONY: the land goes back to its people. Nothing is refunded.
export const abandonColony = (state, regionId, nationId = state.playerNationId) => {
  const r = state.regions[regionId];
  if (r?.colony?.ownerId !== nationId) return state;
  const { colony, ...rest } = r; // eslint-disable-line no-unused-vars
  return { ...state, regions: { ...state.regions, [regionId]: rest }, units: sendEscortsHome(state.regions, state.units, regionId, nationId), logs: [...state.logs, { year: state.year, type: 'action', message: `The colony in ${name(regionId)} was abandoned.` }] };
};

// Turns left at this turn's growth (ignoring raids).
export const colonyTurnsLeft = (state, regionId) => {
  const c = state.regions[regionId]?.colony;
  if (!c) return null;
  return Math.max(1, Math.ceil((100 - c.progress) / Math.max(0.1, colonyGrowth(state, regionId, c.ownerId, c.policy))));
};

// The colony phase, at the end of resolveTurn (state.turnNumber is the new turn). Pure.
export const processColonies = (state) => {
  const ids = Object.keys(state.regions).filter((id) => state.regions[id].colony).sort();
  if (!ids.length) return state;
  const regions = { ...state.regions };
  const units = { ...state.units };
  let nations = state.nations;
  let resources = state.resources;
  const logs = [];
  const year = state.year;
  const colonySet = new Set(ids);
  const unitsByRegion = new Map();
  Object.keys(units).sort().forEach((uid) => { const r = units[uid].regionId; if (colonySet.has(r)) { if (!unitsByRegion.has(r)) unitsByRegion.set(r, []); unitsByRegion.get(r).push(uid); } });
  const countBy = {};
  ids.forEach((id) => { const o = regions[id].colony.ownerId; countBy[o] = (countBy[o] || 0) + 1; });
  ids.forEach((id) => {
    const region = regions[id];
    const c = region.colony;
    const owner = nations[c.ownerId];
    const isPlayer = c.ownerId === state.playerNationId;
    const drop = (why) => {
      const { colony, ...rest } = region; // eslint-disable-line no-unused-vars
      regions[id] = rest;
      Object.assign(units, sendEscortsHome(regions, units, id, c.ownerId));
      logs.push({ year, type: isPlayer ? 'crisis' : 'action', message: `${isPlayer ? 'Your' : `${owner?.name || 'A'}`} colony in ${name(id)} ${why}.` });
    };
    if (!owner || owner.isEliminated) { drop('was left empty'); return; }
    // Upkeep, paid first: a colony nobody pays for does not grow.
    const upkeep = { gold: UPKEEP_GOLD + UPKEEP_GOLD_PER_OTHER * Math.max(0, countBy[c.ownerId] - 1), supplies: UPKEEP_SUPPLIES };
    const pool = isPlayer ? resources : (owner.economy || {});
    const paid = (pool.gold || 0) >= upkeep.gold;
    const nextPool = { ...pool, gold: Math.max(0, (pool.gold || 0) - upkeep.gold), supplies: Math.max(0, (pool.supplies || 0) - upkeep.supplies) };
    if (isPlayer) resources = nextPool; else nations = { ...nations, [c.ownerId]: { ...owner, economy: nextPool } };
    let progress = c.progress + (paid ? colonyGrowth(state, id, c.ownerId, c.policy) : 0);
    // Raids.
    const escort = (unitsByRegion.get(id) || []).map((uid) => units[uid]).filter((u) => u.ownerId === c.ownerId && u.domain === 'land' && u.strength > 0);
    let raids = 0;
    if (colonyRoll(`colony|${id}|${state.turnNumber}`) < raidChance(state, id, c.policy, escort.length > 0)) {
      progress = Math.max(0, progress - RAID_SETBACK);
      raids = (c.raids || 0) + 1;
      escort.forEach((u) => { units[u.id] = { ...u, strength: Math.max(1, Math.round(u.strength * (1 - RAID_ESCORT_LOSS))) }; });
      if (raids >= RAIDS_TO_LOSE) { drop('was overrun by raids and lost'); return; }
      if (isPlayer) logs.push({ year, type: 'combat', message: `Raiders struck your colony in ${name(id)} (${raids} of ${RAIDS_TO_LOSE} before it falls).` });
    }
    if (progress >= 100) {
      const policy = POLICY[c.policy] || POLICY.coexist;
      const { colony, ...rest } = region; // eslint-disable-line no-unused-vars
      regions[id] = {
        ...rest, owner: c.ownerId, neutral: null, control: COLONY_START_CONTROL, unrest: policy.startUnrest,
        integratingUntil: state.turnNumber + INTEGRATION_TURNS,
        currentPopulation: policy.keepsNatives ? (region.currentPopulation || 0) + c.settlers : c.settlers
      };
      nations = { ...nations, [c.ownerId]: { ...nations[c.ownerId], frontierClaims: (nations[c.ownerId].frontierClaims || 0) + 1 } };
      if (policy.neighbourHostility) {
        const neighbours = new Set(getNeighborIds(id).map((n) => regions[n]?.owner).filter((o) => o && o !== c.ownerId && nations[o]));
        [...neighbours].sort().forEach((o) => { nations = { ...nations, [o]: { ...nations[o], hostility: Math.min(100, (nations[o].hostility || 0) + policy.neighbourHostility) } }; });
      }
      logs.push({ year, type: isPlayer ? 'milestone' : 'action', message: `${isPlayer ? 'Your' : `${owner.name}'s`} colony in ${name(id)} has grown into a province.` });
      return;
    }
    regions[id] = { ...region, colony: { ...c, progress: Math.round(progress * 10) / 10, raids } };
  });
  return { ...state, regions, units, nations, resources, logs: logs.length ? [...state.logs, ...logs] : state.logs };
};
