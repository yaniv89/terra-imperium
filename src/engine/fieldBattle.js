// src/engine/fieldBattle.js
// Field battles between armies on tiles (plans/civ-map-rework.md, D5 "Field", "Sally", "Relief";
// workstream 6). A stack attacks an enemy stack on an ADJACENT tile that is not a city centre (a
// city is taken through invasion.js). The same three halves as an invasion so auto-resolve and a
// commanded battle share one gate and one set of consequences:
//   validateFieldAttack     may this attack happen, and with which units?
//   getFieldBattleContext   the numbers resolveBattle needs: the tile's terrain, no walls, a fort
//                           improvement on the tile (FORT_REDUCTION), a river crossing between the
//                           two tiles (RIVER_ATTACK_MULT: the "river crossing" type), the ages
//   applyFieldResult        through the outcome service (battleOutcome.js): decisive (master plan
//                           6.9): the loser's units still on the field are destroyed; units that
//                           left by an exit step back one tile (towards their base, findTilePath's
//                           first step), a beaten defender with no way out is destroyed; the
//                           winner gains XP; devastation and war exhaustion as for any battle.
//                           Nobody advances onto the tile: holding ground is a march order.
// A sally is the garrison attacking the besiegers on a ring-1 tile; a relief is an army attacking
// them from outside: both are this attack from different tiles. The AI's garrisons sally through
// `aiSally` (aiOperations.js) when they are clearly stronger.
import { getTiles } from '../data/geo/tiles';
import { withAirSupport } from './airPower';
import { getEffectiveAgeId } from '../data/ages';
import { ACTION_COSTS } from '../data/actionCosts';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { canAfford } from '../utils/helpers';
import { isWarBetween } from './diplomacy';
import { getTechAgeId } from './nationState';
import { canAttack } from './hostility';
import { legacyTerrainOf } from './world/registry';
import { passableTile, regionForTile, unitTile } from './armies';
import { isUnitInBattle } from './invasion';
import { applyBattleOutcome, makeBattleOutcome, battleIdOf, BATTLE_MARK_TURNS } from './battleOutcome';
import { isSettler } from './settlers';
import { battleTypeOf, RIVER_ATTACK_MULT, riverAttackAdjust } from '../battle/setup/battleType';
import { tileContextOf } from '../battle/setup/tileContext';
import { ringsForKm } from '../data/geo/gridScale';

export const FORT_REDUCTION = 0.75;      // damage taken by a stack on a tile with a Fort
export const FORT_BATTLE_LEVEL = 2;      // a Fort on the battle map: a walled keep with a tower (forts.js, decision 34)
export const FORTIFY_REDUCTION = 0.85;   // damage taken by a stack that held its tile a full turn (plans/playtest-1.md P2.3)
/** A unit that stood on its tile through a whole turn and has no march under way. */
export const isFortified = (u, turn) => u?.heldSince != null && (turn || 0) - u.heldSince >= 1 && !u.route?.length;
export { RIVER_ATTACK_MULT };            // attacking across a river (battleType.js, shared with the tactical sim)
export const RETREAT_KM = 102; // km (1 ring at frequency 75)
export const RETREAT_RINGS = ringsForKm(RETREAT_KM);

const isCentre = (state, tile) => state.regions[state.world?.tileOwner?.[tile]]?.tile === tile;
// `me` may attack a stack of `owner` (hostility.js: at war, rebels, an independent's stack).
const hostile = (state, me, owner) => canAttack(state, me, owner);

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
    attackerPenaltyMultiplier: battleType === 'river' ? riverAttackAdjust(tiles.riverSizeBetween(v.fromTile, v.tile)) : 1, // the river's size (battleType.js)
    defenderDamageReductionMultiplier: (fort ? FORT_REDUCTION : 1) * (v.defenderUnits.length && v.defenderUnits.every((u) => isFortified(u, state.turnNumber)) ? FORTIFY_REDUCTION : 1)
  };
};

export const getFieldResolveArgs = (v, ctx) => ({
  attackerUnits: v.attackerUnits, defenderUnits: v.defenderUnits, terrain: ctx.terrain, isAttackingFortification: ctx.isAttackingFortification,
  generals: ctx.generals, attackerAgeId: ctx.attackerAgeId, defenderAgeId: ctx.defenderAgeId,
  attackerPenaltyMultiplier: ctx.attackerPenaltyMultiplier, defenderDamageReductionMultiplier: ctx.defenderDamageReductionMultiplier, battleType: ctx.battleType
});

/** Everything after the battle, through the one outcome service (battleOutcome.js): decisive
 * (master plan 6.9), the loser's units still on the field are destroyed, those that left by an exit
 * step back one tile; XP, war score, devastation and war exhaustion, the tile's mark, the report.
 * `battle` is resolveBattle's shape. `attackerNationId` defaults to the player (the AI's sallies
 * pass their own); `viewerId` is the real player when an AI fights with its own actor state. */
export { BATTLE_MARK_TURNS };
export const applyFieldResult = (state, v, battle, { rngSeed, xpBonusById = null, attackerNationId = state.playerNationId, id = null, viewerId = undefined, mode = undefined, defenseId = null } = {}) => {
  const anchor = state.world?.tileOwner?.[v.tile] ?? regionForTile(state, v.tile, attackerNationId, v.fromRegionId);
  const meta = {
    kind: 'field', mode, defenseId, warId: v.war?.id ?? null, attackerNationId, defenderNationId: v.defenderNationId, viewerId,
    fromRegionId: v.fromRegionId, regionId: anchor, tile: v.tile, fromTile: v.fromTile ?? null,
    attackerStart: v.attackerUnits, defenderStart: v.defenderUnits, xpBonusById, rngSeed
  };
  return applyBattleOutcome(state, makeBattleOutcome({ ...meta, id: id || battleIdOf(state, { ...meta, seed: rngSeed ?? state.rngSeed }) }, battle));
};
