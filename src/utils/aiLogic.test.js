import { describe, it, expect } from 'vitest';
import { processAINationTurn, processAllAINations, getRelationFromHostility } from './aiLogic';
import { createRng } from './rng';
import { RelationStatus } from '../data/types';

const aiNation = (overrides = {}) => ({
  id: 'fr',
  isPlayer: false,
  isAtWar: false,
  hostility: 50,
  hostilityFloor: 0,
  militaryStrength: 15000,
  aggression: 0.1,
  doctrine: 'cautious',
  ...overrides
});

describe('processAINationTurn', () => {
  it('is a no-op for the player\'s own nation', () => {
    const updates = processAINationTurn({ ...aiNation(), isPlayer: true }, {}, 1950, createRng(1));
    expect(updates).toEqual({ militaryStrengthChange: 0, hostilityChange: 0, logs: [] });
  });

  it('grows military strength over time', () => {
    const updates = processAINationTurn(aiNation(), {}, 1950, createRng(5));
    expect(updates.militaryStrengthChange).toBeGreaterThan(0);
  });

  it('decays hostility down toward its floor', () => {
    const updates = processAINationTurn(aiNation({ hostility: 50, hostilityFloor: 10 }), {}, 1950, createRng(5));
    expect(updates.hostilityChange).toBeLessThan(0);
  });

  it('does not decay hostility once at its floor', () => {
    const updates = processAINationTurn(aiNation({ hostility: 10, hostilityFloor: 10 }), {}, 1950, createRng(5));
    expect(updates.hostilityChange).toBe(0);
  });

  it('is deterministic given the same rng sequence', () => {
    const a = processAINationTurn(aiNation(), {}, 1950, createRng(99));
    const b = processAINationTurn(aiNation(), {}, 1950, createRng(99));
    expect(a).toEqual(b);
  });
});

describe('processAllAINations', () => {
  it('produces a growth/hostility update for every non-player nation, and none for the player', () => {
    const state = {
      nations: {
        fr: aiNation({ id: 'fr' }),
        de: aiNation({ id: 'de' }),
        us: { ...aiNation({ id: 'us' }), isPlayer: true }
      }
    };
    const result = processAllAINations(state, 1950, createRng(1));
    expect(Object.keys(result.nationUpdates).sort()).toEqual(['de', 'fr']);
  });
});

describe('getRelationFromHostility', () => {
  it('war overrides everything', () => {
    expect(getRelationFromHostility(0, true, true, true)).toBe(RelationStatus.WAR);
  });

  it('trade agreement reads as friendly', () => {
    expect(getRelationFromHostility(90, false, false, true)).toBe(RelationStatus.FRIENDLY);
  });

  it('peace treaty reads as cold peace', () => {
    expect(getRelationFromHostility(90, false, true, false)).toBe(RelationStatus.COLD_PEACE);
  });

  it('high hostility with no treaty reads as hostile', () => {
    expect(getRelationFromHostility(85, false, false, false)).toBe(RelationStatus.HOSTILE);
  });

  it('low hostility with no treaty reads as neutral', () => {
    expect(getRelationFromHostility(10, false, false, false)).toBe(RelationStatus.NEUTRAL);
  });
});
