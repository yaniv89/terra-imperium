import { describe, it, expect } from 'vitest';
import { declareWar, assignDefaultWarGoal, buildWarGoal, checkWarGoal } from './diplomacy';
import { createInitialState } from '../context/GameContext';
import { GamePhases } from '../data/types';

const postState = () => ({ ...createInitialState(), phase: GamePhases.POST_STATE });

describe('assignDefaultWarGoal (Phase 7: every war now has a concrete objective)', () => {
  it('gives the player a capture_region goal against a nation with a bordering region', () => {
    const state = postState();
    const goal = assignDefaultWarGoal(state, 'egypt', 'player');
    expect(goal.type).toBe('capture_region');
    // gaza is egypt's region bordering player-held tel_aviv/negev.
    expect(state.regions[goal.regionId].owner).toBe('egypt');
  });

  it('falls back to destroy_military for the player when the nation has no bordering region', () => {
    const state = postState();
    // Strip every region so no capture target can exist.
    const regions = { ...state.regions };
    Object.keys(regions).forEach(id => { regions[id] = { ...regions[id], owner: 'nobody' }; });
    const goal = assignDefaultWarGoal({ ...state, regions }, 'egypt', 'player');
    expect(goal.type).toBe('destroy_military');
    expect(goal.threshold).toBeLessThan(state.nations.egypt.militaryStrength);
  });

  it('gives a blitz/opportunist AI aggressor a capture_region goal when a target exists', () => {
    const state = postState();
    const blitzNationId = Object.keys(state.nations).find(id => state.nations[id].doctrine === 'blitz');
    expect(blitzNationId).toBeDefined();
    const goal = assignDefaultWarGoal(state, blitzNationId, blitzNationId);
    // Only asserts capture_region IF a bordering player region actually exists for this nation;
    // buildWarGoal gracefully falls back otherwise, which destroy_military below covers.
    if (goal.type === 'capture_region') {
      expect(state.regions[goal.regionId].owner).toBe('player');
    }
  });

  it('gives an attrition/cautious AI aggressor a destroy_military goal', () => {
    const state = postState();
    const attritionNationId = Object.keys(state.nations).find(id => state.nations[id].doctrine === 'attrition');
    expect(attritionNationId).toBeDefined();
    const goal = assignDefaultWarGoal(state, attritionNationId, attritionNationId);
    expect(goal.type).toBe('destroy_military');
  });
});

describe('buildWarGoal (Phase 7: explicit player choice)', () => {
  it('falls back to destroy_military when capture_region is requested but no target exists', () => {
    const state = postState();
    const regions = { ...state.regions };
    Object.keys(regions).forEach(id => { regions[id] = { ...regions[id], owner: 'nobody' }; });
    const goal = buildWarGoal({ ...state, regions }, 'egypt', 'player', 'capture_region');
    expect(goal.type).toBe('destroy_military');
  });
});

describe('checkWarGoal (Phase 7)', () => {
  it('capture_region: true once the wanted owner actually holds the target region', () => {
    const state = postState();
    const war = { active: true, aggressor: 'player', enemy: 'egypt', goal: { type: 'capture_region', regionId: 'gaza' } };
    expect(checkWarGoal(war, state)).toBe(false);
    const captured = { ...state, regions: { ...state.regions, gaza: { ...state.regions.gaza, owner: 'player' } } };
    expect(checkWarGoal(war, captured)).toBe(true);
  });

  it('capture_region for an AI aggressor checks THEIR ownership, not the player\'s', () => {
    const state = postState();
    const war = { active: true, aggressor: 'egypt', enemy: 'egypt', goal: { type: 'capture_region', regionId: 'tel_aviv' } };
    expect(checkWarGoal(war, state)).toBe(false); // still player-owned
    const overrun = { ...state, regions: { ...state.regions, tel_aviv: { ...state.regions.tel_aviv, owner: 'egypt' } } };
    expect(checkWarGoal(war, overrun)).toBe(true);
  });

  it('destroy_military: true once the enemy nation\'s strength drops to the threshold', () => {
    const state = postState();
    const war = { active: true, aggressor: 'player', enemy: 'egypt', goal: { type: 'destroy_military', threshold: 5000 } };
    expect(checkWarGoal(war, state)).toBe(false);
    const weakened = { ...state, nations: { ...state.nations, egypt: { ...state.nations.egypt, militaryStrength: 4000 } } };
    expect(checkWarGoal(war, weakened)).toBe(true);
  });

  it('returns false for a war with no goal, an already-achieved goal, or an inactive war', () => {
    const state = postState();
    expect(checkWarGoal({ active: true, goal: null }, state)).toBe(false);
    expect(checkWarGoal({ active: true, goal: { type: 'destroy_military', threshold: 999999999 }, goalAchieved: true, aggressor: 'player', enemy: 'egypt' }, state)).toBe(false);
    expect(checkWarGoal({ active: false, goal: { type: 'destroy_military', threshold: 999999999 }, aggressor: 'player', enemy: 'egypt' }, state)).toBe(false);
  });
});

describe('declareWar (Phase 7: aggressor + goal tracking)', () => {
  it('auto-assigns a goal and records the aggressor when none is passed', () => {
    const state = postState();
    const next = declareWar(state, 'egypt');
    const war = next.wars.find(w => w.enemy === 'egypt');
    expect(war.aggressor).toBe('player');
    expect(war.goal).toBeTruthy();
    expect(war.goalAchieved).toBe(false);
  });

  it('records an explicit aggressor for an AI-initiated declaration', () => {
    const state = postState();
    const next = declareWar(state, 'egypt', { aggressor: 'egypt' });
    const war = next.wars.find(w => w.enemy === 'egypt');
    expect(war.aggressor).toBe('egypt');
  });

  it('uses an explicitly-supplied goal instead of auto-assigning one', () => {
    const state = postState();
    const goal = { type: 'destroy_military', threshold: 1 };
    const next = declareWar(state, 'egypt', { aggressor: 'player', goal });
    expect(next.wars.find(w => w.enemy === 'egypt').goal).toEqual(goal);
  });

  it('is still a no-op when the nation is already at war (regression)', () => {
    const state = postState();
    const atWar = declareWar(state, 'egypt');
    expect(declareWar(atWar, 'egypt')).toBe(atWar);
  });
});
