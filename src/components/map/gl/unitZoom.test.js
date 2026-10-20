// Map models keep one world size (user rule 2026-10-20): the close view's model units are
// proportional to the zoom (figures: closeView/hexFit.test.js), so a model looks bigger only because the camera is closer. The army
// banner (a flat sprite) keeps one size on screen from the far map into the close view.
import { describe, it, expect } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import { markerSprites, CLOSE_ZOOM_K, SETTLER_MAX_R, settlerRadius } from './sceneModel';
import { unitPx } from '../closeView/scale';

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

describe('army stacks at the far end of the close view', () => {
  const at = { lat: 31.8, lng: 35.2 };
  const mk = (id) => ({ id, own: true, ownerId: 'israel', regionId: null, at, men: 1800, mainClass: 'infantry', morale: 90, canMove: true });
  it('each army or stack of armies has a readable banner, whatever the zoom', () => {
    [1, 4, CLOSE_ZOOM_K, 40, 150].forEach((k) => {
      [[mk('a1')], [mk('a1'), mk('a2')]].forEach((armies) => {
        const { sprites } = markerSprites({ markers: { armies, fleets: [], battles: [] }, projection, k, atWar: new Set(), dpr: 2 });
        expect(sprites).toHaveLength(1);
        expect(sprites[0].size[0]).toBeGreaterThanOrEqual(20); expect(sprites[0].size[1]).toBeGreaterThanOrEqual(20);
      });
    });
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
