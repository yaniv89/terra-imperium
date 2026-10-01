// Every unit of every age gets a real, rigged 3D model: it builds, it's reasonably light for a
// phone, it wears its side's colour somewhere, and walking figures actually have legs to move.
import { describe, it, expect } from 'vitest';
import { getSoldierGeometry, getImposterGeometry, LIMB } from './soldierFactory';
import { UNIT_ROSTER } from '../../data/unitClasses';

describe('soldier models', () => {
  it('preserves smooth anatomical normals after merging', () => {
    const normal = getSoldierGeometry('classical', 'infantry').attributes.normal;
    let curved = 0;
    for (let i = 0; i < normal.count; i += 3) {
      const difference = Math.abs(normal.getX(i) - normal.getX(i + 1)) + Math.abs(normal.getY(i) - normal.getY(i + 1)) + Math.abs(normal.getZ(i) - normal.getZ(i + 1));
      if (difference > 0.05) curved++;
    }
    expect(curved / (normal.count / 3)).toBeGreaterThan(0.5);
  });
  Object.entries(UNIT_ROSTER).forEach(([ageId, roster]) => {
    Object.keys(roster).filter((c) => c !== 'naval').forEach((classId) => {
      it(`${ageId} ${classId} builds a rigged, team-coloured model`, () => {
        const geo = getSoldierGeometry(ageId, classId);
        const n = geo.attributes.position.count;
        expect(n).toBeGreaterThan(30);
        const budget = classId === 'cavalry' && ageId !== 'modern' ? (ageId === 'bronze' ? 5300 : 3700) : 2200;
        expect(n / 3).toBeLessThan(budget);
        const distant = getImposterGeometry(ageId, classId);
        expect(distant.attributes.position.count).toBeLessThanOrEqual(n);
        expect([...new Set(distant.attributes.aLimb.array)].sort()).toEqual([...new Set(geo.attributes.aLimb.array)].sort());
        expect(distant.boundingBox.min.distanceTo(geo.boundingBox.min)).toBeLessThan(0.035);
        expect(distant.boundingBox.max.distanceTo(geo.boundingBox.max)).toBeLessThan(0.035);
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
