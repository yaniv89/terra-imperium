import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from './GameContext';
import { ActionTypes, GameStatus, GamePhases } from '../data/types';
import { ACTION_COSTS } from '../data/actionCosts';
import { HISTORICAL_EVENTS } from '../data/events';

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

describe('EMERGENCY_INTERVENTION / SCORCHED_EARTH_DEFENSE (Phase 10: comeback mechanics)', () => {
  const crisisState = () => {
    const state = createInitialState();
    state.phase = GamePhases.POST_STATE;
    state.resources = { ...state.resources, diplomacyPoints: 999, money: 999999 };
    // Drive core control below the comeback threshold.
    Object.keys(state.regions).forEach(id => {
      if (state.regions[id].owner === 'player') state.regions[id] = { ...state.regions[id], control: 5 };
    });
    return state;
  };

  const safeState = () => {
    const state = createInitialState();
    state.phase = GamePhases.POST_STATE;
    state.resources = { ...state.resources, diplomacyPoints: 999, money: 999999 };
    // PRE_STATE core regions start well under 30% control by design (that's the whole point of
    // the early game) — DECLARE_INDEPENDENCE normally brings them to 100% on the real path to
    // POST_STATE, so a "not in crisis" fixture needs to set that explicitly too.
    Object.keys(state.regions).forEach(id => {
      if (state.regions[id].owner === 'player') state.regions[id] = { ...state.regions[id], control: 100 };
    });
    return state;
  };

  it('is a no-op outside of crisis (core control above the threshold)', () => {
    const state = safeState();
    expect(gameReducer(state, { type: ActionTypes.EMERGENCY_INTERVENTION })).toBe(state);
  });

  it('is a no-op before independence, even in crisis', () => {
    const state = crisisState();
    state.phase = GamePhases.PRE_STATE;
    expect(gameReducer(state, { type: ActionTypes.EMERGENCY_INTERVENTION })).toBe(state);
  });

  it('grants resources and cools every at-war nation\'s hostility, respecting hostilityFloor', () => {
    const state = crisisState();
    state.nations.egypt = { ...state.nations.egypt, isAtWar: true, hostility: 40, hostilityFloor: 0 };
    state.nations.syria = { ...state.nations.syria, isAtWar: true, hostility: 20, hostilityFloor: 10 };
    const next = gameReducer(state, { type: ActionTypes.EMERGENCY_INTERVENTION });
    expect(next).not.toBe(state);
    expect(next.resources.money).toBe(state.resources.money + 50000); // emergencyIntervention costs no money
    expect(next.resources.manpower).toBe(state.resources.manpower + 2000);
    expect(next.nations.egypt.hostility).toBe(25); // 40 - 15
    expect(next.nations.syria.hostility).toBe(10); // 20 - 15 = 5, floored at 10
  });

  it('does not touch a nation that is not at war', () => {
    const state = crisisState();
    const before = state.nations.egypt.hostility;
    const next = gameReducer(state, { type: ActionTypes.EMERGENCY_INTERVENTION });
    expect(next.nations.egypt.hostility).toBe(before);
  });

  it('rejects EMERGENCY_INTERVENTION when unaffordable', () => {
    const state = crisisState();
    state.resources.diplomacyPoints = 0;
    expect(gameReducer(state, { type: ActionTypes.EMERGENCY_INTERVENTION })).toBe(state);
  });

  it('SCORCHED_EARTH_DEFENSE adds a permanent, stacking defense bonus only in crisis', () => {
    const outsideCrisis = safeState();
    expect(gameReducer(outsideCrisis, { type: ActionTypes.SCORCHED_EARTH_DEFENSE })).toBe(outsideCrisis);

    const state = crisisState();
    const once = gameReducer(state, { type: ActionTypes.SCORCHED_EARTH_DEFENSE });
    expect(once.eventDefenseBonus).toBeCloseTo(0.1, 5);
    expect(once.resources.money).toBe(state.resources.money - ACTION_COSTS.scorchedEarthDefense.money);
    const twice = gameReducer(once, { type: ActionTypes.SCORCHED_EARTH_DEFENSE });
    expect(twice.eventDefenseBonus).toBeCloseTo(0.2, 5);
  });

  it('rejects SCORCHED_EARTH_DEFENSE when unaffordable', () => {
    const state = crisisState();
    state.resources.money = 0;
    expect(gameReducer(state, { type: ActionTypes.SCORCHED_EARTH_DEFENSE })).toBe(state);
  });
});

