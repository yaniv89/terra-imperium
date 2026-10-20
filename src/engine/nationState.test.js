import { describe, it, expect } from 'vitest';
import { ageOf, ageIndexOf } from './nationState';
import { createInitialState } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { applyScenario } from './worldgen/emergentWorld';
import { FIRST_AGE_ID, getAgeIndex } from '../data/ages';
import { HISTORICAL_EVENTS } from '../data/events';

// Ages by tech (eight-ages plan U5, KTD1): a nation's age is its research age and nothing else.
describe('ageOf', () => {
  const state = {
    playerNationId: 'p',
    techAgeId: 'classical',
    year: 1900,
    age: 'modern',
    nations: { p: {}, a: { tech: { ageId: 'gunpowder' } }, b: { tech: {} } }
  };

  it('reads the research age whatever the year holds', () => {
    expect(ageOf(state, 'p')).toBe('classical');
    expect(ageOf({ ...state, year: -2000, age: 'bronze' }, 'p')).toBe('classical');
  });

  it('has no cap: a nation two ages ahead reads its own age', () => {
    expect(ageOf({ ...state, age: 'bronze', year: -2000 }, 'a')).toBe('gunpowder');
  });

  it('puts a nation with no research age, rebels and no nation in the first age', () => {
    expect(ageOf(state, 'b')).toBe(FIRST_AGE_ID);
    expect(ageOf(state, 'rebels')).toBe(FIRST_AGE_ID);
    expect(ageOf(state, null)).toBe(FIRST_AGE_ID);
  });

  it('ageIndexOf is the rank of ageOf', () => {
    expect(ageIndexOf(state, 'a')).toBe(getAgeIndex('gunpowder'));
  });

  it('a Modern era fixture is still Modern after one resolveTurn', () => {
    const base = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    let s = applyScenario(base, { mode: 'full', start: 'modern' });
    expect(ageOf(s, 'fr')).toBe('modern');
    const ai = Object.keys(s.nations).find((id) => id !== 'fr');
    expect(ageOf(s, ai)).toBe('modern');
    s = { ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    s = resolveTurn(s);
    expect(ageOf(s, 'fr')).toBe('modern');
    expect(ageOf(s, ai)).toBe('modern');
  }, 60000);
});
