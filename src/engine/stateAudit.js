// Read-only diagnostics for resolved campaign snapshots. No repairs and no RNG consumption.
import { PRETENDER_MARKER } from './civilWar';
import { REBEL_OWNER_ID } from '../data/rebellion';

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
  Object.entries(units).forEach(([id, u]) => {
    if (u.id !== id) report('identity', `units.${id}.id`, 'Record ID differs from its map key');
    numbers(u, `units.${id}`);
    if (!knownOwner(u.ownerId)) report('unknown_owner', `units.${id}.ownerId`, 'Unit owner is missing');
    if (!regions[u.regionId]) report('missing_region', `units.${id}.regionId`, 'Unit region is missing');
    if (u.strength < 0 || u.strength > u.maxStrength) report('range', `units.${id}.strength`, 'Strength must fit the unit capacity');
    if (u.movesLeft < 0) report('range', `units.${id}.movesLeft`, 'Movement cannot be negative');
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
