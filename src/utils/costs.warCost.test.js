import { describe, it, expect } from 'vitest';
import { warCost } from './costs';
import { withAgesResearched } from '../engine/research';
import { ACTION_COSTS } from '../data/actionCosts';
import { peoplesWorld } from '../engine/testWorld';

describe('war price (lead 29 Oct)', () => {
  it('is a decree with a cause, else 150 gold times the payer age unitCostMult', () => {
    const S = peoplesWorld({ seed: 7 });
    expect(warCost(S, true)).toBe(ACTION_COSTS.declareWarJustified);
    expect(warCost(S, false)).toEqual({ gold: 150 });
    expect(warCost(withAgesResearched(S, S.playerNationId, 'kingdoms'), false)).toEqual({ gold: 330 });
  });
});
