import { describe, it, expect } from 'vitest';
import {
  VICTORY_CONDITIONS, checkVictoryConditions, applyVictory, isDiplomaticallyAligned,
  getDiplomaticAlignmentShare, DIPLOMATIC_LEADERSHIP_STREAK_TURNS, CONQUEROR_CAPITAL_SHARE,
  ECONOMIC_HEGEMONY_GDP_SHARE
} from './victoryConditions';
import { createInitialState } from '../context/GameContext';
import { GameStatus } from './types';
import { END_YEAR } from './ages';
import { FINAL_SPACE_MISSION_ID } from './spaceMissions';
import { WORLD_NATIONS } from './worldNations';
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

describe('domination', () => {
  it('is false at the start of a fresh game (owns only its own one region of 240)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(VICTORY_CONDITIONS.domination.check(state)).toBe(false);
  });

  it('is true once the player owns enough of the world\'s regions', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const regions = { ...state.regions };
    const ids = Object.keys(regions);
    const ownedCount = Math.ceil(ids.length * 0.41);
    ids.slice(0, ownedCount).forEach(id => { regions[id] = { ...regions[id], owner: 'fr' }; });
    expect(VICTORY_CONDITIONS.domination.check({ ...state, regions })).toBe(true);
  });
});

describe('conqueror', () => {
  it('is false at the start of a fresh game (owns no one else\'s capital)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(VICTORY_CONDITIONS.conqueror.check(state)).toBe(false);
  });

  it('is true once the player holds enough of the world\'s other capitals', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const regions = { ...state.regions };
    const otherNationIds = Object.keys(state.nations).filter(id => id !== 'fr');
    const neededCapitals = Math.ceil(otherNationIds.length * CONQUEROR_CAPITAL_SHARE);
    let handedOver = 0;
    for (const nationId of otherNationIds) {
      const capitalId = getNationCapital(nationId);
      if (!capitalId) continue;
      regions[capitalId] = { ...regions[capitalId], owner: 'fr' };
      handedOver += 1;
      if (handedOver >= neededCapitals) break;
    }
    expect(VICTORY_CONDITIONS.conqueror.check({ ...state, regions })).toBe(true);
  });

  it('still credits a capital taken from a nation later fully eliminated', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const otherNationIds = Object.keys(state.nations).filter(id => id !== 'fr');
    const regions = { ...state.regions };
    const nations = { ...state.nations };
    const neededCapitals = Math.ceil(otherNationIds.length * CONQUEROR_CAPITAL_SHARE);
    let handedOver = 0;
    for (const nationId of otherNationIds) {
      const capitalId = getNationCapital(nationId);
      if (!capitalId) continue;
      regions[capitalId] = { ...regions[capitalId], owner: 'fr' };
      nations[nationId] = { ...nations[nationId], isEliminated: true };
      handedOver += 1;
      if (handedOver >= neededCapitals) break;
    }
    expect(VICTORY_CONDITIONS.conqueror.check({ ...state, regions, nations })).toBe(true);
  });
});

describe('economicHegemony', () => {
  it('is false at the start of a fresh game', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(VICTORY_CONDITIONS.economicHegemony.check(state)).toBe(false);
  });

  it('is true once the player\'s owned regions carry enough of the world\'s GDP', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const regions = { ...state.regions };
    // Hand France every REGION belonging to the world's biggest economies (a nation is many real
    // provinces now, not one region matching its own id) until the share clears the threshold —
    // real per-region gdpMillions data means this is a real computation, not a fixture stub.
    let totalGdp = 0;
    Object.values(regions).forEach(r => { totalGdp += r.gdpMillions || 0; });
    const regionIdsByNation = {};
    Object.entries(state.regions).forEach(([id, r]) => { (regionIdsByNation[r.owner] ||= []).push(id); });
    const sortedNationIds = Object.keys(WORLD_NATIONS).sort((a, b) => (WORLD_NATIONS[b].gdpMillions || 0) - (WORLD_NATIONS[a].gdpMillions || 0));
    let ownedGdp = 0;
    for (const nationId of sortedNationIds) {
      (regionIdsByNation[nationId] || []).forEach((id) => {
        regions[id] = { ...regions[id], owner: 'fr' };
        ownedGdp += regions[id].gdpMillions || 0;
      });
      if (ownedGdp / totalGdp >= ECONOMIC_HEGEMONY_GDP_SHARE) break;
    }
    expect(VICTORY_CONDITIONS.economicHegemony.check({ ...state, regions })).toBe(true);
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
