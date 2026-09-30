// src/battle/sim/hash.js
// A 32-bit FNV-1a checksum of everything that matters in a world. Two worlds with the same hash at
// the same tick are (for all practical purposes) identical — used by the determinism tests, the
// dev desync detector and, later, server-side replay verification.
const mix = (h, v) => Math.imul(h ^ (v | 0), 16777619) >>> 0;

export const worldHash = (w) => {
  let h = mix(2166136261, w.tick);
  h = mix(h, w.rngState);
  h = mix(h, w.supply[0]); h = mix(h, w.supply[1]); h = mix(h, w.assimilation);
  w.squads.forEach((q) => {
    h = mix(h, q.x); h = mix(h, q.y); h = mix(h, q.facing); h = mix(h, q.strength); h = mix(h, q.morale);
    h = mix(h, (q.alive ? 1 : 0) | (q.onField ? 2 : 0) | (q.fled ? 4 : 0) | (q.routed ? 8 : 0) | (q.retreating ? 16 : 0));
    h = mix(h, q.target); h = mix(h, q.cooldown); h = mix(h, q.enterTick);
  });
  w.structures.forEach((s) => { h = mix(h, s.hp); h = mix(h, s.cooldown || 0); });
  w.points.forEach((p) => { h = mix(h, p.owner); h = mix(h, p.progress); });
  return h;
};
