// src/engine/defense.js
// Defense battles (Tactical Battles plan §16). An AI assault on a player region guarded by land
// troops is no longer a bare dice roll: resolveWarProgress (diplomacy.js) queues it on
// state.pendingDefenses, and at the start of the player's turn each one is fought, either
// auto-resolved (resolveBattle) or commanded (the tactical battle with the player as defender).
// Whichever way it's fought, applyDefenseResult below applies the consequences.
//
// The assault force is the aggressor's real land units standing in provinces next to the target.
// If those are fewer than its strength warrants, an expeditionary force is synthesized from the
// aggressor's militaryStrength to make up the gap. Synthetic troops exist only for this battle:
// they're stored on the defense record, never in state.units, and their losses come out of
// militaryStrength afterwards.
import { recordBattleReport } from './battleReports';
import { conquerRegion } from './conquest';
import { applyBattleAftermath } from './aftermath';
import { LogTypes } from '../data/types';
import { REGIONS_DATA, getTouchingIds } from '../data/regions';
import { getRegionTerrain } from '../data/terrain';
import { getEffectiveAgeId } from '../data/ages';
import { getAvailableClasses } from '../data/unitClasses';
import { awardXp } from '../data/promotions';
import { getGeneralXpMultiplier } from '../data/generals';
import { createRng } from '../utils/rng';
import { resolveBattle } from './battle';
import { recordBattle } from './diplomacy';
import { getTechAgeId } from './nationState';
import { getRegionModifier } from './modifiers/sheet';
import { XP_WIN, XP_LOSE } from './invasion';
import { placeInCity, unitsWithinRings, nearestHeldCity, REINFORCE_RINGS } from './armies';
import { getDefenseLevelDamageReductionMultiplier, getZoneOfControlMultiplier, hasMeleeUnitDeployed, resolveSiegeControlDamage, SIEGE_CONTROL_DAMAGE, SIEGE_CAPTURE_CONTROL_THRESHOLD, isGarrisonBroken } from './siege';

// Before this system, a successful capture roll against a garrisoned player region always did
// full siege damage. Now the garrison fights back (getAssaultPressure averages about half), so the
// roll fires more often to compensate. Calibrated by src/engine/defense.test.js's harness so the
// EXPECTED control damage per turn under auto-resolve stays within ±10% of the old behaviour.
export const PLAYER_DEFENDED_CAPTURE_MULT = 1.85;

const MAX_ASSAULT_UNITS = 12;
const SYNTHETIC_CLASS_WEIGHTS = [['infantry', 5], ['ranged', 2], ['cavalry', 2], ['siege', 1]];

// The player's land troops holding `regionId` (the garrison an assault has to beat).
export const getGarrison = (state, regionId) => Object.values(state.units || {})
  .filter((u) => u.regionId === regionId && u.domain === 'land' && u.classId !== 'settler' && u.ownerId === state.playerNationId && !u.embarkedOn && u.strength > 0);

// Where the assault comes from: a city of the aggressor whose land touches the target, else the
// region of the aggressor's nearest troops beside it, else the target itself (a landing).
const pickStagingRegion = (state, aggressorId, regionId) => {
  const held = getTouchingIds(regionId).filter((rid) => {
    const r = state.regions[rid];
    return r && (r.occupiedBy ? r.occupiedBy === aggressorId : r.owner === aggressorId);
  });
  if (held.length) return held[0];
  const centre = state.regions[regionId]?.tile;
  const near = centre == null ? [] : unitsWithinRings(state, centre, aggressorId, REINFORCE_RINGS);
  return near.find((u) => u.regionId && u.regionId !== regionId)?.regionId || regionId;
};

// How many units the assault should field: as many as the garrison when the two nations are evenly
// matched, scaling with the aggressor's share of their combined militaryStrength.
export const getAssaultSize = (garrisonCount, aggressorShare) =>
  Math.max(1, Math.min(MAX_ASSAULT_UNITS, Math.round(garrisonCount * 2 * aggressorShare)));

// Deterministic expeditionary troops, picked from the aggressor's current age roster.
export const buildSyntheticForce = ({ defenseId, aggressorId, ageId, count, seed }) => {
  if (count <= 0) return [];
  const available = getAvailableClasses(ageId);
  const weights = SYNTHETIC_CLASS_WEIGHTS.filter(([id]) => available.includes(id));
  const pool = weights.length ? weights : [[available[0] || 'infantry', 1]];
  const total = pool.reduce((s, [, w]) => s + w, 0);
  const rng = createRng(seed ^ 0x5bd1e995);
  // The first unit is always the backbone class, so the force can hold what it takes.
  return Array.from({ length: count }, (_, i) => {
    let classId = pool[0][0];
    if (i > 0) {
      let roll = rng.next() * total;
      for (const [id, w] of pool) { roll -= w; if (roll < 0) { classId = id; break; } }
    }
    return {
      id: `syn_${defenseId}_${i}`, regionId: null, ownerId: aggressorId, domain: 'land', classId,
      strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1,
      xp: 0, rank: 'recruit', promotions: [], commanderId: null, synthetic: true
    };
  });
};

