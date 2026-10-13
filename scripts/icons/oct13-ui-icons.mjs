// scripts/icons/oct13-ui-icons.mjs
// The UI icons of the 13 October art update (UI06, UI07, UI08, UI11, UI14 to UI17), hand drawn as
// SVG in the style of src/assets/icons (dark #292C29 outline, flat fills, no plate, 256 box).
// This file is their source: edit a drawing here, then run
//   node scripts/icons/oct13-ui-icons.mjs            writes src/assets/icons/{battle,ui}/*.svg
//   node scripts/icons/oct13-ui-icons.mjs --sheets   also the contact sheets in plans/art-pilot/ui-icons-oct13/
// Seen at 11 to 24 css px on a phone: one bold shape, two or three flat tones, no thin lines, no text.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ICONS = join(ROOT, 'src', 'assets', 'icons');
const OUT = join(ROOT, 'plans', 'art-pilot', 'ui-icons-oct13');

const INK = '#292C29';
const CREAM = '#F0E6CC';
const GOLD = '#EDBB2E';
const GOLD_LIGHT = '#FBE7A0';
const WHEAT = '#D69B42';
const WHEAT_LIGHT = '#F3D99A';
const WOOD = '#B98854';
const WOOD_DARK = '#A87952';
const BARK = '#8F5F3A';
const GRAIN = '#EBC58C';
const STONE = '#B5B6A6';
const STONE_LIGHT = '#DDE3DE';
const STONE_DARK = '#8E9890';
const RED = '#B9684C';
const BLUE = '#79A6B5';
const SLATE = '#657078';
const NIGHT = '#1A212B';

