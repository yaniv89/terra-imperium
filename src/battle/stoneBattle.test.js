// src/battle/stoneBattle.test.js
// Stone Age battles (eight ages plan, Phase C U37 to U40): the roster without horses, the guard on
// foot, Stone battle stats, and a Stone battle that plays to an end the same way twice.
import { describe, it, expect } from 'vitest';
import { getAvailableClasses, guardClassOf } from '../data/unitClasses';
import { getBattleStats } from './data/battleStats';
import { buildSetupFromArmies } from './setup/buildBattleSetup';
import { runHeadless } from './sim/headless';
import { createWorld } from './sim/world';
import { battleModelPairs } from './render/unitModels';
import { navalLinesFor } from '../data/navalLines';

const army = (prefix, classes, commanderId = null) => classes.map((classId, i) => ({
  id: `${prefix}${i}`, classId, strength: 800, maxStrength: 1000, morale: 100, promotions: [], commanderId: i === 0 ? commanderId : null, domain: 'land', xp: 0
}));
const stoneSetup = (seed, extra = {}) => buildSetupFromArmies({
  regionId: 'stone-test', terrain: 'forest', seed, attackerAgeId: 'stone', defenderAgeId: 'stone',
  attackerUnits: army('a', ['infantry', 'infantry', 'ranged', 'support'], 'g1'), defenderUnits: army('d', ['infantry', 'infantry', 'ranged']),
  generals: { g1: { id: 'g1', name: 'Chief', skill: 2 } }, controllers: ['ai', 'ai'], ...extra
});

describe('Stone roster and battle stats (U37)', () => {
  it('Stone has no cavalry and no air; its transports are dugout canoes', () => {
    expect(getAvailableClasses('stone')).not.toContain('cavalry');
    expect(getAvailableClasses('stone')).not.toContain('air');
    expect(navalLinesFor('stone')).toEqual(['transport']);
    expect(navalLinesFor('bronze')).toEqual(['warship']);
  });

  it("a Stone general's guard is infantry, a Bronze one's cavalry, and the model list follows", () => {
    expect(guardClassOf('stone')).toBe('infantry');
    expect(guardClassOf('bronze')).toBe('cavalry');
    const setup = stoneSetup(3);
    const w = createWorld(setup);
    expect(w.squads.find((q) => q.isGeneral).classId).toBe('infantry');
    expect(battleModelPairs(setup).map((p) => p.join(':'))).not.toContain('stone:cavalry');
  });

  it('Hunters shoot short and fast; a Warband loses heart faster; no Stone squad fights in ranks', () => {
    expect(getBattleStats('ranged', 'stone').range).toBeLessThan(getBattleStats('ranged', 'bronze').range);
    expect(getBattleStats('ranged', 'stone').attackTicks).toBeLessThan(getBattleStats('ranged', 'bronze').attackTicks);
    expect(getBattleStats('infantry', 'stone').moraleLoss).toBeGreaterThan(1);
    expect(getBattleStats('infantry', 'stone').noFormation).toBe(true);
    expect(getBattleStats('infantry', 'bronze').noFormation).toBeUndefined();
  });

  it('a Stone vs Stone battle runs to an end, the same way twice', () => {
    const a = runHeadless(stoneSetup(7));
    const b = runHeadless(stoneSetup(7));
    expect(a.world.ended).toBeTruthy();
    expect(a.hash).toBe(b.hash);
  });
});
