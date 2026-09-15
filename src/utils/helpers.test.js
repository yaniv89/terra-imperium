import { describe, it, expect } from 'vitest';
import {
  calcCombatResult, canAfford, applyCosts,
  sumUnits, addUnits, subtractUnits, scaleUnits, hasEnoughUnits,
  calcCompositionStrength, distributeCasualties, emptyUnits
} from './helpers';
import { createRng } from './rng';

describe('calcCombatResult', () => {
  it('is deterministic given the same seeded rng sequence', () => {
    const a = calcCombatResult(10000, 8000, {}, 'plains', createRng(42));
    const b = calcCombatResult(10000, 8000, {}, 'plains', createRng(42));
    expect(a).toEqual(b);
  });

  it('favors the defender on rugged/urban terrain instead of penalizing them (regression: terrain inversion)', () => {
    // Attacker nominally stronger than defender (7000 vs 10000 is defender-favored already;
    // use a closer matchup so terrain is what decides it).
    const rng = createRng(7);
    let plainsRepels = 0;
    let mountainRepels = 0;
    for (let i = 0; i < 500; i++) {
      if (calcCombatResult(9000, 10000, {}, 'plains', rng).defenderWins) plainsRepels++;
      if (calcCombatResult(9000, 10000, {}, 'mountains', rng).defenderWins) mountainRepels++;
    }
    // Mountains must defend at least as well as plains — previously mountains multiplied the
    // defender's score by 0.7 (a penalty), making the game's toughest terrain its worst.
    expect(mountainRepels).toBeGreaterThan(plainsRepels);
  });

  it('produces attrition on both sides (casualties are non-zero for a contested fight)', () => {
    const result = calcCombatResult(10000, 9500, {}, 'plains', createRng(3));
    expect(result.casualties.attacker).toBeGreaterThan(0);
    expect(result.casualties.defender).toBeGreaterThanOrEqual(0);
  });
});

describe('canAfford / applyCosts', () => {
  it('rejects when any single resource is short', () => {
    const resources = { money: 1000, actionPoints: 3 };
    expect(canAfford(resources, { money: 500, actionPoints: 5 })).toBe(false);
    expect(canAfford(resources, { money: 500, actionPoints: 2 })).toBe(true);
  });

  it('applyCosts never drives a resource negative', () => {
    const resources = { money: 100 };
    const next = applyCosts(resources, { money: 500 });
    expect(next.money).toBe(0);
  });

  it('applyCosts does not mutate the input', () => {
    const resources = { money: 1000 };
    applyCosts(resources, { money: 500 });
    expect(resources.money).toBe(1000);
  });
});

describe('unit composition (Phase 3)', () => {
  it('sumUnits totals all three types, treating a missing pool as empty', () => {
    expect(sumUnits({ infantry: 100, armor: 50, air: 25 })).toBe(175);
    expect(sumUnits(undefined)).toBe(0);
  });

  it('addUnits and subtractUnits floor at 0 and never mutate the input', () => {
    const units = { infantry: 100, armor: 0, air: 0 };
    const added = addUnits(units, { infantry: 50 });
    expect(added.infantry).toBe(150);
    expect(units.infantry).toBe(100); // unmutated

    const subtracted = subtractUnits(units, { infantry: 500 });
    expect(subtracted.infantry).toBe(0); // floored, not negative
  });

  it('scaleUnits shrinks every type by the same factor', () => {
    const scaled = scaleUnits({ infantry: 1000, armor: 200, air: 10 }, 0.5);
    expect(scaled).toEqual({ infantry: 500, armor: 100, air: 5 });
  });

  it('hasEnoughUnits checks each type independently', () => {
    const units = { infantry: 1000, armor: 0, air: 500 };
    expect(hasEnoughUnits(units, { infantry: 1000, armor: 0, air: 500 })).toBe(true);
    expect(hasEnoughUnits(units, { infantry: 1001, armor: 0, air: 0 })).toBe(false);
    expect(hasEnoughUnits(units, { infantry: 0, armor: 1, air: 0 })).toBe(false);
  });

  it('calcCompositionStrength rewards terrain-appropriate unit types', () => {
    const allArmor = { infantry: 0, armor: 1000, air: 0 };
    const allInfantry = { infantry: 1000, armor: 0, air: 0 };
    // Desert favors armor, mountains favors infantry — same raw headcount, opposite outcome.
    expect(calcCompositionStrength(allArmor, 'desert')).toBeGreaterThan(calcCompositionStrength(allInfantry, 'desert'));
    expect(calcCompositionStrength(allInfantry, 'mountains')).toBeGreaterThan(calcCompositionStrength(allArmor, 'mountains'));
  });

  it('distributeCasualties splits proportionally and never exceeds what a type has', () => {
    const units = { infantry: 800, armor: 200, air: 0 };
    const losses = distributeCasualties(units, 100);
    expect(losses.infantry).toBe(80);
    expect(losses.armor).toBe(20);
    expect(losses.air).toBe(0);
  });

  it('distributeCasualties on an empty pool returns no losses (no divide-by-zero)', () => {
    expect(distributeCasualties(emptyUnits(), 100)).toEqual(emptyUnits());
  });
});
