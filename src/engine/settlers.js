// src/engine/settlers.js
// Settlers and outposts (plans/civ-map-rework.md, C7; workstream 4).
//
//   Settler     built in a city's queue ("settler" item, cities.js: the city must be size 2 and
//               gives up one citizen). A land unit with no combat (strength SETTLER_STRENGTH,
//               never an attacker or a garrison) that stands on a tile and walks SETTLER_MOVES
//               tiles a turn towards its target over land it may cross: free land, its own
//               nation's land, and the land of a nation it is at war with or allied to (open
//               borders come with diplomacy on cities).
//   Found       on arrival at a legal site (cities.canFoundCity) the settler becomes an OUTPOST:
//               a city of size 1 that claims its ring but yields nothing and builds nothing
//               until its progress reaches OUTPOST_DONE. Progress a turn is OUTPOST_PROGRESS x
//               the terrain factor (open land 1, hills and forest 0.7, mountains, desert and
//               arctic 0.4), so an outpost on open land is a city in 8 turns, in the desert in 18,
//               at the reference pace; divided by the speed table's multiplier (ages.js
//               speedCostMult) so an outpost takes the same span of years at every game speed.
//   Slots       a nation runs at most OUTPOST_SLOTS_BY_AGE[age] outposts at once (the colony
//               slots of before); a settler that arrives while every slot is taken waits.
//   AI          an AI settler picks the best site in reach the turn it is built (scoreSite:
//               yields of the centre and its ring, a resource, a river, the coast, distance from
//               the capital), the player picks a tile on the map (SET_SETTLER_TARGET). One that
//               found no site looks again every SETTLER_RETRY_TURNS turns, as far as
//               MAX_SETTLE_RINGS, and is disbanded after SETTLER_GIVE_UP_TURNS turns idle: an
//               idle settler would otherwise block its nation's next one for the whole game
//               (aiProduction.js builds a settler only when the nation has none).
//   Ripples     a new city pays upkeep and claims land (cities.js), the nation's city count raises
//               later settler and tile costs (cities.productionCost, tileCultureCost), and more
//               cities mean more amenities to find (cities.amenitiesOf). Natives and loyalty
//               pressure on far outposts arrive with C5 and C7.3.
import { pickCityName } from './cityNames';
import { getTiles } from '../data/geo/tiles';
import { canFoundCity, foundCity, ringDistance, cityId, SETTLER_MIN_SIZE } from './world/cities';
import { tileFacts, tileYields } from '../data/tileYields';
import { legacyTerrainOf } from './world/registry';
import { isWarBetween } from './diplomacy';
import { settlingBarred } from './accords';
import { isExplored } from './fog';
import { speedCostMult } from '../data/ages';
import { ringsForKm, kmPerRing, F75_RING_KM } from '../data/geo/gridScale';

export const SETTLER_KM = 306; // km (3 rings at frequency 75)
export const SETTLER_MOVES = ringsForKm(SETTLER_KM);
export const SETTLER_STRENGTH = 100;
export const OUTPOST_DONE = 100;
export const OUTPOST_PROGRESS = 14;
export const OUTPOST_TERRAIN_FACTOR = { mountains: 0.4, desert: 0.4, arctic: 0.4, hills: 0.7, forest: 0.7 };
export const OUTPOST_SLOTS_BY_AGE = { bronze: 2, classical: 3, kingdoms: 3, gunpowder: 4, modern: 4 };
export const MAX_SETTLE_KM = 1734; // km (17 rings at frequency 75)
export const MAX_SETTLE_RINGS = ringsForKm(MAX_SETTLE_KM);   // how far a settler is sent at most
export const AI_SETTLE_KM = 1122; // km (11 rings at frequency 75)
export const AI_SETTLE_RINGS = ringsForKm(AI_SETTLE_KM);    // how far the AI looks for a site
export const SITE_SCORE_MIN = 4;      // a site's quality (its yields, before distance) below this is not worth a city
export const SETTLER_RETRY_TURNS = 5;   // an AI settler without a target looks again this often
export const SETTLER_GIVE_UP_TURNS = 15; // and is disbanded after this long without one
export { SETTLER_MIN_SIZE };

export const isSettler = (unit) => unit?.classId === 'settler';

/** The unit record for a settler just built in `city`. */
export const makeSettler = (id, city, nationId) => ({
  id, ownerId: nationId, regionId: city.id, homeRegionId: city.id, domain: 'land', classId: 'settler',
  strength: SETTLER_STRENGTH, maxStrength: SETTLER_STRENGTH, morale: 100, movesLeft: SETTLER_MOVES, xp: 0, rank: 'recruit',
  promotions: [], commanderId: null, embarkedOn: null, tile: city.tile, target: null
});

