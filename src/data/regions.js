// src/data/regions.js
// Every country on Earth is built from its real admin-1 provinces — 4,482 of them — each a real,
// separately-ownable/controllable game region, built from real population/GDP (split across a
// country's own provinces) and real geographic adjacency (see scripts/geo/build-world-regions.mjs
// and worldRegions.json). A nation is the SET of regions sharing a startOwner, not a region in its
// own right — nationId and regionId are different id spaces and must never be used
// interchangeably (see getOwnedRegionIds/getBorderingNationIds below, which bridge the two for AI
// code that needs to reason about a nation's current territory rather than one specific region).
import WORLD_REGIONS_DATA from './geo/worldRegions.json';

export const REGIONS_DATA = WORLD_REGIONS_DATA;

// ============ ADJACENCY ============

export const getNeighborIds = (regionId) => REGIONS_DATA[regionId]?.neighbors || [];

// True if `regionId` shares a border with any region the given owner holds.
export const isAdjacentToOwner = (regionId, regions, ownerId) => {
  return getNeighborIds(regionId).some(nId => regions[nId]?.owner === ownerId);
};

// getOwnedRegionIds/getBorderingNationIds get called for every nation, multiple times per turn
// (aiLogic.js's tiering, war-target and coalition checks) — with 4,482 regions, a fresh
// `Object.keys(regions).filter(...)` scan on every single call was the single biggest cost in a
// 300-turn, 240-nation simulation. `regions` is never mutated in place (every engine update
// replaces it with a new object via spread), so it's safe to build the nationId -> owned-region-ids
// index once per distinct `regions` object and reuse it — a WeakMap naturally drops the cache entry
// once that turn's `regions` object is no longer referenced anywhere.
const ownedRegionsIndexCache = new WeakMap();
const getOwnedRegionsIndex = (regions) => {
  let index = ownedRegionsIndexCache.get(regions);
  if (!index) {
    index = {};
    Object.keys(regions).forEach((id) => {
      const owner = regions[id]?.owner;
      if (!owner) return;
      (index[owner] ||= []).push(id);
    });
    ownedRegionsIndexCache.set(regions, index);
  }
  return index;
};

// Every region CURRENTLY owned by a nation — current ownership, not static startOwner geography,
// since a nation's actual territory shifts with conquest.
export const getOwnedRegionIds = (regions, nationId) => getOwnedRegionsIndex(regions)[nationId] || [];

// Which other nations currently border ANY of nationId's owned regions — the real, ownership-aware
// equivalent of "this nation's neighbors" now that a nation can hold many regions. Static
// region-to-region adjacency (getNeighborIds) never changes, but which NATION sits on the other
// side of a given border does, as territory changes hands — this recomputes that from current
// ownership rather than caching a stale nation-to-nation border list.
//
// Cached per (regions object, nationId) the same way getOwnedRegionsIndex is above: aiLogic.js
// calls this for potentially every one of 240 nations, multiple times in the same turn (tiering,
// war-target and coalition checks all read it independently), and a fresh O(owned regions x
// neighbors) walk on every single one of those calls was a real, measured cost at 4,482 regions —
// this was the single biggest hot path in a profiled 300-turn simulation before this cache existed.
// The nested Map (not a second WeakMap) is because the cache key here is a nationId STRING, which
// WeakMap can't hold as a key on its own.
const borderingNationsIndexCache = new WeakMap();
export const getBorderingNationIds = (regions, nationId) => {
  let perNation = borderingNationsIndexCache.get(regions);
  if (!perNation) {
    perNation = new Map();
    borderingNationsIndexCache.set(regions, perNation);
  }
  if (perNation.has(nationId)) return perNation.get(nationId);

  const owned = new Set(getOwnedRegionIds(regions, nationId));
  const bordering = new Set();
  owned.forEach((regionId) => {
    getNeighborIds(regionId).forEach((neighborId) => {
      if (owned.has(neighborId)) return;
      const neighborOwner = regions[neighborId]?.owner;
      if (neighborOwner && neighborOwner !== nationId) bordering.add(neighborOwner);
    });
  });
  const result = Array.from(bordering);
  perNation.set(nationId, result);
  return result;
};

