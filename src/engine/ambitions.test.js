// Ambitions engine (differentiation plan U12).
import { describe, it, expect } from 'vitest';
import { ambitionOffer, ambitionDef, tickAmbitions } from './ambitions';
import { AMBITION_OFFERS, AMBITION_TEMPLATES } from '../data/ambitions';
import { HISTORICAL_AMBITIONS } from '../data/ambitionsByPeople';
import { SIGNATURE_UNITS } from '../data/signatureUnits';
import { AGE_ORDER, FIRST_AGE_ID } from '../data/ages';
import { RENOWN } from '../data/rulers';
import { createRuler } from './rulers';
import { factsUsed, FACTS } from './predicates';

// An AI nation 'p' in `ageId` that has researched `techs` techs, with no cities.
const world = (ageId, techs = [], extra = {}) => ({
  playerNationId: 'me', techTree: {}, regions: {}, turnNumber: 5,
  nations: { p: { id: 'p', ruler: { ...createRuler('p'), decrees: 0 }, tech: { ageId, researched: techs }, ...extra } }
});

describe('the offer', () => {
  it('is the same for the same nation and age, and holds templates of that age only', () => {
    AGE_ORDER.forEach((age) => {
      const a = ambitionOffer('p', age);
      expect(ambitionOffer('p', age)).toEqual(a);
      expect(a.length).toBeLessThanOrEqual(AMBITION_OFFERS);
      expect(a.length).toBeGreaterThan(0);
    });
    const firsts = ['p', 'q', 'r', 's', 't', 'u'].map((id) => ambitionOffer(id, FIRST_AGE_ID).join());
    expect(new Set(firsts).size).toBeGreaterThan(1);
  });

  it('adds the historical ambition only in the people\'s peak age', () => {
    const peak = SIGNATURE_UNITS.akkad.ageId;
    AGE_ORDER.forEach((age) => expect(ambitionOffer('akkad', age).includes(HISTORICAL_AMBITIONS.akkad.id)).toBe(age === peak));
  });

  it('every predicate names a known fact', () => {
    [...Object.values(AMBITION_TEMPLATES), ...Object.values(HISTORICAL_AMBITIONS)].forEach((a) => factsUsed(a.requires).forEach((f) => expect(FACTS[f]).toBeTypeOf('function')));
  });
});

describe('a turn of ambitions', () => {
  const lore = { ageId: FIRST_AGE_ID, offers: [{ id: 'lore', base: { techs: 1 } }], done: [] };

  it('draws the offer when the nation enters an age, with the gain base taken then', () => {
    const s = world(FIRST_AGE_ID, ['a', 'b']);
    const { nation } = tickAmbitions(s, 'p', s.nations.p, 5);
    expect(nation.ambitions.ageId).toBe(FIRST_AGE_ID);
    expect(nation.ambitions.offers.map((o) => o.id)).toEqual(ambitionOffer('p', FIRST_AGE_ID));
    const loreOffer = nation.ambitions.offers.find((o) => o.id === 'lore');
    if (loreOffer) expect(loreOffer.base).toEqual({ techs: 2 });
  });

  it('pays renown, one decree and a legacy record once', () => {
    const s = world(FIRST_AGE_ID, ['a', 'b', 'c', 'd'], { ambitions: lore });
    const once = tickAmbitions(s, 'p', s.nations.p, 6);
    expect(once.done).toEqual(['lore']);
    expect(once.nation.ruler.renown).toBeCloseTo(s.nations.p.ruler.renown + RENOWN.ambition);
    expect(once.nation.ruler.decrees).toBe(1);
    expect(once.nation.ambitions.done).toEqual([{ id: 'lore', ageId: FIRST_AGE_ID, turn: 6, legacy: 1 }]);
    const again = tickAmbitions({ ...s, nations: { p: once.nation } }, 'p', once.nation, 7);
    expect(again.done).toEqual([]);
    expect(again.nation).toBe(once.nation);
  });

  it('waits while unmet, and a new age lapses the old offers but keeps the record', () => {
    const s = world(FIRST_AGE_ID, ['a', 'b'], { ambitions: lore });
    expect(tickAmbitions(s, 'p', s.nations.p, 6).nation).toBe(s.nations.p);
    const done = [{ id: 'lore', ageId: FIRST_AGE_ID, turn: 3, legacy: 1 }];
    const next = world(AGE_ORDER[1], ['a', 'b'], { ambitions: { ...lore, done } });
    const { nation } = tickAmbitions(next, 'p', next.nations.p, 9);
    expect(nation.ambitions.ageId).toBe(AGE_ORDER[1]);
    expect(nation.ambitions.done).toEqual(done);
    expect(nation.ambitions.offers.map((o) => o.id)).toEqual(ambitionOffer('p', AGE_ORDER[1]));
  });

  it('offers nothing to a nation without a ruler', () => {
    const s = world(FIRST_AGE_ID);
    const indep = { id: 'p', tech: s.nations.p.tech };
    expect(tickAmbitions(s, 'p', indep, 5).nation).toBe(indep);
    expect(ambitionDef('nope')).toBeNull();
  });
});
