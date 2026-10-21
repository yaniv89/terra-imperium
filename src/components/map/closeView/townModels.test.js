import { describe, it, expect } from 'vitest';
import { AGE_ORDER } from '../../../data/ages';
import { buildTownGeometry, countBuildings, townTier } from './townModels';

const region = (cats, extraction = {}) => ({ buildings: { categories: cats, extraction } });

describe('town models', () => {
  it('sizes the town by the buildings in the province', () => {
    expect(countBuildings(region({ food: -1, economy: -1 }))).toBe(0);
    expect(countBuildings(region({ food: 1, economy: 0 }, { copper: true }))).toBe(4);
    expect(townTier(region({ food: -1 })).id).toBe('small');
    expect(townTier(region({ food: 1, economy: 1 })).id).toBe('medium');
    expect(townTier(region({ food: 2, economy: 2, defense: 2, culture: 0 })).id).toBe('big');
  });

  it('a bigger town has more to it, and walls add a ring', () => {
    const v = (g) => g.attributes.position.count;
    const small = buildTownGeometry('fr-75', 'small');
    const medium = buildTownGeometry('fr-75', 'medium');
    const big = buildTownGeometry('fr-75', 'big');
    expect(v(medium)).toBeGreaterThan(v(small));
    expect(v(big)).toBeGreaterThan(v(medium));
    expect(v(buildTownGeometry('fr-75', 'medium', { walls: true, ageId: 'kingdoms' }))).toBeGreaterThan(v(buildTownGeometry('fr-75', 'medium', { ageId: 'kingdoms' })));
    expect(big.attributes.color).toBeDefined();
  });

  it('is the same town every time for a province, and differs between provinces', () => {
    const a = buildTownGeometry('fr-75', 'medium', { ageId: 'classical' }).attributes.position.array;
    const b = buildTownGeometry('fr-75', 'medium', { ageId: 'classical' }).attributes.position.array;
    const c = buildTownGeometry('de-by', 'medium', { ageId: 'classical' }).attributes.position.array;
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });

  it('every age and Future (not registered yet) builds a town of every size without art', () => {
    [...new Set([...AGE_ORDER, 'future'])].forEach((ageId) => ['small', 'medium', 'big'].forEach((tier) => {
      expect(buildTownGeometry('fr-75', tier, { ageId, walls: true, capital: true }).attributes.position.count, `${ageId} ${tier}`).toBeGreaterThan(50);
    }));
    expect(buildTownGeometry('fr-75', 'big', { ageId: 'future' }).attributes.position.count).not.toBe(buildTownGeometry('fr-75', 'big', { ageId: 'information' }).attributes.position.count);
  });
});
