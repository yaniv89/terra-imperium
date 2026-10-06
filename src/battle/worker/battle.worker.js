// src/battle/worker/battle.worker.js
// The tactical sim's home off the UI thread (Tactical Battles plan §12.1). Workers have no
// requestAnimationFrame, so a ~60 Hz timer feeds the loop; the loop itself converts wall-clock
// time into fixed ticks, so timer jitter never changes the outcome.
// The world grid is fetched first (src/data/geo/tiles.js) and the sim imported after it, since
// modules in its graph read the grid as they load; messages are handled in order once it is in.
import { loadTiles } from '../../data/geo/tiles';

const ready = loadTiles().then(() => import('./battleLoop'));

let loop = null;
let timer = null;

const pump = () => {
  if (!loop) return;
  loop.frame(performance.now());
  timer = setTimeout(pump, 16);
};

const handle = (data, createBattleLoop) => {
  switch (data.type) {
    case 'start':
      clearTimeout(timer);
      loop = createBattleLoop({ setup: data.setup, resume: data.resume || null, post: (m, transfer) => self.postMessage(m, transfer || []) });
      if (data.paused) loop.setPaused(true);
      pump();
      break;
    case 'orders': loop?.pushOrders(data.orders); break;
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
  queue = queue.then(() => ready).then(({ createBattleLoop }) => handle(data, createBattleLoop));
};
