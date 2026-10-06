import { describe, it, expect } from 'vitest';
import { titleFor, nationTitle, GOVERNMENT_TITLES, EMPIRE_CITY_COUNT } from './nationTitles';
import { PEOPLES, PEOPLES_LIST } from './peoples';
import { GOVERNMENT_TYPES } from './government';

describe('titles by government and size', () => {
  const akkad = PEOPLES.akkad;
  it('reads the decided forms', () => {
    expect(titleFor(akkad, 'tribal', 1)).toBe('The Akkadian tribes');
    expect(titleFor(akkad, 'monarchy', 3)).toBe('Kingdom of Akkad');
    expect(titleFor(akkad, 'monarchy', EMPIRE_CITY_COUNT)).toBe('The Akkadian Empire');
    expect(titleFor(akkad, 'theocracy', 3)).toBe('Holy Akkad');
    expect(titleFor(akkad, 'republic', 3)).toBe('Republic of Akkad');
  });

  it('writes the titles that were missing: Dictatorship, Technocracy, Corporate State', () => {
    expect(titleFor(akkad, 'dictatorship', 3)).toBe('The Akkadian State');
    expect(titleFor(akkad, 'dictatorship', 20)).toBe('Greater Akkad');
    expect(titleFor(akkad, 'technocracy', 3)).toBe('The Akkadian Technate');
    expect(titleFor(akkad, 'corporate', 3)).toBe('The Akkadian Combine');
  });

  it('has a title for every government type, small and big', () => {
    Object.keys(GOVERNMENT_TYPES).forEach((type) => expect(GOVERNMENT_TITLES[type], type).toBeDefined());
    PEOPLES_LIST.forEach((p) => Object.keys(GOVERNMENT_TITLES).forEach((type) => [1, 30].forEach((n) => {
      const title = titleFor(p, type, n);
      expect(title, `${p.id} ${type}`).toMatch(/^[A-Z]/);
      expect(title).not.toMatch(/\{|\bthe The\b|Holy the|Greater the|of The /);
    })));
  });

  it('plural peoples read well', () => {
    expect(titleFor(PEOPLES.nuragi, 'monarchy', 2)).toBe('Kingdom of the Nuragi');
    expect(titleFor(PEOPLES.nuragi, 'theocracy', 2)).toBe('The Holy Nuragic Realm');
    expect(titleFor(PEOPLES.sarmatians, 'dictatorship', 20)).toBe('The Greater Sarmatian State');
  });

  it('the Kingdom of Israel keeps its full name until it changes government', () => {
    expect(titleFor(PEOPLES.israel, 'tribal', 1)).toBe('Kingdom of Israel');
    expect(titleFor(PEOPLES.israel, 'monarchy', 5)).toBe('Kingdom of Israel');
    expect(titleFor(PEOPLES.israel, 'monarchy', 20)).toBe('The Israelite Empire');
    expect(titleFor(PEOPLES.israel, 'republic', 5)).toBe('Republic of Israel');
    expect(titleFor(PEOPLES.bosporan_kingdom, 'monarchy', 2)).toBe('The Bosporan Kingdom');
  });

  it('a legacy nation has no title (it keeps its stored name)', () => {
    expect(nationTitle({ id: 'fr', government: { type: 'monarchy' } }, 3)).toBeNull();
    expect(nationTitle({ id: 'akkad', people: 'akkad', government: { type: 'monarchy' } }, 3)).toBe('Kingdom of Akkad');
  });
});
