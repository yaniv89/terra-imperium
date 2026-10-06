// src/battle/sim/hash.js
// A 32-bit FNV-1a checksum of everything that matters in a world. Two worlds with the same hash at
// the same tick are (for all practical purposes) identical — used by the determinism tests, the
// dev desync detector and, later, server-side replay verification.
import { foldEconomy } from './economy';

const mix = (h, v) => Math.imul(h ^ (v | 0), 16777619) >>> 0;

export const worldHash = (w) => {
  let h = mix(2166136261, w.tick);
  h = mix(h, w.rngState);
  h = mix(h, w.supply[0]); h = mix(h, w.supply[1]); h = mix(h, w.assimilation); h = mix(h, w.beachhead || 0);
  w.squads.forEach((q) => {
    h = mix(h, q.x); h = mix(h, q.y); h = mix(h, q.facing); h = mix(h, q.strength); h = mix(h, q.morale);
    h = mix(h, (q.alive ? 1 : 0) | (q.onField ? 2 : 0) | (q.fled ? 4 : 0) | (q.routed ? 8 : 0) | (q.retreating ? 16 : 0));
    h = mix(h, q.target); h = mix(h, q.cooldown); h = mix(h, q.enterTick); h = mix(h, (q.inside ?? -1) + 1);
  });
  w.structures.forEach((s) => { h = mix(h, s.hp); h = mix(h, s.cooldown || 0); });
  w.points.forEach((p) => { h = mix(h, p.owner); h = mix(h, p.progress); });
  // The battle economy (economy.js): only a world that has one, so other battles hash as before.
  if (w.eco) h = foldEconomy(h, w, mix);
  return h;
};

// Hash chain (plans/rts-world-review.md section 3, plans/MASTER-PLAN.md phase C): every
// HASH_CHAIN_EVERY ticks step() folds the world hash into a running value,
//   chain(t) = mix(mix(chain(t - N), t), worldHash at t),
// so one 32-bit number vouches for the whole battle so far. Two devices (or a live battle and its
// replay) that agree on the chain at a tick agree on every checkpoint before it; the first
// checkpoint where two chains part is where they desynced. A long battle can then be verified by
// replaying only its last segment from a trusted snapshot (replaySegment in replay.js) instead of
// from tick zero. The chain lives on the world (w.hashChain) so snapshots carry it.
export const HASH_CHAIN_EVERY = 20; // once a second of battle
export const HASH_CHAIN_SEED = 0x9e3779b9;
export const chainHash = (prev, tick, hash) => mix(mix(prev, tick), hash);

export const advanceHashChain = (w) => {
  if (w.tick % HASH_CHAIN_EVERY !== 0) return;
  w.hashChain = chainHash(w.hashChain ?? HASH_CHAIN_SEED, w.tick, worldHash(w));
};
