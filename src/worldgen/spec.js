// src/worldgen/spec.js
// The world descriptor (plans/MAP-VARIATIONS-PLAN.md 3.2): which world a game is played on.
//
//   { kind: 'earth' }                                         the real Earth (also when absent)
//   { kind: 'generated', generatorVersion, seed, params, worldHash }
//
// `params` (all small integers or ids, all saved): land (20 to 45, % of cells), continents (0 = auto,
// 1 to 7), climate ('cold' | 'temperate' | 'hot'), rainfall ('dry' | 'normal' | 'wet').
// The save holds only this descriptor (state.scenario.map), never the columns: a generated world
// is rebuilt from it (or read from the IndexedDB cache) and checked against `worldHash`.
// A map code such as `G1-30-4T-N-7KX2QF` carries the whole spec (section 7.3).

export const GENERATOR_VERSION = 1;
export const EARTH_SPEC = Object.freeze({ kind: 'earth' });

export const LAND_RANGE = [20, 45];
export const CONTINENT_RANGE = [0, 7];
export const CLIMATES = ['cold', 'temperate', 'hot'];
export const RAINFALLS = ['dry', 'normal', 'wet'];
export const DEFAULT_PARAMS = Object.freeze({ land: 30, continents: 0, climate: 'temperate', rainfall: 'normal' });

const clampInt = (v, [lo, hi], dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};

/** The params with every field present, clamped and canonical. */
export const normalizeParams = (params = {}) => ({
  land: clampInt(params.land, LAND_RANGE, DEFAULT_PARAMS.land),
  continents: clampInt(params.continents, CONTINENT_RANGE, DEFAULT_PARAMS.continents),
  climate: CLIMATES.includes(params.climate) ? params.climate : DEFAULT_PARAMS.climate,
  rainfall: RAINFALLS.includes(params.rainfall) ? params.rainfall : DEFAULT_PARAMS.rainfall
});

/** A spec in canonical form: earth, or a generated world with every field set. */
export const normalizeSpec = (spec) => {
  if (!spec || spec.kind !== 'generated') return EARTH_SPEC;
  return {
    kind: 'generated',
    generatorVersion: spec.generatorVersion || GENERATOR_VERSION,
    seed: (Number(spec.seed) >>> 0),
    params: normalizeParams(spec.params),
    ...(spec.worldHash ? { worldHash: spec.worldHash } : {})
  };
};

export const isGeneratedSpec = (spec) => spec?.kind === 'generated';

/** The key a world is cached and compared under (no hash: the hash is the result). */
export const specKey = (spec) => {
  const s = normalizeSpec(spec);
  if (s.kind !== 'generated') return 'earth';
  const p = s.params;
  return `gen${s.generatorVersion}:${s.seed}:${p.land}:${p.continents}:${p.climate}:${p.rainfall}`;
};

export const sameWorld = (a, b) => specKey(a) === specKey(b);


// ---- map codes ------------------------------------------------------------------------------------
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base 32
const toB32 = (n) => { let s = ''; let x = n >>> 0; do { s = B32[x % 32] + s; x = Math.floor(x / 32); } while (x > 0); return s; };
const fromB32 = (s) => { let x = 0; for (const ch of s.toUpperCase()) { const d = B32.indexOf(ch); if (d < 0) return null; x = x * 32 + d; } return x >>> 0; };

/** `G1-30-4T-N-7KX2QF`: version, land %, continents (A = auto) and climate letter, rainfall letter, seed. */
export const mapCode = (spec) => {
  const s = normalizeSpec(spec);
  if (s.kind !== 'generated') return 'EARTH';
  const p = s.params;
  return `G${s.generatorVersion}-${p.land}-${p.continents || 'A'}${p.climate[0].toUpperCase()}-${p.rainfall[0].toUpperCase()}-${toB32(s.seed)}`;
};

/** The spec of a map code, or null when it does not read as one. */
export const parseMapCode = (code) => {
  const m = /^G(\d+)-(\d+)-([0-7A])([CTH])-([DNW])-([0-9A-Z]+)$/i.exec(String(code || '').trim());
  if (!m) return null;
  const seed = fromB32(m[6]);
  if (seed == null) return null;
  const climate = { C: 'cold', T: 'temperate', H: 'hot' }[m[4].toUpperCase()];
  const rainfall = { D: 'dry', N: 'normal', W: 'wet' }[m[5].toUpperCase()];
  return normalizeSpec({ kind: 'generated', generatorVersion: Number(m[1]), seed, params: { land: Number(m[2]), continents: m[3].toUpperCase() === 'A' ? 0 : Number(m[3]), climate, rainfall } });
};

// ---- the world hash ---------------------------------------------------------------------------------
// FNV-1a (32 bit) over the bytes of the columns the rules read, in a fixed order.
export const HASHED_COLUMNS = ['land', 'coastal', 'elevation', 'roughness', 'climate', 'terrain', 'relief', 'feature', 'rivers', 'resource', 'riverSize', 'range', 'ridge', 'pass'];
export const fnv1a = (bytes, h = 0x811c9dc5) => {
  let x = h >>> 0;
  for (let i = 0; i < bytes.length; i++) { x ^= bytes[i]; x = Math.imul(x, 0x01000193) >>> 0; }
  return x >>> 0;
};
export const worldHashOf = (raw) => {
  let h = 0x811c9dc5;
  HASHED_COLUMNS.forEach((name) => {
    const col = raw[name];
    if (!col) return;
    const arr = ArrayBuffer.isView(col) ? col : Int32Array.from(col);
    h = fnv1a(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), h);
  });
  return h.toString(16).padStart(8, '0');
};
