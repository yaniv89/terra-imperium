// src/engine/invasion.js
// The player's land invasion, split into its three real halves (Tactical Battles plan §5.2) so the
// two ways of fighting it — auto-resolve (resolveBattle) and a commanded real-time battle
// (src/battle/) — share EXACTLY the same entry gate and the same consequences:
//   validateInvasion        — may this invasion happen right now, and with which units?
//   getInvasionBattleContext — every number resolveBattle needs beyond the unit lists
//   applyInvasionResult     — everything that follows a battle: siege control damage, conquest,
//                             XP for units that fought, stack movement, war score, log, report
// LAUNCH_INVASION (gameReducer.js) is now just these three around one resolveBattle call; the
// tactical path swaps only the middle step for a simulated battle producing the same result shape.
import { LogTypes } from '../data/types';
import { REGIONS_DATA, getNeighborIds } from '../data/regions';
import { getRegionTerrain } from '../data/terrain';
import { getEffectiveAgeId } from '../data/ages';
import { ACTION_COSTS } from '../data/actionCosts';
import { awardXp } from '../data/promotions';
import { getGeneralXpMultiplier } from '../data/generals';
import { canAfford } from '../utils/helpers';
import { isWarBetween, recordBattle } from './diplomacy';
import { getRegionModifier } from './modifiers/sheet';
import { getDefenseLevelDamageReductionMultiplier, hasMeleeUnitDeployed, resolveSiegeControlDamage, getZoneOfControlMultiplier, isGarrisonBroken } from './siege';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { conquerRegion } from './conquest';

// Units committed to an in-progress tactical battle can't be moved, disbanded or sent into a
// second fight until it resolves.
export const isUnitInBattle = (state, unitId) => {
  // A garrison with an assault queued against it (src/engine/defense.js) is committed too.
  if ((state.pendingDefenses || []).some((d) => d.defenderUnitIds.includes(unitId))) return true;
  const pb = state.pendingBattle;
  if (!pb) return false;
  if (pb.navalUnitId === unitId) return true; // the fleet carrying a commanded landing
  if ((pb.attackerUnitIds || []).includes(unitId) || (pb.defenderUnitIds || []).includes(unitId)) return true;
  // Troops standing by in neighbouring provinces as possible reinforcements are committed too.
  return [...(pb.attackerReinforcements || []), ...(pb.defenderReinforcements || [])].some((src) => src.unitIds.includes(unitId));
};

// Idle land troops in provinces next to the battle that a side could call in as reinforcements
// (RoN Conquer the World): owned by that nation, in land it owns and actually holds, with their
// move still available, not already in the battle and not aboard a ship.
export const getReinforcementSources = (state, targetRegionId, nationId, excludeRegionIds = []) => getNeighborIds(targetRegionId)
  .filter((rid) => !excludeRegionIds.includes(rid))
  .filter((rid) => state.regions[rid]?.owner === nationId && !state.regions[rid]?.occupiedBy)
  .map((rid) => ({
    regionId: rid,
    unitIds: Object.values(state.units)
      .filter((u) => u.regionId === rid && u.ownerId === nationId && u.domain === 'land' && !u.embarkedOn && (u.movesLeft ?? 1) > 0 && u.strength > 0)
      .map((u) => u.id)
  }))
  .filter((src) => src.unitIds.length > 0);

