// src/engine/sieges.js
// Sieges on tiles (plans/civ-map-rework.md, D2; workstream 6). A city has WALLS (0 to 3 from the
// Defense building line: none, Palisade, Stone Walls, Star Fort and better) and siege HP
// `SIEGE_HP_BASE x (1 + walls) x (1 + size / 10)`. Enemy land units standing on the tiles around
// the city centre (ring 1) BESIEGE it:
//   damage a turn  the besiegers' siege strength (SIEGE_STRENGTH_SIEGE per siege unit, SIEGE_STRENGTH_OTHER
//                  per other unit, x SIEGE_ENGINEERING_MULT with Siege Engineering) minus the walls'
//                  regen (WALL_REGEN x walls), never below 0
//   encircled      every land tile of ring 1 holds a besieger and every water tile beside the city
//                  is blockaded (fleets.js): damage doubles and the walls do not regenerate
//   yields         a besieged city (besiegers present) works ring 1 only for production and taxes,
//                  and those are cut to SIEGE_YIELD_MULT (cities.js); its food is untouched
//   relief         a turn without besiegers heals SIEGE_HEAL of the max HP; at full HP the siege
//                  record is dropped
// A SIEGE NEVER TAKES A CITY (the user's rule of 14 October): no fall at 0 HP, no surrender, no
// starving out. HP at 0 stays at 0 while the besiegers stay; the city is taken only by an attack
// (cityAssault.js on Auto: the attack that brings the HP to 0 takes an empty city; Command: winning
// the real-time battle). The siege only makes that attack easier: lower HP, battered walls
// (battleInputs.js hpRatio), a poorer city. Rebels besiege too.
//   intent         an army beside an enemy city at war besieges it; beside an independent's city
//                  only under an order (besiegesCity below: Lay siege, or an AI campaign)
// Ripples: a siege feeds war score through the capture, the supply meter (besiegers sit in enemy
// land), the city's yields and growth, and the AI's "threatened city" objective (aiOperations).
import { getTiles } from '../data/geo/tiles';
import { msg, sub, people, cityRef } from './messages';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { canAttack, isIndependentId } from './hostility';
import { getResearched } from './nationState';
import { unitTile } from './armies';
import { isBlockaded, isFleet, portWaters } from './fleets';
import { NAVAL_BOMBARD, navalBombards } from '../data/navalLines';
import { isSettler } from './settlers';
import { cityWonderTotal } from '../data/greatProjects';
import { BUILDING_CATEGORIES } from '../data/buildings';

export const SIEGE_HP_BASE = 200;
export const SIEGE_STRENGTH_SIEGE = 40;
export const SIEGE_STRENGTH_OTHER = 15;
export const SIEGE_ENGINEERING_MULT = 1.5;
export const SIEGE_ENGINEERING_TECH = 'military_siege_engineering';
export const WALL_REGEN = 5;
export const ENCIRCLE_MULT = 2;
export const SIEGE_HEAL = 0.1;
export const MAX_WALLS = 3;
/** Is the city besieged right now (besiegers beside it this turn)? A battered city whose siege was
 * lifted keeps a healing `siege` record without `by`. */
export const isBesieged = (city) => !!city?.siege?.by;

/** Walls from the Defense line's fort level: none 0, Earthwork Ditch and Palisade 1, Stone Walls 2, Star Fort and up 3. */
export const wallsOf = (city) => Math.min(MAX_WALLS, Math.ceil(BUILDING_CATEGORIES.defense.tiers[city.buildings?.categories?.defense ?? -1]?.effects['local.fortLevel'] || 0));
// `greatProjects` (state.greatProjects): a national fortress wonder in the city (Masada,
// greatProjects.js cityEffects 'local.wallHp') raises the walls' HP by its share.
export const siegeMaxHp = (city, greatProjects = null) => Math.round(SIEGE_HP_BASE * (1 + wallsOf(city)) * (1 + (city.size || 1) / 10) * (1 + cityWonderTotal(greatProjects, city.id, 'local.wallHp')));
export const siegeHpOf = (city, greatProjects = null) => (city.siege ? city.siege.hp : siegeMaxHp(city, greatProjects));

