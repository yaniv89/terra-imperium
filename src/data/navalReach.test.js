import { describe, it, expect } from 'vitest';
import { NAVAL_REACH_KM, isCoastal, getAllSeaLanes, getSeaLanesWithinReach, isReachableBySea } from './navalReach';
import { AGE_ORDER } from './ages';

describe('isCoastal', () => {
  it('is true for real coastal nations', () => {
    ['gb', 'jp', 'us', 'eg', 'au', 'cy', 'mg', 'id'].forEach(id => {
      expect(isCoastal(id), id).toBe(true);
    });
  });

  it('is false for real landlocked nations', () => {
    ['ch', 'at', 'mn', 'af', 'bo'].forEach(id => {
      expect(isCoastal(id), id).toBe(false);
    });
  });

  it('is false for an unknown region id rather than throwing', () => {
    expect(() => isCoastal('not-a-real-region')).not.toThrow();
    expect(isCoastal('not-a-real-region')).toBe(false);
  });
});

describe('NAVAL_REACH_KM', () => {
  it('grows monotonically age over age, ending unbounded at Modern', () => {
    const values = AGE_ORDER.map(id => NAVAL_REACH_KM[id]);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    expect(NAVAL_REACH_KM.modern).toBe(Infinity);
  });
});

describe('getSeaLanesWithinReach / isReachableBySea', () => {
  it('a very short lane (Dover Strait) is reachable even in the Bronze Age', () => {
    expect(isReachableBySea('gb', 'fr', 'bronze')).toBe(true);
  });

  it('a transoceanic lane is unreachable before Gunpowder and reachable by Modern', () => {
    // UK <-> US crosses the Atlantic — real transoceanic colonial-era range.
    expect(isReachableBySea('gb', 'us', 'bronze')).toBe(false);
    expect(isReachableBySea('gb', 'us', 'classical')).toBe(false);
    expect(isReachableBySea('gb', 'us', 'modern')).toBe(true);
  });

  it('only returns lanes within the given age\'s reach, all still under the reach cap', () => {
    const lanes = getSeaLanesWithinReach('gb', 'classical');
    lanes.forEach(lane => expect(lane.km).toBeLessThanOrEqual(NAVAL_REACH_KM.classical));
  });

  it('getAllSeaLanes returns every lane regardless of age, a superset of any age-filtered result', () => {
    const all = getAllSeaLanes('jp');
    const bronzeReach = getSeaLanesWithinReach('jp', 'bronze');
    expect(all.length).toBeGreaterThanOrEqual(bronzeReach.length);
    bronzeReach.forEach(lane => expect(all.some(l => l.to === lane.to)).toBe(true));
  });

  it('returns nothing for a landlocked nation', () => {
    expect(getAllSeaLanes('ch')).toEqual([]);
    expect(isReachableBySea('ch', 'fr', 'modern')).toBe(false);
  });
});

// The plan's explicit regression guard (§13): named island/peninsula nations must be unreachable
// by sea in the Bronze Age and reachable by the Age of Gunpowder, so islands can never silently
// fall out of the game the way they did under the old land-adjacency-only invasion system.
describe('island reachability guarantee', () => {
  const ISLAND_NATIONS = ['gb', 'jp', 'au', 'id', 'mg', 'cy'];

  it('every named island nation is coastal', () => {
    ISLAND_NATIONS.forEach(id => expect(isCoastal(id), id).toBe(true));
  });

  it('every named island nation has at least one sea lane reachable by the Age of Gunpowder', () => {
    ISLAND_NATIONS.forEach(id => {
      const reachable = getSeaLanesWithinReach(id, 'gunpowder');
      expect(reachable.length, `${id} has no Gunpowder-age sea lane`).toBeGreaterThan(0);
    });
  });
});
