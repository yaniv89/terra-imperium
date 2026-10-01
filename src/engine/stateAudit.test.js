import { describe, it, expect } from 'vitest';
import { auditGameState, assertGameState } from './stateAudit';
import { createInitialState } from './gameReducer';

describe('state auditor', () => {
  it('accepts a seeded world without mutating it', () => {
    const state = createInitialState({ rngSeed: 7 });
    const before = JSON.stringify(state);
    expect(auditGameState(state)).toEqual([]);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('reports corrupted references, numbers, war flags, and cargo with paths', () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    state.resources.gold = NaN;
    state.nations.fr.isAtWar = true;
    state.units.bad = { id: 'bad', ownerId: 'missing', regionId: 'missing', embarkedOn: 'missing', strength: 10, maxStrength: 5 };
    const issues = auditGameState(state);
    expect(issues.map(i => i.code)).toEqual(expect.arrayContaining(['non_finite', 'war_flag', 'unknown_owner', 'missing_region', 'invalid_transport', 'range']));
    expect(() => assertGameState(state)).toThrow('State audit failed');
  });
});
