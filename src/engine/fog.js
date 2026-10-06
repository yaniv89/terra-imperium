// src/engine/fog.js
// Fog of war, the rules (plans/MASTER-PLAN.md 5.1, plans/rts-world-review.md 6.1).
//
// The model in plain words:
// - Every nation has an EXPLORED set of tiles: a bitset over the whole grid (one bit a tile,
//   12.5 kB). It starts as the nation's homeland (START_KNOWN_KM around each of its cities: the
//   lands its people already know) and grows every turn from what the nation sees (sight.js rules:
//   SIGHT_LAND_KM around its land, SIGHT_ARMY_KM around its armies, more on hills, fleets at sea,
//   techs that see further). Explored never shrinks.
// - Allies and vassals share their maps: at the end of each turn an overlord and its vassal, and
//   the player and every nation in a military alliance with it, add each other's explored tiles.
// - CONTACT needs sight: nation A meets nation B the first time A sees one of B's tiles or units
//   (or B sees A's: meeting is mutual). Peoples whose cities lie in each other's homeland have met
//   at the start. Diplomacy with a people you have not met is closed (gameReducer.js), the AI only
//   picks war targets it has met (aiLogic.js) and settles only explored land (settlers.js).
// - The player also keeps a LAST SEEN picture of every tile it has seen: which city held it, the
//   improvement on it and the turn it was seen; and of every city seen: owner, name, size, town
//   tier. The map draws explored but unseen land from this picture (fogView.js).
// - "Explored world" (`fog.on === false`, a new-game option) turns all of this off: every tile is
//   explored, every people met, as before fog existed.
//
// Shape (state.fog):
//   { on, explored: { [nationId]: TileBits }, met: { [nationId]: { [otherId]: turnMet } },
//     seen: { city: TileInts (index into cityIds, +1; 0 = no city), turn: TileInts (0 = never),
//             cityIds: string[], cities: { [cityId]: snapshot }, improvements: { [tile]: id } } }
// TileBits and TileInts wrap typed arrays and serialise themselves run-length encoded (toJSON),
// so every save writer (localStorage, export, cloud) stores them small; `reviveFog` turns the
// encoded form back into arrays on load (saveMigrations.js).
//
// Pure: copies on write (a nation's bitset is copied only when it gains a tile), deterministic
// (fixed iteration orders, no randomness).
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { SIGHT_LAND_KM, SIGHT_ARMY_KM, SIGHT_HILLS_BONUS_KM, SIGHT_FLEET_KM, visibleTiles } from './sight';
import { unitTile } from './armies';
import { mapEffectsFor } from './techMapEffects';
import { navalLineOf, navalSightBonus } from '../data/navalLines';
import { townTier } from '../data/townTiers';

/** How far around its cities a people knows the world at the start (km). */
export const START_KNOWN_KM = 1000;

// ---------------------------------------------------------------- packed arrays with RLE saves

/** One bit per tile. `bytes` is a Uint8Array of ceil(count / 8). */
export class TileBits {
  constructor(bytes) { this.bytes = bytes; }
  /** Run lengths alternating unset, set, unset... starting with unset (the first may be 0). */
  toJSON() {
    const b = this.bytes; const n = getTiles().count;
    const runs = []; let cur = 0; let len = 0;
    let i = 0;
    while (i < n) {
      const byte = b[i >> 3];
      // Whole bytes of the current value at a byte boundary: 8 tiles at once.
      if ((i & 7) === 0 && i + 8 <= n && byte === (cur ? 255 : 0)) { len += 8; i += 8; continue; }
      const bit = (byte >> (i & 7)) & 1;
      if (bit !== cur) { runs.push(len); cur = bit; len = 0; }
      len += 1; i += 1;
    }
    runs.push(len);
    return { rle: runs };
  }
}

/** One 32-bit integer per tile. */
export class TileInts {
  constructor(ints) { this.ints = ints; }
  /** Pairs [value, run length, value, run length, ...]. */
  toJSON() {
    const a = this.ints; const out = [];
    let i = 0;
    while (i < a.length) { const v = a[i]; let j = i + 1; while (j < a.length && a[j] === v) j++; out.push(v, j - i); i = j; }
    return { rle: out };
  }
}

