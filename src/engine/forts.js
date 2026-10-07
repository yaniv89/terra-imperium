// src/engine/forts.js
// Forts start battles (decision 34, plans/MASTER-PLAN.md 6.9 and 6.7 row 7; phase R3 step 3).
// A Fort is a tile improvement (data/tileYields.js, built by workers, pillaged by raiders); the
// nation that owns the land it stands on owns the fort.
//   Zone of control  every fort, manned or not, ends the move of an enemy army that enters a tile
//                    next to it (armies.js inEnemyZoc): an unmanned fort only slows.
//   Manned           a fort with its owner's land army standing on it. An enemy army that ENTERED a
//                    tile next to a manned fort this turn (it marched there, or was stopped there by
//                    the fort's zone of control trying to pass) must fight: a field battle on the
//                    fort's tile, the army stopped beside it attacking, the garrison defending from
//                    the fort. One battle per fort and per stopped stack a turn; an army that was
//                    already beside it last turn is not stopped again.
//   The battle       fieldBattle.js: the fort's FORT_REDUCTION in the auto-resolve; on the battle map
//                    the fort stands as a walled keep with a tower (FORT_BATTLE_LEVEL, the garrison
//                    may man it and counts as housed) (buildBattleSetup.js).
//   Who fights how   the player in it, either side: the battle queue (battleQueue.js), Command or
//                    Auto; AI against AI: Auto at once. Raid parties are left out (raids.js fights
//                    its own battles).
// Pure: processFortBattles(state, startUnits) -> state.
import { getTiles } from '../data/geo/tiles';
import { createRng } from '../utils/rng';
import { canAttack } from './hostility';
import { unitTile } from './armies';
import { isUnitInBattle } from './invasion';
import { hashRoll } from './aftermath';
import { getPool, getTechAgeId } from './nationState';
import { validateFieldAttack, getFieldBattleContext, getFieldResolveArgs, applyFieldResult, FORT_BATTLE_LEVEL } from './fieldBattle';
import { resolveAutoBattle } from './autoBattle';
import { fieldDefenseRecord } from './battleQueue';

export { FORT_BATTLE_LEVEL };

/** Is there a standing (unpillaged) fort on `tile`? */
export const isFortTile = (state, tile) => {
  const ts = state.world?.tileState?.[tile];
  return ts?.improvement === 'fort' && !ts.pillaged;
};

/** The nation whose land the fort stands on, or null. */
export const fortOwnerOf = (state, tile) => state.regions?.[state.world?.tileOwner?.[tile]]?.owner ?? null;

const isArmy = (u) => u && u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && (u.strength || 0) > 0;

/** The fort's garrison: its owner's land army standing on the tile. */
export const fortGarrison = (state, tile, units = state.units) => {
  const owner = fortOwnerOf(state, tile);
  if (!owner || !isFortTile(state, tile)) return [];
  return Object.values(units).filter((u) => isArmy(u) && u.ownerId === owner && unitTile(state, u) === tile);
};

/** Is `tile` next to a fort of a nation `nationId` may fight (zone of control, manned or not)? */
export const besideEnemyFort = (state, tiles, tile, nationId) => tiles.neighbors[tile].some((n) => {
  if (!isFortTile(state, n)) return false;
  const owner = fortOwnerOf(state, n);
  return !!owner && owner !== nationId && canAttack(state, nationId, owner);
});

/**
 * The battles forts start this turn: [{ fortTile, owner, moverId, from, attackerIds }], in tile
 * order. `startUnits`: the units as they stood when the turn began (who moved).
 */
