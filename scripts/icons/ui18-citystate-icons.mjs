// scripts/icons/ui18-citystate-icons.mjs
// UI18: the five city-state type badges and the patron mark, hand drawn as SVG in the style of
// src/assets/icons (dark #292C29 outline at 7, flat fills, no plate, 256 box). This file is their source:
//   node scripts/icons/ui18-citystate-icons.mjs            writes src/assets/icons/independents/citystate-*.svg
//   node scripts/icons/ui18-citystate-icons.mjs --sheets   also the sheets in plans/art-pilot/ui18-citystates/
// A type badge is a round medallion in the type's colour (data/cityStates.js CITY_STATE_TYPES[*].badge)
// with one bold cream glyph, so it never looks like an independent's heater shield (its personality).
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'src', 'assets', 'icons', 'independents');
const OUT = join(ROOT, 'plans', 'art-pilot', 'ui18-citystates');

const INK = '#292C29';
const CREAM = '#F0E6CC';
const GOLD = '#EDBB2E';
const WOOD = '#B98854';
const STEEL = '#DDE3DE';
const YOU = '#5B9BF0';

const icon = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><g stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" transform="translate(7.68 7.68) scale(0.94)">${body}</g></svg>\n`;
const medal = (colour, glyph) => icon(`<circle cx="128" cy="128" r="118" fill="${colour}"/>${glyph}`);

// One axe, blade on the outer side, so the crossed pair shows both blades.
const axe = (t) => `<g transform="${t}"><rect x="116" y="50" width="24" height="168" rx="6" fill="${WOOD}"/><path d="M116,52L66,36C48,66 48,104 66,132L116,114Z" fill="${STEEL}"/></g>`;

export const CITY_STATE_ICONS = {
  // Trade: an amphora, the trade good of every age.
  'citystate-trade': medal('#CA8A04',
    `<path d="M108,66L148,66C188,84 198,138 170,182L144,218L112,218L86,182C58,138 68,84 108,66Z" fill="${CREAM}"/>`
    + `<rect x="98" y="34" width="60" height="30" rx="6" fill="${CREAM}"/><path d="M84,128H172" fill="none" stroke="#CA8A04" stroke-width="14"/>`),
  // Military: a crested helmet seen from the front.
  'citystate-military': medal('#57534E',
    `<path d="M84,70C84,14 172,14 172,70Z" fill="#C2410C"/>`
    + `<path d="M56,206L56,132C56,86 88,58 128,58C168,58 200,86 200,132L200,206L160,206L152,142L104,142L96,206Z" fill="${CREAM}"/>`),
  // Science: an open book.
  'citystate-science': medal('#2563EB',
    `<path d="M128,90C104,70 70,68 40,78L40,184C70,174 104,176 128,196Z" fill="${CREAM}"/><path d="M128,90C152,70 186,68 216,78L216,184C186,174 152,176 128,196Z" fill="${CREAM}"/>`
    + `<path d="M128,92V194" fill="none" stroke-width="9"/>`),
  // Culture: a temple front.
  'citystate-culture': medal('#9333EA',
    `<path d="M44,104L128,44L212,104Z" fill="${CREAM}"/><rect x="66" y="112" width="28" height="64" fill="${CREAM}"/><rect x="114" y="112" width="28" height="64" fill="${CREAM}"/><rect x="162" y="112" width="28" height="64" fill="${CREAM}"/>`
    + `<rect x="46" y="176" width="164" height="30" rx="4" fill="${CREAM}"/>`),
  // Raiders: two crossed axes.
  'citystate-raiders': medal('#C2410C', axe('rotate(-34 128 140)') + axe('translate(256 0) scale(-1 1) rotate(-34 128 140)')),
  // The patron mark ("they favour you"): a favour rosette with two ribbon tails, in the player's blue.
  'citystate-patron': icon(
    `<path d="M96,140L52,242L88,228L110,250L140,156Z" fill="${YOU}"/><path d="M160,140L204,242L168,228L146,250L116,156Z" fill="${YOU}"/>`
    + Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return `<circle cx="${(128 + 72 * Math.sin(a)).toFixed(1)}" cy="${(104 - 72 * Math.cos(a)).toFixed(1)}" r="28" fill="${GOLD}"/>`; }).join('')
    + `<circle cx="128" cy="104" r="78" fill="${GOLD}" stroke="none"/><circle cx="128" cy="104" r="42" fill="${YOU}"/><circle cx="128" cy="104" r="16" fill="${CREAM}" stroke-width="5"/>`)
};

