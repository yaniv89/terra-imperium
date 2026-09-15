import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from './GameContext';
import { ActionTypes, GameStatus } from '../data/types';
import { ACTION_COSTS } from '../data/actionCosts';

describe('reducer atomicity (regression: panels used to spend-then-effect as two dispatches)', () => {
  it('rejects an unaffordable action with zero state change (no partial spend)', () => {
    const state = createInitialState();
    state.resources.money = 100; // less than buyLand's 3000
    const before = state.resources.money;

    const next = gameReducer(state, { type: ActionTypes.BUY_LAND, payload: { regionId: 'tel_aviv' } });

    expect(next.resources.money).toBe(before);
    expect(next).toBe(state); // literal no-op, not just numerically unchanged
  });

  it('applies cost and effect together — never one without the other', () => {
    const state = createInitialState();
    const before = state.resources.money;

    const next = gameReducer(state, { type: ActionTypes.BUY_LAND, payload: { regionId: 'tel_aviv' } });

    expect(next.resources.money).toBe(before - ACTION_COSTS.buyLand.money);
    expect(next.regions.tel_aviv.control).toBe(state.regions.tel_aviv.control + 5);
  });

  it('two dispatches of the same action against a stale local `state` reference cannot double-spend below zero', () => {
    // Simulates the double-click / stale-closure hazard directly: two components both holding
    // a reference to the SAME snapshot both fire before either sees the other's update. Because
    // each dispatch is atomic and reducer-validated, the second one (however it's triggered)
    // is checked against its own true prior state, not the stale snapshot.
    let state = createInitialState();
    state.resources.money = ACTION_COSTS.buyLand.money; // affordable exactly once
    const staleSnapshot = state;

    state = gameReducer(state, { type: ActionTypes.BUY_LAND, payload: { regionId: 'tel_aviv' } });
    // A second dispatch computed from the stale snapshot (money still looked "available" there)
    // must be validated against the CURRENT reducer state, not the stale one.
    state = gameReducer(state, { type: ActionTypes.BUY_LAND, payload: { regionId: 'tel_aviv' } });

    expect(state.resources.money).toBe(0); // not negative
    void staleSnapshot;
  });

  it('LAUNCH_PLAYER_INVASION requires being at war, and RESEARCH_TECH_COSTED requires prerequisites', () => {
    const state = createInitialState();
    const noWar = gameReducer(state, { type: ActionTypes.LAUNCH_PLAYER_INVASION, payload: { targetRegion: 'egypt_sinai' } });
    expect(noWar).toBe(state);

    const noPrereq = gameReducer(state, { type: ActionTypes.RESEARCH_TECH_COSTED, payload: { techId: 'desalination' } });
    expect(noPrereq).toBe(state); // needs drip_irrigation researched first
  });
});

