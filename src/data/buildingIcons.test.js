import { describe, it, expect } from 'vitest';
import { BUILDING_ICON_PATHS, EXTRACTION_ICON_PATHS, getBuildingIconPath, getExtractionIconPath } from './buildingIcons';
import { BUILDING_CATEGORIES, BUILDING_CATEGORY_IDS, EXTRACTION_BUILDINGS } from './buildings';

describe('BUILDING_ICON_PATHS', () => {
  it('has exactly one icon per tier every building category actually has', () => {
    BUILDING_CATEGORY_IDS.forEach((categoryId) => {
      BUILDING_CATEGORIES[categoryId].tiers.forEach(({ age }) => {
        expect(getBuildingIconPath(categoryId, age), `${categoryId}/${age} has no icon`).toBeTruthy();
      });
    });
  });

  it('declares no icon for a tier the category does not have that age', () => {
    Object.entries(BUILDING_ICON_PATHS).forEach(([categoryId, ages]) => {
      const tierAges = new Set(BUILDING_CATEGORIES[categoryId]?.tiers.map((t) => t.age));
      Object.keys(ages).forEach((ageId) => {
        expect(tierAges.has(ageId), `${categoryId}/${ageId} icon has no matching tier`).toBe(true);
      });
    });
  });
});

describe('EXTRACTION_ICON_PATHS', () => {
  it('has exactly one icon per extraction building', () => {
    Object.keys(EXTRACTION_BUILDINGS).forEach((resourceId) => {
      expect(getExtractionIconPath(resourceId), `${resourceId} has no icon`).toBeTruthy();
    });
    expect(Object.keys(EXTRACTION_ICON_PATHS).sort()).toEqual(Object.keys(EXTRACTION_BUILDINGS).sort());
  });
});