describe('FAST_FORWARD (Phase 10)', () => {
  const quietState = () => {
    const state = createInitialState();
    state.phase = GamePhases.POST_STATE;
    state.militaryUnits = { infantry: 999999, armor: 0, air: 0 }; // avoid an incidental DEFEAT
    state.firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id => [id, true]));
    // Every non-player nation pacified enough that a war can never start (hostility 0, plus
    // hasPeaceTreaty as the actual unconditional guard in shouldDeclareWar — hostility alone
    // isn't enough, since historical enemies get a flat war-chance bonus independent of it) —
    // a war starting is FAST_FORWARD's other, equally real stop condition. Kuwait is left
    // WITHOUT a peace treaty (but still hostility 0, and not a historical enemy, so it still
    // can never start a war on its own) so this fixture doesn't accidentally also satisfy the
    // diplomatic_hegemony victory condition (Phase 10) and end the game after one turn.
    Object.keys(state.nations).forEach(id => {
      if (state.nations[id].isPlayer || id === 'kuwait') return;
      state.nations[id] = { ...state.nations[id], hostility: 0, hasPeaceTreaty: true };
    });
    state.nations.kuwait = { ...state.nations.kuwait, hostility: 0 };
    return state;
  };

  it('advances multiple turns in one dispatch when nothing interesting happens', () => {
    const state = quietState();
    const next = gameReducer(state, { type: ActionTypes.FAST_FORWARD });
    expect(next.turnNumber).toBeGreaterThan(state.turnNumber + 1);
  });

  it('stops the moment a scripted event becomes active', () => {
    // Real PRE_STATE timeline, nothing pre-fired — petah_tikva_1878 is due well within the cap.
    // Hostility zeroed out so an AI-initiated war (a separate, also-real stop condition — see
    // resolveTurn.js's AI-initiated-war loop, which isn't gated to POST_STATE) can't fire first
    // and mask the one this test actually checks.
    const state = createInitialState();
    Object.keys(state.nations).forEach(id => {
      // hasPeaceTreaty is the actual unconditional guard in shouldDeclareWar — hostility alone
      // isn't enough, since historical enemies get a flat +0.1 war-chance bonus independent of
      // hostility, which was still enough to occasionally start a war within the 20-turn cap.
      if (!state.nations[id].isPlayer) state.nations[id] = { ...state.nations[id], hostility: 0, hasPeaceTreaty: true };
    });
    const next = gameReducer(state, { type: ActionTypes.FAST_FORWARD });
    expect(next.activeEventId).not.toBeNull();
  });

  it('is a no-op when an event is already pending', () => {
    const state = { ...quietState(), activeEventId: 'balfour_1917' };
    expect(gameReducer(state, { type: ActionTypes.FAST_FORWARD })).toBe(state);
  });

  it('is a no-op once the game has ended', () => {
    const state = { ...quietState(), gameStatus: GameStatus.DEFEAT };
    expect(gameReducer(state, { type: ActionTypes.FAST_FORWARD })).toBe(state);
  });

  it('never advances more than the turn cap in a single dispatch', () => {
    const state = quietState();
    const next = gameReducer(state, { type: ActionTypes.FAST_FORWARD });
    expect(next.turnNumber - state.turnNumber).toBeLessThanOrEqual(20);
  });

  it('preserves the full log history across every fast-forwarded turn', () => {
    const state = quietState();
    const next = gameReducer(state, { type: ActionTypes.FAST_FORWARD });
    expect(next.logs.length).toBeGreaterThan(state.logs.length);
  });
});
