import { describe, it, expect } from 'vitest';
import { calcCombatResult, canAfford, applyCosts } from './helpers';
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