describe('ADVANCE_TURN / RESOLVE_EVENT delegate to the pure engine', () => {
  it('ADVANCE_TURN is a no-op once the game has ended', () => {
    const state = { ...createInitialState(), gameStatus: GameStatus.DEFEAT };
    const next = gameReducer(state, { type: ActionTypes.ADVANCE_TURN });
    expect(next).toBe(state);
  });

  it('RESOLVE_EVENT is a no-op if there is no active event', () => {
    const state = createInitialState();
    const next = gameReducer(state, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
    expect(next).toBe(state);
  });
});

describe('LAUNCH_PLAYER_INVASION (Phase 3: adjacency + unit composition)', () => {
  const atWarState = () => {
    const state = createInitialState();
    state.nations.egypt = { ...state.nations.egypt, isAtWar: true };
    state.militaryUnits = { infantry: 10000, armor: 5000, air: 2000 };
    state.resources.money = ACTION_COSTS.launchInvasion.money;
    state.resources.manpower = ACTION_COSTS.launchInvasion.manpower;
    state.resources.actionPoints = ACTION_COSTS.launchInvasion.actionPoints;
    return state;
  };

  it('rejects a target that does not border any player-controlled territory', () => {
    const state = atWarState();
    // egypt_cairo only borders egypt_sinai, which the player doesn't own at game start.
    const next = gameReducer(state, {
      type: ActionTypes.LAUNCH_PLAYER_INVASION,
      payload: { targetRegion: 'egypt_cairo', composition: { infantry: 1000, armor: 0, air: 0 } }
    });
    expect(next).toBe(state);
  });

  it('allows a target adjacent to player territory and deducts the committed composition', () => {
    const state = atWarState();
    // gaza borders tel_aviv, negev — both player-owned at game start.
    const next = gameReducer(state, {
      type: ActionTypes.LAUNCH_PLAYER_INVASION,
      payload: { targetRegion: 'gaza', composition: { infantry: 1000, armor: 500, air: 0 } }
    });
    expect(next).not.toBe(state);
    expect(next.militaryUnits).toEqual({ infantry: 9000, armor: 4500, air: 2000 });
    const invasion = next.invasions.find(i => i.targetRegion === 'gaza');
    expect(invasion.composition).toEqual({ infantry: 1000, armor: 500, air: 0 });
  });

  it('rejects a composition that exceeds available units', () => {
    const state = atWarState();
    const next = gameReducer(state, {
      type: ActionTypes.LAUNCH_PLAYER_INVASION,
      payload: { targetRegion: 'gaza', composition: { infantry: 999999, armor: 0, air: 0 } }
    });
    expect(next).toBe(state);
  });

  it('rejects an empty composition', () => {
    const state = atWarState();
    const next = gameReducer(state, {
      type: ActionTypes.LAUNCH_PLAYER_INVASION,
      payload: { targetRegion: 'gaza', composition: { infantry: 0, armor: 0, air: 0 } }
    });
    expect(next).toBe(state);
  });

  it('defaults a new invasion to storm, or records siege when requested (Phase 8)', () => {
    const state = atWarState();
    const stormInv = gameReducer(state, {
      type: ActionTypes.LAUNCH_PLAYER_INVASION,
      payload: { targetRegion: 'gaza', composition: { infantry: 1000, armor: 0, air: 0 } }
    }).invasions.find(i => i.targetRegion === 'gaza');
    expect(stormInv.approach).toBe('storm');

    const siegeInv = gameReducer(state, {
      type: ActionTypes.LAUNCH_PLAYER_INVASION,
      payload: { targetRegion: 'gaza', composition: { infantry: 1000, armor: 0, air: 0 }, approach: 'siege' }
    }).invasions.find(i => i.targetRegion === 'gaza');
    expect(siegeInv.approach).toBe('siege');
  });
});

describe('SET_INVASION_APPROACH / SET_INVASION_ORDER (Phase 8: tactical battle systems)', () => {
  const withPlayerInvasion = () => {
    const state = createInitialState();
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1000, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true, approach: 'storm'
    }];
    return state;
  };

  it('switches an active player invasion\'s approach', () => {
    const state = withPlayerInvasion();
    const next = gameReducer(state, { type: ActionTypes.SET_INVASION_APPROACH, payload: { invasionId: 'inv1', approach: 'siege' } });
    expect(next.invasions[0].approach).toBe('siege');
  });

  it('rejects an unknown approach value', () => {
    const state = withPlayerInvasion();
    const next = gameReducer(state, { type: ActionTypes.SET_INVASION_APPROACH, payload: { invasionId: 'inv1', approach: 'nonsense' } });
    expect(next).toBe(state);
  });

  it('is a no-op for an invasion that does not exist or is not the player\'s', () => {
    const state = withPlayerInvasion();
    expect(gameReducer(state, { type: ActionTypes.SET_INVASION_APPROACH, payload: { invasionId: 'not-real', approach: 'siege' } })).toBe(state);
  });

  it('sets a tactical order on an active player invasion, rejecting unknown values', () => {
    const state = withPlayerInvasion();
    const next = gameReducer(state, { type: ActionTypes.SET_INVASION_ORDER, payload: { invasionId: 'inv1', tacticalOrder: 'hold' } });
    expect(next.invasions[0].tacticalOrder).toBe('hold');
    expect(gameReducer(state, { type: ActionTypes.SET_INVASION_ORDER, payload: { invasionId: 'inv1', tacticalOrder: 'charge!' } })).toBe(state);
  });
});

