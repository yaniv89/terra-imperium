import { describe, it, expect } from 'vitest';
import { canAfford, applyCosts, scaleCosts, calcIncome, getPlayerControl, getCostString, getResourceStrain, formatNumber, formatMoney, getSupplyCapacity, getStability, nextUnrest, getNationBonusTotal, getPowerIncome, getFieldedStrength, getDisplayPopulation } from './helpers';
import { createInitialState } from '../context/GameContext';
import { getNationCapital } from '../data/regions';

// A nation now spans many real provinces, not one region matching its own id — these tests use
// each nation's capital as "its" region wherever the old one-region-per-nation model used the
// nation id directly as a region id.
const cap = getNationCapital;

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
    const state = createInitialState({ playerNationId: 'fr' });
    expect(getPlayerControl(state)).toBe(state.regions[cap('fr')].control);
  });
});

describe('calcIncome', () => {
  it('yields only gold and hr in the Bronze Age (copper/iron/oil not unlocked)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const income = calcIncome(state);
    expect(income.gold).toBeGreaterThan(0);
    expect(income.hr).toBeGreaterThan(0);
    expect(income.copper).toBe(0);
    expect(income.iron).toBe(0);
    expect(income.oil).toBe(0);
  });

  it('scales with control% — a lower-control empire yields less income than a fully-controlled one', () => {
    // France now spans many provinces, not one — halving every owned province's control (not just
    // one of them) is what actually halves the empire-wide picture the way a single region used to.
    const state = createInitialState({ playerNationId: 'fr' });
    const fullControl = calcIncome(state);
    const halfControlRegions = { ...state.regions };
    Object.keys(halfControlRegions).forEach(id => {
      if (halfControlRegions[id].owner === 'fr') halfControlRegions[id] = { ...halfControlRegions[id], control: 50 };
    });
    const halfControl = calcIncome({ ...state, regions: halfControlRegions });
    expect(halfControl.gold).toBeLessThan(fullControl.gold);
  });

  it('adds a flat gold bonus per active trade agreement', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const anyNationId = Object.keys(state.nations).find(id => id !== 'fr');
    const withTrade = calcIncome({
      ...state,
      nations: { ...state.nations, [anyNationId]: { ...state.nations[anyNationId], hasTradeAgreement: true } }
    });
    const without = calcIncome(state);
    expect(withTrade.gold).toBeGreaterThan(without.gold);
  });

  it('yields a deposit resource once its extraction building is developed', () => {
    // Chile has a copper deposit (src/data/deposits.js).
    const state = createInitialState({ playerNationId: 'cl' });
    const withoutMine = calcIncome(state);
    expect(withoutMine.copper).toBe(0);

    const withMine = calcIncome({
      ...state,
      regions: {
        ...state.regions,
        [cap('cl')]: { ...state.regions[cap('cl')], buildings: { ...state.regions[cap('cl')].buildings, extraction: { ...state.regions[cap('cl')].buildings.extraction, copper: true } } }
      }
    });
    expect(withMine.copper).toBeGreaterThan(0);
  });

  it('yields nothing from an extraction building in a region with no matching deposit', () => {
    // France has no copper deposit listed.
    const state = createInitialState({ playerNationId: 'fr' });
    const withMine = calcIncome({
      ...state,
      regions: {
        ...state.regions,
        [cap('fr')]: { ...state.regions[cap('fr')], buildings: { ...state.regions[cap('fr')].buildings, extraction: { ...state.regions[cap('fr')].buildings.extraction, copper: true } } }
      }
    });
    expect(withMine.copper).toBe(0);
  });

  it('scales gold and hr with population growth from Population Policy, but not deposit/extraction resources', () => {
    const state = createInitialState({ playerNationId: 'cl' }); // Chile has a copper deposit
    const base = calcIncome(state);
    const grown = calcIncome({
      ...state,
      regions: {
        ...state.regions,
        [cap('cl')]: {
          ...state.regions[cap('cl')],
          currentPopulation: Math.round(state.regions[cap('cl')].currentPopulation * 1.5),
          buildings: { ...state.regions[cap('cl')].buildings, extraction: { ...state.regions[cap('cl')].buildings.extraction, copper: true } }
        }
      }
    });
    expect(grown.gold).toBeGreaterThan(base.gold);
    expect(grown.hr).toBeGreaterThan(base.hr);
    const baseWithMine = calcIncome({
      ...state,
      regions: { ...state.regions, [cap('cl')]: { ...state.regions[cap('cl')], buildings: { ...state.regions[cap('cl')].buildings, extraction: { ...state.regions[cap('cl')].buildings.extraction, copper: true } } } }
    });
    expect(grown.copper).toBe(baseWithMine.copper); // extraction yield is deposit/building-driven, not population-driven
  });

  it('applies Set Tax Rate\'s goldMult on top of government/policy bonuses', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const normal = calcIncome(state);
    const highTax = calcIncome({ ...state, nations: { ...state.nations, fr: { ...state.nations.fr, taxRate: 'high' } } });
    const lowTax = calcIncome({ ...state, nations: { ...state.nations, fr: { ...state.nations.fr, taxRate: 'low' } } });
    expect(highTax.gold).toBeGreaterThan(normal.gold);
    expect(lowTax.gold).toBeLessThan(normal.gold);
  });

  it('applies an owned Navigation Satellite\'s goldMult and a Weather Satellite\'s hrMult', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const withoutSatellites = calcIncome(state);
    const withSatellites = calcIncome({
      ...state,
      satellites: {
        s1: { id: 's1', ownerId: 'fr', typeId: 'navigation' },
        s2: { id: 's2', ownerId: 'fr', typeId: 'weather' }
      }
    });
    expect(withSatellites.gold).toBeGreaterThan(withoutSatellites.gold);
    expect(withSatellites.hr).toBeGreaterThan(withoutSatellites.hr);
  });

  it('adds a Spy Satellite\'s flat techPoints/turn', () => {
    // A Communications Satellite's DIP/turn is asserted in getPowerIncome's own tests instead —
    // see that describe block's header comment for why a DIP-pool bonus has to be computed there,
    // not in calcIncome's generic per-resource income object.
    const state = createInitialState({ playerNationId: 'fr' });
    const withSatellites = calcIncome({
      ...state,
      satellites: { s2: { id: 's2', ownerId: 'fr', typeId: 'spy' } }
    });
    expect(withSatellites.techPoints).toBeGreaterThan(0);
  });

  it('never counts a rival nation\'s satellites toward the player\'s own income', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const withoutSatellites = calcIncome(state);
    const withRivalSatellite = calcIncome({ ...state, satellites: { s1: { id: 's1', ownerId: 'de', typeId: 'navigation' } } });
    expect(withRivalSatellite.gold).toBe(withoutSatellites.gold);
  });

  it('degrades a satellite\'s bonus under high orbital debris', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const satellites = { s1: { id: 's1', ownerId: 'fr', typeId: 'navigation' } };
    const noDebris = calcIncome({ ...state, satellites, orbitalDebrisLevel: 0 });
    const highDebris = calcIncome({ ...state, satellites, orbitalDebrisLevel: 100 });
    expect(highDebris.gold).toBeLessThan(noDebris.gold);
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
  it('sums a completed World Wonder\'s effect alongside government and policy bonuses', () => {
    const nation = { government: null, policies: [], wonders: ['grandBazaar'] }; // grandBazaar: goldMult 0.15
    expect(getNationBonusTotal(nation, 'goldMult')).toBeCloseTo(0.15);
  });

  it('sums multiple wonders on the same hook', () => {
    const nation = { wonders: ['royalObservatory', 'spaceProgram'] }; // stabilityBonus 5 + 8
    expect(getNationBonusTotal(nation, 'stabilityBonus')).toBe(13);
  });

  it('ignores an unbuilt/unknown wonder id gracefully', () => {
    const nation = { wonders: ['not_a_real_wonder'] };
    expect(getNationBonusTotal(nation, 'goldMult')).toBe(0);
  });

  it('adds National Identity\'s contribution alongside government/policy/wonder bonuses', () => {
    const nation = { government: 'monarchy', policies: [], wonders: [], identity: { collectivism: 100 } };
    // monarchy's own stabilityBonus (5) plus fully-Collectivist identity's stabilityBonus (10).
    expect(getNationBonusTotal(nation, 'stabilityBonus')).toBe(15);
  });
});

