import { describe, it, expect } from 'vitest';
import { createInitialState } from '../context/GameContext';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { AGE_LANDMARKS } from '../data/ageLandmarks';
import { AGE_ORDER } from '../data/ages';
import { pendingLandmarkAge, withLandmark, aiLandmark } from './ageLandmarks';
import { getModifier } from './modifiers/sheet';

// The AoE and Civ report's rank 13: one of two landmarks per age entered, kept for good.
describe('age landmarks', () => {
  const base = createInitialState({ playerNationId: 'akkad', rngSeed: 5, scenario: { mode: 'peoples', size: 'standard', seed: 5 } });
  const me = base.playerNationId;
  const choose = (s, ageId, landmarkId) => gameReducer(s, { type: ActionTypes.CHOOSE_AGE_LANDMARK, payload: { ageId, landmarkId } });

  it('two picks for every age after the Stone Age, none for the Stone Age', () => {
    expect(AGE_LANDMARKS.stone).toBeUndefined();
    AGE_ORDER.slice(1).forEach((a) => expect(AGE_LANDMARKS[a]).toHaveLength(2));
  });

  it('nothing waits in the Stone Age; the oldest unpicked age waits after it', () => {
    expect(pendingLandmarkAge({ ...base, techAgeId: 'stone' })).toBeNull();
    const s = { ...base, techAgeId: 'classical' };
    expect(pendingLandmarkAge(s)).toBe('bronze');
    expect(choose(s, 'classical', 'forum')).toBe(s); // not the oldest
    const after = choose(s, 'bronze', 'ziggurat');
    expect(after.nations[me].landmarks).toEqual({ bronze: 'ziggurat' });
    expect(pendingLandmarkAge(after)).toBe('classical');
    expect(choose(after, 'bronze', 'chariot_yards')).toBe(after); // never changed
    expect(choose(after, 'classical', 'nope')).toBe(after);
  });

  it('a pick is a line on the modifier sheet', () => {
    const s = { ...base, techAgeId: 'classical' };
    const before = getModifier(s, me, 'national.goldMult').total;
    const after = choose(choose(s, 'bronze', 'ziggurat'), 'classical', 'forum');
    expect(getModifier(after, me, 'national.goldMult').total).toBeCloseTo(before + 0.1, 6);
  });

  it('an AI pick is seeded by its id and the age, and one of the two', () => {
    const ids = AGE_LANDMARKS.bronze.map((l) => l.id);
    expect(ids).toContain(aiLandmark('assyria', 'bronze'));
    expect(aiLandmark('assyria', 'bronze')).toBe(aiLandmark('assyria', 'bronze'));
    expect(aiLandmark('assyria', 'stone')).toBeNull();
    const n = { id: 'x' };
    expect(withLandmark(n, 'stone', 'ziggurat')).toBe(n);
  });
});
