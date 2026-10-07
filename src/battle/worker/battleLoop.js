// src/battle/worker/battleLoop.js
// Real-time driver around the pure sim (Tactical Battles plan §12.1), shared by the Web Worker and
// the main-thread fallback. It turns wall-clock time into fixed 20 Hz ticks (with speed and
// pause), stamps the player's orders with the tick they take effect on, records them into a log
// (setup + log = the whole battle), and posts packed render frames (packedView.js: the squads in
// one transferable buffer, `post(message, transfer)`), checkpoints and the result.
import { createWorld } from '../sim/world';
import { step } from '../sim/step';
import { applyOrder } from '../sim/orders';
import { toStrategicResult } from '../sim/result';
import { worldHash } from '../sim/hash';
import { TICK_HZ } from '../sim/constants';
import { createViewPacker, SLOW_EVERY } from '../render/packedView';

const TICK_MS = 1000 / TICK_HZ;
const CHECKPOINT_EVERY = 10 * TICK_HZ;

// Re-simulate a recorded log headlessly up to `untilTick` (resume after the app was closed).
export const replayTo = (world, log, untilTick) => {
  const byTick = new Map();
  log.forEach((o) => { const l = byTick.get(o.tick) || []; l.push(o); byTick.set(o.tick, l); });
  while (!world.ended && world.tick < untilTick) { step(world, byTick.get(world.tick) || []); world.events.length = 0; }
  return world;
};

export const createBattleLoop = ({ setup, resume = null, post }) => {
  let world = createWorld(setup);
  let log = resume?.log ? [...resume.log] : [];
  if (resume?.log) {
    replayTo(world, log, resume.tick ?? Infinity);
    // The replay must land on the checkpoint's own hash. Anything else is a checkpoint of another
    // battle (battle ids repeat between games) or of other rules: start this battle fresh instead
    // of playing on from a world that never happened. The UI goes back to deployment.
    if (resume.hash != null && worldHash(world) !== resume.hash) {
      world = createWorld(setup);
      log = [];
      post({ type: 'resumeRejected', tick: resume.tick ?? null });
    }
  }
  let pending = [];
  let seq = log.length;
  let paused = false;
  let speed = 1;
  let acc = 0;
  let last = null;
  let finished = false;
  // Everything the UI is shown is seen from the player's side (fog of war); spectating = side 0.
  const playerSide = Math.max(0, (setup.controllers || []).indexOf('player'));
  let lastFogTick = -100; // the fog grid rides along only when it can have changed (every 5 ticks)
  let lastPostedTick = -1;
  let lastSlowTick = -100; // names, abilities, call costs: every SLOW_EVERY ticks
  const packer = createViewPacker();
  // Wall-clock ms of the last 100 sim ticks, for the perf overlay (never read by the sim).
  const tickMs = new Float64Array(100); let ticksTimed = 0;
  const simStats = () => {
    const n = Math.min(ticksTimed, tickMs.length);
    if (!n) return null;
    const a = Array.from(tickMs.subarray(0, n)).sort((x, y) => x - y);
    return { mean: a.reduce((x, y) => x + y, 0) / n, p95: a[Math.min(n - 1, Math.floor(n * 0.95))], squads: world.squads.length };
  };
  const postFrame = (fog, alpha, events, slow) => {
    const { packed, transfer } = packer.pack(world, pending, playerSide, { fog, slow });
    post({ type: 'frame', packed, alpha, events, sim: simStats() }, transfer);
  };

  const emitEnd = () => {
    finished = true;
    post({ type: 'ended', result: toStrategicResult(world), log, hash: worldHash(world), chain: world.hashChain, tick: world.tick });
  };

  return {
    world,
    pushOrders(orders) {
      // Orders always take effect on the next tick to be simulated — never in the past — which
      // is exactly how the replay applies them, so live play and replay agree.
      orders.forEach((o) => {
        const stamped = { ...o, tick: world.tick, seq: seq++ };
        log.push(stamped);
        // A deployment (before the first tick) is set down at once so the paused frame shows it;
        // the replay applies the same logged order at tick 0 before stepping, to the same effect.
        if (o.type === 'deploy' && world.tick === 0) { applyOrder(world, stamped); world.events.length = 0; return; }
        pending.push(stamped);
      });
      if (paused) postFrame(false, 1, [], true);
    },
    setPaused(p) { paused = p; last = null; },
    setSpeed(s) { speed = s; },
    frame(now) {
      if (finished) return;
      if (last === null) last = now;
      const dt = Math.min(250, now - last);
      last = now;
      if (!paused) acc += dt * speed;
      const events = [];
      while (acc >= TICK_MS && !world.ended) {
        const orders = pending; pending = [];
        const t0 = performance.now();
        step(world, orders);
        tickMs[ticksTimed++ % tickMs.length] = performance.now() - t0;
        events.push(...world.events); world.events.length = 0;
        acc -= TICK_MS;
        if (world.tick % CHECKPOINT_EVERY === 0) post({ type: 'checkpoint', tick: world.tick, hash: worldHash(world), chain: world.hashChain, log: [...log] });
      }
      // A view only when the world moved on (20 Hz at 1x, not every screen frame): the screen
      // interpolates between the last two by itself, and a 300-a-side view costs milliseconds to
      // build and copy (plans/terra-imperium-rts-plan.md 13.3). Paused, pushOrders posts its own.
      if (world.tick === lastPostedTick && !events.length && !world.ended) return;
      lastPostedTick = world.tick;
      const sendFog = world.tick - lastFogTick >= 5;
      if (sendFog) lastFogTick = world.tick;
      const sendSlow = world.tick - lastSlowTick >= SLOW_EVERY || paused || world.ended;
      if (sendSlow) lastSlowTick = world.tick;
      postFrame(sendFog, paused ? 1 : acc / TICK_MS, events, sendSlow);
      if (world.ended) emitEnd();
    }
  };
};
