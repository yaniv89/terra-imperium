// src/battle/sim/rng.js
// The same mulberry32 generator as src/utils/rng.js, but with its state stored on the world
// (w.rngState) instead of a closure — so a world snapshot captures the RNG exactly and a replay
// from any checkpoint draws the very same numbers.
export const nextRandom = (w) => {
  let s = w.rngState | 0;
  s = (s + 0x6D2B79F5) | 0;
  w.rngState = s >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