const byteCount = (n) => (n + 7) >> 3;
export const emptyBits = () => new TileBits(new Uint8Array(byteCount(getTiles().count)));
export const bitsHas = (bits, t) => !!bits && ((bits.bytes[t >> 3] >> (t & 7)) & 1) === 1;
const setBit = (bytes, t) => { bytes[t >> 3] |= 1 << (t & 7); };
export const bitsCount = (bits) => { let c = 0; for (const b of bits.bytes) { let v = b; while (v) { v &= v - 1; c++; } } return c; };

const decodeBits = (v) => {
  if (v instanceof TileBits) return v;
  if (v && v.bytes instanceof Uint8Array) return new TileBits(v.bytes); // a structured clone
  const bytes = new Uint8Array(byteCount(getTiles().count));
  if (v && Array.isArray(v.rle)) {
    let t = 0; let cur = 0;
    for (const len of v.rle) { if (cur) for (let k = 0; k < len; k++) setBit(bytes, t + k); t += len; cur ^= 1; }
  }
  return new TileBits(bytes);
};
const decodeInts = (v) => {
  if (v instanceof TileInts) return v;
  if (v && v.ints instanceof Int32Array) return new TileInts(v.ints);
  const ints = new Int32Array(getTiles().count);
  if (v && Array.isArray(v.rle)) { let t = 0; for (let k = 0; k < v.rle.length; k += 2) { ints.fill(v.rle[k], t, t + v.rle[k + 1]); t += v.rle[k + 1]; } }
  return new TileInts(ints);
};

/** The fog of a loaded save (JSON or a structured clone) with its arrays back. Idempotent. */
export const reviveFog = (fog) => {
  if (!fog || fog.on === false) return fog;
  const explored = {};
  Object.keys(fog.explored || {}).forEach((id) => { explored[id] = decodeBits(fog.explored[id]); });
  const s = fog.seen || {};
  return { ...fog, explored, met: fog.met || {}, seen: { cityIds: s.cityIds || [], cities: s.cities || {}, improvements: s.improvements || {}, city: decodeInts(s.city), turn: decodeInts(s.turn) } };
};

// ---------------------------------------------------------------- queries

/** True when fog is in play for this game. */
export const fogOn = (state) => !!state?.fog && state.fog.on !== false;
/** Has `nationId` explored `tile`? Always true with fog off. */
export const isExplored = (state, tile, nationId = state.playerNationId) => !fogOn(state) || (tile != null && bitsHas(state.fog.explored[nationId], tile));
/** Has `a` met `b`? A people always knows itself; with fog off everyone has met. */
export const hasMet = (state, a, b) => a === b || !fogOn(state) || !!state.fog.met?.[a]?.[b];
/** The peoples `nationId` has met, sorted. */
export const metNations = (state, nationId = state.playerNationId) => (fogOn(state) ? Object.keys(state.fog.met?.[nationId] || {}).sort() : Object.keys(state.nations).filter((id) => id !== nationId));
/** A nation's name as `viewerId` knows it: "Unknown people" before contact. */
export const UNKNOWN_PEOPLE = 'Unknown people';
export const knownNationName = (state, nationId, viewerId = state.playerNationId) => (hasMet(state, viewerId, nationId) ? state.nations[nationId]?.name || nationId : UNKNOWN_PEOPLE);

// ---------------------------------------------------------------- sight for every nation at once

// Breadth-first growth `rings` deep from `seeds`, calling visit(t) once per tile reached. `mark`
// and `stamp` make "seen in this walk" an integer compare (no Set per walk).
const walk = (tiles, seeds, rings, mark, stamp, visit) => {
  let frontier = [];
  for (const t of seeds) if (mark[t] !== stamp) { mark[t] = stamp; visit(t); frontier.push(t); }
  for (let d = 0; d < rings; d++) {
    const next = [];
    for (const t of frontier) for (const n of tiles.neighbors[t]) if (mark[n] !== stamp) { mark[n] = stamp; visit(n); next.push(n); }
    frontier = next;
  }
};

const alive = (n) => n && !n.isEliminated;

