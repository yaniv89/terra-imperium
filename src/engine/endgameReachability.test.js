// src/engine/endgameReachability.test.js
// Plan §13's "endgame reachability": an automated long-run test asserting each victory condition
// is achievable in principle, and that the space-race mission ladder can complete within the
// Modern Age's own turn budget rather than outlasting it.
//
// "Achievable in principle" is split into two kinds of proof here, matching how concretely each
// claim can actually be tested:
// - domination / economicHegemony / diplomatic / spaceAscendancy: construct a state that satisfies
//   the condition's real threshold (a genuine share of regions/GDP, a sustained alignment streak,
//   the ladder's final mission) and confirm resolveTurn — the same code path every real turn goes
//   through — actually ends the game with that victory. This is a regression guard on the
//   mechanism recognizing success, not a claim that an AI or scripted player reaches it unaided.
// - the space-race ladder: a real end-to-end simulation — advance the calendar to the mission
//   ladder's unlock year, then launch and wait out every mission in order through the actual
//   LAUNCH_MISSION reducer action and resolveTurn's own per-turn mission-progress ticking — proving
//   the full ladder both completes and fires Space Ascendancy victory within the Modern Age.
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { createInitialState, gameReducer } from '../context/GameContext';
import { ActionTypes, GameStatus } from '../data/types';
import { AGES, getYearsPerTurn } from '../data/ages';
import { SATELLITE_UNLOCK_YEAR } from '../data/satellites';
import { SPACE_MISSIONS, FINAL_SPACE_MISSION_ID } from '../data/spaceMissions';
import {
  DOMINATION_REGION_SHARE, ECONOMIC_HEGEMONY_GDP_SHARE, DIPLOMATIC_LEADERSHIP_STREAK_TURNS
} from '../data/victoryConditions';
import { WORLD_NATIONS } from '../data/worldNations';
import { HISTORICAL_EVENTS } from '../data/events';

const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});

// Isolates every test below from the scripted/procedural event pipeline, exactly like
// aiQualityBenchmark.test.js's freshWorld: a pending event makes resolveTurn a no-op, which would
// silently stall a long run rather than exercise the victory/space-race machinery under test.
const freshWorld = (playerNationId = 'fr') => ({
  ...createInitialState({ playerNationId }),
  firedEvents,
  proceduralEventCooldown: 999999
});

const advance = (state) => {
  const next = resolveTurn(state);
  return next.activeProceduralEvent ? { ...next, activeProceduralEvent: null } : next;
};

const advanceUntil = (state, predicate, maxTurns) => {
  let current = state;
  for (let i = 0; i < maxTurns; i++) {
    if (predicate(current)) return current;
    current = advance(current);
  }
  return current;
};

describe('endgame reachability: the game always resolves to a victory by 2300', () => {
  it('a passive run (no player actions at all) still reaches Score Victory by END_YEAR', () => {
    const MAX_TURNS = 1200; // Marathon's ~990-turn estimate (plan §3) plus generous headroom
    const state = advanceUntil(freshWorld(), (s) => s.gameStatus !== GameStatus.ACTIVE, MAX_TURNS);
    expect(state.gameStatus, 'the game never reached a victory within the turn budget').toBe(GameStatus.VICTORY);
    expect(state.year).toBeLessThanOrEqual(2300);
  });
});

describe('endgame reachability: each victory condition fires when its real threshold is met', () => {
  it('Domination: holding the region-share threshold ends the game as a Domination Victory', () => {
    const state = freshWorld();
    const regionIds = Object.keys(state.regions);
    const targetCount = Math.ceil(regionIds.length * DOMINATION_REGION_SHARE) + 1;
    const regions = { ...state.regions };
    regionIds.slice(0, targetCount).forEach((id) => { regions[id] = { ...regions[id], owner: state.playerNationId }; });
    const next = resolveTurn({ ...state, regions });
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('domination');
  });

  it('Economic Hegemony: holding the world-GDP-share threshold ends the game as an Economic Hegemony Victory', () => {
    const state = freshWorld();
    // GDP is far more concentrated than region count (a handful of nations hold most of it), so
    // reaching the GDP threshold this way stays well under the domination region-share threshold —
    // confirmed below — proving this is genuinely the GDP condition firing, not domination.
    const byGdpDesc = Object.entries(WORLD_NATIONS).sort((a, b) => (b[1].gdpMillions || 0) - (a[1].gdpMillions || 0));
    const totalGdp = byGdpDesc.reduce((sum, [, n]) => sum + (n.gdpMillions || 0), 0);
    const regions = { ...state.regions };
    let ownedGdp = 0;
    let ownedCount = 0;
    for (const [id, nation] of byGdpDesc) {
      if (ownedGdp / totalGdp >= ECONOMIC_HEGEMONY_GDP_SHARE) break;
      if (!regions[id]) continue;
      regions[id] = { ...regions[id], owner: state.playerNationId };
      ownedGdp += nation.gdpMillions || 0;
      ownedCount += 1;
    }
    expect(ownedCount / Object.keys(state.regions).length).toBeLessThan(DOMINATION_REGION_SHARE);
    const next = resolveTurn({ ...state, regions });
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('economicHegemony');
  });

  it('Diplomatic: a sustained majority-alignment streak ends the game as a Diplomatic Victory', () => {
    const state = freshWorld();
    const others = Object.values(state.nations).filter((n) => !n.isPlayer);
    const majorityCount = Math.floor(others.length / 2) + 1;
    const nations = { ...state.nations };
    others.slice(0, majorityCount).forEach((n) => { nations[n.id] = { ...n, hasTradeAgreement: true }; });
    // One turn short of the streak requirement, with the majority already aligned this turn too,
    // so resolveTurn's own streak increment (not a hand-set field) is what crosses the threshold —
    // the real mechanism under test, not a shortcut around it.
    const primed = { ...state, nations, diplomaticLeadershipStreak: DIPLOMATIC_LEADERSHIP_STREAK_TURNS - 1 };
    const next = resolveTurn(primed);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('diplomatic');
  });

  it('Space Ascendancy: completing the mission ladder ends the game as a Space Ascendancy Victory', () => {
    const state = freshWorld();
    const next = resolveTurn({ ...state, completedMissions: [FINAL_SPACE_MISSION_ID] });
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('spaceAscendancy');
  });
});

