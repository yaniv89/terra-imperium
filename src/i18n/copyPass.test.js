// src/i18n/copyPass.test.js
// Mobile campaign audit H-20: no developer notes in player text, no raw keys, correct plurals,
// and a march line that reads as one sentence.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { translate, tableOf } from './index';
import { GREAT_PROJECTS } from '../data/greatProjects';
import { GOVERNMENT_TYPES, GOVERNMENT_REFORMS } from '../data/government';

describe('copy pass (H-20)', () => {
  it('great project text has no milestone notes', () => {
    for (const p of Object.values(GREAT_PROJECTS)) {
      expect(p.description, p.id).not.toMatch(/\bM\d+\b|wired/);
    }
  });
  it('government text has no dev notes', () => {
    const texts = [];
    for (const g of Object.values(GOVERNMENT_TYPES)) texts.push([g.id, g.description]);
    for (const byAge of Object.values(GOVERNMENT_REFORMS)) for (const list of Object.values(byAge)) for (const r of list) texts.push([r.id, r.description]);
    expect(texts.length).toBeGreaterThan(10);
    for (const [id, d] of texts) expect(d || '', id).not.toMatch(/wired|not yet|\bM\d+\b/i);
  });
  it('the pre-battle card uses a key that exists', () => {
    const src = readFileSync('src/components/battle/PreBattleModal.jsx', 'utf8');
    const en = tableOf('en');
    for (const [, key] of src.matchAll(/\bt\('([\w.]+)'/g)) {
      const hit = en[key] ?? en[`${key}.other`];
      expect(hit, key).toBeTruthy();
    }
  });
  it('one turn and one supply are singular, in both languages', () => {
    expect(translate('march.turns', { count: 1 }, 'en')).toBe('1 turn');
    expect(translate('march.suppliesCount', { count: 1 }, 'en')).toBe('1 supply');
    expect(translate('march.suppliesCount', { count: 4 }, 'en')).toBe('4 supplies');
    expect(translate('research.turnsCount', { count: 1 }, 'en')).toBe('1 turn');
    expect(translate('march.suppliesCount', { count: 4 }, 'he')).toBe('4 אספקה');
  });
  it('the march line has no stray punctuation', () => {
    const line = translate('march.toTurns', { target: 'Waset', turns: '1 turn' }, 'en') + translate('march.setsOut', null, 'en')
      + translate('march.supplies', { supplies: '1 supply' }, 'en') + translate('march.moveNowNote', null, 'en');
    expect(line).toBe('To Waset: 1 turn, it sets out now, about 1 supply. Move now arrives this turn.');
    expect(line).not.toMatch(/\. ,|\.\./);
  });
});
