import { describe, it, expect } from 'vitest';
import { getHistoricalPopulationShare } from './historicalPopulation';

describe('getHistoricalPopulationShare', () => {
  it('is a small fraction of modern at the game start year (2000 BCE)', () => {
    const share = getHistoricalPopulationShare(-2000);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(0.01);
  });

  it('is exactly 1 at the modern baseline year', () => {
    expect(getHistoricalPopulationShare(2024)).toBe(1);
  });

  it('monotonically increases from 2000 BCE through 2024 CE', () => {
    const years = [-2000, -1000, -500, 1, 1000, 1500, 1800, 1900, 1950, 2000, 2024];
    for (let i = 1; i < years.length; i += 1) {
      expect(getHistoricalPopulationShare(years[i])).toBeGreaterThan(getHistoricalPopulationShare(years[i - 1]));
    }
  });

  it('holds flat rather than extrapolating past the last real anchor', () => {
    expect(getHistoricalPopulationShare(2100)).toBe(getHistoricalPopulationShare(2300));
  });

  it('clamps to the earliest anchor for any year before it', () => {
    expect(getHistoricalPopulationShare(-5000)).toBe(getHistoricalPopulationShare(-2000));
  });

  it('interpolates smoothly between anchors rather than jumping', () => {
    const midpoint = getHistoricalPopulationShare(1750); // between the 1500 and 1800 anchors
    expect(midpoint).toBeGreaterThan(getHistoricalPopulationShare(1500));
    expect(midpoint).toBeLessThan(getHistoricalPopulationShare(1800));
  });
});