describe('endgame reachability: the space-race ladder completes within the Modern Age\'s turn budget', () => {
  // Plan §13: "the Modern Age is ~200 turns and must not outlast its own content." The ladder
  // itself only unlocks once a satellite can be launched (SATELLITE_UNLOCK_YEAR, 1957) — real
  // turns spent get the calendar there first, so what's actually checked below is the ladder's own
  // turn cost against what's LEFT of the Modern Age's ~200-turn budget after reaching 1957, not
  // the Modern Age's full 400-year span.
  it('launching every mission back-to-back, in order, completes the ladder and wins Space Ascendancy well inside the Modern Age', () => {
    const MODERN_AGE_YEARS = AGES.modern.endYear - AGES.modern.startYear;
    const MODERN_AGE_TURNS_NORMAL = Math.ceil(MODERN_AGE_YEARS / getYearsPerTurn('modern', 'normal'));
    const YEARS_INTO_MODERN_AT_UNLOCK = SATELLITE_UNLOCK_YEAR - AGES.modern.startYear;
    const TURNS_INTO_MODERN_AT_UNLOCK = Math.ceil(YEARS_INTO_MODERN_AT_UNLOCK / getYearsPerTurn('modern', 'normal'));
    const REMAINING_MODERN_BUDGET = MODERN_AGE_TURNS_NORMAL - TURNS_INTO_MODERN_AT_UNLOCK;

    let state = advanceUntil(freshWorld(), (s) => s.year >= SATELLITE_UNLOCK_YEAR, 400);
    expect(state.year, 'never reached the satellite-unlock year within the search budget').toBeGreaterThanOrEqual(SATELLITE_UNLOCK_YEAR);
    const turnsUsedToReachUnlock = state.turnNumber;

    SPACE_MISSIONS.forEach((mission) => {
      // Top up resources rather than simulating decades of realistic economic buildup between
      // launches — this test is about whether the ladder's own turn lengths fit the Modern Age's
      // budget, which is a fact about SPACE_MISSIONS' `turns` values, not about tax-rate tuning.
      state = {
        ...state,
        resources: { ...state.resources, gold: 999999, techPoints: 999999, actionPoints: 999 }
      };
      const afterLaunch = gameReducer(state, { type: ActionTypes.LAUNCH_MISSION, payload: { missionId: mission.id } });
      expect(afterLaunch.spaceMissionProgress[mission.id], `${mission.id} failed to launch`).toBe(mission.turns);
      state = advanceUntil(afterLaunch, (s) => s.completedMissions.includes(mission.id) || s.gameStatus !== GameStatus.ACTIVE, mission.turns + 1);
      expect(state.completedMissions, `${mission.id} never completed`).toContain(mission.id);
    });

    const turnsSpentOnLadder = state.turnNumber - turnsUsedToReachUnlock;
    expect(
      turnsSpentOnLadder,
      `the ladder itself took ${turnsSpentOnLadder} turns, over the ~${REMAINING_MODERN_BUDGET} turns left in the Modern Age after reaching the unlock year`
    ).toBeLessThan(REMAINING_MODERN_BUDGET);
    expect(state.year, 'the ladder finished after the game already ended (2300)').toBeLessThanOrEqual(2300);
    expect(state.gameStatus).toBe(GameStatus.VICTORY);
    expect(state.victoryConditionId).toBe('spaceAscendancy');
  });
});
