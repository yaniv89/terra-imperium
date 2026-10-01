import { describe,it,expect } from 'vitest';
import { createInitialState,gameReducer } from '../gameReducer';
import { getNeighborIds } from '../../data/regions';
import { ActionTypes } from '../../data/types';
import { migrateSave,CURRENT_SAVE_VERSION } from '../saveMigrations';
import { assertGameState } from '../stateAudit';
import { resolveTurn } from '../resolveTurn';
import { HISTORICAL_EVENTS } from '../../data/events';
import { NATION_COUNTS,generateStarts } from './emergentWorld';
import { processEmergence } from '../emergence';

describe('emergent world invariants',()=>{
  it('new nations do not inherit player transport or commander references',()=>{
    const state=createInitialState({playerNationId:'fr',scenario:{mode:'emergent',nationCount:15,seed:7}});
    state.turnNumber=50;
    state.units.start_fr={...state.units.start_fr,embarkedOn:'player_fleet',commanderId:'player_general',isPretender:true};
    const added=Object.values(processEmergence(state).units).find(u=>u.id.startsWith('emerged_'));
    expect(added).toBeDefined();
    expect(added.commanderId).toBeNull();
    expect(added.embarkedOn).toBeUndefined();
    expect(added.isPretender).toBeUndefined();
    expect(added.homeRegionId).toBe(added.regionId);
  });
  it('isolated starts do not depend on previously generated games',()=>{
    const first=generateStarts('va',75,4242);
    generateStarts('fr',15,7);
    generateStarts('sg',60,2026);
    expect(generateStarts('va',75,4242)).toEqual(first);
  });
  it.each(NATION_COUNTS)('%i seeded nations have distinct starts, one province and equal armies',nationCount=>{
    const state=createInitialState({playerNationId:'fr',rngSeed:7,scenario:{mode:'emergent',nationCount,seed:7}});
    expect(Object.keys(state.nations)).toHaveLength(nationCount);
    expect(new Set(Object.values(state.scenario.starts)).size).toBe(nationCount);
    expect(state.nations.fr).toBeDefined();
    for(const n of Object.values(state.nations)){
      expect(Object.values(state.regions).filter(r=>r.owner===n.id)).toHaveLength(1);
      expect(n.militaryStrength).toBe(5000);
      expect(getNeighborIds(n.capitalRegionId).length).toBeGreaterThan(0);
    }
    expect(generateStarts('fr',nationCount,7).starts).toEqual(state.scenario.starts);
    assertGameState(state);
    const loaded=migrateSave({version:CURRENT_SAVE_VERSION,state}).state;
    expect(Object.keys(loaded.nations)).toHaveLength(nationCount);
    expect(loaded.scenario).toEqual(state.scenario);
  });
  it('spends expedition movement and blocks same-turn chaining',()=>{
    let state=createInitialState({playerNationId:'fr',rngSeed:7,scenario:{mode:'emergent',nationCount:15,seed:7}});
    state.resources={...state.resources,gold:10000,adm:100,supplies:100};
    const army=state.units.start_fr;
    const target=getNeighborIds(army.regionId).find(id=>state.regions[id].owner===null);
    state=gameReducer(state,{type:ActionTypes.FRONTIER_EXPEDITION,payload:{targetRegionId:target}});
    expect(state.regions[target].owner).toBe('fr');
    expect(state.units.start_fr.movesLeft).toBe(0);
    const nextTarget=getNeighborIds(target).find(id=>state.regions[id].owner===null);
    const next=gameReducer(state,{type:ActionTypes.FRONTIER_EXPEDITION,payload:{targetRegionId:nextTarget}});
    expect(next.regions).toBe(state.regions);
    expect(state.resources.gold).toBeLessThan(10000);
    expect(migrateSave({version:CURRENT_SAVE_VERSION,state:JSON.parse(JSON.stringify(state))}).state.regions[target].neutral).toBeNull();
  });
  it('relocates an isolated player visibly and persists its active roster through turns',()=>{
    let state=createInitialState({playerNationId:'va',rngSeed:3,scenario:{mode:'emergent',nationCount:15,seed:3}});
    expect(state.scenario.relocations.some(r=>r.nationId==='va')).toBe(true);
    state={...state,firedEvents:Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id=>[id,true])),proceduralEventCooldown:99999,battleSettings:{autoDefend:true}};
    for(let i=0;i<5;i++) state=resolveTurn({...state,activeProceduralEvent:null});
    expect(state.turnNumber).toBe(6);
    expect(Object.keys(state.nations)).toHaveLength(15);
    expect(Object.values(state.regions).filter(r=>r.owner!==null).length).toBeGreaterThan(15);
    assertGameState(state);
  });
});
