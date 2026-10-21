import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { getNationCapital } from '../../data/regions';
import { addCity } from '../../engine/testWorld';
import { cityRailModel, shortItemLabel, perTurnStrip } from './cityRailModel';
import { calcNationBalance } from '../../engine/economy';
import { calcIncome } from '../../utils/helpers';
import { peoplesWorld } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 7 });
const FR = WORLD.playerNationId;

describe('city rail model', () => {
  it('lists the player\'s cities biggest first with growth, the build and the flags', () => {
    const s0 = peoplesWorld({ seed: 7 });
    const paris = getNationCapital(FR);
    const added = addCity(s0, FR, { near: paris, size: 1 });
    let s = added.state;
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: paris, item: { kind: 'building', category: 'food', tier: 0 } } });
    // The list reads the live city (cityEconomy.js), not last turn's mirror: the second city really
    // starves (twelve citizens on its centre tile alone), whatever `lastYields` says.
    const second = s.regions[added.cityId];
    const withYields = { ...s, regions: { ...s.regions, [paris]: { ...s.regions[paris], lastYields: { food: 4, production: 5, gold: 2 }, food: 0 }, [added.cityId]: { ...second, size: 12, tiles: [second.tile], locked: [], lastYields: { food: 9, production: 1, gold: 0 }, unrest: 60, siege: { hp: 10 } } } };
    const rows = cityRailModel(withYields);
    expect(rows.map((r) => r.id)).toEqual([paris, added.cityId]); // the capital leads
    expect(rows[0]).toMatchObject({ capital: true, building: 'Storage Pits', idle: false, starving: false, restless: false });
    expect(rows[0].buildTurns).toBeGreaterThan(0);
    expect(rows[0].buildShare).toBe(0); // nothing built yet: an empty production bar
    expect(rows[1].buildShare).toBeNull();
    expect(rows[0].growthTurns).toBeGreaterThan(0);
    expect(rows[1]).toMatchObject({ capital: false, idle: true, starving: true, restless: true, besieged: true, growthTurns: null });
    expect(cityRailModel({ ...s0, playerNationId: 'nope' })).toEqual([]);
  }, 30000);
  it('names build items shortly and the per-turn strip reads the balance', () => {
    expect(shortItemLabel({ kind: 'settler' })).toBe('Settlers');
    expect(shortItemLabel({ kind: 'unit', classId: 'infantry' })).toMatch(/\w/);
    expect(shortItemLabel({ kind: 'unit', classId: 'naval', navalLine: 'raider' })).toBe('Raider');
    expect(shortItemLabel(null)).toBeNull();
    const s = peoplesWorld({ seed: 7 });
    const rows = perTurnStrip(s, calcNationBalance(s, FR), calcIncome(s));
    expect(rows[0]).toMatchObject({ id: 'gold' });
    expect(rows.find((r) => r.id === 'science')).toBeTruthy();
  });
});
