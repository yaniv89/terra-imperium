import { describe,it,expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { getNeighborIds } from '../data/regions';
import { createRng } from '../utils/rng';
import { processAINavalOperations, processAIOperations } from './aiOperations';
const setup=()=>{
  const s=createInitialState({playerNationId:'fr',rngSeed:7});
  const border=Object.keys(s.regions).find(id=>s.regions[id].owner==='de' && getNeighborIds(id).some(n=>s.regions[n]?.owner==='fr') && getNeighborIds(id).some(n=>s.regions[n]?.owner==='de' && !getNeighborIds(n).some(m=>s.regions[m]?.owner==='fr')));
  const interior=getNeighborIds(border).find(id=>s.regions[id]?.owner==='de' && !getNeighborIds(id).some(n=>s.regions[n]?.owner==='fr'));
  const target=getNeighborIds(border).find(id=>s.regions[id]?.owner==='fr');
  s.wars=[{id:'w',aggressor:'fr',enemy:'de',active:true,battleScore:0}];
  s.nations.de.economy={gold:1000,hr:1000,mil:100,adm:100};
  const unit={id:'a',ownerId:'de',regionId:interior,domain:'land',classId:'infantry',strength:1000,maxStrength:1000,morale:100,movesLeft:1,promotions:[],xp:0};
  s.units={a:unit};return {s,border,interior,target};
};
describe('operational AI',()=>{
  it('redirects interior troops to a threatened capital before attacking',()=>{
    const {s,border,interior}=setup();
    s.nations.de={...s.nations.de,capitalRegionId:border};
    s.regions[border]={...s.regions[border],underInvasion:true};
    const next=processAIOperations(s,createRng(7));
    expect(next.aiOperations.de.objective).toBe('defend');
    expect(next.units.a.regionId).toBe(border);
    expect(getNeighborIds(interior)).toContain(border);
    expect(next.pendingDefenses).toHaveLength(0);
  });
  it('does not commit the same player garrison to two simultaneous battles',()=>{
    const {s}=setup();
    const target=Object.keys(s.regions).find(id=>s.regions[id].owner==='fr'&&getNeighborIds(id).filter(n=>s.regions[n]?.owner==='de').length>=2);
    expect(target).toBeDefined();
    const sources=getNeighborIds(target).filter(id=>s.regions[id]?.owner==='de').slice(0,2);
    s.units=Object.fromEntries(sources.map((regionId,i)=>['a'+i,{...s.units.a,id:'a'+i,regionId}]));
    s.units.defender={...s.units.a0,id:'defender',ownerId:'fr',regionId:target,strength:10};
    const next=processAIOperations(s,createRng(7));
    const defenses=next.pendingDefenses.filter(d=>d.regionId===target);
    expect(defenses).toHaveLength(1);
    expect(defenses[0].defenderUnitIds).toEqual(['defender']);
    const attackers=next.pendingDefenses.flatMap(d=>d.attackerUnitIds);
    expect(new Set(attackers).size).toBe(attackers.length);
  });
  it('moves toward a front one legal hop and spends movement',()=>{
    const {s,interior}=setup();const next=processAIOperations(s,createRng(7));
    expect(getNeighborIds(interior)).toContain(next.units.a.regionId);
    expect(next.units.a.movesLeft).toBe(0);
    expect(next.nations.de.economy.mil).toBe(99);
    expect(processAIOperations(next,createRng(7)).units.a).toEqual(next.units.a);
  });
  it('counterattacks in a player-started war using real troops only',()=>{
    const {s,border}=setup();s.units.a.regionId=border;
    const next=processAIOperations(s,createRng(7));
    expect(next.pendingDefenses).toHaveLength(1);
    expect(next.pendingDefenses[0].attackerUnitIds).toEqual(['a']);
    expect(next.pendingDefenses[0].synthetic).toEqual([]);
    expect(next.units.a.movesLeft).toBe(0);
    expect(next.nations.de.economy.mil).toBe(98);
  });
  it('can transport a real army to a reachable island front without creating free units',()=>{
    const s=createInitialState({playerNationId:'fr',rngSeed:7});s.age='modern';s.techAgeId='modern';
    const port=Object.keys(s.regions).find(r=>s.regions[r].owner==='gb'&&isCoastal(r));
    const target=Object.keys(s.regions).find(r=>s.regions[r].owner==='fr'&&isCoastal(r)&&isReachableBySea(port,r,s.age));
    expect(target).toBeDefined();s.wars=[{id:'island',aggressor:'gb',enemy:'fr',active:true,startYear:s.year}];
    s.nations.gb={...s.nations.gb,isAtWar:true,economy:{gold:1000,hr:1000,mil:100,adm:100},tech:{ageId:'modern',researched:[]}};
    s.nations.fr={...s.nations.fr,isAtWar:true};s.units={fleet:{id:'fleet',ownerId:'gb',regionId:port,domain:'naval',classId:'naval',strength:1000,maxStrength:1000,morale:100,movesLeft:1,transportCapacity:2,promotions:[]},army:{id:'army',ownerId:'gb',regionId:port,homeRegionId:port,domain:'land',classId:'infantry',strength:1000,maxStrength:1000,morale:100,movesLeft:1,promotions:[],xp:0}};
    const next=processAINavalOperations(s);expect(Object.keys(next.units)).toHaveLength(2);
    expect(next.units.army.embarkedOn).toBeNull();expect(next.units.army.movesLeft).toBe(0);
    expect(next.regions[next.units.army.regionId].owner).toBe('gb');expect(next.units.fleet.movesLeft).toBe(0);
    expect(next.nations.gb.economy.mil).toBeLessThan(100);
  });
  it('cannot teleport across neutral or hostile territory or create troops',()=>{
    const {s,interior}=setup();for(const id of getNeighborIds(interior))s.regions[id]={...s.regions[id],owner:'it'};
    const next=processAIOperations(s,createRng(7));
    expect(next.units.a.regionId).toBe(interior);expect(Object.keys(next.units)).toEqual(['a']);
  });
});
