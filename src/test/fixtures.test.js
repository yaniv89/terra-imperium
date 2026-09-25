import { describe, it, expect } from 'vitest';
import { cap, makeState } from './fixtures';
import { getNationCapital } from '../data/regions';

describe('cap', () => {
  it('is the same function as getNationCapital', () => {
    expect(cap).toBe(getNationCapital);
    expect(cap('fr')).toBe(getNationCapital('fr'));
  });
});

describe('makeState', () => {
  it('defaults to a fresh state for France at normal speed', () => {
    const state = makeState();
    expect(state.playerNationId).toBe('fr');
    expect(state.gameSpeed).toBe('normal');
  });

  it('merges resource overrides on top of the fresh defaults, leaving other resources untouched', () => {
    const state = makeState({ resources: { gold: 100000 } });
    expect(state.resources.gold).toBe(100000);
    expect(state.resources.hr).toBe(makeState().resources.hr); // untouched, matches a fresh state's own default
  });

  it('applies top-level overrides (e.g. age) alongside resource overrides', () => {
    const state = makeState({ overrides: { age: 'modern', techAgeId: 'modern' }, resources: { techPoints: 100000 } });
    expect(state.age).toBe('modern');
    expect(state.techAgeId).toBe('modern');
    expect(state.resources.techPoints).toBe(100000);
  });

  it('respects a different playerNationId', () => {
    const state = makeState({ playerNationId: 'de' });
    expect(state.playerNationId).toBe('de');
    expect(state.nations.de.isPlayer).toBe(true);
  });
});
