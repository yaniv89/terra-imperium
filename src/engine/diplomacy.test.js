import { describe, it, expect } from 'vitest';
import { declareWar, assignDefaultWarGoal, buildWarGoal, checkWarGoal, hasCasusBelli, isWarBetween, isAtWarWithPlayer, resolveWarProgress } from './diplomacy';
import { createInitialState } from '../context/GameContext';
import { getNationCapital } from '../data/regions';

// A nation now spans many real provinces, not one region matching its own id — these tests use
// each nation's capital as "its" region wherever the old one-region-per-nation model used the
// nation id directly as a region id.
const cap = getNationCapital;

const alwaysRolls = { next: () => 0 };       // guarantees any probability check < 1 succeeds
const neverRolls = { next: () => 0.999999 }; // guarantees any realistic probability check fails

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
    const war = { active: true, aggressor: 'us', enemy: 'ca', goal: { type: 'capture_region', regionId: cap('ca') } };
    expect(checkWarGoal(war, state)).toBe(false);
    const captured = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], owner: 'us' } } };
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

describe('isWarBetween', () => {
  it('matches regardless of which id is the aggressor and which is the enemy', () => {
    const war = { aggressor: 'ca', enemy: 'us' };
    expect(isWarBetween(war, 'us', 'ca')).toBe(true);
    expect(isWarBetween(war, 'ca', 'us')).toBe(true);
  });

  it('does not match a war between two unrelated nations', () => {
    const war = { aggressor: 'ca', enemy: 'us' };
    expect(isWarBetween(war, 'mx', 'us')).toBe(false);
  });
});

describe('isAtWarWithPlayer', () => {
  // Regression: nation.isAtWar means "in a war with ANYONE" (used for AI-tiering), and several UI
  // surfaces were reading it as "at war with the player" — so two AI nations fighting each other
  // showed up as if they'd declared war on you (map coloring, the Military/Diplomacy tabs' war
  // lists and badges). isAtWarWithPlayer is the one function all of those must use instead.
  const stateWith = (wars, playerNationId = 'us') => ({ playerNationId, wars });

  it('is true when the player is a side of an active war', () => {
    const state = stateWith([{ aggressor: 'de', enemy: 'us', active: true }]);
    expect(isAtWarWithPlayer(state, 'de')).toBe(true);
  });

  it('is false for a war between two other nations, even though both are isAtWar', () => {
    const state = stateWith([{ aggressor: 'eg', enemy: 'ps', active: true }]);
    expect(isAtWarWithPlayer(state, 'eg')).toBe(false);
    expect(isAtWarWithPlayer(state, 'ps')).toBe(false);
  });

  it('is false once the war against the player is no longer active', () => {
    const state = stateWith([{ aggressor: 'de', enemy: 'us', active: false }]);
    expect(isAtWarWithPlayer(state, 'de')).toBe(false);
  });
});

describe('resolveWarProgress (Task 32: AI-vs-AI/AI-vs-player territorial conquest)', () => {
  // Mexico ('mx') is AI-declaring war on Canada ('ca') here — neither is the player ('us') — so
  // this exercises the pure AI-vs-AI path. A separate test below exercises AI-vs-player.
  const aiWarState = (overrides = {}) => {
    const state = usState();
    const war = { id: 'war_1', aggressor: 'mx', enemy: 'ca', active: true, goalAchieved: false, startYear: state.year, ...overrides };
    return { state: { ...state, wars: [war] }, war };
  };

  it('leaves a war the player started completely untouched', () => {
    const state = usState();
    const war = { id: 'war_1', aggressor: 'us', enemy: 'ca', active: true, goalAchieved: false, startYear: state.year, goal: { type: 'capture_region', regionId: cap('ca') } };
    const withWar = { ...state, wars: [war] };
    const result = resolveWarProgress(withWar, withWar.regions, withWar.nations, withWar.wars, alwaysRolls);
    expect(result.wars[0]).toEqual(war);
    expect(result.regions).toBe(withWar.regions);
    expect(result.nations).toBe(withWar.nations);
  });

  it('leaves an inactive war untouched', () => {
    const { state, war } = aiWarState({ active: false, goal: { type: 'capture_region', regionId: cap('ca') } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
    expect(result.wars[0]).toEqual(war);
  });

  it('applies mutual military attrition to both belligerents every turn the war runs', () => {
    const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 1 } });
    const before = { mx: state.nations.mx.militaryStrength, ca: state.nations.ca.militaryStrength };
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, neverRolls);
    expect(result.nations.mx.militaryStrength).toBeLessThan(before.mx);
    expect(result.nations.ca.militaryStrength).toBeLessThan(before.ca);
  });

  it('captures the goal region and ends the war (AI vs AI) when the roll succeeds', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap('ca') } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
    expect(result.regions[cap('ca')].owner).toBe('mx');
    expect(result.regions[cap('ca')].formerOwner).toBe('ca');
    expect(result.wars[0].active).toBe(false);
    expect(result.wars[0].goalAchieved).toBe(true);
    expect(result.nations.mx.isAtWar).toBe(false);
    expect(result.nations.ca.isAtWar).toBe(false);
    expect(result.nations.mx.hasPeaceTreaty).toBe(true);
    expect(result.nations.ca.hasPeaceTreaty).toBe(true);
  });

  it('an AI can capture the PLAYER\'S region and end the war, exactly like any other nation', () => {
    const state = usState();
    const war = { id: 'war_1', aggressor: 'ca', enemy: 'us', active: true, goalAchieved: false, startYear: state.year, goal: { type: 'capture_region', regionId: cap('us') } };
    const withWar = { ...state, wars: [war] };
    const result = resolveWarProgress(withWar, withWar.regions, withWar.nations, withWar.wars, alwaysRolls);
    expect(result.regions[cap('us')].owner).toBe('ca');
    expect(result.regions[cap('us')].formerOwner).toBe('us');
    expect(result.nations.us.isAtWar).toBe(false);
  });

  it('does not capture the region when the roll fails, and the war stays active', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap('ca') } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, neverRolls);
    expect(result.regions[cap('ca')].owner).toBe('ca');
    expect(result.wars[0].active).toBe(true);
  });

  it('does not roll a capture once the target region already changed hands some other way', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap('ca') } });
    const alreadyLost = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], owner: 'us' } } };
    const result = resolveWarProgress(alreadyLost, alreadyLost.regions, alreadyLost.nations, alreadyLost.wars, alwaysRolls);
    expect(result.regions[cap('ca')].owner).toBe('us'); // unchanged by this war
  });

  it('ends the war once a destroy_military goal is met, regardless of the capture roll', () => {
    const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 999999999 } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, neverRolls);
    expect(result.wars[0].active).toBe(false);
    expect(result.wars[0].goalAchieved).toBe(true);
    expect(result.nations.mx.isAtWar).toBe(false);
    expect(result.nations.ca.isAtWar).toBe(false);
  });
});
