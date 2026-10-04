// src/data/geo/gridScale.test.js
// The grid-relative distance helper: measured from the loaded grid, admissible for A*, and right
// on a denser grid without hand edits. No test here assumes the frequency or the cell count.
import { describe, it, expect } from 'vitest';
import { getTiles } from './tiles';
import { buildGrid, distanceKm, cellCount } from './geodesic';
import { gridSpacing, kmPerRing, ringsForKm, ringsApart, kmCoveringRings, minStepsBetween, cellsForAreaKm2 } from './gridScale';

const tiles = getTiles();

// Hop counts from `from` to every tile (plain BFS over the whole grid).
const hops = (grid, from) => {
  const d = new Int32Array(grid.centres.length).fill(-1);
  d[from] = 0; let frontier = [from];
  while (frontier.length) {
    const next = [];
    for (const t of frontier) for (const n of grid.neighbors[t]) if (d[n] < 0) { d[n] = d[t] + 1; next.push(n); }
    frontier = next;
  }
  return d;
};

describe('gridSpacing', () => {
  it('measures every neighbour step: min <= each step <= max, and the mean between', () => {
    const { minKm, maxKm, meanKm, cellKm2 } = gridSpacing(tiles);
    expect(minKm).toBeGreaterThan(0);
    expect(minKm).toBeLessThan(meanKm);
    expect(meanKm).toBeLessThan(maxKm);
    let outside = 0;
    for (let i = 0; i < tiles.count; i++) {
      for (const j of tiles.neighbors[i]) {
        const d = distanceKm(tiles.centres[i], tiles.centres[j]);
        if (d > maxKm || d < minKm) outside += 1;
      }
    }
    expect(outside).toBe(0);
    // The tiles cover the Earth.
    expect(cellKm2 * tiles.count).toBeCloseTo(4 * Math.PI * 6371 * 6371, -3);
    expect(gridSpacing(tiles)).toBe(gridSpacing(tiles)); // measured once
  });

  it('turns km into rings and back on the measured spacing', () => {
    [1, 2, 4, 13, 17, 28, 60].forEach((r) => expect(ringsForKm(r * kmPerRing())).toBe(r));
    expect(ringsForKm(1)).toBe(1); // at least one ring by default
    expect(ringsForKm(1, { min: 0 })).toBe(0);
    expect(cellsForAreaKm2(gridSpacing().cellKm2 * 500)).toBe(500);
    const [a, b] = [0, tiles.neighbors[0][0]];
    expect(ringsApart(a, b)).toBeGreaterThan(0.7);
    expect(ringsApart(a, b)).toBeLessThan(1.3);
  });
});

describe('the A* guess is admissible on the real grid', () => {
  it('never exceeds 1 for a single step', () => {
    let worst = 0;
    for (let i = 0; i < tiles.count; i++) for (const j of tiles.neighbors[i]) worst = Math.max(worst, minStepsBetween(i, j));
    expect(worst).toBeLessThanOrEqual(1);
    expect(worst).toBeGreaterThan(0.999);
  });

  it('never exceeds the true hop count, from sources spread over the world (pentagon corners included)', () => {
    const pentagons = [];
    for (let i = 0; i < tiles.count && pentagons.length < 4; i++) if (tiles.neighbors[i].length === 5) pentagons.push(i);
    const sources = [...pentagons, ...Array.from({ length: 8 }, (_, k) => Math.floor(((k + 0.5) * tiles.count) / 8))];
    let tightest = 0; let over = 0;
    sources.forEach((s) => {
      const d = hops(tiles, s);
      for (let t = 0; t < tiles.count; t += 7) {
        if (t === s) continue;
        const h = minStepsBetween(s, t);
        if (h > d[t]) over += 1;
        tightest = Math.max(tightest, h / d[t]);
      }
    });
    expect(over).toBe(0);
    // And it is tight: some pair is guessed within 5% of its true count (the old km / 170 guess
    // reached about two thirds at best).
    expect(tightest).toBeGreaterThan(0.95);
  });

  it('kmCoveringRings holds every tile within that many steps', () => {
    const s = Math.floor(tiles.count / 3);
    const d = hops(tiles, s);
    let missed = 0; let checked = 0;
    for (let t = 0; t < tiles.count; t++) {
      if (d[t] > 0 && d[t] <= 17) { checked += 1; if (distanceKm(tiles.centres[s], tiles.centres[t]) > kmCoveringRings(d[t])) missed += 1; }
    }
    expect(checked).toBeGreaterThan(100);
    expect(missed).toBe(0);
  });
});

describe('a denser grid needs no hand edits', () => {
  it('frequency 100: spacing, rings for a km rule and the A* bound follow the grid', () => {
    const f75 = gridSpacing(tiles);
    const grid = buildGrid(100);
    expect(grid.centres.length).toBe(cellCount(100));
    const f100 = gridSpacing(grid);
    expect(f100.meanKm).toBeLessThan(f75.meanKm);
    // The same 410 km rule asks for more rings of smaller hexes.
    expect(ringsForKm(410, { tiles: grid })).toBeGreaterThanOrEqual(ringsForKm(410));
    expect(Math.abs(ringsForKm(410, { tiles: grid }) * f100.meanKm - 410)).toBeLessThanOrEqual(f100.meanKm / 2);
    // Admissible there too.
    const d = hops(grid, 12345);
    let over = 0;
    for (let t = 0; t < grid.centres.length; t++) if (t !== 12345 && minStepsBetween(12345, t, grid) > d[t]) over += 1;
    expect(over).toBe(0);
  });
});
