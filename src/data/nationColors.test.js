import { describe, it, expect } from 'vitest';
import { NATION_COLORS, getNationColor, UNKNOWN_NATION_COLOR } from './nationColors';
import { REGIONS_DATA } from './regions';

describe('NATION_COLORS', () => {
  it('assigns every real nation (every distinct startOwner) a color', () => {
    const nationIds = new Set(Object.values(REGIONS_DATA).map((r) => r.startOwner));
    nationIds.forEach((id) => {
      expect(NATION_COLORS[id], id).toBeDefined();
    });
  });

  it('is stable across repeated reads (same module instance -> same color every time)', () => {
    const nationIds = Object.keys(NATION_COLORS);
    const first = nationIds.map((id) => NATION_COLORS[id]);
    const second = nationIds.map((id) => NATION_COLORS[id]);
    expect(second).toEqual(first);
  });

  it('gives directly-bordering nations different colors in the overwhelming majority of cases', () => {
    // Real-world geography means a handful of nations border 15-20+ others (e.g. Russia, China) —
    // more than the palette's own size — where a repeat is an accepted, documented rarity rather
    // than a bug. This asserts the greedy assignment is actually doing its job, not that it's
    // perfect for every nation on Earth.
    const adjacency = {};
    Object.values(REGIONS_DATA).forEach((region) => {
      const nationId = region.startOwner;
      if (!nationId) return;
      const set = (adjacency[nationId] ||= new Set());
      (region.neighbors || []).forEach((neighborId) => {
        const neighborNation = REGIONS_DATA[neighborId]?.startOwner;
        if (neighborNation && neighborNation !== nationId) set.add(neighborNation);
      });
    });

    let pairs = 0;
    let clashes = 0;
    Object.entries(adjacency).forEach(([nationId, neighbors]) => {
      neighbors.forEach((neighborId) => {
        if (neighborId <= nationId) return; // count each undirected pair once
        pairs += 1;
        if (NATION_COLORS[nationId] === NATION_COLORS[neighborId]) clashes += 1;
      });
    });
    expect(pairs).toBeGreaterThan(0);
    expect(clashes / pairs).toBeLessThan(0.05);
  });
});

describe('getNationColor', () => {
  it('returns the assigned color for a known nation', () => {
    expect(getNationColor('fr')).toBe(NATION_COLORS.fr);
  });

  it('falls back to UNKNOWN_NATION_COLOR for an unrecognized id', () => {
    expect(getNationColor('not_a_real_nation')).toBe(UNKNOWN_NATION_COLOR);
  });
});