// Real units of the aggressor standing within REINFORCE_RINGS tiles of the target that could join
// the assault, strongest first. Units already committed to another queued defense are skipped.
const pickRealAssaultUnits = (state, aggressorId, regionId, committed) => {
  const centre = state.regions[regionId]?.tile;
  if (centre == null) return [];
  return unitsWithinRings(state, centre, aggressorId, REINFORCE_RINGS)
    .filter((u) => u.domain === 'land' && !committed.has(u.id))
    .sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1));
};

// Builds one queued defense record. `seed` comes from the turn's rng.
export const createDefenseRecord = (state, { war, regionId, aggressorShare, seed, index, committed = new Set() }) => {
  const id = `d_${state.turnNumber}_${index}`;
  const garrison = getGarrison(state, regionId);
  const size = getAssaultSize(garrison.length, aggressorShare);
  const real = pickRealAssaultUnits(state, war.aggressor, regionId, committed).slice(0, size);
  real.forEach((u) => committed.add(u.id));
  const ageId = getEffectiveAgeId(state.age, getTechAgeId(state, war.aggressor));
  return {
    id,
    warId: war.id,
    aggressorId: war.aggressor,
    regionId,
    fromRegionId: pickStagingRegion(state, war.aggressor, regionId),
    attackerUnitIds: real.map((u) => u.id),
    synthetic: buildSyntheticForce({ defenseId: id, aggressorId: war.aggressor, ageId, count: size - real.length, seed }),
    defenderUnitIds: garrison.map((u) => u.id),
    seed,
    turn: state.turnNumber
  };
};

// Units in a queued defense can't be moved, disbanded or sent off to invade before it's fought.
export const isUnitInPendingDefense = (state, unitId) =>
  (state.pendingDefenses || []).some((d) => d.defenderUnitIds.includes(unitId));

// Both armies as they stand now. Units that died or left in the meantime are dropped.
export const getDefenseArmies = (state, def) => ({
  attackerUnits: [
    ...def.attackerUnitIds.map((id) => state.units[id]).filter((u) => u && u.strength > 0 && u.ownerId === def.aggressorId),
    ...(def.synthetic || []).map((u) => ({ ...u }))
  ],
  defenderUnits: def.defenderUnitIds.map((id) => state.units[id]).filter((u) => u && u.strength > 0 && u.regionId === def.regionId)
});

// Every number resolveBattle needs beyond the unit lists, with the player as the defender.
export const getDefenseBattleContext = (state, def) => {
  const region = state.regions[def.regionId];
  const fortLevel = (region.defenseLevel || 0) + getRegionModifier(state, def.regionId, 'local.fortLevel').total;
  return {
    terrain: getRegionTerrain(def.regionId, REGIONS_DATA),
    isAttackingFortification: (region.defenseLevel || 0) > 0,
    generals: state.hiredCommanders || {},
    attackerAgeId: getEffectiveAgeId(state.age, getTechAgeId(state, def.aggressorId)),
    defenderAgeId: getEffectiveAgeId(state.age, state.techAgeId),
    fortLevel,
    defenderDamageReductionMultiplier: getDefenseLevelDamageReductionMultiplier(fortLevel) * getZoneOfControlMultiplier(state.regions, def.regionId, region.owner)
  };
};

export const autoResolveDefense = (state, def) => {
  const armies = getDefenseArmies(state, def);
  const ctx = getDefenseBattleContext(state, def);
  return resolveBattle({
    attackerUnits: armies.attackerUnits,
    defenderUnits: armies.defenderUnits,
    terrain: ctx.terrain,
    isAttackingFortification: ctx.isAttackingFortification,
    generals: ctx.generals,
    attackerAgeId: ctx.attackerAgeId,
    defenderAgeId: ctx.defenderAgeId,
    defenderDamageReductionMultiplier: ctx.defenderDamageReductionMultiplier,
    rng: createRng(def.seed)
  });
};

const sumStrength = (units) => units.reduce((s, u) => s + Math.max(0, u.strength), 0);

