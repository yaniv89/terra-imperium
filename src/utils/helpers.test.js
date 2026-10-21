import { describe, it, expect } from 'vitest';
import { canAfford, applyCosts, scaleCosts, calcIncome, getPlayerControl, getCostString, getResourceStrain, formatNumber, formatMoney, getSupplyCapacity, getStability, nextUnrest, getNationBonusTotal, getFieldedStrength, getDisplayPopulation } from './helpers';
import { peoplesWorld, rivalOf } from '../engine/testWorld';
import { REGIONS_DATA } from '../data/regions';
import { syncWorldRegistry } from '../engine/world/registry';

// A fixed small peoples world; the player's capital stands in for "its" region. The state is shared:
// a test that changes it in place takes cloneWorld first.
// The registry readers follow the last synced world, so each use re-syncs the shared state.
const world = (opts = {}) => syncWorldRegistry(peoplesWorld({ seed: 11, ...opts }));
const capOf = (state, id = state.playerNationId) => state.nations[id].capitalRegionId;

describe('canAfford / applyCosts', () => {
  it('rejects when any single resource is short', () => {
    const resources = { gold: 1000, adm: 3 };
    expect(canAfford(resources, { gold: 500, adm: 5 })).toBe(false);
    expect(canAfford(resources, { gold: 500, adm: 2 })).toBe(true);
  });

  it('applyCosts never drives a resource negative', () => {
    const resources = { gold: 100 };
    const next = applyCosts(resources, { gold: 500 });
    expect(next.gold).toBe(0);
  });

  it('applyCosts does not mutate the input', () => {
    const resources = { gold: 1000 };
    applyCosts(resources, { gold: 500 });
    expect(resources.gold).toBe(1000);
  });

  it('scaleCosts multiplies every field and rounds to a whole number', () => {
    expect(scaleCosts({ gold: 40, techPoints: 10 }, 1.9)).toEqual({ gold: 76, techPoints: 19 });
  });

  it('scaleCosts is a no-op at multiplier 1', () => {
    expect(scaleCosts({ gold: 40, techPoints: 10 }, 1)).toEqual({ gold: 40, techPoints: 10 });
  });
});

describe('formatNumber / formatMoney', () => {
  it('abbreviates large numbers', () => {
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(2500000)).toBe('2.5M');
    expect(formatNumber(500)).toBe('500');
  });

  it('formatMoney appends the gold suffix', () => {
    expect(formatMoney(1500)).toBe('1.5Kg');
  });
});

describe('getPlayerControl', () => {
  it('reads the player nation\'s own region control', () => {
    const state = world();
    expect(getPlayerControl(state)).toBe(state.regions[capOf(state)].control);
  });
});

