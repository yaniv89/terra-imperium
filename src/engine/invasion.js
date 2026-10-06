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
import { withAirSupport } from './airPower';
import { REGIONS_DATA, getNeighborIds, getTouchingIds } from '../data/regions';
import { getRegionTerrain } from '../data/terrain';
import { getEffectiveAgeId } from '../data/ages';
import { ACTION_COSTS } from '../data/actionCosts';
import { canAfford } from '../utils/helpers';
import { isWarBetween } from './diplomacy';
import { canAttack } from './hostility';
import { getRegionModifier } from './modifiers/sheet';
import { getDefenseLevelDamageReductionMultiplier, getZoneOfControlMultiplier } from './siege';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { applyBattleOutcome, makeBattleOutcome, battleIdOf, XP_WIN, XP_LOSE, MISSILE_POWER_TIERS } from './battleOutcome';
import { getTiles } from '../data/geo/tiles';
import { touchesCity, unitTile, unitsWithinRings, REINFORCE_RINGS } from './armies';
import { atSea, touchesCoastOf } from './fleets';
import { LANDING_ATTACK_MULT } from '../battle/setup/battleType';

// Units committed to an in-progress tactical battle can't be moved, disbanded or sent into a
// second fight until it resolves.
export const isUnitInBattle = (state, unitId) => {
  // A garrison with an assault queued against it (src/engine/defense.js) is committed too.
  if ((state.pendingDefenses || []).some((d) => (d.defenderUnitIds.includes(unitId) || d.attackerUnitIds.includes(unitId)))) return true;
  const pb = state.pendingBattle;
  if (!pb) return false;
  if (pb.navalUnitId === unitId) return true; // the fleet carrying a commanded landing
  if ((pb.attackerUnitIds || []).includes(unitId) || (pb.defenderUnitIds || []).includes(unitId)) return true;
  // Troops standing by in neighbouring provinces as possible reinforcements are committed too.
  return [...(pb.attackerReinforcements || []), ...(pb.defenderReinforcements || [])].some((src) => src.unitIds.includes(unitId));
};

// Idle land troops near the battle that a side could call in as reinforcements (RoN Conquer the
// World): owned by that nation, standing within REINFORCE_RINGS tiles of the city's centre (not in
// the city itself, not in an excluded region such as the attack's origin), with their move still
// available and not aboard a ship. Grouped by the region they belong to, for the battlefield edge.
export const getReinforcementSources = (state, targetRegionId, nationId, excludeRegionIds = []) => {
  const centre = state.regions[targetRegionId]?.tile;
  if (centre == null) return [];
  const byRegion = new Map();
  unitsWithinRings(state, centre, nationId, REINFORCE_RINGS)
    .filter((u) => u.domain === 'land' && (u.movesLeft ?? 1) > 0 && u.regionId !== targetRegionId && !excludeRegionIds.includes(u.regionId))
    .forEach((u) => { const rid = u.regionId; if (!byRegion.has(rid)) byRegion.set(rid, []); byRegion.get(rid).push(u.id); });
  return [...byRegion].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([regionId, unitIds]) => ({ regionId, unitIds }));
};

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

export { MISSILE_POWER_TIERS };

