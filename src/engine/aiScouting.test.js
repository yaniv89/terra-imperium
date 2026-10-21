import { describe, it, expect } from 'vitest';
import { createInitialState } from '../context/GameContext';
import { aiScout, scoutTarget, scoutsThisTurn, AI_SCOUT_PERIOD } from './aiScouting';
import { isExplored } from './fog';
import { isIndependentNation } from '../data/independents';
import { getCapital } from '../data/regions';

// CB09 I122: a major at peace sends one scout to the nearest land it has not explored.
describe('aiScouting', () => {
  const base = createInitialState({ playerNationId: 'gunditjmara', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
  const major = Object.values(base.nations).find((n) => !n.isPlayer && !isIndependentNation(n) && Object.values(base.units).some((u) => u.ownerId === n.id && u.domain === 'land' && u.classId !== 'settler'));
  const cap = base.regions[getCapital(base, major.id)];
  // Two units in the capital so one can go.
  const first = Object.values(base.units).find((u) => u.ownerId === major.id && u.domain === 'land' && u.classId !== 'settler');
  const units = { ...base.units, [first.id]: { ...first, regionId: cap.id, tile: cap.tile }, scout_test_b: { ...first, id: 'scout_test_b', regionId: cap.id, tile: cap.tile } };
  const turn = Array.from({ length: AI_SCOUT_PERIOD }, (_, i) => i + 1).find((t) => scoutsThisTurn(major.id, t));

  it('picks an unexplored land tile it may enter', () => {
    const t = scoutTarget(base, major.id, cap.tile);
    expect(t).not.toBeNull();
    expect(isExplored(base, t, major.id)).toBe(false);
  });

  it('sends one scout on its turn, keeps a unit home, and none on other turns', () => {
    const next = { ...base, turnNumber: turn, units: { ...units } };
    expect(aiScout(next, major.id)).toBe(true);
    const scouts = Object.values(next.units).filter((u) => u.scout);
    expect(scouts).toHaveLength(1);
    expect(scouts[0].route.length).toBeGreaterThan(0);
    expect(scouts[0].scout.home).toBe(cap.id);
    const other = { ...base, turnNumber: turn + 1, units: { ...units } };
    expect(aiScout(other, major.id)).toBe(false);
    expect(Object.values(other.units).some((u) => u.scout)).toBe(false);
  });

  it('a scout home again is done', () => {
    const u = Object.values(units).find((x) => x.ownerId === major.id && x.domain === 'land');
    const next = { ...base, turnNumber: turn + 1, units: { ...units, [u.id]: { ...u, scout: { home: cap.id, returning: true } } } };
    aiScout(next, major.id);
    expect(next.units[u.id].scout).toBeUndefined();
  });
});
