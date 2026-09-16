import { describe, it, expect } from 'vitest';
import { pickProceduralEvent } from './proceduralEvents';
import { createInitialState } from '../context/GameContext';
import { createRng } from '../utils/rng';

describe('pickProceduralEvent', () => {
  it('returns null — no templates authored yet (Phase D3, against the new resource model)', () => {
    const state = createInitialState();
    for (let seed = 0; seed < 10; seed++) {
      expect(pickProceduralEvent(state, createRng(seed))).toBeNull();
    }
  });
});
