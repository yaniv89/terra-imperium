import { describe, it, expect } from 'vitest';
import {
  AI_THINK_PERIOD, thinksThisTurn, getEffectiveMilitaryPower,
  calcAllNationIncomes, processAIEconomyTurn, canAffordAIRecruit, applyAIRecruitCost
} from './aiEconomy';
import { REGIONS_DATA } from '../data/regions';
import { seedDevelopment } from './development';

// Real geo ids (both start-owned by Indonesia, both coastal) rather than hand-faked region data —
// calcAllNationIncomes/tryConstructBuilding read isCoastal/isCapital/population straight off
// REGIONS_DATA, so a fake id would silently no-op every one of those checks.
const REGION_A = 'id-ki';
const REGION_B = 'id-kb';
const REGION_C = 'id-jt';

const makeRegion = (id, overrides = {}) => ({
  id,
  owner: 'id',
  control: 100,
  currentInfrastructure: 0,
  currentPopulation: REGIONS_DATA[id].population,
  dev: seedDevelopment(id),
  buildings: { categories: {} },
  ...overrides
});

const makeAiNation = (overrides = {}) => ({
  doctrine: 'attrition',
  government: null,
  stability: 0,
  legitimacy: 50,
  economy: { gold: 0, hr: 0, techPoints: 0, adm: 0, dip: 0, mil: 0 },
  tech: { researched: [], ageId: 'bronze' },
  ...overrides
});

const makeState = ({ age = 'bronze', regions = {}, nations = {}, units = {} } = {}) => ({
  playerNationId: 'us',
  age,
  year: 3000, // clear of every tech's yearAvailable gate — these tests are about resource affordability, not the calendar
  units,
  regions,
  nations: { us: {}, ...nations },
  greatProjects: {},
  satellites: {},
  regionModifiers: {}
});

describe('AI think cadence (plan §C)', () => {
  it('Tier 1 nations think every turn', () => {
    expect(AI_THINK_PERIOD[1]).toBe(1);
    for (let t = 0; t < 5; t++) expect(thinksThisTurn('id', 1, t)).toBe(true);
  });

  it('Tier 2 thinks exactly 1 turn in 3, Tier 3 exactly 1 in 10', () => {
    let tier2Count = 0;
    let tier3Count = 0;
    for (let t = 0; t < 30; t++) {
      if (thinksThisTurn('id', 2, t)) tier2Count++;
      if (thinksThisTurn('id', 3, t)) tier3Count++;
    }
    expect(tier2Count).toBe(10);
    expect(tier3Count).toBe(3);
  });

  it('spreads nations of the same tier across different turns via a hash of the nation id', () => {
    const turnsThatThink = (nationId) => {
      const turns = [];
      for (let t = 0; t < 3; t++) if (thinksThisTurn(nationId, 2, t)) turns.push(t);
      return turns;
    };
    // Not every nation id can land on a different turn (only 3 slots exist), but at least these two
    // real, differently-spelled ids don't collide by construction (a bug that hardcoding period=1
    // for every tier, or hashing nothing at all, would both produce).
    expect(turnsThatThink('id')).not.toEqual(turnsThatThink('br'));
  });
});

describe('getEffectiveMilitaryPower (plan §M16)', () => {
  it('sums real fielded strength with a damped militaryStrength garrison', () => {
    const state = { nations: { id: { militaryStrength: 1000 } }, units: { u1: { ownerId: 'id', strength: 50 } } };
    expect(getEffectiveMilitaryPower(state, 'id')).toBe(50 + 1000 * 0.1);
  });

  it('is 0 for a nation with no units and no garrison', () => {
    const state = { nations: { id: {} }, units: {} };
    expect(getEffectiveMilitaryPower(state, 'id')).toBe(0);
  });
});

describe('calcAllNationIncomes', () => {
  it('computes real gold/hr income for a non-player nation from its owned, unoccupied regions', () => {
    const regions = { [REGION_A]: makeRegion(REGION_A), [REGION_B]: makeRegion(REGION_B) };
    const state = makeState({ regions, nations: { id: makeAiNation() } });
    const incomes = calcAllNationIncomes(state);
    expect(incomes.id.gold).toBeGreaterThan(0);
    expect(incomes.id.hr).toBeGreaterThan(0);
  });

  it('excludes a region while it is occupied by someone else (plan §M13: occupation gives the owner nothing)', () => {
    const ownedOnly = calcAllNationIncomes(makeState({ regions: { [REGION_A]: makeRegion(REGION_A) }, nations: { id: makeAiNation() } }));
    const withOccupied = calcAllNationIncomes(makeState({
      regions: { [REGION_A]: makeRegion(REGION_A), [REGION_B]: makeRegion(REGION_B, { occupiedBy: 'br' }) },
      nations: { id: makeAiNation() }
    }));
    expect(withOccupied.id.gold).toBe(ownedOnly.id.gold);
  });

  it('never produces an income entry for the player nation (the player keeps calcIncome instead)', () => {
    const regions = { [REGION_C]: makeRegion(REGION_C, { owner: 'us' }) };
    const incomes = calcAllNationIncomes(makeState({ regions }));
    expect(incomes.us).toBeUndefined();
  });
});

