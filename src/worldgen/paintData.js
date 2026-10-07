// src/worldgen/paintData.js
// The per-tile inputs of the GPU painter (src/components/map/gl/proceduralPaint.js, phase MV4,
// plans/MAP-VARIATIONS-PLAN.md 5.1): two RGBA float texels per tile, in the per-tile texture
// layout of tileGpuData.js (DATA_W texels a row):
//   texel 2i      climate colour r, g, b (0 to 1, the rasterLook.js palette) and the mean elevation
//                 in metres (held at 2 m and up on land, -80 m and down at sea, like the Earth build);
//   texel 2i + 1  flags + 8 x the land cover base class (flags: 1 land, 2 lake, 4 ice), the
//                 roughness (metres), the river edge bits (bit k: the edge to neighbour k) and the
//                 river sizes (2 bits an edge, the riverSize column).
// Sea tiles take the colour of a land neighbour, so the coast blends into land colour, not grey.
// Pure (no three.js); visual only, nothing the rules read comes from here.
import { CLIMATE_COLOR, DEFAULT_LAND } from '../data/geo/rasterLook';
import { LAND_COVER } from '../data/geo/rasterDetail';
import { DATA_W } from '../components/map/gl/tileGpuData';

const C = Object.fromEntries(LAND_COVER.map((n, i) => [n, i]));
export const FLAG_LAND = 1;
export const FLAG_LAKE = 2;
export const FLAG_ICE = 4;

/**
 * The land cover class of a tile before the elevation rules (snow line, tree line): the part of
 * classifyCover in scripts/geo/build-raster-detail.mjs that reads the hex feature and the Köppen
 * class. The shader adds ice above the snow line and rock above the tree line per pixel.
 */
export const coverBaseOf = ({ feature, koppen }) => {
  if (koppen === 'EF') return C.ice;
  if (feature === 'marsh') return C.wetland;
  if (feature === 'oasis' || feature === 'floodplain') return C.irrigated;
  if (feature === 'jungle') return C.rainforest;
  if (feature === 'forest') return C.forest;
  if (!koppen) return C.grassland;
  if (koppen === 'ET') return C.tundra;
  if (koppen.startsWith('BW')) return C.desert;
  if (koppen.startsWith('BS') || koppen === 'Csa' || koppen === 'Csb') return C.steppe;
  if (koppen === 'Af' || koppen === 'Am') return C.rainforest;
  if (/^D.[cd]$/.test(koppen)) return C.forest;
  return C.grassland;
};

const cache = new WeakMap();

/** { data: Float32Array, rows } for a decorated grid (see the header). Built once per grid. */
export const paintTileData = (tiles) => {
  const hit = cache.get(tiles);
  if (hit) return hit;
  const n = tiles.count;
  const rows = Math.ceil((n * 2) / DATA_W);
  const data = new Float32Array(DATA_W * rows * 4);
  const T = tiles.terrainNames; const F = tiles.featureNames;
  const lakeCode = T.indexOf('lake'); const snowCode = T.indexOf('snow'); const iceCode = F.indexOf('ice');
  const landOf = (i) => tiles.land[i] === 1 && tiles.terrain[i] !== lakeCode;
  const colourOf = (i) => {
    const k = tiles.climate && tiles.climate[i] >= 0 ? tiles.climateNames[tiles.climate[i]] : null;
    return (k && CLIMATE_COLOR[k]) || DEFAULT_LAND;
  };
  for (let i = 0; i < n; i++) {
    const land = landOf(i);
    let col = colourOf(i);
    if (!land) { const j = tiles.neighbors[i].find(landOf); if (j != null) col = colourOf(j); }
    const lake = tiles.terrain[i] === lakeCode;
    const ice = tiles.feature[i] === iceCode || tiles.terrain[i] === snowCode;
    const e = tiles.elevation[i];
    const o = i * 8;
    data[o] = col[0] / 255; data[o + 1] = col[1] / 255; data[o + 2] = col[2] / 255;
    data[o + 3] = land ? Math.max(e, 2) : Math.min(e, -80);
    const koppen = tiles.climate && tiles.climate[i] >= 0 ? tiles.climateNames[tiles.climate[i]] : null;
    const cover = land ? coverBaseOf({ feature: F[tiles.feature[i]], koppen }) : C.water;
    data[o + 4] = (land ? FLAG_LAND : 0) + (lake ? FLAG_LAKE : 0) + (ice ? FLAG_ICE : 0) + 8 * cover;
    data[o + 5] = tiles.roughness ? tiles.roughness[i] : 50;
    data[o + 6] = tiles.rivers ? tiles.rivers[i] : 0;
    data[o + 7] = tiles.riverSize ? tiles.riverSize[i] : 0;
  }
  const out = { data, rows };
  cache.set(tiles, out);
  return out;
};