/**
 * Does this unit, standing beside the city, besiege it? Hostile intent is explicit (playtest
 * audit I130: an army parked next to an independent's city began a siege on its own, and calling
 * off an assault left one running):
 *   at war       a declared war is the intent: an enemy army beside the city besieges it (the AI's
 *                fronts and the "threatened city" objective rely on it); rebels likewise
 *   independent  an independent's city may be attacked without a war (hostility.js), so standing
 *                beside it means nothing. It is besieged only under an order: the player's
 *                Lay siege (`unit.siegeOf` = the city id, gameReducer SET_SIEGE, shown on the army
 *                sheet until lifted or the army is told to move), or an AI campaign's siege force
 *                (`unit.indepOp` = the city id, indepPolicy.js)
 * A passive independent never besieges (canAttack).
 */
export const besiegesCity = (state, unit, city) => {
  if (!city || unit.ownerId === city.owner || !canAttack(state, unit.ownerId, city.owner)) return false;
  if (!isIndependentId(state, city.owner)) return true;
  // indepOp is the independent's NATION id (indepPolicy.js tagForce); in the legacy world that is also its
  // city's id, so the old test passed while peoples-world campaigns never laid a siege (I125).
  return unit.siegeOf === city.id || unit.indepOp === city.owner || unit.indepOp === city.id;
};

/** City centres by tile: Map tile -> city id (for besiegedCityOf over many units). */
export const centreIndex = (state) => {
  const map = new Map();
  Object.values(state.regions || {}).forEach((c) => { if (c.tile != null && c.owner) map.set(c.tile, c.id); });
  return map;
};

/** The city this land unit besieges from the tile it stands on (ring 1 of the centre), or null. */
export const besiegedCityOf = (state, unit, centres = centreIndex(state)) => {
  if (unit.domain === 'naval' || unit.embarkedOn || isSettler(unit) || !(unit.strength > 0)) return null;
  const t = unitTile(state, unit);
  if (t == null) return null;
  for (const n of getTiles().neighbors[t]) {
    const id = centres.get(n);
    if (id != null && besiegesCity(state, unit, state.regions[id])) return id;
  }
  return null;
};

/**
 * The independent cities the stack on `tile` could lay siege to, or already does (the army
 * sheet's Lay siege / Lift the siege): [{ regionId, name, on }]. Cities at war with the player
 * are besieged without an order and are not listed.
 */
export const siegeOrders = (state, tile, units, nationId = state.playerNationId) => {
  const out = [];
  getTiles().neighbors[tile].forEach((n) => {
    const id = state.world?.tileOwner?.[n];
    const city = id != null ? state.regions[id] : null;
    if (!city || city.tile !== n || city.owner === nationId || !isIndependentId(state, city.owner) || !canAttack(state, nationId, city.owner)) return;
    out.push({ regionId: id, name: city.name, on: units.length > 0 && units.every((u) => u.siegeOf === id) });
  });
  return out.sort((a, b) => (a.regionId < b.regionId ? -1 : 1));
};

/** Land units (no cargo, no settlers, alive) by the tile they stand on: Map tile -> units. Built
 * once per turn and shared by the siege and loyalty phases. */
export const landUnitsByTile = (state, units = state.units) => {
  const map = new Map();
  Object.values(units).forEach((u) => {
    if (u.domain === 'naval' || u.embarkedOn || isSettler(u) || !(u.strength > 0)) return;
    const t = unitTile(state, u);
    if (t == null) return;
    const list = map.get(t); if (list) list.push(u); else map.set(t, [u]);
  });
  return map;
};

/** Enemy land units on the tiles around the city centre (ring 1), grouped by nation. */
export const besiegersOf = (state, city, units = state.units, byTile = null) => {
  const tiles = getTiles();
  const index = byTile || landUnitsByTile(state, units);
  const byNation = new Map();
  tiles.neighbors[city.tile].forEach((t) => (index.get(t) || []).forEach((u) => {
    if (!besiegesCity(state, u, city)) return;
    if (!byNation.has(u.ownerId)) byNation.set(u.ownerId, []);
    byNation.get(u.ownerId).push(u);
  }));
  return byNation;
};

const researchedOf = (state, nationId) => (nationId === REBEL_OWNER_ID ? [] : getResearched(state, nationId));

