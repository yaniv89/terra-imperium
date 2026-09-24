import { describe, it, expect } from 'vitest';
import {
  declareWar, assignDefaultWarGoal, buildWarGoal, checkWarGoal, hasCasusBelli, isWarBetween, isAtWarWithPlayer, resolveWarProgress,
  isInTruce, setTruce, getTradePactCapacity, recordBattle, getOccupationScore, updateTickScore, computeWarScore
} from './diplomacy';
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
  it('capture_region: true once the aggressor actually occupies the target region (plan §M13: occupiedBy, not owner)', () => {
    const state = usState();
    const war = { active: true, aggressor: 'us', enemy: 'ca', goal: { type: 'capture_region', regionId: cap('ca') } };
    expect(checkWarGoal(war, state)).toBe(false);
    const occupied = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], occupiedBy: 'us' } } };
    expect(checkWarGoal(war, occupied)).toBe(true);
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

describe('recordBattle (plan §M13)', () => {
  const war = { aggressor: 'us', enemy: 'ca', battleScore: 0 };

  it('moves battleScore toward the aggressor when the aggressor wins', () => {
    expect(recordBattle(war, 'us', 0.5)).toBeGreaterThan(0);
  });

  it('moves battleScore toward the enemy when the enemy wins', () => {
    expect(recordBattle(war, 'ca', 0.5)).toBeLessThan(0);
  });

  it('clamps at +/-40', () => {
    expect(recordBattle({ ...war, battleScore: 39 }, 'us', 1)).toBe(40);
    expect(recordBattle({ ...war, battleScore: -39 }, 'ca', 1)).toBe(-40);
  });

  it('scales magnitude up with a bigger lossShare', () => {
    expect(recordBattle(war, 'us', 1)).toBeGreaterThan(recordBattle(war, 'us', 0));
  });
});

describe('getOccupationScore (plan §M13)', () => {
  it('is 0 with no occupation either way', () => {
    const state = usState();
    expect(getOccupationScore(state, { aggressor: 'us', enemy: 'ca' })).toBe(0);
  });

  it('is positive when the aggressor occupies enemy territory', () => {
    const state = usState();
    const occupied = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], occupiedBy: 'us' } } };
    expect(getOccupationScore(occupied, { aggressor: 'us', enemy: 'ca' })).toBeGreaterThan(0);
  });

  it('is negative when the enemy occupies aggressor territory', () => {
    const state = usState();
    const occupied = { ...state, regions: { ...state.regions, [cap('us')]: { ...state.regions[cap('us')], occupiedBy: 'ca' } } };
    expect(getOccupationScore(occupied, { aggressor: 'us', enemy: 'ca' })).toBeLessThan(0);
  });
});

describe('updateTickScore (plan §M13)', () => {
  it('ticks up while the aggressor holds a capture_region goal', () => {
    const state = usState();
    const war = { aggressor: 'us', enemy: 'ca', tickScore: 0, startTurn: state.turnNumber, goal: { type: 'capture_region', regionId: cap('ca') } };
    const occupied = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], occupiedBy: 'us' } } };
    expect(updateTickScore(war, occupied)).toBe(1);
  });

  it('does not tick down before the grace period elapses', () => {
    const state = usState();
    const war = { aggressor: 'us', enemy: 'ca', tickScore: 0, startTurn: state.turnNumber, goal: { type: 'capture_region', regionId: cap('ca') } };
    expect(updateTickScore(war, state)).toBe(0);
  });

  it('ticks down once the grace period elapses without holding the goal', () => {
    const state = usState();
    const war = { aggressor: 'us', enemy: 'ca', tickScore: 0, startTurn: state.turnNumber - 5, goal: { type: 'capture_region', regionId: cap('ca') } };
    expect(updateTickScore(war, state)).toBe(-1);
  });

  it('stays at 0 for a destroy_military goal (no ticking territory to hold)', () => {
    const state = usState();
    const war = { aggressor: 'us', enemy: 'ca', tickScore: 0, startTurn: state.turnNumber, goal: { type: 'destroy_military', threshold: 1 } };
    expect(updateTickScore(war, state)).toBe(0);
  });
});

describe('computeWarScore (plan §M13)', () => {
  it('sums battle and tick components, clamped to +/-100', () => {
    const state = usState();
    const war = { aggressor: 'us', enemy: 'ca', battleScore: 40, tickScore: 25 };
    expect(computeWarScore(war, state)).toBe(65);
  });

  it('never exceeds the +/-100 clamp even with a large occupation component', () => {
    const state = usState();
    const war = { aggressor: 'us', enemy: 'ca', battleScore: 40, tickScore: 25 };
    const occupied = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], occupiedBy: 'us' } } };
    const score = computeWarScore(war, occupied);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(65);
  });
});

