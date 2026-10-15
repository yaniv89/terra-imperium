import { describe, it, expect } from 'vitest';
import { updateWarHeat, warContagionMult, heatKernel, HEAT_DECAY, HEAT_ALPHA, HEAT_MULT_MAX, HEAT_REACH_KM, HEAT_KM } from './warContagion';
import { getTiles } from '../data/geo/tiles';
import { getCapital } from '../data/regions';
import { tileKm } from './tradeValue';
import { peoplesWorld, majorIds } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js). The cast
// is chosen by distance: the two nearest majors fight, CZ is the nearest other major, FR a farther one
// and AU one beyond the contagion reach.
const PEOPLES_WORLD = peoplesWorld({ size: 'standard', seed: 4 });
const majors = majorIds(PEOPLES_WORLD);
const capTile = (id) => PEOPLES_WORLD.regions[PEOPLES_WORLD.nations[id].capitalRegionId].tile;
const kmBetween = (a, b) => tileKm(getTiles(), capTile(a), capTile(b));
const pairs = majors.flatMap((a, i) => majors.slice(i + 1).map((b) => [a, b])).sort((x, y) => kmBetween(...x) - kmBetween(...y));
const [DE_ID, PL_ID] = pairs[0];
const nearWar = (id) => Math.min(kmBetween(id, DE_ID), kmBetween(id, PL_ID));
const others = majors.filter((id) => id !== DE_ID && id !== PL_ID).sort((a, b) => nearWar(a) - nearWar(b));
const CZ_ID = others[0];
const FR_ID = others[Math.floor(others.length / 3)];
const AU_ID = others.find((id) => nearWar(id) > HEAT_REACH_KM + 500) ?? others.at(-1);

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
  const state = PEOPLES_WORLD;
  const war = { aggressor: DE_ID, enemy: PL_ID, active: true, startTurn: state.turnNumber };
  it('a new war heats its neighbours by distance, not its belligerents or the far side of the world', () => {
    const next = updateWarHeat(state.nations, [war], state.turnNumber, state);
    expect(next[DE_ID].warHeat).toBeUndefined();
    expect(next[PL_ID].warHeat).toBeUndefined();
    expect(next[CZ_ID].warHeat).toBeGreaterThan(0);
    expect(next[CZ_ID].warHeat).toBeLessThanOrEqual(HEAT_ALPHA);
    expect(next[AU_ID].warHeat).toBeUndefined();
    const tiles = getTiles(); const cap = (id) => state.regions[getCapital(state, id)].tile;
    const near = (id) => Math.min(tileKm(tiles, cap(id), cap(DE_ID)), tileKm(tiles, cap(id), cap(PL_ID)));
    if (near(FR_ID) > near(CZ_ID)) expect(next[FR_ID].warHeat || 0).toBeLessThan(next[CZ_ID].warHeat);
  });
  it('decays geometrically and is cleared once negligible; old wars do not excite again', () => {
    let n = updateWarHeat(state.nations, [war], state.turnNumber, state);
    const h0 = n[CZ_ID].warHeat;
    n = updateWarHeat(n, [war], state.turnNumber + 1, state);
    expect(n[CZ_ID].warHeat).toBeCloseTo(h0 * HEAT_DECAY, 3);
    for (let t = 2; t < 80; t++) n = updateWarHeat(n, [war], state.turnNumber + t, state);
    expect(n[CZ_ID].warHeat).toBeUndefined();
  });
  it('returns the same object on a quiet turn', () => {
    expect(updateWarHeat(state.nations, [], 5, state)).toBe(state.nations);
  });
});