export const outpostsOf = (regions, nationId) => Object.values(regions).filter((c) => c.owner === nationId && c.outpost);
export const outpostSlots = (ageId) => OUTPOST_SLOTS_BY_AGE[ageId] || 1;
export const settlersOf = (units, nationId) => Object.values(units).filter((u) => isSettler(u) && u.ownerId === nationId);

// Land a settler of `nationId` may walk across: free, its own, an ally's, or an enemy's.
// `memo` (a Map per search, keyed by the city that owns the tile) spares the war scan per tile.
const passable = (state, tiles, tile, nationId, memo = null) => {
  if (!tiles.land[tile] || tiles.terrainOf(tile) === 'snow' || tiles.featureOf(tile) === 'ice') return false;
  const cityHere = state.world?.tileOwner?.[tile];
  if (!cityHere) return true;
  if (memo && memo.has(cityHere)) return memo.get(cityHere);
  const owner = state.regions[cityHere]?.owner;
  let ok;
  if (!owner || owner === nationId) ok = true;
  else {
    const n = state.nations[owner];
    ok = n?.vassalOf === nationId || state.nations[nationId]?.vassalOf === owner || !!n?.openBordersWith?.[nationId] // open borders (accords.js)
      || (state.wars || []).some((w) => w.active && isWarBetween(w, nationId, owner));
  }
  if (memo) memo.set(cityHere, ok);
  return ok;
};

/** Shortest land path from `from` to `to` for a settler (tile ids, excluding `from`), or null.
 * Breadth first over passable tiles within `maxSteps`. */
