// src/utils/mapMarkers.js
// What the map draws on top of the map (plan §4a): one army banner per stack on a tile (workstream
// 5: armies stand on tiles), fleets, and last turn's battles. Pure, shared by the flat map and the
// globe. Each marker carries `tile` (where to draw it) and `regionId` (the city it belongs to).
//   Own armies: soldiers (strength x MEN_PER_STRENGTH), main unit type, average morale, whether any
//   unit can still move, and how many units ride on a fleet.
//   Foreign armies: presence only (owner and a rough size band with intel), and only where the
//   player could plausibly see them: in or next to the player's land (or next to a player army),
//   in an ally's or vassal's land, or anywhere of a nation the player has intel on. Elsewhere: fog.
import { REGIONS_DATA, getNeighborIds } from '../data/regions';
import { GREAT_PROJECTS } from '../data/greatProjects';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { MEN_PER_STRENGTH } from '../engine/aftermath';
import { hasIntel } from '../engine/intel';
import { playerWon } from '../engine/battleReports';
import { unitTile } from '../engine/armies';
import { visibleTiles } from '../engine/sight';
import { supplyOf } from '../engine/supplyMeter';

// Soldier bands a foreign army is described by when the player has intel on its owner.
export const sizeBand = (strength) => (strength >= 3000 ? 'large' : strength >= 1000 ? 'medium' : 'small');

const mainClass = (units) => {
  const by = {};
  units.forEach((u) => { by[u.classId] = (by[u.classId] || 0) + (u.strength || 0); });
  const ranked = Object.entries(by).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return 'infantry';
  // Mixed when no class is at least 60% of the army.
  const total = ranked.reduce((s, [, v]) => s + v, 0);
  return ranked[0][1] / Math.max(1, total) >= 0.6 ? ranked[0][0] : 'mixed';
};

// The set of provinces whose foreign armies the player can see.
export const getVisibleRegionIds = (state) => {
  const me = state.playerNationId;
  const visible = new Set();
  const add = (id) => { visible.add(id); getNeighborIds(id).forEach((n) => visible.add(n)); };
  Object.entries(state.regions).forEach(([id, r]) => {
    if (r.owner === me) add(id);
    else {
      const owner = state.nations[r.owner];
      if (owner && (owner.vassalOf === me || owner.hasMilitaryPact)) visible.add(id);
    }
  });
  Object.values(state.units).forEach((u) => { if (u.ownerId === me && REGIONS_DATA[u.regionId]) add(u.regionId); });
  return visible;
};

// { armies: [...], fleets: [...], battles: [...], colonies: [...] } — one entry per (province, owner, domain).
export const getMapMarkers = (state) => {
  const me = state.playerNationId;
  const sight = visibleTiles(state, me);
  const groups = new Map();
  Object.values(state.units).forEach((u) => {
    if (!u || !(u.strength > 0) || u.embarkedOn || u.classId === 'settler' || !REGIONS_DATA[u.regionId]) return;
    const domain = u.domain === 'naval' ? 'naval' : 'land';
    const tile = unitTile(state, u);
    const key = `${tile}|${u.regionId}|${u.ownerId}|${domain}`;
    if (!groups.has(key)) groups.set(key, { tile, regionId: u.regionId, ownerId: u.ownerId, domain, units: [] });
    groups.get(key).units.push(u);
  });
  const armies = []; const fleets = [];
  groups.forEach((g) => {
    const own = g.ownerId === me;
    if (!own && !sight.has(g.tile) && !hasIntel(state, g.ownerId)) return; // fog of war: seen by tile
    const strength = g.units.reduce((s, u) => s + (u.strength || 0), 0);
    const marker = {
      id: `${g.tile}|${g.regionId}|${g.ownerId}|${g.domain}`,
      tile: g.tile,
      regionId: g.regionId,
      ownerId: g.ownerId,
      own,
      rebels: g.ownerId === REBEL_OWNER_ID,
      domain: g.domain,
      ...(own ? {
        units: g.units.map((u) => u.id),
        men: Math.round(strength * MEN_PER_STRENGTH),
        mainClass: mainClass(g.units),
        morale: Math.round(g.units.reduce((s, u) => s + (u.morale ?? 100), 0) / g.units.length),
        canMove: g.units.some((u) => (u.movesLeft ?? 1) > 0),
        supply: Math.round(g.units.reduce((s, u) => s + supplyOf(u), 0) / g.units.length),
        embarked: g.domain === 'naval' ? Object.values(state.units).filter((c) => g.units.some((f) => f.id === c.embarkedOn)).length : 0
      } : {
        band: hasIntel(state, g.ownerId) ? sizeBand(strength) : null
      })
    };
    (g.domain === 'naval' ? fleets : armies).push(marker);
  });
  // Battles the player fought this turn or last.
  const battles = (state.battleReports || [])
    .filter((b) => b.turn >= (state.turnNumber || 0) - 1 && b.targetRegionId && REGIONS_DATA[b.targetRegionId])
    .map((b) => ({ id: b.id, regionId: b.targetRegionId, outcome: b.outcome, playerSide: b.playerSide, won: playerWon(b) }));
  // Colonies growing on free land (plan §4h): yours always, others where you can see.
  const colonies = Object.keys(state.regions).filter((id) => state.regions[id].colony && REGIONS_DATA[id]).map((id) => {
    const c = state.regions[id].colony;
    return { id, regionId: id, ownerId: c.ownerId, own: c.ownerId === me, progress: c.progress };
  }).filter((c) => c.own || sight.has(state.regions[c.regionId]?.tile) || hasIntel(state, c.ownerId));
  // Wonders on their tiles (plan C9): yours always, others where you can see or have intel.
  const wonders = Object.entries(state.greatProjects || {}).filter(([, p]) => p && p.tile != null && state.regions[p.regionId]).map(([projectId, p]) => {
    const ownerId = state.regions[p.regionId].owner;
    return { id: projectId, regionId: p.regionId, ownerId, own: ownerId === me, tier: p.tier || 1, tile: p.tile, name: GREAT_PROJECTS[projectId]?.name || projectId };
  }).filter((w) => w.own || sight.has(w.tile) || hasIntel(state, w.ownerId));
  return { armies, fleets, battles, colonies, wonders };
};

// "12k", "850": short soldier counts for a banner.
export const shortMen = (n) => (n >= 1e6 ? `${Math.round(n / 1e5) / 10}M` : n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));
