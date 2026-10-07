import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { getNationCapital } from '../../data/regions';
import { addCity } from '../../engine/testWorld';
import { cityRailModel, shortItemLabel, perTurnStrip } from './cityRailModel';
import { calcNationBalance } from '../../engine/economy';
import { calcIncome } from '../../utils/helpers';

describe('city rail model', () => {
  it('lists the player\'s cities biggest first with growth, the build and the flags', () => {
    const s0 = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const paris = getNationCapital('fr');
    const added = addCity(s0, 'fr', { near: paris, size: 1 });
    let s = added.state;
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: paris, item: { kind: 'building', category: 'food', tier: 0 } } });
    const withYields = { ...s, regions: { ...s.regions, [paris]: { ...s.regions[paris], lastYields: { food: 4, production: 5, gold: 2 }, food: 0 }, [added.cityId]: { ...s.regions[added.cityId], lastYields: { food: -1, production: 1, gold: 0 }, unrest: 60, siege: { hp: 10 } } } };
    const rows = cityRailModel(withYields);
    expect(rows.map((r) => r.id)).toEqual([paris, added.cityId]);
    expect(rows[0]).toMatchObject({ capital: true, building: 'Granary', idle: false, starving: false, restless: false });
    expect(rows[0].buildTurns).toBeGreaterThan(0);
    expect(rows[0].buildShare).toBe(0); // nothing built yet: an empty production bar
    expect(rows[1].buildShare).toBeNull();
    expect(rows[0].growthTurns).toBeGreaterThan(0);
    expect(rows[1]).toMatchObject({ capital: false, idle: true, starving: true, restless: true, besieged: true, growthTurns: null });
    expect(cityRailModel({ ...s0, playerNationId: 'nope' })).toEqual([]);
  });
  it('names build items shortly and the per-turn strip reads the balance', () => {
    expect(shortItemLabel({ kind: 'settler' })).toBe('Settlers');
    expect(shortItemLabel({ kind: 'unit', classId: 'infantry' })).toMatch(/\w/);
    expect(shortItemLabel({ kind: 'unit', classId: 'naval', navalLine: 'raider' })).toBe('Raider');
    expect(shortItemLabel(null)).toBeNull();
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const rows = perTurnStrip(s, calcNationBalance(s, 'fr'), calcIncome(s));
    expect(rows[0]).toMatchObject({ id: 'gold' });
    expect(rows.find((r) => r.id === 'science')).toBeTruthy();
  });
});
