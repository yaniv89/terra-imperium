// The battlefield's one graphics profile (high quality). Dynamic resolution in BattleRenderer
// still steps the pixel ratio down on slow frames and back up when frames are fast again.
// figureTriangles: what the soldiers may draw a frame (soldierLod.js picks a coarser level past
// it), the rest of RTS plan 13.1's budget (0.5 M phone, 1 to 1.5 M desktop) is terrain and scenery.
export const BATTLE_GRAPHICS = { maxDpr: 2, shadows: true, shadowSize: 2048, effects: 400, figureTriangles: { phone: 300000, desktop: 800000 } };

export const frameSummary = samples => {
  if(!samples.length)return {p50:0,p95:0};
  const sorted=[...samples].sort((a,b)=>a-b);
  return {p50:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.floor((sorted.length-1)*.95)]};
};