describe('resolveWarProgress (Task 32 + plan §M13: occupation, war score, and the peace machinery)', () => {
  // Mexico ('mx') is AI-declaring war on Canada ('ca') here — neither is the player ('us') — so
  // this exercises the pure AI-vs-AI path. Separate describes below exercise AI-vs-player.
  const aiWarState = (overrides = {}) => {
    const base = usState();
    // Inflates every ca region OTHER than its capital to a huge development value, so a single
    // capital capture's tripled occupation weight (getOccupationScore's own capital bonus) stays a
    // small fraction of ca's total dev — keeping these capture-mechanics tests decoupled from
    // whether the resulting occupation score happens to cross the AI-vs-AI peace threshold on real
    // Canada geography. The peace-machinery describe below tests that threshold directly instead.
    const capId = cap('ca');
    const regions = { ...base.regions };
    Object.keys(regions).forEach((id) => {
      if (regions[id].owner === 'ca' && id !== capId) regions[id] = { ...regions[id], dev: { tax: 1000, production: 1000, manpower: 1000 } };
    });
    const state = { ...base, regions };
    const war = {
      id: 'war_1', aggressor: 'mx', enemy: 'ca', active: true, goalAchieved: false,
      startYear: state.year, startTurn: state.turnNumber, cb: 'none',
      battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0,
      ...overrides
    };
    return { state: { ...state, wars: [war] }, war };
  };

  it('runs no capture roll for a war the player started, but still keeps its score bookkeeping', () => {
    const state = usState();
    const war = {
      id: 'war_1', aggressor: 'us', enemy: 'ca', active: true, goalAchieved: false, startYear: state.year, startTurn: state.turnNumber,
      cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'capture_region', regionId: cap('ca') }
    };
    const withWar = { ...state, wars: [war] };
    const result = resolveWarProgress(withWar, withWar.regions, withWar.nations, withWar.wars, alwaysRolls);
    expect(result.wars[0]).toEqual(war); // nothing moved: no capture roll, no attrition, score stays 0
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

  it('occupies (not annexes) the goal region when the capture roll succeeds (AI vs AI)', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap('ca') } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
    expect(result.regions[cap('ca')].owner).toBe('ca'); // unchanged — occupation, not annexation
    expect(result.regions[cap('ca')].occupiedBy).toBe('mx');
    expect(result.regions[cap('ca')].formerOwner).toBeUndefined();
  });

  it('an AI can occupy the PLAYER\'S region, exactly like any other nation', () => {
    const state = usState();
    const war = {
      id: 'war_1', aggressor: 'ca', enemy: 'us', active: true, goalAchieved: false, startYear: state.year, startTurn: state.turnNumber,
      cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'capture_region', regionId: cap('us') }
    };
    const withWar = { ...state, wars: [war] };
    const result = resolveWarProgress(withWar, withWar.regions, withWar.nations, withWar.wars, alwaysRolls);
    expect(result.regions[cap('us')].owner).toBe('us');
    expect(result.regions[cap('us')].occupiedBy).toBe('ca');
  });

  it('records the capture as a battle, moving battleScore toward the taker', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap('ca') } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
    expect(result.wars[0].battleScore).toBeGreaterThan(0);
  });

  it('does not occupy the region when the roll fails, and the war stays active', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap('ca') } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, neverRolls);
    expect(result.regions[cap('ca')].occupiedBy).toBeUndefined();
    expect(result.wars[0].active).toBe(true);
  });

  it('does not roll a capture once the target region already changed hands some other way', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap('ca') } });
    const alreadyLost = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], owner: 'us' } } };
    const result = resolveWarProgress(alreadyLost, alreadyLost.regions, alreadyLost.nations, alreadyLost.wars, alwaysRolls);
    expect(result.regions[cap('ca')].owner).toBe('us'); // unchanged by this war
  });

  it('does not re-roll once the aggressor already occupies the target region', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap('ca') } });
    const alreadyOccupied = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], occupiedBy: 'mx' } } };
    const result = resolveWarProgress(alreadyOccupied, alreadyOccupied.regions, alreadyOccupied.nations, alreadyOccupied.wars, alwaysRolls);
    expect(result.regions[cap('ca')].occupiedBy).toBe('mx');
  });

  it('sets goalAchieved (without ending the war outright) once a destroy_military goal is met', () => {
    const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 999999999 } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, neverRolls);
    expect(result.wars[0].goalAchieved).toBe(true);
    expect(result.wars[0].battleScore).toBe(40); // a crushed military counts as a maximally decisive battle
  });

  it('does not accrue Aggressive Expansion merely from occupying a region — only from land actually changing hands at peace (see peace.test.js)', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap('ca') } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
    expect(result.nations.ca.ae?.mx || 0).toBe(0);
  });

  describe('the peace machinery (plan §M13)', () => {
    it('ends a war in white peace once both sides are sufficiently war-exhausted', () => {
      const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 1 } });
      const exhausted = {
        ...state,
        nations: { ...state.nations, mx: { ...state.nations.mx, warExhaustion: 85 }, ca: { ...state.nations.ca, warExhaustion: 85 } }
      };
      const result = resolveWarProgress(exhausted, exhausted.regions, exhausted.nations, exhausted.wars, neverRolls);
      expect(result.wars[0].active).toBe(false);
      expect(result.nations.mx.truces.ca).toBe(state.turnNumber + 10);
    });

    it('concludes an AI-vs-AI war once the leading side is winning by enough and the loser\'s ledger accepts', () => {
      const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 1 }, battleScore: 95, goalAchieved: true });
      const result = resolveWarProgress(state, state.regions, state.nations, state.wars, neverRolls);
      expect(result.wars[0].active).toBe(false);
      expect(result.nations.mx.truces.ca).toBe(state.turnNumber + 10);
      expect(result.nations.ca.truces.mx).toBe(state.turnNumber + 10);
    });

    it('queues a pendingPeaceOffer for the player once an AI enemy is winning enough to demand terms', () => {
      const state = usState();
      const war = {
        id: 'war_1', aggressor: 'ca', enemy: 'us', active: true, goalAchieved: true, startYear: state.year, startTurn: state.turnNumber,
        cb: 'none', battleScore: 35, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 }
      };
      const withWar = { ...state, wars: [war] };
      const result = resolveWarProgress(withWar, withWar.regions, withWar.nations, withWar.wars, neverRolls);
      expect(result.pendingPeaceOffer).toBeTruthy();
      expect(result.pendingPeaceOffer.from).toBe('ca');
      expect(result.wars[0].active).toBe(true); // an offer, not an enforcement — the player still decides
    });

    it('enforces peace on the player outright once the AI is winning overwhelmingly', () => {
      const state = usState();
      const war = {
        id: 'war_1', aggressor: 'ca', enemy: 'us', active: true, goalAchieved: true, startYear: state.year, startTurn: state.turnNumber,
        cb: 'none', battleScore: 95, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 }
      };
      const withWar = { ...state, wars: [war] };
      const result = resolveWarProgress(withWar, withWar.regions, withWar.nations, withWar.wars, neverRolls);
      expect(result.wars[0].active).toBe(false);
      expect(result.pendingPeaceOffer).toBeNull();
    });

    it('an unrelated AI-vs-AI war processed the same turn does not disturb the player\'s pending offer', () => {
      const state = usState();
      const warA = {
        id: 'war_a', aggressor: 'ca', enemy: 'us', active: true, goalAchieved: true, startYear: state.year, startTurn: state.turnNumber,
        cb: 'none', battleScore: 35, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 }
      };
      const warB = {
        id: 'war_b', aggressor: 'mx', enemy: 'de', active: true, goalAchieved: false, startYear: state.year, startTurn: state.turnNumber,
        cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 }
      };
      const withWars = { ...state, wars: [warA, warB] };
      const result = resolveWarProgress(withWars, withWars.regions, withWars.nations, withWars.wars, neverRolls);
      expect(result.pendingPeaceOffer.warId).toBe('war_a');
      expect(result.wars.find(w => w.id === 'war_b').active).toBe(true);
    });
  });
});

