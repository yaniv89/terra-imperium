// src/components/map/gl/territoryData.js
// What the territory shader (territoryShader.js) reads per tile and per city, built from the
// world as the player knows it (fogView.js). Pure, no three.js:
//   tile texel  [city index + 1 (0: nobody), nation index + 1 (0: nobody), fog, 0]
//               fog 0 unexplored, 1 explored but out of sight, 2 in sight (2 everywhere, fog off)
//   city texels two per city: [band r, g, b, flags] and [stroke r, g, b, stroke kind]
//               flags: 1 at war with the player, 2 remembered (a ghost), 4 the player's own
//               stroke kind: 0 none (the plain border), 1 a coloured outline, 2 the selected city
//   tint texel  [r, g, b, a] bytes per tile: the lens tints (supply, estates), 0 elsewhere
// Mirrors the old SVG map's rules (Map2DView.jsx): the band is the owner's colour (the player's
// green), the outline colours come from getRegionStrokeColor (src/utils/mapRegionStyle.js).
import { DATA_W } from './tileGpuData';
import { cssColor } from './cssColor';
import { getNationColor } from '../../../data/nationColors';
import { getRegionStrokeColor } from '../../../utils/mapRegionStyle';
import { bitsHas } from '../../../engine/fog';

export const PLAYER_BAND_COLOR = '#4ade80';
export const CITY_W = 1024; // texels per row of the city texture (two per city)
export const FLAG_ENEMY = 1;
export const FLAG_GHOST = 2;
export const FLAG_OWN = 4;

const rowsFor = (texels, w) => Math.max(1, Math.ceil(texels / w));

/** A stable index per city (sorted ids) and per nation. */
export const indexCities = (regions) => {
  const ids = Object.keys(regions || {}).sort();
  const cityIndex = new Map(ids.map((id, i) => [id, i]));
  const nationIndex = new Map();
  ids.forEach((id) => { const o = regions[id].owner; if (o && !nationIndex.has(o)) nationIndex.set(o, nationIndex.size); });
  return { ids, cityIndex, nationIndex };
};

/**
 * The tile texture: Float32Array(DATA_W * rows * 4). `fog`: the fogView result (on, explored,
 * visible); `index`: indexCities(view regions).
 */
export const buildTileTexels = ({ tileCount, tileOwner, regions, fog, index }) => {
  const rows = rowsFor(tileCount, DATA_W);
  const out = new Float32Array(DATA_W * rows * 4);
  const { cityIndex, nationIndex } = index;
  if (!fog?.on) {
    for (let t = 0; t < tileCount; t++) out[t * 4 + 2] = 2;
  } else {
    const bytes = fog.explored?.bytes;
    if (bytes) {
      for (let b = 0; b < bytes.length; b++) {
        const v = bytes[b];
        if (!v) continue;
        for (let k = 0; k < 8; k++) if ((v >> k) & 1) { const t = b * 8 + k; if (t < tileCount) out[t * 4 + 2] = 1; }
      }
    }
    fog.visible?.forEach((t) => { if (t < tileCount && bitsHas(fog.explored, t)) out[t * 4 + 2] = 2; });
  }
  Object.keys(tileOwner || {}).forEach((key) => {
    const t = Number(key);
    const id = tileOwner[key];
    const ci = cityIndex.get(id);
    if (ci == null || t >= tileCount) return;
    out[t * 4] = ci + 1;
    const owner = regions[id]?.owner;
    out[t * 4 + 1] = owner && nationIndex.has(owner) ? nationIndex.get(owner) + 1 : 0;
  });
  return { data: out, rows };
};

/** The city texture: Float32Array(CITY_W * rows * 4), two texels per city. */
export const buildCityTexels = ({ regions, index, playerNationId, selectedRegion, atWarNationIds }) => {
  const rows = rowsFor(index.ids.length * 2, CITY_W);
  const out = new Float32Array(CITY_W * rows * 4);
  index.ids.forEach((id, i) => {
    const c = regions[id];
    const own = c.owner === playerNationId;
    const band = cssColor(own ? PLAYER_BAND_COLOR : getNationColor(c.owner) || '#94a3b8');
    const o = i * 8;
    out[o] = band[0]; out[o + 1] = band[1]; out[o + 2] = band[2];
    out[o + 3] = (c.owner && atWarNationIds?.has(c.owner) ? FLAG_ENEMY : 0) + (c.ghost ? FLAG_GHOST : 0) + (own ? FLAG_OWN : 0);
    const stroke = getRegionStrokeColor(regions, playerNationId, id, selectedRegion, atWarNationIds || new Set());
    const sc = cssColor(stroke);
    out[o + 4] = sc[0]; out[o + 5] = sc[1]; out[o + 6] = sc[2];
    out[o + 7] = id === selectedRegion ? 2 : stroke === '#000000' ? 0 : 1;
  });
  return { data: out, rows };
};

/** The lens tint texture: Uint8Array(DATA_W * rows * 4) from [{ tile, colour }] (later wins). */
export const buildTintTexels = (tileCount, tints) => {
  const rows = rowsFor(tileCount, DATA_W);
  const out = new Uint8Array(DATA_W * rows * 4);
  (tints || []).forEach(({ tile, colour }) => {
    if (tile == null || tile < 0 || tile >= tileCount) return;
    const c = cssColor(colour);
    out.set([c[0] * 255, c[1] * 255, c[2] * 255, c[3] * 255].map(Math.round), tile * 4);
  });
  return { data: out, rows };
};
