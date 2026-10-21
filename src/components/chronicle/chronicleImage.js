// src/components/chronicle/chronicleImage.js
// The Chronicle's pictures, drawn on a canvas in the browser (differentiation plan U29): a border map
// per chapter and the share image (a PNG the player saves; no server, no upload).
import { getTiles } from '../../data/geo/tiles';

const COLS = 4;
const CELL_W = 280;
const CELL_H = 190;
const MAP_H = 140;
const PAD = 20;
const HEAD = 96;

/** Every tile id of a run-length list [start, length, ...]. */
const eachTile = (runs, fn) => { for (let i = 0; i < runs.length; i += 2) for (let k = 0; k < runs[i + 1]; k += 1) fn(runs[i] + k); };

/** The lat/lon box that holds every chapter's land, so the maps share one scale. */
export const chronicleBox = (chapters) => {
  const tiles = getTiles();
  const b = { s: 90, n: -90, w: 180, e: -180 };
  chapters.forEach((c) => eachTile(c.runs, (t) => {
    const { lat, lon } = tiles.latLonOf(t);
    b.s = Math.min(b.s, lat); b.n = Math.max(b.n, lat); b.w = Math.min(b.w, lon); b.e = Math.max(b.e, lon);
  }));
  return b;
};

/** Draws one chapter's tiles inside (x, y, w, h), keeping the box's shape. */
export const drawBorders = (ctx, runs, box, x, y, w, h, color = '#d9a441') => {
  const tiles = getTiles();
  const dLon = Math.max(box.e - box.w, 1);
  const dLat = Math.max(box.n - box.s, 1);
  const k = Math.min(w / dLon, h / dLat);
  const ox = x + (w - dLon * k) / 2;
  const oy = y + (h - dLat * k) / 2;
  const dot = Math.max(1.5, k * 0.75);
  ctx.fillStyle = color;
  eachTile(runs, (t) => {
    const { lat, lon } = tiles.latLonOf(t);
    ctx.fillRect(ox + (lon - box.w) * k, oy + (box.n - lat) * k, dot, dot);
  });
};

/** The share image as a canvas. `rows` is [{ title, sub, runs }] and `head` the two header lines. */
export const chronicleCanvas = (rows, head, dir = 'ltr') => {
  const box = chronicleBox(rows);
  const lines = Math.ceil(rows.length / COLS) || 1;
  const cv = document.createElement('canvas');
  cv.width = COLS * CELL_W + PAD * 2;
  cv.height = HEAD + lines * CELL_H + PAD;
  const ctx = cv.getContext('2d');
  ctx.direction = dir;
  ctx.fillStyle = '#16120d';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#f1e4c4';
  ctx.textAlign = 'start';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText(head[0], dir === 'rtl' ? cv.width - PAD : PAD, 48, cv.width - PAD * 2);
  ctx.fillStyle = '#b79b62';
  ctx.font = '20px Georgia, serif';
  ctx.fillText(head[1], dir === 'rtl' ? cv.width - PAD : PAD, 78, cv.width - PAD * 2);
  rows.forEach((r, i) => {
    const col = i % COLS;
    const x = dir === 'rtl' ? cv.width - PAD - (col + 1) * CELL_W : PAD + col * CELL_W;
    const y = HEAD + Math.floor(i / COLS) * CELL_H;
    ctx.fillStyle = '#241d14';
    ctx.fillRect(x + 4, y, CELL_W - 8, CELL_H - 8);
    drawBorders(ctx, r.runs, box, x + 12, y + 8, CELL_W - 24, MAP_H);
    ctx.fillStyle = '#f1e4c4';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillText(r.title, dir === 'rtl' ? x + CELL_W - 12 : x + 12, y + MAP_H + 24, CELL_W - 24);
    ctx.fillStyle = '#b79b62';
    ctx.font = '14px Georgia, serif';
    ctx.fillText(r.sub, dir === 'rtl' ? x + CELL_W - 12 : x + 12, y + MAP_H + 42, CELL_W - 24);
  });
  return cv;
};

/** Hands the canvas to the player as a downloaded PNG. */
export const saveCanvas = (cv, fileName) => new Promise((resolve) => cv.toBlob((blob) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  resolve();
}, 'image/png'));
