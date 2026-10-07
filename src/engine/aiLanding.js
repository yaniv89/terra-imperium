// src/engine/aiLanding.js
// An AI landing on the player's coast waits in the battle queue (battleQueue.js) for the player's
// Command or Auto, like every other battle an AI starts against the player (master plan decision
// 24, 6.1; phase R3 step 2). The AI's naval operations (aiOperations.js processAINavalOperations)
// queue it instead of fighting it at once:
//   'intercept'  the player's fleets at the target city meet the transport first (the naval
//                interception of AMPHIBIOUS_ASSAULT): a sea battle; a beaten transport sinks with
//                everything aboard, a winning one sails on to land
//   'landing'    the landing itself: the AI's embarked army against the city's garrison and its
//                militia, the real city on the battle map (an amphibious assault, full base-building)
// The intercept record comes first, so the queue fights them in that order; a landing whose fleet
// went down (or whose war ended, or whose city changed hands) is dropped unfought. The AI pays the
// assault's cost and spends the fleet's and the troops' moves when it queues. Both kinds end in the
// one outcome service (battleOutcome.js: 'lane' for the interception, 'landing' for the landing),
// under the queued record's id, so Command and Auto can never both land. Pure.
import { getRegionTerrain } from '../data/terrain';
import { REGIONS_DATA } from '../data/regions';
import { getEffectiveAgeId } from '../data/ages';
import { LogTypes } from '../data/types';
import { createRng } from '../utils/rng';
import { getTechAgeId } from './nationState';
import { resolveAutoBattle } from './autoBattle';
import { applyBattleOutcome, makeBattleOutcome } from './battleOutcome';
import { validateAmphibious, getAmphibiousBattleContext, applyAmphibiousLanding } from './invasion';
import { cityMilitia } from './battleInputs';
import { hashRoll } from './aftermath';

export const LANDING_KINDS = ['intercept', 'landing'];
export const isLandingKind = (kind) => LANDING_KINDS.includes(kind);

const viewOf = (state, nationId) => ({ ...state, playerNationId: nationId, techAgeId: getTechAgeId(state, nationId) });
const drop = (state, id) => ({ ...state, pendingDefenses: (state.pendingDefenses || []).filter((d) => d.id !== id) });

/** The player's fleets (any fleet not the lander's) in the target city's waters. */
const interceptorsAt = (state, regionId, aggressorId) => Object.values(state.units)
  .filter((u) => u.regionId === regionId && u.domain === 'naval' && u.strength > 0 && u.ownerId !== aggressorId).sort((a, b) => (a.id < b.id ? -1 : 1));

/**
 * The queue records of an AI landing on the player's coast: [intercept?, landing]. `v` is
 * validateAmphibious run as the aggressor.
 */
export const landingRecords = (state, v, aggressorId) => {
  const seed = (what) => Math.floor(hashRoll(`${v.navalUnit.id}|${state.turnNumber}|${what}`) * 4294967296) >>> 0;
  const base = { warId: v.war?.id ?? null, aggressorId, navalUnitId: v.navalUnit.id, fromRegionId: v.navalUnit.regionId, regionId: v.targetRegionId, synthetic: [], turn: state.turnNumber };
  const out = [];
  const fleets = interceptorsAt(state, v.targetRegionId, aggressorId);
  if (fleets.length) out.push({ ...base, id: `ic_${state.turnNumber}_${aggressorId}_${v.navalUnit.id}`, kind: 'intercept', attackerUnitIds: [v.navalUnit.id], defenderUnitIds: fleets.map((u) => u.id), seed: seed('intercept') });
  out.push({
    ...base, id: `ld_${state.turnNumber}_${aggressorId}_${v.navalUnit.id}`, kind: 'landing', hasBeachhead: v.hasBeachhead,
    attackerUnitIds: v.embarkedLandUnits.map((u) => u.id), defenderUnitIds: v.defenderLandUnits.map((u) => u.id),
    militia: cityMilitia(state, v.targetRegionId), seed: seed('landing')
  });
  return out;
};

/** The interception's fleets as they stand: { attackerUnits: [transport], defenderUnits } or null. */
export const interceptArmies = (state, def) => {
  const ship = state.units[def.navalUnitId];
  if (!ship || !(ship.strength > 0)) return null;
  const defenderUnits = def.defenderUnitIds.map((id) => state.units[id]).filter((u) => u && u.strength > 0 && u.domain === 'naval' && u.regionId === def.regionId);
  return defenderUnits.length ? { attackerUnits: [ship], defenderUnits } : null;
};

/** resolveBattle's arguments for the interception. */
export const interceptArgs = (state, def, armies) => ({
  attackerUnits: armies.attackerUnits, defenderUnits: armies.defenderUnits, terrain: getRegionTerrain(def.regionId, REGIONS_DATA), isAttackingFortification: false,
  generals: state.hiredCommanders, attackerAgeId: getEffectiveAgeId(state.age, getTechAgeId(state, def.aggressorId)), defenderAgeId: getEffectiveAgeId(state.age, state.techAgeId)
});