// How hard an auto-resolved assault pressed the siege, from 0 to 1. Auto-resolve is ONE exchange
// per turn, and a single exchange almost never breaks a garrison outright (player invasions grind
// a region down over several turns). So instead of a win/lose coin, the siege damage follows the
// casualty exchange: breaking the garrison is full damage; an assault whose own line broke does
// nothing; anything in between scales with how much of the fighting went the attacker's way.
export const getAssaultPressure = (battle, before) => {
  if (battle.outcome === 'attacker') return 1;
  const deployed = battle.report?.deployedAttackerIds || [];
  const front = battle.attackerUnits.filter((u) => deployed.includes(u.id));
  if (front.length && front.every((u) => u.strength <= 0 || u.routed)) return 0;
  const shareA = before.attacker > 0 ? (before.attacker - sumStrength(battle.attackerUnits)) / before.attacker : 0;
  const shareD = before.defender > 0 ? (before.defender - sumStrength(battle.defenderUnits)) / before.defender : 0;
  return shareA + shareD > 0 ? Math.max(0, Math.min(1, shareD / (shareA + shareD))) : 0;
};

// resolveSiegeControlDamage's rule with the damage scaled by pressure.
const siegeFromPressure = (control, pressure, hasMeleeUnit) => {
  const damaged = Math.max(0, (control || 0) - Math.round(SIEGE_CONTROL_DAMAGE.attacker * pressure));
  if (pressure <= 0 || damaged > SIEGE_CAPTURE_CONTROL_THRESHOLD) return { nextControl: damaged, captured: false };
  return hasMeleeUnit ? { nextControl: damaged, captured: true } : { nextControl: SIEGE_CAPTURE_CONTROL_THRESHOLD, captured: false };
};

const removeDefense = (state, defId) => ({ ...state, pendingDefenses: (state.pendingDefenses || []).filter((d) => d.id !== defId) });

