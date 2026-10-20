import { describe, it, expect } from 'vitest';
import { researchLeaderAge, strongestKnownMajor, independentAgeOf, sideAgeOf } from './ageRefs';
import { contactsOf } from './techDiffusion';
import { peoplesWorld } from './testWorld';
import { FIRST_AGE_ID } from '../data/ages';

// Eight-ages plan U7 (KTD2): the two tech-only age references.
describe('researchLeaderAge', () => {
  const state = {
    playerNationId: 'p',
    techAgeId: 'classical',
    nations: {
      p: { id: 'p' },
      a: { id: 'a', tech: { ageId: 'kingdoms' } },
      i: { id: 'i', kind: 'independent', tech: { ageId: 'modern' } },
      c: { id: 'c', tech: { ageId: 'gunpowder' } }, // no city
      e: { id: 'e', isEliminated: true, tech: { ageId: 'modern' } }
    },
    regions: { r1: { owner: 'p', size: 2 }, r2: { owner: 'a', size: 1 }, r3: { owner: 'i', size: 1 }, r4: { owner: 'e', size: 1 }, r5: { owner: 'c', size: 1, outpost: true } }
  };

  it('is the highest age among living majors with a city: independents and cityless nations are left out', () => {
    expect(researchLeaderAge(state)).toBe('kingdoms');
  });

  it('follows the player when the player leads', () => {
    expect(researchLeaderAge({ ...state, nations: { ...state.nations }, techAgeId: 'gunpowder' })).toBe('gunpowder');
  });

  it('is the first age in an empty world', () => {
    expect(researchLeaderAge({ playerNationId: 'p', nations: {}, regions: {} })).toBe(FIRST_AGE_ID);
  });
});

describe('strongestKnownMajor', () => {
  const world = peoplesWorld({ seed: 11, independents: true });
  const indep = Object.keys(world.nations).sort().find((id) => world.nations[id].kind === 'independent' && contactsOf(world, id).size > 0);

  it('is the known major with the largest economy, and never an independent', () => {
    const id = strongestKnownMajor(world, indep);
    expect(id).toBeTruthy();
    expect(world.nations[id].kind).not.toBe('independent');
    expect(contactsOf(world, indep).has(id)).toBe(true);
  });

  it('does not depend on the key order of state.nations', () => {
    const reversed = Object.fromEntries(Object.entries(world.nations).reverse());
    expect(strongestKnownMajor({ ...world, nations: reversed, regions: { ...world.regions } }, indep)).toBe(strongestKnownMajor(world, indep));
  });

  it('is null for an independent that knows no major', () => {
    const lone = { ...world, nations: { [indep]: world.nations[indep] }, regions: Object.fromEntries(Object.entries(world.regions).filter(([, c]) => c.owner === indep)) };
    expect(strongestKnownMajor(lone, indep)).toBeNull();
  });
});

describe('independentAgeOf and sideAgeOf', () => {
  const world = peoplesWorld({ seed: 11, independents: true });
  const indep = Object.keys(world.nations).sort().find((id) => world.nations[id].kind === 'independent' && contactsOf(world, id).size > 0);

  it('an independent reads the age of its strongest known major', () => {
    const major = strongestKnownMajor(world, indep);
    const s = { ...world, nations: { ...world.nations, [major]: { ...world.nations[major], tech: { ...world.nations[major].tech, ageId: 'kingdoms' } } } };
    if (major === world.playerNationId) s.techAgeId = 'kingdoms';
    expect(independentAgeOf(s, indep)).toBe('kingdoms');
    expect(sideAgeOf(s, indep)).toBe('kingdoms');
    expect(sideAgeOf(s, major)).toBe('kingdoms');
  });

  it('an independent that knows no major is in the first age', () => {
    const lone = { ...world, nations: { [indep]: world.nations[indep] }, regions: Object.fromEntries(Object.entries(world.regions).filter(([, c]) => c.owner === indep)) };
    expect(independentAgeOf(lone, indep)).toBe(FIRST_AGE_ID);
  });
});
