// Units never shrink as the map zooms in (playtest: "please don't make units smaller on map zoom
// in"): the army banner keeps one size from the far map into the close view, and the close view's
// figures grow or stay the same on screen, both laid out at a zoom and while a zoom is under way.
import { describe, it, expect } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import { markerSprites, CLOSE_ZOOM_K, SETTLER_MAX_R, settlerRadius } from './sceneModel';
import { figureScale, figureLiveFactor, unitPx } from '../closeView/scale';

const projection = geoEquirectangular().fitSize([844, 390], { type: 'Sphere' });
const ZOOMS = [1, 2, 4, 8, 12, CLOSE_ZOOM_K * 0.99, CLOSE_ZOOM_K, CLOSE_ZOOM_K * 1.01, 16, 20, 30, 40, 41, 60, 90, 140, 200];
const rising = (list) => list.every((v, i) => i === 0 || v >= list[i - 1] - 1e-9);

describe('army banners on the map', () => {
  const army = { id: 'a1', own: true, ownerId: 'israel', regionId: null, at: { lat: 31.8, lng: 35.2 }, men: 1800, mainClass: 'infantry', morale: 90, canMove: true };
  const sizeAt = (k) => {
    const { sprites } = markerSprites({ markers: { armies: [army], fleets: [], battles: [] }, projection, k, atWar: new Set(), dpr: 2 });
    expect(sprites).toHaveLength(1);
    return sprites[0].size;
  };

  it('keep one size on screen from the far map into the close view', () => {
    const sizes = ZOOMS.map(sizeAt);
    sizes.forEach((s) => expect(s).toEqual(sizes[0]));
    expect(sizes[0][0]).toBeGreaterThan(20);
  });
});

describe('close view figures (armies and settler parties)', () => {
  // an infantry figure of the battle model: 1.5 model units tall, the true size factor of
  // closeViewScene (SOLDIER_SIZE 2.4 x MODEL_SCALE 0.88), floors of 64 px (armies) and 38 px (settlers)
  const height = 1.5; const trueFactor = 2.4 * 0.88;
  const floors = [64 / height, (64 * 0.6) / height];

  it('never get smaller on screen as the map zooms in, at any settled zoom', () => {
    floors.forEach((floor) => {
      const px = ZOOMS.filter((k) => k >= CLOSE_ZOOM_K).map((k) => figureScale(k, trueFactor, floor) * height);
      expect(rising(px)).toBe(true);
      expect(px[0]).toBeGreaterThanOrEqual(floor * height - 1e-9);
    });
  });

  it('show while a zoom is under way at the size the zoom settles to, so they never snap back smaller', () => {
    floors.forEach((floor) => {
      [CLOSE_ZOOM_K, 16, 25, 40, 70, 120].forEach((layoutK) => {
        // the GPU scales the layout by k / layoutK; the live factor sizes the figures in place
        const live = ZOOMS.filter((k) => k >= CLOSE_ZOOM_K).map((k) => figureScale(layoutK, trueFactor, floor) * figureLiveFactor(k, layoutK, trueFactor, floor) * (k / layoutK) * height);
        const settled = ZOOMS.filter((k) => k >= CLOSE_ZOOM_K).map((k) => figureScale(k, trueFactor, floor) * height);
        live.forEach((p, i) => expect(p).toBeCloseTo(settled[i], 6));
        expect(rising(live)).toBe(true);
      });
    });
  });

  it('were shrinking before: the layout scaled with the zoom, then the floor on settle', () => {
    // what the map did without the live factor: a figure at its floor laid out at k 16 grew with a
    // zoom in to k 30, then the layout at k 30 drew it at the floor again
    const floor = floors[0];
    const during = figureScale(16, trueFactor, floor) * (30 / 16) * height;
    const after = figureScale(30, trueFactor, floor) * height;
    expect(after).toBeLessThan(during);
    expect(figureLiveFactor(30, 16, trueFactor, floor)).toBeCloseTo(16 / 30, 6);
  });

  it('grow with the land in the super zoom, past their floor', () => {
    expect(figureScale(200, trueFactor, floors[0])).toBeCloseTo(unitPx(200) * trueFactor, 9);
    expect(figureScale(200, trueFactor, floors[0])).toBeGreaterThan(floors[0]);
  });
});

describe('settler discs on the map', () => {
  it('grow or stay the same as the map zooms in', () => {
    const r = ZOOMS.map(settlerRadius);
    expect(rising(r)).toBe(true);
    expect(r.at(-1)).toBe(SETTLER_MAX_R);
  });
});
