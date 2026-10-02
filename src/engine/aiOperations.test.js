import { describe,it,expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { getNeighborIds } from '../data/regions';
import { createRng } from '../utils/rng';
import { addCity } from './testWorld';
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { processAINavalOperations, processAIOperations } from './aiOperations';
// The Dawn world gives Germany one city (its capital, which borders Paris), so the fixture founds
// a German interior city beside it that borders no French city.
const setup=()=>{
  const s0=createInitialState({playerNationId:'fr',rngSeed:7});
  const border=s0.nations.de.capitalRegionId;
  const added=addCity(s0,'de',{near:border});
  const s=added.state;const interior=added.cityId;
  const target=getNeighborIds(border).find(id=>s.regions[id]?.owner==='fr');
  if(!target||getNeighborIds(interior).some(n=>s.regions[n]?.owner==='fr'))throw new Error('fixture: expected Berlin to border Paris and the new city not to');
  s.wars=[{id:'w',aggressor:'fr',enemy:'de',active:true,battleScore:0}];
  s.nations.de={...s.nations.de,economy:{gold:1000,hr:1000,mil:100,adm:100}};
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
    const base=setup();
    // A French city with two German neighbours: a new French city, then two German ones beside it.
    // Beside the interior city, away from Berlin, so the capital is not threatened.
    // A French city that borders neither Berlin nor the interior city's French neighbours: the
    // nearest free land to the interior city that is not adjacent to the capital.
    const tiles=getTiles();const from=base.s.regions[base.interior].tile;
    const pool=[];for(let t=0;t<tiles.count;t++)if(tiles.land[t]&&!base.s.world.tileOwner[t])pool.push(t);
    pool.sort((a,b)=>distanceKm(tiles.centres[from],tiles.centres[a])-distanceKm(tiles.centres[from],tiles.centres[b]));
    let f=null;
    for(const t of pool.slice(0,40)){let r;try{r=addCity(base.s,'fr',{near:t});}catch{continue;}if(r.state.regions[r.cityId].tile===t&&!getNeighborIds(r.cityId).includes(base.border)){f=r;break;}}
    if(!f)throw new Error('fixture: no French site away from Berlin');
    let st=f.state;const sources=[];
    for(let i=0;i<5&&sources.length<2;i++){const g=addCity(st,'de',{near:f.cityId});st=g.state;if(getNeighborIds(f.cityId).includes(g.cityId))sources.push(g.cityId);}
    const s={...st,wars:base.s.wars,nations:{...st.nations,de:base.s.nations.de},units:base.s.units};
    const target=f.cityId;
    sources.forEach(id=>expect(getNeighborIds(target)).toContain(id));
    expect(getNeighborIds(target)).not.toContain(base.border);
    s.units=Object.fromEntries(sources.map((regionId,i)=>['a'+i,{...s.units.a,id:'a'+i,regionId}]));
    s.units.defender={...s.units.a0,id:'defender',ownerId:'fr',regionId:target,strength:10};
    const next=processAIOperations(s,createRng(7));
    const defenses=next.pendingDefenses.filter(d=>d.regionId===target);
    expect(defenses,JSON.stringify({ops:next.aiOperations?.de,pd:next.pendingDefenses,units:next.units,nb:getNeighborIds(target).map(id=>[id,s.regions[id].owner])})).toHaveLength(1);
    expect(defenses[0].defenderUnitIds).toEqual(['defender']);
    const attackers=next.pendingDefenses.flatMap(d=>d.attackerUnitIds);
    expect(new Set(attackers).size).toBe(attackers.length);
  });
  it('moves toward a front one legal hop and spends movement',()=>{
    const {s,interior}=setup();const next=processAIOperations(s,createRng(7));
    expect(getNeighborIds(interior)).toContain(next.units.a.regionId);
    expect(next.units.a.movesLeft).toBe(0);
    expect(next.nations.de.economy.mil).toBe(100); // moving is free since routes (plan §4g)
    expect(processAIOperations(next,createRng(7)).units.a).toEqual(next.units.a);
  });
  it('marches on tiles toward the player\'s city when its own does not touch it, and halts before it',()=>{
    // India (AI) at war with the player Pakistan: New Delhi does not touch Islamabad, five tiles away.
    const s0=createInitialState({playerNationId:'pk',rngSeed:7});
    const IN=s0.nations.in.capitalRegionId;const PK=s0.nations.pk.capitalRegionId;
    const s={...s0,wars:[{id:'w',aggressor:'pk',enemy:'in',active:true,battleScore:0}],units:{a:{id:'a',ownerId:'in',regionId:IN,tile:s0.regions[IN].tile,domain:'land',classId:'infantry',strength:1000,maxStrength:1000,morale:100,movesLeft:1,promotions:[],xp:0}}};
    s.nations.in={...s.nations.in,economy:{gold:1000,hr:1000,mil:100,adm:100},isAtWar:true};s.nations.pk={...s.nations.pk,isAtWar:true};
    const tiles=getTiles();
    const next=processAIOperations(s,createRng(7));
    expect(next.pendingDefenses).toHaveLength(0);
    expect(next.units.a.tile).not.toBe(s.regions[IN].tile);
    expect(next.units.a.route?.length).toBeGreaterThan(0);
    expect(next.units.a.regionId).toBe(IN);
    let st=next;
    for(let i=0;i<12&&st.units.a.route?.length;i++){st={...st,units:Object.fromEntries(Object.entries(st.units).map(([id,u])=>[id,{...u,movesLeft:1}]))};st=processAIOperations(st,createRng(7+i));}
    const at=st.units.a.tile;
    expect(tiles.neighbors[at].some(t=>s.world.tileOwner[t]===PK)||s.world.tileOwner[at]===PK).toBe(true);
    expect(st.units.a.routeHalt).toBe('attack');
  });
  it('counterattacks in a player-started war using real troops only, from a tile touching the city',()=>{
    const {s,border,target}=setup();s.units.a.regionId=border;
    const tiles=getTiles();
    const beside=s.regions[target].tiles.flatMap(t=>tiles.neighbors[t]).find(t=>tiles.land[t]===1&&s.world.tileOwner[t]!==target);
    s.units.a.tile=beside;
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
