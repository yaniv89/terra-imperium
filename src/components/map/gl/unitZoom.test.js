// Map models keep one world size (user rule 2026-10-20): the close view's figures and model units
// are proportional to the zoom, so a model looks bigger only because the camera is closer. The army
// banner (a flat sprite) keeps one size on screen from the far map into the close view.
import { describe, it, expect } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import { markerSprites, CLOSE_ZOOM_K, SETTLER_MAX_R, settlerRadius } from './sceneModel';
import { figureScale, unitPx } from '../closeView/scale';

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
  const CLOSE = ZOOMS.filter((k) => k >= CLOSE_ZOOM_K);

  it('keep one world size at every zoom (the layout scale is proportional to the zoom)', () => {
    floors.forEach((floor) => {
      const world = CLOSE.map((k) => (figureScale(k, trueFactor, floor) * height) / k);
      world.forEach((w) => expect(w).toBeCloseTo(world[0], 9));
    });
  });

  it('are the size they had where the close view opens, at that zoom', () => {
    floors.forEach((floor) => {
      expect(figureScale(CLOSE_ZOOM_K, trueFactor, floor) * height).toBeCloseTo(Math.max(unitPx(CLOSE_ZOOM_K) * trueFactor, floor) * height, 9);
      expect(figureScale(CLOSE_ZOOM_K, trueFactor, floor) * height).toBeGreaterThanOrEqual(floor * height - 1e-9);
    });
  });

  it('do not stop growing in the super zoom (no power law past k 40)', () => {
    expect(figureScale(200, trueFactor, floors[0]) / figureScale(100, trueFactor, floors[0])).toBeCloseTo(2, 9);
  });
});

describe('model units per zoom', () => {
  it('unitPx is exactly proportional to the zoom, so a model has one world size', () => {
    const per = ZOOMS.filter((k) => k >= CLOSE_ZOOM_K).map((k) => unitPx(k) / k);
    per.forEach((v) => expect(v).toBeCloseTo(per[0], 12));
  });
});

describe('settler discs on the map', () => {
  it('grow or stay the same as the map zooms in', () => {
    const r = ZOOMS.map(settlerRadius);
    expect(rising(r)).toBe(true);
    expect(r.at(-1)).toBe(SETTLER_MAX_R);
  });
});
