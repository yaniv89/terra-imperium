import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getNationCapital } from '../data/regions';
import { buildingOrder, BUILDING_PRIORITY, chooseProduction } from './aiProduction';
import { DOCTRINE_BUILDING_PRIORITY, DOCTRINE_IDS } from '../data/nations';
import { BUILDING_CATEGORIES } from '../data/buildings';

describe('AI building templates (the doctrine order)', () => {
  it('every doctrine orders every line once, its own preferences first', () => {
    DOCTRINE_IDS.forEach((d) => {
      const order = buildingOrder(d);
      expect([...order].sort()).toEqual([...BUILDING_PRIORITY].sort());
      const liked = DOCTRINE_BUILDING_PRIORITY[d].filter((c) => BUILDING_PRIORITY.includes(c));
      expect(order.slice(0, liked.length)).toEqual(liked);
    });
    expect(buildingOrder(undefined)).toEqual(BUILDING_PRIORITY);
  });
  it('a blitz city builds its first military line before food; a cautious one builds defense first', () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
    const berlin = s.regions[getNationCapital('de')];
    const rich = { ...berlin, lastYields: { ...(berlin.lastYields || {}), production: 30 }, production: { current: null, queue: [], progress: 0 } };
    const pick = (doctrine) => {
      const st = { ...s, regions: { ...s.regions, [berlin.id]: rich }, nations: { ...s.nations, de: { ...s.nations.de, doctrine, ruler: { ...s.nations.de.ruler, traits: [] } } } }; // a ruler without traits: the doctrine order alone (rulerBias.js)
      return chooseProduction(st, rich, { researched: [], ageId: 'bronze', citiesOwned: 1, turnNumber: 2, units: s.units, counts: { settlers: 1, outposts: 0, landUnits: 9 } });
    };
    const blitz = pick('blitz'); const cautious = pick('cautious');
    expect(blitz.kind).toBe('building'); expect(cautious.kind).toBe('building');
    expect(blitz.category).toBe(DOCTRINE_BUILDING_PRIORITY.blitz.find((c) => BUILDING_CATEGORIES[c]?.tiers[0] && !BUILDING_CATEGORIES[c].tiers[0].requiresTech && !BUILDING_CATEGORIES[c].coastalOnly));
    expect(cautious.category).toBe(DOCTRINE_BUILDING_PRIORITY.cautious.find((c) => BUILDING_CATEGORIES[c]?.tiers[0] && !BUILDING_CATEGORIES[c].tiers[0].requiresTech && !BUILDING_CATEGORIES[c].coastalOnly));
  });
});
