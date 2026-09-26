import { describe, it, expect } from 'vitest';
import { fillColorForRegion, getAtWarNationIds, getRegionFillColor, getRegionStrokeColor } from './mapRegionStyle';

describe('fillColorForRegion', () => {
  it('bands the player\'s own territory by control, 80+/60+/40+/20+/below', () => {
    expect(fillColorForRegion({ control: 100 }, true)).toBe('#4ade80');
    expect(fillColorForRegion({ control: 79 }, true)).toBe('#84cc16');
    expect(fillColorForRegion({ control: 59 }, true)).toBe('#facc15');
    expect(fillColorForRegion({ control: 39 }, true)).toBe('#fb923c');
    expect(fillColorForRegion({ control: 5 }, true)).toBe('#f87171');
  });

  it('clamps an out-of-range control value instead of returning an undefined band', () => {
    expect(fillColorForRegion({ control: 150 }, true)).toBe('#4ade80');
    expect(fillColorForRegion({ control: -10 }, true)).toBe('#f87171');
  });

  it('uses the owner\'s own stable nation color for a foreign region, ignoring control', () => {
    expect(fillColorForRegion({ owner: 'de', control: 10 }, false)).toBe(fillColorForRegion({ owner: 'de', control: 90 }, false));
  });
});

describe('getAtWarNationIds', () => {
  it('collects the enemy of every active war the player is in, either side', () => {
    const wars = [
      { aggressor: 'fr', enemy: 'de', active: true },
      { aggressor: 'br', enemy: 'fr', active: true },
      { aggressor: 'fr', enemy: 'jp', active: false } // inactive: excluded
    ];
    expect(getAtWarNationIds(wars, 'fr')).toEqual(new Set(['de', 'br']));
  });

  it('is empty when the player has no active wars', () => {
    expect(getAtWarNationIds([], 'fr')).toEqual(new Set());
  });
});

describe('getRegionFillColor', () => {
  it('returns the unknown-nation color for a region id with no matching state', () => {
    expect(getRegionFillColor({}, 'fr', 'nowhere')).toBeTruthy();
  });

  it('routes through fillColorForRegion using isPlayerOwned derived from ownership', () => {
    const regions = { r1: { owner: 'fr', control: 90 } };
    expect(getRegionFillColor(regions, 'fr', 'r1')).toBe('#4ade80');
  });
});

describe('getRegionStrokeColor', () => {
  const regions = { r1: { owner: 'de' } };

  it('highlights the selected region in blue above every other rule', () => {
    const invaded = { r1: { owner: 'de', underInvasion: true } };
    expect(getRegionStrokeColor(invaded, 'fr', 'r1', 'r1', new Set(['de']))).toBe('#2563eb');
  });

  it('outlines a region under invasion in red', () => {
    const invaded = { r1: { owner: 'de', underInvasion: true } };
    expect(getRegionStrokeColor(invaded, 'fr', 'r1', null, new Set())).toBe('#ef4444');
  });

  it('outlines a foreign region red when its owner is at war with the player', () => {
    expect(getRegionStrokeColor(regions, 'fr', 'r1', null, new Set(['de']))).toBe('#ef4444');
  });

  it('defaults to black otherwise', () => {
    expect(getRegionStrokeColor(regions, 'fr', 'r1', null, new Set())).toBe('#000000');
  });
});
