import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { coloniesOf, colonySlots, foundColony, foundingCost, validateColony } from './colonies';
// Persistent front objectives and real, one-hop army orders. All combat uses invasion aftermath.
import { getNeighborIds, getOwnedRegionIds } from '../data/regions';
import { getPool, getTechAgeId } from './nationState';
import { validateInvasion, getInvasionBattleContext, getResolveBattleArgs, applyInvasionResult } from './invasion';
import { resolveBattle } from './battle';
import { isUnitInBattle } from './invasion';
import { applyCosts, canAfford } from '../utils/helpers';
import { ACTION_COSTS } from '../data/actionCosts';

const routeStep = (regions, nationId, from, goals) => {
  const queue = [from], first = new Map([[from, null]]);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id !== from && goals.has(id)) return first.get(id);
    for (const n of getNeighborIds(id)) {
      if (first.has(n) || regions[n]?.owner !== nationId || (regions[n].occupiedBy && regions[n].occupiedBy !== nationId)) continue;
      first.set(n, first.get(id) || n); queue.push(n);
    }
  }
  return null;
};

export const processAIOperations = (state, rng) => {
  let next = { ...state, units: { ...state.units }, aiOperations: {}, pendingDefenses: [...(state.pendingDefenses || [])] };
  const committed = new Set();
  for (const nationId of Object.keys(state.nations).sort()) {
    if (nationId === state.playerNationId || state.nations[nationId].isEliminated) continue;
    if (state.scenario?.mode === 'emergent') {
      const neutral = [...new Set(getOwnedRegionIds(next.regions, nationId).flatMap(getNeighborIds))].filter(id => next.regions[id]?.owner === null).sort();
      // Colonies (colonies.js), under the same rules as the player: a free slot first, then the
      // first affordable target. Wary of strong natives: live alongside them; else drive them out.
      if (coloniesOf(next, nationId).length < colonySlots(next, nationId) && canAfford(getPool(next, nationId), foundingCost(next, nationId))) {
        const target = neutral.find(id => !next.regions[id].colony && validateColony(next,id,nationId,{quick:true}).ok);
        if(target) next=foundColony(next,target,(next.regions[target].neutral?.resistance||0)>=45?'coexist':'driveOut',nationId);
      }
    }
    const wars = next.wars.filter(w => w.active && (w.aggressor === nationId || w.enemy === nationId));
    if (!wars.length) continue;
    const enemies = new Set(wars.map(w => w.aggressor === nationId ? w.enemy : w.aggressor));
    const land = getOwnedRegionIds(next.regions, nationId);
    const fronts = new Set(land.filter(id => getNeighborIds(id).some(n => enemies.has(next.regions[n]?.owner))));
    // The capital counts as threatened when an enemy army stands next to it, not merely because
    // enemy land borders it (on the Dawn world every capital borders its neighbours' capitals).
    const enemyArmyNear = (id) => getNeighborIds(id).some(n => Object.values(next.units).some(u => u.regionId === n && u.domain === 'land' && !u.embarkedOn && enemies.has(u.ownerId)));
    const threatened = new Set(land.filter(id => next.regions[id].underInvasion || (id === next.nations[nationId].capitalRegionId && fronts.has(id) && enemyArmyNear(id))));
    const goals = threatened.size ? threatened : fronts;
    next.aiOperations[nationId] = { turn: state.turnNumber, objective: threatened.size ? 'defend' : 'advance', startedTurn:state.aiOperations?.[nationId]?.objective === (threatened.size ? 'defend' : 'advance') ? state.aiOperations[nationId].startedTurn : state.turnNumber, fronts: [...fronts].sort(), targets: [...goals].sort() };
    const stacks = new Map();
    for (const u of Object.values(next.units)) {
      if (u.ownerId !== nationId || u.domain !== 'land' || u.classId === 'settler' || u.embarkedOn || u.strength <= 0 || isUnitInBattle(next, u.id)) continue;
      const stack = stacks.get(u.regionId) || []; stack.push(u); stacks.set(u.regionId, stack);
    }
    for (const [from, stack] of [...stacks].sort(([a], [b]) => a.localeCompare(b))) {
      if (!stack.every(u => u.movesLeft > 0 && !committed.has(u.id)) || next.regions[from]?.owner !== nationId) continue;
      const pool = getPool(next, nationId);
      const candidates = getNeighborIds(from).filter(id => enemies.has(next.regions[id]?.owner) && !next.pendingDefenses.some(d=>d.regionId===id) && !Object.values(next.units).some(u=>u.regionId===id&&isUnitInBattle(next,u.id))).sort((a,b) => {
        const value = id => (next.regions[id].formerOwner === nationId || next.regions[id].conquest?.from === nationId ? 100 : 0) + (wars.some(w => w.goal?.regionId === id) ? 20 : 0) - Object.values(next.units).filter(u => u.regionId === id && u.ownerId !== nationId).reduce((s,u) => s + u.strength, 0) / 1000;
        return value(b)-value(a) || a.localeCompare(b);
      });
      const target = threatened.size && !threatened.has(from) ? null : candidates[0];
      if (target) {
        const actor = { ...next, playerNationId: nationId, resources: pool, techAgeId: getTechAgeId(next, nationId) };
        const v = validateInvasion(actor, from, target);
        if (!v.ok) continue;
        const defenderStrength=v.defenderUnits.reduce((sum,u)=>sum+u.strength,0);
        if(defenderStrength>stack.reduce((sum,u)=>sum+u.strength,0)*1.25)continue;
        // Keep a defensive reserve when the capital is under siege elsewhere.
        stack.forEach(u => committed.add(u.id));
        const chargedPool = applyCosts(pool, ACTION_COSTS.launchInvasion);
        if (next.regions[target].owner === state.playerNationId) {
          next.nations = { ...next.nations, [nationId]: { ...next.nations[nationId], economy: chargedPool } };
          stack.forEach(u => { next.units[u.id] = { ...u, movesLeft: 0 }; });
          next.pendingDefenses.push({ id: `op_${state.turnNumber}_${nationId}_${from}`, warId: v.war.id, aggressorId: nationId, fromRegionId: from, regionId: target, attackerUnitIds: stack.map(u => u.id), defenderUnitIds: v.defenderUnits.map(u=>u.id), synthetic: [], seed: Math.floor(rng.next()*0xffffffff)>>>0, turn: state.turnNumber });
        } else {
          const ctx = getInvasionBattleContext(actor, v);
          const battle = resolveBattle({ ...getResolveBattleArgs(v, ctx), rng });
          const result = applyInvasionResult(actor, { ...v, fromRegionId: from, targetRegionId: target, isDefended: ctx.isDefended }, battle, { rngSeed: rng.getSeed() });
          next = { ...next, regions: result.regions, units: result.units, wars: result.wars, hiredCommanders: result.hiredCommanders,
            nations: { ...result.nations, [nationId]: { ...result.nations[nationId], economy: chargedPool } },
            logs: [...next.logs, { year: next.year, type: 'combat', message: `${next.nations[nationId].name} attacks from ${from} toward ${target}.` }] };
        }
      } else {
        const to = routeStep(next.regions, nationId, from, goals);
        if (!to || !canAfford(pool, ACTION_COSTS.moveArmy)) continue;
        stack.forEach(u => { committed.add(u.id); next.units[u.id] = { ...u, regionId: to, movesLeft: 0 }; });
        next.nations = { ...next.nations, [nationId]: { ...next.nations[nationId], economy: applyCosts(pool, ACTION_COSTS.moveArmy) } };
      }
    }
  }
  return processAINavalOperations({...next,rngSeed:rng.getSeed()});
};

