// src/components/map/closeView/groundBlend.js
// Fitting the art into the land under it, everywhere on the map:
//   Land mask   the real coastline (the map's country outlines) drawn once into a land/sea
//               picture, equirectangular; fields, farm works and trees are only drawn where it
//               says land, so nothing stands in the sea (the 106 km hex tiles are far too coarse
//               for a coastline).
//   Ground tint the colour of the world picture under a town, land pixels only, turned into a
//               multiplier for the models' Ground material (earth, paving, fields, wall
//               footings), three quarters of the way toward the land: green earth in Europe, pale in the tundra,
//               sandy in the desert, so a town sits in its land instead of on a pasted disc.
// The maths is pure (unit tested); loading needs a browser (canvas, image).
import { geoEquirectangular, geoPath } from 'd3-geo';

export const MASK_W = 4096;
export const MASK_H = 2048;

const px = (w, h, lat, lon) => {
  const x = Math.floor((((lon + 180) % 360 + 360) % 360) / 360 * w);
  const y = Math.floor(((90 - lat) / 180) * h);
  return [Math.min(w - 1, Math.max(0, x)), Math.min(h - 1, Math.max(0, y))];
};

/** Land (true) or sea at a point; true while no mask is loaded, so nothing vanishes. */
export const isLandAt = (mask, lat, lon) => {
  if (!mask) return true;
  const [x, y] = px(mask.w, mask.h, lat, lon);
  return mask.data[y * mask.w + x] === 1;
};

/** A mask from RGBA pixels where land was painted opaque: { w, h, data: Uint8Array of 0/1 }. */
export const maskFromRgba = (rgba, w, h) => {
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = rgba[i * 4 + 3] > 127 ? 1 : 0;
  return { w, h, data };
};

/** The mean colour (0..1 RGB) of the land pixels of `raster` ({ w, h, rgba }) within `radius`
 * pixels of a point, or null when there is no land there or no raster yet. */
export const sampleLandColour = (raster, mask, lat, lon, radius = 3) => {
  if (!raster) return null;
  const [cx, cy] = px(raster.w, raster.h, lat, lon);
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx; const y = cy + dy;
      if (x < 0 || y < 0 || x >= raster.w || y >= raster.h) continue;
      if (mask) {
        const lat2 = 90 - ((y + 0.5) / raster.h) * 180;
        const lon2 = ((x + 0.5) / raster.w) * 360 - 180;
        if (!isLandAt(mask, lat2, lon2)) continue;
      }
      const i = (y * raster.w + x) * 4;
      r += raster.rgba[i]; g += raster.rgba[i + 1]; b += raster.rgba[i + 2]; n += 1;
    }
  }
  return n ? [r / n / 255, g / n / 255, b / n / 255] : null;
};

// The models' ground is authored as warm earth about this colour (linear-ish 0..1 sRGB).
const AUTHORED_GROUND = [0.72, 0.56, 0.38];
export const GROUND_BLEND = 0.75;
/** A colour multiplier for the Ground material that takes it GROUND_BLEND of the way toward the
 * land colour, kept within 0.45..1.5 per channel; quantised so towns share materials. */
export const groundTint = (land, blend = GROUND_BLEND) => {
  if (!land) return null;
  return land.map((c, i) => {
    const f = Math.min(1.5, Math.max(0.45, c / AUTHORED_GROUND[i]));
    return Math.round((1 + (f - 1) * blend) * 16) / 16;
  });
};
export const tintKey = (tint) => (tint ? tint.join(',') : '');

let loading = null;
/** Build the land mask from the country features and read the world picture, once (browser). */
export const loadGroundData = (features, rasterUrl) => {
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_W; canvas.height = MASK_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const projection = geoEquirectangular().scale(MASK_W / (2 * Math.PI)).translate([MASK_W / 2, MASK_H / 2]).precision(0.5);
    ctx.beginPath();
    geoPath(projection, ctx)({ type: 'FeatureCollection', features: features?.features || features || [] });
    ctx.fillStyle = '#000';
    ctx.fill();
    const mask = maskFromRgba(ctx.getImageData(0, 0, MASK_W, MASK_H).data, MASK_W, MASK_H);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c2 = document.createElement('canvas');
      c2.width = img.naturalWidth; c2.height = img.naturalHeight;
      const x2 = c2.getContext('2d', { willReadFrequently: true });
      x2.drawImage(img, 0, 0);
      resolve({ mask, raster: { w: c2.width, h: c2.height, rgba: x2.getImageData(0, 0, c2.width, c2.height).data } });
    };
    img.onerror = () => resolve({ mask, raster: null });
    img.src = rasterUrl;
  });
  return loading;
};
