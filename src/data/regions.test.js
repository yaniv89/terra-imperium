import { describe, it, expect } from 'vitest';
import { REGIONS_DATA, isAdjacentToOwner, distanceFromAnchor, getNationCapital, getCapital } from './regions';

describe('region adjacency graph', () => {
  it('covers all 240 nations via their real admin-1 provinces', () => {
    // Balanced regions (scripts/geo/build-balanced-regions.mjs): 4,482 admin-1 provinces merged to 2,028.
    expect(Object.keys(REGIONS_DATA).length).toBe(2028);
    const countries = new Set(Object.values(REGIONS_DATA).map(r => r.startOwner));
    expect(countries.size).toBe(240);
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
  // jo-ir (Irbid, Jordan) really borders il-z, a real Israeli province — see subregions-adjacency.json.
  it('is true when a neighboring region is owned by the given owner', () => {
    const regions = { 'il-z': { owner: 'us' }, 'jo-ba': { owner: 'us' }, 'eg-c': { owner: 'egypt' } };
    expect(isAdjacentToOwner('jo-ba', regions, 'us')).toBe(true);
  });

  it('is false when no neighbor is owned by the given owner', () => {
    const regions = { 'jo-ba': { owner: 'egypt' } };
    expect(isAdjacentToOwner('jo-ba', regions, 'us')).toBe(false);
  });
});

describe('distanceFromAnchor (overextension)', () => {
  // A real 3-hop chain, found in the data: A borders B, B borders C, and C is not next to A.
  // D is another neighbour of C, for the multi-anchor case.
  const nb = (id) => REGIONS_DATA[id].neighbors;
  const A = Object.keys(REGIONS_DATA).sort().find((a) => nb(a).some((b) => nb(b).some((c) => c !== a && !nb(a).includes(c))));
  const B = nb(A).find((b) => nb(b).some((c) => c !== A && !nb(A).includes(c)));
  const C = nb(B).find((c) => c !== A && !nb(A).includes(c));
  const D = nb(C).find((d) => d !== B && d !== A) || B;

  it('is 0 for the anchor region itself', () => {
    expect(distanceFromAnchor([A], A)).toBe(0);
  });

  it('is 1 for a direct neighbor of the anchor', () => {
    expect(distanceFromAnchor([A], B)).toBe(1);
  });

  it('grows correctly for a multi-hop path (A -> B -> C)', () => {
    expect(distanceFromAnchor([A], B)).toBe(1);
    expect(distanceFromAnchor([A], C)).toBe(2); // C only reachable via B from A
  });

  it('finds the shortest distance across multiple anchors, not just the first', () => {
    expect(distanceFromAnchor([A, D], C)).toBe(1); // D borders C directly
  });
});

describe('getNationCapital (overextension anchor)', () => {
  it('returns the isCapital-flagged region for every one of the 240 nations', () => {
    const nationIds = [...new Set(Object.values(REGIONS_DATA).map(r => r.startOwner))];
    expect(nationIds.length).toBe(240);
    nationIds.forEach(nationId => {
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

describe('getCapital (plan §M15: dynamic capital)', () => {
  it('falls back to the native capital when a nation has no capitalRegionId (no state.nations, or a record missing the field)', () => {
    expect(getCapital({ nations: {} }, 'fr')).toBe(getNationCapital('fr'));
    expect(getCapital({ nations: { fr: {} } }, 'fr')).toBe(getNationCapital('fr'));
  });

  it('prefers the nation\'s own capitalRegionId once one has been set (e.g. after Move Capital)', () => {
    const state = { nations: { fr: { capitalRegionId: 'some-other-region' } } };
    expect(getCapital(state, 'fr')).toBe('some-other-region');
  });
});