export const settlerPath = (state, from, to, nationId, maxSteps = MAX_SETTLE_RINGS * 2) => {
  const memo = new Map(); // passability per owning city, once per search
  if (from === to) return [];
  const tiles = getTiles();
  const prev = new Map([[from, null]]);
  let frontier = [from];
  for (let d = 0; d < maxSteps && frontier.length; d++) {
    const next = [];
    for (const t of frontier) {
      for (const n of tiles.neighbors[t]) {
        if (prev.has(n)) continue;
        if (n !== to && !passable(state, tiles, n, nationId, memo)) continue;
        if (n === to && !tiles.land[n]) continue;
        prev.set(n, t);
        if (n === to) {
          const path = [];
          for (let c = to; c !== from; c = prev.get(c)) path.push(c);
          return path.reverse();
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
};

/** Can this nation found a city on `tile` right now (land, spacing, ownership, a free slot)? */
export const canSettle = (state, tile, nationId, ageId) => {
  const tiles = getTiles();
  const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
  const ok = canFoundCity(world, tiles, tile, nationId);
  if (!ok.ok) return ok;
  if (outpostsOf(state.regions, nationId).length >= outpostSlots(ageId)) return { ok: false, reason: `Every outpost slot is in use (${outpostSlots(ageId)} this age).` };
  if (settlingBarred(state, nationId, tile)) return { ok: false, reason: 'You promised not to settle this close to their cities.' };
  return { ok: true };
};

/** How good a city site is: the centre and its ring's food, production and gold, a resource, a
 * river, the coast (the site's QUALITY), minus 0.6 per ring of distance at frequency 75 (per 102 km) (`distance` when the caller
 * already walked it). Pure of state except ownership. */
export const scoreSite = (state, tile, fromTile = null, distance = null) => siteQuality(state, tile) - siteDistancePenalty(state, tile, fromTile, distance);
// 0.6 per 102 km of walk (a ring at frequency 75), so the AI weighs distance in km on any grid.
const SITE_PENALTY_PER_F75_RING = 0.6;
const sitePenaltyPerRing = () => SITE_PENALTY_PER_F75_RING * (kmPerRing() / F75_RING_KM);
export const siteDistancePenalty = (state, tile, fromTile = null, distance = null) => {
  if (distance != null) return distance * sitePenaltyPerRing();
  return fromTile != null ? ringDistance(getTiles(), fromTile, tile, MAX_SETTLE_RINGS) * sitePenaltyPerRing() : 0;
};
/** The site's worth on its own, without the walk: the AI settles a site of quality SITE_SCORE_MIN
 * or more however far it is (within reach), and ranks the candidates by score. */
// Memoised per world object (one a turn): the settlers, the AI's build choice and the player's
// site list scan the same land, and a tile's own yields depend on its tile state alone.
const siteQualityCache = new WeakMap(); // world -> Map tile -> quality
const ownYieldCache = new WeakMap(); // tileState -> Map tile -> food x1.2 + production + gold
export const siteQuality = (state, tile) => {
  const tiles = getTiles();
  const world = state.world || {};
  let byTile = siteQualityCache.get(world);
  if (!byTile) { byTile = new Map(); siteQualityCache.set(world, byTile); }
  const hit = byTile.get(tile);
  if (hit !== undefined) return hit;
  const tileState = world.tileState || {};
  const tileOwner = world.tileOwner || {};
  const facts = tileFacts(tiles, tile, tileState[tile]);
  if (!facts.land) { byTile.set(tile, -Infinity); return -Infinity; }
  let ownMemo = ownYieldCache.get(tileState);
  if (!ownMemo) { ownMemo = new Map(); ownYieldCache.set(tileState, ownMemo); }
  const own = (t) => { let v = ownMemo.get(t); if (v === undefined) { const y = tileYields(tileFacts(tiles, t, tileState[t])); v = y.food * 1.2 + y.production + y.gold; ownMemo.set(t, v); } return v; };
  let score = 0;
  score += own(tile);
  tiles.neighbors[tile].forEach((n) => { if (!tileOwner[n]) score += own(n) * 0.5; });
  if (facts.resource) score += 3;
  if (facts.river) score += 2;
  if (facts.coastal) score += 1.5;
  const q = Math.round(score * 10) / 10;
  byTile.set(tile, q);
  return q;
};

/** The best legal sites for a settler standing on `fromTile`, best first: [{ tile, score, quality, steps }]. */
export const bestSites = (state, nationId, fromTile, ageId, { rings = AI_SETTLE_RINGS, limit = 5 } = {}) => {
  const tiles = getTiles();
  const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
  const seen = new Set([fromTile]);
  let frontier = [fromTile];
  const out = [];
  const memo = new Map();
  const perRing = sitePenaltyPerRing();
  for (let d = 0; d <= rings; d++) {
    for (const t of frontier) {
      // Only land the nation has explored (fog.js): nobody settles a coast it has never seen.
      if (tiles.land[t] && !world.tileOwner[t] && isExplored(state, t, nationId) && canFoundCity(world, tiles, t, nationId).ok && !settlingBarred(state, nationId, t)) {
        const quality = siteQuality(state, t);
        if (quality >= SITE_SCORE_MIN) out.push({ tile: t, score: Math.round((quality - d * perRing) * 10) / 10, quality, steps: d });
      }
    }
    const next = [];
    for (const t of frontier) for (const n of tiles.neighbors[t]) { if (!seen.has(n) && passable(state, tiles, n, nationId, memo)) { seen.add(n); next.push(n); } }
    frontier = next.sort((a, b) => a - b);
  }
  return out.sort((a, b) => b.score - a.score || a.steps - b.steps || a.tile - b.tile).slice(0, limit);
};

const terrainFactor = (tiles, tile) => OUTPOST_TERRAIN_FACTOR[legacyTerrainOf(tiles, tile)] ?? 1;

/** Founds an outpost for the settler's nation on the settler's tile. Returns the new regions,
 * world and city, or null when the site is not legal. The settler is gone. */
export const foundOutpost = (state, regions, world, settler, turn, inPlace = false) => {
  const tiles = getTiles();
  const nationId = settler.ownerId;
  const ok = canFoundCity({ cities: regions, tileOwner: world.tileOwner, tileState: world.tileState }, tiles, settler.tile, nationId);
  if (!ok.ok) return null;
  const name = pickCityName(regions, tiles, settler.tile, nationId); // a real name nearby or one of the founder's culture (cityNames.js)
  const r = foundCity({ cities: regions, tileOwner: world.tileOwner, tileState: world.tileState }, tiles, { nationId, tile: settler.tile, name, size: 1, turn, isCapital: false, inPlace });
  const city = { ...r.city, founderId: nationId, owner: nationId, control: 100, currentPopulation: 1000, currentInfrastructure: 0, underInvasion: false, unrest: 0, defenseLevel: 0, climateResilience: 0, dev: { tax: 1, production: 1, manpower: 1 }, outpost: { progress: 0, startTurn: turn } };
  if (inPlace) { regions[city.id] = city; return { regions, world, city }; } // the pass's own copies, written in place
  const nextRegions = { ...r.world.cities, [city.id]: city };
  // Cities the founding took tiles from are already updated in r.world.cities; keep their records.
  Object.keys(nextRegions).forEach((id) => { if (id !== city.id && regions[id]) nextRegions[id] = { ...regions[id], tiles: r.world.cities[id].tiles, worked: r.world.cities[id].worked, locked: r.world.cities[id].locked }; });
  return { regions: nextRegions, world: { ...world, tileOwner: r.world.tileOwner, tileState: r.world.tileState }, city };
};

/**
 * The settlers phase of a turn: every settler with a target walks towards it; one that arrives
 * on a legal site founds an outpost (when a slot is free); every outpost grows. Works on the
 * turn's working copies and returns { regions, units, world, logs } (logs carry nationId).
 */
export const processSettlers = (state, regions, units, world, ageById, turn) => {
  const tiles = getTiles();
  let nextRegions = regions; let nextWorld = world; const nextUnits = { ...units }; const logs = [];
  let v = null; // the state as the settlers see it, rebuilt only when the cities or the map changed
  const view = () => (v && v.regions === nextRegions && v.world === nextWorld ? v : (v = { ...state, regions: nextRegions, world: nextWorld, units: nextUnits }));
  Object.values(units).forEach((u) => {
    if (!isSettler(u) || u.tile == null) return;
    let settler = { ...u, movesLeft: SETTLER_MOVES };
    // An AI settler without a destination looks again now and then, further each time it must; one
    // idle too long is disbanded.
    if (settler.target == null && settler.ownerId !== state.playerNationId) {
      const idleSince = settler.idleSince ?? turn;
      if (turn - idleSince >= SETTLER_GIVE_UP_TURNS) { delete nextUnits[u.id]; logs.push({ nationId: u.ownerId, message: `The settlers of ${state.nations?.[u.ownerId]?.name || u.ownerId} found no land and went home.` }); return; }
      settler = { ...settler, idleSince };
      if ((turn - idleSince) % SETTLER_RETRY_TURNS === 0) {
        const site = bestSites(view(), settler.ownerId, settler.tile, ageById(settler.ownerId), { rings: MAX_SETTLE_RINGS, limit: 1 })[0];
        if (site) settler = { ...settler, target: site.tile, path: null, idleSince: null };
      }
    }
    if (settler.target != null && settler.target !== settler.tile) {
      // The planned road is kept on the unit and replanned only when it breaks (a border closed).
      let path = settler.path && settler.path.length && settler.path[settler.path.length - 1] === settler.target && settler.path.slice(0, SETTLER_MOVES).every((t) => t === settler.target || passable(view(), tiles, t, settler.ownerId)) ? settler.path : null;
      if (!path) path = settlerPath(view(), settler.tile, settler.target, settler.ownerId);
      if (!path) { settler = { ...settler, target: null, path: null }; logs.push({ nationId: u.ownerId, message: `Your settlers cannot reach ${tiles.names[u.target] || 'their destination'} and stop.` }); }
      else { const steps = Math.min(path.length, SETTLER_MOVES); settler = { ...settler, tile: path[steps - 1], path: path.slice(steps) }; }
    }
    if (settler.target != null && settler.target === settler.tile) {
      const ageId = ageById(settler.ownerId);
      const can = canSettle(view(), settler.tile, settler.ownerId, ageId);
      if (can.ok) {
        // The turn's regions and world are this pass's own copies: foundings write in place (one
        // copy of 9,000 tiles per founding was the cost of the pass).
        const founded = foundOutpost(view(), nextRegions, nextWorld, settler, turn, true);
        if (founded) {
          nextRegions = founded.regions; nextWorld = founded.world;
          delete nextUnits[u.id];
          logs.push({ nationId: u.ownerId, message: `${founded.city.name} is founded as an outpost.` });
          return;
        }
      } else if (/belongs|close|land|ice/.test(can.reason)) {
        settler = { ...settler, target: null };
        logs.push({ nationId: u.ownerId, message: `Your settlers find no room at their destination: ${can.reason}` });
      }
    }
    // A settler's home city for the readers that place units by city: the nearest own city.
    nextUnits[u.id] = settler;
  });
  // Outposts grow into cities (one copy of the cities map, written in place).
  const grown = Object.values(nextRegions).filter((c) => c.outpost);
  if (grown.length) nextRegions = { ...nextRegions };
  grown.forEach((c) => {
    // Per calendar year, not per turn: the speed table's multiplier for the owner's age (ages.js),
    // the same one production costs carry, so outposts keep pace with the rest of the city.
    const progress = c.outpost.progress + (OUTPOST_PROGRESS * terrainFactor(tiles, c.tile)) / speedCostMult(state.gameSpeed, ageById(c.owner));
    if (progress >= OUTPOST_DONE) {
      nextRegions[c.id] = { ...c, outpost: null, size: Math.max(1, c.size) };
      logs.push({ nationId: c.owner, message: `${c.name} has grown from an outpost into a city.` });
    } else nextRegions[c.id] = { ...c, outpost: { ...c.outpost, progress: Math.round(progress * 10) / 10 } };
  });
  return { regions: nextRegions, units: nextUnits, world: nextWorld, logs };
};

/** The id a city founded on `tile` will have (for the UI to follow it). */
export const futureCityId = cityId;
