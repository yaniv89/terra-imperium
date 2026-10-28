// src/audio/mapAmbience.js
// Which ambience beds (soundRegistry.js AMBIENCE_SOUNDS) the campaign map plays, from the hex at the
// centre of the view: sea on water, desert wind on sand, insects in the jungle, birds over fields,
// wind on cold land and mountains, and on land by the sea half a share of surf. Zoomed out to the
// whole world it is only the high wind (Civ VI's map ambience follows the terrain under the camera
// the same way). Pure: GLMapView passes the tile's facts, music.js plays the mix.

/** { bedId: weight 0..1 } for a tile (pure). facts: { water, lake, terrain, feature, relief, climate, coastal }. */
export const ambienceMix = (facts, { zoomedOut = false } = {}) => {
  if (zoomedOut || !facts) return { 'map-wind': 1 };
  const { water, lake, terrain, feature, relief, climate = '', coastal } = facts;
  if (water) return lake ? { 'map-fields': 0.6, 'map-sea': 0.4 } : { 'map-sea': 1 };
  const bed = feature === 'jungle' || climate === 'Af' || climate === 'Am' ? 'map-jungle'
    : terrain === 'desert' || climate.startsWith('BW') ? 'map-desert'
      : terrain === 'tundra' || terrain === 'snow' || feature === 'ice' || climate.startsWith('E') || relief === 'mountains' ? 'map-wind'
        : 'map-fields';
  return coastal ? { [bed]: 1, 'map-sea': 0.5 } : { [bed]: 1 };
};

/** The facts ambienceMix reads, from the tile grid (tiles.js getTiles()) and a tile id. */
export const tileAmbienceFacts = (tiles, id) => {
  if (id == null || id < 0) return null;
  const water = tiles.isWater(id);
  const terrain = tiles.terrainOf(id);
  return {
    water,
    lake: terrain === 'lake',
    terrain,
    feature: tiles.featureOf(id),
    relief: tiles.reliefOf(id),
    climate: tiles.climateNames?.[tiles.climate?.[id]] || '',
    coastal: !water && tiles.neighbors[id].some((n) => tiles.isWater(n) && tiles.terrainOf(n) !== 'lake')
  };
};
