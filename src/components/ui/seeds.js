// src/components/ui/seeds.js
// Fresh seeds for a new game and a new map, drawn in the UI (crypto.getRandomValues), never in the
// engine, which stays pure and reads them from the scenario.

/** A fresh 32-bit seed (never 0). */
export const newWorldSeed = () => {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0] || 1;
  } catch {
    return (Date.now() >>> 0) || 1;
  }
};
