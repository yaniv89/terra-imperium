import { describe, it, expect } from 'vitest';
import { buildTownManifest, townFileKey, townLayout, manifestHousing, houseHousing, TOWNHALL_HOUSING, citySeed, isCivic, wallTowerCount } from './townLayout';
import { townAssetUrl, townFileNames } from '../components/map/closeView/townAssets';
import LAYOUTS from './townLayouts.json';

describe('town layouts (the city manifest source)', () => {
  it('has a layout for every town file the close view can load, and no other', () => {
    expect(Object.keys(LAYOUTS.towns).sort()).toEqual(townFileNames().sort());
  });

  it('every town file has houses, standing inside its ground', () => {
    Object.entries(LAYOUTS.towns).forEach(([key]) => {
      const { houses } = townLayout(key);
      expect(houses.length, key).toBeGreaterThanOrEqual(5);
      const half = key.includes('-big-') ? 4.3 : key.includes('-medium-') ? 3.3 : 2.3;
      houses.forEach((h) => { expect(Math.abs(h.x), key).toBeLessThan(half); expect(Math.abs(h.z), key).toBeLessThan(half); });
    });
  });

  it('picks the same town file as the close view', () => {
    [['bronze', 'small', 0, null], ['bronze', 'medium', 1, 'levant'], ['classical', 'big', 3, 'nile'], ['kingdoms', 'small', 2, 'andalus'], ['modern', 'big', 5, 'europe']].forEach(([age, tier, seed, style]) => {
      const key = townFileKey(age, tier, seed, style);
      expect(townAssetUrl(age, tier, seed, style)).toContain(key);
    });
    expect(townFileKey('future', 'small')).toBeNull();
    // no Roman big town of its own: the classical base big town, and the manifest lists its houses
    expect(townFileKey('classical', 'big', 0, 'europe')).toMatch(/^classical-town-big-[ab]$/);
    expect(townAssetUrl('classical', 'big', 0, 'europe')).toContain(townFileKey('classical', 'big', 0, 'europe'));
    const roman = buildTownManifest({ cityId: 'x', ageId: 'classical', tierId: 'big', style: 'europe' });
    expect(roman.townKey).toMatch(/^classical-town-big-[ab]$/);
    expect(roman.structures.filter((s) => s.kind === 'house').length).toBe(townLayout(roman.townKey).houses.length);
    expect(roman.structures.filter((s) => s.kind === 'house').length).toBeGreaterThan(10);
  });
});

describe('buildTownManifest', () => {
  const base = { cityId: 'c1', ageId: 'bronze', tierId: 'medium', style: null, seed: citySeed('c1') };

  it('lists the town hall, every house with stable ids, and its landmarks', () => {
    const m = buildTownManifest(base);
    const layout = townLayout(m.townKey);
    expect(m.structures[0]).toMatchObject({ id: 'townhall', kind: 'townhall', housing: TOWNHALL_HOUSING });
    const houses = m.structures.filter((s) => s.kind === 'house');
    expect(houses.map((h) => h.id)).toEqual(layout.houses.map((_, i) => `house-${i}`));
    expect(m.structures.filter((s) => s.kind === 'landmark')).toHaveLength(layout.landmarks.length);
    expect(new Set(m.structures.map((s) => s.id)).size).toBe(m.structures.length);
  });

  it('is deterministic', () => {
    expect(buildTownManifest(base)).toEqual(buildTownManifest(base));
  });

  it('adds one structure per built building at its tier, a palace for a capital and the wall ring with a gate', () => {
    const m = buildTownManifest({ ...base, capital: true, defenseTier: 1, buildings: { culture: 1, economy: 0, defense: 1, food: -1 } });
    const blds = m.structures.filter((s) => s.kind === 'building');
    expect(blds.map((b) => b.id)).toEqual(['bld-culture', 'bld-economy']);
    expect(blds[0].tier).toBe(1);
    expect(m.structures.some((s) => s.id === 'palace')).toBe(true);
    expect(m.structures.filter((s) => s.kind === 'gate')).toHaveLength(1);
    expect(m.structures.filter((s) => s.kind === 'wall').length).toBeGreaterThan(6);
    expect(m.structures.filter((s) => s.kind === 'tower')).toHaveLength(wallTowerCount(1));
    // the gate faces the front (model south, +z)
    expect(m.structures.find((s) => s.kind === 'gate').z).toBeGreaterThan(2);
  });

  it('a bigger town has more houses and so more housing', () => {
    const small = buildTownManifest({ ...base, tierId: 'small' });
    const big = buildTownManifest({ ...base, tierId: 'big' });
    expect(manifestHousing(big)).toBeGreaterThan(manifestHousing(small));
  });

  it('housing: the town hall plus every house not ruined', () => {
    const m = buildTownManifest(base);
    const houses = m.structures.filter((s) => s.kind === 'house');
    expect(manifestHousing(m)).toBe(TOWNHALL_HOUSING + houses.reduce((s, h) => s + h.housing, 0));
    expect(manifestHousing(m, { 'house-0': 1 })).toBe(manifestHousing(m) - houses[0].housing);
    expect(houseHousing(0.5, 0.5)).toBe(5);
    expect(houseHousing(0.8, 0.8)).toBe(10);
    expect(houseHousing(1.2, 1)).toBe(15);
    expect(isCivic(houses[0])).toBe(true);
  });

  it('an outpost camp has no town', () => {
    const m = buildTownManifest({ ...base, camp: true, defenseTier: 2 });
    expect(m.townKey).toBeNull();
    expect(m.structures.map((s) => s.kind)).toEqual(['townhall']);
  });
});