export const validateInvasion = (state, fromRegionId, targetRegionId, { ignoreCost = false, ignoreBattleLocks = false } = {}) => {
  const fromRegion = state.regions[fromRegionId];
  const targetRegion = state.regions[targetRegionId];
  if (!fromRegion || fromRegion.owner !== state.playerNationId) return { ok: false, reason: 'not_your_region' };
  if (!targetRegion || targetRegion.owner === state.playerNationId) return { ok: false, reason: 'bad_target' };
  // Already held by your army (an occupation from an older save): there is nothing left to fight.
  if (targetRegion.occupiedBy === state.playerNationId) return { ok: false, reason: 'already_held' };
  // Workstream 5 and 13: an army attacks a city from any tile next to its land (armies.js), or from
  // inside a city whose land TOUCHES the target's (registry.js `touching`); the Dawn bridge that
  // linked capitals 12 tiles apart no longer carries an attack: the army walks there first.
  const tiles = getTiles();
  const tileOwner = state.world?.tileOwner || {};
  const cityAdjacent = getTouchingIds(fromRegionId).includes(targetRegionId);
  const reaches = (u) => { const t = unitTile(state, u); return t != null && ((cityAdjacent && tileOwner[t] === fromRegionId) || touchesCity(state, tiles, t, targetRegionId)); };
  // Troops aboard a ship are not on the land: they land through AMPHIBIOUS_ASSAULT, never here.
  const stack = Object.values(state.units).filter((u) => u.regionId === fromRegionId && u.ownerId === state.playerNationId && u.domain === 'land' && u.classId !== 'settler' && !u.embarkedOn && (ignoreBattleLocks || !isUnitInBattle(state, u.id)));
  const attackerUnits = stack.filter(reaches);
  if (!cityAdjacent && attackerUnits.length === 0) return { ok: false, reason: 'not_adjacent' };
  // Plan §M13: invasions require an active war with the target's owner, except an independent's
  // city, which anyone may attack without one (hostility.js; `war` is then null: no war score).
  const war = state.wars.find((w) => w.active && isWarBetween(w, state.playerNationId, targetRegion.owner)) || null;
  if (!war && !canAttack(state, state.playerNationId, targetRegion.owner)) return { ok: false, reason: 'no_war' };
  if (!ignoreCost && !canAfford(state.resources, ACTION_COSTS.launchInvasion)) return { ok: false, reason: 'cost' };
  if (attackerUnits.length === 0) return { ok: false, reason: 'no_units' };
  // Plan §M14: one attack per stack per turn — every unit in the attacking stack must still have
  // its move (all-or-nothing on the whole stack, matching "an army is every unit in one region").
  if (!ignoreBattleLocks && !attackerUnits.every((u) => (u.movesLeft ?? 1) > 0)) return { ok: false, reason: 'no_moves' };
  // The garrison is whoever else stands there — never the player's own troops.
  const defenderUnits = Object.values(state.units).filter((u) => u.regionId === targetRegionId && u.domain === 'land' && u.classId !== 'settler' && u.ownerId !== state.playerNationId);
  // Aircraft in range of the city join each side (airPower.js); they stay at their base after.
  return { ok: true, war, fromRegion, targetRegion, attackerUnits: withAirSupport(state, state.playerNationId, targetRegion.tile, attackerUnits, defenderUnits), defenderUnits: withAirSupport(state, targetRegion.owner, targetRegion.tile, defenderUnits, attackerUnits) };
};

export const getInvasionBattleContext = (state, { targetRegionId, targetRegion, defenderUnits }) => {
  // An undefended region is taken in one hit regardless of its control — walking into an empty
  // city needs no siege. Only a real garrison triggers the multi-turn control grind.
  const isDefended = defenderUnits.length > 0;
  return {
    terrain: getRegionTerrain(targetRegionId, REGIONS_DATA),
    isDefended,
    isAttackingFortification: (targetRegion.defenseLevel || 0) > 0,
    battleType: (targetRegion.defenseLevel || 0) > 0 ? 'assault' : 'field', // battleType.js
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
  defenderDamageReductionMultiplier: ctx.defenderDamageReductionMultiplier,
  battleType: ctx.battleType,
  attackerPenaltyMultiplier: ctx.attackerPenaltyMultiplier ?? 1
});

export { XP_WIN, XP_LOSE };

// Everything that follows the battle, through the one outcome service (battleOutcome.js): siege
// control, conquest, XP, war score, the aftermath, the city's damage, the report. `battle` is
// resolveBattle's own shape ({ outcome, attackerUnits, defenderUnits, report }) or a commanded
// battle's (src/battle/sim/result.js). `decisive` (commanded: the keep was taken) captures the
// region outright; `xpBonusById` (commanded) adds the capped command bonus. `id` is the operation
// id (a pending battle's); without one the battle gets battleIdOf. `viewerId`: the real player when
// an AI nation fights through this with its own actor state (aiOperations.js).
export const applyInvasionResult = (state, { fromRegionId, targetRegionId, war, targetRegion, isDefended }, battle, { rngSeed, decisive = false, xpBonusById = null, id = null, viewerId = undefined, mode = undefined, militia = null } = {}) => {
  const meta = { kind: 'invasion', mode, warId: war?.id ?? null, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner, viewerId, fromRegionId, regionId: targetRegionId, tile: targetRegion.tile ?? null, isDefended, decisive, xpBonusById, rngSeed, militia };
  return applyBattleOutcome(state, makeBattleOutcome({ ...meta, id: id || battleIdOf(state, { ...meta, seed: rngSeed ?? state.rngSeed }) }, battle));
};

