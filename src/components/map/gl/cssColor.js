// src/components/map/gl/cssColor.js
// CSS colour strings (the map's own: #rgb, #rrggbb, rgb(), rgba(), hsl() with spaces or commas)
// as [r, g, b, a], channels 0 to 1, for the WebGL map's data textures and vertex colours. Pure.
const cache = new Map();

const hslToRgb = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
};

const parse = (css) => {
  const s = String(css || '').trim().toLowerCase();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const full = hex.length === 3 || hex.length === 4 ? hex.split('').map((c) => c + c).join('') : hex;
    const v = (i) => parseInt(full.slice(i, i + 2), 16) / 255;
    return [v(0), v(2), v(4), full.length >= 8 ? v(6) : 1];
  }
  const m = s.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (!m) return [0, 0, 0, 0];
  const parts = m[2].split(/[\s,/]+/).filter(Boolean);
  const num = (p, scale) => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p) / scale);
  const alpha = parts[3] != null ? num(parts[3], 1) : 1;
  if (m[1].startsWith('rgb')) return [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), alpha];
  const [r, g, b] = hslToRgb(parseFloat(parts[0]) || 0, num(parts[1], 100), num(parts[2], 100));
  return [r, g, b, alpha];
};

/** [r, g, b, a] in 0..1 for a CSS colour string; transparent black for anything unknown. */
export const cssColor = (css) => {
  let v = cache.get(css);
  if (!v) { v = parse(css).map((c) => (Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0)); cache.set(css, v); }
  return v;
};
