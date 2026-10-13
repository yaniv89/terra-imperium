import { describe, it, expect } from 'vitest';
import { countOf, isPluralName, agree, subjectVerb, plainPlace } from './grammar';

describe('grammar helpers', () => {
  it('counts with the right plural', () => {
    expect(countOf(1, 'unit')).toBe('1 unit');
    expect(countOf(3, 'unit')).toBe('3 units');
    expect(countOf(2, 'city', 'cities')).toBe('2 cities');
  });
  it('knows plural peoples', () => {
    expect(isPluralName('The Elamite tribes')).toBe(true);
    expect(isPluralName('Norse sea raiders')).toBe(true);
    expect(isPluralName('the Mariote horde')).toBe(false);
    expect(isPluralName('Athens')).toBe(false);
  });
  it('makes the verb agree', () => {
    expect(subjectVerb('the Mariote horde', 'sack', 'Kish')).toBe('the Mariote horde sacks Kish');
    expect(subjectVerb('the Elamite tribes', 'descend', 'into civil war')).toBe('the Elamite tribes descend into civil war');
    expect(agree('Akkad', 'march')).toBe('marches');
    expect(agree('Akkad', 'carry')).toBe('carries');
  });
  it('strips the battle word from a place', () => {
    expect(plainPlace('Sack of Kish')).toBe('Kish');
    expect(plainPlace('Battle of Mari')).toBe('Mari');
    expect(plainPlace('Siege of Ur')).toBe('Ur');
    expect(plainPlace('Raid on Nippur')).toBe('Nippur');
    expect(plainPlace('Kish')).toBe('Kish');
  });
});
