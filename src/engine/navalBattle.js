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
import { awardXp } from '../data/promotions';
import { getGeneralXpMultiplier } from '../data/generals';
import { canAfford } from '../utils/helpers';
import { isWarBetween, recordBattle } from './diplomacy';
import { canAttack } from './hostility';
import { getTechAgeId } from './nationState';
import { recordBattleReport } from './battleReports';
import { regionForTile, unitTile } from './armies';
import { isUnitInBattle, XP_WIN, XP_LOSE } from './invasion';
import { isFleet, seaPassable, fleetAge, enemyFleetAt } from './fleets';
import { mapEffectsFor } from './techMapEffects';
import { BATTLE_MARK_TURNS } from './fieldBattle';

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

// Where a beaten fleet on `tile` falls back to: a neighbouring sea tile it may sail, with no
// enemy fleet on it and not one the attackers came from; else nowhere (it is sunk).
const retreatTile = (state, tile, unit, attackerTiles) => {
  const tiles = getTiles();
  const ageId = fleetAge(state, unit.ownerId);
  const fx = mapEffectsFor(state, unit.ownerId);
  return tiles.neighbors[tile].find((n) => seaPassable(tiles, n, ageId, fx.deepOcean > 0, fx.deepOcean > 0) && !attackerTiles.has(n) && !enemyFleetAt(state, n, unit.ownerId)) ?? null;
};

/** Everything after the battle. `battle` is resolveBattle's shape. */
export const applyFleetResult = (state, v, battle, { rngSeed, attackerNationId = state.playerNationId } = {}) => {
  const { outcome, attackerUnits: resolvedAttackers, defenderUnits: resolvedDefenders, report } = battle;
  const units = { ...state.units };
  const sink = (id) => { delete units[id]; Object.values(units).forEach((c) => { if (c.embarkedOn === id) delete units[c.id]; }); };
  const world = state.world ? { ...state.world, tileState: { ...(state.world.tileState || {}), [v.tile]: { ...(state.world.tileState?.[v.tile] || {}), battle: { turn: state.turnNumber, until: (state.turnNumber || 0) + BATTLE_MARK_TURNS, outcome } } } } : state.world;
  const xp = (list, deployed, amount) => list.map((u) => (deployed.includes(u.id) ? awardXp(u, Math.round(amount * getGeneralXpMultiplier(state.hiredCommanders?.[u.commanderId]))) : u));
  const attackerXp = outcome === 'attacker' ? XP_WIN : outcome === 'defender' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
  const defenderXp = outcome === 'defender' ? XP_WIN : outcome === 'attacker' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
  const attackers = xp(resolvedAttackers, report?.deployedAttackerIds || [], attackerXp);
  const defenders = xp(resolvedDefenders, report?.deployedDefenderIds || [], defenderXp);
  let sunk = 0;
  attackers.forEach((u) => {
    if (u.strength <= 0) { sink(u.id); return; }
    units[u.id] = { ...units[u.id], ...u, routed: undefined, movesLeft: 0, lastBattleTurn: state.turnNumber };
  });
  const attackerTiles = new Set(v.attackerUnits.map((u) => unitTile(state, u)));
  let retreated = null;
  defenders.forEach((u) => {
    if (u.strength <= 0) { sink(u.id); sunk += 1; return; }
    const next = { ...units[u.id], ...u, routed: undefined, lastBattleTurn: state.turnNumber };
    if (outcome === 'attacker') {
      const to = retreated ?? retreatTile(state, v.tile, u, attackerTiles);
      if (to == null) { sink(u.id); sunk += 1; return; }
      retreated = to;
      units[u.id] = { ...next, tile: to, regionId: regionForTile(state, to, u.ownerId, u.regionId), movesLeft: 0, route: undefined };
      Object.values(units).forEach((c) => { if (c.embarkedOn === u.id) units[c.id] = { ...c, tile: to, regionId: units[u.id].regionId }; });
    } else units[u.id] = next;
  });
  const attStart = v.attackerUnits.reduce((s, u) => s + u.strength, 0); const defStart = v.defenderUnits.reduce((s, u) => s + u.strength, 0);
  const attLoss = attStart - resolvedAttackers.reduce((s, u) => s + Math.max(0, u.strength), 0);
  const defLoss = defStart - resolvedDefenders.reduce((s, u) => s + Math.max(0, u.strength), 0);
  let wars = state.wars;
  if (v.war && outcome !== 'stalemate') {
    const winnerId = outcome === 'attacker' ? attackerNationId : v.defenderNationId;
    const lossShare = outcome === 'attacker' ? (defStart ? defLoss / defStart : 0) : (attStart ? attLoss / attStart : 0);
    wars = state.wars.map((w) => (w.id === v.war.id ? { ...w, battleScore: recordBattle(w, winnerId, lossShare) } : w));
  }
  const anchor = state.world?.tileOwner?.[v.tile] ?? regionForTile(state, v.tile, attackerNationId, v.fromRegionId);
  const where = state.regions[anchor]?.name ? `off ${state.regions[anchor].name}` : 'at sea';
  const enemy = state.nations[v.defenderNationId]?.name || 'the enemy';
  const mine = attackerNationId === state.playerNationId;
  const who = mine ? 'Your fleet' : `${state.nations[attackerNationId]?.name || 'A'} fleet`;
  const message = outcome === 'attacker' ? `${who} beat ${mine ? enemy : 'your fleet'} ${where}${sunk ? `, sinking ${sunk} ship${sunk > 1 ? 's' : ''}` : ''}.`
    : outcome === 'defender' ? `${mine ? 'Your attack' : `${state.nations[attackerNationId]?.name || 'An'} attack`} ${where} was beaten off${mine ? '' : ' by your fleet'}.`
    : `The sea battle ${where} ended with both fleets spent.`;
  return {
    ...state,
    world, units, wars,
    rngSeed: rngSeed ?? state.rngSeed,
    ...recordBattleReport(state, { ...report, kind: 'naval', tile: v.tile, outcome, fromRegionId: v.fromRegionId, targetRegionId: anchor, attackerNationId, defenderNationId: v.defenderNationId }, { attackers: resolvedAttackers, defenders: resolvedDefenders }),
    logs: [...state.logs, { year: state.year, message, type: 'combat' }]
  };
};
