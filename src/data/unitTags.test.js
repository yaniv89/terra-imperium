// Rank 16 of the AoE and Civ report: the age's own matchups and the signature units' tags.
import { describe, it, expect } from 'vitest';
import { getCounterMultiplier, COUNTER_OVERRIDES } from './unitClasses';
import { SIGNATURE_UNITS, SIGNATURE_TAGS, SIGNATURE_EDGE, signatureTagOf, signatureEdge } from './signatureUnits';
import { computeHitMultiplier } from '../engine/battle';
import { unitTagText } from '../i18n/unitTags';

describe('counter overrides and signature tags', () => {
  it('an age override replaces the triangle for that pair only', () => {
    expect(getCounterMultiplier('infantry', 'cavalry')).toBe(1.75);
    expect(getCounterMultiplier('infantry', 'cavalry', 'kingdoms')).toBe(COUNTER_OVERRIDES.kingdoms['infantry>cavalry']);
    expect(getCounterMultiplier('infantry', 'cavalry', 'classical')).toBe(1.75);
    expect(getCounterMultiplier('ranged', 'cavalry', 'modern')).toBe(1);
  });

  it('every signature unit has a tag of the menu', () => {
    Object.values(SIGNATURE_UNITS).forEach((e) => expect(Object.keys(SIGNATURE_TAGS)).toContain(signatureTagOf(e)));
    expect(signatureTagOf(SIGNATURE_UNITS.akkad)).toBe('vsCavalry'); // Sharur-bearing spearmen
  });

  it('the tag counts in the shared hit multiplier, only for its people, age, role and target', () => {
    const sig = { ownerId: 'akkad', classId: 'infantry', ageId: 'bronze' };
    const horse = { classId: 'cavalry' };
    expect(signatureEdge(sig, horse)).toBe(SIGNATURE_EDGE);
    expect(signatureEdge({ ...sig, ageId: 'classical' }, horse)).toBe(1);
    expect(signatureEdge({ ...sig, ownerId: 'mari_not' }, horse)).toBe(1);
    expect(signatureEdge(sig, { classId: 'ranged' })).toBe(1);
    const plain = computeHitMultiplier({ ...sig, ownerId: 'nobody' }, horse, { phase: 'melee', sourceAgeId: 'bronze', targetAgeId: 'bronze' });
    const tagged = computeHitMultiplier(sig, horse, { phase: 'melee', sourceAgeId: 'bronze', targetAgeId: 'bronze' });
    expect(tagged / plain).toBeCloseTo(SIGNATURE_EDGE, 6);
  });

  it('the line the build list and army sheet show', () => {
    expect(unitTagText('akkad', 'bronze', 'infantry')).toMatch(/Signature: \+25% vs/);
    expect(unitTagText('akkad', 'kingdoms', 'infantry')).toMatch(/This age: x2.2 vs/);
    expect(unitTagText('akkad', 'classical', 'ranged')).toBeNull();
  });
});
