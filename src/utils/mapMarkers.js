// src/utils/mapMarkers.js
// What the map draws on top of the map (plan §4a): one army banner per stack on a tile (workstream
// 5: armies stand on tiles), fleets, and last turn's battles. Pure, shared by the flat map and the
// globe. Each marker carries `tile` (where to draw it) and `regionId` (the city it belongs to).
//   Own armies: soldiers (unitMenOf: strength x MEN_PER_STRENGTH, a scout party its few), main unit type, average morale, whether any
//   unit can still move, and how many units ride on a fleet. A land stack past two thirds of its
//   tile's cap (supplyMeter.js stackCap, the units the supply meter counts) carries capUse [n, cap]
//   (the AoE and Civ report's rank 9: the flag says 9/12 before the supply drain starts).
//   Foreign armies: presence only (owner and a rough size band with intel), and only where the
//   player could plausibly see them: in or next to the player's land (or next to a player army),
//   in an ally's or vassal's land, or anywhere of a nation the player has intel on. Elsewhere: fog.
import { REGIONS_DATA, getNeighborIds } from '../data/regions';
import { GREAT_PROJECTS } from '../data/greatProjects';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { unitMenOf } from '../engine/battleLedger';
import { hasIntel } from '../engine/intel';
import { playerWon } from '../engine/battleReports';
import { unitTile, aboardShip } from '../engine/armies';
import { visibleTiles } from '../engine/sight';
import { supplyOf, stackCap } from '../engine/supplyMeter';
import { isSettler, isExplorer } from '../engine/settlers';
import { mapEffectsFor } from '../engine/techMapEffects';
import { getTiles } from '../data/geo/tiles';
import { orderedStack, topUnit, isCivilian } from '../components/map/tileStack';

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
// `selected`: { tile, unitId }, the unit the player picked on a tile (cycling): its model is the tile's.
export const getMapMarkers = (state, { selected = null } = {}) => {
  const me = state.playerNationId;
  const sight = visibleTiles(state, me);
  const groups = new Map();
  Object.values(state.units).forEach((u) => {
    if (!u || !(u.strength > 0) || aboardShip(u) || u.classId === 'settler' || !REGIONS_DATA[u.regionId]) return;
    const domain = u.domain === 'naval' ? 'naval' : 'land';
    const tile = unitTile(state, u);
    const key = `${tile}|${u.ownerId}|${domain}`; // one stack, one flag, one model per tile (Civilization)
    if (!groups.has(key)) groups.set(key, { tile, regionId: u.regionId, ownerId: u.ownerId, domain, units: [] });
    groups.get(key).units.push(u);
  });
  const cityTiles = new Set(Object.values(state.regions).map((r) => r.tile));
  const civilians = new Map(); // tile -> settlers and workers standing there (counted in the flag, never drawn over a soldier)
  Object.values(state.units).forEach((u) => { if (u && isCivilian(u) && !u.embarkedOn && u.ownerId === me && u.tile != null) civilians.set(u.tile, (civilians.get(u.tile) || 0) + 1); });
  const armies = []; const fleets = [];
  const capExtra = mapEffectsFor(state, me).stackCap || 0;
  const capUseOf = (g) => {
    const n = g.units.filter((u) => !isSettler(u) && !isExplorer(u)).length;
    const cap = g.tile == null ? 0 : stackCap(getTiles(), g.tile, capExtra);
    return cap > 0 && n * 3 > cap * 2 ? [n, cap] : null;
  };
  groups.forEach((g) => {
    const own = g.ownerId === me;
    if (!own && !sight.has(g.tile) && !hasIntel(state, g.ownerId)) return; // fog of war: seen by tile
    const strength = g.units.reduce((s, u) => s + (u.strength || 0), 0);
    const marker = {
      id: `${g.tile}|${g.regionId}|${g.ownerId}|${g.domain}`,
      tile: g.tile,
      // one unit of the stack: the map glides the banner from where it stood (marchGlide.js, I070)
      lead: g.units[0].id,
      inCity: cityTiles.has(g.tile),
      regionId: g.regionId,
      ownerId: g.ownerId,
      own,
      rebels: g.ownerId === REBEL_OWNER_ID,
      domain: g.domain,
      boat: g.domain === 'land' && getTiles().land[g.tile] !== 1, // self-embarked (armies.js): drawn as a boat
      ...(own ? {
        units: g.units.map((u) => u.id),
        // the drawing order and the one unit whose model stands on the tile (tileStack.js)
        stack: orderedStack(g.units).map((u) => u.id),
        top: topUnit(orderedStack(g.units), selected?.tile === g.tile ? selected.unitId : null)?.id,
        topClass: topUnit(orderedStack(g.units), selected?.tile === g.tile ? selected.unitId : null)?.classId,
        topAge: topUnit(orderedStack(g.units), selected?.tile === g.tile ? selected.unitId : null)?.ageId || null, // its own age's model (unitUpgrades.js)
        scout: !!topUnit(orderedStack(g.units), selected?.tile === g.tile ? selected.unitId : null)?.explorer, // a scout party's smaller figure (scale.js)
        civilians: g.domain === 'land' ? civilians.get(g.tile) || 0 : 0,
        count: g.units.length + (g.domain === 'land' ? civilians.get(g.tile) || 0 : 0),
        men: g.units.reduce((s, u) => s + unitMenOf(u), 0), // a scout party counts its few men (battleLedger.js)
        mainClass: mainClass(g.units),
        navalLine: g.domain === 'naval' ? (g.units[0].navalLine || 'warship') : null,
        morale: Math.round(g.units.reduce((s, u) => s + (u.morale ?? 100), 0) / g.units.length),
        canMove: g.units.some((u) => (u.movesLeft ?? 1) > 0),
        capUse: g.domain === 'land' ? capUseOf(g) : null,
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
  // The open event's city (plan C9): one amber mark while the event sheet is up.
  const ev = state.activeProceduralEvent;
  const evCity = ev?.cityId ? state.regions[ev.cityId] : null;
  const events = evCity && REGIONS_DATA[evCity.id] ? [{ id: `event:${ev.id || evCity.id}`, regionId: evCity.id, ownerId: evCity.owner, own: true, tile: evCity.tile, title: ev.title || 'An event' }] : [];
  return { armies, fleets, battles, colonies, wonders, events };
};

// "12k", "850": short soldier counts for a banner.
export const shortMen = (n) => (n >= 1e6 ? `${Math.round(n / 1e5) / 10}M` : n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));
