// src/components/map/gl/fogField.js
// The soft fog edge of the WebGL map (territoryShader.js). What is explored and in sight stays a
// per-tile fact (fogView.js); only its DRAWING is softened. Once per fog change the tile states are
// rasterised onto an equirectangular FIELD_W x FIELD_H grid (each texel takes the state of the tile
// under its centre: the lookup grid of tileGpuData.js) and blurred with a gaussian about half a hex
// wide (wider in longitude towards the poles, so the blur is round on the ground). Two channels:
//   r  explored (1) or not (0), blurred: the dark mask fades over the band where r crosses ~0.4;
//   g  in sight (1) or not (0), blurred: the grey "last seen" wash fades the same way.
// The shader samples it bilinearly, warps it with world-space noise and keeps every tile's centre
// on its own side (a lone explored tile stays open, a lone unexplored one stays dark).
// Pure, no three.js: a Uint8Array of RGBA texels (b and a unused).
import { LOOKUP_W, LOOKUP_H } from './tileGpuData';

export const FIELD_W = LOOKUP_W;
export const FIELD_H = LOOKUP_H;
export const EARTH_KM = 6371;
export const FOG_SIGMA_KM = 34; // the blur, about 0.45 of the 77 km between tile centres
const MAX_SIGMA_TEXELS = 24; // near the poles a degree of longitude is short: cap the row blur

const kernel = (sigma) => {
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const w = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); w[i + r] = v; sum += v; }
  for (let i = 0; i < w.length; i++) w[i] /= sum;
  return { r, w };
};

/**
 * The fog field from every tile's fog state (buildFogStates in territoryData.js: 0 unexplored,
 * 1 explored, 2 in sight) and the lookup grid (tile id per texel).
 * Returns { data: Uint8Array(FIELD_W * FIELD_H * 4), width, height }.
 */
export const buildFogField = ({ states, lookup, width = FIELD_W, height = FIELD_H, sigmaKm = FOG_SIGMA_KM }) => {
  const n = width * height;
  const ex = new Float32Array(n);
  const vi = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = states[lookup[i]];
    ex[i] = s > 0.5 ? 1 : 0;
    vi[i] = s > 1.5 ? 1 : 0;
  }
  const kmPerTexelY = (Math.PI * EARTH_KM) / height;
  const kmPerTexelX = (2 * Math.PI * EARTH_KM) / width; // at the equator
  const tmpE = new Float32Array(n);
  const tmpV = new Float32Array(n);
  const rowState = new Int8Array(height); // a uniform row's state (explored 1 + in sight 2), or -1
  // Rows (longitude wraps): sigma in texels grows as 1 / cos(latitude).
  for (let y = 0; y < height; y++) {
    const row = y * width;
    // a uniform row (all unexplored, say) blurs to itself: skip the work
    let uniform = true;
    for (let x = 1; x < width && uniform; x++) if (ex[row + x] !== ex[row] || vi[row + x] !== vi[row]) uniform = false;
    rowState[y] = uniform ? ex[row] + 2 * vi[row] : -1;
    if (uniform) { tmpE.fill(ex[row], row, row + width); tmpV.fill(vi[row], row, row + width); continue; }
    const lat = Math.PI / 2 - ((y + 0.5) * Math.PI) / height;
    const sx = Math.min(MAX_SIGMA_TEXELS, sigmaKm / (kmPerTexelX * Math.max(0.02, Math.cos(lat))));
    const { r, w } = kernel(sx);
    for (let x = 0; x < width; x++) {
      let se = 0; let sv = 0;
      for (let i = -r; i <= r; i++) {
        let xx = x + i;
        if (xx < 0) xx += width; else if (xx >= width) xx -= width;
        const k = w[i + r];
        se += ex[row + xx] * k; sv += vi[row + xx] * k;
      }
      tmpE[row + x] = se; tmpV[row + x] = sv;
    }
  }
  // Columns (clamped at the poles), a row at a time so memory is read in order; a row whose
  // neighbourhood is uniform rows of one state is that state.
  const { r, w } = kernel(sigmaKm / kmPerTexelY);
  const out = new Uint8Array(n * 4);
  const accE = new Float32Array(width);
  const accV = new Float32Array(width);
  const sameAs = (a, b) => rowState[a] >= 0 && rowState[a] === rowState[b];
  for (let y = 0; y < height; y++) {
    let flat = rowState[y] >= 0;
    for (let i = -r; i <= r && flat; i++) flat = sameAs(Math.min(height - 1, Math.max(0, y + i)), y);
    if (flat) {
      const e = rowState[y] & 1 ? 255 : 0; const v = rowState[y] & 2 ? 255 : 0;
      for (let x = 0, o = y * width * 4; x < width; x++, o += 4) { out[o] = e; out[o + 1] = v; }
      continue;
    }
    accE.fill(0); accV.fill(0);
    for (let i = -r; i <= r; i++) {
      const row = Math.min(height - 1, Math.max(0, y + i)) * width;
      const k = w[i + r];
      for (let x = 0; x < width; x++) { accE[x] += tmpE[row + x] * k; accV[x] += tmpV[row + x] * k; }
    }
    for (let x = 0, o = y * width * 4; x < width; x++, o += 4) { out[o] = Math.round(accE[x] * 255); out[o + 1] = Math.round(accV[x] * 255); }
  }
  return { data: out, width, height };
};