// ---- Amphibious landings (AMPHIBIOUS_ASSAULT, and the commanded landing of Tactical Battles T9) ----

// No foothold next to the target: the landing itself fights at a malus.
export const AMPHIBIOUS_PENALTY_MULT = LANDING_ATTACK_MULT; // the landing type's odds (battleType.js)

// May this fleet land its troops on `targetRegionId` right now? Mirrors AMPHIBIOUS_ASSAULT's gate.
export const validateAmphibious = (state, navalUnitId, targetRegionId, { ignoreCost = false, ignoreBattleLocks = false } = {}) => {
  const navalUnit = state.units[navalUnitId];
  const targetRegion = state.regions[targetRegionId];
  if (!navalUnit || navalUnit.ownerId !== state.playerNationId || navalUnit.domain !== 'naval') return { ok: false, reason: 'bad_fleet' };
  if (!targetRegion || targetRegion.owner === state.playerNationId) return { ok: false, reason: 'bad_target' };
  if (targetRegion.occupiedBy === state.playerNationId) return { ok: false, reason: 'already_held' };
  if (!isCoastal(targetRegionId)) return { ok: false, reason: 'not_coastal' };
  const beside = atSea(state, navalUnit) && touchesCoastOf(state, getTiles(), navalUnit.tile, targetRegionId);
  if (!beside && !getNeighborIds(navalUnit.regionId).includes(targetRegionId) && !isReachableBySea(navalUnit.regionId, targetRegionId, state.age)) return { ok: false, reason: 'out_of_reach' };
  const embarkedLandUnits = Object.values(state.units).filter((u) => u.embarkedOn === navalUnitId && u.ownerId === state.playerNationId);
  if (embarkedLandUnits.length === 0) return { ok: false, reason: 'no_units' };
  const war = state.wars.find((w) => w.active && isWarBetween(w, state.playerNationId, targetRegion.owner)) || null;
  if (!war && !canAttack(state, state.playerNationId, targetRegion.owner)) return { ok: false, reason: 'no_war' };
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
    battleType: v.hasBeachhead ? ((v.targetRegion.defenseLevel || 0) > 0 ? 'assault' : 'field') : 'landing',
    attackerPenaltyMultiplier: 1,
    defenderDamageReductionMultiplier: isDefended
      ? getDefenseLevelDamageReductionMultiplier((v.targetRegion.defenseLevel || 0) + getRegionModifier(state, v.targetRegionId, 'local.fortLevel').total) * getZoneOfControlMultiplier(state.regions, v.targetRegionId, v.targetRegion.owner)
      : 1
  };
};

// Everything that follows the land battle of a landing, through the outcome service. `state.units`
// already reflects any naval interception. Survivors go ashore only once the region is taken.
export const applyAmphibiousLanding = (state, { navalUnitId, fromRegionId, targetRegionId, war, targetRegion, isDefended }, battle, { rngSeed, decisive = false, xpBonusById = null, id = null, viewerId = undefined, mode = undefined, militia = null } = {}) => {
  const meta = { kind: 'landing', mode, warId: war?.id ?? null, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner, viewerId, navalUnitId, fromRegionId, regionId: targetRegionId, tile: targetRegion.tile ?? null, isDefended, decisive, xpBonusById, rngSeed, militia };
  return applyBattleOutcome(state, makeBattleOutcome({ ...meta, id: id || battleIdOf(state, { ...meta, seed: rngSeed ?? state.rngSeed }) }, battle));
};
