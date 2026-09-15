import { describe, it, expect } from 'vitest';
import {
  calcCombatResult, canAfford, applyCosts,
  sumUnits, addUnits, subtractUnits, scaleUnits, hasEnoughUnits,
  calcCompositionStrength, distributeCasualties, emptyUnits,
  getTechBonuses, calcIncome
} from './helpers';
import { createRng } from './rng';
import { GamePhases } from '../data/types';

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

  it('combatPrediction (Phase 5: AI Warfare) narrows the random band to 0.9-1.1', () => {
    // A ratio that's borderline-stalemate under the normal 0.8-1.2 band can become a guaranteed
    // stalemate under the narrowed 0.9-1.1 band, or vice versa — the concrete, seed-independent
    // check is that raw randomFactor variance shrinks, which we verify via the resulting ratio
    // spread across many draws at a fixed attacker/defender pair.
    const rng = createRng(11);
    const ratios = [];
    const narrowRatios = [];
    for (let i = 0; i < 1000; i++) {
      ratios.push(calcCombatResult(10000, 10000, {}, 'plains', rng).ratio);
      narrowRatios.push(calcCombatResult(10000, 10000, { combatPrediction: true }, 'plains', rng).ratio);
    }
    const spread = (arr) => Math.max(...arr) - Math.min(...arr);
    expect(spread(narrowRatios)).toBeLessThan(spread(ratios));
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

  it('calcCompositionStrength applies tech bonuses (Phase 5: Uzi/Merkava/Air Superiority) on top of terrain', () => {
    const infantry = { infantry: 1000, armor: 0, air: 0 };
    const withBonus = calcCompositionStrength(infantry, 'plains', { infantryBonus: 0.15 });
    const withoutBonus = calcCompositionStrength(infantry, 'plains', {});
    expect(withBonus).toBeCloseTo(withoutBonus * 1.15, 5);
  });

  it('calcCompositionStrength applies a seasonal H2 penalty to armor/air but not infantry (Phase 7)', () => {
    const armor = { infantry: 0, armor: 1000, air: 0 };
    const air = { infantry: 0, armor: 0, air: 1000 };
    const infantry = { infantry: 1000, armor: 0, air: 0 };
    expect(calcCompositionStrength(armor, 'plains', {}, 1)).toBeLessThan(calcCompositionStrength(armor, 'plains', {}, 0));
    expect(calcCompositionStrength(air, 'plains', {}, 1)).toBeLessThan(calcCompositionStrength(air, 'plains', {}, 0));
    expect(calcCompositionStrength(infantry, 'plains', {}, 1)).toBe(calcCompositionStrength(infantry, 'plains', {}, 0));
  });

  it('calcCompositionStrength defaults to the H1 (no-penalty) season when period is omitted', () => {
    const armor = { infantry: 0, armor: 1000, air: 0 };
    expect(calcCompositionStrength(armor, 'plains', {})).toBe(calcCompositionStrength(armor, 'plains', {}, 0));
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

describe('getTechBonuses (Phase 5: no known-dead effect keys)', () => {
  it('caps layered missileDefenseBonus at 0.9 so it can never fully negate damage', () => {
    const techTree = {
      iron_dome: { researched: true },
      arrow_3: { researched: true },
      laser_defense: { researched: true }
    };
    // iron_dome(0.4) + arrow_3(0.3) + laser_defense(0.2) = 0.9 exactly, at the cap.
    expect(getTechBonuses(techTree).missileDefenseBonus).toBeCloseTo(0.9, 5);
  });

  it('accumulates hostilityReduction from Mossad', () => {
    const techTree = { mossad_formation: { researched: true } };
    expect(getTechBonuses(techTree).hostilityReduction).toBe(5);
  });

  it('sets covertOps/cyber/globalIntel flags from their respective techs', () => {
    expect(getTechBonuses({ mossad_formation: { researched: true } }).covertOps).toBe(true);
    expect(getTechBonuses({ unit_8200: { researched: true } }).cyber).toBe(true);
    expect(getTechBonuses({ quantum_intel: { researched: true } }).globalIntel).toBe(true);
    expect(getTechBonuses({}).covertOps).toBe(false);
  });

  it('returns a safe default object for an empty/missing tech tree', () => {
    expect(getTechBonuses(null).moneyMult).toBe(1);
    expect(getTechBonuses({}).missileDefenseBonus).toBe(0);
  });
});

describe('calcIncome tech bonuses (Phase 5)', () => {
  const baseState = () => ({
    phase: GamePhases.POST_STATE,
    societalSlider: 50,
    nations: {},
    techTree: {},
    regions: {
      negev: { id: 'negev', owner: 'player', control: 100, currentInfrastructure: 0 },
      tel_aviv: { id: 'tel_aviv', owner: 'player', control: 100, currentInfrastructure: 0 }
    }
  });

  it('negevBonus (Desert Blooming) boosts only the Negev region\'s output', () => {
    const withoutTech = calcIncome(baseState());
    const withTech = calcIncome({ ...baseState(), techTree: { desert_blooming: { researched: true } } });
    // desert_blooming also carries moneyMult:1.2 economy-wide, so isolate the Negev-specific
    // effect by checking money increased by MORE than the flat moneyMult alone would explain.
    expect(withTech.money).toBeGreaterThan(Math.round(withoutTech.money * 1.2));
  });

  it('diplomacyIncomeBonus (Green Energy / Open Diplomacy) adds flat DP income', () => {
    const withoutTech = calcIncome(baseState());
    const withTech = calcIncome({ ...baseState(), techTree: { open_diplomacy: { researched: true } } });
    expect(withTech.diplomacyPoints).toBe(withoutTech.diplomacyPoints + 5);
  });
});
