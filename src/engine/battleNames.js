// src/engine/battleNames.js
// What a battle is called (master plan section 4 "Names everywhere"): "Siege of <city>" for an
// assault on a city, "Battle of <nearest city or the tile's place name>" for a field battle,
// "Landing at <place>" for an assault from the sea, "Sea battle off <place>", and, for the kinds
// the independents work adds, "Raid on <city>", "Sack of <city>", "Sally from <city>". Used by the
// pre-battle screen, the battle HUD, the replay and the battle reports (the report entry keeps
// the name it was given). Pure; reads the cities and the grid only.
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';

// A field or sea battle is named after a city this close to it, else after the tile's place.
export const BATTLE_NEAR_CITY_KM = 250;

const nearestCityName = (state, tile, maxKm) => {
  const tiles = getTiles();
  const at = tiles.centres[tile];
  if (!at) return null;
  let best = null;
  Object.values(state.regions || {}).forEach((c) => {
    if (c?.tile == null || !c.name) return;
    const d = distanceKm(at, tiles.centres[c.tile]);
    if (d <= maxKm && (!best || d < best.d || (d === best.d && c.id < best.id))) best = { d, id: c.id, name: c.name };
  });
  return best?.name || null;
};

/** The place a battle on `tile` is named after: the nearest city, the tile's own name, the river,
 * or the city whose land it is. */
export const battlePlace = (state, tile, fallbackRegionId = null) => {
  const tiles = getTiles();
  if (tile != null) {
    const near = nearestCityName(state, tile, BATTLE_NEAR_CITY_KM);
    if (near) return near;
    if (tiles.names[tile]) return tiles.names[tile];
    if (tiles.rivers?.[tile] && tiles.riverNames?.[tile]) return `the ${tiles.riverNames[tile]}`;
  }
  return state.regions?.[fallbackRegionId]?.name || 'the border';
};

/** The name of a battle: `{ kind, targetRegionId, tile }` (a pending battle or a report entry). */
export const battleName = (state, { kind, targetRegionId = null, tile = null } = {}) => {
  const city = state.regions?.[targetRegionId]?.name || null;
  switch (kind) {
    case 'field': return `Battle of ${battlePlace(state, tile, targetRegionId)}`;
    case 'intercept':
    case 'naval': return `Sea battle off ${battlePlace(state, tile ?? state.regions?.[targetRegionId]?.tile, targetRegionId)}`;
    case 'amphibious':
    case 'landing': return `Landing at ${city || battlePlace(state, tile)}`;
    case 'raid': return `Raid on ${city || battlePlace(state, tile)}`;
    case 'sack': return `Sack of ${city || battlePlace(state, tile)}`;
    case 'sally': return `Sally from ${city || battlePlace(state, tile)}`;
    case 'rebellion': return `Revolt in ${city || battlePlace(state, tile)}`;
    default: return city ? `Siege of ${city}` : `Battle of ${battlePlace(state, tile)}`;
  }
};