const write = () => {
  mkdirSync(DIR, { recursive: true });
  for (const [id, svg] of Object.entries(CITY_STATE_ICONS)) writeFileSync(join(DIR, `${id}.svg`), svg);
};

const DARK = '#1A212B';
const LIGHT = '#C8CFA4';
const RAISED = '#232C38';

const sheets = async () => {
  const sharp = (await import('sharp')).default;
  mkdirSync(OUT, { recursive: true });
  const mine = Object.keys(CITY_STATE_ICONS).map((id) => ({ id, file: join(DIR, `${id}.svg`) }));
  const refs = ['raiders', 'mercantile', 'fortress', 'tribal'].map((p) => ({ id: `shield ${p}`, file: join(DIR, `${p}.svg`) }));
  const png = (it, h) => sharp(Buffer.from(readFileSync(it.file)), { density: 72 * Math.max(1, (h * 4) / 96) })
    .resize({ height: h, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
  const label = (text, w, colour) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="16"><text x="${w / 2}" y="12" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="${colour}">${text}</text></svg>`);

  const list = [...mine, ...refs];
  const cols = 5; const cw = 132; const chh = 132;
  const rows = Math.ceil(list.length / cols); const half = rows * chh + 16;
  const parts = [];
  for (const bi of [0, 1]) {
    for (const [n, it] of list.entries()) {
      const { data, info } = await png(it, 96);
      const x = (n % cols) * cw; const y = bi * half + Math.floor(n / cols) * chh + 8;
      parts.push({ input: data, left: x + Math.round((cw - info.width) / 2), top: y + 2 });
      parts.push({ input: label(it.id, cw, bi ? DARK : '#ECE5D3'), left: x, top: y + 104 });
    }
  }
  await sharp({ create: { width: cols * cw, height: half * 2, channels: 4, background: DARK } })
    .composite([{ input: { create: { width: cols * cw, height: half, channels: 4, background: LIGHT } }, left: 0, top: half }, ...parts])
    .png().toFile(join(OUT, 'sheet-96.png'));

  // True sizes on the sheet's raised row colour, the panel and the light map colour, one icon a row.
  const sizes = [11, 14, 18, 24];
  const bands = [RAISED, DARK, LIGHT];
  const bandW = sizes.reduce((s, v) => s + v + 5, 0) + 5; const rowH = 30;
  const w2 = bandW * bands.length; const h2 = list.length * rowH;
  const comp = [];
  for (const [r, it] of list.entries()) {
    for (const [b, bg] of bands.entries()) {
      comp.push({ input: { create: { width: bandW - 2, height: rowH - 2, channels: 4, background: bg } }, left: b * bandW, top: r * rowH });
      let x = b * bandW + 5;
      for (const s of sizes) {
        const { data } = await png(it, s);
        comp.push({ input: data, left: x, top: r * rowH + Math.round((rowH - 2 - s) / 2) });
        x += s + 5;
      }
    }
  }
  const base = await sharp({ create: { width: w2, height: h2, channels: 4, background: '#000000' } }).composite(comp).png().toBuffer();
  await sharp(base).resize({ width: w2 * 4, kernel: 'nearest' }).png().toFile(join(OUT, 'sheet-true-sizes-4x.png'));
  writeFileSync(join(OUT, 'sheet-true-sizes-order.txt'), `One icon a row; each row shows 11, 14, 18 and 24 px on the list row colour (${RAISED}), the panel (${DARK}) and a light map colour (${LIGHT}):\n${list.map((s, i) => `${i + 1}. ${s.id}`).join('\n')}\n`);
};

write();
if (process.argv.includes('--sheets')) await sheets();
