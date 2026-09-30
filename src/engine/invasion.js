// src/engine/invasion.js
// The player's land invasion, split into its three real halves (Tactical Battles plan §5.2) so the
// two ways of fighting it — auto-resolve (resolveBattle) and a commanded real-time battle
// (src/battle/) — share EXACTLY the same entry gate and the same consequences:
//   validateInvasion        — may this invasion happen right now, and with which units?
//   getInvasionBattleContext — every number resolveBattle needs beyond the unit lists
//   applyInvasionResult     — everything that follows a battle: siege control damage, occupation,
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
import { getDefenseLevelDamageReductionMultiplier, hasMeleeUnitDeployed, resolveSiegeControlDamage, getZoneOfControlMultiplier } from './siege';

// Units committed to an in-progress tactical battle can't be moved, disbanded or sent into a
// second fight until it resolves.
export const isUnitInBattle = (state, unitId) => {
  const pb = state.pendingBattle;
  if (!pb) return false;
  return (pb.attackerUnitIds || []).includes(unitId) || (pb.defenderUnitIds || []).includes(unitId);
};

export const validateInvasion = (state, fromRegionId, targetRegionId, { ignoreCost = false, ignoreBattleLocks = false } = {}) => {
  const fromRegion = state.regions[fromRegionId];
  const targetRegion = state.regions[targetRegionId];
  if (!fromRegion || fromRegion.owner !== state.playerNationId) return { ok: false, reason: 'not_your_region' };
  if (!targetRegion || targetRegion.owner === state.playerNationId) return { ok: false, reason: 'bad_target' };
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
  const defenderUnits = Object.values(state.units).filter((u) => u.regionId === targetRegionId && u.domain === 'land');
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

const XP_WIN = 30;
const XP_LOSE = 15;

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
        hasMeleeUnit: hasMeleeUnitDeployed(resolvedAttackers.filter(u => u.strength > 0))
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

  const nextRegions = { ...state.regions };
  if (captured) {
    // Occupation (plan §M13), not annexation: `owner` stays put, `occupiedBy` marks who holds it
    // militarily. Ownership only changes at the peace table (src/engine/peace.js).
    nextRegions[targetRegionId] = {
      ...targetRegion,
      occupiedBy: state.playerNationId,
      control: 25,
      unrest: Math.max(targetRegion.unrest || 0, 50),
      lastAttackedTurn: state.turnNumber,
      underInvasion: false
    };
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
    ? `Your forces occupy ${REGIONS_DATA[targetRegionId]?.name}, taken from ${state.nations[targetRegion.owner]?.name || targetRegion.owner}.`
    : outcome === 'attacker'
      ? `Your forces broke through at ${REGIONS_DATA[targetRegionId]?.name} (control now ${nextControl}%), but could not yet secure it.`
      : outcome === 'defender'
        ? `Your invasion of ${REGIONS_DATA[targetRegionId]?.name} was repelled.`
        : `Your invasion of ${REGIONS_DATA[targetRegionId]?.name} ended in a mutual withdrawal.`;

  return {
    ...state,
    regions: nextRegions,
    units: nextUnits,
    wars: nextWars,
    rngSeed,
    lastBattleReport: { ...report, captured, fromRegionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner },
    logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
  };
};
