// src/components/map/gl/declutter.js
// Which labels the map draws when they would stand on each other (playtest audit I080: at the
// world zoom city names, banners and "Raid party" labels piled up). Each label is a sprite of
// sceneModel.js or raidShapes.js with a priority (`prio`, higher first); the labels are placed in
// that order and one that would overlap a label already placed is left out. What a hidden label
// names is still there to tap (its badge, its party), and comes back as the player zooms in.
// Pure: sprites in, sprites out, in their first order.

/** The sprite's box on screen at zoom `k`, without the camera's pan: [x0, y0, x1, y1] CSS px. */
export const labelBox = (s, k, pad = 1) => {
  const o = s.offset || [0, 0, 0, 0]; const e = s.exp || [0, 0];
  const cx = s.anchor[0] * k + o[0] + o[2] * k ** e[1]; const cy = s.anchor[1] * k + o[1] + o[3] * k ** e[1];
  const w = s.size[0] * k ** e[0]; const h = s.size[1] * k ** e[0];
  return [cx - w / 2 - pad, cy - h / 2 - pad, cx + w / 2 + pad, cy + h / 2 + pad];
};

const CELL = 96; // the buckets of the overlap search, CSS px

/**
 * The labels to draw among `labels` at zoom `k`: highest `prio` first (ties: the earlier one), a
 * label that overlaps a kept one is dropped. Sprites without `prio` count as 0.
 */
export const declutterLabels = (labels, k, pad = 1) => {
  if (!labels || labels.length < 2) return labels || [];
  const order = labels.map((s, i) => ({ s, i, box: labelBox(s, k, pad) })).sort((a, b) => (b.s.prio || 0) - (a.s.prio || 0) || a.i - b.i);
  const grid = new Map();
  const keep = new Array(labels.length).fill(false);
  for (const { i, box } of order) {
    const x0 = Math.floor(box[0] / CELL); const x1 = Math.floor(box[2] / CELL); const y0 = Math.floor(box[1] / CELL); const y1 = Math.floor(box[3] / CELL);
    let hit = false;
    for (let gx = x0; gx <= x1 && !hit; gx++) {
      for (let gy = y0; gy <= y1 && !hit; gy++) {
        const cell = grid.get(`${gx},${gy}`);
        if (cell) hit = cell.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
      }
    }
    if (hit) continue;
    keep[i] = true;
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const key = `${gx},${gy}`; let cell = grid.get(key); if (!cell) { cell = []; grid.set(key, cell); } cell.push(box); }
  }
  return labels.filter((_, i) => keep[i]);
};

/** A city name's priority: the selected city, your capital, your cities, capitals, then by size. */
export const cityLabelPrio = (city, { selected = false, own = false } = {}) => (selected ? 1000 : 0) + (own ? 400 : 0) + (city.isCapital ? 200 : 0) + Math.min(99, city.size || 1);
