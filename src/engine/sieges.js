// src/engine/sieges.js
// Sieges on tiles (plans/civ-map-rework.md, D2; workstream 6). A city has WALLS (0 to 3 from the
// Defense building line: none, Palisade, Stone Walls, Star Fort and better) and siege HP
// `SIEGE_HP_BASE x (1 + walls) x (1 + size / 10)`. Enemy land units standing on the tiles around
// the city centre (ring 1) BESIEGE it:
//   damage a turn  the besiegers' siege strength (SIEGE_STRENGTH_SIEGE per siege unit, SIEGE_STRENGTH_OTHER
//                  per other unit, x SIEGE_ENGINEERING_MULT with Siege Engineering) minus the walls'
//                  regen (WALL_REGEN x walls), never below 0
//   encircled      every land tile of ring 1 holds a besieger and every water tile beside the city
//                  is blockaded (fleets.js): damage doubles and the city starves (size -1 every
//                  ENCIRCLE_STARVE_TURNS turns)
//   yields         a besieged city works ring 1 only (cities.js); the countryside is the enemy's
//   relief         a turn without besiegers heals SIEGE_HEAL of the max HP; at full HP the siege
//                  record is dropped
//   fall           at HP 0 the city falls to the besieger: the player's and an AI's conquest go
//                  through conquest.js at once; a player city falls through a last-stand assault
//                  (defense.js, the pending defence of the turn), so the player may still fight
// Assaults stay the attack card (invasion.js). Rebels besiege too.
// Ripples: a siege feeds war score through the capture, the supply meter (besiegers sit in enemy
// land), the city's yields and growth, and the AI's "threatened city" objective (aiOperations).
import { getTiles } from '../data/geo/tiles';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { canAttack } from './hostility';
import { getResearched } from './nationState';
import { unitTile } from './armies';
import { isBlockaded, isFleet, portWaters } from './fleets';
import { NAVAL_BOMBARD, navalBombards } from '../data/navalLines';
import { isSettler } from './settlers';
import { cityWonderTotal } from '../data/greatProjects';

export const SIEGE_HP_BASE = 200;
export const SIEGE_STRENGTH_SIEGE = 40;
export const SIEGE_STRENGTH_OTHER = 15;
export const SIEGE_ENGINEERING_MULT = 1.5;
export const SIEGE_ENGINEERING_TECH = 'military_siege_engineering';
export const WALL_REGEN = 5;
export const ENCIRCLE_MULT = 2;
export const ENCIRCLE_STARVE_TURNS = 4;
export const SIEGE_HEAL = 0.1;
export const MAX_WALLS = 3;

/** Walls from the Defense building line: none 0, Palisade 1, Stone Walls 2, Star Fort and up 3. */
export const wallsOf = (city) => Math.min(MAX_WALLS, (city.buildings?.categories?.defense ?? -1) + 1);
// `greatProjects` (state.greatProjects): a national fortress wonder in the city (Masada,
// greatProjects.js cityEffects 'local.wallHp') raises the walls' HP by its share.
export const siegeMaxHp = (city, greatProjects = null) => Math.round(SIEGE_HP_BASE * (1 + wallsOf(city)) * (1 + (city.size || 1) / 10) * (1 + cityWonderTotal(greatProjects, city.id, 'local.wallHp')));
export const siegeHpOf = (city, greatProjects = null) => (city.siege ? city.siege.hp : siegeMaxHp(city, greatProjects));

// Who besieges a city: anyone who may attack its owner (hostility.js: at war, rebels, or anyone
// against an independent; a passive independent never besieges).
const besieges = (state, ownerId, cityOwnerId) => canAttack(state, ownerId, cityOwnerId);

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
    if (u.ownerId === city.owner || !besieges(state, u.ownerId, city.owner)) return;
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
 * Returns { fallen: [{ cityId, to, from, encircled }], logs: [{ nationId, message }] }.
 * The caller resolves the falls (conquest.js, or a last-stand defence for the player).
 */
export const processSieges = (state, regions, units, { turn }) => {
  const fallen = []; const logs = [];
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
    const prev = city.siege || { hp: maxHp, startedTurn: turn, starving: 0 };
    const hp = Math.max(0, Math.min(maxHp, prev.hp) - damage);
    let size = city.size;
    let starving = encircled ? (prev.starving || 0) + 1 : 0;
    if (encircled && starving >= ENCIRCLE_STARVE_TURNS && size > 1) { size -= 1; starving = 0; logs.push({ nationId: city.owner, message: `${city.name}, encircled, starves and shrinks to size ${size}.` }); }
    const siege = { hp, maxHp, by: leader, startedTurn: prev.startedTurn ?? turn, encircled, starving };
    regions[id] = { ...city, size, siege, food: encircled ? 0 : city.food };
    if (!city.siege) logs.push({ nationId: city.owner, message: `${city.name} is under siege by ${state.nations[leader]?.name || 'rebels'}.` }, { nationId: leader, message: `Your army lays siege to ${city.name} (walls ${wallsOf(city)}, ${hp} HP).` });
    if (hp <= 0) fallen.push({ cityId: id, to: leader, from: city.owner, encircled });
  });
  return { fallen, logs };
};
