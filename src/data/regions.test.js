import { describe, it, expect } from 'vitest';
import { REGIONS_DATA, isAdjacentToOwner, distanceFromAnchor, getNationCapital } from './regions';

describe('region adjacency graph', () => {
  it('covers all 240 nations', () => {
    expect(Object.keys(REGIONS_DATA).length).toBe(240);
  });

  it('every region carries an isCoastal boolean (build-sea-lanes.mjs)', () => {
    Object.entries(REGIONS_DATA).forEach(([id, data]) => {
      expect(typeof data.isCoastal, id).toBe('boolean');
    });
  });

  it('is symmetric — every neighbor relationship is listed on both sides', () => {
    const asymmetric = [];
    Object.entries(REGIONS_DATA).forEach(([id, data]) => {
      data.neighbors.forEach(nId => {
        if (!REGIONS_DATA[nId]) {
          asymmetric.push(`${id} references unknown region ${nId}`);
        } else if (!REGIONS_DATA[nId].neighbors.includes(id)) {
          asymmetric.push(`${id} -> ${nId} but not ${nId} -> ${id}`);
        }
      });
    });
    expect(asymmetric).toEqual([]);
  });

  // Full-world connectivity isn't a meaningful assertion once real-world geography is involved —
  // Afro-Eurasia, the Americas, Australia, and every island nation (UK, Japan, Cyprus, Cuba, ...)
  // are genuinely separate landmasses with zero real land border between them.
  it('most nations have at least one real land neighbor (islands are the expected exception)', () => {
    const ids = Object.keys(REGIONS_DATA);
    const withNeighbors = ids.filter(id => REGIONS_DATA[id].neighbors.length > 0);
    expect(withNeighbors.length / ids.length).toBeGreaterThan(0.6);
  });
});

describe('isAdjacentToOwner', () => {
  it('is true when a neighboring region is owned by the given owner', () => {
    const regions = { il: { owner: 'us' }, jo: { owner: 'us' }, eg: { owner: 'egypt' } };
    expect(isAdjacentToOwner('jo', regions, 'us')).toBe(true);
  });

  it('is false when no neighbor is owned by the given owner', () => {
    const regions = { eg: { owner: 'egypt' }, ly: { owner: 'egypt' } };
    expect(isAdjacentToOwner('eg', regions, 'us')).toBe(false);
  });
});

describe('distanceFromAnchor (overextension)', () => {
  it('is 0 for the anchor region itself', () => {
    expect(distanceFromAnchor(['us'], 'us')).toBe(0);
  });

  it('is 1 for a direct neighbor of the anchor', () => {
    expect(distanceFromAnchor(['us'], 'mx')).toBe(1); // Mexico borders the US
  });

  it('grows correctly for a multi-hop path (us -> mx -> gt)', () => {
    expect(distanceFromAnchor(['us'], 'mx')).toBe(1);
    expect(distanceFromAnchor(['us'], 'gt')).toBe(2); // Guatemala only reachable via Mexico
  });

  it('finds the shortest distance across multiple anchors, not just the first', () => {
    expect(distanceFromAnchor(['us', 'mx'], 'gt')).toBe(1);
  });
});

describe('getNationCapital (overextension anchor)', () => {
  it('returns the isCapital-flagged region for every one of the 240 nations', () => {
    Object.keys(REGIONS_DATA).forEach(nationId => {
      const capitalId = getNationCapital(nationId);
      expect(capitalId, `${nationId} has no capital`).toBeTruthy();
      expect(REGIONS_DATA[capitalId].isCapital).toBe(true);
      expect(REGIONS_DATA[capitalId].startOwner).toBe(nationId);
    });
  });

  it('returns null for an unknown nation id', () => {
    expect(getNationCapital('not-a-real-nation')).toBeNull();
  });
});