describe('calcIncome', () => {
  it('yields only gold and hr in the Bronze Age (copper/iron/oil not unlocked)', () => {
    const state = world();
    const income = calcIncome(state);
    expect(income.gold).toBeGreaterThan(0);
    expect(income.hr).toBeGreaterThan(0);
    expect(income.copper).toBe(0);
    expect(income.iron).toBe(0);
    expect(income.oil).toBe(0);
  });

  it('scales with control% — a lower-control empire yields less income than a fully-controlled one', () => {
    // Halving every owned city's control (not just one of them) halves the empire-wide picture.
    const state = world();
    const fullControl = calcIncome(state);
    const halfControlRegions = { ...state.regions };
    Object.keys(halfControlRegions).forEach(id => {
      if (halfControlRegions[id].owner === state.playerNationId) halfControlRegions[id] = { ...halfControlRegions[id], control: 50 };
    });
    const halfControl = calcIncome({ ...state, regions: halfControlRegions });
    expect(halfControl.gold).toBeLessThan(fullControl.gold);
  });

  it('adds a flat gold bonus per active trade agreement', () => {
    // A Dawn capital pays a few gold a turn, so this gives it a real tax base first.
    const base = world({ seed: 1 });
    const state = { ...base, regions: Object.fromEntries(Object.entries(base.regions).map(([id, r]) => [id, r.owner === base.playerNationId ? { ...r, dev: { ...r.dev, tax: 100, production: 100 } } : r])) };
    const anyNationId = rivalOf(state);
    const withTrade = calcIncome({
      ...state,
      nations: { ...state.nations, [anyNationId]: { ...state.nations[anyNationId], hasTradeAgreement: true } }
    });
    const without = calcIncome(state);
    expect(withTrade.gold).toBeGreaterThan(without.gold);
  });

  it('yields a deposit resource once its extraction building is developed', () => {
    // Deposits are scarce (one holder per land, src/engine/world/registry.js): Shang's capital holds iron.
    const state = world({ player: 'shang' });
    expect(REGIONS_DATA[capOf(state)].deposits).toContain('iron');
    const withoutMine = calcIncome(state);
    expect(withoutMine.iron).toBe(0);

    const withMine = calcIncome({
      ...state,
      regions: {
        ...state.regions,
        [capOf(state)]: { ...state.regions[capOf(state)], buildings: { ...state.regions[capOf(state)].buildings, extraction: { ...state.regions[capOf(state)].buildings.extraction, iron: true } } }
      }
    });
    expect(withMine.iron).toBeGreaterThan(0);
  });

  it('yields nothing from an extraction building in a region with no matching deposit', () => {
    // Akkad's capital holds oil, no copper.
    const state = world();
    expect(REGIONS_DATA[capOf(state)].deposits).not.toContain('copper');
    const withMine = calcIncome({
      ...state,
      regions: {
        ...state.regions,
        [capOf(state)]: { ...state.regions[capOf(state)], buildings: { ...state.regions[capOf(state)].buildings, extraction: { ...state.regions[capOf(state)].buildings.extraction, copper: true } } }
      }
    });
    expect(withMine.copper).toBe(0);
  });

  it('a city earns by its size, not by a separate people number (one population model); extraction is deposit-driven', () => {
    const state = world({ player: 'shang', seed: 3 }); // Shang's capital has an iron deposit
    const capital = state.regions[capOf(state)];
    const withMine = { ...capital, buildings: { ...capital.buildings, extraction: { ...capital.buildings.extraction, iron: true } } };
    const baseWithMine = calcIncome({ ...state, regions: { ...state.regions, [capOf(state)]: withMine } });
    // A stale or edited people number on a city changes nothing: people are derived from size.
    const inflated = calcIncome({ ...state, regions: { ...state.regions, [capOf(state)]: { ...withMine, currentPopulation: Math.round(capital.currentPopulation * 1.5) } } });
    expect(inflated.gold).toBe(baseWithMine.gold);
    expect(inflated.hr).toBe(baseWithMine.hr);
    // A bigger economy (the dev a bigger city's yields write) earns more; iron stays the mine's.
    const developed = calcIncome({ ...state, regions: { ...state.regions, [capOf(state)]: { ...withMine, dev: { tax: withMine.dev.tax * 2, production: withMine.dev.production * 2, manpower: withMine.dev.manpower * 2 } } } });
    expect(developed.gold).toBeGreaterThan(baseWithMine.gold);
    expect(developed.hr).toBeGreaterThan(baseWithMine.hr);
    expect(developed.iron).toBe(baseWithMine.iron);
  });

  it('applies Set Tax Rate\'s goldMult on top of government/policy bonuses', () => {
    // A fixed seed and a real tax base: a Dawn capital's few gold a turn can round the same at two rates.
    const fresh = world({ seed: 7 });
    const me = fresh.playerNationId;
    const state = { ...fresh, regions: Object.fromEntries(Object.entries(fresh.regions).map(([id, r]) => [id, r.owner === me ? { ...r, dev: { ...r.dev, tax: 100, production: 100, manpower: 100 } } : r])) };
    const normal = calcIncome(state);
    const highTax = calcIncome({ ...state, nations: { ...state.nations, [me]: { ...state.nations[me], taxRate: 'high' } } });
    const lowTax = calcIncome({ ...state, nations: { ...state.nations, [me]: { ...state.nations[me], taxRate: 'low' } } });
    expect(highTax.gold).toBeGreaterThan(normal.gold);
    expect(lowTax.gold).toBeLessThan(normal.gold);
  });

});

