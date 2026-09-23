import { describe, it, expect } from 'vitest';
import { UNIT_ICON_PATHS, getUnitIconPath } from './unitIcons';
import { UNIT_ROSTER } from './unitClasses';

describe('UNIT_ICON_PATHS', () => {
  it('has exactly one icon per (age x class) the roster actually offers', () => {
    Object.entries(UNIT_ROSTER).forEach(([ageId, classes]) => {
      Object.keys(classes).forEach((classId) => {
        expect(getUnitIconPath(ageId, classId), `${ageId}/${classId} has no icon`).toBeTruthy();
      });
    });
  });

  it('declares no icon for a class the roster does not offer at that age (e.g. air before modern)', () => {
    Object.entries(UNIT_ICON_PATHS).forEach(([ageId, classes]) => {
      Object.keys(classes).forEach((classId) => {
        expect(UNIT_ROSTER[ageId]?.[classId], `${ageId}/${classId} icon has no matching roster entry`).toBeTruthy();
      });
    });
  });

  it('every path is a non-empty SVG path data string', () => {
    Object.values(UNIT_ICON_PATHS).forEach((classes) => {
      Object.values(classes).forEach((d) => {
        expect(typeof d).toBe('string');
        expect(d.length).toBeGreaterThan(0);
      });
    });
  });
});
