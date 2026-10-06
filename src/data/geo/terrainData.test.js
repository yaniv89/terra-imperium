// src/data/geo/terrainData.test.js
// The phase F terrain columns (scripts/geo/build-tile-terrain.mjs) and their read APIs.
import { describe, it, expect } from 'vitest';
import { getTiles } from './tiles';
import {
  RIVER_SIZE, FORDS_BY_SIZE, riverEdgesOf, riverSizeAt, edgeCorners, riverEdgeList, crossingsOf, roadEdgesOf,
  rangeOf, ridgeEdgesOf, mountainRanges, isPass, reliefClassOf, tileTerrainDescriptor
} from './terrainData';

const tiles = getTiles();
const nearestLand = (lat, lon) => tiles.nearest(lat, lon, 7).find((t) => tiles.land[t] === 1);

describe('terrain data columns', () => {
  it('ships every terrain column in tiles.json', () => {
    ['riverSize', 'range', 'ridge', 'pass'].forEach((k) => expect(tiles[k]?.length, k).toBe(tiles.count));
    expect(tiles.rangeNames.length).toBe(tiles.rangeSizes.length);
  });

  it('gives every river edge a size class and only river edges one', () => {
    let edges = 0; let stray = 0; let lopsided = 0; const bySize = [0, 0, 0, 0];
    for (let t = 0; t < tiles.count; t++) {
      if (!tiles.rivers[t]) { if (tiles.riverSize[t]) stray++; continue; }
      tiles.neighbors[t].forEach((n, k) => {
        const s = (tiles.riverSize[t] >> (2 * k)) & 3;
        if ((tiles.rivers[t] & (1 << k)) === 0) { if (s) stray++; return; }
        edges++; bySize[tiles.riverSizeBetween(t, n)]++;
        if (tiles.riverSizeBetween(t, n) !== tiles.riverSizeBetween(n, t)) lopsided++;
      });
    }
    expect(stray).toBe(0);
    expect(lopsided).toBe(0);
    expect(edges).toBeGreaterThan(20000);
    expect(bySize[0]).toBe(0);
    expect(bySize[RIVER_SIZE.GREAT]).toBeGreaterThan(1000);
    expect(bySize[RIVER_SIZE.STREAM]).toBeGreaterThan(bySize[RIVER_SIZE.GREAT]);
  });

  it('calls the Nile at Luxor a great river', () => {
    let best = 0;
    tiles.nearest(25.7, 32.6, 7).forEach((t) => { best = Math.max(best, riverSizeAt(t)); });
    expect(best).toBe(RIVER_SIZE.GREAT);
  });

  it('lists river edges once, with corners both tiles agree on', () => {
    const list = riverEdgeList();
    expect(list.length).toBeGreaterThan(10000);
    const { a, b } = list[0];
    const ka = tiles.neighbors[a].indexOf(b); const kb = tiles.neighbors[b].indexOf(a);
    const ea = edgeCorners(a, ka); const eb = edgeCorners(b, kb);
    // the same two points, in either order
    const same = (p, q) => p.every((v, i) => v === q[i]);
    expect((same(ea.a, eb.a) && same(ea.b, eb.b)) || (same(ea.a, eb.b) && same(ea.b, eb.a))).toBe(true);
    expect(riverEdgesOf(a).some((e) => e.neighbour === b && e.k === ka)).toBe(true);
  });

  it('puts fords on every crossing and a bridge where a road runs on both banks', () => {
    const { a, b, size } = riverEdgeList()[0];
    expect(crossingsOf(a).find((c) => c.neighbour === b)).toMatchObject({ size, fords: FORDS_BY_SIZE[size], bridge: false });
    const state = { world: { tileState: { [a]: { road: true }, [b]: { road: true } } } };
    expect(crossingsOf(a, state).find((c) => c.neighbour === b).bridge).toBe(true);
    expect(roadEdgesOf(a, state)).toEqual([b]);
    const pillaged = { world: { tileState: { [a]: { road: true }, [b]: { road: true, pillaged: true } } } };
    expect(crossingsOf(a, pillaged).find((c) => c.neighbour === b).bridge).toBe(false);
  });
});

describe('mountain ranges, ridges and passes', () => {
  it('names the great ranges', () => {
    const names = new Set(mountainRanges().map((r) => r.name));
    ['Alps', 'Andes', 'Himalayas', 'Zagros Mountains', 'Pyrenees'].forEach((n) => expect(names.has(n), n).toBe(true));
    const alps = rangeOf(nearestLand(46.5, 9.5));
    expect(alps?.name).toBe('Alps');
  });

  it('only mountain tiles belong to a range, and ridges join a range into one chain', () => {
    let wrong = 0;
    for (let t = 0; t < tiles.count; t++) if ((tiles.range[t] >= 0) !== (tiles.land[t] === 1 && tiles.reliefOf(t) === 'mountains')) wrong++;
    expect(wrong).toBe(0);
    // a range's ridge edges stay inside its mass and connect each of its tiles to another
    mountainRanges().filter((r) => r.size >= 5).slice(0, 20).forEach((r) => {
      r.tiles.forEach((t) => {
        ridgeEdgesOf(t).forEach((n) => expect(tiles.reliefOf(n)).toBe('mountains'));
      });
      expect(r.tiles.filter((t) => ridgeEdgesOf(t).length > 0).length).toBeGreaterThan(r.size * 0.8);
    });
  });

  it('marks passes on mountain tiles only, a few per cent of them', () => {
    let passes = 0; let mountains = 0;
    for (let t = 0; t < tiles.count; t++) {
      if (tiles.land[t] === 1 && tiles.reliefOf(t) === 'mountains') mountains++;
      if (isPass(t)) { passes++; expect(tiles.reliefOf(t)).toBe('mountains'); expect(reliefClassOf(t)).toBe('pass'); }
    }
    expect(passes).toBeGreaterThan(50);
    expect(passes).toBeLessThan(mountains * 0.1);
  });
});

describe('the tile terrain descriptor', () => {
  it('describes a tile edge by edge in neighbour order', () => {
    const { a, b, size } = riverEdgeList()[0];
    const d = tileTerrainDescriptor(a);
    expect(d.tileId).toBe(a);
    expect(d.neighbours).toEqual(tiles.neighbors[a]);
    expect(d.riverEdges[tiles.neighbors[a].indexOf(b)]).toBe(size);
    expect(d.riverEdges).toHaveLength(d.neighbours.length);
    expect(d.roadEdges.every((x) => x === false)).toBe(true);
    expect(['flat', 'hills', 'pass', 'mountains']).toContain(d.relief);
  });
});
