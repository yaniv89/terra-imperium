// src/engine/aftermath.js
// What war costs the land and the people, beyond the units themselves. Every battle and every levy
// ripples into the macro economy through explicit, bounded formulas:
//
//   Levy: raising a unit draws its men from its home province's population. Population already
//   feeds that province's tax, production and manpower through getPopFactor (development.js), so a
//   heavy levy in a small province visibly thins its income and its future manpower.
//
//   Casualty scars: men who die in battle don't come home. Their share of the unit's strength is
//   taken off the home province's population for good (natural growth refills it only slowly).
//
//   Devastation (0-100): a province fought over is trampled, burned and looted. It cuts that
//   province's income and growth and fades by DEVASTATION_DECAY per turn, so a front line that
//   keeps seeing battles stays poor while a one-off battlefield recovers within a few years.
//
//   War exhaustion: a lost battle hurts at home now, not only the passing of turns. The loser
//   takes a spike scaled by how much of its army it lost; the winner takes a little too.
//
//   Commanders: a general whose unit is destroyed may fall with it; otherwise they escape and are
//   free for a new command. The roll is a hash of (unit, turn), so it replays identically.
//
// All pure: (inputs) -> new objects, no RNG state threaded through, no mutation.
import { REGIONS_DATA } from '../data/regions';
import { POPULATION_FLOOR_RATIO } from './population';

// Men per point of unit strength: a full 1000-strength unit is ~10,000 soldiers. Against real
// provincial populations (hundreds of thousands to millions) a single levy is a few per cent at
// most for a small province and noise for a big one — an opportunity cost, not a collapse.
export const MEN_PER_STRENGTH = 10;

export const DEVASTATION_MAX = 100;
export const DEVASTATION_PER_BATTLE = 12;       // a small skirmish
export const DEVASTATION_PER_LOSS_SHARE = 40;   // + this x the share of both armies destroyed
export const DEVASTATION_DECAY = 4;             // per turn
// At full devastation a province earns half its income and its growth is cut by 0.4%/turn.
export const DEVASTATION_INCOME_PENALTY = 0.5;
export const DEVASTATION_GROWTH_PENALTY = 0.004;

export const WE_LOSER_BASE = 2;
export const WE_LOSER_PER_LOSS_SHARE = 12;
export const WE_WINNER = 1;
export const WE_MAX = 100;

export const COMMANDER_FALL_CHANCE = 0.25;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Deterministic 0..1 from a string (FNV-1a), for rolls that must replay without an RNG stream.
export const hashRoll = (key) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
};

const populationFloor = (regionId) => (REGIONS_DATA[regionId]?.population || 0) * POPULATION_FLOOR_RATIO;

// Remove `men` people from a province, never below its population floor. Returns the same
// `regions` object when nothing changes.
export const drawPopulation = (regions, regionId, men) => {
  const region = regions?.[regionId];
  const baseline = REGIONS_DATA[regionId]?.population || 0;
  if (!region || !(men > 0) || !(baseline > 0)) return regions;
  const current = region.currentPopulation || baseline;
  const next = Math.round(Math.max(populationFloor(regionId), current - men));
  if (next === current) return regions;
  return { ...regions, [regionId]: { ...region, currentPopulation: next } };
};

// A new unit's men come from its home province.
export const levyUnit = (regions, unit) => drawPopulation(regions, unit.homeRegionId || unit.regionId, (unit.strength || 0) * MEN_PER_STRENGTH);

// Every unit present in `nextUnits` but not in `prevUnits` was raised this turn: levy each one.
export const levyNewUnits = (regions, prevUnits, nextUnits) => {
  let out = regions;
  Object.values(nextUnits || {}).forEach((u) => {
    if (prevUnits?.[u.id] || u.domain === 'naval') return;
    out = levyUnit(out, u);
  });
  return out;
};

// Casualty scars. `before` is the units as they went into battle (id -> unit, or an array),
// `after` the resolved units (array, strength 0 = destroyed). Only real units with a home
// province count — synthetic AI troops are an abstraction of militaryStrength.
export const applyCasualtyScars = (regions, before, after) => {
  const start = Array.isArray(before) ? Object.fromEntries(before.map((u) => [u.id, u])) : (before || {});
  let out = regions;
  (after || []).forEach((u) => {
    const b = start[u.id];
    if (!b || u.synthetic) return;
    const lost = Math.max(0, (b.strength || 0) - Math.max(0, u.strength || 0));
    if (lost > 0) out = drawPopulation(out, b.homeRegionId || b.regionId, lost * MEN_PER_STRENGTH);
  });
  return out;
};

