// The battlefield's one graphics profile (high quality). Dynamic resolution in BattleRenderer
// still steps the pixel ratio down on slow frames and back up when frames are fast again.
// figureTriangles: what the soldiers may draw a frame (soldierLod.js picks a coarser level past
// it), the rest of RTS plan 13.1's budget (0.5 M phone, 1 to 1.5 M desktop) is terrain and scenery.
export const BATTLE_GRAPHICS = { maxDpr: 2, shadows: true, shadowSize: 2048, effects: 400, figureTriangles: { phone: 300000, desktop: 800000 } };

// Adaptive soldier detail (BattleRenderer.adaptDetail): bias = how many levels finer than size on
// screen asks for. Up while the frame p95 holds the display rate, down past stepDownMs.
export const ADAPTIVE = { startBias: 1, maxBias: 2, window: 60, stepUpMs: 18, stepDownMs: 22, holdAfterUpS: 2, holdAfterDownS: 8, retryS: 45 };

export const frameSummary = samples => {
  if(!samples.length)return {p50:0,p95:0};
  const sorted=[...samples].sort((a,b)=>a-b);
  return {p50:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.floor((sorted.length-1)*.95)]};
};
