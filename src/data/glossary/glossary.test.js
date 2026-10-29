import { describe, it, expect } from 'vitest';
import { GLOSSARY_KINDS, GLOSSARY_TERMS, glossaryIds, glossaryEntry } from './index';
import { hasKey } from '../../i18n/core';
import { PEOPLES_LIST } from '../peoples';

describe('glossary', () => {
  it('every people, city, tech and unit id has an entry', () => {
    GLOSSARY_KINDS.forEach((k) => {
      const ids = glossaryIds(k);
      expect(ids.length).toBeGreaterThan(5);
      ids.forEach((id) => expect(glossaryEntry(k, id), `${k} ${id}`).toBeTruthy());
    });
  });
  it('a people names its capital and land; an unknown id has no entry', () => {
    const p = PEOPLES_LIST[0];
    expect(glossaryEntry('people', p.id)).toMatchObject({ capital: p.capital.name, land: p.landName });
    expect(glossaryEntry('tech', 'nope')).toBeFalsy();
  });
  it('every people carries an English and Hebrew note and founded line', () => {
    PEOPLES_LIST.forEach((p) => {
      const e = glossaryEntry('people', p.id);
      ['note', 'founded'].forEach((f) => ['en', 'he'].forEach((l) => expect(e[f]?.[l], `${p.id} ${f} ${l}`).toBeTruthy()));
    });
  });
  it('every game term has an entry and its words in English and Hebrew', () => {
    GLOSSARY_TERMS.forEach((id) => {
      expect(glossaryEntry('term', id)).toEqual({ kind: 'term', id });
      ['en', 'he'].forEach((lang) => [`gloss.term.${id}`, `gloss.term.${id}.text`].forEach((k) => expect(hasKey(k, lang), `${k} ${lang}`).toBe(true)));
    });
    expect(glossaryEntry('term', 'nope')).toBeNull();
  });
});

describe('glossary tech and unit entries', () => {
  it('a tech names what it leads to and its boost; a tech-locked unit names its tech', () => {
    const e = glossaryEntry('tech', 'military_hunting_bands');
    expect(e.leadsTo.map((x) => x.id)).toContain('military_copper_working');
    expect(e.boost).toBeTruthy();
    const locked = glossaryIds('unit').map((id) => glossaryEntry('unit', id)).find((u) => u.needsTech);
    expect(locked && glossaryEntry('tech', locked.needsTech)).toBeTruthy();
  });
});

describe('glossary buildings, resources and improvements', () => {
  it('a building names its tech, a resource its improvement, an improvement the resources it works', () => {
    expect(glossaryEntry('building', 'food.1')).toMatchObject({ name: 'Granary', requiresTech: 'economy_granary_storage' });
    expect(glossaryEntry('resource', 'copper')).toMatchObject({ improvement: 'mine', knownTech: 'military_copper_working' });
    expect(glossaryEntry('improvement', 'mine').resources).toContain('copper');
    glossaryIds('resource').forEach((id) => expect(glossaryEntry('improvement', glossaryEntry('resource', id).improvement), id).toBeTruthy());
    expect(glossaryEntry('building', 'food.99')).toBeNull();
  });
});

describe('U7 topic cards', () => {
  it('battles, ships and diplomacy costs are terms in en and he, and their links resolve', async () => {
    const { GLOSSARY_TOPICS } = await import('./index');
    const { translate } = await import('../../i18n/core');
    expect(Object.keys(GLOSSARY_TOPICS)).toEqual(['battle', 'ships', 'diplomacy']);
    Object.entries(GLOSSARY_TOPICS).forEach(([id, links]) => {
      expect(glossaryEntry('term', id)).toEqual({ kind: 'term', id });
      links.forEach((l) => expect(glossaryEntry('term', l), `${id} -> ${l}`).toBeTruthy());
      ['en', 'he'].forEach((lang) => expect(translate(`gloss.term.${id}.text`, {}, lang).split('\n').length, `${id} ${lang}`).toBe(3));
    });
    ['en', 'he'].forEach((lang) => ['gloss.seeAlso', 'gloss.topics'].forEach((k) => expect(hasKey(k, lang), `${k} ${lang}`).toBe(true)));
  });
});