describe('isInTruce / setTruce (plan §M12/M13)', () => {
  it('is false with no truce entry at all', () => {
    const state = usState();
    expect(isInTruce(state, 'us', 'ca')).toBe(false);
  });

  it('is true immediately after setTruce, on both sides', () => {
    const state = usState();
    const nations = setTruce(state.nations, 'us', 'ca', state.turnNumber);
    const withTruce = { ...state, nations };
    expect(isInTruce(withTruce, 'us', 'ca')).toBe(true);
    expect(isInTruce(withTruce, 'ca', 'us')).toBe(true);
  });

  it('expires after TRUCE_DURATION_TURNS turns', () => {
    const state = usState();
    const nations = setTruce(state.nations, 'us', 'ca', state.turnNumber);
    const later = { ...state, nations, turnNumber: state.turnNumber + 10 };
    expect(isInTruce(later, 'us', 'ca')).toBe(false);
  });

  it('is a no-op when either nation is missing', () => {
    const state = usState();
    expect(setTruce(state.nations, 'us', 'ghost', state.turnNumber)).toBe(state.nations);
  });
});

describe('getTradePactCapacity (plan §M8.3/§M12)', () => {
  it('is the base capacity with a neutral identity', () => {
    expect(getTradePactCapacity({ identity: { globalism: 0 } })).toBe(1);
  });

  it('is +1 for a Globalist nation', () => {
    expect(getTradePactCapacity({ identity: { globalism: 50 } })).toBe(2);
  });

  it('is -1, floored at 0, for an Isolationist nation', () => {
    expect(getTradePactCapacity({ identity: { globalism: -50 } })).toBe(0);
  });
});