// The commander powers a nation brings into a battle, from what it really has (Tactical Battles
// plan §8.8): everyone can rally; the arrow storm belongs to the early ages; artillery needs a
// siege unit in the fight; an air strike needs aircraft; a recon satellite gives a sweep; missiles
// come out of the real stockpile (one use per missile); only the player may use a nuclear strike.
export const getBattlePowers = (state, nationId, ageId, units = [], { allowNuclear = false } = {}) => {
  const out = [{ id: 'rallyCry' }];
  if (['bronze', 'classical', 'kingdoms'].includes(ageId)) out.push({ id: 'arrowStorm' });
  if (['gunpowder', 'modern'].includes(ageId) && units.some((u) => u.classId === 'siege')) out.push({ id: 'artilleryBarrage' });
  if (ageId === 'modern' && units.some((u) => u.classId === 'air')) out.push({ id: 'airStrike' });
  if (Object.values(state.satellites || {}).some((sat) => sat.ownerId === nationId && sat.typeId === 'recon')) out.push({ id: 'satelliteSweep' });
  const missiles = state.nations?.[nationId]?.missiles || {};
  if (missiles.tactical > 0) out.push({ id: 'missileTactical', uses: missiles.tactical });
  if (missiles.theatre > 0) out.push({ id: 'missileTheatre', uses: missiles.theatre });
  if (allowNuclear && missiles.nuclear > 0) out.push({ id: 'nuclearStrike', uses: missiles.nuclear });
  return out;
};

export const MISSILE_POWER_TIERS = { missileTactical: 'tactical', missileTheatre: 'theatre', nuclearStrike: 'nuclear' };

export const validateInvasion = (state, fromRegionId, targetRegionId, { ignoreCost = false, ignoreBattleLocks = false } = {}) => {
  const fromRegion = state.regions[fromRegionId];
  const targetRegion = state.regions[targetRegionId];
  if (!fromRegion || fromRegion.owner !== state.playerNationId) return { ok: false, reason: 'not_your_region' };
  if (!targetRegion || targetRegion.owner === state.playerNationId) return { ok: false, reason: 'bad_target' };
  // Already held by your army (an occupation from an older save): there is nothing left to fight.
  if (targetRegion.occupiedBy === state.playerNationId) return { ok: false, reason: 'already_held' };
  if (!getNeighborIds(fromRegionId).includes(targetRegionId)) return { ok: false, reason: 'not_adjacent' };
  // Plan §M13: invasions require an active war with the target's owner.
  const war = state.wars.find((w) => w.active && isWarBetween(w, state.playerNationId, targetRegion.owner));
  if (!war) return { ok: false, reason: 'no_war' };
  if (!ignoreCost && !canAfford(state.resources, ACTION_COSTS.launchInvasion)) return { ok: false, reason: 'cost' };

  const attackerUnits = Object.values(state.units).filter((u) => u.regionId === fromRegionId && u.ownerId === state.playerNationId && u.domain === 'land' && (ignoreBattleLocks || !isUnitInBattle(state, u.id)));
  if (attackerUnits.length === 0) return { ok: false, reason: 'no_units' };
  // Plan §M14: one attack per stack per turn — every unit in the attacking stack must still have
  // its move (all-or-nothing on the whole stack, matching "an army is every unit in one region").
  if (!ignoreBattleLocks && !attackerUnits.every((u) => (u.movesLeft ?? 1) > 0)) return { ok: false, reason: 'no_moves' };
  // The garrison is whoever else stands there — never the player's own troops.
  const defenderUnits = Object.values(state.units).filter((u) => u.regionId === targetRegionId && u.domain === 'land' && u.ownerId !== state.playerNationId);
  return { ok: true, war, fromRegion, targetRegion, attackerUnits, defenderUnits };
};

export const getInvasionBattleContext = (state, { targetRegionId, targetRegion, defenderUnits }) => {
  // An undefended region is taken in one hit regardless of its control — walking into an empty
  // city needs no siege. Only a real garrison triggers the multi-turn control grind.
  const isDefended = defenderUnits.length > 0;
  return {
    terrain: getRegionTerrain(targetRegionId, REGIONS_DATA),
    isDefended,
    isAttackingFortification: (targetRegion.defenseLevel || 0) > 0,
    generals: state.hiredCommanders,
    // Plan §M14: each side's roster stats are looked up live from its OWNER's current effective
    // age. The defender has no independent tech age here, so it fights at the calendar age.
    attackerAgeId: getEffectiveAgeId(state.age, state.techAgeId),
    defenderAgeId: state.age,
    // defenseLevel's own damage reduction ("Walls", src/engine/siege.js); plan §M6: the Defense
    // building's local.fortLevel stacks on top of the manual defenseLevel. Plan §M14 folds Zone
    // of Control into the same slot — a fortified neighbor makes a siege harder too.
    defenderDamageReductionMultiplier: isDefended
      ? getDefenseLevelDamageReductionMultiplier((targetRegion.defenseLevel || 0) + getRegionModifier(state, targetRegionId, 'local.fortLevel').total) * getZoneOfControlMultiplier(state.regions, targetRegionId, targetRegion.owner)
      : 1
  };
};

