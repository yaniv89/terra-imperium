import { describe, it, expect } from 'vitest';
import { researchLeaderAge, strongestKnownMajor, independentAgeOf, sideAgeOf } from './ageRefs';
import { contactsOf } from './techDiffusion';
import { peoplesWorld, addCity } from './testWorld';
import { FIRST_AGE_ID } from '../data/ages';
import { tributeGold, tradeGoldOf, mercPrice, mercUpkeep, independentSizeCap, MERC_SELLERS } from '../data/independents';
import { tributePerTurn } from './tributePricing';
import { tradeCheck } from './indepPolicy';
import { mercOffer } from './mercenaries';
import { independentCityCtx } from './independents';
import { raidForecast } from './raids';

// Eight-ages plan U7 (KTD2): the two tech-only age references.
describe('researchLeaderAge', () => {
  const state = {
    playerNationId: 'p',
    techAgeId: 'classical',
    nations: {
      p: { id: 'p' },
      a: { id: 'a', tech: { ageId: 'kingdoms' } },
      i: { id: 'i', kind: 'independent', tech: { ageId: 'modern' } },
      c: { id: 'c', tech: { ageId: 'gunpowder' } }, // no city
      e: { id: 'e', isEliminated: true, tech: { ageId: 'modern' } }
    },
    regions: { r1: { owner: 'p', size: 2 }, r2: { owner: 'a', size: 1 }, r3: { owner: 'i', size: 1 }, r4: { owner: 'e', size: 1 }, r5: { owner: 'c', size: 1, outpost: true } }
  };

  it('is the highest age among living majors with a city: independents and cityless nations are left out', () => {
    expect(researchLeaderAge(state)).toBe('kingdoms');
  });

  it('follows the player when the player leads', () => {
    expect(researchLeaderAge({ ...state, nations: { ...state.nations }, techAgeId: 'gunpowder' })).toBe('gunpowder');
  });

  it('is the first age in an empty world', () => {
    expect(researchLeaderAge({ playerNationId: 'p', nations: {}, regions: {} })).toBe(FIRST_AGE_ID);
  });
});

describe('strongestKnownMajor', () => {
  const world = peoplesWorld({ seed: 11, independents: true });
  const indep = Object.keys(world.nations).sort().find((id) => world.nations[id].kind === 'independent' && contactsOf(world, id).size > 0);

  it('is the known major with the largest economy, and never an independent', () => {
    const id = strongestKnownMajor(world, indep);
    expect(id).toBeTruthy();
    expect(world.nations[id].kind).not.toBe('independent');
    expect(contactsOf(world, indep).has(id)).toBe(true);
  });

  it('does not depend on the key order of state.nations', () => {
    const reversed = Object.fromEntries(Object.entries(world.nations).reverse());
    expect(strongestKnownMajor({ ...world, nations: reversed, regions: { ...world.regions } }, indep)).toBe(strongestKnownMajor(world, indep));
  });

  it('is null for an independent that knows no major', () => {
    const lone = { ...world, nations: { [indep]: world.nations[indep] }, regions: Object.fromEntries(Object.entries(world.regions).filter(([, c]) => c.owner === indep)) };
    expect(strongestKnownMajor(lone, indep)).toBeNull();
  });
});

describe('independentAgeOf and sideAgeOf', () => {
  const world = peoplesWorld({ seed: 11, independents: true });
  const indep = Object.keys(world.nations).sort().find((id) => world.nations[id].kind === 'independent' && contactsOf(world, id).size > 0);

  it('an independent reads the age of its strongest known major', () => {
    // Every major to Kingdoms (a lone advance would widen the contact reach and change who is known).
    const nations = Object.fromEntries(Object.entries(world.nations).map(([id, n]) => [id, n.kind === 'independent' ? n : { ...n, tech: { ...n.tech, ageId: 'kingdoms' } }]));
    const s = { ...world, nations, techAgeId: 'kingdoms' };
    const major = strongestKnownMajor(s, indep);
    expect(independentAgeOf(s, indep)).toBe('kingdoms');
    expect(sideAgeOf(s, indep)).toBe('kingdoms');
    expect(sideAgeOf(s, major)).toBe('kingdoms');
  });

  it('an independent that knows no major is in the first age', () => {
    const lone = { ...world, nations: { [indep]: world.nations[indep] }, regions: Object.fromEntries(Object.entries(world.regions).filter(([, c]) => c.owner === indep)) };
    expect(independentAgeOf(lone, indep)).toBe(FIRST_AGE_ID);
  });
});

