import { describe, it, expect } from 'vitest';
import { buildingUpkeepOf } from './economy';
import { BUILDING_UPKEEP_GOLD } from '../data/actionCosts';

const state = (cats) => ({ playerNationId: 'p', regions: { c1: { owner: 'p', buildings: { categories: cats } }, c2: { owner: 'q', buildings: { categories: { food: 4 } } } } });

describe('building upkeep (H-13)', () => {
  it('charges BUILDING_UPKEEP_GOLD x (tier+1) per standing building, rounded down, skipping defense and empty slots', () => {
    const s = state({ food: 0, economy: 1, military: 2, defense: 3, science: -1 });
    expect(buildingUpkeepOf(s, s.regions, 'p')).toBe(Math.floor(BUILDING_UPKEEP_GOLD * (1 + 2 + 3)));
  });
  it('is zero for every nation but the player', () => {
    const s = state({ food: 3 });
    expect(buildingUpkeepOf(s, s.regions, 'q')).toBe(0);
  });
});
