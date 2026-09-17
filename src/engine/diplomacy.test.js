import { describe, it, expect } from 'vitest';
import { declareWar, assignDefaultWarGoal, buildWarGoal, checkWarGoal, hasCasusBelli } from './diplomacy';
import { createInitialState } from '../context/GameContext';

// Player is the US; Canada ('ca') and Mexico ('mx') are its real bordering nations.
const usState = () => createInitialState({ playerNationId: 'us' });

describe('assignDefaultWarGoal', () => {
  it('gives the player a capture_region goal against a nation with a bordering region', () => {
    const state = usState();
    const goal = assignDefaultWarGoal(state, 'ca', 'us');
    expect(goal.type).toBe('capture_region');
    expect(state.regions[goal.regionId].owner).toBe('ca');
  });

  it('falls back to destroy_military for the player when the nation has no bordering region', () => {
    const state = usState();
    const regions = { ...state.regions };
    Object.keys(regions).forEach(id => { regions[id] = { ...regions[id], owner: 'nobody' }; });
    const goal = assignDefaultWarGoal({ ...state, regions }, 'ca', 'us');
    expect(goal.type).toBe('destroy_military');
    expect(goal.threshold).toBeLessThan(state.nations.ca.militaryStrength);
  });

  it('gives a blitz/opportunist AI aggressor a capture_region goal when a target exists', () => {
    const state = usState();
    const aggressorId = 'mx';
    const withDoctrine = { ...state, nations: { ...state.nations, [aggressorId]: { ...state.nations[aggressorId], doctrine: 'blitz' } } };
    const goal = assignDefaultWarGoal(withDoctrine, 'us', aggressorId);
    expect(goal.type).toBe('capture_region');
    expect(state.regions[goal.regionId].owner).toBe('us');
  });

  it('gives an attrition/cautious AI aggressor a destroy_military goal', () => {
    const state = usState();
    const aggressorId = 'mx';
    const withDoctrine = { ...state, nations: { ...state.nations, [aggressorId]: { ...state.nations[aggressorId], doctrine: 'cautious' } } };
    const goal = assignDefaultWarGoal(withDoctrine, 'us', aggressorId);
    expect(goal.type).toBe('destroy_military');
  });
});

describe('buildWarGoal', () => {
  it('falls back to destroy_military when capture_region is requested but no target exists', () => {
    const state = usState();
    const regions = { ...state.regions };
    Object.keys(regions).forEach(id => { regions[id] = { ...regions[id], owner: 'nobody' }; });
    const goal = buildWarGoal({ ...state, regions }, 'ca', 'us', 'capture_region');
    expect(goal.type).toBe('destroy_military');
  });
});

describe('checkWarGoal', () => {
  it('capture_region: true once the aggressor actually holds the target region', () => {
    const state = usState();
    const war = { active: true, aggressor: 'us', enemy: 'ca', goal: { type: 'capture_region', regionId: 'ca' } };
    expect(checkWarGoal(war, state)).toBe(false);
    const captured = { ...state, regions: { ...state.regions, ca: { ...state.regions.ca, owner: 'us' } } };
    expect(checkWarGoal(war, captured)).toBe(true);
  });

  it('destroy_military: true once the enemy nation\'s strength drops to the threshold', () => {
    const state = usState();
    const war = { active: true, aggressor: 'us', enemy: 'ca', goal: { type: 'destroy_military', threshold: 5000 } };
    expect(checkWarGoal(war, state)).toBe(false);
    const weakened = { ...state, nations: { ...state.nations, ca: { ...state.nations.ca, militaryStrength: 4000 } } };
    expect(checkWarGoal(war, weakened)).toBe(true);
  });

  it('returns false for a war with no goal, an already-achieved goal, or an inactive war', () => {
    const state = usState();
    expect(checkWarGoal({ active: true, goal: null }, state)).toBe(false);
    expect(checkWarGoal({ active: true, goal: { type: 'destroy_military', threshold: 999999999 }, goalAchieved: true, aggressor: 'us', enemy: 'ca' }, state)).toBe(false);
    expect(checkWarGoal({ active: false, goal: { type: 'destroy_military', threshold: 999999999 }, aggressor: 'us', enemy: 'ca' }, state)).toBe(false);
  });
});

describe('declareWar', () => {
  it('auto-assigns a goal and records the aggressor', () => {
    const state = usState();
    const next = declareWar(state, 'ca', { aggressor: 'us' });
    const war = next.wars.find(w => w.enemy === 'ca');
    expect(war.aggressor).toBe('us');
    expect(war.goal).toBeTruthy();
    expect(war.goalAchieved).toBe(false);
  });

  it('records an explicit aggressor for an AI-initiated declaration', () => {
    const state = usState();
    const next = declareWar(state, 'us', { aggressor: 'ca' });
    const war = next.wars.find(w => w.enemy === 'us');
    expect(war.aggressor).toBe('ca');
  });

  it('uses an explicitly-supplied goal instead of auto-assigning one', () => {
    const state = usState();
    const goal = { type: 'destroy_military', threshold: 1 };
    const next = declareWar(state, 'ca', { aggressor: 'us', goal });
    expect(next.wars.find(w => w.enemy === 'ca').goal).toEqual(goal);
  });

  it('is a no-op when the nation is already at war', () => {
    const state = usState();
    const atWar = declareWar(state, 'ca', { aggressor: 'us' });
    expect(declareWar(atWar, 'ca', { aggressor: 'us' })).toBe(atWar);
  });

  it('consumes a fabricated claim the aggressor holds against the target', () => {
    const state = usState();
    const withClaim = { ...state, nations: { ...state.nations, us: { ...state.nations.us, claims: ['ca'] } } };
    const next = declareWar(withClaim, 'ca', { aggressor: 'us' });
    expect(next.nations.us.claims).not.toContain('ca');
  });

  it('leaves claims against other nations untouched', () => {
    const state = usState();
    const withClaims = { ...state, nations: { ...state.nations, us: { ...state.nations.us, claims: ['ca', 'mx'] } } };
    const next = declareWar(withClaims, 'ca', { aggressor: 'us' });
    expect(next.nations.us.claims).toEqual(['mx']);
  });

  it('marks the aggressor isAtWar too, not just the target — every isAtWar reader in the codebase means "a belligerent", not "the defender"', () => {
    const state = usState();
    const next = declareWar(state, 'ca', { aggressor: 'us' });
    expect(next.nations.us.isAtWar).toBe(true);
    expect(next.nations.ca.isAtWar).toBe(true);
  });
});

describe('hasCasusBelli', () => {
  it('is true when the aggressor has a fabricated claim against the target', () => {
    const state = usState();
    const withClaim = { ...state, nations: { ...state.nations, us: { ...state.nations.us, claims: ['ca'] } } };
    expect(hasCasusBelli(withClaim, 'us', 'ca')).toBe(true);
  });

  it('is true when the target is already sufficiently hostile, with no claim needed', () => {
    const state = usState();
    const hostile = { ...state, nations: { ...state.nations, ca: { ...state.nations.ca, hostility: 90 } } };
    expect(hasCasusBelli(hostile, 'us', 'ca')).toBe(true);
  });

  it('is false with neither a claim nor sufficient hostility', () => {
    const state = usState();
    const calm = { ...state, nations: { ...state.nations, ca: { ...state.nations.ca, hostility: 10 } } };
    expect(hasCasusBelli(calm, 'us', 'ca')).toBe(false);
  });
});
