// src/engine/battleQueue.js
// The battle queue (plans/MASTER-PLAN.md 6.1 and 6.7 "Multiple battles in one turn", "Battles
// while a peace offer or event is open"). Every battle the player is in offers Command or Auto,
// attacker or defender (decision 24). The player's own attacks ask at once (the pre-battle sheet);
// the battles OTHERS start against the player wait in `state.pendingDefenses`, in the order the
// armies moved, and each pauses the turn (resolveTurn does nothing while one is queued):
//   kind 'defense' (or none)  an assault on one of the player's cities (defense.js)
//   kind 'field'              an AI stack attacks a player stack on a tile (a relief or a sally,
//                             aiOperations.js), fought as a field battle (fieldBattle.js)
//   kind 'naval'              an AI fleet attacks a player fleet (navalBattle.js)
//   kind 'raid' or 'sack'     an independent's raid party fights the player's troops on a tile, or
//                             sacks a player's town (raidBattle.js; settled by raids.js). Raids are
//                             not wars: these records carry no war id
//   kind 'intercept', 'landing'  an AI landing on the player's coast (aiLanding.js): the player's
//                             fleets there meet the transport first, then the landing itself
// AI against AI is always Auto (aiOperations.js fights it at once and never queues it).
// The queue waits, like resolveTurn, while an event or a peace offer is open: nothing in it is
// fought (Auto or Command) until the player answers; a peace signed meanwhile drops the battles of
// that war (the outcome service applies nothing for a war that ended). `battleSettings.autoDefend`
// fights the whole queue on Auto as soon as nothing blocks it (drainAutoBattles). Pure.
import { createRng } from '../utils/rng';
import { getTechAgeId, getPool } from './nationState';
import { resolveDefenseAuto, getDefenseArmies, estimateDefenseOdds } from './defense';
import { battleNameOf } from './battleName';
import { resolveAutoBattle } from './autoBattle';
import { validateFieldAttack, getFieldBattleContext, getFieldResolveArgs, applyFieldResult } from './fieldBattle';
import { validateFleetAttack, getFleetBattleContext, getFleetResolveArgs, applyFleetResult } from './navalBattle';
import { isRaidKind, queuedRaidArmies, raidSpecOf, fightRaidAuto } from './raidBattle';
import { resolveRaidBattle } from './raids';
import { isLandingKind, resolveInterceptQueued, resolveLandingQueued, landingHoldChance } from './aiLanding';

export const QUEUE_KINDS = ['defense', 'field', 'naval', 'raid', 'sack', 'intercept', 'landing'];

/** Does a queued battle still stand? A war's battle while its war is active; a raid while its raiders live. */
export const keepQueued = (d, wars, nations) => (d.warId ? wars.some((w) => w.id === d.warId && w.active) : isRaidKind(d.kind) && !!nations?.[d.aggressorId] && !nations[d.aggressorId].isEliminated);

/** Is the queue waiting for the player to answer an event or a peace offer first? */
export const battleQueueBlocked = (state) => !!(state.activeEventId || state.activeProceduralEvent || state.pendingPeaceOffer);

/** The kind of a queued battle (old records carry none: a city assault). */
export const queuedKind = (def) => (QUEUE_KINDS.includes(def?.kind) ? def.kind : 'defense');

/** The battles waiting for the player, in the order they come. */
export const queuedBattles = (state) => state.pendingDefenses || [];

/** The next battle to fight, or null while the queue waits (an event, a peace offer, a battle under way). */
export const nextQueuedBattle = (state) => (battleQueueBlocked(state) || state.pendingBattle ? null : queuedBattles(state)[0] || null);

// The aggressor's view of the state, for the gates that are written for "the player" as attacker.
export const aggressorView = (state, nationId) => ({ ...state, playerNationId: nationId, resources: getPool(state, nationId), techAgeId: getTechAgeId(state, nationId) });

const drop = (state, id) => ({ ...state, pendingDefenses: (state.pendingDefenses || []).filter((d) => d.id !== id) });

/** The armies of a queued field or sea battle as they stand now, validated as the aggressor's attack, or null. */
export const queuedArmies = (state, def) => {
  const actor = aggressorView(state, def.aggressorId);
  const v = def.kind === 'naval'
    ? validateFleetAttack(actor, def.fromTile, def.tile, { ignoreCost: true, ignoreBattleLocks: true })
    : validateFieldAttack(actor, def.fromRegionId, def.tile, { ignoreCost: true, ignoreBattleLocks: true });
  if (!v.ok) return null;
  const vv = { ...v, attackerUnits: v.attackerUnits.filter((u) => def.attackerUnitIds.includes(u.id)), defenderUnits: v.defenderUnits.filter((u) => def.defenderUnitIds.includes(u.id)) };
  return vv.attackerUnits.length && vv.defenderUnits.length ? { actor, v: vv } : null;
};

