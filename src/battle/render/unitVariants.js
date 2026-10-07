// src/battle/render/unitVariants.js
// Per-instance variety for the battlefield's soldiers, all inside ONE draw call per (age, class).
// Every soldier instance carries a vec4 `aVariant`:
//   x — skin tone into SKIN_TONES (vertices tagged aPart = 1: faces, hands), fractional: the
//       shader blends the two tones either side. Every soldier of a side wears its people's tone
//       (skinToneFor), give or take SKIN_SPREAD / 2. (Picking each soldier's tone from the whole
//       palette made one squad of Bronze spearmen look like two different models.)
//   y — emblem cell 0..15 in the heraldry atlas (vertices tagged aPart = 2: shield faces, tabards)
//   z — cloth jitter -1..1 (a ±9% brightness shift on untinted cloth/leather/steel)
//   w — spare
// The side's colour still comes from instanceColor (vertices tagged aTeam = 1). The atlas is one
// small texture (4 × 4 cells) drawn procedurally on a canvas — no art files, one texture bind.
import { CanvasTexture, DataTexture, RGBAFormat, SRGBColorSpace, Color, LinearMipmapLinearFilter, LinearFilter } from 'three';
import { PEOPLES, peopleForNationId } from '../../data/peoples';

export const SKIN_TONES = ['#f1cfae', '#e0ac82', '#c68b5f', '#a8714a', '#8d5a3b', '#5e3a24'];

// A people's skin tone (a fractional index into SKIN_TONES) by its region in the peoples pool;
// anyone else (legacy countries, independents, the sandbox) the middle of the palette.
export const DEFAULT_SKIN_TONE = 2;
export const SKIN_SPREAD = 0.7;
const REGION_SKIN = {
  europe: 0.6, eastasia: 1.1, centralasia: 1.4, neareast: 2, northafrica: 2.5, americas: 2.5,
  southeastasia: 2.6, southasia: 3.1, oceania: 3.6, africa: 4.4
};
export const skinToneFor = (nationId) => REGION_SKIN[PEOPLES[peopleForNationId(nationId)]?.region] ?? DEFAULT_SKIN_TONE;
export const EMBLEM_GRID = 4;             // 4 × 4 cells
export const EMBLEM_CELLS = EMBLEM_GRID * EMBLEM_GRID;
export const EMBLEM_INSET = 0.05;         // keep samples off the cell edges (mip bleeding)

const hash01 = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// The atlas UV of a point (u, v in 0..1 on the part) in emblem `cell` — the exact formula the
// vertex shader uses (soldierFactory.js VARIANT_GLSL), mirrored here so it can be tested.
export const emblemCellUv = (cell, u, v) => {
  const c = Math.max(0, Math.min(EMBLEM_CELLS - 1, Math.round(cell)));
  const col = c % EMBLEM_GRID; const row = Math.floor(c / EMBLEM_GRID);
  const k = 1 - 2 * EMBLEM_INSET;
  const cu = Math.max(0, Math.min(1, u)); const cv = Math.max(0, Math.min(1, v));
  return [(cu * k + EMBLEM_INSET + col) / EMBLEM_GRID, (cv * k + EMBLEM_INSET + row) / EMBLEM_GRID];
};

// Which cell a squad's shields carry: each side draws from its own half of the atlas (0–7 / 8–15),
// so the two armies read as two heraldic families while every squad still has its own device.
export const emblemCellFor = (side, squadIdx) => ((side ? 1 : 0) * 8 + (Math.floor(hash01(squadIdx * 7717 + 3) * 8) % 8));

// One soldier's tone: his people's `tone`, give or take SKIN_SPREAD / 2, inside the palette.
export const soldierSkinTone = (tone, squadIdx, i) => Math.max(0, Math.min(SKIN_TONES.length - 1, tone + (hash01(squadIdx * 211 + i * 17 + 5) - 0.5) * SKIN_SPREAD));

// Fill `out` (a Float32Array / attribute array) at instance k with soldier i of squad s, whose
// people's skin tone is `tone` (skinToneFor).
export const writeSoldierVariant = (arr, k, squadIdx, side, i, tone = DEFAULT_SKIN_TONE) => {
  const o = k * 4;
  arr[o] = soldierSkinTone(tone, squadIdx, i);
  arr[o + 1] = emblemCellFor(side, squadIdx);
  arr[o + 2] = hash01(squadIdx * 389 + i * 31 + 11) * 2 - 1;
  arr[o + 3] = 0;
};

// Colours are converted to the renderer's (linear) working space by Color.set.
export const SKIN_UNIFORM = { value: SKIN_TONES.map((h) => new Color(h)) };

