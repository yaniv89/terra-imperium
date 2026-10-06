import { describe, it, expect } from 'vitest';
import {
  inCivilWarCooldown, CIVIL_WAR_COOLDOWN_TURNS,
  nextLowStabilityStreak, isStabilityCivilWarTrigger, startCivilWar, processCivilWarTurn, INSURGENT_MARKER
} from './civilWar';
import { createInitialState } from './gameReducer';
import { createRng } from '../utils/rng';
import { CIVIL_WAR_STABILITY_STREAK_TURNS } from '../data/actionCosts';
import { addCities } from './testWorld';
import { getOwnedRegionIds } from '../data/regions';
import { REBEL_OWNER_ID } from '../data/rebellion';

// Seven US cities, so the insurgents' share of the nation is a fraction and not all of it.
const usState = () => addCities(createInitialState({ playerNationId: 'us', rngSeed: 1 }), 'us', 6).state;

describe('nextLowStabilityStreak / isStabilityCivilWarTrigger (plan §M15)', () => {
  it('increments while stability is at the floor (-3)', () => {
    expect(nextLowStabilityStreak({ stability: -3, lowStabilityStreak: 0 })).toBe(1);
    expect(nextLowStabilityStreak({ stability: -3, lowStabilityStreak: 1 })).toBe(2);
  });

  it('resets to 0 once stability recovers above the floor', () => {
    expect(nextLowStabilityStreak({ stability: -2, lowStabilityStreak: 2 })).toBe(0);
  });

  it('triggers only once the streak reaches the threshold (five turns at the floor, plans/playtest-1.md P4)', () => {
    expect(isStabilityCivilWarTrigger(CIVIL_WAR_STABILITY_STREAK_TURNS - 1)).toBe(false);
    expect(isStabilityCivilWarTrigger(CIVIL_WAR_STABILITY_STREAK_TURNS)).toBe(true);
    expect(isStabilityCivilWarTrigger(CIVIL_WAR_STABILITY_STREAK_TURNS + 1)).toBe(true);
  });
});

describe('startCivilWar (plan §M15)', () => {
  it('spawns insurgent rebels in ~15% of the nation\'s own regions (min 1), marking them occupied', () => {
    const state = usState();
    const rng = createRng(42);
    const ownedCount = getOwnedRegionIds(state.regions, 'us').length;
    const result = startCivilWar(state.regions, state.units, 'us', 10000, rng, 5);
    expect(result).not.toBeNull();
    expect(result.civilWar).toEqual({ active: true, startedTurn: 5, holdStreak: 0 });

    const insurgentUnits = Object.values(result.units).filter((u) => u.isInsurgent);
    const expectedCount = Math.max(1, Math.round(ownedCount * 0.15));
    expect(insurgentUnits.length).toBe(expectedCount);
    insurgentUnits.forEach((u) => {
      expect(u.ownerId).toBe(REBEL_OWNER_ID);
      expect(result.regions[u.regionId].occupiedBy).toBe(INSURGENT_MARKER);
      expect(result.regions[u.regionId].owner).toBe('us');
    });
  });

  it('sizes each insurgent army off a share of the nation\'s real fielded strength', () => {
    const state = usState();
    const rng = createRng(1);
    const result = startCivilWar(state.regions, state.units, 'us', 10000, rng, 1);
    const insurgentUnits = Object.values(result.units).filter((u) => u.isInsurgent);
    const totalInsurgentStrength = insurgentUnits.reduce((sum, u) => sum + u.strength, 0);
    // 15% of the nation's fielded strength (10000), give or take rounding across N regions.
    expect(totalInsurgentStrength).toBeGreaterThan(1000);
    expect(totalInsurgentStrength).toBeLessThan(2000);
  });

  it('returns null for a nation that owns no regions', () => {
    const state = usState();
    const regionsWithoutUs = { ...state.regions };
    Object.keys(regionsWithoutUs).forEach((id) => {
      if (regionsWithoutUs[id].owner === 'us') regionsWithoutUs[id] = { ...regionsWithoutUs[id], owner: 'ca' };
    });
    expect(startCivilWar(regionsWithoutUs, state.units, 'us', 1000, createRng(1), 1)).toBeNull();
  });
});

