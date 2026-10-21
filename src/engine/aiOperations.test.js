import { describe,it,expect } from 'vitest';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { getNeighborIds, getNationCapital } from '../data/regions';
import { createRng } from '../utils/rng';
import { addCity, neighbourWorld, peoplesWorld, cloneWorld, majorIds, rivalOf } from './testWorld';
import { getTiles } from '../data/geo/tiles';
import { ringsAround } from './world/cities';
import { syncWorldRegistry } from './world/registry';
import { distanceKm } from '../data/geo/geodesic';
import { processAINavalOperations, processAIOperations, cityAttackWorthIt } from './aiOperations';
import { resolveAllQueuedAuto } from './battleQueue';
// The rival's capital borders the player's land (neighbourWorld), so the fixture founds a rival
// interior city beside it that borders no city of the player.
const W0=neighbourWorld({seed:7,rivals:1,capitals:true,fog:false});
const P=W0.playerNationId;const D=rivalOf(W0);
const setup=()=>{
  const s0=cloneWorld(W0);
  const border=s0.nations[D].capitalRegionId;
  const added=addCity(s0,D,{near:border,loose:true});
  const s=added.state;const interior=added.cityId;
  const target=getNeighborIds(border).find(id=>s.regions[id]?.owner===P);
  if(!target||getNeighborIds(interior).some(n=>s.regions[n]?.owner===P))throw new Error('fixture: expected the rival capital to border the player and the new city not to');
  s.wars=[{id:'w',aggressor:P,enemy:D,active:true,battleScore:0}];
  s.nations[D]={...s.nations[D],economy:{gold:1000,hr:1000,mil:100,adm:100}};
  const unit={id:'a',ownerId:D,regionId:interior,domain:'land',classId:'infantry',strength:1000,maxStrength:1000,morale:100,movesLeft:1,promotions:[],xp:0};
  s.units={a:unit};return {s,border,interior,target};
};
describe('operational AI',()=>{
  it('redirects interior troops to a threatened capital before attacking',()=>{
    const {s,border,interior}=setup();
    s.nations[D]={...s.nations[D],capitalRegionId:border};
    s.regions[border]={...s.regions[border],underInvasion:true};
    const next=processAIOperations(s,createRng(7));
    expect(next.aiOperations[D].objective).toBe('defend');
    expect(next.units.a.regionId).toBe(border);
    expect(getNeighborIds(interior)).toContain(border);
    expect(next.pendingDefenses).toHaveLength(0);
  });
  it('does not commit the same player garrison to two simultaneous battles',()=>{
    const base=setup();
    // A French city with two German neighbours: a new French city, then two German ones beside it,
    // packed tighter than the settling rule allows (testWorld addCity loose).
    // Beside the interior city, away from the rival capital, so the capital is not threatened.
    // A French city that borders neither the rival capital nor the interior city's French neighbours: the
    // nearest free land to the interior city that is not adjacent to the capital.
    const tiles=getTiles();const from=base.s.regions[base.interior].tile;
    const pool=[];for(let t=0;t<tiles.count;t++)if(tiles.land[t]&&!base.s.world.tileOwner[t])pool.push(t);
    pool.sort((a,b)=>distanceKm(tiles.centres[from],tiles.centres[a])-distanceKm(tiles.centres[from],tiles.centres[b]));
    let f=null;
    for(const t of pool.slice(0,160)){let r;try{r=addCity(base.s,P,{near:t,loose:true});}catch{continue;}if(r.state.regions[r.cityId].tile===t&&!getNeighborIds(r.cityId).includes(base.border)){f=r;break;}}
    if(!f)throw new Error('fixture: no player site away from the rival capital');
    let st=f.state;const sources=[];
    for(let i=0;i<5&&sources.length<2;i++){const g=addCity(st,D,{near:f.cityId,loose:true});st=g.state;if(getNeighborIds(f.cityId).includes(g.cityId))sources.push(g.cityId);}
    const s={...st,wars:base.s.wars,nations:{...st.nations,[D]:base.s.nations[D]},units:base.s.units};
    const target=f.cityId;
    sources.forEach(id=>expect(getNeighborIds(target)).toContain(id));
    expect(getNeighborIds(target)).not.toContain(base.border);
    s.units=Object.fromEntries(sources.map((regionId,i)=>['a'+i,{...s.units.a,id:'a'+i,regionId}]));
    // Every other city of the rival keeps a garrison, so the player's lone regiment threatens none of them (threat.js) and the objective stays an advance.
    Object.values(s.regions).filter(c=>c.owner===D&&!sources.includes(c.id)).forEach(c=>{s.units['g'+c.id]={...s.units.a0,id:'g'+c.id,regionId:c.id,tile:c.tile};});
    s.units.defender={...s.units.a0,id:'defender',ownerId:P,regionId:target,strength:10};
    const next=processAIOperations(s,createRng(7));
    const defenses=next.pendingDefenses.filter(d=>d.regionId===target);
    expect(defenses,JSON.stringify({ops:next.aiOperations?.[D],pd:next.pendingDefenses,units:next.units,nb:getNeighborIds(target).map(id=>[id,s.regions[id].owner])})).toHaveLength(1);
    expect(defenses[0].defenderUnitIds).toEqual(['defender']);
    const attackers=next.pendingDefenses.flatMap(d=>d.attackerUnitIds);
    expect(new Set(attackers).size).toBe(attackers.length);
  });
  it('an interior city sends its regiments to the muster point by the front (war plan, lane W5)',()=>{
    const {s,border}=setup();
    s.units.b={...s.units.a,id:'b'};
    const next=processAIOperations(s,createRng(7));
    expect(next.nations[D].warPlan.staging).toBe(border);
    for(const id of ['a','b']){
      const u=next.units[id];
      expect(u.route?.length>0||u.tile===s.regions[border].tile).toBe(true); // on the road to the rival capital (or there)
      if(u.route?.length)expect(u.route[u.route.length-1]).toBe(s.regions[border].tile);
    }
    expect(next.nations[D].economy.mil).toBe(100); // moving is free since routes (plan §4g)
  });
  it('a border city or the capital keeps one regiment home; a lone one waits instead of walking to the walls alone (lane W5)',()=>{
    const {s,border}=setup();
    s.units.a={...s.units.a,regionId:border,tile:s.regions[border].tile};
    const next=processAIOperations(s,createRng(7));
    expect(next.units.a.regionId).toBe(border);
    expect(next.units.a.route).toBeFalsy();
    expect(next.pendingDefenses).toHaveLength(0);
  });
  it('marches on tiles toward the player\'s city when its own does not touch it, and halts before it',()=>{
    // A rival (AI) at war with the player: its city does not touch the player's capital, a few tiles away.
    const w0=cloneWorld(peoplesWorld({seed:7,fog:false}));const RV=rivalOf(w0);
    const PK=w0.nations[w0.playerNationId].capitalRegionId;
    // A rival city a few tiles out that is not a neighbour of the player's capital by the near rule.
    let s0=null;let IN=null;
    for(const [t,d] of ringsAround(getTiles(),w0.regions[PK].tile,14)){
      if(d<5||getTiles().land[t]!==1||w0.world.tileOwner[t]!=null)continue;
      let r;try{r=addCity(w0,RV,{near:t});}catch{continue;}
      if(!getNeighborIds(r.cityId).includes(PK)){s0=r.state;IN=r.cityId;break;}
    }
    if(!IN)throw new Error('fixture: no rival site a few tiles from the player capital');
    // A strike stack (warPlans.js): five regiments in New Delhi, four march and one holds the city.
    const reg=(id)=>({id,ownerId:RV,regionId:IN,tile:s0.regions[IN].tile,domain:'land',classId:'infantry',strength:1000,maxStrength:1000,morale:100,movesLeft:1,promotions:[],xp:0});
    const s={...s0,wars:[{id:'w',aggressor:s0.playerNationId,enemy:RV,active:true,battleScore:0}],units:{a:reg('a'),b:reg('b'),c:reg('c'),d:reg('d'),home:{...reg('home'),strength:900}}};
    s.nations[RV]={...s.nations[RV],economy:{gold:1000,hr:1000,mil:100,adm:100},isAtWar:true};s.nations[s.playerNationId]={...s.nations[s.playerNationId],isAtWar:true};
    const tiles=getTiles();
    const next=processAIOperations(s,createRng(7));
    expect(next.pendingDefenses).toHaveLength(0);
    expect(next.units.a.tile).not.toBe(s.regions[IN].tile);
    expect(next.units.a.route?.length).toBeGreaterThan(0);
    expect(next.units.a.regionId).toBe(IN);
    expect(next.units.home.route).toBeFalsy();
    let st=next;
    for(let i=0;i<12&&st.units.a.route?.length;i++){st={...st,units:Object.fromEntries(Object.entries(st.units).map(([id,u])=>[id,{...u,movesLeft:1}]))};st=processAIOperations(st,createRng(7+i));}
    const at=st.units.a.tile;
    expect(tiles.neighbors[at].some(t=>s.world.tileOwner[t]===PK)||s.world.tileOwner[at]===PK).toBe(true);
    // Halted before the city (routes.js 'attack'), the next turn's decision drops the last step and
    // fights there or holds the tile (lane W5): it never waits on the step all war.
    expect(st.units.a.routeHalt==='attack'||!st.units.a.route?.length).toBe(true);
    st={...st,units:Object.fromEntries(Object.entries(st.units).map(([id,u])=>[id,{...u,movesLeft:1}]))};
    st=processAIOperations(st,createRng(99));
    expect(st.units.a.route?.length||0).toBe(0);
  });
  it('a march halted before the city it was sent to fights there instead of waiting on its last step (lane W5)',()=>{
    const {s,border,target}=setup();s.units.a.regionId=border;
    const tiles=getTiles();
    const beside=s.regions[target].tiles.flatMap(t=>tiles.neighbors[t]).find(t=>tiles.land[t]===1&&s.world.tileOwner[t]!==target);
    s.units.a={...s.units.a,tile:beside,route:[s.regions[target].tile],routeHalt:'attack',routeBank:0};
    const next=processAIOperations(s,createRng(7));
    expect(next.pendingDefenses).toHaveLength(1);
    expect(next.pendingDefenses[0].attackerUnitIds).toEqual(['a']);
    expect(next.units.a.route).toBeFalsy();
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
    expect(next.nations[D].economy.mil).toBe(98);
  });
  it('a broken stack does not assault a garrisoned city it would route against (H-15)',()=>{
    const {s,border,target}=setup();
    const tiles=getTiles();
    const beside=s.regions[target].tiles.flatMap(t=>tiles.neighbors[t]).find(t=>tiles.land[t]===1&&s.world.tileOwner[t]!==target);
    const run=(morale)=>{
      const units={g:{id:'g',ownerId:P,regionId:target,tile:s.regions[target].tile,domain:'land',classId:'infantry',strength:1000,maxStrength:1000,morale:100,movesLeft:1,promotions:[],xp:0}};
      for(let i=0;i<3;i++)units[`a${i}`]={...s.units.a,id:`a${i}`,regionId:border,tile:beside,morale};
      return processAIOperations({...s,units,pendingDefenses:[]},createRng(7)).pendingDefenses.filter(d=>d.regionId===target).length;
    };
    expect(run(100)).toBe(1);
    expect(run(15)).toBe(0);
  });
  it('can transport a real army to a reachable island front without creating free units',()=>{
    // Two coastal peoples of the small world that reach each other by sea (as in aiLanding.test.js).
    const s=cloneWorld(peoplesWorld({seed:7,player:'ahhiyawa'}));s.techAgeId='modern';const A='brigantes';const D2=s.playerNationId;
    const port=Object.keys(s.regions).find(r=>s.regions[r].owner===A&&isCoastal(r));
    const target=Object.keys(s.regions).find(r=>s.regions[r].owner===D2&&isCoastal(r)&&isReachableBySea(port,r,s.techAgeId));
    expect(target).toBeDefined();s.wars=[{id:'island',aggressor:A,enemy:D2,active:true,startYear:s.year}];
    s.nations[A]={...s.nations[A],isAtWar:true,economy:{gold:1000,hr:1000,mil:100,adm:100},tech:{ageId:'modern',researched:[]}};
    s.nations[D2]={...s.nations[D2],isAtWar:true};s.units={fleet:{id:'fleet',ownerId:A,regionId:port,domain:'naval',classId:'naval',strength:1000,maxStrength:1000,morale:100,movesLeft:1,transportCapacity:2,promotions:[]},army:{id:'army',ownerId:A,regionId:port,homeRegionId:port,domain:'land',classId:'infantry',strength:1000,maxStrength:1000,morale:100,movesLeft:1,promotions:[],xp:0}};
    // On the player's coast the landing waits in the battle queue (aiLanding.js), paid and moved.
    const queued=processAINavalOperations(s);expect(Object.keys(queued.units)).toHaveLength(2);
    expect(queued.pendingDefenses.map(d=>d.kind)).toEqual(['landing']);
    expect(queued.units.army.embarkedOn).toBe('fleet');expect(queued.units.army.movesLeft).toBe(0);expect(queued.units.fleet.movesLeft).toBe(0);
    expect(queued.nations[A].economy.mil).toBeLessThan(100);
    const next=resolveAllQueuedAuto(queued);expect(next.pendingDefenses).toHaveLength(0);
    expect(Object.keys(next.units).length).toBeLessThanOrEqual(2);
    if(next.units.army){expect(next.units.army.embarkedOn===null?next.regions[next.units.army.regionId].owner===A:next.units.army.embarkedOn==='fleet').toBe(true);}
  });
  it('cannot teleport across neutral or hostile territory or create troops',()=>{
    const {s,interior}=setup();const X3=majorIds(s).find(id=>id!==P&&id!==D);for(const id of getNeighborIds(interior))s.regions[id]={...s.regions[id],owner:X3};
    const next=processAIOperations(s,createRng(7));
    expect(next.units.a.regionId).toBe(interior);expect(Object.keys(next.units)).toEqual(['a']);
  });
});