// Everything that follows a defense battle. `battle` has resolveBattle's shape. `pressure` is set
// for auto-resolved battles (getAssaultPressure); a commanded battle is fought to the finish, so
// its outcome alone decides the siege. `decisive` (commanded: the keep fell) takes the region.
export const applyDefenseResult = (state, def, battle, { decisive = false, xpBonusById = null, pressure = null } = {}) => {
  const cleared = removeDefense(state, def.id);
  const war = state.wars.find((w) => w.id === def.warId && w.active);
  const region = state.regions[def.regionId];
  // Peace was signed (or the region changed hands) before the battle was fought: nothing happens.
  if (!war || !region || region.owner !== state.playerNationId || region.occupiedBy) return cleared;

  const { outcome, attackerUnits, defenderUnits, report } = battle;
  const hasMeleeUnit = hasMeleeUnitDeployed(attackerUnits.filter((u) => u.strength > 0 && !u.routed));
  const garrisonBroken = isGarrisonBroken(defenderUnits);
  const siege = pressure === null || (outcome === 'attacker' && garrisonBroken)
    ? resolveSiegeControlDamage({ currentControl: region.control, outcome, hasMeleeUnit, garrisonBroken })
    : siegeFromPressure(region.control, pressure, hasMeleeUnit);
  const captured = siege.captured || (decisive && outcome === 'attacker');
  const damaged = siege.nextControl < (region.control || 0);
  // Who "won" for war score: an auto-resolved assault counts for the aggressor once it did most of
  // the damage it could have.
  const aggressorWon = pressure === null ? outcome === 'attacker' : pressure >= 0.5;
  const playerWon = pressure === null ? outcome === 'defender' : pressure < 0.5;

  const units = { ...state.units };
  // The garrison: XP for the troops who fought; if the region falls, the survivors fall back to a
  // neighbouring province the player still holds (or are lost if there's nowhere to go).
  const defenderXp = outcome === 'defender' ? XP_WIN : outcome === 'attacker' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
  const deployed = report?.deployedDefenderIds || [];
  const fallback = captured ? nearestHeldCity(state, def.regionId, state.playerNationId) : null;
  defenderUnits.forEach((u) => {
    if (!units[u.id]) return;
    if (u.strength <= 0 || (captured && !fallback)) { delete units[u.id]; return; }
    const gained = deployed.includes(u.id) ? Math.round(defenderXp * getGeneralXpMultiplier(state.hiredCommanders?.[u.commanderId])) + (xpBonusById?.[u.id] || 0) : 0;
    const next = gained ? awardXp({ ...units[u.id], strength: u.strength, morale: u.morale }, gained) : { ...units[u.id], strength: u.strength, morale: u.morale };
    units[u.id] = { ...(captured ? placeInCity(next, state.regions, fallback) : next), lastBattleTurn: state.turnNumber };
  });
  // The aggressor's real troops take their losses and stay where they are. Synthetic ones fold
  // back into militaryStrength, minus what they lost.
  let syntheticLoss = 0;
  attackerUnits.forEach((u) => {
    if (u.synthetic) {
      const start = (def.synthetic || []).find((s) => s.id === u.id)?.strength || 0;
      syntheticLoss += Math.max(0, start - Math.max(0, u.strength));
      return;
    }
    if (!units[u.id]) return;
    if (u.strength <= 0) delete units[u.id];
    else units[u.id] = { ...(captured ? placeInCity(units[u.id], state.regions, def.regionId) : units[u.id]), strength: u.strength, morale: u.morale, movesLeft: 0, lastBattleTurn: state.turnNumber };
  });
  const aggressor = state.nations[def.aggressorId];
  let nations = aggressor && syntheticLoss > 0
    ? { ...state.nations, [def.aggressorId]: { ...aggressor, militaryStrength: Math.max(100, (aggressor.militaryStrength || 0) - syntheticLoss) } }
    : state.nations;

  // A province that falls is conquered outright (src/engine/conquest.js) — the same rule as the
  // player's own invasions; win it back by invading it.
  let regions;
  if (captured) {
    ({ regions, nations } = conquerRegion({ regions: state.regions, nations, turnNumber: state.turnNumber }, def.regionId, def.aggressorId, war));
  } else {
    regions = { ...state.regions, [def.regionId]: { ...region, control: siege.nextControl, lastAttackedTurn: state.turnNumber, underInvasion: damaged } };
  }

  const winnerId = aggressorWon ? def.aggressorId : playerWon ? state.playerNationId : null;
  const wars = winnerId
    ? state.wars.map((w) => (w.id === war.id ? { ...w, battleScore: recordBattle(w, winnerId, aggressorWon ? (captured ? 0.3 : 0.15) : 0.2) } : w))
    : state.wars;

  const name = REGIONS_DATA[def.regionId]?.name || def.regionId;
  const enemy = aggressor?.name || def.aggressorId;
  const message = captured
    ? `${enemy} storms ${name} and conquers it!${fallback ? ` Your survivors fall back to ${REGIONS_DATA[fallback]?.name || fallback}.` : ''}`
    : damaged
      ? `${enemy} presses the siege of ${name} (control now ${siege.nextControl}%). Your garrison holds on.`
      : `Your garrison repels ${enemy}'s assault on ${name}!`;

  // The battle's cost to the land and people (src/engine/aftermath.js).
  const startOf = (u) => state.units[u.id] || (def.synthetic || []).find((sy) => sy.id === u.id) || { ...u, strength: u.maxStrength || u.strength };
  const outcomeForAftermath = pressure === null ? outcome : aggressorWon ? 'attacker' : playerWon ? 'defender' : 'draw';
  const aftermath = applyBattleAftermath({ ...state, regions, nations }, {
    regionId: def.regionId,
    beforeA: attackerUnits.map(startOf), afterA: attackerUnits,
    beforeD: defenderUnits.map(startOf), afterD: defenderUnits,
    attackerId: def.aggressorId, defenderId: state.playerNationId, outcome: outcomeForAftermath
  });

  return {
    ...cleared,
    units,
    nations: aftermath.nations,
    regions: aftermath.regions,
    hiredCommanders: aftermath.hiredCommanders,
    wars,
    ...recordBattleReport(state, { ...report, captured, defense: true, fromRegionId: def.fromRegionId, targetRegionId: def.regionId, attackerNationId: def.aggressorId, defenderNationId: state.playerNationId }, {
      attackers: attackerUnits, defenders: defenderUnits,
      // Synthetic attackers (an AI's abstract militaryStrength, fielded for this fight) aren't in state.units.
      beforeOf: (u) => (u.synthetic ? (def.synthetic || []).find((s) => s.id === u.id)?.strength : state.units[u.id]?.strength) ?? u.maxStrength ?? u.strength
    }),
    logs: [...state.logs, { year: state.year, message, type: LogTypes.COMBAT }, ...aftermath.logs]
  };
};