/** Fight (or apply) the interception: `battle` is the commanded result or null for Auto. */
export const resolveInterceptQueued = (state, def, battle = null, { mode = 'auto', xpBonusById = null } = {}) => {
  const armies = interceptArmies(state, def);
  if (!armies) return drop(state, def.id); // the transport is gone, or nothing stands in its way
  const fought = battle || resolveAutoBattle(state, interceptArgs(state, def, armies), { kind: 'lane' }, createRng(def.seed));
  const sunk = fought.outcome !== 'attacker';
  const result = sunk ? { ...fought, attackerUnits: fought.attackerUnits.map((u) => (u.id === def.navalUnitId ? { ...u, strength: 0 } : u)) } : fought;
  const meta = { id: def.id, defenseId: def.id, kind: 'lane', mode, warId: def.warId, attackerNationId: def.aggressorId, defenderNationId: state.playerNationId, viewerId: state.playerNationId, fromRegionId: def.fromRegionId, regionId: def.regionId, attackerStart: armies.attackerUnits, defenderStart: armies.defenderUnits, xpBonusById, rngSeed: state.rngSeed };
  let next = applyBattleOutcome(state, makeBattleOutcome(meta, result));
  if (next === state || !sunk) return next;
  // The transport went down with everything aboard: the landing never comes.
  const units = { ...next.units };
  delete units[def.navalUnitId];
  Object.values(units).forEach((u) => { if (u.embarkedOn === def.navalUnitId) delete units[u.id]; });
  next = { ...next, units, pendingDefenses: (next.pendingDefenses || []).filter((d) => !(d.kind === 'landing' && d.navalUnitId === def.navalUnitId)) };
  return { ...next, logs: [...next.logs, { year: next.year, message: `Your fleet sank ${state.nations[def.aggressorId]?.name || 'the enemy'}'s invasion fleet off ${state.regions[def.regionId]?.name || 'the coast'}.`, type: LogTypes.COMBAT }] };
};

/** The landing's armies as they stand, through the aggressor's gate: { v, attackerUnits, defenderUnits } or null. */
export const landingArmies = (state, def) => {
  const v = validateAmphibious(viewOf(state, def.aggressorId), def.navalUnitId, def.regionId, { ignoreCost: true, ignoreBattleLocks: true });
  if (!v.ok) return null;
  const attackerUnits = v.embarkedLandUnits.filter((u) => def.attackerUnitIds.includes(u.id));
  if (!attackerUnits.length) return null;
  return { v: { ...v, hasBeachhead: def.hasBeachhead ?? v.hasBeachhead }, attackerUnits, defenderUnits: v.defenderLandUnits };
};

/** resolveBattle's arguments for the landing (the aggressor's context). */
export const landingArgs = (state, def, armies) => ({ attackerUnits: armies.attackerUnits, defenderUnits: armies.defenderUnits, ...getAmphibiousBattleContext(viewOf(state, def.aggressorId), armies.v, armies.defenderUnits) });

/** Fight (or apply) the landing: `battle` is the commanded result or null for Auto. */
export const resolveLandingQueued = (state, def, battle = null, { mode = 'auto', decisive = false, xpBonusById = null } = {}) => {
  const armies = landingArmies(state, def);
  if (!armies) return drop(state, def.id); // the fleet sank, peace came, or the city changed hands
  const fought = battle || resolveAutoBattle(state, landingArgs(state, def, armies), { kind: 'landing', cityId: def.regionId, fromRegionId: def.fromRegionId, militia: def.militia || null }, createRng(def.seed));
  const { v } = armies;
  const next = applyAmphibiousLanding(state, { navalUnitId: def.navalUnitId, fromRegionId: def.fromRegionId, targetRegionId: def.regionId, war: v.war, targetRegion: v.targetRegion, isDefended: armies.defenderUnits.length > 0 }, fought, {
    rngSeed: state.rngSeed, id: def.id, defenseId: def.id, attackerNationId: def.aggressorId, viewerId: state.playerNationId, mode, decisive, xpBonusById, militia: fought.inputs?.militia || def.militia || []
  });
  return next === state ? drop(state, def.id) : next;
};

/** Odds for the queue sheet: how often the player's side holds on Auto, `samples` runs. */
export const landingHoldChance = (state, def, samples = 30) => {
  const isIntercept = def.kind === 'intercept';
  const armies = isIntercept ? interceptArmies(state, def) : landingArmies(state, def);
  if (!armies) return { armies: null, holdChance: 1 };
  const args = isIntercept ? interceptArgs(state, def, armies) : landingArgs(state, def, armies);
  let held = 0;
  for (let i = 0; i < samples; i++) {
    const r = resolveAutoBattle(state, args, isIntercept ? { kind: 'lane' } : { kind: 'landing', cityId: def.regionId, fromRegionId: def.fromRegionId, militia: def.militia || null }, createRng((def.seed + i * 0x9e3779b1) >>> 0));
    if (r.outcome !== 'attacker') held += 1;
  }
  return { armies, holdChance: held / samples };
};
