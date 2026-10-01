import { getNeighborIds } from '../data/regions';
import { getPool } from './nationState';
import { canAfford, applyCosts } from '../utils/helpers';
import { isUnitInBattle } from './invasion';
export const validateFrontier = (state,targetRegionId,nationId=state.playerNationId) => {
  const target=state.regions[targetRegionId];
  if(state.scenario?.mode!=='emergent' || !target || target.owner!==null || !target.neutral)return {ok:false,reason:'Choose a neutral frontier region.'};
  const army=Object.values(state.units).filter(u=>u.ownerId===nationId && u.domain==='land' && !u.embarkedOn && u.strength>0 && u.movesLeft>0 && !isUnitInBattle(state,u.id) && state.regions[u.regionId]?.owner===nationId && getNeighborIds(u.regionId).includes(targetRegionId)).sort((a,b)=>b.strength-a.strength || a.id.localeCompare(b.id))[0];
  if(!army)return {ok:false,reason:'An adjacent land army with movement remaining is required.'};
  const claims=state.nations[nationId].frontierClaims || 0;
  const cost={gold:Math.round(80+20*claims**1.4),adm:2+Math.floor(claims/4),supplies:2+Math.floor((target.neutral.resistance||0)/20)};
  if(!canAfford(getPool(state,nationId),cost))return {ok:false,reason:'Insufficient gold, administration or supplies for this expedition.',cost};
  const losses=Math.round((target.neutral.resistance||0)*3*(1+claims/10));
  if(army.strength<=losses)return {ok:false,reason:'The army is too weak to overcome frontier resistance.',cost};
  return {ok:true,army,cost,losses};
};
export const claimFrontier = (state,targetRegionId,nationId=state.playerNationId) => {
  const v=validateFrontier(state,targetRegionId,nationId); if(!v.ok)return state;
  const pool=applyCosts(getPool(state,nationId),v.cost),target=state.regions[targetRegionId];
  return {...state,resources:nationId===state.playerNationId?pool:state.resources,
    nations:{...state.nations,[nationId]:{...state.nations[nationId],frontierClaims:(state.nations[nationId].frontierClaims||0)+1,...(nationId!==state.playerNationId?{economy:pool}:{})}},
    regions:{...state.regions,[targetRegionId]:{...target,owner:nationId,control:35,unrest:35,neutral:null,integratingUntil:state.turnNumber+5}},
    units:{...state.units,[v.army.id]:{...v.army,regionId:targetRegionId,strength:v.army.strength-v.losses,movesLeft:0,lastBattleTurn:state.turnNumber}},
    logs:[...state.logs,{year:state.year,type:'action',message:`${state.nations[nationId].name} settles ${targetRegionId}; integration will take five turns.`}]};
};
