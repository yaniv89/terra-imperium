// src/battle/sim/headless.js
// Run a whole battle without any rendering — for tests, the parity harness, odds previews and
// (later) server-side replay. `orders` is a recorded log of { tick, ... } orders to replay.
import { createWorld } from './world';
import { step } from './step';
import { toStrategicResult } from './result';
import { worldHash } from './hash';
import { battleLimitTicks } from './constants';

export const runHeadless = (setup, { orders = [], maxTicks = battleLimitTicks(setup) + 20, checkpointEvery = 0 } = {}) => {
  const w = createWorld(setup);
  const byTick = new Map();
  orders.forEach((o) => { const list = byTick.get(o.tick) || []; list.push(o); byTick.set(o.tick, list); });
  const checkpoints = [];
  while (!w.ended && w.tick < maxTicks) {
    step(w, byTick.get(w.tick) || []);
    w.events.length = 0;
    if (checkpointEvery && w.tick % checkpointEvery === 0) checkpoints.push({ tick: w.tick, hash: worldHash(w), chain: w.hashChain });
  }
  return { world: w, result: toStrategicResult(w), hash: worldHash(w), chain: w.hashChain, checkpoints };
};
