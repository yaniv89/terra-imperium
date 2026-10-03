// src/components/globe/politicalTexture.js
// The globe's political layer as pixels (plans/civ-map-rework.md, B4b and B5): the realistic
// Earth raster with every city's land tinted in its nation's colour and nation borders drawn as
// lines. The territories arrive already cut to the real coastline (src/data/geo/cityFeatures.js),
// so no hex edge shows along a coast. One canvas in equirectangular projection, the exact layout
// of the raster, uploaded to the globe as a three.js CanvasTexture. Far out the globe is the
// world view: nations, borders and capitals, nothing smaller (the flat map carries the local view).
// The lenses (E5) paint over it from the same models as the flat map (lensLayer.js).
import { geoEquirectangular, geoPath } from 'd3-geo';
import { getCityFeatures, getNationTerritories } from '../../data/geo/cityFeatures';
import { drawLensLayer } from './lensLayer';

export const POLITICAL_ALPHA = 0.45;

/** Draws the political layer over `baseImage` (an Image of the world raster) on a canvas of the
 * same size. `fillFor(cityId)` gives a hex colour; `land` is the country feature list the
 * territories are clipped to; `warOwners` is a Set of nation ids whose borders are drawn red;
 * `selected` is the city id to outline. Returns the canvas. */
export const renderPoliticalCanvas = ({ canvas, baseImage, state, fillFor, land, warOwners, selected, lens = 'political' }) => {
  const width = canvas.width; const height = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  if (baseImage) ctx.drawImage(baseImage, 0, 0, width, height);
  const projection = geoEquirectangular().fitSize([width, height], { type: 'Sphere' });
  const path = geoPath(projection, ctx);
  const features = getCityFeatures(state, land);
  ctx.globalAlpha = POLITICAL_ALPHA;
  features.forEach((f) => {
    const colour = fillFor(f.properties.gameRegionId);
    if (!colour) return;
    ctx.fillStyle = colour;
    ctx.beginPath(); path(f); ctx.fill();
  });
  ctx.globalAlpha = 1;
  // Nation borders: the outline of each nation's land.
  const nations = getNationTerritories(state, land);
  ctx.lineJoin = 'round';
  nations.forEach((f) => {
    const atWar = warOwners && warOwners.has(f.id);
    ctx.strokeStyle = atWar ? '#ef4444' : 'rgba(5,8,20,0.85)';
    ctx.lineWidth = atWar ? Math.max(1.5, width / 1400) : Math.max(1, width / 2048);
    ctx.beginPath(); path(f); ctx.stroke();
  });
  if (selected) {
    const f = features.find((x) => x.properties.gameRegionId === selected);
    if (f) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, width / 1200);
      ctx.beginPath(); path(f); ctx.stroke();
    }
  }
  // The lens layer (E5, lensLayer.js) on top of borders and the selection.
  drawLensLayer(ctx, { state, lens, projection, width });
  return { canvas, path };
};

/** Loads an image once (the world raster). */
const images = new Map();
export const loadImage = (url) => {
  if (images.has(url)) return images.get(url);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
  images.set(url, p);
  return p;
};
