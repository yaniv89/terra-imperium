// src/data/geo/resourceDensity.js
// Fewer resources on the land (playtest audit I098, the user: "too many"). The scatter
// (classifyTile.js scatterResource) put a resource on 37% of the land tiles, three times
// Civilization's share, so every site had a bit of everything and none was worth a detour. This
// thinning pass runs once over the Earth grid after the scatter and the curated deposits
// (scripts/geo/build-tiles.mjs; scripts/geo/thin-resources.mjs applies it to an existing
// tiles.json) and leaves about 18% of the land with a resource. Static map data, never game state.
//
// The rule, in order, every choice by a hash of the tile id (deterministic, the same on every build):
//   1. a lottery by kind: a tile keeps its resource when hash < KEEP_SHARE[kind] (bonus food and
//      production resources are cut hardest, luxuries and strategic ones the least);
//   2. duplicates thin out: a resource never sits within SAME_RESOURCE_RINGS of a kept tile of the
//      same resource (the copper belts and wheat fields of the scatter become single deposits);
//   3. floors put back what the cuts took too far, from the tiles that had it before:
//      - the curated deposits (deposits.json): each listed country keeps two of each listed resource;
//      - each country keeps at least one luxury and one strategic resource if it had one;
//      - each start (the peoples' capitals, peopleCapitals.json, and the old countries' capitals)
//        keeps START_MIN_RESOURCES in its founding area, and a luxury and a strategic resource
//        within START_REACH_RINGS, if it had them, so the starts stay fair;
//      - every land tile that had a resource within COVER_RINGS still has one there, so no
//        stretch of farmland is left with nothing.
// Sea resources (fish, whales on coast tiles) are not touched. Generated worlds keep their own
// frozen generator (src/worldgen, hashed per version), so this pass is Earth's only.
import { hash01 } from './classifyTile.js';

/** The marker tiles.json carries once thinned (`resourceDensity`), so the pass never runs twice. */
export const RESOURCE_DENSITY_VERSION = 2;

/** Share of each kind the lottery keeps. */
export const KEEP_SHARE = Object.freeze({ bonus: 0.46, luxury: 0.7, strategic: 0.62 });

/** Two tiles of the same resource are at least this many rings apart after the thinning. */
export const SAME_RESOURCE_RINGS = 2;

/** A land tile that had a resource within this many rings keeps one there. */
export const COVER_RINGS = 2;

/** A start's founding area keeps this many resources (or all it had, if fewer). */
export const START_MIN_RESOURCES = 2;

/** And within this many rings of a start (its border reach, 204 km) a luxury and a strategic one. */
export const START_REACH_RINGS = 3;

/** Hash salts (classifyTile.js hash01): the lottery and the priority order. */
const SALT_KEEP = 97;
const SALT_ORDER = 98;

// The kind of each resource (tileYields.js RESOURCES_ON_TILES, a test checks they agree; kept here
// so the plain-Node build scripts can import this file).
export const RESOURCE_KINDS = Object.freeze({
  wheat: 'bonus', rice: 'bonus', cattle: 'bonus', sheep: 'bonus', deer: 'bonus', fish: 'bonus', bananas: 'bonus',
  dates: 'bonus', stone: 'bonus', timber: 'bonus', reeds: 'bonus',
  horses: 'strategic', copper: 'strategic', iron: 'strategic', coal: 'strategic', oil: 'strategic', uranium: 'strategic', rubber: 'strategic',
  whales: 'luxury', gold: 'luxury', silver: 'luxury', gems: 'luxury', salt: 'luxury', furs: 'luxury', honey: 'luxury', spices: 'luxury',
  dyes: 'luxury', sugar: 'luxury', cotton: 'luxury', silk: 'luxury', tea: 'luxury', wine: 'luxury', olives: 'luxury', incense: 'luxury', papyrus: 'luxury'
});

/** The tiles within `rings` of `centre` (the centre included), by breadth-first search. */
const disk = (neighbors, centre, rings) => {
  const seen = new Set([centre]);
  let front = [centre];
  for (let r = 0; r < rings; r++) {
    const next = [];
    front.forEach((t) => {
      for (let k = 0; k < 6; k++) { const j = neighbors[t * 6 + k]; if (j >= 0 && !seen.has(j)) { seen.add(j); next.push(j); } }
    });
    front = next;
  }
  return seen;
};

/** A start's founding area as gridScale.js foundingDisk draws it at frequency 100: the centre,
 * ring 1 and the ring-2 tiles that touch two ring-1 tiles (13 tiles). */
const foundingArea = (neighbors, centre) => {
  const nb = (t) => { const o = []; for (let k = 0; k < 6; k++) { const j = neighbors[t * 6 + k]; if (j >= 0) o.push(j); } return o; };
  const ring1 = nb(centre);
  const in1 = new Set(ring1);
  const touch = new Map();
  ring1.forEach((t) => nb(t).forEach((x) => { if (x !== centre && !in1.has(x)) touch.set(x, (touch.get(x) || 0) + 1); }));
  return [centre, ...ring1, ...[...touch].filter(([, k]) => k >= 2).map(([t]) => t)];
};

/**
 * The thinned resource column of a tiles.json-shaped grid `raw` (count, land, resource,
 * resourceNames, neighbors as 6 per cell with -1 pads, country, countryIds). `deposits` is
 * deposits.json ({ countryId: [resource, ...] }); `starts` the start tiles (startTilesOf).
 * Returns a new plain array; `raw` is untouched.
 */
