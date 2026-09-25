import { describe, it, expect } from 'vitest';
import { processDisastersTurn, nextEconomicCollapseProgress, isEconomicCollapseDisasterReady } from './disasters';
import { createInitialState } from './gameReducer';
import { createInitialEstate, LABOR_ESTATE_ID } from '../data/estates';

const baseNation = () => createInitialState({ playerNationId: 'us' }).nations.us;

describe('processDisastersTurn — Estate Takeover (plan §M15)', () => {
  it('grows the meter while any estate has influence > 80 and loyalty < 50, and completes at 100', () => {
    let nation = {
      ...baseNation(),
      estates: { ...baseNation().estates, nobility: { loyalty: 20, influence: 90, privileges: [] } }
    };
    for (let turn = 1; turn <= 10; turn++) {
      const result = processDisastersTurn(nation, 'classical', turn);
      nation = result.nation;
    }
    expect(nation.disasters.estateTakeover).toBe(0); // completed and reset
  });

  it('grants an ADM/DIP/MIL modifier and a forced privilege once it completes', () => {
    let nation = {
      ...baseNation(),
      estates: { ...baseNation().estates, nobility: { loyalty: 20, influence: 90, privileges: [] } }
    };
    let lastResult;
    for (let turn = 1; turn <= 10; turn++) {
      lastResult = processDisastersTurn(nation, 'classical', turn);
      nation = lastResult.nation;
    }
    expect(nation.modifiers.some((m) => m.sourceId === 'estate_takeover')).toBe(true);
    expect(nation.estates.nobility.privileges.length).toBeGreaterThan(0);
    expect(lastResult.logs.length).toBeGreaterThan(0);
  });

  it('decays back toward 0 once the trigger condition stops holding', () => {
    const triggeringNation = { ...baseNation(), estates: { ...baseNation().estates, nobility: { loyalty: 20, influence: 90, privileges: [] } } };
    const grown = processDisastersTurn(triggeringNation, 'classical', 1).nation;
    expect(grown.disasters.estateTakeover).toBeGreaterThan(0);
    const calmNation = { ...grown, estates: { ...grown.estates, nobility: { loyalty: 60, influence: 10, privileges: [] } } };
    const decayed = processDisastersTurn(calmNation, 'classical', 2).nation;
    expect(decayed.disasters.estateTakeover).toBeLessThan(grown.disasters.estateTakeover);
  });
});

describe('processDisastersTurn — Succession War (plan §M15)', () => {
  it('triggers civil war once a heirless, low-legitimacy monarchy completes the meter', () => {
    let nation = { ...baseNation(), government: { type: 'monarchy', reforms: {} }, heir: null, legitimacy: 10 };
    let triggered = false;
    for (let turn = 1; turn <= 10; turn++) {
      const result = processDisastersTurn(nation, 'classical', turn);
      nation = result.nation;
      if (result.triggersCivilWar) triggered = true;
    }
    expect(triggered).toBe(true);
  });

  it('never triggers for a republic, regardless of legitimacy/heir', () => {
    let nation = { ...baseNation(), government: { type: 'republic', reforms: {} }, heir: null, legitimacy: 5 };
    let triggered = false;
    for (let turn = 1; turn <= 15; turn++) {
      const result = processDisastersTurn(nation, 'classical', turn);
      nation = result.nation;
      if (result.triggersCivilWar) triggered = true;
    }
    expect(triggered).toBe(false);
  });
});

describe('processDisastersTurn — Revolution (plan §M15)', () => {
  it('overturns the government and triggers civil war once stability collapses with a disloyal Labor estate, Modern age only', () => {
    let nation = {
      ...baseNation(),
      government: { type: 'monarchy', reforms: {} },
      stability: -3,
      estates: { ...baseNation().estates, [LABOR_ESTATE_ID]: { ...createInitialEstate(), loyalty: 10 } }
    };
    let triggered = false;
    for (let turn = 1; turn <= 10; turn++) {
      const result = processDisastersTurn(nation, 'modern', turn);
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
      estates: { ...baseNation().estates, [LABOR_ESTATE_ID]: { ...createInitialEstate(), loyalty: 10 } }
    };
    const result = processDisastersTurn(nation, 'gunpowder', 1);
    expect(result.nation.disasters.revolution).toBe(0);
    expect(result.triggersCivilWar).toBe(false);
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
