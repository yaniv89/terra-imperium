// src/battle/worker/battle.worker.js
// The tactical sim's home off the UI thread (Tactical Battles plan §12.1). Workers have no
// requestAnimationFrame, so a ~60 Hz timer feeds the loop; the loop itself converts wall-clock
// time into fixed ticks, so timer jitter never changes the outcome.
// The world grid is fetched first (src/data/geo/tiles.js) and the sim imported after it, since
// modules in its graph read the grid as they load; messages are handled in order once it is in.
// Any failure (the grid or the sim failing to load, an exception building or stepping the world)
// is posted as { type: 'error', message }: the battle screen shows it with a way back to the map
// instead of freezing on an empty field (battleClient.js may first retry on the main thread).
import { loadWorld, WORLD_MESSAGE } from '../../worldgen/worldLoader';

// The world this worker runs comes in the first message (worldLoader.js worldMessage): the page's.
let setWorld;
const world = new Promise((resolve) => { setWorld = resolve; });
const ready = world.then((spec) => loadWorld(spec, { inline: true })).then(() => import('./battleLoop'));

let loop = null;
let timer = null;

const fail = (stage, err) => {
  clearTimeout(timer);
  loop = null;
  self.postMessage({ type: 'error', stage, message: err?.message || String(err), stack: err?.stack || null });
};

const pump = () => {
  if (!loop) return;
  try { loop.frame(performance.now()); } catch (err) { fail('step', err); return; }
  timer = setTimeout(pump, 16);
};

const handle = (data, createBattleLoop) => {
  switch (data.type) {
    case 'start':
      clearTimeout(timer);
      try {
        loop = createBattleLoop({ setup: data.setup, resume: data.resume || null, post: (m, transfer) => self.postMessage(m, transfer || []) });
      } catch (err) { fail('start', err); return; }
      if (data.paused) loop.setPaused(true);
      pump();
      break;
    case 'orders': try { loop?.pushOrders(data.orders); } catch (err) { fail('orders', err); } break;
    case 'pause': loop?.setPaused(true); break;
    case 'resume': loop?.setPaused(false); break;
    case 'speed': loop?.setSpeed(data.speed); break;
    case 'stop': clearTimeout(timer); loop = null; break;
    default:
  }
};

// A chain keeps the messages in their order while the first ones wait for the grid.
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  if (data?.type === WORLD_MESSAGE) { setWorld(data.spec); return; }
  queue = queue.then(() => ready).then(({ createBattleLoop }) => handle(data, createBattleLoop), (err) => { if (data.type === 'start') fail('load', err); });
};
