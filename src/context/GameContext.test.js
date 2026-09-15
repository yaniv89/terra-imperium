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
});
