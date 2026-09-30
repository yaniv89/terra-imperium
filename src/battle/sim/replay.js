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
import { BATTLE_LIMIT_TICKS } from './constants';

export const MAX_LOG_ORDERS = 20000;
const MAX_SQUADS_PER_ORDER = 64;
const ORDER_TYPES = new Set(['move', 'attackMove', 'formationLine', 'attack', 'stop', 'hold', 'retreat', 'retreatAll', 'callReserve', 'ability', 'power']);
const int = (v) => (Number.isFinite(v) ? Math.trunc(v) : 0);
// Coordinates stay exactly as recorded (the live battle used them as-is); only non-numbers go.
const num = (v) => (Number.isFinite(v) ? v : 0);

const cleanOrder = (o, playerSide) => {
  if (!o || typeof o !== 'object' || !ORDER_TYPES.has(o.type)) return null;
  if (!Number.isInteger(o.tick) || o.tick < 0 || o.tick > BATTLE_LIMIT_TICKS + 20) return null;
  const out = { type: o.type, side: playerSide, tick: o.tick, seq: int(o.seq) };
  if (Array.isArray(o.squads)) out.squads = o.squads.filter((i) => Number.isInteger(i) && i >= 0).slice(0, MAX_SQUADS_PER_ORDER);
  ['x', 'y', 'x2', 'y2'].forEach((k) => { if (k in o) out[k] = num(o[k]); });
  if (typeof o.formation === 'string') out.formation = o.formation.slice(0, 16);
  if (typeof o.ability === 'string') out.ability = o.ability.slice(0, 32);
  if (typeof o.power === 'string') out.power = o.power.slice(0, 32);
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
  const { result, hash, world } = runHeadless(setup, { orders: sanitizeOrderLog(log, playerSide) });
  return { result, hash, tick: world.tick };
};