// Eight-ages plan U8 (KTD8): every independent price and the raid factor follow independentAgeOf.
describe('independents price and raid at independentAgeOf', () => {
  const world = peoplesWorld({ seed: 11, independents: true });
  // Every major moves to the age together: one major alone ahead would widen everyone's contact
  // reach (it is the research leader, KTD5) and could change who the strongest known major is.
  const withMajorAge = (state, major, ageId) => ({
    ...state,
    techAgeId: ageId,
    nations: Object.fromEntries(Object.entries(state.nations).map(([id, n]) => [id, n.kind === 'independent' ? n : { ...n, tech: { ...n.tech, ageId } }]))
  });
  // An independent that knows a major, whose personality sells bands and raids.
  const indep = Object.keys(world.nations).sort().find((id) => {
    const n = world.nations[id];
    return n.kind === 'independent' && MERC_SELLERS.includes(n.indep?.personality) && strongestKnownMajor(world, id);
  });
  const major = strongestKnownMajor(world, indep);
  // (Contact reach still reads the calendar age until its own unit, so the world's age is left alone.)
  const at = (ageId) => withMajorAge(world, major, ageId);

  it('the tribute price follows the strongest known major, not the calendar', () => {
    expect(indep).toBeTruthy();
    const poor = (s) => ({ ...s, regions: Object.fromEntries(Object.entries(s.regions).map(([k, c]) => [k, c.owner === major ? { ...c, dev: { ...c.dev, tax: 0, production: 0 } } : c])) });
    expect(tributePerTurn(poor(at('kingdoms')), major, indep)).toBe(tributeGold('kingdoms'));
    expect(tributePerTurn(poor(at('bronze')), major, indep)).toBe(tributeGold('bronze'));
  });

  it('the trade gold in the check follows the same age', () => {
    const mercantile = (s) => ({ ...s, nations: { ...s.nations, [indep]: { ...s.nations[indep], indep: { ...s.nations[indep].indep, personality: 'mercantile' } } } });
    const text = (s) => tradeCheck(mercantile(s), indep, major).reason || '';
    const k = text(at('kingdoms')); const b = text(at('bronze'));
    if (k.includes('gold') && b.includes('gold')) {
      expect(k).toContain(String(tradeGoldOf('kingdoms')));
      expect(b).toContain(String(tradeGoldOf('bronze')));
    }
  });

  it('the mercenary price and upkeep follow the same age', () => {
    const s = at('kingdoms');
    const offer = mercOffer(s, indep, major);
    if (offer.ok) {
      expect(offer.price).toBe(mercPrice('kingdoms'));
      expect(offer.upkeep).toBe(mercUpkeep('kingdoms'));
      expect(mercOffer(at('bronze'), indep, major).price).toBe(mercPrice('bronze'));
    }
  });

  it('an independent with no known major prices at the first age', () => {
    const lone = { ...world, age: 'modern', nations: { [indep]: world.nations[indep] }, regions: Object.fromEntries(Object.entries(world.regions).filter(([, c]) => c.owner === indep)) };
    expect(tributePerTurn(lone, indep, indep)).toBe(tributeGold(FIRST_AGE_ID));
  });

  it('the size cap of its cities follows the same age', () => {
    expect(independentCityCtx(at('kingdoms'), indep).maxSize).toBe(independentSizeCap('kingdoms'));
    expect(independentCityCtx(at('bronze'), indep).maxSize).toBe(independentSizeCap('bronze'));
  });

  it('the raid factor falls as the strongest known major reaches later ages', () => {
    // A tribal independent with a city of its strongest known major (the player) two rings away.
    const id = Object.keys(world.nations).sort().find((x) => world.nations[x].kind === 'independent' && contactsOf(world, x).has(world.playerNationId));
    const base = { ...world, nations: { ...world.nations, [id]: { ...world.nations[id], indep: { ...world.nations[id].indep, personality: 'tribal', truceWith: {} } } } };
    const { state: s0 } = addCity(base, base.playerNationId, { near: base.nations[id].capitalRegionId, size: 4, loose: true });
    // Make the player the strongest major it knows, whatever the map says.
    const big = { ...s0, regions: Object.fromEntries(Object.entries(s0.regions).map(([k, c]) => [k, c.owner === s0.playerNationId ? { ...c, size: 40 } : c])) };
    expect(strongestKnownMajor(big, id)).toBe(big.playerNationId);
    const score = (ageId) => raidForecast({ ...big, techAgeId: ageId }, id, big.playerNationId)?.score;
    const k = score('kingdoms'); const g = score('gunpowder'); const mo = score('modern');
    expect(k).toBeTypeOf('number');
    expect(g).toBeLessThan(k); // RAID_ERA_FACTOR 1 -> 0.8
    expect(mo).toBeLessThan(g); // -> 0.5
    expect(score('classical')).toBeCloseTo(k, 9); // 1 -> 1
  });
});