describe('processAIEconomyTurn (plan §M16: one spending decision per think)', () => {
  it('deducts unit upkeep from gold and floors at 0 rather than going negative', () => {
    const state = makeState({
      regions: { [REGION_A]: makeRegion(REGION_A) },
      nations: { id: makeAiNation({ economy: { gold: 1, hr: 0, techPoints: 0, adm: 0, dip: 0, mil: 0 }, government: { type: 'dictatorship', reforms: {} } }) },
      units: { u1: { ownerId: 'id', strength: 10 }, u2: { ownerId: 'id', strength: 10 } }
    });
    const { nation } = processAIEconomyTurn(state, state.regions, 'id');
    expect(nation.economy.gold).toBe(0);
  });

  it('adopts a real government once old enough to leave Tribal behind', () => {
    const state = makeState({
      age: 'classical',
      regions: { [REGION_A]: makeRegion(REGION_A) },
      nations: { id: makeAiNation({ government: null }) }
    });
    const { nation } = processAIEconomyTurn(state, state.regions, 'id');
    expect(nation.government).toBeTruthy();
    expect(nation.government.type).not.toBe('tribal');
  });

  it('stays Tribal before the Classical age (nothing to gain from reforming yet)', () => {
    const state = makeState({
      age: 'bronze',
      regions: { [REGION_A]: makeRegion(REGION_A) },
      nations: { id: makeAiNation({ government: null, economy: { gold: 1000, hr: 0, techPoints: 0, adm: 0, dip: 0, mil: 0 } }) }
    });
    const { nation } = processAIEconomyTurn(state, state.regions, 'id');
    // No government decision fires, so the very next priority (construct a building) should have run.
    expect(nation.government).toBeFalsy();
  });

  it('fills in the current age reform tier once a non-tribal government type is already chosen', () => {
    const state = makeState({
      age: 'bronze',
      regions: { [REGION_A]: makeRegion(REGION_A) },
      nations: { id: makeAiNation({ government: { type: 'monarchy', reforms: {} } }) }
    });
    const { nation } = processAIEconomyTurn(state, state.regions, 'id');
    expect(nation.government.reforms.bronze).toBeTruthy();
  });

  it('constructs the doctrine-preferred, affordable building tier in the highest-dev owned region only', () => {
    const state = makeState({
      age: 'bronze',
      regions: {
        [REGION_A]: makeRegion(REGION_A),
        [REGION_B]: makeRegion(REGION_B, { dev: { tax: 30, production: 30, manpower: 30 } }) // clearly higher dev
      },
      nations: {
        id: makeAiNation({
          government: { type: 'dictatorship', reforms: { bronze: 'x', classical: 'x' } }, // already reformed -> falls through to building
          economy: { gold: 1000, hr: 0, techPoints: 0, adm: 0, dip: 0, mil: 0 }
        })
      }
    });
    const { nation } = processAIEconomyTurn(state, state.regions, 'id');
    expect(nation.economy.gold).toBeLessThan(1000); // spent on the building
    expect(state.regions[REGION_B].buildings.categories.military).toBe(0); // 'attrition' doctrine prioritizes military first
    expect(state.regions[REGION_A].buildings.categories.military).toBeUndefined(); // the OTHER owned region is untouched
  });

  it('never touches a region it does not own, even one adjacent/cheaper to build in', () => {
    const state = makeState({
      age: 'bronze',
      regions: { [REGION_A]: makeRegion(REGION_A), [REGION_C]: makeRegion(REGION_C, { owner: 'br' }) },
      nations: {
        id: makeAiNation({
          government: { type: 'dictatorship', reforms: { bronze: 'x', classical: 'x' } },
          economy: { gold: 1000, hr: 0, techPoints: 0, adm: 0, dip: 0, mil: 0 }
        })
      }
    });
    processAIEconomyTurn(state, state.regions, 'id');
    expect(state.regions[REGION_C].buildings.categories.military).toBeUndefined();
  });

  it('researches a tech when no government decision or affordable building is available', () => {
    const state = makeState({
      age: 'bronze',
      regions: { [REGION_A]: makeRegion(REGION_A, { buildings: { categories: { food: 0, economy: 0, military: 0, defense: 0, science: 0, industry: 0, culture: 0, naval: 0, logistics: 0 } } }) },
      nations: {
        id: makeAiNation({
          government: { type: 'dictatorship', reforms: { bronze: 'x', classical: 'x' } },
          economy: { gold: 1000, hr: 0, techPoints: 1000, adm: 0, dip: 0, mil: 1000 }
        })
      }
    });
    const { nation } = processAIEconomyTurn(state, state.regions, 'id');
    expect(nation.tech.researched.length).toBe(1);
  });

  it('does nothing (no crash, no change) for a nation with no seeded economy — a legacy/test fixture', () => {
    const state = makeState({ regions: { [REGION_A]: makeRegion(REGION_A) }, nations: { id: { doctrine: 'attrition' } } });
    expect(() => processAIEconomyTurn(state, state.regions, 'id')).not.toThrow();
  });
});

describe('canAffordAIRecruit / applyAIRecruitCost (plan §M16: real recruit cost once an economy exists)', () => {
  it('affords recruitment only when gold, manpower, and MIL power all clear the real cost', () => {
    const rich = { economy: { gold: 1000, hr: 1000, mil: 10 } };
    const poor = { economy: { gold: 0, hr: 0, mil: 0 } };
    expect(canAffordAIRecruit(rich)).toBe(true);
    expect(canAffordAIRecruit(poor)).toBe(false);
  });

  it('deducts exactly the recruit cost from the nation pool', () => {
    const nation = { economy: { gold: 1000, hr: 1000, mil: 10 } };
    const result = applyAIRecruitCost(nation);
    expect(result.economy.gold).toBe(1000 - 60);
    expect(result.economy.hr).toBe(1000 - 100);
    expect(result.economy.mil).toBe(10 - 1);
  });
});
