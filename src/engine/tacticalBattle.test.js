// src/engine/tacticalBattle.test.js
// Tactical Battles T5 exit gate (design/rts-battles-implementation-plan.md §17): BEGIN pays once
// and locks the units; the turn can't end mid-battle; RESOLVE applies exactly the invasion's own
// consequences from a sanitized result (no minting soldiers); ABANDON is auto-resolve with the same
// seed; and a real headless battle's result flows through RESOLVE end to end.
import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState, sanitizeTacticalResult } from './gameReducer';
import { ActionTypes } from '../data/types';
import { buildInvasionSetup } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';
import { estimateInvasionOdds } from './battleOdds';

const FR_BORDER = 'fr-59';
const BE_REGION = 'be-vwv';

const baseState = () => {
  const s = createInitialState({ playerNationId: 'fr' });
  return {
    ...s,
    resources: { ...s.resources, gold: 100000, hr: 100000, mil: 500, adm: 500, dip: 500 },
    wars: [...s.wars, { id: 'war_t', aggressor: 'fr', enemy: 'be', active: true, goalAchieved: false, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 } }]
  };
};
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 1000) => ({
  id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1
});
const withArmies = (state = baseState()) => ({
  ...state,
  units: {
    a1: unit('a1', FR_BORDER, 'fr'), a2: unit('a2', FR_BORDER, 'fr', 'cavalry'), a3: unit('a3', FR_BORDER, 'fr', 'ranged'),
    d1: unit('d1', BE_REGION, 'be'), d2: unit('d2', BE_REGION, 'be', 'ranged', 800)
  }
});
const begin = (s) => gameReducer(s, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });

describe('BEGIN_TACTICAL_BATTLE', () => {
  it('pays the invasion cost once, records the battle and locks both armies', () => {
    const s = withArmies();
    const next = begin(s);
    expect(next.pendingBattle).toMatchObject({ fromRegionId: FR_BORDER, targetRegionId: BE_REGION, attackerUnitIds: ['a1', 'a2', 'a3'], defenderUnitIds: ['d1', 'd2'], playerSide: 'attacker' });
    expect(next.resources.mil).toBeLessThan(s.resources.mil);
    // locked: can't move, can't end the turn, can't start a second battle
    const moved = gameReducer(next, { type: ActionTypes.MOVE_ARMY, payload: { unitId: 'a1', toRegionId: 'fr-62' } });
    expect(moved.units.a1.regionId).toBe(FR_BORDER);
    const turn = gameReducer(next, { type: ActionTypes.ADVANCE_TURN });
    expect(turn.turnNumber).toBe(next.turnNumber);
    expect(begin(next).pendingBattle.id).toBe(next.pendingBattle.id);
  });

  it('takes an undefended region immediately, like auto-resolve', () => {
    const s = baseState();
    const next = begin({ ...s, units: { a1: unit('a1', FR_BORDER, 'fr') } });
    expect(next.pendingBattle).toBeNull();
    expect(next.regions[BE_REGION].occupiedBy).toBe('fr');
  });

  it('refuses without a war, like LAUNCH_INVASION', () => {
    const s = withArmies({ ...baseState(), wars: [] });
    expect(begin(s).pendingBattle).toBeNull();
  });
});

