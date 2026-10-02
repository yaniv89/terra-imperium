import { describe, it, expect } from 'vitest';
import { VICTORY_CONDITIONS, checkVictoryConditions, applyVictory, isDiplomaticallyAligned, getDiplomaticAlignmentShare, DIPLOMATIC_LEADERSHIP_STREAK_TURNS, DOMINATION_CAPITAL_SHARE, CONQUEROR_CITY_SHARE, ECONOMIC_HEGEMONY_SHARE, ECONOMIC_ROUTE_SHARE, getEconomicShare } from './victoryConditions';
import { createInitialState } from '../context/GameContext';
import { GameStatus } from './types';
import { END_YEAR } from './ages';
import { FINAL_SPACE_MISSION_ID } from './spaceMissions';
import { getNationCapital } from './regions';

// Plan §M18: "Remove the free win. survival no longer grants VICTORY." — reaching END_YEAR is no
// longer a `check` in this table at all (see resolveTurn.test.js/endgameReachability.test.js for
// the real, ranked ending it's replaced with, src/engine/score.js). The two display-only entries
// kept for GameOverModal's lookup must never fire through checkVictoryConditions's own loop.
describe('eventVictory / finalScore (display-only entries)', () => {
  it('never fire on their own — checkVictoryConditions only ever returns null for them', () => {
    const state = createInitialState();
    expect(VICTORY_CONDITIONS.eventVictory.check(state)).toBe(false);
    expect(VICTORY_CONDITIONS.finalScore.check({ ...state, year: END_YEAR })).toBe(false);
  });
});

describe('domination (capitals held)', () => {
  it('is false at the start of a fresh game (owns no one else\'s capital)', () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
    expect(VICTORY_CONDITIONS.domination.check(state)).toBe(false);
  });

  it('is true once the player holds enough of the world\'s other capitals, a nation later eliminated still counting', () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
    const regions = { ...state.regions }; const nations = { ...state.nations };
    const otherNationIds = Object.keys(state.nations).filter(id => id !== 'fr');
    const needed = Math.ceil(otherNationIds.length * DOMINATION_CAPITAL_SHARE);
    let handedOver = 0;
    for (const nationId of otherNationIds) {
      const capitalId = getNationCapital(nationId);
      if (!capitalId) continue;
      regions[capitalId] = { ...regions[capitalId], owner: 'fr' };
      if (handedOver % 2 === 0) nations[nationId] = { ...nations[nationId], isEliminated: true };
      handedOver += 1;
      if (handedOver >= needed) break;
    }
    expect(VICTORY_CONDITIONS.domination.check({ ...state, regions, nations })).toBe(true);
  });
});

describe('conqueror (cities held)', () => {
  it('is false at the start and true once the player owns enough of the world\'s cities', () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
    expect(VICTORY_CONDITIONS.conqueror.check(state)).toBe(false);
    const regions = { ...state.regions };
    const ids = Object.keys(regions);
    ids.slice(0, Math.ceil(ids.length * (CONQUEROR_CITY_SHARE + 0.01))).forEach(id => { regions[id] = { ...regions[id], owner: 'fr' }; });
    expect(VICTORY_CONDITIONS.conqueror.check({ ...state, regions })).toBe(true);
  });
});

describe('economicHegemony (gold and trade)', () => {
  it('is false at the start and true once the player earns enough of the world\'s gold', () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
    expect(VICTORY_CONDITIONS.economicHegemony.check(state)).toBe(false);
    const regions = Object.fromEntries(Object.entries(state.regions).map(([id, r]) => [id, { ...r, lastYields: { ...(r.lastYields || {}), gold: r.owner === 'fr' ? 100000 : 10 } }]));
    const rich = { ...state, regions };
    expect(getEconomicShare(rich).share).toBeGreaterThan(ECONOMIC_HEGEMONY_SHARE);
    expect(VICTORY_CONDITIONS.economicHegemony.check(rich)).toBe(true);
    const traded = { ...state, nations: { ...state.nations, de: { ...state.nations.de, hasTradeAgreement: true } } };
    const deGold = Object.values(state.regions).filter((r) => r.owner === 'de').reduce((sum, r) => sum + Math.max(0, r.lastYields?.gold ?? r.dev?.tax ?? 0), 0);
    expect(getEconomicShare(traded).routes).toBeCloseTo(deGold * ECONOMIC_ROUTE_SHARE, 6);
    expect(getEconomicShare(traded).mine).toBeCloseTo(getEconomicShare(state).mine + deGold * ECONOMIC_ROUTE_SHARE, 6);
  });
});

