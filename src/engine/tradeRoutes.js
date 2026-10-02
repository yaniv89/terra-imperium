import { isBlockaded } from './fleets';
import { getNeighborIds,getOwnedRegionIds,getCapital } from '../data/regions';
import { isCoastal,isReachableBySea } from '../data/navalReach';
export const getTradeRoute = (state,partnerId) => {
  const me=state.playerNationId,partner=state.nations[partnerId];
  if(!partner || partner.isEliminated)return {ok:false,reason:'Partner is no longer active.'};
  if(state.wars.some(w=>w.active && ((w.aggressor===me && w.enemy===partnerId)||(w.enemy===me && w.aggressor===partnerId))))return {ok:false,reason:'Trade is suspended during war.'};
  const start=getCapital(state,me),target=getCapital(state,partnerId);
  if(!start || !target)return {ok:false,reason:'A trading capital is missing.'};
  const allowed=id=>state.regions[id]?.owner===me || state.regions[id]?.owner===partnerId || state.nations[state.regions[id]?.owner]?.hasMilitaryPact;
  const queue=[start],prev=new Map([[start,null]]);
  for(let i=0;i<queue.length;i++){
    const id=queue[i];
    if(id===target){const route=[];let p=id;while(p){route.unshift(p);p=prev.get(p);}return {ok:true,kind:'land',regions:route};}
    for(const n of getNeighborIds(id))if(!prev.has(n) && allowed(n) && !state.regions[n].occupiedBy){prev.set(n,id);queue.push(n);}
  }
  const ports=id=>getOwnedRegionIds(state.regions,id).filter(r=>isCoastal(r) && !state.regions[r].occupiedBy && (state.regions[r].buildings?.categories?.naval ?? -1)>=0);
  const blocked=r=>isBlockaded(state,r)||Object.values(state.units).some(u=>u.regionId===r && u.domain==='naval' && state.wars.some(w=>w.active && ((w.aggressor===me&&w.enemy===u.ownerId)||(w.enemy===me&&w.aggressor===u.ownerId))));
  for(const a of ports(me))for(const b of ports(partnerId))if(isReachableBySea(a,b,state.age) && !blocked(a) && !blocked(b))return {ok:true,kind:'sea',regions:[a,b]};
  return {ok:false,reason:'No open land route or reachable, unblocked ports.'};
};
