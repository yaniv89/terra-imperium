import { describe, it, expect } from 'vitest';
import {
  getFormerOwnerOnConquest, REVOLT_SUCCESS_TURNS, INTEGRATION_CONTROL_THRESHOLD,
  REVOLT_RECLAIMED_CONTROL, REVOLT_RECLAIMED_UNREST, REBELLION_UNREST_THRESHOLD
} from './rebellion';

describe('getFormerOwnerOnConquest', () => {
  it('records whoever held the region right before the new owner took it', () => {
    expect(getFormerOwnerOnConquest('eg', 'eg', 'fr')).toBe('eg');
  });

  it('carries forward an existing occupier when the region changes hands again', () => {
    // 'de' already held a region it took from 'eg'; 'fr' now takes it from 'de'.
    expect(getFormerOwnerOnConquest('eg', 'de', 'fr')).toBe('de');
  });

  it('clears to undefined when a nation reclaims its own native region — a homecoming, not a conquest', () => {
    expect(getFormerOwnerOnConquest('eg', 'fr', 'eg')).toBeUndefined();
  });
});

describe('revolt tuning constants', () => {
  it('gives a conquered region a real, positive window before a revolt can succeed', () => {
    expect(REVOLT_SUCCESS_TURNS).toBeGreaterThan(0);
  });

  it('sets the integration bar above the reclaimed starting control, so it is a real goal to work toward', () => {
    expect(INTEGRATION_CONTROL_THRESHOLD).toBeGreaterThan(REVOLT_RECLAIMED_CONTROL);
  });

  it('reclaims a region below the rebellion threshold, so it does not instantly revolt again', () => {
    expect(REVOLT_RECLAIMED_UNREST).toBeLessThan(REBELLION_UNREST_THRESHOLD);
  });
});
