// src/engine/pirates.js
// Pirates (lane naval-9; Civ VI's barbarian galleys, EU4's pirates): the first warship gets a target.
// In 8 headless games of 150 turns nobody fought a single fleet-against-fleet battle, so a ship had
// nothing to do at sea.
//
//   when    a major (the player or an AI) from the Bronze age on, with a sea-coast city, not in
//           Explore mode: once its pirate wait is over, each turn rolls PIRATE_CHANCE (hashRoll of
//           the nation and the turn). The wait is PIRATE_REF_TURNS reference turns (speedTurns, at
//           the major's age) after the last ship, and as long again at the start of the Bronze age.
//   who     the nearest coastal independent within PIRATE_KM of the port (sea raiders first, the
//           `seaRaiders` independents of data/independents.js). None in reach: no pirates.
//   what    ONE weak raider ship (PIRATE_STRENGTH men, `unit.pirate = { target, until }`) on a free
//           water tile beside one of the major's sea-coast cities. It never moves and never attacks.
//   effect  while it stands there it cuts the player's sea trade routes through that port
//           (plunder.js, then tradeDisruptions.js: an event with a cause, a length and an end).
//           Pirates cut trade without a war; every other rule reads them as an independent's ship.
//   end     sunk in a sea battle (the player's ATTACK_FLEET, or an AI fleet beside it at peace:
//           aiOperations.js aiFleetAttack; navalBattle.js and applyBattleOutcome as every sea
//           battle), or gone after PIRATE_STAY_REF_TURNS, or when their people is gone.
// The player reads one line when pirates appear off a city of theirs and one when they sail off.
// State: the ship itself, and `nation.pirateNext` (the turn the next may come). Pure.
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { isAgeAtLeast, speedTurns } from '../data/ages';
import { isIndependentNation } from '../data/independents';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { hasSeaCoast } from './world/cities';
import { portWaters, isFleet, seaPassable } from './fleets';
import { mapEffectsFor } from './techMapEffects';
import { unitTile } from './armies';
import { ageOf } from './nationState';
import { independentAgeOf } from './ageRefs';
import { exploreOn, canFight } from './hostility';
import { hashRoll } from './aftermath';
import { msg, people, cityRef } from './messages';

export const PIRATE_FROM_AGE = 'bronze';
export const PIRATE_REF_TURNS = 16;      // the least wait between two pirate ships off one major (about 25 turns at Normal)
export const PIRATE_STAY_REF_TURNS = 5;  // a pirate ship not sunk sails off after this long (about 8 turns at Normal)
export const PIRATE_CHANCE = 0.15;       // a turn's roll once the wait is over
export const PIRATE_STRENGTH = 400;      // a weak raider: one warship of the age (1,000) sinks it
export const PIRATE_KM = 2500;           // how far from the port the pirates' home may be

export const isPirate = (u) => !!u?.pirate;

const coastalIndependents = (state, tiles) => Object.values(state.nations).filter((n) => isIndependentNation(n) && !n.isEliminated && state.regions[n.capitalRegionId] && hasSeaCoast(tiles, state.regions[n.capitalRegionId]));

/** One turn of pirates: ships gone, ships come. Returns { units, nations, logs } (the same objects when nothing changed). */
export const advancePirates = (state, turn) => {
  if (exploreOn(state)) return { units: state.units, nations: state.nations, logs: [] };
  const tiles = getTiles();
  const me = state.playerNationId;
  const logs = [];
  let units = state.units;
  let nations = state.nations;
  const edit = () => { if (units === state.units) units = { ...state.units }; };
  // Gone: sunk ships are removed by the battle; here the ones whose time is up or whose people fell.
  Object.values(state.units).forEach((u) => {
    if (!isPirate(u)) return;
    if (u.pirate.until > turn && !state.nations[u.ownerId]?.isEliminated) return;
    edit();
    delete units[u.id];
    const city = state.regions[u.pirate.target];
    if (city?.owner === me) logs.push(msg('m.pirates.gone', { nation: people(u.ownerId, state.nations[u.ownerId]?.name), city: cityRef(city.id, city.name) }));
  });
  let indeps = null;
  Object.keys(state.nations).sort().forEach((id) => {
    const nation = state.nations[id];
    if (nation.isEliminated || isIndependentNation(nation) || id === REBEL_OWNER_ID) return;
    const age = ageOf(state, id);
    if (!isAgeAtLeast(age, PIRATE_FROM_AGE)) return;
    const wait = speedTurns(PIRATE_REF_TURNS, state.gameSpeed, age);
    if (nation.pirateNext == null) { nations = { ...nations, [id]: { ...nations[id], pirateNext: turn + wait } }; return; } // the age's first turns are quiet
    if (turn < nation.pirateNext || hashRoll(`${turn}|pirates|${state.rngSeed}|${id}`) >= PIRATE_CHANCE) return;
    const ports = Object.values(state.regions).filter((c) => c.owner === id && c.tile != null && !c.outpost && !c.ghost && hasSeaCoast(tiles, c)).sort((a, b) => (a.id < b.id ? -1 : 1));
    if (!ports.length) return;
    const port = ports[Math.floor(hashRoll(`${turn}|pirate port|${state.rngSeed}|${id}`) * ports.length)];
    indeps ||= coastalIndependents(state, tiles);
    const at = tiles.centres[port.tile];
    const home = indeps.map((n) => ({ n, km: distanceKm(at, tiles.centres[state.regions[n.capitalRegionId].tile]), raiders: n.indep?.seaRaiders ? 0 : 1 }))
      .filter((x) => x.km <= PIRATE_KM && canFight(state, id, x.n.id)).sort((a, b) => a.raiders - b.raiders || a.km - b.km || (a.n.id < b.n.id ? -1 : 1))[0]?.n; // a truce or tribute keeps their pirates off
    const effects = mapEffectsFor(state, id);
    const taken = new Set(Object.values(units).filter(isFleet).map((u) => unitTile(state, u)));
    // beside the city's centre, where a ship in port can reach it (navalBattle.js: an attack is on a neighbouring tile)
    // water this major's ships can sail, so its first warship can meet them
    const free = portWaters(state, tiles, port.id).filter((t) => !taken.has(t) && seaPassable(tiles, t, age, effects.deepOcean > 0, effects.navalMoves > 0));
    const tile = free.find((t) => tiles.neighbors[port.tile].includes(t)) ?? free[0];
    nations = { ...nations, [id]: { ...nations[id], pirateNext: turn + wait } };
    if (!home || tile == null) return;
    edit();
    const shipId = `pirate-${turn}-${id}`;
    const stay = speedTurns(PIRATE_STAY_REF_TURNS, state.gameSpeed, age);
    units[shipId] = { id: shipId, ownerId: home.id, regionId: home.capitalRegionId, homeRegionId: home.capitalRegionId, tile, ageId: independentAgeOf(state, home.id), domain: 'naval', classId: 'naval', navalLine: 'raider', transportCapacity: 0, strength: PIRATE_STRENGTH, maxStrength: PIRATE_STRENGTH, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, pirate: { target: port.id, until: turn + stay } };
    if (id === me) logs.push(msg('m.pirates.appear', { nation: people(home.id, home.name), city: cityRef(port.id, port.name), turns: stay }));
  });
  return { units, nations, logs };
};
