import { describe,it,expect } from 'vitest';
import { createInitialState,gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getTermCost } from './peace';
import { transferRegion } from './regionTransfer';
import { canSubjugate,reconcileTerritory } from './worldLifecycle';
import { getOwnedRegionIds,getBorderingNationIds,invalidateRegionsCache } from '../data/regions';
import { auditGameState } from './stateAudit';
import { addCity } from './testWorld';
describe('territory and subject lifecycle',()=>{
  it('rejects subjugating the overlord and subject chains',()=>{
    const s=createInitialState({playerNationId:'fr',rngSeed:7});
    s.nations.fr.vassalOf='de';s.nations.de.vassals=['fr'];
    expect(canSubjugate(s.nations,'fr','de')).toBe(false);
    expect(gameReducer(s,{type:ActionTypes.VASSALIZE,payload:{nationId:'de'}})).toBe(s);
    expect(getTermCost(s,{aggressor:'fr',enemy:'de'},'fr',{type:'vassalize'})).toBe(Infinity);
  });
  it('peaceful transfers remove old war scoring markers',()=>{
    const r={id:'fr-75',owner:'fr',conquest:{warId:'old',from:'de'},occupiedBy:'it',underInvasion:true};
    const moved=transferRegion(r,'de',{de:{id:'de'}}).region;
    expect(moved.conquest).toBeUndefined();expect(moved.occupiedBy).toBeUndefined();
  });
  it('refreshes cached ownership and capitals at a draft boundary',()=>{
    const s=addCity(createInitialState({playerNationId:'fr',rngSeed:7}),'de').state;
    const id=s.nations.de.capitalRegionId;
    const old=getOwnedRegionIds(s.regions,'de').length;
    getBorderingNationIds(s.regions,'de');
    s.regions[id]={...s.regions[id],owner:'fr'};
    invalidateRegionsCache(s.regions);
    const next=reconcileTerritory(s);
    expect(getOwnedRegionIds(next.regions,'de')).toHaveLength(old-1);
    expect(next.regions[next.nations.de.capitalRegionId].owner).toBe('de');
  });
  it('reports a cycle even if reciprocal subject lists appear valid',()=>{
    const s=createInitialState({playerNationId:'fr',rngSeed:7});
    s.nations.fr.vassalOf='de';s.nations.de.vassalOf='fr';s.nations.fr.vassals=['de'];s.nations.de.vassals=['fr'];
    expect(auditGameState(s).some(i=>i.code==='vassal_cycle')).toBe(true);
  });
});

describe('a vassal that loses its last city', () => {
  it('is eliminated with its vassal link cleared, and drops off its overlord\'s list', async () => {
    const { createInitialState } = await import('./gameReducer');
    const { auditGameState } = await import('./stateAudit');
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const it0 = s.nations.it; const va = s.nations.va;
    const linked = { ...s, nations: { ...s.nations, it: { ...it0, vassalOf: 'va', vassalizedTurn: 3 }, va: { ...va, vassals: ['it'] } } };
    // Italy's cities all pass to the Vatican.
    const regions = Object.fromEntries(Object.entries(linked.regions).map(([id, r]) => [id, r.owner === 'it' ? { ...r, owner: 'va' } : r]));
    const out = reconcileTerritory({ ...linked, regions });
    expect(out.nations.it.isEliminated).toBe(true);
    expect(out.nations.it.vassalOf).toBeNull();
    expect(out.nations.va.vassals).toEqual([]);
    expect(auditGameState(out).filter((v) => v.code === 'vassal_link')).toEqual([]);
  });
});
