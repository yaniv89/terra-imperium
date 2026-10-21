// Ambitions content (differentiation plan U13): the templates and the 150 historical ambitions.
import { describe, it, expect } from 'vitest';
import { AMBITION_OFFERS, AMBITION_TEMPLATES } from './ambitions';
import { HISTORICAL_AMBITIONS, AMBITION_ROWS } from './ambitionsByPeople';
import { SIGNATURE_UNITS } from './signatureUnits';
import { PEOPLES_LIST } from './peoples';
import { AGE_ORDER, isAgeAtLeast, isAgeBefore } from './ages';
import { GREAT_PROJECTS } from './greatProjects';
import { FACTS, factsUsed } from '../engine/predicates';
import { ambitionOffer } from '../engine/ambitions';
import { MAX_SIZE } from '../engine/world/cities';

const all = [...Object.entries(AMBITION_TEMPLATES), ...Object.entries(HISTORICAL_AMBITIONS)];
const leaves = (p) => (p.all || p.any ? (p.all || p.any).flatMap(leaves) : p.not ? leaves(p.not) : [p]);

describe('ambition templates', () => {
  it('every age has at least a full offer, drawn from templates of that age', () => {
    AGE_ORDER.forEach((age) => {
      const open = Object.values(AMBITION_TEMPLATES).filter((t) => isAgeAtLeast(age, t.from) && (!t.until || isAgeBefore(age, t.until)));
      expect(open.length, age).toBeGreaterThanOrEqual(AMBITION_OFFERS);
    });
  });

  it('the first age (Stone) has its own ambitions', () => {
    expect(ambitionOffer('akkad', AGE_ORDER[0]).length).toBe(AMBITION_OFFERS);
  });
});

describe('historical ambitions', () => {
  it('every people has exactly one, with its own id', () => {
    const ids = PEOPLES_LIST.map((p) => p.id);
    ids.filter((id) => SIGNATURE_UNITS[id]).forEach((id) => expect(HISTORICAL_AMBITIONS[id], id).toBeDefined());
    expect(Object.keys(HISTORICAL_AMBITIONS).sort()).toEqual(Object.keys(SIGNATURE_UNITS).sort());
    expect(new Set(Object.values(HISTORICAL_AMBITIONS).map((a) => a.id)).size).toBe(150);
    expect(AMBITION_ROWS.length).toBe(150);
  });

  it('is offered in the peak age and no other', () => {
    Object.entries(HISTORICAL_AMBITIONS).forEach(([id, a]) => {
      AGE_ORDER.forEach((age) => expect(ambitionOffer(id, age).includes(a.id), `${id} ${age}`).toBe(age === SIGNATURE_UNITS[id].ageId));
    });
  });
});

describe('every ambition', () => {
  it('names only known facts, in plain English with no dash and no stray spaces', () => {
    all.forEach(([id, a]) => {
      factsUsed(a.requires).forEach((f) => expect(FACTS[f], `${id} fact ${f}`).toBeTypeOf('function'));
      expect(a.label, id).toMatch(/^[A-Z][^—–]*[^ .]$/);
      expect(a.label, id).not.toMatch(/ {2}|\.\./);
    });
  });

  it('can be met on a Standard world: sizes inside the engine caps, wonders and ages that exist', () => {
    const wondersAvailable = (age) => Object.values(GREAT_PROJECTS).some((g) => g.ageId && !isAgeBefore(age, g.ageId));
    all.forEach(([id, a]) => leaves(a.requires).forEach((l) => {
      const min = l.min ?? 1;
      if (l.fact === 'maxSize') expect(min, id).toBeLessThanOrEqual(MAX_SIZE);
      if (l.fact === 'cities') expect(min, id).toBeLessThanOrEqual(20);
      if (l.fact === 'resources') expect(min, id).toBeLessThanOrEqual(12);
      if (l.fact === 'wonders') expect(wondersAvailable(a.from || SIGNATURE_UNITS[id.replace(/Ambition$/, '')]?.ageId), id).toBe(true);
    }));
    Object.entries(AMBITION_TEMPLATES).forEach(([id, t]) => expect(AGE_ORDER.includes(t.from) && (!t.until || AGE_ORDER.includes(t.until)), id).toBe(true));
  });
});
