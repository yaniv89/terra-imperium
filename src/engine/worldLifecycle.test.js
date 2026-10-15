import { describe,it,expect } from 'vitest';
import { createInitialState,gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getTermCost } from './peace';
import { transferRegion } from './regionTransfer';
import { canSubjugate,reconcileTerritory } from './worldLifecycle';
import { getOwnedRegionIds,getBorderingNationIds,invalidateRegionsCache } from '../data/regions';
import { auditGameState } from './stateAudit';
import { addCity } from './testWorld';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 7 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);
const IT_ID = rivalOf(PEOPLES_WORLD, 1);
const VA_ID = rivalOf(PEOPLES_WORLD, 2);

describe('territory and subject lifecycle',()=>{
  it('rejects subjugating the overlord and subject chains',()=>{
    const s=neighbourWorld({ seed: 7 });
    s.nations[FR_ID].vassalOf=DE_ID;s.nations[DE_ID].vassals=[FR_ID];
    expect(canSubjugate(s.nations,FR_ID,DE_ID)).toBe(false);
    expect(gameReducer(s,{type:ActionTypes.VASSALIZE,payload:{nationId:DE_ID}})).toBe(s);
    expect(getTermCost(s,{aggressor:FR_ID,enemy:DE_ID},FR_ID,{type:'vassalize'})).toBe(Infinity);
  });
  it('peaceful transfers remove old war scoring markers',()=>{
    const r={id:'fr-75',owner:FR_ID,conquest:{warId:'old',from:DE_ID},occupiedBy:IT_ID,underInvasion:true};
    const moved=transferRegion(r,DE_ID,{[DE_ID]:{id:DE_ID}}).region;
    expect(moved.conquest).toBeUndefined();expect(moved.occupiedBy).toBeUndefined();
  });
  it('refreshes cached ownership and capitals at a draft boundary',()=>{
    const s=addCity(neighbourWorld({ seed: 7 }),DE_ID).state;
    const id=s.nations[DE_ID].capitalRegionId;
    const old=getOwnedRegionIds(s.regions,DE_ID).length;
    getBorderingNationIds(s.regions,DE_ID);
    s.regions[id]={...s.regions[id],owner:FR_ID};
    invalidateRegionsCache(s.regions);
    const next=reconcileTerritory(s);
    expect(getOwnedRegionIds(next.regions,DE_ID)).toHaveLength(old-1);
    expect(next.regions[next.nations[DE_ID].capitalRegionId].owner).toBe(DE_ID);
  });
  it('reports a cycle even if reciprocal subject lists appear valid',()=>{
    const s=neighbourWorld({ seed: 7 });
    s.nations[FR_ID].vassalOf=DE_ID;s.nations[DE_ID].vassalOf=FR_ID;s.nations[FR_ID].vassals=[DE_ID];s.nations[DE_ID].vassals=[FR_ID];
    expect(auditGameState(s).some(i=>i.code==='vassal_cycle')).toBe(true);
  });
});

describe('a vassal that loses its last city', () => {
  it('is eliminated with its vassal link cleared, and drops off its overlord\'s list', async () => {
    const { createInitialState } = await import('./gameReducer');
    const { auditGameState } = await import('./stateAudit');
    const s = neighbourWorld({ seed: 7 });
    const it0 = s.nations[IT_ID]; const va = s.nations[VA_ID];
    const linked = { ...s, nations: { ...s.nations, [IT_ID]: { ...it0, vassalOf: VA_ID, vassalizedTurn: 3 }, [VA_ID]: { ...va, vassals: [IT_ID] } } };
    // Italy's cities all pass to the Vatican.
    const regions = Object.fromEntries(Object.entries(linked.regions).map(([id, r]) => [id, r.owner === IT_ID ? { ...r, owner: VA_ID } : r]));
    const out = reconcileTerritory({ ...linked, regions });
    expect(out.nations[IT_ID].isEliminated).toBe(true);
    expect(out.nations[IT_ID].vassalOf).toBeNull();
    expect(out.nations[VA_ID].vassals).toEqual([]);
    expect(auditGameState(out).filter((v) => v.code === 'vassal_link')).toEqual([]);
  });
});
