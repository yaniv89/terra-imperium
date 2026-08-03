// src/utils/rng.js
// Deterministic PRNG (mulberry32) so turn resolution is reproducible from a seed.
// Game logic must never call Math.random() directly — thread a createRng() instance instead.

export const createRng = (seed) => {
  let s = (seed >>> 0) || 1;
  return {
    next() {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    // Exposes the internal state so callers can persist it back onto game state.
    getSeed() {
      return s >>> 0;
    }
  };
};

export const randomSeed = () => (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
