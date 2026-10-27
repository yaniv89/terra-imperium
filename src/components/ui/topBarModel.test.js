import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { declareWar } from '../../engine/diplomacy';
import { topBarModel, yearLabel, scienceLabel, goldIncomeRows, GOLD_CITY_ROWS } from './topBarModel';
import { calcIncome } from '../../utils/helpers';
import { addCities } from '../../engine/testWorld';
import { grantDecree, spendDecree } from '../../engine/decrees';

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
    expect(m.gold.reasons.reduce((s, r) => s + r.value, 0)).toBe(m.gold.perTurn); // the rows add up to the change
    expect(m.food).toMatchObject({ value: 12, perTurn: 3 });
    expect(m.food.reasons.find((r) => r.id === cap)).toMatchObject({ value: 3 });
    expect(m.culture.perTurn).toBe(2);
    expect(m.culture.reasons).toEqual([{ id: cap, label: base.regions[cap].name, value: 2 }]);
    expect(m.year).toBe('c. 5000 BCE'); // a new game starts in the Stone Age
    expect(m.turn).toBe(base.turnNumber);
    expect(m.warLabel).toBeNull();
  });

  it('names every source of the gold income, and the rows add up to it (playtest issue 13)', () => {
    let s = createInitialState({ playerNationId: 'akkad', rngSeed: 11 }); // a city start
    s = addCities(s, s.playerNationId, GOLD_CITY_ROWS + 2).state;
    const gold = calcIncome(s).gold;
    const rows = goldIncomeRows(s, gold);
    expect(rows.reduce((t, r) => t + r.value, 0)).toBe(Math.round(gold));
    expect(rows.filter((r) => r.id.startsWith('city:')).length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.id.startsWith('city:')).length).toBeLessThanOrEqual(GOLD_CITY_ROWS);
    rows.forEach((r) => { expect(r.label).toBeTruthy(); expect(r.label).not.toMatch(/\{|undefined|NaN/); });
    expect(calcIncome(s, { goldParts: [] })).toEqual(calcIncome(s)); // the parts never change the income
    const m = topBarModel(s);
    expect(m.gold.reasons.reduce((t, r) => t + r.value, 0)).toBe(m.gold.perTurn);
  });

  it('shows the war pill only at war, with the enemy\'s short name', () => {
    const enemy = Object.keys(base.nations).find((id) => id !== base.playerNationId && base.nations[id].capitalRegionId && !base.nations[id].indep);
    const atWar = declareWar(base, enemy, { aggressor: base.playerNationId });
    const m = topBarModel(atWar);
    expect(m.wars.map((w) => w.id)).toContain(enemy);
    expect(m.warLabel).toMatch(/^At war: /);
  });

  it('never shows a raw placeholder when the enemy has no name', () => {
    const enemy = Object.keys(base.nations).find((id) => id !== base.playerNationId && base.nations[id].capitalRegionId && !base.nations[id].indep);
    const atWar = declareWar(base, enemy, { aggressor: base.playerNationId });
    const nameless = { ...atWar, nations: { ...atWar.nations, [enemy]: { ...atWar.nations[enemy], name: undefined } } };
    expect(topBarModel(nameless).warLabel).not.toMatch(/[{}]|undefined/);
  });

  it('formats the year and the science label', () => {
    expect(yearLabel(-1984)).toBe('1984 BCE');
    expect(yearLabel(5)).toBe('5 CE');
    expect(scienceLabel(null)).toBe('Choose research');
    expect(scienceLabel({ tech: { name: 'Bronze Working' }, finishesIn: 3 })).toBe('Bronze Working 3t');
    expect(scienceLabel({ tech: { name: 'Writing' }, finishesIn: Infinity })).toBe('Writing');
  });
});

describe('the decrees on the top bar (U9)', () => {
  it('reads the bank, the cap, the reasons newest first and what the acts cost', () => {
    const me = base.playerNationId;
    const n = base.nations[me];
    const s = { ...base, nations: { ...base.nations, [me]: grantDecree(spendDecree(grantDecree({ ...n, ruler: { ...n.ruler, decrees: 0, decreeLog: [] } }, 'warWon', 4, 'Elam'), 'changeLaw', 5), 'wonder', 6) } };
    const d = topBarModel(s).decrees;
    expect(d).toMatchObject({ value: 1, cap: 3 });
    expect(d.reasons.map((r) => [r.label, r.value])).toEqual([['Wonder completed', 1], ['Change a law', -1], ['War won: Elam', 1]]);
    expect(d.costs[0]).toMatchObject({ n: 2, labels: ['Change the government'] });
    expect(d.costs[1].n).toBe(1);
    expect(d.costs[1].labels).toContain('Make a vassal');
  });
});
