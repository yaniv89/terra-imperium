// src/utils/exactMath.js
// Trigonometry that gives the same last bit on every JavaScript engine (plans/math-ideas.md, 10.3).
// IEEE 754 makes + - * / and Math.sqrt exactly rounded, so they agree everywhere; Math.sin,
// Math.cos, Math.acos, Math.asin, Math.exp, Math.log and Math.pow with a fractional power do not
// (V8 and JavaScriptCore differ in the last bit now and then). The engine's grid distances and
// the tile centres feed comparisons that decide outcomes (which city is nearest, a culture flip, a
// path), so they are built here from the exact operations only: short Taylor series on a reduced
// argument, accurate to about 1e-15.

const DEG = Math.PI / 180;

// sin and cos of x in radians for |x| <= pi/4, in nested (Horner) form: sin to x^17, cos to x^18.
// The first omitted term is below 1e-19 there.
const sinSmall = (x) => {
  const x2 = x * x;
  return x * (1 - (x2 / 6) * (1 - (x2 / 20) * (1 - (x2 / 42) * (1 - (x2 / 72) * (1 - (x2 / 110) * (1 - (x2 / 156) * (1 - (x2 / 210) * (1 - x2 / 272))))))));
};
const cosSmall = (x) => {
  const x2 = x * x;
  return 1 - (x2 / 2) * (1 - (x2 / 12) * (1 - (x2 / 30) * (1 - (x2 / 56) * (1 - (x2 / 90) * (1 - (x2 / 132) * (1 - (x2 / 182) * (1 - (x2 / 240) * (1 - x2 / 306))))))));
};

/** [sin, cos] of an angle in degrees, the same on every engine. Degrees reduce exactly to a
 * quarter turn, so there is no loss from reducing a multiple of pi. */
export const sinCosDeg = (deg) => {
  const d = deg - 360 * Math.floor(deg / 360);   // [0, 360)
  const q = Math.round(d / 90);                   // the nearest quarter turn, 0..4
  const x = (d - 90 * q) * DEG;                   // |x| <= pi/4
  const s = sinSmall(x); const c = cosSmall(x);
  switch (q & 3) {
    case 0: return [s, c];
    case 1: return [c, -s];
    case 2: return [-s, -c];
    default: return [-c, s];
  }
};

// asin for 0 <= x <= 1/2 by its series. Each term is at most x^2 <= 1/4 of the one before, so
// stopping once a term no longer moves the sum loses under 1e-16; neighbouring tiles (x near
// 0.008) need three terms, the far side of the world 28.
const asinSmall = (x) => {
  const x2 = x * x;
  let term = x; let sum = x;
  for (let n = 1; n < 30; n++) {
    term *= (x2 * (2 * n - 1) * (2 * n - 1)) / ((2 * n) * (2 * n + 1));
    const next = sum + term;
    if (next === sum) break;
    sum = next;
  }
  return sum;
};

/** asin(x) in radians, the same on every engine. Above 1/2 it uses
 * asin(x) = pi/2 - 2 asin(sqrt((1 - x) / 2)), which keeps the series argument small. */
export const asinExact = (x) => {
  const a = Math.min(1, Math.abs(x));
  const r = a <= 0.5 ? asinSmall(a) : Math.PI / 2 - 2 * asinSmall(Math.sqrt((1 - a) / 2));
  return x < 0 ? -r : r;
};

// Natural log of x > 0: x = m 2^e with m in [sqrt(1/2), sqrt(2)) (exact halvings and doublings),
// then ln m = 2 atanh(s) with s = (m - 1) / (m + 1), |s| < 0.172, by its series.
const LN2 = 0.6931471805599453;
export const logExact = (x) => {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  if (x === Infinity) return Infinity;
  let m = x; let e = 0;
  while (m >= 1.4142135623730951) { m /= 2; e += 1; }
  while (m < 0.7071067811865476) { m *= 2; e -= 1; }
  const s = (m - 1) / (m + 1); const s2 = s * s;
  let term = s; let sum = s;
  for (let n = 3; n < 60; n += 2) {
    term *= s2;
    const next = sum + term / n;
    if (next === sum) break;
    sum = next;
  }
  return 2 * sum + e * LN2;
};

/** e^x: x = k ln2 + r with |r| <= ln2 / 2, e^r by its series, times 2^k by exact doublings. */
export const expExact = (x) => {
  if (x !== x) return NaN;
  if (x > 709.78) return Infinity;
  if (x < -745.2) return 0;
  const k = Math.round(x / LN2);
  const r = x - k * LN2;
  let term = 1; let sum = 1;
  for (let n = 1; n < 30; n++) {
    term *= r / n;
    const next = sum + term;
    if (next === sum) break;
    sum = next;
  }
  let p = sum;
  if (k > 0) for (let i = 0; i < k; i++) p *= 2;
  else for (let i = 0; i < -k; i++) p /= 2;
  return p;
};

/** x^y for x >= 0, the same on every engine (about 1e-15 relative, not correctly rounded, so a
 * value fed to Math.round may still differ from Math.pow at an exact half: compare with care). */
export const powExact = (x, y) => {
  if (y === 0) return 1;
  if (x === 0) return y > 0 ? 0 : Infinity;
  if (Number.isInteger(y) && Math.abs(y) <= 64) {
    // Square-and-multiply: exact operations only.
    let base = y < 0 ? 1 / x : x; let n = Math.abs(y); let out = 1;
    while (n > 0) { if (n & 1) out *= base; base *= base; n >>= 1; }
    return out;
  }
  return expExact(y * logExact(x));
};

const LN10 = 2.302585092994046;
/** log10(x), the same on every engine; exact at powers of ten. */
export const log10Exact = (x) => {
  if (x > 0 && x <= 1e22) {
    // An exact power of ten gives an exact integer (Math.log10's own promise players' numbers lean on).
    let p = 1; let k = 0;
    while (p < x) { p *= 10; k += 1; }
    if (p === x) return k;
  }
  return logExact(x) / LN10;
};
