import { describe, it, expect } from 'vitest';
import { REGIONS_DATA, getNeighborIds, isAdjacentToOwner } from './regions';

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

  it('is fully connected (no isolated region/subgraph)', () => {
    const ids = Object.keys(REGIONS_DATA);
    const seen = new Set([ids[0]]);
    const queue = [ids[0]];
    while (queue.length) {
      const current = queue.shift();
      getNeighborIds(current).forEach(n => {
        if (!seen.has(n)) { seen.add(n); queue.push(n); }
      });
    }
    const unreachable = ids.filter(id => !seen.has(id));
    expect(unreachable).toEqual([]);
  });

  it('every region has at least one neighbor', () => {
    const isolated = Object.entries(REGIONS_DATA).filter(([, data]) => data.neighbors.length === 0);
    expect(isolated).toEqual([]);
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
