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

const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/**
 * Labels moved out from under the map's own buttons (playtest audit I081: a city's name under the
 * World button). `toScreen(anchor)` is an anchor's screen point at the settled view, `rects` the
 * controls' boxes [x0, y0, x1, y1] in CSS px over the map. A label under a control slides the
 * shortest way out (at most `maxShift` px, never onto another control); one whose city itself is
 * under the control, or that cannot get out, is left out (its badge is still there to tap, and it
 * comes back as the map moves). Pure: sprites in, sprites out.
 */
export const avoidHud = (labels, k, toScreen, rects, { pad = 3, maxShift = 72 } = {}) => {
  if (!labels?.length || !rects?.length) return labels || [];
  const grown = rects.map((r) => [r[0] - pad, r[1] - pad, r[2] + pad, r[3] + pad]);
  const out = [];
  for (const s of labels) {
    const at = toScreen(s.anchor);
    if (!at) { out.push(s); continue; }
    const b0 = labelBox(s, k, 0);
    const dx0 = at[0] - s.anchor[0] * k; const dy0 = at[1] - s.anchor[1] * k;
    const box = [b0[0] + dx0, b0[1] + dy0, b0[2] + dx0, b0[3] + dy0];
    const hit = grown.find((r) => overlaps(box, r));
    if (!hit) { out.push(s); continue; }
    if (at[0] >= hit[0] && at[0] <= hit[2] && at[1] >= hit[1] && at[1] <= hit[3]) continue;
    const moves = [[hit[0] - box[2], 0], [hit[2] - box[0], 0], [0, hit[1] - box[3]], [0, hit[3] - box[1]]]
      .filter(([x, y]) => Math.abs(x) + Math.abs(y) <= maxShift)
      .filter(([x, y]) => !grown.some((r) => overlaps([box[0] + x, box[1] + y, box[2] + x, box[3] + y], r)))
      .sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]));
    if (!moves.length) continue;
    const o = s.offset || [0, 0, 0, 0];
    out.push({ ...s, offset: [o[0] + moves[0][0], o[1] + moves[0][1], o[2], o[3]] });
  }
  return out;
};

/** A city name's priority: the selected city, your capital, your cities, capitals, then by size. */
export const cityLabelPrio = (city, { selected = false, own = false } = {}) => (selected ? 1000 : 0) + (own ? 400 : 0) + (city.isCapital ? 200 : 0) + Math.min(99, city.size || 1);
