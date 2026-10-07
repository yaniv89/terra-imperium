// src/worldgen/worldgen.worker.js
// The world generator off the main thread (plans/MAP-VARIATIONS-PLAN.md 4.3): the start screen's
// preview and the boot into a generated world post { id, spec, grid, coast } and get back progress
// messages and then { id, result } (the tiles binary transferred, not copied), or { id, error }.
import { buildWorldPackage, encodePicture } from './worldPackage';

self.onmessage = async (e) => {
  const { id, spec, grid, coast = true, paint = false } = e.data || {};
  try {
    const t0 = performance.now();
    const result = buildWorldPackage(spec, grid, { coast, paint, onProgress: (f, stage) => self.postMessage({ id, progress: f, stage }) });
    result.ms = performance.now() - t0; // the generation time inside the worker (benchmarks)
    if (result.painted) {
      const t1 = performance.now();
      result.picture = await encodePicture(result.painted);
      result.pictureMs = performance.now() - t1;
      result.painted = null;
    }
    self.postMessage({ id, result }, [result.tiles.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.stack || err) });
  }
};