/** The sight seeds of every nation: its land tiles and its units with their reach in rings. */
const seedsByNation = (state) => {
  const land = new Map(); const units = new Map();
  Object.values(state.regions).forEach((c) => {
    if (!c.owner || c.tile == null) return;
    (land.get(c.owner) || land.set(c.owner, []).get(c.owner)).push(c);
  });
  Object.values(state.units).forEach((u) => {
    if (!u.ownerId || u.embarkedOn) return;
    const t = unitTile(state, u);
    if (t == null) return;
    (units.get(u.ownerId) || units.set(u.ownerId, []).get(u.ownerId)).push(u);
  });
  return { land, units };
};

const unitRings = (tiles, u, t, extra) => ringsForKm(extra + (u.domain === 'naval' ? SIGHT_FLEET_KM + navalSightBonus(navalLineOf(u)) : SIGHT_ARMY_KM + (tiles.reliefOf(t) === 'hills' ? SIGHT_HILLS_BONUS_KM : 0)));

// What a city's land sees, `rings` deep, cached by the land itself (the city's tile list as a key:
// the turn rebuilds city records, the land rarely changes), so a quiet turn walks almost no land.
const LAND_SIGHT_CACHE_MAX = 20000;
const landSightCache = new Map(); // `${rings}|${tiles}` -> tile list
const citySight = (tiles, c, rings, mark, stamp) => {
  const seeds = c.tiles || [c.tile];
  const key = `${rings}|${seeds.join(',')}`;
  const hit = landSightCache.get(key);
  if (hit) return hit;
  const list = [];
  walk(tiles, seeds, rings, mark, stamp, (t) => list.push(t));
  if (landSightCache.size >= LAND_SIGHT_CACHE_MAX) landSightCache.clear();
  landSightCache.set(key, list);
  return list;
};

/**
 * What every living nation sees on its own this turn (its land and units; allies' sight is
 * shared through the explored maps instead): Map nationId -> tile id list. Deterministic order.
 */
export const ownSightAll = (state) => {
  const tiles = getTiles();
  const { land, units } = seedsByNation(state);
  const mark = new Int32Array(tiles.count); const seen = new Int32Array(tiles.count);
  let stamp = 0; let nationStamp = 0;
  const out = new Map();
  Object.keys(state.nations).forEach((id) => {
    if (!alive(state.nations[id])) return;
    const seeds = land.get(id); const own = units.get(id);
    if (!seeds && !own) return;
    nationStamp += 1;
    const list = [];
    const visit = (t) => { if (seen[t] !== nationStamp) { seen[t] = nationStamp; list.push(t); } };
    const extra = mapEffectsFor(state, id).sight || 0;
    if (seeds) { const rings = ringsForKm(SIGHT_LAND_KM + extra); for (const c of seeds) for (const t of citySight(tiles, c, rings, mark, ++stamp)) visit(t); }
    if (own) own.forEach((u) => { const t = unitTile(state, u); for (const x of citySight(tiles, { tile: t }, unitRings(tiles, u, t, extra), mark, ++stamp)) visit(x); });
    out.set(id, list);
  });
  return out;
};

// ---------------------------------------------------------------- the per-turn update

// Copy-on-write helpers over the working copies of one update.
const makeWriter = (fog) => {
  let explored = fog.explored; let met = fog.met || {};
  const copiedBits = new Set(); const copiedMet = new Set();
  const bitsOf = (id) => {
    if (!copiedBits.has(id)) {
      if (explored === fog.explored) explored = { ...explored };
      const old = explored[id];
      explored[id] = new TileBits(old ? old.bytes.slice() : new Uint8Array(byteCount(getTiles().count)));
      copiedBits.add(id);
    }
    return explored[id].bytes;
  };
  const meet = (a, b, turn) => {
    if (a === b || met[a]?.[b] != null) return false;
    if (met === (fog.met || {})) met = { ...met };
    [[a, b], [b, a]].forEach(([x, y]) => {
      if (!copiedMet.has(x)) { met[x] = { ...(met[x] || {}) }; copiedMet.add(x); }
      met[x][y] = turn;
    });
    return true;
  };
  return { bitsOf, meet, explored: () => explored, met: () => met };
};

const addTiles = (writer, fog, id, list) => {
  const cur = fog.explored[id];
  let bytes = null;
  for (const t of list) {
    if (bytes) { setBit(bytes, t); continue; }
    if (!bitsHas(cur, t)) { bytes = writer.bitsOf(id); setBit(bytes, t); }
  }
};

