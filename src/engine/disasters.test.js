import { describe, it, expect } from 'vitest';
import { processDisastersTurn, nextEconomicCollapseProgress, isEconomicCollapseDisasterReady } from './disasters';
import { createInitialState } from './gameReducer';

const baseNation = () => createInitialState({ playerNationId: 'us', rngSeed: 1 }).nations.us;

describe('processDisastersTurn — Revolution (plan §M15)', () => {
  it('overturns the government and triggers civil war once stability collapses under a discredited regime, Modern age only', () => {
    let nation = {
      ...baseNation(),
      government: { type: 'monarchy', reforms: {} },
      stability: -3,
      legitimacy: 10
    };
    let triggered = false;
    for (let turn = 1; turn <= 10; turn++) {
      const result = processDisastersTurn(nation, 'modern');
      nation = result.nation;
      if (result.triggersCivilWar) triggered = true;
    }
    expect(triggered).toBe(true);
    expect(['republic', 'dictatorship']).toContain(nation.government.type);
  });

  it('does not progress at all outside the Modern age', () => {
    let nation = {
      ...baseNation(),
      government: { type: 'monarchy', reforms: {} },
      stability: -3,
      legitimacy: 10
    };
    const result = processDisastersTurn(nation, 'gunpowder');
    expect(result.nation.disasters.revolution).toBe(0);
    expect(result.triggersCivilWar).toBe(false);
  });
});

describe('processDisastersTurn — old meters', () => {
  it('drops the Estate Takeover and Succession War meters', () => {
    const nation = { ...baseNation(), disasters: { estateTakeover: 40, successionWar: 30, economicCollapse: 20, revolution: 0 } };
    expect(processDisastersTurn(nation, 'classical').nation.disasters).toEqual({ economicCollapse: 20, revolution: 0 });
  });

  it('a legitimate regime sees no revolution even at low stability', () => {
    const nation = { ...baseNation(), stability: -3, legitimacy: 60 };
    expect(processDisastersTurn(nation, 'modern').nation.disasters.revolution).toBe(0);
  });
});

describe('nextEconomicCollapseProgress / isEconomicCollapseDisasterReady (plan §M15)', () => {
  it('only grows with >= 3 loans AND a negative net income this turn', () => {
    const twoLoans = { loans: [{}, {}], disasters: { economicCollapse: 0 } };
    expect(nextEconomicCollapseProgress(twoLoans, true)).toBe(0); // only 2 loans

    const threeLoansPositiveIncome = { loans: [{}, {}, {}], disasters: { economicCollapse: 0 } };
    expect(nextEconomicCollapseProgress(threeLoansPositiveIncome, false)).toBe(0); // income is fine

    const threeLoansNegativeIncome = { loans: [{}, {}, {}], disasters: { economicCollapse: 0 } };
    expect(nextEconomicCollapseProgress(threeLoansNegativeIncome, true)).toBeGreaterThan(0);
  });

  it('is ready once progress reaches 100', () => {
    expect(isEconomicCollapseDisasterReady(90)).toBe(false);
    expect(isEconomicCollapseDisasterReady(100)).toBe(true);
  });
});