// Island fronts need real paid transports and cargo. Shared actions retain interception,
// reach, transport capacity, supply costs and the same landing aftermath as player orders.
export const processAINavalOperations = state => {
  let next=state;
  for(const id of Object.keys(next.nations).sort()){
    if(id===state.playerNationId || next.nations[id].isEliminated)continue;
    const enemies=new Set(next.wars.filter(w=>w.active&&(w.aggressor===id||w.enemy===id)).map(w=>w.aggressor===id?w.enemy:w.aggressor));
    if(!enemies.size)continue;
    const actor=()=>({...next,playerNationId:id,resources:getPool(next,id),techAgeId:getTechAgeId(next,id)});
    const apply=action=>{
      const before=actor(),after=gameReducer(before,action);
      if(after===before)return false;
      next={...next,regions:after.regions,units:after.units,wars:after.wars,rngSeed:after.rngSeed,nextUnitSeq:after.nextUnitSeq,hiredCommanders:after.hiredCommanders,nations:{...after.nations,[id]:{...after.nations[id],economy:after.resources}},logs:after.logs};
      return true;
    };
    const coast=Object.keys(next.regions).filter(r=>enemies.has(next.regions[r].owner)&&isCoastal(r)).sort();
    const ports=getOwnedRegionIds(next.regions,id).filter(isCoastal).sort();
    if(!coast.length || !ports.length)continue;
    let fleets=Object.values(next.units).filter(u=>u.ownerId===id&&u.domain==='naval'&&u.strength>0&&!isUnitInBattle(next,u.id));
    if(!fleets.length){
      const port=ports.find(p=>coast.some(t=>isReachableBySea(p,t,next.age))&&Object.values(next.units).some(u=>u.ownerId===id&&u.domain==='land'&&u.regionId===p&&!u.embarkedOn));
      if(port && (getPool(next,id).gold || 0)>300)apply({type:ActionTypes.RECRUIT_UNIT,payload:{regionId:port,classId:'naval'}});
      fleets=Object.values(next.units).filter(u=>u.ownerId===id&&u.domain==='naval');
    }
    for(const fleet of fleets.sort((a,b)=>a.id.localeCompare(b.id))){
      if((fleet.movesLeft ?? 0)<=0 || isUnitInBattle(next,fleet.id))continue;
      const target=coast.find(t=>isReachableBySea(fleet.regionId,t,next.age)||getNeighborIds(fleet.regionId).includes(t));
      if(!target)continue;
      const cargo=Object.values(next.units).filter(u=>u.ownerId===id&&u.domain==='land'&&u.regionId===fleet.regionId&&!u.embarkedOn&&u.movesLeft>0&&!isUnitInBattle(next,u.id));
      for(const unit of cargo.slice(0,fleet.transportCapacity || 0))apply({type:ActionTypes.EMBARK_UNIT,payload:{landUnitId:unit.id,navalUnitId:fleet.id}});
      const embarked=Object.values(next.units).filter(u=>u.embarkedOn===fleet.id);
      const defenders=Object.values(next.units).filter(u=>u.regionId===target&&u.domain==='land');
      if(!embarked.length || defenders.reduce((v,u)=>v+u.strength,0)>embarked.reduce((v,u)=>v+u.strength,0)*.75)continue;
      apply({type:ActionTypes.AMPHIBIOUS_ASSAULT,payload:{navalUnitId:fleet.id,targetRegionId:target}});
    }
  }
  return next;
};