/** The house wrapper: the same outline, joins and inset as the delivered icons. */
const icon = (body, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"${attrs}><g stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" transform="translate(7.68 7.68) scale(0.94)">${body}</g></svg>\n`;

const ear = (deg, fill) => `<path d="M128,150C102,116 102,58 128,18C154,58 154,116 128,150Z" fill="${fill}" transform="rotate(${deg} 128 150)"/>`;
const log = (x, y) => `<circle cx="${x}" cy="${y}" r="54" fill="${BARK}"/><circle cx="${x}" cy="${y}" r="38" fill="${GRAIN}" stroke="none"/><circle cx="${x}" cy="${y}" r="20" fill="none" stroke="${WOOD}" stroke-width="9"/><circle cx="${x}" cy="${y}" r="6" fill="${BARK}" stroke="none"/>`;
const block = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${STONE}"/><rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="24" fill="${STONE_LIGHT}" stroke="none"/><rect x="${x + 5}" y="${y + h - 23}" width="${w - 10}" height="18" fill="${STONE_DARK}" stroke="none"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="none"/>`;
const ingot = (xl, xr, y0, y1, slant) => {
  const t = 28 / (y1 - y0);
  return `<path d="M${xl - slant},${y1}L${xl},${y0}L${xr},${y0}L${xr + slant},${y1}Z" fill="${GOLD}"/><path d="M${xl},${y0}L${xr},${y0}L${xr + slant * t},${y0 + 28}L${xl - slant * t},${y0 + 28}Z" fill="${GOLD_LIGHT}" stroke-width="5"/>`;
};
const KEEP = 'M70,234L70,116L46,116L46,28L86,28L86,58L108,58L108,28L148,28L148,58L170,58L170,28L210,28L210,116L186,116L186,234Z';
const KEEP_DOOR = 'M106,234L106,188C106,152 150,152 150,188L150,234Z';

export const BATTLE = {
  // UI14: the battle stocks.
  'stock-food': icon(
    `<path d="M100,150L156,150L192,228Q128,244 64,228Z" fill="${WHEAT}"/>`
    + ear(-46, WHEAT) + ear(46, WHEAT) + ear(-23, WHEAT_LIGHT) + ear(23, WHEAT_LIGHT) + ear(0, WHEAT)
    + `<rect x="88" y="136" width="80" height="32" rx="10" fill="${RED}"/>`),
  'stock-wood': icon(log(74, 178) + log(182, 178) + log(128, 84)),
  'stock-stone': icon(block(18, 138, 110, 92) + block(128, 138, 110, 92) + block(40, 46, 122, 92)),
  'stock-gold': icon(ingot(38, 104, 152, 230, 22) + ingot(152, 218, 152, 230, 22) + ingot(92, 164, 62, 144, 24)),
  'stock-supply': icon(
    `<rect x="20" y="78" width="146" height="152" rx="6" fill="${WOOD}"/><rect x="44" y="102" width="98" height="104" fill="${WOOD_DARK}" stroke-width="5"/><path d="M44,102L142,206" fill="none" stroke-width="6"/>`
    + `<path d="M148,238C104,238 100,190 120,152C130,134 148,124 154,114L198,114C204,124 224,134 234,154C250,192 246,238 206,238Z" fill="${CREAM}"/>`
    + `<path d="M144,98C146,74 164,70 176,84C188,70 208,74 208,98Z" fill="${CREAM}"/><path d="M146,96L206,96L200,118L152,118Z" fill="${RED}"/>`),
  'stock-population': icon(
    `<rect x="44" y="112" width="168" height="122" fill="${CREAM}"/><path d="M128,18L244,120L12,120Z" fill="${RED}"/>`
    + `<path d="M82,234C82,196 102,182 128,182C154,182 174,196 174,234Z" fill="${SLATE}"/><circle cx="128" cy="154" r="26" fill="${SLATE}"/>`),

  // UI16: base identity. Both tint: every tinted part is currentColor (white by default).
  'base-marker': icon(
    `<circle cx="128" cy="128" r="116" fill="currentColor"/><circle cx="128" cy="128" r="90" fill="${NIGHT}" stroke-width="5"/>`
    + `<path d="M92,196L92,122L78,122L78,62L102,62L102,82L117,82L117,62L139,62L139,82L154,82L154,62L178,62L178,122L164,122L164,196Z" fill="currentColor"/>`
    + `<path d="M116,196L116,170C116,150 140,150 140,170L140,196Z" fill="${NIGHT}" stroke-width="5"/>`, ' color="#FFFFFF"'),
  'base-status': icon(`<path d="${KEEP}" fill="currentColor"/><path d="${KEEP_DOOR}" fill="${NIGHT}" stroke-width="5"/>`, ` color="${CREAM}"`),

  // UI08: two different glyphs.
  'select-all': icon(
    ['M14,96L14,14L96,14L96,50L50,50L50,96Z', 'M242,96L242,14L160,14L160,50L206,50L206,96Z', 'M14,160L14,242L96,242L96,206L50,206L50,160Z', 'M242,160L242,242L160,242L160,206L206,206L206,160Z']
      .map((d) => `<path d="${d}" fill="${CREAM}"/>`).join('')
    + `<rect x="74" y="74" width="108" height="108" rx="10" fill="${WHEAT}"/><path d="M128,74V182M74,128H182" fill="none" stroke-width="8"/>`),
  'find-army': icon(
    `<path d="M156,182L182,156L242,216L216,242Z" fill="${WOOD}"/><circle cx="108" cy="108" r="88" fill="${CREAM}"/><circle cx="108" cy="108" r="62" fill="${NIGHT}" stroke-width="5"/>`
    + `<rect x="68" y="58" width="16" height="100" rx="3" fill="${CREAM}" stroke-width="5"/><path d="M84,62L156,96L84,130Z" fill="${WHEAT}" stroke-width="5"/>`),

  // UI11: close, and stop working (a hammer under a "no" ring), clearly not the same glyph.
  close: icon(`<path d="M54,22L128,96L202,22L234,54L160,128L234,202L202,234L128,160L54,234L22,202L96,128L22,54Z" fill="${CREAM}"/>`),
  'stop-working': icon(
    `<circle cx="128" cy="128" r="112" fill="${RED}"/><circle cx="128" cy="128" r="84" fill="${NIGHT}" stroke-width="5"/>`
    + `<path d="M84,190L138,112L158,126L104,204Z" fill="${WOOD}" stroke-width="5"/><path d="M110,90L174,134L190,110L126,66Z" fill="${STONE_LIGHT}" stroke-width="5"/>`
    + `<path d="M58,82L82,58L198,174L174,198Z" fill="${RED}"/>`),

  // UI06: placement states (shape first, colour second) and the tiling field edge.
  'placement-legal': icon(`<circle cx="128" cy="128" r="114" fill="#3DB89A"/><path d="M58,132L84,106L112,134L172,70L200,96L112,188Z" fill="${CREAM}"/>`),
  'placement-blocked': icon(`<path d="M128,10L246,128L128,246L10,128Z" fill="#D9622B"/><rect x="66" y="108" width="124" height="40" rx="6" fill="${CREAM}"/>`),
  'placement-overlap': icon(`<rect x="18" y="18" width="146" height="146" rx="10" fill="#E6A91F"/><rect x="92" y="92" width="146" height="146" rx="10" fill="${CREAM}"/><rect x="92" y="92" width="72" height="72" fill="${RED}" stroke-width="5"/>`),
  'placement-fog': icon(
    `<path d="M60,186C16,186 10,132 52,122C48,70 114,46 140,88C170,60 228,84 212,132C252,140 246,186 204,186Z" fill="#C9D0D6"/>`
    + `<rect x="36" y="204" width="76" height="30" rx="14" fill="${STONE_DARK}"/><rect x="134" y="204" width="86" height="30" rx="14" fill="${STONE_DARK}"/>`),
  'field-edge': `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="24" viewBox="0 0 96 24"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><rect x="6" y="6.5" width="52" height="11" rx="5.5" fill="${CREAM}"/><path d="M77,3L86,12L77,21L68,12Z" fill="${WHEAT}"/></g></svg>\n`
};

const WALL = (top) => `M22,236L22,${top}L58,${top}L58,${top + 24}L96,${top + 24}L96,${top}L160,${top}L160,${top + 24}L198,${top + 24}L198,${top}L234,${top}L234,236Z`;
const hdrEnd = (flip) => `<g${flip ? ' transform="translate(512 0) scale(-1 1)"' : ''}><path d="M46,32L62,48L46,64L30,48Z" fill="${WHEAT}" stroke="${INK}" stroke-width="3"/><path d="M74,60V40H86V48H98V40H110V48H122V40H134V60Z" fill="${STONE}" stroke="${INK}" stroke-width="3"/></g>`;

export const UI = {
  // UI15: the capture card.
  'capture-conquer': icon(
    `<rect x="120" y="14" width="16" height="150" fill="${WOOD_DARK}"/><path d="M136,22L238,22L212,62L238,102L136,102Z" fill="${RED}"/>`
    + `<path d="${WALL(146)}" fill="${STONE}"/><path d="M26,204H230" fill="none" stroke="${STONE_DARK}" stroke-width="10"/><path d="${WALL(146)}" fill="none"/>`),
  'capture-raze': icon(
    `<path d="M128,14C150,56 196,84 190,138C186,180 156,204 128,204C98,204 66,182 66,138C66,112 82,98 88,76C102,90 104,100 110,106C106,70 116,42 128,14Z" fill="#E0803A"/>`
    + `<path d="M128,98C144,120 160,134 156,160C154,180 142,192 128,192C112,192 100,180 100,160C100,138 120,124 128,98Z" fill="#F6D77A" stroke-width="5"/>`
    + `<path d="M18,236L18,166L52,166L52,188L82,188L96,214L112,194L128,228L146,200L160,216L174,188L204,188L204,166L238,166L238,236Z" fill="${STONE_DARK}"/>`),
  'capture-tributary': icon(
    `<rect x="30" y="14" width="16" height="150" fill="${WOOD_DARK}"/><path d="M46,18L128,52L46,88Z" fill="${BLUE}"/>`
    + `<circle cx="160" cy="112" r="56" fill="${GOLD}"/><circle cx="160" cy="112" r="28" fill="${GOLD_LIGHT}" stroke-width="5"/>`
    + `<rect x="22" y="160" width="212" height="78" rx="8" fill="${WOOD}"/><rect x="108" y="160" width="40" height="78" fill="${WHEAT}" stroke-width="5"/>`),
  'capture-free': icon(
    `<path d="${WALL(62)}" fill="${STONE}"/><path d="M76,236L76,164C76,104 180,104 180,164L180,236Z" fill="${WHEAT_LIGHT}"/>`
    + `<path d="M76,150L40,168L40,244L76,236Z" fill="${WOOD_DARK}"/><path d="M180,150L216,168L216,244L180,236Z" fill="${WOOD_DARK}"/>`),
  'capture-header': `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="96" viewBox="0 0 512 96"><path d="M30,6H482L506,48L482,90H30L6,48Z" fill="#232C38" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M36,15H476L495,48L476,81H36L17,48Z" fill="none" stroke="#D8A444" stroke-width="3.5" stroke-linejoin="round"/>${hdrEnd(false)}${hdrEnd(true)}</svg>\n`,

  // UI17: empty contested ground, two sides' pennants (a triangle and a swallowtail), nobody on it.
  'no-mans-land': icon(
    `<path d="M100,196L100,20L116,20L116,196Z" fill="${WOOD_DARK}"/><path d="M100,24L8,62L100,104Z" fill="${BLUE}"/>`
    + `<path d="M140,196L140,20L156,20L156,196Z" fill="${WOOD_DARK}"/><path d="M156,24L248,24L224,64L248,104L156,104Z" fill="#D98A4A"/>`
    + `<path d="M8,240C40,186 96,168 128,168C160,168 216,186 248,240Z" fill="#A89A7C"/>`),

  // UI07: a campaign unit that holds its ground: a planted spear and shield.
  'hold-map': icon(
    `<rect x="120" y="46" width="16" height="40" fill="${WOOD}"/><path d="M128,6L150,48L128,64L106,48Z" fill="${STONE_LIGHT}"/>`
    + `<path d="M52,76L204,76L204,138C204,186 166,206 128,222C90,206 52,186 52,138Z" fill="${BLUE}"/><path d="M128,76L204,76L204,138C204,186 166,206 128,222Z" fill="${CREAM}" stroke-width="5"/><circle cx="128" cy="136" r="22" fill="${WHEAT}" stroke-width="5"/>`
    + `<rect x="22" y="214" width="212" height="26" rx="10" fill="${WOOD_DARK}"/>`)
};

const write = () => {
  for (const [group, set] of [['battle', BATTLE], ['ui', UI]]) {
    mkdirSync(join(ICONS, group), { recursive: true });
    for (const [id, svg] of Object.entries(set)) writeFileSync(join(ICONS, group, `${id}.svg`), svg);
  }
};

// ---- contact sheets -------------------------------------------------------------------------
const DARK = '#1A212B';   // --fa-panel
const LIGHT = '#C8CFA4';  // a light land colour of the map
const DISABLED = ['capture-conquer', 'capture-raze', 'capture-tributary', 'capture-free'];

const sheets = async () => {
  const sharp = (await import('sharp')).default;
  mkdirSync(OUT, { recursive: true });
  const all = [
    ...Object.keys(BATTLE).map((id) => ({ id, file: join(ICONS, 'battle', `${id}.svg`) })),
    ...Object.keys(UI).map((id) => ({ id, file: join(ICONS, 'ui', `${id}.svg`) }))
  ];
  const refs = [
    { id: 'ref wheat', file: join(ICONS, 'resources', 'wheat.svg') }, { id: 'ref gold', file: join(ICONS, 'resources', 'gold.svg') },
    { id: 'ref timber', file: join(ICONS, 'resources', 'timber.webp') }, { id: 'ref stone', file: join(ICONS, 'resources', 'stone.webp') }
  ];
  const wide = (id) => id === 'capture-header' || id === 'field-edge';
  /** An icon as a PNG `h` px tall (width follows the art), drawn the way the browser scales an <img>. */
  const png = async (it, h) => {
    const src = it.file.endsWith('.svg') ? sharp(Buffer.from(readFileSync(it.file)), { density: 72 * Math.max(1, (h * 4) / 96) }) : sharp(it.file);
    return src.resize({ height: h, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
  };
  const disabled = async (buf) => {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      const g = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
      data[i] = g; data[i + 1] = g; data[i + 2] = g; data[i + 3] = Math.round(data[i + 3] * 0.45);
    }
    return sharp(data, { raw: info }).png().toBuffer();
  };
  const label = (text, w, colour) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="16"><text x="${w / 2}" y="12" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="${colour}">${text}</text></svg>`);

  // Sheet 1: everything at 96 px, on the dark panel and on the light map colour.
  const list = [...all, ...refs];
  const cols = 8; const cw = 132; const chh = 132;
  const rows = Math.ceil((list.length + DISABLED.length) / cols);
  const half = rows * chh + 16;
  const parts = [];
  for (const bi of [0, 1]) {
    const ink = bi ? '#1A212B' : '#ECE5D3';
    let n = 0;
    const put = async (it, off) => {
      const { data, info } = await png(it, wide(it.id) ? (it.id === 'field-edge' ? 24 : 22) : 96);
      const x = (n % cols) * cw; const y = bi * half + Math.floor(n / cols) * chh + 8;
      parts.push({ input: off ? await disabled(data) : data, left: x + Math.round((cw - info.width) / 2), top: y + Math.round((100 - info.height) / 2) });
      parts.push({ input: label(off ? `${it.id} (off)` : it.id, cw, ink), left: x, top: y + 104 });
      n++;
    };
    for (const it of list) await put(it, false);
    for (const id of DISABLED) await put(all.find((a) => a.id === id), true);
  }
  await sharp({ create: { width: cols * cw, height: half * 2, channels: 4, background: DARK } })
    .composite([{ input: { create: { width: cols * cw, height: half, channels: 4, background: LIGHT } }, left: 0, top: half }, ...parts])
    .png().toFile(join(OUT, 'sheet-96.png'));

  // Sheet 2: true sizes 11, 14, 18 and 24 px, then the whole sheet enlarged 4x with nearest neighbour.
  const sizes = [11, 14, 18, 24];
  const small = [...refs, ...all.filter((a) => !wide(a.id))];
  const perRow = 3; const cellW = 2 * (sizes.reduce((s, v) => s + v + 4, 0)) + 14; const cellH = 30;
  const w2 = perRow * cellW; const h2 = Math.ceil(small.length / perRow) * cellH;
  const bgs = []; const tiny = [];
  for (const [i, it] of small.entries()) {
    const x0 = (i % perRow) * cellW; const y0 = Math.floor(i / perRow) * cellH;
    const halfW = (cellW - 6) / 2;
    bgs.push({ input: { create: { width: halfW, height: cellH - 2, channels: 4, background: DARK } }, left: x0, top: y0 });
    bgs.push({ input: { create: { width: halfW, height: cellH - 2, channels: 4, background: LIGHT } }, left: x0 + halfW, top: y0 });
    for (const b of [0, 1]) {
      let x = x0 + b * halfW + 4;
      for (const s of sizes) {
        const { data } = await png(it, s);
        tiny.push({ input: data, left: x, top: y0 + Math.round((cellH - 2 - s) / 2) });
        x += s + 4;
      }
    }
  }
  const base = await sharp({ create: { width: w2, height: h2, channels: 4, background: '#000000' } }).composite([...bgs, ...tiny]).png().toBuffer();
  await sharp(base).resize({ width: w2 * 4, kernel: 'nearest' }).png().toFile(join(OUT, 'sheet-true-sizes-4x.png'));
  writeFileSync(join(OUT, 'sheet-true-sizes-order.txt'), `Left to right, top to bottom, ${perRow} a row; each cell shows 11, 14, 18 and 24 px on the dark panel, then on the light map colour:\n${small.map((s, i) => `${i + 1}. ${s.id}`).join('\n')}\n`);

  // The wide pieces at the size they are meant for.
  const hdr = await png({ file: join(ICONS, 'ui', 'capture-header.svg') }, 48);
  const edge = await png({ file: join(ICONS, 'battle', 'field-edge.svg') }, 12);
  const run = Array.from({ length: 6 }, (_, i) => ({ input: edge.data, left: 8 + i * edge.info.width, top: 0 }));
  const strip = (top) => run.map((r) => ({ ...r, top }));
  await sharp({ create: { width: 320, height: 200, channels: 4, background: DARK } })
    .composite([{ input: { create: { width: 320, height: 100, channels: 4, background: LIGHT } }, left: 0, top: 100 },
      { input: hdr.data, left: 32, top: 12 }, { input: hdr.data, left: 32, top: 112 }, ...strip(74), ...strip(174)])
    .png().toFile(join(OUT, 'sheet-wide.png'));
};

write();
if (process.argv.includes('--sheets')) await sheets();
