// src/battle/render/perfMeter.js
// The battle's on-screen performance readout (`&perf` in the URL, phase C2): open the same sandbox
// URL on a real phone and read the numbers off the screen. Frame time is the real interval between
// screen frames (not clamped), main-thread ms the time inside the renderer, sim ms the worker's own
// timing of each 20 Hz tick (battleLoop.js), triangles and draw calls three.js's count for the
// last frame (shadow pass included).
export const PERF_WINDOW = 120; // frames kept (about 2 s at 60 fps)

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);

export const createPerfMeter = (size = PERF_WINDOW) => {
  const frame = new Float64Array(size); const main = new Float64Array(size);
  let n = 0;
  return {
    push(frameMs, mainMs) { frame[n % size] = frameMs; main[n % size] = mainMs; n += 1; },
    summary() {
      const k = Math.min(n, size);
      const f = Array.from(frame.subarray(0, k)).sort((a, b) => a - b);
      const m = Array.from(main.subarray(0, k)).sort((a, b) => a - b);
      const mean = k ? f.reduce((a, b) => a + b, 0) / k : 0;
      return { fps: mean ? 1000 / mean : 0, frameP50: pct(f, 0.5), frameP95: pct(f, 0.95), mainP50: pct(m, 0.5), mainP95: pct(m, 0.95), frames: k };
    }
  };
};

const r1 = (v) => (v == null ? '-' : (Math.round(v * 10) / 10).toFixed(1));
// The overlay's text: one short line per measure, so it fits a corner of a 844x390 screen.
export const formatPerf = ({ meter, diag, sim, squads }) => [
  `${r1(meter.fps)} fps  frame p50 ${r1(meter.frameP50)} / p95 ${r1(meter.frameP95)} ms`,
  `main ${r1(meter.mainP50)} / p95 ${r1(meter.mainP95)} ms  sim ${sim ? `${r1(sim.mean)} / p95 ${r1(sim.p95)}` : '-'} ms/tick`,
  `${diag ? `${Math.round(diag.triangles / 1000)}k tris  ${diag.drawCalls} calls  ${diag.figures} figures  lod ${diag.tier ?? '-'} (+${diag.bias ?? 0})  dpr ${diag.dpr}` : ''}`,
  `${squads} squads on the field`
].join('\n');