export const fortChallenges = (state, startUnits) => {
  const tiles = getTiles();
  const stacks = new Map(); // `${owner}|${tile}` -> unit ids that entered that tile this turn
  Object.values(state.units).forEach((u) => {
    if (!isArmy(u) || u.raidOf) return;
    const t = unitTile(state, u);
    const before = startUnits?.[u.id];
    if (t == null || !before || unitTile({ ...state, units: startUnits }, before) === t) return;
    const k = `${u.ownerId}|${t}`;
    if (!stacks.has(k)) stacks.set(k, []);
    stacks.get(k).push(u.id);
  });
  const out = [];
  const usedForts = new Set();
  [...stacks.keys()].sort().forEach((k) => {
    const [owner, tileStr] = k.split('|');
    const from = Number(tileStr);
    const fort = tiles.neighbors[from].filter((n) => !usedForts.has(n) && isFortTile(state, n)).sort((a, b) => a - b).find((n) => {
      const fortOwner = fortOwnerOf(state, n);
      return fortOwner && fortOwner !== owner && canAttack(state, owner, fortOwner) && fortGarrison(state, n).some((g) => !isUnitInBattle(state, g.id));
    });
    if (fort == null) return;
    const ids = stacks.get(k).filter((id) => !isUnitInBattle(state, id));
    if (!ids.length) return;
    usedForts.add(fort);
    out.push({ fortTile: fort, owner: fortOwnerOf(state, fort), moverId: owner, from, attackerIds: ids });
  });
  return out;
};

const actorView = (state, nationId) => ({ ...state, playerNationId: nationId, resources: nationId === state.playerNationId ? state.resources : getPool(state, nationId), techAgeId: getTechAgeId(state, nationId) });

/**
 * Every battle a manned fort starts this turn (resolveTurn, after the marches and the AI's moves).
 * With the player on either side it joins the battle queue; AI against AI is fought on Auto.
 */
export const processFortBattles = (state, startUnits) => {
  const challenges = fortChallenges(state, startUnits);
  if (!challenges.length) return state;
  let next = state;
  challenges.forEach((c) => {
    const first = next.units[c.attackerIds[0]];
    if (!first) return;
    const actor = actorView(next, c.moverId);
    const v0 = validateFieldAttack(actor, first.regionId, c.fortTile, { ignoreCost: true, ignoreBattleLocks: true });
    if (!v0.ok) return;
    const v = { ...v0, attackerUnits: v0.attackerUnits.filter((u) => c.attackerIds.includes(u.id) || u.domain === 'air'), fromTile: c.from };
    if (!v.attackerUnits.some((u) => u.domain === 'land')) return;
    const seed = Math.floor(hashRoll(`fort|${c.fortTile}|${next.turnNumber}|${c.moverId}`) * 4294967296) >>> 0;
    const units = { ...next.units };
    v.attackerUnits.forEach((u) => { if (units[u.id]) units[u.id] = { ...units[u.id], movesLeft: 0, route: undefined, routeHalt: null }; });
    const name = next.regions[next.world?.tileOwner?.[c.fortTile]]?.name;
    if (c.moverId === next.playerNationId || c.owner === next.playerNationId) {
      const record = { ...fieldDefenseRecord(next, v, { aggressorId: c.moverId, seed, kind: 'field' }), id: `ft_${next.turnNumber}_${c.moverId}_${c.fortTile}`, fort: true };
      const mine = c.moverId === next.playerNationId;
      next = {
        ...next, units, pendingDefenses: [...(next.pendingDefenses || []), record],
        logs: [...next.logs, { year: next.year, message: mine ? `The fort near ${name || 'the border'} stops your army: it must fight its way past.` : `Your fort near ${name || 'the border'} stops ${next.nations[c.moverId]?.name || 'the enemy'}'s army.`, type: 'combat' }]
      };
      return;
    }
    const ctx = getFieldBattleContext(actor, v);
    const battle = resolveAutoBattle(actor, getFieldResolveArgs(v, ctx), { kind: 'field', fromRegionId: v.fromRegionId }, createRng(seed));
    const r = applyFieldResult({ ...actor, units }, v, battle, { rngSeed: next.rngSeed, attackerNationId: c.moverId, viewerId: next.playerNationId, id: `ft_${next.turnNumber}_${c.moverId}_${c.fortTile}` });
    next = { ...next, units: r.units, regions: r.regions, nations: { ...r.nations, [c.moverId]: { ...r.nations[c.moverId], economy: next.nations[c.moverId]?.economy } }, hiredCommanders: r.hiredCommanders, appliedBattleIds: r.appliedBattleIds, world: r.world || next.world, wars: r.wars };
  });
  return next;
};
