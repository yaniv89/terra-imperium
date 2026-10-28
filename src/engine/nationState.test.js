import { describe, it, expect } from 'vitest';
import { ageOf, ageIndexOf, viewAs, getResearched } from './nationState';
import { peoplesWorld, rivalOf } from './testWorld';
import { resolveTurn } from './resolveTurn';
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
    let s = peoplesWorld({ seed: 7, age: 'modern' });
    const me = s.playerNationId;
    expect(ageOf(s, me)).toBe('modern');
    const ai = rivalOf(s);
    expect(ageOf(s, ai)).toBe('modern');
    s = { ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    s = resolveTurn(s);
    expect(ageOf(s, me)).toBe('modern');
    expect(ageOf(s, ai)).toBe('modern');
  }, 60000);
});

describe('viewAs: the state as an AI nation acts in it', () => {
  const state = { playerNationId: 'p', techAgeId: 'kingdoms', techTree: { writing: { researched: true } }, resources: { gold: 5 }, nations: { p: {}, a: { tech: { ageId: 'classical', researched: ['bronzeWorking'] }, economy: { gold: 9 } } } };
  it('reads the actor as the player and keeps the human\'s age and research (they were read as the first age)', () => {
    const v = viewAs(state, 'a');
    expect([v.playerNationId, v.techAgeId, v.resources.gold]).toEqual(['a', 'classical', 9]);
    expect(ageOf(v, 'p')).toBe('kingdoms');
    expect(getResearched(v, 'p')).toEqual(['writing']);
    expect(getResearched(v, 'a')).toEqual(['bronzeWorking']);
    expect(ageOf(viewAs(v, 'p'), 'p')).toBe('kingdoms');
    expect(viewAs(state, 'p')).toBe(state);
  });
});
