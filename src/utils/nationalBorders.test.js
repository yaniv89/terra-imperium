import { describe, it, expect } from 'vitest';
import { getOwnershipFingerprint, computeNationalBorderMesh } from './nationalBorders';

describe('getOwnershipFingerprint', () => {
  it('is the same string for the same regions object', () => {
    const regions = { a: { owner: 'fr' }, b: { owner: 'de' } };
    expect(getOwnershipFingerprint(regions)).toBe(getOwnershipFingerprint(regions));
  });

  it('is unaffected by a region changing a field other than owner (e.g. control/unrest drift)', () => {
    const regions = { a: { owner: 'fr', control: 80 }, b: { owner: 'de', control: 50 } };
    const drifted = { a: { owner: 'fr', control: 61 }, b: { owner: 'de', control: 55 } };
    expect(getOwnershipFingerprint(drifted)).toBe(getOwnershipFingerprint(regions));
  });

  it('changes when one region\'s owner changes (a conquest)', () => {
    const before = { a: { owner: 'fr' }, b: { owner: 'de' } };
    const after = { a: { owner: 'de' }, b: { owner: 'de' } };
    expect(getOwnershipFingerprint(after)).not.toBe(getOwnershipFingerprint(before));
  });
});

describe('computeNationalBorderMesh', () => {
  // A minimal topology: three unit-square-ish provinces sharing two internal arcs (a-b and b-c)
  // plus their own outer boundary arcs, just enough to exercise the owner-diff filter without
  // pulling in the real ~4,482-region subregions.topo.json.
  const topology = {
    type: 'Topology',
    arcs: [
      [[0, 0], [0, 1]], // arc 0: shared border between a and b
      [[0, 1], [0, 2]], // arc 1: shared border between b and c
      [[1, 0], [1, 1], [0, 1], [0, 0], [1, 0]], // arc 2: a's outer boundary
      [[1, 1], [1, 2], [0, 2], [0, 1], [1, 1]] // arc 3: b's own... (kept simple, geometry validity doesn't matter for the filter)
    ],
    objects: {
      provinces: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Polygon', id: 'a', arcs: [[2, 0]] },
          { type: 'Polygon', id: 'b', arcs: [[~0, ~2], [1, 3]] },
          { type: 'Polygon', id: 'c', arcs: [[~1, ~3]] }
        ]
      }
    }
  };

  it('includes only the border between two provinces with different owners', () => {
    const regions = { a: { owner: 'fr' }, b: { owner: 'fr' }, c: { owner: 'de' } };
    const result = computeNationalBorderMesh(topology, topology.objects.provinces, regions);
    // a/b share owner fr (excluded), b/c differ (included) -> exactly one line's worth of arcs.
    expect(result.type).toBe('MultiLineString');
    expect(result.coordinates.length).toBeGreaterThan(0);
  });

  it('includes no lines when every province shares the same owner', () => {
    const regions = { a: { owner: 'fr' }, b: { owner: 'fr' }, c: { owner: 'fr' } };
    const result = computeNationalBorderMesh(topology, topology.objects.provinces, regions);
    expect(result.coordinates.length).toBe(0);
  });

  it('reflects a conquest: the a/b border appears once they have different owners', () => {
    const before = { a: { owner: 'fr' }, b: { owner: 'fr' }, c: { owner: 'de' } };
    const after = { a: { owner: 'de' }, b: { owner: 'fr' }, c: { owner: 'de' } };
    const beforeLines = computeNationalBorderMesh(topology, topology.objects.provinces, before).coordinates.length;
    const afterLines = computeNationalBorderMesh(topology, topology.objects.provinces, after).coordinates.length;
    expect(afterLines).toBeGreaterThan(beforeLines);
  });
});
