import { describe, it, expect } from 'vitest';
import {
  SATELLITE_TYPES, SATELLITE_TYPE_IDS, SATELLITE_UNLOCK_YEAR, MAX_ORBITAL_DEBRIS,
  canLaunchSatellite, getOrbitalEffectivenessMult, getSatelliteEffectTotal
} from './satellites';

describe('SATELLITE_TYPES data integrity', () => {
  it('every type has at least one real effect', () => {
    SATELLITE_TYPE_IDS.forEach(id => {
      expect(Object.keys(SATELLITE_TYPES[id].effect).length).toBeGreaterThan(0);
    });
  });

  it('every type has a name and description', () => {
    SATELLITE_TYPE_IDS.forEach(id => {
      expect(SATELLITE_TYPES[id].name).toBeTruthy();
      expect(SATELLITE_TYPES[id].description).toBeTruthy();
    });
  });

  it('covers all five plan-named types', () => {
    expect(SATELLITE_TYPE_IDS.sort()).toEqual(['communications', 'navigation', 'recon', 'spy', 'weather']);
  });
});

describe('canLaunchSatellite', () => {
  it('is false before the Modern Age even if the year is late enough', () => {
    expect(canLaunchSatellite('gunpowder', 'gunpowder', 2000)).toBe(false);
  });

  it('is false in the Modern Age before the real unlock year', () => {
    expect(canLaunchSatellite('modern', 'modern', SATELLITE_UNLOCK_YEAR - 1)).toBe(false);
  });

  it('is true in the Modern Age at or after the unlock year', () => {
    expect(canLaunchSatellite('modern', 'modern', SATELLITE_UNLOCK_YEAR)).toBe(true);
    expect(canLaunchSatellite('modern', 'modern', SATELLITE_UNLOCK_YEAR + 50)).toBe(true);
  });

  it('honors a tech-earned effective age one age ahead of the calendar', () => {
    expect(canLaunchSatellite('gunpowder', 'modern', SATELLITE_UNLOCK_YEAR)).toBe(true);
  });
});

describe('getOrbitalEffectivenessMult', () => {
  it('is 1 (full effectiveness) with no debris', () => {
    expect(getOrbitalEffectivenessMult(0)).toBe(1);
    expect(getOrbitalEffectivenessMult(undefined)).toBe(1);
  });

  it('decreases as debris rises', () => {
    expect(getOrbitalEffectivenessMult(50)).toBeLessThan(getOrbitalEffectivenessMult(0));
    expect(getOrbitalEffectivenessMult(MAX_ORBITAL_DEBRIS)).toBeLessThan(getOrbitalEffectivenessMult(50));
  });

  it('never drops below the 20% floor even at maximum debris', () => {
    expect(getOrbitalEffectivenessMult(MAX_ORBITAL_DEBRIS)).toBeGreaterThanOrEqual(0.2);
    expect(getOrbitalEffectivenessMult(999999)).toBeGreaterThanOrEqual(0.2);
  });
});

describe('getSatelliteEffectTotal', () => {
  const satellites = {
    a: { id: 'a', ownerId: 'fr', typeId: 'navigation' }, // goldMult 0.08
    b: { id: 'b', ownerId: 'fr', typeId: 'weather' },    // hrMult 0.1
    c: { id: 'c', ownerId: 'de', typeId: 'navigation' }  // belongs to someone else
  };

  it('sums only the given nation\'s own satellites for the requested effect key', () => {
    expect(getSatelliteEffectTotal(satellites, 'fr', 'goldMult', 0)).toBeCloseTo(0.08);
    expect(getSatelliteEffectTotal(satellites, 'fr', 'hrMult', 0)).toBeCloseTo(0.1);
    expect(getSatelliteEffectTotal(satellites, 'de', 'goldMult', 0)).toBeCloseTo(0.08);
  });

  it('is 0 for an effect key none of the nation\'s satellites provide', () => {
    expect(getSatelliteEffectTotal(satellites, 'fr', 'stabilityBonus', 0)).toBe(0);
  });

  it('is 0 for a nation with no satellites at all', () => {
    expect(getSatelliteEffectTotal(satellites, 'us', 'goldMult', 0)).toBe(0);
  });

  it('scales down under orbital debris, shared across every nation\'s satellites equally', () => {
    const full = getSatelliteEffectTotal(satellites, 'fr', 'goldMult', 0);
    const degraded = getSatelliteEffectTotal(satellites, 'fr', 'goldMult', 100);
    expect(degraded).toBeLessThan(full);
    expect(degraded).toBeCloseTo(full * getOrbitalEffectivenessMult(100));
  });
});