/** Fight one queued battle on Auto, whatever its kind. */
export const resolveQueuedAuto = (state, defId) => {
  const def = queuedBattles(state).find((d) => d.id === defId);
  if (!def) return state;
  const kind = queuedKind(def);
  if (kind === 'defense') return resolveDefenseAuto(state, defId);
  if (isRaidKind(kind)) return resolveRaidBattle(state, def, null, { mode: 'auto' });
  if (kind === 'intercept') return resolveInterceptQueued(state, def);
  if (kind === 'landing') return resolveLandingQueued(state, def);
  const armies = queuedArmies(state, def);
  if (!armies) return drop(state, defId); // the armies moved, died or made peace: no battle
  const { actor, v } = armies;
  const opts = { attackerNationId: def.aggressorId, viewerId: state.playerNationId, id: def.id, defenseId: def.id, mode: 'auto', rngSeed: state.rngSeed };
  if (kind === 'naval') {
    const battle = resolveAutoBattle(state, getFleetResolveArgs(v, getFleetBattleContext(actor, v)), { kind: 'naval' }, createRng(def.seed));
    return applyFleetResult(state, v, battle, opts);
  }
  const battle = resolveAutoBattle(state, getFieldResolveArgs(v, getFieldBattleContext(actor, v)), { kind: 'field', fromRegionId: def.fromRegionId }, createRng(def.seed));
  return applyFieldResult(state, v, battle, opts);
};

/** Fight every queued battle on Auto, in order (the one being commanded, if any, is left alone). */
export const resolveAllQueuedAuto = (state) => queuedBattles(state)
  .filter((d) => d.id !== state.pendingBattle?.defenseId)
  .reduce((s, d) => resolveQueuedAuto(s, d.id), state);

/** With autoDefend on, fight the queue on Auto as soon as nothing blocks it. */
export const drainAutoBattles = (state) => {
  if (state.battleSettings?.autoDefend !== true || !queuedBattles(state).length || battleQueueBlocked(state) || state.pendingBattle) return state;
  return resolveAllQueuedAuto(state);
};

/**
 * What the queue sheet shows for one battle: { kind, name, attackerUnits, defenderUnits, odds:
 * { holdChance, avgDamage?, undefended? } } (odds from the same honest auto-resolve, `samples` runs).
 */
export const queuedBattleView = (state, def, samples = 30) => {
  const kind = queuedKind(def);
  if (kind === 'defense') {
    const armies = getDefenseArmies(state, def);
    return { kind, name: battleNameOf(state, { kind: 'defense', regionId: def.regionId }), attackerUnits: armies.attackerUnits, defenderUnits: armies.defenderUnits, odds: estimateDefenseOdds(state, def, samples) };
  }
  if (isLandingKind(kind)) {
    const { armies, holdChance } = landingHoldChance(state, def, samples);
    return { kind, name: battleNameOf(state, { kind: kind === 'intercept' ? 'lane' : 'landing', regionId: def.regionId }), attackerUnits: armies?.attackerUnits || [], defenderUnits: [...(armies?.defenderUnits || []), ...(kind === 'landing' ? def.militia || [] : [])], odds: { holdChance } };
  }
  if (isRaidKind(kind)) {
    const armies = queuedRaidArmies(state, def);
    const spec = raidSpecOf(state, def, armies);
    let held = 0;
    for (let i = 0; i < samples; i++) if (fightRaidAuto(state, spec, createRng((def.seed + i * 0x9e3779b1) >>> 0)).outcome !== 'attacker') held += 1;
    return { kind, name: battleNameOf(state, { kind, tile: def.tile, regionId: def.regionId }), attackerUnits: armies.attackerUnits, defenderUnits: [...armies.defenderUnits, ...(def.militia || [])], odds: { holdChance: armies.attackerUnits.length ? held / samples : 1 } };
  }
  const armies = queuedArmies(state, def);
  const name = battleNameOf(state, { kind, tile: def.tile, regionId: def.regionId });
  if (!armies) return { kind, name, attackerUnits: [], defenderUnits: [], odds: { holdChance: 1 } };
  const { actor, v } = armies;
  const args = kind === 'naval' ? getFleetResolveArgs(v, getFleetBattleContext(actor, v)) : getFieldResolveArgs(v, getFieldBattleContext(actor, v));
  let held = 0;
  for (let i = 0; i < samples; i++) {
    const r = resolveAutoBattle(state, args, { kind, fromRegionId: def.fromRegionId }, createRng((def.seed + i * 0x9e3779b1) >>> 0));
    if (r.outcome !== 'attacker') held += 1;
  }
  return { kind, name, attackerUnits: v.attackerUnits, defenderUnits: v.defenderUnits, odds: { holdChance: held / samples } };
};

/** A queued field battle: an AI stack (`v`, validated as its attack) against a player stack. */
export const fieldDefenseRecord = (state, v, { aggressorId, seed, kind = 'field' }) => ({
  id: `${kind === 'naval' ? 'nd' : 'fd'}_${state.turnNumber}_${aggressorId}_${v.tile}`,
  kind, warId: v.war?.id ?? null, aggressorId,
  fromRegionId: v.fromRegionId, fromTile: v.fromTile ?? null, tile: v.tile,
  // The player's stack's own city: the record is about the player's army (worldLifecycle.js keeps it).
  regionId: v.defenderUnits[0]?.regionId ?? null,
  attackerUnitIds: v.attackerUnits.map((u) => u.id), defenderUnitIds: v.defenderUnits.map((u) => u.id),
  synthetic: [], seed: seed >>> 0, turn: state.turnNumber
});