describe('getSupplyCapacity', () => {
  it('grows with infrastructure level', () => {
    expect(getSupplyCapacity(0)).toBe(1);
    expect(getSupplyCapacity(4)).toBeGreaterThan(getSupplyCapacity(0));
  });

  it('handles a missing/undefined level without throwing', () => {
    expect(() => getSupplyCapacity(undefined)).not.toThrow();
    expect(getSupplyCapacity(undefined)).toBe(1);
  });
});

describe('getStability / nextUnrest', () => {
  it('getStability is 100 minus unrest', () => {
    expect(getStability({ unrest: 30 })).toBe(70);
    expect(getStability({ unrest: 0 })).toBe(100);
    expect(getStability({})).toBe(100);
  });

  it('unrest rises when control is below the threshold', () => {
    const region = { control: 20, unrest: 10 };
    expect(nextUnrest(region)).toBeGreaterThan(region.unrest);
  });

  it('unrest falls when control is at or above the threshold', () => {
    const region = { control: 100, unrest: 10 };
    expect(nextUnrest(region)).toBeLessThan(region.unrest);
  });

  it('is clamped to [0, 100]', () => {
    expect(nextUnrest({ control: 100, unrest: 0 })).toBe(0);
    expect(nextUnrest({ control: 0, unrest: 100 })).toBe(100);
  });

  it('taxUnrestDelta (Set Tax Rate) adds on top of the control-based drift', () => {
    const stableRegion = { control: 100, unrest: 20 };
    const withoutTax = nextUnrest(stableRegion, 0, 0);
    const highTax = nextUnrest(stableRegion, 0, 2);
    const lowTax = nextUnrest(stableRegion, 0, -1);
    expect(highTax).toBeGreaterThan(withoutTax);
    expect(lowTax).toBeLessThan(withoutTax);
  });
});

describe('getNationBonusTotal', () => {
  // Plan §M10: Great Projects replaced the old flat, nation-scoped World Wonders (`nation.wonders[]`)
  // with region-sited projects whose owner is derived from live region state — staticSources (the
  // only source getNationBonusTotal's bare-nation shim can read) can no longer demonstrate them; see
  // src/engine/modifiers/sources.test.js's contextSources tests for the real coverage instead.
  it('sums a reform\'s effect from the nation alone', () => {
    const nation = { government: { type: 'theocracy', reforms: { classical: 'oracle_council' } }, laws: {} };
    expect(getNationBonusTotal(nation, 'techPointsMult')).toBeCloseTo(0.15);
  });

  it('ignores an unknown reform id gracefully', () => {
    const nation = { government: { type: 'theocracy', reforms: { classical: 'not_a_real_reform' } } };
    expect(getNationBonusTotal(nation, 'techPointsMult')).toBe(0);
  });

  it('sums an enacted government reform\'s effect (identity no longer contributes directly, plan §M8.3)', () => {
    const nation = { government: { type: 'monarchy', reforms: { bronze: 'despotic_rule' } }, identity: { collectivism: 100 } };
    // despotic_rule's own stabilityBonus (-1); a fully-Collectivist identity contributes nothing to
    // this hook anymore — it only gates/discounts law and government-type choices now.
    expect(getNationBonusTotal(nation, 'stabilityBonus')).toBe(-1);
  });
});


