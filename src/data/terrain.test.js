import { describe, it, expect } from 'vitest';
import { getRegionTerrain, getTerrainCombatModifier, TERRAIN_COMBAT_MODIFIERS } from './terrain';

describe('getRegionTerrain (plan §M14)', () => {
  const regionsData = {
    swiss_alps: { id: 'swiss_alps', name: 'Swiss Alps Canton', description: '', infrastructure: 3 },
    sahara_belt: { id: 'sahara_belt', name: 'Sahara Desert Province', description: '', infrastructure: 2 },
    amazon_basin: { id: 'amazon_basin', name: 'Amazon Rainforest', description: '', infrastructure: 1 },
    greenland_ice: { id: 'greenland_ice', name: 'Greenland', description: '', infrastructure: 0 },
    plateau_region: { id: 'plateau_region', name: 'Central Highland Plateau', description: '', infrastructure: 4 },
    coastal_isle: { id: 'coastal_isle', name: 'Some Small Island', description: '', infrastructure: 3 },
    metro_hub: { id: 'metro_hub', name: 'Ordinary Province', description: 'a very developed capital region', infrastructure: 10 },
    plain_farmland: { id: 'plain_farmland', name: 'Ordinary Farmland County', description: '', infrastructure: 5 }
  };

  it('classifies a name containing a known mountain range as mountains', () => {
    expect(getRegionTerrain('swiss_alps', regionsData)).toBe('mountains');
  });

  it('classifies a name containing a known desert as desert', () => {
    expect(getRegionTerrain('sahara_belt', regionsData)).toBe('desert');
  });

  it('classifies a name containing a known forest/rainforest as forest', () => {
    expect(getRegionTerrain('amazon_basin', regionsData)).toBe('forest');
  });

  it('classifies a name containing a known arctic region as arctic', () => {
    expect(getRegionTerrain('greenland_ice', regionsData)).toBe('arctic');
  });

  it('classifies a name containing a highland/plateau keyword as hills', () => {
    expect(getRegionTerrain('plateau_region', regionsData)).toBe('hills');
  });

  it('classifies a name containing an island keyword as island', () => {
    expect(getRegionTerrain('coastal_isle', regionsData)).toBe('island');
  });

  it('classifies a highly developed region with no other keyword match as urban', () => {
    expect(getRegionTerrain('metro_hub', regionsData)).toBe('urban');
  });

  it('falls back to mixed for an ordinary, undistinguished region', () => {
    expect(getRegionTerrain('plain_farmland', regionsData)).toBe('mixed');
  });

  it('memoizes so repeated calls for the same id are consistent', () => {
    const first = getRegionTerrain('swiss_alps', regionsData);
    const second = getRegionTerrain('swiss_alps', regionsData);
    expect(second).toBe(first);
  });

  it('does not throw for an unknown region id', () => {
    expect(() => getRegionTerrain('not_a_real_region_xyz', regionsData)).not.toThrow();
  });
});

describe('getTerrainCombatModifier (plan §M14)', () => {
  it('every terrain type in the table has both an attackerMult and attritionMult', () => {
    Object.entries(TERRAIN_COMBAT_MODIFIERS).forEach(([terrain, mod]) => {
      expect(typeof mod.attackerMult, terrain).toBe('number');
      expect(typeof mod.attritionMult, terrain).toBe('number');
    });
  });

  it('mountains favor the defender (attacker malus) and raise attrition', () => {
    const mod = getTerrainCombatModifier('mountains');
    expect(mod.attackerMult).toBeLessThan(1);
    expect(mod.attritionMult).toBeGreaterThan(1);
  });

  it('falls back to mixed\'s neutral modifier for an unknown terrain key', () => {
    expect(getTerrainCombatModifier('not_a_real_terrain')).toEqual(TERRAIN_COMBAT_MODIFIERS.mixed);
  });
});
