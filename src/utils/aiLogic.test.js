import { describe, it, expect } from 'vitest';
import { processAINationTurn } from './aiLogic';
import { createRng } from './rng';

const atWarNation = () => ({
  id: 'egypt',
  isPlayer: false,
  isAtWar: true,
  hostility: 100,
  militaryStrength: 15000,
  aggression: 0.7
});

describe('processAINationTurn hostility (regression: peace was mathematically unreachable)', () => {
  it('can decay hostility while at war', () => {
    // Previously ALL hostility decay was gated behind `if (!nation.isAtWar)`, so DECLARE_WAR's
    // hostility:100 was a permanent floor and "seek peace" (which requires hostility <= 60)
    // could never be satisfied — every war was permanent. Run enough seeded turns and hostility
    // must be able to drop.
    let hostility = 100;
    const rng = createRng(1);
    for (let turn = 0; turn < 200; turn++) {
      const nation = { ...atWarNation(), hostility };
      const updates = processAINationTurn(nation, { regions: {}, phase: 'POST_STATE', invasions: [] }, 1950 + turn, rng, 0);
      hostility = Math.max(0, Math.min(100, hostility + updates.hostilityChange));
    }
    expect(hostility).toBeLessThan(100);
  });

  it('eventually decays below the seek-peace threshold (60) given enough turns', () => {
    let hostility = 100;
    const rng = createRng(7);
    for (let turn = 0; turn < 400 && hostility > 60; turn++) {
      const nation = { ...atWarNation(), hostility };
      const updates = processAINationTurn(nation, { regions: {}, phase: 'POST_STATE', invasions: [] }, 1950 + turn, rng, 0);
      hostility = Math.max(0, Math.min(100, hostility + updates.hostilityChange));
    }
    expect(hostility).toBeLessThanOrEqual(60);
  });
});

describe('processAINationTurn determinism', () => {
  it('produces identical results for the same rng sequence', () => {
    const a = processAINationTurn(atWarNation(), { regions: {}, phase: 'POST_STATE', invasions: [] }, 1950, createRng(99), 0);
    const b = processAINationTurn(atWarNation(), { regions: {}, phase: 'POST_STATE', invasions: [] }, 1950, createRng(99), 0);
    expect(a).toEqual(b);
  });
});
