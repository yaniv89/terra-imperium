import { describe, it, expect } from 'vitest';
import { activeCrisis, BANNER_TURNS } from './CrisisBanner';
import { startState } from '../../engine/gameReducer';
import { crisesOn } from '../../engine/crises';

describe('crisis banner and setup option (U32)', () => {
  const s = { turnNumber: 20, crises: { history: [{ id: 'great_plague', turn: 15, nations: ['a'] }] } };
  it('follows a crisis for a few turns, then lets go', () => {
    expect(activeCrisis(s)).toMatchObject({ turn: 15, crisis: { id: 'great_plague' } });
    expect(activeCrisis({ ...s, turnNumber: 15 + BANNER_TURNS + 1 })).toBeNull();
    expect(activeCrisis({ turnNumber: 3 })).toBeNull();
  });
  it('the start option writes state.settings.crises', () => {
    const start = { playerNationId: 'akkad', rngSeed: 7, scenario: { mode: 'peoples', size: 'small', seed: 7 } };
    expect(crisesOn(startState({ ...start, crises: 'off' }))).toBe(false);
    expect(startState({ ...start, crises: 'off' }).settings.crises).toBe('off');
    expect(crisesOn(startState(start))).toBe(true);
  });
});