// Shortest hop count (BFS over the static adjacency graph — not current ownership, so this is a
// fixed geographic distance) from any of `anchorRegionIds` to `targetRegionId`. Used for
// overextension: supply decay scales with how far an invasion has pushed from its attacker's home
// territory, not from whatever it currently borders (every invasion is adjacent-1 from the
// current front line by construction, so distance from the FRONT would never vary — distance from
// a fixed home anchor is what actually captures overextension).
// `maxDistance`, when given, stops the search the moment it's exceeded and returns null instead of
// the exact distance — callers that only ask "is this within range N" (resolveTurn.js's supply
// attrition) don't need the true distance for an out-of-range unit, and with 4,482 regions letting
// the search run to completion for every out-of-supply unit, every turn, was a real cost. Callers
// that need the exact distance regardless of size (missiles.js's range check) simply omit it.
export const distanceFromAnchor = (anchorRegionIds, targetRegionId, maxDistance = Infinity) => {
  if (anchorRegionIds.includes(targetRegionId)) return 0;
  const visited = new Set(anchorRegionIds);
  let frontier = anchorRegionIds;
  let dist = 0;
  while (frontier.length > 0 && dist < maxDistance) {
    dist += 1;
    const next = [];
    for (const rid of frontier) {
      for (const nId of getNeighborIds(rid)) {
        if (nId === targetRegionId) return dist;
        if (!visited.has(nId)) {
          visited.add(nId);
          next.push(nId);
        }
      }
    }
    frontier = next;
  }
  return null; // unreachable within maxDistance (or genuinely unreachable at all, off this map's connected graph)
};

// The set of every region within `maxDistance` hops of any of `anchorRegionIds` — one bounded
// multi-source BFS covering the whole in-range set at once, rather than a separate
// distanceFromAnchor call per distinct target region. resolveTurn.js's supply attrition check
// needs exactly this ("is this unit's region in range of any of my regions") for potentially many
// units spread across many distinct regions each turn; computing it once per nation instead of
// once per distinct occupied region is what keeps that check affordable at 4,482 regions.
export const regionsWithinRange = (anchorRegionIds, maxDistance) => {
  const visited = new Set(anchorRegionIds);
  let frontier = anchorRegionIds;
  let dist = 0;
  while (frontier.length > 0 && dist < maxDistance) {
    dist += 1;
    const next = [];
    for (const rid of frontier) {
      for (const nId of getNeighborIds(rid)) {
        if (!visited.has(nId)) {
          visited.add(nId);
          next.push(nId);
        }
      }
    }
    frontier = next;
  }
  return visited;
};

// A nation's home anchor for overextension purposes: the one region among its (now many) provinces
// flagged isCapital by build-world-regions.mjs. REGIONS_DATA is static for the whole app lifetime
// (never rebuilt at runtime, unlike `regions` game state), so this index is built once, lazily, on
// first use rather than scanning all 4,482 regions on every single call — this is now called for
// potentially every one of 240 nations every turn (victoryConditions.js's Conqueror Victory check),
// and an O(regions) scan per call per nation was a real, measured cost at that scale.
let capitalByNationIndex = null;
export const getNationCapital = (nationId) => {
  if (!capitalByNationIndex) {
    capitalByNationIndex = {};
    Object.values(REGIONS_DATA).forEach((r) => {
      if (r.isCapital) capitalByNationIndex[r.startOwner] = r.id;
    });
  }
  return capitalByNationIndex[nationId] || null;
};

// Plan §M15: capitals become dynamic — Move Capital (gameReducer.js's MOVE_CAPITAL) can relocate
// one, and a peace deal that cedes it auto-relocates the loser's (peace.js). `nation.capitalRegionId`
// is seeded from getNationCapital at createInitialState and is the live source of truth from then on;
// getNationCapital itself is untouched (still "this nation's ORIGINAL native capital", read by
// buildings.js's capital building-slot bonus and greatProjects.js's site rules, which the plan does
// NOT say should follow a moved capital) and stays the fallback for a nation record that predates
// this field (an old save mid-migration, or a hand-built test fixture).
export const getCapital = (state, nationId) => state.nations?.[nationId]?.capitalRegionId || getNationCapital(nationId);
