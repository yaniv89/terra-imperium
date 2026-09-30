// src/battle/sim/fixed.js
// Deterministic integer geometry for the sim: no Math.sin/cos/atan2/sqrt at runtime (Tactical
// Battles plan §12.2). Angles are 0..255 for a full turn (0 = +x/east, 64 = +y/south, screen
// convention). The two lookup tables are built once at load from integer inputs and rounded to
// integers, which is what makes them identical everywhere.
export const SIN = Int16Array.from({ length: 256 }, (_, i) => Math.round(Math.sin((i / 256) * 2 * Math.PI) * 4096));
export const COS = Int16Array.from({ length: 256 }, (_, i) => SIN[(i + 64) & 255]);
// ATAN[r] = angle (in 1/256 turns) of a slope r/256, r in 0..256 → 0..32.
const ATAN = Uint8Array.from({ length: 257 }, (_, r) => Math.round((Math.atan(r / 256) / (2 * Math.PI)) * 256));

// Integer square root (floor), exact for any non-negative safe integer.
export const isqrt = (n) => {
  if (n <= 0) return 0;
  let x = Math.floor(Math.sqrt(n)); // initial guess only; corrected below so the RESULT is exact
  while (x * x > n) x -= 1;
  while ((x + 1) * (x + 1) <= n) x += 1;
  return x;
};

export const dist = (x0, y0, x1, y1) => isqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
export const distSq = (x0, y0, x1, y1) => (x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0);

// Direction from (x0,y0) to (x1,y1) as 0..255, octant-reduced so only a 0..45° lookup is needed.
export const angleBetween = (x0, y0, x1, y1) => {
  const dx = x1 - x0; const dy = y1 - y0;
  if (dx === 0 && dy === 0) return 0;
  const ax = Math.abs(dx); const ay = Math.abs(dy);
  const a = ax >= ay ? ATAN[Math.floor((ay * 256) / ax)] : 64 - ATAN[Math.floor((ax * 256) / ay)];
  if (dx >= 0 && dy >= 0) return a & 255;
  if (dx < 0 && dy >= 0) return (128 - a) & 255;
  if (dx < 0 && dy < 0) return (128 + a) & 255;
  return (256 - a) & 255;
};

// Signed smallest difference a - b, in -128..127.
export const angleDiff = (a, b) => ((a - b + 384) & 255) - 128;

// Rotate `current` toward `target` by at most `maxStep`.
export const turnToward = (current, target, maxStep) => {
  const d = angleDiff(target, current);
  if (Math.abs(d) <= maxStep) return target & 255;
  return (current + (d > 0 ? maxStep : -maxStep)) & 255;
};

// Move a vector of length `len` along angle `a` (Q12 trig → integer result).
export const polarX = (a, len) => Math.trunc((COS[a & 255] * len) / 4096);
export const polarY = (a, len) => Math.trunc((SIN[a & 255] * len) / 4096);
