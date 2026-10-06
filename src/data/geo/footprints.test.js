// src/data/geo/footprints.test.js
import { describe, it, expect } from 'vitest';
import { getTiles } from './tiles';
import { gridSpacing } from './gridScale';
import { riverEdgeList } from './terrainData';
import { localFrame, cellPolygonKm, edgeOf, insetPolygon, insideDistance, pointInPolygon, tileFootprint, townRadiusKm, SAFE_INSET, TOWN_MAX_SHARE } from './footprints';

const tiles = getTiles();
const land = [...Array(tiles.count).keys()].filter((t) => tiles.land[t] === 1);
const sample = land.filter((_, i) => i % 997 === 0);

describe('cell polygons in local km', () => {
  it('are hexes about the grid spacing across, centred on the tile', () => {
    const { meanKm } = gridSpacing();
    sample.forEach((t) => {
      const poly = cellPolygonKm(t);
      expect(poly.length).toBe(tiles.neighbors[t].length);
      const ap = insideDistance(poly, [0, 0]);
      expect(ap).toBeGreaterThan(meanKm * 0.35); // grid cells vary in shape
      expect(ap).toBeLessThan(meanKm * 0.6);
    });
  });

  it('maps local km back onto the globe (fromLocal inverts toLocal)', () => {
    sample.slice(0, 8).forEach((t) => {
      const f = localFrame(t);
      [[0, 0], [12.5, -7], [-30, 22]].forEach((p) => {
        const q = f.toLocal(f.fromLocal(p));
        expect(q[0]).toBeCloseTo(p[0], 6); expect(q[1]).toBeCloseTo(p[1], 6);
      });
    });
  });

  it('puts edge k toward neighbour k', () => {
    const t = sample[3];
    const poly = cellPolygonKm(t);
    tiles.neighbors[t].forEach((n, k) => {
      const [a, b] = edgeOf(poly, k);
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      // the neighbour's centre lies beyond the edge middle, in the same direction
      const o = localFrame(t).toLocal(tiles.centres[n]);
      const cos = (m[0] * o[0] + m[1] * o[1]) / (Math.sqrt(m[0] ** 2 + m[1] ** 2) * Math.sqrt(o[0] ** 2 + o[1] ** 2));
      expect(cos).toBeGreaterThan(0.95);
      expect(Math.sqrt(o[0] ** 2 + o[1] ** 2)).toBeGreaterThan(Math.sqrt(m[0] ** 2 + m[1] ** 2) * 1.5);
    });
  });

  it('insets a polygon by the margin on every edge', () => {
    const poly = cellPolygonKm(sample[0]);
    const inner = insetPolygon(poly, 5);
    expect(insideDistance(poly, [0, 0]) - insideDistance(inner, [0, 0])).toBeCloseTo(5, 3);
    inner.forEach((p) => expect(pointInPolygon(poly, p)).toBe(true));
  });
});

describe('tile footprints', () => {
  const city = (t, size) => ({ world: { tileOwner: { [t]: 'c1' }, tileState: {} }, regions: { c1: { id: 'c1', tile: t, size } } });

  it('keeps the town inside its share of the cell, growing with size', () => {
    const t = sample[5];
    const small = tileFootprint(t, city(t, 1)).town; const big = tileFootprint(t, city(t, 30)).town;
    expect(big.radiusKm).toBeGreaterThan(small.radiusKm);
    const ap = insideDistance(cellPolygonKm(t), [0, 0]);
    expect(big.radiusKm).toBeLessThanOrEqual(ap * TOWN_MAX_SHARE + 1e-9);
    expect(townRadiusKm(1, 1000)).toBeLessThan(townRadiusKm(9, 1000));
  });

  it('places fields inside the safe area, clear of the town, the rivers and each other', () => {
    const e = riverEdgeList().find((x) => tiles.land[x.a] === 1 && tiles.reliefOf(x.a) === 'flat');
    const t = e.a;
    const fp = tileFootprint(t, city(t, 10));
    expect(fp.fields.length).toBeGreaterThan(8);
    const safeMargin = fp.apothemKm * 2 * SAFE_INSET;
    expect(insideDistance(fp.cell, [0, 0]) - insideDistance(fp.safe, [0, 0])).toBeCloseTo(safeMargin, 3);
    fp.fields.forEach((f) => {
      f.poly.forEach((q) => expect(pointInPolygon(fp.safe, q)).toBe(true));
      expect(Math.sqrt(f.centre[0] ** 2 + f.centre[1] ** 2)).toBeGreaterThan(fp.town.radiusKm);
    });
    expect(fp.rivers.length).toBeGreaterThan(0);
    // the same tile and state give the same layout
    expect(tileFootprint(t, city(t, 10))).toEqual(fp);
  });

  it('runs roads to the middle of each road edge, with a bridge on a river edge', () => {
    const e = riverEdgeList().find((x) => tiles.land[x.a] === 1 && tiles.land[x.b] === 1);
    const state = { world: { tileOwner: {}, tileState: { [e.a]: { road: true }, [e.b]: { road: true } } }, regions: {} };
    const fp = tileFootprint(e.a, state);
    expect(fp.roads).toHaveLength(1);
    expect(fp.roads[0]).toMatchObject({ neighbour: e.b, bridge: true });
    expect(tileFootprint(e.a).roads).toEqual([]);
  });

  it('fills a farm tile with fields and leaves a plain tile empty', () => {
    const t = sample[7];
    expect(tileFootprint(t).fields).toEqual([]);
    const farm = tileFootprint(t, { world: { tileOwner: {}, tileState: { [t]: { improvement: 'farm' } } }, regions: {} });
    expect(farm.fields.length).toBeGreaterThan(10);
    expect(farm.improvement).toBe('farm');
  });
});