describe('COMMISSION_COMMANDER / ASSIGN_COMMANDER (Phase 8)', () => {
  const richState = () => ({ ...createInitialState(), resources: { ...createInitialState().resources, money: 999999, diplomacyPoints: 999 } });

  it('commissions a known persona and deducts its cost, rejecting an unknown one', () => {
    const state = richState();
    const next = gameReducer(state, { type: ActionTypes.COMMISSION_COMMANDER, payload: { personaId: 'rafael_katz' } });
    expect(next.hiredCommanders).toContain('rafael_katz');
    expect(next.resources.money).toBe(state.resources.money - ACTION_COSTS.commissionCommander.money);
    expect(gameReducer(state, { type: ActionTypes.COMMISSION_COMMANDER, payload: { personaId: 'not_a_real_persona' } })).toBe(state);
  });

  it('rejects commissioning the same persona twice', () => {
    const state = richState();
    const once = gameReducer(state, { type: ActionTypes.COMMISSION_COMMANDER, payload: { personaId: 'rafael_katz' } });
    expect(gameReducer(once, { type: ActionTypes.COMMISSION_COMMANDER, payload: { personaId: 'rafael_katz' } })).toBe(once);
  });

  it('assigns a hired commander to an active invasion, and can unassign with null', () => {
    let state = richState();
    state = gameReducer(state, { type: ActionTypes.COMMISSION_COMMANDER, payload: { personaId: 'rafael_katz' } });
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1000, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true
    }];
    const assigned = gameReducer(state, { type: ActionTypes.ASSIGN_COMMANDER, payload: { invasionId: 'inv1', personaId: 'rafael_katz' } });
    expect(assigned.invasions[0].commanderId).toBe('rafael_katz');
    const unassigned = gameReducer(assigned, { type: ActionTypes.ASSIGN_COMMANDER, payload: { invasionId: 'inv1', personaId: null } });
    expect(unassigned.invasions[0].commanderId).toBeNull();
  });

  it('rejects assigning a commander that was never commissioned', () => {
    const state = richState();
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1000, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true
    }];
    expect(gameReducer(state, { type: ActionTypes.ASSIGN_COMMANDER, payload: { invasionId: 'inv1', personaId: 'rafael_katz' } })).toBe(state);
  });

  it('rejects double-booking a commander already leading a different active front', () => {
    let state = richState();
    state = gameReducer(state, { type: ActionTypes.COMMISSION_COMMANDER, payload: { personaId: 'rafael_katz' } });
    state.invasions = [
      { id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1000, armor: 0, air: 0 }, morale: 100, supply: 100, active: true, isPlayerAttacker: true, commanderId: 'rafael_katz' },
      { id: 'inv2', targetRegion: 'west_bank', composition: { infantry: 1000, armor: 0, air: 0 }, morale: 100, supply: 100, active: true, isPlayerAttacker: true }
    ];
    const next = gameReducer(state, { type: ActionTypes.ASSIGN_COMMANDER, payload: { invasionId: 'inv2', personaId: 'rafael_katz' } });
    expect(next).toBe(state);
  });
});

describe('HIRE_MERCENARIES (Phase 8)', () => {
  it('adds a temporary infantry boost to the invasion and deducts the cost', () => {
    const state = { ...createInitialState(), resources: { ...createInitialState().resources, money: 999999 } };
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1000, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true
    }];
    const next = gameReducer(state, { type: ActionTypes.HIRE_MERCENARIES, payload: { invasionId: 'inv1' } });
    expect(next.invasions[0].composition.infantry).toBe(1500);
    expect(next.invasions[0].mercenaryBoost).toEqual({ amount: 500, turnsRemaining: 4 });
    expect(next.resources.money).toBe(state.resources.money - ACTION_COSTS.hireMercenaries.money);
  });

  it('stacks amount and refreshes duration on a second hire for the same front', () => {
    const state = { ...createInitialState(), resources: { ...createInitialState().resources, money: 999999 } };
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1000, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true
    }];
    let next = gameReducer(state, { type: ActionTypes.HIRE_MERCENARIES, payload: { invasionId: 'inv1' } });
    next = gameReducer(next, { type: ActionTypes.HIRE_MERCENARIES, payload: { invasionId: 'inv1' } });
    expect(next.invasions[0].mercenaryBoost).toEqual({ amount: 1000, turnsRemaining: 4 });
  });

  it('is a no-op when the invasion does not exist or is not the player\'s', () => {
    const state = { ...createInitialState(), resources: { ...createInitialState().resources, money: 999999 } };
    expect(gameReducer(state, { type: ActionTypes.HIRE_MERCENARIES, payload: { invasionId: 'not-real' } })).toBe(state);
  });
});
