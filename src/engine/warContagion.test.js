import { describe, it, expect } from 'vitest';
import { updateWarHeat, warContagionMult, heatKernel, HEAT_DECAY, HEAT_ALPHA, HEAT_MULT_MAX, HEAT_REACH_KM, HEAT_KM } from './warContagion';
import { createInitialState } from '../context/GameContext';
import { getTiles } from '../data/geo/tiles';
import { getCapital } from '../data/regions';
import { tileKm } from './tradeValue';

describe('war contagion (Hawkes)', () => {
  it('the kernel falls with km and ends at the reach', () => {
    expect(heatKernel(0)).toBe(1);
    expect(heatKernel(HEAT_KM)).toBeCloseTo(0.5, 10);
    expect(heatKernel(HEAT_REACH_KM + 1)).toBe(0);
  });
  it('the multiplier is 1 when calm and soft-capped at 1 + HEAT_MULT_MAX', () => {
    expect(warContagionMult({})).toBe(1);
    expect(warContagionMult({ warHeat: 1 })).toBeCloseTo(1 + HEAT_MULT_MAX / 2, 10);
    expect(warContagionMult({ warHeat: 1e9 })).toBeLessThan(1 + HEAT_MULT_MAX);
  });
  const state = createInitialState({ playerNationId: 'au', rngSeed: 4 });
  const war = { aggressor: 'de', enemy: 'pl', active: true, startTurn: state.turnNumber };
  it('a new war heats its neighbours by distance, not its belligerents or the far side of the world', () => {
    const next = updateWarHeat(state.nations, [war], state.turnNumber, state);
    expect(next.de.warHeat).toBeUndefined();
    expect(next.pl.warHeat).toBeUndefined();
    expect(next.cz.warHeat).toBeGreaterThan(0);
    expect(next.cz.warHeat).toBeLessThanOrEqual(HEAT_ALPHA);
    expect(next.au.warHeat).toBeUndefined();
    const tiles = getTiles(); const cap = (id) => state.regions[getCapital(state, id)].tile;
    const near = (id) => Math.min(tileKm(tiles, cap(id), cap('de')), tileKm(tiles, cap(id), cap('pl')));
    if (near('fr') > near('cz')) expect(next.fr.warHeat || 0).toBeLessThan(next.cz.warHeat);
  });
  it('decays geometrically and is cleared once negligible; old wars do not excite again', () => {
    let n = updateWarHeat(state.nations, [war], state.turnNumber, state);
    const h0 = n.cz.warHeat;
    n = updateWarHeat(n, [war], state.turnNumber + 1, state);
    expect(n.cz.warHeat).toBeCloseTo(h0 * HEAT_DECAY, 3);
    for (let t = 2; t < 80; t++) n = updateWarHeat(n, [war], state.turnNumber + t, state);
    expect(n.cz.warHeat).toBeUndefined();
  });
  it('returns the same object on a quiet turn', () => {
    expect(updateWarHeat(state.nations, [], 5, state)).toBe(state.nations);
  });
});
