import {describe,it,expect} from 'vitest';
import {createInitialState} from './gameReducer';
import {getRecruitUnitCost} from './economy';
import {settleAIUpkeep,canAffordAIRecruit,applyAIRecruitCost} from './aiEconomy';
import {getTradeRoute} from './tradeRoutes';
import {processEmergence} from './emergence';
import {assertGameState} from './stateAudit';
import {hasDeposit} from '../data/deposits';
import {calcAllNationIncomes} from './aiEconomy';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 7 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);

describe('economic and scenario connections',()=>{
  it('charges identical resource costs to player and AI',()=>{
    const s=neighbourWorld({ seed: 7 });s.resources={gold:500,hr:500,mil:10,copper:0};s.nations[DE_ID].economy={...s.resources};
    expect(getRecruitUnitCost(s,'bronze',DE_ID)).toEqual(getRecruitUnitCost(s,'bronze',FR_ID));
    expect(canAffordAIRecruit(s.nations[DE_ID],s,'bronze')).toBe(true);
    const n=applyAIRecruitCost(s.nations[DE_ID],s,'bronze');expect(n.economy.gold).toBe(410);
    s.resources.copper=10;s.nations[DE_ID].economy.copper=10;
    expect(getRecruitUnitCost(s,'bronze',DE_ID)).toEqual(getRecruitUnitCost(s,'bronze',FR_ID));
  });
  it('charges AI upkeep every turn and applies real bankruptcy without banking',()=>{
    const s=neighbourWorld({ seed: 7 });s.nations[DE_ID].economy.gold=0;
    s.units={u:{id:'u',ownerId:DE_ID,regionId:s.nations[DE_ID].capitalRegionId,domain:'land',strength:100,maxStrength:100}};
    const n=settleAIUpkeep(s,DE_ID,{gold:0});expect(n.economy.gold).toBe(0);expect(n.hasBeenBankrupt).toBe(true);
  });
  it('AI extraction yields finite strategic stocks',()=>{
    const s=neighbourWorld({ seed: 7 });const r=Object.values(s.regions).find(r=>r.owner!==FR_ID&&hasDeposit(r.owner,'iron'));
    r.buildings.extraction={iron:true};const income=calcAllNationIncomes(s);expect(income[r.owner].iron).toBeGreaterThan(0);expect(Number.isFinite(income[r.owner].iron)).toBe(true);
  });
  it('war disrupts a real adjacent land trade route',()=>{
    const s=neighbourWorld({ seed: 7 });expect(getTradeRoute(s,DE_ID).ok).toBe(true);
    s.wars=[{id:'w',aggressor:FR_ID,enemy:DE_ID,active:true}];expect(getTradeRoute(s,DE_ID).ok).toBe(false);
  });
  it('late emergence uses only neutral territory and keeps valid capital and save metadata',()=>{
    const s=createInitialState({playerNationId:FR_ID,rngSeed:7,scenario:{mode:'emergent',nationCount:15,seed:7}});s.turnNumber=50;
    const next=processEmergence(s);expect(Object.keys(next.nations)).toHaveLength(16);
    const id=next.scenario.activeNationIds.at(-1);const capital=next.nations[id].capitalRegionId;
    expect(s.regions[capital]).toBeUndefined();expect(s.world.tileOwner[next.regions[capital].tile]).toBeUndefined();expect(next.regions[capital].owner).toBe(id);assertGameState(next);
  });
});
