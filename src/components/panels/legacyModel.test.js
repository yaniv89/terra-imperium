import { describe, it, expect } from 'vitest';
import { legacyModel } from './legacyModel';
import { legacyPoints } from '../../data/legacy';
import { AGE_ORDER } from '../../data/ages';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';

const ME_AGE = AGE_ORDER[0];
describe('legacyModel', () => {
  const world = peoplesWorld({ seed: 11 });
  const me = world.playerNationId;
  const rival = rivalOf(world, 0);
  const give = (state, id, patch) => ({ ...state, nations: { ...state.nations, [id]: { ...state.nations[id], ...patch } } });

  it('groups parts by age and ranks first with the highest total', () => {
    const s = give(world, me, { eraGoals: { [ME_AGE]: { met: ['a', 'b'], legacy: true } } });
    const m = legacyModel(s);
    const p = legacyPoints(ME_AGE);
    expect(m.total).toBe(2 * p.eraGoal + p.eraLegacy);
    expect(m.ages).toEqual([{ ageId: ME_AGE, points: m.total, counts: { 'legacy.eraGoal': 2, 'legacy.eraLegacy': 1 } }]);
    expect(m.rank).toBe(1);
    expect(m.top.length).toBe(3);
  });

  it('puts a richer rival first in the top list and drops the player rank', () => {
    const s = give(world, rival, { eraGoals: { [ME_AGE]: { met: ['a', 'b', 'c'], legacy: true } } });
    const m = legacyModel(s);
    expect(m.rank).toBeGreaterThan(1);
    expect(m.top[0]).toEqual({ nationId: rival, legacy: 3 * legacyPoints(ME_AGE).eraGoal + legacyPoints(ME_AGE).eraLegacy });
  });
});
