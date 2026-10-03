import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { empireOverviewModel } from './empireOverviewModel';
import { authorityOf } from '../../engine/authority';
import { ERA_GOALS_FOR_LEGACY } from '../../data/eraGoals';

describe('empire overview model', () => {
  it('reads authority, the era goals, the treasury lines, cities, people and research for the player', () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const m = empireOverviewModel(s);
    expect(m.name).toBe(s.nations.fr.name);
    expect(m.authority.total).toBe(authorityOf(s, 'fr').total);
    expect(['red', 'amber', 'green']).toContain(m.authority.tone);
    expect(m.era.goals).toHaveLength(5);
    expect(m.era.needed).toBe(ERA_GOALS_FOR_LEGACY);
    expect(m.era.goals.find((g) => g.id === 'expand').value).toBe(m.cities);
    expect(m.cities).toBeGreaterThan(0);
    expect(m.people).toBeGreaterThan(0);
    expect(m.treasury.net).toBe(m.treasury.income - m.treasury.upkeep);
    expect(m.treasury.expenseLines.every((l) => l.value > 0)).toBe(true);
    expect(m.wars).toEqual([]);
    expect(typeof m.research.science).toBe('number');
    expect(empireOverviewModel({ ...s, playerNationId: 'nope' })).toBeNull();
  });
});