describe('RESOLVE_TACTICAL_BATTLE', () => {
  it('applies a real headless battle through the invasion consequences and clears the lock', () => {
    const started = begin(withArmies());
    const setup = buildInvasionSetup(started, started.pendingBattle);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result } });
    expect(next.pendingBattle).toBeNull();
    expect(next.lastBattleReport.outcome).toBe(result.outcome);
    expect(next.lastBattleReport.tactical.mode).toBe('command');
    // every surviving attacker spent its move; strengths match the battle
    result.attackerUnits.forEach((u) => {
      if (u.strength > 0) { expect(next.units[u.id].strength).toBe(u.strength); expect(next.units[u.id].movesLeft).toBe(0); } else expect(next.units[u.id]).toBeUndefined();
    });
    expect(gameReducer(next, { type: ActionTypes.ADVANCE_TURN }).turnNumber).toBe(next.turnNumber + 1);
  });

  it('a decisive (keep taken) win captures the region outright', () => {
    const started = begin(withArmies());
    const pb = started.pendingBattle;
    const result = {
      outcome: 'attacker',
      attackerUnits: pb.attackerUnitIds.map((id) => ({ ...started.units[id] })),
      defenderUnits: pb.defenderUnitIds.map((id) => ({ ...started.units[id], strength: 0 })),
      report: { deployedAttackerIds: pb.attackerUnitIds, deployedDefenderIds: pb.defenderUnitIds, log: [], tactical: { decisive: true } }
    };
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result } });
    expect(next.regions[BE_REGION].occupiedBy).toBe('fr');
    expect(next.units.a1.regionId).toBe(BE_REGION);
  });

  it('never trusts the client: inflated strength, foreign ids and a bogus outcome are sanitized', () => {
    const started = begin(withArmies());
    const pb = started.pendingBattle;
    const tampered = {
      outcome: 'total_victory',
      attackerUnits: [{ ...started.units.a1, strength: 999999 }, { id: 'ghost', strength: 5000, classId: 'infantry' }],
      defenderUnits: [],
      report: { deployedAttackerIds: ['a1', 'ghost'], tactical: { decisive: 'yes', xpBonusById: { a1: 9999, ghost: 50 } } }
    };
    const safe = sanitizeTacticalResult(started, pb, tampered);
    expect(safe.outcome).toBe('defender');
    expect(safe.attackerUnits.find((u) => u.id === 'a1').strength).toBe(1000);
    expect(safe.attackerUnits.some((u) => u.id === 'ghost')).toBe(false);
    expect(safe.report.deployedAttackerIds).toEqual(['a1']);
    expect(safe.report.tactical.xpBonusById).toEqual({ a1: 20 });
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result: tampered } });
    expect(next.units.ghost).toBeUndefined();
    Object.values(next.units).forEach((u) => expect(u.strength).toBeLessThanOrEqual(1000));
  });

  it('ignores a result for a different battle id', () => {
    const started = begin(withArmies());
    expect(gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: 'nope', result: {} } })).toBe(started);
  });

  it('has no consequences if peace was signed meanwhile', () => {
    const started = begin(withArmies());
    const peaceful = { ...started, wars: started.wars.map((w) => ({ ...w, active: false })) };
    const next = gameReducer(peaceful, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result: { outcome: 'attacker', attackerUnits: [], defenderUnits: [], report: {} } } });
    expect(next.pendingBattle).toBeNull();
    expect(next.regions[BE_REGION]).toBe(peaceful.regions[BE_REGION]);
    expect(next.units).toBe(peaceful.units);
  });
});

describe('ABANDON_TACTICAL_BATTLE', () => {
  it('auto-resolves the same battle without charging again', () => {
    const started = begin(withArmies());
    const next = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    expect(next.pendingBattle).toBeNull();
    expect(next.resources.mil).toBe(started.resources.mil);
    expect(next.lastBattleReport).toBeTruthy();
    expect(next.lastBattleReport.tactical).toBeUndefined();
    // deterministic: same battle, same seed → same outcome
    expect(gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE }).lastBattleReport.outcome).toBe(next.lastBattleReport.outcome);
  });
});

describe('battle odds preview', () => {
  it('reports sensible probabilities from the real auto-resolve', () => {
    const s = withArmies();
    const odds = estimateInvasionOdds(s, FR_BORDER, BE_REGION, 100);
    expect(odds.attacker + odds.defender + odds.stalemate).toBeCloseTo(1, 5);
    expect(odds.attackerStrength).toBe(3000);
    expect(estimateInvasionOdds({ ...s, units: { a1: unit('a1', FR_BORDER, 'fr') } }, FR_BORDER, BE_REGION).undefended).toBe(true);
  });
});
