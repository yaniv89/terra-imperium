// src/engine/fieldBattle.js
// Field battles between armies on tiles (plans/civ-map-rework.md, D5 "Field", "Sally", "Relief";
// workstream 6). A stack attacks an enemy stack on an ADJACENT tile that is not a city centre (a
// city is taken through invasion.js). The same three halves as an invasion so auto-resolve and a
// commanded battle share one gate and one set of consequences:
//   validateFieldAttack     may this attack happen, and with which units?
//   getFieldBattleContext   the numbers resolveBattle needs: the tile's terrain, no walls, a fort
//                           improvement on the tile (FORT_REDUCTION), a river crossing between the
//                           two tiles (RIVER_ATTACK_MULT: the "river crossing" type), the ages
//   applyFieldResult        losses, XP, morale, war score, the report, and the ground: a beaten
//                           defender stack retreats one tile towards its base (findTilePath's
//                           first step) or is destroyed when no retreat is open; a beaten attacker
//                           stays where it stood. Nobody advances onto the tile: holding ground is
//                           a march order.
// A sally is the garrison attacking the besiegers on a ring-1 tile; a relief is an army attacking
// them from outside: both are this attack from different tiles. The AI's garrisons sally through
// `aiSally` (aiOperations.js) when they are clearly stronger.
import { getTiles } from '../data/geo/tiles';
import { withAirSupport, isAir } from './airPower';
import { getEffectiveAgeId } from '../data/ages';
import { ACTION_COSTS } from '../data/actionCosts';
import { awardXp } from '../data/promotions';
import { getGeneralXpMultiplier } from '../data/generals';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { canAfford } from '../utils/helpers';
import { isWarBetween, recordBattle } from './diplomacy';
import { getTechAgeId } from './nationState';
import { legacyTerrainOf } from './world/registry';
import { recordBattleReport } from './battleReports';
import { findTilePath, passableTile, regionForTile, unitTile } from './armies';
import { isUnitInBattle, XP_WIN, XP_LOSE } from './invasion';
import { isSettler } from './settlers';
import { battleTypeOf, RIVER_ATTACK_MULT } from '../battle/setup/battleType';
import { tileContextOf } from '../battle/setup/tileContext';
import { ringsForKm } from '../data/geo/gridScale';

export const FORT_REDUCTION = 0.75;      // damage taken by a stack on a tile with a Fort
export const FORTIFY_REDUCTION = 0.85;   // damage taken by a stack that held its tile a full turn (plans/playtest-1.md P2.3)
/** A unit that stood on its tile through a whole turn and has no march under way. */
export const isFortified = (u, turn) => u?.heldSince != null && (turn || 0) - u.heldSince >= 1 && !u.route?.length;
export { RIVER_ATTACK_MULT };            // attacking across a river (battleType.js, shared with the tactical sim)
export const RETREAT_KM = 102; // km (1 ring at frequency 75)
export const RETREAT_RINGS = ringsForKm(RETREAT_KM);

const isCentre = (state, tile) => state.regions[state.world?.tileOwner?.[tile]]?.tile === tile;
const hostile = (state, me, owner) => owner === REBEL_OWNER_ID || (state.wars || []).some((w) => w.active && isWarBetween(w, me, owner));

/** Enemy land units of `me` standing on `tile`. */
export const enemyStackAt = (state, tile, me = state.playerNationId, units = state.units) => Object.values(units)
  .filter((u) => u.domain === 'land' && !u.embarkedOn && !isSettler(u) && u.strength > 0 && u.ownerId !== me && unitTile(state, u) === tile && hostile(state, me, u.ownerId));