// Auto-resolves one queued defense (or all of them) into the log.
export const resolveDefenseAuto = (state, defId) => {
  const def = (state.pendingDefenses || []).find((d) => d.id === defId);
  if (!def) return state;
  const armies = getDefenseArmies(state, def);
  // The garrison left or was wiped out before the battle: the old dice roll's result stands, and
  // the region simply takes the siege damage.
  if (!armies.defenderUnits.length || !armies.attackerUnits.length) {
    return applyDefenseResult(state, def, {
      outcome: armies.attackerUnits.length ? 'attacker' : 'defender',
      attackerUnits: armies.attackerUnits,
      defenderUnits: armies.defenderUnits,
      report: { log: [], deployedAttackerIds: [], deployedDefenderIds: [] }
    });
  }
  const battle = autoResolveDefense(state, def);
  const pressure = getAssaultPressure(battle, { attacker: sumStrength(armies.attackerUnits), defender: sumStrength(armies.defenderUnits) });
  return applyDefenseResult(state, def, battle, { pressure });
};

export const resolveAllDefensesAuto = (state) =>
  (state.pendingDefenses || []).reduce((s, d) => resolveDefenseAuto(s, d.id), state);

// A quick preview for the Under-Attack sheet: how often the garrison holds (the assault does less
// than half the damage it could) and the average control it would lose, from `samples`
// auto-resolved runs. The attackers are marching at you in plain sight, so no intel is needed.
export const estimateDefenseOdds = (state, def, samples = 40) => {
  const armies = getDefenseArmies(state, def);
  if (!armies.defenderUnits.length) return { undefended: true, holdChance: 0, avgDamage: SIEGE_CONTROL_DAMAGE.attacker };
  const before = { attacker: sumStrength(armies.attackerUnits), defender: sumStrength(armies.defenderUnits) };
  let held = 0; let damage = 0;
  for (let i = 0; i < samples; i++) {
    const battle = autoResolveDefense(state, { ...def, seed: (def.seed + i * 0x9e3779b1) >>> 0 });
    const p = getAssaultPressure(battle, before);
    if (p < 0.5) held++;
    damage += SIEGE_CONTROL_DAMAGE.attacker * p;
  }
  return { undefended: false, holdChance: held / samples, avgDamage: Math.round(damage / samples) };
};

// ---- Withdrawing instead of fighting -----------------------------------------------------------

export const WITHDRAW_MORALE_LOSS = 25;
export const WITHDRAW_STRENGTH_LOSS = 0.05; // stragglers and abandoned baggage

// Where a garrison can fall back to: the nearest city the player owns and holds (armies.js
// nearestHeldCity, within FALLBACK_RINGS of the lost city).
export const getWithdrawalTarget = (state, regionId) => nearestHeldCity(state, regionId, state.playerNationId);

// The garrison gives up the province without a fight: it falls back to a neighbouring province
// (losing morale and some men on the way) and the enemy takes the province unopposed — a small
// war-score win for them, but no battle casualties. Refused when there's nowhere to fall back to.
export const applyDefenseWithdrawal = (state, defId) => {
  const def = (state.pendingDefenses || []).find((d) => d.id === defId);
  if (!def) return { ok: false, reason: 'no_defense', state };
  const war = state.wars.find((w) => w.id === def.warId && w.active);
  const region = state.regions[def.regionId];
  const cleared = removeDefense(state, def.id);
  if (!war || !region || region.owner !== state.playerNationId || region.occupiedBy) return { ok: true, state: cleared };
  const fallback = getWithdrawalTarget(state, def.regionId);
  if (!fallback) return { ok: false, reason: 'nowhere', state };
  const units = { ...state.units };
  def.defenderUnitIds.forEach((id) => {
    const u = units[id];
    if (!u) return;
    units[id] = {
      ...u,
      regionId: fallback,
      strength: Math.max(1, Math.round(u.strength * (1 - WITHDRAW_STRENGTH_LOSS))),
      morale: Math.max(0, (u.morale ?? 100) - WITHDRAW_MORALE_LOSS),
      movesLeft: 0
    };
  });
  const { regions, nations } = conquerRegion({ regions: state.regions, nations: state.nations, turnNumber: state.turnNumber }, def.regionId, def.aggressorId, war);
  const wars = state.wars.map((w) => (w.id === war.id ? { ...w, battleScore: recordBattle(w, def.aggressorId, 0.1) } : w));
  const name = REGIONS_DATA[def.regionId]?.name || def.regionId;
  const enemy = state.nations[def.aggressorId]?.name || def.aggressorId;
  return {
    ok: true,
    state: {
      ...cleared,
      units,
      regions,
      nations,
      wars,
      logs: [...state.logs, { year: state.year, message: `Your garrison abandons ${name} to ${enemy} and falls back to ${REGIONS_DATA[fallback]?.name || fallback}.`, type: LogTypes.COMBAT }]
    }
  };
};