// Regression: player-facing "power" comparisons used to read nation.militaryStrength directly —
// an abstract, unbounded AI economy score (aiLogic.js's processAINationTurn) that has no cap tied to
// what's actually on the map. getFieldedStrength is what ResourceBar/MilitaryPanel/DiplomacyPanel/
// RegionInfoModal show instead: the real sum of a nation's own recruited units, which can't drift
// arbitrarily far from what a player can actually see and fight.
describe('getFieldedStrength', () => {
  it('sums only the given nation\'s own units\' strength', () => {
    const state = {
      units: {
        a: { ownerId: 'fr', strength: 1000 },
        b: { ownerId: 'fr', strength: 500 },
        c: { ownerId: 'de', strength: 2000 }
      }
    };
    expect(getFieldedStrength(state, 'fr')).toBe(1500);
    expect(getFieldedStrength(state, 'de')).toBe(2000);
  });

  it('is zero for a nation with no units', () => {
    const state = { units: { a: { ownerId: 'fr', strength: 1000 } } };
    expect(getFieldedStrength(state, 'de')).toBe(0);
  });

  it('handles a missing/empty units dict gracefully', () => {
    expect(getFieldedStrength({}, 'fr')).toBe(0);
  });
});

describe('getDisplayPopulation', () => {
  it('scales a region\'s modern population down for a historically early year', () => {
    const region = { currentPopulation: 1000000 };
    const regionData = { population: 1000000 };
    const display = getDisplayPopulation(region, regionData, -2000);
    expect(display).toBeGreaterThan(0);
    expect(display).toBeLessThan(region.currentPopulation);
  });

  it('matches the modern figure exactly at the modern baseline year with no Population Policy growth', () => {
    const region = { currentPopulation: 500000 };
    const regionData = { population: 500000 };
    expect(getDisplayPopulation(region, regionData, 2024)).toBe(500000);
  });

  it('still reflects Population Policy growth on top of the era scaling', () => {
    const regionData = { population: 100000 };
    const grown = { currentPopulation: 150000 }; // 1.5x via Population Policy
    const notGrown = { currentPopulation: 100000 };
    const grownDisplay = getDisplayPopulation(grown, regionData, -1000);
    const notGrownDisplay = getDisplayPopulation(notGrown, regionData, -1000);
    expect(grownDisplay).toBeGreaterThan(notGrownDisplay);
    expect(grownDisplay / notGrownDisplay).toBeCloseTo(1.5, 1);
  });

  it('never goes below 1 even for a tiny province at the earliest year', () => {
    const region = { currentPopulation: 10 };
    const regionData = { population: 10 };
    expect(getDisplayPopulation(region, regionData, -2000)).toBeGreaterThanOrEqual(1);
  });

  it('is 0 for a region with no baseline population data', () => {
    expect(getDisplayPopulation({ currentPopulation: 0 }, { population: 0 }, 2024)).toBe(0);
  });
});

describe('getResourceStrain', () => {
  it('is null when nothing crosses the 50% threshold', () => {
    expect(getResourceStrain({ gold: 10 }, { gold: 1000 })).toBeNull();
  });

  it('measures every other resource against its current on-hand amount (no cap)', () => {
    const result = getResourceStrain({ gold: 800 }, { gold: 1000 });
    expect(result).toEqual({ level: 'high', label: 'Gold' }); // 80%: high, not yet critical (>= 90%)
  });

  it('reports only the worst-strained resource among several costs', () => {
    const result = getResourceStrain({ gold: 100, hr: 4 }, { gold: 1000, hr: 5 });
    expect(result.label).toBe('HR'); // 4/5 = 80% beats gold's 10%
  });
});

describe('getCostString', () => {
  it('formats known resource and meta-currency costs', () => {
    expect(getCostString({ gold: 1500, techPoints: 5, decrees: 2 })).toBe('1.5K Gold, 5 TP, 2 decrees');
  });

  it('omits zero/falsy costs', () => {
    expect(getCostString({ gold: 0, hr: 10 })).toBe('10 HR');
  });
});
