// Every unit of every age gets a real, rigged 3D model: it builds, it's reasonably light for a
// phone, it wears its side's colour somewhere, and walking figures actually have legs to move.
import { describe, it, expect } from 'vitest';
import { getSoldierGeometry, LIMB } from './soldierFactory';
import { UNIT_ROSTER } from '../../data/unitClasses';

describe('soldier models', () => {
  Object.entries(UNIT_ROSTER).forEach(([ageId, roster]) => {
    Object.keys(roster).filter((c) => c !== 'naval').forEach((classId) => {
      it(`${ageId} ${classId} builds a rigged, team-coloured model`, () => {
        const geo = getSoldierGeometry(ageId, classId);
        const n = geo.attributes.position.count;
        expect(n).toBeGreaterThan(30);
        expect(n / 3).toBeLessThan(2200); // triangles: light enough for hundreds on a phone
        ['color', 'aLimb', 'aPivot', 'aTeam', 'normal'].forEach((a) => expect(geo.attributes[a], a).toBeDefined());
        const team = geo.attributes.aTeam.array;
        expect(team.some((v) => v === 1)).toBe(true);
        const limbs = new Set(geo.attributes.aLimb.array);
        const walker = ['infantry', 'ranged'].includes(classId) || (classId === 'support' && ageId !== 'bronze' && ageId !== 'modern');
        if (walker) { expect(limbs.has(LIMB.LEG_L)).toBe(true); expect(limbs.has(LIMB.ARM_R)).toBe(true); }
        if (classId === 'cavalry' && ageId !== 'modern') expect(limbs.has(LIMB.HORSE_FRONT)).toBe(true);
        expect(Number.isFinite(geo.boundingSphere.radius)).toBe(true);
      });
    });
  });
});
