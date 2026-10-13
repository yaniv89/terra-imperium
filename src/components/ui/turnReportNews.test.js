import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { turnReportModel } from './turnReportModel';
import { cap } from '../../engine/testWorld';
import { LogTypes } from '../../data/types';

// Playtest audit I172: a sack that shrinks a city and growth in the same report read in order.
describe('turn report: shrink then growth', () => {
  it('explains a city that shrank and grew back', () => {
    const before = createInitialState({ playerNationId: 'fr', rngSeed: 11 });
    const id = cap('fr');
    const city = before.regions[id];
    const after = {
      ...before,
      turnNumber: before.turnNumber + 1,
      regions: { ...before.regions, [id]: { ...city, size: (city.size || 1) + 1 } },
      logs: [...before.logs, { year: before.year, type: LogTypes.COMBAT, message: `Raiders sack ${city.name}: 40 gold taken, the city shrinks to 1.` }]
    };
    const m = turnReportModel(before, after);
    const grew = m.items.find((i) => i.growth);
    expect(grew.title).toBe(`${city.name} grew to size ${(city.size || 1) + 1}`);
    expect(grew.sub).toMatch(/shrank to 1/);
  });
});
