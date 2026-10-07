// scripts/art/proof-sheet.mjs
// A labelled proof sheet of model renders (render_unit_preview.py output, transparent or plain
// background): each picture is trimmed to its model, fitted into a square tile and captioned with
// its file name. node scripts/art/proof-sheet.mjs <out.png> <cols> <tile_px> <png>...
import sharp from 'sharp';
import { basename } from 'node:path';

const [out, colsArg, tileArg, ...files] = process.argv.slice(2);
const cols = Number(colsArg) || 8; const T = Number(tileArg) || 200; const CAP = 18;
const esc = (s) => s.replace(/[<>&]/g, '');
const tiles = await Promise.all(files.map(async (f) => {
  const img = await sharp(f).trim({ threshold: 8 }).resize(T - 8, T - CAP - 6, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const label = Buffer.from(`<svg width="${T}" height="${CAP}"><text x="${T / 2}" y="13" font-family="sans-serif" font-size="12" fill="#e2e8f0" text-anchor="middle">${esc(basename(f, '.png'))}</text></svg>`);
  return sharp({ create: { width: T, height: T, channels: 4, background: '#334155' } })
    .composite([{ input: img, left: 4, top: 4 }, { input: label, left: 0, top: T - CAP }]).png().toBuffer();
}));
const rows = Math.ceil(files.length / cols);
await sharp({ create: { width: cols * T, height: rows * T, channels: 3, background: '#1e293b' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * T, top: Math.floor(i / cols) * T })))
  .png({ compressionLevel: 9 }).toFile(out);
console.log(out, files.length, 'pictures');
