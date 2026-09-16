import { describe, it, expect } from 'vitest';
import { REGIONS_DATA, getNeighborIds, isAdjacentToOwner, distanceFromAnchor, getNationCapital, CORE_REGION_IDS, HAND_AUTHORED_REGION_IDS } from './regions';

describe('region adjacency graph', () => {
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
  // are genuinely separate landmasses with zero real land border between them. What still must
  // hold is the guarantee the original campaign was built and tested against: the 28 hand-authored
  // regions themselves stay one connected graph.
  it('the 28 hand-authored regions remain fully connected to each other', () => {
    const seen = new Set([HAND_AUTHORED_REGION_IDS[0]]);
    const queue = [HAND_AUTHORED_REGION_IDS[0]];
    while (queue.length) {
      const current = queue.shift();
      getNeighborIds(current).forEach(n => {
        if (HAND_AUTHORED_REGION_IDS.includes(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
      });
    }
    const unreachable = HAND_AUTHORED_REGION_IDS.filter(id => !seen.has(id));
    expect(unreachable).toEqual([]);
  });

  it('every hand-authored region has at least one neighbor', () => {
    const isolated = HAND_AUTHORED_REGION_IDS.filter(id => REGIONS_DATA[id].neighbors.length === 0);
    expect(isolated).toEqual([]);
  });

  it('most generated world regions have at least one real land neighbor (islands are the expected exception)', () => {
    const worldIds = Object.keys(REGIONS_DATA).filter(id => !HAND_AUTHORED_REGION_IDS.includes(id));
    const withNeighbors = worldIds.filter(id => REGIONS_DATA[id].neighbors.length > 0);
    expect(withNeighbors.length / worldIds.length).toBeGreaterThan(0.6);
  });
});

describe('isAdjacentToOwner', () => {
  it('is true when a neighboring region is owned by the given owner', () => {
    const regions = { tel_aviv: { owner: 'player' }, haifa: { owner: 'player' }, jerusalem: { owner: 'egypt' } };
    expect(isAdjacentToOwner('haifa', regions, 'player')).toBe(true);
  });

  it('is false when no neighbor is owned by the given owner', () => {
    const regions = { egypt_cairo: { owner: 'egypt' }, egypt_sinai: { owner: 'egypt' } };
    expect(isAdjacentToOwner('egypt_cairo', regions, 'player')).toBe(false);
  });
});

describe('distanceFromAnchor (Phase 7: overextension)', () => {
  it('is 0 for the anchor region itself', () => {
    expect(distanceFromAnchor(['tel_aviv'], 'tel_aviv')).toBe(0);
  });

  it('is 1 for a direct neighbor of the anchor', () => {
    expect(distanceFromAnchor(['tel_aviv'], 'gaza')).toBe(1); // gaza borders tel_aviv
  });

  it('grows correctly for a multi-hop path (negev -> egypt_sinai -> egypt_cairo)', () => {
    expect(distanceFromAnchor(['negev'], 'egypt_sinai')).toBe(1);
    expect(distanceFromAnchor(['negev'], 'egypt_cairo')).toBe(2);
  });

  it('finds the shortest distance across multiple anchors, not just the first', () => {
    // egypt_cairo is 2 hops from negev but (via the same path) still 2 from the full core set —
    // this just confirms passing several anchors doesn't break or inflate the result.
    expect(distanceFromAnchor(CORE_REGION_IDS, 'egypt_cairo')).toBe(2);
  });
});

describe('getNationCapital (Phase 7: overextension anchor)', () => {
  it('returns the isCapital-flagged region for every nation that starts with territory', () => {
    const nationIds = new Set(Object.values(REGIONS_DATA).map(r => r.startOwner).filter(id => id && id !== 'player'));
    nationIds.forEach(nationId => {
      const capitalId = getNationCapital(nationId);
      expect(capitalId, `${nationId} has no capital`).toBeTruthy();
      expect(REGIONS_DATA[capitalId].isCapital).toBe(true);
      expect(REGIONS_DATA[capitalId].startOwner).toBe(nationId);
    });
  });

  it('returns null for a stateless actor with no starting territory (Hamas)', () => {
    expect(getNationCapital('hamas')).toBeNull();
  });
});
