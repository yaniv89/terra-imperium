// src/engine/navalBattle.js
// Fleet against fleet on sea tiles (plans/civ-map-rework.md D5b). A stack of fleets on a tile
// (at sea, or in a port whose centre touches the water) attacks the enemy fleets standing on a
// neighbouring sea tile. The quick battle is resolveBattle on open water (terrain 'sea', battle
// type 'naval'): a transport fights badly and a raider lightly (navalLines.js), the attacker
// takes no terrain penalty. After it: a sunk ship takes everything aboard down with it, the
// winners stay where they are with their moves spent, a beaten defender falls back one sea tile
// away from the attackers (no free tile: sunk), the war's battle score records a decisive result
// and the player's report lists it as a naval battle. The AI's fleets use the same gate and
// aftermath (aiOperations.js). Naval battles in the tactical sim stay a later slice. Pure.
import { getTiles } from '../data/geo/tiles';
import { getEffectiveAgeId } from '../data/ages';
import { ACTION_COSTS } from '../data/actionCosts';
import { canAfford } from '../utils/helpers';
import { isWarBetween } from './diplomacy';
import { canAttack } from './hostility';
import { getTechAgeId } from './nationState';
import { regionForTile, unitTile } from './armies';
import { isUnitInBattle } from './invasion';
import { isFleet } from './fleets';
import { applyBattleOutcome, makeBattleOutcome, battleIdOf } from './battleOutcome';

export const SEA_TERRAIN = 'sea';
export const NAVAL_BATTLE_TYPE = 'naval';
/** An AI fleet attacks when it outweighs the enemy stack by this much. */
export const AI_FLEET_ATTACK_RATIO = 1.25;

// At war with `me`, or an independent's fleet (hostility.js canAttack; rebels have no fleets).
const hostile = (state, me, owner) => canAttack(state, me, owner);
const isWater = (tiles, tile) => tile != null && tile >= 0 && tiles.land[tile] !== 1;

/** Enemy fleets of `me` standing on sea tile `tile` (at war with `me`). */
export const enemyFleetsAt = (state, tile, me = state.playerNationId, units = state.units) => Object.values(units)
  .filter((u) => isFleet(u) && u.strength > 0 && u.ownerId !== me && unitTile(state, u) === tile && hostile(state, me, u.ownerId))
  .sort((a, b) => (a.id < b.id ? -1 : 1));

/** The fleets of `me` whose tile is `fromTile` (a sea tile, or a port city's centre) that can still act. */
export const fleetsOn = (state, fromTile, me = state.playerNationId, { ignoreBattleLocks = false } = {}) => Object.values(state.units)
  .filter((u) => isFleet(u) && u.ownerId === me && u.strength > 0 && unitTile(state, u) === fromTile && (ignoreBattleLocks || !isUnitInBattle(state, u.id)))
  .sort((a, b) => (a.id < b.id ? -1 : 1));

/**
 * The gate: the player's fleets on `fromTile` attack the enemy fleets on the neighbouring sea
 * tile `tile`. { ok, tile, fromTile, war, attackerUnits, defenderUnits, defenderNationId } or
 * { ok: false, reason }: bad_target, no_enemy, no_units, not_adjacent, no_moves, cost.
 */
export const validateFleetAttack = (state, fromTile, tile, { ignoreCost = false, ignoreBattleLocks = false } = {}) => {
  const me = state.playerNationId;
  const tiles = getTiles();
  if (!isWater(tiles, tile)) return { ok: false, reason: 'bad_target' };
  const defenderUnits = enemyFleetsAt(state, tile, me);
  if (!defenderUnits.length) return { ok: false, reason: 'no_enemy' };
  const defenderNationId = defenderUnits[0].ownerId;
  const attackerUnits = fleetsOn(state, fromTile, me, { ignoreBattleLocks });
  if (!attackerUnits.length) return { ok: false, reason: 'no_units' };
  if (!tiles.neighbors[fromTile]?.includes(tile)) return { ok: false, reason: 'not_adjacent' };
  if (!ignoreBattleLocks && !attackerUnits.every((u) => (u.movesLeft ?? 1) > 0)) return { ok: false, reason: 'no_moves' };
  if (!ignoreCost && !canAfford(state.resources, ACTION_COSTS.navalEngagement)) return { ok: false, reason: 'cost' };
  const war = (state.wars || []).find((w) => w.active && isWarBetween(w, me, defenderNationId)) || null;
  return { ok: true, tile, fromTile, war, attackerUnits, defenderUnits: defenderUnits.filter((u) => u.ownerId === defenderNationId), defenderNationId, fromRegionId: attackerUnits[0].regionId };
};

export const getFleetBattleContext = (state, v) => ({
  terrain: SEA_TERRAIN,
  isDefended: true,
  isAttackingFortification: false,
  battleType: NAVAL_BATTLE_TYPE,
  generals: state.hiredCommanders,
  attackerAgeId: getEffectiveAgeId(state.age, state.techAgeId),
  defenderAgeId: getEffectiveAgeId(state.age, getTechAgeId(state, v.defenderNationId)),
  attackerPenaltyMultiplier: 1,
  defenderDamageReductionMultiplier: 1
});

export const getFleetResolveArgs = (v, ctx) => ({
  attackerUnits: v.attackerUnits, defenderUnits: v.defenderUnits, terrain: ctx.terrain, isAttackingFortification: false,
  generals: ctx.generals, attackerAgeId: ctx.attackerAgeId, defenderAgeId: ctx.defenderAgeId,
  attackerPenaltyMultiplier: 1, defenderDamageReductionMultiplier: 1, battleType: ctx.battleType
});

/** Everything after the battle, through the one outcome service (battleOutcome.js). `battle` is resolveBattle's shape. */
export const applyFleetResult = (state, v, battle, { rngSeed, attackerNationId = state.playerNationId, id = null, viewerId = undefined, mode = undefined } = {}) => {
  const anchor = state.world?.tileOwner?.[v.tile] ?? regionForTile(state, v.tile, attackerNationId, v.fromRegionId);
  const meta = {
    kind: 'naval', mode, warId: v.war?.id ?? null, attackerNationId, defenderNationId: v.defenderNationId, viewerId,
    fromRegionId: v.fromRegionId, regionId: anchor, tile: v.tile, fromTile: v.fromTile ?? null,
    attackerStart: v.attackerUnits, defenderStart: v.defenderUnits, rngSeed
  };
  return applyBattleOutcome(state, makeBattleOutcome({ ...meta, id: id || battleIdOf(state, { ...meta, seed: rngSeed ?? state.rngSeed }) }, battle));
};
