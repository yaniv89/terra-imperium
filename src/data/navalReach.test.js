import { describe, it, expect } from 'vitest';
import { NAVAL_REACH_KM, isCoastal, getAllSeaLanes, getSeaLanesWithinReach, isReachableBySea } from './navalReach';
import { AGE_ORDER } from './ages';
import { REGIONS_DATA, getNeighborIds } from './regions';

// isCoastal/getSeaLanesWithinReach/isReachableBySea now take real PROVINCE ids, not country ids —
// a country is coastal if ANY of its provinces is. These helpers resolve a country id to one real
// province for the spot-checks below, the same way a UI action (Amphibious Assault, Naval
// Engagement) always operates on one specific province.
const coastalProvinceOf = (countryId) => Object.values(REGIONS_DATA).find(r => r.startOwner === countryId && r.isCoastal)?.id;
const anyProvinceOf = (countryId) => Object.values(REGIONS_DATA).find(r => r.startOwner === countryId)?.id;

describe('isCoastal', () => {
  it('is true for a real coastal province of real coastal nations', () => {
    ['gb', 'jp', 'us', 'eg', 'au', 'cy', 'mg', 'id'].forEach(id => {
      expect(isCoastal(coastalProvinceOf(id)), id).toBe(true);
    });
  });

  it('is false for every province of real landlocked nations', () => {
    ['ch', 'at', 'mn', 'af', 'bo'].forEach(id => {
      expect(coastalProvinceOf(id), `${id} should have no coastal province at all`).toBeUndefined();
      expect(isCoastal(anyProvinceOf(id)), id).toBe(false);
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
    expect(isReachableBySea(coastalProvinceOf('gb'), coastalProvinceOf('fr'), 'bronze')).toBe(true);
  });

  it('a transoceanic lane is unreachable before Gunpowder and reachable by Modern', () => {
    // UK <-> US crosses the Atlantic — real transoceanic colonial-era range.
    expect(isReachableBySea(coastalProvinceOf('gb'), coastalProvinceOf('us'), 'bronze')).toBe(false);
    expect(isReachableBySea(coastalProvinceOf('gb'), coastalProvinceOf('us'), 'classical')).toBe(false);
    expect(isReachableBySea(coastalProvinceOf('gb'), coastalProvinceOf('us'), 'modern')).toBe(true);
  });

  it('only returns lanes within the given age\'s reach, all still under the reach cap', () => {
    const lanes = getSeaLanesWithinReach(coastalProvinceOf('gb'), 'classical');
    lanes.forEach(lane => expect(lane.km).toBeLessThanOrEqual(NAVAL_REACH_KM.classical));
  });

  it('getAllSeaLanes returns every lane regardless of age, a superset of any age-filtered result', () => {
    const all = getAllSeaLanes(coastalProvinceOf('jp'));
    const bronzeReach = getSeaLanesWithinReach(coastalProvinceOf('jp'), 'bronze');
    expect(all.length).toBeGreaterThanOrEqual(bronzeReach.length);
    bronzeReach.forEach(lane => expect(all.some(l => l.to === lane.to)).toBe(true));
  });

  it('returns nothing for a landlocked nation', () => {
    expect(getAllSeaLanes(anyProvinceOf('ch'))).toEqual([]);
    expect(isReachableBySea(anyProvinceOf('ch'), coastalProvinceOf('fr'), 'modern')).toBe(false);
  });
});

// The plan's explicit regression guard (§13): named island/peninsula nations must be unreachable
// by sea in the Bronze Age and reachable by the Age of Gunpowder, so islands can never silently
// fall out of the game the way they did under the old land-adjacency-only invasion system.
describe('island reachability guarantee', () => {
  const ISLAND_NATIONS = ['gb', 'jp', 'au', 'id', 'mg', 'cy'];

  it('every named island nation has a coastal province', () => {
    ISLAND_NATIONS.forEach(id => expect(coastalProvinceOf(id), id).toBeTruthy());
  });

  it('every named island nation has at least one sea lane reachable by the Age of Gunpowder', () => {
    ISLAND_NATIONS.forEach(id => {
      const reachable = getSeaLanesWithinReach(coastalProvinceOf(id), 'gunpowder');
      expect(reachable.length, `${id} has no Gunpowder-age sea lane`).toBeGreaterThan(0);
    });
  });
});

// The same guarantee, generalized to every real province rather than 6 named spot-checks — this
// is the plan §13 bullet in full: "an automated test asserting that every one of the 240 nations
// is conquerable... This is the regression guard that stops islands from silently falling out of
// the game again." A region graph splits into: one large land-connected mainland, a handful of
// tiny land-connected components (e.g. Great Britain/Ireland), and several dozen fully-isolated
// (no land neighbor at all) regions — every single isolated region turns out to be coastal, so
// none of them is EVER permanently unreachable: LAUNCH_INVASION covers the land-connected graph,
// and AMPHIBIOUS_ASSAULT (global sea reach at the Modern Age) covers every coastal region,
// including every isolated one.
describe('exhaustive reachability guarantee — every province', () => {
  it('every region either has a real land neighbor or is coastal (no region is land-isolated AND landlocked)', () => {
    Object.keys(REGIONS_DATA).forEach(id => {
      const hasLandNeighbor = getNeighborIds(id).length > 0;
      expect(hasLandNeighbor || isCoastal(id), `${id} (${REGIONS_DATA[id]?.name}) has no land neighbor and is not coastal — would be permanently unreachable`).toBe(true);
    });
  });

  it('every coastal region has a real Modern-age sea lane to at least one other region', () => {
    Object.keys(REGIONS_DATA).filter(id => isCoastal(id)).forEach(id => {
      const lanes = getSeaLanesWithinReach(id, 'modern');
      expect(lanes.length, `${id} (${REGIONS_DATA[id]?.name}) has no Modern-age sea lane`).toBeGreaterThan(0);
    });
  });
});
