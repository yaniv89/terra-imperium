import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { declareWar } from '../../engine/diplomacy';
import { topBarModel, yearLabel, scienceLabel } from './topBarModel';

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });

describe('the world top bar (U1, plans/UI-DESIGN.md section 2)', () => {
  it('names the people shortly, keeps the title, and reads gold, food, science and culture', () => {
    const me = base.playerNationId;
    const cap = base.nations[me].capitalRegionId;
    const s = { ...base, regions: { ...base.regions, [cap]: { ...base.regions[cap], food: 12, lastYields: { ...(base.regions[cap].lastYields || {}), food: 3, culture: 2 } } } };
    const m = topBarModel(s);
    expect(m.nation.name).toBe('Akkad');
    expect(m.nation.title).toBe(base.nations[me].name);
    expect(m.gold.value).toBe(Math.round(base.resources.gold));
    expect(m.gold.reasons[0]).toMatchObject({ id: 'income' });
    expect(m.food).toMatchObject({ value: 12, perTurn: 3 });
    expect(m.food.reasons.find((r) => r.id === cap)).toMatchObject({ value: 3 });
    expect(m.culture.perTurn).toBe(2);
    expect(m.culture.reasons).toEqual([{ id: cap, label: base.regions[cap].name, value: 2 }]);
    expect(m.year).toBe('2000 BCE');
    expect(m.turn).toBe(base.turnNumber);
    expect(m.warLabel).toBeNull();
  });

  it('shows the war pill only at war, with the enemy\'s short name', () => {
    const enemy = Object.keys(base.nations).find((id) => id !== base.playerNationId && base.nations[id].capitalRegionId && !base.nations[id].indep);
    const atWar = declareWar(base, enemy, { aggressor: base.playerNationId });
    const m = topBarModel(atWar);
    expect(m.wars.map((w) => w.id)).toContain(enemy);
    expect(m.warLabel).toMatch(/^At war: /);
  });

  it('formats the year and the science label', () => {
    expect(yearLabel(-1984)).toBe('1984 BCE');
    expect(yearLabel(5)).toBe('5 CE');
    expect(scienceLabel(null)).toBe('Choose research');
    expect(scienceLabel({ tech: { name: 'Bronze Working' }, finishesIn: 3 })).toBe('Bronze Working 3t');
    expect(scienceLabel({ tech: { name: 'Writing' }, finishesIn: Infinity })).toBe('Writing ?t');
  });
});