export const validateFieldAttack = (state, fromRegionId, tile, { ignoreCost = false, ignoreBattleLocks = false } = {}) => {
  const me = state.playerNationId;
  const tiles = getTiles();
  if (tile == null || tile < 0 || !passableTile(tiles, tile)) return { ok: false, reason: 'bad_target' };
  if (isCentre(state, tile)) return { ok: false, reason: 'is_city' };
  const defenderUnits = enemyStackAt(state, tile, me);
  if (!defenderUnits.length) return { ok: false, reason: 'no_enemy' };
  const defenderNationId = defenderUnits[0].ownerId;
  const war = defenderNationId === REBEL_OWNER_ID ? null : (state.wars || []).find((w) => w.active && isWarBetween(w, me, defenderNationId));
  const stack = Object.values(state.units).filter((u) => u.regionId === fromRegionId && u.ownerId === me && u.domain === 'land' && !u.embarkedOn && !isSettler(u) && u.strength > 0 && (ignoreBattleLocks || !isUnitInBattle(state, u.id)));
  const attackerUnits = stack.filter((u) => tiles.neighbors[unitTile(state, u)]?.includes(tile));
  if (!attackerUnits.length) return { ok: false, reason: 'no_units' };
  if (!ignoreBattleLocks && !attackerUnits.every((u) => (u.movesLeft ?? 1) > 0)) return { ok: false, reason: 'no_moves' };
  if (!ignoreCost && !canAfford(state.resources, ACTION_COSTS.launchInvasion)) return { ok: false, reason: 'cost' };
  // Aircraft in range join each side (airPower.js) and fly home after.
  return { ok: true, tile, war, fromRegionId, attackerUnits: withAirSupport(state, me, tile, attackerUnits, defenderUnits), defenderUnits: withAirSupport(state, defenderNationId, tile, defenderUnits, attackerUnits), defenderNationId, fromTile: unitTile(state, attackerUnits[0]) };
};

export const getFieldBattleContext = (state, v) => {
  const tiles = getTiles();
  const fort = state.world?.tileState?.[v.tile]?.improvement === 'fort' && !state.world?.tileState?.[v.tile]?.pillaged;
  const river = v.fromTile != null && tiles.riverBetween(v.fromTile, v.tile);
  // The battle type the tactical sim would set (river crossing, ambush, sally, field): the
  // auto-resolve applies the same type's odds (battleType.js), so the two stay in parity.
  const from = state.regions[v.fromRegionId];
  const sally = !!from?.siege?.by && from.tile != null && tiles.neighbors[from.tile].includes(v.tile);
  const battleType = battleTypeOf({ sally, city: false, tileContext: tileContextOf(state, v.tile, { fromTile: v.fromTile }), fromTile: v.fromTile });
  return {
    terrain: legacyTerrainOf(tiles, v.tile),
    isDefended: true,
    isAttackingFortification: fort,
    river,
    battleType,
    generals: state.hiredCommanders,
    attackerAgeId: getEffectiveAgeId(state.age, state.techAgeId),
    defenderAgeId: v.defenderNationId === REBEL_OWNER_ID ? state.age : getEffectiveAgeId(state.age, getTechAgeId(state, v.defenderNationId)),
    attackerPenaltyMultiplier: 1,
    defenderDamageReductionMultiplier: (fort ? FORT_REDUCTION : 1) * (v.defenderUnits.length && v.defenderUnits.every((u) => isFortified(u, state.turnNumber)) ? FORTIFY_REDUCTION : 1)
  };
};

export const getFieldResolveArgs = (v, ctx) => ({
  attackerUnits: v.attackerUnits, defenderUnits: v.defenderUnits, terrain: ctx.terrain, isAttackingFortification: ctx.isAttackingFortification,
  generals: ctx.generals, attackerAgeId: ctx.attackerAgeId, defenderAgeId: ctx.defenderAgeId,
  attackerPenaltyMultiplier: ctx.attackerPenaltyMultiplier, defenderDamageReductionMultiplier: ctx.defenderDamageReductionMultiplier, battleType: ctx.battleType
});

// Where a beaten stack on `tile` falls back to: the first step towards its base, else any
// adjacent passable tile with no enemy on it, else nowhere.
const retreatTile = (state, tile, unit, enemyTiles) => {
  const tiles = getTiles();
  const base = state.regions[unit.regionId];
  if (base?.tile != null) {
    const p = findTilePath(state, tile, base.tile, unit.ownerId, { maxSteps: 40 });
    if (p.path && p.path[1] != null && !enemyTiles.has(p.path[1]) && !isCentre(state, p.path[1])) return p.path[1];
  }
  return tiles.neighbors[tile].find((n) => passableTile(tiles, n) && !enemyTiles.has(n) && !isCentre(state, n)) ?? null;
};

/** Everything after the battle. `battle` is resolveBattle's shape. `attackerNationId` defaults to
 * the player (the AI's sallies pass their own). */
