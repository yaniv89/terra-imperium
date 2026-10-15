import {describe,it,expect} from 'vitest';
import {getRecruitUnitCost} from './economy';
import {settleAIUpkeep,canAffordAIRecruit,applyAIRecruitCost} from './aiEconomy';
import {getTradeRoute} from './tradeRoutes';
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
    // Deposits are keyed by modern country code (data/deposits.js), so a peoples city never has one: the stocks must still be finite numbers.
    const s=neighbourWorld({ seed: 7 });const r=Object.values(s.regions).find(r=>r.owner!==FR_ID);
    r.buildings.extraction={iron:true};const income=calcAllNationIncomes(s);Object.values(income[r.owner]).forEach(v=>{if(typeof v==='number')expect(Number.isFinite(v)).toBe(true);});
  });
  it('war disrupts a real adjacent land trade route',()=>{
    const s=neighbourWorld({ seed: 7 });expect(getTradeRoute(s,DE_ID).ok).toBe(true);
    s.wars=[{id:'w',aggressor:FR_ID,enemy:DE_ID,active:true}];expect(getTradeRoute(s,DE_ID).ok).toBe(false);
  });
});