describe('raids on the player\'s trade routes (plan D6)', () => {
  it('a stack at war with the player with no city goal in reach marches to the nearest route tile', async () => {
    const { getTradeRoute } = await import('./tradeRoutes');
    const { nearestRouteTile, AI_RAID_RINGS } = await import('./aiOperations');
    const base = cloneWorld(peoplesWorld({ seed: 7, fog: false })); const P0 = base.playerNationId;
    syncWorldRegistry(base); // the registry holds the last world built by this file
    const tiles = getTiles();
    // A trade partner whose route crosses free land: a route tile on free land with a free land neighbour, where the raider stands.
    // The raider's tile and all its neighbours are free, so no city is beside it (that would be a city goal).
    const lone = (t, r) => tiles.land[t] === 1 && !r.tiles.includes(t) && [t, ...tiles.neighbors[t]].every((n) => base.world.tileOwner[n] == null);
    let s; let route; let wild; let D2; let stand;
    for (const cand of majorIds(base).filter((id) => id !== P0)) {
      const t = { ...base, nations: { ...base.nations, [cand]: { ...base.nations[cand], hasTradeAgreement: true } } };
      const r = getTradeRoute(t, cand);
      const w = r.ok ? r.tiles.find((x) => t.world.tileOwner[x] == null && tiles.neighbors[x].some((n) => lone(n, r))) : null;
      if (w != null) { s = t; route = r; wild = w; D2 = cand; stand = tiles.neighbors[w].find((n) => lone(n, r)); break; }
    }
    expect(wild).toBeDefined();
    const nearest = nearestRouteTile(s, stand, AI_RAID_RINGS);
    expect(route.tiles).toContain(nearest); expect(tiles.neighbors[stand]).toContain(nearest); // a route tile one step away (the lowest id when two touch)
    // A third people shares no border with the player: no front, no city goal, only the raid.
    const PL = majorIds(s).find((id) => id !== P0 && id !== D2 && !getNeighborIds(getNationCapital(id)).some((n) => s.regions[n]?.owner === P0));
    expect(PL).toBeDefined();
    const raider = { id: 'raid1', ownerId: PL, regionId: getNationCapital(PL), homeRegionId: getNationCapital(PL), tile: stand, domain: 'land', classId: 'cavalry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1 };
    const war = { ...s, units: { ...s.units, raid1: raider }, wars: [{ id: 'w', aggressor: PL, enemy: P0, active: true, startTurn: 1 }], pendingDefenses: [], logs: [] };
    if (getNeighborIds(getNationCapital(PL)).some((id) => war.regions[id]?.owner === P0)) throw new Error('VAC2');
    const next = processAIOperations(war, createRng(3));
    const u = next.units.raid1;
    expect(u.tile === nearest || (u.route && u.route[u.route.length - 1] === nearest) || u.routeFailed?.goal === `raid:${nearest}`).toBe(true);
  });
});

describe('siege that cannot take the city (playtest 4 M2)',()=>{
  it('does not attack again a city already at 0 HP when no foot or horse is in the stack',()=>{
    const {s,target}=setup();
    const broken={...s.regions[target],siege:{hp:0,maxHp:500,startedTurn:1,by:D}};
    const siegeOnly=[{id:'e',ownerId:D,classId:'siege',strength:900}];
    const withFoot=[...siegeOnly,{id:'f',ownerId:D,classId:'infantry',strength:300}];
    expect(cityAttackWorthIt(s,D,siegeOnly,broken)).toBe(false);
    expect(cityAttackWorthIt(s,D,withFoot,broken)).toBe(true);
  });
});
