import {describe,it,expect} from 'vitest';
import {createInitialState,gameReducer} from './gameReducer';
import {getRecruitUnitCost} from './economy';
import {settleAIUpkeep,canAffordAIRecruit,applyAIRecruitCost} from './aiEconomy';
import {getTradeRoute} from './tradeRoutes';
import {processEmergence} from './emergence';
import {ActionTypes} from '../data/types';
import {assertGameState} from './stateAudit';
import {hasDeposit} from '../data/deposits';
import {calcAllNationIncomes} from './aiEconomy';
describe('economic and scenario connections',()=>{
  it('charges identical resource costs to player and AI',()=>{
    const s=createInitialState({playerNationId:'fr',rngSeed:7});s.resources={gold:500,hr:500,mil:10,copper:0};s.nations.de.economy={...s.resources};
    expect(getRecruitUnitCost(s,'bronze','de')).toEqual(getRecruitUnitCost(s,'bronze','fr'));
    expect(canAffordAIRecruit(s.nations.de,s,'bronze')).toBe(true);
    const n=applyAIRecruitCost(s.nations.de,s,'bronze');expect(n.economy.gold).toBe(410);
    s.resources.copper=10;s.nations.de.economy.copper=10;
    expect(getRecruitUnitCost(s,'bronze','de')).toEqual(getRecruitUnitCost(s,'bronze','fr'));
  });
  it('charges AI upkeep every turn and applies real bankruptcy without banking',()=>{
    const s=createInitialState({playerNationId:'fr',rngSeed:7});s.nations.de.economy.gold=0;
    s.units={u:{id:'u',ownerId:'de',regionId:s.nations.de.capitalRegionId,domain:'land',strength:100,maxStrength:100}};
    const n=settleAIUpkeep(s,'de',{gold:0});expect(n.economy.gold).toBe(0);expect(n.hasBeenBankrupt).toBe(true);
  });
  it('AI extraction yields finite strategic stocks',()=>{
    const s=createInitialState({playerNationId:'fr',rngSeed:7});const r=Object.values(s.regions).find(r=>r.owner!=='fr'&&hasDeposit(r.owner,'iron'));
    r.buildings.extraction={iron:true};const income=calcAllNationIncomes(s);expect(income[r.owner].iron).toBeGreaterThan(0);expect(Number.isFinite(income[r.owner].iron)).toBe(true);
  });
  it('war disrupts a real adjacent land trade route',()=>{
    const s=createInitialState({playerNationId:'fr',rngSeed:7});expect(getTradeRoute(s,'de').ok).toBe(true);
    s.wars=[{id:'w',aggressor:'fr',enemy:'de',active:true}];expect(getTradeRoute(s,'de').ok).toBe(false);
  });
  it('tax decisions have a visible political cost only when changed',()=>{
    const s=createInitialState({playerNationId:'fr',rngSeed:7});const before=s.nations.fr.estates.burghers.loyalty;
    const next=gameReducer(s,{type:ActionTypes.SET_TAX_RATE,payload:{rate:'high'}});expect(next.nations.fr.estates.burghers.loyalty).toBe(before-5);
    const same=gameReducer(next,{type:ActionTypes.SET_TAX_RATE,payload:{rate:'high'}});expect(same.nations.fr.estates.burghers.loyalty).toBe(before-5);
  });
  it('late emergence uses only neutral territory and keeps valid capital and save metadata',()=>{
    const s=createInitialState({playerNationId:'fr',rngSeed:7,scenario:{mode:'emergent',nationCount:15,seed:7}});s.turnNumber=50;
    const next=processEmergence(s);expect(Object.keys(next.nations)).toHaveLength(16);
    const id=next.scenario.activeNationIds.at(-1);expect(s.regions[next.nations[id].capitalRegionId].owner).toBeNull();assertGameState(next);
  });
});