/** Pairs of nations that share their maps: overlord and vassal, the player and its allies. Sorted. */
export const mapSharingPairs = (state) => {
  const pairs = [];
  const p = state.playerNationId;
  Object.keys(state.nations).sort().forEach((id) => {
    const n = state.nations[id];
    if (!alive(n)) return;
    if (n.vassalOf && alive(state.nations[n.vassalOf])) pairs.push([n.vassalOf, id]);
    if (id !== p && n.hasMilitaryPact && alive(state.nations[p])) pairs.push([p, id]);
  });
  return pairs;
};

const unionInto = (writer, explored, into, from) => {
  const a = explored()[into]; const b = explored()[from];
  if (!b) return;
  const ab = a?.bytes; const bb = b.bytes;
  let bytes = null;
  for (let i = 0; i < bb.length; i++) {
    const v = bb[i];
    if (!v) continue;
    if (bytes) { bytes[i] |= v; continue; }
    if (!ab || (ab[i] | v) !== ab[i]) { bytes = writer.bitsOf(into); bytes[i] |= v; }
  }
};

// Who holds each tile and whose units stand on it, for contact: typed arrays of nation indexes
// (+1, 0 = nobody) so the per-tile checks are integer reads.
const ownerAt = (state) => {
  const tiles = getTiles();
  const ids = Object.keys(state.nations);
  const index = new Map(ids.map((id, i) => [id, i + 1]));
  const land = new Int16Array(tiles.count);
  Object.values(state.regions).forEach((c) => {
    const o = index.get(c.owner);
    if (!o) return;
    for (const t of (c.tiles || [c.tile])) if (t != null) land[t] = o;
  });
  const unit = new Int16Array(tiles.count);
  const more = new Map(); // a tile with units of several owners: the extra owners
  Object.values(state.units).forEach((u) => {
    const o = index.get(u.ownerId);
    if (!o || u.embarkedOn) return;
    const t = unitTile(state, u);
    if (t == null) return;
    if (!unit[t]) unit[t] = o;
    else if (unit[t] !== o) { const s = more.get(t) || more.set(t, []).get(t); if (!s.includes(o)) s.push(o); }
  });
  return { ids, index, land, unit, more };
};

const snapshotCity = (c) => ({ id: c.id, name: c.name, owner: c.owner || null, size: c.size || 1, tile: c.tile, isCapital: !!c.isCapital, tier: c.outpost ? 'outpost' : townTier(c)?.id || 'small', buildings: c.buildings || null, outpost: c.outpost ? { progress: c.outpost.progress } : null });

/** The player's last-seen picture updated for the tiles it sees now. */
const updateSeen = (state, seen, visible) => {
  const tileOwner = state.world?.tileOwner || {};
  const tileState = state.world?.tileState || {};
  const turn = state.turnNumber || 0;
  const city = new Int32Array(seen.city.ints); const turns = new Int32Array(seen.turn.ints);
  let cityIds = seen.cityIds; const index = new Map(cityIds.map((id, i) => [id, i]));
  const intern = (id) => { let i = index.get(id); if (i === undefined) { if (cityIds === seen.cityIds) cityIds = [...cityIds]; i = cityIds.length; cityIds.push(id); index.set(id, i); } return i + 1; };
  let improvements = seen.improvements; let cities = seen.cities;
  const visibleCities = new Set();
  visible.forEach((t) => {
    const owner = tileOwner[t];
    city[t] = owner ? intern(owner) : 0;
    turns[t] = turn;
    const imp = tileState[t]?.improvement && !tileState[t]?.pillaged ? tileState[t].improvement : null;
    if ((improvements[t] || null) !== imp) {
      if (improvements === seen.improvements) improvements = { ...improvements };
      if (imp) improvements[t] = imp; else delete improvements[t];
    }
  });
  Object.values(state.regions).forEach((c) => {
    if (c.tile == null || !visible.has(c.tile)) return;
    visibleCities.add(c.id);
    const snap = snapshotCity(c);
    const old = cities[c.id];
    if (old && old.owner === snap.owner && old.size === snap.size && old.tier === snap.tier && old.name === snap.name && old.isCapital === snap.isCapital && old.buildings === snap.buildings && old.outpost?.progress === snap.outpost?.progress) return;
    if (cities === seen.cities) cities = { ...cities };
    cities[c.id] = snap;
  });
  // A remembered city whose centre is in sight but which no longer stands there is gone.
  Object.keys(cities).forEach((id) => {
    const c = cities[id];
    if (visibleCities.has(id) || !visible.has(c.tile)) return;
    if (cities === seen.cities) cities = { ...cities };
    delete cities[id];
  });
  return { cityIds, cities, improvements, city: new TileInts(city), turn: new TileInts(turns) };
};

