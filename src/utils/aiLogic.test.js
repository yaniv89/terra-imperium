import { describe, it, expect } from 'vitest';
import { processAINationTurn, shouldDeclareWar } from './aiLogic';
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
      const updates = processAINationTurn(nation, { regions: {}, nations: {}, phase: 'POST_STATE', invasions: [] }, 1950 + turn, rng, 0);
      hostility = Math.max(0, Math.min(100, hostility + updates.hostilityChange));
    }
    expect(hostility).toBeLessThan(100);
  });

  it('eventually decays below the seek-peace threshold (60) given enough turns', () => {
    let hostility = 100;
    const rng = createRng(7);
    for (let turn = 0; turn < 400 && hostility > 60; turn++) {
      const nation = { ...atWarNation(), hostility };
      const updates = processAINationTurn(nation, { regions: {}, nations: {}, phase: 'POST_STATE', invasions: [] }, 1950 + turn, rng, 0);
      hostility = Math.max(0, Math.min(100, hostility + updates.hostilityChange));
    }
    expect(hostility).toBeLessThanOrEqual(60);
  });
});

describe('processAINationTurn determinism', () => {
  it('produces identical results for the same rng sequence', () => {
    const a = processAINationTurn(atWarNation(), { regions: {}, nations: {}, phase: 'POST_STATE', invasions: [] }, 1950, createRng(99), 0);
    const b = processAINationTurn(atWarNation(), { regions: {}, nations: {}, phase: 'POST_STATE', invasions: [] }, 1950, createRng(99), 0);
    expect(a).toEqual(b);
  });
});

describe('shouldDeclareWar (Phase 4: AI nations can now initiate war on their own — was written but never called)', () => {
  const eligibleNation = () => ({
    id: 'egypt', isPlayer: false, isAtWar: false, hasPeaceTreaty: false, hostility: 80, doctrine: 'attrition'
  });
  const alwaysRolls = (value) => ({ next: () => value });

  it('can return true for an eligible nation on a low roll', () => {
    expect(shouldDeclareWar(eligibleNation(), { nations: {} }, alwaysRolls(0))).toBe(true);
  });

  it('never fires on a maximal roll (probabilities stay well under 1)', () => {
    expect(shouldDeclareWar(eligibleNation(), { nations: {} }, alwaysRolls(1))).toBe(false);
  });

  it('never fires if already at war', () => {
    const nation = { ...eligibleNation(), isAtWar: true };
    expect(shouldDeclareWar(nation, { nations: {} }, alwaysRolls(0))).toBe(false);
  });

  it('never fires if a peace treaty is in place', () => {
    const nation = { ...eligibleNation(), hasPeaceTreaty: true };
    expect(shouldDeclareWar(nation, { nations: {} }, alwaysRolls(0))).toBe(false);
  });

  it('bandwagon: a bloc-mate already at war with the player raises the chance', () => {
    // jordan (opportunist, bandwagonMult 1.8): warChance = (0.8*0.5+0.1)*0.05*0.8 = 0.02 alone,
    // 0.036 with a bloc-mate at war. A fixed roll of 0.03 falls strictly between the two.
    const jordan = { id: 'jordan', isPlayer: false, isAtWar: false, hasPeaceTreaty: false, hostility: 80, doctrine: 'opportunist' };
    const rng = alwaysRolls(0.03);
    expect(shouldDeclareWar(jordan, { nations: {} }, rng)).toBe(false);
    expect(shouldDeclareWar(jordan, { nations: { egypt: { isAtWar: true } } }, rng)).toBe(true);
  });

  it('difficulty (Phase 10): raises or lowers the war chance uniformly via state.difficultyMultiplier', () => {
    // egypt (historical enemy, aggression 0.7, attrition doctrine): at normal (mult 1) the final
    // chance is (0.8*0.7*1 + 0.1)*0.05 = 0.033; at easy (0.7) it's 0.0246; at hard (1.4) it's
    // 0.0442. A fixed roll of 0.028 falls between easy and normal; 0.04 falls between normal and hard.
    const egypt = eligibleNation();
    const lowRoll = alwaysRolls(0.028);
    expect(shouldDeclareWar(egypt, { nations: {}, difficultyMultiplier: 0.7 }, lowRoll)).toBe(false);
    expect(shouldDeclareWar(egypt, { nations: {}, difficultyMultiplier: 1 }, lowRoll)).toBe(true);

    const highRoll = alwaysRolls(0.04);
    expect(shouldDeclareWar(egypt, { nations: {}, difficultyMultiplier: 1 }, highRoll)).toBe(false);
    expect(shouldDeclareWar(egypt, { nations: {}, difficultyMultiplier: 1.4 }, highRoll)).toBe(true);
  });

  it('defaults to a 1x (no-op) difficulty multiplier when the field is absent (old saves)', () => {
    const egypt = eligibleNation();
    const rng = alwaysRolls(0.028);
    expect(shouldDeclareWar(egypt, { nations: {} }, rng)).toBe(shouldDeclareWar(egypt, { nations: {}, difficultyMultiplier: 1 }, rng));
  });
});
