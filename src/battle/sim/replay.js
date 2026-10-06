// src/battle/sim/replay.js
// Server-authoritative battle verification (Tactical Battles plan §12.4). A commanded battle is
// fully defined by (setup, command log): the sim is deterministic, so replaying the log over the
// same setup reproduces the battle tick for tick. The reducer (and so the Supabase edge function,
// which runs the same reducer) replays the player's log and uses ITS result. The result the client
// reports is only a preview, which makes faking one pointless.
//
// The log comes from the client, so it's cleaned first. Every order is forced onto the player's
// own side (a client can't command the AI's troops); only known order types, integer ticks inside
// the battle and finite numbers survive; and the log length is capped.
import { runHeadless } from './headless';
import { step } from './step';
import { worldHash } from './hash';
import { MAX_BATTLE_TICKS } from './constants';

export const MAX_LOG_ORDERS = 20000;
// One order may move a whole army: the largest preset is 1,000 squads a side (MASTER-PLAN 6.2).
// (It was 64: a box-selected 300-squad order then replayed as a 64-squad one, a false desync.)
export const MAX_SQUADS_PER_ORDER = 1024;
const ORDER_TYPES = new Set(['move', 'attackMove', 'formationLine', 'attack', 'stop', 'hold', 'retreat', 'retreatAll', 'callReserve', 'ability', 'power', 'garrison']);
const int = (v) => (Number.isFinite(v) ? Math.trunc(v) : 0);
// Coordinates stay exactly as recorded (the live battle used them as-is); only non-numbers go.
const num = (v) => (Number.isFinite(v) ? v : 0);

const cleanOrder = (o, playerSide) => {
  if (!o || typeof o !== 'object' || !ORDER_TYPES.has(o.type)) return null;
  if (!Number.isInteger(o.tick) || o.tick < 0 || o.tick > MAX_BATTLE_TICKS + 20) return null;
  const out = { type: o.type, side: playerSide, tick: o.tick, seq: int(o.seq) };
  if (Array.isArray(o.squads)) out.squads = o.squads.filter((i) => Number.isInteger(i) && i >= 0).slice(0, MAX_SQUADS_PER_ORDER);
  ['x', 'y', 'x2', 'y2'].forEach((k) => { if (k in o) out[k] = num(o[k]); });
  if (typeof o.formation === 'string') out.formation = o.formation.slice(0, 16);
  if (typeof o.ability === 'string') out.ability = o.ability.slice(0, 32);
  if (typeof o.power === 'string') out.power = o.power.slice(0, 32);
  if (Number.isInteger(o.structure) && o.structure >= 0) out.structure = o.structure;
  if (o.target && typeof o.target === 'object' && (o.target.kind === 'squad' || o.target.kind === 'structure') && Number.isInteger(o.target.index) && o.target.index >= 0) {
    out.target = { kind: o.target.kind, index: o.target.index };
  }
  return out;
};

export const sanitizeOrderLog = (log, playerSide) => {
  if (!Array.isArray(log)) return [];
  return log.slice(0, MAX_LOG_ORDERS)
    .map((o) => cleanOrder(o, playerSide))
    .filter(Boolean)
    // Stable: equal ticks keep their recorded order, which is the order they were applied live.
    .map((o, i) => ({ o, i }))
    .sort((a, b) => a.o.tick - b.o.tick || a.i - b.i)
    .map(({ o }) => o);
};

// Replays a recorded battle and returns its authoritative result and final world hash.
export const replayBattle = (setup, log) => {
  const playerSide = Math.max(0, (setup.controllers || []).indexOf('player'));
  const { result, hash, chain, world } = runHeadless(setup, { orders: sanitizeOrderLog(log, playerSide) });
  return { result, hash, chain, tick: world.tick };
};

// Verify only the last segment of a long battle (plans/rts-world-review.md section 3): continue a
// TRUSTED snapshot of the world (a structuredClone taken at a checkpoint, carrying its hash chain)
// with the logged orders from its tick on, up to `untilTick` or the end. The returned chain must
// equal the one the client reported for the same tick. The snapshot is not modified.
export const replaySegment = (snapshot, log, untilTick = Infinity) => {
  const w = structuredClone(snapshot);
  const playerSide = Math.max(0, (w.setup.controllers || []).indexOf('player'));
  const byTick = new Map();
  sanitizeOrderLog(log, playerSide).forEach((o) => { if (o.tick >= w.tick) { const l = byTick.get(o.tick) || []; l.push(o); byTick.set(o.tick, l); } });
  while (!w.ended && w.tick < untilTick) { step(w, byTick.get(w.tick) || []); w.events.length = 0; }
  return { world: w, chain: w.hashChain, hash: worldHash(w), tick: w.tick };
};
