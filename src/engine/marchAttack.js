// src/engine/marchAttack.js
// March to attack: the player's Attack on a city the army does not border (the user's playtest:
// "I clicked Attack and it opened the attack modal even when the unit was far from it").
//
//   Adjacent   the army can assault the city now (invasion.js validateInvasion finds units that
//              touch its land, or the army stands inside a city whose land touches it): the attack
//              card opens at once, as before.
//   Far        Attack becomes a march order (routes.js orderMarch) with an attack intent: every
//              unit of the stack gets `routeAttack` = the city's id. The army walks its route at End
//              Turn like any march (move points, zone of control, rivers, enemy land at war) and
//              halts before the city's centre (routes.js halt 'attack'): standing on the ring
//              around the city it besieges it (sieges.js). That turn the player is offered the
//              assault (readyAttacks below): the pre-battle card, Command or Auto, the same card
//              and the same outcome service as any assault. An enemy army met on the way halts
//              the march (halt 'enemy') and is offered as a field battle the same way.
//   Rules      the intent needs the target to be attackable (hostility.js canAttack: at war, or an
//              independent); without a war the order is refused. Calling the assault off drops
//              the intent (the army stays where it stands, still besieging). Player only: AI
//              armies keep their own operations (aiOperations.js), so the AI world is unchanged.
// Pure.
import { getTiles } from '../data/geo/tiles';
import { canAttack } from './hostility';
import { validateInvasion } from './invasion';
import { validateFieldAttack, enemyStackAt } from './fieldBattle';
import { orderMarch, planMarch, marchingUnits } from './routes';
import { unitTile } from './armies';

// Reasons that still mean "the army borders the city" (it only lacks a move, gold or a war).
const ADJACENT_REASONS = ['no_moves', 'cost', 'no_war'];

/**
 * How the stack in `fromId` (or `unitIds`) stands towards the city `cityId`:
 * 'adjacent' (the attack card can open now), 'far' (it must march first) or null (not a city
 * the player could attack: its own, unknown).
 */
export const attackReach = (state, fromId, cityId, unitIds = null) => {
  const city = state.regions?.[cityId];
  if (!city || city.owner === state.playerNationId) return null;
  const v = validateInvasion(state, fromId, cityId, { ignoreCost: true });
  if (!(v.ok || ADJACENT_REASONS.includes(v.reason))) return 'far';
  if (!unitIds) return 'adjacent';
  // A chosen part of the stack: those units must be among the ones that reach the city.
  const reaching = v.ok ? new Set(v.attackerUnits.map((u) => u.id)) : null;
  return !reaching || unitIds.some((id) => reaching.has(id)) ? 'adjacent' : 'far';
};

/**
 * The preview of a march to attack: planMarch plus `targetRegionId`, `stopsAt` (a city of another
 * enemy on the way where the march will halt first, or null) and `canAttack`.
 */
export const planMarchAttack = (state, fromId, cityId, unitIds = null) => {
  const city = state.regions?.[cityId];
  if (!city) return { ok: false, reason: 'Unknown place.' };
  const plan = planMarch(state, fromId, cityId, unitIds);
  if (!plan.ok) return plan;
  return { ...plan, targetRegionId: cityId, stopsAt: plan.haltAt && plan.haltAt !== cityId ? plan.haltAt : null, canAttack: canAttack(state, state.playerNationId, city.owner) };
};

/**
 * Give the order (gameReducer SET_ROUTE with `attack`). Returns { units, plan } or { reason }
 * ('no_war' | 'adjacent' | a planMarch reason).
 */
export const orderMarchAttack = (state, fromId, cityId, unitIds = null) => {
  const city = state.regions?.[cityId];
  if (!city || city.owner === state.playerNationId) return { reason: 'That city cannot be attacked.' };
  if (!canAttack(state, state.playerNationId, city.owner)) return { reason: 'no_war' };
  if (attackReach(state, fromId, cityId, unitIds) === 'adjacent') return { reason: 'adjacent' };
  const order = orderMarch(state, fromId, cityId, unitIds);
  if (!order.units) return order;
  const units = order.units;
  order.plan.units.forEach((id) => { if (units[id]?.route?.length) units[id] = { ...units[id], routeAttack: cityId }; });
  return { units, plan: { ...order.plan, targetRegionId: cityId, stopsAt: order.plan.haltAt && order.plan.haltAt !== cityId ? order.plan.haltAt : null } };
};

/**
 * Battles the player's marches to attack have reached this turn: the army stands on the ring of its
 * target city (kind 'city': { fromRegionId, targetRegionId }) or before an enemy army on its way
 * (kind 'field': { fromRegionId, tile }), and the attack is valid now (validateInvasion /
 * validateFieldAttack). One entry per stack and target, in a stable order.
 * [{ kind, key, fromRegionId, targetRegionId, tile, unitIds }]
 */
export const readyAttacks = (state) => {
  if (state.pendingBattle) return [];
  const me = state.playerNationId;
  const tiles = getTiles();
  const tileOwner = state.world?.tileOwner || {};
  const byKey = new Map();
  Object.values(state.units || {}).forEach((u) => {
    if (u.ownerId !== me || !u.routeAttack || !u.route?.length || !(u.strength > 0) || u.embarkedOn) return;
    const next = u.route[0];
    const at = unitTile(state, u);
    if (at == null || !tiles.neighbors[at]?.includes(next)) return;
    let entry = null;
    // At the city's ring: the next step is its centre (the march halts there; no need to wait a
    // turn for the halt to be recorded).
    if (tileOwner[next] === u.routeAttack && state.regions[u.routeAttack]?.tile === next) {
      entry = { kind: 'city', key: `city|${u.regionId}|${u.routeAttack}`, fromRegionId: u.regionId, targetRegionId: u.routeAttack, tile: next };
    } else if (enemyStackAt(state, next, me).length) {
      entry = { kind: 'field', key: `field|${u.regionId}|${next}`, fromRegionId: u.regionId, targetRegionId: null, tile: next };
    }
    if (!entry) return;
    const prev = byKey.get(entry.key);
    if (prev) prev.unitIds.push(u.id); else byKey.set(entry.key, { ...entry, unitIds: [u.id] });
  });
  return [...byKey.values()]
    .filter((e) => (e.kind === 'city' ? validateInvasion(state, e.fromRegionId, e.targetRegionId).ok : validateFieldAttack(state, e.fromRegionId, e.tile).ok))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
};

/** The player's units in `fromId` that would march (for the UI's counts). */
export const marchAttackUnits = (state, fromId, unitIds = null) => marchingUnits(state, fromId, unitIds);
