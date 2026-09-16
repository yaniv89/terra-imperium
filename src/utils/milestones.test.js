import { describe, it, expect } from 'vitest';
import { computeMilestones } from './milestones';
import { createInitialState } from '../context/GameContext';

describe('computeMilestones', () => {
  it('returns no milestones yet (content pending Phase D)', () => {
    expect(computeMilestones(createInitialState())).toEqual([]);
  });
});
