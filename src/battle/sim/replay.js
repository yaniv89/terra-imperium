// src/battle/sim/replay.js
// Server-authoritative battle verification (Tactical Battles plan §12.4). A commanded battle is
// fully defined by (setup, command log): the sim is deterministic, so replaying the log over the
// same setup reproduces the battle tick for tick. The reducer (and so the Supabase edge function,
// which runs the same reducer) replays the player's log and uses ITS result. The result the client
// reports is only a preview, which makes faking one pointless.
//
// The log comes from the client, so it's cleaned first, through the SAME schema the live battle
// admitted each order with (orderSchema.js admitOrder): every order is forced onto the player's own
// side (a client can't command the AI's troops); only known order types with their own valid
// fields and integer ticks inside the battle survive; and the log length is capped. An honest log
// passes untouched. `auditOrderLog` says how many entries did not, so a replay of a log that was
// cut is never called a clean verification.
import { runHeadless } from './headless';
import { step } from './step';
import { worldHash } from './hash';
import { MAX_BATTLE_TICKS } from './constants';
import { admitOrder, MAX_LOG_ORDERS, MAX_SQUADS_PER_ORDER } from './orderSchema';
import { isDeployment } from './orders';

export { MAX_LOG_ORDERS, MAX_SQUADS_PER_ORDER };
const int = (v) => (Number.isFinite(v) ? Math.trunc(v) : 0);

const cleanOrder = (o, playerSide) => {
  const admitted = admitOrder(o, playerSide);
  if (!admitted) return null;
  if (!Number.isInteger(o.tick) || o.tick < 0 || o.tick > MAX_BATTLE_TICKS + 20) return null;
  return { ...admitted, tick: o.tick, seq: int(o.seq) };
};

/**
 * The log as the replay runs it, with what was left out: `dropped` entries the schema or the tick
 * check refused, `truncated` when the log was longer than MAX_LOG_ORDERS. A log recorded by the
 * live battle loop has neither.
 */
export const auditOrderLog = (log, playerSide) => {
  if (!Array.isArray(log)) return { orders: [], dropped: 0, truncated: false };
  const cleaned = log.slice(0, MAX_LOG_ORDERS).map((o) => cleanOrder(o, playerSide));
  const orders = cleaned.filter(Boolean)
    // Stable: equal ticks keep their recorded order, which is the order they were applied live.
    .map((o, i) => ({ o, i }))
    .sort((a, b) => a.o.tick - b.o.tick || a.i - b.i)
    .map(({ o }) => o);
  return { orders, dropped: cleaned.length - orders.length, truncated: log.length > MAX_LOG_ORDERS };
};

export const sanitizeOrderLog = (log, playerSide) => auditOrderLog(log, playerSide).orders;

export const playerSideOf = (setup) => Math.max(0, (setup?.controllers || []).indexOf('player'));

// Replays a recorded battle and returns its authoritative result and final world hash, plus what
// the log's cleaning left out (0 and false for an honest log).
export const replayBattle = (setup, log) => {
  const { orders, dropped, truncated } = auditOrderLog(log, playerSideOf(setup));
  const { result, hash, chain, world } = runHeadless(setup, { orders });
  return { result, hash, chain, tick: world.tick, orders: orders.length, dropped, truncated };
};

// Verify only the last segment of a long battle (plans/rts-world-review.md section 3): continue a
// TRUSTED snapshot of the world (a structuredClone taken at a checkpoint, carrying its hash chain)
// with the logged orders from its tick on, up to `untilTick` or the end. The returned chain must
// equal the one the client reported for the same tick. The snapshot is not modified. (The
// deployment is already in the snapshot: its orders are not run again.)
export const replaySegment = (snapshot, log, untilTick = Infinity) => {
  const w = structuredClone(snapshot);
  const byTick = new Map();
  sanitizeOrderLog(log, playerSideOf(w.setup)).forEach((o) => { if (o.tick >= w.tick && !isDeployment(o)) { const l = byTick.get(o.tick) || []; l.push(o); byTick.set(o.tick, l); } });
  while (!w.ended && w.tick < untilTick) { step(w, byTick.get(w.tick) || []); w.events.length = 0; }
  return { world: w, chain: w.hashChain, hash: worldHash(w), tick: w.tick };
};