// The resolveBattle options for a validated invasion (everything except the rng).
export const getResolveBattleArgs = (v, ctx) => ({
  attackerUnits: v.attackerUnits,
  defenderUnits: v.defenderUnits,
  terrain: ctx.terrain,
  isAttackingFortification: ctx.isAttackingFortification,
  generals: ctx.generals,
  attackerAgeId: ctx.attackerAgeId,
  defenderAgeId: ctx.defenderAgeId,
  defenderDamageReductionMultiplier: ctx.defenderDamageReductionMultiplier
});

export const XP_WIN = 30;
export const XP_LOSE = 15;

// Everything that follows the battle. `battle` is resolveBattle's own shape ({ outcome,
// attackerUnits, defenderUnits, report }). `decisive` (commanded battles only: the keep was taken
// and assimilated) captures the region outright instead of grinding its control down.
// `xpBonusById` (commanded battles only) adds a small, capped skill bonus on top of the normal XP.
export const applyInvasionResult = (state, { fromRegionId, targetRegionId, war, targetRegion, isDefended }, battle, { rngSeed, decisive = false, xpBonusById = null } = {}) => {
  const { outcome, attackerUnits: resolvedAttackers, defenderUnits: resolvedDefenders, report } = battle;

  // A defended region's control absorbs the damage instead of an outright flip — see
  // src/engine/siege.js's file header. `captured` here means the siege is actually over.
  const siege = isDefended
    ? resolveSiegeControlDamage({
        currentControl: targetRegion.control,
        outcome,
        hasMeleeUnit: hasMeleeUnitDeployed(resolvedAttackers.filter(u => u.strength > 0 && !u.routed)),
        garrisonBroken: isGarrisonBroken(resolvedDefenders)
      })
    : { nextControl: targetRegion.control, captured: outcome === 'attacker' };
  const nextControl = siege.nextControl;
  const captured = siege.captured || (decisive && outcome === 'attacker');

  // Only units actually deployed to the front line fought and earn XP; the winning side earns
  // more than the losing side, a draw splits the difference. A Logistician-commanded unit earns
  // extra on top (see src/data/generals.js).
  const attackerXpAmount = outcome === 'attacker' ? XP_WIN : outcome === 'defender' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
  const defenderXpAmount = outcome === 'defender' ? XP_WIN : outcome === 'attacker' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
  const awardBattleXp = (units, deployedIds, xpAmount) => units.map(u => {
    if (!deployedIds.includes(u.id)) return u;
    const gained = Math.round(xpAmount * getGeneralXpMultiplier(state.hiredCommanders[u.commanderId])) + (xpBonusById?.[u.id] || 0);
    return awardXp(u, gained);
  });
  const xpAttackers = awardBattleXp(resolvedAttackers, report.deployedAttackerIds, attackerXpAmount);
  const xpDefenders = awardBattleXp(resolvedDefenders, report.deployedDefenderIds, defenderXpAmount);

  const nextUnits = { ...state.units };
  // Attacker survivors occupy the target region only once it's actually captured; a round that
  // merely damages a still-defended region's control falls back to origin, same as a loss —
  // each further round of the grind is a fresh, separately-paid invasion. Plan §M14: spends the
  // whole stack's move (one attack per stack per turn) and marks it as having fought this turn,
  // so resolveTurn.js's reinforcement/morale-recovery phase skips it.
  xpAttackers.forEach(u => {
    if (u.strength <= 0) { delete nextUnits[u.id]; return; }
    nextUnits[u.id] = { ...u, regionId: captured ? targetRegionId : fromRegionId, movesLeft: 0, lastBattleTurn: state.turnNumber };
  });
  // A captured region's garrison doesn't remain a coherent defending force — on actual capture
  // the whole defending side is cleared, survivors and routed alike. A round that only damages
  // control (siege continues) persists surviving defenders exactly like a repelled attack does.
  xpDefenders.forEach(u => {
    if (captured || u.strength <= 0) { delete nextUnits[u.id]; return; }
    nextUnits[u.id] = { ...u, lastBattleTurn: state.turnNumber };
  });

  // Conquest: the province is yours the moment it falls (src/engine/conquest.js).
  let nextRegions = { ...state.regions };
  let nextNations = state.nations;
  let capitalTaken = false;
  if (captured) {
    ({ regions: nextRegions, nations: nextNations, capitalTaken } = conquerRegion({ regions: nextRegions, nations: state.nations, turnNumber: state.turnNumber }, targetRegionId, state.playerNationId, war));
  } else if (isDefended) {
    nextRegions[targetRegionId] = { ...targetRegion, control: nextControl, lastAttackedTurn: state.turnNumber, underInvasion: true };
  }

  // War score (plan §M13): this invasion counts as a battle in `war` regardless of which side of
  // it the player is on, feeding the same score the AI's own peace decisions read.
  const invasionLossShare = captured ? 0.4 : (outcome === 'attacker' ? 0.2 : outcome === 'defender' ? 0.2 : null);
  const invasionWinnerId = outcome === 'attacker' ? state.playerNationId : outcome === 'defender' ? targetRegion.owner : null;
  const nextWars = invasionWinnerId
    ? state.wars.map(w => (w.id === war.id ? { ...w, battleScore: recordBattle(w, invasionWinnerId, invasionLossShare) } : w))
    : state.wars;

  const outcomeMessage = captured
    ? `${REGIONS_DATA[targetRegionId]?.name} is conquered — taken from ${state.nations[targetRegion.owner]?.name || targetRegion.owner}, it is now yours${capitalTaken ? ' (their capital has fallen!)' : ''}. Hold it: it starts restless (control 25%).`
    : outcome === 'attacker'
      ? `Your forces broke through at ${REGIONS_DATA[targetRegionId]?.name} (control now ${nextControl}%), but could not yet secure it.`
      : outcome === 'defender'
        ? `Your invasion of ${REGIONS_DATA[targetRegionId]?.name} was repelled.`
        : `Your invasion of ${REGIONS_DATA[targetRegionId]?.name} ended in a mutual withdrawal.`;

  return {
    ...state,
    regions: nextRegions,
    nations: nextNations,
    units: nextUnits,
    wars: nextWars,
    rngSeed,
    lastBattleReport: { ...report, captured, fromRegionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner },
    logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
  };
};

