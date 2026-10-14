// src/battle/worker/warmWorker.js
// Kept apart from battleClient.js so the pre-battle sheets can warm the worker without pulling the
// sim into the main bundle.
import { worldMessage } from '../../worldgen/worldLoader';

// A battle worker started ahead of the battle (prewarmBattleWorker): the sim's module graph and the
// world grid load while the player is still on the pre-battle sheet or the "Mustering the troops"
// screen, instead of after the battlefield is drawn (scripts/perf/battle-load.mjs: the worker took 3
// to 5 s from its creation to its first frame, most of it loading). The next battle takes it if it is
// still for the same world, else it is dropped.
const WARM_TTL_MS = 120000;
let warm = null;
const spawnWorker = () => {
  const worker = new Worker(new URL('./battle.worker.js', import.meta.url), { type: 'module' });
  const msg = worldMessage();
  worker.postMessage(msg); // the world to load first (one world per page)
  return { worker, world: JSON.stringify(msg.spec) };
};
const dropWarm = () => { if (warm) { clearTimeout(warm.timer); try { warm.worker.terminate(); } catch { /* gone */ } warm = null; } };
export const prewarmBattleWorker = () => {
  if (warm || typeof Worker === 'undefined') return;
  try {
    const w = spawnWorker();
    w.worker.onerror = (e) => { e.preventDefault?.(); dropWarm(); }; // a dead one is never adopted
    w.timer = setTimeout(dropWarm, WARM_TTL_MS);
    warm = w;
  } catch { warm = null; }
};
export const takeWorker = () => {
  if (warm) {
    const w = warm; warm = null; clearTimeout(w.timer);
    try { if (w.world === JSON.stringify(worldMessage().spec)) return w.worker; } catch { /* fall through */ }
    try { w.worker.terminate(); } catch { /* gone */ }
  }
  return spawnWorker().worker;
};
