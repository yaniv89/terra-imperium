// Short seeded correctness scenarios run on every PR. Timing budgets run explicitly on a
// dedicated machine with PERF_CHECKS=1; they retain their original 80 ms/turn target.
import { describe,it,expect } from 'vitest';
import { createInitialState,gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { assertGameState } from './stateAudit';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { advanceCampaign } from '../../scripts/simulate.mjs';
const engine={resolveTurn,gameReducer,ActionTypes,assertGameState};
const fresh=(seed=7)=>({...createInitialState({playerNationId:'fr',rngSeed:seed}),firedEvents:Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id=>[id,true])),proceduralEventCooldown:999999,battleSettings:{autoDefend:true}});
const run=(s,count)=>{for(let i=0;i<count;i++){s=advanceCampaign(engine,s);if(s.gameStatus!=='ACTIVE')break;}return s;};
describe('AI correctness scenarios',()=>{
  it.each([7,4242,2026])('advances actual turns and preserves invariants for seed %i',seed=>{
    const s=run(fresh(seed),30);expect(s.turnNumber).toBe(31);assertGameState(s);
    const counts={};Object.values(s.regions).forEach(r=>{counts[r.owner]=(counts[r.owner]||0)+1;});
    expect(Math.max(...Object.values(counts))/Object.keys(s.regions).length).toBeLessThan(.4);
  },30000);
  it('recruits a counter to a cavalry-heavy neighboring player',()=>{
    let s=fresh();s.nations.de={...s.nations.de,doctrine:'isolationist',hostility:0,economy:{gold:10000,hr:10000,mil:1000,adm:0,dip:0,techPoints:0}};
    for(let i=0;i<6;i++)s.units['c'+i]={id:'c'+i,ownerId:'fr',regionId:getNationCapital('fr'),domain:'land',classId:'cavalry',strength:1000,maxStrength:1000,morale:100,movesLeft:1,promotions:[]};
    s=run(s,20);const army=Object.values(s.units).filter(u=>u.ownerId==='de');
    expect(army.length).toBeGreaterThan(0);expect(army.filter(u=>u.classId==='infantry').length/army.length).toBeGreaterThanOrEqual(.5);
  },30000);
});
describe.runIf(process.env.PERF_CHECKS==='1')('dedicated full-world performance budgets',()=>{
  it('resolves 300 completed turns under 30 seconds',()=>{const start=performance.now();const s=run(fresh(),300);expect(s.turnNumber).toBe(301);expect(performance.now()-start).toBeLessThan(30000);},45000);
  it('keeps mean turn time under 80 ms',()=>{const start=performance.now();run(fresh(),50);expect((performance.now()-start)/50).toBeLessThan(80);},20000);
});