export const BATTLE_MARK_TURNS = 5;
export const applyFieldResult = (state, v, battle, { rngSeed, xpBonusById = null, attackerNationId = state.playerNationId } = {}) => {
  const { outcome, attackerUnits: resolvedAttackers, defenderUnits: resolvedDefenders, report } = battle;
  const units = { ...state.units };
  // The ground remembers the battle for a few turns (the map shows the mark).
  const world = state.world ? { ...state.world, tileState: { ...(state.world.tileState || {}), [v.tile]: { ...(state.world.tileState?.[v.tile] || {}), battle: { turn: state.turnNumber, until: (state.turnNumber || 0) + BATTLE_MARK_TURNS, outcome } } } } : state.world;
  const xp = (list, deployed, amount) => list.map((u) => (deployed.includes(u.id) ? awardXp(u, Math.round(amount * getGeneralXpMultiplier(state.hiredCommanders?.[u.commanderId])) + (xpBonusById?.[u.id] || 0)) : u));
  const attackerXp = outcome === 'attacker' ? XP_WIN : outcome === 'defender' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
  const defenderXp = outcome === 'defender' ? XP_WIN : outcome === 'attacker' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
  const attackers = xp(resolvedAttackers, report?.deployedAttackerIds || [], attackerXp);
  const defenders = xp(resolvedDefenders, report?.deployedDefenderIds || [], defenderXp);
  attackers.forEach((u) => {
    if (u.strength <= 0) { delete units[u.id]; return; }
    units[u.id] = { ...units[u.id], ...u, routed: undefined, movesLeft: 0, lastBattleTurn: state.turnNumber };
  });
  const attackerTiles = new Set(v.attackerUnits.map((u) => unitTile(state, u)));
  let destroyed = 0; let retreated = null;
  defenders.forEach((u) => {
    if (u.strength <= 0) { delete units[u.id]; return; }
    const next = { ...units[u.id], ...u, routed: undefined, lastBattleTurn: state.turnNumber };
    if (outcome === 'attacker' && !isAir(u)) {
      const to = retreated ?? retreatTile(state, v.tile, u, attackerTiles);
      if (to == null) { delete units[u.id]; destroyed += 1; return; }
      retreated = to;
      units[u.id] = { ...next, tile: to, regionId: regionForTile(state, to, u.ownerId, u.regionId), movesLeft: 0 };
    } else units[u.id] = next;
  });
  // War score: a decisive field battle counts like any other battle.
  const attStart = v.attackerUnits.reduce((s, u) => s + u.strength, 0); const defStart = v.defenderUnits.reduce((s, u) => s + u.strength, 0);
  const attLoss = attStart - resolvedAttackers.reduce((s, u) => s + Math.max(0, u.strength), 0);
  const defLoss = defStart - resolvedDefenders.reduce((s, u) => s + Math.max(0, u.strength), 0);
  let wars = state.wars;
  if (v.war && outcome !== 'stalemate') {
    const winnerId = outcome === 'attacker' ? attackerNationId : v.defenderNationId;
    const lossShare = outcome === 'attacker' ? (defStart ? defLoss / defStart : 0) : (attStart ? attLoss / attStart : 0);
    wars = state.wars.map((w) => (w.id === v.war.id ? { ...w, battleScore: recordBattle(w, winnerId, lossShare) } : w));
  }
  const tiles = getTiles();
  const where = tiles.names[v.tile] || state.regions[state.world?.tileOwner?.[v.tile]]?.name || 'the field';
  const enemy = v.defenderNationId === REBEL_OWNER_ID ? 'the rebels' : (state.nations[v.defenderNationId]?.name || 'the enemy');
  const mine = attackerNationId === state.playerNationId;
  const message = outcome === 'attacker' ? `${mine ? 'Your army' : `${state.nations[attackerNationId]?.name || 'An army'}`} beat ${mine ? enemy : 'your army'} in the field near ${where}${destroyed ? `, destroying ${destroyed} unit${destroyed > 1 ? 's' : ''} with no retreat` : ''}.`
    : outcome === 'defender' ? `${mine ? 'Your attack' : `${state.nations[attackerNationId]?.name || 'An'} attack`} near ${where} was thrown back${mine ? '' : ' by your army'}.`
    : `The battle near ${where} ended with both sides spent.`;
  const anchor = state.world?.tileOwner?.[v.tile] ?? regionForTile(state, v.tile, attackerNationId, v.fromRegionId);
  return {
    ...state,
    world, units,
    wars,
    rngSeed: rngSeed ?? state.rngSeed,
    ...recordBattleReport(state, { ...report, kind: 'field', tile: v.tile, outcome, fromRegionId: v.fromRegionId, targetRegionId: anchor, attackerNationId, defenderNationId: v.defenderNationId }, { attackers: resolvedAttackers, defenders: resolvedDefenders }),
    logs: [...state.logs, { year: state.year, message, type: 'combat' }]
  };
};
