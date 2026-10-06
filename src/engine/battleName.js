// src/engine/battleName.js
// The name of a battle (plans/MASTER-PLAN.md section 4 "Battles"), used by the battle report, the
// log lines of the outcome service (battleOutcome.js), the pre-battle sheet and the result screen:
//   city assault / defence   "Siege of <city>"
//   field battle             "Battle of <the tile's place name, or the nearest city>"
//   landing                  "Landing at <city or coast place>"
//   sea battle               "Sea battle off <the nearest city or place>"
//   raid / sack (phase R3)   "Raid on <city>", "Sack of <city>"
// Pure. TODO(W0): phase W0 brings src/engine/battleNames.js with the peoples' names; when the
// integration branch is merged, this file should delegate to it and keep only the fallback.
import { getTiles } from '../data/geo/tiles';
import { ringsAround } from './world/cities';

export const NAME_SEARCH_RINGS = 6;

const cityName = (state, id) => (id ? state.regions?.[id]?.name || id : null);

/** The place a tile is known by: its own name, the city whose land it is, else the nearest city within NAME_SEARCH_RINGS. */
export const placeNameOfTile = (state, tile) => {
  if (tile == null || tile < 0) return null;
  const tiles = getTiles();
  if (tiles.names?.[tile]) return tiles.names[tile];
  const owner = state.world?.tileOwner?.[tile];
  if (owner && state.regions?.[owner]?.name) return state.regions[owner].name;
  // The nearest city centre by rings (ties by tile id: deterministic).
  const centres = new Map();
  Object.values(state.regions || {}).forEach((c) => { if (c.tile != null && c.name) centres.set(c.tile, c.name); });
  let best = null; let bestD = Infinity;
  ringsAround(tiles, tile, NAME_SEARCH_RINGS).forEach((d, t) => {
    if (!centres.has(t)) return;
    if (d < bestD || (d === bestD && t < best)) { best = t; bestD = d; }
  });
  return best == null ? null : centres.get(best);
};

/**
 * The name of a battle. `b`: { kind, regionId, tile } where kind is invasion | defense | landing |
 * field | naval | raid | sack. Never empty.
 */
export const battleNameOf = (state, b) => {
  const kind = b?.kind || 'invasion';
  const city = cityName(state, b?.regionId);
  if (kind === 'invasion' || kind === 'defense' || kind === 'assault') return `Siege of ${city || 'the city'}`;
  if (kind === 'landing' || kind === 'amphibious') return `Landing at ${city || placeNameOfTile(state, b?.tile) || 'the coast'}`;
  if (kind === 'raid') return `Raid on ${city || 'the city'}`;
  if (kind === 'sack') return `Sack of ${city || 'the city'}`;
  const place = placeNameOfTile(state, b?.tile) || city;
  if (kind === 'naval') return place ? `Sea battle off ${place}` : 'Sea battle';
  return place ? `Battle of ${place}` : 'Battle in the field';
};
