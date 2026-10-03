import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { nationSheetModel } from './nationSheetModel';

describe('nation sheet model', () => {
  const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  it('describes a foreign nation, its strength against yours, standing and relations', () => {
    const m = nationSheetModel(S, 'de');
    expect(m.name).toBe(S.nations.de.name);
    expect(m.cities).toBe(1); expect(m.capital).toBeTruthy();
    expect(m.strength.theirs).toBeGreaterThanOrEqual(0); expect(typeof m.strength.word).toBe('string');
    expect(typeof m.opinion).toBe('number');
    expect(m.relations).toEqual([]);
    const traded = { ...S, nations: { ...S.nations, de: { ...S.nations.de, hasTradeAgreement: true, hasMilitaryPact: true } }, wars: [{ id: 'w', aggressor: 'be', enemy: 'fr', active: true }] };
    expect(nationSheetModel(traded, 'de').relations.map((r) => r.id)).toEqual(['alliance', 'trade']);
    expect(nationSheetModel(traded, 'be').relations.map((r) => r.id)).toEqual(['war']);
    expect(nationSheetModel(S, 'fr')).toBeNull();
    expect(nationSheetModel(S, 'zz')).toBeNull();
  });
});
