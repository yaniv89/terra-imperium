import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getNationCapital, getNeighborIds } from '../data/regions';
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

describe('AI production by utility (plans/math/ai.md)', () => {
  const setup = (doctrine, cityPatch = {}, extra = {}) => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
    const berlin = s.regions[getNationCapital('de')];
    const city = { ...berlin, lastYields: { ...(berlin.lastYields || {}), production: 30, food: 2 }, production: { current: null, queue: [], progress: 0 }, ...cityPatch };
    const st = { ...s, regions: { ...s.regions, [berlin.id]: city }, nations: { ...s.nations, de: { ...s.nations.de, doctrine, ruler: { ...s.nations.de.ruler, traits: [] } } }, ...extra };
    return { st, city };
  };
  const ctx = (st, landUnits = 9) => ({ researched: [], ageId: 'bronze', citiesOwned: 1, turnNumber: 2, units: st.units, counts: { settlers: 1, outposts: 0, landUnits } });

  it('a starving city builds food before its doctrine\'s first line', () => {
    const { st, city } = setup('cautious', { lastYields: { production: 30, food: -1 } });
    expect(chooseProduction(st, city, ctx(st))).toMatchObject({ kind: 'building', category: 'food' });
  });
  it('a city touching an enemy at war builds walls first, even for a blitz doctrine', () => {
    const { st: s0, city } = setup('blitz');
    const enemyId = getNeighborIds(city.id).map((id) => s0.regions[id]?.owner).find((o) => o && o !== 'de');
    const st = { ...s0, wars: [{ id: 'w', active: true, aggressor: enemyId, enemy: 'de' }] };
    expect(chooseProduction(st, city, ctx(st))).toMatchObject({ kind: 'building', category: 'defense' });
  });
  it('at war, a nation short of armies trains them before buildings; in peace it builds first', () => {
    const { st: s0, city } = setup('attrition');
    const war = { ...s0, wars: [{ id: 'w', active: true, aggressor: 'it', enemy: 'de' }] };
    expect(chooseProduction(war, city, ctx(war, 0))).toMatchObject({ kind: 'unit' });
    expect(chooseProduction(s0, city, ctx(s0, 0)).kind).toBe('building');
  });
});
