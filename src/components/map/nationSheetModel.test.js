import { describe, it, expect } from 'vitest';
import { nationSheetModel } from './nationSheetModel';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 7 });
const FR = WORLD.playerNationId;
const DE = rivalOf(WORLD, 0);
const BE = rivalOf(WORLD, 1);

describe('nation sheet model', () => {
  const S = peoplesWorld({ seed: 7 });
  it('describes a foreign nation, its strength against yours, standing and relations', () => {
    const m = nationSheetModel(S, DE);
    expect(m.name).toBe(S.nations[DE].name);
    expect(m.cities).toBe(1); expect(m.capital).toBeTruthy();
    expect(m.strength.theirs).toBeGreaterThanOrEqual(0); expect(typeof m.strength.word).toBe('string');
    expect(typeof m.opinion).toBe('number');
    expect(m.relations).toEqual([]);
    const traded = { ...S, nations: { ...S.nations, [DE]: { ...S.nations[DE], hasTradeAgreement: true, hasMilitaryPact: true } }, wars: [{ id: 'w', aggressor: BE, enemy: FR, active: true }] };
    expect(nationSheetModel(traded, DE).relations.map((r) => r.id)).toEqual(['alliance', 'trade']);
    expect(nationSheetModel(traded, BE).relations.map((r) => r.id)).toEqual(['war']);
    expect(nationSheetModel(S, FR)).toBeNull();
    expect(nationSheetModel(S, 'zz')).toBeNull();
  });
});