export const thinResources = (raw, deposits = {}, starts = []) => {
  const n = raw.count;
  const names = raw.resourceNames;
  const before = Array.from(raw.resource);
  const after = before.slice();
  const kindOf = (idx) => RESOURCE_KINDS[names[idx]] || 'bonus';
  const isLandRes = (i) => raw.land[i] === 1 && before[i] >= 0;
  const order = (a, b) => hash01(a, SALT_ORDER) - hash01(b, SALT_ORDER) || a - b;

  // 1. The lottery by kind.
  const candidates = [];
  for (let i = 0; i < n; i++) {
    if (!isLandRes(i)) continue;
    if (hash01(i, SALT_KEEP) < KEEP_SHARE[kindOf(before[i])]) candidates.push(i);
    else after[i] = -1;
  }
  // 2. Duplicates: in priority order, a tile loses its resource when a kept tile of the same
  // resource lies within SAME_RESOURCE_RINGS.
  candidates.sort(order);
  const keptAt = new Map(); // resource index -> Set of kept tiles
  candidates.forEach((i) => {
    const r = before[i];
    const kept = keptAt.get(r) || new Set();
    let clash = false;
    for (const t of disk(raw.neighbors, i, SAME_RESOURCE_RINGS)) { if (t !== i && kept.has(t)) { clash = true; break; } }
    if (clash) { after[i] = -1; return; }
    kept.add(i); keptAt.set(r, kept);
  });

  // 3. Floors, from the tiles that had the resource before.
  const restore = (i) => { after[i] = before[i]; };
  const byCountry = new Map();
  for (let i = 0; i < n; i++) {
    if (!isLandRes(i) || raw.country[i] < 0) continue;
    const cid = raw.countryIds[raw.country[i]];
    if (!byCountry.has(cid)) byCountry.set(cid, []);
    byCountry.get(cid).push(i);
  }
  byCountry.forEach((list) => list.sort(order));
  // The curated deposits: two of each listed resource per listed country.
  Object.entries(deposits).forEach(([cid, wanted]) => {
    const list = byCountry.get(cid) || [];
    wanted.forEach((res) => {
      const ri = names.indexOf(res);
      const had = list.filter((i) => before[i] === ri);
      const need = Math.min(2, had.length) - had.filter((i) => after[i] === ri).length;
      had.filter((i) => after[i] !== ri).slice(0, Math.max(0, need)).forEach(restore);
    });
  });
  // A luxury and a strategic resource for every country that had them.
  byCountry.forEach((list) => {
    ['luxury', 'strategic'].forEach((kind) => {
      const had = list.filter((i) => kindOf(before[i]) === kind);
      if (had.length && !had.some((i) => after[i] >= 0)) restore(had[0]);
    });
  });
  // Starts: a capital's founding area keeps START_MIN_RESOURCES (or what it had), and its border
  // reach (START_REACH_RINGS) a luxury and a strategic resource if it had them.
  starts.forEach((c) => {
    if (c == null || c < 0 || c >= n) return;
    const area = foundingArea(raw.neighbors, c).filter(isLandRes).sort(order);
    const short = Math.min(START_MIN_RESOURCES, area.length) - area.filter((t) => after[t] >= 0).length;
    area.filter((t) => after[t] < 0).slice(0, Math.max(0, short)).forEach(restore);
    const reach = [...disk(raw.neighbors, c, START_REACH_RINGS)].filter(isLandRes).sort(order);
    ['luxury', 'strategic'].forEach((kind) => {
      const had = reach.filter((t) => kindOf(before[t]) === kind);
      if (had.length && !had.some((t) => after[t] >= 0)) restore(had[0]);
    });
  });
  // Cover: every land tile that had a resource within COVER_RINGS keeps one there.
  for (let i = 0; i < n; i++) {
    if (raw.land[i] !== 1) continue;
    const near = [...disk(raw.neighbors, i, COVER_RINGS)].filter(isLandRes);
    if (!near.length || near.some((t) => after[t] >= 0)) continue;
    restore(near.sort(order)[0]);
  }
  return after;
};

/** The start tiles the pass protects: the old countries' capitals (tiles.json `capitals`) and the
 * peoples' capitals (peopleCapitals.json `capitals`, when given), sorted and unique. */
export const startTilesOf = (raw, peopleCapitals = null) => [...new Set([
  ...Object.values(raw.capitals || {}), ...Object.values(peopleCapitals?.capitals || {})
].filter((t) => Number.isInteger(t)))].sort((a, b) => a - b);

/** Land share of each kind, for reports and tests: { all, bonus, luxury, strategic } over land tiles. */
export const resourceShares = (raw, column = raw.resource) => {
  let land = 0; const c = { all: 0, bonus: 0, luxury: 0, strategic: 0 };
  for (let i = 0; i < raw.count; i++) {
    if (raw.land[i] !== 1) continue;
    land++;
    if (column[i] < 0) continue;
    c.all++; c[RESOURCE_KINDS[raw.resourceNames[column[i]]] || 'bonus']++;
  }
  return { all: c.all / land, bonus: c.bonus / land, luxury: c.luxury / land, strategic: c.strategic / land };
};
