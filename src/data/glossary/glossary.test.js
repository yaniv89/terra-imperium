import { describe, it, expect } from 'vitest';
import { GLOSSARY_KINDS, glossaryIds, glossaryEntry } from './index';
import { PEOPLES_LIST } from '../peoples';

describe('glossary', () => {
  it('every people, city, tech and unit id has an entry', () => {
    GLOSSARY_KINDS.forEach((k) => {
      const ids = glossaryIds(k);
      expect(ids.length).toBeGreaterThan(20);
      ids.forEach((id) => expect(glossaryEntry(k, id), `${k} ${id}`).toBeTruthy());
    });
  });
  it('a people names its capital and land; an unknown id has no entry', () => {
    const p = PEOPLES_LIST[0];
    expect(glossaryEntry('people', p.id)).toMatchObject({ capital: p.capital.name, land: p.landName });
    expect(glossaryEntry('tech', 'nope')).toBeFalsy();
  });
});
