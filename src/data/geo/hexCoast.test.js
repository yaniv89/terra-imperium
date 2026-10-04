// src/data/geo/hexCoast.test.js
import { describe, it, expect } from 'vitest';
import { geoArea, geoContains } from 'd3-geo';
import { getTiles } from './tiles';
import { chaikin, coastNoise, CHUNK_DEG } from './hexCoast';
import hexLand from './hexLand.json';

describe('the hex coastline', () => {
  const tiles = getTiles();
  const land = { type: 'FeatureCollection', features: hexLand.features };

  // A planar point-in-polygon (with box culling) is far faster than d3's spherical test and exact
  // away from the poles; the polar caps use d3.
  const pip = (ring, x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i]; const [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const polys = hexLand.features.map((f) => { const r = f.geometry.coordinates; const xs = r[0].map((p) => p[0]); const ys = r[0].map((p) => p[1]); return { r, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }; });
  const inLand = (x, y) => polys.some(({ r, box }) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && pip(r[0], x, y) && !r.slice(1).some((h) => pip(h, x, y)));

  it('is all land at every land hex and all water at every water hex (centres and half way to the corners)', () => {
    let wrong = 0; let checked = 0;
    for (let t = 0; t < tiles.count; t += 3) {
      const { lat, lon } = tiles.latLonOf(t);
      if (lat < -60 || lat > 80) continue;
      const isLand = tiles.land[t] === 1;
      const points = [[lon, lat], ...tiles.polygonOf(t).filter((_, i) => i % 2 === 0).map((p) => {
        let dx = p.lon - lon; if (dx > 180) dx -= 360; if (dx < -180) dx += 360;
        return [lon + dx / 2, (p.lat + lat) / 2];
      })];
      points.forEach(([x, y]) => { checked += 1; if (inLand(((x + 540) % 360) - 180, y) !== isLand) wrong += 1; });
    }
    expect(checked).toBeGreaterThan(50000);
    expect(wrong / checked).toBeLessThan(0.0005);
  }, 60000);

  it('covers Antarctica and leaves the Arctic sea open', () => {
    let wrong = 0;
    for (let t = 0; t < tiles.count; t += 5) {
      const { lat, lon } = tiles.latLonOf(t);
      if (lat > -60 && lat < 80) continue;
      if (geoContains(land, [lon, lat]) !== (tiles.land[t] === 1 || lat < -85)) wrong += 1;
    }
    expect(wrong).toBe(0);
  }, 60000);

  it('winds every piece as a small patch of the sphere, never its complement, cut to the chunk size', () => {
    hexLand.features.forEach((f) => expect(geoArea(f), f.id).toBeLessThan(((CHUNK_DEG * Math.PI) / 180) ** 2 * 1.01));
    expect(hexLand.features.reduce((a, f) => a + geoArea(f), 0) / (4 * Math.PI)).toBeGreaterThan(0.2);
  });

  it('rounds corners and keeps the noise small and bounded', () => {
    const square = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
    expect(chaikin(square)).toHaveLength(9);
    for (let i = 0; i < 200; i++) expect(Math.abs(coastNoise(i * 0.37 - 40, i * 0.21 - 20))).toBeLessThanOrEqual(1);
  });
});