// Regression: AP was a flat 3/turn regardless of empire size or maturity — a 50-region late-game
// empire acted exactly as often per turn as a 1-region start. Administrative Capacity fixes that via
// two real levers: government maturity (apBonus) and the Governance tech line. Plan §M2 replaced
// the single AP pool with three (adm/dip/mil); apBonus applies equally to all three since neither
// government nor tech differentiates between them yet (M3/M7 are what eventually will).
describe('getPowerIncome', () => {
  // M3's ruler/advisor generation adds nonzero adm/dip/mil skill to createInitialState's nations —
  // real for gameplay, but it would make these exact-value assertions depend on the seeded RNG roll
  // for 'fr' specifically. Zero the ruler and clear advisors so this suite still isolates apBonus/
  // tech/satellite/mission math the way it did before M3.
  const baseState = () => {
    const state = createInitialState({ playerNationId: 'fr' });
    state.nations.fr.ruler = { ...state.nations.fr.ruler, adm: 0, dip: 0, mil: 0, traits: [] };
    state.nations.fr.advisors = { adm: null, dip: null, mil: null };
    return state;
  };

  it('is the flat base of 3 per pool with no government and no researched Governance tech', () => {
    expect(getPowerIncome(baseState())).toEqual({ adm: 3, dip: 3, mil: 3 });
  });

  it('adds the adopted government\'s apBonus to all three pools equally', () => {
    const state = baseState();
    state.nations.fr.government = 'monarchy'; // apBonus: 1
    expect(getPowerIncome(state)).toEqual({ adm: 4, dip: 4, mil: 4 });
  });

  it('adds +1 ADM per researched Governance tech with a real admBonus effect (Code of Laws), ignoring other techs', () => {
    // Plan §M7 replaced the old flat "+1 per 3 Governance techs" rule with each tech's own real
    // effect — Code of Laws gives +1 admBonus; Scribal Bureaucracy and Civic Assemblies don't
    // touch any power pool (their own effects are developmentCost and an unlock respectively).
    const state = baseState();
    ['governance_code_of_laws', 'governance_scribal_bureaucracy', 'governance_civic_assemblies'].forEach((id) => {
      state.techTree[id] = { ...state.techTree[id], researched: true };
    });
    // A non-Governance tech researched too, to prove only techs with a real admBonus effect count.
    state.techTree.military_bronze_casting = { ...state.techTree.military_bronze_casting, researched: true };
    expect(getPowerIncome(state)).toEqual({ adm: 4, dip: 3, mil: 3 }); // 3 base + 1 (Code of Laws)
  });

  it('stacks the government apBonus with per-tech admBonus effects together', () => {
    const state = baseState();
    state.nations.fr.government = 'empire'; // apBonus: 2, all three pools
    // Of these 6, only Code of Laws and Royal Chancery have their own +1 admBonus effect.
    ['governance_code_of_laws', 'governance_scribal_bureaucracy', 'governance_civic_assemblies',
      'governance_provincial_administration', 'governance_feudal_charters', 'governance_royal_chancery'].forEach((id) => {
      state.techTree[id] = { ...state.techTree[id], researched: true };
    });
    expect(getPowerIncome(state)).toEqual({ adm: 7, dip: 5, mil: 5 }); // 3 base + 2 gov (all) + 2 admBonus (adm only)
  });

  // A recurring DIP bonus (satellite or completed space mission) must be part of getPowerIncome's
  // OWN return value, not added afterward — resolveTurn.js banks each pool up to 2x whatever this
  // function returns, so a bonus added only after the fact gets clipped straight back down the
  // very next turn instead of raising the effective cap along with the income (see this
  // function's own header comment).
  it('adds a Communications Satellite\'s DIP/turn to the dip pool only, not adm/mil', () => {
    const state = { ...baseState(), satellites: { s1: { id: 's1', ownerId: 'fr', typeId: 'communications' } } };
    expect(getPowerIncome(state)).toEqual({ adm: 3, dip: 8, mil: 3 }); // 3 base + 5 satellite
  });

  it('adds a completed space mission\'s recurring dipPerTurn reward to the dip pool', () => {
    const state = { ...baseState(), completedMissions: ['moon_landing'] };
    expect(getPowerIncome(state).dip).toBe(13); // 3 base + 10 moon_landing dipPerTurn
  });

  it('never counts a rival nation\'s satellites toward the player\'s own power income', () => {
    const state = { ...baseState(), satellites: { s1: { id: 's1', ownerId: 'de', typeId: 'communications' } } };
    expect(getPowerIncome(state).dip).toBe(3);
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
    expect(getResourceStrain({ gold: 10, adm: 1 }, { gold: 1000, adm: 5, maxAdm: 5 })).toBeNull();
  });

  it('measures a power-pool cost against its own max, not its current amount', () => {
    // Banked well above max (8/5) — the strain should still be judged against the 5 cap, not 8.
    const result = getResourceStrain({ mil: 3 }, { mil: 8, maxMil: 5 });
    expect(result).toEqual({ level: 'high', label: 'MIL' }); // 3/5 = 60%
  });

  it('falls back to the current amount for a power pool with no max recorded yet', () => {
    const result = getResourceStrain({ dip: 9 }, { dip: 10 });
    expect(result).toEqual({ level: 'critical', label: 'DIP' }); // 9/10 = 90%
  });

  it('measures every other resource against its current on-hand amount (no cap)', () => {
    const result = getResourceStrain({ gold: 800 }, { gold: 1000 });
    expect(result).toEqual({ level: 'high', label: 'Gold' }); // 80%: high, not yet critical (>= 90%)
  });

  it('reports only the worst-strained resource among several costs', () => {
    const result = getResourceStrain({ gold: 100, mil: 4 }, { gold: 1000, mil: 5, maxMil: 5 });
    expect(result.label).toBe('MIL'); // 4/5 = 80% beats gold's 10%
  });
});

describe('getCostString', () => {
  it('formats known resource and meta-currency costs', () => {
    expect(getCostString({ gold: 1500, techPoints: 5, adm: 2, dip: 1, mil: 3 })).toBe('1.5K Gold, 5 TP, 2 ADM, 1 DIP, 3 MIL');
  });

  it('omits zero/falsy costs', () => {
    expect(getCostString({ gold: 0, hr: 10 })).toBe('10 HR');
  });
});
