// src/worldgen/preview.js
// A flat-colour picture of a world from its tile columns (debug view and the start screen's map
// thumbnail; plans/MAP-VARIATIONS-PLAN.md 7.1 and 8.4). Equirectangular, one nearest tile per
// pixel: terrain colours tinted by elevation, sea by depth, rivers in blue. Not the painted look
// (MV4): generated worlds ship with that.

const TERRAIN_RGB = {
  grassland: [104, 150, 72], plains: [168, 160, 96], desert: [222, 196, 138], tundra: [148, 152, 132], snow: [236, 240, 246], lake: [72, 128, 190]
};
const FEATURE_RGB = { forest: [60, 104, 54], jungle: [34, 96, 46], marsh: [86, 128, 104], floodplain: [126, 170, 82], oasis: [120, 160, 90], ice: [226, 236, 248] };

/** RGBA bytes (Uint8ClampedArray, W x H) of the world in `tiles` (a decorated grid). */
export const worldPreviewRgba = (tiles, W, H, { rivers = true } = {}) => {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * 360 - 180;
      const id = tiles.nearest(lat, lon);
      let c;
      const e = tiles.elevation[id];
      if (tiles.land[id] !== 1) {
        const d = Math.min(1, -e / 5000);
        c = tiles.featureNames[tiles.feature[id]] === 'ice' ? [214, 226, 240] : [Math.round(52 - 30 * d), Math.round(108 - 50 * d), Math.round(168 - 50 * d)];
      } else {
        const t = tiles.terrainNames[tiles.terrain[id]];
        const f = tiles.featureNames[tiles.feature[id]];
        c = (FEATURE_RGB[f] || TERRAIN_RGB[t] || [160, 160, 160]).slice();
        const rel = tiles.reliefNames[tiles.relief[id]];
        if (rel === 'mountains') c = [Math.round(c[0] * 0.55 + 70), Math.round(c[1] * 0.5 + 58), Math.round(c[2] * 0.5 + 50)];
        else if (rel === 'hills') c = c.map((v) => Math.round(v * 0.86));
        if (e > 2500 && t !== 'snow') c = c.map((v) => Math.min(255, v + 40));
        if (rivers && tiles.rivers[id] && ((x + y) & 3) === 0) c = [56, 112, 210];
      }
      const o = (y * W + x) * 4;
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
    }
  }
  return out;
};
