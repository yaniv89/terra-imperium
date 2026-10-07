// src/worldgen/v1/noise.js
// Integer noise on the unit sphere for the world generator (plans/MAP-VARIATIONS-PLAN.md 4.2 and
// 4.4). Everything here is integer arithmetic: positions are unit vectors scaled by ONE (2^16),
// lattice gradients come from a permutation table built by an integer hash of the salt, the
// quintic fade is a fixed-point table and the interpolation divides exactly by powers of two.
// Every intermediate stays far below 2^53, so the doubles JavaScript uses hold them exactly and
// the same seed gives the same numbers on V8 and JavaScriptCore alike.
// Frozen with generator version 1: any change here is a new generator version.

export const ONE = 65536; // 1.0 in 16.16 fixed point
const ONE_INV = 1 / ONE; // exact: a power of two
const PERIOD = 1024; // lattice period of a permutation table
const MASK = PERIOD - 1;

/** A 32-bit hash of one integer and a salt (unsigned), for per-cell and per-plate rolls. */
export const hash1 = (x, s) => {
  let h = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
};

/** The hash as a number in [0, 1). */
export const hashUnit = (x, s) => hash1(x, s) / 4294967296;

// The quintic fade 6t^5 - 15t^4 + 10t^3 for t in [0, ONE), in fixed point, as a table.
const FADE = new Int32Array(ONE);
for (let t = 0; t < ONE; t++) {
  const t2 = Math.floor((t * t) * ONE_INV);
  const t3 = Math.floor((t2 * t) * ONE_INV);
  const inner = Math.floor((t * (6 * t - 15 * ONE)) * ONE_INV) + 10 * ONE;
  FADE[t] = Math.floor((t3 * inner) * ONE_INV);
}

// Perlin's sixteen gradients (the twelve cube edges, four repeated).
const GX = new Int8Array([1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, 1, 0, -1, 0]);
const GY = new Int8Array([1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, -1, 1, -1]);
const GZ = new Int8Array([0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1, 0, 1, 0, -1]);

const tables = new Map();
/** The permutation table of a salt (a Fisher-Yates shuffle driven by hash1, cached). */
const permOf = (salt) => {
  const key = salt >>> 0;
  let p = tables.get(key);
  if (p) return p;
  p = new Int32Array(PERIOD);
  for (let i = 0; i < PERIOD; i++) p[i] = i;
  for (let i = PERIOD - 1; i > 0; i--) {
    const j = hash1(i, key) % (i + 1);
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  if (tables.size > 256) tables.clear();
  tables.set(key, p);
  return p;
};

/**
 * Gradient noise at the integer point (x, y, z), in units where ONE is one lattice step, for the
 * permutation table P. Returns an integer in about [-ONE, ONE] (most values within ONE / 2).
 */
const noiseP = (P, x, y, z) => {
  const ix = Math.floor(x * ONE_INV); const iy = Math.floor(y * ONE_INV); const iz = Math.floor(z * ONE_INV);
  const fx = x - ix * ONE; const fy = y - iy * ONE; const fz = z - iz * ONE;
  const gx = fx - ONE; const gy = fy - ONE; const gz = fz - ONE;
  const u = FADE[fx]; const v = FADE[fy]; const w = FADE[fz];
  const a = P[ix & MASK]; const b = P[(ix + 1) & MASK];
  const aa = P[(a + iy) & MASK]; const ab = P[(a + iy + 1) & MASK];
  const ba = P[(b + iy) & MASK]; const bb = P[(b + iy + 1) & MASK];
  let h;
  h = P[(aa + iz) & MASK] & 15; const n000 = GX[h] * fx + GY[h] * fy + GZ[h] * fz;
  h = P[(ba + iz) & MASK] & 15; const n100 = GX[h] * gx + GY[h] * fy + GZ[h] * fz;
  h = P[(ab + iz) & MASK] & 15; const n010 = GX[h] * fx + GY[h] * gy + GZ[h] * fz;
  h = P[(bb + iz) & MASK] & 15; const n110 = GX[h] * gx + GY[h] * gy + GZ[h] * fz;
  h = P[(aa + iz + 1) & MASK] & 15; const n001 = GX[h] * fx + GY[h] * fy + GZ[h] * gz;
  h = P[(ba + iz + 1) & MASK] & 15; const n101 = GX[h] * gx + GY[h] * fy + GZ[h] * gz;
  h = P[(ab + iz + 1) & MASK] & 15; const n011 = GX[h] * fx + GY[h] * gy + GZ[h] * gz;
  h = P[(bb + iz + 1) & MASK] & 15; const n111 = GX[h] * gx + GY[h] * gy + GZ[h] * gz;
  const x00 = n000 + Math.floor(((n100 - n000) * u) * ONE_INV);
  const x10 = n010 + Math.floor(((n110 - n010) * u) * ONE_INV);
  const x01 = n001 + Math.floor(((n101 - n001) * u) * ONE_INV);
  const x11 = n011 + Math.floor(((n111 - n011) * u) * ONE_INV);
  const y0 = x00 + Math.floor(((x10 - x00) * v) * ONE_INV);
  const y1 = x01 + Math.floor(((x11 - x01) * v) * ONE_INV);
  return y0 + Math.floor(((y1 - y0) * w) * ONE_INV);
};

/** Gradient noise at an integer point for a salt. */
export const gnoise = (x, y, z, salt) => noiseP(permOf(salt), x, y, z);

/**
 * A fractal noise field: `octaves` octaves, the first at `freq` (an integer) lattice steps per unit
 * radius, each next one twice as fine and half as strong (integer halving), each with its own
 * table. `sample(px, py, pz)` takes an integer point with |p| = ONE and returns an integer in about
 * [-ONE, ONE]. `ridged`: 1 - |noise| per octave, squared and weighted by the octave before (sharp
 * crests), in [0, ONE].
 */
export const makeField = (salt, freq, octaves, { ridged = false } = {}) => {
  const perms = []; const offs = []; const freqs = []; const amps = [];
  let amp = ONE; let norm = 0; let f = freq;
  for (let o = 0; o < octaves; o++) {
    perms.push(permOf(hash1(o, salt)));
    offs.push((hash1(o, salt ^ 0x5bd1e995) % 4096) * ONE);
    freqs.push(f); amps.push(amp); norm += amp;
    amp = Math.floor(amp / 2); f *= 2;
  }
  if (!ridged) {
    return (px, py, pz) => {
      let sum = 0;
      for (let o = 0; o < octaves; o++) {
        const f2 = freqs[o]; const off = offs[o];
        sum += Math.floor((noiseP(perms[o], px * f2 + off, py * f2 - off, pz * f2 + off) * amps[o]) * ONE_INV);
      }
      return Math.floor((sum * ONE) / norm);
    };
  }
  return (px, py, pz) => {
    let sum = 0; let weight = ONE;
    for (let o = 0; o < octaves; o++) {
      const f2 = freqs[o]; const off = offs[o];
      let r = ONE - Math.abs(noiseP(perms[o], px * f2 + off, py * f2 + off, pz * f2 - off) * 2);
      if (r < 0) r = 0;
      r = Math.floor((r * r) * ONE_INV);
      r = Math.floor((r * weight) * ONE_INV);
      weight = Math.min(ONE, r * 2);
      sum += Math.floor((r * amps[o]) * ONE_INV);
    }
    return Math.floor((sum * ONE) / norm);
  };
};
