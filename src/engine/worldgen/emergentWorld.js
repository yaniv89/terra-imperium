import { REGIONS_DATA, getNeighborIds, getNationCapital } from '../../data/regions';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import { createRng } from '../../utils/rng';
export const NATION_COUNTS = [15, 30, 45, 60, 75];
export const GENERATION_VERSION = 1;
const separation = (a,b) => {
  const x = REGION_COORDINATES[a], y = REGION_COORDINATES[b];
  if (!x || !y) return 0;
  const lat = (x.lat-y.lat)*Math.PI/180, lon = (x.lng-y.lng)*Math.PI/180;
  return Math.sin(lat/2)**2 + Math.cos(x.lat*Math.PI/180)*Math.cos(y.lat*Math.PI/180)*Math.sin(lon/2)**2;
};
const connected = id => {
  const seen = new Set([id]), queue = [id];
  for (let i=0; i<queue.length && seen.size<5; i++) for (const n of getNeighborIds(queue[i])) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  return seen.size >= 5;
};
const connectedCache = new Map();
const usable = id => { if(!connectedCache.has(id)) connectedCache.set(id,connected(id)); return connectedCache.get(id); };
const relocatedCache = new Map();
const eligible = Object.keys(REGIONS_DATA).filter(usable);
export const generateStarts = (playerNationId, nationCount, seed) => {
  if (!NATION_COUNTS.includes(nationCount)) throw new Error('Unsupported nation count');
  const occupied = new Set();
  const pick = id => {
    const native = getNationCapital(id);
    if (native && usable(native) && !occupied.has(native)) return native;
    if(!relocatedCache.has(id)) relocatedCache.set(id,[...eligible].sort((a,b)=>separation(native,a)-separation(native,b) || a.localeCompare(b)));
    return relocatedCache.get(id).find(r=>!occupied.has(r));
  };
  const starts = {}, relocations = [];
  const assign = id => { const region = pick(id); starts[id]=region; occupied.add(region); if(region!==getNationCapital(id))relocations.push({nationId:id,from:getNationCapital(id),to:region}); };
  if (!getNationCapital(playerNationId)) throw new Error('Unknown player nation');
  assign(playerNationId);
  const rng = createRng(seed);
  const candidates = [...new Set(Object.values(REGIONS_DATA).map(r=>r.startOwner))].filter(id=>id!==playerNationId).map(id=>({id,tie:rng.next()}));
  while(Object.keys(starts).length<nationCount){
    const selected=candidates.reduce((best,c)=>{
      const r=pick(c.id),score=Math.min(...Object.values(starts).map(s=>separation(s,r)));
      return !best || score>best.score || (score===best.score && c.tie>best.tie) ? {...c,score} : best;
    },null);
    assign(selected.id); candidates.splice(candidates.findIndex(c=>c.id===selected.id),1);
  }
  return {starts,relocations};
};
export const applyScenario = (initial, {mode='full',nationCount=45,seed=1}={}) => {
  if(mode==='full')return {...initial,scenario:{mode:'full',generationVersion:GENERATION_VERSION,seed,activeNationIds:Object.keys(initial.nations)}};
  if(mode!=='emergent')throw new Error('Unsupported world mode');
  const {starts,relocations}=generateStarts(initial.playerNationId,nationCount,seed);
  const activeNationIds=Object.keys(starts), nations={},regions={},units={};
  for(const [id,r] of Object.entries(initial.regions))regions[id]={...r,owner:null,control:60,neutral:{inhabitants:r.currentPopulation,resistance:Math.min(80,20+Math.round(Math.log10(1+r.currentPopulation)*5))},unrest:0};
  for(const id of activeNationIds){
    const regionId=starts[id];
    nations[id]={...initial.nations[id],capitalRegionId:regionId,startRegionCount:1,militaryStrength:5000,frontierClaims:0};
    if(id!==initial.playerNationId)nations[id].economy={...initial.resources,supplies:20};
    regions[regionId]={...regions[regionId],owner:id,control:100,neutral:null,dev:{tax:4,production:4,manpower:4}};
    const unitId=`start_${id}`;
    units[unitId]={id:unitId,ownerId:id,regionId,homeRegionId:regionId,domain:'land',classId:'infantry',strength:1000,maxStrength:1000,morale:100,movesLeft:1,xp:0,rank:'recruit',promotions:[],commanderId:null};
  }
  return {...initial,nations,regions,units,resources:{...initial.resources,supplies:20},scenario:{mode,generationVersion:GENERATION_VERSION,seed,nationCount,activeNationIds,starts,relocations,dormantNationIds:Object.keys(initial.nations).filter(id=>!nations[id])}};
};