describe('processCivilWarTurn (plan §M15)', () => {
  const setup = () => {
    const state = usState();
    const rng = createRng(7);
    const started = startCivilWar(state.regions, state.units, 'us', 10000, rng, 1);
    const nation = { ...state.nations.us, civilWar: started.civilWar, stability: -3, prestige: 40, legitimacy: 40 };
    return { state: { ...state, age: state.age }, regions: started.regions, units: started.units, nation, rng };
  };

  it('crushes the civil war once every insurgent army is gone (+1 stability, +10 legitimacy)', () => {
    const { state, regions, units, nation, rng } = setup();
    const clearedUnits = { ...units };
    Object.values(clearedUnits).forEach((u) => { if (u.isInsurgent) delete clearedUnits[u.id]; });
    const result = processCivilWarTurn(state, regions, clearedUnits, nation, 'us', rng, 2);
    expect(result.result).toBe('crushed');
    expect(result.nation.civilWar).toBeNull();
    expect(result.nation.stability).toBe(nation.stability + 1);
    expect(result.nation.legitimacy).toBe(nation.legitimacy + 10);
    // Every region that was marked occupied-by-insurgents is liberated.
    Object.values(result.regions).forEach((r) => { if (r.owner === 'us') expect(r.occupiedBy).not.toBe(INSURGENT_MARKER); });
  });

  it('stays ongoing (no ruler change) while the insurgents hold less than half the nation\'s regions', () => {
    const { state, regions, units, nation, rng } = setup();
    const result = processCivilWarTurn(state, regions, units, nation, 'us', rng, 2);
    expect(result.result).toBe('ongoing');
    expect(result.nation.civilWar.active).toBe(true);
    expect(result.nation.civilWar.holdStreak).toBe(0); // 15% held is well under the 50% losing threshold
    expect(result.nation.ruler).toBe(nation.ruler);
  });

  it('the nation falls to the insurgents once they hold >= 50% of its regions for 5 straight turns', () => {
    const state = usState();
    const rng = createRng(3);
    // Force every owned region under insurgent control so holdShare is 100%.
    let regions = { ...state.regions };
    let units = { ...state.units };
    const ownedIds = getOwnedRegionIds(regions, 'us');
    ownedIds.forEach((id, i) => {
      const unitId = `insurgent_test_${i}`;
      units[unitId] = { id: unitId, regionId: id, ownerId: REBEL_OWNER_ID, isInsurgent: true, domain: 'land', classId: 'infantry', strength: 10, maxStrength: 10, morale: 100, movesLeft: 1 };
      regions[id] = { ...regions[id], occupiedBy: INSURGENT_MARKER };
    });
    let nation = { ...state.nations.us, civilWar: { active: true, startedTurn: 1, holdStreak: 0 } };

    for (let turn = 2; turn <= 5; turn++) {
      const result = processCivilWarTurn({ ...state, age: state.age }, regions, units, nation, 'us', rng, turn);
      expect(result.result).toBe('ongoing');
      regions = result.regions;
      units = result.units;
      nation = result.nation;
    }
    const final = processCivilWarTurn({ ...state, age: state.age }, regions, units, nation, 'us', rng, 6);
    expect(final.result).toBe('lost');
    expect(final.nation.civilWar).toBeNull();
    expect(final.nation.prestige).toBe((nation.prestige || 0) - 20);
    expect(final.nation.ruler).not.toBe(nation.ruler);
    expect(final.nation.laws).toBeDefined();
    // Every insurgent unit and its occupation marker are cleared as part of the regime change.
    expect(Object.values(final.units).some((u) => u.isInsurgent)).toBe(false);
    Object.values(final.regions).forEach((r) => { if (r.owner === 'us') expect(r.occupiedBy).not.toBe(INSURGENT_MARKER); });
  });
});

describe('civil war gates (plans/playtest-1.md P4)', () => {
  it('a nation falls into no second civil war within the cooldown', () => {
    expect(inCivilWarCooldown({ civilWarEndedTurn: 80 }, 100)).toBe(true);
    expect(inCivilWarCooldown({ civilWarEndedTurn: 80 }, 80 + CIVIL_WAR_COOLDOWN_TURNS)).toBe(false);
    expect(inCivilWarCooldown({}, 100)).toBe(false);
  });
});