// Share (0..1) of everyone who fought that was lost, across both sides.
export const battleLossShare = (beforeUnits, afterUnits) => {
  const start = (beforeUnits || []).reduce((s, u) => s + Math.max(0, u.strength || 0), 0);
  const end = (afterUnits || []).reduce((s, u) => s + Math.max(0, u.strength || 0), 0);
  return start > 0 ? clamp((start - end) / start, 0, 1) : 0;
};

// The province a battle was fought in is devastated.
export const devastateRegion = (regions, regionId, lossShare) => {
  const region = regions?.[regionId];
  if (!region) return regions;
  const gain = DEVASTATION_PER_BATTLE + Math.round(DEVASTATION_PER_LOSS_SHARE * clamp(lossShare || 0, 0, 1));
  return { ...regions, [regionId]: { ...region, devastation: clamp((region.devastation || 0) + gain, 0, DEVASTATION_MAX) } };
};

export const decayDevastation = (value) => Math.max(0, (value || 0) - DEVASTATION_DECAY);
export const devastationIncomeMult = (region) => 1 - DEVASTATION_INCOME_PENALTY * clamp((region?.devastation || 0) / DEVASTATION_MAX, 0, 1);
export const devastationGrowthPenalty = (region) => DEVASTATION_GROWTH_PENALTY * clamp((region?.devastation || 0) / DEVASTATION_MAX, 0, 1);

// The loser of a battle feels it at home; `loserLossShare` is the share of ITS OWN army it lost.
export const applyBattleWarExhaustion = (nations, winnerId, loserId, loserLossShare) => {
  let out = nations;
  const bump = (id, amount) => {
    const n = out?.[id];
    if (!n || !(amount > 0)) return;
    out = { ...out, [id]: { ...n, warExhaustion: clamp((n.warExhaustion || 0) + amount, 0, WE_MAX) } };
  };
  if (loserId) bump(loserId, WE_LOSER_BASE + Math.round(WE_LOSER_PER_LOSS_SHARE * clamp(loserLossShare || 0, 0, 1)));
  if (winnerId) bump(winnerId, WE_WINNER);
  return out;
};

// Share of one side's own strength lost.
export const sideLossShare = (before, after) => battleLossShare(before, after);

// Destroyed units' commanders: some fall (removed), the rest escape unassigned. Returns
// { hiredCommanders, fallen: [names] }.
export const resolveCommanderCasualties = (hiredCommanders, destroyedUnits, turnNumber) => {
  if (!hiredCommanders) return { hiredCommanders, fallen: [] };
  let out = hiredCommanders;
  const fallen = [];
  (destroyedUnits || []).forEach((u) => {
    const id = u.commanderId;
    const c = id && out[id];
    if (!c) return;
    if (hashRoll(`${u.id}|${turnNumber}`) < COMMANDER_FALL_CHANCE) {
      out = { ...out };
      delete out[id];
      fallen.push(c.name || id);
    } else {
      out = { ...out, [id]: { ...c, assignedUnitId: null } };
    }
  });
  return { hiredCommanders: out, fallen };
};

// Everything above for one resolved battle. `beforeA`/`beforeD` and `afterA`/`afterD` are the two
// sides' units going in and coming out; `regionId` is where it was fought; the winner/loser ids
// may be null (a draw). Returns the new regions/nations/hiredCommanders and log lines.
export const applyBattleAftermath = (state, { regionId, beforeA, afterA, beforeD, afterD, attackerId, defenderId, outcome }) => {
  const all = [...(beforeA || []), ...(beforeD || [])];
  const allAfter = [...(afterA || []), ...(afterD || [])];
  let regions = applyCasualtyScars(state.regions, all, allAfter);
  regions = devastateRegion(regions, regionId, battleLossShare(all, allAfter));
  const winnerId = outcome === 'attacker' ? attackerId : outcome === 'defender' ? defenderId : null;
  const loserId = outcome === 'attacker' ? defenderId : outcome === 'defender' ? attackerId : null;
  const loserShare = loserId === attackerId ? sideLossShare(beforeA, afterA) : sideLossShare(beforeD, afterD);
  const nations = applyBattleWarExhaustion(state.nations, winnerId, loserId, loserShare);
  const destroyed = allAfter.filter((u) => !u.synthetic && (u.strength || 0) <= 0).map((u) => ({ ...u, commanderId: u.commanderId ?? all.find((b) => b.id === u.id)?.commanderId }));
  const { hiredCommanders, fallen } = resolveCommanderCasualties(state.hiredCommanders, destroyed, state.turnNumber);
  const logs = fallen.map((name) => ({ year: state.year, message: `${name} fell in battle with their troops.`, type: 'combat' }));
  return { regions, nations, hiredCommanders, logs };
};