// ---- the heraldry atlas ---------------------------------------------------------------------

const CHARGE_COLORS = ['#f4efe0', '#e8c35a', '#1d1b18', '#f4efe0'];
const DESIGNS = [
  (g, s) => { g.fillRect(s * 0.4, 0, s * 0.2, s); g.fillRect(0, s * 0.4, s, s * 0.2); },                    // cross
  (g, s) => { g.lineWidth = s * 0.18; g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.moveTo(s, 0); g.lineTo(0, s); g.stroke(); }, // saltire
  (g, s) => { g.beginPath(); g.moveTo(0, s * 0.8); g.lineTo(s / 2, s * 0.3); g.lineTo(s, s * 0.8); g.lineTo(s, s); g.lineTo(s / 2, s * 0.52); g.lineTo(0, s); g.fill(); }, // chevron
  (g, s) => { g.fillRect(s * 0.34, 0, s * 0.32, s); },                                                     // pale
  (g, s) => { g.fillRect(0, s * 0.36, s, s * 0.28); },                                                     // fess
  (g, s) => { g.lineWidth = s * 0.24; g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.stroke(); },        // bend
  (g, s) => { g.fillRect(0, 0, s / 2, s / 2); g.fillRect(s / 2, s / 2, s / 2, s / 2); },                   // quarterly
  (g, s) => { g.fillRect(0, 0, s, s * 0.3); },                                                             // chief
  (g, s) => { star(g, s / 2, s / 2, s * 0.42, s * 0.17, 5); },                                             // mullet (star)
  (g, s) => { g.beginPath(); g.arc(s / 2, s / 2, s * 0.2, 0, Math.PI * 2); g.fill(); star(g, s / 2, s / 2, s * 0.46, s * 0.24, 12); }, // sun
  (g, s) => { g.beginPath(); g.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(s * 0.62, s * 0.42, s * 0.3, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; }, // crescent
  (g, s) => { g.beginPath(); g.moveTo(s / 2, s * 0.08); g.lineTo(s * 0.86, s / 2); g.lineTo(s / 2, s * 0.92); g.lineTo(s * 0.14, s / 2); g.fill(); }, // lozenge
  (g, s) => { g.fillRect(0, 0, s / 2, s); },                                                               // per pale
  (g, s) => { g.lineWidth = s * 0.12; g.strokeRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88); },             // bordure
  (g, s) => { g.beginPath(); g.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2); g.fill(); },                    // roundel
  (g, s) => { g.beginPath(); g.moveTo(s / 2, s * 0.15); g.lineTo(s * 0.95, s * 0.45); g.lineTo(s * 0.62, s * 0.5); g.lineTo(s / 2, s * 0.9); g.lineTo(s * 0.38, s * 0.5); g.lineTo(s * 0.05, s * 0.45); g.fill(); } // eagle (displayed)
];
function star(g, cx, cy, r1, r2, n) {
  g.beginPath();
  for (let k = 0; k < n * 2; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / n; const r = k % 2 ? r2 : r1;
    g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath(); g.fill();
}

let atlas = null;
// The shared emblem atlas: charges drawn opaque on a transparent field, so the shader shows the
// side's colour through (mix by alpha). In Node (tests) there's no canvas: a 1×1 clear texture.
export const getEmblemAtlas = () => {
  if (atlas) return atlas;
  const doc = typeof document !== 'undefined' ? document : null;
  const canvas = doc?.createElement?.('canvas');
  const g = canvas?.getContext?.('2d');
  if (!g) {
    atlas = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat);
    atlas.needsUpdate = true;
    return atlas;
  }
  const CELL = 64;
  canvas.width = CELL * EMBLEM_GRID; canvas.height = CELL * EMBLEM_GRID;
  DESIGNS.forEach((draw, cell) => {
    const col = cell % EMBLEM_GRID; const row = Math.floor(cell / EMBLEM_GRID);
    g.save();
    // flipY: atlas row 0 (v = 0..0.25) is the canvas's BOTTOM row.
    g.translate(col * CELL, (EMBLEM_GRID - 1 - row) * CELL);
    g.beginPath(); g.rect(0, 0, CELL, CELL); g.clip();
    const color = CHARGE_COLORS[(cell + row) % CHARGE_COLORS.length];
    g.fillStyle = color; g.strokeStyle = color;
    draw(g, CELL);
    g.restore();
  });
  atlas = new CanvasTexture(canvas);
  atlas.colorSpace = SRGBColorSpace;
  atlas.minFilter = LinearMipmapLinearFilter; atlas.magFilter = LinearFilter;
  return atlas;
};
export const disposeEmblemAtlas = () => { atlas?.dispose(); atlas = null; };