/** The siege strength of a stack: siege units 20, others 3, x1.5 with Siege Engineering. */
export const siegeStrength = (state, nationId, units) => {
  const base = units.reduce((s, u) => s + (u.classId === 'siege' ? SIEGE_STRENGTH_SIEGE : SIEGE_STRENGTH_OTHER), 0);
  return researchedOf(state, nationId).includes(SIEGE_ENGINEERING_TECH) ? base * SIEGE_ENGINEERING_MULT : base;
};

/** The bombardment of the besieging nations' warships on the city's port waters: NAVAL_BOMBARD each. */
export const bombardStrength = (state, city, units, nationIds) => {
  if (!nationIds.length || city.tile == null) return 0;
  const waters = new Set(portWaters(state, getTiles(), city.id));
  if (!waters.size) return 0;
  return Object.values(units).reduce((s, u) => (isFleet(u) && u.strength > 0 && nationIds.includes(u.ownerId) && navalBombards(u) && waters.has(unitTile(state, u)) ? s + NAVAL_BOMBARD : s), 0);
};

/** True when every land tile of ring 1 holds a besieger of `nationId` and every water tile beside
 * the city is blockaded. */
export const isEncircled = (state, city, nationId, units = state.units, byTile = null) => {
  const tiles = getTiles();
  const index = byTile || landUnitsByTile(state, units);
  const ring = tiles.neighbors[city.tile];
  const landClosed = ring.filter((t) => tiles.land[t] === 1).every((t) => (index.get(t) || []).some((u) => u.ownerId === nationId));
  const hasWater = ring.some((t) => tiles.land[t] !== 1 && tiles.terrainOf(t) !== 'lake');
  return landClosed && (!hasWater || isBlockaded(state, city.id, units));
};

/**
 * The siege phase of a turn, on the turn's working `regions` (mutated in place) against `units`.
 * Returns { logs: [{ nationId, message }] }. A siege never changes a city's owner.
 */
export const processSieges = (state, regions, units, { turn }) => {
  const logs = [];
  const view = { ...state, regions };
  const byTile = landUnitsByTile(view, units);
  Object.keys(regions).sort().forEach((id) => {
    const city = regions[id];
    if (city.tile == null || !city.owner) return;
    const by = besiegersOf(view, city, units, byTile);
    if (!by.size) {
      if (city.siege) {
        const full = siegeMaxHp(city, state.greatProjects);
        const hp = Math.min(full, city.siege.hp + Math.round(full * SIEGE_HEAL));
        regions[id] = hp >= full ? { ...city, siege: null } : { ...city, siege: { ...city.siege, hp, by: null, encircled: false } };
      }
      return;
    }
    // The strongest besieging nation leads the siege; the others add their strength.
    const stacks = [...by].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
    const leader = stacks[0][0];
    const bombard = bombardStrength(view, city, units, [...by.keys()]); // warships on the port waters (navalLines.js)
    const strength = stacks.reduce((s, [nid, list]) => s + siegeStrength(state, nid, list), 0) + bombard;
    const encircled = isEncircled(view, city, leader, units, byTile);
    const regen = encircled ? 0 : WALL_REGEN * wallsOf(city);
    const damage = Math.max(0, Math.round((strength - regen) * (encircled ? ENCIRCLE_MULT : 1)));
    const maxHp = siegeMaxHp(city, state.greatProjects);
    const prev = city.siege || { hp: maxHp, startedTurn: turn };
    const hp = Math.max(0, Math.min(maxHp, prev.hp) - damage);
    const siege = { hp, maxHp, by: leader, startedTurn: prev.startedTurn ?? turn, encircled };
    regions[id] = { ...city, siege };
    const cityName = cityRef(id, city.name);
    if (!city.siege?.by) logs.push({ nationId: city.owner, ...msg('m.battle.underSiege', { city: cityName, by: state.nations[leader]?.name ? people(leader, state.nations[leader].name) : sub('m.battle.rebels') }) }, { nationId: leader, ...msg('m.battle.laySiege', { city: cityName, walls: wallsOf(city), hp }) });
    // The walls are down: the siege can do no more. Only an attack takes the city.
    if (hp <= 0 && prev.hp > 0) logs.push({ nationId: leader, ...msg('m.battle.siegeBrokeWalls', { city: cityName }) }, { nationId: city.owner, ...msg('m.battle.siegeBrokeOurWalls', { city: cityName }) });
  });
  return { logs };
};
