import { describe, it, expect } from 'vitest';
import { aiBudgetStep, AI_MIN_STANDING_UNITS } from './aiBudget';
import { settleAIUpkeep } from './aiEconomy';
import { applyBankruptcy } from './economy';
import { ARMY_MAINTENANCE_MIN, ARMY_MAINTENANCE_DEFAULT, BANKRUPTCY_DURATION_TURNS } from '../data/actionCosts';

const unit = (id, strength = 1000, extra = {}) => ({ id, ownerId: 'x', domain: 'land', classId: 'infantry', strength, ...extra });
const world = (nation, units) => ({
  turnNumber: 20, playerNationId: 'p', regions: {}, units: Object.fromEntries(units.map((u) => [u.id, u])),
  nations: { x: { id: 'x', economy: { gold: 0 }, ...nation } }
});

describe('aiBudgetStep (I124)', () => {
  it('does nothing while the books balance', () => {
    const units = [unit('a'), unit('b')];
    const s = world({ economy: { gold: 0 } }, units);
    const r = aiBudgetStep(s, 'x', { gold: 50 }, units);
    expect(r.nation).toBe(s.nations.x);
    expect(r.disband).toEqual([]);
  });

  it('lets savings carry a short deficit', () => {
    const units = [unit('a'), unit('b'), unit('c')];
    const s = world({ economy: { gold: 500 } }, units);
    const r = aiBudgetStep(s, 'x', { gold: 0 }, units);
    expect(r.nation).toBe(s.nations.x);
    expect(r.disband).toEqual([]);
  });

  it('counts this turn\'s income once: the gold it just earned is no saving (a Stone village went bankrupt on it)', () => {
    const units = Array.from({ length: 12 }, (_, i) => unit(`u${i}`, 1000 - i));
    const s = world({ economy: { gold: 25 } }, units); // nothing saved, 25 earned this turn, half pay 30
    const r = aiBudgetStep(s, 'x', { gold: 25 }, units);
    expect(r.disband.length).toBeGreaterThan(0);
    const after = settleAIUpkeep({ ...s, nations: { x: r.nation } }, 'x', { gold: 25 }, units.filter((u) => !r.disband.includes(u.id)));
    expect(after.loans || []).toEqual([]); // paid from this turn's income, no debt
    expect(after.lastBankruptcyTurn).toBeUndefined();
  });

  it('cuts pay first, then disbands the weakest units, keeping a standing force', () => {
    const units = [unit('a', 900), unit('b', 300), unit('c', 600), unit('s', 1000, { classId: 'settler' })];
    const s = world({ economy: { gold: 0 } }, units);
    const r = aiBudgetStep(s, 'x', { gold: 0 }, units);
    expect(r.nation.armyMaintenance).toBe(ARMY_MAINTENANCE_MIN);
    expect(r.disband).toEqual(['b', 'c']); // weakest first, never the settler
    expect(units.length - 1 - r.disband.length).toBe(AI_MIN_STANDING_UNITS);
  });

  it('never disbands a unit in a battle', () => {
    const units = [unit('a', 900), unit('b', 300)];
    const s = world({ economy: { gold: 0 } }, units);
    const r = aiBudgetStep(s, 'x', { gold: 0 }, units, (id) => id === 'b');
    expect(r.disband).toEqual(['a']);
  });

  it('restores full pay once the treasury can carry it', () => {
    const units = [unit('a')];
    const s = world({ armyMaintenance: ARMY_MAINTENANCE_MIN, economy: { gold: 200 } }, units);
    expect(aiBudgetStep(s, 'x', { gold: 10 }, units).nation.armyMaintenance).toBe(ARMY_MAINTENANCE_DEFAULT);
  });
});

describe('bankruptcy recovery (I124)', () => {
  it('a second bankruptcy refreshes the modifier instead of stacking it', () => {
    const once = applyBankruptcy({ id: 'x', modifiers: [] }, {}, 'x', 10).nation;
    const twice = applyBankruptcy(once, {}, 'x', 25).nation;
    expect(twice.modifiers.filter((m) => m.sourceId === 'bankruptcy')).toHaveLength(1);
    expect(twice.modifiers[0].expiresTurn).toBe(25 + BANKRUPTCY_DURATION_TURNS);
  });

  it('a shortfall inside the window leaves the troops unpaid, not a new bankruptcy', () => {
    const units = [unit('a')];
    const s = world({ economy: { gold: 0 }, lastBankruptcyTurn: 18, stability: -1 }, units);
    const n = settleAIUpkeep(s, 'x', { gold: 0 }, units);
    expect(n.lastBankruptcyTurn).toBe(18);
    expect(n.lastUnpaidTurn).toBe(20);
    expect(n.stability).toBe(-1);
    expect(n.economy.gold).toBe(0);
  });

  it('after the window a shortfall is a bankruptcy again', () => {
    const units = [unit('a')];
    const s = world({ economy: { gold: 0 }, lastBankruptcyTurn: 20 - BANKRUPTCY_DURATION_TURNS }, units);
    expect(settleAIUpkeep(s, 'x', { gold: 0 }, units).lastBankruptcyTurn).toBe(20);
  });
});
