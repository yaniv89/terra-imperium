// Read-only diagnostics for resolved campaign snapshots. No repairs and no RNG consumption.
import { PRETENDER_MARKER } from './civilWar';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { getTiles } from '../data/geo/tiles';
import { spacingBreaches } from '../data/geo/citySpacing';

export const auditGameState = (state) => {
  const issues = [];
  const report = (code, path, message) => issues.push({ code, path, message });
  const nations = state.nations || {};
  const regions = state.regions || {};
  const units = state.units || {};
  const knownOwner = id => id === REBEL_OWNER_ID || !!nations[id];
  const numbers = (record, path) => Object.entries(record || {}).forEach(([key, value]) => {
    if (typeof value === 'number' && !Number.isFinite(value)) report('non_finite', `${path}.${key}`, 'Expected a finite number');
  });
  numbers(state.resources, 'resources');
  if (!nations[state.playerNationId]) report('missing_player', 'playerNationId', 'Player nation is missing');
  const fighting = new Set();
  const warIds = new Set();
  (state.wars || []).forEach((w, i) => {
    if (warIds.has(w.id)) report('duplicate_war', `wars.${i}.id`, 'War IDs must be unique');
    warIds.add(w.id);
    numbers(w, `wars.${i}`);
    if (!w.active) return;
    [w.aggressor, w.enemy].forEach(id => {
      fighting.add(id);
      if (!nations[id] || nations[id].isEliminated) report('invalid_belligerent', `wars.${i}`, `Inactive or missing nation: ${id}`);
    });
    if (w.aggressor === w.enemy) report('self_war', `wars.${i}`, 'A nation cannot fight itself');
  });
  Object.entries(nations).forEach(([id, n]) => {
    if (n.id !== id) report('identity', `nations.${id}.id`, 'Record ID differs from its map key');
    numbers(n, `nations.${id}`);
    numbers(n.economy, `nations.${id}.economy`);
    if (!!n.isAtWar !== fighting.has(id)) report('war_flag', `nations.${id}.isAtWar`, 'Flag disagrees with active wars');
    (n.claims || []).forEach((cid, k) => { if (!regions[cid]) report('claim_city', `nations.${id}.claims.${k}`, 'A claim names a city that does not exist'); }); // a claim on a city taken this turn drops at the next claims step
    const chain = new Set([id]);
    let parent = n.vassalOf;
    while (parent) { if(chain.has(parent)) { report('vassal_cycle', 'nations.'+id, 'Subject graph must be acyclic'); break; } chain.add(parent); parent=nations[parent]?.vassalOf; }
    if (n.vassalOf && (!nations[n.vassalOf] || !(nations[n.vassalOf].vassals || []).includes(id))) {
      report('vassal_link', `nations.${id}.vassalOf`, 'Overlord must reference its vassal');
    }
  });
  const landOwners = new Set(Object.values(regions).map(r=>r.owner).filter(Boolean));
  for(const id of landOwners) if(nations[id] && regions[nations[id].capitalRegionId]?.owner!==id) report('invalid_capital','nations.'+id+'.capitalRegionId','Live nations with land need an owned capital');
  Object.entries(regions).forEach(([id, r]) => {
    if (r.id !== id) report('identity', `regions.${id}.id`, 'Record ID differs from its map key');
    numbers(r, `regions.${id}`);
    numbers(r.dev, `regions.${id}.dev`);
    if (r.owner != null && !knownOwner(r.owner)) report('unknown_owner', `regions.${id}.owner`, 'Region owner is missing');
    if (nations[r.owner]?.isEliminated) report('eliminated_owner', `regions.${id}.owner`, 'Eliminated nation still owns land');
    if (r.occupiedBy && !(r.occupiedBy===PRETENDER_MARKER && nations[r.owner]?.civilWar?.active) && (!knownOwner(r.occupiedBy) || r.occupiedBy === r.owner)) report('invalid_occupation', `regions.${id}.occupiedBy`, 'Occupier must be a different known owner');
    ['control', 'unrest', 'devastation'].forEach(key => {
      if (r[key] != null && (r[key] < 0 || r[key] > 100)) report('range', `regions.${id}.${key}`, 'Expected 0..100');
    });
    if (r.currentPopulation < 0) report('range', `regions.${id}.currentPopulation`, 'Population cannot be negative');
  });
  // Tile world (plans/civ-map-rework.md): every city stands on a tile, owns its tiles once, and the
  // tile owner map agrees with the cities.
  const tileOwner = state.world?.tileOwner;
  if (tileOwner) {
    const seen = new Map();
    Object.entries(regions).forEach(([id, c]) => {
      if (c.tile == null) { report('city_tile', `regions.${id}.tile`, 'A city needs a tile'); return; }
      (c.tiles || []).forEach((t) => {
        if (seen.has(t)) report('tile_twice', `regions.${id}.tiles`, `Tile ${t} is owned by ${seen.get(t)} too`);
        seen.set(t, id);
        if (tileOwner[t] !== id) report('tile_owner', `world.tileOwner.${t}`, `Tile ${t} owner should be ${id}`);
      });
      if (!(c.tiles || []).includes(c.tile)) report('city_centre', `regions.${id}.tiles`, 'A city owns its centre');
      if (c.size != null && (c.size < 1 || c.size > 30)) report('range', `regions.${id}.size`, 'Size is 1..30');
    });
    Object.entries(tileOwner).forEach(([t, id]) => { if (!regions[id]) report('tile_owner', `world.tileOwner.${t}`, 'Tile owned by a missing city'); });
    // The settling rule (citySpacing.js, settle-rules R7): no two city centres closer than it allows.
    const byTile = new Map();
    Object.entries(regions).forEach(([id, c]) => { if (c.tile != null && !byTile.has(c.tile)) byTile.set(c.tile, id); });
    spacingBreaches(getTiles(), Object.values(regions).map((c) => c.tile).filter((t) => t != null)).forEach(([a, b]) => {
      report('city_spacing', `regions.${byTile.get(b)}.tile`, a === b ? `Two cities on tile ${a}` : `Too close to ${regions[byTile.get(a)]?.name || byTile.get(a)}`);
    });
  }
  Object.entries(units).forEach(([id, u]) => {
    if (u.id !== id) report('identity', `units.${id}.id`, 'Record ID differs from its map key');
    numbers(u, `units.${id}`);
    if (!knownOwner(u.ownerId)) report('unknown_owner', `units.${id}.ownerId`, 'Unit owner is missing');
    if (!regions[u.regionId]) report('missing_region', `units.${id}.regionId`, 'Unit region is missing');
    if (u.strength < 0 || u.strength > u.maxStrength) report('range', `units.${id}.strength`, 'Strength must fit the unit capacity');
    if (u.movesLeft < 0) report('range', `units.${id}.movesLeft`, 'Movement cannot be negative');
    // Armies on tiles (workstream 5): a land unit's tile is land, and when that land belongs to a
    // city the unit belongs to that city. A unit without a tile stands on its city's centre.
    if (u.tile != null && tileOwner) {
      if (u.domain !== 'naval' && !u.embarkedOn && getTiles().land[u.tile] !== 1) report('unit_tile', `units.${id}.tile`, 'A land unit stands on land');
      const here = tileOwner[u.tile];
      if (getTiles().land[u.tile] === 1 && here != null && here !== u.regionId && regions[here]?.owner === u.ownerId) report('unit_region', `units.${id}.regionId`, `Unit stands on its nation's land of ${here}`);
    }
    if (u.embarkedOn) {
      const ship = units[u.embarkedOn];
      if (!ship || ship.domain !== 'naval' || ship.ownerId !== u.ownerId || ship.regionId !== u.regionId) {
        report('invalid_transport', `units.${id}.embarkedOn`, 'Cargo needs a colocated friendly transport');
      }
    }
  });
  if (state.pendingPeaceOffer && !(state.wars || []).some(w => w.active && w.id === state.pendingPeaceOffer.warId)) {
    report('stale_peace', 'pendingPeaceOffer', 'Offer references an inactive war');
  }
  return issues;
};

export const assertGameState = (state) => {
  const issues = auditGameState(state);
  if (issues.length) throw new Error(`State audit failed at turn ${state.turnNumber}: ${JSON.stringify(issues.slice(0, 20))}`);
  return state;
};