// ---- Amphibious landings (AMPHIBIOUS_ASSAULT, and the commanded landing of Tactical Battles T9) ----

// No foothold next to the target: the landing itself fights at a malus.
export const AMPHIBIOUS_PENALTY_MULT = 0.75;

// May this fleet land its troops on `targetRegionId` right now? Mirrors AMPHIBIOUS_ASSAULT's gate.
export const validateAmphibious = (state, navalUnitId, targetRegionId, { ignoreCost = false, ignoreBattleLocks = false } = {}) => {
  const navalUnit = state.units[navalUnitId];
  const targetRegion = state.regions[targetRegionId];
  if (!navalUnit || navalUnit.ownerId !== state.playerNationId || navalUnit.domain !== 'naval') return { ok: false, reason: 'bad_fleet' };
  if (!targetRegion || targetRegion.owner === state.playerNationId) return { ok: false, reason: 'bad_target' };
  if (targetRegion.occupiedBy === state.playerNationId) return { ok: false, reason: 'already_held' };
  if (!isCoastal(targetRegionId)) return { ok: false, reason: 'not_coastal' };
  if (!getNeighborIds(navalUnit.regionId).includes(targetRegionId) && !isReachableBySea(navalUnit.regionId, targetRegionId, state.age)) return { ok: false, reason: 'out_of_reach' };
  const embarkedLandUnits = Object.values(state.units).filter((u) => u.embarkedOn === navalUnitId && u.ownerId === state.playerNationId);
  if (embarkedLandUnits.length === 0) return { ok: false, reason: 'no_units' };
  const war = state.wars.find((w) => w.active && isWarBetween(w, state.playerNationId, targetRegion.owner));
  if (!war) return { ok: false, reason: 'no_war' };
  if (!ignoreBattleLocks && ((navalUnit.movesLeft ?? 1) <= 0 || !embarkedLandUnits.every((u) => (u.movesLeft ?? 1) > 0))) return { ok: false, reason: 'no_moves' };
  if (!ignoreCost && !canAfford(state.resources, ACTION_COSTS.amphibiousAssault)) return { ok: false, reason: 'cost' };
  const defenderNavalUnits = Object.values(state.units).filter((u) => u.regionId === targetRegionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
  const defenderLandUnits = Object.values(state.units).filter((u) => u.regionId === targetRegionId && u.domain === 'land' && u.ownerId !== state.playerNationId);
  const hasBeachhead = getNeighborIds(targetRegionId).some((nId) => state.regions[nId]?.owner === state.playerNationId);
  return { ok: true, navalUnit, targetRegionId, targetRegion, war, embarkedLandUnits, defenderNavalUnits, defenderLandUnits, hasBeachhead };
};

// The resolveBattle options for a landing's land battle (everything but the armies and the rng),
// exactly as AMPHIBIOUS_ASSAULT computes them.
export const getAmphibiousBattleContext = (state, v, defenderLandUnits) => {
  const isDefended = defenderLandUnits.length > 0;
  return {
    terrain: getRegionTerrain(v.targetRegionId, REGIONS_DATA),
    isAttackingFortification: (v.targetRegion.defenseLevel || 0) > 0,
    generals: state.hiredCommanders,
    attackerAgeId: getEffectiveAgeId(state.age, state.techAgeId),
    defenderAgeId: state.age,
    attackerPenaltyMultiplier: v.hasBeachhead ? 1 : AMPHIBIOUS_PENALTY_MULT,
    defenderDamageReductionMultiplier: isDefended
      ? getDefenseLevelDamageReductionMultiplier((v.targetRegion.defenseLevel || 0) + getRegionModifier(state, v.targetRegionId, 'local.fortLevel').total) * getZoneOfControlMultiplier(state.regions, v.targetRegionId, v.targetRegion.owner)
      : 1
  };
};

// Everything that follows the land battle of a landing. `state.units` already reflects any naval
// interception. Survivors go ashore only once the region is taken; otherwise they're back aboard.
export const applyAmphibiousLanding = (state, { navalUnitId, fromRegionId, targetRegionId, war, targetRegion, isDefended }, battle, { rngSeed, decisive = false, xpBonusById = null } = {}) => {
  const { outcome, attackerUnits: resolvedAttackers, defenderUnits: resolvedDefenders, report } = battle;
  const nextUnits = { ...state.units };
  // See src/engine/siege.js — a defended region's control absorbs the damage instead of an
  // outright flip; undefended coastline is still taken in one landing.
  const siege = isDefended
    ? resolveSiegeControlDamage({
        currentControl: targetRegion.control,
        outcome,
        hasMeleeUnit: hasMeleeUnitDeployed(resolvedAttackers.filter(u => u.strength > 0 && !u.routed)),
        garrisonBroken: isGarrisonBroken(resolvedDefenders)
      })
    : { nextControl: targetRegion.control, captured: outcome === 'attacker' };
  const nextControl = siege.nextControl;
  const captured = siege.captured || (decisive && outcome === 'attacker');

  const attackerXpAmount = outcome === 'attacker' ? XP_WIN : outcome === 'defender' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
  const defenderXpAmount = outcome === 'defender' ? XP_WIN : outcome === 'attacker' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
  const awardBattleXp = (units, deployedIds, xpAmount) => units.map(u => {
    if (!deployedIds.includes(u.id)) return u;
    const gained = Math.round(xpAmount * getGeneralXpMultiplier(state.hiredCommanders[u.commanderId])) + (xpBonusById?.[u.id] || 0);
    return awardXp(u, gained);
  });
  const xpAttackers = awardBattleXp(resolvedAttackers, report.deployedAttackerIds, attackerXpAmount);
  const xpDefenders = awardBattleXp(resolvedDefenders, report.deployedDefenderIds, defenderXpAmount);

  // Survivors disembark onto the beach only once it's actually captured; a round that merely
  // damages a still-defended region's control falls back aboard the transport, still embarked,
  // for another attempt — matching how a land LAUNCH_INVASION falls back to origin.
  xpAttackers.forEach(u => {
    if (u.strength <= 0) { delete nextUnits[u.id]; return; }
    nextUnits[u.id] = captured
      ? { ...u, regionId: targetRegionId, embarkedOn: null, movesLeft: 0, lastBattleTurn: state.turnNumber }
      : { ...u, regionId: fromRegionId, embarkedOn: navalUnitId, movesLeft: 0, lastBattleTurn: state.turnNumber };
  });
  xpDefenders.forEach(u => {
    if (captured || u.strength <= 0) { delete nextUnits[u.id]; return; }
    nextUnits[u.id] = { ...u, lastBattleTurn: state.turnNumber };
  });
  if (nextUnits[navalUnitId]) nextUnits[navalUnitId] = { ...nextUnits[navalUnitId], movesLeft: 0, lastBattleTurn: state.turnNumber };

  let nextRegions = { ...state.regions };
  let nextNations = state.nations;
  let capitalTaken = false;
  if (captured) {
    ({ regions: nextRegions, nations: nextNations, capitalTaken } = conquerRegion({ regions: nextRegions, nations: state.nations, turnNumber: state.turnNumber }, targetRegionId, state.playerNationId, war));
  } else if (isDefended) {
    nextRegions[targetRegionId] = { ...targetRegion, control: nextControl, lastAttackedTurn: state.turnNumber, underInvasion: true };
  }

  const assaultLossShare = captured ? 0.4 : (outcome === 'attacker' ? 0.2 : outcome === 'defender' ? 0.2 : null);
  const assaultWinnerId = outcome === 'attacker' ? state.playerNationId : outcome === 'defender' ? targetRegion.owner : null;
  const nextWars = assaultWinnerId
    ? state.wars.map(w => (w.id === war.id ? { ...w, battleScore: recordBattle(w, assaultWinnerId, assaultLossShare) } : w))
    : state.wars;

  const outcomeMessage = captured
    ? `Your amphibious assault conquers ${REGIONS_DATA[targetRegionId]?.name} from ${state.nations[targetRegion.owner]?.name || targetRegion.owner} — it is now yours${capitalTaken ? ' (their capital has fallen!)' : ''}.`
    : outcome === 'attacker'
      ? `Your landing broke through at ${REGIONS_DATA[targetRegionId]?.name} (control now ${nextControl}%), but could not yet secure it.`
      : outcome === 'defender'
        ? `Your amphibious assault on ${REGIONS_DATA[targetRegionId]?.name} was repelled.`
        : `Your amphibious assault on ${REGIONS_DATA[targetRegionId]?.name} ended in a mutual withdrawal.`;

  return {
    ...state,
    regions: nextRegions,
    nations: nextNations,
    units: nextUnits,
    wars: nextWars,
    rngSeed,
    lastBattleReport: { ...report, captured, kind: 'amphibious', fromRegionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner },
    logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
  };
};
