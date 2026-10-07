// scripts/art/contact-sheet.mjs
// A checkpoint's contact sheet from screenshots: node scripts/art/contact-sheet.mjs <out.png> <cols> <png>...
// Each picture is shrunk to half size (844x390 -> 422x195) and laid out in rows.
import sharp from 'sharp';

const [out, colsArg, ...files] = process.argv.slice(2);
const cols = Number(colsArg) || 3; const W = 422; const H = 195;
const rows = Math.ceil(files.length / cols);
const tiles = await Promise.all(files.map((f) => sharp(f).resize(W, H, { fit: 'cover' }).png().toBuffer()));
await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#1e293b' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * W, top: Math.floor(i / cols) * H })))
  .png({ compressionLevel: 9, palette: true }).toFile(out);
console.log(out, files.length, 'pictures');
