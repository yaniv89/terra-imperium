// src/engine/world/lod.test.js
import { describe, it, expect } from 'vitest';
import { lodPeriod, settlesThisTurn, turnsToSettle, LOD_MAX_PERIOD } from './lod';
import { thinksThisTurn } from '../aiEconomy';

describe('simulation level of detail', () => {
  it('keeps the player, nations at war and Tier 1 on every turn', () => {
    expect(lodPeriod(3, { isPlayer: true })).toBe(1);
    expect(lodPeriod(3, { isAtWar: true })).toBe(1);
    expect(lodPeriod(3, { civilWar: { active: true } })).toBe(1);
    expect(lodPeriod(1, {})).toBe(1);
    expect(lodPeriod(2, {})).toBeGreaterThan(1);
    expect(lodPeriod(3, {})).toBeLessThanOrEqual(LOD_MAX_PERIOD);
  });

  it('settles on every turn a nation thinks, so decisions read a fresh pool', () => {
    ['fr', 'eg', 'cn', 'au', 'br', 'za'].forEach((id) => [1, 2, 3].forEach((tier) => {
      for (let turn = 1; turn <= 60; turn++) if (thinksThisTurn(id, tier, turn)) expect(settlesThisTurn(id, lodPeriod(tier, {}), turn)).toBe(true);
    }));
  });

  it('covers every turn exactly once, whatever the period does between settlements', () => {
    const periods = [3, 3, 5, 5, 5, 1, 1, 3, 5, 3, 1, 5, 5, 5, 5, 3, 3, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    let nation = {}; let covered = 0;
    periods.forEach((p, i) => {
      const turn = i + 2; // a game's first resolved turn is 2
      if (!settlesThisTurn('eg', p, turn)) return;
      covered += turnsToSettle(nation, turn, p);
      nation = { ...nation, lodSettledTurn: turn };
    });
    expect(covered).toBe(nation.lodSettledTurn - 1); // turns 2..last settlement, none lost or doubled
  });
});
