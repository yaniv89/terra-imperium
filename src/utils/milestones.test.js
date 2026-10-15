import { describe, it, expect } from 'vitest';
import { computeMilestones } from './milestones';
import { peoplesWorld } from '../engine/testWorld';

describe('computeMilestones', () => {
  it('returns no milestones yet (content pending Phase D)', () => {
    expect(computeMilestones(peoplesWorld())).toEqual([]);
  });
});
