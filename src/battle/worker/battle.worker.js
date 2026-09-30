// src/battle/worker/battle.worker.js
// The tactical sim's home off the UI thread (Tactical Battles plan §12.1). Workers have no
// requestAnimationFrame, so a ~60 Hz timer feeds the loop; the loop itself converts wall-clock
// time into fixed ticks, so timer jitter never changes the outcome.
import { createBattleLoop } from './battleLoop';

let loop = null;
let timer = null;

const pump = () => {
  if (!loop) return;
  loop.frame(performance.now());
  timer = setTimeout(pump, 16);
};

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'start':
      clearTimeout(timer);
      loop = createBattleLoop({ setup: data.setup, resume: data.resume || null, post: (m) => self.postMessage(m) });
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
