// src/data/regions.js
// Every country on Earth is a real, playable game region — one whole-country region each, built
// from real population/GDP and real geographic adjacency (see scripts/geo/build-world-regions.mjs
// and worldRegions.json). This is what makes any of the 240 nations pickable as the player's
// starting nation, and every one of them a real target for diplomacy or invasion, not just a
// colored backdrop on the globe.
import WORLD_REGIONS_DATA from './geo/worldRegions.json';

export const REGIONS_DATA = WORLD_REGIONS_DATA;

// ============ ADJACENCY ============

export const getNeighborIds = (regionId) => REGIONS_DATA[regionId]?.neighbors || [];

// True if `regionId` shares a border with any region the given owner holds.
export const isAdjacentToOwner = (regionId, regions, ownerId) => {
  return getNeighborIds(regionId).some(nId => regions[nId]?.owner === ownerId);
};

// Shortest hop count (BFS over the static adjacency graph — not current ownership, so this is a
// fixed geographic distance) from any of `anchorRegionIds` to `targetRegionId`. Used for
// overextension: supply decay scales with how far an invasion has pushed from its attacker's home
// territory, not from whatever it currently borders (every invasion is adjacent-1 from the
// current front line by construction, so distance from the FRONT would never vary — distance from
// a fixed home anchor is what actually captures overextension).
export const distanceFromAnchor = (anchorRegionIds, targetRegionId) => {
  if (anchorRegionIds.includes(targetRegionId)) return 0;
  const visited = new Set(anchorRegionIds);
  let frontier = anchorRegionIds;
  let dist = 0;
  while (frontier.length > 0) {
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
  return null; // unreachable — shouldn't happen on this map's connected graph, but defensive
};

// A nation's home anchor for overextension purposes: its region flagged isCapital. Every nation
// currently has exactly one (its own whole-country region).
export const getNationCapital = (nationId) => {
  const capital = Object.values(REGIONS_DATA).find(r => r.startOwner === nationId && r.isCapital);
  return capital ? capital.id : null;
};
