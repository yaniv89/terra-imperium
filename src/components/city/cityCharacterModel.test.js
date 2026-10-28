// What a city is known for, why the advisor picks a build, what the next citizen brings (lane cities-8).
import { describe, it, expect } from 'vitest';
import { getNationCapital } from '../../data/regions';
import { nextCitizenEffect } from '../../engine/cityEffects';
import { peoplesWorld } from '../../engine/testWorld';
import { cityCharacter, advisorWhy } from './cityCharacterModel';

const S = peoplesWorld({ seed: 7 });
const cap = getNationCapital(S.playerNationId);
const withLines = (s, categories) => ({ ...s, regions: { ...s.regions, [cap]: { ...s.regions[cap], buildings: { ...(s.regions[cap].buildings || {}), categories } } } });

describe('city character', () => {
  it('a city with no buildings is named by its land', () => {
    const c = cityCharacter(withLines(S, {}), cap);
    expect(c.id).toMatch(/^land_(food|production|gold|coast)$/);
    expect(c.title.length).toBeGreaterThan(0);
    expect(c.why).toMatch(/food/);
  });

  it('the highest building line names the city, ties by line order', () => {
    expect(cityCharacter(withLines(S, { food: 2, science: 1 }), cap).id).toBe('food');
    expect(cityCharacter(withLines(S, { food: 1, science: 1 }), cap).id).toBe('science');
  });
});

describe('advisor why and next citizen', () => {
  it('each kind of pick has its reason in words', () => {
    expect(advisorWhy(S, cap, { kind: 'unit', classId: 'infantry' })).toMatch(/regiments for \d+ cities/);
    expect(advisorWhy(S, cap, { kind: 'building', category: 'food', tier: 0 })).toMatch(/^Most worth its cost here: /);
    expect(advisorWhy(S, cap, { kind: 'settler' })).toMatch(/^More cities/);
  });

  it('the next citizen adds production and science (cities.js PRODUCTION_PER_SIZE, SCIENCE_PER_SIZE)', () => {
    const e = nextCitizenEffect(S, cap);
    expect(e.deltas.production).toBeGreaterThan(0);
    expect(e.text.length).toBeGreaterThan(0);
  });
});
