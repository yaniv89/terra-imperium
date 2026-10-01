import { describe, it, expect, vi } from 'vitest';
import { advanceCampaign, parseArgs } from './simulate.mjs';

describe('campaign benchmark', () => {
  it.each(['0', '-1', 'NaN', '1.5'])('rejects invalid turn budgets %s', value => {
    expect(() => parseArgs(['--turns', value])).toThrow('Invalid --turns');
  });
  it('answers blocking peace offers before advancing', () => {
    const engine = {
      ActionTypes: { ACCEPT_PENDING_PEACE: 'accept', REJECT_PENDING_PEACE: 'reject' },
      gameReducer: vi.fn(s => ({ ...s, pendingPeaceOffer: null })),
      resolveTurn: s => s.pendingPeaceOffer ? s : { ...s, turnNumber: s.turnNumber + 1 },
      assertGameState: vi.fn()
    };
    const state = { gameStatus: 'ACTIVE', turnNumber: 4, pendingPeaceOffer: { terms: [] } };
    expect(advanceCampaign(engine, state).turnNumber).toBe(5);
    expect(engine.gameReducer).toHaveBeenCalledWith(state, { type: 'accept' });
    expect(engine.assertGameState).toHaveBeenCalledOnce();
  });
  it('fails rather than count a blocked iteration as a turn', () => {
    const engine = { resolveTurn: s => s, assertGameState: vi.fn() };
    expect(() => advanceCampaign(engine, { gameStatus: 'ACTIVE', turnNumber: 4 })).toThrow('Campaign stalled at turn 4');
  });
});
