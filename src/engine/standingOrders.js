// src/engine/standingOrders.js
// What an army on the map is doing, and which armies still wait for an order (playtest audit
// I061, I062; plan W03 task 8; the user's Hold request, decision D12).
//
//   Hold        `unit.hold` (gameReducer SET_HOLD): the unit stays where it is and is not counted
//               idle, until the player lifts it or tells the unit to move (routes.js `released`:
//               a march, Move now). A hold changes no rule: the unit still fortifies by standing
//               still (fieldBattle.js isFortified), is supplied, fights when attacked.
//   Lay siege   `unit.siegeOf` (gameReducer SET_SIEGE, sieges.js besiegesCity): the explicit siege
//               order against an independent's city, ended the same way.
//
// armyStatus(state, unit) is the one answer every surface reads (the idle prompt, the army sheet):
//   'aboard'     cargo on a ship
//   'marching'   it has a route
//   'holding'    the Hold order
//   'besieging'  it stands beside a city it besieges (at war, or under a siege order)
//   'garrison'   it stands on a city's centre: garrisons rest in their cities
//   'spent'      no move left this turn
//   'idle'       in the field with a move left and nothing to do
// Only 'idle' asks for the player's attention. Old saves have neither field: both read as off.
// Pure.
import { unitTile } from './armies';
import { isSettler } from './settlers';
import { besiegedCityOf, centreIndex } from './sieges';

export const isHolding = (unit) => !!unit?.hold;

/** What the unit is doing (see the header). `centres`: sieges.js centreIndex, shared over many units. */
export const armyStatus = (state, unit, centres = centreIndex(state)) => {
  if (unit.embarkedOn) return 'aboard';
  if (unit.route?.length) return 'marching';
  if (isHolding(unit)) return 'holding';
  if (unit.domain !== 'naval' && besiegedCityOf(state, unit, centres) != null) return 'besieging';
  const t = unitTile(state, unit);
  if (t != null && centres.has(t)) return 'garrison';
  if (!(unit.movesLeft > 0)) return 'spent';
  return 'idle';
};

/**
 * The tiles where the player's land armies wait for an order, one per stack, in unit id order:
 * a stack is idle when one of its units is. Fleets, cargo and settlers are not armies here.
 */
export const idleArmyTiles = (state, nationId = state.playerNationId) => {
  const centres = centreIndex(state);
  const cityTiles = new Set(Object.values(state.regions || {}).map((c) => c.tile));
  const seen = new Set();
  const out = [];
  Object.values(state.units || {})
    .filter((u) => u.ownerId === nationId && u.strength > 0 && u.domain !== 'naval' && !u.embarkedOn && !isSettler(u))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .forEach((u) => {
      const t = unitTile(state, u);
      // A city's own tile is a garrison post whoever owns it (an army let in by an ally rests there too).
      if (t == null || seen.has(t) || cityTiles.has(t)) return;
      if (armyStatus(state, u, centres) !== 'idle') return;
      seen.add(t);
      out.push(t);
    });
  return out;
};

/** SET_HOLD: the player's land units among `unitIds` hold (or stop holding). Returns the new units
 * map, or null when nothing changed. A unit on a route cannot hold: halt the march first. */
export const setHold = (state, unitIds, hold = true) => {
  const mine = (unitIds || []).map((id) => state.units[id]).filter((u) => u && u.ownerId === state.playerNationId && u.domain !== 'naval' && !u.embarkedOn && !isSettler(u) && !!u.hold !== !!hold && !(hold && u.route?.length));
  if (!mine.length) return null;
  const units = { ...state.units };
  mine.forEach((u) => { units[u.id] = { ...u, hold: !!hold }; });
  return units;
};

/** SET_SIEGE: the player's land units among `unitIds` lay siege to `cityId` (null lifts it).
 * Returns the new units map, or null when nothing changed. sieges.js decides whether a unit that
 * holds the order really besieges (it must stand beside the city and be able to attack its owner). */
export const setSiege = (state, unitIds, cityId = null) => {
  const mine = (unitIds || []).map((id) => state.units[id]).filter((u) => u && u.ownerId === state.playerNationId && u.domain !== 'naval' && !u.embarkedOn && !isSettler(u) && (u.siegeOf ?? null) !== (cityId ?? null));
  if (!mine.length) return null;
  const units = { ...state.units };
  mine.forEach((u) => { units[u.id] = { ...u, siegeOf: cityId ?? null }; });
  return units;
};
