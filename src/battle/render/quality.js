export const BATTLE_QUALITY = {
  low: { label:'Low', maxDpr:1, shadows:false, shadowSize:512, effects:120 },
  balanced: { label:'Balanced', maxDpr:1.5, shadows:true, shadowSize:1024, effects:240 },
  high: { label:'High', maxDpr:2, shadows:true, shadowSize:2048, effects:400 }
};
export const frameSummary = samples => {
  if(!samples.length)return {p50:0,p95:0};
  const sorted=[...samples].sort((a,b)=>a-b);
  return {p50:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.floor((sorted.length-1)*.95)]};
};
