// Civilization's rule for map models: one fixed world size at every zoom, units scaled up against
// the land on purpose but always inside their hex (user rule 2026-10-20). Tests for the hex-relative
// figure size and the camera's maximum zoom that keeps a unit from filling the screen.
import { describe, it, expect } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import { getTiles } from '../../../data/geo/tiles';
import { kmPerRing } from '../../../data/geo/gridScale';
import { hexPxOf, figureScale, figureGap, armyBannerOffset, FIGURE_HEIGHT_HEX, FIGURE_WIDTH_RATIO, GROUP_WIDTH_HEX, ARMY_SPOT_HEX, SETTLER_FIGURE_SHARE } from './scale';
import { maxZoomFor, HEXES_ACROSS_AT_MAX_ZOOM } from '../gl/mapView';
import { CLOSE_ZOOM_K } from '../gl/sceneModel';

const projection = geoEquirectangular().fitSize([844, 390], { type: 'Sphere' });
const ZOOMS = [CLOSE_ZOOM_K, 20, 40, 90, 160];

describe('army figures fit their hex', () => {
  const modelHeight = 1.5;
  it('are the same share of a hex at every zoom (a hex-relative world size, no pixel floor)', () => {
    const share = ZOOMS.map((k) => (figureScale(hexPxOf(projection, k), modelHeight) * modelHeight) / hexPxOf(projection, k));
    share.forEach((v) => expect(v).toBeCloseTo(FIGURE_HEIGHT_HEX, 9));
  });
  it('keep a group of one to three, with its step off the hex centre, inside half a hex each side', () => {
    ZOOMS.forEach((k) => {
      const hex = hexPxOf(projection, k);
      const h = figureScale(hex, modelHeight) * modelHeight;
      [1, 2, 3].forEach((n) => [1.1, 2.8].forEach((side) => {
        const gap = figureGap(hex, h, n, side);
        const half = ((n - 1) / 2) * gap * side + (FIGURE_WIDTH_RATIO * h) / 2;
        expect(2 * half).toBeLessThanOrEqual(GROUP_WIDTH_HEX * hex + 1e-9);
        expect(Math.abs(ARMY_SPOT_HEX.x) * hex + half).toBeLessThanOrEqual(0.5 * hex);
      }));
    });
  });
  it('settlers stand smaller still, in the middle of their hex', () => {
    const hex = hexPxOf(projection, 40);
    expect(SETTLER_FIGURE_SHARE).toBeLessThan(1);
    expect(FIGURE_HEIGHT_HEX * SETTLER_FIGURE_SHARE * hex).toBeLessThan(0.5 * hex);
  });
  it('hang the banner above the soldiers, in proportion to the hex', () => {
    const [x, y] = armyBannerOffset(100); const [x2, y2] = armyBannerOffset(200);
    expect(x2).toBeCloseTo(2 * x, 9);
    expect(y).toBeLessThan(0); expect(y2).toBeLessThan(y);
  });
});

describe('the camera never zooms in past a few hexes across the screen', () => {
  it('3 to 4 hexes fit across 844 px at the closest zoom of a phone in landscape', () => {
    const k = maxZoomFor({ width: 844, scale: projection.scale(), hexKm: kmPerRing() });
    const hexesAcross = 844 / hexPxOf(projection, k);
    expect(hexesAcross).toBeGreaterThanOrEqual(3);
    expect(hexesAcross).toBeLessThanOrEqual(4);
    expect(hexesAcross).toBeCloseTo(HEXES_ACROSS_AT_MAX_ZOOM, 6);
    expect(k).toBeGreaterThan(CLOSE_ZOOM_K * 2);
  });
  it('is never past 200 and never short of a usable close view', () => {
    expect(maxZoomFor({ width: 100000, scale: 1 })).toBe(200);
    expect(maxZoomFor({ width: 10, scale: 1e6 })).toBeGreaterThanOrEqual(CLOSE_ZOOM_K * 2);
  });
  it('a unit is a fraction of the screen at that zoom', () => {
    const k = maxZoomFor({ width: 844, scale: projection.scale(), hexKm: kmPerRing() });
    expect(FIGURE_HEIGHT_HEX * hexPxOf(projection, k)).toBeLessThan(390 * 0.35);
    expect(getTiles().count).toBeGreaterThan(0);
  });
});