const emptySeen = () => ({ cityIds: [], cities: {}, improvements: {}, city: new TileInts(new Int32Array(getTiles().count)), turn: new TileInts(new Int32Array(getTiles().count)) });

/**
 * The end-of-turn fog pass: explored grows from sight, contacts are made, allies share maps, the
 * player's last-seen picture is refreshed. Returns the same state when fog is off.
 * `onlyPlayer` (the reducer, after the player moves an army) updates the player alone.
 */
export const updateFog = (state, { onlyPlayer = false } = {}) => {
  if (!fogOn(state)) return state;
  const fog = state.fog;
  const writer = makeWriter(fog);
  const turn = state.turnNumber || 0;
  const p = state.playerNationId;
  const who = ownerAt(state);
  const sights = onlyPlayer ? new Map() : ownSightAll(state);
  const playerVisible = state.nations[p] ? visibleTiles(state, p) : new Set();
  if (state.nations[p]) sights.set(p, [...new Set([...(sights.get(p) || []), ...playerVisible])]);
  // Fixed order: nation ids sorted, so who-met-whom-first is the same everywhere.
  [...sights.keys()].sort().forEach((id) => {
    const list = sights.get(id);
    addTiles(writer, fog, id, list);
    const self = who.index.get(id);
    const meetIdx = (o) => { if (o && o !== self) writer.meet(id, who.ids[o - 1], turn); };
    for (const t of list) {
      meetIdx(who.land[t]);
      if (who.unit[t]) { meetIdx(who.unit[t]); const extra = who.more.get(t); if (extra) extra.forEach(meetIdx); }
    }
  });
  if (!onlyPlayer) mapSharingPairs(state).forEach(([a, b]) => { unionInto(writer, writer.explored, a, b); unionInto(writer, writer.explored, b, a); });
  const seen = state.nations[p] ? updateSeen(state, fog.seen || emptySeen(), playerVisible) : fog.seen;
  const explored = writer.explored(); const met = writer.met();
  if (explored === fog.explored && met === fog.met && seen === fog.seen) return state;
  return { ...state, fog: { ...fog, explored, met, seen } };
};

/**
 * The fog of a new game: each nation knows START_KNOWN_KM around its cities, peoples whose cities
 * lie in each other's homeland have met, then one ordinary pass of sight. `on: false` is the
 * "explored world" option.
 */
export const initFog = (state, { on = true } = {}) => {
  if (!on) return { ...state, fog: { on: false } };
  const tiles = getTiles();
  const rings = ringsForKm(START_KNOWN_KM);
  const mark = new Int32Array(tiles.count);
  let stamp = 0;
  const explored = {};
  const met = {};
  const homeOf = new Map();
  Object.values(state.regions).forEach((c) => { if (c.owner && c.tile != null) (homeOf.get(c.owner) || homeOf.set(c.owner, []).get(c.owner)).push(c.tile); });
  const cityOwnerAt = new Map();
  Object.values(state.regions).forEach((c) => { if (c.owner && c.tile != null) cityOwnerAt.set(c.tile, c.owner); });
  [...homeOf.keys()].sort().forEach((id) => {
    if (!alive(state.nations[id])) return;
    const bytes = new Uint8Array(byteCount(tiles.count));
    walk(tiles, homeOf.get(id), rings, mark, ++stamp, (t) => {
      setBit(bytes, t);
      const o = cityOwnerAt.get(t);
      if (o && o !== id && state.nations[o]) { (met[id] ||= {})[o] = state.turnNumber || 1; (met[o] ||= {})[id] = state.turnNumber || 1; }
    });
    explored[id] = new TileBits(bytes);
  });
  return updateFog({ ...state, fog: { on: true, explored, met, seen: emptySeen() } });
};