describe('spaceAscendancy', () => {
  it('is false without completing the mission ladder', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(VICTORY_CONDITIONS.spaceAscendancy.check(state)).toBe(false);
    expect(VICTORY_CONDITIONS.spaceAscendancy.check({ ...state, completedMissions: ['sounding_rocket'] })).toBe(false);
  });

  it('is true once the final mission is completed', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(VICTORY_CONDITIONS.spaceAscendancy.check({ ...state, completedMissions: [FINAL_SPACE_MISSION_ID] })).toBe(true);
  });
});

describe('diplomatic', () => {
  it('is false without a sustained streak', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(VICTORY_CONDITIONS.diplomatic.check(state)).toBe(false);
    expect(VICTORY_CONDITIONS.diplomatic.check({ ...state, diplomaticLeadershipStreak: DIPLOMATIC_LEADERSHIP_STREAK_TURNS - 1 })).toBe(false);
  });

  it('is true once the streak reaches the required length', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(VICTORY_CONDITIONS.diplomatic.check({ ...state, diplomaticLeadershipStreak: DIPLOMATIC_LEADERSHIP_STREAK_TURNS })).toBe(true);
  });
});

describe('isDiplomaticallyAligned', () => {
  it('requires genuine engagement (trade or alliance), not just low hostility', () => {
    // Every real nation starts at hostility 5 (worldNations.js) — this must NOT count as aligned
    // on its own, or every game would win a Diplomatic Victory by turn ~20 for free.
    expect(isDiplomaticallyAligned({ hostility: 5 })).toBe(false);
    expect(isDiplomaticallyAligned({ hostility: 0 })).toBe(false);
  });

  it('is true with a trade agreement or a military pact', () => {
    expect(isDiplomaticallyAligned({ hasTradeAgreement: true, hostility: 90 })).toBe(true);
    expect(isDiplomaticallyAligned({ hasMilitaryPact: true, hostility: 90 })).toBe(true);
  });
});

describe('getDiplomaticAlignmentShare', () => {
  it('is 0 in a fresh game (no trade agreements or alliances exist yet)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(getDiplomaticAlignmentShare(state)).toBe(0);
  });

  it('excludes the player itself from the denominator', () => {
    const state = {
      nations: {
        us: { isPlayer: true, hasTradeAgreement: true },
        fr: { isPlayer: false, hasTradeAgreement: true },
        de: { isPlayer: false, hasTradeAgreement: false }
      }
    };
    expect(getDiplomaticAlignmentShare(state)).toBeCloseTo(0.5);
  });
});

describe('checkVictoryConditions', () => {
  it('returns null when nothing is satisfied', () => {
    expect(checkVictoryConditions(createInitialState())).toBeNull();
  });

  it('returns the id of a satisfied ambition', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), diplomaticLeadershipStreak: DIPLOMATIC_LEADERSHIP_STREAK_TURNS };
    expect(checkVictoryConditions(state)).toBe('diplomatic');
  });

  // Plan §M18: "Continue playing after victory" — an ambition already recorded as achieved must
  // not immediately re-fire the next turn just because its threshold, naturally, is often still met.
  it('skips an ambition already recorded in state.victoriesAchieved', () => {
    const state = {
      ...createInitialState({ playerNationId: 'fr' }),
      diplomaticLeadershipStreak: DIPLOMATIC_LEADERSHIP_STREAK_TURNS,
      victoriesAchieved: ['diplomatic']
    };
    expect(checkVictoryConditions(state)).toBeNull();
  });

  it('never returns the END_YEAR calendar limit on its own — that is resolveTurn.js\'s own ranked step, not a `check` in this table', () => {
    expect(checkVictoryConditions({ ...createInitialState(), year: END_YEAR })).toBeNull();
  });
});

describe('applyVictory', () => {
  it('sets gameStatus to VICTORY and records which condition triggered it', () => {
    const state = createInitialState();
    const next = applyVictory(state, 'domination');
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('domination');
  });

  it('does not mutate the input state', () => {
    const state = createInitialState();
    applyVictory(state, 'domination');
    expect(state.gameStatus).toBe(GameStatus.ACTIVE);
  });
});
